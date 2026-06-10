## Problem

La modalità chiara è di fatto **non implementata**: la classe `.light` viene applicata su `<html>` dal `ThemeContext` ma in `src/index.css` esistono solo i token per `:root` (dark) e `.dark`. Risultato: in Light Mode i token CSS restano scuri, mentre la mappa CARTO mostra tile chiare → il testo bianco dei pannelli glass diventa invisibile su sfondo bianco. In più ~45 componenti usano classi hardcoded (`text-white`, `bg-white/10`, `text-gray-300`…) che restano bianche anche se i token cambiassero.

## Strategy

Approccio "token-first": definire un set completo di token Light, far seguire le utility glass/scrollbar/landscape, e sostituire negli hotspot le classi hardcoded con token semantici. La Dark Mode resta intatta (continua a vivere su `:root` + `.dark`).

## Steps

### 1. Definire i token Light in `src/index.css`
Aggiungere un blocco `.light { … }` con:
- `--background` bianco caldo (es. `0 0% 100%`), `--foreground` navy (`200 100% 11%`).
- `--card`, `--popover`: bianco; relative `*-foreground` navy.
- `--primary` resta gold ma `--primary-foreground` diventa bianco (per buttons gold).
- `--secondary` teal chiaro (`188 60% 92%`), foreground navy.
- `--muted` grigio chiarissimo, `--muted-foreground` `215 16% 35%` (AA su bianco).
- `--border` / `--input`: `200 20% 88%` (solidi, non opacità su bianco).
- `--destructive` invariato; `--ring` gold.
- Sidebar tokens speculari (bianco + navy).
- **Glass / surface**: `--fgb-glass: 0 0% 100% / 0.85`, `--fgb-surface: 200 30% 95% / 0.9` con border `200 25% 80% / 0.6`.
- **Lens tokens**: già pensati per superfici chiare → solo allineare `--lens-shadow` e `--lens-ring-track`.
- **Heatmap**: lasciare invariata (la scala funziona su entrambi i temi).

### 2. Override delle utility glass
Nello stesso file, dopo le definizioni base:
```css
.light .glass-panel { background: hsl(var(--fgb-surface)); border-color: hsl(200 25% 80% / .6); box-shadow: 0 8px 32px hsl(200 50% 20% / .12); color: hsl(var(--foreground)); }
.light .glass-card  { background: linear-gradient(135deg, hsl(0 0% 100% / .9), hsl(200 30% 96% / .8)); border-color: hsl(200 25% 80% / .6); color: hsl(var(--foreground)); }
```
Più override per scrollbar (thumb gold rimane) e landscape overlay (`background: hsl(var(--background))` già token-based: nessuna modifica).

### 3. Map tiles dinamiche
In `src/components/dashboard/MapView.tsx` selezionare la tile CARTO in base a `useTheme()`:
- Dark → `dark_all` (attuale).
- Light → `light_all` o `voyager` (così il pannello scuro/chiaro ha sempre contrasto sufficiente).

### 4. Sostituire hardcoded color classes negli hotspot
Per ciascuno dei file con più di 25 occorrenze (ProjectDetail, DemoDashboards, OverviewSection, BillAnalysisModule, Auth, AirCustomComponents, BrandOverlay, LEEDCertificationWidget, EnergyWeatherCorrelation, FloatingBentoPanel, RegionOverlay, DashboardSkeleton, Admin) applicare le sostituzioni standard:
- `text-white` → `text-foreground`
- `text-white/70|80|90` → `text-muted-foreground` (o `text-foreground/80`)
- `bg-white/5|10|20` → `bg-card/60` o `bg-muted/40`
- `bg-black/30|50` → `bg-background/80`
- `text-gray-300|400` → `text-muted-foreground`
- `border-white/10|20` → `border-border`
- Eccezioni: testi sopra immagini scure o overlay sempre-scuri (es. SiteMarker tooltip su mappa) restano `text-white` se il loro container ha bg fisso scuro.

Per i file restanti (≤10 occorrenze) batch sostituzione mirata; revisione visiva successiva.

### 5. Componenti con sfondo fisso scuro
`WrappedPlayer`, `MobileBurgerMenu` (overlay scuri intenzionali), `RegionNav` chip selezionato: forzare `bg-[hsl(var(--fgb-base))] text-white` (non token) per restare leggibili anche in Light. Marcare come "always-dark surface".

### 6. Verifica
- Toggle dark/light dal `UserAccountDropdown`, navigare Map → BrandOverlay → ProjectDetail (Overview, Energy, Air, Reports) → Admin → Auth.
- Screenshot di confronto e check di:
  - Pannello "Regional Performance" leggibile sopra la mappa light.
  - Form Auth (input/placeholder/button) contrasto AA.
  - Tabelle Admin con header e righe distinguibili.
  - Tooltip Recharts e legenda.
  - Tile mappa coerenti col tema.
- Nessuna regressione visibile in Dark Mode.

## Files coinvolti (stimati)

```
src/index.css                              (+ ~70 righe: token .light + override glass)
src/components/dashboard/MapView.tsx       (tile URL dinamica)
src/components/dashboard/ProjectDetail.tsx
src/components/dashboard/OverviewSection.tsx
src/components/dashboard/BrandOverlay.tsx
src/components/dashboard/RegionOverlay.tsx
src/components/dashboard/RegionNav.tsx
src/components/dashboard/MobileKpiPanel.tsx
src/components/dashboard/MobileBurgerMenu.tsx
src/components/dashboard/UserAccountDropdown.tsx
src/components/dashboard/SiteAlertsWidget.tsx
src/components/dashboard/TimePeriodSelector.tsx
src/components/dashboard/LEEDCertificationWidget.tsx
src/components/dashboard/EnergyWeatherCorrelation.tsx
src/components/dashboard/AirCustomComponents.tsx
src/components/dashboard/BillAnalysisModule.tsx
src/components/dashboard/DashboardSkeleton.tsx
src/components/modules/DemoDashboards.tsx
src/components/auth/FloatingBentoPanel.tsx
src/pages/Auth.tsx
src/pages/Admin.tsx
(+ pochi minori secondo audit grep)
```

## Out of scope

- Redesign visivo della Light Mode (resta funzionalmente equivalente alla Dark, sfondi bianchi al posto di navy).
- Refactor del Wrapped Player (resta scuro intenzionalmente — overlay cinematografico).
- Riprogettazione della heatmap o del modulo PDF (i PDF restano col loro stile dedicato).
