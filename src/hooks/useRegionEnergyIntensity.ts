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
  /** region code → avg CO2 ppm */
  avgCo2ByRegion: Record<string, number>;
  /** region code → number of sites with CO2 data */
  co2SiteCountByRegion: Record<string, number>;
  isLoading: boolean;
}

async function fetchRegionIntensities(): Promise<{
  intensityByRegion: Record<string, number>;
  siteCountByRegion: Record<string, number>;
  avgCo2ByRegion: Record<string, number>;
  co2SiteCountByRegion: Record<string, number>;
}> {
  if (!supabase) return { intensityByRegion: {}, siteCountByRegion: {}, avgCo2ByRegion: {}, co2SiteCountByRegion: {} };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // 1) Get ALL sites with region (for both energy + AQ)
  const { data: allSites, error: sitesError } = await supabase
    .from('sites')
    .select('id, region, area_m2')
    .not('region', 'is', null);

  if (sitesError || !allSites || allSites.length === 0) {
    console.warn('[useRegionEnergyIntensity] No sites:', sitesError);
    return { intensityByRegion: {}, siteCountByRegion: {}, avgCo2ByRegion: {}, co2SiteCountByRegion: {} };
  }

  // Build a siteId→site map for quick lookup
  const allSiteMap = new Map(allSites.map(s => [s.id, s]));

  // Sites with area for energy intensity
  const sitesWithArea = allSites.filter(s => s.area_m2 && Number(s.area_m2) > 0);
  const siteIdsWithArea = sitesWithArea.map(s => s.id);

  // 2) Get devices with category='general' for energy (batched to avoid URL length limits)
  let devices: { id: string; site_id: string | null }[] = [];
  const energyBatchSize = 50;
  for (let i = 0; i < siteIdsWithArea.length; i += energyBatchSize) {
    const batch = siteIdsWithArea.slice(i, i + energyBatchSize);
    const { data, error } = await supabase
      .from('devices')
      .select('id, site_id')
      .in('site_id', batch)
      .eq('category', 'general');
    if (!error && data) devices = devices.concat(data);
  }

  // 3) Get ALL air quality devices (no site filter to avoid URL length issues)
  const { data: aqDevices, error: aqDevErr } = await supabase
    .from('devices')
    .select('id, site_id')
    .eq('device_type', 'air_quality')
    .not('site_id', 'is', null);

  // --- ENERGY INTENSITY ---
  const intensityByRegion: Record<string, number> = {};
  const siteCountByRegion: Record<string, number> = {};

  if (devices && devices.length > 0) {
    const deviceIds = devices.map(d => d.id);
    const deviceToSite: Record<string, string> = {};
    devices.forEach(d => { deviceToSite[d.id] = d.site_id!; });

    let allRows: any[] = [];
    const batchSize = 50;
    for (let i = 0; i < deviceIds.length; i += batchSize) {
      const batch = deviceIds.slice(i, i + batchSize);
      const { data: rows, error } = await supabase
        .from('energy_daily')
        .select('device_id, value_sum')
        .in('device_id', batch)
        .gte('ts_day', thirtyDaysAgoStr);
      if (!error && rows) allRows = allRows.concat(rows);
    }

    const siteKwh: Record<string, number> = {};
    allRows.forEach((row: any) => {
      if (row.value_sum === null) return;
      const siteId = deviceToSite[row.device_id];
      if (!siteId) return;
      siteKwh[siteId] = (siteKwh[siteId] || 0) + Number(row.value_sum);
    });

    const siteMapEnergy = new Map(sitesWithArea.map(s => [s.id, s]));
    const regionIntensities: Record<string, number[]> = {};
    Object.entries(siteKwh).forEach(([siteId, kwh]) => {
      const site = siteMapEnergy.get(siteId);
      if (!site || !site.region || !site.area_m2 || site.area_m2 <= 0) return;
      if (kwh <= 0) return;
      const intensity = kwh / Number(site.area_m2);
      if (!regionIntensities[site.region]) regionIntensities[site.region] = [];
      regionIntensities[site.region].push(intensity);
    });

    Object.entries(regionIntensities).forEach(([region, values]) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      intensityByRegion[region] = Math.round(avg * 10) / 10;
      siteCountByRegion[region] = values.length;
    });
  }

  // --- AIR QUALITY (avg CO2 per region) ---
  const avgCo2ByRegion: Record<string, number> = {};
  const co2SiteCountByRegion: Record<string, number> = {};

  if (!aqDevErr && aqDevices && aqDevices.length > 0) {
    // Filter to only devices whose site has a region
    const aqDevicesInRegion = aqDevices.filter(d => d.site_id && allSiteMap.has(d.site_id));
    const aqDeviceIds = aqDevicesInRegion.map(d => d.id);
    const aqDeviceToSite: Record<string, string> = {};
    aqDevicesInRegion.forEach(d => { aqDeviceToSite[d.id] = d.site_id!; });

    // Fetch avg CO2 from telemetry_daily (last 30 days, metric = 'iaq.co2' or 'CO2')
    let co2Rows: any[] = [];
    const batchSize = 50;
    for (let i = 0; i < aqDeviceIds.length; i += batchSize) {
      const batch = aqDeviceIds.slice(i, i + batchSize);
      // Try both metric names
      const { data: rows, error } = await supabase
        .from('telemetry_daily')
        .select('device_id, metric, value_avg')
        .in('device_id', batch)
        .gte('ts_day', thirtyDaysAgoStr)
        .in('metric', ['iaq.co2', 'CO2', 'co2']);
      if (!error && rows) co2Rows = co2Rows.concat(rows);
    }

    // Average CO2 per site
    const siteCo2Values: Record<string, number[]> = {};
    co2Rows.forEach((row: any) => {
      if (row.value_avg === null) return;
      const siteId = aqDeviceToSite[row.device_id];
      if (!siteId) return;
      if (!siteCo2Values[siteId]) siteCo2Values[siteId] = [];
      siteCo2Values[siteId].push(Number(row.value_avg));
    });

    // Avg CO2 per site → then avg per region
    const regionCo2: Record<string, number[]> = {};
    Object.entries(siteCo2Values).forEach(([siteId, values]) => {
      const site = allSiteMap.get(siteId);
      if (!site || !site.region) return;
      const siteAvg = values.reduce((a, b) => a + b, 0) / values.length;
      if (!regionCo2[site.region]) regionCo2[site.region] = [];
      regionCo2[site.region].push(siteAvg);
    });

    Object.entries(regionCo2).forEach(([region, values]) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgCo2ByRegion[region] = Math.round(avg);
      co2SiteCountByRegion[region] = values.length;
    });
  }

  console.log('[useRegionEnergyIntensity] Results:', { intensityByRegion, siteCountByRegion, avgCo2ByRegion, co2SiteCountByRegion });

  return { intensityByRegion, siteCountByRegion, avgCo2ByRegion, co2SiteCountByRegion };
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
    avgCo2ByRegion: data?.avgCo2ByRegion ?? {},
    co2SiteCountByRegion: data?.co2SiteCountByRegion ?? {},
    isLoading,
  };
}
