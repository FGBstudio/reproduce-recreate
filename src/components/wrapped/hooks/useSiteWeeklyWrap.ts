/**
 * useSiteWeeklyWrap — fetches all real telemetry needed to build a single-site
 * weekly Wrapped story (current ISO week vs previous one).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  currentISOWeek, previousISOWeek, pctDelta, co2KgFromKwh, treesEquivFromCo2Kg, eui,
} from '../lib/wrappedMath';

export interface DailyKwh { day: string; kwh: number | null; }

export interface SiteWeeklyData {
  siteId: string;
  weekLabel: string;
  prevWeekLabel: string;

  energy: {
    weekKwh: number | null;
    prevWeekKwh: number | null;
    deltaPct: number | null;
    daily: DailyKwh[];           // current week, 7 entries
    prevDaily: DailyKwh[];       // previous week
    goldenDay: { day: string; kwh: number } | null;
    eui: number | null;
    onTarget: boolean | null;    // delta <= 0
  };
  co2: {
    weekKg: number | null;
    savedKg: number | null;      // positive when prev > current
    treesEquiv: number | null;
  };
  water: {
    weekLiters: number | null;
    prevWeekLiters: number | null;
    deltaPct: number | null;
    leakCount: number;
  };
  air: {
    avgCo2Ppm: number | null;
    bestDay: { day: string; co2: number } | null;
    daysExcellent: number;       // days with avg CO₂ < 800
  };
  alerts: {
    resolvedThisWeek: number;
    activeNow: number;
  };
  hasAnyData: boolean;
}

const ENERGY_METRICS = ['energy.active_import_kwh', 'energy.active_energy'];
const CO2_METRICS = ['iaq.co2', 'CO2', 'co2'];

async function fetchEnergyDailyForSite(siteId: string, start: string, end: string): Promise<DailyKwh[]> {
  if (!supabase) return [];
  const { data: devs } = await supabase
    .from('devices')
    .select('id')
    .eq('site_id', siteId)
    .eq('category', 'general');
  const deviceIds = (devs ?? []).map((d: any) => d.id);
  if (deviceIds.length === 0) return [];

  const { data } = await supabase
    .from('energy_daily')
    .select('device_id, ts_day, value_sum, metric')
    .in('device_id', deviceIds)
    .gte('ts_day', start)
    .lte('ts_day', end)
    .in('metric', ENERGY_METRICS);

  const byDay = new Map<string, number>();
  (data ?? []).forEach((r: any) => {
    if (r.value_sum == null) return;
    byDay.set(r.ts_day, (byDay.get(r.ts_day) ?? 0) + Number(r.value_sum));
  });

  // fill in 7 day slots
  const out: DailyKwh[] = [];
  const startD = new Date(start + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    const d = new Date(startD.getTime() + i * 86400000).toISOString().slice(0, 10);
    out.push({ day: d, kwh: byDay.has(d) ? byDay.get(d)! : null });
  }
  return out;
}

async function fetchAirCo2(siteId: string, start: string, end: string): Promise<DailyKwh[]> {
  if (!supabase) return [];
  const { data: devs } = await supabase
    .from('devices')
    .select('id')
    .eq('site_id', siteId)
    .eq('device_type', 'air_quality');
  const deviceIds = (devs ?? []).map((d: any) => d.id);
  if (deviceIds.length === 0) return [];

  const { data } = await supabase
    .from('telemetry_daily')
    .select('ts_day, value_avg, metric')
    .in('device_id', deviceIds)
    .gte('ts_day', start)
    .lte('ts_day', end)
    .in('metric', CO2_METRICS);

  const groups = new Map<string, number[]>();
  (data ?? []).forEach((r: any) => {
    if (r.value_avg == null) return;
    if (!groups.has(r.ts_day)) groups.set(r.ts_day, []);
    groups.get(r.ts_day)!.push(Number(r.value_avg));
  });

  const out: DailyKwh[] = [];
  const startD = new Date(start + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    const d = new Date(startD.getTime() + i * 86400000).toISOString().slice(0, 10);
    const arr = groups.get(d);
    out.push({
      day: d,
      kwh: arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null,
    });
  }
  return out;
}

async function fetchAlertsForSite(siteId: string, weekStart: string, weekEnd: string) {
  if (!supabase) return { active: 0, resolved: 0 };
  const [{ data: active }, { data: resolved }] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'active'),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'resolved')
      .gte('ts_resolved', weekStart).lte('ts_resolved', weekEnd + 'T23:59:59Z'),
  ] as any);
  return {
    active: (active as any)?.length ?? (active as any)?.count ?? 0,
    resolved: (resolved as any)?.length ?? (resolved as any)?.count ?? 0,
  };
}

async function fetchSiteWeekly(siteId: string, areaM2: number | null | undefined): Promise<SiteWeeklyData> {
  const cur = currentISOWeek();
  const prev = previousISOWeek();

  const [energyCur, energyPrev, airCur, alerts] = await Promise.all([
    fetchEnergyDailyForSite(siteId, cur.startStr, cur.endStr),
    fetchEnergyDailyForSite(siteId, prev.startStr, prev.endStr),
    fetchAirCo2(siteId, cur.startStr, cur.endStr),
    fetchAlertsForSite(siteId, cur.startStr, cur.endStr),
  ]);

  const weekKwh = sumNullable(energyCur.map(d => d.kwh));
  const prevWeekKwh = sumNullable(energyPrev.map(d => d.kwh));
  const delta = pctDelta(weekKwh, prevWeekKwh);
  const golden = pickMin(energyCur);

  const savedKg = (prevWeekKwh != null && weekKwh != null && prevWeekKwh > weekKwh)
    ? co2KgFromKwh(prevWeekKwh - weekKwh)
    : 0;

  const airAvgs = airCur.map(d => d.kwh).filter((v): v is number => v != null);
  const airAvg = airAvgs.length ? airAvgs.reduce((a, b) => a + b, 0) / airAvgs.length : null;
  const bestAir = pickMin(airCur, true);
  const daysExcellent = airCur.filter(d => d.kwh != null && d.kwh < 800).length;

  return {
    siteId,
    weekLabel: cur.label,
    prevWeekLabel: prev.label,
    energy: {
      weekKwh,
      prevWeekKwh,
      deltaPct: delta,
      daily: energyCur,
      prevDaily: energyPrev,
      goldenDay: golden ? { day: golden.day, kwh: golden.kwh! } : null,
      eui: eui(weekKwh, areaM2),
      onTarget: delta != null ? delta <= 0 : null,
    },
    co2: {
      weekKg: weekKwh != null ? co2KgFromKwh(weekKwh) : null,
      savedKg,
      treesEquiv: savedKg > 0 ? treesEquivFromCo2Kg(savedKg) : 0,
    },
    water: { weekLiters: null, prevWeekLiters: null, deltaPct: null, leakCount: 0 },
    air: {
      avgCo2Ppm: airAvg != null ? Math.round(airAvg) : null,
      bestDay: bestAir ? { day: bestAir.day, co2: Math.round(bestAir.kwh!) } : null,
      daysExcellent,
    },
    alerts: { resolvedThisWeek: alerts.resolved, activeNow: alerts.active },
    hasAnyData: weekKwh != null || prevWeekKwh != null || airAvg != null,
  };
}

function sumNullable(arr: (number | null)[]): number | null {
  const filt = arr.filter((v): v is number => v != null);
  if (!filt.length) return null;
  return filt.reduce((a, b) => a + b, 0);
}
function pickMin(arr: DailyKwh[], includeZero = false) {
  const filt = arr.filter(d => d.kwh != null && (includeZero || d.kwh! > 0));
  if (!filt.length) return null;
  return filt.reduce((m, d) => (d.kwh! < m.kwh! ? d : m));
}

export function useSiteWeeklyWrap(
  siteId: string | null | undefined,
  areaM2?: number | null,
) {
  return useQuery({
    queryKey: ['wrapped:site-weekly', siteId, areaM2 ?? null],
    queryFn: () => fetchSiteWeekly(siteId!, areaM2 ?? null),
    enabled: isSupabaseConfigured && !!siteId,
    staleTime: 5 * 60_000,
  });
}