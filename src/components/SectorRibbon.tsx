import { memo, type CSSProperties } from "react";
import clsx from "clsx";

import { SECTOR_SHORT, type SectorPerf } from "../lib/us-market";
import { formatPercent, trendClass } from "../lib/formatters";

type SectorRibbonProps = { sectors: SectorPerf[] };

/**
 * Map a sector's daily change to two CSS custom props: a *subtle* background wash
 * (alpha capped ≤0.17 so the cell stays near the page floor and every text token
 * keeps WCAG AA in both themes) plus a vivid left accent spine that carries the
 * "market mood" signal on a non-text layer, scaled by the move's magnitude.
 */
function cellStyle(change: number | null): CSSProperties {
  if (change === null || !Number.isFinite(change)) {
    return {
      "--cell-wash": "rgba(232, 228, 216, 0.03)",
      "--cell-accent": "var(--hairline-strong)",
      "--cell-accent-strength": "0.5",
    } as CSSProperties;
  }
  const magnitude = Math.min(1, Math.abs(change) / 2.5);
  const washAlpha = (0.05 + magnitude * 0.12).toFixed(3); // ≤0.17 — text stays AA-safe
  const rgb = change >= 0 ? "63, 224, 163" : "255, 92, 114";
  return {
    "--cell-wash": `rgba(${rgb}, ${washAlpha})`,
    "--cell-accent": `rgb(${rgb})`,
    "--cell-accent-strength": (0.4 + magnitude * 0.6).toFixed(3),
  } as CSSProperties;
}

/**
 * The 11 GICS sectors as a legible grid, ordered best-to-worst and tinted by each
 * sector's cap-weighted daily move — the page's "market mood" color temperature,
 * read at a glance. Each cell also shows the sector's internal breadth (up/down).
 */
export const SectorRibbon = memo(function SectorRibbon({ sectors }: SectorRibbonProps) {
  if (!sectors.length) return null;

  const ordered = [...sectors].sort((a, b) => (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity));

  return (
    <section className="heat" aria-label="Sector performance">
      <span className="heat-eyebrow">Sectors · today</span>
      <div className="heat-grid" role="list">
        {ordered.map((sector) => (
          <div
            key={sector.sector}
            role="listitem"
            className="heat-cell"
            style={cellStyle(sector.changePercent)}
            tabIndex={0}
            aria-label={`${sector.sector}: ${formatPercent(sector.changePercent)}, ${sector.advancing} up and ${sector.declining} down of ${sector.count}`}
          >
            <span className="heat-name">{SECTOR_SHORT[sector.sector] ?? sector.sector}</span>
            <div className="heat-cell-bot">
              <span className={clsx("heat-chg", trendClass(sector.changePercent))}>{formatPercent(sector.changePercent)}</span>
              <span className="heat-bd">{sector.advancing}▲ · {sector.declining}▼</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});
