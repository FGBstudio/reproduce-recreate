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

/* ─────────── Month range + label helpers ─────────── */

export interface MonthRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  label: string;
  year: number;
  month: number;
}

const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTH_NAMES = MONTH_NAMES_EN;

export function wrappedMonthRange(now: Date = new Date()): MonthRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const dayOfMonth = now.getUTCDate();
  let year = y, month0 = m;
  if (dayOfMonth <= 3) {
    if (m === 0) { year = y - 1; month0 = 11; }
    else { month0 = m - 1; }
  }
  const start = new Date(Date.UTC(year, month0, 1));
  const end = new Date(Date.UTC(year, month0 + 1, 1));
  const lastDay = new Date(end.getTime() - 86400000);
  return {
    start, end,
    startStr: start.toISOString().slice(0, 10),
    endStr: lastDay.toISOString().slice(0, 10),
    label: `${MONTH_NAMES_EN[month0]} ${year}`,
    year, month: month0 + 1,
  };
}

export function previousYearMonthRange(ref: MonthRange): MonthRange {
  const start = new Date(Date.UTC(ref.year - 1, ref.month - 1, 1));
  const end = new Date(Date.UTC(ref.year - 1, ref.month, 1));
  const lastDay = new Date(end.getTime() - 86400000);
  return {
    start, end,
    startStr: start.toISOString().slice(0, 10),
    endStr: lastDay.toISOString().slice(0, 10),
    label: `${MONTH_NAMES_EN[ref.month - 1]} ${ref.year - 1}`,
    year: ref.year - 1, month: ref.month,
  };
}

export function previousMonthRange(ref: MonthRange): MonthRange {
  const m0 = ref.month - 2;
  const year = m0 < 0 ? ref.year - 1 : ref.year;
  const month0 = (m0 + 12) % 12;
  const start = new Date(Date.UTC(year, month0, 1));
  const end = new Date(Date.UTC(year, month0 + 1, 1));
  const lastDay = new Date(end.getTime() - 86400000);
  return {
    start, end,
    startStr: start.toISOString().slice(0, 10),
    endStr: lastDay.toISOString().slice(0, 10),
    label: `${MONTH_NAMES_EN[month0]} ${year}`,
    year, month: month0 + 1,
  };
}

export function formatEuro(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  return `€ ${Math.round(v).toLocaleString('it-IT')}`;
}

/* ─────────── Building archetype from hourly load profile ─────────── */

export type ArchetypeKey = 'early-bird' | 'day-shift' | 'night-owl' | 'insomniac';
export interface ArchetypeInfo {
  key: ArchetypeKey;
  name: string;
  emoji: string;
  caption: string;
  description: string;
  peakHour: number;
}

export function archetypeFromHourlyProfile(profile: (number | null)[]): ArchetypeInfo | null {
  if (!profile || profile.length !== 24) return null;
  const vals = profile.map(v => v ?? 0);
  const present = profile.filter(v => v != null && (v as number) > 0).length;
  if (present < 6) return null;
  const total = vals.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const max = Math.max(...vals);
  const positive = vals.filter(v => v > 0);
  const min = positive.length ? Math.min(...positive) : 0;
  const avg = total / 24;
  const peakHour = vals.indexOf(max);
  const flat = avg > 0 && (max - min) / avg < 0.6;

  if (flat) {
    return { key: 'insomniac', name: 'The Insomniac', emoji: '🌙',
      caption: 'Always on. Flat load 24/7.',
      description: 'Your consumption stays roughly constant day and night — typical of data centers, hospitals, or always-on facilities.',
      peakHour };
  }
  if (peakHour >= 6 && peakHour <= 11) {
    return { key: 'early-bird', name: 'The Early Bird', emoji: '🌅',
      caption: 'Energy peaks in the morning.',
      description: 'Mornings drive your usage — typical of retail openings, bakeries and offices ramping up early.',
      peakHour };
  }
  if (peakHour >= 12 && peakHour <= 17) {
    return { key: 'day-shift', name: 'The Day Shift', emoji: '☀️',
      caption: 'Steady consumption through the afternoon.',
      description: 'Your building hits its stride mid-day — classic office or workshop pattern.',
      peakHour };
  }
  return { key: 'night-owl', name: 'The Night Owl', emoji: '🌃',
    caption: 'Energy peaks in the evening.',
    description: 'Evenings are your busiest hours — typical of restaurants, gyms and entertainment venues.',
    peakHour };
}

/* ─────────── Real-life energy equivalences ─────────── */

export interface EnergyEquiv {
  icon: string;
  value: number;
  unit: string;
  label: string;
}

const EQUIV_RATES: Array<{ icon: string; unit: string; label: string; perKwh: number }> = [
  { icon: '☕', unit: '',     label: 'espressos',          perKwh: 1 / 0.015 },
  { icon: '📱', unit: '',     label: 'phone charges',      perKwh: 1 / 0.012 },
  { icon: '🚗', unit: 'km',   label: 'Tesla Model 3',      perKwh: 1 / 0.15 },
  { icon: '🧺', unit: '',     label: 'laundry loads',      perKwh: 1 / 1.0 },
  { icon: '💡', unit: 'h',    label: 'LED bulb',           perKwh: 1 / 0.087 },
  { icon: '🍕', unit: '',     label: 'pizzas baked',       perKwh: 1 / 0.8 },
];

/** Deterministic pick of 3 equivalences seeded by siteId+month. */
export function energyEquivalences(kwh: number, seed: string): EnergyEquiv[] {
  if (!isFinite(kwh) || kwh <= 0) return [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const start = h % EQUIV_RATES.length;
  const pool = EQUIV_RATES.slice(start).concat(EQUIV_RATES.slice(0, start));
  return [0, 1, 2].map(i => {
    const r = pool[i];
    return { icon: r.icon, label: r.label, unit: r.unit, value: Math.round(kwh * r.perKwh) };
  });
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

/* ─────────── Weekly site score (matches OverviewSection formulas) ───────────
 * Uses *weekly averages* of the same quantities the dashboard ScoreHero uses:
 *   - energy:  avg power kW    → 100 - (kW/100)*20         (clamp 0..100)
 *   - air:     avg CO₂ ppm     → 100 - ((ppm-400)/600)*100 (clamp 0..100)
 *   - water:   omitted (no reliable weekly water in wrap)  – weight redistributed
 * Weights mirror MODULE_WEIGHTS in OverviewSection: energy 0.80, air 0.05, water 0.15.
 */
export function weeklySiteScore(input: {
  avgPowerKw: number | null;
  avgCo2Ppm: number | null;
}): number | null {
  const parts: { score: number; weight: number }[] = [];
  if (input.avgPowerKw != null && isFinite(input.avgPowerKw)) {
    const s = clamp(100 - (input.avgPowerKw / 100) * 20, 0, 100);
    parts.push({ score: s, weight: 0.80 });
  }
  if (input.avgCo2Ppm != null && isFinite(input.avgCo2Ppm)) {
    const s = clamp(100 - ((input.avgCo2Ppm - 400) / 600) * 100, 0, 100);
    parts.push({ score: s, weight: 0.05 });
  }
  if (parts.length === 0) return null;
  const totalW = parts.reduce((a, p) => a + p.weight, 0);
  const score = parts.reduce((a, p) => a + p.score * (p.weight / totalW), 0);
  return Math.round(clamp(score, 0, 100));
}