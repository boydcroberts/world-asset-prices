import { memo, useCallback, useMemo } from "react";

import { SectionGrid } from "./SectionGrid";
import { useCardServices } from "../context/card-services";
import type { SectionFilter } from "../lib/dashboard-filters";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardPrivateCompany,
  DashboardSegmentMeta,
  DashboardStock,
} from "../types/dashboard";

type SegmentMetaMap = {
  topStocks?: DashboardSegmentMeta;
  topEtfs?: DashboardSegmentMeta;
  topCurrencies?: DashboardSegmentMeta;
  topCryptos?: DashboardSegmentMeta;
  topPrivateCompanies?: DashboardSegmentMeta;
};

type MarketSectionsProps = {
  shouldShowSection: (filter: Exclude<SectionFilter, "all">) => boolean;
  isBooting: boolean;
  normalizedSearchTerm: string;
  pinnedIdSet: ReadonlySet<string>;
  selectedAssetId: string | null;
  segmentMeta: SegmentMetaMap | undefined;

  topAssets: DashboardAsset[];
  visibleTopAssets: DashboardAsset[];

  topStocks: DashboardStock[];
  visibleTopStocks: DashboardStock[];

  topPrivateCompanies: DashboardPrivateCompany[];
  visibleTopPrivateCompanies: DashboardPrivateCompany[];

  topEtfs: DashboardEtf[];
  visibleTopEtfs: DashboardEtf[];

  topCurrencies: DashboardCurrency[];
  visibleTopCurrencies: DashboardCurrency[];

  topCryptos: DashboardCrypto[];
  visibleTopCryptos: DashboardCrypto[];
  activeCryptoId: string;
  onCryptoActivate: (id: string) => void;
};

/**
 * Renders the six market sections (Global Assets, Public Companies,
 * ETFs, Private Companies, Currencies, Cryptos) in order, honoring the
 * current section filter. Shared card-context props are forwarded once
 * to each SectionGrid.
 */
export const MarketSections = memo(function MarketSections(props: MarketSectionsProps) {
  const {
    shouldShowSection,
    isBooting,
    normalizedSearchTerm,
    pinnedIdSet,
    selectedAssetId,
    segmentMeta,
    activeCryptoId,
    onCryptoActivate,
  } = props;
  const { onOpenAssetDetail, equityEstimateLabel } = useCardServices();

  // Stable shared per-section state so memoized SectionGrids don't re-render
  // when an unrelated section's props change. (The app-level services —
  // pin/select handlers, generatedAt — now come from CardServicesContext.)
  const common = useMemo(
    () => ({
      isBooting,
      normalizedSearchTerm,
      pinnedIdSet,
      selectedAssetId,
    }),
    [isBooting, normalizedSearchTerm, pinnedIdSet, selectedAssetId],
  );

  // Clicking a crypto card both marks it active and opens its detail drawer.
  const handleCryptoSelect = useCallback(
    (id: string) => {
      onCryptoActivate(id);
      onOpenAssetDetail(id);
    },
    [onCryptoActivate, onOpenAssetDetail],
  );

  return (
    <>
      {shouldShowSection("assets") ? (
        <SectionGrid
          {...common}
          id="section-assets"
          surfaceClass="global-assets-surface"
          title="Top 15 Global Assets"
          subtitle={equityEstimateLabel}
          meta={segmentMeta?.topStocks}
          totalCount={props.topAssets.length}
          visibleEntries={props.visibleTopAssets}
          variant="assets"
          emptyLabel="global assets"
          footerNote="* Approximate values. Network/API conditions may delay updates."
        />
      ) : null}

      {shouldShowSection("stocks") ? (
        <SectionGrid
          {...common}
          id="section-stocks"
          surfaceClass="stocks-surface"
          title="Top 15 Public Companies"
          subtitle={equityEstimateLabel}
          meta={segmentMeta?.topStocks}
          totalCount={props.topStocks.length}
          visibleEntries={props.visibleTopStocks}
          variant="stocks"
          emptyLabel="public companies"
        />
      ) : null}

      {shouldShowSection("etfs") ? (
        <SectionGrid
          {...common}
          id="section-etfs"
          surfaceClass="etfs-surface"
          title="Top 15 ETFs"
          subtitle="Ranked by fund AUM; unit prices live when available"
          meta={segmentMeta?.topEtfs}
          totalCount={props.topEtfs.length}
          visibleEntries={props.visibleTopEtfs}
          variant="etfs"
          emptyLabel="ETFs"
        />
      ) : null}

      {shouldShowSection("private") ? (
        <SectionGrid
          {...common}
          id="section-private-companies"
          surfaceClass="private-companies-surface"
          title="Top 15 Private Companies"
          subtitle="Curated valuations from disclosed rounds — not a live market feed"
          totalCount={props.topPrivateCompanies.length}
          visibleEntries={props.visibleTopPrivateCompanies}
          variant="private"
          emptyLabel="private companies"
        />
      ) : null}

      {shouldShowSection("currencies") ? (
        <SectionGrid
          {...common}
          id="section-currencies"
          surfaceClass="currencies-surface"
          title="Top 15 Currencies"
          subtitle="Exchange rates vs USD"
          meta={segmentMeta?.topCurrencies}
          totalCount={props.topCurrencies.length}
          visibleEntries={props.visibleTopCurrencies}
          variant="currencies"
          emptyLabel="currencies"
        />
      ) : null}

      {shouldShowSection("cryptos") ? (
        <SectionGrid
          {...common}
          id="section-cryptos"
          surfaceClass="cryptos-surface"
          title="Top 15 Cryptocurrencies"
          subtitle="Live market feed"
          meta={segmentMeta?.topCryptos}
          totalCount={props.topCryptos.length}
          visibleEntries={props.visibleTopCryptos}
          variant="cryptos"
          emptyLabel="cryptocurrencies"
          activeCryptoId={activeCryptoId}
          onCryptoSelect={handleCryptoSelect}
        />
      ) : null}
    </>
  );
});
