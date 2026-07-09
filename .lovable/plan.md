
# Mobile redesign — Energy cards (viewport < 768px)

Only presentation changes, scoped to `.pd-energy-module` on mobile. No data/logic edits.

## 1. Devices Consumption (stacked bar chart)

Problem: too many stacked bars crammed, X labels overlap the chart, legend spills outside the card.

- Full-width card (already), give it a **taller** dedicated mobile height: `min-height: 380px`, chart area `min-height: 300px`.
- **Force horizontal scroll** on the chart: wrap `<ZoomableChart>` in a `overflow-x-auto` div with `min-width: max(100%, ${data.length * 28}px)` so each bar gets ~28px and stays readable. Y axis stays fixed via a small trick: keep it inside the chart (the user swipes; acceptable, matches native pattern).
- Simplify X ticks on mobile: force `interval` to show ~5 labels, font 10px, no rotation (labels are short after scroll).
- Legend: move below chart, horizontal wrap, font 11px, colored dots 8px, `padding-top: 12px`, `max-height: 60px` scrollable if many categories.
- Bars: `maxBarSize={24}` on mobile.

## 2. Energy Consumption Breakdown (donut + legend)

Problem: total value (`4783`) overflows outside the donut ring.

- On mobile, stack vertically instead of `flex items-center gap-4`: donut on top **centered**, legend below full width.
- Donut size fixed and large: `w-44 h-44` centered with `mx-auto`.
- Center total text scaled to fit: main number `text-2xl` (was `text-xl`) but with `leading-none` and `px-4` padding safety; if number ≥ 4 digits, use `text-xl`. Add `whitespace-nowrap` + `tabular-nums`.
- Legend below: full-width rows, item font 13px, value 13px bold, min tap height 36px, no `max-w-[160px]` truncation (allow 2-line wrap).

## 3. Site Alerts

Problem: cramped, text tiny, hard to scan.

- Card padding `16px`, `min-height: 320px`, `max-height: none` (let it grow).
- Header 15px, actions icon 20px hitbox 36px.
- Each alert row: font 13px, icon 18px, timestamp on its own second line (12px muted), row padding `10px 4px`, separator `border-b border-gray-100`.

## 4. Sensor Health

Problem: donut + text competing in tiny box.

- Same stack pattern as Breakdown: donut centered `w-32 h-32` on top, KPI counters below in a 2-col grid (Healthy / Stale / Offline etc.), each cell font 13px value + 11px label.
- Card `min-height: 320px`, header 15px.

(Alerts + Sensor Health already stack vertically on mobile via existing rule; this plan enlarges them so they aren't "half-empty and squeezed".)

## 5. Actual vs Average (composed line/area chart)

Problem: 4 series (Peer Range band, Peer Average, Benchmark, Actual) overlap → unreadable.

- On mobile, hide the two low-signal series: `Peer Range` band and `Benchmark` line rendered only when `!isMobileView`. Keep only **Actual** (teal) + **Peer Average** (gray) → the story stays intact, visual noise drops ~60%.
- Chart height `min-height: 280px`.
- Move the "You are X% above/below average" badge **below** the title (own line, full width), font 12px, so header doesn't wrap.
- Legend: bottom, 2 items, font 12px.
- X-axis: `interval="preserveStartEnd"`, max 4 ticks, font 10px.
- Thicker Actual line (`strokeWidth={3.5}`), larger dots on active only.

## Files touched

- `src/components/dashboard/ProjectDetail.tsx`
  - Read `isMobileView` (already available) inside Slide 3 render.
  - Devices Consumption: wrap chart in scroll container with dynamic `minWidth`; conditionally set X `interval`, bar size, legend props.
  - Energy Consumption Breakdown (Power Consumption card ~line 4413): mobile-only class swap `flex-col` + centered donut + full-width legend list without max-width truncation; dynamic font-size for center label based on digit count.
  - Actual vs Average: conditionally render `<Area name="Peer Range">` and `<Line name="Benchmark">` only when `!isMobileView`; move badge under title on mobile.
  - Site Alerts / Sensor Health wrappers (Slide 2 lines 4095-4117): remove `grid-rows-2` cap; already handled but enlarge inner content.

- `src/index.css` — additional `@media (max-width: 767px)` rules under `.pd-energy-module`:
  - Larger card min-heights (Alerts/Sensor Health 320px, Devices 380px).
  - `.pd-energy-module .pd-energy-legend-mobile` full-width flex-wrap legend styles.
  - Larger tap targets and font sizes for alerts/sensor rows.
  - Remove `max-height: 240px` cap added earlier that made cards look "half-empty".

## Out of scope

- Heatmap (already redone).
- Energy Periods table (already compacted).
- Slides 4+ (Carbon Footprint etc.).
- Air / Water modules.
- Any data-fetching or hook changes.

## Verification

- `tsgo --noEmit`.
- Playwright at 390×844: screenshot Slides 2 and 3 of Energy module; visually confirm no overflow, donut center fits, only 2 lines on Actual vs Average, bar chart scrollable with readable bars.
