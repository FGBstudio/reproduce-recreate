/**
 * Soglie di qualità dell'aria — FONTE UNICA E CANONICA.
 *
 * Prima di questo modulo le soglie CO₂ erano duplicate in almeno 3 componenti
 * con giudizi INCOERENTI tra loro (es. 1200 ppm = "POOR" nel pannello KPI ma
 * "MODERATE" nella vista sito). Qualsiasi componente che giudica la CO₂ deve
 * importare da qui. Se in futuro le soglie cambiano, si cambia SOLO questo file.
 *
 * Scala basata sulle linee guida comuni per ambienti indoor:
 *   ≤ 600 ppm  EXCELLENT   (aria molto buona, ricambio ottimale)
 *   ≤ 1000 ppm GOOD        (accettabile, soglia di comfort classica)
 *   ≤ 1500 ppm MODERATE    (ventilazione da migliorare)
 *   >  1500 ppm POOR       (intervento necessario)
 */

export type Co2Level = "EXCELLENT" | "GOOD" | "MODERATE" | "POOR";

export const CO2_THRESHOLDS = {
  excellent: 600,
  good: 1000,
  moderate: 1500,
} as const;

export function co2Level(ppm: number): Co2Level {
  if (ppm <= CO2_THRESHOLDS.excellent) return "EXCELLENT";
  if (ppm <= CO2_THRESHOLDS.good) return "GOOD";
  if (ppm <= CO2_THRESHOLDS.moderate) return "MODERATE";
  return "POOR";
}

/** Score 0-100 derivato dalla CO₂ (400 ppm = 100, degrada linearmente). */
export function co2ToScore(ppm: number): number {
  return Math.round(Math.max(0, Math.min(100, 100 - ((ppm - 400) / 600) * 100)));
}

/** Classi colore Tailwind coerenti per livello, uguali in tutta l'app. */
export const CO2_LEVEL_COLORS: Record<Co2Level, string> = {
  EXCELLENT: "text-emerald-500",
  GOOD: "text-lime-500",
  MODERATE: "text-amber-500",
  POOR: "text-red-500",
};

// ─────────────────────────────────────────────
// Indice sintetico multi-parametro (worst-pollutant)
// ─────────────────────────────────────────────
// Ogni inquinante ha una curva lineare fra "ottimo" (score 100) e "critico" (score 0).
// Lo score finale è il MINIMO fra i sotto-score disponibili — stesso approccio dell'AQI EPA
// e dell'Indice di Parigi: la qualità dell'aria è dettata dall'inquinante peggiore.
//
// Valori mancanti o non numerici vengono ignorati; se nessun inquinante è disponibile
// la funzione restituisce `null` (il chiamante mostrerà NO_DATA).

type PollutantKey = "co2" | "voc" | "pm25" | "pm10" | "o3" | "co";

const POLLUTANT_CURVES: Record<PollutantKey, { best: number; worst: number; metricKeys: string[] }> = {
  co2:  { best: 400,  worst: 1500, metricKeys: ["iaq.co2",  "co2"] },
  voc:  { best: 200,  worst: 1000, metricKeys: ["iaq.voc",  "tvoc", "voc"] },
  pm25: { best: 5,    worst: 35,   metricKeys: ["iaq.pm25", "pm25"] },
  pm10: { best: 15,   worst: 50,   metricKeys: ["iaq.pm10", "pm10"] },
  o3:   { best: 60,   worst: 120,  metricKeys: ["iaq.o3",   "o3"] },
  co:   { best: 2,    worst: 9,    metricKeys: ["iaq.co",   "co"] },
};

function subScore(value: number, best: number, worst: number): number {
  if (!Number.isFinite(value)) return 100;
  const ratio = (value - best) / (worst - best);
  return Math.round(Math.max(0, Math.min(100, 100 - ratio * 100)));
}

export interface AirIndexResult {
  score: number;
  components: Partial<Record<PollutantKey, number>>;
  driver: PollutantKey; // inquinante peggiore
}

/**
 * Calcola l'Air Quality Index sintetico da un dizionario di metriche telemetriche.
 * Ritorna `null` se nessun inquinante mappato è disponibile.
 */
export function computeAirIndex(
  metrics: Record<string, number | undefined | null> | null | undefined,
): AirIndexResult | null {
  if (!metrics) return null;
  const components: Partial<Record<PollutantKey, number>> = {};

  (Object.keys(POLLUTANT_CURVES) as PollutantKey[]).forEach((key) => {
    const { best, worst, metricKeys } = POLLUTANT_CURVES[key];
    for (const mk of metricKeys) {
      const v = metrics[mk];
      if (typeof v === "number" && Number.isFinite(v)) {
        components[key] = subScore(v, best, worst);
        return;
      }
    }
  });

  const entries = Object.entries(components) as [PollutantKey, number][];
  if (entries.length === 0) return null;

  let driver: PollutantKey = entries[0][0];
  let min = entries[0][1];
  for (const [k, s] of entries) {
    if (s < min) { min = s; driver = k; }
  }
  return { score: min, components, driver };
}
