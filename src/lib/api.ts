/**
 * Centralized API layer for Supabase Edge Functions
 * Provides typed fetch functions and React Query hooks for dashboard data
 */

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from './supabase';

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
// API Base URL
// =============================================================================

const getApiBaseUrl = (): string | null => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/functions/v1`;
};

// =============================================================================
// Fetch Functions (raw API calls)
// =============================================================================

/**
 * Fetch devices with optional filtering
 */
export async function fetchDevicesApi(params?: {
  site_id?: string;
  type?: string;
  status?: string;
  model?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiDevicesResponse | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl || !supabase) return null;

  const searchParams = new URLSearchParams();
  if (params?.site_id) searchParams.set('site_id', params.site_id);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.model) searchParams.set('model', params.model);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const url = `${baseUrl}/devices?${searchParams.toString()}`;
  
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    console.error('Devices API error:', response.status, await response.text());
    return null;
  }

  return response.json();
}

/**
 * Fetch latest telemetry values
 */
export async function fetchLatestApi(params?: {
  site_id?: string;
  device_ids?: string[];
  metrics?: string[];
}): Promise<ApiLatestResponse | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl || !supabase) return null;

  const searchParams = new URLSearchParams();
  if (params?.site_id) searchParams.set('site_id', params.site_id);
  if (params?.device_ids?.length) searchParams.set('device_ids', params.device_ids.join(','));
  if (params?.metrics?.length) searchParams.set('metrics', params.metrics.join(','));

  const url = `${baseUrl}/latest?${searchParams.toString()}`;
  
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    console.error('Latest API error:', response.status, await response.text());
    return null;
  }

  return response.json();
}

/**
 * Fetch time-series telemetry data
 */
export async function fetchTimeseriesApi(params: {
  device_ids: string[];
  metrics: string[];
  start: string;
  end: string;
  bucket?: string;
}): Promise<ApiTimeseriesResponse | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl || !supabase) return null;

  const searchParams = new URLSearchParams();
  searchParams.set('device_ids', params.device_ids.join(','));
  searchParams.set('metrics', params.metrics.join(','));
  searchParams.set('start', params.start);
  searchParams.set('end', params.end);
  if (params.bucket) searchParams.set('bucket', params.bucket);

  const url = `${baseUrl}/timeseries?${searchParams.toString()}`;
  
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    console.error('Timeseries API error:', response.status, await response.text());
    return null;
  }

  return response.json();
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
