## Scope — Slide 2 of Energy dashboard on mobile

Four cards on the second slide of the Energy module (visible when swiping past the KPI/donut slide):

1. **Site Alerts**
2. **Sensor Health**
3. **Energy Periods** (pivot table)
4. **Energy Consumption Heatmap** (24h × N days)

All work is presentation-only, scoped to `.pd-energy-module` so nothing else changes. No data/logic changes to hooks or SQL — the heatmap "3h aggregation" is a mobile-only render collapse of the existing `heatmapGrid` cells.

## Changes

### 1. `src/index.css` — mobile rules under `@media (max-width: 767px)`, all scoped to `.pd-energy-module`

- **Slide 2 layout**: force the outer `grid grid-cols-1 lg:grid-cols-2` into a single column (already 1 col on mobile — verify) and change the left `grid-rows-2 xl:grid-rows-1 xl:grid-cols-2` for Alerts/Sensor into `grid-rows-1 grid-cols-1` with `min-h-[280px]` instead of 400 so cards aren't half-empty.
- **Card padding**: reduce `p-6` → `12px` inside these cards.
- **Site Alerts card**: shrink header title to `15px`, alert row text to `12px`, chevron/icon size to `14px`; cap card height to `260px` with internal scroll.
- **Sensor Health card**: shrink donut / score number to fit; title to `13px`; cap card height to `260px`.
- **Energy Periods table**:
  - Font `11px`, cell padding `6px 8px`.
  - Sticky `<thead>` (already `sticky top-0`) — ensure `z-10` works with `-webkit-sticky` on iOS.
  - Money column: force `tabular-nums` + `whitespace-nowrap` + `font-size: 10.5px` so €-strings don't wrap.
  - Year `<select>` + Export buttons: allow header to wrap (`flex-wrap`) and shrink select to `text-[11px]`.
  - Cap table container to `maxHeight: 260px` on mobile.
- **Energy Consumption Heatmap**:
  - Legend row (Low ▮▮▮▮▮ High + Export): wrap under the title (`flex-wrap`, `gap: 6px`), font `9px`.
  - Row-label column width `w-12` → `36px`, font `9px`.
  - Cell `min-width: 24px` → `18px`, height `h-6` → `14px`, spacing `mx-[1px]` kept.
  - Tooltip: switch from CSS `group-hover` (unusable on touch) to touch-friendly display — on mobile, tap-to-show via a small state ref, OR (simpler) show the value inside the cell for the currently focused column header. We'll go with: **tap a cell → shows a compact toast-style tooltip anchored above the cell** using a lightweight `useState` for `selectedCell` (rendered only when < 768px).
  - **3h aggregation on mobile (hourly view only)**: derive a mobile grid at render time from `heatmapGrid` — collapse rows into 8 buckets (00–03, 03–06, …, 21–24) by summing values per column. Applied only when `useIsMobile()` and `!heatmapGrid.isYearView`. Year (daily) view is unchanged. Row labels become `00–03`, `03–06`, etc. Cell height on mobile bumps to `28px` since only 8 rows.
  - Keep horizontal scroll for many days; add scroll-snap and hide the scrollbar (already done for `.overflow-x-auto` in the module).

### 2. `src/components/dashboard/ProjectDetail.tsx` — heatmap render only

- Add `const isMobileView = useIsMobile();` near the other slide-2 state (import if not already).
- Add a derived `heatmapGridMobile` `useMemo` that, when `isMobileView && !heatmapGrid.isYearView`, returns `{ rows: [0,3,6,9,12,15,18,21], cols, valueMap: <collapsed>, scale, isYearView:false, is3h:true }` — summing 3 source rows per bucket per column. Otherwise returns `heatmapGrid` unchanged.
- Use `heatmapGridMobile` in the JSX at lines ~4200–4246.
- Row label: if `is3h`, render `${String(row).padStart(2,'0')}–${String((row+3)%24).padStart(2,'0')}`.
- Add tap-to-tooltip state `[tappedCell, setTappedCell] = useState<string | null>(null)` and swap the `hidden group-hover:block` classes so on mobile the tooltip shows when `tappedCell === key`, on desktop keeps hover behavior. Auto-dismiss on outside tap via a `useEffect` listener.

### 3. What we explicitly do NOT change

- No hook/data changes. `useEnergyTimeseries` still fetches hourly buckets; 3h collapse is purely visual.
- No changes to Air/Water heatmap (`AirHeatmap`) — separate task.
- Overview cards, desktop layout, and all other dashboards untouched.

## Verification

After edits: `tsgo --noEmit`, then Playwright at 390×844 to screenshot slide 2 of the Energy module and confirm:
- Alerts + Sensor Health stacked, cards not empty.
- Energy Periods table readable, no horizontal overflow of the card, prices not wrapping.
- Heatmap shows 8 rows × N days, tap a cell shows tooltip with the summed kWh, hour labels readable.