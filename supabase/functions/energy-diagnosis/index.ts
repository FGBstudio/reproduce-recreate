import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { energyData } = await req.json() as { energyData: EnergyData };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context-rich prompt
    const systemPrompt = `Sei un esperto consulente energetico per edifici commerciali e retail. 
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

    const userPrompt = buildUserPrompt(energyData);

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
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const diagnosis = data.choices?.[0]?.message?.content || "Diagnosi non disponibile";

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

function buildUserPrompt(data: EnergyData): string {
  const lines: string[] = [
    `# Dati Energetici: ${data.projectName}`,
    `**Periodo di riferimento**: ${data.period}`,
    "",
    "## Consumi Energetici",
    `- Consumo Totale: ${data.totalConsumption.toLocaleString("it-IT")} kWh`,
    `- HVAC: ${data.hvacConsumption.toLocaleString("it-IT")} kWh (${((data.hvacConsumption / data.totalConsumption) * 100).toFixed(1)}%)`,
    `- Illuminazione: ${data.lightingConsumption.toLocaleString("it-IT")} kWh (${((data.lightingConsumption / data.totalConsumption) * 100).toFixed(1)}%)`,
    `- Emissioni CO₂: ${data.co2Emissions.toLocaleString("it-IT")} kg`,
  ];

  if (data.area_m2) {
    const intensity = data.totalConsumption / data.area_m2;
    lines.push(`- Superficie: ${data.area_m2.toLocaleString("it-IT")} m²`);
    lines.push(`- Intensità Energetica: ${intensity.toFixed(2)} kWh/m²`);
  }

  if (data.energy_price_kwh) {
    const cost = data.totalConsumption * data.energy_price_kwh;
    lines.push(`- Costo Energia: €${data.energy_price_kwh.toFixed(4)}/kWh`);
    lines.push(`- Costo Totale Stimato: €${cost.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`);
  }

  lines.push("");
  lines.push("## Qualità Ambientale");
  lines.push(`- Temperatura Media: ${data.avgTemperature}°C`);
  lines.push(`- CO₂ Medio: ${data.avgCo2} ppm`);
  lines.push(`- Umidità Media: ${data.avgHumidity}%`);
  lines.push(`- Indice Qualità Aria: ${data.airQualityIndex}`);

  if (data.pm25 !== undefined || data.pm10 !== undefined) {
    lines.push(`- PM2.5: ${data.pm25 ?? "N/D"} µg/m³`);
    lines.push(`- PM10: ${data.pm10 ?? "N/D"} µg/m³`);
  }

  if (data.deviceBreakdown && data.deviceBreakdown.length > 0) {
    lines.push("");
    lines.push("## Breakdown per Dispositivo");
    data.deviceBreakdown.forEach((device) => {
      const pct = ((device.consumption / data.totalConsumption) * 100).toFixed(1);
      lines.push(`- ${device.name}: ${device.consumption.toLocaleString("it-IT")} kWh (${pct}%)`);
    });
  }

  if (data.waterConsumption !== undefined) {
    lines.push("");
    lines.push("## Consumi Idrici");
    lines.push(`- Consumo Acqua: ${data.waterConsumption.toLocaleString("it-IT")} L`);
    if (data.waterLeaks !== undefined && data.waterLeaks > 0) {
      lines.push(`- ⚠️ Perdite Rilevate: ${data.waterLeaks}`);
    }
  }

  lines.push("");
  lines.push("Genera una diagnosi energetica completa basata su questi dati.");

  return lines.join("\n");
}
