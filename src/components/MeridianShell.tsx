import { memo, useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { useNow } from "../hooks/useNow";
import { getMarketSession, type MarketMood } from "../lib/us-market";

type MeridianShellProps = {
  children: ReactNode;
  mood?: MarketMood;
};

/**
 * Page chrome for the command center: a session-tinted, MOOD-driven ambient wash
 * behind the content. `data-mood` (bullish/bearish/neutral) + `--mood-intensity`
 * set the page's color temperature from the day's breadth + direction — the
 * signature ambient. `data-session` shifts it with the trading day. Reads the
 * shared clock so only this wrapper re-renders as time passes.
 */
export const MeridianShell = memo(function MeridianShell({ children, mood }: MeridianShellProps) {
  const session = getMarketSession(useNow()).phase;
  const tone = mood?.tone ?? "neutral";
  const style = { "--mood-intensity": String(mood?.intensity ?? 0) } as CSSProperties;

  // Entrance choreography gate. Sections render hidden, then transition in once
  // this flips just after first paint. Gated on a timer (not rAF) so it fires
  // even when the compositor is paused (background tab / offscreen) — and once
  // set, the settled state is the elements' NORMAL style, so the page is never
  // left blank if the transition itself doesn't run.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 40);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="meridian-root" data-session={session} data-mood={tone} data-entered={entered ? "" : undefined} style={style}>
      <div className="meridian-wash" aria-hidden="true" />
      <main className="meridian">{children}</main>
      <footer className="meridian-footer">
        <span className="meridian-footer-word">MERIDIAN</span>
        <span className="meridian-footer-dot" aria-hidden="true" />
        <span>Live US market · indices, breadth &amp; movers</span>
        <span className="meridian-footer-dot" aria-hidden="true" />
        <span>Data: Yahoo / Stooq / CoinPaprika · not financial advice</span>
      </footer>
    </div>
  );
});
