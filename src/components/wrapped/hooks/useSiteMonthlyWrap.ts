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
  currentISOWeek,
  previousISOWeek,
  pctDelta,
  co2KgFromKwh,
  treesEquivFromCo2Kg,
  eui,
  archetypeFromHourlyProfile,
  weeklySiteScore,
  ArchetypeInfo,
} from '../lib/wrappedMath';
import type { SiteWeeklyData, DailyKwh } from './useSiteWeeklyWrap';

// ── Tipi riga delle query Supabase usate in questo hook ──────────────────────
type DeviceRow = { id: string; category?: string | null; site_id?: string };
type EnergyRow = { device_id: string; ts_day: string; value_sum: number | null; metric?: string };
type MetricRow = { device_id?: string; ts_day?: string; ts?: string; value_sum?: number | null; value_avg?: number | null; value?: number | null; metric?: string };
type PeerSiteRow = { id: string; name?: string | null; area_m2?: number | null };

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
  /** Same value as weekLabel — kept for slides that still read monthLabel. */
  monthLabel: string;
  prevMonthLabel: string;
  prevYearMonthLabel: string;
  hasAirDevices: boolean;
  peer: PeerBenchmark | null;
  /** Dashboard-style score (0..100) computed on weekly averages. null if no data. */
  siteScore: number | null;

  energy: SiteWeeklyData['energy'] & {
    /** alias of weekKwh – kept so existing slides keep typing */
    monthKwh: number | null;
    prevMonthKwh: number | null;
    yoyKwh: number | null;
    yoyDeltaPct: number | null;
    /** Weekly average draw, in kW (general meters / hours in window). */
    avgPowerKw: number | null;
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

  const ids = all.map((d: DeviceRow) => d.id);
  const catById = new Map<string, string>(all.map((d: DeviceRow) => [d.id, (d.category ?? '').toLowerCase()]));

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
  (data ?? []).forEach((r: MetricRow) => {
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
  const ids = (devs ?? []).map((d: DeviceRow) => d.id);
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
  const ids = (devs ?? []).map((d: DeviceRow) => d.id);
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
    (data ?? []).forEach((r: MetricRow) => {
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
  const ids = (devs ?? []).map((d: DeviceRow) => d.id);
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
    (data ?? []).forEach((r: MetricRow) => {
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
  const ids = (devs ?? []).map((d: DeviceRow) => d.id);
  if (ids.length === 0) return empty;

  const { data } = await supabase
    .from('telemetry_daily')
    .select('ts_day, value_avg, metric')
    .in('device_id', ids)
    .gte('ts_day', start)
    .lte('ts_day', end)
    .in('metric', CO2_METRICS);
  const groups = new Map<string, number[]>();
  (data ?? []).forEach((r: MetricRow) => {
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
  const empty = {
    active: 0,
    resolved: 0,
    items: [] as AlertItem[],
    countsBySeverity: { critical: 0, warning: 0, info: 0 },
    totalDurationMin: 0,
  };
  if (!supabase) return empty;
  const startIso = weekStart + 'T00:00:00Z';
  const endIso = weekEnd + 'T23:59:59Z';
  // Source of truth = site_alerts (same table the dashboard widget reads).
  // We take alerts *triggered* within the wrap week so the number matches the
  // story of the week. Resolved-in-week is reported separately, smaller.
  const { data, error } = await supabase
    .from('site_alerts')
    .select('id, message, metric, severity, status, triggered_at, resolved_at')
    .eq('site_id', siteId)
    .gte('triggered_at', startIso)
    .lte('triggered_at', endIso)
    .order('severity', { ascending: false })
    .order('triggered_at', { ascending: false })
    .limit(500);
  if (error || !data) return empty;

  const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const items: AlertItem[] = (data ?? [])
    .map((r: MetricRow) => {
      const created = r.triggered_at ? new Date(r.triggered_at).getTime() : null;
      const resolved = r.resolved_at ? new Date(r.resolved_at).getTime() : null;
      const durationMin = created != null && resolved != null
        ? Math.max(1, Math.round((resolved - created) / 60000))
        : null;
      return {
        id: r.id,
        title: r.message ?? r.metric ?? 'Alert',
        severity: (r.severity as 'critical' | 'warning' | 'info') ?? 'info',
        durationMin,
        status: (r.status as 'active' | 'acknowledged' | 'resolved') ?? 'active',
      } as AlertItem;
    })
    .sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity])
      || ((b.durationMin ?? 0) - (a.durationMin ?? 0)));

  const countsBySeverity = { critical: 0, warning: 0, info: 0 };
  let totalDurationMin = 0;
  let active = 0, resolved = 0;
  for (const it of items) {
    countsBySeverity[it.severity] += 1;
    if (it.durationMin != null) totalDurationMin += it.durationMin;
    if (it.status === 'active' || it.status === 'acknowledged') active += 1;
    else resolved += 1;
  }
  return { active, resolved, items: items.slice(0, 6), countsBySeverity, totalDurationMin };
}

async function fetchPeerBenchmark(
  siteId: string,
  monthStart: string,
  monthEnd: string,
  monthLabel: string,
): Promise<PeerBenchmark | null> {
  if (!supabase) return null;
  // 1) Current site brand
  const { data: meSite } = await supabase
    .from('sites').select('brand_id, area_m2').eq('id', siteId).maybeSingle();
  if (!meSite?.brand_id) return null;

  // 2) Brand name + peers
  const [{ data: brandRow }, { data: peers }] = await Promise.all([
    supabase.from('brands').select('name').eq('id', meSite.brand_id).maybeSingle(),
    supabase.from('sites').select('id, name, area_m2').eq('brand_id', meSite.brand_id),
  ]);
  const peerSites = peers ?? [];
  if (peerSites.length < 2) return null;

  // 3) Devices (general) per peer site → device_id → site_id
  const peerIds = peerSites.map((p: PeerSiteRow) => p.id);
  const { data: devs } = await supabase
    .from('devices')
    .select('id, site_id')
    .in('site_id', peerIds)
    .eq('category', 'general');
  const siteByDevice = new Map<string, string>((devs ?? []).map((d: DeviceRow) => [d.id, d.site_id ?? ""]));
  const deviceIds = Array.from(siteByDevice.keys());
  if (deviceIds.length === 0) return null;

  // 4) Monthly kWh per site
  const { data: rows } = await supabase
    .from('energy_daily')
    .select('device_id, value_sum')
    .in('device_id', deviceIds)
    .gte('ts_day', monthStart)
    .lte('ts_day', monthEnd)
    .in('metric', ENERGY_METRICS);
  const kwhBySite = new Map<string, number>();
  (rows ?? []).forEach((r: MetricRow) => {
    if (r.value_sum == null) return;
    const sid = siteByDevice.get(r.device_id);
    if (!sid) return;
    kwhBySite.set(sid, (kwhBySite.get(sid) ?? 0) + Number(r.value_sum));
  });

  // 5) Build scoring rows (lower kWh/m² is better → higher score)
  const useEui = peerSites.every((p: PeerSiteRow) => !!p.area_m2 && p.area_m2 > 0);
  const scored = peerSites
    .map((p: PeerSiteRow) => {
      const kwh = kwhBySite.get(p.id) ?? null;
      if (kwh == null || kwh <= 0) return null;
      const metric = useEui ? kwh / Number(p.area_m2) : kwh;
      return { siteId: p.id, name: p.name as string, metric };
    })
    .filter((x): x is { siteId: string; name: string; metric: number } => x !== null);
  if (scored.length < 2 || !scored.find(s => s.siteId === siteId)) return null;

  scored.sort((a, b) => a.metric - b.metric); // ascending: best first
  const best = scored[0].metric;
  const ranked: PeerRow[] = scored.map((s, i) => ({
    siteId: s.siteId,
    name: s.name,
    score: Math.max(50, Math.round((best / s.metric) * 100)),
    isMe: s.siteId === siteId,
  }));
  const myIdx = ranked.findIndex(r => r.isMe);
  const top5 = ranked.slice(0, 5);
  if (myIdx >= 5) top5[4] = ranked[myIdx];

  return {
    brandName: (brandRow?.name as string) ?? 'Brand',
    total: ranked.length,
    rank: myIdx + 1,
    myScore: ranked[myIdx].score,
    top5,
    basis: useEui ? 'eui' : 'kwh',
    monthLabel,
  };
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
  // The Wrap is *weekly* — current ISO week vs previous one, plus a "same week
  // last year" reference (52 ISO weeks ago).
  const cur = currentISOWeek();
  const prev = previousISOWeek();
  const yoyStart = new Date(cur.start.getTime() - 52 * 7 * 86400000);
  const yoyEndExcl = new Date(cur.end.getTime() - 52 * 7 * 86400000);
  const yoyLastDay = new Date(yoyEndExcl.getTime() - 86400000);
  const yoy = {
    startStr: yoyStart.toISOString().slice(0, 10),
    endStr: yoyLastDay.toISOString().slice(0, 10),
    label: `${yoyStart.toISOString().slice(0, 10)} → ${yoyLastDay.toISOString().slice(0, 10)}`,
  };

  const [
    { daily: energyDaily, byCategory, totalKwh },
    prevMonthKwh,
    yoyKwh,
    hourlyProfile,
    airHourly,
    airDaily,
    alerts,
    airDevicesCount,
    peer,
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
    fetchPeerBenchmark(siteId, cur.startStr, cur.endStr, cur.label),
  ]);

  const monthKwh = totalKwh;
  const delta = pctDelta(monthKwh, prevMonthKwh);
  const yoyDelta = pctDelta(monthKwh, yoyKwh);
  const weeks = weeklyBuckets(energyDaily);

  // Avg power kW over the *elapsed* hours in the week (skip days with no data).
  const presentDays = energyDaily.filter(d => d.kwh != null);
  const hoursElapsed = Math.max(1, presentDays.length * 24);
  const avgPowerKw = monthKwh != null ? monthKwh / hoursElapsed : null;

  // Score with the *same* logic the dashboard uses (weekly averages).
  const siteScore = weeklySiteScore({
    avgPowerKw,
    avgCo2Ppm: airDaily.avg,
  });

  // Reuse "best vs others" as golden day on the month
  const nonZeroDays = energyDaily.filter(d => d.kwh != null && (d.kwh as number) > 0);
  const goldenDay = nonZeroDays.length
    ? nonZeroDays.reduce((m, d) => (d.kwh! < m.kwh! ? d : m))
    : null;

  const archetype = archetypeFromHourlyProfile(hourlyProfile);

  // Saved CO₂ vs previous week (preferred), fallback YoY. If consumption *worsened*,
  // we leave savedKgRef = null so the Treedom slide shows total emitted CO₂ instead.
  let savedKgRef: number | null = null;
  if (prevMonthKwh != null && monthKwh != null && prevMonthKwh > monthKwh) savedKgRef = co2KgFromKwh(prevMonthKwh - monthKwh);
  else if (yoyKwh != null && monthKwh != null && yoyKwh > monthKwh) savedKgRef = co2KgFromKwh(yoyKwh - monthKwh);

  return {
    siteId,
    weekLabel: cur.label,
    prevWeekLabel: prev.label,
    monthLabel: cur.label,
    prevMonthLabel: prev.label,
    prevYearMonthLabel: yoy.label,
    siteScore,
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
      avgPowerKw,
      weeks,
      byCategory,
      hourlyProfile,
      archetype,
    },
    co2: {
      weekKg: monthKwh != null ? co2KgFromKwh(monthKwh) : null,
      // null (not 0) when consumption did *not* improve — slides use this to switch
      // between "saved" and "emitted" narratives.
      savedKg: savedKgRef,
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
    alerts: {
      resolvedThisWeek: alerts.resolved,
      activeNow: alerts.active,
      items: alerts.items,
      countsBySeverity: alerts.countsBySeverity,
      totalDurationMin: alerts.totalDurationMin,
    },
    peer,
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