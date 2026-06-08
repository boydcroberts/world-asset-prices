import type { AssetDetailPayload, DashboardPayload, DashboardSegmentKey, DashboardSegmentSource, HistoricalRange } from "./types/dashboard";

declare const __GITHUB_PAGES__: boolean;
const IS_GITHUB_PAGES = typeof __GITHUB_PAGES__ !== "undefined" && __GITHUB_PAGES__;

const DASHBOARD_ENDPOINT = import.meta.env.DEV
  ? "/__local_api/dashboard"
  : IS_GITHUB_PAGES
    ? import.meta.env.BASE_URL + "data/dashboard.json"
    : "/api/dashboard";

const CLIENT_ERROR_ENDPOINT = import.meta.env.DEV ? "/__local_api/client-error" : "/api/client-error";
const ASSET_DETAIL_ENDPOINT = import.meta.env.DEV ? "/__local_api/asset-detail" : "/api/asset-detail";
// `night` remains in the API payload/types (server contract) but is intentionally
// not surfaced in the UI, so it is excluded from the segments we normalize and
// report health for.
const SEGMENT_KEYS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "topEtfs", "topCurrencies", "topPrivateCompanies"];
const SEGMENT_SOURCES = new Set<DashboardSegmentSource>(["live", "fresh-cache", "stale-cache", "fallback", "durable-cache"]);

function isSegmentSource(value: unknown): value is DashboardSegmentSource {
  return typeof value === "string" && SEGMENT_SOURCES.has(value as DashboardSegmentSource);
}

function isDegradedSource(source: DashboardSegmentSource): boolean {
  return source === "stale-cache" || source === "fallback" || source === "durable-cache";
}

function normalizeSegmentMeta(payload: DashboardPayload, ageSec: number): DashboardPayload["segmentMeta"] {
  const segmentMeta = payload.segmentMeta as Partial<
    Record<DashboardSegmentKey, Partial<DashboardPayload["segmentMeta"][DashboardSegmentKey]>>
  > | undefined;

  return Object.fromEntries(
    SEGMENT_KEYS.map((segment) => {
      const meta = segmentMeta?.[segment];
      const metaAgeSec = typeof meta?.ageSec === "number" && Number.isFinite(meta.ageSec) ? Math.max(0, Math.floor(meta.ageSec)) : ageSec;
      return [
        segment,
        {
          source: isSegmentSource(meta?.source) ? meta.source : "fallback",
          ageSec: metaAgeSec,
        },
      ];
    }),
  ) as DashboardPayload["segmentMeta"];
}

function deriveDegradedSegments(segmentMeta: DashboardPayload["segmentMeta"]): DashboardSegmentKey[] {
  return SEGMENT_KEYS.filter((segment) => isDegradedSource(segmentMeta[segment].source));
}

// Hard ceiling for a single client request. The server caps its own work at
// ~10s; if the round trip stalls past this, fail fast so React Query can retry
// (and ultimately surface cached/last-known-good data) instead of hanging on the
// browser's multi-minute default.
const REQUEST_TIMEOUT_MS = 12_000;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    // Let the browser HTTP cache honor the server's Cache-Control
    // (`s-maxage`/`stale-while-revalidate`) instead of forcing revalidation.
    cache: "no-cache",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

function normalizeDashboardPayload(payload: DashboardPayload): DashboardPayload {
  const generatedAtMs = Date.parse(payload.generatedAt);
  const ageSec = Number.isFinite(generatedAtMs) ? Math.max(0, Math.floor((Date.now() - generatedAtMs) / 1_000)) : 0;
  const segmentMeta = normalizeSegmentMeta(payload, ageSec);

  return {
    ...payload,
    refreshInSec: Number.isFinite(payload.refreshInSec) ? payload.refreshInSec : 30,
    degradedSegments: deriveDegradedSegments(segmentMeta),
    segmentMeta,
    topCryptos: Array.isArray(payload.topCryptos) ? payload.topCryptos : [],
    topStocks: Array.isArray(payload.topStocks) ? payload.topStocks : [],
    topEtfs: Array.isArray(payload.topEtfs) ? payload.topEtfs : [],
    topCurrencies: Array.isArray(payload.topCurrencies) ? payload.topCurrencies : [],
    topPrivateCompanies: Array.isArray(payload.topPrivateCompanies) ? payload.topPrivateCompanies : [],
    topAssets: Array.isArray(payload.topAssets) ? payload.topAssets : [],
    night: payload.night ?? null,
  };
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  const payload = await getJson<DashboardPayload>(DASHBOARD_ENDPOINT);
  return normalizeDashboardPayload(payload);
}

export async function fetchAssetDetail(id: string, range: HistoricalRange): Promise<AssetDetailPayload> {
  if (IS_GITHUB_PAGES) {
    return getJson<AssetDetailPayload>(`${import.meta.env.BASE_URL}data/asset-detail/${encodeURIComponent(id)}-${range}.json`);
  }

  const url = new URL(ASSET_DETAIL_ENDPOINT, window.location.origin);
  url.searchParams.set("id", id);
  url.searchParams.set("range", range);
  return getJson<AssetDetailPayload>(url.pathname + url.search);
}

type ClientErrorPayload = {
  message: string;
  source?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
};

export async function reportClientError(payload: ClientErrorPayload): Promise<void> {
  if (!import.meta.env.PROD || IS_GITHUB_PAGES) {
    return;
  }

  try {
    await fetch(CLIENT_ERROR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Fire-and-forget client telemetry.
  }
}
