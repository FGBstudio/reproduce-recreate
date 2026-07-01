## Obiettivo
Modificare il comportamento dei marker sulla mappa: al momento le sfere delle metriche (Energy/Air/Water/Certifications) compaiono immediatamente al passaggio del cursore. Vogliamo un passaggio intermedio con una singola "card di anteprima" (nome sito + pulsante info).

## Nuovo comportamento

1. **Marker a riposo** — solo il pin (come ora).
2. **Hover sul pin** → compare **una sola sfera** in stile identico alle attuali (stessa lente in vetro, stesso pattern di sfondo brand/immagine del sito, stesso bordo/ombra), contenente:
   - Il **nome del sito** (in evidenza)
   - Sotto, un piccolo pulsante circolare con l'icona **"i"** (info)
3. **Click sulla "i"** → la card di anteprima si nasconde e compaiono le sfere delle metriche esattamente come oggi (Energy/Air/Water/Certifications, in arco attorno al pin).
4. **Mouse leave** → tutto si chiude e torna a stato 1.
5. **Click sul pin** (marker) → invariato: apre la dashboard del sito (`onMarkerClick`).
6. **Click su una singola sfera metrica** → invariato: apre la sezione corrispondente (`onSphereClick`).

## Dove intervenire

Un solo file: `src/components/dashboard/SiteMarker.tsx`.

### Dettagli tecnici

- Aggiungere uno stato locale `showMetrics: boolean` accanto a `isHovered`. Reset di `showMetrics` a `false` su `handleLeave`.
- Estrarre il "guscio" visivo dell'attuale `MapMetricRadar` (lente, pattern brand, patina di vetro, bordo interno) in modo che una nuova `MapNameCard` possa riusarlo con lo stesso look. In pratica: fattorizzare in un piccolo componente `LensShell` che riceve `rotationDeg`, `backgroundImage`, `brandLogo`, `accentVar` e `children` (contenuto centrale).
- Creare `MapNameCard` che usa `LensShell` con:
  - `accentVar = "--fgb-navy"` (o token neutro coerente col brand)
  - `rotationDeg = 270` (una sola card, posizionata sopra il pin come le sfere singole)
  - Contenuto: nome del sito (`project.name`, con wrapping/troncamento se lungo) + sotto pulsante rotondo con icona `Info` (lucide-react). Click sul pulsante → `setShowMetrics(true)` (con `stopPropagation`).
- Rendering condizionale dentro `<AnimatePresence>`:
  - `isHovered && !showMetrics && activeSpheres.length > 0` → mostra `MapNameCard`.
  - `isHovered && showMetrics && activeSpheres.length > 0` → mostra le sfere metriche come oggi.
  - Se `activeSpheres.length === 0`, non mostrare nulla (comportamento attuale).
- Il fetch dei dati real-time (`useRealTimeLatestData`, `useEnergyPowerByCategory`) resta legato a `isHovered` (non serve attendere il click su "i", così quando l'utente clicca info i valori sono già pronti). Nessuna modifica alla logica dati.
- Il click sul pin (`button` con `markerPinIcon`) resta invariato e continua a chiamare `onMarkerClick(project)`.
- Nessuna modifica a `MapView.tsx` o ad altri file: le props di `SiteMarker` restano identiche.

## Fuori scope
- Nessuna modifica al comportamento su mobile/touch oltre a quanto già presente.
- Nessuna modifica ai dati, alle API, o all'aspetto grafico delle sfere metriche.
- Nessuna modifica alla dashboard.
