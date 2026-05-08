# Piano di correzione timezone per Shanghai, Taikoo Li Qiantan

## Cosa ho verificato

- I dati del sito `Shanghai, Taikoo Li Qiantan` esistono nel DB: circa 396k righe in `energy_telemetry`, con dati recenti fino all'8 maggio.
- Il sito ha timezone corretta in tabella `sites`: `Asia/Shanghai`.
- Il frontend sta già formattando le label usando `project.timezone`, quindi il problema non sembra essere solo un'etichetta frontend.
- La distribuzione oraria del device `general` conferma il problema: con timezone `Asia/Shanghai`, il consumo scende intorno alle 13:00 locali e resta basso di sera/notte, cioè è disallineato rispetto all'orario reale del negozio.
- Simulando uno shift di `+8h`, il pattern diventa coerente: consumo alto circa 08:00-20:00 Shanghai e basso di notte.
- `Boucheron Shanghai Xintiandi` non va toccato: ha già un profilo coerente e non risulta nel log timezone fix.

## Causa probabile

Per questo sito specifico, i timestamp storici sembrano essere stati salvati come se l'ora locale Shanghai fosse già UTC, quindi il grafico poi aggiunge correttamente `Asia/Shanghai` e mostra tutto 8 ore avanti nel giorno locale.

Il fix precedente non è stato applicato a Taikoo Li Qiantan (`tz_fix_log` vuoto), e la funzione `_apply_tz_fix_device` attuale usa una trasformazione rischiosa/non reversibile per tutti i casi. Non voglio applicarla “alla cieca” ad altri siti.

## Intervento proposto

1. Creare una nuova migrazione DB sicura e specifica per questo caso:
   - nuova funzione `public._shift_energy_site_timestamps(p_site_id uuid, p_shift interval, p_fix_version text)`;
   - applica uno shift esplicito ai timestamp (`ts + interval '8 hours'`) solo ai device del sito indicato;
   - ricostruisce `energy_hourly`, `energy_daily` ed `energy_latest` per quei device;
   - marca l'intervento in `tz_fix_log` con una versione nuova, ad esempio `shanghai_taikoo_plus_8h_v1`, così è idempotente.

2. Applicare la correzione solo a:
   - `Shanghai, Taikoo Li Qiantan`
   - site UUID: `1338d4af-d6d8-4b7f-b030-02468c157818`
   - shift: `+8 hours`

3. Non toccare:
   - `Boucheron Shanghai Xintiandi`;
   - gli altri siti Shanghai;
   - frontend, componenti grafici, ZoomableChart;
   - timezone registrata nel sito (`Asia/Shanghai` resta corretta).

4. Verificare subito dopo:
   - `energy_telemetry`, `energy_hourly`, `energy_daily`, `energy_latest` hanno timestamp coerenti;
   - la media oraria locale mostra basso consumo di notte e consumo più alto nelle ore di apertura;
   - il sito continua ad avere dati nel periodo corrente.

## Rollback previsto

La funzione userà un `fix_version` dedicato. Se il risultato non fosse corretto, si potrà applicare l'inverso solo per quel sito:

```sql
SELECT public._shift_energy_site_timestamps(
  '1338d4af-d6d8-4b7f-b030-02468c157818'::uuid,
  interval '-8 hours',
  'shanghai_taikoo_minus_8h_rollback_v1'
);
```

## Nota importante

Questo è un fix DB mirato al sito dove il dato è disallineato. Non userò una correzione globale per tutti i siti perché rischierebbe di rompere siti già coerenti come Boucheron Shanghai Xintiandi.