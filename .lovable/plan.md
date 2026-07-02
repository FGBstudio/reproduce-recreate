
# MapNameCard refinement

Tutte le modifiche in un solo file: `src/components/dashboard/SiteMarker.tsx`. Ambito ristretto al componente `MapNameCard` e al blocco di rendering nell'`AnimatePresence` della name-card. `MapMetricRadar` e le sfere metriche restano identiche.

## 1. Rimozione del cono
Eliminare l'`<svg>` che disegna il `conePath` all'interno di `MapNameCard`. Le sfere metriche mantengono il loro cono.

## 2. Fluttuante sopra al marker
Nel wrapper di rendering della name-card:
- Definire `NAME_CARD_OFFSET_PX = FOCUS_OFFSET_PX * 0.55` per avvicinare la sfera al pin.
- Forzare posizione sopra: `dx = 0`, `dy = -Math.abs(NAME_CARD_OFFSET_PX)`. Rimosso il calcolo con `thetaDeg = 270`.
- Passare `rotationDeg={0}` a `MapNameCard` così logo e bottone restano dritti.

## 3. Verde FGB #006367
Dentro `MapNameCard`:
- Costante locale `const FGB_GREEN = "#006367"`.
- Bordo della sfera (ring 2.5px) → `FGB_GREEN`.
- Sfondo e bordo del bottone "i" → `FGB_GREEN` (bordo bianco esterno mantenuto).
- Colore testo del nome sito → `FGB_GREEN`.
Sostituisce l'uso attuale di `--fgb-emerald` solo in `MapNameCard`.

## 4. Logo brand + nome sito
Al centro della sfera:
- Se `brandLogo` esiste: mostrare il PNG (`object-fit: contain`, larghezza `CARD_SIZE - 40px`, altezza max ~60px, leggero `drop-shadow`) sopra al nome del sito.
- Il nome del sito rimane sempre visibile sotto al logo, in maiuscolo e color `FGB_GREEN`.
- Se `brandLogo` manca, mostrato solo il nome sito.
- Bottone "i" sotto al blocco logo+nome, struttura invariata.

## 5. Sfondo della sfera
Pattern/`project.img` invariati. Il logo si sovrappone come nella reference.

## Fuori scope
Nessun cambio a `MapMetricRadar`, al cono delle sfere metriche, ai dati, o al click sul pin (che continua ad aprire la dashboard). Nessun cambio all'API di `SiteMarker`.
