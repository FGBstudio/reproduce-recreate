// Edge Function: GET /timeseries
// Returns time-bucketed telemetry data with auto-table selection
//
// Query params:
//   - device_ids: string (required) - Comma-separated device UUIDs
//   - metrics: string (required) - Comma-separated metric names (e.g., "iaq.co2,energy.power_kw")
//   - start: string (required) - ISO 8601 start timestamp
//   - end: string (required) - ISO 8601 end timestamp  
//   - bucket: string (optional) - Time bucket: "5m", "15m", "1h", "1d", "1w" (auto-selected if not provided)
//   - include_computed_power: boolean (optional) - Include computed power from I/V measurements
//
// Auto-selects optimal data source based on time range:
//   - <= 48 hours: raw telemetry
//   - <= 90 days: hourly aggregates
//   - > 90 days: daily aggregates
//
// Examples:
//   curl "https://PROJECT.supabase.co/functions/v1/timeseries?device_ids=UUID&metrics=iaq.co2&start=2025-01-01&end=2025-01-02"
//   curl "https://PROJECT.supabase.co/functions/v1/timeseries?device_ids=UUID&metrics=energy.power_kw&start=2025-01-01&end=2025-01-14&bucket=1h"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validation helpers
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

const isValidDateString = (str: string): boolean => {
  const date = new Date(str)
  return !isNaN(date.getTime())
}

const VALID_BUCKETS = ['15m', '30m', '1h', '6h', '1d', '1w', '1M']

// Convert bucket string to PostgreSQL interval
const bucketToInterval = (bucket: string): string => {
  const map: Record<string, string> = {
    '1m': '1 minute',
    '5m': '5 minutes',
    '15m': '15 minutes',
    '30m': '30 minutes',
    '1h': '1 hour',
    '6h': '6 hours',
    '1d': '1 day',
    '1w': '1 week',
    '1M': '1 month'
  }
  return map[bucket] || '1 hour'
}

// Auto-select bucket based on time range
const autoSelectBucket = (start: Date, end: Date): string => {
  const diffMs = end.getTime() - start.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours <= 24) return '15m'
  if (diffHours <= 24 * 30) return '1h'
  return '1d'
}

Deno.serve(async (req) => {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {}
      }
    })


    const url = new URL(req.url)
    const deviceIdsParam = url.searchParams.get('device_ids')
    const metricsParam = url.searchParams.get('metrics')
    const startParam = url.searchParams.get('start')
    const endParam = url.searchParams.get('end')
    const bucketParam = url.searchParams.get('bucket')
    const modeParam = (url.searchParams.get('mode') || 'auto').toLowerCase()
    const fillParam = (url.searchParams.get('fill') || 'null').toLowerCase()

    // Validate required params
    const missingParams = []
    if (!deviceIdsParam) missingParams.push('device_ids')
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

    // Parse and validate device_ids
    const deviceIds = deviceIdsParam!.split(',').map(id => id.trim()).filter(Boolean)
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

    // Validate bucket if provided
    if (bucketParam && !VALID_BUCKETS.includes(bucketParam)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid bucket',
        details: `bucket must be one of: ${VALID_BUCKETS.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Auto-select bucket
    const bucket = bucketParam || autoSelectBucket(start, end)
    const interval = bucketToInterval(bucket)

    // 1. DOMAIN DETECTION & DURATION
    const isEnergyRequest = metrics.some(m => m.startsWith('energy.'))
    const isWaterRequest = metrics.some(m => m.startsWith('water.'))
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

    let data: Array<{
      ts: string
      device_id: string
      metric: string
      value: number
      value_avg?: number
      value_min?: number
      value_max?: number
      sample_count?: number
    }> = []
    let source = 'raw'
    let effectiveBucket = bucket
    let effectiveInterval = interval

    // 2. DYNAMIC TABLE ROUTING

    if (isEnergyRequest) {
      // ===== ENERGY DOMAIN (energy_*) =====
      if (diffHours <= 24) {
        // RAW (≤24h) → energy_telemetry via RPC
        source = 'raw'
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_energy_timeseries', {
          p_device_ids: deviceIds,
          p_metrics: metrics,
          p_start: start.toISOString(),
          p_end: end.toISOString(),
          p_bucket: interval
        })
        if (rpcError) {
          console.error('Energy RPC error, falling back to direct query:', rpcError)
          // Fallback to direct query
          const { data: rawData, error: rawError } = await supabase
            .from('energy_telemetry')
            .select('ts, value, device_id, metric')
            .in('device_id', deviceIds)
            .in('metric', metrics)
            .gte('ts', start.toISOString())
            .lt('ts', end.toISOString())
            .order('ts', { ascending: true })
          if (rawError) throw rawError
          data = (rawData || []).map(d => ({
            ts: d.ts,
            value: d.value,
            device_id: d.device_id,
            metric: d.metric
          }))
        } else {
          data = rpcData || []
        }
      } else if (diffHours <= 24 * 30) {
        // HOURLY (>24h, ≤30d) → energy_hourly
        source = 'hourly'
        const { data: hourlyData, error: hourlyError } = await supabase
          .from('energy_hourly')
          .select('ts_hour, value_avg, value_min, value_max, sample_count, device_id, metric')
          .in('device_id', deviceIds)
          .in('metric', metrics)
          .gte('ts_hour', start.toISOString())
          .lte('ts_hour', end.toISOString())
          .order('ts_hour', { ascending: true })

        if (hourlyError) throw hourlyError
        data = (hourlyData || []).map(d => ({
          ts: d.ts_hour,
          value: d.value_avg,
          value_avg: d.value_avg,
          value_min: d.value_min,
          value_max: d.value_max,
          sample_count: d.sample_count,
          device_id: d.device_id,
          metric: d.metric
        }))
      } else {
        // DAILY (>30d) → energy_daily
        source = 'daily'
        const { data: dailyData, error: dailyError } = await supabase
          .from('energy_daily')
          .select('ts_day, value_avg, value_sum, value_min, value_max, sample_count, device_id, metric')
          .in('device_id', deviceIds)
          .in('metric', metrics)
          .gte('ts_day', start.toISOString())
          .lte('ts_day', end.toISOString())
          .order('ts_day', { ascending: true })

        if (dailyError) throw dailyError
        // For energy, use value_sum (kWh totals) for daily aggregation
        data = (dailyData || []).map(d => ({
          ts: d.ts_day,
          value: d.value_sum || d.value_avg,
          value_avg: d.value_avg,
          value_min: d.value_min,
          value_max: d.value_max,
          sample_count: d.sample_count,
          device_id: d.device_id,
          metric: d.metric
        }))
      }
    } else if (isWaterRequest) {
      // ===== WATER DOMAIN (water_*) - Future support =====
      if (diffHours <= 24) {
        source = 'raw'
        const { data: rawData, error: rawError } = await supabase
          .from('water_telemetry')
          .select('ts, value, device_id, metric')
          .in('device_id', deviceIds)
          .in('metric', metrics)
          .gte('ts', start.toISOString())
          .lt('ts', end.toISOString())
          .order('ts', { ascending: true })
        if (rawError) {
          console.warn('water_telemetry not found, falling back to telemetry:', rawError)
          // Fallback to standard telemetry
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('telemetry')
            .select('ts, value, device_id, metric')
            .in('device_id', deviceIds)
            .in('metric', metrics)
            .gte('ts', start.toISOString())
            .lt('ts', end.toISOString())
            .order('ts', { ascending: true })
          if (fallbackError) throw fallbackError
          data = fallbackData || []
        } else {
          data = rawData || []
        }
      } else if (diffHours <= 24 * 30) {
        source = 'hourly'
        const { data: hourlyData, error: hourlyError } = await supabase
          .from('water_hourly')
          .select('ts_hour, value_avg, value_min, value_max, sample_count, device_id, metric')
          .in('device_id', deviceIds)
          .in('metric', metrics)
          .gte('ts_hour', start.toISOString())
          .lte('ts_hour', end.toISOString())
          .order('ts_hour', { ascending: true })
        if (hourlyError) {
          console.warn('water_hourly not found, falling back to telemetry_hourly')
          // Fallback
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('telemetry_hourly')
            .select('ts_hour, value_avg, value_min, value_max, sample_count, device_id, metric')
            .in('device_id', deviceIds)
            .in('metric', metrics)
            .gte('ts_hour', start.toISOString())
            .lte('ts_hour', end.toISOString())
            .order('ts_hour', { ascending: true })
          if (fallbackError) throw fallbackError
          data = (fallbackData || []).map(d => ({
            ts: d.ts_hour,
            value: d.value_avg,
            value_avg: d.value_avg,
            value_min: d.value_min,
            value_max: d.value_max,
            sample_count: d.sample_count,
            device_id: d.device_id,
            metric: d.metric
          }))
        } else {
          data = (hourlyData || []).map(d => ({
            ts: d.ts_hour,
            value: d.value_avg,
            value_avg: d.value_avg,
            value_min: d.value_min,
            value_max: d.value_max,
            sample_count: d.sample_count,
            device_id: d.device_id,
            metric: d.metric
          }))
        }
      } else {
        source = 'daily'
        const { data: dailyData, error: dailyError } = await supabase
          .from('water_daily')
          .select('ts_day, value_avg, value_sum, value_min, value_max, sample_count, device_id, metric')
          .in('device_id', deviceIds)
          .in('metric', metrics)
          .gte('ts_day', start.toISOString())
          .lte('ts_day', end.toISOString())
          .order('ts_day', { ascending: true })
        if (dailyError) {
          console.warn('water_daily not found, falling back to telemetry_daily')
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('telemetry_daily')
            .select('ts_day, value_avg, value_min, value_max, sample_count, device_id, metric')
            .in('device_id', deviceIds)
            .in('metric', metrics)
            .gte('ts_day', start.toISOString())
            .lte('ts_day', end.toISOString())
            .order('ts_day', { ascending: true })
          if (fallbackError) throw fallbackError
          data = (fallbackData || []).map(d => ({
            ts: d.ts_day,
            value: d.value_avg,
            value_avg: d.value_avg,
            value_min: d.value_min,
            value_max: d.value_max,
            sample_count: d.sample_count,
            device_id: d.device_id,
            metric: d.metric
          }))
        } else {
          // For water, use value_sum (liters totals) for daily
          data = (dailyData || []).map(d => ({
            ts: d.ts_day,
            value: d.value_sum || d.value_avg,
            value_avg: d.value_avg,
            value_min: d.value_min,
            value_max: d.value_max,
            sample_count: d.sample_count,
            device_id: d.device_id,
            metric: d.metric
          }))
        }
      }
    } else {
      // ===== AIR / STANDARD DOMAIN (telemetry_*) =====
      if (diffHours <= 24) {
        // RAW (≤24h) → telemetry via RPC
        source = 'raw'
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_telemetry_timeseries', {
          p_device_ids: deviceIds,
          p_metrics: metrics,
          p_start: start.toISOString(),
          p_end: end.toISOString(),
          p_bucket: interval
        })
        if (rpcError) {
          console.error('Telemetry RPC error, falling back to direct query:', rpcError)
          const { data: rawData, error: rawError } = await supabase
            .from('telemetry')
            .select('ts, value, device_id, metric')
            .in('device_id', deviceIds)
            .in('metric', metrics)
            .gte('ts', start.toISOString())
            .lt('ts', end.toISOString())
            .order('ts', { ascending: true })
          if (rawError) throw rawError
          data = rawData || []
        } else {
          data = rpcData || []
        }
      } else if (diffHours <= 24 * 30) {
        // HOURLY (>24h, ≤30d) → telemetry_hourly
        source = 'hourly'
        const { data: hourlyData, error: hourlyError } = await supabase
          .from('telemetry_hourly')
          .select('ts_hour, value_avg, value_min, value_max, sample_count, device_id, metric')
          .in('device_id', deviceIds)
          .in('metric', metrics)
          .gte('ts_hour', start.toISOString())
          .lte('ts_hour', end.toISOString())
          .order('ts_hour', { ascending: true })

        if (hourlyError) throw hourlyError
        data = (hourlyData || []).map(d => ({
          ts: d.ts_hour,
          value: d.value_avg,
          value_avg: d.value_avg,
          value_min: d.value_min,
          value_max: d.value_max,
          sample_count: d.sample_count,
          device_id: d.device_id,
          metric: d.metric
        }))
      } else {
        // DAILY (>30d) → telemetry_daily
        source = 'daily'
        const { data: dailyData, error: dailyError } = await supabase
          .from('telemetry_daily')
          .select('ts_day, value_avg, value_min, value_max, sample_count, device_id, metric')
          .in('device_id', deviceIds)
          .in('metric', metrics)
          .gte('ts_day', start.toISOString())
          .lte('ts_day', end.toISOString())
          .order('ts_day', { ascending: true })

        if (dailyError) throw dailyError
        // For air quality, use value_avg (averages) for daily aggregation
        data = (dailyData || []).map(d => ({
          ts: d.ts_day,
          value: d.value_avg,
          value_avg: d.value_avg,
          value_min: d.value_min,
          value_max: d.value_max,
          sample_count: d.sample_count,
          device_id: d.device_id,
          metric: d.metric
        }))
      }
    }

    // Determine domain for metadata
    const domain = isEnergyRequest ? 'energy' : isWaterRequest ? 'water' : 'air'

    return new Response(JSON.stringify({ 
      data,
      meta: {
        device_ids: deviceIds,
        metrics,
        start: start.toISOString(),
        end: end.toISOString(),
        bucket,
        bucket_interval: interval,
        source,
        point_count: data.length,
        domain
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
