import { formatCompactCurrency, formatPercent, isFiniteNumber } from "./formatters";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardPrivateCompany,
  DashboardPayload,
  DashboardStock,
} from "../types/dashboard";

export type DashboardEntry = DashboardAsset | DashboardCrypto | DashboardCurrency | DashboardEtf | DashboardStock | DashboardPrivateCompany;

export type DashboardSortMode = "rank" | "name" | "value" | "movement";

export type DashboardInsight = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "negative";
};

export type DashboardSegmentHealth = {
  segment: keyof DashboardPayload["segmentMeta"];
  label: string;
  source: DashboardPayload["segmentMeta"][keyof DashboardPayload["segmentMeta"]]["source"];
  ageSec: number;
};

type DashboardHealthMode = "degraded" | "fresh" | "recovering";

const DEGRADE_RANK: Record<DashboardPayload["segmentMeta"][keyof DashboardPayload["segmentMeta"]]["source"], number> = {
  live: 0,
  "fresh-cache": 1,
  "stale-cache": 2,
  "durable-cache": 3,
  fallback: 4,
};

const SEGMENT_LABELS: Record<keyof DashboardPayload["segmentMeta"], string> = {
  topCryptos: "Cryptos",
  topStocks: "Public companies",
  topEtfs: "ETFs",
  topCurrencies: "FX",
  topPrivateCompanies: "Private companies",
  night: "NIGHT",
};

function normalizedText(value: string): string {
  return value.trim().toLowerCase();
}

export function dashboardEntryMatches(entry: DashboardEntry, searchTerm: string): boolean {
  const term = normalizedText(searchTerm);
  if (!term) return true;

  return [entry.name, entry.symbol, entry.category].some((value) => normalizedText(value).includes(term));
}

export function getEntryValue(entry: DashboardEntry): number | null {
  if ("rateVsUsd" in entry) return isFiniteNumber(entry.rateVsUsd) ? entry.rateVsUsd : null;
  if ("aumUsd" in entry && isFiniteNumber(entry.aumUsd)) return entry.aumUsd;
  if ("marketCapUsd" in entry && isFiniteNumber(entry.marketCapUsd)) return entry.marketCapUsd;
  if ("priceUsd" in entry && isFiniteNumber(entry.priceUsd)) return entry.priceUsd;
  return null;
}

export function getEntryChange(entry: DashboardEntry): number | null {
  if ("change24h" in entry) return isFiniteNumber(entry.change24h) ? entry.change24h : null;
  if ("changePercent" in entry) return isFiniteNumber(entry.changePercent) ? entry.changePercent : null;
  return null;
}

function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

export function sortDashboardEntries<T extends DashboardEntry>(entries: readonly T[], sortMode: DashboardSortMode): T[] {
  return [...entries].sort((a, b) => {
    if (sortMode === "name") {
      return compareText(a.name, b.name);
    }

    if (sortMode === "value") {
      return compareNullableDesc(getEntryValue(a), getEntryValue(b)) || a.rank - b.rank || compareText(a.name, b.name);
    }

    if (sortMode === "movement") {
      const movementA = getEntryChange(a);
      const movementB = getEntryChange(b);
      return compareNullableDesc(movementA === null ? null : Math.abs(movementA), movementB === null ? null : Math.abs(movementB)) || a.rank - b.rank || compareText(a.name, b.name);
    }

    return a.rank - b.rank || compareText(a.name, b.name);
  });
}

function countTrackedMarkets(dashboard: DashboardPayload): number {
  return (
    dashboard.topAssets.length +
    dashboard.topStocks.length +
    dashboard.topEtfs.length +
    dashboard.topCurrencies.length +
    dashboard.topPrivateCompanies.length +
    dashboard.topCryptos.length
  );
}

// The runtime payload strips `night` from segmentMeta (see SEGMENT_KEYS in
// api.ts), while raw/server/test payloads may still carry it. Count provider
// segments against this explicit allowlist so the math is correct either way —
// the old `length - 1` (which assumed night was always the extra key) reported
// "4 of 4" at runtime once night was stripped.
const PROVIDER_SEGMENT_KEYS = [
  "topCryptos",
  "topStocks",
  "topEtfs",
  "topCurrencies",
  "topPrivateCompanies",
] as const;

function getProviderSegmentCounts(dashboard: DashboardPayload): { total: number; fresh: number } {
  const present = PROVIDER_SEGMENT_KEYS.map((key) => dashboard.segmentMeta[key]).filter(Boolean);
  const fresh = present.filter((meta) => meta.source === "live" || meta.source === "fresh-cache").length;
  return { total: present.length, fresh };
}

function formatDataHealthDetail(dashboard: DashboardPayload, mode: DashboardHealthMode): string {
  if (mode === "fresh") {
    const { total, fresh } = getProviderSegmentCounts(dashboard);
    return `${fresh} of ${total} provider segments live; curated snapshots verified`;
  }

  if (mode === "recovering") {
    const recentCacheCount = Object.values(dashboard.segmentMeta).filter((meta) => meta.source === "stale-cache").length;
    return `${recentCacheCount} segment${recentCacheCount === 1 ? "" : "s"} retrying with recent cache`;
  }

  const fallbackSegments = dashboard.degradedSegments.filter((segment) => dashboard.segmentMeta[segment].source === "fallback");
  const degradedCount = dashboard.degradedSegments.length;
  const staleCount = degradedCount - fallbackSegments.length;

  if (fallbackSegments.length > 0 && staleCount > 0) {
    return `Using degraded data: ${degradedCount} segments (${fallbackSegments.length} fallback)`;
  }

  if (fallbackSegments.length > 0) {
    return `Using fallback for ${fallbackSegments.length} segment${fallbackSegments.length === 1 ? "" : "s"}`;
  }

  return `Using ${staleCount} stale segment${staleCount === 1 ? "" : "s"}`;
}

function rankDegradedSegment(health: DashboardSegmentHealth): number {
  return DEGRADE_RANK[health.source] * 10_000 + health.ageSec;
}

export function getWorstSegmentHealthSummaries(
  dashboard: DashboardPayload,
  max = 3,
): DashboardSegmentHealth[] {
  const degraded = dashboard.degradedSegments
    .map((segment) => {
      const meta = dashboard.segmentMeta[segment];
      return {
        segment,
        label: SEGMENT_LABELS[segment],
        source: meta.source,
        ageSec: meta.ageSec,
      };
    })
    .sort((left, right) => {
      if (rankDegradedSegment(right) !== rankDegradedSegment(left)) {
        return rankDegradedSegment(right) - rankDegradedSegment(left);
      }

      return right.ageSec - left.ageSec;
    });

  return degraded.slice(0, max);
}

function getLargestMover(dashboard: DashboardPayload): DashboardInsight {
  const entries: DashboardEntry[] = [
    ...dashboard.topCryptos,
    ...dashboard.topStocks,
    ...dashboard.topEtfs,
    ...dashboard.topCurrencies,
  ];

  const largest = entries
    .map((entry) => ({ name: entry.name, symbol: entry.symbol, change: getEntryChange(entry) }))
    .filter((entry): entry is { name: string; symbol: string; change: number } => isFiniteNumber(entry.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];

  if (!largest) {
    return {
      label: "Largest move",
      value: "—",
      detail: "Waiting for change data",
      tone: "neutral",
    };
  }

  return {
    label: "Largest move",
    value: formatPercent(largest.change),
    detail: `${largest.name} (${largest.symbol})`,
    tone: largest.change > 0 ? "positive" : largest.change < 0 ? "negative" : "neutral",
  };
}

function getGlobalLeader(topAssets: readonly DashboardAsset[]): DashboardInsight {
  const leader = sortDashboardEntries(topAssets, "rank")[0];
  if (!leader) {
    return {
      label: "Global leader",
      value: "—",
      detail: "Waiting for asset data",
      tone: "neutral",
    };
  }

  return {
    label: "Global leader",
    value: formatCompactCurrency(leader.marketCapUsd).replace(/\.00(?=[A-Z]?$)/, ""),
    detail: `${leader.name} (${leader.symbol})`,
    tone: "neutral",
  };
}

export function buildDashboardInsights(dashboard: DashboardPayload): DashboardInsight[] {
  const degradedCount = dashboard.degradedSegments.length;
  const isDegraded = dashboard.source.fallbackUsed || degradedCount > 0;
  const isRecovering = !isDegraded && dashboard.stale;
  const healthMode: DashboardHealthMode = isDegraded ? "degraded" : isRecovering ? "recovering" : "fresh";

  // Visible market sections = the provider segments plus the cross-category
  // "Global Assets" section (when present).
  const sectionCount =
    getProviderSegmentCounts(dashboard).total + (dashboard.topAssets.length > 0 ? 1 : 0);

  return [
    {
      label: "Tracked markets",
      value: String(countTrackedMarkets(dashboard)),
      detail: `Across ${sectionCount} live sections`,
      tone: "neutral",
    },
    {
      label: "Data health",
      value: isDegraded ? "Degraded" : isRecovering ? "Recovering" : "Live",
      detail: formatDataHealthDetail(dashboard, healthMode),
      tone: isDegraded || isRecovering ? "warning" : "positive",
    },
    getLargestMover(dashboard),
    getGlobalLeader(dashboard.topAssets),
  ];
}
