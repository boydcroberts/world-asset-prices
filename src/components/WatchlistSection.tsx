import { memo } from "react";

import { PinnedCard } from "./SectionGrid";
import type { DashboardEntry } from "../lib/dashboard-insights";

type WatchlistSectionProps = {
  entries: DashboardEntry[];
  pinnedIdSet: ReadonlySet<string>;
  selectedAssetId: string | null;
};

export const WatchlistSection = memo(function WatchlistSection({
  entries,
  pinnedIdSet,
  selectedAssetId,
}: WatchlistSectionProps) {
  if (!entries.length) return null;

  return (
    <section
      id="section-watchlist"
      className="surface watchlist-surface"
      aria-labelledby="watchlist-heading"
    >
      <div className="surface-head">
        <div className="surface-title-row">
          <h2 id="watchlist-heading">Pinned Watchlist</h2>
        </div>
        <div className="surface-head-meta">
          <p>
            {entries.length} pinned market{entries.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="coin-grid watchlist-grid">
        {entries.map((entry, index) => (
          <PinnedCard
            key={`pinned-${entry.id}`}
            entry={entry}
            index={index}
            pinnedIdSet={pinnedIdSet}
            selectedAssetId={selectedAssetId}
          />
        ))}
      </div>
    </section>
  );
});
