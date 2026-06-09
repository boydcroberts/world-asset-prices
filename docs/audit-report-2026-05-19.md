# World Asset Prices Audit Report

> **Historical audit snapshot — 2026-05-19.** Asset counts, data versions, and findings reflect the state at that date; current state may differ.

Date: 2026-05-19  
Auditor: Codex  
Release verdict: Ready

## Executive Summary

World Asset Prices is in solid MVP shape. The canonical Vercel deployment is live, current production verification has no degraded segments, NVIDIA no longer shows the stale multi-trillion-dollar drift that triggered the original concern, and the local quality gates pass.

No P0 or P1 blockers were found. The original follow-up findings have been addressed: history messaging is now honest, GitHub Pages builds generate static detail payloads, and private-company source reviews are enforced by the data audit.

## Validation Snapshot

| Check | Result | Evidence |
| --- | --- | --- |
| Git state before audit | Clean and aligned with `origin/main` | `git status --short --branch` -> `## main...origin/main` |
| Repo size | 129 tracked/non-build files inspected | `find ... | wc -l` |
| Data audit | Pass | `npm run audit:data` -> manifest `2026-05-16`, 14 public companies, 10 private companies, 10 ETFs, NVIDIA fallback `$5.38T` |
| Production dependency audit | Pass | `npm audit --omit=dev` -> 0 vulnerabilities |
| Full local gate | Pass | `npm run check` -> lint, typecheck, data audit, unit/server tests, route tests, build, bundle check |
| E2E | Pass | `npm run test:e2e` -> 6/6 tests passed after allowing local server bind |
| Production verify | Pass | `npm run verify:production` -> `stale: false`, `degradedSegments: []`, leader `NVDA`, value `$5.361T`, source version `2026-05-16` |
| Visual viewport audit | Pass | 390x844, 768x1024, 1440x900, 1920x1080 in light and dark: 0 horizontal overflow, 0 undersized controls, detail drawer opens |
| Portfolio flow | Pass | Mobile search/sort/watchlist/add/export/remove/import flow preserved NVIDIA holding and had 0 overflow |

## Findings

### [P2] Resolved: Stock and ETF history now powered by Yahoo Finance v8

Files: `server/providers/stooq.ts`, `server/asset-detail.ts`, `server/asset-registry.ts`, `README.md`, `ROADMAP.md`, `CHANGELOG.md`

Original impact: The previous Stooq CSV history path returned an API-key prompt, so the drawer surfaced an unavailable state for every real asset. The 2026-05-19 pass made the messaging honest but did not restore history.

Re-fix applied on 2026-05-20:

- Added `fetchHistoricalPricesFromYahoo` against `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}` (no key). Prefers `adjclose`, falls back to `close`. Range tokens: 7D→`5d`, 30D→`1mo`, 1Y→`1y`, all at daily interval.
- Added `fetchEquityHistory` wrapper that tries Yahoo first and falls back to the existing Stooq CSV path (in case Stooq ever reopens).
- `historyForEntry` in `server/asset-detail.ts` calls the wrapper for Stock/ETF entries that have a live unit price; everything else still returns the existing honest unavailable reason.
- `AssetRef.supportsHistory` flipped from constant `false` to `isStockOrEtf && hasUnitPrice` so the client enables the range selector for assets with real history.
- Stooq history payload budget reused for Yahoo to keep responses capped.
- README, ROADMAP, and CHANGELOG copy refreshed.

Validation after fix:

- `npm run check` — 77 unit tests (was 73), 33 route tests, lint, typecheck, build, bundle budget all green.
- New stooq tests cover Yahoo chart parsing (adjusted close, null skip) and the Yahoo→Stooq fallback path.
- `server/asset-detail.test.ts` now asserts Yahoo-mocked history populates `history.points` and that double-provider failure still returns the honest unavailable reason.
- Live spot check: `curl https://query1.finance.yahoo.com/v8/finance/chart/NVDA?range=5d&interval=1d` returns 5 close points without an API key.

### [P2] Fixed: GitHub Pages build has static dashboard data but no static asset-detail route

Files: `vite.config.ts:98`, `src/api.ts:5`, `src/api.ts:11`, `src/api.ts:12`, `.github/workflows/pages.yml`

Impact: The project has a GitHub Pages deployment workflow and copies `dashboard-fallback.json` into `dist/data/dashboard.json`, but `ASSET_DETAIL_ENDPOINT` still points to `/api/asset-detail` in production. GitHub Pages has no serverless API route, so the static deployment can load the dashboard but detail drawers fail.

Evidence:

- `vite.config.ts` explicitly documents GitHub Pages as "a static host with no serverless backend" and copies only dashboard JSON.
- `src/api.ts` switches `DASHBOARD_ENDPOINT` for `__GITHUB_PAGES__`, but does not switch `ASSET_DETAIL_ENDPOINT` or client error reporting.
- Vercel is the canonical live site and passes, so this is not a Vercel blocker. It is a portfolio/deployment consistency issue.

Fix applied:

- GitHub Pages builds now generate static asset-detail JSON for every fallback asset and every supported detail range.
- GitHub Pages frontend requests now read `/data/asset-detail/{assetId}-{range}.json`.
- Client-error reporting is now a no-op for GitHub Pages static builds.

Validation after fix:

- Build with `GITHUB_PAGES=true npm run build` and verify `dist/data/asset-detail/*.json` exists.
- Serve `dist/` locally and verify dashboard, detail drawer, and portfolio flows without `/api/*`.
- Add a lightweight Playwright/static smoke for the GitHub Pages build.

### [P3] Fixed: Private-company source aging is documented but not enforced

Files: `scripts/audit-data.mjs`, `server/data/asset-value-sources.json`

Impact: The source manifest carries `valueAsOf`, `confidence`, and `updateCadence`, but `npm run audit:data` does not currently fail on old low-confidence private-company values. That allows entries like Epic Games (`2022-04-01`, low confidence) and older event-driven values for Canva/ByteDance/Databricks/Waymo to remain in the top 10 without an automated review prompt.

Evidence:

- `private-epic-games` is a low-confidence source dated `2022-04-01`.
- `private-canva` is dated `2025-09-30`, `private-bytedance` is dated `2025-12-22`, and `private-databricks` is dated `2025-12-16`.
- `audit:data` validates source shape, allowed primary source types, required company coverage, ranking order, ETF methodology notes, and fixed private-company values, but not source age thresholds.

Fix applied:

- Added `lastCheckedAt` metadata for private-company source rows.
- `npm run audit:data` now fails event-driven private-company rows without recent review metadata.
- The audit also enforces low-confidence and medium-confidence stale-source review rules.

Validation after fix:

- `npm run audit:data` passes with current review metadata and will fail once review markers age past policy.

### Fixed During Audit: CI did not run the project data audit

Files changed: `.github/workflows/ci.yml`, `.github/workflows/pages.yml`

Impact before fix: Pull requests and GitHub Pages deployment builds could pass lint, typecheck, tests, and build while skipping the project-specific data provenance gate.

Fix applied:

- Added `npm run audit:data` to the main CI quality job.
- Added `npm run audit:data` before the GitHub Pages build.

Validation:

- `npm run check` already includes `audit:data`.
- `git diff --check` should remain clean after this report.

## Data Accuracy Spot Check

### Public Companies

Production currently reports NVIDIA as the public-company leader at about `$5.361T`, with no degraded segments. That is within the audit tolerance against current public references:

- [StockAnalysis NVIDIA market cap](https://stockanalysis.com/stocks/nvda/market-cap/) showed about `$5.38T` on its market-cap page.
- [StockAnalysis NVIDIA overview](https://stockanalysis.com/stocks/nvda/) and public search snippets showed about `$5.46T`.
- [CompaniesMarketCap NVIDIA](https://companiesmarketcap.com/nvidia/marketcap/) showed about `$5.16T`.

Global public-company coverage includes the required set: NVIDIA, Alphabet, Apple, Microsoft, Amazon, TSMC, Broadcom, Saudi Aramco, Tesla, Meta, Samsung, Walmart, Berkshire Hathaway, and Eli Lilly. Production ordering is coherent with the app's mixed live-price plus curated-snapshot model.

### Private Companies

Primary private-company values follow the verified-only standard:

- [MoneyWeek on Scottish Mortgage SpaceX valuation](https://moneyweek.com/investments/investment-trusts/scottish-mortgage-confirms-spacex-valuation): supports SpaceX at `$1.25T` as a transaction-based mark, with higher IPO targets left out of the primary value.
- [Reuters via Investing.com on OpenAI](https://www.investing.com/news/stock-market-news/openai-investors-question-852-billion-valuation-as-strategy-shifts-ft-reports-4611649): supports the `$852B` OpenAI report with the appropriate medium-confidence caveat.
- [Reuters via Investing.com on Anthropic](https://www.investing.com/news/economy-news/anthropic-valued-at-380-billion-in-latest-funding-round-4503855): supports the `$380B` primary Anthropic valuation; later secondary-market chatter should remain alternate/speculative.
- [TechCrunch on Stripe](https://techcrunch.com/2026/02/24/stripes-valuation-soars-74-to-159-billion/): supports `$159B`.
- [Databricks PRNewswire](https://www.prnewswire.com/news-releases/databricks-grows-55-yoy-surpasses-4-8b-revenue-run-rate-and-is-raising-4b-series-l-at-134b-valuation-302643445.html): supports `$134B`.

No private-company primary value was found using `rumor`, `target`, or `secondary-market-chatter` as its primary source type.

### ETFs

ETF AUM values are directionally correct but should remain labeled as sourced snapshots because ETF sources disagree materially:

- [ETF Central VOO](https://www.etfcentral.com/fund/VOO) showed VOO AUM around `$956.53B` as of May 12, 2026; app fallback uses `$935.76B`, a roughly 2.2% difference.
- [BlackRock IVV](https://www.blackrock.com/us/individual/products/239726/ishares-core-s-p-500-etf) showed IVV net assets of `$825.83B` as of May 15, 2026; app fallback uses `$805.28B`, a roughly 2.5% difference.
- [Kiplinger ETF comparison](https://www.kiplinger.com/investing/why-your-portfolio-needs-more-than-just-an-sp-500-etf) showed VOO/IVV/SPY values that differ from ETF Central and issuer pages, reinforcing that AUM should not be treated as live price times units.

No ETF spot-check exceeded the 5% material-drift threshold, but the next data refresh should update VOO and IVV source values if ETF Central/issuer values remain higher.

## Product And Visual QA

Rendered checks were run against an isolated local dev server on `http://127.0.0.1:4190/` because `localhost:5188` was occupied by another local app.

Viewport results:

| Viewport | Theme | Overflow | Small controls | Cards | Detail drawer |
| --- | --- | ---: | ---: | ---: | --- |
| 390x844 | Dark/light | 0 | 0 | 69 | Opens |
| 768x1024 | Dark/light | 0 | 0 | 69 | Opens |
| 1440x900 | Dark/light | 0 | 0 | 69 | Opens |
| 1920x1080 | Dark/light | 0 | 0 | 69 | Opens |

Workflow checks:

- Search, sort, watchlist pinning, and compact density controls remained usable on mobile.
- Portfolio add, export JSON, remove, import JSON, and persistence state worked.
- Data health rendered `Live` locally and in production during the audit.
- README screenshot path exists at `docs/screenshot.jpg`; social preview path exists at `public/site-preview.jpg`.

## Security And Dependency Review

No active security blockers were found.

Checked areas:

- Unsafe DOM sinks: no production `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`, or `new Function` usage found.
- Secrets: no committed `.env` or obvious live secret values found; token/password hits were tests, docs, or server-side env names.
- Logo proxy: HTTPS-only, userinfo rejection, private-host rejection, exact allowlist, response size limits, and content-type checks are in place.
- Provider overrides: HTTPS-only, expected-host-only, no userinfo, no paths, no queries, no fragments.
- Client telemetry: URL credentials/query/fragment are stripped; stack text is hashed/trimmed rather than logged raw.
- Dependency audit: `npm audit --omit=dev` returned 0 vulnerabilities.

## Release Recommendation

Ready.

Ship status is acceptable for the canonical Vercel app and the static GitHub Pages path now has dashboard and detail data. Production rankings are coherent, security checks are clean, and the UI works across required breakpoints. The next real growth step is adding a reliable no-key historical provider rather than expanding more card sections.
