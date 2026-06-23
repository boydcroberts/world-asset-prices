import clsx from "clsx";

import { buildHorizonGeometry } from "../lib/horizon";
import { formatLevel, formatPercent, formatPoints } from "../lib/formatters";
import type { IndexIntradayPoint } from "../types/dashboard";

export type HeroDirection = "serif" | "grotesque";
export type HeroMood = "bullish" | "bearish";

type Props = {
  direction: HeroDirection;
  mood: HeroMood;
  prevClose: number;
  points: IndexIntradayPoint[];
  eyebrow: string;
  narrative: string;
};

/**
 * Phase-1 concept-spike hero. Shares the real `buildHorizonGeometry` so the
 * sparkline is honest. Type direction (serif vs grotesque) and mood
 * (bullish/bearish) are driven entirely by `data-*` attributes + CSS so the two
 * directions render from one component.
 */
export function SpikeHero({ direction, mood, prevClose, points, eyebrow, narrative }: Props) {
  const geo = buildHorizonGeometry(points, prevClose, { width: 1000, height: 300 });
  const last = points[points.length - 1]?.value ?? prevClose;
  const changeAbs = last - prevClose;
  const changePct = (changeAbs / prevClose) * 100;
  const rising = changeAbs >= 0;
  const nowTopPct = geo ? (geo.nowY / geo.height) * 100 : 50;
  const baselineTopPct = geo ? (geo.baselineY / geo.height) * 100 : 50;

  return (
    <section className="sx-hero" data-direction={direction} data-mood={mood}>
      <div className="sx-mood" aria-hidden="true" />
      <div className="sx-grain" aria-hidden="true" />

      {geo ? (
        <div className="sx-spark-wrap" aria-hidden="true">
          <svg className="sx-spark" viewBox="0 0 1000 300" preserveAspectRatio="none">
            <path className="sx-area" d={geo.area} />
            <line className="sx-baseline" x1="0" x2="1000" y1={geo.baselineY} y2={geo.baselineY} />
            <path className="sx-line" d={geo.line} />
          </svg>
          <span className="sx-baseline-label" style={{ top: `${baselineTopPct}%` }}>
            prev {formatLevel(prevClose)}
          </span>
          <span className={clsx("sx-now", rising ? "is-up" : "is-down")} style={{ top: `${nowTopPct}%` }} />
        </div>
      ) : null}

      <div className="sx-inner">
        <p className="sx-eyebrow">{eyebrow}</p>
        <div className="sx-level">{formatLevel(last)}</div>
        <p className={clsx("sx-change", rising ? "is-up" : "is-down")}>
          <span className="sx-arrow">{rising ? "▲" : "▼"}</span>
          <span>{formatPoints(changeAbs)}</span>
          <span className="sx-pct">{formatPercent(changePct)}</span>
        </p>
        <p className="sx-narrative">{narrative}</p>
      </div>
    </section>
  );
}
