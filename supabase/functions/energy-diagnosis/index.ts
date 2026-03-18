import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnergyPayload {
  totalConsumption: number;
  breakdown: Array<{ name: string; kwh: number }>;
  co2Total: number;
}

interface WaterPayload {
  totalConsumption: number;
  leaksDetected: number;
  avgPh?: number;
  avgTurbidity?: number;
}

interface AirPayload {
  avgTemp: number;
  avgCo2: number;
  avgAqi: string;
  status: string;
}

interface ModuleConfig {
  energy: boolean;
  water: boolean;
  air: boolean;
}

interface DiagnosisRequest {
  projectName: string;
  period: string;
  language: 'en' | 'it' | 'fr' | 'es' | 'zh';
  modules: ModuleConfig;
  energyData?: EnergyPayload | null;
  waterData?: WaterPayload | null;
  airData?: AirPayload | null;
}

function buildSystemPrompt(lang: string, modules: ModuleConfig): string {
  const isIt = lang === 'it';

  let prompt = isIt
    ? `Sei un esperto Facility Manager e Analista di Sostenibilità. Analizza i dati di telemetria forniti e genera una diagnosi completa in Italiano.\n\n`
    : `You are an expert Facility Manager and Sustainability Analyst. Analyze the provided telemetry data and generate a comprehensive diagnosis in English.\n\n`;

  // CRITICAL FORMATTING RULES
  prompt += isIt
    ? `REGOLE DI FORMATTAZIONE OBBLIGATORIE:\n- NON usare MAI LaTeX, MathJax o notazione matematica ($, \\circ, ^{}, etc.)\n- Scrivi le unità in testo semplice: 25 °C, 1200 ppm, 45 %, 150 kWh\n- Usa solo Markdown standard (### titoli, **grassetto**, elenchi con -)\n- Numeri con massimo 2 decimali e separatore migliaia: 1,240.50\n- Ogni valore DEVE avere la sua unità di misura\n\n`
    : `MANDATORY FORMATTING RULES:\n- NEVER use LaTeX, MathJax or math notation ($, \\circ, ^{}, etc.)\n- Write units in plain text: 25 °C, 1200 ppm, 45 %, 150 kWh\n- Use only standard Markdown (### headings, **bold**, lists with -)\n- Numbers with max 2 decimals and thousands separator: 1,240.50\n- Every value MUST include its unit of measurement\n\n`;

  prompt += isIt
    ? `STRUTTURA OBBLIGATORIA DEL REPORT (questo ordine è fondamentale):\n`
    : `MANDATORY REPORT STRUCTURE (this order is critical):\n`;

  // 1. Executive Summary with ACTION PLAN FIRST
  prompt += isIt
    ? `### 1. Piano d'Azione Prioritario (PRIMA DI TUTTO)\n[Elenca 3-5 azioni concrete con priorità (ALTA/MEDIA/BASSA). Ogni azione deve specificare: cosa fare, impatto stimato, urgenza. Questo è il contenuto più importante del report - i dirigenti leggono solo questa sezione.]\n\n`
    : `### 1. Priority Action Plan (FIRST AND FOREMOST)\n[List 3-5 concrete actions with priority (HIGH/MEDIUM/LOW). Each action must specify: what to do, estimated impact, urgency. This is the most important content - executives only read this section.]\n\n`;

  // 2. Executive Summary
  prompt += isIt
    ? `### 2. Sintesi Esecutiva\n[Breve riassunto (3-4 frasi) dello stato generale dell'edificio. Menziona il problema più critico e il principale punto di forza.]\n\n`
    : `### 2. Executive Summary\n[Brief summary (3-4 sentences) of overall building health. Mention the most critical issue and the main strength.]\n\n`;

  // Module-specific sections
  if (modules.energy) {
    prompt += isIt
      ? `### 3. Prestazioni Energetiche\n[Analizza consumo totale, confronto con benchmark (tipico ufficio: 150-250 kWh/m²/anno), ripartizione HVAC vs Illuminazione. Identifica anomalie. Indica sempre i valori in kWh e i costi in €.]\n\n`
      : `### 3. Energy Performance\n[Analyze total consumption, benchmark comparison (typical office: 150-250 kWh/m²/year), HVAC vs Lighting breakdown. Identify anomalies. Always show values in kWh and costs in €.]\n\n`;
  }

  if (modules.water) {
    prompt += isIt
      ? `### 4. Gestione Idrica\n[Analizza consumi in litri e perdite. Se "Leaks Detected" > 0, segnala con urgenza ALTA.]\n\n`
      : `### 4. Water Management\n[Analyze consumption in liters and leaks. If "Leaks Detected" > 0, flag as HIGH urgency.]\n\n`;
  }

  if (modules.air) {
    prompt += isIt
      ? `### 5. Qualità Ambientale e Comfort\n[Valuta Temperatura (°C), CO2 (ppm), Umidità (%), AQI. Confronta con limiti WHO: CO2 < 1000 ppm, Temp 20-26 °C, Umidità 40-60 %.]\n\n`
      : `### 5. Environmental Quality & Comfort\n[Evaluate Temperature (°C), CO2 (ppm), Humidity (%), AQI. Compare with WHO limits: CO2 < 1000 ppm, Temp 20-26 °C, Humidity 40-60 %.]\n\n`;
  }

  prompt += isIt
    ? `Sii professionale, diretto e quantitativo. Ogni affermazione deve essere supportata da un dato numerico con unità di misura.`
    : `Be professional, direct and quantitative. Every statement must be backed by a numeric value with unit of measurement.`;

  return prompt;
}

function buildUserMessage(data: DiagnosisRequest): string {
  const { projectName, period, energyData, waterData, airData } = data;

  let msg = `Project: ${projectName}\nPeriod: ${period}\n\n`;

  if (data.modules.energy && energyData) {
    msg += `--- ENERGY DATA ---\n`;
    msg += `Total Consumption: ${energyData.totalConsumption.toFixed(2)} kWh\n`;
    msg += `CO2 Emissions: ${energyData.co2Total.toFixed(2)} kg\n`;
    if (energyData.breakdown?.length > 0) {
      msg += `Breakdown:\n`;
      energyData.breakdown.forEach(d => msg += `- ${d.name}: ${d.kwh} kWh\n`);
    }
    msg += `\n`;
  }

  if (data.modules.water && waterData) {
    msg += `--- WATER DATA ---\n`;
    msg += `Total Consumption: ${waterData.totalConsumption.toFixed(2)} Liters\n`;
    msg += `Leaks Detected: ${waterData.leaksDetected}\n`;
    msg += `\n`;
  }

  if (data.modules.air && airData) {
    msg += `--- AIR QUALITY DATA ---\n`;
    msg += `Avg Temperature: ${airData.avgTemp?.toFixed(1)} °C\n`;
    msg += `Avg CO2: ${airData.avgCo2?.toFixed(0)} ppm\n`;
    msg += `Air Quality Index (AQI): ${airData.avgAqi}\n`;
    msg += `Status: ${airData.status}\n`;
    msg += `\n`;
  }

  msg += `Produce the report following the mandatory structure. Remember: NO LaTeX, plain text units only.`;

  return msg;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json() as DiagnosisRequest;

    if (!requestData.projectName || !requestData.modules) {
      throw new Error("Missing required fields (projectName or modules)");
    }

    const language = requestData.language || 'en';

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = buildSystemPrompt(language, requestData.modules);
    const userMessage = buildUserMessage(requestData);

    console.log("Sending prompt to AI:", userMessage.substring(0, 100) + "...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: language === 'it' ? "Troppe richieste. Riprova più tardi." : "Rate limit exceeded." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errText = await response.text();
      console.error("AI Gateway Error:", errText);
      throw new Error(`AI Gateway returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const diagnosis = data.choices?.[0]?.message?.content || (language === 'it' ? "Diagnosi non disponibile." : "Diagnosis not available.");

    return new Response(
      JSON.stringify({ diagnosis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Energy Diagnosis Function Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
