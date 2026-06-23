import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchEquityHistory,
  fetchHistoricalPricesFromStooq,
  fetchHistoricalPricesFromYahoo,
  fetchTopEtfsFromStooq,
  fetchTopStocksFromStooq,
} from "./stooq";

describe("Stooq provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches stock quotes from Stooq and fills missing symbols from Yahoo Finance", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("query1.finance.yahoo.com")) {
        return new Response(
          JSON.stringify({
            quoteResponse: {
              result: [
                {
                  symbol: "GOOGL",
                  regularMarketOpen: 388,
                  regularMarketPrice: 390,
                },
              ],
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      return new Response(
        [
          "Symbol,Date,Open,High,Low,Close,Volume",
          "NVDA.US,2026-05-04,199.5,201.73,194.74,198.543,85711680",
          "AAPL.US,2026-05-04,279.655,280.63,274.8601,276.873,26725780",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "content-type": "text/csv",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const stocks = await fetchTopStocksFromStooq({ timeoutMs: 1000 });

    const calls = fetchMock.mock.calls.map((call) => String(call[0] as string | URL));
    expect(calls[0]).toContain("s=nvda.us+aapl.us+msft.us");
    expect(calls.some((url) => url.includes("query1.finance.yahoo.com/v7/finance/quote"))).toBe(true);
    // NVDA/AAPL resolve from Stooq and GOOGL from Yahoo (live price × shares); the
    // other original names fall back to their manifest market cap (priceUsd null);
    // the newer universe names lack both a quote and a manifest mark and drop out.
    const bySymbol = Object.fromEntries(stocks.map((stock) => [stock.symbol, stock]));
    expect(stocks).toHaveLength(15);
    expect(stocks[0].symbol).toBe("NVDA"); // highest market cap leads
    expect(bySymbol.NVDA).toMatchObject({ priceUsd: 198.543, marketCapUsd: Math.round(198.543 * 24_598_300_000) });
    expect(bySymbol.GOOGL).toMatchObject({ priceUsd: 390, marketCapUsd: Math.round(390 * 12_116_119_041) });
    expect(bySymbol.AAPL).toMatchObject({ priceUsd: 276.873, marketCapUsd: Math.round(276.873 * 14_687_400_000) });
    expect(bySymbol["2222.SR"]).toMatchObject({
      name: "Saudi Aramco",
      priceUsd: null,
      marketCapUsd: 1_703_000_000_000,
    });
  });

  it("fetches ETF quotes in a single batched Stooq request", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("query1.finance.yahoo.com")) {
        return new Response(JSON.stringify({ quoteResponse: { result: [] } }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      return new Response(
        [
          "Symbol,Date,Open,High,Low,Close,Volume",
          "SPY.US,2026-05-04,720.07,722.12,715,718.03,38285071",
          "IVV.US,2026-05-04,722.62,725,717.2,720.31,5123456",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "content-type": "text/csv",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const etfs = await fetchTopEtfsFromStooq({ timeoutMs: 1000 });

    const calls = fetchMock.mock.calls.map((call) => String(call[0] as string | URL));
    expect(calls[0]).toContain("s=voo.us+ivv.us+spy.us");
    expect(etfs).toHaveLength(2);
    // CSV row order is independent of TOP_ETF_SYMBOLS rank order;
    // SPY rank is 3 in the canonical list.
    const spy = etfs.find((etf) => etf.symbol === "SPY");
    expect(spy).toMatchObject({
      symbol: "SPY",
      priceUsd: 718.03,
      aumUsd: 758_880_000_000,
    });
  });

  it("rejects oversized CSV responses before normalizing quotes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("Symbol,Date,Open,High,Low,Close,Volume\nNVDA.US,2026-04-16,100,101,99,101,123", {
          status: 200,
          headers: {
            "content-type": "text/csv",
            "content-length": "1000000",
          },
        }),
      ),
    );

    await expect(
      fetchTopStocksFromStooq({
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("payload_too_large");
  });

  it("rejects unexpected base URL hosts before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchTopStocksFromStooq({
        baseUrl: "https://evil.example",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("Invalid Stooq base URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Yahoo Finance when Stooq fails completely", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("query1.finance.yahoo.com")) {
        return new Response(
          JSON.stringify({
            quoteResponse: {
              result: [
                {
                  symbol: "NVDA",
                  regularMarketOpen: 224,
                  regularMarketPrice: 225,
                },
              ],
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      return new Response("upstream down", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const stocks = await fetchTopStocksFromStooq({ timeoutMs: 1000 });

    const calls = fetchMock.mock.calls.map((call) => String(call[0] as string | URL));
    expect(calls.some((url) => url.includes("stooq.com"))).toBe(true);
    expect(calls.some((url) => url.includes("query1.finance.yahoo.com/v7/finance/quote"))).toBe(true);
    // NVDA resolves live from Yahoo; the other original names fall back to their
    // manifest market cap; the newer universe names (no quote, no manifest) drop out.
    expect(stocks).toHaveLength(15);
    expect(stocks[0]).toMatchObject({
      symbol: "NVDA",
      priceUsd: 225,
      marketCapUsd: Math.round(225 * 24_598_300_000),
    });
  });

  it("uses Yahoo Finance v8 chart as a third-tier quote fallback when v7 also fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/v8/finance/chart/NVDA")) {
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  timestamp: [1778765400],
                  indicators: { quote: [{ open: [220], close: [225] }] },
                },
              ],
              error: null,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/v8/finance/chart/")) {
        return new Response(JSON.stringify({ chart: { result: [], error: null } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("query1.finance.yahoo.com/v7/finance/quote")) {
        return new Response("rate limited", { status: 429 });
      }
      return new Response("upstream down", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const stocks = await fetchTopStocksFromStooq({ timeoutMs: 1000 });

    const calls = fetchMock.mock.calls.map((call) => String(call[0] as string | URL));
    expect(calls.some((url) => url.includes("/v8/finance/chart/NVDA"))).toBe(true);
    expect(stocks).toHaveLength(15);
    expect(stocks.find((stock) => stock.symbol === "NVDA")).toMatchObject({
      priceUsd: 225,
      changePercent: 2.272727272727273,
    });
  });

  it("normalizes Yahoo Finance v8 chart history with adjusted close when available", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                timestamp: [1778679000, 1778765400, 1778851800],
                indicators: {
                  quote: [{ close: [200, null, 205] }],
                  adjclose: [{ adjclose: [201, 203, 206] }],
                },
              },
            ],
            error: null,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const points = await fetchHistoricalPricesFromYahoo("NVDA", "30D", { timeoutMs: 1000 });

    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("query1.finance.yahoo.com/v8/finance/chart/NVDA");
    expect(url).toContain("range=1mo");
    expect(url).toContain("interval=1d");
    expect(points).toHaveLength(3);
    expect(points[0]).toMatchObject({ value: 201 });
    expect(points[2]).toMatchObject({ value: 206 });
  });

  it("skips Yahoo Finance history points with null closes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  timestamp: [1778679000, 1778765400],
                  indicators: {
                    quote: [{ close: [null, 235] }],
                  },
                },
              ],
              error: null,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const points = await fetchHistoricalPricesFromYahoo("NVDA", "7D", { timeoutMs: 1000 });

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ value: 235 });
  });

  it("falls back to Stooq when Yahoo Finance history returns no data", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("query1.finance.yahoo.com")) {
        return new Response(JSON.stringify({ chart: { result: [], error: null } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        [
          "Date,Open,High,Low,Close,Volume",
          "2026-05-01,200,205,199,204.5,1234",
          "2026-05-04,204,208,203,207.25,4567",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/csv" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const points = await fetchEquityHistory("NVDA", "30D", { timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("query1.finance.yahoo.com");
    expect(String((fetchMock.mock.calls[1] as unknown[])[0])).toContain("/q/d/l/?s=nvda.us");
    expect(points).toEqual([
      { t: "2026-05-01T00:00:00.000Z", value: 204.5 },
      { t: "2026-05-04T00:00:00.000Z", value: 207.25 },
    ]);
  });

  it("normalizes historical daily prices from Stooq", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          "Date,Open,High,Low,Close,Volume",
          "2026-05-01,200,205,199,204.5,1234",
          "2026-05-04,204,208,203,207.25,4567",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "content-type": "text/csv",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const points = await fetchHistoricalPricesFromStooq("NVDA", "30D", { timeoutMs: 1000 });

    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/q/d/l/?s=nvda.us");
    expect(points).toEqual([
      { t: "2026-05-01T00:00:00.000Z", value: 204.5 },
      { t: "2026-05-04T00:00:00.000Z", value: 207.25 },
    ]);
  });
});
