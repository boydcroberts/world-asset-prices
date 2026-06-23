import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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

const INDEX_ORDER = ["sp500", "nasdaq", "dow"] as const;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const etTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

export const LivingHorizon = memo(function LivingHorizon({ indices, isStale }: LivingHorizonProps) {
  const gradientId = useId();
  const session = getMarketSession(useNow());
  const [selectedKey, setSelectedKey] = useState<string>("sp500");
  const [scrub, setScrub] = useState<number | null>(null);

  const available = INDEX_ORDER.map((key) => findIndex(indices, key)).filter((i): i is UsIndex => Boolean(i) && i!.level !== null);
  const selected = available.find((i) => i.key === selectedKey) ?? available[0];

  const geometry = useMemo(
    () => (selected ? buildHorizonGeometry(selected.intraday, selected.previousClose, { width: 1000, height: 300 }) : null),
    [selected],
  );

  // Flash the level toward its direction color on each value change — but not when
  // the user switches index (reset the baseline on key change) or while scrubbing.
  const levelRef = useRef<HTMLSpanElement>(null);
  const prevLevel = useRef<number | null>(selected?.level ?? null);
  const prevKey = useRef<string>(selectedKey);
  useEffect(() => {
    const level = selected?.level ?? null;
    if (prevKey.current !== selectedKey) {
      prevKey.current = selectedKey;
      prevLevel.current = level;
      return;
    }
    if (prevLevel.current === level) return;
    const rising = level !== null && prevLevel.current !== null ? level >= prevLevel.current : true;
    prevLevel.current = level;
    const el = levelRef.current;
    if (!el || typeof el.animate !== "function" || prefersReducedMotion()) return;
    el.animate([{ color: rising ? "var(--rise)" : "var(--fall)" }, { color: "var(--bone)" }], { duration: 700, easing: "ease-out" });
  }, [selected?.level, selectedKey]);

  const pointFromClientX = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (!geometry || geometry.points.length < 2) return null;
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(fraction * (geometry.points.length - 1));
    },
    [geometry],
  );

  if (!selected || selected.level === null) {
    return (
      <section className="lh lh--empty" aria-label="US market overview">
        <p className="lh-unavailable">Live index data is unavailable right now — reconnecting.</p>
      </section>
    );
  }

  const scrubPoint = scrub !== null && geometry ? geometry.points[scrub] : undefined;
  const displayLevel = scrubPoint ? scrubPoint.value : selected.level;
  const scrubChangeAbs =
    scrubPoint && selected.previousClose != null ? scrubPoint.value - selected.previousClose : null;
  const scrubChangePct =
    scrubPoint && selected.previousClose ? (scrubChangeAbs! / selected.previousClose) * 100 : null;
  const displayChangeAbs = scrubPoint ? scrubChangeAbs : selected.changeAbs;
  const displayChangePct = scrubPoint ? scrubChangePct : selected.changePercent;
  const dir = displayChangePct == null ? "flat" : displayChangePct >= 0 ? "up" : "down";
  const changeText = `${formatPoints(displayChangeAbs)} (${formatPercent(displayChangePct)})`;
  const railIndices = available.filter((i) => i.key !== selected.key);

  return (
    <section
      className={clsx("lh", `lh--${dir}`, isStale && "lh--stale", scrubPoint && "lh--scrubbing")}
      data-dir={dir}
      aria-label={`${selected.name} ${formatPercent(selected.changePercent)} — intraday`}
      tabIndex={0}
      onPointerMove={(event) => {
        const idx = pointFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
        if (idx !== null) setScrub(idx);
      }}
      onPointerLeave={() => setScrub(null)}
      onKeyDown={(event) => {
        if (!geometry) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          setScrub((current) => {
            const start = current ?? geometry.points.length - 1;
            const next = start + (event.key === "ArrowRight" ? 1 : -1);
            return Math.min(geometry.points.length - 1, Math.max(0, next));
          });
        } else if (event.key === "Escape") {
          setScrub(null);
        }
      }}
    >
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
              <line className="lh-baseline" x1="0" y1={geometry.baselineY} x2={geometry.width} y2={geometry.baselineY} vectorEffect="non-scaling-stroke" />
              <path d={geometry.area} fill={`url(#fill-${gradientId})`} />
              <path className="lh-line" d={geometry.line} fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
            {scrubPoint ? (
              <span className="lh-crosshair" style={{ left: `${scrubPoint.xPct}%` }}>
                <span className="lh-crosshair-dot" style={{ top: `${scrubPoint.yPct}%` }} />
              </span>
            ) : (
              <span className="lh-now" style={{ top: `${(geometry.nowY / geometry.height) * 100}%` }} />
            )}
          </>
        ) : null}
      </div>

      <div className="lh-readout">
        <div className="lh-lead">
          <p className="lh-eyebrow">
            {selected.name} <span className="lh-eyebrow-sep">·</span>{" "}
            <span className="lh-eyebrow-session">{scrubPoint ? etTimeFormatter.format(new Date(scrubPoint.t)) : session.label}</span>
          </p>
          <div className="lh-level">
            <span ref={levelRef}>{formatLevel(displayLevel)}</span>
          </div>
          <p className={clsx("lh-change", trendClass(displayChangePct))}>{changeText}</p>
        </div>
        <div className="lh-rail">
          {railIndices.map((index) => (
            <button key={index.key} type="button" className="lh-rail-item" onClick={() => setSelectedKey(index.key)} aria-label={`Show ${index.name}`}>
              <span className="lh-rail-name">{index.name}</span>
              <span className="lh-rail-level">{formatLevel(index.level)}</span>
              <span className={clsx("lh-rail-change", trendClass(index.changePercent))}>{formatPercent(index.changePercent)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
});
