import { describe, expect, it } from "vitest";

import {
  formatCompactCurrency,
  formatCurrency,
  formatExactCurrency,
  formatExactNumber,
  formatPercent,
  trendClass,
} from "./formatters";

describe("formatters", () => {
  it("returns an em dash for invalid currency input", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(Number.NaN)).toBe("—");
    expect(formatCompactCurrency(Infinity)).toBe("—");
    expect(formatExactCurrency(null)).toBe("—");
    expect(formatExactNumber(Number.NaN)).toBe("—");
  });

  it("formats exact zero as $0.00 rather than $0.00000000", () => {
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(-0)).toBe("$0.00");
  });

  it("selects the right precision band and the cached formatters stay distinct", () => {
    // formatCurrency caches one Intl.NumberFormat per maxDigits; assert each
    // magnitude band returns its own correct precision (a mis-keyed cache would
    // reuse the wrong formatter and slip past the sentinel-only coverage).
    expect(formatCurrency(60_000)).toBe("$60,000.00"); // >=100 → 2 digits
    expect(formatCurrency(1.23456)).toBe("$1.2346"); // <100 → 4 digits
    expect(formatCurrency(0.123456)).toBe("$0.123456"); // <1 → 6 digits
    expect(formatCurrency(0.00012345678)).toBe("$0.00012346"); // <0.01 → 8 digits
    // Re-call earlier bands to prove the Map cache returns distinct instances.
    expect(formatCurrency(60_000)).toBe("$60,000.00");
    expect(formatCurrency(1.23456)).toBe("$1.2346");
  });

  it("formats exact currency and number with full precision", () => {
    expect(formatExactCurrency(1234.5)).toBe("$1,234.50");
    expect(formatExactNumber(1_024_000_000_000)).toBe("1,024,000,000,000");
  });

  it("formats percent with sign and precision", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-0.556)).toBe("-0.56%");
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("returns trend classes for positive, negative, zero, and invalid", () => {
    expect(trendClass(1)).toBe("is-up");
    expect(trendClass(-1)).toBe("is-down");
    expect(trendClass(0)).toBe("is-flat");
    expect(trendClass(null)).toBe("is-flat");
  });
});
