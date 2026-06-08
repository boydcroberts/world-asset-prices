import clsx from "clsx";

import type { DashboardEntry } from "./dashboard-insights";
import {
  formatCompactCurrency,
  formatCurrency,
  formatExactCurrency,
  formatExactNumber,
  trendClass,
} from "./formatters";

/** `formatPercent` returns this sentinel when a value is missing. */
const NO_VALUE = "—";

/** Whether a `formatPercent` result represents a real change (not the em dash). */
export function hasMeaningfulChange(changeText: string): boolean {
  return changeText !== NO_VALUE;
}

/**
 * Headline secondary text for priced cards (stocks, ETFs): "$123.45 · +1.2%"
 * when a change exists, otherwise just the formatted price.
 */
export function priceWithChangeText(priceUsd: number | null, changeText: string): string {
  const price = formatCurrency(priceUsd);
  return hasMeaningfulChange(changeText) ? `${price} · ${changeText}` : price;
}

/**
 * Secondary-line class shared by every card variant: tinted `coin-change` when
 * there's a real change to show, otherwise the muted `asset-note` style.
 */
export function changeSecondaryClass(change: number | null | undefined, hasChange: boolean): string {
  return hasChange ? clsx("coin-change", trendClass(change)) : "asset-note";
}

export type WatchlistPresentation = {
  valueLabel: string | undefined;
  value: string;
  exactValue: string;
  exactNoun: string;
};

/**
 * Resolve the headline value, label, and exact-tooltip value for a pinned
 * watchlist entry. The underlying kind (crypto / currency / priced asset /
 * private company / market-cap asset) decides which field leads — consolidating
 * the discriminator branching that previously lived inline in PinnedCard.
 */
export function presentWatchlistEntry(entry: DashboardEntry): WatchlistPresentation {
  const isCrypto = "sparkline7d" in entry;
  const isCurrency = "rateVsUsd" in entry;
  const isPrivateCompany = entry.category === "Private Company";
  const isPricedAsset = "priceUsd" in entry;

  const valueLabel = isCrypto
    ? undefined
    : isCurrency
      ? "Rate vs USD"
      : isPricedAsset
        ? "Price"
        : isPrivateCompany
          ? "Est. Valuation"
          : "Est. Market Cap";

  const value = isCurrency
    ? formatCurrency(entry.rateVsUsd)
    : isPricedAsset
      ? formatCurrency(entry.priceUsd)
      : formatCompactCurrency(entry.marketCapUsd);

  const exactValue = isCurrency
    ? formatExactCurrency(entry.rateVsUsd)
    : isPrivateCompany
      ? formatExactCurrency(entry.marketCapUsd)
      : isPricedAsset
        ? formatExactCurrency(entry.priceUsd)
        : formatExactNumber(entry.marketCapUsd);

  const exactNoun = isCurrency
    ? "Exact rate"
    : isPricedAsset
      ? "Exact"
      : isPrivateCompany
        ? "Exact valuation (USD)"
        : "Exact market cap (USD)";

  return { valueLabel, value, exactValue, exactNoun };
}
