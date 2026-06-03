# Component: MarketCard

`src/components/MarketCard.tsx`

## Description
The primary data tile for every market section (crypto, stocks, ETFs, FX,
commodities, private companies). Renders rank, name/symbol, logo, a primary
value, optional secondary line, and an optional sparkline. It is `memo`-ized —
the 1s clock ticker does **not** re-render cards; only a changed prop does.

Use it for any "ranked asset at a glance" row. For the expanded view (history
chart + provenance), the card's `onSelect` opens the [AssetDetailDrawer](./AssetDetailDrawer.md).

## Variants
| Variant | `interactive` | Use when |
|---------|---------------|----------|
| Interactive | `true` | Card opens a detail dialog on click/Enter/Space. Renders `<article role="button">` with hover tilt + entrance fade. |
| Static | `false` (default) | Display-only (e.g. commodities with no detail). Plain `<article>`, no tilt/handlers. |
| Asset style | `assetStyle` | Adds `.asset-card` styling for the unified "Global Assets" grid. Composable with either variant. |

## Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | — | Stable asset id; passed back by all callbacks. |
| `rank` | `number` | — | Displayed `#rank`. |
| `name` / `symbol` | `string` | — | Title + ticker pill. |
| `meta` | `string` | — | Category label (drives `data-category` color). |
| `value` | `string` | — | Pre-formatted primary value; pulses green on change. |
| `valueLabel` | `string?` | — | Small label above the value. |
| `secondary` / `secondaryClassName` | `string?` | — | Optional second line + its class (e.g. trend color). |
| `index` | `number` | — | Position; sets `--card-index` for the staggered entrance. |
| `logoUrl` / `fallbackLogoUrls` | `string?` / `string[]?` | — | Threaded to `LogoMark` (monogram fallback). |
| `interactive` | `boolean` | `false` | Enables dialog-opening behavior + tilt. |
| `active` | `boolean` | `false` | Marks the currently-open card (`.active`). |
| `onSelect` | `(id) => void` | — | Fired on click / Enter / Space. |
| `pinned` / `onTogglePin` | `boolean` / `(id)=>void` | — | Watchlist pin chip (rendered only if handler given). |
| `compared` / `onToggleCompare` | `boolean` / `(id)=>void` | — | Compare chip (rendered only if handler given). |
| `sparkline` | `number[]?` | — | ≥2 points → inline memoized SVG sparkline. |
| `priceTitle` / `secondaryTitle` | `string?` | — | Native `title` tooltips. |

## States
| State | Visual | Behavior |
|-------|--------|----------|
| Default | Glass card, top-edge light-catch | — |
| Hover (interactive) | Pointer 3D tilt + section-themed glow + lift shadow | `useTilt` writes inline transform (rAF-throttled; off on touch / reduced-motion) |
| Focus-visible | Accent outline + same glow | Keyboard reachable (`tabIndex=0`) |
| Active | Cyan inset top border | Reflects the open asset |
| Value change | 0.6s green background pulse | Web Animations API (no reflow; skipped under reduced-motion) |
| Chip active | `pinned`/`compared` → filled chip | `aria-pressed`, `stopPropagation` so it doesn't open the dialog |

## Accessibility
- **Role**: interactive → `button` with `aria-haspopup="dialog"` + `aria-label="Show {name} details"`. Static → plain `article`.
- **Keyboard**: `Tab` to focus; `Enter`/`Space` call `onSelect` (default-prevented). Chips are real `<button>`s in the tab order with their own `aria-label`.
- **Screen reader**: announced as a button that opens a dialog; sparkline is `aria-hidden` (decorative).

## Do's and Don'ts
| ✅ Do | ❌ Don't |
|------|---------|
| Pre-format `value`/`secondary` before passing in | Pass raw numbers and format inside the card |
| Set `interactive` only when an `onSelect` detail exists | Make display-only tiles focusable |
| Give a stable `id` + correct `index` | Reuse `index` across sections (breaks stagger) |

## Code Example
```tsx
<MarketCard
  id={asset.id} rank={i + 1} index={i}
  name={asset.name} symbol={asset.symbol} meta="Crypto"
  value={formatCurrency(asset.marketCapUsd)} valueLabel="Market cap"
  secondary={formatPercent(asset.change24h)} secondaryClassName={trendClass(asset.change24h)}
  logoUrl={asset.logoUrl} fallbackLogoUrls={asset.fallbackLogoUrls}
  sparkline={asset.sparkline7d}
  interactive active={asset.id === selectedAssetId}
  onSelect={setSelectedAssetId}
  pinned={isPinned(asset.id)} onTogglePin={togglePin}
/>
```
