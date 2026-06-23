export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// Intl.NumberFormat construction is the expensive part — instances are immutable
// and reusable, so we build each configuration once and reuse it across every
// cell/render instead of allocating ~90 formatters per full dashboard paint.
const exactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 10,
});

const exactNumberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 10,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

// formatCurrency varies its fraction digits by magnitude, so cache one formatter
// per distinct digit count (2/4/6/8) the first time each is needed.
const currencyFormatters = new Map<number, Intl.NumberFormat>();
function currencyFormatter(maxDigits: number): Intl.NumberFormat {
  let formatter = currencyFormatters.get(maxDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: maxDigits,
    });
    currencyFormatters.set(maxDigits, formatter);
  }
  return formatter;
}

export function formatCurrency(value: unknown): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  if (value === 0) {
    return "$0.00";
  }

  const abs = Math.abs(value);
  let maxDigits = 2;

  if (abs < 1) {
    maxDigits = abs < 0.01 ? 8 : 6;
  } else if (abs < 100) {
    maxDigits = 4;
  }

  return currencyFormatter(maxDigits).format(value);
}

export function formatExactCurrency(value: unknown): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  return exactCurrencyFormatter.format(value);
}

export function formatExactNumber(value: unknown): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  return exactNumberFormatter.format(value);
}

export function formatCompactCurrency(value: unknown): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  return compactCurrencyFormatter.format(value);
}

export function formatPercent(value: unknown): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

const levelFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Comma-grouped index level with 2 decimals (e.g. 7,472.79). */
export function formatLevel(value: unknown): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }
  return levelFormatter.format(value);
}

/** Signed, comma-grouped points change with a true minus glyph (e.g. +41.33 / −18.20). */
export function formatPoints(value: unknown): string {
  if (!isFiniteNumber(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${levelFormatter.format(Math.abs(value))}`;
}

export function trendClass(value: unknown): "is-up" | "is-down" | "is-flat" {
  if (!isFiniteNumber(value) || value === 0) {
    return "is-flat";
  }

  return value > 0 ? "is-up" : "is-down";
}
