import { describe, expect, it } from "vitest";

import {
  changeSecondaryClass,
  hasMeaningfulChange,
  presentWatchlistEntry,
  priceWithChangeText,
} from "./card-presenters";
import type {
  DashboardCrypto,
  DashboardCurrency,
  DashboardPrivateCompany,
  DashboardStock,
} from "../types/dashboard";

const base = { logoUrl: null, fallbackLogoUrls: [] as string[] };

describe("card-presenters", () => {
  it("detects a meaningful change versus the em-dash sentinel", () => {
    expect(hasMeaningfulChange("+1.20%")).toBe(true);
    expect(hasMeaningfulChange("-0.50%")).toBe(true);
    expect(hasMeaningfulChange("—")).toBe(false);
  });

  it("joins price and change, or shows price alone when there is no change", () => {
    expect(priceWithChangeText(200, "+1.20%")).toBe("$200.00 · +1.20%");
    expect(priceWithChangeText(200, "—")).toBe("$200.00");
  });

  it("returns tinted coin-change class when there's a change, else the muted note", () => {
    expect(changeSecondaryClass(1.5, true)).toBe("coin-change is-up");
    expect(changeSecondaryClass(-1, true)).toBe("coin-change is-down");
    expect(changeSecondaryClass(null, false)).toBe("asset-note");
  });

  it("presents a priced stock with the Price label", () => {
    const stock: DashboardStock = {
      ...base,
      id: "stock-aapl",
      rank: 1,
      name: "Apple",
      symbol: "AAPL",
      category: "Stock",
      marketCapUsd: 3_000_000_000_000,
      priceUsd: 200,
      changePercent: 1,
    };
    expect(presentWatchlistEntry(stock)).toMatchObject({
      valueLabel: "Price",
      value: "$200.00",
      exactNoun: "Exact",
    });
  });

  it("presents a currency by its rate", () => {
    const currency: DashboardCurrency = {
      ...base,
      id: "fx-eur",
      rank: 1,
      name: "Euro",
      symbol: "EUR",
      category: "Currency",
      rateVsUsd: 1.1,
      changePercent: 0.5,
    };
    expect(presentWatchlistEntry(currency)).toMatchObject({
      valueLabel: "Rate vs USD",
      exactNoun: "Exact rate",
    });
  });

  it("presents a private company by its estimated valuation", () => {
    const company: DashboardPrivateCompany = {
      ...base,
      id: "private-openai",
      rank: 1,
      name: "OpenAI",
      symbol: "OPENAI",
      category: "Private Company",
      marketCapUsd: 300_000_000_000,
    };
    expect(presentWatchlistEntry(company)).toMatchObject({
      valueLabel: "Est. Valuation",
      value: "$300.00B",
      exactNoun: "Exact valuation (USD)",
    });
  });

  it("presents a crypto with no value label (sparkline leads instead)", () => {
    const crypto: DashboardCrypto = {
      ...base,
      id: "crypto-btc",
      rank: 1,
      name: "Bitcoin",
      symbol: "BTC",
      category: "Crypto",
      priceUsd: 60000,
      marketCapUsd: 1_000_000_000_000,
      change24h: 2,
      sparkline7d: [1, 2, 3],
    };
    expect(presentWatchlistEntry(crypto)).toMatchObject({
      valueLabel: undefined,
      value: "$60,000.00",
    });
  });
});
