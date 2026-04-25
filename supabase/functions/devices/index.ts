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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // --- AuthN: estrarre l'identità SOLO dal JWT ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await userClient.auth.getUser(token)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const userId = userData.user.id

    // Service-role client SOLO per operazioni autorizzate dopo i check
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verifica admin
    const { data: isAdminFlag } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
    const isAdmin = !!isAdminFlag

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

    // --- AuthZ: il client NON decide cosa può vedere ---
    // 1. Se è stato richiesto un site_id specifico, verifica accesso server-side
    // 2. Altrimenti, restringi automaticamente ai siti accessibili
    let allowedSiteIds: string[] | null = null
    if (!isAdmin) {
      if (siteId) {
        const { data: canAccess, error: accessErr } = await supabase
          .rpc('can_access_site', { _user_id: userId, _site_id: siteId })
        if (accessErr || !canAccess) {
          return new Response(JSON.stringify({ error: 'Forbidden', details: 'No access to this site' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      } else {
        // Deriva la lista di siti accessibili dalle membership dell'utente
        const { data: memberships } = await supabase
          .from('user_memberships')
          .select('scope_type, scope_id')
          .eq('user_id', userId)
        const siteScopes = (memberships || []).filter(m => m.scope_type === 'site').map(m => m.scope_id)
        const brandScopes = (memberships || []).filter(m => m.scope_type === 'brand').map(m => m.scope_id)
        const holdingScopes = (memberships || []).filter(m => m.scope_type === 'holding').map(m => m.scope_id)

        const siteIdSet = new Set<string>(siteScopes)
        if (brandScopes.length > 0) {
          const { data: brandSites } = await supabase.from('sites').select('id').in('brand_id', brandScopes)
          ;(brandSites || []).forEach(s => siteIdSet.add(s.id as string))
        }
        if (holdingScopes.length > 0) {
          const { data: hBrands } = await supabase.from('brands').select('id').in('holding_id', holdingScopes)
          const brandIds = (hBrands || []).map(b => b.id as string)
          if (brandIds.length > 0) {
            const { data: hSites } = await supabase.from('sites').select('id').in('brand_id', brandIds)
            ;(hSites || []).forEach(s => siteIdSet.add(s.id as string))
          }
        }
        allowedSiteIds = Array.from(siteIdSet)
        if (allowedSiteIds.length === 0) {
          return new Response(JSON.stringify({ data: [], meta: { total: 0, limit, offset, has_more: false } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
    }

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

    if (siteId) {
      query = query.eq('site_id', siteId)
    } else if (allowedSiteIds) {
      query = query.in('site_id', allowedSiteIds)
    }
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
