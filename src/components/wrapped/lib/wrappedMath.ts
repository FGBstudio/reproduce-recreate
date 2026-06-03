/**
 * Math helpers for FGB Wrapped weekly storytelling.
 */

export const CO2_EMISSION_FACTOR_KG_KWH = 0.233; // Italy grid avg, matches PdfReportGenerator
export const CO2_KG_PER_TREE_YEAR = 21;

export interface ISOWeek {
  /** Monday 00:00 of the week, in UTC */
  start: Date;
  /** Following Monday 00:00 (exclusive end), in UTC */
  end: Date;
  /** YYYY-MM-DD string of `start` */
  startStr: string;
  /** YYYY-MM-DD string of last included day */
  endStr: string;
  label: string;
}

function startOfISOWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return out;
}

export function currentISOWeek(now: Date = new Date()): ISOWeek {
  const start = startOfISOWeek(now);
  const end = new Date(start.getTime() + 7 * 86400_000);
  const lastDay = new Date(end.getTime() - 86400_000);
  return {
    start, end,
    startStr: start.toISOString().slice(0, 10),
    endStr: lastDay.toISOString().slice(0, 10),
    label: `${start.toISOString().slice(0,10)} → ${lastDay.toISOString().slice(0,10)}`,
  };
}

export function previousISOWeek(now: Date = new Date()): ISOWeek {
  const cur = currentISOWeek(now);
  const start = new Date(cur.start.getTime() - 7 * 86400_000);
  const end = cur.start;
  const lastDay = new Date(end.getTime() - 86400_000);
  return {
    start, end,
    startStr: start.toISOString().slice(0, 10),
    endStr: lastDay.toISOString().slice(0, 10),
    label: `${start.toISOString().slice(0,10)} → ${lastDay.toISOString().slice(0,10)}`,
  };
}

export function pctDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function co2KgFromKwh(kwh: number): number {
  return kwh * CO2_EMISSION_FACTOR_KG_KWH;
}

/** Trees equivalent from kg CO₂ saved (annualised reduction projection). */
export function treesEquivFromCo2Kg(co2Kg: number): number {
  if (co2Kg <= 0) return 0;
  // weekly saving annualised: 52 weeks
  const annual = co2Kg * 52;
  return Math.max(0, Math.round(annual / CO2_KG_PER_TREE_YEAR));
}

/** kWh / m² — null if area missing or zero. */
export function eui(kwh: number | null, areaM2: number | null | undefined): number | null {
  if (kwh == null || !areaM2 || areaM2 <= 0) return null;
  return kwh / areaM2;
}

export function formatKwh(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')} MWh`;
  return `${Math.round(v).toLocaleString('it-IT')} kWh`;
}

export function formatKg(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(2)} t`;
  return `${Math.round(v)} kg`;
}

export function formatPct(v: number | null, signed = true): string {
  if (v == null) return '—';
  const sign = signed && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1).replace('.', ',')}%`;
}

export function dayName(dStr: string, lang: 'en' | 'it' = 'en'): string {
  const d = new Date(dStr + 'T00:00:00Z');
  const names = lang === 'it'
    ? ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names[d.getUTCDay()];
}

/** Generic number formatter (it-IT by default). */
export function formatNumber(v: number | null | undefined, locale: string = 'it-IT'): string {
  if (v == null || !isFinite(v)) return '—';
  return Math.round(v).toLocaleString(locale);
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Overall performance score on 0–100, weighted 80% energy / 15% water / 5% air.
 * - Energy: 100 when deltaPct <= -25%, 0 when deltaPct >= +25% (linear).
 * - Water: same scale as energy.
 * - Air: 100 when avg CO₂ <= 800 ppm, 0 at 1500 ppm (linear).
 * If a metric is null its weight is redistributed across the remaining ones.
 */
export function overallScore(input: {
  energyDeltaPct: number | null;
  waterDeltaPct: number | null;
  airAvgCo2Ppm: number | null;
}): number | null {
  const parts: { score: number; weight: number }[] = [];

  if (input.energyDeltaPct != null) {
    const d = clamp(input.energyDeltaPct, -25, 25);
    parts.push({ score: 50 - d * 2, weight: 0.80 });
  }
  if (input.waterDeltaPct != null) {
    const d = clamp(input.waterDeltaPct, -25, 25);
    parts.push({ score: 50 - d * 2, weight: 0.15 });
  }
  if (input.airAvgCo2Ppm != null) {
    const ppm = input.airAvgCo2Ppm;
    let s: number;
    if (ppm <= 800) s = 100;
    else if (ppm >= 1500) s = 0;
    else s = 100 - ((ppm - 800) / 700) * 100;
    parts.push({ score: clamp(s, 0, 100), weight: 0.05 });
  }

  if (parts.length === 0) return null;
  const totalW = parts.reduce((a, p) => a + p.weight, 0);
  const score = parts.reduce((a, p) => a + p.score * (p.weight / totalW), 0);
  return Math.round(clamp(score, 0, 100));
}

/** Identity avatar based on overall score. */
export function identityForScore(score: number | null): { name: string; emoji: string; traits: string; description: string } {
  if (score == null) return { name: 'Seedling', emoji: '🌱', traits: 'Just getting started.', description: 'Not enough data yet — your building is just starting its journey.' };
  if (score >= 90) return {
    name: 'Fern',
    emoji: '🌿',
    traits: 'Resilient. Efficient. Always green.',
    description: 'A fern thrives quietly, purifies the air, and keeps going even when conditions aren\'t perfect.',
  };
  if (score >= 75) return {
    name: 'Oak',
    emoji: '🌳',
    traits: 'Solid. Steady. Built to last.',
    description: 'An oak grows slowly but surely, offering shade and stability through every season.',
  };
  if (score >= 60) return {
    name: 'Bamboo',
    emoji: '🎋',
    traits: 'Flexible. Fast-growing. Improving.',
    description: 'Bamboo bends with the wind and grows fast — your building is on a clear upward path.',
  };
  return {
    name: 'Cactus',
    emoji: '🌵',
    traits: 'Tough. Surviving. Ready to bloom.',
    description: 'A cactus weathers harsh conditions. There is room to improve — small adjustments will make a big impact.',
  };
}