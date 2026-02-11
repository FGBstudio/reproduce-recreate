// Edge Function: GET /devices
// Returns list of devices with optional filtering
// 
// Query params:
//   - site_id: UUID (optional) - Filter by site
//   - type: string (optional) - Filter by device_type
//   - status: string (optional) - Filter by status (online, offline, warning, error)
//   - model: string (optional) - Filter by model (WEEL, LEED, PAN12, MSCHN)
//   - limit: number (optional, default 100, max 500)
//   - offset: number (optional, default 0)
//
// Examples:
//   curl "https://PROJECT.supabase.co/functions/v1/devices?site_id=UUID"
//   curl "https://PROJECT.supabase.co/functions/v1/devices?type=air_quality&status=online"

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

const VALID_DEVICE_TYPES = ['air_quality', 'energy_monitor', 'water_meter', 'occupancy', 'hvac', 'lighting', 'other']
const VALID_STATUSES = ['online', 'offline', 'warning', 'error', 'maintenance']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow GET
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
    const deviceType = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const model = url.searchParams.get('model')
    const limitParam = url.searchParams.get('limit')
    const offsetParam = url.searchParams.get('offset')

    // Validate site_id if provided
    if (siteId && !isValidUUID(siteId)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid site_id format',
        details: 'site_id must be a valid UUID'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate device type
    if (deviceType && !VALID_DEVICE_TYPES.includes(deviceType)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid device type',
        details: `type must be one of: ${VALID_DEVICE_TYPES.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate status
    if (status && !VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid status',
        details: `status must be one of: ${VALID_STATUSES.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse and validate pagination
    const limit = Math.min(Math.max(1, parseInt(limitParam || '100')), 500)
    const offset = Math.max(0, parseInt(offsetParam || '0'))

    let query = supabase
      .from('devices')
      .select(`
        id,
        device_id,
        mac_address,
        model,
        device_type,
        name,
        location,
        status,
        last_seen,
        rssi_dbm,
        firmware_version,
        metadata,
        site_id,
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
      meta: { 
        total: count, 
        limit, 
        offset,
        has_more: (offset + limit) < (count || 0)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Devices function error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
