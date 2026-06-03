# Allineamento Wrapped mono-sito all'HTML di riferimento

Obiettivo: ridurre il gap tra `fgb-wrapped-v3-5.html` e l'attuale player React per il caso A (singolo sito), mantenendo "no-fake-data" e RLS-safe. Nessun cambio a DB / migrazioni / dipendenze.

## 1. Passaggio da settimanale a mensile

- Nuovo hook `useSiteMonthlyWrap(siteId, areaM2)` parallelo all'esistente weekly (NON rimuovo il weekly: viene mantenuto perché l'aggregate/admin lo richiama).
- Range: 1° → ultimo giorno del **mese corrente** (oppure mese precedente se siamo nei primi 3 giorni → più dati).
- Output esteso vs weekly:
  - `energy.daily[]` su tutto il mese
  - `energy.weeks[]` (4–5 bucket lun-dom usati nella Recap)
  - `energy.byCategory` `{ hvac, lighting, plugs, other }` in kWh + %
  - `energy.hourlyProfile[24]` (kWh medi per ora)
  - `energy.peakHour` (ora del picco mediano) → archetype
  - `energy.yoy` (stesso mese anno precedente, se presente)
  - `energy.bestMonthYtd` (miglior score YTD, se calcolabile)
  - `air.hoursExcellent` (ore consecutive totali con CO2<800, VOC<limite, PM2.5<15)
  - `air.metrics` `{ co2, voc, pm25 }` con avg e ore-eccellenti per metrica
- Label slide 1 → `MMMM YYYY` invece di range ISO week.

## 2. Slide Score — back-of-card mono-sito-safe

Sostituire i benchmark "portfolio" con dati interni al sito:
- "Stesso mese, anno scorso" → da `energy.yoy`
- "Tuo record YTD" → da `energy.bestMonthYtd`
- Se mancano (sito nuovo) → riga mostrata come "—" (no fake).

## 3. Slide Energy — breakdown HVAC / Lighting / Plugs

- Query su `devices` raggruppata per `category` (`hvac`, `lighting`, `plugs`, `general`) → sum kWh da `energy_daily`.
- Render barra orizzontale a 3 segmenti con i colori dell'HTML (`--amber` HVAC, `--purple` Lighting, `--red` Plugs; resto in `--track`).
- Copy: rimuovo "vs portfolio average", scrivo "vs tuo baseline" usando media mobile dei mesi precedenti se disponibile, altrimenti niente confronto.

## 4. Slide Air — ore eccellenti reali

- Query su `telemetry_hourly` (rollup orario esistente) per device `air_quality`, metriche `iaq.co2`, `iaq.voc`, `iaq.pm25` (mappature note in metric-normalization).
- Conteggio ore in cui **tutte** le metriche disponibili sono sotto soglia (CO2<800, VOC<300, PM2.5<15).
- Slide mostra: `Xh of excellent air` + tre micro-stat (CO2 / VOC / PM2.5) come nell'HTML.
- Se manca rollup orario o sensore manca, fallback al conteggio "giorni eccellenti" attuale, con label diversa.

## 5. Slide Fun — equivalenze a rotazione

In `wrappedMath.ts`:
- `energyEquivalences(kwh)` ritorna 3 oggetti scelti deterministicamente per `siteId+mese` (no random instabile fra render):
  - Espressi (0.015 kWh)
  - Ricariche smartphone (0.012 kWh)
  - Km Tesla Model 3 (0.15 kWh)
  - Lavatrici (1 kWh)
- Slide Fun aggiornata per usare questi (sostituisce gli equivalenti attuali phones/apt).

## 6. Slide Identity — archetipo basato su load profile

- Aggiunto `archetypeFromHourlyProfile(profile24)` in `wrappedMath.ts`:
  - picco 06–11 → **The Early Bird**
  - picco 12–17 → **The Day Shift**
  - picco 18–23 → **The Night Owl**
  - delta max/min < 25% media → **The Insomniac** (flat)
- Slide `SlideIdentity` esistente diventa "tree persona" → rinominata internamente in due slide:
  - `SlideArchetype` (archetipo edificio, dall'HTML)
  - `SlideIdentity` esistente (Fern/Oak/Bamboo/Cactus) resta come slide di chiusura prima del recap.
  Entrambe mostrate solo se i dati lo permettono.

## 7. Slide Treedom — CO2 senza numeri fuorvianti

- `savedKg` calcolato preferendo confronto **YoY** (`energy.yoy`) se presente; altrimenti vs mese precedente.
- Se delta peggiorato → slide neutra ("Hai emesso X kg CO₂ questo mese") senza alberi.
- Se delta migliorato → versione attuale (alberi equivalenti).
- Nessun valore negativo presentato come "saved".

## 8. Recap — tabella per settimane

- `SlideRecap` mono-sito mostra tabella stile HTML: Week 1..5 con kWh, € (se prezzo unitario disponibile sulla site config; altrimenti colonna nascosta), CO2.
- Footer card mantiene download PDF.

## Variant + Player

- `MonoSiteWrapped.tsx` passa a `useSiteMonthlyWrap` e compone la nuova sequenza:
  Welcome → Score → Energy(+breakdown) → Air → Alerts → Fun → Archetype → Treedom → Identity → Recap.
- Ogni slide rimane skip-on-null per "no-fake-data".
- `WrappedPlayer` invariato strutturalmente (continua a chiamare `useMonoSiteSlides`).

## File toccati

**Nuovi**
- `src/components/wrapped/hooks/useSiteMonthlyWrap.ts`
- `src/components/wrapped/slides/SlideArchetype.tsx`

**Modificati**
- `src/components/wrapped/lib/wrappedMath.ts` — `monthRange`, `archetypeFromHourlyProfile`, `energyEquivalences`, helpers YoY.
- `src/components/wrapped/variants/MonoSiteWrapped.tsx` — usa monthly hook, nuova sequenza.
- `src/components/wrapped/slides/SlideWelcome.tsx` — label mensile.
- `src/components/wrapped/slides/SlideScore.tsx` — back-of-card YoY / record YTD.
- `src/components/wrapped/slides/SlideEnergy.tsx` — barra breakdown + copy baseline.
- `src/components/wrapped/slides/SlideAir.tsx` — `hoursExcellent` + tre micro-stat.
- `src/components/wrapped/slides/SlideFun.tsx` — equivalenze a rotazione.
- `src/components/wrapped/slides/SlideTreedom.tsx` — gating positivo / messaggio neutro.
- `src/components/wrapped/slides/SlideRecap.tsx` — tabella settimanale del mese.
- `src/components/wrapped/styles/wrapped.css` — classi `.hbar/.htrack/.hfill`, `.wr-archetype-*`, `.wr-recap-table`.
- `src/components/wrapped/lib/wrappedPdf.ts` — copy/struttura coerente con la nuova sequenza.

**Invariati**
- Aggregate / AdminGlobal variants e relativi slide.
- `WrappedPlayer.tsx`, `WrappedContext.tsx`, `WrappedLauncherButton.tsx`.
- DB, migrazioni, edge functions, deps.

## Note / rischi

- `telemetry_hourly` deve contenere metriche IAQ; se per un device non c'è VOC o PM2.5, l'algoritmo usa solo le metriche disponibili (no fake).
- `energy.yoy` richiede 13 mesi di storia: per siti recenti la slide Score back-of-card e Treedom degradano a "—".
- Tutte le slide continuano a essere skip se mancano i dati necessari.
