import { useCallback, useEffect, useMemo, useState } from "react";

import type { DashboardSortMode } from "../lib/dashboard-insights";
import {
  type DensityMode,
  type SectionFilter,
  readStoredHoldings,
  readStoredPinnedIds,
  readStoredPrefs,
  writeStoredHoldings,
  writeStoredPinnedIds,
  writeStoredPrefs,
} from "../lib/dashboard-filters";
import type { LocalHolding } from "../types/dashboard";

const MAX_PINNED = 12;

export type UseDashboardFiltersResult = {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  normalizedSearchTerm: string;

  sectionFilter: SectionFilter;
  setSectionFilter: (value: SectionFilter) => void;
  shouldShowSection: (filter: Exclude<SectionFilter, "all">) => boolean;

  sortMode: DashboardSortMode;
  setSortMode: (value: DashboardSortMode) => void;

  density: DensityMode;
  toggleDensity: () => void;

  pinnedIds: string[];
  pinnedIdSet: ReadonlySet<string>;
  togglePinned: (id: string) => void;

  holdings: LocalHolding[];
  setHoldings: (next: LocalHolding[]) => void;
};

/**
 * Centralizes dashboard control state: search, section filter, sort mode,
 * density, the pinned watchlist, and local portfolio holdings. Persists
 * prefs, pinned ids, and holdings to localStorage so reloads feel sticky.
 */
export function useDashboardFilters(): UseDashboardFiltersResult {
  const initialPrefs = useMemo(() => readStoredPrefs(), []);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>(initialPrefs.sectionFilter ?? "all");
  const [sortMode, setSortMode] = useState<DashboardSortMode>(initialPrefs.sortMode ?? "rank");
  const [density, setDensity] = useState<DensityMode>(initialPrefs.density ?? "comfortable");
  const [pinnedIds, setPinnedIds] = useState<string[]>(readStoredPinnedIds);
  const [holdings, setHoldings] = useState<LocalHolding[]>(readStoredHoldings);

  useEffect(() => {
    writeStoredPinnedIds(pinnedIds);
  }, [pinnedIds]);

  useEffect(() => {
    writeStoredHoldings(holdings);
  }, [holdings]);

  useEffect(() => {
    writeStoredPrefs({ sectionFilter, sortMode, density });
  }, [sectionFilter, sortMode, density]);

  const togglePinned = useCallback((id: string) => {
    setPinnedIds((current) =>
      current.includes(id) ? current.filter((pinnedId) => pinnedId !== id) : [id, ...current].slice(0, MAX_PINNED),
    );
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity((current) => (current === "compact" ? "comfortable" : "compact"));
  }, []);

  const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const normalizedSearchTerm = searchTerm.trim();

  const shouldShowSection = useCallback(
    (filter: Exclude<SectionFilter, "all">) => sectionFilter === "all" || sectionFilter === filter,
    [sectionFilter],
  );

  return {
    searchTerm,
    setSearchTerm,
    normalizedSearchTerm,
    sectionFilter,
    setSectionFilter,
    shouldShowSection,
    sortMode,
    setSortMode,
    density,
    toggleDensity,
    pinnedIds,
    pinnedIdSet,
    togglePinned,
    holdings,
    setHoldings,
  };
}
