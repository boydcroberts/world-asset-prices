# Component: AssetDetailDrawer

`src/components/AssetDetailDrawer.tsx`

## Description
The modal detail view for a single asset: headline metrics, a selectable
historical price chart (7D / 30D / 1Y), and full data provenance (provider,
source, confidence, method, source link, alternates, limitations). Opened from
an interactive [MarketCard](./MarketCard.md) and **code-split** (`React.lazy`) —
it ships in its own chunk and only loads after the first card click.

Renders as a right-side drawer on desktop and a bottom sheet on mobile.

## Variants
Single variant (a modal dialog). Its *content* is driven by request state
(loading / error / loaded) and the selected `range`.

## Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `detail` | `AssetDetailPayload \| undefined` | — | Loaded payload (quote, history, provenance). |
| `isLoading` | `boolean` | — | Shows the loading line. |
| `error` | `Error \| null` | — | Shows the unavailable message. |
| `range` | `HistoricalRange` | — | Active range; one of `7D` / `30D` / `1Y`. |
| `onRangeChange` | `(range) => void` | — | Fired by the range buttons. |
| `onClose` | `() => void` | — | Fired by the close button or overlay click. |
| `logoUrl` / `fallbackLogoUrls` | `string?` / `string[]?` | `null` / `[]` | Threaded from the triggering card so the logo shows instantly. |

## States
| State | Visual | Behavior |
|-------|--------|----------|
| Loading | "Loading detail and provenance…" | While the asset-detail request is in flight |
| Error | "Asset detail is unavailable right now." | On request failure |
| Loaded | Metrics + chart + provenance | Chart renders only if `history.available`, else a reason line |
| Range active | Selected range button filled | `aria-pressed`; calls `onRangeChange` |
| Open (mount) | Drawer/sheet slides in | Focus moves to close button; background scroll locked |

## Accessibility
- **Role**: `dialog` with `aria-modal="true"` and `aria-labelledby="asset-detail-title"`.
- **Focus**: on open, focus moves to the close button; **Tab is trapped** within the drawer and **restored to the trigger** on close.
- **Scroll**: `document.body` overflow is locked while mounted (prevents the page behind the mobile sheet from scrolling/rubber-banding).
- **Range row**: wrapped in `role="group" aria-label="History range"`.
- **Close**: `Escape` (global handler in `App.tsx` while an asset is selected), the close button (`aria-label="Close asset detail"`), or clicking the overlay backdrop. The drawer's own `keydown` listener handles only the Tab trap.

## Do's and Don'ts
| ✅ Do | ❌ Don't |
|------|---------|
| Keep it lazy-loaded behind a selection | Static-import it (re-bloats the initial chunk) |
| Pass the card's `logoUrl` through | Refetch the logo from scratch |
| Render only when an asset is selected | Keep it mounted with `display:none` (breaks scroll-lock/focus) |

## Code Example
```tsx
{selectedAssetId ? (
  <Suspense fallback={null}>
    <AssetDetailDrawer
      detail={detail}
      isLoading={isLoading}
      error={error}
      range={range}
      onRangeChange={setRange}
      onClose={() => setSelectedAssetId(null)}
      logoUrl={selected?.logoUrl}
      fallbackLogoUrls={selected?.fallbackLogoUrls}
    />
  </Suspense>
) : null}
```
