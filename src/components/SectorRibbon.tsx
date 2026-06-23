import { memo } from "react";
import clsx from "clsx";

import { SECTOR_SHORT, type SectorPerf } from "../lib/us-market";
import { formatPercent, trendClass } from "../lib/formatters";

type SectorRibbonProps = { sectors: SectorPerf[] };

/** Map a sector's daily change to an emitted-light tint — the page's "market mood." */
function tintFor(change: number | null): string {
  if (change === null || !Number.isFinite(change)) return "rgba(232, 228, 216, 0.04)";
  const magnitude = Math.min(1, Math.abs(change) / 2.5);
  const alpha = (0.12 + magnitude * 0.4).toFixed(3);
  return change >= 0 ? `rgba(63, 224, 163, ${alpha})` : `rgba(255, 92, 114, ${alpha})`;
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
            style={{ background: tintFor(sector.changePercent) }}
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
