/**
 * Colore continuo sul gradiente di performance FGB.
 *
 * Serve a colorare un valore (consumo, indice IAQ, % sul limite) in base a
 * quanto è vicino al proprio limite: verde/acqua quando è buono, rosa e poi
 * bordeaux quando peggiora.
 *
 * Nota: l'interpolazione diretta teal → bordeaux in RGB attraversa tonalità
 * fangose, quindi la scala passa SEMPRE per uno stop rosato intermedio.
 */

/** Palette ufficiale FGB. */
export const FGB = {
  aqua: "#9fd5d9",
  teal: "#009193",
  deep: "#016368",
  bordeaux: "#931841",
  pink: "#f9cace",
} as const;

/** Scala per fondi scuri (edifici energy/water): parte dall'acqua chiara. */
const SCALE_ON_DARK = [FGB.aqua, FGB.pink, FGB.bordeaux];
/** Scala per fondi chiari (edificio air): parte dal teal profondo. */
const SCALE_ON_LIGHT = [FGB.deep, "#b85874", FGB.bordeaux];

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function mix(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

/**
 * @param ratio 0 = ottimo, 1 = al limite (valori fuori range vengono clampati)
 * @param on    fondo su cui il testo viene disegnato
 * @returns colore css `rgb(...)`
 */
export function performanceColor(ratio: number, on: "dark" | "light" = "dark"): string {
  const t = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const stops = on === "light" ? SCALE_ON_LIGHT : SCALE_ON_DARK;
  const segments = stops.length - 1;
  const i = Math.min(Math.floor(t * segments), segments - 1);
  const local = t * segments - i;
  const [r, g, b] = mix(hexToRgb(stops[i]), hexToRgb(stops[i + 1]), local);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Ratio di un valore rispetto al suo limite. Senza limite configurato usa una
 * scala sullo score (100 = ottimo → ratio 0) così il colore resta significativo.
 */
export function ratioFromLimit(value?: number | null, limit?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return value / limit;
  }
  return 0;
}

/** Ratio derivato da uno score 0-100 (100 = ottimo). */
export function ratioFromScore(score?: number | null): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, (100 - score) / 100));
}
