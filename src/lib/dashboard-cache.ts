import type { DashboardPayload } from "../types/dashboard";

/**
 * Client-side last-known-good cache. The server already degrades live → durable
 * KV → bundled JSON, but that bundled fallback lives *server-side*: if the API
 * route itself is unreachable (the user is offline, or the deployment is down),
 * a cold load has nothing to show. Persisting the last successful payload here
 * lets the dashboard paint real (clearly-aged) data instead of a blank screen.
 *
 * NEW localStorage key, additive — existing keys (`wap.portfolio.v1`,
 * `wap.pinned-markets.v1`, `wap.prefs.v1`) are untouched. Only public market
 * data is stored; never anything sensitive.
 */
const CACHE_KEY = "wap.dashboard-cache.v1";

export type CachedDashboard = {
  payload: DashboardPayload;
  cachedAt: number;
};

export function readCachedDashboard(): CachedDashboard | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDashboard> | null;
    if (
      !parsed ||
      typeof parsed.cachedAt !== "number" ||
      !Number.isFinite(parsed.cachedAt) ||
      !parsed.payload ||
      typeof (parsed.payload as DashboardPayload).generatedAt !== "string"
    ) {
      return null;
    }
    return { payload: parsed.payload as DashboardPayload, cachedAt: parsed.cachedAt };
  } catch {
    return null;
  }
}

export function writeCachedDashboard(payload: DashboardPayload, cachedAt: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ payload, cachedAt } satisfies CachedDashboard));
  } catch {
    // Ignore quota / serialization / private-mode errors — the cache is best-effort.
  }
}
