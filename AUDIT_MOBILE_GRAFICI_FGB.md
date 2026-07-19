# FGB Monitoring — Audit mobile: grafici, card e stabilità del layout
*Metodo: app in modalità demo renderizzata a 375×812 (iPhone) con misurazione
programmatica (overflow, scrollWidth, font, SVG recharts, animazioni attive,
PerformanceObserver layout-shift), incrociata con l'ispezione completa del codice
dei grafici. Complementare a AUDIT_UX_MOBILE_FGB.md (che copriva touch target,
form, gesti): qui il tema è **leggibilità dei dati e adattività del layout**.*

---

## Causa radice (spiega quasi tutto il resto)

**Il layer dashboard non sa di essere su mobile.** L'hook `useIsMobile`
(`src/hooks/use-mobile.tsx`) esiste ma è usato solo in Header, sidebar e
RegionOverlay. `ProjectDetail.tsx` — cioè TUTTI i grafici — e `OverviewSection.tsx`
non lo importano mai: ogni chart renderizza la **stessa configurazione desktop**
(altezze, tick, serie, margini) dentro ~350px di larghezza. Non è un insieme di
bug indipendenti: è un'architettura che non ha mai avuto un ramo mobile.

Corollario: i breakpoint usati nelle slide sono quasi solo `lg:` (1024px).
Tra 350px e 1023px l'app è "un desktop compresso", e sotto i 390px
(iPhone SE 375, Android 360) non esiste alcuna gestione.

---

## Problemi verificati, dal più grave

### P1. Grafici con configurazione desktop hardcoded
**Misurato:** SVG recharts da 275–319px di larghezza con altezze fisse 262–300px;
tick a 10px; con dati reali le label si sovrappongono.

**Nel codice:**
- **~27 altezze fisse in px** che non scalano col viewport:
  `height={280}` (ProjectDetail.tsx:3815, 5321, 5484, 5535), wrapper `h-[200px]`
  (:4958, :4995), `h-[220px]` (:5032), `h-[250px]` (:5078, :5119), `h-[280px]`
  (:5215), fullscreen `height={500}`/`h-[500px]` ×16 (:6576–6851), card overview
  `h-[320px]` ×6 (OverviewSection.tsx:457–728).
- **Densità tick cieca alla larghezza**: bar chart device con `interval` calcolato
  `len/12…len/15` (ProjectDetail.tsx:4541-4547) → 12-15 date ruotate a -45°,
  fontSize 9, in ~300px di plot area.
- **Grafici aria SENZA `interval`/`minTickGap`** (CO₂ :4973, TVOC, Temp/Hum,
  PM2.5, PM10): ogni bucket temporale disegna la sua label → sovrapposizione
  totale su schermo stretto. È il motivo per cui "i grafici non si capiscono".
- **Serie illimitate**: una `<Line>` per ogni device selezionato (:4977) in un
  chart alto 200px con legenda che va a capo e mangia il grafico; barre stacked
  illimitate (:4568); fino a 5 aree stacked (:3884-3929).

### P2. Heatmap oraria inutilizzabile su touch
Griglia flex di celle `min-w-[24px]` (misurati **761 elementi** `min-w-*` montati)
dentro `overflow-x-auto`: vista anno = fino a 31 colonne → ~750px in 350 di
viewport, scroll orizzontale forzato senza indicatori. Il tooltip delle celle è
`hidden group-hover:block` (ProjectDetail.tsx:4285-4287): **hover-only, su touch
non esiste** — i valori delle celle sono inaccessibili da telefono.

### P3. ZoomableChart: le azioni non esistono su touch
- Pulsanti Espandi/Reset: `opacity-0 group-hover:opacity-100`
  (ZoomableChart.tsx:88) → su un dispositivo senza hover **non compaiono mai**.
  L'utente mobile non può nemmeno aprire il fullscreen (che sarebbe la
  soluzione naturale ai grafici stretti!).
- Zoom solo `Ctrl+rotella` (:43), reset solo doppio click (:80): **zero supporto
  pinch/touch**.

### P4. Tutte le slide montate e animate insieme
**Misurato:** aprendo la dash energia, **19 SVG recharts** montati
contemporaneamente, con grafici posizionati a x=782, 965, 1157px (fuori schermo);
**16 animazioni attive** anche per contenuti invisibili. Il track del carosello
è `translateX(-N*100%)` con tutte le slide `w-full flex-shrink-0` affiancate
(:3726-3728). Su un telefono medio questo produce jank e scatti percepiti come
"widget che si muovono", oltre a consumare batteria per grafici che nessuno vede.

### P5. Elementi che si spostano (layout shift)
In demo il CLS misurato è 0 perché i mock sono sincroni; **con dati reali** i
meccanismi di shift nel codice sono:
1. ~~Asse meteo che appare dopo il fetch~~ **CORREZIONE dopo verifica sul
   codice**: gli YAxis meteo dei grafici energy-outdoor sono renderizzati
   incondizionatamente e l'header temp ha un fallback statico sempre presente
   (`outdoorTemp ?? project.data.temp`) — questo rilievo della prima analisi
   era errato, nessun intervento necessario.
2. **`DataSourceBadge` e badge di stato** che passano da loading a contenuto con
   larghezza diversa dentro flex row (:3769) → gli elementi adiacenti slittano.
3. **Unità `vh`** (`max-h-[calc(100vh-80px)]` :5702, modal `h-[88vh]`
   ZoomableChart.tsx:151): nel browser mobile la barra URL che si
   comprime/espande cambia il valore di `100vh` → il contenuto salta durante lo
   scroll. (Nell'app Capacitor non c'è barra URL, ma la PWA ne soffre.)
4. Spinner sostituiti da contenuti di altezza diversa (39 spinner, 1 skeleton).

### P6. Barre orizzontali che sforano senza segnalarlo
**Misurato a 375px:**
- Barra tab vista sito: contenuto **571px in 343 visibili** → Export PDF e
  Settings invisibili da telefono (già analizzata in dettaglio, v. conversazione).
- **Barra comandi mappa: 450px in 375** → sfora anche la barra principale della
  home (regioni + moduli + KPI).
- Una card della overview con scroll interno: 413px in 317.
- Nessuna delle tre ha indicatori di scroll (fade/frecce); `scrollbar-hide` usata
  nel codice **non è definita da nessuna parte** (plugin non installato) → no-op.

### P7. Pattern hover-only diffusi oltre i grafici
Tooltip soglie aria `w-[340px]` posizionato `right-0` hover-only
(AirCustomComponents.tsx:146) → su touch inaccessibile, e comunque sforerebbe.
Tabella KPI `grid-cols-4` in overflow-x (:148-169).

### P8. Navigazione slide poco leggibile
Dot indicatori **6×6px misurati** (intoccabili — ok come indicatori, ma nessun
titolo slide visibile: l'utente non sa cosa c'è dopo "2/5"). Frecce 44px ok.
`safe-area-inset-bottom` non gestito su frecce/dots → rischio collisione con
l'home indicator iOS.

### P9. Testi sotto soglia residui
4 nodi a **8px** e 5 a 10px misurati sulla sola overview (il lotto 3 aveva
portato a 11px le etichette principali, ma non è arrivato ovunque).

---

## Soluzioni

### Principi (per "adattarsi ai vari smartphone" senza inseguire ogni modello)
1. **Mai px fissi per dimensioni di layout**: altezze grafici in
   `clamp(200px, 32dvh, 320px)`; `dvh`/`svh` al posto di `vh` (risolve i salti
   da barra URL); larghezze in % o `minmax()`.
2. **Capability query, non solo width query**: `@media (hover: none)` /
   `(pointer: coarse)` per decidere tooltip-tap vs hover e pulsanti sempre
   visibili — distingue un touch device VERO da una finestra stretta.
3. **Container queries per le card** (`@tailwindcss/container-queries` è GIÀ
   installato e già usato in una card): ogni card si adatta al proprio
   contenitore, non al viewport → funziona uguale su phone, split-screen,
   tablet.
4. **Un solo punto di verità**: `src/lib/chartConfig.ts` che dato
   `{width, isTouch}` restituisce tick interval, font, margini, altezza, max
   serie. I chart lo consumano; niente più valori sparsi in 27 punti.

### Interventi per problema

**S1 — Config grafici adattiva (per P1)**
- `XAxis`: `interval="preserveStartEnd"` + `minTickGap={24}` ovunque (2 props,
  elimina da solo le sovrapposizioni); formatter breve su mobile ("19/07" non
  "19/07 16:57").
- Altezze: `clamp()` via chartConfig; su mobile 240px è il minimo leggibile
  per un line chart, i 500px fullscreen diventano `72dvh`.
- Serie: su mobile max 3-4 visibili di default, il resto aggregato in "Altri"
  con legenda-chip tappabile per attivarle; legenda sopra il grafico, una riga
  scrollabile, mai wrappata dentro l'altezza del chart.

**S2 — Heatmap mobile (per P2)**
- Celle a larghezza calcolata `(100cqw - labels) / colonne` con minimo 12px;
  sotto il minimo, aggregazione (vista anno → settimane: 5 colonne, non 31).
- Tooltip → **tap sulla cella** apre valore in un chip fisso sotto la heatmap
  (non popup ancorato): un pattern, zero hover.

**S3 — ZoomableChart touch (per P3)**
- Pulsanti sempre visibili con `@media (hover: none)`; oppure tap sul grafico =
  apri fullscreen (comportamento atteso su mobile).
- Fullscreen in **landscape suggerito** ("ruota il telefono" hint): è la vera
  risposta ai grafici stretti — larghezza x2 gratis su ogni smartphone.
- Pinch-to-zoom nel fullscreen (touch events già gestiti nel carosello, stesso
  pattern).

**S4 — Montare solo le slide vicine (per P4)**
- Renderizzare slide attiva ± 1 (lo swipe resta fluido), placeholder vuoto per
  le altre: `{Math.abs(i - currentSlide) <= 1 ? <Slide/> : <div className="w-full flex-shrink-0"/>}`.
- `isAnimationActive={false}` sui recharts su mobile (le animazioni di
  ingresso dei chart sono il grosso delle 16 attive).
- Beneficio collaterale: meno memoria → meno crash del WebView su telefoni
  con poca RAM.

**S5 — Stabilità layout (per P5)**
- Asse meteo: riservare SEMPRE lo spazio del secondo YAxis (renderlo con
  `tick={false}` finché il dato non c'è) → il grafico non salta.
- Badge: larghezza minima fissa sul contenitore del badge.
- Sostituire `vh` → `dvh` (5 occorrenze note).
- Skeleton con la STESSA altezza del contenuto finale sulle card slide
  (chartConfig fornisce l'altezza → lo skeleton la conosce).

**S6 — Barre scrollabili oneste (per P6)**
- Vista sito: split navigazione/filtri come già concordato (icone su riga
  propria, periodo su riga sotto, Export+Settings in menu ⋯).
- Barra mappa: stesso trattamento — a <400px il blocco KPI va su una seconda
  riga o dentro il bottom sheet esistente.
- Dove resta uno scroll orizzontale: fade laterale + `scroll-snap` + definire
  davvero `scrollbar-hide` (plugin `tailwind-scrollbar-hide` o utility custom).

**S7 — Un pattern unico per i dettagli su touch (per P7)**
- Regola di progetto: **niente contenuto solo-hover**. Tooltip complessi →
  bottom sheet (vaul è già in dipendenza); valori puntuali → tap-toggle.

**S8 — Orientamento slide (per P8)**
- Titolo slide visibile ("2/5 · Heatmap CO₂") accanto ai dots — chiavi i18n
  già esistenti per i nomi.
- `safe-area-inset-bottom` sul footer del carosello.

**S9 — Sweep finale tipografia (per P9)**
- Grep `text-[8px]|text-[9px]|text-[10px]` → 11px minimo, come da lotto 3.

---

## Piano per lotti (impatto / sforzo)

| # | Intervento | Impatto | Sforzo | Note |
|---|---|---|---|---|
| 1 | S1a: `interval`+`minTickGap`+formatter su tutti gli XAxis | **Altissimo** (leggibilità) | Basso | 2 props ripetute, zero rischio |
| 2 | S4: slide attiva ±1 + stop animazioni offscreen | Alto (fluidità percepita) | Basso | 1 punto nel track |
| 3 | S3: ZoomableChart visibile+tap su touch | Alto | Basso | sblocca il fullscreen che già esiste |
| 4 | S6: split barre (sito + mappa) + fade scroll | Alto | Medio | già progettato |
| 5 | S5: dvh + spazio asse meteo + badge fissi | Alto (stop "si muove") | Basso | |
| 6 | S1b: chartConfig centrale + clamp altezze | Alto | Medio | rifattorizza i 27 punti |
| 7 | S2: heatmap tap + aggregazione colonne | Medio-alto | Medio | |
| 8 | S1c: max serie + legenda chip | Medio | Medio | |
| 9 | S7: pattern bottom-sheet per tooltip | Medio | Medio | |
| 10 | S8+S9: titoli slide, safe-area, sweep font | Medio | Basso | |

I lotti 1-5 sono fattibili **senza** aspettare lo split di ProjectDetail.tsx;
il 6 (chartConfig) è propedeutico allo split e lo semplifica.

## Cosa NON fare
- Non riscrivere le dashboard "mobile-first da zero": il problema è la
  configurazione, non la struttura; il carosello + card regge bene.
- Non fare media query per singoli device (iPhone X, S22…): con
  clamp/dvh/container query l'adattamento è continuo su qualunque schermo.
- Non toccare i 51 useEffect né lo split del file in questo lotto (già
  pianificati a parte).

## Nota su come riprodurre le misure
Server demo: `npm run dev -- --mode demo --port 8081` (usa `.env.demo`, creato
per questo scopo: azzera le variabili Supabase → mock + no login; non influenza
`npm run dev` normale né le build).
