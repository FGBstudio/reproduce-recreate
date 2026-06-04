/**
 * useSiteMonthlyWrap — fetches real telemetry needed for the *monthly*
 * single-site Wrapped story, mirroring `fgb-wrapped-v3-5.html`.
 *
 * Returns SiteMonthlyData which is a superset of SiteWeeklyData so existing
 * mono-site slides can keep typing against SiteWeeklyData where they don't
 * need the extra fields.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  wrappedMonthRange,
  previousMonthRange,
  previousYearMonthRange,
  pctDelta,
  co2KgFromKwh,
  treesEquivFromCo2Kg,
  eui,
  archetypeFromHourlyProfile,
  ArchetypeInfo,
} from '../lib/wrappedMath';
import type { SiteWeeklyData, DailyKwh } from './useSiteWeeklyWrap';

const ENERGY_METRICS = ['energy.active_import_kwh', 'energy.active_energy'];
const CO2_METRICS  = ['iaq.co2', 'CO2', 'co2'];
const VOC_METRICS  = ['iaq.voc', 'iaq.tvoc', 'voc', 'tvoc'];
const PM25_METRICS = ['iaq.pm25', 'iaq.pm2_5', 'pm25', 'pm2_5'];

const WELL_CO2 = 800;
const VOC_LIMIT = 300;     // µg/m³ rough WHO guideline
const PM25_LIMIT = 15;     // µg/m³ WHO 24h

export interface WeekBucket {
  index: number;     // 1..5
  startStr: string;
  endStr: string;
  kwh: number | null;
  co2Kg: number | null;
}

export interface EnergyBreakdown {
  hvac: number;
  lighting: number;
  plugs: number;
  other: number;
  total: number;     // sum of the four
}

export interface AirMetricStat {
  metric: 'co2' | 'voc' | 'pm25';
  avg: number | null;
  hoursExcellent: number;
  limit: number;
  unit: string;
}

export interface PeerRow {
  siteId: string;
  name: string;
  score: number;     // 0..100, higher is better
  isMe: boolean;
}

export interface PeerBenchmark {
  brandName: string;
  total: number;       // number of peers with valid data (incl. me)
  rank: number;        // 1-based rank of current site
  myScore: number;
  top5: PeerRow[];     // top 5 entries, with current site injected if outside top5
  basis: 'eui' | 'kwh';
  monthLabel: string;
}

export interface AlertItem {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  durationMin: number | null;   // null if still active
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface SiteMonthlyData extends SiteWeeklyData {
  monthLabel: string;
  prevMonthLabel: string;
  prevYearMonthLabel: string;
  hasAirDevices: boolean;
  peer: PeerBenchmark | null;

  energy: SiteWeeklyData['energy'] & {
    monthKwh: number | null;
    prevMonthKwh: number | null;
    yoyKwh: number | null;
    yoyDeltaPct: number | null;
    weeks: WeekBucket[];
    byCategory: EnergyBreakdown | null;
    hourlyProfile: (number | null)[]; // length 24
    archetype: ArchetypeInfo | null;
  };

  air: SiteWeeklyData['air'] & {
    hoursExcellent: number | null;     // all metrics within limits simultaneously
    perMetric: AirMetricStat[];
  };
  alerts: SiteWeeklyData['alerts'] & {
    items: AlertItem[];
    countsBySeverity: { critical: number; warning: number; info: number };
    totalDurationMin: number;
  };
}

/* ──────────────────────────────────────────────────────── helpers ───── */

async function fetchEnergyDailyByCategory(
  siteId: string, start: string, end: string,
): Promise<{ daily: DailyKwh[]; byCategory: EnergyBreakdown | null; totalKwh: number | null }> {
  if (!supabase) return { daily: [], byCategory: null, totalKwh: null };

  const { data: devs } = await supabase
    .from('devices')
    .select('id, category')
    .eq('site_id', siteId);
  const all = devs ?? [];
  if (all.length === 0) return { daily: [], byCategory: null, totalKwh: null };

  const ids = all.map((d: any) => d.id);
  const catById = new Map<string, string>(all.map((d: any) => [d.id, (d.category ?? '').toLowerCase()]));

  const { data } = await supabase
    .from('energy_daily')
    .select('device_id, ts_day, value_sum, metric')
    .in('device_id', ids)
    .gte('ts_day', start)
    .lte('ts_day', end)
    .in('metric', ENERGY_METRICS);

  // Daily totals from 'general' meters (trunk), like the weekly hook.
  const byDay = new Map<string, number>();
  const sumByCat: Record<string, number> = { hvac: 0, lighting: 0, plugs: 0, general: 0, other: 0 };
  (data ?? []).forEach((r: any) => {
    if (r.value_sum == null) return;
    const v = Number(r.value_sum);
    const cat = catById.get(r.device_id) ?? 'other';
    if (cat === 'general') byDay.set(r.ts_day, (byDay.get(r.ts_day) ?? 0) + v);
    if (cat in sumByCat) sumByCat[cat] += v;
    else sumByCat.other += v;
  });

  // Fill day slots
  const daily: DailyKwh[] = [];
  const startD = new Date(start + 'T00:00:00Z');
  const endD = new Date(end + 'T00:00:00Z');
  for (let d = new Date(startD); d <= endD; d = new Date(d.getTime() + 86400000)) {
    const s = d.toISOString().slice(0, 10);
    daily.push({ day: s, kwh: byDay.has(s) ? byDay.get(s)! : null });
  }

  const totalGeneral = Array.from(byDay.values()).reduce((a, b) => a + b, 0);
  const totalKwh = totalGeneral > 0
    ? totalGeneral
    : (sumByCat.hvac + sumByCat.lighting + sumByCat.plugs + sumByCat.other) || null;

  const breakdownSum = sumByCat.hvac + sumByCat.lighting + sumByCat.plugs + sumByCat.other;
  const byCategory: EnergyBreakdown | null = breakdownSum > 0 ? {
    hvac: sumByCat.hvac,
    lighting: sumByCat.lighting,
    plugs: sumByCat.plugs,
    other: sumByCat.other,
    total: breakdownSum,
  } : null;

  return { daily, byCategory, totalKwh };
}

async function fetchEnergyTotal(siteId: string, start: string, end: string): Promise<number | null> {
  if (!supabase) return null;
  const { data: devs } = await supabase
    .from('devices').select('id').eq('site_id', siteId).eq('category', 'general');
  const ids = (devs ?? []).map((d: any) => d.id);
  if (ids.length === 0) return null;
  const { data } = await supabase
    .from('energy_daily')
    .select('value_sum')
    .in('device_id', ids)
    .gte('ts_day', start)
    .lte('ts_day', end)
    .in('metric', ENERGY_METRICS);
  const sum = (data ?? []).reduce((a: number, r: any) => a + (r.value_sum != null ? Number(r.value_sum) : 0), 0);
  return sum > 0 ? sum : null;
}

/** 24-slot mean kWh per hour-of-day. Falls back to null entries if table missing. */
async function fetchEnergyHourlyProfile(siteId: string, start: string, end: string): Promise<(number | null)[]> {
  const empty = Array.from({ length: 24 }, () => null) as (number | null)[];
  if (!supabase) return empty;
  const { data: devs } = await supabase
    .from('devices').select('id').eq('site_id', siteId).eq('category', 'general');
  const ids = (devs ?? []).map((d: any) => d.id);
  if (ids.length === 0) return empty;

  try {
    const { data, error } = await supabase
      .from('energy_hourly')
      .select('ts_hour, value_sum, metric')
      .in('device_id', ids)
      .gte('ts_hour', start + 'T00:00:00Z')
      .lt('ts_hour', end + 'T23:59:59Z')
      .in('metric', ENERGY_METRICS)
      .limit(10000);
    if (error) return empty;
    const sums = Array.from({ length: 24 }, () => 0);
    const counts = Array.from({ length: 24 }, () => 0);
    (data ?? []).forEach((r: any) => {
      if (r.value_sum == null) return;
      const h = new Date(r.ts_hour).getUTCHours();
      sums[h] += Number(r.value_sum);
      counts[h] += 1;
    });
    return sums.map((s, h) => counts[h] > 0 ? s / counts[h] : null);
  } catch {
    return empty;
  }
}

async function fetchAirHourly(siteId: string, start: string, end: string): Promise<{
  perMetric: AirMetricStat[]; hoursAllExcellent: number | null;
}> {
  const empty = { perMetric: [], hoursAllExcellent: null as number | null };
  if (!supabase) return empty;
  const { data: devs } = await supabase
    .from('devices').select('id').eq('site_id', siteId).eq('device_type', 'air_quality');
  const ids = (devs ?? []).map((d: any) => d.id);
  if (ids.length === 0) return empty;

  const allMetrics = [...CO2_METRICS, ...VOC_METRICS, ...PM25_METRICS];
  try {
    const { data, error } = await supabase
      .from('telemetry_hourly')
      .select('ts_hour, value_avg, metric')
      .in('device_id', ids)
      .gte('ts_hour', start + 'T00:00:00Z')
      .lt('ts_hour', end + 'T23:59:59Z')
      .in('metric', allMetrics)
      .limit(20000);
    if (error) return empty;

    // Bucket per-hour averages per kind
    const byHour = new Map<string, { co2: number[]; voc: number[]; pm25: number[] }>();
    (data ?? []).forEach((r: any) => {
      if (r.value_avg == null) return;
      const key = r.ts_hour;
      const v = Number(r.value_avg);
      if (!byHour.has(key)) byHour.set(key, { co2: [], voc: [], pm25: [] });
      const slot = byHour.get(key)!;
      if (CO2_METRICS.includes(r.metric)) slot.co2.push(v);
      else if (VOC_METRICS.includes(r.metric)) slot.voc.push(v);
      else if (PM25_METRICS.includes(r.metric)) slot.pm25.push(v);
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    let co2Sum = 0, co2N = 0, vocSum = 0, vocN = 0, pmSum = 0, pmN = 0;
    let co2Hours = 0, vocHours = 0, pmHours = 0;
    let allOkHours = 0;

    byHour.forEach(slot => {
      const co2 = avg(slot.co2);
      const voc = avg(slot.voc);
      const pm  = avg(slot.pm25);
      if (co2 != null) { co2Sum += co2; co2N++; if (co2 < WELL_CO2) co2Hours++; }
      if (voc != null) { vocSum += voc; vocN++; if (voc < VOC_LIMIT) vocHours++; }
      if (pm  != null) { pmSum  += pm;  pmN++;  if (pm  < PM25_LIMIT) pmHours++; }
      const cOk = co2 == null || co2 < WELL_CO2;
      const vOk = voc == null || voc < VOC_LIMIT;
      const pOk = pm  == null || pm  < PM25_LIMIT;
      const anyPresent = (co2 != null) || (voc != null) || (pm != null);
      if (anyPresent && cOk && vOk && pOk) allOkHours++;
    });

    const perMetric: AirMetricStat[] = [];
    if (co2N > 0) perMetric.push({ metric: 'co2', avg: Math.round(co2Sum / co2N), hoursExcellent: co2Hours, limit: WELL_CO2, unit: 'ppm' });
    if (vocN > 0) perMetric.push({ metric: 'voc', avg: Math.round(vocSum / vocN), hoursExcellent: vocHours, limit: VOC_LIMIT, unit: 'µg' });
    if (pmN  > 0) perMetric.push({ metric: 'pm25', avg: Math.round((pmSum / pmN) * 10) / 10, hoursExcellent: pmHours, limit: PM25_LIMIT, unit: 'µg' });

    return { perMetric, hoursAllExcellent: byHour.size > 0 ? allOkHours : null };
  } catch {
    return empty;
  }
}

async function fetchAirDailyAvg(siteId: string, start: string, end: string): Promise<{
  avg: number | null; daysExcellent: number; bestDay: { day: string; co2: number } | null; min: number | null; peak: number | null;
}> {
  const empty = { avg: null as number | null, daysExcellent: 0, bestDay: null as any, min: null as number | null, peak: null as number | null };
  if (!supabase) return empty;
  const { data: devs } = await supabase
    .from('devices').select('id').eq('site_id', siteId).eq('device_type', 'air_quality');
  const ids = (devs ?? []).map((d: any) => d.id);
  if (ids.length === 0) return empty;

  const { data } = await supabase
    .from('telemetry_daily')
    .select('ts_day, value_avg, metric')
    .in('device_id', ids)
    .gte('ts_day', start)
    .lte('ts_day', end)
    .in('metric', CO2_METRICS);
  const groups = new Map<string, number[]>();
  (data ?? []).forEach((r: any) => {
    if (r.value_avg == null) return;
    if (!groups.has(r.ts_day)) groups.set(r.ts_day, []);
    groups.get(r.ts_day)!.push(Number(r.value_avg));
  });
  const daily: { day: string; co2: number }[] = [];
  groups.forEach((arr, day) => daily.push({ day, co2: arr.reduce((a, b) => a + b, 0) / arr.length }));
  if (daily.length === 0) return empty;
  const avg = daily.reduce((a, d) => a + d.co2, 0) / daily.length;
  const bestDay = daily.reduce((m, d) => d.co2 < m.co2 ? d : m);
  const min = Math.min(...daily.map(d => d.co2));
  const peak = Math.max(...daily.map(d => d.co2));
  const daysExcellent = daily.filter(d => d.co2 < WELL_CO2).length;
  return {
    avg: Math.round(avg), daysExcellent,
    bestDay: { day: bestDay.day, co2: Math.round(bestDay.co2) },
    min: Math.round(min), peak: Math.round(peak),
  };
}

async function fetchAlerts(siteId: string, weekStart: string, weekEnd: string) {
  if (!supabase) return { active: 0, resolved: 0 };
  const [{ count: active }, { count: resolved }] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'active'),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'resolved')
      .gte('ts_resolved', weekStart).lte('ts_resolved', weekEnd + 'T23:59:59Z'),
  ] as any);
  return { active: active ?? 0, resolved: resolved ?? 0 };
}

/* ────────────────────────────────────────────────────── buckets ───── */

function weeklyBuckets(daily: DailyKwh[]): WeekBucket[] {
  if (daily.length === 0) return [];
  const buckets: WeekBucket[] = [];
  let idx = 1;
  let acc: DailyKwh[] = [];
  const flush = () => {
    if (acc.length === 0) return;
    const vals = acc.map(d => d.kwh).filter((v): v is number => v != null);
    const kwh = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    buckets.push({
      index: idx++,
      startStr: acc[0].day,
      endStr: acc[acc.length - 1].day,
      kwh,
      co2Kg: kwh != null ? co2KgFromKwh(kwh) : null,
    });
    acc = [];
  };
  for (const d of daily) {
    acc.push(d);
    // close bucket every 7 days
    if (acc.length === 7) flush();
  }
  flush();
  return buckets;
}

/* ────────────────────────────────────────────────────── main ──────── */

async function fetchSiteMonthly(siteId: string, areaM2: number | null | undefined): Promise<SiteMonthlyData> {
  const cur = wrappedMonthRange();
  const prev = previousMonthRange(cur);
  const yoy = previousYearMonthRange(cur);

  const [
    { daily: energyDaily, byCategory, totalKwh },
    prevMonthKwh,
    yoyKwh,
    hourlyProfile,
    airHourly,
    airDaily,
    alerts,
    airDevicesCount,
  ] = await Promise.all([
    fetchEnergyDailyByCategory(siteId, cur.startStr, cur.endStr),
    fetchEnergyTotal(siteId, prev.startStr, prev.endStr),
    fetchEnergyTotal(siteId, yoy.startStr, yoy.endStr),
    fetchEnergyHourlyProfile(siteId, cur.startStr, cur.endStr),
    fetchAirHourly(siteId, cur.startStr, cur.endStr),
    fetchAirDailyAvg(siteId, cur.startStr, cur.endStr),
    fetchAlerts(siteId, cur.startStr, cur.endStr),
    (async () => {
      if (!supabase) return 0;
      const { count } = await supabase
        .from('devices').select('id', { count: 'exact', head: true })
        .eq('site_id', siteId).eq('device_type', 'air_quality');
      return count ?? 0;
    })(),
  ]);

  const monthKwh = totalKwh;
  const delta = pctDelta(monthKwh, prevMonthKwh);
  const yoyDelta = pctDelta(monthKwh, yoyKwh);
  const weeks = weeklyBuckets(energyDaily);

  // Reuse "best vs others" as golden day on the month
  const presentDays = energyDaily.filter(d => d.kwh != null && (d.kwh as number) > 0);
  const goldenDay = presentDays.length
    ? presentDays.reduce((m, d) => (d.kwh! < m.kwh! ? d : m))
    : null;

  const archetype = archetypeFromHourlyProfile(hourlyProfile);

  // YoY-preferred CO₂ savings.
  let savedKgRef: number | null = null;
  if (yoyKwh != null && monthKwh != null && yoyKwh > monthKwh) savedKgRef = co2KgFromKwh(yoyKwh - monthKwh);
  else if (prevMonthKwh != null && monthKwh != null && prevMonthKwh > monthKwh) savedKgRef = co2KgFromKwh(prevMonthKwh - monthKwh);

  return {
    siteId,
    weekLabel: cur.label,          // keep field name for legacy slides
    prevWeekLabel: prev.label,
    monthLabel: cur.label,
    prevMonthLabel: prev.label,
    prevYearMonthLabel: yoy.label,
    hasAirDevices: (airDevicesCount ?? 0) > 0,
    energy: {
      weekKwh: monthKwh,
      prevWeekKwh: prevMonthKwh,
      deltaPct: delta,
      daily: energyDaily,
      prevDaily: [],
      goldenDay: goldenDay ? { day: goldenDay.day, kwh: goldenDay.kwh! } : null,
      eui: eui(monthKwh, areaM2),
      onTarget: delta != null ? delta <= 0 : null,
      monthKwh,
      prevMonthKwh,
      yoyKwh,
      yoyDeltaPct: yoyDelta,
      weeks,
      byCategory,
      hourlyProfile,
      archetype,
    },
    co2: {
      weekKg: monthKwh != null ? co2KgFromKwh(monthKwh) : null,
      savedKg: savedKgRef ?? 0,
      treesEquiv: savedKgRef && savedKgRef > 0 ? treesEquivFromCo2Kg(savedKgRef) : 0,
    },
    water: { weekLiters: null, prevWeekLiters: null, deltaPct: null, leakCount: 0 },
    air: {
      avgCo2Ppm: airDaily.avg,
      bestDay: airDaily.bestDay,
      daysExcellent: airDaily.daysExcellent,
      minPpm: airDaily.min,
      peakPpm: airDaily.peak,
      hoursExcellent: airHourly.hoursAllExcellent,
      perMetric: airHourly.perMetric,
    },
    alerts: { resolvedThisWeek: alerts.resolved, activeNow: alerts.active },
    hasAnyData: monthKwh != null || prevMonthKwh != null || airDaily.avg != null,
  };
}

export function useSiteMonthlyWrap(
  siteId: string | null | undefined,
  areaM2?: number | null,
) {
  return useQuery({
    queryKey: ['wrapped:site-monthly', siteId, areaM2 ?? null],
    queryFn: () => fetchSiteMonthly(siteId!, areaM2 ?? null),
    enabled: isSupabaseConfigured && !!siteId,
    staleTime: 5 * 60_000,
  });
}