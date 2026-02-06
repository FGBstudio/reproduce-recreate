/**
 * Energy Diagnosis API client
 * Calls the edge function to generate AI-powered energy diagnostics
 */

export interface EnergyDiagnosisInput {
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

export interface EnergyDiagnosisResult {
  diagnosis: string;
  error?: string;
}

/**
 * Generate AI-powered energy diagnosis for a project
 */
export async function generateEnergyDiagnosis(
  energyData: EnergyDiagnosisInput
): Promise<EnergyDiagnosisResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (!supabaseUrl) {
    return { 
      diagnosis: "", 
      error: "Supabase non configurato" 
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/energy-diagnosis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ energyData }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { diagnosis: "", error: "Limite richieste AI raggiunto. Riprova più tardi." };
      }
      if (response.status === 402) {
        return { diagnosis: "", error: "Crediti AI esauriti. Aggiungi crediti al workspace." };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      return { diagnosis: "", error: data.error };
    }

    return { diagnosis: data.diagnosis };
  } catch (error) {
    console.error("Energy diagnosis error:", error);
    return { 
      diagnosis: "", 
      error: error instanceof Error ? error.message : "Errore sconosciuto" 
    };
  }
}
