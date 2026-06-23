import type { DashboardStock, UsIndex } from "../types/dashboard";

export type MarketSession = "pre" | "open" | "power" | "after" | "closed";

export type MarketSessionInfo = {
  phase: MarketSession;
  /** Short human label, e.g. "Market open", "Power hour", "After hours". */
  label: string;
  /** Whether US regular trading is live right now. */
  isLive: boolean;
  /** Current ET wall-clock, e.g. "9:47:12 AM ET". */
  etClock: string;
};

const SESSION_LABEL: Record<MarketSession, string> = {
  pre: "Pre-market",
  open: "Market open",
  power: "Power hour",
  after: "After hours",
  closed: "Market closed",
};

/**
 * Derive the US trading session phase from an epoch timestamp, evaluated in
 * America/New_York so it's correct regardless of the viewer's timezone or DST.
 */
export function getMarketSession(nowMs: number): MarketSessionInfo {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  let hour = Number.parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some engines emit "24" at midnight
  const minute = Number.parseInt(get("minute"), 10);
  const minutes = hour * 60 + minute;
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  let phase: MarketSession = "closed";
  if (!isWeekend) {
    if (minutes >= 240 && minutes < 570) phase = "pre"; // 4:00–9:30
    else if (minutes >= 570 && minutes < 900) phase = "open"; // 9:30–15:00
    else if (minutes >= 900 && minutes < 960) phase = "power"; // 15:00–16:00
    else if (minutes >= 960 && minutes < 1200) phase = "after"; // 16:00–20:00
  }

  const etClock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(nowMs));

  return {
    phase,
    label: SESSION_LABEL[phase],
    isLive: phase === "open" || phase === "power",
    etClock: `${etClock} ET`,
  };
}

export function findIndex(indices: UsIndex[] | undefined, key: string): UsIndex | undefined {
  return indices?.find((index) => index.key === key);
}

export type MarketBreadth = { advancing: number; declining: number; unchanged: number; total: number };

/** Advancing / declining / unchanged across the stocks that carry a live change. */
export function deriveBreadth(stocks: DashboardStock[]): MarketBreadth {
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  for (const stock of stocks) {
    const change = stock.changePercent;
    if (change === null || !Number.isFinite(change)) continue;
    if (change > 0.05) advancing += 1;
    else if (change < -0.05) declining += 1;
    else unchanged += 1;
  }
  return { advancing, declining, unchanged, total: advancing + declining + unchanged };
}

export type SectorPerf = {
  sector: string;
  /** Cap-weighted average daily change across the sector's constituents. */
  changePercent: number | null;
  marketCapUsd: number;
  count: number;
  advancing: number;
  declining: number;
};

/** Short labels so the sector ribbon stays legible at narrow widths. */
export const SECTOR_SHORT: Record<string, string> = {
  Technology: "Tech",
  "Communication Services": "Comms",
  "Consumer Discretionary": "Cons Disc",
  "Consumer Staples": "Staples",
  Financials: "Financials",
  "Health Care": "Health",
  Energy: "Energy",
  Industrials: "Industrials",
  Utilities: "Utilities",
  "Real Estate": "Real Estate",
  Materials: "Materials",
};

/**
 * Aggregate the stock universe into sector performance — cap-weighted daily change,
 * total market cap (drives ribbon width), and advance/decline counts. Sorted by
 * market cap so the heaviest sectors lead.
 */
export function deriveSectors(stocks: DashboardStock[]): SectorPerf[] {
  type Agg = { weightedChange: number; weight: number; marketCap: number; count: number; advancing: number; declining: number };
  const map = new Map<string, Agg>();
  for (const stock of stocks) {
    if (!stock.sector) continue;
    let agg = map.get(stock.sector);
    if (!agg) {
      agg = { weightedChange: 0, weight: 0, marketCap: 0, count: 0, advancing: 0, declining: 0 };
      map.set(stock.sector, agg);
    }
    const cap = stock.marketCapUsd ?? 0;
    agg.count += 1;
    agg.marketCap += cap;
    const change = stock.changePercent;
    if (change !== null && Number.isFinite(change)) {
      const weight = cap > 0 ? cap : 1;
      agg.weightedChange += change * weight;
      agg.weight += weight;
      if (change > 0.05) agg.advancing += 1;
      else if (change < -0.05) agg.declining += 1;
    }
  }
  return [...map.entries()]
    .map(([sector, a]) => ({
      sector,
      changePercent: a.weight > 0 ? a.weightedChange / a.weight : null,
      marketCapUsd: a.marketCap,
      count: a.count,
      advancing: a.advancing,
      declining: a.declining,
    }))
    .sort((x, y) => y.marketCapUsd - x.marketCapUsd);
}

/** Top movers by absolute daily change, split into gainers and losers. */
export function deriveMovers(stocks: DashboardStock[], limit = 6): { gainers: DashboardStock[]; losers: DashboardStock[] } {
  const withChange = stocks.filter(
    (stock) => stock.changePercent !== null && Number.isFinite(stock.changePercent),
  );
  const gainers = [...withChange]
    .filter((stock) => (stock.changePercent as number) > 0)
    .sort((a, b) => (b.changePercent as number) - (a.changePercent as number))
    .slice(0, limit);
  const losers = [...withChange]
    .filter((stock) => (stock.changePercent as number) < 0)
    .sort((a, b) => (a.changePercent as number) - (b.changePercent as number))
    .slice(0, limit);
  return { gainers, losers };
}
