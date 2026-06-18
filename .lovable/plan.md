## Come funziona oggi il selettore temporale

Il selettore vive in `src/components/dashboard/TimePeriodSelector.tsx` e produce due output che vengono passati ai widget tramite props:

1. `**value: TimePeriod**` — una stringa enum: `"today" | "week" | "month" | "year" | "custom"` (definita sia nel componente che in `src/hooks/useTimeFilteredData.ts`).
2. `**dateRange?: { from: Date; to: Date }**` — popolato solo quando l'utente sceglie `"custom"` dal calendario.

Questi due valori vengono poi consumati da `getTimeRangeParams(timePeriod, dateRange)` in `useTimeFilteredData.ts`, che li traduce in:

```text
{ start: ISO string, end: ISO string, bucket: "15m" | "1h" | "1d" }
```

usato dalle query (energy_hourly / energy_daily / weather_data, ecc.). Mappatura attuale:


| Period | start            | end          | bucket                             |
| ------ | ---------------- | ------------ | ---------------------------------- |
| today  | startOfDay(now)  | now          | 15m                                |
| week   | now - 7 giorni   | now          | 1h                                 |
| month  | now - 1 mese     | now          | 1h                                 |
| year   | startOfYear(now) | now          | 1d                                 |
| custom | dateRange.from   | dateRange.to | auto (15m/1h/1d in base ai giorni) |


Lo stesso enum è usato anche dai generatori di dati mock (`useEnergyData`, `useDeviceData`, `useCO2Data`, ecc.) con uno `switch` per periodo.

> Nota: l'attuale `"month"` è "ultimi 30 giorni rolling", non "dall'inizio del mese". L'attuale `"year"` invece è già "dall'inizio dell'anno" (YTD). Quindi:
>
> - **MTD** ("dall'inizio del mese ad oggi") è una vera novità → nuova opzione.
> - **YTD** ("dall'inizio dell'anno ad oggi") tecnicamente coincide con l'attuale `year`. Posso (a) rinominare l'etichetta di `year` in "Anno corrente (YTD)" senza creare un nuovo enum, oppure (b) aggiungere un'opzione separata `ytd` e lasciare `year` come "ultimi 12 mesi". Vedi domanda in fondo.

## Modifiche previste

### 1. Estendere l'enum `TimePeriod`

In `src/hooks/useTimeFilteredData.ts` e `src/components/dashboard/TimePeriodSelector.tsx`:

```ts
export type TimePeriod = "today" | "week" | "month" | "year" | "mtd" | "ytd" | "custom";
```

### 2. `getTimeRangeParams` — nuovi casi

```ts
case "mtd":
  start = startOfMonth(now); end = now; bucket = "1h"; break;
case "ytd":
  start = startOfYear(now);  end = now; bucket = "1d"; break;
```

### 3. `TimePeriodSelector.tsx` — nuove voci nel dropdown

Aggiungere due `<SelectItem>`:

- `mtd` → label `t('time.mtd')` ("Mese corrente" / "Month to date")
- `ytd` → label `t('time.ytd')` ("Anno corrente" / "Year to date")

### 4. Traduzioni

Aggiungere chiavi `time.mtd` e `time.ytd` in `src/contexts/LanguageContext.tsx` (IT/EN, e altre lingue presenti).

### 5. Generatori mock in `useTimeFilteredData.ts`

Aggiungere i case `mtd` (giorni da inizio mese → granularità giornaliera) e `ytd` (mesi da inizio anno → granularità mensile) negli `switch` di `useEnergyData`, `useDeviceData`, `useCO2Data` per evitare array vuoti in demo mode. In alternativa, "fallthrough" verso `month`/`year` esistenti.

### 6. Nessuna modifica ai consumer

Tutti i widget che ricevono `timePeriod` lo passano semplicemente a `getTimeRangeParams`, quindi non serve toccarli — l'aggiunta è retro-compatibile.

## Domanda aperta (prima di implementare)

Visto che l'attuale `"year"` è già "dall'inizio dell'anno ad oggi" (YTD), preferisci:

- **A)** Aggiungere `ytd` come opzione separata, lasciando `year` invariato (rischio: due opzioni equivalenti).
- **B)** Rinominare solo l'etichetta di `year` in "Anno corrente (YTD)" e aggiungere solo `mtd`.
- **C)** Aggiungere `ytd` nuovo e ridefinire `year` come "ultimi 12 mesi rolling" (startOfYear → subYears(now,1)).

Confermami la scelta e procedo.  
procedi con lascelta **C**