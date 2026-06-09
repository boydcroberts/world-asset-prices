import { afterEach, describe, expect, it } from "vitest";

import { rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  afterEach(() => {
    resetRateLimits();
  });

  it("allows requests up to limit then blocks", () => {
    const now = 10_000;
    const first = rateLimit("logo", "client-a", { limit: 2, windowSec: 60 }, now);
    const second = rateLimit("logo", "client-a", { limit: 2, windowSec: 60 }, now + 100);
    const blocked = rateLimit("logo", "client-a", { limit: 2, windowSec: 60 }, now + 200);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets usage after window", () => {
    const now = 20_000;
    rateLimit("client-error", "client-a", { limit: 1, windowSec: 60 }, now);
    const blocked = rateLimit("client-error", "client-a", { limit: 1, windowSec: 60 }, now + 500);
    const reset = rateLimit("client-error", "client-a", { limit: 1, windowSec: 60 }, now + 61_000);

    expect(blocked.allowed).toBe(false);
    expect(reset.allowed).toBe(true);
  });

  it("reports an accurate retryAfterSec while blocked", () => {
    const now = 30_000;
    rateLimit("logo", "client-a", { limit: 1, windowSec: 60 }, now);
    const blocked = rateLimit("logo", "client-a", { limit: 1, windowSec: 60 }, now + 45_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(15);
  });

  it("isolates counters per scope and per client", () => {
    const now = 40_000;
    rateLimit("logo", "client-a", { limit: 1, windowSec: 60 }, now);

    expect(rateLimit("client-error", "client-a", { limit: 1, windowSec: 60 }, now + 10).allowed).toBe(true);
    expect(rateLimit("logo", "client-b", { limit: 1, windowSec: 60 }, now + 20).allowed).toBe(true);
    expect(rateLimit("logo", "client-a", { limit: 1, windowSec: 60 }, now + 30).allowed).toBe(false);
  });
});
