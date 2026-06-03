import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";

vi.mock("./providers/stooq", () => ({
  EQUITY_FUNDAMENTALS_AS_OF: "2026-05-12",
  EQUITY_QUOTE_PROVIDERS: "stooq+yahoo-finance",
  fetchTopStocksFromStooq: vi.fn(),
  fetchTopEtfsFromStooq: vi.fn(),
}));

vi.mock("./providers/frankfurter", () => ({
  fetchTopCurrenciesFromFrankfurter: vi.fn(),
}));

vi.mock("./providers/coinpaprika", () => ({
  fetchTopCryptosFromCoinpaprika: vi.fn(),
  fetchNightFromCoinpaprika: vi.fn(),
}));

import { buildDashboardPayload, dashboardFallbackPayload } from "./dashboard";
import { fetchNightFromCoinpaprika, fetchTopCryptosFromCoinpaprika } from "./providers/coinpaprika";
import { fetchTopCurrenciesFromFrankfurter } from "./providers/frankfurter";
import { fetchTopEtfsFromStooq, fetchTopStocksFromStooq } from "./providers/stooq";
import type { DashboardCrypto, DashboardCurrency, DashboardEtf, DashboardNight, DashboardStock } from "./types";

const mockedFetchTopStocksFromStooq = vi.mocked(fetchTopStocksFromStooq);
const mockedFetchTopCryptosFromCoinpaprika = vi.mocked(fetchTopCryptosFromCoinpaprika);
const mockedFetchNightFromCoinpaprika = vi.mocked(fetchNightFromCoinpaprika);
const mockedFetchTopEtfsFromStooq = vi.mocked(fetchTopEtfsFromStooq);
const mockedFetchTopCurrenciesFromFrankfurter = vi.mocked(fetchTopCurrenciesFromFrankfurter);

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const sampleStocks: DashboardStock[] = [
  {
    id: "stock-aapl",
    rank: 1,
    name: "Apple",
    symbol: "AAPL",
    category: "Stock",
    marketCapUsd: 3400000000000,
    priceUsd: 210,
    changePercent: 0.4,
    logoUrl: "https://financialmodelingprep.com/image-stock/AAPL.png",
    fallbackLogoUrls: [],
  },
];

const sampleCryptos: DashboardCrypto[] = [
  {
    id: "btc-bitcoin",
    rank: 1,
    name: "Bitcoin",
    symbol: "BTC",
    category: "Crypto",
    priceUsd: 67000,
    marketCapUsd: 1300000000000,
    change24h: 1.1,
    sparkline7d: [0, 0.2, 0.6, 1.1, 2.1, 4.2],
    logoUrl: "https://static.coinpaprika.com/coin/btc-bitcoin/logo.png",
    fallbackLogoUrls: [],
  },
];

const sampleEtfs: DashboardEtf[] = [
  {
    id: "etf-spy",
    rank: 1,
    name: "SPDR S&P 500 ETF Trust",
    symbol: "SPY",
    category: "ETF",
    aumUsd: 585000000000,
    priceUsd: 528.45,
    changePercent: 0.21,
    logoUrl: "https://financialmodelingprep.com/image-stock/SPY.png",
    fallbackLogoUrls: [],
  },
  {
    id: "etf-ivv",
    rank: 2,
    name: "iShares Core S&P 500 ETF",
    symbol: "IVV",
    category: "ETF",
    aumUsd: 510000000000,
    priceUsd: 530.12,
    changePercent: 0.18,
    logoUrl: "https://financialmodelingprep.com/image-stock/IVV.png",
    fallbackLogoUrls: [],
  },
];

const sampleCurrencies: DashboardCurrency[] = [
  {
    id: "currency-usd",
    rank: 1,
    name: "US Dollar",
    symbol: "USD",
    category: "Currency",
    rateVsUsd: 1,
    changePercent: 0,
    logoUrl: "https://flagcdn.com/w40/us.png",
    fallbackLogoUrls: ["https://flagcdn.com/w80/us.png"],
  },
  {
    id: "currency-eur",
    rank: 2,
    name: "Euro",
    symbol: "EUR",
    category: "Currency",
    rateVsUsd: 1.13,
    changePercent: 0.2,
    logoUrl: "https://flagcdn.com/w40/eu.png",
    fallbackLogoUrls: ["https://flagcdn.com/w80/eu.png"],
  },
];

const sampleNight: DashboardNight = {
  id: "night-midnight2",
  name: "Midnight",
  symbol: "NIGHT",
  logoUrl: "https://static.coinpaprika.com/coin/night-midnight2/logo.png",
  fallbackLogoUrls: [],
  priceUsd: 0.84,
  marketCapUsd: 123000000,
  volume24hUsd: 5100000,
  athPriceUsd: 1.22,
  change24h: 3.1,
  percentFromAth: -31.1,
};

describe("buildDashboardPayload", () => {
  beforeEach(() => {
    mockedFetchTopStocksFromStooq.mockReset();
    mockedFetchTopCryptosFromCoinpaprika.mockReset();
    mockedFetchNightFromCoinpaprika.mockReset();
    mockedFetchTopEtfsFromStooq.mockReset();
    mockedFetchTopCurrenciesFromFrankfurter.mockReset();
  });

  it("returns fresh cache entries within TTL without refetching providers", async () => {
    const cache = new MemoryCache();
    let now = 1_000_000;

    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    now += 30_000;

    await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    expect(mockedFetchTopStocksFromStooq).toHaveBeenCalledTimes(1);
    expect(mockedFetchTopCryptosFromCoinpaprika).toHaveBeenCalledTimes(1);
    expect(mockedFetchNightFromCoinpaprika).toHaveBeenCalledTimes(1);
    expect(mockedFetchTopEtfsFromStooq).toHaveBeenCalledTimes(1);
    expect(mockedFetchTopCurrenciesFromFrankfurter).toHaveBeenCalledTimes(1);
  });

  it("serves stale cache when providers fail after cache TTL", async () => {
    const cache = new MemoryCache();
    let now = 2_000_000;

    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    mockedFetchTopStocksFromStooq.mockRejectedValue(new Error("stooq down"));
    mockedFetchTopCryptosFromCoinpaprika.mockRejectedValue(new Error("coinpaprika down"));
    mockedFetchNightFromCoinpaprika.mockRejectedValue(new Error("night down"));
    mockedFetchTopEtfsFromStooq.mockRejectedValue(new Error("etfs down"));
    mockedFetchTopCurrenciesFromFrankfurter.mockRejectedValue(new Error("frankfurter down"));

    now += 70_000;

    const payload = await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(false);
    expect(payload.degradedSegments).toEqual([]);
    expect(payload.segmentMeta.topCryptos.source).toBe("stale-cache");
    expect(payload.topStocks[0]?.symbol).toBe("AAPL");
  });

  it("uses fallback JSON when providers fail and no cache is available", async () => {
    mockedFetchTopStocksFromStooq.mockRejectedValue(new Error("stooq down"));
    mockedFetchTopCryptosFromCoinpaprika.mockRejectedValue(new Error("coinpaprika down"));
    mockedFetchNightFromCoinpaprika.mockRejectedValue(new Error("night down"));
    mockedFetchTopEtfsFromStooq.mockRejectedValue(new Error("etfs down"));
    mockedFetchTopCurrenciesFromFrankfurter.mockRejectedValue(new Error("frankfurter down"));

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 3_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(true);
    expect(payload.degradedSegments).toEqual(["topCryptos", "topStocks", "topEtfs", "topCurrencies", "night"]);
    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
    expect(payload.topCryptos[0]?.id).toBe(dashboardFallbackPayload.topCryptos[0]?.id);
  });

  it("uses monogram fallbacks for commodities instead of blocked SVG logo URLs", () => {
    const commodities = dashboardFallbackPayload.topAssets.filter((asset) => asset.category === "Commodity");

    expect(commodities.length).toBeGreaterThan(0);
    for (const commodity of commodities) {
      expect(commodity.logoUrl).toBeNull();
      expect(commodity.fallbackLogoUrls).toEqual([]);
    }
  });

  it("reports partially degraded segments when a single provider fails", async () => {
    const cache = new MemoryCache();
    const now = 4_000_000;

    mockedFetchTopStocksFromStooq.mockRejectedValue(new Error("stooq down"));
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });

    expect(payload.stale).toBe(true);
    expect(payload.source.fallbackUsed).toBe(true);
    expect(payload.degradedSegments).toEqual(["topStocks"]);
    expect(payload.segmentMeta.topCryptos.source).toBe("live");
    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
  });

  it("falls back a segment whose provider exceeds the per-segment budget", async () => {
    const cache = new MemoryCache();
    const now = 4_500_000;

    // Stocks provider hangs indefinitely; the wall-clock budget must cut it off
    // and route the segment through the existing fallback path.
    mockedFetchTopStocksFromStooq.mockReturnValue(new Promise<DashboardStock[]>(() => {}));
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      segmentBudgetMs: 30,
      logger,
    });

    expect(payload.segmentMeta.topStocks.source).toBe("fallback");
    expect(payload.segmentMeta.topCryptos.source).toBe("live");
    expect(payload.degradedSegments).toContain("topStocks");
  });

  it("includes topEtfs in the assembled payload", async () => {
    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 5_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.topEtfs).toHaveLength(2);
    expect(payload.topEtfs[0]?.symbol).toBe("SPY");
    expect(payload.segmentMeta.topEtfs.source).toBe("live");
    expect(payload.source.equityFundamentalsAsOf).toBe("2026-05-12");
  });

  it("marks topEtfs as degraded and uses fallback when ETF provider fails", async () => {
    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockRejectedValue(new Error("etf provider down"));
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 6_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.stale).toBe(true);
    expect(payload.degradedSegments).toContain("topEtfs");
    expect(payload.segmentMeta.topEtfs.source).toBe("fallback");
    expect(payload.topEtfs.length).toBeGreaterThan(0);
  });

  it("includes topCurrencies in the assembled payload", async () => {
    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 7_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.topCurrencies).toHaveLength(2);
    expect(payload.topCurrencies[0]?.symbol).toBe("USD");
    expect(payload.segmentMeta.topCurrencies.source).toBe("live");
  });

  it("does not crash when a provider resolves a malformed segment", async () => {
    mockedFetchTopStocksFromStooq.mockResolvedValue("not-an-array" as unknown as DashboardStock[]);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const payload = await buildDashboardPayload({
      cache: new MemoryCache(),
      now: () => 8_000_000,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });

    expect(payload.topStocks).toEqual([]);
    expect(payload.topCryptos[0]?.symbol).toBe("BTC");
  });

  it("tracks a segment through stale-cache, fallback, and live recovery", async () => {
    const cache = new MemoryCache();
    let now = 1_000_000;

    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const seeded = await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });
    expect(seeded.stale).toBe(false);
    expect(seeded.degradedSegments).toEqual([]);

    now += 70_000;
    mockedFetchTopStocksFromStooq.mockRejectedValue(new Error("stooq transient"));
    const staleCachePayload = await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });
    expect(staleCachePayload.stale).toBe(true);
    expect(staleCachePayload.source.fallbackUsed).toBe(false);
    expect(staleCachePayload.degradedSegments).toEqual([]);
    expect(staleCachePayload.segmentMeta.topStocks.source).toBe("stale-cache");

    now += 300_000;
    const escalatedStalePayload = await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });
    expect(escalatedStalePayload.stale).toBe(true);
    expect(escalatedStalePayload.degradedSegments).toEqual(["topStocks"]);
    expect(escalatedStalePayload.segmentMeta.topStocks.source).toBe("stale-cache");

    now += 700_000;
    mockedFetchTopStocksFromStooq.mockRejectedValue(new Error("stooq down"));
    const fallbackPayload = await buildDashboardPayload({
      cache,
      now: () => now,
      cacheTtlSec: 60,
      fallbackTtlSec: 600,
      logger,
    });
    expect(fallbackPayload.stale).toBe(true);
    expect(fallbackPayload.source.fallbackUsed).toBe(true);
    expect(fallbackPayload.degradedSegments).toEqual(["topStocks"]);
    expect(fallbackPayload.segmentMeta.topStocks.source).toBe("fallback");

    now += 5_000;
    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    const recovered = await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });
    expect(recovered.stale).toBe(false);
    expect(recovered.source.fallbackUsed).toBe(false);
    expect(recovered.degradedSegments).toEqual([]);
    expect(recovered.segmentMeta.topStocks.source).toBe("live");
  });

  it("reconciles outlier stock and ETF valuation jumps against cached values", async () => {
    const cache = new MemoryCache();
    let now = 2_500_000;

    mockedFetchTopStocksFromStooq.mockResolvedValue(sampleStocks);
    mockedFetchTopCryptosFromCoinpaprika.mockResolvedValue(sampleCryptos);
    mockedFetchNightFromCoinpaprika.mockResolvedValue(sampleNight);
    mockedFetchTopEtfsFromStooq.mockResolvedValue(sampleEtfs);
    mockedFetchTopCurrenciesFromFrankfurter.mockResolvedValue(sampleCurrencies);

    const seeded = await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });
    expect(seeded.segmentMeta.topStocks.source).toBe("live");
    expect(seeded.segmentMeta.topEtfs.source).toBe("live");

    now += 70_000;
    mockedFetchTopStocksFromStooq.mockResolvedValue([
      {
        ...sampleStocks[0],
        priceUsd: 3900,
        marketCapUsd: 8_999_000_000_000,
      },
    ]);
    mockedFetchTopEtfsFromStooq.mockResolvedValue([
      {
        ...sampleEtfs[0],
        priceUsd: 3900,
        aumUsd: 2_000_000_000_000,
      },
    ]);
    const reconciled = await buildDashboardPayload({ cache, now: () => now, cacheTtlSec: 60, fallbackTtlSec: 600, logger });
    expect(reconciled.stale).toBe(true);
    expect(reconciled.segmentMeta.topStocks.source).toBe("stale-cache");
    expect(reconciled.segmentMeta.topEtfs.source).toBe("stale-cache");
    expect(reconciled.topStocks[0]?.marketCapUsd).toBe(sampleStocks[0]?.marketCapUsd);
    expect(reconciled.topEtfs[0]?.aumUsd).toBe(sampleEtfs[0]?.aumUsd);
  });
});
