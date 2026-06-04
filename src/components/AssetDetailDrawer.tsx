import clsx from "clsx";
import { useEffect, useRef } from "react";

import { LogoMark } from "./LogoMark";
import { formatCompactCurrency, formatCurrency, formatPercent, trendClass } from "../lib/formatters";
import type { AssetDetailPayload, HistoricalRange } from "../types/dashboard";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const RANGES: HistoricalRange[] = ["7D", "30D", "1Y"];

type AssetDetailDrawerProps = {
  detail: AssetDetailPayload | undefined;
  isLoading: boolean;
  error: Error | null;
  range: HistoricalRange;
  onRangeChange: (range: HistoricalRange) => void;
  onClose: () => void;
  /** Logo of the asset the user clicked, threaded from the dashboard entry. */
  logoUrl?: string | null;
  fallbackLogoUrls?: string[];
};

function finitePrices(points: AssetDetailPayload["history"]["points"]): number[] {
  return points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function HistoryChart({ points }: { points: AssetDetailPayload["history"]["points"] }) {
  const values = finitePrices(points);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const trendUp = values[values.length - 1] >= values[0];
  const stroke = trendUp ? "rgba(80, 215, 155, 0.95)" : "rgba(255, 110, 135, 0.95)";
  const fillTop = trendUp ? "rgba(80, 215, 155, 0.28)" : "rgba(255, 110, 135, 0.24)";

  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 44 - ((value - min) / span) * 38;
    return `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`;
  });
  const line = coords.join(" ");

  return (
    <svg className="detail-chart" viewBox="0 0 100 48" preserveAspectRatio="none" aria-label="Historical price chart">
      <defs>
        <linearGradient id="detail-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </linearGradient>
      </defs>
      <polygon points={`${line} 100,48 0,48`} fill="url(#detail-area-fill)" stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function HistoryMeta({ points }: { points: AssetDetailPayload["history"]["points"] }) {
  const values = finitePrices(points);
  if (!values.length) return null;
  return (
    <p className="detail-chart-meta">
      <span>{points.length} pts</span>
      <span>low {formatCompactCurrency(Math.min(...values))} · high {formatCompactCurrency(Math.max(...values))}</span>
      <span>latest {formatCurrency(values[values.length - 1])}</span>
    </p>
  );
}

function formatSourceType(value: string | undefined): string {
  if (!value) return "—";
  return value.replace(/-/g, " ");
}

export function AssetDetailDrawer({ detail, isLoading, error, range, onRangeChange, onClose, logoUrl = null, fallbackLogoUrls = [] }: AssetDetailDrawerProps) {
  const degradedReason =
    detail?.degradedReason && detail.degradedReason !== detail.history.reason ? detail.degradedReason : null;

  const drawerRef = useRef<HTMLElement>(null);

  // Focus management for the modal dialog: move focus in on open, trap Tab
  // within it, and restore focus to the triggering element on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>(".detail-close")?.focus();

    // Lock background scroll while the modal is open so the page behind the
    // mobile bottom-sheet can't scroll or rubber-band under it.
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Mark the main content as inert so background elements are fully removed
    // from the accessibility tree — keyboard and SR focus stays inside the modal.
    const mainEl = document.querySelector<HTMLElement>("main");
    if (mainEl) mainEl.inert = true;

    function handleTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || !drawer) return;
      const focusables = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleTab, true);
    return () => {
      document.removeEventListener("keydown", handleTab, true);
      document.body.style.overflow = previousBodyOverflow;
      if (mainEl) mainEl.inert = false;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="detail-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        ref={drawerRef}
        className="asset-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="detail-head">
          <div className="detail-head-main">
            <LogoMark
              name={detail?.asset.displayName ?? "Asset"}
              symbol={detail?.asset.symbol ?? "•"}
              logoUrl={logoUrl}
              fallbackLogoUrls={fallbackLogoUrls}
            />
            <div>
              <p className="detail-eyebrow">Asset detail</p>
              <h2 id="asset-detail-title">{detail?.asset.displayName ?? "Loading asset"}</h2>
              {detail ? <p>{detail.asset.symbol} · {detail.asset.category}</p> : null}
            </div>
          </div>
          <button type="button" className="detail-close" onClick={onClose} aria-label="Close asset detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? <p className="muted">Loading detail and provenance...</p> : null}
        {error ? <p className="filter-empty">Asset detail is unavailable right now.</p> : null}

        {detail ? (
          <>
            <div className="detail-metrics">
              <div>
                <span>{detail.quote.valueLabel}</span>
                <strong>{formatCompactCurrency(detail.quote.valueUsd)}</strong>
              </div>
              <div>
                <span>Unit price</span>
                <strong>{detail.quote.priceUsd === undefined ? "—" : formatCurrency(detail.quote.priceUsd)}</strong>
              </div>
              <div>
                <span>Change</span>
                <strong className={trendClass(detail.quote.changePercent)}>{formatPercent(detail.quote.changePercent)}</strong>
              </div>
            </div>

            <div className="detail-range-row" role="group" aria-label="History range">
              {RANGES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={clsx("detail-range", range === option && "active")}
                  onClick={() => onRangeChange(option)}
                  aria-pressed={range === option}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="detail-panel">
              <div className="detail-panel-head">
                <span>History</span>
                <span>{detail.history.range}</span>
              </div>
              {detail.history.available ? (
                <>
                  <HistoryChart points={detail.history.points} />
                  <HistoryMeta points={detail.history.points} />
                </>
              ) : (
                <p className="detail-unavailable">{detail.history.reason ?? "History unavailable from the current provider set."}</p>
              )}
            </div>

            <div className="detail-provenance">
              <div><span>Provider</span><strong>{detail.provenance.provider}</strong></div>
              <div><span>Source</span><strong>{detail.provenance.source}</strong></div>
              <div><span>Confidence</span><strong>{detail.provenance.confidence}</strong></div>
              <div><span>Method</span><strong>{detail.provenance.valueMethod}</strong></div>
              <div><span>Verified as of</span><strong>{detail.provenance.valueAsOf ?? detail.quote.asOf.slice(0, 10)}</strong></div>
              <div><span>Source type</span><strong>{formatSourceType(detail.provenance.sourceType)}</strong></div>
            </div>
            {detail.provenance.sourceUrl ? (
              <a className="detail-source-link" href={detail.provenance.sourceUrl} target="_blank" rel="noreferrer">
                {detail.provenance.sourceTitle ?? "Open source"}
              </a>
            ) : null}
            {detail.provenance.alternateValuations?.length ? (
              <div className="detail-alternates">
                <span>Alternate context</span>
                {detail.provenance.alternateValuations.map((valuation) => (
                  <p key={`${valuation.valueUsd}-${valuation.valueAsOf}`}>
                    {formatCompactCurrency(valuation.valueUsd)} {formatSourceType(valuation.sourceType)} · {valuation.notes}
                  </p>
                ))}
              </div>
            ) : null}
            <p className="detail-limitation">{detail.provenance.limitation}</p>
            {degradedReason ? <p className="detail-degraded">{degradedReason}</p> : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}
