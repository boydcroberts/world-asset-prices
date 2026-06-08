import clsx from "clsx";
import { memo, type ReactNode } from "react";

import { MarketCard } from "./MarketCard";
import { SectionHeader } from "./SectionHeader";
import { useCardServices } from "../context/card-services";
import {
  changeSecondaryClass,
  hasMeaningfulChange,
  presentWatchlistEntry,
  priceWithChangeText,
} from "../lib/card-presenters";
import { buildPriceTitle, type SectionId } from "../lib/dashboard-filters";
import { getEntryChange, type DashboardEntry } from "../lib/dashboard-insights";
import {
  formatCompactCurrency,
  formatCurrency,
  formatExactCurrency,
  formatExactNumber,
  formatPercent,
  trendClass,
} from "../lib/formatters";
import type {
  DashboardAsset,
  DashboardCrypto,
  DashboardCurrency,
  DashboardEtf,
  DashboardPrivateCompany,
  DashboardSegmentMeta,
  DashboardStock,
} from "../types/dashboard";

export type SectionVariant = "assets" | "stocks" | "private" | "etfs" | "currencies" | "cryptos";

type SkeletonGridProps = { count?: number };

export function SkeletonGrid({ count = 15 }: SkeletonGridProps) {
  return (
    <div className="coin-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article key={`skeleton-${index}`} className="coin-card skeleton-card">
          <span className="skeleton-line skeleton-line-sm" />
          <span className="skeleton-line" />
          <span className="skeleton-line skeleton-line-lg" />
          <span className="skeleton-line skeleton-line-sm" />
        </article>
      ))}
    </div>
  );
}

type CommonProps = {
  id: SectionId;
  surfaceClass: string;
  title: string;
  subtitle: string;
  meta?: DashboardSegmentMeta;
  isBooting: boolean;
  totalCount: number;
  normalizedSearchTerm: string;
  emptyLabel: string;
  pinnedIdSet: ReadonlySet<string>;
  selectedAssetId: string | null;
  footerNote?: string;
};

type SectionGridProps = CommonProps &
  (
    | { variant: "assets"; visibleEntries: readonly DashboardAsset[] }
    | { variant: "stocks"; visibleEntries: readonly DashboardStock[] }
    | { variant: "private"; visibleEntries: readonly DashboardPrivateCompany[] }
    | { variant: "etfs"; visibleEntries: readonly DashboardEtf[] }
    | { variant: "currencies"; visibleEntries: readonly DashboardCurrency[] }
    | {
        variant: "cryptos";
        visibleEntries: readonly DashboardCrypto[];
        activeCryptoId: string;
        /** Stable handler that both activates the crypto and opens its detail drawer. */
        onCryptoSelect: (id: string) => void;
      }
  );

/**
 * Per-card render context: section-scoped state (pin set, current selection)
 * merged with the app-level card services pulled from context. Replaces the
 * five fields that used to be threaded down as props.
 */
type CardRenderContext = {
  pinnedIdSet: ReadonlySet<string>;
  selectedAssetId: string | null;
  onTogglePin: (id: string) => void;
  onOpenAssetDetail: (id: string) => void;
  generatedAt: string | undefined;
};

export const SectionGrid = memo(function SectionGrid(props: SectionGridProps) {
  const { onTogglePin, onOpenAssetDetail, generatedAt } = useCardServices();
  const {
    id,
    surfaceClass,
    title,
    subtitle,
    meta,
    isBooting,
    totalCount,
    normalizedSearchTerm,
    emptyLabel,
    footerNote,
  } = props;

  const ctx: CardRenderContext = {
    pinnedIdSet: props.pinnedIdSet,
    selectedAssetId: props.selectedAssetId,
    onTogglePin,
    onOpenAssetDetail,
    generatedAt,
  };

  return (
    <section id={id} className={clsx("surface", surfaceClass)}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        meta={meta}
        generatedAt={generatedAt}
        staticBadge={props.variant === "private" ? "Curated" : undefined}
      />
      {renderBody(props, ctx, isBooting, totalCount, normalizedSearchTerm, emptyLabel)}
      {footerNote ? <p className="disclaimer">{footerNote}</p> : null}
    </section>
  );
});

function renderBody(
  props: SectionGridProps,
  ctx: CardRenderContext,
  isBooting: boolean,
  totalCount: number,
  normalizedSearchTerm: string,
  emptyLabel: string,
): ReactNode {
  if (isBooting) return <SkeletonGrid />;
  if (!totalCount || !props.visibleEntries.length) {
    return renderEmptyState(emptyLabel, totalCount > 0, normalizedSearchTerm);
  }

  switch (props.variant) {
    case "assets":
      return <div className="coin-grid">{props.visibleEntries.map((asset, index) => renderAssetCard(asset, index, ctx))}</div>;
    case "stocks":
      return <div className="coin-grid">{props.visibleEntries.map((stock, index) => renderStockCard(stock, index, ctx))}</div>;
    case "private":
      return <div className="coin-grid">{props.visibleEntries.map((company, index) => renderPrivateCard(company, index, ctx))}</div>;
    case "etfs":
      return <div className="coin-grid">{props.visibleEntries.map((etf, index) => renderEtfCard(etf, index, ctx))}</div>;
    case "currencies":
      return <div className="coin-grid">{props.visibleEntries.map((currency, index) => renderCurrencyCard(currency, index, ctx))}</div>;
    case "cryptos":
      return (
        <div className="coin-grid">
          {props.visibleEntries.map((coin, index) => renderCryptoCard(coin, index, props, ctx))}
        </div>
      );
  }
}

function renderEmptyState(label: string, hasSourceData: boolean, normalizedSearchTerm: string): ReactNode {
  if (hasSourceData && normalizedSearchTerm) {
    return <p className="filter-empty">{`No ${label} match "${normalizedSearchTerm}".`}</p>;
  }
  return <p className="filter-empty filter-empty--nodata">No {label} data available.</p>;
}

function renderAssetCard(asset: DashboardAsset, index: number, ctx: CardRenderContext): ReactNode {
  return (
    <MarketCard
      key={asset.id}
      id={asset.id}
      rank={asset.rank}
      name={asset.name}
      symbol={asset.symbol}
      meta={asset.category}
      valueLabel="Est. Market Cap"
      value={formatCompactCurrency(asset.marketCapUsd)}
      priceTitle={buildPriceTitle(formatExactNumber(asset.marketCapUsd), ctx.generatedAt, "Exact market cap (USD)")}
      index={index}
      logoUrl={asset.logoUrl}
      fallbackLogoUrls={asset.fallbackLogoUrls}
      pinned={ctx.pinnedIdSet.has(asset.id)}
      onTogglePin={ctx.onTogglePin}
      assetStyle
      interactive
      active={asset.id === ctx.selectedAssetId}
      onSelect={ctx.onOpenAssetDetail}
    />
  );
}

function renderStockCard(stock: DashboardStock, index: number, ctx: CardRenderContext): ReactNode {
  const changeText = formatPercent(stock.changePercent);
  const hasChange = hasMeaningfulChange(changeText);
  const priceText = stock.priceUsd === null ? "Curated" : priceWithChangeText(stock.priceUsd, changeText);
  const priceTooltip = stock.priceUsd === null
    ? "Verified snapshot; no free live quote"
    : hasChange
      ? "Price and daily change"
      : "Unit price";

  return (
    <MarketCard
      key={stock.id}
      id={stock.id}
      rank={stock.rank}
      name={stock.name}
      symbol={stock.symbol}
      meta={stock.category}
      valueLabel="Market cap"
      value={formatCompactCurrency(stock.marketCapUsd)}
      priceTitle={buildPriceTitle(formatExactNumber(stock.marketCapUsd), ctx.generatedAt, "Exact market cap (USD)")}
      secondary={priceText}
      secondaryClassName={changeSecondaryClass(stock.changePercent, hasChange)}
      secondaryTitle={priceTooltip}
      index={index}
      logoUrl={stock.logoUrl}
      fallbackLogoUrls={stock.fallbackLogoUrls}
      pinned={ctx.pinnedIdSet.has(stock.id)}
      onTogglePin={ctx.onTogglePin}
      assetStyle
      interactive
      active={stock.id === ctx.selectedAssetId}
      onSelect={ctx.onOpenAssetDetail}
    />
  );
}

function renderPrivateCard(company: DashboardPrivateCompany, index: number, ctx: CardRenderContext): ReactNode {
  return (
    <MarketCard
      key={company.id}
      id={company.id}
      rank={company.rank}
      name={company.name}
      symbol={company.symbol}
      meta={company.category}
      valueLabel="Valuation"
      value={formatCompactCurrency(company.marketCapUsd)}
      priceTitle={buildPriceTitle(formatExactNumber(company.marketCapUsd), ctx.generatedAt, "Exact valuation (USD)")}
      index={index}
      logoUrl={company.logoUrl}
      fallbackLogoUrls={company.fallbackLogoUrls}
      pinned={ctx.pinnedIdSet.has(company.id)}
      onTogglePin={ctx.onTogglePin}
      assetStyle
      interactive
      active={company.id === ctx.selectedAssetId}
      onSelect={ctx.onOpenAssetDetail}
    />
  );
}

function renderEtfCard(etf: DashboardEtf, index: number, ctx: CardRenderContext): ReactNode {
  const changeText = formatPercent(etf.changePercent);
  const hasChange = hasMeaningfulChange(changeText);
  // ETFs are ranked by fund size (AUM), so AUM is the headline value — mirroring
  // how stock cards lead with market cap — with unit price + daily change beneath.
  const priceText = etf.priceUsd === null
    ? (hasChange ? changeText : "—")
    : priceWithChangeText(etf.priceUsd, changeText);
  const priceTooltip = etf.priceUsd === null
    ? (hasChange ? "Daily change" : undefined)
    : hasChange
      ? "Unit price and daily change"
      : "Unit price";

  return (
    <MarketCard
      key={etf.id}
      id={etf.id}
      rank={etf.rank}
      name={etf.name}
      symbol={etf.symbol}
      meta={etf.category}
      valueLabel="AUM"
      value={formatCompactCurrency(etf.aumUsd)}
      priceTitle={buildPriceTitle(formatExactNumber(etf.aumUsd), ctx.generatedAt, "Exact AUM (USD)")}
      secondary={priceText}
      secondaryClassName={changeSecondaryClass(etf.changePercent, hasChange)}
      secondaryTitle={priceTooltip}
      index={index}
      logoUrl={etf.logoUrl}
      fallbackLogoUrls={etf.fallbackLogoUrls}
      pinned={ctx.pinnedIdSet.has(etf.id)}
      onTogglePin={ctx.onTogglePin}
      assetStyle
      interactive
      active={etf.id === ctx.selectedAssetId}
      onSelect={ctx.onOpenAssetDetail}
    />
  );
}

function renderCurrencyCard(currency: DashboardCurrency, index: number, ctx: CardRenderContext): ReactNode {
  return (
    <MarketCard
      key={currency.id}
      id={currency.id}
      rank={currency.rank}
      name={currency.name}
      symbol={currency.symbol}
      meta={currency.category}
      valueLabel="Rate vs USD"
      value={formatCurrency(currency.rateVsUsd)}
      priceTitle={buildPriceTitle(formatExactCurrency(currency.rateVsUsd), ctx.generatedAt, "Exact rate")}
      secondary={formatPercent(currency.changePercent)}
      secondaryClassName={clsx("coin-change", trendClass(currency.changePercent))}
      secondaryTitle="Daily change"
      index={index}
      logoUrl={currency.logoUrl}
      fallbackLogoUrls={currency.fallbackLogoUrls}
      pinned={ctx.pinnedIdSet.has(currency.id)}
      onTogglePin={ctx.onTogglePin}
      assetStyle
      interactive
      active={currency.id === ctx.selectedAssetId}
      onSelect={ctx.onOpenAssetDetail}
    />
  );
}

function renderCryptoCard(
  coin: DashboardCrypto,
  index: number,
  props: Extract<SectionGridProps, { variant: "cryptos" }>,
  ctx: CardRenderContext,
): ReactNode {
  return (
    <MarketCard
      key={coin.id}
      id={coin.id}
      rank={coin.rank}
      name={coin.name}
      symbol={coin.symbol}
      meta={coin.category}
      value={formatCurrency(coin.priceUsd)}
      priceTitle={buildPriceTitle(formatExactCurrency(coin.priceUsd), ctx.generatedAt)}
      secondary={formatPercent(coin.change24h)}
      secondaryClassName={clsx("coin-change", trendClass(coin.change24h))}
      secondaryTitle="24h change"
      index={index}
      logoUrl={coin.logoUrl}
      fallbackLogoUrls={coin.fallbackLogoUrls}
      pinned={ctx.pinnedIdSet.has(coin.id)}
      onTogglePin={ctx.onTogglePin}
      interactive
      active={coin.id === props.activeCryptoId || coin.id === ctx.selectedAssetId}
      onSelect={props.onCryptoSelect}
      sparkline={coin.sparkline7d}
    />
  );
}

type PinnedCardProps = {
  entry: DashboardEntry;
  index: number;
  pinnedIdSet: ReadonlySet<string>;
  selectedAssetId: string | null;
};

/**
 * Render a single pinned-watchlist card. Pinned cards are rendered outside
 * SectionGrid because their value/secondary varies per underlying entry kind.
 */
export const PinnedCard = memo(function PinnedCard({
  entry,
  index,
  pinnedIdSet,
  selectedAssetId,
}: PinnedCardProps) {
  const { onTogglePin, onOpenAssetDetail, generatedAt } = useCardServices();
  const change = getEntryChange(entry);
  const changeText = formatPercent(change);
  const hasChange = hasMeaningfulChange(changeText);
  const isCrypto = "sparkline7d" in entry;
  const isCurrency = "rateVsUsd" in entry;
  const isPrivateCompany = entry.category === "Private Company";
  const isPricedAsset = "priceUsd" in entry;

  const { valueLabel, value, exactValue, exactNoun } = presentWatchlistEntry(entry);

  return (
    <MarketCard
      id={entry.id}
      rank={entry.rank}
      name={entry.name}
      symbol={entry.symbol}
      meta={entry.category}
      valueLabel={valueLabel}
      value={value}
      priceTitle={buildPriceTitle(exactValue, generatedAt, exactNoun)}
      secondary={
        isCrypto
          ? changeText
          : hasChange
            ? changeText
            : isPricedAsset || isCurrency
              ? "—"
              : isPrivateCompany
                ? "Curated estimate"
                : "Estimated market cap"
      }
      secondaryClassName={isCrypto || hasChange ? clsx("coin-change", trendClass(change)) : "asset-note"}
      secondaryTitle={isCrypto ? "24h change" : hasChange ? "Daily change" : undefined}
      index={index}
      logoUrl={entry.logoUrl}
      fallbackLogoUrls={entry.fallbackLogoUrls}
      pinned={pinnedIdSet.has(entry.id)}
      onTogglePin={onTogglePin}
      sparkline={isCrypto ? entry.sparkline7d : undefined}
      assetStyle={!isCrypto}
      interactive
      active={entry.id === selectedAssetId}
      onSelect={onOpenAssetDetail}
    />
  );
});
