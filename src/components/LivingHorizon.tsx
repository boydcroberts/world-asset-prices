import { memo, useEffect, useId, useMemo, useRef } from "react";
import clsx from "clsx";

import { buildHorizonGeometry } from "../lib/horizon";
import { findIndex, getMarketSession } from "../lib/us-market";
import { useNow } from "../hooks/useNow";
import { formatLevel, formatPercent, formatPoints, trendClass } from "../lib/formatters";
import type { UsIndex } from "../types/dashboard";

type LivingHorizonProps = {
  indices: UsIndex[] | undefined;
  isStale?: boolean;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Compact index readout (Nasdaq / Dow) shown beside the S&P lead. */
function RailIndex({ index }: { index: UsIndex | undefined }) {
  if (!index) return null;
  return (
    <div className="lh-rail-item">
      <span className="lh-rail-name">{index.name}</span>
      <span className="lh-rail-level">{formatLevel(index.level)}</span>
      <span className={clsx("lh-rail-change", trendClass(index.changePercent))}>{formatPercent(index.changePercent)}</span>
    </div>
  );
}

export const LivingHorizon = memo(function LivingHorizon({ indices, isStale }: LivingHorizonProps) {
  const gradientId = useId();
  const session = getMarketSession(useNow());
  const sp = findIndex(indices, "sp500");
  const nasdaq = findIndex(indices, "nasdaq");
  const dow = findIndex(indices, "dow");

  const geometry = useMemo(
    () => (sp ? buildHorizonGeometry(sp.intraday, sp.previousClose, { width: 1000, height: 300 }) : null),
    [sp],
  );

  // Flash the level toward its direction color on each value change, then settle.
  const levelRef = useRef<HTMLSpanElement>(null);
  const prevLevel = useRef<number | null>(sp?.level ?? null);
  useEffect(() => {
    const level = sp?.level ?? null;
    if (prevLevel.current === level) return;
    const rising = level !== null && prevLevel.current !== null ? level >= prevLevel.current : true;
    prevLevel.current = level;
    const el = levelRef.current;
    if (!el || typeof el.animate !== "function" || prefersReducedMotion()) return;
    el.animate(
      [{ color: rising ? "var(--rise)" : "var(--fall)" }, { color: "var(--bone)" }],
      { duration: 700, easing: "ease-out" },
    );
  }, [sp?.level]);

  const dir = sp?.changePercent == null ? "flat" : sp.changePercent >= 0 ? "up" : "down";

  if (!sp || sp.level === null) {
    return (
      <section className="lh lh--empty" aria-label="US market overview">
        <p className="lh-unavailable">Live index data is unavailable right now — reconnecting.</p>
      </section>
    );
  }

  const changeText = `${formatPoints(sp.changeAbs)} (${formatPercent(sp.changePercent)})`;

  return (
    <section className={clsx("lh", `lh--${dir}`, isStale && "lh--stale")} data-dir={dir} aria-label="US market overview">
      <div className="lh-canvas" aria-hidden="true">
        {geometry ? (
          <>
            <svg className="lh-svg" viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id={`fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line
                className="lh-baseline"
                x1="0"
                y1={geometry.baselineY}
                x2={geometry.width}
                y2={geometry.baselineY}
                vectorEffect="non-scaling-stroke"
              />
              <path d={geometry.area} fill={`url(#fill-${gradientId})`} />
              <path className="lh-line" d={geometry.line} fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="lh-now" style={{ top: `${(geometry.nowY / geometry.height) * 100}%` }} />
          </>
        ) : null}
      </div>

      <div className="lh-readout">
        <div className="lh-lead">
          <p className="lh-eyebrow">
            S&amp;P 500 <span className="lh-eyebrow-sep">·</span> <span className="lh-eyebrow-session">{session.label}</span>
          </p>
          <div className="lh-level">
            <span ref={levelRef}>{formatLevel(sp.level)}</span>
          </div>
          <p className={clsx("lh-change", trendClass(sp.changePercent))}>{changeText}</p>
        </div>
        <div className="lh-rail">
          <RailIndex index={nasdaq} />
          <RailIndex index={dow} />
        </div>
      </div>
    </section>
  );
});
