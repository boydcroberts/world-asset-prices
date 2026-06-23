import { memo } from "react";
import clsx from "clsx";

import { formatLevel, formatPercent, formatPoints, trendClass } from "../lib/formatters";
import type { MarketBreadth } from "../lib/us-market";
import type { UsIndex } from "../types/dashboard";

type RiskStripProps = {
  breadth: MarketBreadth;
  vix: UsIndex | undefined;
  ust10y: UsIndex | undefined;
};

/**
 * The market's risk backdrop, typeset on a single rule (no tiles): breadth as a
 * split advance/decline bar, plus VIX and the 10-year yield.
 */
export const RiskStrip = memo(function RiskStrip({ breadth, vix, ust10y }: RiskStripProps) {
  const total = breadth.total || 1;
  const advPct = (breadth.advancing / total) * 100;
  const decPct = (breadth.declining / total) * 100;

  return (
    <section className="rs" aria-label="Market risk backdrop">
      <div className="rs-breadth">
        <span className="rs-eyebrow">Breadth</span>
        <div className="rs-bar" role="img" aria-label={`${breadth.advancing} advancing, ${breadth.declining} declining`}>
          <span className="rs-bar-adv" style={{ width: `${advPct}%` }} />
          <span className="rs-bar-dec" style={{ width: `${decPct}%` }} />
        </div>
        <span className="rs-breadth-nums">
          <span className="is-up">{breadth.advancing}&#9650;</span>
          <span className="rs-breadth-sep">/</span>
          <span className="is-down">{breadth.declining}&#9660;</span>
        </span>
      </div>

      <div className="rs-stat">
        <span className="rs-eyebrow">VIX</span>
        <strong className="rs-stat-value">{formatLevel(vix?.level)}</strong>
        {vix ? <span className={clsx("rs-stat-change", trendClass(vix.changePercent))}>{formatPercent(vix.changePercent)}</span> : null}
      </div>

      <div className="rs-stat">
        <span className="rs-eyebrow">US 10Y</span>
        <strong className="rs-stat-value">{ust10y?.level == null ? "—" : `${formatLevel(ust10y.level)}%`}</strong>
        {ust10y ? <span className={clsx("rs-stat-change", trendClass(ust10y.changeAbs))}>{formatPoints(ust10y.changeAbs)}</span> : null}
      </div>
    </section>
  );
});
