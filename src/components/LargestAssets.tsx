import { memo, useState } from "react";
import clsx from "clsx";

import { LogoMark } from "./LogoMark";
import { formatCompactCurrency, formatPercent, trendClass } from "../lib/formatters";
import type { DashboardAsset } from "../types/dashboard";

export type LargestAssetRow = DashboardAsset & {
  /** Live daily change, when available (stocks/crypto). Commodities and
   *  private companies carry no daily feed — null renders as "—", never a
   *  fabricated number. */
  changePercent: number | null;
};

type LargestAssetsProps = {
  rows: LargestAssetRow[];
  onSelect: (id: string) => void;
};

const DEFAULT_LIMIT = 10;

const CATEGORY_LABEL: Record<DashboardAsset["category"], string> = {
  Stock: "Stock",
  Crypto: "Crypto",
  Commodity: "Commodity",
  "Private Company": "Private",
};
const CATEGORY_CLASS: Record<DashboardAsset["category"], string> = {
  Stock: "la-tag--stock",
  Crypto: "la-tag--crypto",
  Commodity: "la-tag--commodity",
  "Private Company": "la-tag--private",
};

/**
 * THE hero leaderboard — every asset class ranked together by market value
 * (companies, crypto, commodities, private companies). The single "how big is
 * this, really" answer the rest of the page breaks down by category.
 */
export const LargestAssets = memo(function LargestAssets({ rows, onSelect }: LargestAssetsProps) {
  const [expanded, setExpanded] = useState(false);
  if (!rows.length) return null;

  const visible = expanded ? rows : rows.slice(0, DEFAULT_LIMIT);
  const canExpand = rows.length > DEFAULT_LIMIT;

  return (
    <section className="la" aria-label="Largest assets in the world">
      <div className="la-head">
        <h2 className="la-title">Largest Assets</h2>
        <span className="la-basis">by market value · worldwide</span>
        {canExpand ? (
          <button type="button" className="la-more" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show top 10" : `See all ${rows.length} →`}
          </button>
        ) : null}
      </div>
      <div className="la-board">
        <div className="la-cols" role="row">
          <span>#</span>
          <span>Asset</span>
          <span>Class</span>
          <span className="la-r">Market value</span>
          <span className="la-r">Today</span>
        </div>
        {visible.map((row, index) => (
          <button key={row.id} type="button" className="la-row" onClick={() => onSelect(row.id)}>
            <span className={clsx("la-rank", index < 3 && "la-rank--top")}>{index + 1}</span>
            <span className="la-asset">
              <LogoMark name={row.name} symbol={row.symbol} logoUrl={row.logoUrl} fallbackLogoUrls={row.fallbackLogoUrls} />
              <span className="la-asset-text">
                <span className="la-nm">{row.name}</span>
                <span className="la-sym">{row.symbol}</span>
              </span>
            </span>
            <span className={clsx("la-tag", CATEGORY_CLASS[row.category])}>{CATEGORY_LABEL[row.category]}</span>
            <span className="la-val">{formatCompactCurrency(row.marketCapUsd)}</span>
            <span className={clsx("la-chg", trendClass(row.changePercent))}>
              {row.changePercent == null ? "—" : formatPercent(row.changePercent)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
});
