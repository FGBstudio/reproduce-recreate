import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { requireUser, rateLimit, promptSafe } from "../_shared/auth.ts";

interface EnergyPayload {
  totalConsumption: number;
  breakdown: Array<{ name: string; kwh: number }>;
  co2Total: number;
}

interface WaterPayload {
  totalConsumption: number;
  leaksDetected: number;
}

interface AirPayload {
  avgTemp: number | null;
  avgCo2: number | null;
  avgHumidity: number | null;
  avgAqi: string | null;
  metricsAvailable: string[];
}

/** Cosa e' EFFETTIVAMENTE monitorato sul sito con dati nel periodo. Serve a
    non confondere "non installato" con "guasto" (analisi #6). */
interface Installed {
  energy: boolean;
  water: boolean;
  air: boolean;
}

interface DiagnosisRequest {
  projectName: string;
  period: string;
  language: 'en' | 'it' | 'fr' | 'es' | 'zh';
  installed: Installed;
  siteAreaM2?: number | null;
  energyData?: EnergyPayload | null;
  waterData?: WaterPayload | null;
  airData?: AirPayload | null;
}

/* Termini vietati: sistemi/azioni che l'AI inventava senza alcuna evidenza
   (analisi #5). Se compaiono nell'output, si rigenera una volta con un
   vincolo piu' duro; se resistono, le frasi che li contengono vengono tolte. */
const BANNED = [
  'bms', 'building management system', 'digital twin', 'gemello digitale',
  'fire safety', 'fire system', 'antincendio', 'sicurezza antincendio',
  'power outage', 'blackout', 'interruzione di corrente', 'blackout totale',
  'recalibrat', 'ricalibr', 'replace the meter', 'sostituire il contatore',
  'replace the sensor', 'sostituire il sensore', 'hardware replacement',
  'who limit', 'limite who', 'limite oms',
];

function buildSystemPrompt(lang: string, installed: Installed, hasArea: boolean): string {
  const isIt = lang === 'it';

  let prompt = isIt
    ? `Sei un analista di monitoraggio energetico e qualita' dell'aria per edifici retail. Scrivi in Italiano, in modo sobrio e fattuale.\n\n`
    : `You are an energy and indoor-air monitoring analyst for retail buildings. Write in English, sober and factual.\n\n`;

  // REGOLE DI ONESTA' (il cuore della Fase B)
  prompt += isIt
    ? `REGOLE TASSATIVE — la violazione rende il report inutilizzabile:\n`
      + `1. Usa SOLO i numeri presenti nei dati forniti. Non inventare valori, stime, proiezioni o percentuali non ricavabili dai dati.\n`
      + `2. Se un dato manca, scrivi semplicemente che non e' disponibile per il periodo. Non dedurne cause.\n`
      + `3. Non nominare MAI sistemi non presenti: niente BMS, "digital twin", impianto antincendio, sicurezza antincendio.\n`
      + `4. Non diagnosticare guasti hardware e non raccomandare di sostituire o ricalibrare contatori o sensori.\n`
      + `5. Per le grandezze NON monitorate su questo sito non fare commenti: elencale al massimo come "non monitorate".\n`
      + `6. L'assenza di dati NON e' un "blackout" ne' una "interruzione di corrente": al massimo e' un gateway da verificare.\n`
      + `7. Soglie: la CO2 a 1000 ppm e' un riferimento di ventilazione comune (EN 16798 / ASHRAE), NON un limite OMS. Comfort termico 20-26 C, umidita' 40-60 %.\n`
      + (hasArea ? `8. Il confronto per m2/anno e' ammesso SOLO se coerente col periodo fornito; un mese parziale non si confronta con un indice annuale.\n` : `8. La superficie del sito NON e' fornita: NON citare benchmark per m2/anno.\n`)
      + `\nFORMATTAZIONE: niente LaTeX, unita' in testo semplice (25 C, 1200 ppm, 150 kWh), Markdown standard (### titoli, **grassetto**, elenchi con -), massimo 2 decimali, ogni valore con la sua unita'.\n\n`
    : `STRICT RULES — breaking any makes the report unusable:\n`
      + `1. Use ONLY the numbers present in the provided data. Never invent values, estimates, projections or percentages not derivable from the data.\n`
      + `2. If a value is missing, simply state it is not available for the period. Do not infer causes.\n`
      + `3. NEVER mention systems that are not present: no BMS, no "digital twin", no fire-safety / fire system.\n`
      + `4. Do not diagnose hardware failures and do not recommend replacing or recalibrating meters or sensors.\n`
      + `5. For quantities NOT monitored at this site, make no comment: at most list them as "not monitored".\n`
      + `6. Missing data is NOT a "blackout" or a "power outage": at most a gateway to check.\n`
      + `7. Thresholds: CO2 at 1000 ppm is a common ventilation reference (EN 16798 / ASHRAE), NOT a WHO limit. Thermal comfort 20-26 C, humidity 40-60 %.\n`
      + (hasArea ? `8. A per-m2/year comparison is allowed ONLY if consistent with the given period; a partial month is not compared to an annual index.\n` : `8. Site floor area is NOT provided: do NOT cite any per-m2/year benchmark.\n`)
      + `\nFORMATTING: no LaTeX, plain-text units (25 C, 1200 ppm, 150 kWh), standard Markdown (### headings, **bold**, lists with -), max 2 decimals, every value with its unit.\n\n`;

  prompt += isIt ? `STRUTTURA (in quest'ordine):\n` : `STRUCTURE (in this order):\n`;
  prompt += isIt
    ? `### 1. Piano d'Azione Prioritario\n[1-5 azioni con priorita' (ALTA/MEDIA/BASSA), ciascuna con cosa fare e perche', SOLO basate sui dati forniti. Se i dati non supportano azioni, dillo e non inventarne.]\n\n`
    : `### 1. Priority Action Plan\n[1-5 actions with priority (HIGH/MEDIUM/LOW), each with what to do and why, based ONLY on the provided data. If the data does not support actions, say so and do not invent any.]\n\n`;
  prompt += isIt
    ? `### 2. Sintesi Esecutiva\n[2-4 frasi sullo stato, solo dai dati.]\n\n`
    : `### 2. Executive Summary\n[2-4 sentences on status, from the data only.]\n\n`;
  if (installed.energy) prompt += isIt
    ? `### 3. Energia\n[Consumo del periodo, ripartizione se fornita, anomalie evidenti dai numeri. Valori in kWh e costo in € solo se forniti.]\n\n`
    : `### 3. Energy\n[Period consumption, breakdown if provided, anomalies evident from the numbers. Values in kWh and cost in € only if provided.]\n\n`;
  if (installed.water) prompt += isIt
    ? `### 4. Acqua\n[Consumo e perdite SOLO dai dati forniti.]\n\n`
    : `### 4. Water\n[Consumption and leaks ONLY from the provided data.]\n\n`;
  if (installed.air) prompt += isIt
    ? `### 5. Qualita' dell'Aria e Comfort\n[Valuta solo le metriche presenti in "metricsAvailable". Per le metriche assenti: non commentare.]\n\n`
    : `### 5. Air Quality & Comfort\n[Evaluate only the metrics listed in "metricsAvailable". For absent metrics: no comment.]\n\n`;

  return prompt;
}

function buildUserMessage(data: DiagnosisRequest): string {
  const { projectName, period, energyData, waterData, airData, installed, siteAreaM2 } = data;

  let msg = `Project: ${projectName}\nPeriod: ${period}\n`;
  msg += `Site floor area: ${siteAreaM2 != null ? siteAreaM2 + ' m2' : 'not provided'}\n`;
  // Inventario esplicito: cosa e' monitorato e cosa no.
  const monitored = [installed.energy && 'energy', installed.air && 'air quality', installed.water && 'water'].filter(Boolean);
  msg += `Monitored at this site (with data in the period): ${monitored.length ? monitored.join(', ') : 'none'}\n\n`;

  if (installed.energy && energyData) {
    msg += `--- ENERGY DATA ---\n`;
    msg += `Total Consumption: ${energyData.totalConsumption.toFixed(2)} kWh\n`;
    msg += `CO2 Emissions: ${energyData.co2Total.toFixed(2)} kg\n`;
    if (energyData.breakdown?.length > 0) {
      msg += `Breakdown:\n`;
      energyData.breakdown.forEach(d => msg += `- ${d.name}: ${d.kwh} kWh\n`);
    }
    msg += `\n`;
  }

  if (installed.water && waterData) {
    msg += `--- WATER DATA ---\n`;
    msg += `Total Consumption: ${waterData.totalConsumption.toFixed(2)} Liters\n`;
    msg += `Leaks Detected: ${waterData.leaksDetected}\n\n`;
  }

  if (installed.air && airData) {
    msg += `--- AIR QUALITY DATA ---\n`;
    msg += `Metrics monitored: ${airData.metricsAvailable.join(', ') || 'none'}\n`;
    if (airData.avgTemp != null) msg += `Avg Temperature: ${airData.avgTemp.toFixed(1)} C\n`;
    if (airData.avgCo2 != null) msg += `Avg CO2: ${airData.avgCo2.toFixed(0)} ppm\n`;
    if (airData.avgHumidity != null) msg += `Avg Humidity: ${airData.avgHumidity.toFixed(0)} %\n`;
    if (airData.avgAqi != null) msg += `Air Quality rating: ${airData.avgAqi}\n`;
    msg += `\n`;
  }

  msg += `Produce the report following the structure. Use ONLY the numbers above. No LaTeX, plain-text units.`;
  return msg;
}

/** Toglie le frasi che contengono un termine vietato (fallback se la
    rigenerazione non basta). Spezza su punto / a-capo. */
function stripBanned(text: string): string {
  return text.split(/(?<=[.\n])/).filter(seg => {
    const low = seg.toLowerCase();
    return !BANNED.some(b => low.includes(b));
  }).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function hasBanned(text: string): boolean {
  const low = text.toLowerCase();
  return BANNED.some(b => low.includes(b));
}

serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Audit A2: utente autenticato obbligatorio + tetto giornaliero.
    const auth = await requireUser(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const MAX_PER_DAY = Number(Deno.env.get("AI_DIAGNOSIS_DAILY_LIMIT") ?? "30");
    if (!(await rateLimit(auth.user.id, "energy-diagnosis", MAX_PER_DAY))) {
      return new Response(JSON.stringify({ error: "Daily AI quota reached" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestData = await req.json() as DiagnosisRequest;

    if (!requestData.projectName || !requestData.installed) {
      throw new Error("Missing required fields (projectName or installed)");
    }

    // Audit A2: i campi liberi del chiamante entravano nel prompt così
    // com'erano, e la risposta finisce nel PDF come «diagnosi tecnica».
    requestData.projectName = promptSafe(requestData.projectName, 80);
    requestData.period = promptSafe(requestData.period, 60);

    const language = requestData.language === 'it' ? 'it' : 'en';

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const hasArea = (requestData.siteAreaM2 ?? 0) > 0;
    const userMessage = buildUserMessage(requestData);

    // Una chiamata all'AI col system prompt dato; ritorna il testo o lancia.
    const callAI = async (systemPrompt: string): Promise<string> => {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.3, // piu' basso = meno fantasia
          max_tokens: 3000,
        }),
      });
      if (!response.ok) {
        if (response.status === 429) throw Object.assign(new Error("rate"), { rate: true });
        const errText = await response.text();
        console.error("AI Gateway Error:", errText);
        throw new Error(`AI Gateway returned ${response.status}: ${errText}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? "";
    };

    try {
      const baseSystem = buildSystemPrompt(language, requestData.installed, hasArea);
      let diagnosis = await callAI(baseSystem);

      // Validazione #5: se compaiono termini vietati (BMS, digital twin,
      // antincendio, "blackout", sostituzione hardware…), rigenera UNA volta
      // con un richiamo esplicito; se resistono, togli le frasi colpevoli.
      if (hasBanned(diagnosis)) {
        console.warn("AI output tripped banned terms, regenerating once");
        const stricter = baseSystem + (language === 'it'
          ? `\nIMPORTANTE: la bozza precedente citava sistemi o azioni non consentiti. NON nominare BMS, digital twin, antincendio; NON parlare di blackout/interruzione di corrente; NON raccomandare sostituzione/ricalibrazione hardware. Attieniti ai soli dati.`
          : `\nIMPORTANT: the previous draft mentioned forbidden systems or actions. Do NOT mention BMS, digital twin, fire safety; do NOT talk about blackout/power outage; do NOT recommend hardware replacement/recalibration. Stick to the data only.`);
        const retry = await callAI(stricter);
        diagnosis = hasBanned(retry) ? stripBanned(retry) : retry;
      }

      if (!diagnosis.trim()) {
        diagnosis = language === 'it' ? "Diagnosi non disponibile." : "Diagnosis not available.";
      }

      return new Response(
        JSON.stringify({ diagnosis }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      if ((e as { rate?: boolean }).rate) {
        return new Response(
          JSON.stringify({ error: language === 'it' ? "Troppe richieste. Riprova più tardi." : "Rate limit exceeded." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw e;
    }

  } catch (error) {
    console.error("Energy Diagnosis Function Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
