import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchAssetDetail, fetchDashboard } from "./api";
import { CardServicesContext, type CardServices } from "./context/card-services";
import { readCachedDashboard, writeCachedDashboard } from "./lib/dashboard-cache";
import { MarketControls } from "./components/MarketControls";
import { MarketSections } from "./components/MarketSections";
import { PortfolioLab } from "./components/PortfolioLab";
import { WatchlistSection } from "./components/WatchlistSection";
import { MeridianShell } from "./components/MeridianShell";
import { Masthead } from "./components/Masthead";
import { LivingHorizon } from "./components/LivingHorizon";
import { RiskStrip } from "./components/RiskStrip";
import { Movers } from "./components/Movers";
import { SectorRibbon } from "./components/SectorRibbon";
import { MacroRail } from "./components/MacroRail";
import { deriveBreadth, deriveMovers, deriveSectors, findIndex } from "./lib/us-market";
import {
  DEFAULT_REFRESH_SEC,
  SECTION_IDS,
  SECTION_LINKS,
  filterAndSortEntries,
} from "./lib/dashboard-filters";
import { type DashboardEntry } from "./lib/dashboard-insights";
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

  // Seed the query with the last successful payload from a prior visit so a cold
  // load (including a fully offline one) paints real, clearly-aged data instead
  // of a blank screen while the live fetch runs.
  const cachedDashboard = useMemo(() => readCachedDashboard(), []);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: (query) => {
      const refreshInSec = query.state.data?.refreshInSec ?? DEFAULT_REFRESH_SEC;
      return refreshInSec * 1_000;
    },
    // The dynamic refetchInterval drives live updates; staleTime just stops
    // window-focus from triggering a redundant refetch within the same window.
    staleTime: 15_000,
    initialData: cachedDashboard?.payload,
    initialDataUpdatedAt: cachedDashboard?.cachedAt,
  });

  const assetDetailQuery = useQuery({
    queryKey: ["asset-detail", selectedAssetId, detailRange],
    queryFn: () => fetchAssetDetail(selectedAssetId ?? "", detailRange),
    enabled: Boolean(selectedAssetId),
    // Keep the previous payload only while switching ranges for the SAME asset
    // (so 7D→1Y doesn't flash an empty drawer). When the asset itself changes,
    // drop it — otherwise asset A's name/metrics/chart render under asset B's
    // header until the fetch lands.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === selectedAssetId ? previousData : undefined,
  });

  // Persist every successful payload as the client-side last-known-good cache.
  // Keyed on dataUpdatedAt so we store the data's true fetch time (idempotent
  // when the query is seeded from cache).
  useEffect(() => {
    if (dashboardQuery.isSuccess && dashboardQuery.data) {
      writeCachedDashboard(dashboardQuery.data, dashboardQuery.dataUpdatedAt);
    }
  }, [dashboardQuery.isSuccess, dashboardQuery.dataUpdatedAt, dashboardQuery.data]);

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

  // Stable, app-level card services provided via context so they don't have to
  // be threaded App → MarketSections → SectionGrid → MarketCard. Memoized so
  // card consumers only re-render when one of these actually changes.
  const cardServices = useMemo<CardServices>(
    () => ({
      onTogglePin: togglePinned,
      onOpenAssetDetail: openAssetDetail,
      generatedAt,
      equityEstimateLabel,
    }),
    [togglePinned, openAssetDetail, generatedAt, equityEstimateLabel],
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

  const allEntries = useMemo(() => {
    // Section arrays carry the richest variant (price + daily change). topAssets
    // is a cross-category market-cap summary that re-lists many of the same ids
    // (e.g. stock-nvda, btc-bitcoin) without price/change — so add a topAssets
    // entry only when its id isn't already represented by a section entry. This
    // keeps pinned/selected/search resolving to the rich variant and prevents
    // duplicate React keys + duplicate rows in the search modal.
    const ordered: DashboardEntry[] = [
      ...topStocks,
      ...topEtfs,
      ...topCurrencies,
      ...topCryptos,
      ...topPrivateCompanies,
    ];
    const seen = new Set(ordered.map((entry) => entry.id));
    for (const asset of topAssets) {
      if (!seen.has(asset.id)) {
        seen.add(asset.id);
        ordered.push(asset);
      }
    }
    return ordered;
  }, [topAssets, topCryptos, topCurrencies, topEtfs, topPrivateCompanies, topStocks]);

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

  // US-market command-center data. Indices come from the server; movers and
  // breadth are derived client-side from the live equity universe.
  const indices = dashboard?.indices;
  const vix = findIndex(indices, "vix");
  const ust10y = findIndex(indices, "ust10y");
  const breadth = useMemo(() => deriveBreadth(topStocks), [topStocks]);
  const movers = useMemo(() => deriveMovers(topStocks), [topStocks]);
  const sectors = useMemo(() => deriveSectors(topStocks), [topStocks]);
  const isStale = dashboard?.stale ?? false;

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

  // (Re)attach the scroll-spy observer whenever the rendered set of sections can
  // change — section filter, watchlist presence, boot state, or the error panel
  // mounting/unmounting sections. Without re-running, newly-mounted sections go
  // unobserved and the nav active-highlight stops tracking scroll.
  useEffect(
    () => setupSectionObserver(),
    [setupSectionObserver, sectionFilter, pinnedEntries.length, isBooting, dashboardQuery.isError],
  );

  return (
    <>
      <CardServicesContext.Provider value={cardServices}>
        <MeridianShell>
          <Masthead theme={theme} onToggleTheme={toggleTheme} onOpenSearch={() => setSearchModalOpen(true)} />

          {dashboardQuery.isError && !dashboard ? (
            <section className="lh lh--empty" role="alert">
              <p className="lh-unavailable">
                Live market data is unavailable, and no cached snapshot is stored yet.{" "}
                <button type="button" className="retry-button" onClick={() => void dashboardQuery.refetch()}>
                  Try again
                </button>
              </p>
            </section>
          ) : (
            <>
              <LivingHorizon indices={indices} isStale={isStale} />
              <RiskStrip breadth={breadth} vix={vix} ust10y={ust10y} />
              <MacroRail indices={indices} />
              <SectorRibbon sectors={sectors} />
              <Movers gainers={movers.gainers} losers={movers.losers} onSelect={openAssetDetail} />

              <details className="beyond">
                <summary>Beyond the US market — crypto, FX, global &amp; private</summary>
                <div className="beyond-body">
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
                    selectedAssetId={selectedAssetId}
                  />

                  <MarketSections
                    shouldShowSection={shouldShowSection}
                    isBooting={isBooting}
                    normalizedSearchTerm={normalizedSearchTerm}
                    pinnedIdSet={pinnedIdSet}
                    selectedAssetId={selectedAssetId}
                    segmentMeta={segmentMeta}
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
                </div>
              </details>
            </>
          )}
        </MeridianShell>
      </CardServicesContext.Provider>

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
