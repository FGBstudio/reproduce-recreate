/**
 * Hook for fetching aggregated real telemetry data across multiple sites
 * Used by BrandOverlay and HoldingOverlay to display only real data from sites with active modules
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
  hasEnergyData: boolean;
  hasAirData: boolean;
  hasWaterData: boolean;
  energy: {
    total: number | null;
    hvac: number | null;
    lighting: number | null;
    plugs: number | null;
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
}

export interface AggregatedOverlayData {
  sites: SiteRealData[];
  sitesWithEnergy: SiteRealData[];
  sitesWithAir: SiteRealData[];
  sitesWithWater: SiteRealData[];
  totals: {
    energy: number;
    avgCo2: number;
    sitesCount: number;
  };
  isLoading: boolean;
  isError: boolean;
  hasRealData: boolean;
}

// =============================================================================
// Fetch latest telemetry for multiple sites
// =============================================================================

async function fetchLatestTelemetryForSites(siteIds: string[]): Promise<Map<string, Record<string, number>>> {
  if (!supabase || siteIds.length === 0) {
    return new Map();
  }

  // We aggregate per-site metrics across multiple devices.
  // - Energy metrics: SUM (kW)
  // - Non-energy metrics: AVERAGE (e.g., CO2)
  const energyMetrics = new Set([
    'energy.power_kw',
    'energy.total_kw',
    'energy.hvac_kw',
    'energy.lighting_kw',
    'energy.plugs_kw',
  ]);

  const siteEnergy = new Map<string, Record<string, number>>();
  const siteNonEnergySum = new Map<string, Record<string, number>>();
  const siteNonEnergyCount = new Map<string, Record<string, number>>();

  const ensure = (m: Map<string, Record<string, number>>, siteId: string) => {
    if (!m.has(siteId)) m.set(siteId, {});
    return m.get(siteId)!;
  };

  const add = (siteId: string, rawMetric: string, rawValue: number) => {
    const metric = normalizeMetric(rawMetric);
    if (!Number.isFinite(rawValue)) return;

    if (energyMetrics.has(metric) || metric.startsWith('energy.')) {
      const metrics = ensure(siteEnergy, siteId);
      metrics[metric] = (metrics[metric] || 0) + rawValue;
      return;
    }

    const sums = ensure(siteNonEnergySum, siteId);
    const counts = ensure(siteNonEnergyCount, siteId);
    sums[metric] = (sums[metric] || 0) + rawValue;
    counts[metric] = (counts[metric] || 0) + 1;
  };

  // ---------------------------------------------------------------------------
  // 1) ENERGY: Prefer dedicated energy_latest (doesn't require "live" freshness)
  // ---------------------------------------------------------------------------
  try {
    const { data: energyRows, error: energyError } = await supabase
      .from('energy_latest')
      .select('site_id, metric, value')
      .in('site_id', siteIds)
      .in('metric', Array.from(energyMetrics));

    if (energyError) {
      console.warn('[useAggregatedSiteData] energy_latest query failed (will fallback to telemetry_latest):', energyError);
    } else {
      (energyRows || []).forEach((row: any) => {
        const siteId = row.site_id;
        if (!siteId) return;
        add(siteId, row.metric, row.value);
      });
    }
  } catch (e) {
    console.warn('[useAggregatedSiteData] energy_latest query threw (will fallback to telemetry_latest):', e);
  }

  // ---------------------------------------------------------------------------
  // 2) AIR/WATER (and possible energy fallback): telemetry_latest
  // Prefer filtering by telemetry_latest.site_id (migration 012). If missing,
  // fallback to join on devices.
  // ---------------------------------------------------------------------------
  const telemetryMetricCandidates = [
    // canonical
    'iaq.co2',
    'iaq.voc',
    'iaq.tvoc',
    'env.temperature',
    'env.humidity',
    'env.temp',
    'env.hum',
    'water.consumption',
    'water.flow',

    // legacy short keys (still seen in some payloads)
    'co2',
    'CO2',
    'voc',
    'tvoc',
    'temp',
    'temperature',
    'temp_c',
    'humidity',
    'hum',

    // energy fallback (some deployments still write energy.* to telemetry_latest)
    ...Array.from(energyMetrics),
  ];

  // Attempt: direct site_id filter
  const direct = await supabase
    .from('telemetry_latest')
    .select('site_id, metric, value')
    .in('site_id', siteIds)
    .in('metric', telemetryMetricCandidates);

  if (direct.error) {
    const msg = String((direct.error as any)?.message || '').toLowerCase();

    // If site_id column isn't available in this deployment, fallback to the join.
    if (msg.includes('site_id') && msg.includes('column')) {
      const { data, error } = await supabase
        .from('telemetry_latest')
        .select(`
          metric,
          value,
          devices!inner(site_id)
        `)
        .in('devices.site_id', siteIds)
        .in('metric', telemetryMetricCandidates);

      if (error) {
        console.error('[useAggregatedSiteData] Error fetching telemetry_latest (join fallback):', error);
      } else {
        (data || []).forEach((row: any) => {
          const siteId = row.devices?.site_id;
          if (!siteId) return;
          add(siteId, row.metric, row.value);
        });
      }
    } else {
      console.error('[useAggregatedSiteData] Error fetching telemetry_latest:', direct.error);
    }
  } else {
    (direct.data || []).forEach((row: any) => {
      const siteId = row.site_id;
      if (!siteId) return;
      add(siteId, row.metric, row.value);
    });
  }

  // ---------------------------------------------------------------------------
  // Finalize map: energy sums + non-energy averages
  // ---------------------------------------------------------------------------
  const out = new Map<string, Record<string, number>>();

  const allSiteIds = new Set<string>([
    ...Array.from(siteEnergy.keys()),
    ...Array.from(siteNonEnergySum.keys()),
  ]);

  allSiteIds.forEach((siteId) => {
    const merged: Record<string, number> = {};

    const e = siteEnergy.get(siteId);
    if (e) Object.assign(merged, e);

    const sums = siteNonEnergySum.get(siteId) || {};
    const counts = siteNonEnergyCount.get(siteId) || {};
    Object.keys(sums).forEach((metric) => {
      const c = counts[metric] || 0;
      if (c > 0) merged[metric] = sums[metric] / c;
    });

    out.set(siteId, merged);
  });

  return out;
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

  // Fetch real telemetry data
  const { data: telemetryMap, isLoading, isError } = useQuery({
    queryKey: ['aggregated-site-telemetry', [...siteIds].sort().join(',')],
    queryFn: () => fetchLatestTelemetryForSites(siteIds),
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

      const metrics = telemetryMap?.get(project.siteId) || {};

      // Check which data types have real values
      const hasEnergyData = modules.energy && (
        metrics['energy.power_kw'] !== undefined ||
        metrics['energy.total_kw'] !== undefined ||
        metrics['energy.hvac_kw'] !== undefined
      );

      const hasAirData = modules.air && (
        metrics['iaq.co2'] !== undefined ||
        metrics['env.temperature'] !== undefined
      );

      const hasWaterData = modules.water && (
        metrics['water.consumption'] !== undefined ||
        metrics['water.flow'] !== undefined
      );

      // Only include site if it has at least one type of real data
      if (!hasEnergyData && !hasAirData && !hasWaterData) {
        return;
      }

      sites.push({
        siteId: project.siteId,
        siteName: project.name,
        hasEnergyData,
        hasAirData,
        hasWaterData,
        energy: {
          total: metrics['energy.power_kw'] ?? metrics['energy.total_kw'] ?? null,
          hvac: metrics['energy.hvac_kw'] ?? null,
          lighting: metrics['energy.lighting_kw'] ?? null,
          plugs: metrics['energy.plugs_kw'] ?? null,
        },
        air: {
          co2: metrics['iaq.co2'] ?? null,
          temperature: metrics['env.temperature'] ?? null,
          humidity: metrics['env.humidity'] ?? null,
          voc: metrics['iaq.voc'] ?? null,
        },
        water: {
          consumption: metrics['water.consumption'] ?? null,
        },
      });
    });

    const sitesWithEnergy = sites.filter(s => s.hasEnergyData);
    const sitesWithAir = sites.filter(s => s.hasAirData);
    const sitesWithWater = sites.filter(s => s.hasWaterData);

    // Calculate totals
    const totalEnergy = sitesWithEnergy.reduce((sum, s) => sum + (s.energy.total || 0), 0);
    const totalCo2 = sitesWithAir.reduce((sum, s) => sum + (s.air.co2 || 0), 0);
    const avgCo2 = sitesWithAir.length > 0 ? Math.round(totalCo2 / sitesWithAir.length) : 0;

    return {
      sites,
      sitesWithEnergy,
      sitesWithAir,
      sitesWithWater,
      totals: {
        energy: Math.round(totalEnergy),
        avgCo2,
        sitesCount: sites.length,
      },
      isLoading,
      isError,
      hasRealData: sites.length > 0,
    };
  }, [filteredProjects, siteModuleConfig, telemetryMap, isLoading, isError]);
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
