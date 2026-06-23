export type DashboardSource = {
  equities: string;
  crypto: "coinpaprika";
  fallbackUsed: boolean;
  equityFundamentalsAsOf?: string;
  valueSourceVersion?: string;
};

export type DashboardSegmentKey = "topCryptos" | "topStocks" | "topEtfs" | "topCurrencies" | "topPrivateCompanies" | "night";

export type DashboardSegmentSource = "live" | "fresh-cache" | "stale-cache" | "fallback" | "durable-cache";

export type DashboardSegmentMeta = {
  source: DashboardSegmentSource;
  ageSec: number;
};

export type DashboardEntryBase = {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  logoUrl: string | null;
  fallbackLogoUrls: string[];
};

export type AssetValueSourceType = "live-provider" | "issuer" | "reported-transaction" | "recognized-market-data";

export type AlternateAssetValuation = {
  valueUsd: number;
  valueAsOf: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: "rumor" | "target" | "secondary-market-chatter";
  notes: string;
};

export type AssetValueSource = {
  assetId: string;
  category: AssetCategory;
  valueUsd: number;
  valueAsOf: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: AssetValueSourceType;
  confidence: "high" | "medium" | "low" | "curated";
  updateCadence: "daily" | "weekly" | "monthly" | "event-driven";
  lastCheckedAt?: string;
  notes: string;
  alternateValuations?: AlternateAssetValuation[];
};

export type DashboardCrypto = DashboardEntryBase & {
  category: "Crypto";
  priceUsd: number | null;
  marketCapUsd: number | null;
  change24h: number | null;
  sparkline7d: number[];
};

export type DashboardStock = DashboardEntryBase & {
  category: "Stock";
  marketCapUsd: number | null;
  priceUsd: number | null;
  changePercent: number | null;
  /** GICS-style sector for breadth/sector aggregation. Additive/optional. */
  sector?: string;
  /** 52-week range (sourced snapshot) for the range bar. Additive/optional. */
  low52w?: number;
  high52w?: number;
};

export type DashboardEtf = DashboardEntryBase & {
  category: "ETF";
  aumUsd: number | null;
  priceUsd: number | null;
  changePercent: number | null;
};

export type DashboardPrivateCompany = DashboardEntryBase & {
  category: "Private Company";
  marketCapUsd: number | null;
};

export type DashboardAsset = DashboardEntryBase & {
  category: "Stock" | "Crypto" | "Commodity" | "Private Company";
  marketCapUsd: number | null;
};

export type DashboardNight = {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  fallbackLogoUrls: string[];
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  athPriceUsd: number | null;
  change24h: number | null;
  percentFromAth: number | null;
};

export type DashboardCurrency = DashboardEntryBase & {
  category: "Currency";
  rateVsUsd: number | null;
  changePercent: number | null;
};

export type IndexIntradayPoint = { t: string; value: number };

export type UsIndexKind = "index" | "volatility" | "rate" | "future" | "currency" | "commodity";

export type UsIndex = {
  key: string;
  symbol: string;
  name: string;
  kind: UsIndexKind;
  level: number | null;
  previousClose: number | null;
  changeAbs: number | null;
  changePercent: number | null;
  intraday: IndexIntradayPoint[];
};

export type DashboardPayload = {
  generatedAt: string;
  stale: boolean;
  refreshInSec: number;
  source: DashboardSource;
  degradedSegments: DashboardSegmentKey[];
  segmentMeta: Record<DashboardSegmentKey, DashboardSegmentMeta>;
  topCryptos: DashboardCrypto[];
  topStocks: DashboardStock[];
  topEtfs: DashboardEtf[];
  topCurrencies: DashboardCurrency[];
  topPrivateCompanies: DashboardPrivateCompany[];
  topAssets: DashboardAsset[];
  night: DashboardNight | null;
  /** US-market instruments (indices + VIX + 10Y) powering the command-center hero. Additive/optional. */
  indices?: UsIndex[];
  valueSources?: Record<string, AssetValueSource>;
  requestId?: string;
};

export type AssetCategory = DashboardCrypto["category"] | DashboardStock["category"] | DashboardEtf["category"] | DashboardCurrency["category"] | DashboardPrivateCompany["category"] | DashboardAsset["category"] | "NIGHT";

export type AssetRef = {
  id: string;
  symbol: string;
  displayName: string;
  category: AssetCategory;
  currency: "USD";
  tradable: boolean;
  supportsHistory: boolean;
  supportsLivePrice: boolean;
  providerIds: {
    stooq?: string;
    coinpaprika?: string;
  };
};

export type HistoricalRange = "7D" | "30D" | "1Y";

export type HistoricalPoint = {
  t: string;
  value: number | null;
};

export type AssetProvenance = {
  provider: string;
  source: DashboardSegmentSource | "curated";
  segment: DashboardSegmentKey | "topAssets";
  ageSec: number;
  updatedAt: string;
  valueMethod: "live-price" | "derived-market-cap" | "curated-market-cap" | "sourced-aum" | "derived-aum" | "exchange-rate" | "curated-valuation" | "commodity-estimate" | "unavailable";
  confidence: "high" | "medium" | "low" | "curated";
  limitation: string;
  valueAsOf?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceType?: AssetValueSourceType;
  alternateValuations?: AlternateAssetValuation[];
};

export type AssetDetailPayload = {
  asset: AssetRef;
  quote: {
    valueUsd: number | null;
    priceUsd?: number | null;
    valueLabel: string;
    changePercent?: number | null;
    asOf: string;
  };
  history: {
    range: HistoricalRange;
    available: boolean;
    points: HistoricalPoint[];
    reason?: string;
  };
  provenance: AssetProvenance;
  stale: boolean;
  degradedReason?: string;
  requestId?: string;
};

export type LocalHolding = {
  assetId: string;
  quantity: string;
  costBasisUsd?: string;
  createdAt: string;
  updatedAt: string;
};
