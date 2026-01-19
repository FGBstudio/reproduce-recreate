import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase connection
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create Supabase client - always create it if configured
let _supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = _supabase!;

// Helper to check if we should use real data or mock
export const useRealData = isSupabaseConfigured;

// Log configuration status for debugging
console.log('[Supabase] Configured:', isSupabaseConfigured, '| URL:', supabaseUrl ? 'SET' : 'MISSING');

// Types for database tables
export interface DbHolding {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DbBrand {
  id: string;
  holding_id: string;
  name: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DbSite {
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
  created_at: string;
  updated_at: string;
}

export interface DbDevice {
  id: string;
  site_id: string;
  device_id: string;
  mac_address?: string;
  model?: string;
  device_type: 'air_quality' | 'energy_monitor' | 'water_meter' | 'occupancy' | 'hvac' | 'lighting' | 'other';
  broker?: string;
  topic?: string;
  name?: string;
  location?: string;
  category?: string;
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance';
  last_seen?: string;
  rssi_dbm?: number;
  firmware_version?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbTelemetryLatest {
  device_id: string;
  metric: string;
  value: number;
  unit?: string;
  ts: string;
  quality?: string;
}

export interface DbSiteKpi {
  id: string;
  site_id: string;
  ts_computed: string;
  energy_total_kwh?: number;
  energy_hvac_kwh?: number;
  energy_lighting_kwh?: number;
  energy_plugs_kwh?: number;
  energy_intensity_kwh_m2?: number;
  energy_cost_eur?: number;
  aq_index?: string;
  aq_co2_avg?: number;
  aq_co2_max?: number;
  aq_voc_avg?: number;
  aq_temp_avg?: number;
  aq_humidity_avg?: number;
  aq_pm25_avg?: number;
  aq_pm10_avg?: number;
  aq_co_avg?: number;
  aq_o3_avg?: number;
  water_consumption_liters?: number;
  water_target_liters?: number;
  water_leak_count?: number;
  co2_eq_saved_kg?: number;
  devices_online?: number;
  devices_total?: number;
  devices_critical?: number;
  alerts_critical?: number;
  alerts_warning?: number;
  period_type: string;
  period_start?: string;
  period_end?: string;
}

// API helper functions
export async function fetchSites(): Promise<DbSite[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching sites:', error);
    return [];
  }
  
  return data || [];
}

export async function fetchDevices(siteId?: string): Promise<DbDevice[]> {
  if (!supabase) return [];
  
  let query = supabase
    .from('devices')
    .select('*')
    .order('last_seen', { ascending: false });
  
  if (siteId) {
    query = query.eq('site_id', siteId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching devices:', error);
    return [];
  }
  
  return data || [];
}

export async function fetchLatestTelemetry(siteId: string): Promise<DbTelemetryLatest[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('telemetry_latest')
    .select(`
      *,
      devices!inner(site_id)
    `)
    .eq('devices.site_id', siteId);
  
  if (error) {
    console.error('Error fetching latest telemetry:', error);
    return [];
  }
  
  return data || [];
}

export async function fetchSiteKpis(siteId: string, periodType: string = 'day'): Promise<DbSiteKpi | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('site_kpis')
    .select('*')
    .eq('site_id', siteId)
    .eq('period_type', periodType)
    .order('ts_computed', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching site KPIs:', error);
    return null;
  }
  
  return data;
}

export async function fetchTimeseries(
  deviceIds: string[],
  metrics: string[],
  start: string,
  end: string,
  bucket?: string
): Promise<Array<{
  ts_bucket: string;
  device_id: string;
  metric: string;
  value_avg: number;
  value_min: number;
  value_max: number;
  sample_count: number;
}>> {
  if (!supabase) return [];
  
  const { data, error } = await supabase.rpc('get_telemetry_timeseries', {
    p_device_ids: deviceIds,
    p_metrics: metrics,
    p_start: start,
    p_end: end,
    p_bucket: bucket || null,
  });
  
  if (error) {
    console.error('Error fetching timeseries:', error);
    return [];
  }
  
  return data || [];
}
