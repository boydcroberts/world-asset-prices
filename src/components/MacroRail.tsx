import { memo } from "react";
import clsx from "clsx";

import { findIndex } from "../lib/us-market";
import { formatLevel, formatPercent, trendClass } from "../lib/formatters";
import type { UsIndex } from "../types/dashboard";

type MacroRailProps = { indices: UsIndex[] | undefined };

const MACRO_KEYS = ["es", "nq", "dxy", "wti", "gold", "ust5y", "ust10y", "ust30y"] as const;
const MACRO_LABEL: Record<string, string> = {
  es: "S&P Fut",
  nq: "NQ Fut",
  dxy: "DXY",
  wti: "WTI",
  gold: "Gold",
  ust5y: "5Y",
  ust10y: "10Y",
  ust30y: "30Y",
};

function MacroCell({ index }: { index: UsIndex }) {
  const value = index.kind === "rate" ? `${formatLevel(index.level)}%` : formatLevel(index.level);
  return (
    <div className="mc-cell" title={`${index.name}: ${value} (${formatPercent(index.changePercent)})`}>
      <span className="mc-name">{MACRO_LABEL[index.key] ?? index.name}</span>
      <span className="mc-val">{value}</span>
      <span className={clsx("mc-chg", trendClass(index.changePercent))}>{formatPercent(index.changePercent)}</span>
    </div>
  );
}

/** Compact futures + macro backdrop: index futures, dollar, crude, gold, and the
 *  Treasury curve — the context a daily watcher scans alongside the indices. */
export const MacroRail = memo(function MacroRail({ indices }: MacroRailProps) {
  const cells = MACRO_KEYS.map((key) => findIndex(indices, key)).filter(
    (index): index is UsIndex => Boolean(index) && index!.level !== null,
  );
  if (!cells.length) return null;

  return (
    <section className="mc" aria-label="Futures and macro backdrop">
      <span className="mc-eyebrow">Futures &amp; Macro</span>
      <div className="mc-grid">
        {cells.map((index) => (
          <MacroCell key={index.key} index={index} />
        ))}
      </div>
    </section>
  );
});
