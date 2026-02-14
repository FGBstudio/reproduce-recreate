/**
 * Hook to compute real Avg. Energy Intensity (kWh/m²) per region
 * 
 * Logic:
 * 1. Fetch all sites with area_m2 > 0
 * 2. Fetch energy_daily for devices with category='general' over last 30 days
 * 3. Sum kWh per site, divide by area_m2 → site intensity
 * 4. Average intensities across sites in the same region
 */

import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface RegionIntensityData {
  /** region code → avg kWh/m² (monthly) */
  intensityByRegion: Record<string, number>;
  /** region code → number of sites considered */
  siteCountByRegion: Record<string, number>;
  isLoading: boolean;
}

async function fetchRegionIntensities(): Promise<{
  intensityByRegion: Record<string, number>;
  siteCountByRegion: Record<string, number>;
}> {
  if (!supabase) return { intensityByRegion: {}, siteCountByRegion: {} };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // 1) Get all sites with area
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id, region, area_m2')
    .not('area_m2', 'is', null)
    .gt('area_m2', 0);

  if (sitesError || !sites || sites.length === 0) {
    console.warn('[useRegionEnergyIntensity] No sites with area_m2:', sitesError);
    return { intensityByRegion: {}, siteCountByRegion: {} };
  }

  const siteIds = sites.map(s => s.id);

  // 2) Get devices with category='general' for those sites
  const { data: devices, error: devError } = await supabase
    .from('devices')
    .select('id, site_id')
    .in('site_id', siteIds)
    .eq('category', 'general');

  if (devError || !devices || devices.length === 0) {
    console.warn('[useRegionEnergyIntensity] No general devices:', devError);
    return { intensityByRegion: {}, siteCountByRegion: {} };
  }

  const deviceIds = devices.map(d => d.id);
  const deviceToSite: Record<string, string> = {};
  devices.forEach(d => { deviceToSite[d.id] = d.site_id!; });

  // 3) Fetch energy_daily for those devices, last 30 days
  // Query in batches if needed (Supabase 1000 row limit)
  let allRows: any[] = [];
  const batchSize = 50; // device IDs per batch
  for (let i = 0; i < deviceIds.length; i += batchSize) {
    const batch = deviceIds.slice(i, i + batchSize);
    const { data: rows, error } = await supabase
      .from('energy_daily')
      .select('device_id, value_sum')
      .in('device_id', batch)
      .gte('ts_day', thirtyDaysAgoStr);

    if (!error && rows) {
      allRows = allRows.concat(rows);
    }
  }

  // 4) Sum kWh per site
  const siteKwh: Record<string, number> = {};
  allRows.forEach((row: any) => {
    if (row.value_sum === null) return;
    const siteId = deviceToSite[row.device_id];
    if (!siteId) return;
    siteKwh[siteId] = (siteKwh[siteId] || 0) + Number(row.value_sum);
  });

  // 5) Compute intensity per site, then average per region
  const siteMap = new Map(sites.map(s => [s.id, s]));
  const regionIntensities: Record<string, number[]> = {};

  Object.entries(siteKwh).forEach(([siteId, kwh]) => {
    const site = siteMap.get(siteId);
    if (!site || !site.region || !site.area_m2 || site.area_m2 <= 0) return;
    if (kwh <= 0) return;

    const intensity = kwh / Number(site.area_m2);
    if (!regionIntensities[site.region]) regionIntensities[site.region] = [];
    regionIntensities[site.region].push(intensity);
  });

  const intensityByRegion: Record<string, number> = {};
  const siteCountByRegion: Record<string, number> = {};

  Object.entries(regionIntensities).forEach(([region, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    intensityByRegion[region] = Math.round(avg * 10) / 10;
    siteCountByRegion[region] = values.length;
  });

  console.log('[useRegionEnergyIntensity] Results:', { intensityByRegion, siteCountByRegion });

  return { intensityByRegion, siteCountByRegion };
}

export function useRegionEnergyIntensity(): RegionIntensityData {
  const { data, isLoading } = useQuery({
    queryKey: ['region-energy-intensity-v1'],
    queryFn: fetchRegionIntensities,
    enabled: isSupabaseConfigured,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });

  return {
    intensityByRegion: data?.intensityByRegion ?? {},
    siteCountByRegion: data?.siteCountByRegion ?? {},
    isLoading,
  };
}
