// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readCachedDashboard, writeCachedDashboard } from "./dashboard-cache";
import type { DashboardPayload } from "../types/dashboard";

const CACHE_KEY = "wap.dashboard-cache.v1";
const payload = { generatedAt: "2026-01-01T00:00:00.000Z" } as unknown as DashboardPayload;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("dashboard-cache", () => {
  it("round-trips a written payload with its timestamp", () => {
    writeCachedDashboard(payload, 1_700_000_000_000);
    const cached = readCachedDashboard();
    expect(cached?.cachedAt).toBe(1_700_000_000_000);
    expect(cached?.payload.generatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns null when no cache key is present", () => {
    expect(readCachedDashboard()).toBeNull();
  });

  it("returns null (without throwing) on corrupt JSON", () => {
    localStorage.setItem(CACHE_KEY, "{not json");
    expect(readCachedDashboard()).toBeNull();
  });

  it("returns null on wrong-shaped cache entries", () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ payload, cachedAt: "nope" }));
    expect(readCachedDashboard()).toBeNull();

    localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: 1 }));
    expect(readCachedDashboard()).toBeNull();

    localStorage.setItem(CACHE_KEY, JSON.stringify({ payload: { generatedAt: 5 }, cachedAt: 1 }));
    expect(readCachedDashboard()).toBeNull();

    localStorage.setItem(CACHE_KEY, JSON.stringify({ payload, cachedAt: Number.POSITIVE_INFINITY }));
    expect(readCachedDashboard()).toBeNull();
  });

  it("swallows quota/serialization errors on write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => writeCachedDashboard(payload, 1)).not.toThrow();
  });
});
