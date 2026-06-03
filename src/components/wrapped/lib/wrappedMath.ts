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