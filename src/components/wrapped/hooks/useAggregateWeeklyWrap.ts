/**
 * useAggregateWeeklyWrap — aggregate weekly storytelling across many sites.
 * Used by:
 *   • Multi-site (holding / brand) Wrapped — leaderboard, most improved.
 *   • Admin global Wrapped — totals by region.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ── Tipi riga delle query Supabase usate in questo hook ──────────────────────
type DeviceRow = { id: string; category?: string | null; site_id?: string };
type EnergyRow = { device_id: string; ts_day: string; value_sum: number | null; metric?: string };
type MetricRow = { device_id?: string; ts_day?: string; ts?: string; value_sum?: number | null; value_avg?: number | null; value?: number | null; metric?: string };
type PeerSiteRow = { id: string; name?: string | null; area_m2?: number | null };
import {
  currentISOWeek, previousISOWeek, pctDelta, co2KgFromKwh, treesEquivFromCo2Kg, eui,
} from '../lib/wrappedMath';

const ENERGY_METRICS = ['energy.active_import_kwh', 'energy.active_energy'];

export interface AggregateSiteRow {
  siteId: string;
  name: string;
  region: string | null;
  brandName: string | null;
  areaM2: number | null;
  weekKwh: number | null;
  prevWeekKwh: number | null;
  deltaPct: number | null;
  eui: number | null;
}

export interface AggregateWeeklyData {
  sites: AggregateSiteRow[];
  totals: {
    weekKwh: number;
    prevWeekKwh: number;
    savedKg: number;
    treesEquiv: number;
    sitesWithData: number;
    deltaPct: number | null;
  };
  byRegion: Record<string, { weekKwh: number; prevWeekKwh: number; sites: number; deltaPct: number | null; savedKg: number }>;
  leaderboard: AggregateSiteRow[];   // by EUI ASC (lowest = best)
  mostImproved: AggregateSiteRow[];  // by deltaPct ASC (most negative first)
  weekLabel: string;
  prevWeekLabel: string;
}

interface SiteInput {
  id: string;
  name: string;
  region?: string | null;
  brandName?: string | null;
  areaM2?: number | null;
}

async function fetchAggregate(siteInputs: SiteInput[]): Promise<AggregateWeeklyData> {
  const cur = currentISOWeek();
  const prev = previousISOWeek();
  const empty: AggregateWeeklyData = {
    sites: [], totals: { weekKwh: 0, prevWeekKwh: 0, savedKg: 0, treesEquiv: 0, sitesWithData: 0, deltaPct: null },
    byRegion: {}, leaderboard: [], mostImproved: [],
    weekLabel: cur.label, prevWeekLabel: prev.label,
  };
  if (!supabase || siteInputs.length === 0) return empty;

  const siteIds = siteInputs.map(s => s.id);

  // 1) general devices for all sites
  let devices: { id: string; site_id: string }[] = [];
  for (let i = 0; i < siteIds.length; i += 50) {
    const batch = siteIds.slice(i, i + 50);
    const { data } = await supabase.from('devices')
      .select('id, site_id')
      .in('site_id', batch)
      .eq('category', 'general');
    if (data) devices = devices.concat(data as any[]);
  }
  const deviceToSite = new Map<string, string>();
  devices.forEach(d => deviceToSite.set(d.id, d.site_id));
  const deviceIds = devices.map(d => d.id);
  if (deviceIds.length === 0) {
    // still return inputs to render leaderboard empty
    return empty;
  }

  // 2) energy_daily current + previous week
  async function loadWindow(start: string, end: string) {
    let rows: any[] = [];
    for (let i = 0; i < deviceIds.length; i += 50) {
      const batch = deviceIds.slice(i, i + 50);
      const { data } = await supabase.from('energy_daily')
        .select('device_id, value_sum, metric')
        .in('device_id', batch)
        .gte('ts_day', start).lte('ts_day', end)
        .in('metric', ENERGY_METRICS);
      if (data) rows = rows.concat(data);
    }
    const bySite = new Map<string, number>();
    rows.forEach(r => {
      if (r.value_sum == null) return;
      const s = deviceToSite.get(r.device_id);
      if (!s) return;
      bySite.set(s, (bySite.get(s) ?? 0) + Number(r.value_sum));
    });
    return bySite;
  }

  const [curMap, prevMap] = await Promise.all([
    loadWindow(cur.startStr, cur.endStr),
    loadWindow(prev.startStr, prev.endStr),
  ]);

  const sites: AggregateSiteRow[] = siteInputs.map(s => {
    const w = curMap.get(s.id) ?? null;
    const p = prevMap.get(s.id) ?? null;
    return {
      siteId: s.id,
      name: s.name,
      region: s.region ?? null,
      brandName: s.brandName ?? null,
      areaM2: s.areaM2 ?? null,
      weekKwh: w,
      prevWeekKwh: p,
      deltaPct: pctDelta(w, p),
      eui: eui(w, s.areaM2 ?? null),
    };
  });

  const sitesWithData = sites.filter(s => s.weekKwh != null);
  const totalWeek = sitesWithData.reduce((a, s) => a + (s.weekKwh ?? 0), 0);
  const totalPrev = sites.reduce((a, s) => a + (s.prevWeekKwh ?? 0), 0);
  const totalSaved = sites.reduce((a, s) => {
    if (s.weekKwh != null && s.prevWeekKwh != null && s.prevWeekKwh > s.weekKwh) {
      return a + co2KgFromKwh(s.prevWeekKwh - s.weekKwh);
    }
    return a;
  }, 0);

  const byRegion: AggregateWeeklyData['byRegion'] = {};
  sites.forEach(s => {
    const key = s.region ?? 'OTHER';
    if (!byRegion[key]) byRegion[key] = { weekKwh: 0, prevWeekKwh: 0, sites: 0, deltaPct: null, savedKg: 0 };
    byRegion[key].sites++;
    if (s.weekKwh != null) byRegion[key].weekKwh += s.weekKwh;
    if (s.prevWeekKwh != null) byRegion[key].prevWeekKwh += s.prevWeekKwh;
    if (s.weekKwh != null && s.prevWeekKwh != null && s.prevWeekKwh > s.weekKwh) {
      byRegion[key].savedKg += co2KgFromKwh(s.prevWeekKwh - s.weekKwh);
    }
  });
  Object.values(byRegion).forEach(r => { r.deltaPct = pctDelta(r.weekKwh, r.prevWeekKwh) });

  const leaderboard = sites
    .filter(s => s.eui != null && s.weekKwh != null)
    .sort((a, b) => (a.eui! - b.eui!))
    .slice(0, 5);

  const mostImproved = sites
    .filter(s => s.deltaPct != null && s.weekKwh != null && s.prevWeekKwh != null && s.prevWeekKwh > 0)
    .sort((a, b) => (a.deltaPct! - b.deltaPct!))
    .slice(0, 5);

  return {
    sites,
    totals: {
      weekKwh: totalWeek,
      prevWeekKwh: totalPrev,
      savedKg: totalSaved,
      treesEquiv: treesEquivFromCo2Kg(totalSaved),
      sitesWithData: sitesWithData.length,
      deltaPct: pctDelta(totalWeek, totalPrev),
    },
    byRegion,
    leaderboard,
    mostImproved,
    weekLabel: cur.label,
    prevWeekLabel: prev.label,
  };
}

export function useAggregateWeeklyWrap(siteInputs: SiteInput[]) {
  const key = siteInputs.map(s => `${s.id}:${s.areaM2 ?? ''}`).sort().join('|');
  return useQuery({
    queryKey: ['wrapped:aggregate-weekly', key],
    queryFn: () => fetchAggregate(siteInputs),
    enabled: isSupabaseConfigured && siteInputs.length > 0,
    staleTime: 5 * 60_000,
  });
}