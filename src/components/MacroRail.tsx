import { memo } from "react";
import clsx from "clsx";

import { findIndex } from "../lib/us-market";
import { formatLevel, formatPercent, trendClass } from "../lib/formatters";
import type { UsIndex } from "../types/dashboard";

type MacroRailProps = { indices: UsIndex[] | undefined };

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

// Deliberate clusters — futures, macro, and the Treasury curve read as three
// distinct instruments rather than one undifferentiated row of numbers.
const MACRO_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Futures", keys: ["es", "nq"] },
  { label: "Macro", keys: ["dxy", "wti", "gold"] },
  { label: "Curve", keys: ["ust5y", "ust10y", "ust30y"] },
];

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

/** Futures + macro backdrop, grouped into three labeled instrument clusters:
 *  index futures, the dollar/crude/gold macro set, and the Treasury curve. */
export const MacroRail = memo(function MacroRail({ indices }: MacroRailProps) {
  const groups = MACRO_GROUPS.map((group) => ({
    label: group.label,
    cells: group.keys
      .map((key) => findIndex(indices, key))
      .filter((index): index is UsIndex => Boolean(index) && index!.level !== null),
  })).filter((group) => group.cells.length > 0);

  if (!groups.length) return null;

  return (
    <section className="mc" aria-label="Futures and macro backdrop">
      <div className="mc-grid">
        {groups.map((group) => (
          <div className="mc-group" key={group.label}>
            <span className="mc-group-label">{group.label}</span>
            <div className="mc-cells">
              {group.cells.map((index) => (
                <MacroCell key={index.key} index={index} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});
