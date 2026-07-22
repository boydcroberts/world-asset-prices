import { memo } from "react";
import clsx from "clsx";

import { useNow } from "../hooks/useNow";
import { getMarketSession } from "../lib/us-market";
import type { ThemeMode } from "../hooks/useTheme";

type MastheadProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSearch: () => void;
};

/**
 * Top rail: the MERIDIAN wordmark, a live ET clock with the current trading
 * session, and the theme / search controls. The clock ticks off the shared
 * one-second store so it stays live without its own timer.
 */
export const Masthead = memo(function Masthead({ theme, onToggleTheme, onOpenSearch }: MastheadProps) {
  const now = useNow();
  const session = getMarketSession(now);

  return (
    <header className="mh">
      <h1 className="sr-only">MERIDIAN live US market command center</h1>
      <div className="mh-brand">
        <span className="mh-mark" aria-hidden="true" />
        <span className="mh-word">MERIDIAN</span>
        <span className="mh-sub">US Market</span>
      </div>

      <div className="mh-status" aria-live="polite">
        <span className={clsx("mh-session", `mh-session--${session.phase}`)}>
          <span className="mh-session-dot" aria-hidden="true" />
          {session.label}
        </span>
        <time className="mh-clock">{session.etClock}</time>
      </div>

      <div className="mh-actions">
        <button type="button" className="mh-search" onClick={onOpenSearch} aria-label="Search assets (⌘K)">
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" width="14" height="14">
            <circle cx="7.5" cy="7.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11.5 11.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Search</span>
          <kbd aria-hidden="true">⌘K</kbd>
        </button>
        <button
          type="button"
          className="mh-theme"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
});
