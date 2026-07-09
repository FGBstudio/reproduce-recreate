# Ottimizzazione mobile — Energy & Air (retrofit reale)

Le regole CSS globali `.pd-root @media (max-width:767px)` da sole non bastano: i widget di Energy/Air hanno margini interni Recharts, toolbar affollate e tabelle wide con `min-w-[900px]` che ignorano il breakpoint. Serve un retrofit mirato sui componenti.

## Cosa cambia (solo presentazione, nessuna logica dati)

### 1. Nuovo wrapper `ResponsiveChart` (`src/components/dashboard/ResponsiveChart.tsx`)
- Rileva mobile via `useIsMobile`.
- Rende `ResponsiveContainer` con `height` mobile (220) vs desktop (prop originale).
- Espone `mobileMargins` (top:8, right:8, left:-16, bottom:0) e `tickFont` (10) da passare ad Axis/Legend.
- Nasconde legenda inline su mobile, la sostituisce con una `<ul>` compatta sotto al grafico (chip colorati + label + valore corrente).

### 2. Energy (`ProjectDetail.tsx`, sezioni ~4380–4620, 6287–6470)
- **KPI header cards** (grid 4/5 colonne): su mobile forziamo 2 colonne + card 84px, numero 22px, label 10px.
- **Toolbar range/categoria** sopra ai grafici: su mobile diventa `flex-wrap` con chip 28px altezza; default range passa da 30g → 7g solo su mobile.
- **Device Consumption BarChart** (6287): categorie ruotate 0°, mostra top 5 su mobile con "vedi tutti" (accordion), asse Y nascosto, valori sopra le barre.
- **Pie/Donut breakdown** (3941, 4389, 4612, 6390): su mobile diventano **barre orizzontali** (component `HBarBreakdown` inline) — Pie su schermo piccolo è illeggibile.
- **Day/Night e Carbon BarChart**: `barCategoryGap` ridotto, X tick ogni 2, legenda spostata sotto in chip.
- **EnergyWeatherCorrelation** e line charts: margini compatti, 3 tick su Y, X con formatter breve (`d/M`).

### 3. Air (`ProjectDetail.tsx` 4891–5159 + `AirCustomComponents.tsx`)
- **Mini metric cards CO/O₃/PM/CO₂/TVOC/Temp/Hum**: griglia 2×2 fissa su mobile, altezza 96px, numero 24px, unità 9px, barra 4px.
- **Building overview**: su mobile la `<table min-w-[900px]>` diventa `<ul>` — una card per device con:
  - riga 1: nome device
  - riga 2: 4 pill (Temp, Hum, CO₂, PM2.5) con valore + pallino colore
  - "vedi altri" espande le rimanenti metriche.
  Cambio interno a `BuildingOverview` con branch `isMobile`.
- **Air Heatmap**: mantiene scroll orizzontale, ma celle 20px, header sticky, label ore ogni 3.
- **Line charts CO2/TVOC/PM/T-H**: usano `ResponsiveChart`, legenda sotto in chip; tooltip compatto.

### 4. Alerts / Sensor Health (già stackate via CSS globale)
- Convertite a **collapsible** su mobile: header cliccabile + `chevron`, chiuse di default. Wrapper `<details>` con styling coerente.

### 5. Test
- `tsgo --noEmit`.
- Playwright a viewport 390×844: screenshot delle 3 sezioni (Overview, Energy, Air) prima/dopo, confronto visuale.

## Fuori scope
- Login, mappa, admin, dashboard desktop, calcoli/KPI, sorgenti dati.
- Nessuna modifica a hook, query, schemi.

## Ordine di esecuzione
1. `ResponsiveChart.tsx` + utility legend chip.
2. Retrofit Energy (top → giù nella sezione).
3. Retrofit Air (mini-cards + BuildingOverview mobile branch + line charts).
4. Collapsible Alerts/Sensor Health.
5. Verifica Playwright mobile viewport.
