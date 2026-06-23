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
 * The whole US market as one heat ribbon: each GICS sector is a segment sized by
 * market cap and tinted by its cap-weighted daily move — so the page's color
 * temperature reads the market's mood at a glance, before any number.
 */
export const SectorRibbon = memo(function SectorRibbon({ sectors }: SectorRibbonProps) {
  if (!sectors.length) return null;

  return (
    <section className="heat" aria-label="Sector performance">
      <span className="heat-eyebrow">Sectors</span>
      <div className="heat-ribbon" role="list">
        {sectors.map((sector) => (
          <div
            key={sector.sector}
            role="listitem"
            className="heat-seg"
            style={{ flexGrow: Math.max(1, sector.marketCapUsd), background: tintFor(sector.changePercent) }}
            tabIndex={0}
            aria-label={`${sector.sector}: ${formatPercent(sector.changePercent)}, ${sector.advancing} up and ${sector.declining} down of ${sector.count}`}
            title={`${sector.sector} · ${formatPercent(sector.changePercent)} · ${sector.advancing}▲ / ${sector.declining}▼ of ${sector.count}`}
          >
            <span className="heat-name">{SECTOR_SHORT[sector.sector] ?? sector.sector}</span>
            <span className={clsx("heat-chg", trendClass(sector.changePercent))}>{formatPercent(sector.changePercent)}</span>
          </div>
        ))}
      </div>
    </section>
  );
});
