import clsx from "clsx";
import { memo, type ReactNode } from "react";

import {
  type DensityMode,
  SOURCE_LABEL,
  formatSegmentAge,
  sourceTone,
} from "../lib/dashboard-filters";
import type { DashboardInsight, DashboardSegmentHealth } from "../lib/dashboard-insights";
import type { ThemeMode } from "../hooks/useTheme";

type DashboardShellProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  insights: DashboardInsight[];
  segmentHealthSummaries: DashboardSegmentHealth[];
  density: DensityMode;
  children: ReactNode;
};

/**
 * Outer page chrome: animated background orbs, hero header with theme
 * toggle, tagline, insight tiles, and degraded-segment health badges,
 * plus the site footer. Renders everything else (controls + section
 * grids + drawer) as children.
 */
export const DashboardShell = memo(function DashboardShell({
  theme,
  onToggleTheme,
  onOpenSearch,
  insights,
  segmentHealthSummaries,
  density,
  children,
}: DashboardShellProps) {
  return (
    <>
      <div className="bg-orbs" aria-hidden="true">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>
      <main className={clsx("shell", density === "compact" && "shell-compact")}>
        <header className="hero">
          <div className="hero-top-row">
            <p className="eyebrow">World Asset Prices</p>
            <div className="hero-top-actions">
              <button
                type="button"
                className="search-trigger"
                onClick={onOpenSearch}
                aria-label="Search assets"
              >
                <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" width="14" height="14">
                  <circle cx="7.5" cy="7.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M11.5 11.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>Search</span>
                <kbd aria-hidden="true">⌘K</kbd>
              </button>
              <button
                type="button"
                className="theme-toggle"
                onClick={onToggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <h1>
            Global Assets <span>Dashboard</span>
          </h1>
          <p className="tagline">Live crypto, daily equities, ETFs, FX, and curated private-company valuations — the top 15 of every market, ranked by market cap.</p>
          {insights.length ? (
            <dl className="hero-insights" aria-label="Dashboard highlights">
              {insights.map((insight) => (
                <div key={insight.label} className={clsx("hero-insight", `hero-insight--${insight.tone}`)}>
                  <dt>{insight.label}</dt>
                  <dd>{insight.value}</dd>
                  <span>{insight.detail}</span>
                </div>
              ))}
            </dl>
          ) : null}
          {segmentHealthSummaries.length ? (
            <div className="hero-segment-health" aria-label="Degraded segments" aria-live="polite">
              {segmentHealthSummaries.map((segment) => (
                <span
                  key={segment.segment}
                  className={clsx("hero-segment-health-item", `hero-segment-health-item--${sourceTone(segment.source)}`)}
                  title={`Source: ${SOURCE_LABEL[segment.source]} · ${formatSegmentAge(segment.ageSec)} ago`}
                >
                  <span className="hero-segment-health-label">{segment.label}</span>
                  <span className="hero-segment-health-sep" aria-hidden="true">·</span>
                  <span className="hero-segment-health-source">{SOURCE_LABEL[segment.source]}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{formatSegmentAge(segment.ageSec)} ago</span>
                </span>
              ))}
            </div>
          ) : null}
        </header>

        {children}

        <footer className="site-footer">
          <div className="footer-glow" aria-hidden="true" />
          <div className="footer-content">
            <div className="footer-brand">
              <span className="footer-logo">World Asset Prices</span>
              <span className="footer-tagline">Live crypto · daily equities &amp; FX</span>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <span className="footer-col-title">Data</span>
                <span>CoinPaprika</span>
                <span>Stooq / Yahoo / Frankfurter</span>
              </div>
              <div className="footer-col">
                <span className="footer-col-title">Built With</span>
                <span>React + TypeScript</span>
                <span>Vite + Tailwind</span>
                <span>Vercel Functions</span>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>&copy; {new Date().getFullYear()} World Asset Prices</span>
            <span className="footer-dot" aria-hidden="true" />
            <span>Not financial advice</span>
          </div>
        </footer>
      </main>
    </>
  );
});
