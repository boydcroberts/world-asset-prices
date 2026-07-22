# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MERIDIAN first-screen command center: live US index horizon, breadth/risk strip, macro rail, sector ribbon, movers, and sortable largest-company table.
- Current Playwright smoke coverage for the Meridian surface, expanded global boards, static Pages build, and public SpaceX `SPCX` detail flow.

### Fixed

- Mobile masthead no longer overlaps the MERIDIAN wordmark with the market-status clock.
- Restored a top-level accessible H1 for screen readers and document outline/SEO.
- README, page metadata, roadmap, and preview screenshots now describe the current Meridian experience instead of the old global-assets-only UI.

## [1.0.0] — 2026-06-09

### Security

- Rate-limit client keys on Vercel now trust only the edge-set `x-vercel-forwarded-for`; spoofable `x-real-ip` / `x-forwarded-for` fallbacks are honored only behind explicit `TRUST_PROXY_HEADERS=true`.
- CSP gains `form-action 'self'` and a pinned hash for the inline theme-init script; new `Cross-Origin-Opener-Policy: same-origin`; `Permissions-Policy` expanded to deny payment/usb/bluetooth/serial/idle-detection/screen-wake-lock/interest-cohort.
- Logo proxy forwards only the validated bare MIME type, never upstream `Content-Type` parameters.
- Security-header tests now pin the full CSP and verify the inline-script hash stays in sync with `index.html`.

### Added

- cmd+K global search modal with combobox ARIA semantics (`role="combobox"`, `aria-activedescendant`), keyboard navigation, lazy-loaded chunk.
- Asset detail drawer with provenance, source links, confidence, and 7D/30D/1Y historical charts (stocks/ETFs).
- Yahoo Finance v8 `/chart` endpoint as the primary keyless history provider for stocks and ETFs; Stooq CSV history retained as fallback. `AssetRef.supportsHistory` reflects per-entry capability.
- Portfolio Lab (local-only holdings, import/export JSON), watchlist persistence (`wap.pinned-markets.v1`), skeleton loading states, client last-known-good localStorage tier.
- Inline head script eliminates the dark-theme flash for light-mode users (hash-allowed under CSP).
- `FRANKFURTER_BASE_URL` is now read at runtime like the other provider overrides.

### Changed

- Live-computed market caps and AUM derived from price × share/unit baselines, with rankings auto-recomputed from current values.
- Equity quote pipeline batches Stooq with Yahoo Finance v7 quote fallback when Stooq is missing symbols; source disclosure carries `equityFundamentalsAsOf` and `valueSourceVersion`.
- 15 assets per category; NIGHT removed from the UI; Framer Motion removed (~40 KB gz) in favor of CSS + WAAPI.
- `react-dom` isolated into the `react-vendor` chunk so query-library upgrades no longer bust the React cache fingerprint.
- Data corrections (2026-06-09): SpaceX $1.77T (IPO pricing, lists June 12), Samsung $1.30T, gold $29.79T, Databricks Feb 2026 close metadata, Epic Games confidence lowered.

## [0.1.0] — 2026-03-10

### Added

- Full-stack reliability architecture with unified `GET /api/dashboard` API contract.
- Segment-level degradation metadata (`degradedSegments`, `segmentMeta`) and request IDs.
- Security hardening for logo proxy:
  - allowlisted hosts
  - payload-size limits
  - timeout controls
  - lightweight in-memory rate limiting.
- Hardened client error ingestion with schema validation, payload limits, and rate limiting.
- Structured operational logging and expanded health readiness checks.
- Route-level API test suite (`api/*.test.ts`) for dashboard, health, logo, and client-error routes.
- Additional unit tests for security and rate-limiting helpers.
- Expanded smoke E2E coverage for stale/degraded states and logo fallback behavior.
- Bundle-budget guard script (`npm run check:bundle`).
- ROADMAP.md listing planned features and improvements.

### Changed

- **Renamed project from Cryptoprice to World Asset Prices.** All user-visible text, HTTP headers (`X-Wap-*`), internal identifiers, cache keys, localStorage keys, and documentation updated. Existing watchlists are automatically migrated.
- CI workflow now enforces lint, typecheck, unit/integration tests, route tests, build, bundle budget, and E2E smoke checks.
- `npm run check` now runs the complete local validation gate sequence.
- README and contributing docs updated to reflect current architecture, contracts, and quality standards.
- Package metadata and keywords updated for clearer professional positioning.
- Preview images moved from repository root to `docs/` for a cleaner project structure.

[1.0.0]: https://github.com/coleyrockin/world-asset-prices/releases/tag/v1.0.0
[0.1.0]: https://github.com/coleyrockin/world-asset-prices/releases/tag/v0.1.0
