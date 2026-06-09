import { afterEach, describe, expect, it } from "vitest";

import { getClientKey } from "./client-key";

describe("getClientKey", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not trust request-supplied Vercel headers outside a trusted proxy environment", () => {
    process.env = { ...originalEnv };
    delete process.env.VERCEL;
    delete process.env.TRUST_PROXY_HEADERS;

    expect(
      getClientKey({
        headers: {
          "x-vercel-id": "cle1::spoofed",
          "x-forwarded-for": "198.51.100.9",
        },
        socket: {
          remoteAddress: "192.0.2.44",
        },
      }),
    ).toBe("192.0.2.44");
  });

  it("trusts forwarding headers only when enabled by server-side environment", () => {
    process.env = { ...originalEnv, TRUST_PROXY_HEADERS: "true" };

    expect(
      getClientKey({
        headers: {
          "x-forwarded-for": "198.51.100.9",
        },
        socket: {
          remoteAddress: "192.0.2.44",
        },
      }),
    ).toBe("198.51.100.9");
  });

  it("trusts only the edge-set header on Vercel, ignoring spoofable fallbacks", () => {
    process.env = { ...originalEnv, VERCEL: "1" };

    expect(
      getClientKey({
        headers: {
          "x-vercel-forwarded-for": "198.51.100.7",
          "x-real-ip": "203.0.113.99",
          "x-forwarded-for": "203.0.113.99",
        },
        socket: {
          remoteAddress: "192.0.2.44",
        },
      }),
    ).toBe("198.51.100.7");

    expect(
      getClientKey({
        headers: {
          "x-real-ip": "203.0.113.99",
          "x-forwarded-for": "203.0.113.99",
        },
        socket: {
          remoteAddress: "192.0.2.44",
        },
      }),
    ).toBe("192.0.2.44");
  });

  it("prefers trusted single-hop real IP over user-controlled forwarding chains", () => {
    process.env = { ...originalEnv, TRUST_PROXY_HEADERS: "true" };

    expect(
      getClientKey({
        headers: {
          "x-real-ip": "198.51.100.10",
          "x-forwarded-for": "203.0.113.1, 198.51.100.10",
        },
        socket: {
          remoteAddress: "192.0.2.44",
        },
      }),
    ).toBe("198.51.100.10");
  });
});
