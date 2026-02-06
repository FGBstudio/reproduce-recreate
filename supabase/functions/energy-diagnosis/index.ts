import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- INTERFACCE INPUT (Allineate con il frontend) ---
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
  language: 'en' | 'it';
  modules: ModuleConfig;
  energyData?: EnergyPayload | null;
  waterData?: WaterPayload | null;
  airData?: AirPayload | null;
}

// --- COSTRUZIONE PROMPT DINAMICO ---
function buildSystemPrompt(lang: 'en' | 'it', modules: ModuleConfig): string {
  const isIt = lang === 'it';
  
  // Base del prompt
  let prompt = isIt 
    ? `Sei un esperto Facility Manager e Analista di Sostenibilità. Analizza i dati di telemetria forniti e genera una diagnosi completa in Italiano.\n\n`
    : `You are an expert Facility Manager and Sustainability Analyst. Analyze the provided telemetry data and generate a comprehensive diagnosis in English.\n\n`;

  prompt += isIt 
    ? `STRUTTURA OBBLIGATORIA DEL REPORT:\n`
    : `MANDATORY REPORT STRUCTURE:\n`;

  // 1. Executive Summary (Sempre presente)
  prompt += isIt 
    ? `### 1. Sintesi Esecutiva\n[Breve riassunto dello stato generale dell'edificio. Menziona il problema più critico trovato.]\n\n`
    : `### 1. Executive Summary\n[Brief high-level summary of building health. Mention the most critical issue found.]\n\n`;

  // 2. Energia (Solo se attivo)
  if (modules.energy) {
    prompt += isIt 
      ? `### 2. Prestazioni Energetiche\n[Analizza consumo totale, confronto con benchmark e ripartizione (HVAC vs Luci). Identifica anomalie.]\n\n`
      : `### 2. Energy Performance\n[Analyze total consumption, benchmarks comparison, and breakdown (HVAC vs Lighting). Identify anomalies.]\n\n`;
  }

  // 3. Acqua (Solo se attivo)
  if (modules.water) {
    prompt += isIt 
      ? `### 3. Gestione Idrica\n[Analizza consumi e perdite. Se ci sono perdite ("Leaks Detected" > 0), segnalale con urgenza.]\n\n`
      : `### 3. Water Management\n[Analyze consumption and leaks. If "Leaks Detected" > 0, flag this urgently.]\n\n`;
  }

  // 4. Aria (Solo se attivo)
  if (modules.air) {
    prompt += isIt 
      ? `### 4. Qualità Ambientale e Comfort\n[Valuta Temperatura, CO2 e Qualità dell'Aria (AQI). L'ambiente è salubre?]\n\n`
      : `### 4. Environmental Quality & Comfort\n[Evaluate Temperature, CO2, and Air Quality (AQI). Is the environment healthy?]\n\n`;
  }

  // 5. Raccomandazioni (Sempre presente, misto)
  prompt += isIt 
    ? `### 5. Piano d'Azione Prioritario\n[Elenca 3-5 azioni concrete combinando tutte le discipline. Esempio: "Riparare perdita acqua" priorità alta, "Ottimizzare HVAC" media.]\n\n`
    : `### 5. Consolidated Action Plan\n[List 3-5 concrete actions mixing all disciplines. E.g., "Fix water leak" high priority, "Optimize HVAC" medium.]\n\n`;

  // Istruzioni finali
  prompt += isIt 
    ? `Usa formattazione Markdown (grassetti, elenchi). Sii professionale e diretto.`
    : `Use Markdown formatting (bold, lists). Be professional and direct.`;

  return prompt;
}

function buildUserMessage(data: DiagnosisRequest): string {
  const { projectName, period, energyData, waterData, airData, language } = data;
  const isIt = language === 'it';

  let msg = `Project: ${projectName}\nPeriod: ${period}\n\n`;

  if (data.modules.energy && energyData) {
    msg += `--- ENERGY DATA ---\n`;
    msg += `Total Consumption: ${energyData.totalConsumption.toFixed(2)} kWh\n`;
    msg += `CO2 Emissions: ${energyData.co2Total.toFixed(2)} kg\n`;
    if (energyData.breakdown && energyData.breakdown.length > 0) {
      msg += `Breakdown:\n`;
      energyData.breakdown.forEach(d => msg += `- ${d.name}: ${d.kwh} kWh\n`);
    }
    msg += `\n`;
  }

  if (data.modules.water && waterData) {
    msg += `--- WATER DATA ---\n`;
    msg += `Total Consumption: ${waterData.totalConsumption.toFixed(2)} Liters\n`;
    msg += `Leaks Detected: ${waterData.leaksDetected}\n`; // Importante per l'IA
    msg += `\n`;
  }

  if (data.modules.air && airData) {
    msg += `--- AIR QUALITY DATA ---\n`;
    msg += `Avg Temperature: ${airData.avgTemp?.toFixed(1)}°C\n`;
    msg += `Avg CO2: ${airData.avgCo2?.toFixed(0)} ppm\n`;
    msg += `Air Quality Index (AQI): ${airData.avgAqi}\n`;
    msg += `Status: ${airData.status}\n`;
    msg += `\n`;
  }

  msg += isIt 
    ? `Analizza questi dati e produci il report secondo la struttura richiesta.`
    : `Analyze these data and produce the report following the requested structure.`;

  return msg;
}

// --- SERVER PRINCIPALE ---
serve(async (req) => {
  // Gestione CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Parsing del body della richiesta
    const requestData = await req.json() as DiagnosisRequest;
    
    // Validazione minima
    if (!requestData.projectName || !requestData.modules) {
      throw new Error("Missing required fields (projectName or modules)");
    }

    // Default language fallback
    const language = requestData.language || 'en';

    // 2. Recupero API Key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // 3. Costruzione Prompts
    const systemPrompt = buildSystemPrompt(language, requestData.modules);
    const userMessage = buildUserMessage(requestData);

    console.log("Sending prompt to AI:", userMessage.substring(0, 100) + "..."); // Debug log

    // 4. Chiamata a Lovable/OpenAI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview", // O gpt-4o, a seconda della tua config
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5, 
        max_tokens: 2500, // Aumentato per report più lunghi
      }),
    });

    if (!response.ok) {
        // Gestione errori API specifica
        if (response.status === 429) {
            return new Response(
                JSON.stringify({ error: language === 'it' ? "Troppe richieste. Riprova più tardi." : "Rate limit exceeded." }),
                { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
        const errText = await response.text();
        console.error("AI Gateway Error:", errText);
        throw new Error(`AI Gateway returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const diagnosis = data.choices?.[0]?.message?.content || (language === 'it' ? "Diagnosi non disponibile." : "Diagnosis not available.");

    // 5. Risposta al client
    return new Response(
      JSON.stringify({ diagnosis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Energy Diagnosis Function Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
