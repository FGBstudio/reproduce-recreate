import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Language = 'en' | 'it';

interface EnergyData {
  projectName: string;
  period: string;
  totalConsumption: number;
  hvacConsumption: number;
  lightingConsumption: number;
  co2Emissions: number;
  avgTemperature: number;
  avgCo2: number;
  avgHumidity: number;
  airQualityIndex: string;
  area_m2?: number;
  energy_price_kwh?: number;
  deviceBreakdown?: Array<{ name: string; consumption: number; category?: string }>;
  waterConsumption?: number;
  waterLeaks?: number;
  pm25?: number;
  pm10?: number;
  language?: Language;
}

function getSystemPrompt(lang: Language): string {
  if (lang === 'it') {
    return `Sei un esperto consulente energetico per edifici commerciali e retail. 
Analizza i dati energetici forniti e genera una diagnosi professionale in italiano.

La diagnosi deve includere:
1. **Sintesi Prestazioni**: Valutazione generale delle prestazioni energetiche
2. **Analisi Consumi**: Breakdown dei consumi per categoria (HVAC, illuminazione, altro)
3. **Efficienza Energetica**: Calcolo e valutazione dell'intensità energetica (kWh/m²)
4. **Impatto Ambientale**: Analisi delle emissioni CO₂ e confronto con benchmark di settore
5. **Qualità Ambientale**: Valutazione di temperatura, CO₂, umidità e qualità dell'aria
6. **Raccomandazioni**: 3-5 azioni concrete per migliorare l'efficienza
7. **Priorità Interventi**: Classificazione interventi per impatto/costo
8. **Risparmio Stimato**: Stima potenziale di risparmio energetico ed economico

Rispondi in formato strutturato con sezioni chiare. Usa dati specifici quando disponibili.
Mantieni un tono professionale ma accessibile.`;
  }

  return `You are an expert energy consultant for commercial and retail buildings.
Analyze the provided energy data and generate a professional diagnosis in English.

The diagnosis should include:
1. **Performance Summary**: Overall assessment of energy performance
2. **Consumption Analysis**: Breakdown of consumption by category (HVAC, lighting, other)
3. **Energy Efficiency**: Calculation and evaluation of energy intensity (kWh/m²)
4. **Environmental Impact**: CO₂ emissions analysis and comparison with industry benchmarks
5. **Environmental Quality**: Assessment of temperature, CO₂, humidity, and air quality
6. **Recommendations**: 3-5 concrete actions to improve efficiency
7. **Intervention Priorities**: Classification of interventions by impact/cost
8. **Estimated Savings**: Potential energy and economic savings estimate

Respond in a structured format with clear sections. Use specific data when available.
Maintain a professional but accessible tone.`;
}

function buildUserPrompt(data: EnergyData, lang: Language): string {
  const isIt = lang === 'it';
  const locale = isIt ? 'it-IT' : 'en-US';
  const currency = isIt ? '€' : '$';
  
  const labels = {
    title: isIt ? 'Dati Energetici' : 'Energy Data',
    period: isIt ? 'Periodo di riferimento' : 'Reference period',
    consumption: isIt ? 'Consumi Energetici' : 'Energy Consumption',
    total: isIt ? 'Consumo Totale' : 'Total Consumption',
    hvac: 'HVAC',
    lighting: isIt ? 'Illuminazione' : 'Lighting',
    co2Emissions: isIt ? 'Emissioni CO₂' : 'CO₂ Emissions',
    surface: isIt ? 'Superficie' : 'Floor Area',
    intensity: isIt ? 'Intensità Energetica' : 'Energy Intensity',
    energyCost: isIt ? 'Costo Energia' : 'Energy Cost',
    totalCost: isIt ? 'Costo Totale Stimato' : 'Estimated Total Cost',
    envQuality: isIt ? 'Qualità Ambientale' : 'Environmental Quality',
    avgTemp: isIt ? 'Temperatura Media' : 'Average Temperature',
    avgCo2: isIt ? 'CO₂ Medio' : 'Average CO₂',
    avgHumidity: isIt ? 'Umidità Media' : 'Average Humidity',
    aqIndex: isIt ? 'Indice Qualità Aria' : 'Air Quality Index',
    deviceBreakdown: isIt ? 'Breakdown per Dispositivo' : 'Device Breakdown',
    waterConsumption: isIt ? 'Consumi Idrici' : 'Water Consumption',
    water: isIt ? 'Consumo Acqua' : 'Water Consumption',
    leaksDetected: isIt ? '⚠️ Perdite Rilevate' : '⚠️ Leaks Detected',
    generateDiagnosis: isIt 
      ? 'Genera una diagnosi energetica completa basata su questi dati.'
      : 'Generate a complete energy diagnosis based on this data.',
  };

  const lines: string[] = [
    `# ${labels.title}: ${data.projectName}`,
    `**${labels.period}**: ${data.period}`,
    "",
    `## ${labels.consumption}`,
    `- ${labels.total}: ${data.totalConsumption.toLocaleString(locale)} kWh`,
    `- ${labels.hvac}: ${data.hvacConsumption.toLocaleString(locale)} kWh (${((data.hvacConsumption / data.totalConsumption) * 100).toFixed(1)}%)`,
    `- ${labels.lighting}: ${data.lightingConsumption.toLocaleString(locale)} kWh (${((data.lightingConsumption / data.totalConsumption) * 100).toFixed(1)}%)`,
    `- ${labels.co2Emissions}: ${data.co2Emissions.toLocaleString(locale)} kg`,
  ];

  if (data.area_m2) {
    const intensity = data.totalConsumption / data.area_m2;
    lines.push(`- ${labels.surface}: ${data.area_m2.toLocaleString(locale)} m²`);
    lines.push(`- ${labels.intensity}: ${intensity.toFixed(2)} kWh/m²`);
  }

  if (data.energy_price_kwh) {
    const cost = data.totalConsumption * data.energy_price_kwh;
    lines.push(`- ${labels.energyCost}: ${currency}${data.energy_price_kwh.toFixed(4)}/kWh`);
    lines.push(`- ${labels.totalCost}: ${currency}${cost.toLocaleString(locale, { minimumFractionDigits: 2 })}`);
  }

  lines.push("");
  lines.push(`## ${labels.envQuality}`);
  lines.push(`- ${labels.avgTemp}: ${data.avgTemperature}°C`);
  lines.push(`- ${labels.avgCo2}: ${data.avgCo2} ppm`);
  lines.push(`- ${labels.avgHumidity}: ${data.avgHumidity}%`);
  lines.push(`- ${labels.aqIndex}: ${data.airQualityIndex}`);

  if (data.pm25 !== undefined || data.pm10 !== undefined) {
    const na = isIt ? "N/D" : "N/A";
    lines.push(`- PM2.5: ${data.pm25 ?? na} µg/m³`);
    lines.push(`- PM10: ${data.pm10 ?? na} µg/m³`);
  }

  if (data.deviceBreakdown && data.deviceBreakdown.length > 0) {
    lines.push("");
    lines.push(`## ${labels.deviceBreakdown}`);
    data.deviceBreakdown.forEach((device) => {
      const pct = ((device.consumption / data.totalConsumption) * 100).toFixed(1);
      lines.push(`- ${device.name}: ${device.consumption.toLocaleString(locale)} kWh (${pct}%)`);
    });
  }

  if (data.waterConsumption !== undefined) {
    lines.push("");
    lines.push(`## ${labels.waterConsumption}`);
    lines.push(`- ${labels.water}: ${data.waterConsumption.toLocaleString(locale)} L`);
    if (data.waterLeaks !== undefined && data.waterLeaks > 0) {
      lines.push(`- ${labels.leaksDetected}: ${data.waterLeaks}`);
    }
  }

  lines.push("");
  lines.push(labels.generateDiagnosis);

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { energyData } = await req.json() as { energyData: EnergyData };
    const language: Language = energyData.language || 'en';
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = getSystemPrompt(language);
    const userPrompt = buildUserPrompt(energyData, language);

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: language === 'it' ? "Limite richieste superato. Riprova più tardi." : "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: language === 'it' ? "Pagamento richiesto. Aggiungi crediti al workspace." : "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const diagnosis = data.choices?.[0]?.message?.content || (language === 'it' ? "Diagnosi non disponibile" : "Diagnosis not available");

    return new Response(
      JSON.stringify({ diagnosis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Energy diagnosis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
