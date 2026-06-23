import type { IndexIntradayPoint } from "../types/dashboard";

export type HorizonGeometry = {
  /** Polyline path for the intraday line. */
  line: string;
  /** Closed path filling from the line down to the baseline (for the gradient wash). */
  area: string;
  /** y of the previous close — the reference line the day is measured against. */
  baselineY: number;
  /** The "now" point (last sample) in viewBox coords. */
  nowX: number;
  nowY: number;
  width: number;
  height: number;
  /** True when the latest value is at/above the previous close. */
  rising: boolean;
};

type BuildOptions = { width?: number; height?: number; padY?: number };

/**
 * Build SVG path geometry for the Living Horizon from an intraday series and the
 * previous close. Pure + deterministic so it's unit-testable and cheap to morph
 * on each refresh. Returns null when there isn't enough data to draw.
 */
export function buildHorizonGeometry(
  points: IndexIntradayPoint[],
  previousClose: number | null,
  options: BuildOptions = {},
): HorizonGeometry | null {
  const width = options.width ?? 1000;
  const height = options.height ?? 300;
  const padY = options.padY ?? 10;
  if (!Array.isArray(points) || points.length < 2) return null;

  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  if (values.length < 2) return null;

  const hasBaseline = previousClose !== null && Number.isFinite(previousClose);
  const scaleValues = hasBaseline ? [...values, previousClose as number] : values;
  let min = Math.min(...scaleValues);
  let max = Math.max(...scaleValues);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  const innerH = height - padY * 2;
  const yFor = (value: number) => padY + (1 - (value - min) / range) * innerH;
  const xFor = (index: number) => (index / (points.length - 1)) * width;

  let line = "";
  points.forEach((point, index) => {
    line += `${index === 0 ? "M" : "L"}${xFor(index).toFixed(2)} ${yFor(point.value).toFixed(2)} `;
  });

  const area =
    `M0 ${height} L0 ${yFor(points[0].value).toFixed(2)} ` +
    points.map((point, index) => `L${xFor(index).toFixed(2)} ${yFor(point.value).toFixed(2)}`).join(" ") +
    ` L${width} ${height} Z`;

  const lastValue = points[points.length - 1].value;
  return {
    line: line.trim(),
    area,
    baselineY: hasBaseline ? yFor(previousClose as number) : height - padY,
    nowX: width,
    nowY: yFor(lastValue),
    width,
    height,
    rising: hasBaseline ? lastValue >= (previousClose as number) : true,
  };
}
