export type RequestJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  headers?: HeadersInit;
  maxBytes?: number;
};

// Cap how long we will honor an upstream Retry-After. A hostile or misconfigured
// provider could otherwise return a huge value and stall the request past the
// serverless budget.
const MAX_RETRY_AFTER_MS = 2_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry-After is either delta-seconds or an HTTP-date. Returns ms-to-wait, or null.
function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

/**
 * Race a promise against a wall-clock budget. Resolves with the promise's value
 * if it settles first; rejects with `<label>_timeout` if the budget elapses
 * first. Always clears the timer so it never keeps the event loop alive.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function requestJsonWithRetry<T>(url: string, options: RequestJsonOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 4_500;
  const retries = Math.max(0, Math.min(3, options.retries ?? 1));
  const maxBytes = Math.max(1, Math.min(5_000_000, options.maxBytes ?? 1_000_000));

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let retryAfterMs: number | null = null;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        // Honor a (bounded) Retry-After when the provider rate-limits or is
        // briefly unavailable, so the retry backs off instead of hammering it.
        if (response.status === 429 || response.status === 503) {
          retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return JSON.parse(await readResponseTextWithLimit(response, maxBytes)) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const baseMs = 180 * (attempt + 1);
        const jitterMs = Math.floor(Math.random() * baseMs * 0.5);
        const backoffMs = baseMs + jitterMs;
        const waitMs =
          retryAfterMs !== null ? Math.min(Math.max(backoffMs, retryAfterMs), MAX_RETRY_AFTER_MS) : backoffMs;
        await wait(waitMs);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("payload_too_large");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const fallback = Buffer.from(await response.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      throw new Error("payload_too_large");
    }

    return fallback.toString("utf8");
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = Buffer.from(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error("payload_too_large");
      }

      chunks.push(chunk);
    }
  } finally {
    // Release the stream on every exit path (success, over-limit throw, or an
    // abort mid-stream) so the underlying connection isn't leaked.
    reader.cancel().catch(() => {});
  }

  return Buffer.concat(chunks).toString("utf8");
}
