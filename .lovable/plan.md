# FGB Map Metric Sphere – Hover sui marker

Replicare l'effetto "sfera" mostrato in reference sui marker mappa: al passaggio del mouse il marker espande una o più sfere glassmorphism (una per modulo attivo: energia / aria / acqua) con il valore live, ancorate sopra il pin. Click sulla sfera → apre il progetto direttamente sulla sezione corrispondente. Click sul marker → comportamento attuale (overview).

## Cosa cambia (frontend-only)

### 1. Nuovo componente `src/components/dashboard/SiteMarker.tsx`
Componente React che incapsula il marker + l'overlay sfere. Sostituisce la logica attuale `L.marker(...).addTo(map)` in `MapView.tsx` per i pin.

- Renderizzato come **`L.divIcon` HTML wrapper** che monta un portale React (riusiamo `createPortal` già in uso in ProjectDetail) dentro al container del marker Leaflet, così Framer Motion + Tailwind funzionano in modo nativo.
- Props: `project`, `onMarkerClick(project)`, `onSphereClick(project, section)`, `latestData` (telemetria già aggregata), `clientRole`.
- Stato locale `isHovered` su mouseenter/leave del wrapper (con piccolo delay di chiusura ~150 ms così il mouse può spostarsi dal pin alla sfera senza chiuderla).

### 2. Animazione sfere (framer-motion già installato)
- Container `<motion.div>` posizionato `absolute bottom-full left-1/2 -translate-x-1/2 mb-3` rispetto al marker.
- `AnimatePresence` con varianti:
  - `initial / exit`: `{ opacity: 0, scale: 0.2, y: 10 }`
  - `animate`: `{ opacity: 1, scale: 1, y: 0 }`
  - `transition`: `{ type: "spring", stiffness: 260, damping: 22 }`
  - `style={{ transformOrigin: "bottom center" }}`
- Stagger fra sfere multiple (`staggerChildren: 0.06`).
- Layout sfere: flex row con gap-2; se più di una sfera, si dispongono affiancate sopra il pin.

### 3. Singola sfera (`MetricSphere` interno)
- Forma circolare `w-20 h-20 rounded-full` con look FGB:
  - `bg-background/70 backdrop-blur-xl`
  - `border border-white/10`
  - `shadow-[0_10px_40px_rgba(0,0,0,0.5)]`
  - Se il sito ha allarme attivo per quella metrica → ombra colorata sottile, es. `shadow-[0_10px_40px_rgba(239,68,68,0.35)]` per energia in alert; nessun bordo rosso aggressivo.
- Contenuto centrato (3 righe):
  1. Icona Lucide colorata (16px)
  2. Valore numerico grande (`text-base font-bold text-foreground`)
  3. Etichetta micro (`text-[9px] uppercase tracking-wider text-muted-foreground`)

Mapping metrica → icona / colore / dato / etichetta / sezione:
| Metrica | Icona | Colore | Valore (live) | Etichetta | Sezione |
|---|---|---|---|---|---|
| energy | `Zap` | `text-fgb-accent` (teal) | `power_kw` corrente in `kW` | Main Load | `energy` |
| air | `Wind` | `text-sky-400` | CO₂ in `ppm` | CO₂ | `air` |
| water | `Droplet` | `text-blue-400` | flow `L/m` | Flow | `water` |

Se un valore live non è disponibile → mostra `—` (regola "no fake data" da memoria progetto).

### 4. Filtro sfere visibili
Per ogni progetto si mostrano **solo** le sfere dei moduli che il sito sta effettivamente monitorando: intersezione tra `project.monitoring` e i moduli attivi (`useProjectModuleConfig` o, in fallback rapido, `project.monitoring`). Se zero moduli → nessuna sfera, marker resta cliccabile come oggi.

### 5. Sorgente dati realtime
Usare hook già esistenti, per sito:
- `useRealTimeLatestData(siteId)` per CO₂ e flow.
- `useEnergyPowerByCategory` / `useRealTimeEnergyData` per `power_kw`.

Per non moltiplicare le subscription su 100+ marker, due strategie:
- **Fetch on hover**: lo stato `isHovered` abilita gli hook (passando `siteId` solo quando hover attivo). Le sfere mostrano skeleton (`—`) per ~300ms al primo hover, poi popolano. Soluzione semplice, scalabile.
- Cache React Query già condivisa tra marker e ProjectDetail → la seconda apertura è istantanea.

### 6. Click handling
- Click sul marker (zona pin, non sfera) → `onMarkerClick(project)` come oggi (apre overview).
- Click su una sfera → `onSphereClick(project, section)` che:
  - Se `clientRole === 'STORE_USER'` → apre sempre `overview`.
  - Altrimenti apre la sezione `energy | air | water`.
- `event.stopPropagation()` sulla sfera per non triggerare il click marker.

### 7. Modifiche minime ai file esistenti

**`src/components/dashboard/ProjectDetail.tsx`**
- Aggiungere prop opzionale `initialDashboard?: DashboardType`.
- `useState<DashboardType>(initialDashboard ?? "overview")`.

**`src/pages/Index.tsx`**
- Nuovo stato `initialSection: DashboardType | undefined`.
- Handler `handleSphereClick(project, section)` che setta `selectedProject` e `initialSection` (con guard `STORE_USER` → overview).
- Passare `initialDashboard={initialSection}` a `<ProjectDetail>`.
- Reset `initialSection` su chiusura.

**`src/components/dashboard/MapView.tsx`**
- Sostituire la creazione marker con `SiteMarker`. Due opzioni equivalenti:
  - (a) Continuare ad usare `L.marker` + `L.divIcon`, ma renderizzare il contenuto React via `createPortal` nel `divIcon` element dopo `marker.on("add")`. Il container del marker NON deve avere `overflow:hidden` perché la sfera esce sopra.
  - (b) Più pulito: `L.divIcon` che produce solo un `<div id="marker-{id}"/>`, e in un `useEffect` separato si fa `createPortal(<SiteMarker .../>, document.getElementById(...))` per ogni marker visibile.
- Aggiungere CSS override: `.leaflet-marker-icon { overflow: visible !important; }` per permettere alla sfera di "uscire" dal bounding box del marker, e z-index alto sul marker in hover.
- Rimuovere il `bindPopup` corrente (sostituito dalle sfere). Mantenere comunque il click sul pin.
- Passare `clientRole` da `useUserScope` e gli handler `onMarkerClick` / `onSphereClick` come prop da Index → MapView → SiteMarker.

### 8. Accessibilità / UX
- Sfere `role="button"`, `aria-label="Apri sezione Energia di {site}"`.
- Su touch device (no hover): tap singolo sul marker → toggle sfere (invece di aprire overview); secondo tap sul marker chiude o apre overview con piccola "X". Comportamento desktop invariato. *(Da confermare in build, soluzione di default: su mobile resta il comportamento attuale, le sfere sono desktop-only. Le memorie indicano UX mobile dedicata con Drawers per le liste, quindi non sovraccarichiamo il marker mobile.)*

## File toccati
- **Nuovo**: `src/components/dashboard/SiteMarker.tsx`
- **Modificati**:
  - `src/components/dashboard/MapView.tsx` (render marker + portal + CSS overflow)
  - `src/components/dashboard/ProjectDetail.tsx` (prop `initialDashboard`)
  - `src/pages/Index.tsx` (stato `initialSection` + handler sphere click)

## Fuori scope
- Nessun cambio DB / RLS / edge function.
- Nessun nuovo hook dati (riuso degli esistenti).
- Le tile mappa, i filtri regione/brand/holding e la logica click marker restano invariati.
