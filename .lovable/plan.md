## Modifiche a `src/components/dashboard/OverviewSection.tsx`

### 1. Riproporzionamento orizzontale (riga ~703)

Layout `flex flex-col xl:flex-row`:

- `ScoreHero`: rimuovere `flex-1`, dargli `xl:flex-[2]` (più stretto)
- `Card` Fingerprint: da `xl:w-[320px]` → `xl:flex-1 xl:min-w-[380px] xl:max-w-[460px]` (più larga per ospitare il testo AI)

### 2. Overall Performance — non ho chiesto la sfumatura dark ho chiestpo la sfumatura nell'angolo del colore dello stato quyindi se è ok la sfumatura sarà azzurra mentre se è good sarà verde, warning gialla e critical rossa.

Refactor di `ScoreHero` (riga ~191):

- tutto il refacto deve essere organizzato di conseguenza, mantenendo la versione chiara non dark

Nessun nuovo token CSS necessario: si riusano `--fgb-navy` / `--fgb-teal` già definiti.

### 3. Fingerprint con verdetto AI

Nuova sezione testuale nel `Card` Fingerprint (riga ~721), sotto il radar:

```text
[ Site Fingerprint ]
[  radar chart  ]
─────────────────
HEADLINE (es. "All Good", "Ventilate the Room", "Consumption a Bit High")
sottotesto breve (1 riga) con il "perché" basato sugli score
```

#### Logica del verdetto (pure function locale, niente chiamate AI)

Nuovo helper `function buildFingerprintVerdict({ overall, energy, air, water, alerts, moduleConfig })` che ritorna `{ headline: string; reason: string; tone: StatusLevel }`. Regole, valutate in ordine di priorità:

1. `alerts.criticalCount > 0` → `"Critical Issue Detected"` / `"X critical alerts need immediate attention."`
2. `air.enabled && air.score < 50` → `"Ventilate the Room"` / `"Indoor air quality is degrading — increase ventilation."`
3. `energy.enabled && energy.score < 50` → `"Consumption a Bit High"` / `"Energy usage is above the expected baseline."`
4. `water.enabled && water.score < 50` → `"Water Flow Anomaly"` / `"Detected water consumption is outside the normal range."`
5. `alerts.warningCount > 2` → `"Multiple Warnings Active"` / `"Several non-critical anomalies are open."`
6. `overall >= 85` → `"All Good"` / `"All monitored modules are within optimal range."`
7. `overall >= 65` → `"Operating Normally"` / `"Performance is stable, with minor room for improvement."`
8. fallback → `"Needs Attention"` / `"Multiple modules are below their target performance."`

Rendering:

- Headline: `text-sm font-semibold` con colore in base a `tone` (riusa `STATUS_TOKENS[tone].textColor`)
- Reason: `text-[11px] text-gray-500 leading-snug text-center mt-1`

### 4. Cablaggio

Nel componente principale (riga ~700), calcolare:

```ts
const verdict = buildFingerprintVerdict({
  overall: overallStatus.score,
  energy: { score: energyStatus.score, enabled: moduleConfig.energy.enabled },
  air:    { score: airStatus.score,    enabled: moduleConfig.air.enabled },
  water:  { score: waterStatus.score,  enabled: moduleConfig.water.enabled },
  alerts: alertStatus,
});
```

e passarlo a `BuildingFingerprint` come prop `verdict` (oppure renderizzarlo inline nella `Card` sotto il radar — preferito, meno refactor).

### File toccati

- `src/components/dashboard/OverviewSection.tsx` — unico file modificato.

Nessuna modifica a logica dati, hook, o altri componenti. Nessun nuovo token globale.