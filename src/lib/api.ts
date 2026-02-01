/**
 * Centralized API layer for Supabase (Direct DB Access)
 * Provides typed fetch functions and React Query hooks for dashboard data
 */

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from './supabase';

// =============================================================================
// Timestamp parsing helper (handles Postgres formats, Unix, ISO)
// =============================================================================

/**
 * Parse timestamps from various database formats into stable Date objects.
 * Handles:
 * - ISO strings: "2025-01-29T12:00:00.000Z"
 * - Postgres strings with space: "2025-01-29 12:00:00+00"
 * - Unix timestamps (seconds or milliseconds)
 * - Date objects
 */
export function parseTimestamp(ts: unknown): Date | null {
  if (!ts) return null;
  
  // Already a valid Date
  if (ts instanceof Date) {
    return isNaN(ts.getTime()) ? null : ts;
  }
  
  // Unix number (seconds or milliseconds)
  if (typeof ts === 'number') {
    // If < 1e12, assume seconds; otherwise milliseconds
    const ms = ts < 1e12 ? ts * 1000 : ts;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  
  // String parsing
  if (typeof ts === 'string') {
    const str = ts.trim();
    // Replace space with 'T' to make it ISO-like (Safari/Firefox compatibility)
    const isoStr = str.replace(' ', 'T');
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? null : d;
  }
  
  return null;
}

// =============================================================================
// Metric normalization (DB may store short names for backward compatibility)
// =============================================================================
// =============================================================================

function normalizeMetric(metric: string): string {
  // Canonical -> canonical
  if (metric.includes('.')) {
    // normalize legacy alias
    if (metric === 'iaq.tvoc') return 'iaq.voc';
    // dotted legacy env keys seen in some firmwares
    if (metric === 'env.temp') return 'env.temperature';
    if (metric === 'env.hum') return 'env.humidity';
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
  if (canonical === 'env.temperature') return [canonical, 'env.temp', 'temp', 'temperature', 'temp_c'];
  if (canonical === 'env.humidity') return [canonical, 'env.hum', 'humidity', 'hum', 'humidity_rh'];
  // Some DBs stored the canonical dotted alias 'iaq.tvoc'
  if (canonical === 'iaq.voc') return [canonical, 'iaq.tvoc', 'voc', 'tvoc'];
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
  // Energy module: circuit categorization
  category?: string;
  circuit_name?: string;
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
  // Standardized fields (from edge function or normalized)
  ts?: string;
  value?: number;
  // Legacy fields (from raw RPC calls)
  ts_bucket?: string;
  ts_hour?: string;
  ts_day?: string;
  bucket?: string;
  value_avg?: number;
  value_min?: number;
  value_max?: number;
  value_sum?: number;
  sample_count?: number;
  // Common fields
  device_id: string;
  metric: string;
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
  type?: string | string[];        // Legacy param name from frontend
  device_type?: string | string[]; // Correct DB column name (supports multi-type)
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
  // Supports single value or array of values.
  const typeFilter = params?.device_type ?? params?.type;
  if (typeFilter) {
    if (Array.isArray(typeFilter)) {
      query = query.in('device_type', typeFilter);
    } else {
      query = query.eq('device_type', typeFilter);
    }
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
 * Smart table routing configuration
 * Routes queries to the optimal table based on time range duration
 */
type TableRoute = 'raw' | 'hourly' | 'daily';

interface TableRouteConfig {
  table: TableRoute;
  source: string;
  tsColumn: string;
  valueColumn: string;
  hasMinMax: boolean;
}

function getTableRoute(startDate: Date, endDate: Date): TableRouteConfig {
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const durationDays = durationHours / 24;

  // ≤24 hours: use raw telemetry (maximum detail)
  if (durationHours <= 24) {
    return {
      table: 'raw',
      source: 'telemetry',
      tsColumn: 'ts',
      valueColumn: 'value',
      hasMinMax: false,
    };
  }

  // >24 hours AND ≤30 days: use hourly aggregates
  if (durationDays <= 30) {
    return {
      table: 'hourly',
      source: 'telemetry_hourly',
      tsColumn: 'ts_hour',
      valueColumn: 'value_avg',
      hasMinMax: true,
    };
  }

  // >30 days: use daily aggregates
  return {
    table: 'daily',
    source: 'telemetry_daily',
    tsColumn: 'ts_day',
    valueColumn: 'value_avg',
    hasMinMax: true,
  };
}

/**
 * Fetch time-series telemetry data with smart table routing
 * 
 * Routing logic based on time range duration:
 * - ≤24 hours: telemetry (raw) → maximum detail
 * - >24h AND ≤30 days: telemetry_hourly → hourly averages
 * - >30 days: telemetry_daily → daily averages
 * 
 * Includes fallback to raw + client-side aggregation if aggregate tables are empty
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

  // Client-side aggregation for fallback scenarios
  const aggregateRaw = (
    rawRows: Array<{ ts: string; device_id: string; metric: string; value: number }>,
    targetBucket: '1h' | '1d' | '1M'
  ): ApiTimeseriesPoint[] => {
    const bucketIso = (tsIso: string) => {
      const d = new Date(tsIso);
      if (Number.isNaN(d.getTime())) return tsIso;

      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const h = String(d.getUTCHours()).padStart(2, '0');

      if (targetBucket === '1h') return `${y}-${m}-${day}T${h}:00:00.000Z`;
      if (targetBucket === '1M') return `${y}-${m}-01T00:00:00.000Z`;
      return `${y}-${m}-${day}T00:00:00.000Z`;
    };

    type Agg = {
      ts_bucket: string;
      device_id: string;
      metric: string;
      sum: number;
      min: number;
      max: number;
      count: number;
    };

    const map = new Map<string, Agg>();

    for (const r of rawRows) {
      const ts_bucket = bucketIso(r.ts);
      const metric = normalizeMetric(r.metric);
      const key = `${ts_bucket}|${r.device_id}|${metric}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          ts_bucket,
          device_id: r.device_id,
          metric,
          sum: r.value,
          min: r.value,
          max: r.value,
          count: 1,
        });
      } else {
        prev.sum += r.value;
        prev.count += 1;
        if (r.value < prev.min) prev.min = r.value;
        if (r.value > prev.max) prev.max = r.value;
      }
    }

    return Array.from(map.values())
      .map((a) => ({
        ts_bucket: a.ts_bucket,
        device_id: a.device_id,
        metric: a.metric,
        value_avg: a.count ? a.sum / a.count : 0,
        value_min: a.min,
        value_max: a.max,
        sample_count: a.count,
      }))
      .sort((a, b) => (a.ts_bucket < b.ts_bucket ? -1 : a.ts_bucket > b.ts_bucket ? 1 : 0));
  };

  // Parse dates and determine optimal table routing
  const startDate = new Date(params.start);
  const endDate = new Date(params.end);
  const route = getTableRoute(startDate, endDate);

  // Prepare date filters
  const startDay = startDate.toISOString().slice(0, 10); // YYYY-MM-DD for daily table
  const endDay = endDate.toISOString().slice(0, 10);

  let data: any[] | null = null;
  let error: any = null;

  // Execute query based on route
  if (route.table === 'hourly') {
    const resp = await supabase
      .from('telemetry_hourly')
      .select('ts_hour, device_id, metric, value_avg, value_min, value_max, sample_count')
      .in('device_id', params.device_ids)
      .in('metric', metricFilter)
      .gte('ts_hour', params.start)
      .lte('ts_hour', params.end)
      .order('ts_hour', { ascending: true });
    data = resp.data as any;
    error = resp.error;
  } else if (route.table === 'daily') {
    const resp = await supabase
      .from('telemetry_daily')
      .select('ts_day, device_id, metric, value_avg, value_min, value_max, sample_count')
      .in('device_id', params.device_ids)
      .in('metric', metricFilter)
      .gte('ts_day', startDay)
      .lte('ts_day', endDay)
      .order('ts_day', { ascending: true });
    data = resp.data as any;
    error = resp.error;
  } else {
    // Raw telemetry
    const resp = await supabase
      .from('telemetry')
      .select('ts, device_id, metric, value')
      .in('device_id', params.device_ids)
      .in('metric', metricFilter)
      .gte('ts', params.start)
      .lte('ts', params.end)
      .order('ts', { ascending: true });
    data = resp.data as any;
    error = resp.error;
  }

  if (error) {
    console.error(`Direct DB Timeseries fetch error (${route.source}):`, error);
    return null;
  }

  // FALLBACK: If aggregate tables return 0 rows, fall back to raw + client-side aggregation
  const hasNoRows = !data || data.length === 0;
  if (hasNoRows && route.table !== 'raw') {
    console.log(`[Timeseries] ${route.source} returned 0 rows, falling back to raw + client-side aggregation`);
    
    const rawResp = await supabase
      .from('telemetry')
      .select('ts, device_id, metric, value')
      .in('device_id', params.device_ids)
      .in('metric', metricFilter)
      .gte('ts', params.start)
      .lte('ts', params.end)
      .limit(50000)
      .order('ts', { ascending: true });

    if (rawResp.error) {
      console.error('Direct DB Timeseries raw fallback error:', rawResp.error);
      return null;
    }

    // Determine aggregation bucket based on route
    const aggBucket: '1h' | '1d' | '1M' = route.table === 'hourly' ? '1h' : '1d';
    const aggregated = aggregateRaw((rawResp.data as any[]) || [], aggBucket);

    return {
      data: aggregated,
      meta: {
        bucket: aggBucket,
        source: `telemetry(raw->client_agg:${aggBucket})`,
        start: params.start,
        end: params.end,
        point_count: aggregated.length,
      },
    };
  }

  // Map data to ApiTimeseriesPoint format based on source table
  const formattedData: ApiTimeseriesPoint[] = (data || []).map((row: any) => {
    if (route.table === 'hourly') {
      return {
        ts_bucket: row.ts_hour,
        device_id: row.device_id,
        metric: normalizeMetric(row.metric),
        value_avg: row.value_avg ?? 0,
        value_min: row.value_min ?? row.value_avg ?? 0,
        value_max: row.value_max ?? row.value_avg ?? 0,
        sample_count: row.sample_count ?? 0,
      };
    }
    
    if (route.table === 'daily') {
      // DATE -> ISO timestamp (midnight UTC) for consistent parsing in UI
      const dayIso = typeof row.ts_day === 'string' ? `${row.ts_day}T00:00:00.000Z` : row.ts_day;
      return {
        ts_bucket: dayIso,
        device_id: row.device_id,
        metric: normalizeMetric(row.metric),
        value_avg: row.value_avg ?? 0,
        value_min: row.value_min ?? row.value_avg ?? 0,
        value_max: row.value_max ?? row.value_avg ?? 0,
        sample_count: row.sample_count ?? 0,
      };
    }

    // Raw telemetry
    return {
      ts_bucket: row.ts,
      device_id: row.device_id,
      metric: normalizeMetric(row.metric),
      value_avg: row.value,
      value_min: row.value,
      value_max: row.value,
      sample_count: 1,
    };
  });

  // Determine actual bucket for metadata
  const actualBucket = route.table === 'hourly' ? '1h' : route.table === 'daily' ? '1d' : 'raw';

  return {
    data: formattedData,
    meta: {
      bucket: params.bucket || actualBucket,
      source: route.source,
      start: params.start,
      end: params.end,
      point_count: formattedData.length,
    },
  };
}

/**
 * Fetch ENERGY time-series data from dedicated energy tables
 * Uses energy_telemetry, energy_hourly, energy_daily for better performance
 * 
 * Same routing logic as fetchTimeseriesApi but uses energy-specific tables
 */
export async function fetchEnergyTimeseriesApi(params: {
  site_id?: string;
  device_ids?: string[];
  metrics: string[];
  start: string;
  end: string;
  bucket?: string;
}): Promise<ApiTimeseriesResponse | null> {
  if (!supabase) return null;

  // Energy metrics don't need the same expansion as IAQ
  const metricFilter = params.metrics;

  // Client-side aggregation for fallback scenarios
  const aggregateRaw = (
    rawRows: Array<{ ts: string; device_id: string; metric: string; value: number }>,
    targetBucket: '1h' | '1d' | '1M'
  ): ApiTimeseriesPoint[] => {
    const bucketIso = (tsIso: string) => {
      const d = new Date(tsIso);
      if (Number.isNaN(d.getTime())) return tsIso;

      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const h = String(d.getUTCHours()).padStart(2, '0');

      if (targetBucket === '1h') return `${y}-${m}-${day}T${h}:00:00.000Z`;
      if (targetBucket === '1M') return `${y}-${m}-01T00:00:00.000Z`;
      return `${y}-${m}-${day}T00:00:00.000Z`;
    };

    type Agg = {
      ts_bucket: string;
      device_id: string;
      metric: string;
      sum: number;
      min: number;
      max: number;
      count: number;
    };

    const map = new Map<string, Agg>();

    for (const r of rawRows) {
      const ts_bucket = bucketIso(r.ts);
      const key = `${ts_bucket}|${r.device_id}|${r.metric}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          ts_bucket,
          device_id: r.device_id,
          metric: r.metric,
          sum: r.value,
          min: r.value,
          max: r.value,
          count: 1,
        });
      } else {
        prev.sum += r.value;
        prev.count += 1;
        if (r.value < prev.min) prev.min = r.value;
        if (r.value > prev.max) prev.max = r.value;
      }
    }

    return Array.from(map.values())
      .map((a) => ({
        ts_bucket: a.ts_bucket,
        ts: a.ts_bucket,
        device_id: a.device_id,
        metric: a.metric,
        value_avg: a.count ? a.sum / a.count : 0,
        value_sum: a.sum, // ENERGIA TOTALE: somma dei valori nel bucket
        value: a.sum, // Helper per il frontend
        value_min: a.min,
        value_max: a.max,
        sample_count: a.count,
      }))
      .sort((a, b) => (a.ts_bucket < b.ts_bucket ? -1 : a.ts_bucket > b.ts_bucket ? 1 : 0));
  };

  // Parse dates and determine optimal table routing
  const startDate = new Date(params.start);
  const endDate = new Date(params.end);
  const route = getTableRoute(startDate, endDate);

  // Prepare date filters
  const startDay = startDate.toISOString().slice(0, 10);
  const endDay = endDate.toISOString().slice(0, 10);

  let data: any[] | null = null;
  let error: any = null;

  // Build base filter (site_id OR device_ids)
  const buildQuery = (baseQuery: any) => {
    if (params.device_ids && params.device_ids.length > 0) {
      baseQuery = baseQuery.in('device_id', params.device_ids);
    } else if (params.site_id) {
      baseQuery = baseQuery.eq('site_id', params.site_id);
    }
    return baseQuery.in('metric', metricFilter);
  };

  // Execute query based on route - use ENERGY-specific tables
  // IMPORTANTE: Includiamo value_sum per l'energia (kWh totali per bucket)
  if (route.table === 'hourly') {
    let query = supabase
      .from('energy_hourly')
      // NOTE: some deployments don't have value_sum on energy_hourly; keep hourly stable on value_avg.
      .select('ts_hour, device_id, metric, value_avg, value_min, value_max, sample_count')
      .gte('ts_hour', params.start)
      .lte('ts_hour', params.end)
      .order('ts_hour', { ascending: true });
    
    query = buildQuery(query);
    const resp = await query;
    data = resp.data as any;
    error = resp.error;
  } else if (route.table === 'daily') {
    let query = supabase
      .from('energy_daily')
      .select('ts_day, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count')
      .gte('ts_day', startDay)
      .lte('ts_day', endDay)
      .order('ts_day', { ascending: true });
    
    query = buildQuery(query);
    const resp = await query;
    data = resp.data as any;
    error = resp.error;
  } else {
    // Raw energy telemetry
    let query = supabase
      .from('energy_telemetry')
      .select('ts, device_id, metric, value')
      .gte('ts', params.start)
      .lte('ts', params.end)
      .order('ts', { ascending: true });
    
    query = buildQuery(query);
    const resp = await query;
    data = resp.data as any;
    error = resp.error;
  }

  if (error) {
    console.error(`Energy Timeseries fetch error (${route.source}):`, error);
    // Fallback to generic telemetry tables
    console.log('[Energy] Falling back to generic telemetry tables');
    return fetchTimeseriesApi({
      device_ids: params.device_ids || [],
      metrics: params.metrics,
      start: params.start,
      end: params.end,
      bucket: params.bucket,
    });
  }

  // FALLBACK: If energy tables return 0 rows, try raw + client-side aggregation
  const hasNoRows = !data || data.length === 0;
  if (hasNoRows && route.table !== 'raw') {
    console.log(`[Energy] ${route.source} returned 0 rows, trying raw energy_telemetry`);
    
    let rawQuery = supabase
      .from('energy_telemetry')
      .select('ts, device_id, metric, value')
      .gte('ts', params.start)
      .lte('ts', params.end)
      .limit(50000)
      .order('ts', { ascending: true });

    rawQuery = buildQuery(rawQuery);
    const rawResp = await rawQuery;

    if (rawResp.error || !rawResp.data || rawResp.data.length === 0) {
      // Final fallback: try generic telemetry tables
      console.log('[Energy] Falling back to generic telemetry tables');
      return fetchTimeseriesApi({
        device_ids: params.device_ids || [],
        metrics: params.metrics,
        start: params.start,
        end: params.end,
        bucket: params.bucket,
      });
    }

    // Determine aggregation bucket based on route
    const aggBucket: '1h' | '1d' | '1M' = route.table === 'hourly' ? '1h' : '1d';
    const aggregated = aggregateRaw((rawResp.data as any[]) || [], aggBucket);

    return {
      data: aggregated,
      meta: {
        bucket: aggBucket,
        source: `energy_telemetry(raw->client_agg:${aggBucket})`,
        start: params.start,
        end: params.end,
        point_count: aggregated.length,
      },
    };
  }

  // Map data to ApiTimeseriesPoint format
  // IMPORTANTE: Esponiamo value_sum per permettere la SOMMA dell'energia (kWh)
  const formattedData: ApiTimeseriesPoint[] = (data || []).map((row: any) => {
    const isRaw = route.table === 'raw';
    
    if (route.table === 'hourly') {
      return {
        ts_bucket: row.ts_hour,
        ts: row.ts_hour,
        device_id: row.device_id,
        metric: row.metric,
        value_avg: row.value_avg ?? 0,
        // keep shape stable for callers that read value_sum, but on hourly we use value_avg
        value_sum: row.value_avg ?? 0,
        value_min: row.value_min ?? row.value_avg ?? 0,
        value_max: row.value_max ?? row.value_avg ?? 0,
        sample_count: row.sample_count ?? 0,
        // Hourly: primary value is average
        value: row.value_avg ?? 0,
      };
    }
    
    if (route.table === 'daily') {
      const dayIso = typeof row.ts_day === 'string' ? `${row.ts_day}T00:00:00.000Z` : row.ts_day;
      return {
        ts_bucket: dayIso,
        ts: dayIso,
        device_id: row.device_id,
        metric: row.metric,
        value_avg: row.value_avg ?? 0,
        value_sum: row.value_sum ?? row.value_avg ?? 0, // ENERGIA TOTALE del bucket
        value_min: row.value_min ?? row.value_avg ?? 0,
        value_max: row.value_max ?? row.value_avg ?? 0,
        sample_count: row.sample_count ?? 0,
        // Helper: preferisci sempre value_sum per grafici energia
        value: row.value_sum ?? row.value_avg ?? 0,
      };
    }

    // Raw telemetry - value è già l'energia (integrale 15min)
    return {
      ts_bucket: row.ts,
      ts: row.ts,
      device_id: row.device_id,
      metric: row.metric,
      value: row.value,
      value_avg: row.value,
      value_sum: row.value, // Per raw, value è già l'energia del campione
      value_min: row.value,
      value_max: row.value,
      sample_count: 1,
    };
  });

  const actualBucket = route.table === 'hourly' ? '1h' : route.table === 'daily' ? '1d' : 'raw';

  return {
    data: formattedData,
    meta: {
      bucket: params.bucket || actualBucket,
      source: `energy_${route.source}`,
      start: params.start,
      end: params.end,
      point_count: formattedData.length,
    },
  };
}

/**
 * Fetch latest energy telemetry from dedicated energy_latest table
 */
export async function fetchEnergyLatestApi(params?: {
  site_id?: string;
  device_ids?: string[];
  metrics?: string[];
}): Promise<ApiLatestResponse | null> {
  if (!supabase) return null;

  let query = supabase
    .from('energy_latest')
    .select('device_id, site_id, metric, value, unit, ts, quality');

  if (params?.site_id) {
    query = query.eq('site_id', params.site_id);
  }
  if (params?.device_ids && params.device_ids.length > 0) {
    query = query.in('device_id', params.device_ids);
  }
  if (params?.metrics && params.metrics.length > 0) {
    query = query.in('metric', params.metrics);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Energy Latest fetch error:', error);
    // Fallback to generic telemetry_latest
    return fetchLatestApi(params);
  }

  // Transform to grouped format
  const groupedData: Record<string, ApiLatestTelemetry[]> = {};
  
  (data || []).forEach((row: any) => {
    if (!groupedData[row.device_id]) {
      groupedData[row.device_id] = [];
    }
    groupedData[row.device_id].push({
      device_id: row.device_id,
      metric: row.metric,
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
  energyTimeseries: (params: Record<string, unknown>) => ['energy-timeseries', params] as const,
  energyLatest: (params?: Record<string, unknown>) => ['energy-latest', params] as const,
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
 * Hook to fetch ENERGY time-series data from dedicated tables
 * Uses energy_telemetry, energy_hourly, energy_daily for better performance
 */
export function useEnergyTimeseries(
  params: Parameters<typeof fetchEnergyTimeseriesApi>[0],
  options?: Omit<UseQueryOptions<ApiTimeseriesResponse | null>, 'queryKey' | 'queryFn'>
) {
  const hasDevices = params.device_ids && params.device_ids.length > 0;
  const hasSite = !!params.site_id;
  
  return useQuery({
    queryKey: queryKeys.energyTimeseries(params),
    queryFn: () => fetchEnergyTimeseriesApi(params),
    enabled: isSupabaseConfigured && (hasDevices || hasSite),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

/**
 * Hook to fetch latest energy telemetry from dedicated table
 */
export function useEnergyLatest(
  params?: Parameters<typeof fetchEnergyLatestApi>[0],
  options?: Omit<UseQueryOptions<ApiLatestResponse | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.energyLatest(params),
    queryFn: () => fetchEnergyLatestApi(params),
    enabled: isSupabaseConfigured,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
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
