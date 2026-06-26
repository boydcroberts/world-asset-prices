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

/** A qualitative VIX regime band — conventional thresholds, shown as a tag. */
function vixRegime(level: number | null | undefined): { label: string; tone: string } | null {
  if (level == null || !Number.isFinite(level)) return null;
  if (level < 15) return { label: "Calm", tone: "calm" };
  if (level < 20) return { label: "Steady", tone: "steady" };
  if (level < 28) return { label: "Elevated", tone: "elevated" };
  if (level < 40) return { label: "Stressed", tone: "stressed" };
  return { label: "Extreme", tone: "extreme" };
}

/**
 * The market's risk backdrop as a single instrument console: breadth as a glowing
 * advance/decline meter against a 50/50 seam, the VIX with a regime tag, and the
 * 10-year yield — separated by hairline rules.
 */
export const RiskStrip = memo(function RiskStrip({ breadth, vix, ust10y }: RiskStripProps) {
  const total = breadth.total || 1;
  const advPct = (breadth.advancing / total) * 100;
  const decPct = (breadth.declining / total) * 100;
  const net = breadth.advancing - breadth.declining;
  const regime = vixRegime(vix?.level);

  return (
    <section className="rs" aria-label="Market risk backdrop">
      <div className="rs-breadth">
        <span className="rs-eyebrow">Breadth</span>
        <div className="rs-bar" role="img" aria-label={`${breadth.advancing} advancing, ${breadth.declining} declining`}>
          <span className="rs-bar-adv" style={{ width: `${advPct}%` }} />
          <span className="rs-bar-dec" style={{ width: `${decPct}%` }} />
        </div>
        <span className="rs-breadth-nums">
          <span className="is-up">{breadth.advancing}</span>
          <span className="rs-breadth-sep">/</span>
          <span className="is-down">{breadth.declining}</span>
          <span className={clsx("rs-breadth-net", net > 0 ? "is-up" : net < 0 ? "is-down" : "is-flat")}>
            {net > 0 ? "+" : net < 0 ? "−" : ""}{Math.abs(net)} net
          </span>
        </span>
      </div>

      <div className="rs-stat">
        <span className="rs-stat-head">
          <span className="rs-eyebrow">VIX</span>
          {regime ? <span className={clsx("rs-tag", `rs-tag--${regime.tone}`)}>{regime.label}</span> : null}
        </span>
        <span className="rs-stat-readout">
          <strong className="rs-stat-value">{formatLevel(vix?.level)}</strong>
          {vix ? <span className={clsx("rs-stat-change", trendClass(vix.changePercent))}>{formatPercent(vix.changePercent)}</span> : null}
        </span>
      </div>

      <div className="rs-stat">
        <span className="rs-stat-head">
          <span className="rs-eyebrow">US 10Y</span>
        </span>
        <span className="rs-stat-readout">
          <strong className="rs-stat-value">{ust10y?.level == null ? "—" : `${formatLevel(ust10y.level)}%`}</strong>
          {ust10y ? <span className={clsx("rs-stat-change", trendClass(ust10y.changeAbs))}>{formatPoints(ust10y.changeAbs)}</span> : null}
        </span>
      </div>
    </section>
  );
});
