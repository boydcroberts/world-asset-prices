import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAssetDetail, fetchDashboard } from "./api";
import App from "./App";
import type { AssetDetailPayload, DashboardPayload } from "./types/dashboard";

vi.mock("./api", () => ({
  fetchAssetDetail: vi.fn(),
  fetchDashboard: vi.fn(),
}));

const mockedFetchAssetDetail = vi.mocked(fetchAssetDetail);
const mockedFetchDashboard = vi.mocked(fetchDashboard);

const payload: DashboardPayload = {
  generatedAt: "2026-02-16T00:00:00.000Z",
  stale: false,
  refreshInSec: 30,
  source: {
    equities: "stooq+yahoo-finance",
    crypto: "coinpaprika",
    fallbackUsed: false,
    equityFundamentalsAsOf: "2026-05-12",
  },
  degradedSegments: [],
  segmentMeta: {
    topCryptos: {
      source: "live",
      ageSec: 0,
    },
    topStocks: {
      source: "live",
      ageSec: 0,
    },
    topEtfs: {
      source: "live",
      ageSec: 0,
    },
    topCurrencies: {
      source: "live",
      ageSec: 0,
    },
    topPrivateCompanies: {
      source: "live",
      ageSec: 0,
    },
    night: {
      source: "live",
      ageSec: 0,
    },
  },
  topCryptos: [
    {
      id: "btc-bitcoin",
      rank: 1,
      name: "Bitcoin",
      symbol: "BTC",
      category: "Crypto",
      priceUsd: null,
      marketCapUsd: 123,
      change24h: null,
      sparkline7d: [],
      logoUrl: null,
      fallbackLogoUrls: [],
    },
  ],
  topStocks: [
    {
      id: "stock-aapl",
      rank: 1,
      name: "Apple",
      symbol: "AAPL",
      category: "Stock",
      marketCapUsd: 3_000_000_000_000,
      priceUsd: 200,
      changePercent: 1,
      logoUrl: null,
      fallbackLogoUrls: [],
    },
  ],
  topEtfs: [],
  topCurrencies: [],
  topPrivateCompanies: [],
  topAssets: [
    {
      id: "commodity-gold",
      rank: 1,
      name: "Gold",
      symbol: "XAU",
      category: "Commodity",
      marketCapUsd: null,
      logoUrl: null,
      fallbackLogoUrls: [],
    },
  ],
  night: {
    id: "night-midnight2",
    name: "Midnight",
    symbol: "NIGHT",
    logoUrl: null,
    fallbackLogoUrls: [],
    priceUsd: null,
    marketCapUsd: null,
    volume24hUsd: null,
    athPriceUsd: null,
    change24h: null,
    percentFromAth: null,
  },
  indices: [
    { key: "sp500", symbol: "^GSPC", name: "S&P 500", kind: "index", level: 5000, previousClose: 4950, changeAbs: 50, changePercent: 1.01, intraday: [{ t: "2026-02-16T14:30:00.000Z", value: 4950 }, { t: "2026-02-16T15:00:00.000Z", value: 5000 }] },
    { key: "nasdaq", symbol: "^IXIC", name: "Nasdaq Composite", kind: "index", level: 16000, previousClose: 15900, changeAbs: 100, changePercent: 0.63, intraday: [] },
    { key: "dow", symbol: "^DJI", name: "Dow Jones", kind: "index", level: 40000, previousClose: 39800, changeAbs: 200, changePercent: 0.5, intraday: [] },
    { key: "vix", symbol: "^VIX", name: "VIX", kind: "volatility", level: 15, previousClose: 14, changeAbs: 1, changePercent: 7.14, intraday: [] },
    { key: "ust10y", symbol: "^TNX", name: "US 10Y", kind: "rate", level: 4.2, previousClose: 4.15, changeAbs: 0.05, changePercent: 1.2, intraday: [] },
  ],
};

const assetDetail: AssetDetailPayload = {
  asset: {
    id: "stock-aapl",
    symbol: "AAPL",
    displayName: "Apple",
    category: "Stock",
    currency: "USD",
    tradable: true,
    supportsHistory: true,
    supportsLivePrice: true,
    providerIds: { stooq: "AAPL" },
  },
  quote: {
    valueUsd: 3_000_000_000_000,
    priceUsd: 200,
    valueLabel: "Estimated market cap",
    changePercent: 1,
    asOf: "2026-02-16T00:00:00.000Z",
  },
  history: {
    range: "30D",
    available: true,
    points: [
      { t: "2026-02-01T00:00:00.000Z", value: 190 },
      { t: "2026-02-02T00:00:00.000Z", value: 200 },
    ],
  },
  provenance: {
    provider: "Stooq / Yahoo Finance fallback",
    source: "live",
    segment: "topStocks",
    ageSec: 0,
    updatedAt: "2026-02-16T00:00:00.000Z",
    valueMethod: "derived-market-cap",
    confidence: "medium",
    limitation: "Market cap is estimated.",
  },
  stale: false,
};

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App", () => {
  beforeEach(() => {
    mockedFetchAssetDetail.mockReset();
    mockedFetchAssetDetail.mockResolvedValue(assetDetail);
    mockedFetchDashboard.mockReset();
    mockedFetchDashboard.mockResolvedValue(payload);
    localStorage.clear();
  });

  it("renders the US-market hero from live indices", async () => {
    renderApp();

    expect(await screen.findByText("5,000.00")).toBeInTheDocument();
    expect(screen.getByText("Nasdaq Composite")).toBeInTheDocument();
    expect(screen.getByText("VIX")).toBeInTheDocument();
    // Breadth is derived from the live stock universe (AAPL is advancing).
    expect(screen.getByLabelText(/advancing/)).toBeInTheDocument();
  });

  it("opens an asset detail drawer from a mover", async () => {
    renderApp();

    await screen.findByText("Nasdaq Composite");
    // "Apple" surfaces both as a mover and a Beyond-US card; either opens the drawer.
    fireEvent.click(screen.getAllByRole("button", { name: "Show Apple details" })[0]);

    expect(await screen.findByRole("dialog", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByText("Market cap is estimated.")).toBeInTheDocument();
    expect(mockedFetchAssetDetail).toHaveBeenCalledWith("stock-aapl", "30D");
  });

  it("adds a local portfolio holding without sending it to an API", async () => {
    renderApp();

    // Wait for live data so the portfolio candidate list is populated.
    await screen.findByText("Nasdaq Composite");
    await screen.findByText("Portfolio Lab");
    fireEvent.change(screen.getByLabelText("Holding quantity"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Holding cost basis"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Save holding" }));

    const portfolio = screen.getByRole("region", { name: "Portfolio Lab" });
    expect(within(portfolio).getByText("Apple")).toBeInTheDocument();
    expect(localStorage.getItem("wap.portfolio.v1")).toContain("stock-aapl");
    expect(mockedFetchAssetDetail).not.toHaveBeenCalled();
  });

  it("renders safely with missing numbers and keeps ticker pills visible", async () => {
    renderApp();

    expect((await screen.findAllByText("Bitcoin")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("XAU").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("filters the searchable grid by search text", async () => {
    renderApp();

    expect((await screen.findAllByText("Bitcoin")).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Search markets"), {
      target: { value: "apple" },
    });

    // The searchable grid filters down; the always-on Markets leaderboards are
    // unaffected, so we assert the grid's empty-state rather than global absence.
    expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);
    expect(screen.getByText('No cryptocurrencies match "apple".')).toBeInTheDocument();
  });

  it("pins markets into a watchlist section", async () => {
    renderApp();

    await screen.findByText("Nasdaq Composite");
    fireEvent.click(screen.getByRole("button", { name: "Pin Apple to watchlist" }));

    const watchlist = screen.getByRole("region", { name: "Pinned Watchlist" });
    expect(within(watchlist).getByText("Apple")).toBeInTheDocument();
    expect(within(watchlist).getByRole("button", { name: "Unpin Apple from watchlist" })).toBeInTheDocument();
  });
});
