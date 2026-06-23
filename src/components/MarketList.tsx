import { memo } from "react";
import clsx from "clsx";

import { LogoMark } from "./LogoMark";
import { formatPercent, trendClass } from "../lib/formatters";

export type MarketRow = {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  fallbackLogoUrls: string[];
  value: string;
  change: number | null;
  /** When false, the change column is omitted (curated lists without daily change). */
  hasChange: boolean;
};

type MarketListProps = {
  title: string;
  rows: MarketRow[];
  onSelect: (id: string) => void;
  limit?: number;
};

/**
 * A compact top-N ranked market list — the classic "leaderboard" view (crypto,
 * ETFs, FX, commodities, private), rendered in the MERIDIAN type system. Each row
 * opens the detail drawer.
 */
export const MarketList = memo(function MarketList({ title, rows, onSelect, limit = 10 }: MarketListProps) {
  const visible = rows.slice(0, limit);
  if (!visible.length) return null;

  return (
    <section className="ml" aria-label={title}>
      <h3 className="ml-title">{title}</h3>
      <ol className="ml-list">
        {visible.map((row, index) => (
          <li key={row.id}>
            <button type="button" className="ml-row" onClick={() => onSelect(row.id)} aria-label={`Show ${row.name} details`}>
              <span className="ml-rank">{index + 1}</span>
              <LogoMark name={row.name} symbol={row.symbol} logoUrl={row.logoUrl} fallbackLogoUrls={row.fallbackLogoUrls} />
              <span className="ml-sym">{row.symbol}</span>
              <span className="ml-nm">{row.name}</span>
              <span className="ml-val">{row.value}</span>
              {row.hasChange ? (
                <span className={clsx("ml-chg", trendClass(row.change))}>{formatPercent(row.change)}</span>
              ) : (
                <span className="ml-chg ml-chg--none" aria-hidden="true" />
              )}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
});
