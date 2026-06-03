## Espandere il Wrapped: slide fedeli all'HTML + variant per i 3 casi

### 1. Caso A — Mono-sito (fedele al file HTML `fgb-wrapped-v3-5-2.html`)

Riporto le 10 slide del file HTML (S1-S10), adattate alla cadenza **settimanale** (richiesta utente) e ai dati reali presenti in `useSiteWeeklyWrap`. Ogni slide è **skippata** se i dati telemetrici sottostanti non esistono (policy "no fake data").

Nuovi file in `src/components/wrapped/slides/`:

| # | File | Skip condition | Note |
|---|------|----------------|------|
| S1 | `SlideWelcome.tsx` *(già esiste, da rifinire per matchare l'HTML)* | mai | weekly label + nome sito |
| S2 | `SlideScore.tsx` | mai (sempre calcolabile) | ring SVG con overall score (80% energy + 15% water + 5% air). Trend mini-bars settimanali se disponibili, altrimenti solo ring |
| S3 | `SlideEnergy.tsx` *(già esiste)* | `energy.weekKwh == null` | stat principale + barre giornaliere (mantengo 7 giorni invece dei 4 weekly del mock) + compare bar settimana corrente vs precedente |
| S4 | `SlideAir.tsx` | `air.avgCo2Ppm == null` | stat ppm + comparison bars (Yours / WELL 800 / Outdoor 420 / ASHRAE 1000) |
| S5 | `SlideAlerts.tsx` | `alerts.activeNow == 0 && alerts.resolvedThisWeek == 0` | stat count + breakdown Active vs Resolved. Salto la lista per-alert con response time (dato non disponibile) |
| S6 | `SlideBenchmark.tsx` | sempre skip in Caso A (richiede peer data non disponibile per singolo sito) | rimando: appare solo se in futuro caricheremo il rank tramite hook aggregato per il brand del sito |
| S7 | `SlideFun.tsx` | `energy.deltaPct == null o >= 0` | stat % saved + equivalenze (📱 phones, 🏠 mesi appartamento, 🌍 kg CO₂). Formule: phones = savedKwh * 100, mesi = savedKwh / 300, CO₂ = savedKg |
| S8 | `SlideTreedom.tsx` | `co2.treesEquiv <= 0` | "🌳" + numero alberi/anno equivalenti dal risparmio settimanale annualizzato |
| S9 | `SlideIdentity.tsx` | mai | identità del sito basata su score: ≥90 "Fern", 75-89 "Oak", 60-74 "Bamboo", <60 "Cactus" — copy descrittiva, no data inventata |
| S10 | `SlideRecap.tsx` *(già esiste, aggiornare per matchare HTML pcard)* | mai | card recap con KPI + bottone "Download weekly PDF" |

**Componenti grafici riusati dall'HTML**: ring SVG con gradient, barre verticali (`wr-vchart`), barre orizzontali comparison, lista equivalenze, tree icon. CSS extra in `wrapped.css` solo per ciò che manca (`.wr-cmp-bars`, `.wr-fgrid`, `.wr-month-bars`, palette `.wr-bg-fun`, `.wr-bg-identity`, `.wr-bg-benchmark`). Niente `flip-card` (la "data view" del back è ridondante: il dato è già nel front; lo skippiamo per mantenere il timing storytelling).

### 2. Caso B — Multi-sito (Brand/Holding)

Nuovi file in `src/components/wrapped/slides/`:

- `SlideAggWelcome.tsx` — "Your portfolio's Wrapped" + label brand/holding + n° sites
- `SlideAggTotals.tsx` — Stat kWh totali settimana + delta vs settimana precedente + n° sites con dati
- `SlideAggCO2.tsx` — Totale CO₂ saved + trees equivalenti
- `SlideAggLeaderboard.tsx` — Top 5 sites per EUI ascendente (prima posizione `wr-li.gold`)
- `SlideAggMostImproved.tsx` — Top 5 per `deltaPct` più negativo
- `SlideAggRecap.tsx` — Card aggregata + bottone PDF settimanale

Skip rules: se `totals.weekKwh === 0` salto Totals/CO2; se `leaderboard.length === 0` salto Leaderboard; se `mostImproved.length === 0` salto Most Improved.

### 3. Caso C — Admin globale (FGB Studio)

Nuovi file in `src/components/wrapped/slides/`:

- `SlideGlobalWelcome.tsx` — "FGB's worldwide impact this week"
- `SlideGlobalRegions.tsx` — 4 colonne `wr-vchart` per AMER / APAC / EU / MEA (kWh totali, delta %, CO₂ saved per regione, da `byRegion`)
- `SlideGlobalImpact.tsx` — Stat: kg CO₂ totali risparmiati grazie a FGB nel mondo + alberi/anno equivalenti
- `SlideGlobalLeaderboard.tsx` — Top 5 brand performers (raggruppo `data.sites` per `brandName`, ordino per delta% migliore)
- `SlideGlobalRecap.tsx` — Card globale + PDF "FGB Global Weekly"

### 4. Variant components

Nuova cartella `src/components/wrapped/variants/`:

- `MonoSiteWrapped.tsx` — usa `useSiteWeeklyWrap`. Ritorna `{ slides, isLoading, isEmpty }`. Sequenza: Welcome, Score, Energy?, Air?, Alerts?, Fun?, Treedom?, Identity, Recap.
- `AggregateWrapped.tsx` — usa `useAggregateWeeklyWrap`. Sequenza: AggWelcome, AggTotals?, AggCO2?, AggLeaderboard?, AggMostImproved?, AggRecap.
- `AdminGlobalWrapped.tsx` — usa `useAggregateWeeklyWrap` con tutti i sites. Sequenza: GlobalWelcome, GlobalRegions?, GlobalImpact?, GlobalLeaderboard?, GlobalRecap.

Ogni variant gestisce internamente loading skeleton + onDownload (riceve dal player).

### 5. Refactor `WrappedPlayer.tsx`

- Estraggo `handleDownload` in **`lib/wrappedPdf.ts`** con 3 generatori (`generateSitePdf`, `generateAggregatePdf`, `generateGlobalPdf`) — tutti `window.open` + HTML inline + `window.print` (zero nuove dipendenze).
- Player diventa "scemo": switch su `scope.kind` e renderizza il variant corretto; gestisce solo idx/auto-advance/rail/keyboard/splash/close.
- Hook interno `useWrappedSlides(scope)` che ritorna `{ slides: ReactNode[], isLoading, isEmpty }` chiamando il variant giusto.

### 6. Math helpers (`lib/wrappedMath.ts`)

Aggiungo:

- `overallScore({ energyDeltaPct, waterDeltaPct, airAvgCo2Ppm }): number 0–100` — pesi 80/15/5. Energy score = 100 - clamp(deltaPct, -50, 50) → premia delta negativi. Air score = 100 se ≤800ppm, decade lineare fino a 0 a 1500ppm. Water analogo a energy.
- `identityForScore(score): { name, emoji, traits }` — Fern/Oak/Bamboo/Cactus.
- `formatNumber(v, locale='it-IT')` — utility.

### 7. CSS

Aggiungo in `wrapped.css` solo classi non ancora presenti:

- `.wr-bg-fun`, `.wr-bg-identity`, `.wr-bg-benchmark`
- `.wr-cmp-bars`, `.wr-cmp-row`, `.wr-cmp-track`, `.wr-cmp-fill`, `.wr-cmp-lbl`, `.wr-cmp-val` (per Air comparison)
- `.wr-fgrid`, `.wr-fitem` (per S7 equivalenze)
- `.wr-month-bars` (mini-trend Score)
- Adattamento `.wr-vchart` per 4 colonne (regions globali)

### 8. File toccati / creati

**new (slides):** `SlideScore.tsx`, `SlideAir.tsx`, `SlideAlerts.tsx`, `SlideFun.tsx`, `SlideTreedom.tsx`, `SlideIdentity.tsx`, `SlideAggWelcome.tsx`, `SlideAggTotals.tsx`, `SlideAggCO2.tsx`, `SlideAggLeaderboard.tsx`, `SlideAggMostImproved.tsx`, `SlideAggRecap.tsx`, `SlideGlobalWelcome.tsx`, `SlideGlobalRegions.tsx`, `SlideGlobalImpact.tsx`, `SlideGlobalLeaderboard.tsx`, `SlideGlobalRecap.tsx`

**new (variants):** `variants/MonoSiteWrapped.tsx`, `variants/AggregateWrapped.tsx`, `variants/AdminGlobalWrapped.tsx`

**new (lib):** `lib/wrappedPdf.ts`

**edit:** `WrappedPlayer.tsx`, `lib/wrappedMath.ts`, `slides/SlideWelcome.tsx`, `slides/SlideRecap.tsx`, `styles/wrapped.css`, `hooks/useSiteWeeklyWrap.ts` *(aggiungo solo `airMinPpm` / `airPeakPpm` per S4 — già abbiamo le medie giornaliere, basta min/max)*

**Nessun cambiamento DB, migration o dipendenza.**

### Note importanti

- **S6 Benchmark è skippato in questa iterazione** per Caso A: richiederebbe il rank vs altri sites del brand, che è un dato derivato dall'aggregate hook. Se vuoi includerlo, lo aggiungo come slide finale ma solo quando `useSiteWeeklyWrap` è arricchito da un fetch peer (extra query). Fammelo sapere e lo prevedo in un secondo step.
- **Cadenza weekly confermata**: l'HTML è "May 2026 monthly" ma il sistema gira già su ISO week (`currentISOWeek` / `previousISOWeek`). Le slide diranno "this week" / "vs last week".
- **Flip data view**: l'HTML originale ha un retro card cliccabile su ogni slide. Lo skippo perché complica il timing autoplay e il dato già appare nel front. Se lo vuoi lo aggiungo come `?` step nel player.
