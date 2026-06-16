## Problem

The Energy Periods card (and the other "estimated cost" widgets in ProjectDetail) still render values in EUR even after the user saves a different currency (e.g. USD) in Project Settings.

Two combined causes:

1. **Stale `project` prop.** `selectedProject` in `src/pages/Index.tsx` is captured at click time. When the user saves a new currency from the settings dialog, the `sites` React Query is invalidated, but the `selectedProject` state held by `Index.tsx` is not rebuilt — so `project.currency` keeps the value it had when the project was opened (typically `'EUR'`).
2. **`Money` display falls back to source.** All 5 monetary `<Money>` instances in `ProjectDetail.tsx` use `display={isSupportedCurrency(project?.currency) ? project?.currency : 'EUR'}`. With the stale prop, the resolved display currency stays EUR, so no FX conversion is applied and the € symbol is rendered.

## Fix

Use the live, query-backed currency rather than the prop snapshot. The hook `useSiteCurrency(siteId)` already exists (`src/hooks/useSiteCurrency.ts`) and shares the same `['site-currency', siteId]` cache that the settings dialog invalidates on save — so it auto-updates the moment the user saves a new currency.

### Edits — `src/components/dashboard/ProjectDetail.tsx`

1. Import the hook:
   ```ts
   import { useSiteCurrency } from '@/hooks/useSiteCurrency';
   ```
2. Inside the `ProjectDetail` component, resolve the live currency once:
   ```ts
   const displayCurrency = useSiteCurrency(project?.siteId);
   ```
3. Replace every occurrence of
   `display={isSupportedCurrency(project?.currency) ? project?.currency : 'EUR'}`
   with
   `display={displayCurrency}`
   (5 locations: lines ~3818, 3825, 3960, 3980, 5142, 5147 — including the
   `getCurrencySymbol(...)` call used to render the `Consumption × $0.xxx/kWh`
   subtitle).

No other files are touched. Money already handles conversion EUR → display via `CurrencyContext.format()` once `display` is a different supported currency.

## Verification

- Open a site, change currency to USD in Project Settings → Save.
- Energy Periods PRICE column re-renders as `$X.XX` immediately (no reload).
- Estimated Cost card subtitle shows `Consumption × $0.xxx/kWh`.
- Switching back to EUR restores `€` formatting without reopening the dashboard.

## Out of scope

- Currency on cards outside `ProjectDetail.tsx` (Wrapped slides, PDF report) — not mentioned by the user and already handled separately by `CurrencyContext`/`wrappedMath`.
- Backfilling old EUR-based historical prices; we only re-display and FX-convert.
