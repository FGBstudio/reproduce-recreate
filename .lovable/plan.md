Modifica confinata alla card **Indoor Air Quality** in `src/components/dashboard/OverviewSection.tsx`.

## 1. Fronte card — rimuovere la barra e colorare il numero AQI
- Eliminare il blocco con i 4 segmenti colorati e il pallino indicatore.
- Mantenere la riga delle 4 etichette di banda (`Critical · OK · Good · Very Good`), evidenziando quella attiva.
- Applicare al grande numero `currentScore` un riempimento gradiente corrispondente alla fascia attiva, usando le stesse tonalità già presenti nel componente:
  - **Critical**: `from-red-500 to-red-400`
  - **OK**: `from-amber-500 to-amber-400`
  - **Good**: `from-lime-400 to-lime-300`
  - **Very Good**: `from-emerald-500 to-emerald-400`
  - Stato assente / stale: grigio.
- Lasciare invariati: titolo, sottotitolo "Air Quality Index", badge periodo, trend medio e punteggio in alto a destra.

## 2. Retro card — aggiungere CO₂
- Aggiungere una riga **CO₂** nella griglia "Live Gas Diagnostics", usando `readings.co2.value` e formattandola come gli altri parametri (`formatMaybe(..., 0) ppm`).
- Ribilanciare la griglia a 6 parametri (es. rimuovere `col-span-2` da Humidity e lasciare 3 righe su 2 colonne) per evitare colonne vuote.

## 3. Nessun altro impatto
- Nessun nuovo file, hook, helper o dipendenza.
- Nessuna modifica alle traduzioni (l'etichetta CO₂ resta grezza, come TVOC / PM2.5).

### File toccato
- `src/components/dashboard/OverviewSection.tsx`