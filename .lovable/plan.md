## Goal

Sostituire l'attuale verdetto statico del Site Fingerprint ("Critical Issue Detected — 2 critical alerts need immediate attention.") con un messaggio **specifico e generato dall'IA** che reagisce alla telemetria reale del sito:

- CO2 alta → "Open a window — CO2 is reaching 1200 ppm"
- Potenza sopra baseline → "Turn down the AC — HVAC load is 35% above usual"
- Allarme leak → "Possible water leak detected on the main line"
- Tutto OK → frase rassicurante contestuale

Headline breve (≤6 parole) + reason di 1 riga, sempre in inglese, tono coerente con lo score.

## What to build

### 1. Edge function `fingerprint-verdict` (nuova)

`supabase/functions/fingerprint-verdict/index.ts`, sullo stesso pattern di `energy-diagnosis`:

- Input JSON: `{ siteName, language, overall, modules:{energy,air,water}, alerts:{critical,warning,topAlerts[]}, telemetry:{ co2, temperature, humidity, voc, pm25, powerKw, baselinePowerKw, hvacKw, lightingKw, waterFlow, leakDetected } }`
- Modello: `google/gemini-3-flash-preview` via Lovable AI Gateway (`LOVABLE_API_KEY`).
- Structured output (tool calling) → `{ headline: string (max 6 words), reason: string (max 110 chars), tone: 'GOOD'|'OK'|'WARNING'|'CRITICAL' }`.
- System prompt: facility manager esperto, deve citare la metrica che pesa di più (es. valore CO2, % sopra baseline), proporre azione concreta, niente fluff.
- Gestione 429/402 come `energy-diagnosis`.

### 2. Hook `useFingerprintVerdict` (nuovo)

`src/hooks/useFingerprintVerdict.ts`:

- React Query, key = `['fingerprint-verdict', siteId, bucketedSignature]` dove `bucketedSignature` arrotonda i valori (CO2 a step di 100 ppm, kW a step di 1, score a step di 5) così la stessa risposta viene riusata e l'AI non viene chiamata ad ogni re-render.
- `staleTime: 5 min`, `refetchInterval: 10 min`.
- Fallback: se l'edge function fallisce o `siteId` mancante, ritorna il verdetto rule-based attuale (`buildFingerprintVerdict`) così la UI non resta mai vuota.

### 3. Cablaggio in `OverviewSection.tsx`

- Raccogliere i segnali telemetrici già disponibili nel componente (CO2, temp, humidity, power kW corrente vs media, alert critici/warning, leak) e passarli all'hook.
- Sostituire la `useMemo(buildFingerprintVerdict…)` con `const { data: verdict } = useFingerprintVerdict(...)`, mantenendo `buildFingerprintVerdict` come fallback locale.
- Nessuna modifica al layout: rimangono `headline` + `reason` sotto il radar, stessi token di colore (`STATUS_TOKENS[verdict.tone].textColor`).
- Mentre l'AI sta caricando, mostriamo il verdetto rule-based (no flicker, no spinner).

### 4. Config

- Aggiungere `fingerprint-verdict` in `supabase/config.toml` con `verify_jwt = false` (come `energy-diagnosis`).
- Nessun nuovo secret: `LOVABLE_API_KEY` è già disponibile in tutti gli edge env.

## Out of scope

- Nessun cambio al radar chart, al layout della card, ai colori, allo ScoreHero o agli altri componenti.
- Nessun cambio alle soglie di score o alle metriche di telemetria.
- Nessuna nuova migration / RLS / tabella.

## Files touched

- new: `supabase/functions/fingerprint-verdict/index.ts`
- new: `src/hooks/useFingerprintVerdict.ts`
- edit: `src/components/dashboard/OverviewSection.tsx` (solo wiring del verdetto, ~15 righe)
- edit: `supabase/config.toml` (1 voce)
