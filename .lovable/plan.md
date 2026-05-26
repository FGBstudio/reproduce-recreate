## Fix FGB Telemetric Lens widget

### Problems observed
1. Il pattern del logo brand copre il contenuto: la card centrale con icona/valore/unità non è visibile perché il pattern SVG nella lente viene renderizzato sopra (o la card non emerge per via dello z-index relativo all'SVG nello stesso stacking context).
2. Click sul marker pin: deve aprire **Overview del sito**, non niente di diverso.
3. Click su una specifica lente (Energy/Air/Water): deve aprire la **rispettiva sezione** della dashboard del sito.
4. Lo stile finale deve replicare fedelmente la "FGB Telemetric Lens" dell'HTML condiviso (lente circolare flottante, pattern/immagine in background tenue, card centrale bianca rotonda con anello di progresso, label, valore grande, unità).

### Modifiche in `src/components/dashboard/SiteMarker.tsx`

**A. Layering corretto della lente (back → front)**
Ristrutturare il contenuto della lente in layer espliciti, ognuno con il proprio z-index nel medesimo container:
1. `z-0` — Cerchio bianco di base (riempie la lente).
2. `z-10` — Background: immagine del sito (clipPath circle, opacity ~0.55) **oppure** pattern logo brand ripetuto (opacity ~0.18) **oppure** gradiente FGB. Reso via `<svg>` separato, NON nello stesso SVG che contiene il cono.
3. `z-20` — Tint radiale FGB (gradient accent) molto leggero.
4. `z-30` — Anello bordo lente (gold/teal/navy) + anello interno bianco al 40%.
5. `z-40` — **Card centrale bianca** con backdrop-blur, anello SVG di progresso, icona Lucide, label uppercase, valore grande, unità. Counter-rotation per testo dritto.
6. Cono (beam) renderizzato come SVG **separato** dietro alla lente (`z-[-1]` rispetto al cerchio) così non interferisce mai con i layer sopra.

**B. Logica di click corretta**
- Il pin marker (`<button>` esterno) chiama `onMarkerClick(project)` → apre la pagina **Overview** del sito (è già ciò che `Index.tsx` fa con `setSelectedProject` + section "overview").
- Ogni `MapMetricRadar` chiama `onSphereClick(project, section)` con `section` = `"energy" | "air" | "water"` per aprire la dashboard alla sezione corretta. Per `STORE_USER` continua a forzare `"overview"`.
- `e.stopPropagation()` su entrambi per evitare conflitti.

**C. Dimensioni/posizionamento**
- Mantenere `WIDGET_PX = 340` e disposizione a 120° già implementata.
- Mantenere il calcolo del focal point per allineare il cono al marker.

### File toccati
- `src/components/dashboard/SiteMarker.tsx` (refactor del rendering della lente + verifica callback)

Nessun altro file modificato. Nessuna logica dati o hook cambiata.
