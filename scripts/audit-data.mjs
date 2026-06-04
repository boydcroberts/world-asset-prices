import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const PRIMARY_SOURCE_TYPES = new Set(["live-provider", "issuer", "reported-transaction", "recognized-market-data"]);
const ALTERNATE_SOURCE_TYPES = new Set(["rumor", "target", "secondary-market-chatter"]);
const REQUIRED_PUBLIC_COMPANIES = [
  "NVDA",
  "GOOGL",
  "AAPL",
  "MSFT",
  "AMZN",
  "TSM",
  "AVGO",
  "2222.SR",
  "TSLA",
  "META",
  "005930.KS",
  "WMT",
  "BRK-B",
  "LLY",
];
const REQUIRED_PRIVATE_VALUES = new Map([
  ["private-spacex", 1_250_000_000_000],
  ["private-openai", 852_000_000_000],
  ["private-bytedance", 550_000_000_000],
  ["private-anthropic", 965_000_000_000],
  ["private-stripe", 159_000_000_000],
  ["private-databricks", 134_000_000_000],
  ["private-waymo", 126_000_000_000],
]);
const PRIVATE_REVIEW_MAX_AGE_DAYS = 90;
const PRIVATE_LOW_CONFIDENCE_MAX_SOURCE_AGE_DAYS = 180;
const PRIVATE_MEDIUM_CONFIDENCE_MAX_SOURCE_AGE_DAYS = 365;

function parseYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : null;
}

function ageDays(fromMs, toMs) {
  return Math.floor((toMs - fromMs) / 86_400_000);
}

function fail(errors) {
  console.error(`Data audit failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function ranksAreSequential(rows) {
  return rows.every((row, index) => row.rank === index + 1);
}

function valuesAreDescending(rows, key) {
  return rows.every((row, index) => index === 0 || (row[key] ?? 0) <= (rows[index - 1]?.[key] ?? 0));
}

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8"));
}

const [manifest, fallback] = await Promise.all([
  readJson("server/data/asset-value-sources.json"),
  readJson("server/fallback/dashboard-fallback.json"),
]);

const errors = [];
const sources = Array.isArray(manifest.sources) ? manifest.sources : [];
const sourceById = new Map(sources.map((source) => [source.assetId, source]));
const auditNowMs = Date.now();

if (!manifest.version || typeof manifest.version !== "string") errors.push("manifest version is missing");
if (!sources.length) errors.push("manifest has no sources");

for (const source of sources) {
  if (!source.assetId) errors.push("source row is missing assetId");
  if (!PRIMARY_SOURCE_TYPES.has(source.sourceType)) errors.push(`${source.assetId} uses invalid primary sourceType=${source.sourceType}`);
  if (!Number.isFinite(source.valueUsd) || source.valueUsd <= 0) errors.push(`${source.assetId} has invalid valueUsd`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.valueAsOf ?? "")) errors.push(`${source.assetId} has invalid valueAsOf`);
  if (source.lastCheckedAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(source.lastCheckedAt)) errors.push(`${source.assetId} has invalid lastCheckedAt`);
  if (!isHttpUrl(source.sourceUrl)) errors.push(`${source.assetId} has invalid sourceUrl`);
  if (!source.sourceTitle) errors.push(`${source.assetId} is missing sourceTitle`);
  if (!source.notes) errors.push(`${source.assetId} is missing notes`);

  if (source.category === "Private Company" && source.updateCadence === "event-driven") {
    const valueAsOfMs = parseYmd(source.valueAsOf);
    const lastCheckedMs = parseYmd(source.lastCheckedAt);
    if (lastCheckedMs === null) {
      errors.push(`${source.assetId} event-driven private-company source is missing lastCheckedAt`);
    } else if (ageDays(lastCheckedMs, auditNowMs) > PRIVATE_REVIEW_MAX_AGE_DAYS) {
      errors.push(`${source.assetId} private-company source review is older than ${PRIVATE_REVIEW_MAX_AGE_DAYS} days`);
    }

    if (valueAsOfMs !== null) {
      const sourceAgeDays = ageDays(valueAsOfMs, auditNowMs);
      if (source.confidence === "low" && sourceAgeDays > PRIVATE_LOW_CONFIDENCE_MAX_SOURCE_AGE_DAYS && lastCheckedMs === null) {
        errors.push(`${source.assetId} low-confidence private-company source is stale without a current review`);
      }
      if (source.confidence === "medium" && sourceAgeDays > PRIVATE_MEDIUM_CONFIDENCE_MAX_SOURCE_AGE_DAYS && lastCheckedMs === null) {
        errors.push(`${source.assetId} medium-confidence private-company source is stale without a current review`);
      }
    }
  }

  for (const alternate of source.alternateValuations ?? []) {
    if (!ALTERNATE_SOURCE_TYPES.has(alternate.sourceType)) {
      errors.push(`${source.assetId} alternate valuation uses invalid sourceType=${alternate.sourceType}`);
    }
    if (!Number.isFinite(alternate.valueUsd) || alternate.valueUsd <= 0) {
      errors.push(`${source.assetId} alternate valuation has invalid valueUsd`);
    }
  }
}

if (!ranksAreSequential(fallback.topStocks ?? [])) errors.push("fallback topStocks ranks are not sequential");
if (!valuesAreDescending(fallback.topStocks ?? [], "marketCapUsd")) errors.push("fallback topStocks are not sorted by marketCapUsd");
if (!ranksAreSequential(fallback.topPrivateCompanies ?? [])) errors.push("fallback topPrivateCompanies ranks are not sequential");
if (!valuesAreDescending(fallback.topPrivateCompanies ?? [], "marketCapUsd")) errors.push("fallback private companies are not sorted by value");
if (!ranksAreSequential(fallback.topEtfs ?? [])) errors.push("fallback topEtfs ranks are not sequential");
if (!valuesAreDescending(fallback.topEtfs ?? [], "aumUsd")) errors.push("fallback topEtfs are not sorted by sourced AUM");

for (const symbol of REQUIRED_PUBLIC_COMPANIES) {
  const company = fallback.topStocks?.find((stock) => stock.symbol === symbol);
  if (!company) {
    errors.push(`required global public company missing from topStocks: ${symbol}`);
    continue;
  }
  if (!sourceById.has(company.id)) errors.push(`${company.id} is missing value source metadata`);
}

for (const stock of fallback.topStocks ?? []) {
  if (!sourceById.has(stock.id)) errors.push(`${stock.id} missing value source metadata`);
  if ((stock.symbol === "2222.SR" || stock.symbol === "005930.KS") && stock.priceUsd !== null) {
    errors.push(`${stock.symbol} should use curated market cap with priceUsd=null`);
  }
}

for (const etf of fallback.topEtfs ?? []) {
  const source = sourceById.get(etf.id);
  if (!source) {
    errors.push(`${etf.id} missing sourced AUM metadata`);
  } else if (source.sourceType !== "issuer" || !/AUM|sourced snapshot/i.test(source.notes)) {
    errors.push(`${etf.id} should document issuer/sourced AUM methodology`);
  }
}

for (const company of fallback.topPrivateCompanies ?? []) {
  const source = sourceById.get(company.id);
  if (!source) {
    errors.push(`${company.id} missing private-company source metadata`);
    continue;
  }
  if (source.sourceType === "rumor" || source.sourceType === "target" || source.sourceType === "secondary-market-chatter") {
    errors.push(`${company.id} uses speculative primary sourceType`);
  }
  if (company.marketCapUsd !== source.valueUsd) {
    errors.push(`${company.id} value ${company.marketCapUsd} does not match manifest ${source.valueUsd}`);
  }
}

for (const [assetId, expectedValue] of REQUIRED_PRIVATE_VALUES) {
  const company = fallback.topPrivateCompanies?.find((entry) => entry.id === assetId);
  if (!company) {
    errors.push(`required private company missing: ${assetId}`);
  } else if (company.marketCapUsd !== expectedValue) {
    errors.push(`${assetId} expected ${expectedValue} but found ${company.marketCapUsd}`);
  }
}

const nvidia = fallback.topStocks?.find((stock) => stock.symbol === "NVDA");
if (!nvidia || nvidia.marketCapUsd < 5_000_000_000_000 || nvidia.marketCapUsd > 6_200_000_000_000) {
  errors.push(`NVIDIA fallback market cap outside sanity range: ${nvidia?.marketCapUsd}`);
}

if (errors.length) fail(errors);

console.log(JSON.stringify({
  ok: true,
  manifestVersion: manifest.version,
  publicCompanies: fallback.topStocks.length,
  privateCompanies: fallback.topPrivateCompanies.length,
  etfs: fallback.topEtfs.length,
  nvidiaMarketCapUsd: nvidia.marketCapUsd,
}, null, 2));
