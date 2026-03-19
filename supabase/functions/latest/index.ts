// Edge Function: GET /latest
// Returns latest telemetry values for devices (JWT-protected)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // --- AUTH: Validate JWT ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // --- Parse & validate params ---
    const url = new URL(req.url)
    const siteId = url.searchParams.get('site_id')
    const deviceIdsParam = url.searchParams.get('device_ids')
    const metricsParam = url.searchParams.get('metrics')

    if (!siteId && !deviceIdsParam) {
      return new Response(JSON.stringify({ error: 'Missing required parameter', details: 'Provide either site_id or device_ids' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (siteId && !isValidUUID(siteId)) {
      return new Response(JSON.stringify({ error: 'Invalid site_id format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let deviceIds: string[] = []
    if (deviceIdsParam) {
      deviceIds = deviceIdsParam.split(',').map(id => id.trim()).filter(Boolean)
      const invalidIds = deviceIds.filter(id => !isValidUUID(id))
      if (invalidIds.length > 0) {
        return new Response(JSON.stringify({ error: 'Invalid device_ids format', details: `Invalid UUIDs: ${invalidIds.join(', ')}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (deviceIds.length > 100) {
        return new Response(JSON.stringify({ error: 'Too many device_ids', details: 'Maximum 100' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    let metrics: string[] = []
    if (metricsParam) {
      metrics = metricsParam.split(',').map(m => m.trim()).filter(Boolean)
      if (metrics.length > 50) {
        return new Response(JSON.stringify({ error: 'Too many metrics', details: 'Maximum 50' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // --- Query using user-context client (RLS enforced) ---
    let query = userClient
      .from('telemetry_latest')
      .select(`
        device_id, metric, value, unit, ts, quality,
        devices!inner(id, device_id, model, site_id, name, location)
      `)

    if (siteId) query = query.eq('devices.site_id', siteId)
    if (deviceIds.length > 0) query = query.in('device_id', deviceIds)
    if (metrics.length > 0) query = query.in('metric', metrics)

    const { data, error } = await query
    if (error) throw error

    // Group by device
    const grouped = (data || []).reduce((acc, row) => {
      const deviceKey = row.device_id
      if (!acc[deviceKey]) {
        acc[deviceKey] = { device_id: row.device_id, device_info: row.devices, metrics: {} }
      }
      acc[deviceKey].metrics[row.metric] = {
        value: row.value, unit: row.unit, ts: row.ts, quality: row.quality
      }
      return acc
    }, {} as Record<string, any>)

    return new Response(JSON.stringify({
      data: Object.values(grouped),
      meta: { device_count: Object.keys(grouped).length, metric_count: data?.length || 0 }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Latest function error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
