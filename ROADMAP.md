# World Asset Prices — Roadmap

**Status: Production-stable** · Last updated: 2026-06-09 · Stack: React 19 + TS 5.9 + Vite 7 + Tailwind v4

---

## Now

These are the highest-confidence, lowest-risk improvements to tackle next.

### SpaceX reclassification (time-critical)
SpaceX lists on Nasdaq June 12, 2026 (IPO priced at $135/share, ~$1.77T — curated mark updated 2026-06-09). Once trading begins: move it from `topPrivateCompanies` to a live-quoted stock entry, drop the curated private mark, and update `audit-data.mjs` / `verify-production.mjs` pins.

### Crypto curation
The live Coinpaprika top-15 includes STETH and WBTC, which are synthetic wrappers of ETH and BTC already in the list. They inflate the crypto section with duplicates. Plan: filter STETH and WBTC; replace with two of (ADA, AVAX, LINK, DOT, SUI). Keep stablecoins (USDT, USDC) — they have a legitimate market cap story and deserve their own category label.

### Samsung deep-verify
Corrected to $1.30T on 2026-06-09 (CompaniesMarketCap / StockAnalysis consensus). The deeper fix stands: derive it from actual share counts for common (005930.KS) and preferred (005935.KS) × live KRW price × live KRW/USD rate instead of trusting aggregators.

---

## Next

These require more work but are clear in direction.

### Historical chart in detail drawer
The drawer shows static metadata. Adding a 7D/30D/1Y sparkline chart would make it genuinely useful. Data is available: CoinPaprika has OHLCV for crypto, Stooq has it for stocks (already fetched for equities via Yahoo v8). Render as SVG line — same pattern as card sparklines, larger.

### Market breadth per section
"12 of 15 up today" in each section header. Crypto already has 24h change via CoinPaprika. Stocks need delta from prior close. Shows users at a glance which categories are advancing without opening individual cards.

### Section collapse / expand
Power users want to focus on specific asset classes. Add a collapse toggle to each section header; persist state to `localStorage`. CSS `grid-template-rows` animation for smooth collapse.

### Tab-visibility polling pause
`useQuery`'s 30-second refetch runs even when the tab is backgrounded. Wastes Vercel Function invocations and mobile battery. Wire a `visibilitychange` listener to pause refetch when `document.hidden === true`.

---

## Later

These are real features but not blocking anything.

### Shareable asset URLs
`/?asset=BTC` — deep link that opens a specific card's detail drawer on load. Shareable, SEO-friendly. URL state synced bidirectionally with drawer open/close.

### Commodity section expansion
Add WTI Crude Oil, Natural Gas, Copper, Platinum, Palladium as a proper commodity category. Requires curated market-cap methodology (estimated above-ground supply × spot price) and a live price source.

### Public data API
`/api/v1/assets` — expose the curated dashboard payload publicly with docs. Turns WAP into a product with downstream users rather than a display-only layer.

### PWA / offline
Service worker serving stale fallback data when offline. App install prompt. The 3-tier fallback data model already supports this — it's mostly a service worker registration and manifest.

### Alerts
Browser Notification API: alert when BTC moves >5% in 24h. Permission-gated; preferences in localStorage.

---

## Won't Build

Explicit decisions — not on the table.

| Decision | Why |
|---|---|
| **NIGHT in the UI** | Removed. Server API contract preserved for backward compat, but it will never return to the dashboard display. |
| **Paid API key requirement** | The entire value proposition is no-key. Any feature that requires a key for basic function is out. |
| **Real-time streaming prices** | WebSocket infrastructure doesn't justify the cost for a dashboard that refreshes every 30s. |
| **User accounts / auth** | Portfolio data stays local. Cross-device sync via anonymous KV session is fine; full auth is out of scope. |
| **Framer Motion** | Removed for ~40KB gz. All animation stays CSS + WAAPI. Not re-adding it. |

---

## Shipped

| Date | What |
|---|---|
| 2026-06-09 | Full audit pass: security hardening (spoof-proof rate-limit keys, CSP `form-action` + hashed theme script, COOP, expanded Permissions-Policy), data corrections (SpaceX $1.77T IPO mark, Samsung $1.30T, gold $29.79T), theme FOUC fix, combobox a11y on search modal, react-vendor chunk isolation |
| 2026-06-08 | Watchlist persistence (`wap.pinned-markets.v1`), skeleton loading states, client last-known-good localStorage tier |
| 2026-06-07 | cmd+K global search modal — fuzzy match across all 90+ assets, keyboard navigation, lazy-loaded |
| 2026-06-07 | ETF AUM corrections: QQQ +11%, VEA +49%, IEFA +24%, VWO +9%, IWF +21%; full re-sort + re-rank |
| 2026-06-03 | Audit pipeline enforces ETF sort order, private review age, value pins, sourceType consistency |
| 2026-06-03 | Film-grain atmosphere, edge vignette, hero bloom refinement, glass light-catch, stat-tile hover lift |
| 2026-05-29 | Framer Motion removed (~40KB gz saved); CSS entrance animations + WAAPI pulse + rAF tilt replace it |
| 2026-05-29 | NIGHT removed from UI; server contract preserved |
| 2026-05-29 | 15 assets per category (up from 10) |
| 2026-05-29 | Asset detail drawer: provenance, source links, verified-as-of, confidence, historical charts (stocks/ETFs) |
| 2026-05-29 | 3-tier fallback: live → durable KV → bundled JSON; per-segment freshness badges |
| 2026-05-29 | Portfolio Lab: local-only, import/export JSON, unrealized P&L |
| 2026-05-29 | IPv6 SSRF hardening, 429/Retry-After bounds, reader leak fix, rate limiter, security headers |
| 2026-05-29 | Daily-refresh bot auto-heals `dashboard-fallback.json` (bot-owned, zero push conflicts) |

---

## Invariants

Never touch these regardless of what ships:

- `dashboard-fallback.json` is bot-owned — edits only via explicit data commits, never incidental
- NIGHT stays out of the UI — server contract only
- Push discipline: always `git fetch && rebase origin/main` before push (bot commits daily)
- Bundle: total JS under 520 KB raw, 420 KB per file (`npm run check:bundle`)
- `npm run check` must be green before every push
- API payload fields: additive only; removals require a version bump
- localStorage keys: `wap.portfolio.v1`, `wap.pinned-markets.v1`, `wap.prefs.v1` — changing breaks existing user data
