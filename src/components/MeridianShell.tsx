import { memo, type ReactNode } from "react";

import { useNow } from "../hooks/useNow";
import { getMarketSession } from "../lib/us-market";

type MeridianShellProps = {
  children: ReactNode;
};

/**
 * Page chrome for the command center: a session-tinted ambient wash behind the
 * content and the footer. The `data-session` attribute lets the stylesheet shift
 * the page's ambient temperature with the trading day. Reads the shared clock so
 * only this wrapper (not the whole app) re-renders as time passes.
 */
export const MeridianShell = memo(function MeridianShell({ children }: MeridianShellProps) {
  const session = getMarketSession(useNow()).phase;
  return (
    <div className="meridian-root" data-session={session}>
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
