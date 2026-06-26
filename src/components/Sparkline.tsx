import { memo, useMemo } from "react";
import clsx from "clsx";

import { buildHorizonGeometry } from "../lib/horizon";
import type { IndexIntradayPoint } from "../types/dashboard";

type SparklineProps = {
  points: IndexIntradayPoint[] | undefined;
  previousClose: number | null | undefined;
  /** Force the trailing value (e.g. the live level) so the line ends on it. */
  endValue?: number | null;
  width?: number;
  height?: number;
  className?: string;
};

/**
 * A tiny, accurate intraday trace from the same geometry as the hero — real data
 * points (no smoothing), colored vs the previous close, ending exactly on the
 * current value. Decorative only; the numbers beside it carry the meaning.
 */
export const Sparkline = memo(function Sparkline({
  points,
  previousClose,
  endValue,
  width = 132,
  height = 34,
  className,
}: SparklineProps) {
  const series = useMemo(() => {
    const pts = points ?? [];
    if (pts.length < 2 || endValue == null || !Number.isFinite(endValue)) return pts;
    const last = pts[pts.length - 1];
    if (last.value === endValue) return pts;
    return [...pts.slice(0, -1), { t: last.t, value: endValue }];
  }, [points, endValue]);

  const geometry = useMemo(
    () => buildHorizonGeometry(series, previousClose ?? null, { width, height, padY: 3 }),
    [series, previousClose, width, height],
  );

  if (!geometry) return <span className={clsx("spark spark--empty", className)} aria-hidden="true" />;

  const dir = geometry.rising ? "up" : "down";
  return (
    <svg
      className={clsx("spark", `spark--${dir}`, className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="spark-line" d={geometry.line} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
});
