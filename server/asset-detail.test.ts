import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAssetDetailPayload } from "./asset-detail";
import type { DashboardPayload } from "./types";

function stockPayload(): DashboardPayload {
  return {
    generatedAt: "2026-05-13T00:00:00.000Z",
    stale: false,
    refreshInSec: 30,
    source: { equities: "stooq", crypto: "coinpaprika", fallbackUsed: false, equityFundamentalsAsOf: "2026-05-12" },
    degradedSegments: [],
    segmentMeta: {
      topCryptos: { source: "live", ageSec: 0 },
      topStocks: { source: "live", ageSec: 0 },
      topEtfs: { source: "live", ageSec: 0 },
      topCurrencies: { source: "live", ageSec: 0 },
      topPrivateCompanies: { source: "live", ageSec: 0 },
      night: { source: "live", ageSec: 0 },
    },
    topCryptos: [],
    topStocks: [{
      id: "stock-nvda",
      rank: 1,
      name: "NVIDIA",
      symbol: "NVDA",
      category: "Stock",
      marketCapUsd: 5_300_000_000_000,
      priceUsd: 220,
      changePercent: 1.5,
      logoUrl: null,
      fallbackLogoUrls: [],
    }],
    topEtfs: [],
    topCurrencies: [],
    topPrivateCompanies: [{
      id: "private-anthropic",
      rank: 1,
      name: "Anthropic",
      symbol: "ANTHROPIC",
      category: "Private Company",
      marketCapUsd: 965_000_000_000,
      logoUrl: null,
      fallbackLogoUrls: [],
    }, {
      id: "private-databricks",
      rank: 2,
      name: "Databricks",
      symbol: "DATABRICKS",
      category: "Private Company",
      marketCapUsd: 134_000_000_000,
      logoUrl: null,
      fallbackLogoUrls: [],
    }],
    topAssets: [],
    night: null,
  };
}

describe("buildAssetDetailPayload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns stock detail with derived valuation provenance and Yahoo-backed history", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                timestamp: [1778679000, 1778765400, 1778851800],
                indicators: {
                  quote: [{ close: [225.83, 235.74, 225.32] }],
                  adjclose: [{ adjclose: [225.83, 235.74, 225.32] }],
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

    const detail = await buildAssetDetailPayload({
      id: "stock-nvda",
      range: "30D",
      dashboard: stockPayload(),
      now: () => Date.parse("2026-05-13T00:00:00.000Z"),
    });

    expect(detail.asset.providerIds.stooq).toBe("NVDA");
    expect(detail.asset.supportsHistory).toBe(true);
    expect(detail.history.available).toBe(true);
    expect(detail.history.points).toHaveLength(3);
    expect(detail.history.points[0]).toMatchObject({ value: 225.83 });
    expect(detail.provenance.valueMethod).toBe("derived-market-cap");
    expect(detail.provenance.confidence).toBe("high");
    expect(detail.provenance.sourceTitle).toContain("NVIDIA");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("query1.finance.yahoo.com/v8/finance/chart/NVDA");
  });

  it("falls back to honest unavailable history when both equity history providers fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream down", { status: 503 })),
    );

    const detail = await buildAssetDetailPayload({
      id: "stock-nvda",
      range: "30D",
      dashboard: stockPayload(),
      now: () => Date.parse("2026-05-13T00:00:00.000Z"),
    });

    expect(detail.asset.supportsHistory).toBe(true);
    expect(detail.history.available).toBe(false);
    expect(detail.history.reason).toContain("Historical prices unavailable");
  });

  it("labels private companies as curated with unsupported history", async () => {
    const detail = await buildAssetDetailPayload({
      id: "private-anthropic",
      range: "30D",
      dashboard: stockPayload(),
      now: () => Date.parse("2026-05-13T00:00:00.000Z"),
    });

    expect(detail.provenance.source).toBe("curated");
    expect(detail.provenance.confidence).toBe("high");
    expect(detail.history.available).toBe(false);
    expect(detail.history.reason).toContain("curated");

    const databricks = await buildAssetDetailPayload({
      id: "private-databricks",
      range: "30D",
      dashboard: stockPayload(),
      now: () => Date.parse("2026-05-13T00:00:00.000Z"),
    });

    expect(databricks.provenance.alternateValuations?.[0]?.sourceType).toBe("target");
  });

  it("rejects unknown assets before building detail", async () => {
    await expect(
      buildAssetDetailPayload({
        id: "missing",
        range: "30D",
        dashboard: stockPayload(),
      }),
    ).rejects.toThrow("unknown_asset");
  });
});
