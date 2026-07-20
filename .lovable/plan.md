## 1) Air score = 0 solo su FGB Milan Office

Da verificare in build mode con una query telemetry: probabilmente un singolo pollutant (es. VOC con valore fuori scala oppure PM stale ma non filtrato) fa collassare a 0 il worst-pollutant index solo per questo sito.

Fix previsto in `src/lib/airQuality.ts` / `OverviewSection.tsx`:
- Ignorare nel calcolo i sub-score di parametri **non supportati dal monitor** (LEED vs WELL, via `airMonitorType.ts` già esistente) — FGB Milan Office ha un monitor LEED e non deve essere penalizzato per PM/CO/O₃ mancanti o rumorosi.
- Ignorare sub-score con letture **stale** (>60 min) invece di trattarli come 0.
- Richiedere almeno N sub-score validi (≥2) altrimenti → NO_DATA ("—") anziché Critical/0.

Verifica: query supabase sulla telemetria delle ultime 24h del device di FGB Milan Office per identificare quale parametro sta forzando lo score a 0, e confermare la fix.

## 2) Nuovo stile cluster marker

In `src/components/dashboard/MapView.tsx`, dentro `iconCreateFunction`, sostituire l'HTML attuale (cerchio verde scuro + bordo oro) con:

- Cerchio 44×44 `background: rgba(255,255,255,0.4)` (bianco opacità 40%)
- Outline `border: 0.25pt solid rgba(255,255,255,0.9)` (~0.33px, molto sottile)
- Pittogramma FGB (`/green.png` in versione bianca, opacity 0.4) come background centrato dietro al numero
- Numero al centro `color:#fff`, font-weight 700, senza ombra

Nessun'altra modifica al comportamento cluster (raggio, spiderfy, ecc.).

## Tech notes
- File toccati: `src/lib/airQuality.ts`, `src/components/dashboard/OverviewSection.tsx`, `src/components/dashboard/MapView.tsx`.
- Serve versione bianca del pittogramma FGB: uso `filter: brightness(0) invert(1)` su `/green.png` per evitare un nuovo asset.
