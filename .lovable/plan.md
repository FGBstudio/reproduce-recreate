## Diagnosi

Nel sito visualizzato, l'"Air Quality Index" scende a **0 / Critical** anche quando i sensori reali riportano CO₂ intorno a 480–605 ppm (dovrebbe essere ~66–86). Ho verificato la sorgente reale su Supabase: i device WELL Milano hanno `iaq.co2` a 482–605 ppm, `iaq.voc` ~303–313 ppb, `iaq.pm25` 0–6 µg/m³ — quindi aria buona.

Il bug è in `src/components/dashboard/OverviewSection.tsx` (funzione `airStatus`, righe ~827–832):

```ts
const co2 = liveData.metrics['iaq.co2'] ?? liveData.metrics['co2'];
if (typeof co2 !== 'number') return { score: 0, level: 'NO_DATA', isLive: false };
const score = Math.round(Math.max(0, Math.min(100, 100 - ((co2 - 400) / 600) * 100)));
```

Due problemi:

1. **`isStale` ignorato**: se `liveData.isStale` è true (nessun dato negli ultimi minuti) ma `liveData.metrics['iaq.co2']` esiste ancora come cache, il valore viene usato lo stesso. Se quel valore è >1000 ppm il punteggio crolla a 0. In parallelo, la card usa `isCardStale` per mascherare la CO₂ visibile ma **non ripulisce lo score**, generando la contraddizione dello screenshot ("AVG CO₂ 616 ppm · IAQ 0 Critical").
2. **Score mono-parametro**: dipende solo da CO₂. Se `iaq.co2` non arriva (ma arrivano VOC, PM, temp, humidity) il modulo va in `NO_DATA` invece di calcolare l'indice dagli altri inquinanti.

Inoltre `airStatus` non guarda `liveData.isRealData`, quindi con dati falsi/vuoti la formula può comunque produrre 0.

## Fix

### 1. Rendere `airStatus` uno score sintetico multi-parametro

Introdurre in `src/lib/airQuality.ts` una funzione `computeAirIndex(metrics)` che restituisce `{ score, level, componentsUsed }`:

- Per ogni inquinante disponibile calcola un sotto-score 0–100 con curva lineare tra "ottimo" e "critico":
  - CO₂: 400 ppm → 100, 1500 ppm → 0
  - TVOC: 200 ppb → 100, 1000 ppb → 0
  - PM2.5: 5 µg/m³ → 100, 35 µg/m³ → 0 (soglia WHO/EPA)
  - PM10: 15 µg/m³ → 100, 50 µg/m³ → 0
  - O₃: 60 ppb → 100, 120 ppb → 0
  - CO: 2 ppm → 100, 9 ppm → 0
- Score finale = **minimo** tra i sotto-score disponibili (approccio "worst-pollutant" tipo AQI EPA / Indice di Parigi). Fallback a media pesata se preferito, ma il minimo è più fedele allo standard AQI.
- Se nessun inquinante è disponibile → `NO_DATA`.

Questo permette al sensore LEED (solo CO₂/VOC/temp/humidity) di produrre uno score valido, e al WELL di sfruttare anche PM/O₃/CO.

### 2. Correggere `airStatus` in `OverviewSection.tsx`

```ts
const airStatus = useMemo<ModuleStatus>(() => {
  const stale = liveData.isStale;
  const real  = liveData.isRealData;
  if (stale || !real) return { score: 0, level: 'NO_DATA', isLive: false };
  const res = computeAirIndex(liveData.metrics);
  if (!res) return { score: 0, level: 'NO_DATA', isLive: false };
  return { score: res.score, level: getStatusLevel(res.score), isLive: true, lastUpdate: liveData.lastUpdate };
}, [liveData]);
```

Così quando la card è stale il modulo va davvero in `NO_DATA` (mostra "—", coerente con il resto della UI) invece di 0/Critical.

### 3. Allineare `AirCard` (desktop) e `OverviewMobileView` (mobile)

- Sostituire `co2ToScore(avgCo2)` per il periodo con lo stesso `computeAirIndex` applicato ai valori medi (`airAverages`), così l'"Avg periodo" e il "Now" sono confrontabili sulla stessa scala multi-parametro.
- Sul retro della card (Live Gas Diagnostics) nessuna modifica: continua a mostrare i valori grezzi.
- Nel mobile, `bigColor` e la label CRITICAL/OK/GOOD/VERY GOOD derivano già da `air.score`: automaticamente corretti dopo il fix.

### 4. Non toccare

- Soglie CO₂ esistenti in `co2ToScore` / `co2Level` (usate altrove come "livello CO₂" e allarmi soglia).
- Logica alert (`useThresholdAlerts`) e pesi `MODULE_WEIGHTS` dello score complessivo.

## File toccati

- `src/lib/airQuality.ts` — aggiunta `computeAirIndex` + sotto-score per inquinante.
- `src/components/dashboard/OverviewSection.tsx` — nuovo `airStatus`, `AirCard` usa `computeAirIndex` anche per la media periodo.
- `src/components/dashboard/OverviewMobileView.tsx` — nessuna modifica logica, eredita lo score corretto (verifica visiva).

## Verifica

1. Aprire il sito Milano dello screenshot: con CO₂ ~600 ppm, VOC ~310 ppb, PM ~3 µg/m³ ci si aspetta IAQ ≈ 65–75 (banda "Good"), non 0.
2. Simulare `isStale=true` (device offline): IAQ deve mostrare "—" e banda "No Data", non 0/Critical.
3. Sito LEED (solo CO₂+VOC+temp+hum): lo score deve essere calcolato normalmente ignorando PM/O₃/CO mancanti.
