import clsx from "clsx";
import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";

import { useTilt } from "../hooks/useTilt";
import { LogoMark } from "./LogoMark";

type MarketCardProps = {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  meta: string;
  value: string;
  valueLabel?: string;
  secondary?: string;
  secondaryClassName?: string;
  index: number;
  logoUrl?: string | null;
  fallbackLogoUrls?: string[];
  interactive?: boolean;
  active?: boolean;
  /** Called with the card's id when the card is activated (click / Enter / Space). */
  onSelect?: (id: string) => void;
  assetStyle?: boolean;
  pinned?: boolean;
  /** Called with the card's id when the pin chip is toggled. */
  onTogglePin?: (id: string) => void;
  compared?: boolean;
  /** Called with the card's id when the compare chip is toggled. */
  onToggleCompare?: (id: string) => void;
  sparkline?: number[];
  priceTitle?: string;
  secondaryTitle?: string;
};

const normalizeLabel = (label: string) => label.replace(/[^a-z0-9]/gi, "").toLowerCase();

function renderSparkline(points: number[], cardId: string): ReactNode {
  // Early return for insufficient data
  if (points.length < 2) {
    return null;
  }

  const safePoints = points.map((point) => (Number.isFinite(point) ? point : 0));
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const range = Math.max(1, max - min);
  const trendUp = safePoints[safePoints.length - 1] >= safePoints[0];

  const strokeColor = trendUp ? "rgba(80, 215, 155, 0.9)" : "rgba(255, 90, 120, 0.9)";
  const fillColorTop = trendUp ? "rgba(80, 215, 155, 0.35)" : "rgba(255, 90, 120, 0.3)";
  const gradientId = `sg-${cardId}`;

  const coords = safePoints.map((point, index) => {
    const x = (index / (safePoints.length - 1)) * 100;
    const y = 26 - ((point - min) / range) * 22;
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Build a closed polygon for the fill area (line + bottom edge)
  const fillPath = coords.map((c) => `${c.x},${c.y}`).join(" ") + ` 100,26 0,26`;

  return (
    <svg className="card-sparkline" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColorTop} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <polygon points={fillPath} fill={`url(#${gradientId})`} stroke="none" />
      <polyline points={polyline} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export const MarketCard = memo(function MarketCard({
  id,
  rank,
  name,
  symbol,
  meta,
  value,
  valueLabel,
  secondary,
  secondaryClassName,
  index,
  logoUrl,
  fallbackLogoUrls,
  interactive = false,
  active = false,
  onSelect,
  assetStyle = false,
  pinned = false,
  onTogglePin,
  compared = false,
  onToggleCompare,
  sparkline,
  priceTitle,
  secondaryTitle,
}: MarketCardProps) {
  const tilt = useTilt();
  const priceRef = useRef<HTMLParagraphElement>(null);
  const prevValueRef = useRef<string>(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    const isInitial = prevValueRef.current === undefined;
    prevValueRef.current = value;
    if (isInitial) return;
    const el = priceRef.current;
    if (!el) return;
    // Web Animations API restarts cleanly with no forced layout reflow. Unlike a
    // CSS animation it isn't auto-suppressed by the reduced-motion UA stylesheet,
    // so gate it ourselves.
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [{ backgroundColor: "rgba(34, 197, 94, 0.25)" }, { backgroundColor: "transparent" }],
      { duration: 600, easing: "ease-out" },
    );
  }, [value]);

  const cardStyle = {
    "--card-index": index,
  } as CSSProperties;

  const handleSelect = useCallback(() => onSelect?.(id), [onSelect, id]);

  // Memoize sparkline rendering to avoid recalculation on every render
  const sparklineElement = useMemo(() => {
    return Array.isArray(sparkline) && sparkline.length > 1 ? renderSparkline(sparkline, id) : null;
  }, [sparkline, id]);

  const actionButtons = (
    <div className="card-actions">
      {onTogglePin ? (
        <button
          type="button"
          className={clsx("card-chip", pinned && "active")}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin(id);
          }}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${name} from watchlist` : `Pin ${name} to watchlist`}
        >
          {pinned ? "Pinned" : "Pin"}
        </button>
      ) : null}

      {onToggleCompare ? (
        <button
          type="button"
          className={clsx("card-chip", compared && "active")}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCompare(id);
          }}
          aria-pressed={compared}
          aria-label={compared ? `Remove ${name} from compare` : `Add ${name} to compare`}
        >
          {compared ? "Comparing" : "Compare"}
        </button>
      ) : null}
    </div>
  );

  // Private companies have no real ticker — their "symbol" is just the name
  // repeated (ANTHROPIC) or an arbitrary abbreviation (SSI), which only repeats
  // or squeezes the title. Drop the pill for that category; for everything else
  // (real tickers like NVDA/BTC) keep it, guarding against any redundant repeat.
  const isPrivateCompany = meta.toLowerCase() === "private company";
  const showSymbolPill =
    !isPrivateCompany && normalizeLabel(symbol).length > 0 && normalizeLabel(symbol) !== normalizeLabel(name);

  const content: ReactNode = (
    <>
      <div className="coin-head">
        <span>#{rank}</span>
        <span className="asset-category" data-category={meta.toLowerCase()}>{meta}</span>
      </div>

      <div className="coin-title-row">
        <div className="coin-title-main">
          <LogoMark name={name} symbol={symbol} logoUrl={logoUrl} fallbackLogoUrls={fallbackLogoUrls} />
          <h3>{name}</h3>
        </div>
        {showSymbolPill ? <span className="symbol-pill">{symbol}</span> : null}
      </div>

      {valueLabel ? <p className="coin-value-label">{valueLabel}</p> : null}
      <p ref={priceRef} className="coin-price" title={priceTitle}>{value}</p>
      {secondary ? <p className={secondaryClassName} title={secondaryTitle}>{secondary}</p> : null}

      <div className="coin-foot">
        {actionButtons}
        {sparklineElement}
      </div>
    </>
  );

  if (!interactive) {
    return (
      <article key={id} className={clsx("coin-card", assetStyle && "asset-card")} style={cardStyle}>
        {content}
      </article>
    );
  }

  return (
    <article
      ref={tilt.ref as React.RefObject<HTMLElement>}
      key={id}
      className={clsx("coin-card", "interactive-card", active && "active", assetStyle && "asset-card")}
      style={cardStyle}
      onClick={onSelect ? handleSelect : undefined}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(id);
        }
      }}
      aria-haspopup="dialog"
      aria-label={`Show ${name} details`}
    >
      {content}
    </article>
  );
});
