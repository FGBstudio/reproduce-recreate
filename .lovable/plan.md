## Obiettivo

Aggiungere il supporto multi-valuta a tutta l'applicazione. Ogni sito avrà la sua valuta nativa (es. EUR per i siti italiani, GBP per UK), e tutti i valori economici verranno automaticamente formattati e convertiti usando tassi di cambio live aggiornati giornalmente.

## Valute supportate

EUR, USD, GBP, CHF, JPY, CNY, AUD, CAD, SEK, NOK, DKK, PLN, AED, SGD, HKD (15 valute principali).

## Architettura

### 1. Database

**Nuova colonna `currency` su `sites`** (TEXT, default `'EUR'`, CHECK in elenco supportato).

**Nuova tabella `fx_rates`** per memorizzare i tassi di cambio:
- `base` TEXT (sempre `'EUR'`)
- `quote` TEXT (es. `'USD'`)
- `rate` NUMERIC
- `fetched_at` TIMESTAMPTZ
- PRIMARY KEY (base, quote)

Letta da tutti, scritta solo da `service_role`.

### 2. Edge Function `fx-rates-refresh`

Cron job giornaliero che chiama `https://api.exchangerate.host/latest?base=EUR` (gratuito, no key) e fa upsert in `fx_rates`. Schedulato via `pg_cron` ogni 24h.

Endpoint GET pubblico per il primo caricamento on-demand.

### 3. Frontend: `CurrencyContext` + hook

`src/contexts/CurrencyContext.tsx`:
- Carica una volta `fx_rates` in cache (React Query, 12h stale).
- Espone `convert(amount, fromCurrency, toCurrency)` e `format(amount, currency, options?)`.
- `format` usa `Intl.NumberFormat` con locale dalla lingua attiva.

`useSiteCurrency(siteId)` hook utility che restituisce la valuta del sito corrente (dalla query già esistente sui sites).

### 4. Componente `<Money />` riutilizzabile

```tsx
<Money amount={1234.5} from="EUR" to={siteCurrency} compact />
```
Centralizza formattazione + conversione. Sostituisce tutti i template `€${x.toLocaleString(...)}`.

### 5. UI selector

Nelle **Project Settings** del sito (admin/owner): dropdown "Site currency" con tutte le valute supportate. Persistito su `sites.currency`.

Read-only per gli utenti normali: vedono solo la valuta del sito.

## Punti di sostituzione (callsite migration)

Sostituire tutti i `€${...}` / `{ style: 'currency', currency: 'EUR' }` con `<Money />` o `format()`:

- `src/components/dashboard/ProjectDetail.tsx` (estimated cost, periods table, day rows)
- `src/components/dashboard/BillAnalysisModule.tsx` (KPI cards, bill detail fields — usa la valuta della bolletta dove presente)
- `src/components/dashboard/PdfReportGenerator.tsx` (label CSV/tabelle, simbolo dinamico in base al sito)
- `src/components/wrapped/lib/wrappedMath.ts` (`formatMoney` con currency parametrica)
- `src/components/wrapped/lib/wrappedPdf.ts` (consumatore di formatMoney)
- `src/hooks/useEnergyDataTransformer.ts` (commento di esempio — solo doc)

## Dettagli tecnici

```text
sites.currency ──┐
                 ├──► useSiteCurrency(siteId) ──► <Money to={cur} />
fx_rates ────────┘                                      │
                                                        ▼
                          Intl.NumberFormat(locale, { style:'currency', currency })
```

Regole di conversione:
- Tutti i valori sorgente sono in EUR (tariffe `energy_price_kwh`, costi calcolati).
- `convert(x, 'EUR', target) = x * rate('EUR','target')`.
- Se rates non caricati → fallback al simbolo nativo senza conversione + badge "FX unavailable".

Caching:
- React Query `staleTime: 12h`, persistito in `localStorage` per offline.
- Edge function aggiorna i tassi 1x/giorno; client li rilegge quando stale.

## Out of scope

- Conversione storica di valori passati (es. bolletta importata mesi fa rimane nella sua valuta originale).
- Hedging / tassi forward.
- Modifica della valuta nativa di una bolletta già processata.

## Migrazione dati

I siti esistenti restano `EUR` di default (no breaking change). L'admin può cambiare la valuta dei siti non-EUR dalle Project Settings.
