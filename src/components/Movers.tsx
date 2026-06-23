import { memo } from "react";
import clsx from "clsx";

import { LogoMark } from "./LogoMark";
import { formatPercent, trendClass } from "../lib/formatters";
import type { DashboardStock } from "../types/dashboard";

type MoversProps = {
  gainers: DashboardStock[];
  losers: DashboardStock[];
  onSelect: (id: string) => void;
};

function MoverList({ title, stocks, onSelect }: { title: string; stocks: DashboardStock[]; onSelect: (id: string) => void }) {
  return (
    <div className="mv-col">
      <h2 className="mv-title">{title}</h2>
      {stocks.length ? (
        <ul className="mv-list">
          {stocks.map((stock) => (
            <li key={stock.id}>
              <button type="button" className="mv-row" onClick={() => onSelect(stock.id)} aria-label={`Show ${stock.name} details`}>
                <LogoMark name={stock.name} symbol={stock.symbol} logoUrl={stock.logoUrl} fallbackLogoUrls={stock.fallbackLogoUrls} />
                <span className="mv-sym">{stock.symbol}</span>
                <span className="mv-name">{stock.name}</span>
                <span className={clsx("mv-change", trendClass(stock.changePercent))}>{formatPercent(stock.changePercent)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mv-empty">No movers right now.</p>
      )}
    </div>
  );
}

/** Side-by-side top gainers and decliners, derived from the live US universe. */
export const Movers = memo(function Movers({ gainers, losers, onSelect }: MoversProps) {
  if (!gainers.length && !losers.length) return null;
  return (
    <section className="mv" aria-label="Top US movers">
      <MoverList title="Gainers" stocks={gainers} onSelect={onSelect} />
      <MoverList title="Decliners" stocks={losers} onSelect={onSelect} />
    </section>
  );
});
