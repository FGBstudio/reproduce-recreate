/**
 * Hooks for fetching real-time project and site data with React Query
 * Falls back to mock data when Supabase is not configured
 */

import { useMemo } from 'react';
import { 
  useSites, 
  useBrands, 
  useHoldings, 
  useDevices,
  useLatestTelemetry,
  ApiSite,
  ApiBrand,
  ApiHolding,
} from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { 
  Project, 
  Brand, 
  Holding, 
  ProjectData, 
  MonitoringType,
  projects as mockProjects,
  brands as mockBrands,
  holdings as mockHoldings,
} from '@/lib/data';

// =============================================================================
// Transformation Helpers
// =============================================================================

/**
 * Convert API holding to frontend Holding type
 */
function transformHolding(apiHolding: ApiHolding): Holding {
  return {
    id: apiHolding.id,
    name: apiHolding.name,
    logo: apiHolding.logo_url || 'https://via.placeholder.com/128?text=' + encodeURIComponent(apiHolding.name.substring(0, 2)),
  };
}

/**
 * Convert API brand to frontend Brand type
 */
function transformBrand(apiBrand: ApiBrand): Brand {
  return {
    id: apiBrand.id,
    name: apiBrand.name,
    holdingId: apiBrand.holding_id,
    logo: apiBrand.logo_url || 'https://via.placeholder.com/128?text=' + encodeURIComponent(apiBrand.name.substring(0, 2)),
  };
}

/**
 * Convert API site to frontend Project type
 * Sites from DB are given negative IDs to distinguish from mock projects
 */
function transformSite(apiSite: ApiSite, latestData?: Record<string, number>): Project {
  // Calculate ProjectData from latest telemetry or use defaults
  const data: ProjectData = {
    hvac: latestData?.['energy.hvac_kw'] ?? Math.round(20 + Math.random() * 40),
    light: latestData?.['energy.lighting_kw'] ?? Math.round(15 + Math.random() * 35),
    total: latestData?.['energy.power_kw'] ?? Math.round(50 + Math.random() * 80),
    co2: latestData?.['iaq.co2'] ?? Math.round(350 + Math.random() * 300),
    temp: latestData?.['env.temperature'] ?? Math.round(19 + Math.random() * 6),
    alerts: 0, // Would come from events table
    aq: calculateAqIndex(latestData?.['iaq.co2']),
  };

  // --- FIX FILTRI: MAPPING CORRETTO DB -> FRONTEND ---
  // Il DB usa: "energy_monitor", "air_quality", "water_monitor"
  // Il Frontend usa: "energy", "air", "water"
  const rawMonitoring = apiSite.monitoring_types || [];
  const monitoringList: MonitoringType[] = [];

  rawMonitoring.forEach(t => {
    const val = t.toLowerCase();
    // Mappatura "intelligente" che cattura sia "energy" che "energy_monitor"
    if (val.includes('energy')) monitoringList.push('energy');
    if (val.includes('air')) monitoringList.push('air');
    if (val.includes('water')) monitoringList.push('water');
  });

  // Rimuovi duplicati (Set) e trasforma in array
  const monitoring = Array.from(new Set(monitoringList));
  // ---------------------------------------------------

  // Map region from DB (or derive from country)
  const region = mapRegion(apiSite.region || apiSite.country);

  // Generate a unique numeric ID from UUID for legacy compatibility
  const numericId = apiSite.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return {
    id: -numericId, // Negative ID for real data
    name: apiSite.name,
    region,
    lat: apiSite.lat ?? 0,
    lng: apiSite.lng ?? 0,
    address: [apiSite.city, apiSite.country].filter(Boolean).join(', ') || apiSite.address || '',
    
    // Gestione Immagine: undefined permette il fallback al pattern del brand
    img: apiSite.image_url || undefined,

    data,
    // Se il mapping ha trovato qualcosa, usalo. Altrimenti fallback a energy (solo se veramente vuoto)
    monitoring: monitoring.length > 0 ? monitoring : ['energy'],
    
    brandId: apiSite.brand_id,
    siteId: apiSite.id, // Store original site_id for API calls and telemetry
    area_m2: apiSite.area_m2,
    energy_price_kwh: apiSite.energy_price_kwh,
  };
}

/**
 * Calculate AQ index from CO2 level
 */
function calculateAqIndex(co2?: number): string {
  if (!co2) return 'GOOD';
  if (co2 < 600) return 'EXCELLENT';
  if (co2 < 800) return 'GOOD';
  if (co2 < 1000) return 'MODERATE';
  if (co2 < 1500) return 'POOR';
  return 'CRITICAL';
}

/**
 * Map country/region string to dashboard region code
 */
function mapRegion(regionOrCountry?: string): string {
  if (!regionOrCountry) return 'EU';
  
  const lower = regionOrCountry.toLowerCase();
  
  // Europe
  if (['italy', 'france', 'uk', 'germany', 'spain', 'eu', 'europe'].some(c => lower.includes(c))) {
    return 'EU';
  }
  // Americas
  if (['usa', 'canada', 'mexico', 'brazil', 'america', 'amer'].some(c => lower.includes(c))) {
    return 'AMER';
  }
  // Asia Pacific
  if (['japan', 'china', 'korea', 'australia', 'singapore', 'hong kong', 'asia', 'apac'].some(c => lower.includes(c))) {
    return 'APAC';
  }
  // Middle East & Africa
  if (['uae', 'dubai', 'saudi', 'africa', 'mea', 'middle east'].some(c => lower.includes(c))) {
    return 'MEA';
  }
  
  return 'EU';
}

// =============================================================================
// Combined Data Hooks
// =============================================================================

/**
 * Hook to get all holdings (real + mock) with loading/error states
 */
export function useAllHoldings() {
  const { data: realHoldings, isLoading, error, refetch } = useHoldings();

  return useMemo(() => {
    const transformed = realHoldings?.map(transformHolding) || [];
    
    // Combine real holdings with mock holdings (avoiding duplicates by name)
    const realNames = new Set(transformed.map(h => h.name.toLowerCase()));
    const combined = [
      ...transformed,
      ...mockHoldings.filter(h => !realNames.has(h.name.toLowerCase())),
    ];

    return {
      holdings: combined,
      isLoading,
      error: error as Error | null,
      hasRealData: isSupabaseConfigured && transformed.length > 0,
      refetch,
    };
  }, [realHoldings, isLoading, error, refetch]);
}

/**
 * Hook to get all brands (real + mock) with loading/error states
 */
export function useAllBrands() {
  const { data: realBrands, isLoading, error, refetch } = useBrands();

  return useMemo(() => {
    const transformed = realBrands?.map(transformBrand) || [];
    
    // Combine real brands with mock brands
    const realNames = new Set(transformed.map(b => b.name.toLowerCase()));
    const combined = [
      ...transformed,
      ...mockBrands.filter(b => !realNames.has(b.name.toLowerCase())),
    ];

    return {
      brands: combined,
      isLoading,
      error: error as Error | null,
      hasRealData: isSupabaseConfigured && transformed.length > 0,
      refetch,
    };
  }, [realBrands, isLoading, error, refetch]);
}

/**
 * Hook to get all projects/sites (real + mock) with loading/error states
 */
export function useAllProjects() {
  const { data: realSites, isLoading: sitesLoading, error: sitesError, refetch: refetchSites } = useSites();
  
  // Get latest telemetry for all sites to populate project data
  const siteIds = realSites?.map(s => s.id) || [];
  const { data: latestData, refetch: refetchTelemetry } = useLatestTelemetry(
    siteIds.length > 0 ? { site_id: siteIds[0] } : undefined,
    { enabled: siteIds.length > 0 }
  );

  return useMemo(() => {
    // Build a lookup of latest values by device
    const latestByDevice: Record<string, Record<string, number>> = {};
    if (latestData?.data) {
      Object.entries(latestData.data).forEach(([deviceId, metrics]) => {
        latestByDevice[deviceId] = {};
        metrics.forEach(m => {
          latestByDevice[deviceId][m.metric] = m.value;
        });
      });
    }

    const transformed = realSites?.map(site => transformSite(site)) || [];
    
    // Combine real sites with mock projects
    const realNames = new Set(transformed.map(p => p.name.toLowerCase()));
    const combined = [
      ...transformed,
      ...mockProjects.filter(p => !realNames.has(p.name.toLowerCase())),
    ];

    const refetch = () => {
      refetchSites();
      refetchTelemetry();
    };

    return {
      projects: combined,
      isLoading: sitesLoading,
      error: sitesError as Error | null,
      hasRealData: isSupabaseConfigured && transformed.length > 0,
      refetch,
    };
  }, [realSites, latestData, sitesLoading, sitesError, refetchSites, refetchTelemetry]);
}

/**
 * Hook to get devices for a specific site
 */
export function useSiteDevices(siteId?: string) {
  const { data, isLoading, error } = useDevices(
    siteId ? { site_id: siteId } : undefined,
    { enabled: !!siteId }
  );

  return {
    devices: data?.data || [],
    total: data?.meta.total || 0,
    isLoading,
    error,
  };
}

/**
 * Hook to get latest telemetry for a specific site
 */
export function useSiteLatestTelemetry(siteId?: string) {
  const { data, isLoading, error, refetch } = useLatestTelemetry(
    siteId ? { site_id: siteId } : undefined,
    { enabled: !!siteId }
  );

  return useMemo(() => {
    // Flatten and aggregate metrics across all devices
    const aggregated: Record<string, { value: number; count: number; unit?: string }> = {};
    
    if (data?.data) {
      Object.values(data.data).forEach(deviceMetrics => {
        deviceMetrics.forEach(m => {
          if (!aggregated[m.metric]) {
            aggregated[m.metric] = { value: 0, count: 0, unit: m.unit };
          }
          aggregated[m.metric].value += m.value;
          aggregated[m.metric].count += 1;
        });
      });
    }

    // Calculate averages for certain metrics
    const result: Record<string, number> = {};
    Object.entries(aggregated).forEach(([metric, agg]) => {
      // Sum for energy metrics, average for others
      if (metric.startsWith('energy.')) {
        result[metric] = agg.value;
      } else {
        result[metric] = agg.count > 0 ? agg.value / agg.count : 0;
      }
    });

    return {
      metrics: result,
      raw: data?.data || {},
      isLoading,
      error,
      refetch,
    };
  }, [data, isLoading, error, refetch]);
}

// =============================================================================
// Helper to get site ID from Project
// =============================================================================

/**
 * Extract the real site_id from a Project (if it's a real project)
 */
export function getProjectSiteId(project: Project): string | undefined {
  // Use siteId field directly (set for both real DB projects and some mock projects)
  return project.siteId;
}

/**
 * Check if a project is from real data
 */
export function isRealProject(project: Project): boolean {
  return project.id < 0; // Real projects have negative IDs
}
