## Diagnosi

Il problema **non è nel frontend**. Il codice della heatmap (`ProjectDetail.tsx`) usa correttamente `getPartsInTz(ts, project.timezone)` con `Asia/Shanghai`, e il sito ha già `timezone = 'Asia/Shanghai'` salvato correttamente nel DB.

Il problema è nei **dati storici importati**: i timestamp del CSV originale erano in **ora locale di Shanghai** ma sono stati inseriti in `energy_hourly.ts_hour` (colonna `timestamptz`) **senza applicare l'offset +08:00**. Postgres li ha quindi memorizzati come se fossero UTC, generando uno **shift di +8 ore** rispetto alla realtà.

### Evidenza dal database

Profilo orario di **Shanghai, Taikoo Li Qiantan** (device "Main", aprile 2026):

```text
Shanghai hour | avg kW   <- profilo OSSERVATO (sbagliato)
00–07         | 7.7-8.2  <- alto (notte = "negozio aperto")
08–11         | 7.6-7.7  
12            | 7.1
13–21         | 4.6-5.2  <- basso (giorno = "negozio chiuso")
22–23         | 6.6-7.7
```

Confronto con **Boucheron Shanghai Xintiandi** (stesso fuso, dati MQTT real-time, OK):

```text
Shanghai hour | avg kW   <- profilo CORRETTO
00–04         | 3.4      <- basso (notte)
09–21         | 6.0-6.3  <- alto (giorno)
22–23         | 3.6
```

I valori di Taikoo Li Qiantan, **se ruotati di -8 ore** (cioè interpretando il "Shanghai hour" attuale come "UTC hour"), tornano coerenti con un negozio aperto di giorno.

### Altri siti affetti dallo stesso bug di import

Lo stesso shift è presente in:
- `Shanghai, Taikoo Li Qiantan` (Asia/Shanghai, +8h)
- `Hannover, SmartUP Hannover` (Europe/Berlin, +1/+2h)
- `Hoffenheim, SmartUP Hof` (Europe/Berlin, +1/+2h)
- `Vendome, Place Vendome` (Europe/Paris, +1/+2h)

Tutti gli altri siti (Boucheron Xintiandi, IFC, Plaza 66, Hangzhou, Milan, London, Munich, ecc.) hanno il profilo giorno/notte corretto.

## Soluzione proposta

### Step 1 — Migration di correzione retroattiva dei dati storici

Creare una migration che **sposta indietro** i timestamp storici dei 4 siti affetti, applicando l'offset corretto del loro fuso orario all'epoca dell'import. Lo facciamo su tutte le tabelle energy:

- `energy_telemetry` (raw)
- `energy_hourly`
- `energy_daily`
- `energy_latest` (verrà ricalcolata)

Per ciascun device dei 4 siti:

```sql
-- Esempio per Shanghai (offset +8h costante, no DST)
UPDATE energy_hourly
SET ts_hour = ts_hour - INTERVAL '8 hours'
WHERE device_id IN (SELECT id FROM devices WHERE site_id = '<uuid>')
  AND ts_hour < '<cutoff_ingest_real-time>';

-- Per Berlino/Parigi useremo l'offset variabile via AT TIME ZONE per gestire DST:
UPDATE energy_hourly
SET ts_hour = (ts_hour AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin'
WHERE device_id IN (SELECT id FROM devices WHERE site_id = '<uuid>')
  AND ts_hour < '<cutoff>';
```

Il `cutoff` separa i dati "storici importati male" da quelli "MQTT real-time corretti". Lo determineremo guardando il primo timestamp MQTT reale per ciascun sito (se esiste) o fissandolo a una data sicura prima dell'attivazione dei dispositivi.

Dopo l'UPDATE, ri-aggreghiamo `energy_daily` e ri-popoliamo `energy_latest`.

### Step 2 — Hardening dello script di import storico

Verificare/aggiornare lo script di import storico (file `database/migrations/027_import_historical_energy_step2_telemetry.sql` e/o lo script Node `mqtt-ingestion/scripts/backfill-energy.js`) per:

1. Leggere il `timezone` del sito di destinazione dalla tabella `sites`
2. Convertire esplicitamente il timestamp del CSV da "ora locale del sito" a UTC prima dell'INSERT, p.es.:

```sql
INSERT INTO energy_hourly (ts_hour, ...)
VALUES (
  (csv_local_ts::timestamp AT TIME ZONE site_timezone),  -- → UTC corretto
  ...
);
```

Questo evita che import futuri ripropongano lo stesso problema.

### Step 3 — Validazione

Dopo la migration, ri-eseguire la query di check (rapporto giorno/notte) per confermare che tutti i siti abbiano `day_avg > night_avg`.

## File / componenti coinvolti

- **Nuova migration** `database/migrations/045_fix_historical_timezone_shift.sql` — UPDATE su `energy_telemetry`, `energy_hourly`, `energy_daily`, ricalcolo `energy_latest`.
- **Script import** `mqtt-ingestion/scripts/backfill-energy.js` (e/o le migration `026/027`) — applicare conversione TZ esplicita.
- **Nessun cambiamento al frontend**: la logica della heatmap è già corretta.

## Sezione tecnica

- Bucket `ts_hour` è `timestamptz`. Postgres normalizza tutto in UTC al momento dell'INSERT; se non specifichi l'offset, usa il TZ della sessione (di solito UTC sui server Supabase) → ecco perché timestamp Shanghai senza offset finiscono "shiftati di 8h".
- Per Asia/Shanghai l'offset è costante (+08:00, niente DST), quindi un semplice `INTERVAL '8 hours'` è sicuro.
- Per Europe/Berlin ed Europe/Paris c'è il DST: useremo `(ts_hour AT TIME ZONE 'UTC') AT TIME ZONE '<tz>'` che gestisce automaticamente il passaggio CET/CEST.
- La migration sarà **idempotente** tramite una colonna marker (`labels->>'tz_fix_applied'='v1'`) per evitare doppi shift.
- Backup consigliato: prima dell'UPDATE, eseguiremo `CREATE TABLE energy_hourly_backup_pre_tz_fix AS SELECT * FROM energy_hourly WHERE device_id IN (...)` per poter rollback.

## Cosa NON tocchiamo

- Frontend (heatmap, formattazione orari, `timezoneUtils.ts`): già corretti.
- Tabella `sites.timezone`: già valorizzata correttamente.
- Altri 13+ siti: dati già corretti, non li toccheremo.
