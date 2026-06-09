const DEFAULT_URL = "https://world-asset-prices.vercel.app";
const STALE_ALERT_SEC = 300;
const REQUIRED_PUBLIC_COMPANIES = ["NVDA", "GOOGL", "AAPL", "MSFT", "AMZN", "TSM", "AVGO", "2222.SR", "TSLA", "META", "005930.KS", "WMT", "BRK-B", "LLY"];

const origin = new URL(process.env.WAP_PRODUCTION_URL || DEFAULT_URL);
origin.pathname = origin.pathname.replace(/\/$/, "");
origin.search = "";
origin.hash = "";

function fail(message, details) {
  console.error(`Production verification failed: ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exitCode = 1;
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rankIsSequential(rows) {
  return rows.every((row, index) => row.rank === index + 1);
}

function valuesAreDescending(rows, key) {
  return rows.every((row, index) => index === 0 || (row[key] ?? 0) <= (rows[index - 1]?.[key] ?? 0));
}

function degradedFromMeta(segmentMeta) {
  return Object.entries(segmentMeta)
    .filter(([, meta]) => {
      if (!isObject(meta)) return true;
      if (meta.source === "stale-cache") return Number(meta.ageSec ?? 0) >= STALE_ALERT_SEC;
      return meta.source === "fallback" || meta.source === "durable-cache";
    })
    .map(([segment]) => segment);
}

const isLocalOrigin = origin.hostname === "localhost" || origin.hostname === "127.0.0.1" || origin.hostname === "::1";
const dashboardPath = process.env.WAP_DASHBOARD_PATH || (isLocalOrigin ? "/__local_api/dashboard" : "/api/dashboard");
const dashboardUrl = new URL(dashboardPath, origin);
const htmlResponse = await fetch(origin);
assert(htmlResponse.ok, `HTML returned ${htmlResponse.status}`);

const csp = htmlResponse.headers.get("content-security-policy") ?? "";
if (!isLocalOrigin) {
  assert(csp.includes("default-src 'self'"), "CSP default-src is missing", { csp });
  assert(csp.includes("frame-ancestors 'none'"), "CSP frame-ancestors is missing", { csp });
}

const dashboardResponse = await fetch(dashboardUrl);
assert(dashboardResponse.ok, `dashboard API returned ${dashboardResponse.status}`);

const payload = await dashboardResponse.json();
assert(isObject(payload), "dashboard payload is not an object");
assert(payload.source?.fallbackUsed !== true, "dashboard is using fallback", payload.source);
assert(Array.isArray(payload.degradedSegments), "degradedSegments is not an array");
assert(isObject(payload.segmentMeta), "segmentMeta is missing");

const computedDegraded = degradedFromMeta(payload.segmentMeta);
assert(
  computedDegraded.length === payload.degradedSegments.length && computedDegraded.every((segment) => payload.degradedSegments.includes(segment)),
  "degradedSegments does not match segment metadata",
  { expected: computedDegraded, actual: payload.degradedSegments, segmentMeta: payload.segmentMeta },
);

assert(payload.degradedSegments.length === 0, "dashboard has escalated degraded segments", {
  degradedSegments: payload.degradedSegments,
  segmentMeta: payload.segmentMeta,
});

assert(Array.isArray(payload.topStocks) && payload.topStocks.length >= 10, "topStocks is incomplete");
assert(Array.isArray(payload.topEtfs) && payload.topEtfs.length >= 10, "topEtfs is incomplete");
assert(Array.isArray(payload.topPrivateCompanies) && payload.topPrivateCompanies.length >= 10, "topPrivateCompanies is incomplete");
assert(Array.isArray(payload.topAssets) && payload.topAssets.length >= 10, "topAssets is incomplete");
assert(rankIsSequential(payload.topStocks), "topStocks ranks are not sequential");
assert(rankIsSequential(payload.topEtfs), "topEtfs ranks are not sequential");
assert(rankIsSequential(payload.topAssets), "topAssets ranks are not sequential");
assert(valuesAreDescending(payload.topStocks, "marketCapUsd"), "topStocks values are not descending");
assert(valuesAreDescending(payload.topEtfs, "aumUsd"), "topEtfs values are not descending");
assert(valuesAreDescending(payload.topAssets, "marketCapUsd"), "topAssets values are not descending");

const nvidia = payload.topStocks.find((stock) => stock.symbol === "NVDA");
const spacex = payload.topPrivateCompanies?.find((asset) => asset.symbol === "SPACEX");
assert(nvidia?.marketCapUsd > 4_000_000_000_000, "NVIDIA market cap is unexpectedly low", nvidia);
assert(spacex?.category === "Private Company", "SpaceX is missing from private companies", spacex);
assert(spacex?.marketCapUsd === 1_770_000_000_000, "SpaceX primary valuation is not the verified transaction mark", spacex);

for (const symbol of REQUIRED_PUBLIC_COMPANIES) {
  assert(payload.topStocks.some((stock) => stock.symbol === symbol), `required global public company missing: ${symbol}`);
}

assert(payload.valueSources && typeof payload.valueSources === "object", "valueSources metadata is missing");
for (const row of [...payload.topPrivateCompanies, ...payload.topEtfs]) {
  const source = payload.valueSources[row.id];
  assert(source?.sourceUrl && source?.valueAsOf && source?.sourceTitle, `missing source metadata for ${row.id}`, source);
}

if (process.exitCode) process.exit(process.exitCode);

console.log(JSON.stringify({
  ok: true,
  generatedAt: payload.generatedAt,
  stale: payload.stale,
  degradedSegments: payload.degradedSegments,
  stockLeader: payload.topStocks[0]?.symbol,
  stockLeaderValue: payload.topStocks[0]?.marketCapUsd,
  etfLeader: payload.topEtfs[0]?.symbol,
  globalTop10: payload.topAssets.map((asset) => asset.symbol),
  valueSourceVersion: payload.source?.valueSourceVersion,
}, null, 2));
