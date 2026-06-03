
# FGB Wrapped — Integrazione nel dashboard

Il file `fgb-wrapped-v3-5.html` (10 slide, animazioni CSS, font Futura già presenti) viene portato dentro l'app come esperienza interattiva fullscreen ("Wrapped") con dati reali settimanali (vs settimana precedente), differenziata per ruolo. Il `PdfReportGenerator` resta intatto per il report dettagliato; il Wrapped offre invece un download "veloce" del riepilogo settimanale dall'ultima slide.

## 1. Architettura componenti

Nuova cartella `src/components/wrapped/`:

```text
wrapped/
  WrappedPlayer.tsx          // overlay fullscreen, gestione slide, swipe/tastiera, splash
  WrappedSlide.tsx           // wrapper con animazioni eyebrow/stat/headline/body
  slides/
    SlideWelcome.tsx         // S1
    SlideEnergyTotal.tsx     // S2  kWh + vs last week, on/off target
    SlideBestDay.tsx         // S3  "Golden Day" (giorno con minor consumo)
    SlideWater.tsx           // S4
    SlideCO2.tsx             // S5  kg CO₂ evitati
    SlideTreedom.tsx         // S6  equivalente alberi
    SlideAirQuality.tsx      // S7  giorni con aria migliore (solo se modulo IAQ attivo)
    SlideLeaderboard.tsx     // S8  multi-sito: top performer per EUI
    SlideMostImproved.tsx    // S9  multi-sito: sito più migliorato (%)
    SlideRecap.tsx           // S10 riepilogo + bottone "Download weekly PDF"
  variants/
    MonoSiteWrapped.tsx      // ordina slide per caso A
    MultiSiteWrapped.tsx     // caso B (holding/brand): leaderboard + improved + global CO₂
    AdminGlobalWrapped.tsx   // caso C: AMER → APAC → EU → MEA, totali piattaforma
  hooks/
    useWrappedData.ts        // entrypoint, sceglie variant in base allo scope
    useSiteWeeklyWrap.ts     // dati settimanali per singolo sito
    useAggregateWeeklyWrap.ts// dati settimanali per insieme di siti (holding/brand/admin)
  lib/
    wrappedMath.ts           // EUI, % delta vs last week, CO₂, alberi
    wrappedPdf.ts            // export "quick weekly summary" (jsPDF, ~2 pagine)
  styles/wrapped.css         // copia adattata del CSS dell'HTML (token --teal, grain, ecc.)
```

Lo style globale resta isolato dentro `.wrapped-root` per non leakare nel resto dell'app.

## 2. Trigger / accesso al Wrapped per ruolo

Casistiche dal brief, mappate sull'esistente:

- **Caso A — Mono-sito (Facility/Store Manager)**: il Wrapped del proprio store parte da:
  - badge "✨ Weekly Wrapped" nel `Header` (visibile quando il sito ha dati della settimana corrente);
  - voce nel `ProjectSettingsDialog` (la rotella dell'ingranaggio del sito) → "Play Weekly Wrapped".
- **Caso B — Multi-sito (Holding/Brand Energy Manager)**:
  - dentro `BrandOverlay` / `HoldingOverlay` (o `RegionOverlay` per holding): bottone "Play Weekly Wrapped" che lancia `MultiSiteWrapped` sull'insieme dei siti visibili (holding cumulato, oppure brand cumulato);
  - dentro la rotella del singolo sito resta disponibile il Wrapped mono-sito.
- **Caso C — FGB Studio Admin**:
  - nuova card in `src/pages/Admin.tsx` ("Global Weekly Wrapped") che apre `AdminGlobalWrapped` (mondo → AMER, APAC, EU, MEA);
  - già nei dialog di `BrandsManager` / `SitesManager` aggiungiamo un'azione "Play Wrapped as client" (impersonation visiva: passa l'ID a `WrappedPlayer` come se fosse l'utente).

`useUserScope` viene già usato in `Index.tsx`: il componente badge in `Header` consulta lo scope per decidere se mostrare il trigger e quale variant aprire.

## 3. Dati e calcoli settimanali

Settimana = ISO week (lun–dom) corrente vs settimana precedente, in `site.timezone`.

Fonti già in DB:
- `energy_daily` (metric `energy.active_import_kwh`/`energy.active_energy`) → totali, giornaliero, golden day.
- `telemetry_daily` (CO₂, temp, hum, VOC, PM) → IAQ.
- tabelle water (`water_*` se modulo attivo) → litri/leak.
- `events` con `status='active'`/`resolved` → alarms risolti.
- `sites.surface_m2` (o equivalente, da verificare) → EUI = kWh / m².

Calcoli chiave (`wrappedMath.ts`):
- **Δ% energia vs last week** + flag `onTarget` confrontando con `site_thresholds` (`useSiteThresholds`).
- **Golden day**: giorno con `value_sum` minimo (solo giorni con dati completi).
- **CO₂ evitata**: confronto Δ kWh * `CO2_EMISSION_FACTOR_KG_KWH` (già presente in `PdfReportGenerator`, fattorizzare in shared `lib/co2.ts`).
- **Alberi (Treedom)**: kg CO₂ / 21 kg per albero/anno → arrotondamento prudente.
- **Multi-sito leaderboard**: ordina per EUI (kWh / m²) ASC; gestire `surface_m2` mancante escludendo il sito + tooltip "missing area".
- **Most improved**: max Δ% riduzione settimana corrente vs precedente (esclude siti < 7 giorni storia).
- **Admin globale**: aggrega per regione (`sites.region`), totale CO₂ evitata piattaforma.

Per Mono e Multi i dati arrivano via hook che riusano la stessa logica di `useAggregatedSiteData.ts` ma limitata a finestre `current_week` / `previous_week`.

Politica "no fake data": se la metrica non ha dati reali per la settimana, la slide si auto-nasconde (es. niente IAQ per siti senza modulo aria, niente Water se non attivo).

## 4. UX del player

- Splash 2 s (riusiamo `#splash-glow`).
- 10 slide animate (auto-advance opzionale o manuale). Tap zone sinistra/destra come nell'HTML, frecce ⇦/⇨, swipe touch.
- Bottone "Esci" (X) in alto a destra; ESC chiude.
- Ultima slide (Recap) → bottone **"Download weekly PDF"** che chiama `wrappedPdf.ts` (jsPDF, 1–2 pagine, riusa colori e fattore CO₂; titoli ITA/ENG via `LanguageContext`).
- Tutto i18n via `t()` da `LanguageContext`.

## 5. Modifiche puntuali ai file esistenti

- `src/components/dashboard/Header.tsx`: bottone "Weekly Wrapped" condizionale.
- `src/components/dashboard/ProjectSettingsDialog.tsx`: nuova sezione "Weekly Wrapped" con play button.
- `src/components/dashboard/BrandOverlay.tsx` / `RegionOverlay.tsx`: CTA play per scope multi-sito.
- `src/pages/Admin.tsx`: card "Global Weekly Wrapped" + azione "Play as client" nei manager rilevanti.
- `src/pages/Index.tsx`: monta `<WrappedPlayer>` a livello globale guidato da context.
- Nuovo `WrappedContext` (provider in `App.tsx`) per aprire il player da qualsiasi punto: `open({ scope: 'site'|'brand'|'holding'|'global', id })`.

## 6. Asset e font

- I font Futura sono già in `public/fonts/` → `wrapped.css` li richiama.
- L'immagine base64 della splash dell'HTML viene salvata come file in `src/assets/wrapped/splash.jpg` (lovable-assets) per ridurre il bundle.
- Nessuna libreria nuova: tutto con React + CSS animations già usati nel progetto (no Motion/GSAP richiesti).

## 7. Cosa NON viene toccato

- `PdfReportGenerator.tsx`: invariato, resta il report dettagliato.
- Schema DB: nessuna migrazione necessaria. Se manca `sites.surface_m2` o equivalente per EUI, lo verifichiamo in fase build e in caso aggiungiamo una colonna opzionale con migration dedicata.

## 8. Step di build (ordine d'implementazione)

1. Setup base: `WrappedContext`, `WrappedPlayer`, `wrapped.css`, `SlideWelcome` (smoke test su un sito demo).
2. Hook `useSiteWeeklyWrap` + slide caso A (S2–S7) + integrazione in `ProjectSettingsDialog` e Header.
3. Hook `useAggregateWeeklyWrap` + variant Multi-sito + slide leaderboard / improved + trigger da overlay holding/brand.
4. Variant Admin globale + impersonation + card in Admin.
5. SlideRecap + `wrappedPdf.ts` (quick weekly PDF).
6. QA: verifica con siti senza dati (slide nascoste correttamente), test responsive desktop/mobile, ESC/keyboard/swipe.

## Domande aperte (rispondibili anche dopo lo start)

- Confermi che la "settimana" è ISO (lun–dom) e non rolling 7 giorni?
- Per il caso B (holding multi-brand), preferisci un Wrapped unico cumulato o uno separato per brand selezionabile prima del play?
- Per l'admin "impersonation": ti basta lanciare il Wrapped come quel cliente (visuale), o serve loggare l'azione per audit?

Posso procedere con lo Step 1 appena confermi.
