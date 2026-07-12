## Cause della differenza

Nel tab **Energy** del sito ci sono due contatori di alert che leggono dallo stesso `pdAlertStatus` (hook `useThresholdAlerts`) ma applicano filtri diversi:

1. **Card "Active Alerts" nell'header della dashboard Energy** (`ProjectDetail.tsx`, righe ~4025-4029) usa un filtro inline:
   ```ts
   pdAlertStatus.alerts.filter(a =>
     ['energy','power'].some(p => a.metric?.toLowerCase().includes(p))
     || a.deviceType === 'energy_monitor'
   )
   ```
   → conta anche gli alert **senza metric** o con metric `system.offline` se `deviceType === 'energy_monitor'` (nel tuo caso: "Virtual Meter - General: Offline" → conta 2).

2. **Pannello `SiteAlertsWidget` con `moduleFilter="energy"`** più in basso, usa una logica più severa (`SiteAlertsWidget.tsx`, righe 98-127):
   - scarta gli alert privi di `metric`;
   - per metric non `system.*` matcha solo pattern `energy`/`power`;
   - per `system.*` matcha via `deviceType`.
   → conta 1.

Un alert (probabilmente offline di un virtual meter General con `metric` nullo/atipico) rientra nel primo filtro ma non nel secondo → 2 vs 1.

Stessa incongruenza esiste **anche per il card Water** (righe ~5344-5347), con il filtro inline `['water','leak']` / `deviceType==='water_meter'`.

## Fix — un'unica sorgente

**Obiettivo:** allineare i due contatori (Energy e Water) alla stessa logica usata da `SiteAlertsWidget`, che è quella che alimenta la lista di dettaglio visibile all'utente.

### File 1: `src/components/dashboard/SiteAlertsWidget.tsx`
- Esportare `MODULE_METRIC_PATTERNS` e una funzione pura `filterAlertsByModule(alerts, moduleFilter)` che replica esattamente la logica attuale del `useMemo` interno (righe 99-127).
- Sostituire il `useMemo` interno perché usi la nuova funzione, così esiste una sola implementazione.

### File 2: `src/components/dashboard/ProjectDetail.tsx`
- Importare `filterAlertsByModule` da `SiteAlertsWidget`.
- Card **Energy** (righe 4026, 4027, 4029): sostituire i tre filtri inline con:
  ```ts
  const energyAlertCount = filterAlertsByModule(pdAlertStatus?.alerts ?? [], 'energy').length;
  ```
- Card **Water** (righe 5344, 5345, 5347): idem con `'water'`.
- Aggiornare i tre riferimenti (colore, numero, badge "Attention") per usare il conteggio memoizzato.

## Fuori scope
- Non si tocca la logica di generazione degli alert né `useThresholdAlerts`.
- Nessun cambiamento su Air (già coerente) né sull'Overview generale del sito.
- Nessuna modifica visiva: cambia solo il numero mostrato quando la logica divergeva.
