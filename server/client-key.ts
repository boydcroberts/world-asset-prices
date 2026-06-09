import { isIP } from "node:net";

type HeaderValue = string | string[] | undefined;

export type ClientKeyRequest = {
  headers?: Record<string, HeaderValue>;
  socket?: {
    remoteAddress?: string;
  };
};

export function getRequestHeader(request: ClientKeyRequest, key: string): string | null {
  const value = request.headers?.[key.toLowerCase()] ?? request.headers?.[key];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
}

function normalizeIp(value: string | null): string | null {
  const candidate = value?.split(",")[0]?.trim();
  if (!candidate || isIP(candidate) === 0) {
    return null;
  }

  return candidate;
}

export function getClientKey(request: ClientKeyRequest): string {
  if (process.env.VERCEL === "1") {
    // On Vercel only x-vercel-forwarded-for is edge-set; x-real-ip /
    // x-forwarded-for can be client-supplied and would let callers pick
    // their own rate-limit key.
    const forwarded = normalizeIp(getRequestHeader(request, "x-vercel-forwarded-for"));
    if (forwarded) {
      return forwarded;
    }
  } else if (process.env.TRUST_PROXY_HEADERS === "true") {
    const forwarded =
      normalizeIp(getRequestHeader(request, "x-real-ip")) ??
      normalizeIp(getRequestHeader(request, "x-forwarded-for"));

    if (forwarded) {
      return forwarded;
    }
  }

  return normalizeIp(request.socket?.remoteAddress ?? null) ?? "unknown";
}
