import { memo, useMemo, useState } from "react";

import { buildPortfolioSummary, parsePositiveDecimal, type PortfolioEntry } from "../lib/portfolio";
import { formatCompactCurrency, formatCurrency, formatPercent, trendClass } from "../lib/formatters";
import type { LocalHolding } from "../types/dashboard";

type PortfolioLabProps = {
  candidates: PortfolioEntry[];
  holdings: LocalHolding[];
  onChange: (holdings: LocalHolding[]) => void;
};

function nowIso(): string {
  return new Date().toISOString();
}

export const PortfolioLab = memo(function PortfolioLab({ candidates, holdings, onChange }: PortfolioLabProps) {
  const [assetId, setAssetId] = useState(candidates[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [costBasisUsd, setCostBasisUsd] = useState("");
  const [transferText, setTransferText] = useState("");
  const [error, setError] = useState("");
  const assetsById = useMemo(() => new Map(candidates.map((entry) => [entry.id, entry])), [candidates]);
  const summary = useMemo(() => buildPortfolioSummary(holdings, assetsById), [assetsById, holdings]);

  const selectedAssetId = assetId || candidates[0]?.id || "";

  function addHolding() {
    setError("");
    const parsedQuantity = parsePositiveDecimal(quantity);
    const parsedCost = costBasisUsd.trim() ? parsePositiveDecimal(costBasisUsd) : null;
    if (!selectedAssetId || !assetsById.has(selectedAssetId)) {
      setError("Choose a supported tradable asset.");
      return;
    }
    if (!parsedQuantity) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (costBasisUsd.trim() && !parsedCost) {
      setError("Cost basis must be greater than zero or blank.");
      return;
    }

    const stamp = nowIso();
    const existing = holdings.find((holding) => holding.assetId === selectedAssetId);
    const nextHolding: LocalHolding = {
      assetId: selectedAssetId,
      quantity: String(parsedQuantity),
      costBasisUsd: parsedCost ? String(parsedCost) : undefined,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    };

    onChange([nextHolding, ...holdings.filter((holding) => holding.assetId !== selectedAssetId)]);
    setQuantity("");
    setCostBasisUsd("");
  }

  function importHoldings() {
    try {
      const parsed = JSON.parse(transferText);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      const allowed = parsed.filter((holding): holding is LocalHolding => {
        return (
          holding &&
          typeof holding.assetId === "string" &&
          assetsById.has(holding.assetId) &&
          typeof holding.quantity === "string" &&
          Boolean(parsePositiveDecimal(holding.quantity)) &&
          typeof holding.createdAt === "string" &&
          typeof holding.updatedAt === "string" &&
          (holding.costBasisUsd === undefined || (typeof holding.costBasisUsd === "string" && Boolean(parsePositiveDecimal(holding.costBasisUsd))))
        );
      });
      onChange(allowed);
      setError("");
    } catch {
      setError("Paste exported holdings JSON before importing.");
    }
  }

  return (
    <section id="section-portfolio" className="surface portfolio-surface" aria-labelledby="portfolio-heading">
      <div className="surface-head">
        <div className="surface-title-row">
          <h2 id="portfolio-heading">Portfolio Lab</h2>
        </div>
        <div className="surface-head-meta">
          <p>Local simulator · never leaves this browser</p>
        </div>
      </div>

      <div className="portfolio-summary">
        <div><span>Total value</span><strong>{formatCompactCurrency(summary.totalValueUsd)}</strong></div>
        <div><span>Cost basis</span><strong>{summary.totalCostBasisUsd === null ? "—" : formatCompactCurrency(summary.totalCostBasisUsd)}</strong></div>
        <div><span>Unrealized P/L</span><strong className={trendClass(summary.totalGainLossUsd)}>{summary.totalGainLossUsd === null ? "—" : formatCompactCurrency(summary.totalGainLossUsd)}</strong></div>
      </div>

      <div className="portfolio-form">
        <label>
          <span>Asset</span>
          <select value={selectedAssetId} onChange={(event) => setAssetId(event.target.value)} aria-label="Portfolio asset">
            {candidates.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name} ({asset.symbol})</option>
            ))}
          </select>
        </label>
        <label>
          <span>Quantity</span>
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" aria-label="Holding quantity" placeholder="0.5" />
        </label>
        <label>
          <span>Cost basis</span>
          <input value={costBasisUsd} onChange={(event) => setCostBasisUsd(event.target.value)} inputMode="decimal" aria-label="Holding cost basis" placeholder="optional USD" />
        </label>
        <button type="button" onClick={addHolding}>Save holding</button>
      </div>
      {error ? <p className="filter-empty">{error}</p> : null}

      <div className="portfolio-positions">
        {summary.positions.length ? summary.positions.map((position) => (
          <article key={position.holding.assetId} className="portfolio-position">
            <div>
              <strong>{position.asset?.name ?? position.holding.assetId}</strong>
              <span>{position.quantity} {position.asset?.symbol ?? "units"} · {position.allocationPercent === null ? "No price" : formatPercent(position.allocationPercent)}</span>
            </div>
            <div>
              <strong>{position.currentValueUsd === null ? "Price unavailable" : formatCurrency(position.currentValueUsd)}</strong>
              <span className={trendClass(position.gainLossUsd)}>{position.gainLossUsd === null ? "P/L unavailable" : formatCompactCurrency(position.gainLossUsd)}</span>
            </div>
            <button type="button" onClick={() => onChange(holdings.filter((holding) => holding.assetId !== position.holding.assetId))}>
              Remove
            </button>
          </article>
        )) : (
          <p className="muted">Add a stock, ETF, or crypto holding to simulate allocation and unrealized gain/loss.</p>
        )}
      </div>

      <div className="portfolio-transfer">
        <textarea
          value={transferText}
          onChange={(event) => setTransferText(event.target.value)}
          aria-label="Portfolio import export JSON"
          placeholder="Exported holdings JSON appears here."
        />
        <div>
          <button type="button" onClick={() => setTransferText(JSON.stringify(holdings, null, 2))}>Export JSON</button>
          <button type="button" onClick={importHoldings}>Import JSON</button>
        </div>
      </div>
    </section>
  );
});
