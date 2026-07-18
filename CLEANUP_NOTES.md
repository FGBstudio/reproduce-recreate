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
