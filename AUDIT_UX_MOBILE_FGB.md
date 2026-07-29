# FGB Monitoring — Audit UX Mobile per fase
*Metodo: app renderizzata in viewport iPhone (390×844, touch attivo) con misurazione programmatica di touch target, tipografia, tempi e attributi form; incrociata con l'ispezione del codice. Riferimenti: Apple HIG 44×44pt, Material Design 48×48dp, WCAG 2.1.*

---

## FASE 0 — Primo avvio e caricamento

**Misurato:** First Contentful Paint **1,4s** e DOMContentLoaded 1,2s in locale; trasferimento iniziale **~2,9MB** (chunk JS principale 1,7MB + charts 556KB precaricati). Su rete mobile reale (4G medio ~5Mbps) il primo avvio freddo si stima in **4-6 secondi**.

**Giudizio:** accettabile per una PWA, buono nell'app nativa (asset locali, niente rete per il bundle). Il collo di bottiglia residuo è il chunk monolitico da 1,7MB che contiene ProjectDetail: si scarica e si parsa anche solo per vedere il login.

**Interventi:** ① lazy-load di ProjectDetail (dipende dallo split del file, già in roadmap); ② skeleton della mappa come prima cosa dipinta (oggi esiste `DashboardSkeleton` ma usato solo in alcune viste).

## FASE 1 — Login

**Misurato:** input 350×**40px** (sotto i 44pt ma tollerabile); link "Request Access" **92×20px** e "Contact support" **172×18px** — meno di metà del minimo Apple; font input 12,8px.

**Problema più impattante (invisibile agli screenshot):** i campi **non hanno attributi `autocomplete`** (`autocomplete="email"` / `"current-password"`), né `autocapitalize="none"` o `inputmode`. Conseguenze reali su iPhone: il portachiavi iOS **non propone le credenziali salvate**, niente riempimento automatico, e l'utente ridigita la password a ogni login. Per un'app B2B usata ogni giorno è attrito puro, e si risolve con 4 attributi HTML.

**Altri rilievi:** il viewport ha `user-scalable=no, maximum-scale=1` — dentro il WebView di Capacitor blocca davvero lo zoom (violazione WCAG 1.4.4, e penalizza utenti ipovedenti); i tap target dei due link vanno portati ad almeno 44px di altezza con padding.

## FASE 2 — Home / Mappa

**Misurato:** pulsanti regione AM/AP/EU/ME **29-32×27px con font 10px** — i target più sottodimensionati dell'app, su controlli primari; toggle moduli ⚡🌬💧 36×36px; header (menu, ricerca) 36×36px; zoom Leaflet 38×38px; KPI 60×32px. Praticamente **tutta la barra di comando è sotto i 44pt**.

**Gesti:** pan/pinch della mappa nativi Leaflet, ok. Il tap sul marker apre il sito; con il clustering appena introdotto il tap sul cluster zooma — flusso corretto. Manca però **feedback al tocco**: solo 6 occorrenze di `active:` in tutta l'app e zero Haptics → i tap sui controlli vetrosi non danno conferma tattile/visiva, e su mobile "ho premuto o no?" è la micro-frustrazione più comune.

**Ergonomia del pollice:** la barra inferiore è nella zona giusta (thumb zone). L'header in alto a 36px richiede riposizionamento della mano — accettabile perché usato di rado.

## FASE 3 — Ricerca, menu, filtri

Il burger menu è ben fatto: safe-area gestite esplicitamente (top/left/bottom), filtri Global (holding/brand) raggiungibili, logout isolato in basso col colore di pericolo. La ricerca apre overlay a schermo pieno con lista siti — pattern corretto.

**Rilievi:** le label di sezione nel menu sono a **10px** ("Global Filters", "User Settings") — sotto la soglia di leggibilità comoda (11-12px minimo); i dropdown holding/brand misurano 193×**28px** di altezza → sotto il minimo; nessun campo di ricerca ha `enterkeyhint="search"` per il tasto tastiera contestuale.

## FASE 4 — Vista sito: ingresso e orientamento

La transizione marker→sito è fluida e l'header contestuale (nome, città, meteo) orienta subito. La barra icone dei moduli (grid/energia/aria/acqua/cert + selettore periodo) misura però 36×36px per icona e — rilievo di chiarezza — **le icone non hanno label**: un utente nuovo deve tapparle per scoprire cosa sono. Su schermi ≥390px c'è spazio per label 9-10px sotto le icone o almeno per portare i target a 44px.

**Back navigation:** la freccia in alto a sinistra funziona; nel WebView iOS però lo **swipe-back di sistema dal bordo** farà "indietro browser" (hash history) — da testare sul simulatore: se il comportamento è incoerente col back interno, va gestito (Capacitor espone gli eventi).

## FASE 5 — Navigazione tra slide e moduli

**Buona notizia verificata nel codice:** lo **swipe orizzontale tra le slide esiste** (handler touch dedicato, soglia 50px — valore corretto). Le frecce sono quindi un supporto, non l'unico mezzo. I dot indicatori però sono ~6px: come indicatori vanno bene, ma se l'utente prova a tapparli per saltare a una slide, sono intoccabili — o si ingrandiscono i target invisibili o si lascia esplicitamente il solo ruolo indicatore.

**Profondità:** aria ha 5 slide, energia 4. Con lo swipe attivo la profondità è gestibile; aggiungerei però titoli di slide visibili ("2/5 · Heatmap CO₂") perché oggi l'utente non sa cosa c'è dopo.

## FASE 6 — Lettura dei dati

**Misurato:** sulla vista sito, **27 nodi di testo su 78 visibili sono sotto gli 11px**. Le etichette 10px uppercase con tracking largo sono una scelta stilistica coerente col brand, ma su un'app di *lettura dati* usata in piedi, in negozio, con luce variabile, la soglia pratica è 11-12px. I valori numerici principali invece sono grandi e ben gerarchizzati (score, kWh, ppm) — l'ossatura tipografica è giusta, sono le etichette a essere sacrificate.

**Contrasto:** il tema scuro con testo teal chiaro regge; attenzione alle etichette `text-muted-foreground` su vetro semitrasparente sopra la mappa — in pieno sole il vetro chiaro+testo grigio è il primo a sparire. Test sul dispositivo reale consigliato.

## FASE 7 — Azioni: export PDF, impostazioni

L'export PDF ora cattura a larghezza fissa 1200px (fix applicato) — i report da telefono sono corretti. Restano: **generazione bloccante sul main thread** (secondi di freeze su telefoni medi: serve almeno un overlay di progresso esplicito "Generazione report… 3/6 grafici", lo stato `isGeneratingPdf` esiste già); e la condivisione: su mobile il download del blob è goffo — nell'app nativa conviene usare lo **share sheet** (Capacitor Share plugin) per mandare il PDF su WhatsApp/mail in un tap.

## FASE 8 — Wrapped

Il formato stories è perfetto per mobile e il player è dedicato. Da verificare su device: **tap sulle metà schermo** per avanzare/tornare (standard stories: destra avanti, sinistra indietro) oltre allo swipe; **pausa al long-press**; e la barra di progresso per slide in alto. Se mancano, sono i tre gesti che gli utenti si aspettano per riflesso da Instagram — la loro assenza si nota subito.

## FASE 9 — Admin da mobile

L'area admin (lazy-loaded dal fix) è desktop-first: tabelle larghe, dialog densi. Da telefono è usabile per emergenze ma scomoda — ed è accettabile *se* è una scelta: gli admin lavorano da desktop. Consiglio solo di garantire che le azioni distruttive (delete device) abbiano conferme a prova di tap accidentale, perché un dito è meno preciso di un mouse.

## FASE 10 — PWA, Install, Offline

La pagina Install è chiara e localizzata. Il service worker Workbox precache la shell → **secondo avvio quasi istantaneo**. Ma l'offline è solo di shell: senza rete l'app si apre e mostra vuoti/spinner senza spiegare. Serve un **banner "Sei offline — dati non aggiornati"** (listener `navigator.onLine`) e, in seconda battuta, cache selettiva dell'ultimo snapshot KPI per sito così l'app resta consultabile in metropolitana.

## FASE 11 — Stati di sistema

**Misurato:** 39 spinner generici (`animate-spin`) contro 1 skeleton component usato in 3 punti. Gli spinner non comunicano *cosa* sta caricando né *quanto manca*. Il pattern skeleton va esteso alle card della vista sito (le più attese). Gli empty state ora sono corretti (fix "No Data") — restano da rifinire i messaggi di **errore di rete**: oggi i fallimenti delle query sono per lo più silenziosi (nessun toast d'errore nei layer dati) e l'utente vede solo assenza di dati senza sapere se è un problema suo, della rete o del sito.

## FASE 12 — Accessibilità

I tre rilievi ordinati per gravità: ① zoom bloccato dal viewport meta (`user-scalable=no`) — da rimuovere, l'app non si rompe con lo zoom; ② tap target diffusamente sotto i 44pt (fasi 1-5); ③ **zero supporto a `prefers-reduced-motion`** con un'app ricca di animazioni (count-up, pulse, transizioni): per utenti con sensibilità vestibolare serve il media query che le disattiva. Nota positiva: gli `aria-hidden` sugli elementi decorativi ci sono in più punti.

## FASE 13 — Gesti e "feel" nativo (per il porting Capacitor)

Cosa manca perché l'app *sembri* nativa e non un sito impacchettato: **(a)** Haptics sui tap primari (selezione regione, cambio modulo, cluster) — plugin Capacitor, 1 riga per evento; **(b)** StatusBar coordinata col tema (plugin già installato, va solo configurato il colore); **(c)** gestione del **back hardware Android** (oggi chiude l'app invece di fare back interno — evento `backButton` di Capacitor); **(d)** overscroll/bounce da regolare (`overscroll-behavior` non impostato: su Android il glow di overscroll sulla mappa è straniante); **(e)** long-press sui marker per anteprima rapida (nice-to-have).

---

## Piano d'intervento UX ordinato per impatto/sforzo

| # | Intervento | Impatto | Sforzo |
|---|---|---|---|
| 1 | Attributi autocomplete/autocapitalize sul login | Alto (ogni login, ogni utente) | Minimo |
| 2 | Rimozione `user-scalable=no` | Alto (accessibilità) | Minimo |
| 3 | Touch target barra mappa e barra moduli ≥44px | Alto | Basso |
| 4 | Feedback `active:` + Haptics sui controlli primari | Alto (feel) | Basso |
| 5 | Back hardware Android + overscroll | Alto (nativo) | Basso |
| 6 | Etichette 10px → 11-12px (menu, barre, card) | Medio-alto | Basso |
| 7 | Banner offline + toast errori di rete | Medio-alto | Medio |
| 8 | Skeleton sulle card sito + progress PDF | Medio | Medio |
| 9 | Share sheet per il PDF | Medio | Basso |
| 10 | Label sotto le icone moduli / titoli slide | Medio | Basso |
| 11 | Gesti stories nel Wrapped (tap-zone, pausa) | Medio | Medio |
| 12 | prefers-reduced-motion | Medio (nicchia, dovuto) | Basso |
| 13 | Cache offline ultimo snapshot KPI | Alto (differenziante) | Alto |


---

## APPENDICE — Stato di risoluzione del piano d'intervento

| # | Intervento | Stato |
|---|---|---|
| 1 | Autocomplete/autocapitalize login | ✅ Risolto e verificato (email, current-password, new-password, given/family-name, organization) |
| 2 | Rimozione user-scalable=no | ✅ Risolto e verificato |
| 3 | Touch target ≥44px | ✅ Risolto: regioni, toggle moduli, KPI, header, frecce carosello, link login, dropdown menu (residuo: 1 elemento 36px secondario) |
| 4 | Feedback active: + Haptics | ✅ Risolto: active:scale-95 sui controlli primari; hapticLight su regioni/moduli/tab (lib/native.ts, no-op sul web) |
| 5 | Back Android + overscroll | ✅ Risolto: listener backButton (back interno, minimize alla radice); overscroll-behavior none |
| 6 | Etichette 10px → 11px | ✅ Risolto su menu, KPI panel, header, overview, vista sito |
| 7 | Banner offline | ✅ Risolto e verificato (appare/scompare col ciclo offline/online); toast errori di rete → rimandato |
| 8 | Progress PDF | ✅ Risolto: overlay a schermo con messaggi reali di avanzamento (onProgress esisteva ma era ignorato) |
| 9 | Share sheet PDF | ✅ Risolto: su nativo Filesystem+Share con fallback al download |
| 10 | Label icone/titoli slide | ⚠️ Parziale: title= già presenti sulle tab; label visibili rimandate (scelta estetica da validare con te) |
| 11 | Gesti stories Wrapped | ✅ Tap-zone e progress bar esistevano già; aggiunto hold-to-pause con soppressione avanzamento |
| 12 | prefers-reduced-motion | ✅ Risolto: media query globale |
| 13 | Cache offline snapshot KPI | ⏳ Rimandato (intervento alto sforzo, da lotto dedicato) |
