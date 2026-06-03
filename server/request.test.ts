import { afterEach, describe, expect, it, vi } from "vitest";

import { readResponseTextWithLimit, requestJsonWithRetry, withTimeout } from "./request";

describe("requestJsonWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects JSON responses that exceed the configured byte limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ payload: "x".repeat(128) }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": "256",
          },
        }),
      ),
    );

    await expect(requestJsonWithRetry("https://api.example.test/data", { maxBytes: 32, retries: 0 })).rejects.toThrow(
      "payload_too_large",
    );
  });

  it("retries a 429 rate-limit response and succeeds on the next attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestJsonWithRetry<{ ok: boolean }>("https://api.example.test/data", { retries: 1 });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("withTimeout", () => {
  it("resolves with the value when the promise settles before the budget", async () => {
    await expect(withTimeout(Promise.resolve(42), 1_000)).resolves.toBe(42);
  });

  it("rejects with a labelled timeout when the budget elapses first", async () => {
    await expect(withTimeout(new Promise(() => {}), 10, "segment")).rejects.toThrow("segment_timeout");
  });
});

describe("readResponseTextWithLimit", () => {
  it("cancels the stream reader when the payload exceeds the limit", async () => {
    const cancel = vi.fn(async () => {});
    let sent = false;
    const fakeResponse = {
      headers: { get: () => null },
      body: {
        getReader() {
          return {
            read: async () => {
              if (sent) {
                return { done: true, value: undefined };
              }
              sent = true;
              return { done: false, value: new Uint8Array(100) };
            },
            cancel,
          };
        },
      },
    } as unknown as Response;

    await expect(readResponseTextWithLimit(fakeResponse, 32)).rejects.toThrow("payload_too_large");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
