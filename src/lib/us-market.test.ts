import { describe, expect, it } from "vitest";

import type { DashboardStock } from "../types/dashboard";
import {
  deriveBreadth,
  deriveSectors,
  deriveMovers,
  deriveMood,
  deriveNarrative,
  getMarketSession,
  type MarketBreadth,
  type SectorPerf,
} from "./us-market";

/** Minimal Stock factory — only the fields the derivations read. */
function stock(partial: Partial<DashboardStock> & { id: string }): DashboardStock {
  return {
    category: "Stock",
    rank: 1,
    name: partial.id,
    symbol: partial.id.toUpperCase(),
    logoUrl: null,
    fallbackLogoUrls: [],
    marketCapUsd: 1_000_000_000,
    priceUsd: 100,
    changePercent: null,
    ...partial,
  };
}

function breadth(advancing: number, declining: number, unchanged = 0): MarketBreadth {
  return { advancing, declining, unchanged, total: advancing + declining + unchanged };
}

describe("deriveBreadth", () => {
  it("buckets by the ±0.05 dead-zone and ignores null/non-finite changes", () => {
    const b = deriveBreadth([
      stock({ id: "a", changePercent: 1.2 }),
      stock({ id: "b", changePercent: -0.8 }),
      stock({ id: "c", changePercent: 0.0 }), // unchanged (within dead-zone)
      stock({ id: "d", changePercent: 0.04 }), // unchanged (within dead-zone)
      stock({ id: "e", changePercent: null }), // skipped
      stock({ id: "f", changePercent: Number.NaN }), // skipped
    ]);
    expect(b).toEqual({ advancing: 1, declining: 1, unchanged: 2, total: 4 });
  });
});

describe("deriveSectors", () => {
  it("cap-weights the change and sorts heaviest sector first", () => {
    const sectors = deriveSectors([
      stock({ id: "mega", sector: "Technology", marketCapUsd: 3_000_000_000_000, changePercent: 2 }),
      stock({ id: "small", sector: "Technology", marketCapUsd: 1_000_000_000, changePercent: -2 }),
      stock({ id: "util", sector: "Utilities", marketCapUsd: 50_000_000_000, changePercent: 1 }),
    ]);
    expect(sectors[0].sector).toBe("Technology"); // heaviest leads
    // Tech change is dominated by the mega-cap → close to +2, not the simple mean (0).
    expect(sectors[0].changePercent).toBeGreaterThan(1.9);
    expect(sectors[0].advancing).toBe(1);
    expect(sectors[0].declining).toBe(1);
    expect(sectors[0].count).toBe(2);
  });

  it("ignores stocks with no sector", () => {
    const sectors = deriveSectors([stock({ id: "x", changePercent: 1 })]);
    expect(sectors).toHaveLength(0);
  });
});

describe("deriveMovers", () => {
  it("splits gainers and losers, each sorted by magnitude and capped at limit", () => {
    const { gainers, losers } = deriveMovers(
      [
        stock({ id: "g1", changePercent: 5 }),
        stock({ id: "g2", changePercent: 9 }),
        stock({ id: "l1", changePercent: -3 }),
        stock({ id: "l2", changePercent: -7 }),
        stock({ id: "flat", changePercent: 0 }),
        stock({ id: "na", changePercent: null }),
      ],
      1,
    );
    expect(gainers.map((s) => s.id)).toEqual(["g2"]); // biggest gainer first, capped at 1
    expect(losers.map((s) => s.id)).toEqual(["l2"]); // biggest loser first, capped at 1
  });
});

describe("deriveMood", () => {
  it("reads bullish when index up and breadth positive", () => {
    const mood = deriveMood(breadth(8, 2), 1.0);
    expect(mood.tone).toBe("bullish");
    expect(mood.intensity).toBeGreaterThan(0);
    expect(mood.intensity).toBeLessThanOrEqual(1);
  });

  it("reads bearish when index down and breadth negative", () => {
    expect(deriveMood(breadth(2, 8), -1.0).tone).toBe("bearish");
  });

  it("reads neutral on a flat, evenly-split tape", () => {
    expect(deriveMood(breadth(5, 5), 0).tone).toBe("neutral");
  });

  it("weights index direction over breadth (cap-weighted mega-cap day)", () => {
    // Index solidly green, but breadth slightly negative → index wins.
    expect(deriveMood(breadth(4, 6), 1.5).tone).toBe("bullish");
  });

  it("clamps intensity to 1 on an extreme day", () => {
    expect(deriveMood(breadth(20, 0), 10).intensity).toBe(1);
  });

  it("treats null/non-finite index change as zero direction", () => {
    expect(deriveMood(breadth(5, 5), null).tone).toBe("neutral");
    expect(deriveMood(breadth(5, 5), Number.NaN).tone).toBe("neutral");
  });
});

describe("deriveNarrative", () => {
  const sec = (sector: string, changePercent: number): SectorPerf => ({
    sector,
    changePercent,
    marketCapUsd: 1,
    count: 1,
    advancing: changePercent > 0 ? 1 : 0,
    declining: changePercent < 0 ? 1 : 0,
  });

  it("returns empty string with no sectors", () => {
    expect(deriveNarrative([], 1)).toBe("");
  });

  it("names the divergence when the index is red but most sectors held green", () => {
    const sectors = [sec("Technology", 0.5), sec("Energy", 0.3), sec("Financials", -0.1)];
    const line = deriveNarrative(sectors, -0.8);
    expect(line).toContain("Heavyweights drag");
    expect(line).toContain("Technology"); // top sector named
  });

  it("calls a broad advance when index and breadth both rise", () => {
    const sectors = [sec("Technology", 1.2), sec("Energy", 0.8), sec("Utilities", 0.4)];
    expect(deriveNarrative(sectors, 1.0)).toContain("Broad advance");
  });

  it("flags a narrow rally when index is up but breadth is negative", () => {
    const sectors = [sec("Technology", 1.5), sec("Energy", -0.4), sec("Utilities", -0.6)];
    expect(deriveNarrative(sectors, 0.9)).toContain("Narrow rally");
  });
});

describe("getMarketSession", () => {
  // 2026-06-26 is a Friday. Pick UTC instants that map to known ET wall-clocks.
  const etTuesdayNoon = Date.UTC(2026, 5, 23, 16, 0, 0); // 12:00 ET (EDT) → open
  const etPreMarket = Date.UTC(2026, 5, 23, 12, 0, 0); // 08:00 ET → pre
  const etPowerHour = Date.UTC(2026, 5, 23, 19, 30, 0); // 15:30 ET → power
  const etAfter = Date.UTC(2026, 5, 23, 21, 0, 0); // 17:00 ET → after
  const saturday = Date.UTC(2026, 5, 27, 16, 0, 0); // weekend → closed

  it("classifies the trading phases from an ET-aware clock", () => {
    expect(getMarketSession(etPreMarket).phase).toBe("pre");
    expect(getMarketSession(etTuesdayNoon).phase).toBe("open");
    expect(getMarketSession(etTuesdayNoon).isLive).toBe(true);
    expect(getMarketSession(etPowerHour).phase).toBe("power");
    expect(getMarketSession(etAfter).phase).toBe("after");
    expect(getMarketSession(etAfter).isLive).toBe(false);
  });

  it("is closed on the weekend", () => {
    expect(getMarketSession(saturday).phase).toBe("closed");
  });
});
