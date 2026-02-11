// Edge Function: GET /latest
// Returns latest telemetry values for devices
//
// Query params:
//   - site_id: UUID (optional) - Get latest values for all devices in site
//   - device_ids: string (optional) - Comma-separated device UUIDs
//   - metrics: string (optional) - Comma-separated metric names (e.g., "iaq.co2,iaq.voc")
//
// Must provide either site_id or device_ids
//
// Examples:
//   curl "https://PROJECT.supabase.co/functions/v1/latest?site_id=UUID"
//   curl "https://PROJECT.supabase.co/functions/v1/latest?device_ids=UUID1,UUID2&metrics=iaq.co2,iaq.voc"

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

const isValidMetric = (str: string): boolean => {
  // Metric format: namespace.metric_name (e.g., iaq.co2, energy.power_kw)
  const metricRegex = /^[a-z]+\.[a-z0-9_]+$/i
  return metricRegex.test(str)
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const siteId = url.searchParams.get('site_id')
    const deviceIdsParam = url.searchParams.get('device_ids')
    const metricsParam = url.searchParams.get('metrics')

    // Validate: need at least site_id or device_ids
    if (!siteId && !deviceIdsParam) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameter',
        details: 'Provide either site_id or device_ids'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate site_id
    if (siteId && !isValidUUID(siteId)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid site_id format',
        details: 'site_id must be a valid UUID'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse and validate device_ids
    let deviceIds: string[] = []
    if (deviceIdsParam) {
      deviceIds = deviceIdsParam.split(',').map(id => id.trim()).filter(Boolean)
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
      if (deviceIds.length > 100) {
        return new Response(JSON.stringify({ 
          error: 'Too many device_ids',
          details: 'Maximum 100 device_ids allowed per request'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Parse and validate metrics
    let metrics: string[] = []
    if (metricsParam) {
      metrics = metricsParam.split(',').map(m => m.trim()).filter(Boolean)
      // Allow both old format (co2) and new format (iaq.co2) for backwards compat
      if (metrics.length > 50) {
        return new Response(JSON.stringify({ 
          error: 'Too many metrics',
          details: 'Maximum 50 metrics allowed per request'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Build query
    let query = supabase
      .from('telemetry_latest')
      .select(`
        device_id,
        metric,
        value,
        unit,
        ts,
        quality,
        devices!inner(id, device_id, model, site_id, name, location)
      `)

    // Filter by site (via devices join)
    if (siteId) {
      query = query.eq('devices.site_id', siteId)
    }

    // Filter by specific device_ids
    if (deviceIds.length > 0) {
      query = query.in('device_id', deviceIds)
    }

    // Filter by metrics
    if (metrics.length > 0) {
      query = query.in('metric', metrics)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by device for easier consumption
    const grouped = (data || []).reduce((acc, row) => {
      const deviceKey = row.device_id
      if (!acc[deviceKey]) {
        acc[deviceKey] = {
          device_id: row.device_id,
          device_info: row.devices,
          metrics: {}
        }
      }
      acc[deviceKey].metrics[row.metric] = {
        value: row.value,
        unit: row.unit,
        ts: row.ts,
        quality: row.quality
      }
      return acc
    }, {} as Record<string, any>)

    return new Response(JSON.stringify({ 
      data: Object.values(grouped),
      meta: {
        device_count: Object.keys(grouped).length,
        metric_count: data?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Latest function error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
