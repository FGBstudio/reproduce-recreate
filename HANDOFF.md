# HANDOFF — FGB Monitoring: stato del progetto

> Documento di passaggio di consegne. Leggere questo file per intero prima di
> toccare il codice. Autore: sessione di analisi/refactor precedente.

## Contesto in una riga
App di monitoraggio energetico/ambientale (React 18 + TypeScript + Vite +
Supabase, creata con Lovable) da portare ad app nativa iOS/Android via Capacitor,
dopo pulizia del codice e correzione delle criticità UX.

## Regole di lavoro concordate col proprietario (IMPORTANTI)
1. **Niente rotture.** Il codice in produzione serve clienti reali. Ogni modifica
   va su branch, mai diretta su `main`. Ogni intervento = 1 commit reversibile.
2. **NON toccare `mqtt-ingestion/`** (root): è il servizio di ingestione dati dei
   clienti, fonte di verità confermata. `services/mqtt-ingestion/` è la copia
   OBSOLETA e divergente, da rimuovere quando il proprietario darà l'ok.
3. **NON toccare `supabase/`** (migrazioni, edge functions) né il database.
4. **Lovable è ancora in uso** sul branch main: `src/integrations/supabase/client.ts`
   è auto-generato, non modificarlo a mano.

## Stato attuale
Branch `refactor/cleanup` = 23 commit già applicati sopra `main`.
Vedere `CLEANUP_NOTES.md` per l'elenco puntuale dei 23 interventi.
Vedere `ANALISI_FRONTEND_FGB.md` (analisi per pagina/sezione) e
`AUDIT_UX_MOBILE_FGB.md` (audit UX mobile con misurazioni) per il dettaglio.

Sintesi dei 3 lotti già completati:
- **Lotto 1 — struttura**: Capacitor isolato dal preview Lovable, progetti nativi
  android/ e ios/ generati, client Supabase unificato, immagini/asset ottimizzati
  (-35MB), lazy loading route + PDF on-demand, fix violazione Rules of Hooks.
- **Lotto 2 — integrità dati**: vietati i mock in produzione (prima un fallimento
  della telemetria mostrava dati FINTI come reali), badge Live coerente, stato
  NO_DATA al posto del falso "Critical", soglie CO2 canoniche in lib/airQuality.ts,
  clustering marker mappa, PDF catturato a 1200px, video 17,4MB -> 4,2MB.
- **Lotto 3 — UX mobile**: autocomplete login (portachiavi iOS), zoom sbloccato,
  touch target >=44px, haptics + back hardware Android (lib/native.ts), banner
  offline, overlay progresso PDF, share sheet nativo, hold-to-pause nel Wrapped,
  prefers-reduced-motion.

## Da fare — in ordine di priorità

### A. Verifica preview (subito)
`npm run dev` e controllo visivo/tattile su desktop e telefono
(`npm run dev -- --host` per aprirla da mobile sulla stessa Wi-Fi).

### B. Prima build Android firmata
`npx cap sync` poi `npx cap open android` -> Android Studio ->
Build > Generate Signed Bundle. Serve un keystore (da creare e CONSERVARE:
se si perde non si può più aggiornare l'app sullo store).
Per iOS serve un Mac con Xcode + account Apple Developer.
NB: appId attuale `com.fgbstudio.monitoring` — cambiarlo PRIMA della prima
pubblicazione, dopo è definitivo.

### C. Audit RLS su Supabase (sicurezza, non rimandabile)
La anon key è pubblica nel repo (per design, ma il repo è pubblico): le Row
Level Security policies sono l'UNICA barriera sui dati dei clienti. Verificare
tabella per tabella che siano attive e restrittive. Sola lettura, nessuna modifica
senza conferma del proprietario.

### D. Interventi strutturali rimandati (lotto dedicato, con test)
- Migrazione `AdminDataContext` (893 righe, carica tutto al mount) -> React Query
  con invalidazione mirata. Trascina con sé ~200 `any` residui in api.ts.
- 51 `useEffect` con dipendenze mancanti: correggere caso per caso, MAI in blocco
  (cambiano il comportamento a runtime).
- Split di `ProjectDetail.tsx` (6.890 righe) in componenti; sblocca anche il
  code splitting del chunk charts (556KB).
- Stringhe italiane hardcoded da portare in i18n (l'app è in 5 lingue).
- Skeleton loader al posto dei 39 spinner generici; toast sugli errori di rete.
- Cache offline dell'ultimo snapshot KPI (differenziante, alto sforzo).

### E. Decisioni di PRODOTTO in attesa del proprietario (non implementare da soli)
- Opt-out della leaderboard Wrapped (può creare attriti tra store manager).
- Heatmap energia: scala relativa (attuale) o assoluta confrontabile tra siti?
- Quanto esporre il modulo Bills/OCR (oggi nascosto, è la feature più vendibile).
- Licenze: loghi certificazioni (LEED/USGBC ecc.) e tile CARTO per uso commerciale.
- Label visibili sotto le icone dei moduli (scelta estetica).

## Note tecniche
- Modalità demo: senza variabili Supabase in `.env` l'app parte con dati mock e
  salta il login — utile per screenshot/preview, NON rappresenta i dati reali.
- Dopo `git am` delle patch servono `npm install` e `npx cap sync` (5 dipendenze
  nuove: leaflet.markercluster + @capacitor/haptics, app, share, filesystem).
- `.env` è tracciato nel repo: aggiungerlo a .gitignore è già fatto, ma va
  rimosso dall'indice con `git rm --cached .env` quando il proprietario è pronto.
