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
