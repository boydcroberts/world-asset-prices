import { runtimeCache, type MemoryCache } from "./cache.js";
import { envInt } from "./env.js";
import { createRequestId, createStructuredLogger } from "./log.js";
import fallbackPayloadJson from "./fallback/dashboard-fallback.json" with { type: "json" };
import privateCompaniesJson from "./data/private-companies.json" with { type: "json" };
import { recordProviderFailure, recordProviderFallback, recordProviderSuccess, type ProviderMetricKey } from "./metrics.js";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika.js";
import { fetchTopCurrenciesFromFrankfurter } from "./providers/frankfurter.js";
import { EQUITY_FUNDAMENTALS_AS_OF, EQUITY_QUOTE_PROVIDERS, fetchTopEtfsFromStooq, fetchTopStocksFromStooq } from "./providers/stooq.js";
import { fetchGlobalIndices, fetchUsIndices } from "./providers/indices.js";
import { toFiniteNumber } from "./sanitize.js";
import { withTimeout } from "./request.js";
import { isDashboardPayload } from "./dashboard-schema.js";
import { ASSET_VALUE_SOURCE_VERSION, assetValueSourcesById } from "./value-sources.js";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardNight,
  DashboardPrivateCompany,
  DashboardPayload,
  DashboardSegmentKey,
  DashboardSegmentSource,
  DashboardStock,
  UsIndex,
} from "./types.js";

type Logger = Pick<Console, "info" | "warn" | "error">;

type SegmentResult<T> = {
  data: T;
  stale: boolean;
  fallbackUsed: boolean;
  source: DashboardSegmentSource;
  updatedAtMs: number;
};

export type DashboardBuildOptions = {
  cache?: MemoryCache;
  now?: () => number;
  logger?: Logger;
  cacheTtlSec?: number;
  fallbackTtlSec?: number;
  timeoutMs?: number;
  retries?: number;
  segmentBudgetMs?: number;
  coinpaprikaBaseUrl?: string;
};

function loadFallbackPayload(): DashboardPayload {
  const payload = fallbackPayloadJson as unknown;
  if (!isDashboardPayload(payload)) {
    throw new Error("Invalid bundled fallback dashboard payload");
  }

  return payload;
}

const FALLBACK_PAYLOAD = loadFallbackPayload();
const FALLBACK_GENERATED_AT_MS = Date.parse(FALLBACK_PAYLOAD.generatedAt);

const SEGMENT_KEYS: DashboardSegmentKey[] = ["topCryptos", "topStocks", "topEtfs", "topCurrencies", "topPrivateCompanies", "night"];
const CACHE_KEY_STOCKS = "stooq:top-stocks";
const CACHE_KEY_ETFS = "stooq:top-etfs";
const CACHE_KEY_INDICES = "yahoo:us-indices";
const CACHE_KEY_GLOBAL_INDICES = "yahoo:global-indices";
const OUTLIER_JUMP_RATIO = 2.6;

type StaleAlertGlobal = typeof globalThis & {
  __WAP_STALE_ALERTS__?: Map<DashboardSegmentKey, number>;
};

const staleAlertGlobal = globalThis as StaleAlertGlobal;
const staleAlerts = staleAlertGlobal.__WAP_STALE_ALERTS__ ?? (staleAlertGlobal.__WAP_STALE_ALERTS__ = new Map());

function shouldEmitStaleAlert(segment: DashboardSegmentKey, thresholdSec: number, nowMs: number): boolean {
  const lastEmittedMs = staleAlerts.get(segment);
  if (lastEmittedMs && nowMs - lastEmittedMs < thresholdSec * 1_000) {
    return false;
  }

  staleAlerts.set(segment, nowMs);
  return true;
}

function normalizeStocks(stocks: unknown): DashboardStock[] {
  if (!Array.isArray(stocks)) {
    return [];
  }

  return stocks.map((stock, index) => ({
    ...stock,
    rank: index + 1,
    marketCapUsd: toFiniteNumber(stock.marketCapUsd),
    priceUsd: toFiniteNumber(stock.priceUsd),
    changePercent: toFiniteNumber(stock.changePercent),
  }));
}

function normalizeCryptos(cryptos: unknown): DashboardCrypto[] {
  if (!Array.isArray(cryptos)) {
    return [];
  }

  return cryptos.map((crypto, index) => ({
    ...crypto,
    rank: index + 1,
    priceUsd: toFiniteNumber(crypto.priceUsd),
    marketCapUsd: toFiniteNumber(crypto.marketCapUsd),
    change24h: toFiniteNumber(crypto.change24h),
    sparkline7d: Array.isArray(crypto.sparkline7d)
      ? crypto.sparkline7d
        .map((point: unknown) => toFiniteNumber(point))
        .filter((point: number | null): point is number => point !== null)
        .slice(-12)
      : [],
  }));
}

function normalizeNight(night: unknown): DashboardNight | null {
  if (!night || typeof night !== "object") {
    return null;
  }

  const value = night as DashboardNight;
  return {
    ...value,
    priceUsd: toFiniteNumber(value.priceUsd),
    marketCapUsd: toFiniteNumber(value.marketCapUsd),
    volume24hUsd: toFiniteNumber(value.volume24hUsd),
    athPriceUsd: toFiniteNumber(value.athPriceUsd),
    change24h: toFiniteNumber(value.change24h),
    percentFromAth: toFiniteNumber(value.percentFromAth),
  };
}

function normalizeCurrencies(currencies: unknown): DashboardCurrency[] {
  if (!Array.isArray(currencies) || currencies.length === 0) {
    return [];
  }

  return currencies.map((currency, index) => ({
    ...currency,
    rank: index + 1,
    rateVsUsd: toFiniteNumber(currency.rateVsUsd),
    changePercent: toFiniteNumber(currency.changePercent),
  }));
}

function normalizeEtfs(etfs: unknown): DashboardEtf[] {
  if (!Array.isArray(etfs)) {
    return [];
  }

  return etfs.map((etf, index) => ({
    ...etf,
    rank: index + 1,
    aumUsd: toFiniteNumber(etf.aumUsd),
    priceUsd: toFiniteNumber(etf.priceUsd),
    changePercent: toFiniteNumber(etf.changePercent),
  }));
}

function isOutlierEstimate(currentValue: number | null, priorValue: number | null): boolean {
  if (currentValue === null || priorValue === null) {
    return false;
  }

  if (!Number.isFinite(currentValue) || !Number.isFinite(priorValue)) {
    return false;
  }

  if (currentValue <= 0 || priorValue <= 0) {
    return false;
  }

  const ratio = currentValue / priorValue;
  return ratio >= OUTLIER_JUMP_RATIO || ratio <= 1 / OUTLIER_JUMP_RATIO;
}

function reconcileStockValuations(
  current: DashboardStock[],
  prior: DashboardStock[] | null,
): { data: DashboardStock[]; adjusted: boolean } {
  if (!prior?.length) {
    return { data: current, adjusted: false };
  }

  const priorBySymbol = new Map(current.map((entry) => [entry.symbol, null as number | null]));
  for (const entry of prior) {
    priorBySymbol.set(entry.symbol, toFiniteNumber(entry.marketCapUsd));
  }

  let adjusted = false;
  const values = current.map((entry) => {
    const priorValue = priorBySymbol.get(entry.symbol) ?? null;
    const currentValue = toFiniteNumber(entry.marketCapUsd);
    if (isOutlierEstimate(currentValue, priorValue)) {
      adjusted = true;
      return {
        ...entry,
        marketCapUsd: priorValue,
      };
    }

    return entry;
  });

  return {
    data: values,
    adjusted,
  };
}

function reconcileEtfValuations(
  current: DashboardEtf[],
  prior: DashboardEtf[] | null,
): { data: DashboardEtf[]; adjusted: boolean } {
  if (!prior?.length) {
    return { data: current, adjusted: false };
  }

  const priorBySymbol = new Map(current.map((entry) => [entry.symbol, null as number | null]));
  for (const entry of prior) {
    priorBySymbol.set(entry.symbol, toFiniteNumber(entry.aumUsd));
  }

  let adjusted = false;
  const values = current.map((entry) => {
    const priorValue = priorBySymbol.get(entry.symbol) ?? null;
    const currentValue = toFiniteNumber(entry.aumUsd);
    if (isOutlierEstimate(currentValue, priorValue)) {
      adjusted = true;
      return {
        ...entry,
        aumUsd: priorValue,
      };
    }

    return entry;
  });

  return {
    data: values,
    adjusted,
  };
}

type PrivateCompanyEntry = { id: string; name: string; symbol: string; marketCapUsd: number; valueAsOf?: string; confidence?: string };
const PRIVATE_COMPANIES = privateCompaniesJson as { lastUpdated: string; companies: PrivateCompanyEntry[] };

// Private-company valuations are curated (no reliable live feed). Built from the
// maintained server/data/private-companies.json, ranked by valuation. SpaceX is
// intentionally absent — it IPO'd as the public stock SPCX.
function buildPrivateCompanies(): DashboardPrivateCompany[] {
  return [...PRIVATE_COMPANIES.companies]
    .sort((left, right) => (toFiniteNumber(right.marketCapUsd) ?? 0) - (toFiniteNumber(left.marketCapUsd) ?? 0))
    .map((company, index) => ({
      id: company.id,
      rank: index + 1,
      name: company.name,
      symbol: company.symbol,
      category: "Private Company" as const,
      marketCapUsd: toFiniteNumber(company.marketCapUsd),
      logoUrl: null,
      fallbackLogoUrls: [],
    }));
}

function normalizeAssets(assets: unknown): DashboardAsset[] {
  if (!Array.isArray(assets)) {
    return [];
  }

  return assets
    .map((asset) => ({
      ...asset,
      marketCapUsd: toFiniteNumber(asset.marketCapUsd),
    }))
    .sort((left, right) => {
      const leftValue = left.marketCapUsd ?? Number.NEGATIVE_INFINITY;
      const rightValue = right.marketCapUsd ?? Number.NEGATIVE_INFINITY;
      return rightValue - leftValue;
    })
    .slice(0, 15)
    .map((asset, index) => ({
      ...asset,
      rank: index + 1,
    }));
}

function getCommodityAssets(): DashboardAsset[] {
  return FALLBACK_PAYLOAD.topAssets
    .filter((asset) => asset.category === "Commodity")
    .map((asset) => ({
      ...asset,
      rank: 0,
    }));
}

export function buildTopAssets(
  topStocks: DashboardStock[],
  topCryptos: DashboardCrypto[],
  topPrivateCompanies: DashboardPrivateCompany[] = FALLBACK_PAYLOAD.topPrivateCompanies,
): DashboardAsset[] {
  // Pre-allocate Map for deduplication
  const commodityAssets = getCommodityAssets();
  const deduped = new Map<string, DashboardAsset>();

  // Add commodities first
  for (const asset of commodityAssets) {
    deduped.set(asset.id, asset);
  }

  // Add stocks (converting format inline)
  for (const stock of topStocks) {
    deduped.set(stock.id, {
      id: stock.id,
      rank: stock.rank,
      name: stock.name,
      symbol: stock.symbol,
      category: "Stock",
      marketCapUsd: stock.marketCapUsd,
      logoUrl: stock.logoUrl,
      fallbackLogoUrls: stock.fallbackLogoUrls,
    });
  }

  for (const company of topPrivateCompanies) {
    deduped.set(company.id, {
      id: company.id,
      rank: company.rank,
      name: company.name,
      symbol: company.symbol,
      category: "Private Company",
      marketCapUsd: company.marketCapUsd,
      logoUrl: company.logoUrl,
      fallbackLogoUrls: company.fallbackLogoUrls,
    });
  }

  // Add top 5 cryptos only
  const cryptoLimit = Math.min(5, topCryptos.length);
  for (let i = 0; i < cryptoLimit; i++) {
    const crypto = topCryptos[i];
    deduped.set(crypto.id, {
      id: crypto.id,
      rank: crypto.rank,
      name: crypto.name,
      symbol: crypto.symbol,
      category: "Crypto",
      marketCapUsd: crypto.marketCapUsd,
      logoUrl: crypto.logoUrl,
      fallbackLogoUrls: crypto.fallbackLogoUrls,
    });
  }

  return normalizeAssets(Array.from(deduped.values()));
}

async function resolveSegment<T>(options: {
  key: string;
  metricKey: ProviderMetricKey;
  label: string;
  fetcher: () => Promise<T>;
  fallbackValue: T;
  fallbackUpdatedAtMs: number;
  cache: MemoryCache;
  nowMs: number;
  cacheTtlSec: number;
  fallbackTtlSec: number;
  logger: Logger;
  segmentBudgetMs?: number;
}): Promise<SegmentResult<T>> {
  const fresh = options.cache.getFreshEntry<T>(options.key, options.cacheTtlSec, options.nowMs);
  if (fresh) {
    options.logger.info(`[dashboard] ${options.label} source=fresh-cache`);
    return {
      data: fresh.value,
      stale: false,
      fallbackUsed: false,
      source: "fresh-cache",
      updatedAtMs: fresh.updatedAt,
    };
  }

  const startedAt = Date.now();
  try {
    // Bound the whole segment (incl. the fetcher's own internal retries) so one
    // slow provider can't push the parallel Promise.all toward the 10s function
    // cap. A timeout here flows into the catch below → stale-cache → fallback.
    const live = options.segmentBudgetMs
      ? await withTimeout(options.fetcher(), options.segmentBudgetMs, options.label)
      : await options.fetcher();
    options.cache.set(options.key, live, options.nowMs);
    const latencyMs = Date.now() - startedAt;
    recordProviderSuccess(options.metricKey, latencyMs);
    options.logger.info(`[dashboard] ${options.label} source=live latencyMs=${latencyMs}`);

    return {
      data: live,
      stale: false,
      fallbackUsed: false,
      source: "live",
      updatedAtMs: options.nowMs,
    };
  } catch (error) {
    recordProviderFailure(options.metricKey);
    const message = error instanceof Error ? error.message : "unknown error";
    options.logger.warn(`[dashboard] ${options.label} provider-failure reason=${message}`);

    const stale = options.cache.getStaleEntry<T>(options.key, options.fallbackTtlSec, options.nowMs);
    if (stale) {
      recordProviderFallback(options.metricKey);
      options.logger.warn(`[dashboard] ${options.label} source=stale-cache`);
      return {
        data: stale.value,
        stale: true,
        fallbackUsed: false,
        source: "stale-cache",
        updatedAtMs: stale.updatedAt,
      };
    }

    recordProviderFallback(options.metricKey);
    options.logger.warn(`[dashboard] ${options.label} source=fallback`);
    return {
      data: options.fallbackValue,
      stale: true,
      fallbackUsed: true,
      source: "fallback",
      updatedAtMs: options.fallbackUpdatedAtMs,
    };
  }
}

export async function buildDashboardPayload(options: DashboardBuildOptions = {}): Promise<DashboardPayload> {
  const cache = options.cache ?? runtimeCache;
  const nowMs = options.now ? options.now() : Date.now();
  const logger = options.logger ?? createStructuredLogger("dashboard", createRequestId());

  const cacheTtlSec = options.cacheTtlSec ?? envInt("CACHE_TTL_SEC", 30, 15, 300);
  const fallbackTtlSec = options.fallbackTtlSec ?? envInt("FALLBACK_TTL_SEC", 600, 60, 3_600);
  const staleAlertSec = envInt("STALE_ALERT_SEC", 300, 60, 86_400);
  const timeoutMs = options.timeoutMs ?? 4_500;
  const retries = options.retries ?? 1;
  // Per-segment wall-clock ceiling. Segments run in parallel, so this also caps
  // the overall build; kept under the 10s function cap with headroom for durable
  // writes + serialization.
  const segmentBudgetMs = options.segmentBudgetMs ?? envInt("SEGMENT_BUDGET_MS", 7_000, 1_000, 9_000);
  const fallbackUpdatedAtMs = Number.isFinite(FALLBACK_GENERATED_AT_MS) ? FALLBACK_GENERATED_AT_MS : nowMs;
  const priorStocksCache = cache.getStaleEntry<DashboardStock[]>(CACHE_KEY_STOCKS, fallbackTtlSec, nowMs);
  const priorEtfsCache = cache.getStaleEntry<DashboardEtf[]>(CACHE_KEY_ETFS, fallbackTtlSec, nowMs);

  // US-market instruments power the hero. Best-effort and additive: a failed
  // fetch falls back to the last good cached set so the hero never blanks on a
  // transient provider hiccup; an empty result simply degrades the hero.
  const indicesPromise: Promise<UsIndex[]> = fetchUsIndices({ timeoutMs })
    .then((fetched) => {
      if (fetched.length > 0) {
        cache.set(CACHE_KEY_INDICES, fetched, nowMs);
        return fetched;
      }
      return cache.getStaleEntry<UsIndex[]>(CACHE_KEY_INDICES, fallbackTtlSec, nowMs)?.value ?? [];
    })
    .catch((error) => {
      logger.warn(`[dashboard] indices fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
      return cache.getStaleEntry<UsIndex[]>(CACHE_KEY_INDICES, fallbackTtlSec, nowMs)?.value ?? [];
    });

  // Global indices (FTSE/DAX/Nikkei/…) for the Top-Tens board — same best-effort
  // + last-good-cache pattern; additive, never blocks the core payload.
  const globalIndicesPromise: Promise<UsIndex[]> = fetchGlobalIndices({ timeoutMs })
    .then((fetched) => {
      if (fetched.length > 0) {
        cache.set(CACHE_KEY_GLOBAL_INDICES, fetched, nowMs);
        return fetched;
      }
      return cache.getStaleEntry<UsIndex[]>(CACHE_KEY_GLOBAL_INDICES, fallbackTtlSec, nowMs)?.value ?? [];
    })
    .catch((error) => {
      logger.warn(`[dashboard] global indices fetch failed: ${error instanceof Error ? error.message : "unknown"}`);
      return cache.getStaleEntry<UsIndex[]>(CACHE_KEY_GLOBAL_INDICES, fallbackTtlSec, nowMs)?.value ?? [];
    });

  const [cryptosResult, stocksResult, etfsResult, currenciesResult, nightResult] = await Promise.all([
    resolveSegment<DashboardCrypto[]>({
      key: "coinpaprika:top-cryptos",
      metricKey: "topCryptos",
      label: "topCryptos",
      fallbackValue: FALLBACK_PAYLOAD.topCryptos,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      segmentBudgetMs,
      fetcher: () =>
        fetchTopCryptosFromCoinpaprika({
          limit: 15,
          baseUrl: options.coinpaprikaBaseUrl,
          timeoutMs,
          retries,
        }),
    }),
    resolveSegment<DashboardStock[]>({
      key: CACHE_KEY_STOCKS,
      metricKey: "topStocks",
      label: "topStocks",
      fallbackValue: FALLBACK_PAYLOAD.topStocks,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      segmentBudgetMs,
      fetcher: () =>
        fetchTopStocksFromStooq({
          timeoutMs,
        }),
    }),
    resolveSegment<DashboardEtf[]>({
      key: CACHE_KEY_ETFS,
      metricKey: "topEtfs",
      label: "topEtfs",
      fallbackValue: FALLBACK_PAYLOAD.topEtfs,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      segmentBudgetMs,
      fetcher: () =>
        fetchTopEtfsFromStooq({
          timeoutMs,
        }),
    }),
    resolveSegment<DashboardCurrency[]>({
      key: "frankfurter:top-currencies",
      metricKey: "topCurrencies",
      label: "topCurrencies",
      fallbackValue: FALLBACK_PAYLOAD.topCurrencies,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      segmentBudgetMs,
      fetcher: () =>
        fetchTopCurrenciesFromFrankfurter({
          timeoutMs,
          retries,
        }),
    }),
    resolveSegment<DashboardNight | null>({
      key: "coinpaprika:night",
      metricKey: "night",
      label: "night",
      fallbackValue: FALLBACK_PAYLOAD.night,
      fallbackUpdatedAtMs,
      cache,
      nowMs,
      cacheTtlSec,
      fallbackTtlSec,
      logger,
      segmentBudgetMs,
      fetcher: () =>
        fetchNightFromCoinpaprika({
          baseUrl: options.coinpaprikaBaseUrl,
          timeoutMs,
          retries,
        }),
    }),
  ]);

  let topStocks = normalizeStocks(stocksResult.data);
  let stocksMeta = stocksResult;

  let topEtfs = normalizeEtfs(etfsResult.data);
  let etfsMeta = etfsResult;

  if (stocksResult.source === "live" && priorStocksCache) {
    const stabilized = reconcileStockValuations(topStocks, normalizeStocks(priorStocksCache.value));
    if (stabilized.adjusted) {
      topStocks = stabilized.data;
      stocksMeta = {
        ...stocksResult,
        stale: true,
        source: "stale-cache",
        updatedAtMs: priorStocksCache.updatedAt,
      };
    }
  }

  if (etfsResult.source === "live" && priorEtfsCache) {
    const stabilized = reconcileEtfValuations(topEtfs, normalizeEtfs(priorEtfsCache.value));
    if (stabilized.adjusted) {
      topEtfs = stabilized.data;
      etfsMeta = {
        ...etfsResult,
        stale: true,
        source: "stale-cache",
        updatedAtMs: priorEtfsCache.updatedAt,
      };
    }
  }

  const topCryptos = normalizeCryptos(cryptosResult.data);
  const topCurrencies = normalizeCurrencies(currenciesResult.data);
  const topPrivateCompanies = buildPrivateCompanies();
  const topAssets = buildTopAssets(topStocks, topCryptos, topPrivateCompanies);
  const night = normalizeNight(nightResult.data);
  const indices = await indicesPromise;
  const topGlobalIndices = await globalIndicesPromise;

  const stale = cryptosResult.stale || stocksMeta.stale || etfsMeta.stale || currenciesResult.stale || nightResult.stale;
  const fallbackUsed =
    cryptosResult.fallbackUsed || stocksMeta.fallbackUsed || etfsMeta.fallbackUsed || currenciesResult.fallbackUsed || nightResult.fallbackUsed;

  const segmentMeta = {
    topCryptos: {
      source: cryptosResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - cryptosResult.updatedAtMs) / 1_000)),
    },
    topStocks: {
      source: stocksMeta.source,
      ageSec: Math.max(0, Math.floor((nowMs - stocksMeta.updatedAtMs) / 1_000)),
    },
    topEtfs: {
      source: etfsMeta.source,
      ageSec: Math.max(0, Math.floor((nowMs - etfsMeta.updatedAtMs) / 1_000)),
    },
    topCurrencies: {
      source: currenciesResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - currenciesResult.updatedAtMs) / 1_000)),
    },
    topPrivateCompanies: {
      source: "fresh-cache",
      ageSec: 0,
    },
    night: {
      source: nightResult.source,
      ageSec: Math.max(0, Math.floor((nowMs - nightResult.updatedAtMs) / 1_000)),
    },
  } satisfies DashboardPayload["segmentMeta"];

  const degradedSegments = SEGMENT_KEYS.filter((segment) => {
    const source = segmentMeta[segment].source;
    if (source === "stale-cache") return segmentMeta[segment].ageSec >= staleAlertSec;
    return source === "fallback" || source === "durable-cache";
  });

  logger.info(`[dashboard] assembled stale=${stale} fallbackUsed=${fallbackUsed}`);
  for (const segment of SEGMENT_KEYS) {
    const isDegraded = degradedSegments.includes(segment);
    if (isDegraded) {
      if (segmentMeta[segment].ageSec >= staleAlertSec && shouldEmitStaleAlert(segment, staleAlertSec, nowMs)) {
        logger.warn(`[dashboard] stale-threshold segment=${segment} ageSec=${segmentMeta[segment].ageSec} thresholdSec=${staleAlertSec}`);
      }
    } else if (staleAlerts.has(segment)) {
      staleAlerts.delete(segment);
      logger.info(`[dashboard] stale-recovered segment=${segment}`);
    }
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    stale,
    refreshInSec: cacheTtlSec,
    source: {
      equities: EQUITY_QUOTE_PROVIDERS,
      crypto: "coinpaprika",
      fallbackUsed,
      equityFundamentalsAsOf: EQUITY_FUNDAMENTALS_AS_OF,
      valueSourceVersion: ASSET_VALUE_SOURCE_VERSION,
      privateCompaniesAsOf: PRIVATE_COMPANIES.lastUpdated,
    },
    degradedSegments,
    segmentMeta,
    topCryptos,
    topStocks,
    topEtfs,
    topCurrencies,
    topPrivateCompanies,
    topAssets,
    night,
    indices,
    topGlobalIndices,
    valueSources: assetValueSourcesById(),
  };
}

export const dashboardFallbackPayload = FALLBACK_PAYLOAD;
