import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchAssetDetail, fetchDashboard } from "./api";
import { DashboardShell } from "./components/DashboardShell";
import { MarketControls } from "./components/MarketControls";
import { MarketSections } from "./components/MarketSections";
import { PortfolioLab } from "./components/PortfolioLab";
import { WatchlistSection } from "./components/WatchlistSection";
import {
  DEFAULT_REFRESH_SEC,
  SECTION_IDS,
  SECTION_LINKS,
  filterAndSortEntries,
} from "./lib/dashboard-filters";
import {
  buildDashboardInsights,
  getWorstSegmentHealthSummaries,
  type DashboardEntry,
} from "./lib/dashboard-insights";
import { isTradablePortfolioAsset, type PortfolioEntry } from "./lib/portfolio";
import { useDashboardFilters } from "./hooks/useDashboardFilters";
import { useTheme } from "./hooks/useTheme";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardPrivateCompany,
  DashboardStock,
  HistoricalRange,
} from "./types/dashboard";

// Code-split the detail drawer: it only mounts after a card is clicked, so it
// should not ship in the initial bundle chunk.
const AssetDetailDrawer = lazy(() =>
  import("./components/AssetDetailDrawer").then((module) => ({ default: module.AssetDetailDrawer })),
);

// Code-split the search modal: only mounts when user opens cmd+K.
const SearchModal = lazy(() =>
  import("./components/SearchModal").then((module) => ({ default: module.SearchModal })),
);

const EMPTY_CRYPTOS: DashboardCrypto[] = [];
const EMPTY_STOCKS: DashboardStock[] = [];
const EMPTY_ETFS: DashboardEtf[] = [];
const EMPTY_CURRENCIES: DashboardCurrency[] = [];
const EMPTY_ASSETS: DashboardAsset[] = [];
const EMPTY_PRIVATE_COMPANIES: DashboardPrivateCompany[] = [];

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
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
  } = useDashboardFilters();

  const [activeCryptoId, setActiveCryptoId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<string>("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [detailRange, setDetailRange] = useState<HistoricalRange>("30D");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const setupSectionObserver = useCallback(() => {
    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-15% 0px -50% 0px" },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    observerRef.current = observer;
    return () => observer.disconnect();
  }, []);

  useEffect(() => setupSectionObserver(), [setupSectionObserver]);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: (query) => {
      const refreshInSec = query.state.data?.refreshInSec ?? DEFAULT_REFRESH_SEC;
      return refreshInSec * 1_000;
    },
  });

  const assetDetailQuery = useQuery({
    queryKey: ["asset-detail", selectedAssetId, detailRange],
    queryFn: () => fetchAssetDetail(selectedAssetId ?? "", detailRange),
    enabled: Boolean(selectedAssetId),
  });

  const dashboard = dashboardQuery.data;
  const topCryptos = dashboard?.topCryptos ?? EMPTY_CRYPTOS;
  const topStocks = dashboard?.topStocks ?? EMPTY_STOCKS;
  const topEtfs = dashboard?.topEtfs ?? EMPTY_ETFS;
  const topCurrencies = dashboard?.topCurrencies ?? EMPTY_CURRENCIES;
  const topPrivateCompanies = dashboard?.topPrivateCompanies ?? EMPTY_PRIVATE_COMPANIES;
  const topAssets = dashboard?.topAssets ?? EMPTY_ASSETS;
  const segmentMeta = dashboard?.segmentMeta;
  const generatedAt = dashboard?.generatedAt;
  const equityFundamentalsAsOf = dashboard?.source.equityFundamentalsAsOf;
  const equityEstimateLabel = equityFundamentalsAsOf
    ? `Live prices; valuation baselines as of ${equityFundamentalsAsOf}`
    : "Live prices; valuation baselines";
  const isBooting = dashboardQuery.isPending && !dashboard;

  useEffect(() => {
    if (topCryptos.length === 0) {
      if (activeCryptoId) setActiveCryptoId("");
      return;
    }
    if (!topCryptos.some((coin) => coin.id === activeCryptoId)) {
      setActiveCryptoId(topCryptos[0].id);
    }
  }, [activeCryptoId, topCryptos]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);

      // ⌘K / Ctrl+K — open search modal
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchModalOpen((open) => !open);
        return;
      }
      if (event.key === "/" && !isEditable && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (event.key === "Escape" && searchModalOpen) {
        setSearchModalOpen(false);
        return;
      }
      if (event.key === "Escape" && selectedAssetId) {
        event.preventDefault();
        setSelectedAssetId(null);
        return;
      }
      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        if (searchTerm) {
          event.preventDefault();
          setSearchTerm("");
        } else {
          searchInputRef.current?.blur();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [searchModalOpen, searchTerm, selectedAssetId, setSearchTerm]);

  const openAssetDetail = useCallback((id: string) => {
    setSelectedAssetId(id);
  }, []);
  const closeAssetDetail = useCallback(() => {
    setSelectedAssetId(null);
  }, []);

  const dashboardInsights = useMemo(() => (dashboard ? buildDashboardInsights(dashboard) : []), [dashboard]);
  const segmentHealthSummaries = useMemo(
    () => (dashboard ? getWorstSegmentHealthSummaries(dashboard) : []),
    [dashboard],
  );

  const visibleTopAssets = useMemo(
    () => filterAndSortEntries(topAssets, normalizedSearchTerm, sortMode),
    [normalizedSearchTerm, sortMode, topAssets],
  );
  const visibleTopStocks = useMemo(
    () => filterAndSortEntries(topStocks, normalizedSearchTerm, sortMode),
    [normalizedSearchTerm, sortMode, topStocks],
  );
  const visibleTopEtfs = useMemo(
    () => filterAndSortEntries(topEtfs, normalizedSearchTerm, sortMode),
    [normalizedSearchTerm, sortMode, topEtfs],
  );
  const visibleTopCurrencies = useMemo(
    () => filterAndSortEntries(topCurrencies, normalizedSearchTerm, sortMode),
    [normalizedSearchTerm, sortMode, topCurrencies],
  );
  const visibleTopCryptos = useMemo(
    () => filterAndSortEntries(topCryptos, normalizedSearchTerm, sortMode),
    [normalizedSearchTerm, sortMode, topCryptos],
  );
  const visibleTopPrivateCompanies = useMemo(
    () => filterAndSortEntries(topPrivateCompanies, normalizedSearchTerm, sortMode),
    [normalizedSearchTerm, sortMode, topPrivateCompanies],
  );

  const allEntries = useMemo(
    () => [...topStocks, ...topEtfs, ...topCurrencies, ...topCryptos, ...topPrivateCompanies, ...topAssets],
    [topAssets, topCryptos, topCurrencies, topEtfs, topPrivateCompanies, topStocks],
  );

  const entriesById = useMemo(() => {
    const byId = new Map<string, DashboardEntry>();
    for (const entry of allEntries) byId.set(entry.id, entry);
    return byId;
  }, [allEntries]);

  const pinnedEntries = useMemo(
    () => pinnedIds.map((id) => entriesById.get(id)).filter((entry): entry is DashboardEntry => Boolean(entry)),
    [entriesById, pinnedIds],
  );

  const selectedEntry = selectedAssetId ? entriesById.get(selectedAssetId) : undefined;

  const portfolioCandidates = useMemo(() => {
    const entries: PortfolioEntry[] = [
      ...topStocks.filter((stock) => typeof stock.priceUsd === "number"),
      ...topEtfs,
      ...topCryptos,
    ];
    return entries.filter(isTradablePortfolioAsset);
  }, [topCryptos, topEtfs, topStocks]);

  const navLinks = useMemo(
    () =>
      SECTION_LINKS.filter((link) => {
        if (link.filter === "watchlist") return pinnedEntries.length > 0;
        if (link.filter === "portfolio") return sectionFilter === "all";
        return sectionFilter === "all" || link.filter === sectionFilter;
      }),
    [pinnedEntries.length, sectionFilter],
  );

  return (
    <>
      <DashboardShell
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSearch={() => setSearchModalOpen(true)}
        insights={dashboardInsights}
        segmentHealthSummaries={segmentHealthSummaries}
        density={density}
      >
        <MarketControls
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchInputRef={searchInputRef}
          sectionFilter={sectionFilter}
          onSectionFilterChange={setSectionFilter}
          sortMode={sortMode}
          onSortChange={setSortMode}
          density={density}
          onDensityToggle={toggleDensity}
          isFetching={dashboardQuery.isFetching}
          generatedAt={generatedAt}
        />

        <nav className="section-nav" aria-label="Dashboard sections">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={clsx(activeSection === link.id && "nav-active")}
              aria-current={activeSection === link.id ? "true" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <WatchlistSection
          entries={pinnedEntries}
          pinnedIdSet={pinnedIdSet}
          onTogglePin={togglePinned}
          generatedAt={generatedAt}
          selectedAssetId={selectedAssetId}
          onOpenAssetDetail={openAssetDetail}
        />

        <MarketSections
          shouldShowSection={shouldShowSection}
          generatedAt={generatedAt}
          isBooting={isBooting}
          normalizedSearchTerm={normalizedSearchTerm}
          pinnedIdSet={pinnedIdSet}
          onTogglePin={togglePinned}
          selectedAssetId={selectedAssetId}
          onOpenAssetDetail={openAssetDetail}
          segmentMeta={segmentMeta}
          equityEstimateLabel={equityEstimateLabel}
          topAssets={topAssets}
          visibleTopAssets={visibleTopAssets}
          topStocks={topStocks}
          visibleTopStocks={visibleTopStocks}
          topPrivateCompanies={topPrivateCompanies}
          visibleTopPrivateCompanies={visibleTopPrivateCompanies}
          topEtfs={topEtfs}
          visibleTopEtfs={visibleTopEtfs}
          topCurrencies={topCurrencies}
          visibleTopCurrencies={visibleTopCurrencies}
          topCryptos={topCryptos}
          visibleTopCryptos={visibleTopCryptos}
          activeCryptoId={activeCryptoId}
          onCryptoActivate={setActiveCryptoId}
        />

        {sectionFilter === "all" ? (
          <PortfolioLab candidates={portfolioCandidates} holdings={holdings} onChange={setHoldings} />
        ) : null}
      </DashboardShell>

      {searchModalOpen ? (
        <Suspense fallback={null}>
          <SearchModal
            entries={allEntries}
            onSelect={(id) => { openAssetDetail(id); }}
            onClose={() => setSearchModalOpen(false)}
          />
        </Suspense>
      ) : null}

      {selectedAssetId ? (
        <Suspense fallback={null}>
          <AssetDetailDrawer
            detail={assetDetailQuery.data}
            isLoading={assetDetailQuery.isLoading}
            error={assetDetailQuery.error instanceof Error ? assetDetailQuery.error : null}
            range={detailRange}
            onRangeChange={setDetailRange}
            onClose={closeAssetDetail}
            logoUrl={selectedEntry?.logoUrl ?? null}
            fallbackLogoUrls={selectedEntry?.fallbackLogoUrls}
          />
        </Suspense>
      ) : null}
    </>
  );
}

export default App;
