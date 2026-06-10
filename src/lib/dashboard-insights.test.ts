import { describe, expect, it } from "vitest";

import {
  buildDashboardInsights,
  dashboardEntryMatches,
  getEntryChange,
  getEntryValue,
  getWorstSegmentHealthSummaries,
  sortDashboardEntries,
} from "./dashboard-insights";
import type { DashboardAsset, DashboardCrypto, DashboardCurrency, DashboardPayload, DashboardStock } from "../types/dashboard";

const btc: DashboardCrypto = {
  id: "btc-bitcoin",
  rank: 1,
  name: "Bitcoin",
  symbol: "BTC",
  category: "Crypto",
  priceUsd: 100_000,
  marketCapUsd: 2_000_000_000_000,
  change24h: 2.5,
  sparkline7d: [95_000, 100_000],
  logoUrl: null,
  fallbackLogoUrls: [],
};

const apple: DashboardStock = {
  id: "stock-aapl",
  rank: 2,
  name: "Apple",
  symbol: "AAPL",
  category: "Stock",
  marketCapUsd: 3_000_000_000_000,
  priceUsd: 220,
  changePercent: -1.25,
  logoUrl: null,
  fallbackLogoUrls: [],
};

const euro: DashboardCurrency = {
  id: "currency-eur",
  rank: 2,
  name: "Euro",
  symbol: "EUR",
  category: "Currency",
  rateVsUsd: 1.08,
  changePercent: 0.35,
  logoUrl: null,
  fallbackLogoUrls: [],
};

const gold: DashboardAsset = {
  id: "asset-gold",
  rank: 1,
  name: "Gold",
  symbol: "XAU",
  category: "Commodity",
  marketCapUsd: 20_000_000_000_000,
  logoUrl: null,
  fallbackLogoUrls: [],
};

function makePayload(overrides: Partial<DashboardPayload> = {}): DashboardPayload {
  return {
    generatedAt: "2026-05-01T12:00:00.000Z",
    stale: false,
    refreshInSec: 30,
    source: {
      equities: "stooq",
      crypto: "coinpaprika",
      fallbackUsed: false,
    },
    degradedSegments: [],
    segmentMeta: {
      topCryptos: { source: "live", ageSec: 2 },
      topStocks: { source: "fresh-cache", ageSec: 12 },
      topEtfs: { source: "live", ageSec: 5 },
      topCurrencies: { source: "live", ageSec: 3 },
      topPrivateCompanies: { source: "live", ageSec: 7 },
      night: { source: "live", ageSec: 9 },
    },
    topCryptos: [btc],
    topStocks: [apple],
    topEtfs: [],
    topCurrencies: [euro],
    topPrivateCompanies: [],
    topAssets: [gold],
    night: null,
    ...overrides,
  };
}

describe("dashboard insights", () => {
  it("matches entries by name, symbol, and category", () => {
    expect(dashboardEntryMatches(btc, "bit")).toBe(true);
    expect(dashboardEntryMatches(apple, "aapl")).toBe(true);
    expect(dashboardEntryMatches(euro, "currency")).toBe(true);
    expect(dashboardEntryMatches(gold, "tesla")).toBe(false);
  });

  it("uses the displayed numeric value for each dashboard entry type", () => {
    expect(getEntryValue(btc)).toBe(2_000_000_000_000);
    expect(getEntryValue(apple)).toBe(3_000_000_000_000);
    expect(getEntryValue(euro)).toBe(1.08);
    expect(getEntryValue(gold)).toBe(20_000_000_000_000);
  });

  it("extracts comparable movement values", () => {
    expect(getEntryChange(btc)).toBe(2.5);
    expect(getEntryChange(apple)).toBe(-1.25);
    expect(getEntryChange(euro)).toBe(0.35);
    expect(getEntryChange(gold)).toBeNull();
  });

  it("sorts entries by name, value, movement, and rank", () => {
    expect(sortDashboardEntries([btc, apple, euro], "name").map((entry) => entry.symbol)).toEqual(["AAPL", "BTC", "EUR"]);
    expect(sortDashboardEntries([euro, apple, btc], "value").map((entry) => entry.symbol)).toEqual(["AAPL", "BTC", "EUR"]);
    expect(sortDashboardEntries([apple, euro, btc], "movement").map((entry) => entry.symbol)).toEqual(["BTC", "AAPL", "EUR"]);
    expect(sortDashboardEntries([apple, euro, btc], "rank").map((entry) => entry.symbol)).toEqual(["BTC", "AAPL", "EUR"]);
  });

  it("builds concise hero insight cards from dashboard data", () => {
    expect(buildDashboardInsights(makePayload())).toEqual([
      { label: "Tracked markets", value: "4", detail: "Across 6 live sections", tone: "neutral" },
      { label: "Data health", value: "Live", detail: "5 of 5 provider segments live; curated snapshots verified", tone: "positive" },
      { label: "Largest move", value: "+2.50%", detail: "Bitcoin (BTC)", tone: "positive" },
      { label: "Global leader", value: "$20T", detail: "Gold (XAU)", tone: "neutral" },
    ]);
  });

  it("reports correct section/segment counts when night is stripped (runtime shape)", () => {
    // The live client strips `night` from segmentMeta (api.ts SEGMENT_KEYS), so
    // segmentMeta has only the 5 provider segments at runtime. Counts must still
    // read 6 sections / 5 of 5 — the previous `length - 1` math reported 5 / 4 of 4.
    const base = makePayload();
    const normalized: DashboardPayload = {
      ...base,
      segmentMeta: {
        topCryptos: { source: "live", ageSec: 2 },
        topStocks: { source: "fresh-cache", ageSec: 12 },
        topEtfs: { source: "live", ageSec: 5 },
        topCurrencies: { source: "live", ageSec: 3 },
        topPrivateCompanies: { source: "live", ageSec: 7 },
      } as DashboardPayload["segmentMeta"],
    };
    const insights = buildDashboardInsights(normalized);
    expect(insights[0].detail).toBe("Across 6 live sections");
    expect(insights[1].detail).toBe("5 of 5 provider segments live; curated snapshots verified");
  });

  it("marks degraded payloads in the data health insight", () => {
    const insights = buildDashboardInsights(makePayload({
      stale: true,
      degradedSegments: ["topStocks"],
      source: {
        equities: "stooq",
        crypto: "coinpaprika",
        fallbackUsed: true,
      },
      segmentMeta: {
        ...makePayload().segmentMeta,
        topStocks: {
          ...makePayload().segmentMeta.topStocks,
          source: "stale-cache",
          ageSec: 60,
        },
      },
    }));

    expect(insights[1]).toEqual({
      label: "Data health",
      value: "Degraded",
      detail: "Using 1 stale segment",
      tone: "warning",
    });
  });

  it("marks short stale-cache payloads as recovering instead of degraded", () => {
    const insights = buildDashboardInsights(makePayload({
      stale: true,
      degradedSegments: [],
      segmentMeta: {
        ...makePayload().segmentMeta,
        topStocks: {
          ...makePayload().segmentMeta.topStocks,
          source: "stale-cache",
          ageSec: 60,
        },
      },
    }));

    expect(insights[1]).toEqual({
      label: "Data health",
      value: "Recovering",
      detail: "1 segment retrying with recent cache",
      tone: "warning",
    });
  });

  it("returns top degraded segments with the worst health first", () => {
    const summary = getWorstSegmentHealthSummaries(
      makePayload({
        degradedSegments: ["topStocks", "topEtfs", "topPrivateCompanies"],
        segmentMeta: {
          topCryptos: { source: "live", ageSec: 0 },
          topStocks: { source: "durable-cache", ageSec: 4_100 },
          topEtfs: { source: "fallback", ageSec: 3_000 },
          topCurrencies: { source: "live", ageSec: 0 },
          topPrivateCompanies: { source: "stale-cache", ageSec: 4_050 },
          night: { source: "live", ageSec: 0 },
        },
      }),
    );

    expect(summary).toEqual([
      { segment: "topEtfs", label: "ETFs", source: "fallback", ageSec: 3_000 },
      { segment: "topStocks", label: "Public companies", source: "durable-cache", ageSec: 4_100 },
      { segment: "topPrivateCompanies", label: "Private companies", source: "stale-cache", ageSec: 4_050 },
    ]);
  });
});
