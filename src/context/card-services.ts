import { createContext, useContext } from "react";

/**
 * App-level services shared by every market card. These are stable for the life
 * of the app (the two callbacks never change identity; `generatedAt` and
 * `equityEstimateLabel` change only when a refresh lands), so passing them via
 * context instead of threading them App → MarketSections → SectionGrid →
 * MarketCard removes four-level prop-drilling without adding re-render churn.
 *
 * Per-item, frequently-changing state (`pinned`, `active`, the entry itself)
 * deliberately stays on props so each memoized card still re-renders
 * independently.
 */
export type CardServices = {
  onTogglePin: (id: string) => void;
  onOpenAssetDetail: (id: string) => void;
  generatedAt: string | undefined;
  equityEstimateLabel: string;
};

export const CardServicesContext = createContext<CardServices | null>(null);

export function useCardServices(): CardServices {
  const services = useContext(CardServicesContext);
  if (!services) {
    throw new Error("useCardServices must be used within a CardServicesContext.Provider");
  }
  return services;
}
