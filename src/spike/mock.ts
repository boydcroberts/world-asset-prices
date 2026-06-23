import type { IndexIntradayPoint } from "../types/dashboard";

// Deterministic intraday walk from prevClose to a pinned close — seeded so the
// design spike screenshots are stable across reloads (no Math.random jitter).
function walk(prevClose: number, close: number, n = 46, seed = 7): IndexIntradayPoint[] {
  const points: IndexIntradayPoint[] = [];
  const drift = (close - prevClose) / (n - 1);
  const amp = prevClose * 0.0016;
  let value = prevClose;
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff - 0.5;
  };
  const open = Date.UTC(2026, 5, 23, 13, 30); // 9:30 ET
  for (let i = 0; i < n; i += 1) {
    // Taper noise to ~0 at both ends so the line opens and CLOSES cleanly — the
    // last samples approach the close monotonically, so the now-dot always leads.
    const window = Math.sin((Math.PI * i) / (n - 1));
    value += drift + rand() * amp * window;
    points.push({ t: new Date(open + i * 8 * 60_000).toISOString(), value: Math.round(value * 100) / 100 });
  }
  points[points.length - 1].value = close; // pin the close exactly
  return points;
}

export type Scenario = {
  prevClose: number;
  points: IndexIntradayPoint[];
  eyebrow: string;
  narrative: string;
};

const PREV = 5_900;

export const SCENARIOS: Record<"bullish" | "bearish", Scenario> = {
  bullish: {
    prevClose: PREV,
    points: walk(PREV, 6_012.47, 46, 7),
    eyebrow: "S&P 500 · Market open · 2:14 PM ET",
    narrative: "Broad advance — 9 of 11 sectors higher, led by Technology.",
  },
  bearish: {
    prevClose: PREV,
    points: walk(PREV, 5_787.2, 46, 29),
    eyebrow: "S&P 500 · Market open · 2:14 PM ET",
    narrative: "Risk-off — 8 of 11 sectors lower; only Energy holds a bid.",
  },
};
