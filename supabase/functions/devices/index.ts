// Edge Function: GET /devices
// Returns list of devices with optional filtering (JWT-protected)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

const VALID_DEVICE_TYPES = ['air_quality', 'energy_monitor', 'water_meter', 'occupancy', 'hvac', 'lighting', 'other']
const VALID_STATUSES = ['online', 'offline', 'warning', 'error', 'maintenance']

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
    // --- AUTH: Validate JWT ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // User-context client: queries respect RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // --- Parse & validate query params ---
    const url = new URL(req.url)
    const siteId = url.searchParams.get('site_id')
    const deviceType = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const model = url.searchParams.get('model')
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')

    if (siteId && !isValidUUID(siteId)) {
      return new Response(JSON.stringify({ error: 'Invalid site_id format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (deviceType && !VALID_DEVICE_TYPES.includes(deviceType)) {
      return new Response(JSON.stringify({ error: 'Invalid device type', details: `type must be one of: ${VALID_DEVICE_TYPES.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status', details: `status must be one of: ${VALID_STATUSES.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const limit = Math.min(Math.max(1, parseInt(limitParam || '100')), 500)
    const offset = Math.max(0, parseInt(offsetParam || '0'))

    // --- Query using user-context client (RLS enforced) ---
    let query = userClient
      .from('devices')
      .select(`
        id, device_id, mac_address, model, device_type, name, location,
        status, last_seen, rssi_dbm, firmware_version, metadata, site_id,
        sites!inner(id, name, brand_id)
      `, { count: 'exact' })
      .order('last_seen', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (siteId) query = query.eq('site_id', siteId)
    if (deviceType) query = query.eq('device_type', deviceType)
    if (status) query = query.eq('status', status)
    if (model) query = query.ilike('model', `%${model}%`)

    const { data, error, count } = await query

    if (error) throw error

    return new Response(JSON.stringify({
      data,
      meta: { total: count, limit, offset, has_more: (offset + limit) < (count || 0) }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Devices function error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
