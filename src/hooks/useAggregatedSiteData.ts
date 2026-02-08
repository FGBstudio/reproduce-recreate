/**
 * Hook for fetching aggregated real telemetry data across multiple sites
 * Used by BrandOverlay and HoldingOverlay to display only real data from sites with active modules
 * 
 * REFACTORED:
 * - Energy: SUM of kWh from energy_daily (last 7 days), NOT instantaneous kW
 * - Online status: Any telemetry (energy OR air OR water) = site is ONLINE
 * - Alerts: Real count from events table (status='active')
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
    weeklyKwh: number | null;  // SUM of kWh last 7 days
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
    weeklyEnergyKwh: number;  // Total kWh last 7 days
    avgCo2: number;
    sitesCount: number;
    sitesOnline: number;
    alertsCritical: number;
    alertsWarning: number;
  };
  isLoading: boolean;
  isError: boolean;
  hasRealData: boolean;
}

// =============================================================================
// Data fetching functions
// =============================================================================

interface SiteAggregatedData {
  weeklyEnergy: Record<string, number>;  // site_id -> kWh
  latestAir: Record<string, Record<string, number>>;  // site_id -> metrics
  alerts: Record<string, { critical: number; warning: number; info: number }>;
  onlineStatus: Record<string, boolean>;  // site_id -> isOnline
}

async function fetchAggregatedDataForSites(siteIds: string[]): Promise<SiteAggregatedData> {
  if (!supabase || siteIds.length === 0) {
    return { weeklyEnergy: {}, latestAir: {}, alerts: {}, onlineStatus: {} };
  }

  const result: SiteAggregatedData = {
    weeklyEnergy: {},
    latestAir: {},
    alerts: {},
    onlineStatus: {},
  };

  // Calculate date boundaries
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  
  const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // ---------------------------------------------------------------------------
  // 1) ENERGY: Sum kWh from energy_daily (last 7 days)
  // ---------------------------------------------------------------------------
  try {
    const { data: energyRows, error } = await supabase
      .from('energy_daily')
      .select('site_id, metric, value_sum')
      .in('site_id', siteIds)
      .gte('ts_day', sevenDaysAgoStr)
      .in('metric', ['energy.active_energy', 'energy.total_kwh', 'energy.hvac_kwh', 'energy.lighting_kwh', 'energy.plugs_kwh']);

    if (!error && energyRows) {
      // Group by site and sum
      const siteSums: Record<string, Record<string, number>> = {};
      
      energyRows.forEach((row: any) => {
        if (!row.site_id || row.value_sum === null) return;
        if (!siteSums[row.site_id]) siteSums[row.site_id] = {};
        
        const metric = row.metric;
        if (!siteSums[row.site_id][metric]) siteSums[row.site_id][metric] = 0;
        siteSums[row.site_id][metric] += Number(row.value_sum) || 0;
      });

      // Calculate total kWh per site
      Object.entries(siteSums).forEach(([siteId, metrics]) => {
        // Prefer active_energy, fallback to total_kwh
        const total = metrics['energy.active_energy'] ?? metrics['energy.total_kwh'] ?? 0;
        result.weeklyEnergy[siteId] = total;
      });
    }
  } catch (e) {
    console.warn('[useAggregatedSiteData] energy_daily query failed:', e);
  }

  // ---------------------------------------------------------------------------
  // 2) AIR QUALITY: Latest values from telemetry_latest
  // ---------------------------------------------------------------------------
  const airMetrics = ['iaq.co2', 'iaq.voc', 'env.temperature', 'env.humidity', 'co2', 'CO2', 'voc', 'temp', 'temperature', 'humidity'];
  
  try {
    const { data: airRows, error } = await supabase
      .from('telemetry_latest')
      .select('site_id, metric, value, ts')
      .in('site_id', siteIds)
      .in('metric', airMetrics);

    if (!error && airRows) {
      airRows.forEach((row: any) => {
        if (!row.site_id || row.value === null) return;
        
        if (!result.latestAir[row.site_id]) result.latestAir[row.site_id] = {};
        
        // Normalize metric name
        const normalized = normalizeMetric(row.metric);
        result.latestAir[row.site_id][normalized] = Number(row.value);
        
        // Check if data is recent (for online status)
        if (row.ts) {
          const ts = new Date(row.ts);
          if (ts >= sixtyMinutesAgo) {
            result.onlineStatus[row.site_id] = true;
          }
        }
      });
    }
  } catch (e) {
    console.warn('[useAggregatedSiteData] telemetry_latest air query failed:', e);
  }

  // ---------------------------------------------------------------------------
  // 3) ONLINE STATUS: Check energy_latest and telemetry_latest for recent data
  // ---------------------------------------------------------------------------
  try {
    // Check energy_latest for recent data
    const { data: energyLatest, error } = await supabase
      .from('energy_latest')
      .select('site_id, ts')
      .in('site_id', siteIds)
      .gte('ts', sixtyMinutesAgo.toISOString());

    if (!error && energyLatest) {
      energyLatest.forEach((row: any) => {
        if (row.site_id) {
          result.onlineStatus[row.site_id] = true;
        }
      });
    }
  } catch (e) { /* ignore */ }

  try {
    // Also check telemetry_latest for ANY recent telemetry (air, water, etc.)
    const { data: telemetryLatest, error } = await supabase
      .from('telemetry_latest')
      .select('site_id, ts')
      .in('site_id', siteIds)
      .gte('ts', sixtyMinutesAgo.toISOString());

    if (!error && telemetryLatest) {
      telemetryLatest.forEach((row: any) => {
        if (row.site_id) {
          result.onlineStatus[row.site_id] = true;
        }
      });
    }
  } catch (e) { /* ignore */ }

  // ---------------------------------------------------------------------------
  // 4) ALERTS: Count from events table (status='active')
  // ---------------------------------------------------------------------------
  try {
    const { data: eventsRows, error } = await supabase
      .from('events')
      .select('site_id, severity')
      .in('site_id', siteIds)
      .eq('status', 'active');

    if (!error && eventsRows) {
      eventsRows.forEach((row: any) => {
        if (!row.site_id) return;
        
        if (!result.alerts[row.site_id]) {
          result.alerts[row.site_id] = { critical: 0, warning: 0, info: 0 };
        }
        
        const severity = row.severity?.toLowerCase() || 'info';
        if (severity === 'critical' || severity === 'error') {
          result.alerts[row.site_id].critical++;
        } else if (severity === 'warning' || severity === 'warn') {
          result.alerts[row.site_id].warning++;
        } else {
          result.alerts[row.site_id].info++;
        }
      });
    }
  } catch (e) {
    console.warn('[useAggregatedSiteData] events query failed:', e);
  }

  console.log('[useAggregatedSiteData] Fetched data:', {
    sitesWithEnergy: Object.keys(result.weeklyEnergy).length,
    sitesWithAir: Object.keys(result.latestAir).length,
    sitesOnline: Object.keys(result.onlineStatus).filter(k => result.onlineStatus[k]).length,
    sitesWithAlerts: Object.keys(result.alerts).length,
  });

  return result;
}

// =============================================================================
// Helper to normalize metric names
// =============================================================================

function normalizeMetric(metric: string): string {
  if (metric.includes('.')) {
    if (metric === 'iaq.tvoc') return 'iaq.voc';
    if (metric === 'env.temp') return 'env.temperature';
    if (metric === 'env.hum') return 'env.humidity';
    return metric;
  }

  switch (metric) {
    case 'co2':
    case 'CO2':
      return 'iaq.co2';
    case 'voc':
    case 'tvoc':
      return 'iaq.voc';
    case 'pm25':
      return 'iaq.pm25';
    case 'pm10':
      return 'iaq.pm10';
    case 'temp':
    case 'temperature':
    case 'temp_c':
      return 'env.temperature';
    case 'humidity':
    case 'hum':
      return 'env.humidity';
    default:
      return metric;
  }
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Hook to get aggregated real data for a list of projects
 * Only includes sites with active modules and real telemetry data
 */
export function useAggregatedSiteData(filteredProjects: Project[]): AggregatedOverlayData {
  const { projects: adminProjects } = useAdminData();

  // Get site IDs from projects that have a siteId
  const siteIds = useMemo(() => {
    return filteredProjects
      .map(p => p.siteId)
      .filter((id): id is string => !!id);
  }, [filteredProjects]);

  // Get module configuration for each site
  const siteModuleConfig = useMemo(() => {
    const config = new Map<string, { energy: boolean; air: boolean; water: boolean }>();
    
    filteredProjects.forEach(project => {
      if (!project.siteId) return;

      // Find the admin project for this site
      const adminProject = adminProjects.find(
        ap => ap.siteId === project.siteId || ap.id === project.siteId
      );

      if (adminProject) {
        config.set(project.siteId, {
          energy: adminProject.modules.energy.enabled,
          air: adminProject.modules.air.enabled,
          water: adminProject.modules.water.enabled,
        });
      } else {
        // Fallback: check project.monitoring array
        config.set(project.siteId, {
          energy: project.monitoring?.includes('energy') ?? false,
          air: project.monitoring?.includes('air') ?? false,
          water: project.monitoring?.includes('water') ?? false,
        });
      }
    });

    return config;
  }, [filteredProjects, adminProjects]);

  // Fetch real aggregated data
  const { data: aggregatedData, isLoading, isError } = useQuery({
    queryKey: ['aggregated-site-data-v3', [...siteIds].sort().join(',')],
    queryFn: () => fetchAggregatedDataForSites(siteIds),
    enabled: isSupabaseConfigured && siteIds.length > 0,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Build aggregated data
  return useMemo(() => {
    const sites: SiteRealData[] = [];

    filteredProjects.forEach(project => {
      if (!project.siteId) return;

      const modules = siteModuleConfig.get(project.siteId);
      if (!modules) return;

      const siteId = project.siteId;
      const weeklyKwh = aggregatedData?.weeklyEnergy[siteId] ?? null;
      const airMetrics = aggregatedData?.latestAir[siteId] || {};
      const isOnline = aggregatedData?.onlineStatus[siteId] ?? false;
      const alerts = aggregatedData?.alerts[siteId] ?? { critical: 0, warning: 0, info: 0 };

      // Check which data types have real values
      const hasEnergyData = modules.energy && weeklyKwh !== null && weeklyKwh > 0;
      
      // FIX: Site has air data if ANY air metrics exist (not just if energy exists)
      const hasAirData = modules.air && (
        airMetrics['iaq.co2'] !== undefined ||
        airMetrics['env.temperature'] !== undefined ||
        airMetrics['env.humidity'] !== undefined
      );

      const hasWaterData = modules.water && false; // TODO: add water data when available

      // Include site if it has ANY type of real data OR is online
      if (!hasEnergyData && !hasAirData && !hasWaterData && !isOnline) {
        return;
      }

      sites.push({
        siteId,
        siteName: project.name,
        isOnline,
        hasEnergyData,
        hasAirData,
        hasWaterData,
        energy: {
          weeklyKwh,
          hvacKwh: null, // TODO: calculate from category breakdown
          lightingKwh: null,
          plugsKwh: null,
        },
        air: {
          co2: airMetrics['iaq.co2'] ?? null,
          temperature: airMetrics['env.temperature'] ?? null,
          humidity: airMetrics['env.humidity'] ?? null,
          voc: airMetrics['iaq.voc'] ?? null,
        },
        water: {
          consumption: null,
        },
        alerts,
      });
    });

    const sitesWithEnergy = sites.filter(s => s.hasEnergyData);
    const sitesWithAir = sites.filter(s => s.hasAirData);
    const sitesWithWater = sites.filter(s => s.hasWaterData);
    const sitesOnline = sites.filter(s => s.isOnline);

    // Calculate totals
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
      return {
        hasEnergy,
        hasAir,
        hasWater,
        hasAny: hasEnergy || hasAir || hasWater,
      };
    }

    // Fallback to monitoring array
    const hasEnergy = project.monitoring?.includes('energy') ?? false;
    const hasAir = project.monitoring?.includes('air') ?? false;
    const hasWater = project.monitoring?.includes('water') ?? false;

    return {
      hasEnergy,
      hasAir,
      hasWater,
      hasAny: hasEnergy || hasAir || hasWater,
    };
  }, [project, adminProjects]);
}
