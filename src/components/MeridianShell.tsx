import { memo, type CSSProperties, type ReactNode } from "react";

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
  return (
    <div className="meridian-root" data-session={session} data-mood={tone} style={style}>
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
