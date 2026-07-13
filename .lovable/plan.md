## Obiettivo
Rilevare in modo stabile se un monitor è **LEED (4 parametri: CO₂, TVOC, TEMP, HUM)** o **WELL (8 parametri, aggiunge PM2.5, PM10, CO, O₃)** e nascondere ovunque nelle dashboard "Aria" i riferimenti ai 4 parametri extra quando non sono monitorati.

## Metodo di rilevamento (a due livelli, stabile)

Creo un helper `src/lib/airMonitorType.ts` con:

```ts
export const EXTENDED_METRICS = ['iaq.pm25','iaq.pm10','iaq.co','iaq.o3'] as const;
export const BASE_METRICS = ['iaq.co2','iaq.voc','env.temperature','env.humidity'] as const;

// 1) Signal primario: nome/modello device
export function isLeedByName(device): boolean
// match case-insensitive di "LEED" in device.model / device.name / device.device_id
// (esclude "WELL" / "WEEL")

// 2) Fallback telemetrico: se in una finestra ragionevole
// il device NON ha MAI dato uno dei 4 extra → LEED
export function isLeedByTelemetry(deviceAverages): boolean

// API pubblica combinata:
export function getSupportedAirMetrics(device, avg?): Set<string>
export function isLeedMonitor(device, avg?): boolean
```

**Regola di priorità:** se il nome contiene "LEED" (o "WELL"/"WEEL") è deterministico. Altrimenti si guarda la telemetria: se `avg` esiste e i 4 metrici extra sono tutti `null/undefined`, si considera LEED. In assenza di segnale (device nuovo, nessuna telemetria) si assume **WELL/8-metric** (nessun nascondimento aggressivo → nessuna regressione visiva).

## Modifiche UI

Tutte le rimozioni avvengono a livello di rendering, senza toccare fetch/telemetria.

### 1) `src/components/dashboard/AirCustomComponents.tsx` — Building Overview
- Passare `airDeviceLabelById`/dispositivi tramite prop (già presenti).
- Se **tutti** i device selezionati sono LEED → nascondere le 4 colonne PM2.5, PM10, CO, O₃ (header + `<td>`).
- Se mix (WELL + LEED) → colonne visibili, ma per il singolo device LEED le 4 celle mostrano `—` in stile "opacity-40" (già esistente per null).

### 2) `src/components/dashboard/ProjectDetail.tsx` — sezione Air
Applicare `getSupportedAirMetrics()` calcolato sui `selectedAirDevices` e su `deviceAverages`:

- **KPI cards Overview air** (~righe 4702-4820): PM2.5, PM10, CO, O₃ → renderizzate solo se almeno un device selezionato le supporta.
- **Selettore metrica Heatmap** (~riga 4866): filtrare la lista `['iaq.co2','iaq.voc','iaq.pm25','iaq.pm10','iaq.co','iaq.o3','env.temperature','env.humidity']` con `supported.has(m)`. Se `activeAirHeatmapMetric` non è più supportato → reset a `iaq.co2`.
- **Indoor Avg widget** (~righe 5091-5204): mostrare card PM2.5/PM10/CO/O₃ solo se supportate globalmente.
- **Grafici per-device** (righe 4990/5075/5160/5163 e sotto 6529+): nel `.map(selectedAirDevices)` saltare (`return null`) i device LEED quando il grafico riguarda PM2.5/PM10/CO/O₃.

### 3) `AirDeviceSelector.tsx` (opzionale, low-risk)
Aggiungere un piccolo badge testuale "LEED" / "WELL" accanto al nome — solo se rilevabile da nome — per rendere il contratto visibile all'utente. Nessun cambio di logica.

## Fuori scope
- Nessuna modifica a fetch/telemetria/DB.
- Nessuna modifica alle certificazioni (LEED/WELL widget in tab certificazioni restano invariati).
- La sezione Wrapped (`SlideAir`) non viene toccata (usa già solo CO₂/VOC/PM2.5 aggregato).
- Nessun cambio di stile/palette.

## Dettagli tecnici
File nuovi:
- `src/lib/airMonitorType.ts`

File modificati:
- `src/components/dashboard/AirCustomComponents.tsx` (header/celle condizionali)
- `src/components/dashboard/ProjectDetail.tsx` (filtro `supported` su cards, heatmap picker, indoor avg, per-device charts)
- (opz.) `src/components/dashboard/AirDeviceSelector.tsx` (badge)

Il calcolo `supported` è un `useMemo` singolo derivato da `selectedAirDevices` + `deviceAverages`, riutilizzato in tutti i punti sopra per garantire coerenza.
