#!/usr/bin/env node
// Refresh per-stock daily statistics — previous close + 52-week range — into
// server/data/universe-stats.json. These change at most once per trading day, so
// the daily refresh bot (06:30 UTC, after US close) keeps them current while the
// live request path stays cheap (no per-request per-symbol fan-out).
//
// Previous close drives the correct day-change (live price vs prior close, so the
// sign matches the indices); the 52-week range drives the range bar. Sourced from
// Yahoo's keyless v8 chart `meta`. Runs from CI egress IPs where Yahoo is reachable.
//
// Keep SYMBOLS in sync with PUBLIC_COMPANIES (server/providers/stooq.ts) — curated
// names without a keyless quote (Aramco/Samsung) are intentionally excluded.

import { writeFile } from "node:fs/promises";

const SYMBOLS = [
  "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "AVGO", "TSLA", "TSM", "LLY",
  "JPM", "WMT", "BRK-B", "V", "MA", "UNH", "XOM", "JNJ", "HD", "PG",
  "COST", "NFLX", "ORCL", "AMD", "CRM", "BAC", "KO", "PEP", "CVX", "ABBV",
  "WFC", "MRK", "ADBE", "CSCO", "ACN", "MCD", "TMUS", "INTC", "QCOM", "TXN",
  "SPCX",
];

const BASE_URL = process.env.YAHOO_FINANCE_BASE_URL ?? "https://query1.finance.yahoo.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const OUTPUT = new URL("../server/data/universe-stats.json", import.meta.url);

function finite(value) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

async function fetchStats(symbol) {
  const url = `${BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json,*/*" } });
  if (!response.ok) throw new Error(`${symbol}: HTTP ${response.status}`);
  const meta = (await response.json())?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`${symbol}: no meta`);
  const prevClose = finite(meta.chartPreviousClose);
  const low52w = finite(meta.fiftyTwoWeekLow);
  const high52w = finite(meta.fiftyTwoWeekHigh);
  if (prevClose === null && low52w === null && high52w === null) throw new Error(`${symbol}: empty meta`);
  return { symbol, prevClose, low52w, high52w };
}

async function main() {
  const stats = {};
  const failures = [];
  // Chunk to keep request bursts polite and avoid Yahoo rate limiting.
  const chunkSize = 8;
  for (let i = 0; i < SYMBOLS.length; i += chunkSize) {
    const chunk = SYMBOLS.slice(i, i + chunkSize);
    const results = await Promise.allSettled(chunk.map(fetchStats));
    for (const result of results) {
      if (result.status === "fulfilled") {
        const { symbol, ...values } = result.value;
        stats[symbol] = values;
      } else {
        failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      }
    }
  }

  const resolved = Object.keys(stats).length;
  if (resolved < SYMBOLS.length * 0.6) {
    console.error(`Refusing to write: only ${resolved}/${SYMBOLS.length} symbols resolved.`, failures);
    process.exit(1);
  }

  const payload = {
    _comment:
      "Per-stock daily stats (previous close + 52-week range) sourced from Yahoo v8 chart meta. Auto-refreshed daily by the refresh bot; do not hand-edit. Keep symbols in sync with PUBLIC_COMPANIES.",
    generatedAt: new Date().toISOString(),
    stats,
  };
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${resolved}/${SYMBOLS.length} symbols to universe-stats.json.${failures.length ? ` Failures: ${failures.join("; ")}` : ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
