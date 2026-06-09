import { requestJsonWithRetry } from "../request.js";
import { toFiniteNumber } from "../sanitize.js";
import { resolveProviderBaseUrl } from "./base-url.js";
import type { DashboardCurrency } from "../types.js";

// Frankfurter migrated to frankfurter.dev (v1 paths); the legacy .app domain
// now 301s cross-origin, so target the canonical origin directly.
const FRANKFURTER_BASE_URL = "https://api.frankfurter.dev";

type CurrencyDef = {
  symbol: string;
  name: string;
  countryCode: string;
};

const CURRENCY_DEFINITIONS: CurrencyDef[] = [
  { symbol: "USD", name: "US Dollar",          countryCode: "us" },
  { symbol: "EUR", name: "Euro",               countryCode: "eu" },
  { symbol: "JPY", name: "Japanese Yen",       countryCode: "jp" },
  { symbol: "GBP", name: "British Pound",      countryCode: "gb" },
  { symbol: "AUD", name: "Australian Dollar",  countryCode: "au" },
  { symbol: "CAD", name: "Canadian Dollar",    countryCode: "ca" },
  { symbol: "CHF", name: "Swiss Franc",        countryCode: "ch" },
  { symbol: "CNY", name: "Chinese Yuan",       countryCode: "cn" },
  { symbol: "HKD", name: "Hong Kong Dollar",   countryCode: "hk" },
  { symbol: "NZD", name: "New Zealand Dollar", countryCode: "nz" },
  { symbol: "SGD", name: "Singapore Dollar",   countryCode: "sg" },
  { symbol: "INR", name: "Indian Rupee",       countryCode: "in" },
  { symbol: "KRW", name: "South Korean Won",   countryCode: "kr" },
  { symbol: "SEK", name: "Swedish Krona",      countryCode: "se" },
  { symbol: "MXN", name: "Mexican Peso",       countryCode: "mx" },
];

const FOREIGN_SYMBOLS = CURRENCY_DEFINITIONS
  .filter((c) => c.symbol !== "USD")
  .map((c) => c.symbol)
  .join(",");

type FrankfurterResponse = {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};

export type FetchFrankfurterOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
};

export function normalizeFrankfurterCurrencies(
  todayRates: Record<string, number>,
  yesterdayRates: Record<string, number>,
): DashboardCurrency[] {
  return CURRENCY_DEFINITIONS.map((def, index) => {
    let rateVsUsd: number | null;
    let changePercent: number | null;

    if (def.symbol === "USD") {
      rateVsUsd = 1;
      changePercent = 0;
    } else {
      const today = toFiniteNumber(todayRates[def.symbol]);
      const yesterday = toFiniteNumber(yesterdayRates[def.symbol]);

      // Frankfurter gives "X units per 1 USD", so rateVsUsd = 1 / rate
      rateVsUsd = today !== null && today > 0 ? 1 / today : null;

      if (today !== null && today > 0 && yesterday !== null && yesterday > 0) {
        const todayUsd = 1 / today;
        const yesterdayUsd = 1 / yesterday;
        changePercent = ((todayUsd - yesterdayUsd) / yesterdayUsd) * 100;
      } else {
        changePercent = null;
      }
    }

    return {
      id: `currency-${def.symbol.toLowerCase()}`,
      rank: index + 1,
      name: def.name,
      symbol: def.symbol,
      category: "Currency" as const,
      rateVsUsd,
      changePercent,
      logoUrl: `https://flagcdn.com/w40/${def.countryCode}.png`,
      fallbackLogoUrls: [`https://flagcdn.com/w80/${def.countryCode}.png`],
    };
  });
}

/**
 * Given a date string like "2026-04-15", return the previous business day.
 * ECB (Frankfurter's source) only publishes Mon–Fri.
 */
function previousBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  if (!Number.isFinite(d.getTime())) {
    return previousBusinessDay(new Date().toISOString().slice(0, 10));
  }

  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  const daysBack = dow === 1 ? 3 : dow === 0 ? 2 : 1; // Mon→Fri, Sun→Fri, else −1
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

export async function fetchTopCurrenciesFromFrankfurter(
  options: FetchFrankfurterOptions = {},
): Promise<DashboardCurrency[]> {
  const baseUrl = resolveProviderBaseUrl(
    options.baseUrl ?? process.env.FRANKFURTER_BASE_URL,
    FRANKFURTER_BASE_URL,
    "Frankfurter",
    "api.frankfurter.dev",
  );
  const qs = `from=USD&to=${FOREIGN_SYMBOLS}`;

  // Step 1: fetch latest rates — response includes the date ECB published them.
  const todayData = await requestJsonWithRetry<FrankfurterResponse>(
    `${baseUrl}/v1/latest?${qs}`,
    { timeoutMs: options.timeoutMs, retries: options.retries },
  );

  const latestDate = todayData.date ?? new Date().toISOString().slice(0, 10);
  const prevDate = previousBusinessDay(latestDate);

  // Step 2: fetch the previous business day's rates for change%.
  const yesterdayData = await requestJsonWithRetry<FrankfurterResponse>(
    `${baseUrl}/v1/${prevDate}?${qs}`,
    { timeoutMs: options.timeoutMs, retries: options.retries },
  );

  const todayRates = todayData.rates ?? {};
  const yesterdayRates = yesterdayData.rates ?? {};

  const normalized = normalizeFrankfurterCurrencies(todayRates, yesterdayRates);

  const liveCount = normalized.filter((c) => c.rateVsUsd !== null).length;
  if (liveCount < 2) {
    throw new Error(`Frankfurter returned insufficient currency data (${liveCount} live rates)`);
  }

  return normalized;
}
