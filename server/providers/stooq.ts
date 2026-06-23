import { toFiniteNumber, toSafeString } from "../sanitize.js";
import { readResponseTextWithLimit, requestJsonWithRetry } from "../request.js";
import { resolveProviderBaseUrl } from "./base-url.js";
import { sourceValueUsd } from "../value-sources.js";
import type { DashboardEtf, DashboardStock, HistoricalPoint, HistoricalRange } from "../types.js";

import fallbackPayloadJson from "../fallback/dashboard-fallback.json" with { type: "json" };
import universeStatsJson from "../data/universe-stats.json" with { type: "json" };

type UniverseStat = { prevClose?: number | null; low52w?: number | null; high52w?: number | null };
const UNIVERSE_STATS: Record<string, UniverseStat> =
  (universeStatsJson as { stats?: Record<string, UniverseStat> }).stats ?? {};

// Browser-like UA: Stooq and Yahoo intermittently 403 default Node fetch UAs.
const STOOQ_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const STOOQ_BASE_URL = "https://stooq.com";
const YAHOO_FINANCE_BASE_URL = "https://query1.finance.yahoo.com";
const STOOQ_MAX_RESPONSE_BYTES = 64_000;
const STOOQ_HISTORY_MAX_RESPONSE_BYTES = 256_000;
export const EQUITY_FUNDAMENTALS_AS_OF = "2026-05-14";
export const EQUITY_QUOTE_PROVIDERS = "stooq+yahoo-finance+yahoo-chart";

type PublicCompanyDefinition = {
  id: string;
  symbol: string;
  quoteSymbol?: string;
  name: string;
  shares?: number;
  logoSymbol?: string;
  /** GICS-style sector, threaded onto the stock for breadth/sector aggregation. */
  sector?: string;
};

// US large-cap universe (~S&P 100 subset). Live quotes from Stooq/Yahoo; market cap
// derived as price × shares. Shares outstanding + sectors sourced from Robinhood
// fundamentals on 2026-06-23 (build-time; the deployed site stays keyless). Two
// curated names (Tadawul/KRX) carry no keyless quote and use a manifest mark.
const PUBLIC_COMPANIES: PublicCompanyDefinition[] = [
  { id: "stock-nvda", symbol: "NVDA", quoteSymbol: "NVDA", name: "NVIDIA", shares: 24_598_300_000, sector: "Technology" },
  { id: "stock-aapl", symbol: "AAPL", quoteSymbol: "AAPL", name: "Apple", shares: 14_687_400_000, sector: "Technology" },
  { id: "stock-msft", symbol: "MSFT", quoteSymbol: "MSFT", name: "Microsoft", shares: 7_428_434_451, sector: "Technology" },
  { id: "stock-googl", symbol: "GOOGL", quoteSymbol: "GOOGL", name: "Alphabet", shares: 12_116_119_041, sector: "Communication Services" },
  { id: "stock-amzn", symbol: "AMZN", quoteSymbol: "AMZN", name: "Amazon", shares: 10_757_109_348, sector: "Consumer Discretionary" },
  { id: "stock-meta", symbol: "META", quoteSymbol: "META", name: "Meta Platforms", shares: 2_538_427_716, sector: "Communication Services" },
  { id: "stock-avgo", symbol: "AVGO", quoteSymbol: "AVGO", name: "Broadcom", shares: 4_757_580_149, sector: "Technology" },
  { id: "stock-tsla", symbol: "TSLA", quoteSymbol: "TSLA", name: "Tesla", shares: 3_755_723_541, sector: "Consumer Discretionary" },
  { id: "stock-tsm", symbol: "TSM", quoteSymbol: "TSM", name: "TSMC", shares: 5_186_480_000, sector: "Technology" },
  { id: "stock-lly", symbol: "LLY", quoteSymbol: "LLY", name: "Eli Lilly", shares: 941_741_355, sector: "Health Care" },
  { id: "stock-jpm", symbol: "JPM", quoteSymbol: "JPM", name: "JPMorgan Chase", shares: 2_679_511_485, sector: "Financials" },
  { id: "stock-wmt", symbol: "WMT", quoteSymbol: "WMT", name: "Walmart", shares: 7_958_080_000, sector: "Consumer Staples" },
  { id: "stock-brk-b", symbol: "BRK-B", quoteSymbol: "BRK-B", name: "Berkshire Hathaway", shares: 2_160_000_000, sector: "Financials" },
  { id: "stock-v", symbol: "V", quoteSymbol: "V", name: "Visa", shares: 1_884_125_025, sector: "Financials" },
  { id: "stock-ma", symbol: "MA", quoteSymbol: "MA", name: "Mastercard", shares: 883_583_895, sector: "Financials" },
  { id: "stock-unh", symbol: "UNH", quoteSymbol: "UNH", name: "UnitedHealth", shares: 908_144_379, sector: "Health Care" },
  { id: "stock-xom", symbol: "XOM", quoteSymbol: "XOM", name: "Exxon Mobil", shares: 4_144_950_000, sector: "Energy" },
  { id: "stock-jnj", symbol: "JNJ", quoteSymbol: "JNJ", name: "Johnson & Johnson", shares: 2_407_220_000, sector: "Health Care" },
  { id: "stock-hd", symbol: "HD", quoteSymbol: "HD", name: "Home Depot", shares: 997_117_000, sector: "Consumer Discretionary" },
  { id: "stock-pg", symbol: "PG", quoteSymbol: "PG", name: "Procter & Gamble", shares: 2_328_600_000, sector: "Consumer Staples" },
  { id: "stock-cost", symbol: "COST", quoteSymbol: "COST", name: "Costco", shares: 443_479_000, sector: "Consumer Staples" },
  { id: "stock-nflx", symbol: "NFLX", quoteSymbol: "NFLX", name: "Netflix", shares: 4_210_800_000, sector: "Communication Services" },
  { id: "stock-orcl", symbol: "ORCL", quoteSymbol: "ORCL", name: "Oracle", shares: 2_876_050_000, sector: "Technology" },
  { id: "stock-amd", symbol: "AMD", quoteSymbol: "AMD", name: "AMD", shares: 1_630_600_561, sector: "Technology" },
  { id: "stock-crm", symbol: "CRM", quoteSymbol: "CRM", name: "Salesforce", shares: 819_000_000, sector: "Technology" },
  { id: "stock-bac", symbol: "BAC", quoteSymbol: "BAC", name: "Bank of America", shares: 7_096_590_428, sector: "Financials" },
  { id: "stock-ko", symbol: "KO", quoteSymbol: "KO", name: "Coca-Cola", shares: 4_302_482_389, sector: "Consumer Staples" },
  { id: "stock-pep", symbol: "PEP", quoteSymbol: "PEP", name: "PepsiCo", shares: 1_366_770_000, sector: "Consumer Staples" },
  { id: "stock-cvx", symbol: "CVX", quoteSymbol: "CVX", name: "Chevron", shares: 1_991_600_000, sector: "Energy" },
  { id: "stock-abbv", symbol: "ABBV", quoteSymbol: "ABBV", name: "AbbVie", shares: 1_766_792_748, sector: "Health Care" },
  { id: "stock-wfc", symbol: "WFC", quoteSymbol: "WFC", name: "Wells Fargo", shares: 3_060_190_000, sector: "Financials" },
  { id: "stock-mrk", symbol: "MRK", quoteSymbol: "MRK", name: "Merck", shares: 2_469_824_522, sector: "Health Care" },
  { id: "stock-adbe", symbol: "ADBE", quoteSymbol: "ADBE", name: "Adobe", shares: 397_500_000, sector: "Technology" },
  { id: "stock-csco", symbol: "CSCO", quoteSymbol: "CSCO", name: "Cisco", shares: 3_941_434_845, sector: "Technology" },
  { id: "stock-acn", symbol: "ACN", quoteSymbol: "ACN", name: "Accenture", shares: 613_939_286, sector: "Technology" },
  { id: "stock-mcd", symbol: "MCD", quoteSymbol: "MCD", name: "McDonald's", shares: 710_506_000, sector: "Consumer Discretionary" },
  { id: "stock-tmus", symbol: "TMUS", quoteSymbol: "TMUS", name: "T-Mobile US", shares: 1_082_204_701, sector: "Communication Services" },
  { id: "stock-intc", symbol: "INTC", quoteSymbol: "INTC", name: "Intel", shares: 5_026_000_206, sector: "Technology" },
  { id: "stock-qcom", symbol: "QCOM", quoteSymbol: "QCOM", name: "Qualcomm", shares: 1_054_000_000, sector: "Technology" },
  { id: "stock-txn", symbol: "TXN", quoteSymbol: "TXN", name: "Texas Instruments", shares: 910_093_000, sector: "Technology" },
  // SpaceX IPO'd on Nasdaq as SPCX (June 12, 2026) — now a live public large-cap,
  // not a private company. Shares + sector sourced from Robinhood fundamentals 2026-06-23.
  { id: "stock-spcx", symbol: "SPCX", quoteSymbol: "SPCX", name: "SpaceX", shares: 13_183_793_257, sector: "Communication Services" },
  { id: "stock-saudi-aramco", symbol: "2222.SR", name: "Saudi Aramco", sector: "Energy" },
  { id: "stock-samsung-electronics", symbol: "005930.KS", name: "Samsung Electronics", sector: "Technology" },
];

const TOP_STOCK_SYMBOLS = PUBLIC_COMPANIES
  .map((company) => company.quoteSymbol)
  .filter((symbol): symbol is string => typeof symbol === "string");
const TOP_ETF_SYMBOLS = ["VOO", "IVV", "SPY", "VTI", "QQQ", "VUG", "GLD", "BND", "VXUS", "AGG", "VTV", "VEA", "IEFA", "VWO", "IWF"];

type FallbackStockRow = {
  symbol?: string;
  marketCapUsd?: number | null;
  priceUsd?: number | null;
};

type FallbackEtfRow = {
  symbol?: string;
  aumUsd?: number | null;
  priceUsd?: number | null;
};

const HISTORY_RANGE_DAYS: Record<HistoricalRange, number> = {
  "7D": 14,
  "30D": 45,
  "1Y": 370,
};

function normalizeFallbackSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace("BRK.B", "BRK-B");
}

function fallbackUnitsFromRows(rows: unknown[], valueKey: "marketCapUsd" | "aumUsd"): Record<string, number> {
  const units: Record<string, number> = {};

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const candidate = row as Partial<FallbackStockRow & FallbackEtfRow>;
    const symbolRaw = typeof candidate.symbol === "string" ? candidate.symbol : "";
    const symbol = normalizeFallbackSymbol(symbolRaw);
    if (!symbol) continue;

    const value = toFiniteNumber(candidate[valueKey]);
    const price = toFiniteNumber(candidate.priceUsd);
    if (value === null || price === null || !Number.isFinite(value) || !Number.isFinite(price) || price <= 0 || value <= 0) {
      continue;
    }

    const computedUnits = value / price;
    if (!Number.isFinite(computedUnits) || computedUnits <= 0) continue;
    units[symbol] = Math.round(computedUnits);
  }

  return units;
}

const FALLBACK_STOCK_UNITS = fallbackUnitsFromRows((fallbackPayloadJson as { topStocks?: unknown[] }).topStocks ?? [], "marketCapUsd");
const FALLBACK_ETF_UNITS = fallbackUnitsFromRows((fallbackPayloadJson as { topEtfs?: unknown[] }).topEtfs ?? [], "aumUsd");

function resolveStockShares(company: PublicCompanyDefinition): number {
  return company.shares ?? FALLBACK_STOCK_UNITS[company.symbol] ?? 0;
}

function sourceMarketCap(id: string): number | null {
  return sourceValueUsd(id);
}

function sourceAum(id: string): number | null {
  return sourceValueUsd(id);
}

const ETF_NAMES: Record<string, string> = {
  SPY: "SPDR S&P 500 ETF",
  IVV: "iShares Core S&P 500 ETF",
  VOO: "Vanguard S&P 500 ETF",
  VTI: "Vanguard Total Stock Market ETF",
  QQQ: "Invesco QQQ Trust",
  VUG: "Vanguard Growth ETF",
  BND: "Vanguard Total Bond Market ETF",
  AGG: "iShares Core U.S. Aggregate Bond ETF",
  VXUS: "Vanguard Total International Stock ETF",
  GLD: "SPDR Gold Shares",
  VTV: "Vanguard Value ETF",
  VEA: "Vanguard FTSE Developed Markets ETF",
  IEFA: "iShares Core MSCI EAFE ETF",
  VWO: "Vanguard FTSE Emerging Markets ETF",
  IWF: "iShares Russell 1000 Growth ETF",
};

export type FetchStooqOptions = {
  baseUrl?: string;
  yahooBaseUrl?: string;
  timeoutMs?: number;
};

type EquityQuote = {
  open: number | null;
  close: number | null;
};

type YahooFinanceQuote = {
  symbol?: string;
  regularMarketOpen?: number | string;
  regularMarketPrice?: number | string;
  regularMarketPreviousClose?: number | string;
};

type YahooFinanceQuoteResponse = {
  quoteResponse?: {
    result?: YahooFinanceQuote[];
  };
};

// Stooq uses lowercase .us suffix: NVDA → nvda.us, BRK-B → brk-b.us
function toStooqSymbol(symbol: string): string {
  return `${symbol.toLowerCase()}.us`;
}

function fromStooqSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.US$/, "");
}

function parseStooqRows(text: string): Map<string, EquityQuote> {
  const map = new Map<string, EquityQuote>();
  const lines = text.trim().split(/\r?\n/).slice(1);

  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length < 6) continue;

    const symbol = fromStooqSymbol(parts[0] ?? "");
    const open = toFiniteNumber(parts[2]);
    const close = toFiniteNumber(parts[5]);
    if (!symbol || close === null) continue;

    map.set(symbol, { open, close });
  }

  return map;
}

async function fetchStooqQuotes(
  symbols: string[],
  options: FetchStooqOptions,
): Promise<Map<string, EquityQuote>> {
  const baseUrl = resolveProviderBaseUrl(options.baseUrl ?? process.env.STOOQ_BASE_URL, STOOQ_BASE_URL, "Stooq", "stooq.com");
  const stooqSymbols = symbols.map(toStooqSymbol).join("+");
  // f=sd2ohlcv: Symbol, Date, Open, High, Low, Close, Volume
  const url = `${baseUrl}/q/l/?s=${stooqSymbols}&f=sd2ohlcv&h&e=csv`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6_000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": STOOQ_USER_AGENT,
        Accept: "text/csv,text/plain,*/*",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await readResponseTextWithLimit(response, STOOQ_MAX_RESPONSE_BYTES);
    // CSV: header line + one data line per requested symbol
    // Symbol,Date,Open,High,Low,Close,Volume
    // NVDA.US,2026-04-16,197.43,197.79,196.6,196.675,1954302
    return parseStooqRows(text);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeYahooSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace("BRK.B", "BRK-B");
}

function parseYahooQuotes(payload: unknown): Map<string, EquityQuote> {
  const map = new Map<string, EquityQuote>();
  const quotes = (payload as YahooFinanceQuoteResponse).quoteResponse?.result;
  if (!Array.isArray(quotes)) return map;

  for (const quote of quotes) {
    const symbol = normalizeYahooSymbol(toSafeString(quote.symbol, ""));
    const close = toFiniteNumber(quote.regularMarketPrice);
    if (!symbol || close === null) continue;

    map.set(symbol, {
      close,
      open: toFiniteNumber(quote.regularMarketOpen) ?? toFiniteNumber(quote.regularMarketPreviousClose),
    });
  }

  return map;
}

async function fetchYahooFinanceQuotes(symbols: string[], options: FetchStooqOptions): Promise<Map<string, EquityQuote>> {
  const baseUrl = resolveProviderBaseUrl(
    options.yahooBaseUrl ?? process.env.YAHOO_FINANCE_BASE_URL,
    YAHOO_FINANCE_BASE_URL,
    "Yahoo Finance",
    "query1.finance.yahoo.com",
  );
  const url = new URL(`${baseUrl}/v7/finance/quote`);
  url.searchParams.set("symbols", symbols.join(","));

  const payload = await requestJsonWithRetry<unknown>(url.toString(), {
    timeoutMs: options.timeoutMs,
    // retries: 0 — waterfall step; the retry budget is managed by the outer fetchEquityQuotes caller.
    retries: 0,
    maxBytes: STOOQ_MAX_RESPONSE_BYTES,
    headers: {
      "User-Agent": STOOQ_USER_AGENT,
      Accept: "application/json,*/*",
    },
  });

  return parseYahooQuotes(payload);
}

async function fetchYahooChartQuoteForSymbol(symbol: string, options: FetchStooqOptions): Promise<EquityQuote | null> {
  const baseUrl = resolveProviderBaseUrl(
    options.yahooBaseUrl ?? process.env.YAHOO_FINANCE_BASE_URL,
    YAHOO_FINANCE_BASE_URL,
    "Yahoo Finance",
    "query1.finance.yahoo.com",
  );
  const safeSymbol = encodeURIComponent(normalizeYahooSymbol(symbol));
  const url = new URL(`${baseUrl}/v8/finance/chart/${safeSymbol}`);
  url.searchParams.set("range", "5d");
  url.searchParams.set("interval", "1d");

  const payload = await requestJsonWithRetry<unknown>(url.toString(), {
    timeoutMs: options.timeoutMs,
    // retries: 0 — waterfall step; the retry budget is managed by the outer fetchEquityQuotes caller.
    retries: 0,
    maxBytes: STOOQ_HISTORY_MAX_RESPONSE_BYTES,
    headers: {
      "User-Agent": STOOQ_USER_AGENT,
      Accept: "application/json,*/*",
    },
  });

  const result = (payload as YahooChartResponse).chart?.result?.[0];
  if (!result) return null;
  const opens = result.indicators?.quote?.[0]?.open ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  for (let index = closes.length - 1; index >= 0; index -= 1) {
    const close = toFiniteNumber(closes[index]);
    if (close === null) continue;
    const open = toFiniteNumber(opens[index]);
    return { open, close };
  }
  return null;
}

async function fetchYahooChartQuotes(symbols: string[], options: FetchStooqOptions): Promise<Map<string, EquityQuote>> {
  const map = new Map<string, EquityQuote>();
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => ({ symbol, quote: await fetchYahooChartQuoteForSymbol(symbol, options) })),
  );
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    if (result.value.quote) {
      map.set(normalizeYahooSymbol(result.value.symbol), result.value.quote);
    }
  }
  return map;
}

async function fetchEquityQuotes(symbols: string[], options: FetchStooqOptions): Promise<Map<string, EquityQuote>> {
  const quotes = new Map<string, EquityQuote>();
  let stooqError: unknown;
  let yahooError: unknown;

  try {
    const stooqQuotes = await fetchStooqQuotes(symbols, options);
    stooqQuotes.forEach((quote, symbol) => {
      quotes.set(symbol, quote);
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "payload_too_large" || error.message === "Invalid Stooq base URL")) {
      throw error;
    }
    stooqError = error;
  }

  const missingAfterStooq = symbols.filter((symbol) => !quotes.has(symbol));
  if (missingAfterStooq.length > 0) {
    try {
      const yahooQuotes = await fetchYahooFinanceQuotes(missingAfterStooq, options);
      yahooQuotes.forEach((quote, symbol) => {
        quotes.set(symbol, quote);
      });
    } catch (error) {
      if (error instanceof Error && (error.message === "payload_too_large" || error.message === "Invalid Yahoo Finance base URL")) {
        throw error;
      }
      yahooError = error;
    }
  }

  const missingAfterYahooQuote = symbols.filter((symbol) => !quotes.has(symbol));
  if (missingAfterYahooQuote.length > 0) {
    try {
      const chartQuotes = await fetchYahooChartQuotes(missingAfterYahooQuote, options);
      chartQuotes.forEach((quote, symbol) => {
        quotes.set(symbol, quote);
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid Yahoo Finance base URL") {
        throw error;
      }
      if (quotes.size === 0) {
        const stooqMessage = stooqError instanceof Error ? stooqError.message : "no Stooq data";
        const yahooMessage = yahooError instanceof Error ? yahooError.message : "no Yahoo quote data";
        const chartMessage = error instanceof Error ? error.message : "unknown Yahoo chart error";
        throw new Error(
          `Equity quote providers returned no data (Stooq: ${stooqMessage}; Yahoo Finance: ${yahooMessage}; Yahoo chart: ${chartMessage})`,
        );
      }
    }
  }

  if (quotes.size === 0) {
    const stooqMessage = stooqError instanceof Error ? stooqError.message : "no Stooq data";
    const yahooMessage = yahooError instanceof Error ? yahooError.message : "no Yahoo quote data";
    throw new Error(
      `Equity quote providers returned no data (Stooq: ${stooqMessage}; Yahoo Finance: ${yahooMessage}; Yahoo chart: no symbols resolved)`,
    );
  }

  return quotes;
}

function ymd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseStooqHistoryRows(text: string): HistoricalPoint[] {
  const lines = text.trim().split(/\r?\n/).slice(1);

  return lines
    .map((line) => {
      const parts = line.split(",");
      const date = parts[0] ?? "";
      const close = toFiniteNumber(parts[4]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return {
        t: `${date}T00:00:00.000Z`,
        value: close,
      };
    })
    .filter((point): point is HistoricalPoint => point !== null);
}

export async function fetchHistoricalPricesFromStooq(
  symbol: string,
  range: HistoricalRange,
  options: FetchStooqOptions = {},
): Promise<HistoricalPoint[]> {
  const baseUrl = resolveProviderBaseUrl(options.baseUrl ?? process.env.STOOQ_BASE_URL, STOOQ_BASE_URL, "Stooq", "stooq.com");
  const safeSymbol = symbol.trim().toLowerCase().replace(".", "-");
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - HISTORY_RANGE_DAYS[range]);

  const url = `${baseUrl}/q/d/l/?s=${safeSymbol}.us&d1=${ymd(start)}&d2=${ymd(end)}&i=d`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 6_000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": STOOQ_USER_AGENT,
        Accept: "text/csv,text/plain,*/*",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await readResponseTextWithLimit(response, STOOQ_HISTORY_MAX_RESPONSE_BYTES);
    const points = parseStooqHistoryRows(text);
    if (points.length === 0) {
      throw new Error("Stooq returned no historical prices");
    }

    return points;
  } finally {
    clearTimeout(timer);
  }
}

// Yahoo Finance v8 chart endpoint range tokens.
// 7D maps to 5d because Yahoo exposes 5 trading days (~7 calendar days) but no native 7d.
const YAHOO_HISTORY_RANGE: Record<HistoricalRange, string> = {
  "7D": "5d",
  "30D": "1mo",
  "1Y": "1y",
};

type YahooChartResponse = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: {
        quote?: { open?: (number | null)[]; close?: (number | null)[] }[];
        adjclose?: { adjclose?: (number | null)[] }[];
      };
    }[];
    error?: { code?: string; description?: string } | null;
  };
};

function parseYahooHistoryPoints(payload: unknown): HistoricalPoint[] {
  const result = (payload as YahooChartResponse).chart?.result?.[0];
  if (!result) return [];

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose;
  const closes = result.indicators?.quote?.[0]?.close;
  const series = Array.isArray(adjCloses) ? adjCloses : Array.isArray(closes) ? closes : [];

  const points: HistoricalPoint[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const ts = timestamps[index];
    const close = toFiniteNumber(series[index]);
    if (typeof ts !== "number" || !Number.isFinite(ts) || close === null) continue;

    const isoDate = new Date(ts * 1_000).toISOString().slice(0, 10);
    points.push({ t: `${isoDate}T00:00:00.000Z`, value: close });
  }

  return points;
}

export async function fetchHistoricalPricesFromYahoo(
  symbol: string,
  range: HistoricalRange,
  options: FetchStooqOptions = {},
): Promise<HistoricalPoint[]> {
  const baseUrl = resolveProviderBaseUrl(
    options.yahooBaseUrl ?? process.env.YAHOO_FINANCE_BASE_URL,
    YAHOO_FINANCE_BASE_URL,
    "Yahoo Finance",
    "query1.finance.yahoo.com",
  );
  const safeSymbol = encodeURIComponent(normalizeYahooSymbol(symbol));
  const url = new URL(`${baseUrl}/v8/finance/chart/${safeSymbol}`);
  url.searchParams.set("range", YAHOO_HISTORY_RANGE[range]);
  url.searchParams.set("interval", "1d");

  const payload = await requestJsonWithRetry<unknown>(url.toString(), {
    timeoutMs: options.timeoutMs,
    // retries: 0 — waterfall step; the retry budget is managed by the outer fetchEquityQuotes caller.
    retries: 0,
    maxBytes: STOOQ_HISTORY_MAX_RESPONSE_BYTES,
    headers: {
      "User-Agent": STOOQ_USER_AGENT,
      Accept: "application/json,*/*",
    },
  });

  const points = parseYahooHistoryPoints(payload);
  if (points.length === 0) {
    throw new Error("Yahoo Finance returned no historical prices");
  }

  return points;
}

// Stooq's daily history CSV path requires an API key as of mid-2026,
// so Yahoo v8 /chart is the primary keyless path. We keep Stooq as a
// fallback in case it ever opens up again (or local mocks point there).
export async function fetchEquityHistory(
  symbol: string,
  range: HistoricalRange,
  options: FetchStooqOptions = {},
): Promise<HistoricalPoint[]> {
  let yahooError: unknown;

  try {
    return await fetchHistoricalPricesFromYahoo(symbol, range, options);
  } catch (error) {
    if (error instanceof Error && (error.message === "payload_too_large" || error.message === "Invalid Yahoo Finance base URL")) {
      throw error;
    }
    yahooError = error;
  }

  try {
    return await fetchHistoricalPricesFromStooq(symbol, range, options);
  } catch (stooqError) {
    if (stooqError instanceof Error && (stooqError.message === "payload_too_large" || stooqError.message === "Invalid Stooq base URL")) {
      throw stooqError;
    }
    const yahooMessage = yahooError instanceof Error ? yahooError.message : "no Yahoo data";
    const stooqMessage = stooqError instanceof Error ? stooqError.message : "no Stooq data";
    throw new Error(`Equity history providers returned no data (Yahoo: ${yahooMessage}; Stooq: ${stooqMessage})`);
  }
}

function calcChangePercent(open: number | null, close: number | null): number | null {
  if (open === null || close === null || open === 0) return null;
  return ((close - open) / open) * 100;
}

function calcEstimatedValue(priceUsd: number | null, unitCount: number): number | null {
  if (priceUsd === null || !Number.isFinite(priceUsd) || !Number.isFinite(unitCount) || unitCount <= 0) {
    return null;
  }

  return Math.round(priceUsd * unitCount);
}

function rankByEstimatedValue<T extends { rank: number }>(rows: T[], valueFor: (row: T) => number | null): T[] {
  return [...rows]
    .sort((left, right) => {
      const leftValue = valueFor(left) ?? Number.NEGATIVE_INFINITY;
      const rightValue = valueFor(right) ?? Number.NEGATIVE_INFINITY;
      return rightValue - leftValue;
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export async function fetchTopStocksFromStooq(
  options: FetchStooqOptions = {},
): Promise<DashboardStock[]> {
  const quotes = await fetchEquityQuotes(TOP_STOCK_SYMBOLS, options);

  if (quotes.size === 0) {
    throw new Error("Equity quote providers returned no stock data");
  }

  const stocks = PUBLIC_COMPANIES
    .map((company): DashboardStock | null => {
      const q = company.quoteSymbol ? quotes.get(company.quoteSymbol) : undefined;
      const marketCapUsd = q
        ? calcEstimatedValue(q.close, resolveStockShares(company))
        : sourceMarketCap(company.id);

      if (marketCapUsd === null) return null;

      // Daily stats (prev close + 52w) come from the bot-refreshed snapshot. Prefer
      // live-price-vs-previous-close for the day change so the sign matches the
      // indices; fall back to the intraday open→close move when prev close is absent.
      const stats = UNIVERSE_STATS[company.symbol];
      const prevClose = toFiniteNumber(stats?.prevClose);
      const liveClose = q?.close ?? null;
      const changePercent =
        liveClose === null
          ? null
          : prevClose !== null && prevClose > 0
            ? ((liveClose - prevClose) / prevClose) * 100
            : calcChangePercent(q?.open ?? null, liveClose);

      return {
        id: company.id,
        rank: 0,
        name: toSafeString(company.name, company.symbol),
        symbol: company.symbol,
        category: "Stock" as const,
        marketCapUsd,
        priceUsd: liveClose,
        changePercent,
        sector: company.sector,
        low52w: toFiniteNumber(stats?.low52w) ?? undefined,
        high52w: toFiniteNumber(stats?.high52w) ?? undefined,
        logoUrl: company.quoteSymbol ? `https://financialmodelingprep.com/image-stock/${company.logoSymbol ?? company.quoteSymbol}.png` : null,
        fallbackLogoUrls: company.quoteSymbol ? [`https://images.financialmodelingprep.com/symbol/${company.logoSymbol ?? company.quoteSymbol}.png`] : [],
      };
    })
    .filter((s): s is DashboardStock => s !== null);

  return rankByEstimatedValue(stocks, (stock) => stock.marketCapUsd);
}

export async function fetchTopEtfsFromStooq(
  options: FetchStooqOptions = {},
): Promise<DashboardEtf[]> {
  const quotes = await fetchEquityQuotes(TOP_ETF_SYMBOLS, options);

  if (quotes.size === 0) {
    throw new Error("Equity quote providers returned no ETF data");
  }

  const etfs = TOP_ETF_SYMBOLS
    .map((symbol): DashboardEtf | null => {
      const q = quotes.get(symbol);
      if (!q) return null;

      return {
        id: `etf-${symbol.toLowerCase()}`,
        rank: 0,
        name: toSafeString(ETF_NAMES[symbol], symbol),
        symbol,
        category: "ETF" as const,
        aumUsd: sourceAum(`etf-${symbol.toLowerCase()}`) ?? calcEstimatedValue(q.close, FALLBACK_ETF_UNITS[symbol] ?? 0),
        priceUsd: q.close,
        changePercent: calcChangePercent(q.open, q.close),
        logoUrl: `https://financialmodelingprep.com/image-stock/${symbol}.png`,
        fallbackLogoUrls: [`https://images.financialmodelingprep.com/symbol/${symbol}.png`],
      };
    })
    .filter((e): e is DashboardEtf => e !== null);

  return rankByEstimatedValue(etfs, (etf) => etf.aumUsd);
}
