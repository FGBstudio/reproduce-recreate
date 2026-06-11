## Goal
The "Download weekly PDF" generated from the site Wrapped recap slide currently shows fewer/inconsistent KPIs than the on-screen card. Make the PDF a faithful, well-formatted mirror of the slide so values, labels and breakdowns match.

## Discrepancies today (slide vs PDF)
| Block | Slide | PDF now |
|---|---|---|
| Header | Site name + week range, "FGB Wrapped" badge | Same ✓ |
| Energy KPI | `753 kWh`, `+58.6% vs baseline` | `kWh` but `vs last week` label |
| CO₂ KPI | Dynamic: "CO₂ saved" *or* "CO₂ emitted" (colour amber when emitted), trees/yr | Always "CO₂ saved", uses `savedKg` only → renders `— kg` when no saving |
| Air KPI | `654 ppm`, `3 excellent days` | Same ✓ |
| Alerts KPI | `5 active alerts`, `20 resolved` | `activeNow` + `resolved this week` ✓ but label inconsistent |
| Daily table | Day · kWh · CO₂ (kg) for each day with data | Missing entirely |
| Footer caption | "Need the deep-dive? Use the full report generator." | Missing |

## Changes (single file: `src/components/wrapped/lib/wrappedPdf.ts`)

1. **`generateSitePdf` — rewrite the body** so each KPI card mirrors `SlideRecap`:
   - Energy card → value `formatKwh(energy.weekKwh)`, sub-label `±X% vs baseline` (green when ≤0, red otherwise).
   - CO₂ card → same conditional as slide: if `co2.savedKg > 0` show "CO₂ saved" in teal with `≈ N trees/yr`; otherwise show "CO₂ emitted" with `co2.weekKg` in amber, hide trees line or show `—`.
   - Air card → ppm value + `N excellent days` sub-label.
   - Alerts card → `activeNow` as value (red), label "Active alerts", sub-label `N resolved this week`.

2. **Add a daily breakdown table** below the KPI grid, identical to the slide's `wr-recap-table`:
   - Columns: Day (e.g. `Mon 06-08`) · kWh · CO₂ kg (`kwh * 0.233`).
   - Source: `data.energy.daily` filtered to entries with `kwh != null`.
   - Render only if at least one day has data.

3. **Add closing caption line** ("Need the deep-dive? Use the full report generator.") under the table for parity with the slide footer.

4. **Light CSS additions** in `baseCss`: small `.note` style for the caption; ensure table styling already in `baseCss` is reused (already present). Add colour helpers `.amber {color:#c97a14}` / `.teal {color:#00614A}` / `.red {color:#b3261e}` / `.green {color:#1b7a3a}` so KPI values and deltas pick up the same colour semantics as the slide.

5. Keep `generateAggregatePdf` and `generateGlobalPdf` untouched (out of scope).

## Out of scope
- No changes to the slide itself, data hooks, or other PDF variants.
- No new dependencies; still uses `window.open` + `window.print`.
