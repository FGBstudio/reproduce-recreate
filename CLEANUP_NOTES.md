# Note di pulizia — branch refactor/cleanup

## Cosa è stato fatto (ogni voce = 1 commit, annullabile con `git revert`)
1. Capacitor isolato dal preview Lovable + progetti nativi Android/iOS
2. Client Supabase unificato in un'unica istanza (prima erano 2 → doppio GoTrueClient)
3. Immagini hero in WebP (-15MB dal bundle), rimossi 19,8MB di duplicati mai usati
4. Lazy loading route Admin/Install/NotFound + modulo PDF caricato on-demand (-640KB all'avvio)
5. Fix violazione Rules of Hooks in ProjectDetail (useCallback dopo early-return)
6. console.log eliminati solo dalle build di produzione
7. React.memo su SiteMarker (meno re-render sulla mappa)

## Cosa NON è stato toccato (per scelta)
- `mqtt-ingestion/` e `services/mqtt-ingestion/`: NESSUNA modifica (dati clienti).
  ✅ CONFERMATO dal proprietario (lug 2026): la fonte di verità in produzione è
  `mqtt-ingestion/` (root). La copia `services/mqtt-ingestion/` è OBSOLETA e
  divergente: candidata alla rimozione. Rimozione volutamente NON eseguita in
  questo branch; quando pronti: `git rm -r services/mqtt-ingestion` (reversibile).
- `supabase/` (migrazioni, edge functions): nessuna modifica al database.

## Azioni manuali consigliate (fuori da questo branch)
- `.env` è tracciato nel repo pubblico. Contiene solo la anon key (pubblica per
  design, protetta dalle RLS), ma il pattern è rischioso. Quando possibile:
  `git rm --cached .env` + spostare le variabili nei secrets del sistema di build.
- VERIFICARE le Row Level Security policies su Supabase: con la anon key pubblica
  sono l'UNICA barriera sui dati dei clienti.
- I video in `public/videos` (17MB) finiranno nell'app nativa: valutare compressione
  o caricamento da CDN.

## Convivenza con l'editor Lovable (in uso attivo)
- `src/integrations/supabase/client.ts` è auto-generato da Lovable: NON modificarlo
  a mano. L'unificazione dei client è stata fatta nella direzione sicura:
  `src/lib/supabase.ts` IMPORTA l'istanza dal file generato, quindi se Lovable
  lo rigenera non si rompe nulla.
- Lovable lavora sul branch main: applicare e mergiare questo branch in un
  momento di pausa dalle modifiche via Lovable, per minimizzare i conflitti.
- Se in futuro Lovable riscrive per intero `ProjectDetail.tsx`, ricontrollare
  che il `useCallback` di export PDF resti PRIMA di `if (!project) return null;`
  (lint: `npx eslint src --ext .ts,.tsx | grep rules-of-hooks` deve dare 0 risultati).

## Secondo lotto (stesso branch) — integrità dati e UX
8. Mock vietati in produzione: fallback a serie vuote, mai dati finti
9. LiveBadge spento su dati non reali; stato NO_DATA al posto del falso Critical
10. Soglie CO2 canoniche in src/lib/airQuality.ts (prima 3 versioni incoerenti)
11. Clustering marker mappa (leaflet.markercluster, badge brandizzato)
12. PDF: chart catturati a larghezza fissa 1200px anche da mobile
13. Contatori login in src/lib/companyStats.ts; loghi certificazioni WebP
14. Video demo: 17,4MB -> 4,2MB (1280p, CRF27, audio preservato)
15. Hook Wrapped tipizzati (29 any -> 2)

## Terzo lotto — UX mobile
16. Login: autocomplete/autocapitalize (portachiavi iOS/Android funzionante)
17. Zoom sbloccato (rimosso user-scalable=no), prefers-reduced-motion, overscroll none
18. Touch target >=44px su tutte le barre principali; etichette 10->11px
19. Haptics (lib/native.ts) + back hardware Android gestito
20. Banner offline globale; overlay progresso PDF; share sheet nativo per il PDF
21. Wrapped: hold-to-pause aggiunto alle tap-zone esistenti
NB: nuovi plugin nativi (@capacitor/haptics, app, share, filesystem) -> rifare npx cap sync
