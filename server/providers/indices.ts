import { requestJsonWithRetry } from "../request.js";
import { toFiniteNumber } from "../sanitize.js";
import { resolveProviderBaseUrl } from "./base-url.js";
import type { IndexIntradayPoint, UsIndex, UsIndexKind } from "../types.js";

// US-market instruments for the command-center hero. Yahoo's keyless v8 /chart
// endpoint serves index levels, previous closes, and intraday series — the same
// path the asset-detail history already uses, so no new provider contract.
const YAHOO_FINANCE_BASE_URL = "https://query1.finance.yahoo.com";
const YAHOO_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const MAX_RESPONSE_BYTES = 256_000;

type IndexDefinition = {
  key: string;
  symbol: string;
  name: string;
  kind: UsIndexKind;
  /** Fetch a same-day intraday series (used by the Living Horizon hero). */
  intraday?: boolean;
};

const INDEX_DEFINITIONS: IndexDefinition[] = [
  { key: "sp500", symbol: "^GSPC", name: "S&P 500", kind: "index", intraday: true },
  { key: "nasdaq", symbol: "^IXIC", name: "Nasdaq Composite", kind: "index", intraday: true },
  { key: "dow", symbol: "^DJI", name: "Dow Jones", kind: "index", intraday: true },
  { key: "vix", symbol: "^VIX", name: "VIX", kind: "volatility" },
  { key: "ust10y", symbol: "^TNX", name: "US 10Y", kind: "rate" },
];

type YahooChartResult = {
  meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number };
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[] }[] };
};

type YahooChartResponse = { chart?: { result?: YahooChartResult[] } };

export type FetchIndicesOptions = { timeoutMs?: number; yahooBaseUrl?: string };

async function fetchYahooChart(
  symbol: string,
  range: string,
  interval: string,
  options: FetchIndicesOptions,
): Promise<YahooChartResult | null> {
  const baseUrl = resolveProviderBaseUrl(
    options.yahooBaseUrl ?? process.env.YAHOO_FINANCE_BASE_URL,
    YAHOO_FINANCE_BASE_URL,
    "Yahoo Finance",
    "query1.finance.yahoo.com",
  );
  const url = new URL(`${baseUrl}/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);

  const payload = await requestJsonWithRetry<YahooChartResponse>(url.toString(), {
    timeoutMs: options.timeoutMs,
    retries: 0,
    maxBytes: MAX_RESPONSE_BYTES,
    headers: { "User-Agent": YAHOO_USER_AGENT, Accept: "application/json,*/*" },
  });

  return payload.chart?.result?.[0] ?? null;
}

function parseIntraday(result: YahooChartResult): IndexIntradayPoint[] {
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: IndexIntradayPoint[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const value = toFiniteNumber(closes[index]);
    const ts = timestamps[index];
    if (value === null || typeof ts !== "number" || !Number.isFinite(ts)) continue;
    points.push({ t: new Date(ts * 1_000).toISOString(), value });
  }
  return points;
}

async function fetchOneIndex(def: IndexDefinition, options: FetchIndicesOptions): Promise<UsIndex | null> {
  const daily = await fetchYahooChart(def.symbol, "5d", "1d", options);
  if (!daily) return null;

  const level = toFiniteNumber(daily.meta?.regularMarketPrice);
  const previousClose = toFiniteNumber(daily.meta?.chartPreviousClose ?? daily.meta?.previousClose);
  let changeAbs: number | null = null;
  let changePercent: number | null = null;
  if (level !== null && previousClose !== null && previousClose !== 0) {
    changeAbs = level - previousClose;
    changePercent = (changeAbs / previousClose) * 100;
  }

  let intraday: IndexIntradayPoint[] = [];
  if (def.intraday) {
    const intra = await fetchYahooChart(def.symbol, "1d", "5m", options).catch(() => null);
    if (intra) intraday = parseIntraday(intra);
  }

  return {
    key: def.key,
    symbol: def.symbol,
    name: def.name,
    kind: def.kind,
    level,
    previousClose,
    changeAbs,
    changePercent,
    intraday,
  };
}

/**
 * Fetch the US-market instrument set (indices + VIX + 10Y) best-effort. A failed
 * symbol is omitted rather than failing the batch, so the hero degrades to
 * whatever resolved. Returns [] if every fetch fails.
 */
export async function fetchUsIndices(options: FetchIndicesOptions = {}): Promise<UsIndex[]> {
  const results = await Promise.allSettled(INDEX_DEFINITIONS.map((def) => fetchOneIndex(def, options)));
  const indices: UsIndex[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) indices.push(result.value);
  }
  return indices;
}
