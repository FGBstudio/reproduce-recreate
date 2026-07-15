# Indoor Air Quality card — Score come Indice Sintetico + barra Dyson

Modifica confinata alla facciata frontale dell'`AirCard` in `src/components/dashboard/OverviewSection.tsx`. Nessun nuovo helper: uso lo **stesso `status.score` già calcolato** (proprietà `airStatus` — righe 781-786) che oggi popola l'angolo in alto a destra ("Score N" + level). È l'indice sintetico dell'aria dell'app.

## 1. Sostituire il valore grezzo CO₂ con l'indice

Righe ~607-629 del componente `AirCard`:

- Header "Indoor Air Quality" resta invariato.
- Il grande numero `{formatMaybe(currentCo2, 0)} ppm` viene sostituito da:
  - Numero grande = `status.score` (0-100), senza unità.
  - Caption piccola sotto = "Air Quality Index".
- La riga trend "Avg <periodo>: <n> ppm ±%" resta ma diventa confronto **score corrente vs score medio periodo**, calcolato con la stessa formula già presente (`100 − ((avgCo2 − 400)/600)*100` clampato 0-100) applicata a `averageMetrics['iaq.co2']`. Segno del chip invertito (score più alto = meglio → emerald ↑; più basso = peggio → red ↓).
- La riga finale "Main Proxy: Carbon Dioxide (CO₂)" viene **rimossa** per liberare lo spazio della barra colorata.

## 2. Barra cromatica stile Dyson (4 livelli)

Subito sotto il numero + trend, aggiungere una barra segmentata:

- 4 segmenti uguali arrotondati, con colori esistenti già usati nel file:
  - `bg-emerald-500` → **Very Good** (85-100)
  - `bg-lime-400` → **Good** (65-84)
  - `bg-amber-500` → **OK** (40-64)
  - `bg-red-500` → **Critical** (0-39)
- Sopra la barra un pallino/indicatore bianco con bordo, posizionato a `left: score%`.
- Sotto la barra 4 label piccole (`text-[9px] uppercase text-slate-600`): `Very Good · Good · OK · Critical`. La label del band attivo in grassetto e colorata (stesso colore del segmento).

Le soglie 85/65/40 mappano 1:1 sui 4 livelli richiesti e coincidono in massima con gli step del `getStatusLevel` già in uso (che oggi restituisce EXCELLENT/GOOD/MODERATE/POOR). Il livello mostrato in alto a destra del card (`status.level` — riga 602) viene aggiornato a stringa 4-band coerente: `VERY GOOD | GOOD | OK | CRITICAL`.

## 3. Nessuna altra modifica

- Nessun nuovo file, nessuna dipendenza, nessuna modifica a telemetria/hook/altre dashboard.
- Retro della card (Live Gas Diagnostics con TVOC/PM2.5/PM10/Temp/Humidity) invariato.
- `energyStatus`/`waterStatus`/`overallStatus` invariati (usano già `airStatus.score`).

## File toccati

- `src/components/dashboard/OverviewSection.tsx` (solo blocco frontale `AirCard`, ~30 righe).
- `src/contexts/LanguageContext.tsx`: aggiungere 5 stringhe IT/EN — `overview.aqi_title` ("Air Quality Index") e le 4 label di banda.
