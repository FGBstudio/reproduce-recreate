# Grafici zoomabili e navigabili

## Obiettivo
Permettere all'utente di ingrandire qualsiasi grafico della dashboard (specialmente i più piccoli, come quelli dentro i widget Energy/Air/Water) per leggere meglio i dettagli, usando:
- **Ctrl + rotellina mouse** → zoom in/out centrato sul punto puntato
- **Click + drag orizzontale** → seleziona un intervallo X da ingrandire
- **Doppio click** → reset allo zoom completo
- **Pulsante "Espandi"** in alto a destra di ogni grafico → apre il grafico in un dialog full-screen, zoomabile anch'esso

Su mobile (touch): pinch-to-zoom + pan a due dita, con stesso pulsante "Espandi" per il fullscreen.

## Approccio tecnico

Recharts non supporta zoom/pan nativamente. La soluzione più pulita e compatibile con lo stack attuale è creare **un wrapper riusabile** attorno ai chart esistenti, senza cambiare libreria.

### Nuovo componente: `src/components/ui/ZoomableChart.tsx`

Wrapper che:
1. Mantiene uno stato `xDomain` ([startIndex, endIndex] oppure [startValue, endValue]) e lo passa come `domain` agli `XAxis` figli tramite `React.cloneElement` o tramite render-prop `(domain) => <LineChart .../>`.
2. Intercetta su un overlay `<div>`:
   - `onWheel` con `e.ctrlKey` → calcola nuovo dominio (fattore 0.85 zoom-in / 1.15 zoom-out) centrato sulla posizione X del cursore (usando `chartRef` + bbox).
   - `onMouseDown` + `onMouseMove` + `onMouseUp` → mostra un rettangolo di selezione semi-trasparente, al rilascio applica il dominio selezionato.
   - `onDoubleClick` → reset.
   - Touch events `onTouchStart/Move/End` con 2 dita → pinch (mobile).
3. Mostra in alto a destra:
   - Pulsante **Reset** (icona `RotateCcw`) visibile solo quando lo zoom è attivo
   - Pulsante **Espandi** (icona `Maximize2`) → apre `<Dialog>` con lo stesso chart a tutta finestra
4. Hint discreto "Ctrl+scroll per zoom" mostrato al primo hover (auto-nascosto dopo 3s, salvato in localStorage).

### Integrazione

Sostituire i ChartContainer / ResponsiveContainer dei chart "piccoli" con `<ZoomableChart>` nei file:
- `src/components/dashboard/ProjectDetail.tsx` (chart Energy, IAQ timeseries, etc.)
- `src/components/dashboard/EnergyWeatherCorrelation.tsx`
- `src/components/dashboard/BrandOverlay.tsx`
- `src/components/dashboard/BillAnalysisModule.tsx`

Esclusi: `LEEDCertificationWidget` (radar/gauge — lo zoom non ha senso lì).

Il wrapper è opt-in: passando `enableZoom={false}` torna al comportamento attuale, così i grafici di tipo "donut/radar/pie" non vengono toccati.

### Dipendenze
Nessuna nuova libreria necessaria. Solo Recharts (già presente) + componenti shadcn (`Dialog`, `Button`, `Tooltip`) già nel progetto. Tutti i colori restano semantic tokens da `index.css`.

## Cosa NON cambia
- Logica dati, hooks, query Supabase: invariati.
- Aspetto di default dei grafici (colori, font, assi): invariato a riposo.
- Memoria progetto sui token di design rispettata.

## Domande aperte (rispondi se vuoi cambiare qualcosa)
- OK estendere lo zoom a **tutti** i timeseries chart, o vuoi limitarlo solo ai widget Energy?
- Vuoi anche **pan orizzontale** (shift+drag) oltre allo zoom, o basta drag-to-zoom + reset?
