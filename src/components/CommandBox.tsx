import { memo } from "react";
import clsx from "clsx";

import { useNow } from "../hooks/useNow";
import { findIndex, getMarketSession, type MarketBreadth } from "../lib/us-market";
import { formatLevel, formatPercent, formatPoints, trendClass } from "../lib/formatters";
import type { UsIndex } from "../types/dashboard";

type CommandBoxProps = {
  indices: UsIndex[] | undefined;
  breadth: MarketBreadth;
  narrative?: string;
  isStale?: boolean;
};

const MACRO_LABEL: Record<string, string> = {
  es: "S&P Fut",
  nq: "NQ Fut",
  dxy: "DXY",
  wti: "WTI",
  gold: "Gold",
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

function MacroCell({ index }: { index: UsIndex }) {
  const value = index.kind === "rate" ? `${formatLevel(index.level)}%` : formatLevel(index.level);
  return (
    <div className="cmd-cell" title={`${index.name}: ${value} (${formatPercent(index.changePercent)})`}>
      <span className="cmd-l">{MACRO_LABEL[index.key] ?? index.name}</span>
      <span className="cmd-v">{value}</span>
      <span className={clsx("cmd-d", trendClass(index.changePercent))}>{formatPercent(index.changePercent)}</span>
    </div>
  );
}

/**
 * The condensed command box — the whole market snapshot in one glance: the S&P
 * headline + narrative + Nasdaq/Dow on the left, and breadth/VIX/10Y/futures/
 * macro/curve folded into a single instrument grid on the right. Replaces the
 * old full-bleed hero chart + separate risk strip + macro rail.
 */
export const CommandBox = memo(function CommandBox({ indices, breadth, narrative, isStale }: CommandBoxProps) {
  const session = getMarketSession(useNow());
  const sp = findIndex(indices, "sp500");
  const nasdaq = findIndex(indices, "nasdaq");
  const dow = findIndex(indices, "dow");
  const vix = findIndex(indices, "vix");
  const ust5y = findIndex(indices, "ust5y");
  const ust10y = findIndex(indices, "ust10y");
  const ust30y = findIndex(indices, "ust30y");
  const es = findIndex(indices, "es");
  const nq = findIndex(indices, "nq");
  const dxy = findIndex(indices, "dxy");
  const wti = findIndex(indices, "wti");
  const gold = findIndex(indices, "gold");

  const total = breadth.total || 1;
  const advPct = (breadth.advancing / total) * 100;
  const decPct = (breadth.declining / total) * 100;
  const net = breadth.advancing - breadth.declining;
  const regime = vixRegime(vix?.level);
  const curveAvailable = ust5y || ust10y || ust30y;

  if (!sp) return null;

  return (
    <section className="cmd" aria-label="Market command overview">
      <div className="cmd-hero">
        <span className="cmd-hero-eyebrow">
          S&amp;P 500 · <b>{session.label}</b>
          {isStale ? <span className="cmd-stale">Stale data</span> : null}
        </span>
        <div className={clsx("cmd-hero-level", trendClass(sp.changePercent))}>{formatLevel(sp.level)}</div>
        <div className={clsx("cmd-hero-change", trendClass(sp.changePercent))}>
          {formatPoints(sp.changeAbs)} &nbsp;({formatPercent(sp.changePercent)})
        </div>
        {narrative ? <p className="cmd-hero-sub">{narrative}</p> : null}
        {nasdaq || dow ? (
          <div className="cmd-idx-rail">
            {nasdaq ? (
              <div className="cmd-idx">
                <span className="cmd-idx-n">Nasdaq Composite</span>
                <span className="cmd-idx-v">{formatLevel(nasdaq.level)}</span>
                <span className={clsx("cmd-idx-c", trendClass(nasdaq.changePercent))}>{formatPercent(nasdaq.changePercent)}</span>
              </div>
            ) : null}
            {dow ? (
              <div className="cmd-idx">
                <span className="cmd-idx-n">Dow Jones</span>
                <span className="cmd-idx-v">{formatLevel(dow.level)}</span>
                <span className={clsx("cmd-idx-c", trendClass(dow.changePercent))}>{formatPercent(dow.changePercent)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="cmd-grid">
        <div className="cmd-cell cmd-cell--wide">
          <span className="cmd-l">Breadth</span>
          <span className="cmd-v cmd-breadth-nums">
            <span className="is-up">{breadth.advancing}</span>
            <span className="cmd-sep">/</span>
            <span className="is-down">{breadth.declining}</span>
            <span className={clsx("cmd-breadth-net", net > 0 ? "is-up" : net < 0 ? "is-down" : "is-flat")}>
              {net > 0 ? "+" : net < 0 ? "−" : ""}{Math.abs(net)} net
            </span>
          </span>
          <div className="cmd-breadth-bar" role="img" aria-label={`${breadth.advancing} advancing, ${breadth.declining} declining`}>
            <span className="cmd-breadth-adv" style={{ width: `${advPct}%` }} />
            <span className="cmd-breadth-dec" style={{ width: `${decPct}%` }} />
          </div>
        </div>

        <div className="cmd-cell">
          <span className="cmd-l">VIX {regime ? <span className={clsx("cmd-tag", `cmd-tag--${regime.tone}`)}>{regime.label}</span> : null}</span>
          <span className="cmd-v">{formatLevel(vix?.level)}</span>
          {vix ? <span className={clsx("cmd-d", trendClass(vix.changePercent))}>{formatPercent(vix.changePercent)}</span> : null}
        </div>

        <div className="cmd-cell">
          <span className="cmd-l">US 10Y</span>
          <span className="cmd-v">{ust10y?.level == null ? "—" : `${formatLevel(ust10y.level)}%`}</span>
          {ust10y ? <span className={clsx("cmd-d", trendClass(ust10y.changeAbs))}>{formatPoints(ust10y.changeAbs)}</span> : null}
        </div>

        {es ? <MacroCell index={es} /> : null}
        {nq ? <MacroCell index={nq} /> : null}
        {gold ? <MacroCell index={gold} /> : null}
        {wti ? <MacroCell index={wti} /> : null}
        {dxy ? <MacroCell index={dxy} /> : null}

        {curveAvailable ? (
          <div className="cmd-cell">
            <span className="cmd-l">Curve 5·10·30Y</span>
            <span className="cmd-v cmd-v--sm">
              {formatLevel(ust5y?.level)} · {formatLevel(ust10y?.level)} · {formatLevel(ust30y?.level)}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
});
