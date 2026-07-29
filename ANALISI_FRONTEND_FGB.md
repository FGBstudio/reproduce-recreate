# FGB Monitoring — Analisi capillare del frontend
*Analisi condotta su build demo (dati mock) con navigazione reale dell'app renderizzata + lettura del codice sorgente. Branch: refactor/cleanup.*

---

## 1. Login / Auth (`pages/Auth.tsx` + `FloatingBentoPanel.tsx`, 952 righe)

**Cosa mostra.** Form email/password su fondo teal brand, claim "Welcome back / Sign in to your FGB Studio account", link "Request Access" e "Contact support", footer con contatori marketing (60 countries, 6000+ buildings, 300 clients). Su desktop il `FloatingBentoPanel` affianca un pannello vetrina con i mockup dei device (Mac/iPad/iPhone, ora in WebP) e 5+ video demo (`app-nav`, `dashboard`, `report`, `analysis`, `ocr-scan`).

**Rilievi.**
- I contatori (60/6000+/300) sono **hardcoded nel JSX**: se crescono i clienti, nessuno si ricorderà di aggiornarli. → Spostarli in una costante di config o in tabella Supabase.
- I video pesano **17MB** e finiranno dentro il binario dell'app nativa. Su mobile il bento panel probabilmente non si vede nemmeno. → Comprimerli (H.265/AV1, ~3-4MB totali) o servirli da CDN/Supabase Storage con `poster` statico.
- Il flusso "Request Access" e "Contact support": verificare dove puntano (mailto? form?) — su app store Apple richiede che i link di supporto funzionino davvero.
- Gestione recovery password presente (`isPasswordRecovery` con "deviatore di rotta" in ProtectedRoute) — ben fatto.

---

## 2. Mappa globale (`MapView` + `SiteMarker` 747 righe + `RegionNav`)

**Cosa mostra.** Leaflet con tile CARTO, marker custom a goccia con il logo FGB per ogni sito. Barra inferiore: selettore vista globo/regioni (AM, AP, EU, ME), toggle moduli energia/aria/acqua, pulsante KPI. Header: burger menu, ricerca, logo. Su desktop si aggiungono filtri "All Groups" (holding) e "All Clients" (brand) e il pulsante Wrapped.

**Rilievi.**
- **Marker sovrapposti**: i 3 siti europei si impilano l'uno sull'altro già a zoom continentale (visibile negli screenshot). Manca il **clustering** (`leaflet.markercluster` o supercluster): con decine di siti reali per città la mappa diventa illeggibile. È il rilievo UX più importante di questa schermata.
- `SiteMarker` ora è memoizzato (fix applicato), ma resta un componente da 747 righe con animazioni e stato interno: candidato a split.
- I toggle moduli in basso (⚡🌬💧) non hanno etichetta né stato attivo/inattivo evidente al primo sguardo: un utente nuovo non capisce che filtrano i marker. → tooltip al primo uso o label sotto l'icona.
- Tile CARTO: verificare i termini d'uso per app commerciale (CARTO basemaps hanno limiti free-tier); considerare MapTiler/Mapbox con chiave propria.

## 3. Pannello KPI mobile (`MobileKpiPanel.tsx`)

**Cosa mostra.** Bottom sheet con KPI aggregati della regione corrente: **Energy Intensity** (kWh/m² — diviso per 1000 nel render), **Air Quality score** qualitativo (GOOD/MODERATE/POOR) con CO₂ media in ppm, **dispositivi online**. Dati da `useRegionEnergyIntensity` con fallback ai KPI statici della regione.

**Rilievi.**
- Il fallback `realIntensity ?? region?.kpi?.intensity ?? 0` significa che **senza telemetria mostra il valore statico di config senza segnalarlo**: l'utente non distingue un KPI reale da uno di default. → riusare il `DataSourceBadge` (esiste già!) anche qui.
- `(displayIntensity / 1000).toFixed(2)`: la divisione per 1000 è magic number nel render — se l'unità a monte cambia, il numero mostrato sballa in silenzio. → centralizzare le conversioni unità in `lib/`.
- Le soglie GOOD/MODERATE/POOR sono cablate nel componente: dovrebbero essere le stesse soglie usate nelle dashboard aria (unica fonte).

## 4. Burger menu, Ricerca, Overlay regione

**Cosa mostrano.** Il menu laterale raccoglie profilo, navigazione, lingua (5 lingue: EN/IT/FR/ES/ZH), tema, install, logout. La ricerca apre un overlay con la lista siti filtrabile. Il tap su una regione (es. EU) zooma la mappa e apre il `RegionOverlay` con i KPI di regione.

**Rilievi.**
- La ricerca filtra per nome sito: con centinaia di siti servirà anche ricerca per città/brand/tag e ordinamento per rilevanza. Ora è sufficiente.
- i18n: l'infrastruttura c'è ed è estesa (LanguageContext monolitico con tutte le stringhe inline, 161+ chiavi solo per `pd.*`). Funziona, ma il file crescerà all'infinito: valutare split per namespace o i18next con file JSON per lingua. Alcune stringhe sono ancora hardcoded in italiano nel codice (es. "Accesso Negato", messaggi di errore Auth): incoerente per utenti EN/ZH.

## 5. Overview Client / Holding (`BrandOverlay.tsx` 963 righe + filtri desktop)

**Cosa mostra.** Selezionando holding ("All Groups") o brand ("All Clients") su desktop si apre l'overlay aggregato: KPI del portafoglio del cliente filtrati per regione e moduli attivi. È la vista "overview client/holding" richiesta dai ruoli client (auto-filtro per ruolo in `Index.tsx`: un utente brand vede solo il suo brand, ecc.).

**Rilievi.**
- La logica di scoping per ruolo (FGB vede tutto, client vede il suo perimetro) è implementata via `useUserScope` con auto-apply dei filtri: **design corretto**, ma la sicurezza effettiva dipende dalle RLS lato DB, non da questi filtri UI. (Richiamo: audit RLS pendente.)
- ~~Gap mobile~~ **CORREZIONE dopo verifica sul codice**: i filtri holding/brand SONO raggiungibili da mobile tramite il burger menu ("Global Filters") e il BrandOverlay si mostra anche su mobile. Il rilievo iniziale era errato. Resta valido un rilievo minore: la scopribilità (l'utente deve sapere di aprire il menu).
- 963 righe in un file: da spezzare (header, KPI grid, liste siti).

## 6. Vista Sito (`ProjectDetail.tsx`, 6.890 righe) — il cuore dell'app

Architettura a **dashboard commutabili** dalla barra icone in alto, ognuna con un proprio carosello di slide (frecce + dots in basso): overview (1 slide), **energy (4)**, **air (5)**, **water (3)**, **certification (1)**, **bills (1)**.

### 6a. Overview sito
Scheda principale: score complessivo 0-100 con cerchio, giudizio (Excellent→Critical), badge LIVE e DEMO, stato moduli energia/aria/acqua, contatore alert; sotto, card **Site Fingerprint** (radar dello score per dimensione); meteo locale e temperatura nell'header col nome sito.

**Rilievi.**
- **Empty state "0 — Critical"** (già segnalato): sito senza telemetria = allarme rosso. Serve stato dedicato "in attesa di dati" (grigio, icona orologio), distinto da un vero score 0.
- Il badge DEMO c'è ed è visibile: ottimo pattern, va solo reso sistematico (v. rilievo trasversale sui mock).
- Il "LIVE" verde appare anche quando i dati sono mock/demo: contraddittorio (LIVE + DEMO insieme nello screenshot). Il badge LIVE dovrebbe dipendere da `isRealTimeData`.

### 6b. Dash Energy (4 slide)
Dalle chiavi i18n e dal codice: trend giornaliero kWh, profilo giornaliero (curva di carico), breakdown per device/categoria, energia cumulata, potenza media kW, costo stimato (con CurrencyContext multi-valuta), confronto actual vs average, correlazione **energia vs meteo esterno** (`EnergyWeatherCorrelation.tsx`), heatmap oraria con legenda a 5 livelli, periodi tariffari, carbon footprint.

**Rilievi.**
- **Il rilievo più serio dell'intera analisi** — riga ~1280:
  `const filteredEnergyData = realTimeEnergy.isRealData ? realTimeEnergy.data : mockEnergyData;`
  In **produzione**, se la query telemetria fallisce o torna vuota, la dashboard mostra **dati mock come se fossero del sito**. Un cliente può prendere decisioni su numeri finti. Il badge DEMO mitiga solo se sempre visibile e compreso. → In produzione il fallback deve essere un empty state ("telemetria non disponibile"), MAI mock. I mock vanno riservati a `!isSupabaseConfigured` o al flag `showDemo` esplicito del modulo.
- Heatmap: le soglie colore sono calcolate nel componente con scala relativa min/max del periodo: due siti con consumi diversissimi appaiono "ugualmente rossi". Valutare scala assoluta configurabile per confrontabilità.
- Costo stimato: dipende da `useSiteEnergyPriceHistory` (prezzi per sito) — verificare la UX quando il prezzo non è configurato (mostra 0€? nasconde la card?).

### 6c. Dash Air (5 slide)
CO₂ (ppm) con giudizi qualitativi, temperatura, umidità, comfort range, selettore device (`AirDeviceSelector`), componenti custom (`AirCustomComponents`, 8 errori lint), zone critiche, anomalie.

**Rilievi.**
- Le stesse soglie qualitative (EXCELLENT→CRITICAL) sono duplicate in almeno 3 punti (KPI panel, ProjectDetail switch `getAqColor`, heatmap labels): → un solo modulo `airQualityThresholds.ts`.
- 5 slide sono tante su mobile: i dots sono piccoli e le frecce in basso competono con la gesture di sistema. Valutare swipe orizzontale nativo sul carosello (embla è già in dipendenza via shadcn carousel).

### 6d. Dash Water (3 slide)
Consumo idrico, trend, breakdown. Modulo spesso disattivato per sito (`ModuleGate`/`ModuleLockedNotice`: la card "modulo non attivo" con notice "dati esemplificativi" quando `showDemo`).

**Rilievi.**
- Il pattern ModuleGate → demo con disclaimer è ben pensato (testo i18n `module.demo_data_notice` presente in 5 lingue). Assicurarsi che il disclaimer sia visibile su OGNI slide demo, non solo sulla prima.

### 6e. Certificazioni (1 slide)
Widget LEED (`LEEDCertificationWidget`), loghi BREEAM/WELL/GRESB/Fitwel/Envision/LIFE presenti in `public/`, "certified since", categorie e punteggi (gestione da admin via `LEEDCertificationsDialog`).

**Rilievi.**
- I loghi certificazioni sono PNG non ottimizzati (fino a 194KB il singolo logo): micro-ottimizzazione WebP possibile (~-70%).
- Uso dei loghi ufficiali degli enti: verificare le brand guidelines (LEED/USGBC richiede autorizzazione per uso commerciale del marchio).

### 6f. Bills — Analisi bollette (`BillAnalysisModule.tsx`, 793 righe)
Upload bolletta → analisi AI/OCR (edge function), estrazione periodo, importi, confronto con telemetria.

**Rilievi.**
- Funzione distintiva e vendibile: oggi è nascosta dentro la vista sito. Sarebbe da esporre di più (voce nel menu, CTA nell'overview quando delta bolletta/telemetria supera soglia).
- Gestire esplicitamente i fallimenti OCR (bollette scansionate male): stato "analisi non riuscita, inserisci manualmente".

## 7. Wrapped (22 slide, 3 varianti)

**Cosa mostra.** Recap in stile "Spotify Wrapped": varianti **MonoSite** (settimanale/mensile del singolo sito: energia, aria, alert, score, archetipo, benchmark peer, Treedom/CO₂, fun facts), **Aggregate** (portafoglio cliente: totali, leaderboard siti, most improved, CO₂), **AdminGlobal** (globale FGB: regioni, leaderboard, impact). Player a slide con export PDF dedicato (`wrappedPdf.ts`).

**Rilievi.**
- Feature di engagement eccellente e rara nel settore. I 2 hook dati (`useSiteMonthlyWrap` 18 errori `any`, `useSiteWeeklyWrap` 9) sono i più "sporchi" del codebase: da tipizzare per primi, perché calcolano i numeri che il cliente condividerà in giro.
- La leaderboard tra siti del cliente può creare attriti (store manager "ultimo classificato"): prevedere opt-out per cliente o anonimizzazione parziale — decisione di prodotto, non di codice.
- Verificare il comportamento con 1 solo sito (leaderboard di 1) e con dati parziali (settimana incompleta).

## 8. Report PDF (`PdfReportGenerator.tsx`, 951 righe)

**Cosa mostra.** Report multi-pagina con jsPDF + autoTable + cattura grafici via html2canvas: dati progetto arricchiti, telemetria del periodo selezionato, tabelle e chart. Ora caricato on-demand (fix applicato, −640KB all'avvio).

**Rilievi.**
- html2canvas cattura i grafici **come visualizzati**: su mobile i chart stretti producono PDF con grafici minuscoli. → renderizzare i chart per il PDF in un container off-screen a larghezza fissa (es. 1200px).
- Generazione sincrona sul main thread: su telefoni medi l'app si congela per secondi. Mitigare con progress indicator (esiste `isGeneratingPdf`? sì — verificare che l'UI mostri uno stato di avanzamento reale, non solo lo spinner).
- Niente numerazione pagine/indice per report lunghi: nice-to-have.

## 9. Admin (`pages/Admin.tsx` + 15 manager, lazy dal fix)

**Cosa mostra.** CRUD completo: Holdings → Brands → Sites → Projects (gerarchia), Devices (631 righe), utenti client e ruoli, accessi, certificazioni LEED, hierarchy view, settings di modulo per progetto (incl. `showDemo` per modulo).

**Rilievi.**
- `AdminDataContext` (893 righe) carica TUTTO al mount e ogni salvataggio fa refetch completo: con centinaia di siti/device diventerà lento. → migrazione a React Query con invalidazione mirata (già in lista interventi (c)).
- Le tabelle admin non sono virtualizzate: ok fino a ~200 righe, poi serve `@tanstack/react-virtual`.
- `DevicesManager`: è il punto dove si toccano i device MQTT reali — aggiungere conferme esplicite su delete (se non già presenti) perché impatta l'ingestion dei dati clienti.

## 10. Trasversali

**Grafici** (recharts + `ZoomableChart` custom): coerenti, con zoom. Il chunk charts (556KB) è ancora precaricato: splittarlo è possibile ma invasivo (usato ovunque in ProjectDetail); ha senso solo dopo lo split di ProjectDetail.

**Tema e design system**: dark theme di default con palette teal/gold curata, glassmorphism sui controlli mappa, shadcn/Tailwind con CSS variables: solida base. Font custom in `public/fonts` (1,7MB): verificare `font-display: swap` per evitare testo invisibile al primo load.

**Onboarding** (`OnboardingTour`, 500 righe): tour guidato con contatore completamenti per profilo — buono; verificare che non parta sopra la mappa vuota in attesa di dati.

**Skeleton** (`DashboardSkeleton` esiste): usato solo in parte; estenderlo alle slide di ProjectDetail al posto degli spinner.

---

## Sintesi prioritaria (delta rispetto alla lista già nota)

**Nuovi rilievi critici emersi da questa analisi:**
1. **Fallback mock in produzione** (dash energy e affini): dati finti mostrabili come reali se la telemetria fallisce → intervento prioritario, entra nel lotto (c).
2. **Badge LIVE mostrato su dati demo** (incoerenza con badge DEMO).
3. **Marker senza clustering** sulla mappa: degrada con la crescita dei siti.
4. **Gap mobile**: nessuna vista aggregata holding/brand da telefono.
5. **Soglie qualità aria duplicate** in 3+ punti.
6. **PDF: chart catturati a larghezza mobile** → report scadenti da telefono.

**Decisioni di prodotto da prendere (non di codice):** opt-out leaderboard Wrapped; scala heatmap relativa vs assoluta; esposizione del modulo Bills; licenze loghi certificazioni e tile CARTO.


---

## APPENDICE — Stato di risoluzione (branch refactor/cleanup)

**Risolti e verificati con smoke test:**
mock in produzione → serie vuote (mai dati finti); LiveBadge coerente coi dati reali; stato NO_DATA neutro al posto del falso "Critical" (moduli senza telemetria esclusi dalla media overall); soglie CO₂ canoniche in `lib/airQuality.ts` (eliminata l'incoerenza 1200ppm POOR vs MODERATE); clustering marker brandizzato sulla mappa; cattura PDF a larghezza fissa 1200px; contatori login in `lib/companyStats.ts`; loghi certificazioni WebP (−508KB); video demo ricompressi con audio preservato (17,4→4,2MB); hook Wrapped tipizzati (29 any → 2); font-display: swap verificato già presente.

**Rimandati con motivazione (da pianificare):**
migrazione AdminDataContext → React Query (intervento strutturale, va fatto da solo con test dedicati); i ~200 `any` residui in api.ts/AdminDataContext (legati alla migrazione sopra); i 51 useEffect con dipendenze mancanti (da correggere caso per caso, correzioni in blocco rischiano regressioni comportamentali); split di ProjectDetail.tsx (6.890 righe) in componenti; stringhe hardcoded IT da portare in i18n; skeleton loader sulle slide; stato di fallimento OCR nel modulo bollette.

**Decisioni di prodotto in attesa (non di codice):**
opt-out leaderboard Wrapped; scala heatmap relativa vs assoluta; esposizione modulo Bills; licenze loghi certificazioni e tile CARTO.
