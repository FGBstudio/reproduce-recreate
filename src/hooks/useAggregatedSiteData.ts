/**
 * Hook for fetching aggregated real telemetry data across multiple sites
 * Used by BrandOverlay and HoldingOverlay to display only real data
 * 
 * Uses the same proven logic as useRegionEnergyIntensity:
 * - Energy: query devices by category='general', sum energy.active_energy from energy_daily (7 days)
 * - HVAC/Lighting: query devices by category, sum energy.active_energy
 * - Air: avg CO2 from telemetry_daily for air_quality devices (30 days)
 * - Alerts: count from events table (status='active')
 * - Online: any telemetry in last 60 minutes
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAdminData } from '@/contexts/AdminDataContext';
import { Project } from '@/lib/data';

// =============================================================================
// Types
// =============================================================================

export interface SiteRealData {
  siteId: string;
  siteName: string;
  isOnline: boolean;
  hasEnergyData: boolean;
  hasAirData: boolean;
  hasWaterData: boolean;
  energy: {
    weeklyKwh: number | null;
    hvacKwh: number | null;
    lightingKwh: number | null;
    plugsKwh: number | null;
  };
  air: {
    co2: number | null;
    temperature: number | null;
    humidity: number | null;
    voc: number | null;
  };
  water: {
    consumption: number | null;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface AggregatedOverlayData {
  sites: SiteRealData[];
  sitesWithEnergy: SiteRealData[];
  sitesWithAir: SiteRealData[];
  sitesWithWater: SiteRealData[];
  totals: {
    weeklyEnergyKwh: number;
    avgCo2: number;
    sitesCount: number;
    sitesOnline: number;
    /** Sites with any data received (ever), regardless of how recent */
    sitesWithData: number;
    alertsCritical: number;
    alertsWarning: number;
  };
  isLoading: boolean;
  isError: boolean;
  hasRealData: boolean;
}

// =============================================================================
// Core data fetching — mirrors useRegionEnergyIntensity logic
// =============================================================================

interface FetchResult {
  /** site_id → total kWh (general category, 7 days) */
  weeklyEnergy: Record<string, number>;
  /** site_id → hvac kWh */
  hvacEnergy: Record<string, number>;
  /** site_id → lighting kWh */
  lightingEnergy: Record<string, number>;
  /** site_id → plugs kWh */
  plugsEnergy: Record<string, number>;
  /** site_id → { co2, temperature, humidity, voc } avg over 30 days */
  airAvg: Record<string, { co2: number | null; temperature: number | null; humidity: number | null; voc: number | null }>;
  /** site_id → true if any telemetry < 60 min */
  onlineStatus: Record<string, boolean>;
  /** site_id → alert counts */
  alerts: Record<string, { critical: number; warning: number; info: number }>;
  /** site_id → latest timestamp across all telemetry */
  latestTs: Record<string, string>;
}

async function fetchAggregatedDataForSites(siteIds: string[]): Promise<FetchResult> {
  if (!supabase || siteIds.length === 0) {
    return { weeklyEnergy: {}, hvacEnergy: {}, lightingEnergy: {}, plugsEnergy: {}, airAvg: {}, onlineStatus: {}, alerts: {}, latestTs: {} };
  }

  const result: FetchResult = {
    weeklyEnergy: {}, hvacEnergy: {}, lightingEnergy: {}, plugsEnergy: {},
    airAvg: {}, onlineStatus: {}, alerts: {}, latestTs: {},
  };

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const thirtyDaysAgoStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // ---------------------------------------------------------------------------
  // 1) Fetch devices for these sites (all categories)
  // ---------------------------------------------------------------------------
  let allDevices: { id: string; site_id: string; category: string | null; device_type: string }[] = [];
  const batchSize = 50;
  for (let i = 0; i < siteIds.length; i += batchSize) {
    const batch = siteIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('devices')
      .select('id, site_id, category, device_type')
      .in('site_id', batch);
    if (!error && data) allDevices = allDevices.concat(data as any[]);
  }

  // Group devices by category
  const generalDevices = allDevices.filter(d => d.category === 'general');
  const hvacDevices = allDevices.filter(d => d.category === 'hvac');
  const lightingDevices = allDevices.filter(d => d.category === 'lighting');
  const plugsDevices = allDevices.filter(d => d.category === 'plugs');
  const aqDevices = allDevices.filter(d => d.device_type === 'air_quality');

  // Helper: sum energy.active_energy from energy_daily for a set of devices
  async function sumEnergyForDevices(devices: typeof allDevices, days: string): Promise<Record<string, number>> {
    if (devices.length === 0) return {};
    const deviceIds = devices.map(d => d.id);
    const deviceToSite: Record<string, string> = {};
    devices.forEach(d => { deviceToSite[d.id] = d.site_id; });

    let rows: any[] = [];
    for (let i = 0; i < deviceIds.length; i += batchSize) {
      const batch = deviceIds.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('energy_daily')
        .select('device_id, value_sum')
        .in('device_id', batch)
        .gte('ts_day', days)
        .eq('metric', 'energy.active_energy');
      if (!error && data) rows = rows.concat(data);
    }

    const siteKwh: Record<string, number> = {};
    rows.forEach((row: any) => {
      if (row.value_sum === null) return;
      const siteId = deviceToSite[row.device_id];
      if (!siteId) return;
      siteKwh[siteId] = (siteKwh[siteId] || 0) + Number(row.value_sum);
    });
    return siteKwh;
  }

  // ---------------------------------------------------------------------------
  // 2) ENERGY: Sum kWh by category (7 days)
  // ---------------------------------------------------------------------------
  try {
    const [general, hvac, lighting, plugs] = await Promise.all([
      sumEnergyForDevices(generalDevices, sevenDaysAgoStr),
      sumEnergyForDevices(hvacDevices, sevenDaysAgoStr),
      sumEnergyForDevices(lightingDevices, sevenDaysAgoStr),
      sumEnergyForDevices(plugsDevices, sevenDaysAgoStr),
    ]);
    Object.assign(result.weeklyEnergy, general);
    Object.assign(result.hvacEnergy, hvac);
    Object.assign(result.lightingEnergy, lighting);
    Object.assign(result.plugsEnergy, plugs);
  } catch (e) {
    console.warn('[useAggregatedSiteData] energy query failed:', e);
  }

  // ---------------------------------------------------------------------------
  // 3) AIR QUALITY: avg CO2 from telemetry_daily (30 days)
  // ---------------------------------------------------------------------------
  if (aqDevices.length > 0) {
    try {
      const aqDeviceIds = aqDevices.map(d => d.id);
      const aqDeviceToSite: Record<string, string> = {};
      aqDevices.forEach(d => { aqDeviceToSite[d.id] = d.site_id; });

      let co2Rows: any[] = [];
      for (let i = 0; i < aqDeviceIds.length; i += batchSize) {
        const batch = aqDeviceIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('telemetry_daily')
          .select('device_id, metric, value_avg')
          .in('device_id', batch)
          .gte('ts_day', thirtyDaysAgoStr)
          .in('metric', ['iaq.co2', 'CO2', 'co2']);
        if (!error && data) co2Rows = co2Rows.concat(data);
      }

      // Average per site
      const siteCo2: Record<string, number[]> = {};
      co2Rows.forEach((row: any) => {
        if (row.value_avg === null) return;
        const siteId = aqDeviceToSite[row.device_id];
        if (!siteId) return;
        if (!siteCo2[siteId]) siteCo2[siteId] = [];
        siteCo2[siteId].push(Number(row.value_avg));
      });

      Object.entries(siteCo2).forEach(([siteId, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        result.airAvg[siteId] = { co2: Math.round(avg), temperature: null, humidity: null, voc: null };
      });

      // Also get latest temperature/humidity from telemetry_latest
      const { data: latestAir } = await supabase
        .from('telemetry_latest')
        .select('site_id, metric, value')
        .in('site_id', siteIds)
        .in('metric', ['env.temperature', 'env.humidity', 'iaq.voc', 'temp', 'temperature', 'humidity', 'voc']);
      
      if (latestAir) {
        latestAir.forEach((row: any) => {
          if (!row.site_id || row.value === null) return;
          if (!result.airAvg[row.site_id]) {
            result.airAvg[row.site_id] = { co2: null, temperature: null, humidity: null, voc: null };
          }
          const m = row.metric;
          if (m === 'env.temperature' || m === 'temp' || m === 'temperature') {
            result.airAvg[row.site_id].temperature = Number(row.value);
          } else if (m === 'env.humidity' || m === 'humidity') {
            result.airAvg[row.site_id].humidity = Number(row.value);
          } else if (m === 'iaq.voc' || m === 'voc') {
            result.airAvg[row.site_id].voc = Number(row.value);
          }
        });
      }
    } catch (e) {
      console.warn('[useAggregatedSiteData] AQ query failed:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // 4) ONLINE STATUS + STALENESS: check latest timestamps per site
  // ---------------------------------------------------------------------------
  try {
    // Fetch latest ts per site from both tables (batched)
    const batchSizeOnline = 50;
    for (let i = 0; i < siteIds.length; i += batchSizeOnline) {
      const batch = siteIds.slice(i, i + batchSizeOnline);
      const [{ data: el }, { data: tl }] = await Promise.all([
        supabase.from('energy_latest').select('site_id, ts').in('site_id', batch),
        supabase.from('telemetry_latest').select('site_id, ts').in('site_id', batch),
      ]);
      // Track max ts per site and online status
      const processRows = (rows: any[] | null) => {
        rows?.forEach((r: any) => {
          if (!r.site_id || !r.ts) return;
          const ts = new Date(r.ts);
          // Update latestTs
          const existing = result.latestTs[r.site_id];
          if (!existing || ts > new Date(existing)) {
            result.latestTs[r.site_id] = r.ts;
          }
          // Check online (60 min)
          if (ts >= sixtyMinutesAgo) {
            result.onlineStatus[r.site_id] = true;
          }
        });
      };
      processRows(el);
      processRows(tl);
    }
  } catch (e) {
    console.warn('[useAggregatedSiteData] online/staleness query failed:', e);
  }

  // ---------------------------------------------------------------------------
  // 5) ALERTS: count from events (status='active') + staleness alerts
  // ---------------------------------------------------------------------------
  try {
    const { data: eventsRows } = await supabase
      .from('events')
      .select('site_id, severity')
      .in('site_id', siteIds)
      .eq('status', 'active');

    eventsRows?.forEach((row: any) => {
      if (!row.site_id) return;
      if (!result.alerts[row.site_id]) result.alerts[row.site_id] = { critical: 0, warning: 0, info: 0 };
      const sev = row.severity?.toLowerCase() || 'info';
      if (sev === 'critical' || sev === 'error') result.alerts[row.site_id].critical++;
      else if (sev === 'warning' || sev === 'warn') result.alerts[row.site_id].warning++;
      else result.alerts[row.site_id].info++;
    });
  } catch (e) { /* ignore */ }

  // Add staleness-based critical alerts: sites with data older than 2 days
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  Object.entries(result.latestTs).forEach(([siteId, ts]) => {
    const lastTs = new Date(ts);
    if (lastTs < twoDaysAgo) {
      if (!result.alerts[siteId]) result.alerts[siteId] = { critical: 0, warning: 0, info: 0 };
      result.alerts[siteId].critical++;
    }
  });

  console.log('[useAggregatedSiteData] Fetched:', {
    sitesWithEnergy: Object.keys(result.weeklyEnergy).length,
    sitesWithHvac: Object.keys(result.hvacEnergy).length,
    sitesWithAir: Object.keys(result.airAvg).length,
    sitesOnline: Object.keys(result.onlineStatus).filter(k => result.onlineStatus[k]).length,
  });

  return result;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useAggregatedSiteData(filteredProjects: Project[]): AggregatedOverlayData {
  const { projects: adminProjects } = useAdminData();

  const siteIds = useMemo(() => {
    return filteredProjects.map(p => p.siteId).filter((id): id is string => !!id);
  }, [filteredProjects]);

  const siteModuleConfig = useMemo(() => {
    const config = new Map<string, { energy: boolean; air: boolean; water: boolean }>();
    filteredProjects.forEach(project => {
      if (!project.siteId) return;
      const adminProject = adminProjects.find(ap => ap.siteId === project.siteId || ap.id === project.siteId);
      if (adminProject) {
        config.set(project.siteId, {
          energy: adminProject.modules.energy.enabled,
          air: adminProject.modules.air.enabled,
          water: adminProject.modules.water.enabled,
        });
      } else {
        config.set(project.siteId, {
          energy: project.monitoring?.includes('energy') ?? false,
          air: project.monitoring?.includes('air') ?? false,
          water: project.monitoring?.includes('water') ?? false,
        });
      }
    });
    return config;
  }, [filteredProjects, adminProjects]);

  const { data: aggregatedData, isLoading, isError } = useQuery({
    queryKey: ['aggregated-site-data-v4', [...siteIds].sort().join(',')],
    queryFn: () => fetchAggregatedDataForSites(siteIds),
    enabled: isSupabaseConfigured && siteIds.length > 0,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  return useMemo(() => {
    const sites: SiteRealData[] = [];

    filteredProjects.forEach(project => {
      if (!project.siteId) return;
      const siteId = project.siteId;

      const weeklyKwh = aggregatedData?.weeklyEnergy[siteId] ?? null;
      const hvacKwh = aggregatedData?.hvacEnergy[siteId] ?? null;
      const lightingKwh = aggregatedData?.lightingEnergy[siteId] ?? null;
      const plugsKwh = aggregatedData?.plugsEnergy[siteId] ?? null;
      const airData = aggregatedData?.airAvg[siteId] ?? null;
      const isOnline = aggregatedData?.onlineStatus[siteId] ?? false;
      const alerts = aggregatedData?.alerts[siteId] ?? { critical: 0, warning: 0, info: 0 };
      const hasLatestTs = !!aggregatedData?.latestTs[siteId];

      const hasEnergyData = weeklyKwh !== null && weeklyKwh > 0;
      const hasAirData = airData !== null && (airData.co2 !== null || airData.temperature !== null);
      const hasWaterData = false;

      // Include site if it has ANY real data, any telemetry ever, or is online
      if (!hasEnergyData && !hasAirData && !isOnline && !hasLatestTs) return;

      sites.push({
        siteId,
        siteName: project.name,
        isOnline,
        hasEnergyData,
        hasAirData,
        hasWaterData,
        energy: { weeklyKwh, hvacKwh, lightingKwh, plugsKwh },
        air: airData ?? { co2: null, temperature: null, humidity: null, voc: null },
        water: { consumption: null },
        alerts,
      });
    });

    const sitesWithEnergy = sites.filter(s => s.hasEnergyData);
    const sitesWithAir = sites.filter(s => s.hasAirData);
    const sitesWithWater = sites.filter(s => s.hasWaterData);
    const sitesOnline = sites.filter(s => s.isOnline);

    const totalWeeklyKwh = sitesWithEnergy.reduce((sum, s) => sum + (s.energy.weeklyKwh || 0), 0);
    const totalCo2 = sitesWithAir.reduce((sum, s) => sum + (s.air.co2 || 0), 0);
    const avgCo2 = sitesWithAir.length > 0 ? Math.round(totalCo2 / sitesWithAir.length) : 0;
    const alertsCritical = sites.reduce((sum, s) => sum + s.alerts.critical, 0);
    const alertsWarning = sites.reduce((sum, s) => sum + s.alerts.warning, 0);

    return {
      sites,
      sitesWithEnergy,
      sitesWithAir,
      sitesWithWater,
      totals: {
        weeklyEnergyKwh: Math.round(totalWeeklyKwh),
        avgCo2,
        sitesCount: sites.length,
        sitesOnline: sitesOnline.length,
        sitesWithData: sites.length,
        alertsCritical,
        alertsWarning,
      },
      isLoading,
      isError,
      hasRealData: sites.length > 0,
    };
  }, [filteredProjects, siteModuleConfig, aggregatedData, isLoading, isError]);
}

/**
 * Check if a project has any active modules with real data capability
 */
export function useProjectHasRealDataCapability(project: Project | null): {
  hasEnergy: boolean;
  hasAir: boolean;
  hasWater: boolean;
  hasAny: boolean;
} {
  const { projects: adminProjects } = useAdminData();

  return useMemo(() => {
    if (!project || !project.siteId) {
      return { hasEnergy: false, hasAir: false, hasWater: false, hasAny: false };
    }

    const adminProject = adminProjects.find(
      ap => ap.siteId === project.siteId || ap.id === project.siteId
    );

    if (adminProject) {
      const hasEnergy = adminProject.modules.energy.enabled;
      const hasAir = adminProject.modules.air.enabled;
      const hasWater = adminProject.modules.water.enabled;
      return { hasEnergy, hasAir, hasWater, hasAny: hasEnergy || hasAir || hasWater };
    }

    const hasEnergy = project.monitoring?.includes('energy') ?? false;
    const hasAir = project.monitoring?.includes('air') ?? false;
    const hasWater = project.monitoring?.includes('water') ?? false;
    return { hasEnergy, hasAir, hasWater, hasAny: hasEnergy || hasAir || hasWater };
  }, [project, adminProjects]);
}
