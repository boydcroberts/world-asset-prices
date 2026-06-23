import { describe, expect, it } from "vitest";

import { ASSET_VALUE_SOURCE_VERSION, ASSET_VALUE_SOURCES, getAssetValueSource } from "./value-sources";

describe("asset value sources", () => {
  it("requires verified primary source metadata for curated and derived values", () => {
    expect(ASSET_VALUE_SOURCE_VERSION).toBe("2026-06-22");
    expect(getAssetValueSource("stock-nvda")?.sourceType).toBe("recognized-market-data");
    expect(getAssetValueSource("private-spacex")?.valueUsd).toBe(1_770_000_000_000);
    expect(getAssetValueSource("private-databricks")?.alternateValuations?.[0]?.sourceType).toBe("target");
    expect(getAssetValueSource("etf-voo")?.notes).toMatch(/AUM is treated as a sourced snapshot/i);
  });

  it("does not use speculative source types as primary values", () => {
    const speculativeTypes = new Set(["rumor", "target", "secondary-market-chatter"]);
    for (const source of ASSET_VALUE_SOURCES) {
      expect(speculativeTypes.has(source.sourceType)).toBe(false);
      expect(source.sourceUrl).toMatch(/^https?:\/\//);
    }
  });
});
