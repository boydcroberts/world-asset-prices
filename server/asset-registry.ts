import fallbackPayloadJson from "./fallback/dashboard-fallback.json" with { type: "json" };
import { isDashboardPayload } from "./dashboard-schema.js";
import type {
  AssetRef,
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardNight,
  DashboardPayload,
  DashboardPrivateCompany,
  DashboardSegmentKey,
  DashboardStock,
  HistoricalRange,
} from "./types.js";

export const HISTORICAL_RANGES: HistoricalRange[] = ["7D", "30D", "1Y"];

type DetailEntry =
  | DashboardAsset
  | DashboardCrypto
  | DashboardCurrency
  | DashboardEtf
  | DashboardStock
  | DashboardPrivateCompany
  | (DashboardNight & { category: "NIGHT"; rank: number });

const FALLBACK_PAYLOAD = fallbackPayloadJson as unknown;

function fallbackPayload(): DashboardPayload {
  if (!isDashboardPayload(FALLBACK_PAYLOAD)) {
    throw new Error("Invalid fallback payload");
  }

  return FALLBACK_PAYLOAD;
}

export function isHistoricalRange(value: unknown): value is HistoricalRange {
  return typeof value === "string" && HISTORICAL_RANGES.includes(value as HistoricalRange);
}

export function stooqSymbolForAsset(symbol: string): string {
  return symbol.trim().toUpperCase().replace(".", "-");
}

function nightEntry(payload: DashboardPayload): DetailEntry[] {
  if (!payload.night) return [];
  return [
    {
      ...payload.night,
      category: "NIGHT",
      rank: 1,
    },
  ];
}

export function dashboardEntries(payload: DashboardPayload): DetailEntry[] {
  const entries = [
    ...payload.topStocks,
    ...payload.topEtfs,
    ...payload.topCryptos,
    ...payload.topCurrencies,
    ...payload.topPrivateCompanies,
    ...payload.topAssets,
    ...nightEntry(payload),
  ];

  const byId = new Map<string, DetailEntry>();
  for (const entry of entries) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }

  return Array.from(byId.values());
}

export function segmentForEntry(entry: DetailEntry): DashboardSegmentKey | "topAssets" {
  if (entry.category === "Stock") return entry.id.startsWith("stock-") ? "topStocks" : "topAssets";
  if (entry.category === "ETF") return "topEtfs";
  if (entry.category === "Crypto") return "topCryptos";
  if (entry.category === "Currency") return "topCurrencies";
  if (entry.category === "Private Company") return "topPrivateCompanies";
  if (entry.category === "NIGHT") return "night";
  return "topAssets";
}

export function assetRefFromEntry(entry: DetailEntry): AssetRef {
  const isStockOrEtf = entry.category === "Stock" || entry.category === "ETF";
  const isCrypto = entry.category === "Crypto" || entry.category === "NIGHT";
  const isCurrency = entry.category === "Currency";
  const hasUnitPrice = "priceUsd" in entry && typeof entry.priceUsd === "number";

  return {
    id: entry.id,
    symbol: entry.symbol,
    displayName: entry.name,
    category: entry.category,
    currency: "USD",
    tradable: (isStockOrEtf && hasUnitPrice) || isCrypto,
    supportsHistory: isStockOrEtf && hasUnitPrice,
    supportsLivePrice: (isStockOrEtf && hasUnitPrice) || isCrypto || isCurrency,
    providerIds: {
      stooq: isStockOrEtf ? stooqSymbolForAsset(entry.symbol) : undefined,
      coinpaprika: isCrypto && entry.category !== "NIGHT" ? entry.id : entry.category === "NIGHT" ? "night-midnight2" : undefined,
    },
  };
}

let cachedFallbackRefMap: Map<string, AssetRef> | null = null;

function fallbackAssetRefMap(): Map<string, AssetRef> {
  if (!cachedFallbackRefMap) {
    cachedFallbackRefMap = new Map(
      dashboardEntries(fallbackPayload()).map((entry) => [entry.id, assetRefFromEntry(entry)]),
    );
  }

  return cachedFallbackRefMap;
}

export function fallbackAssetRefs(): AssetRef[] {
  return Array.from(fallbackAssetRefMap().values());
}

export function getFallbackAssetRef(id: string): AssetRef | null {
  return fallbackAssetRefMap().get(id) ?? null;
}

export function findDashboardEntry(payload: DashboardPayload, id: string): DetailEntry | null {
  return dashboardEntries(payload).find((entry) => entry.id === id) ?? null;
}
