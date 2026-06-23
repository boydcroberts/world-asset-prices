import { memo, useMemo, useState } from "react";
import clsx from "clsx";

import { LogoMark } from "./LogoMark";
import { formatCompactCurrency, formatCurrency, formatPercent, trendClass } from "../lib/formatters";
import type { DashboardStock } from "../types/dashboard";

type SortKey = "marketCap" | "change" | "name";

type UsLargeCapsProps = {
  stocks: DashboardStock[];
  onSelect: (id: string) => void;
};

const SORTS: [SortKey, string][] = [
  ["marketCap", "Market cap"],
  ["change", "Change"],
  ["name", "A–Z"],
];

/** A live 52-week range bar: the dot marks where today's price sits in the range. */
function RangeBar({ stock }: { stock: DashboardStock }) {
  const { low52w, high52w, priceUsd } = stock;
  if (low52w == null || high52w == null || priceUsd == null || high52w <= low52w) {
    return <span className="ulc-range ulc-range--empty" aria-hidden="true" />;
  }
  const pct = Math.min(1, Math.max(0, (priceUsd - low52w) / (high52w - low52w)));
  return (
    <span
      className="ulc-range"
      title={`52-week ${formatCurrency(low52w)} – ${formatCurrency(high52w)} · ${Math.round(pct * 100)}% of range`}
    >
      <span className="ulc-range-track">
        <span className="ulc-range-fill" style={{ width: `${pct * 100}%` }} />
        <span className={clsx("ulc-range-dot", trendClass(stock.changePercent))} style={{ left: `${pct * 100}%` }} />
      </span>
    </span>
  );
}

/**
 * The full US large-cap board — every tracked name in one scrollable, sortable
 * table: price, today's change (vs previous close), market cap, and a live
 * 52-week range bar. The "scroll through the whole market" centerpiece.
 */
export const UsLargeCaps = memo(function UsLargeCaps({ stocks, onSelect }: UsLargeCapsProps) {
  const [sort, setSort] = useState<SortKey>("marketCap");

  const rows = useMemo(() => {
    const list = stocks.filter((stock) => stock.priceUsd != null);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "change") list.sort((a, b) => (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity));
    else list.sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0));
    return list;
  }, [stocks, sort]);

  if (!rows.length) return null;

  return (
    <section className="ulc" aria-label="US large caps">
      <div className="ulc-head">
        <h2 className="ulc-title">US Large Caps <span className="ulc-count">{rows.length}</span></h2>
        <div className="ulc-sort" role="group" aria-label="Sort large caps">
          {SORTS.map(([key, label]) => (
            <button key={key} type="button" className={clsx("ulc-sort-btn", sort === key && "active")} onClick={() => setSort(key)} aria-pressed={sort === key}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ulc-table" role="table">
        <div className="ulc-row ulc-row--header" role="row">
          <span role="columnheader" className="ulc-c-rank">#</span>
          <span role="columnheader" className="ulc-c-name">Company</span>
          <span role="columnheader" className="ulc-c-price">Price</span>
          <span role="columnheader" className="ulc-c-chg">Today</span>
          <span role="columnheader" className="ulc-c-cap">Mkt Cap</span>
          <span role="columnheader" className="ulc-c-range">52-week range</span>
        </div>
        {rows.map((stock, index) => (
          <button key={stock.id} type="button" role="row" className="ulc-row" onClick={() => onSelect(stock.id)} aria-label={`Show ${stock.name} details`}>
            <span role="cell" className="ulc-c-rank">{index + 1}</span>
            <span role="cell" className="ulc-c-name">
              <LogoMark name={stock.name} symbol={stock.symbol} logoUrl={stock.logoUrl} fallbackLogoUrls={stock.fallbackLogoUrls} />
              <span className="ulc-sym">{stock.symbol}</span>
              <span className="ulc-nm">{stock.name}</span>
            </span>
            <span role="cell" className="ulc-c-price">{formatCurrency(stock.priceUsd)}</span>
            <span role="cell" className={clsx("ulc-c-chg", trendClass(stock.changePercent))}>{formatPercent(stock.changePercent)}</span>
            <span role="cell" className="ulc-c-cap">{formatCompactCurrency(stock.marketCapUsd)}</span>
            <span role="cell" className="ulc-c-range"><RangeBar stock={stock} /></span>
          </button>
        ))}
      </div>
    </section>
  );
});
