## Riepilogo situazione attuale

- Il sistema valute è già implementato (DB, edge function, contesto, `<Money>`), ma:
  - Il selettore vive solo in **Admin → Sites → Edit**, quindi è invisibile all'utente normale.
  - I tassi vengono refreshati solo lato client quando la cache supera 12h: nessuna schedulazione server.
  - Non c'è feedback in UI per capire/cambiare la valuta del sito attivo.

## Cosa cambierà

### 1) Selettore valuta nel Project Settings dialog
File: `src/components/dashboard/ProjectSettingsDialog.tsx`

- Nella tab **Energy**, sotto "Area m²", aggiungere una sezione "Valuta del sito" con la stessa dropdown a 15 valute usata in `SitesManager`.
- Load: `supabase.from('sites').select('currency').eq('id', siteId).maybeSingle()`.
- Save: insieme agli altri campi della tab, `update({ currency }).eq('id', siteId)`.
- Invalidate cache: `['site-currency', siteId]`, `['sites']`, `['admin-sites']`.
- Stringa esplicativa: *"Tutti i valori economici sono memorizzati in EUR e convertiti in tempo reale nella valuta selezionata. Tassi aggiornati ogni 24h."*

### 2) Nessun badge separato — solo il simbolo cambia
Il simbolo della valuta selezionata sostituisce l'`€` ovunque, come già fa il componente `<Money>`. Nessun nuovo chip/badge nell'header. Gli unici punti dove serve verificare/correggere sono quelli che ancora hardcodano `€`:

- `src/components/dashboard/ProjectDetail.tsx` → label tipo `"€/kWh"`, intestazioni colonne `"Costo (€)"`, eventuali tooltip.
- `src/components/dashboard/BillAnalysisModule.tsx` → label e header tabella.
- `src/components/wrapped/lib/wrappedMath.ts` e `wrappedPdf.ts` → testi del PDF/Wrapped.

Soluzione: usare `getCurrencySymbol(project.currency)` da `src/lib/currency.ts` per costruire dinamicamente le label (es. `${symbol}/kWh`, `Costo (${symbol})`). Nessun nuovo componente UI.

### 3) Aggiornamento automatico giornaliero dei tassi
Schedulare via `pg_cron + pg_net` la `fx-rates-refresh` ogni giorno alle **06:00 UTC**. Inserito con il tool `supabase--insert` (non migration, perché contiene URL + anon key specifici del progetto). Le estensioni `pg_cron` e `pg_net` vengono abilitate se mancanti.

```sql
select cron.schedule(
  'fx-rates-daily',
  '0 6 * * *',
  $$ select net.http_post(
       url := 'https://vejqfpznzcohtbggkfhr.supabase.co/functions/v1/fx-rates-refresh',
       headers := '{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
```

## Cosa NON cambia
- Nessun badge/chip nell'header.
- Nessuna conversione dei dati storici a DB.
- Nessuna modifica alle bollette già processate.
- Nessuna modifica alla logica di conversione/formattazione.

## File toccati
- `src/components/dashboard/ProjectSettingsDialog.tsx` — nuova sezione valuta.
- `src/components/dashboard/ProjectDetail.tsx` — sostituire `€` hardcoded con `getCurrencySymbol(currency)`.
- `src/components/dashboard/BillAnalysisModule.tsx` — idem.
- `src/components/wrapped/lib/wrappedMath.ts` / `wrappedPdf.ts` — idem dove appare `€`.
- `supabase--insert` per lo schedule pg_cron.
