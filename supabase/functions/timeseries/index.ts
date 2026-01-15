// Edge Function: GET /timeseries
// Returns time-bucketed telemetry data with auto-table selection
//
// Query params:
//   - device_ids: string (required) - Comma-separated device UUIDs
//   - metrics: string (required) - Comma-separated metric names (e.g., "iaq.co2,iaq.voc")
//   - start: string (required) - ISO 8601 start timestamp
//   - end: string (required) - ISO 8601 end timestamp  
//   - bucket: string (optional) - Time bucket: "5m", "15m", "1h", "1d", "1w" (auto-selected if not provided)
//
// Auto-selects optimal data source based on time range:
//   - <= 3 days: raw telemetry
//   - <= 60 days: hourly aggregates
//   - > 60 days: daily aggregates
//
// Examples:
//   curl "https://PROJECT.supabase.co/functions/v1/timeseries?device_ids=UUID&metrics=iaq.co2&start=2025-01-01&end=2025-01-13"
//   curl "https://PROJECT.supabase.co/functions/v1/timeseries?device_ids=UUID1,UUID2&metrics=energy.power_kw&start=2025-01-01T00:00:00Z&end=2025-01-01T12:00:00Z&bucket=15m"

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

const VALID_BUCKETS = ['1m', '5m', '15m', '30m', '1h', '6h', '1d', '1w', '1M']

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
  
  if (diffHours <= 6) return '5m'
  if (diffHours <= 24) return '15m'
  if (diffHours <= 72) return '1h'      // 3 days
  if (diffHours <= 336) return '1h'     // 14 days  
  if (diffHours <= 1440) return '1d'    // 60 days
  return '1w'
}

// Determine data source based on time range
const getOptimalSource = (start: Date, end: Date): 'raw' | 'hourly' | 'daily' => {
  const diffMs = end.getTime() - start.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  
  if (diffDays <= 3) return 'raw'
  if (diffDays <= 60) return 'hourly'
  return 'daily'
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
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const deviceIdsParam = url.searchParams.get('device_ids')
    const metricsParam = url.searchParams.get('metrics')
    const startParam = url.searchParams.get('start')
    const endParam = url.searchParams.get('end')
    const bucketParam = url.searchParams.get('bucket')

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

    // Auto-select bucket and source
    const bucket = bucketParam || autoSelectBucket(start, end)
    const source = getOptimalSource(start, end)
    const interval = bucketToInterval(bucket)

    // Call the database function
    const { data, error } = await supabase.rpc('get_telemetry_timeseries', {
      p_device_ids: deviceIds,
      p_metrics: metrics,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_bucket: interval
    })

    if (error) throw error

    return new Response(JSON.stringify({ 
      data: data || [],
      meta: {
        device_ids: deviceIds,
        metrics,
        start: start.toISOString(),
        end: end.toISOString(),
        bucket,
        bucket_interval: interval,
        source,
        point_count: data?.length || 0
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
