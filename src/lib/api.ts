/**
 * Centralized API layer for Supabase (Direct DB Access)
 * Provides typed fetch functions and React Query hooks for dashboard data
 */

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from './supabase';

// =============================================================================
// Metric normalization (DB may store short names for backward compatibility)
// =============================================================================

function normalizeMetric(metric: string): string {
  // Canonical -> canonical
  if (metric.includes('.')) {
    // normalize legacy alias
    if (metric === 'iaq.tvoc') return 'iaq.voc';
    return metric;
  }

  // Short DB names -> canonical
  switch (metric) {
    // IAQ
    case 'co2':
      return 'iaq.co2';
    case 'CO2':
      return 'iaq.co2';
    case 'voc':
      return 'iaq.voc';
    case 'tvoc':
      return 'iaq.voc';
    case 'pm25':
      return 'iaq.pm25';
    case 'pm10':
      return 'iaq.pm10';
    case 'co':
      return 'iaq.co';
    case 'o3':
      return 'iaq.o3';

    // ENV
    case 'temp':
      return 'env.temperature';
    case 'temperature':
      return 'env.temperature';
    case 'temp_c':
      return 'env.temperature';
    case 'humidity':
      return 'env.humidity';
    case 'hum':
      return 'env.humidity';
    case 'humidity_rh':
      return 'env.humidity';
    default:
      return metric;
  }
}

function toDbMetricCandidates(canonical: string): string[] {
  // allow querying both canonical and legacy-short values
  if (!canonical) return [];
  if (canonical === 'iaq.tvoc') canonical = 'iaq.voc';
  if (!canonical.includes('.')) return [canonical];

  const short = canonical.split('.').pop()!;
  // env.temperature historically stored as 'temp'
  if (canonical === 'env.temperature') return [canonical, 'temp', 'temperature', 'temp_c'];
  if (canonical === 'env.humidity') return [canonical, 'humidity', 'hum', 'humidity_rh'];
  if (canonical === 'iaq.voc') return [canonical, 'voc', 'tvoc'];
  if (canonical === 'iaq.co2') return [canonical, 'co2', 'CO2'];
  if (canonical === 'iaq.pm25') return [canonical, 'pm25', 'PM2.5', 'pm2_5'];
  if (canonical === 'iaq.pm10') return [canonical, 'pm10', 'PM10'];
  if (canonical === 'iaq.co') return [canonical, 'co', 'CO'];
  if (canonical === 'iaq.o3') return [canonical, 'o3', 'O3'];
  return [canonical, short];
}

function expandMetricFilter(metrics?: string[]): string[] | undefined {
  if (!metrics || metrics.length === 0) return undefined;
  const out = new Set<string>();
  metrics.forEach((m) => toDbMetricCandidates(m).forEach((x) => out.add(x)));
  return Array.from(out);
}

// =============================================================================
// Types
// =============================================================================

export interface ApiDevice {
  id: string;
  device_id: string;
  mac_address?: string;
  model?: string;
  device_type: string;
  name?: string;
  location?: string;
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance';
  last_seen?: string;
  rssi_dbm?: number;
  firmware_version?: string;
  metadata?: Record<string, unknown>;
  site_id: string;
  sites?: {
    id: string;
    name: string;
    brand_id: string;
  };
}

export interface ApiDevicesResponse {
  data: ApiDevice[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface ApiLatestTelemetry {
  device_id: string;
  metric: string;
  value: number;
  unit?: string;
  ts: string;
  quality?: string;
}

export interface ApiLatestResponse {
  data: Record<string, ApiLatestTelemetry[]>;
  meta: {
    device_count: number;
    metric_count: number;
  };
}

export interface ApiTimeseriesPoint {
  ts_bucket: string;
  device_id: string;
  metric: string;
  value_avg: number;
  value_min: number;
  value_max: number;
  sample_count: number;
}

export interface ApiTimeseriesResponse {
  data: ApiTimeseriesPoint[];
  meta: {
    bucket: string;
    source: string;
    start: string;
    end: string;
    point_count: number;
  };
}

export interface ApiSite {
  id: string;
  brand_id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  region?: string;
  lat?: number;
  lng?: number;
  area_m2?: number;
  image_url?: string;
  monitoring_types: string[];
  timezone: string;
  energy_price_kwh: number;
}

export interface ApiBrand {
  id: string;
  holding_id: string;
  name: string;
  logo_url?: string;
}

export interface ApiHolding {
  id: string;
  name: string;
  logo_url?: string;
}

// =============================================================================
// Fetch Functions (DIRECT DB ACCESS)
// =============================================================================

/**
 * Fetch devices directly from Supabase DB
 * Handles both 'type' and 'device_type' parameters to avoid confusion
 */
export async function fetchDevicesApi(params?: {
  site_id?: string;
  type?: string;        // Legacy param name from frontend
  device_type?: string; // Correct DB column name
  status?: string;
  model?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiDevicesResponse | null> {
  if (!supabase) return null;

  // 1. Build query
  let query = supabase
    .from('devices')
    .select('*', { count: 'exact' });

  // 2. Apply filters
  if (params?.site_id) {
    query = query.eq('site_id', params.site_id);
  }
  
  // FIX: Check both parameter names and map to the correct DB column 'device_type'
  const typeFilter = params?.device_type || params?.type;
  if (typeFilter) {
    query = query.eq('device_type', typeFilter);
  }

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  if (params?.model) {
    query = query.eq('model', params.model);
  }

  // Pagination
  const limit = params?.limit || 100;
  const from = params?.offset || 0;
  const to = from + limit - 1;
  
  query = query.range(from, to);

  // 3. Execute
  const { data, error, count } = await query;

  if (error) {
    console.error('Direct DB Devices fetch error:', error);
    return null;
  }

  return {
    data: (data as any[]) || [],
    meta: {
      total: count || 0,
      limit: limit,
      offset: from,
      has_more: (count || 0) > to + 1,
    },
  };
}

/**
 * Fetch latest telemetry directly from 'telemetry_latest' table
 */
export async function fetchLatestApi(params?: {
  site_id?: string;
  device_ids?: string[];
  metrics?: string[];
}): Promise<ApiLatestResponse | null> {
  if (!supabase) return null;

  // IMPORTANT:
  // telemetry_latest (migration 003) does NOT include site_id. Filter by site via join on devices.
  let query = supabase
    .from('telemetry_latest')
    .select(
      `
        device_id,
        metric,
        value,
        unit,
        ts,
        quality,
        devices!inner(site_id)
      `
    );

  // Filters
  if (params?.site_id) {
    query = query.eq('devices.site_id', params.site_id);
  }
  if (params?.device_ids && params.device_ids.length > 0) {
    query = query.in('device_id', params.device_ids);
  }

  const metricFilter = expandMetricFilter(params?.metrics);
  if (metricFilter && metricFilter.length > 0) {
    query = query.in('metric', metricFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Direct DB Latest fetch error:', error);
    return null;
  }

  // Transform flat list to Record<device_id, metrics[]>
  const groupedData: Record<string, ApiLatestTelemetry[]> = {};
  
  (data || []).forEach((row: any) => {
    if (!groupedData[row.device_id]) {
      groupedData[row.device_id] = [];
    }
    groupedData[row.device_id].push({
      device_id: row.device_id,
      metric: normalizeMetric(row.metric),
      value: row.value,
      unit: row.unit,
      ts: row.ts,
      quality: row.quality
    });
  });

  return {
    data: groupedData,
    meta: {
      device_count: Object.keys(groupedData).length,
      metric_count: (data || []).length,
    },
  };
}

/**
 * Fetch time-series telemetry data directly from 'telemetry' table
 */
export async function fetchTimeseriesApi(params: {
  device_ids: string[];
  metrics: string[];
  start: string;
  end: string;
  bucket?: string;
}): Promise<ApiTimeseriesResponse | null> {
  if (!supabase) return null;

  const metricFilter = expandMetricFilter(params.metrics) || params.metrics;

  // Use raw 'telemetry' table for immediate data availability
  const { data, error } = await supabase
    .from('telemetry')
    .select('ts, device_id, metric, value')
    .in('device_id', params.device_ids)
    .in('metric', metricFilter)
    .gte('ts', params.start)
    .lte('ts', params.end)
    .order('ts', { ascending: true });

  if (error) {
    console.error('Direct DB Timeseries fetch error:', error);
    return null;
  }

  // Map raw data to ApiTimeseriesPoint format
  // We use raw 'value' for avg/min/max since we are bypassing aggregation for now
  const formattedData: ApiTimeseriesPoint[] = (data || []).map((row: any) => ({
    ts_bucket: row.ts,
    device_id: row.device_id,
    metric: normalizeMetric(row.metric),
    value_avg: row.value,
    value_min: row.value,
    value_max: row.value,
    sample_count: 1
  }));

  return {
    data: formattedData,
    meta: {
      bucket: params.bucket || 'raw',
      source: 'database_direct',
      start: params.start,
      end: params.end,
      point_count: formattedData.length
    }
  };
}

/**
 * Fetch sites from database
 */
export async function fetchSitesApi(): Promise<ApiSite[] | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('name');

  if (error) {
    console.error('Sites fetch error:', error);
    return null;
  }

  return data;
}

/**
 * Fetch brands from database
 */
export async function fetchBrandsApi(): Promise<ApiBrand[] | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name');

  if (error) {
    console.error('Brands fetch error:', error);
    return null;
  }

  return data;
}

/**
 * Fetch holdings from database
 */
export async function fetchHoldingsApi(): Promise<ApiHolding[] | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .order('name');

  if (error) {
    console.error('Holdings fetch error:', error);
    return null;
  }

  return data;
}

// =============================================================================
// React Query Hooks
// =============================================================================

/**
 * Query key factory for consistent cache keys
 */
export const queryKeys = {
  devices: (params?: Record<string, unknown>) => ['devices', params] as const,
  latest: (params?: Record<string, unknown>) => ['latest', params] as const,
  timeseries: (params: Record<string, unknown>) => ['timeseries', params] as const,
  sites: () => ['sites'] as const,
  brands: () => ['brands'] as const,
  holdings: () => ['holdings'] as const,
};

/**
 * Hook to fetch devices with caching
 */
export function useDevices(
  params?: Parameters<typeof fetchDevicesApi>[0],
  options?: Omit<UseQueryOptions<ApiDevicesResponse | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.devices(params),
    queryFn: () => fetchDevicesApi(params),
    enabled: isSupabaseConfigured,
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
}

/**
 * Hook to fetch latest telemetry with caching
 */
export function useLatestTelemetry(
  params?: Parameters<typeof fetchLatestApi>[0],
  options?: Omit<UseQueryOptions<ApiLatestResponse | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.latest(params),
    queryFn: () => fetchLatestApi(params),
    enabled: isSupabaseConfigured,
    staleTime: 10 * 1000, // 10 seconds for real-time data
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    ...options,
  });
}

/**
 * Hook to fetch time-series data with caching
 */
export function useTimeseries(
  params: Parameters<typeof fetchTimeseriesApi>[0],
  options?: Omit<UseQueryOptions<ApiTimeseriesResponse | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.timeseries(params),
    queryFn: () => fetchTimeseriesApi(params),
    enabled: isSupabaseConfigured && params.device_ids.length > 0,
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

/**
 * Hook to fetch all sites
 */
export function useSites(
  options?: Omit<UseQueryOptions<ApiSite[] | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.sites(),
    queryFn: fetchSitesApi,
    enabled: isSupabaseConfigured,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch all brands
 */
export function useBrands(
  options?: Omit<UseQueryOptions<ApiBrand[] | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.brands(),
    queryFn: fetchBrandsApi,
    enabled: isSupabaseConfigured,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch all holdings
 */
export function useHoldings(
  options?: Omit<UseQueryOptions<ApiHolding[] | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.holdings(),
    queryFn: fetchHoldingsApi,
    enabled: isSupabaseConfigured,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to invalidate all admin data caches
 * Call this after creating/updating/deleting sites, brands, or holdings
 */
export function useInvalidateAdminData() {
  const queryClient = useQueryClient();
  
  return {
    invalidateSites: () => queryClient.invalidateQueries({ queryKey: queryKeys.sites() }),
    invalidateBrands: () => queryClient.invalidateQueries({ queryKey: queryKeys.brands() }),
    invalidateHoldings: () => queryClient.invalidateQueries({ queryKey: queryKeys.holdings() }),
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites() });
      queryClient.invalidateQueries({ queryKey: queryKeys.brands() });
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings() });
    },
  };
}
