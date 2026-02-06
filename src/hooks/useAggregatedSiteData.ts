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

  // Fetch latest telemetry for all sites at once
  const { data, error } = await supabase
    .from('telemetry_latest')
    .select(`
      device_id,
      metric,
      value,
      ts,
      devices!inner(site_id)
    `)
    .in('devices.site_id', siteIds);

  if (error) {
    console.error('[useAggregatedSiteData] Error fetching telemetry:', error);
    return new Map();
  }

  // Group by site_id and aggregate metrics
  const siteMetrics = new Map<string, Record<string, number>>();

  (data || []).forEach((row: any) => {
    const siteId = row.devices?.site_id;
    if (!siteId) return;

    if (!siteMetrics.has(siteId)) {
      siteMetrics.set(siteId, {});
    }

    const metrics = siteMetrics.get(siteId)!;
    const metricName = normalizeMetric(row.metric);

    // Sum energy metrics, average others
    if (metricName.startsWith('energy.')) {
      metrics[metricName] = (metrics[metricName] || 0) + row.value;
    } else {
      // For non-energy metrics, keep the first or average
      if (!metrics[metricName]) {
        metrics[metricName] = row.value;
      } else {
        metrics[metricName] = (metrics[metricName] + row.value) / 2;
      }
    }
  });

  return siteMetrics;
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
    queryKey: ['aggregated-site-telemetry', siteIds.sort().join(',')],
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
