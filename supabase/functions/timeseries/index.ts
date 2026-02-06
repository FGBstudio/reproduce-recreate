// Edge Function: GET /timeseries
// Returns time-bucketed telemetry data with FORCED bucket selection based on time range
//
// Query params:
//   - metrics: string (required) - Comma-separated metric names (e.g., "iaq.co2,energy.power_kw")
//   - start: string (required if mode != latest) - ISO 8601 start timestamp
//   - end: string (required if mode != latest) - ISO 8601 end timestamp  
//   - mode: string (optional) - "auto" (default) | "latest" (for overview/instant values)
//   - device_ids: string (optional) - Comma-separated device UUIDs
//   - site_id: string (optional) - Site UUID for filtering
//   - bucket: string (optional) - IGNORED (kept for backwards compatibility, bucket is FORCED by range)
//   - fill: string (optional) - IGNORED
//
// FORCED bucket selection based on time range (bucket param is IGNORED):
//   - ≤24 hours: 15m granularity → raw tables
//   - >24h AND ≤30 days: 1h granularity → hourly tables
//   - >30 days: 1d granularity → daily tables
//
// Domain routing:
//   - ENERGY (metrics starting with "energy."): energy_telemetry, energy_hourly, energy_daily, energy_latest
//   - AIR (all other metrics): telemetry, telemetry_hourly, telemetry_daily, telemetry_latest
//
// IMPORTANT: Mixed domain requests are NOT allowed (except env.temperature with energy.*)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// =============================================================================
// Validation helpers
// =============================================================================

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

const isValidDateString = (str: string): boolean => {
  const date = new Date(str)
  return !isNaN(date.getTime())
}

// =============================================================================
// FORCED bucket selection based on time range
// The bucket parameter from the client is ALWAYS ignored
// =============================================================================

type ForcedBucket = '15m' | '1h' | '1d'

function getForcedBucket(start: Date, end: Date): ForcedBucket {
  const diffMs = end.getTime() - start.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  
  if (diffHours <= 24) return '15m'      // ≤24h: 15 minute granularity
  if (diffHours <= 24 * 32) return '1h' // ✅ ALLOW 31-DAY MONTHS  // >24h AND ≤30d: hourly granularity
  return '1d'                             // >30d: daily granularity
}

function bucketToInterval(bucket: ForcedBucket): string {
  switch (bucket) {
    case '15m': return '15 minutes'
    case '1h': return '1 hour'
    case '1d': return '1 day'
  }
}

// =============================================================================
// Domain detection
// =============================================================================

interface DomainInfo {
  isEnergy: boolean
  isAir: boolean
  domain: 'energy' | 'air' | 'mixed'
}

function detectDomain(metrics: string[]): DomainInfo {
  // Metrics starting with 'energy.' are energy domain
  const energyMetrics = metrics.filter(m => m.startsWith('energy.'))
  // Exception: env.temperature can be mixed with energy
  const allowedExceptions = ['env.temperature', 'env.humidity']
  const airMetrics = metrics.filter(m => !m.startsWith('energy.') && !allowedExceptions.includes(m))
  
  const isEnergy = energyMetrics.length > 0
  const isAir = airMetrics.length > 0
  
  // If we have both energy and non-exception air metrics, it's a mixed (invalid) request
  if (isEnergy && isAir) {
    return { isEnergy: true, isAir: true, domain: 'mixed' }
  }
  
  // If only energy (with or without exceptions), treat as energy
  if (isEnergy) {
    return { isEnergy: true, isAir: false, domain: 'energy' }
  }
  
  // Otherwise it's air
  return { isEnergy: false, isAir: true, domain: 'air' }
}

// =============================================================================
// Floor timestamps to boundary for aggregate queries
// =============================================================================

function floorToHour(date: Date): Date {
  const d = new Date(date)
  d.setUTCMinutes(0, 0, 0)
  return d
}

function floorToDay(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// =============================================================================
// Output type (normalized for frontend compatibility)
// =============================================================================

interface TimeseriesPoint {
  ts_bucket: string
  ts: string
  device_id: string
  site_id?: string | null
  metric: string
  value: number | null
  value_avg: number | null
  value_min?: number | null
  value_max?: number | null
  value_sum?: number | null
  sample_count?: number | null
  unit?: string | null
  quality?: string | null
  labels?: Record<string, unknown> | null
}

// =============================================================================
// Main handler
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Initialize Supabase client with auth header forwarding for RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {}
      }
    })

    // Parse query parameters
    const url = new URL(req.url)
    const metricsParam = url.searchParams.get('metrics')
    const startParam = url.searchParams.get('start')
    const endParam = url.searchParams.get('end')
    const modeParam = (url.searchParams.get('mode') || 'auto').toLowerCase()
    const deviceIdsParam = url.searchParams.get('device_ids')
    const siteIdParam = url.searchParams.get('site_id')
    // bucket param is ACCEPTED but IGNORED (for backwards compatibility)
    const _bucketParam = url.searchParams.get('bucket')

    // =========================================================================
    // MODE = LATEST (overview/instant values)
    // =========================================================================
    if (modeParam === 'latest') {
      // For latest mode, start/end are NOT required
      // But we need at least one filter (device_ids or site_id)
      const hasDeviceFilter = deviceIdsParam && deviceIdsParam.trim().length > 0
      const hasSiteFilter = siteIdParam && isValidUUID(siteIdParam)
      
      if (!hasDeviceFilter && !hasSiteFilter) {
        return new Response(JSON.stringify({ 
          error: 'At least one filter required: device_ids or site_id',
          details: 'For mode=latest, provide device_ids and/or site_id'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Parse device_ids if provided
      const deviceIds = hasDeviceFilter 
        ? deviceIdsParam!.split(',').map(id => id.trim()).filter(Boolean)
        : []
      
      // Validate device UUIDs
      const invalidIds = deviceIds.filter(id => !isValidUUID(id))
      if (invalidIds.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'Invalid device_ids format',
          details: `Invalid UUIDs: ${invalidIds.join(', ')}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Parse metrics (optional for latest - if not provided, get all)
      const metrics = metricsParam 
        ? metricsParam.split(',').map(m => m.trim()).filter(Boolean)
        : []

      // Detect domain
      const domainInfo = metrics.length > 0 ? detectDomain(metrics) : { isEnergy: false, isAir: true, domain: 'air' as const }
      
      // For energy domain, use energy_latest; for air, use telemetry_latest
      const tableName = domainInfo.domain === 'energy' ? 'energy_latest' : 'telemetry_latest'
      
      let query = supabase
        .from(tableName)
        .select('device_id, site_id, metric, value, unit, ts, quality')
      
      // Apply filters
      if (deviceIds.length > 0) {
        query = query.in('device_id', deviceIds)
      }
      if (hasSiteFilter) {
        query = query.eq('site_id', siteIdParam)
      }
      if (metrics.length > 0) {
        query = query.in('metric', metrics)
      }

      const { data: latestData, error: latestError } = await query

      if (latestError) {
        console.error('Latest query error:', latestError)
        throw latestError
      }

      // Normalize output
      const data: TimeseriesPoint[] = (latestData || []).map((row: any) => ({
        ts_bucket: row.ts,
        ts: row.ts,
        device_id: row.device_id,
        site_id: row.site_id,
        metric: row.metric,
        value: row.value,
        value_avg: row.value,
        unit: row.unit,
        quality: row.quality,
      }))

      return new Response(JSON.stringify({
        data,
        meta: {
          mode: 'latest',
          domain: domainInfo.domain,
          source: tableName,
          point_count: data.length,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =========================================================================
    // MODE = AUTO (timeseries)
    // =========================================================================

    // Validate required params for timeseries mode
    const missingParams: string[] = []
    if (!metricsParam) missingParams.push('metrics')
    if (!startParam) missingParams.push('start')
    if (!endParam) missingParams.push('end')

    if (missingParams.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters',
        details: `Required: ${missingParams.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate filters: at least one of device_ids or site_id must be present
    const hasDeviceFilter = deviceIdsParam && deviceIdsParam.trim().length > 0
    const hasSiteFilter = siteIdParam && isValidUUID(siteIdParam)
    
    if (!hasDeviceFilter && !hasSiteFilter) {
      return new Response(JSON.stringify({ 
        error: 'At least one filter required: device_ids or site_id',
        details: 'Provide device_ids and/or site_id to filter results'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse and validate device_ids
    const deviceIds = hasDeviceFilter 
      ? deviceIdsParam!.split(',').map(id => id.trim()).filter(Boolean)
      : []
    
    const invalidIds = deviceIds.filter(id => !isValidUUID(id))
    if (invalidIds.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid device_ids format',
        details: `Invalid UUIDs: ${invalidIds.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (deviceIds.length > 50) {
      return new Response(JSON.stringify({ 
        error: 'Too many device_ids',
        details: 'Maximum 50 device_ids allowed per request'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse metrics
    const metrics = metricsParam!.split(',').map(m => m.trim()).filter(Boolean)
    if (metrics.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No valid metrics provided',
        details: 'metrics parameter must contain at least one metric'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (metrics.length > 20) {
      return new Response(JSON.stringify({ 
        error: 'Too many metrics',
        details: 'Maximum 20 metrics allowed per request'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate dates
    if (!isValidDateString(startParam!)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid start date',
        details: 'start must be a valid ISO 8601 date'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!isValidDateString(endParam!)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid end date',
        details: 'end must be a valid ISO 8601 date'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const start = new Date(startParam!)
    const end = new Date(endParam!)

    if (start >= end) {
      return new Response(JSON.stringify({ 
        error: 'Invalid date range',
        details: 'start must be before end'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Limit max range to 1 year
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000
    if (end.getTime() - start.getTime() > maxRangeMs) {
      return new Response(JSON.stringify({ 
        error: 'Date range too large',
        details: 'Maximum range is 1 year'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Detect domain
    const domainInfo = detectDomain(metrics)
    
    if (domainInfo.domain === 'mixed') {
      return new Response(JSON.stringify({ 
        error: 'Mixed domain request not allowed',
        details: 'Cannot mix energy metrics with non-env air metrics in a single request. Exception: env.temperature and env.humidity can be included with energy.*'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // FORCE bucket based on time range (ignore client bucket param)
    const forcedBucket = getForcedBucket(start, end)
    const bucketInterval = bucketToInterval(forcedBucket)

    // Determine table and source based on domain and bucket
    let tableName: string
    let tsColumn: string
    let source: string

    if (domainInfo.domain === 'energy') {
      switch (forcedBucket) {
        case '15m':
          tableName = 'energy_telemetry'
          tsColumn = 'ts'
          source = 'raw'
          break
        case '1h':
          tableName = 'energy_hourly'
          tsColumn = 'ts_hour'
          source = 'hourly'
          break
        case '1d':
          tableName = 'energy_daily'
          tsColumn = 'ts_day'
          source = 'daily'
          break
      }
    } else {
      // Air domain
      switch (forcedBucket) {
        case '15m':
          tableName = 'telemetry'
          tsColumn = 'ts'
          source = 'raw'
          break
        case '1h':
          tableName = 'telemetry_hourly'
          tsColumn = 'ts_hour'
          source = 'hourly'
          break
        case '1d':
          tableName = 'telemetry_daily'
          tsColumn = 'ts_day'
          source = 'daily'
          break
      }
    }

    // Prepare date boundaries for aggregate queries
    let queryStart: string
    let queryEnd: string
    
    if (forcedBucket === '15m') {
      // Raw: use exact timestamps
      queryStart = start.toISOString()
      queryEnd = end.toISOString()
    } else if (forcedBucket === '1h') {
      // Hourly: floor start to hour boundary
      queryStart = floorToHour(start).toISOString()
      queryEnd = end.toISOString()
    } else {
      // Daily: floor start to day boundary, use date only for end
      queryStart = floorToDay(start).toISOString()
      queryEnd = end.toISOString()
    }

    // Build and execute query
    let data: TimeseriesPoint[] = []

    // Select columns based on table type
    const selectColumns = forcedBucket === '15m'
      ? `${tsColumn}, device_id, site_id, metric, value, unit, quality, labels`
      : `${tsColumn}, device_id, site_id, metric, value_avg, value_min, value_max, ${forcedBucket === '1d' ? 'value_sum, ' : ''}sample_count, unit, labels`

    let query = supabase
      .from(tableName)
      .select(selectColumns)
      .in('metric', metrics)
      .gte(tsColumn, queryStart)
      .lt(tsColumn, queryEnd)
      .order(tsColumn, { ascending: true })

    // Apply device/site filters
    if (deviceIds.length > 0) {
      query = query.in('device_id', deviceIds)
    }
    if (hasSiteFilter) {
      query = query.eq('site_id', siteIdParam)
    }

    const { data: rawData, error: queryError } = await query

    if (queryError) {
      console.error(`Query error on ${tableName}:`, queryError)
      throw queryError
    }

    // Normalize output to standard format
    data = (rawData || []).map((row: any) => {
      const timestamp = row[tsColumn]
      const isRaw = forcedBucket === '15m'
      
      // For daily tables, ensure timestamp is ISO format
      let normalizedTs = timestamp
      if (forcedBucket === '1d' && typeof timestamp === 'string' && !timestamp.includes('T')) {
        normalizedTs = `${timestamp}T00:00:00.000Z`
      }

      if (isRaw) {
        // Raw table: value is the primary field
        return {
          ts_bucket: normalizedTs,
          ts: normalizedTs,
          device_id: row.device_id,
          site_id: row.site_id,
          metric: row.metric,
          value: row.value,
          value_avg: row.value,
          unit: row.unit,
          quality: row.quality,
          labels: row.labels,
        }
      } else {
        // Aggregate table: value_avg is primary, value_sum available for daily
        return {
          ts_bucket: normalizedTs,
          ts: normalizedTs,
          device_id: row.device_id,
          site_id: row.site_id,
          metric: row.metric,
          value: row.value_avg,
          value_avg: row.value_avg,
          value_min: row.value_min,
          value_max: row.value_max,
          value_sum: row.value_sum ?? null,
          sample_count: row.sample_count,
          unit: row.unit,
          labels: row.labels,
        }
      }
    })

    return new Response(JSON.stringify({
      data,
      meta: {
        metrics,
        start: start.toISOString(),
        end: end.toISOString(),
        bucket: forcedBucket,
        bucket_interval: bucketInterval,
        source,
        domain: domainInfo.domain,
        point_count: data.length,
        device_ids: deviceIds.length > 0 ? deviceIds : undefined,
        site_id: hasSiteFilter ? siteIdParam : undefined,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Timeseries function error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
