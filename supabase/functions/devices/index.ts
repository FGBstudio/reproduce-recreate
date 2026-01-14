// Edge Function: GET /devices
// Returns list of devices with optional filtering

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const siteId = url.searchParams.get('site_id')
    const deviceType = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let query = supabase
      .from('devices')
      .select(`*, sites!inner(id, name, brand_id)`, { count: 'exact' })
      .order('last_seen', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (siteId) query = query.eq('site_id', siteId)
    if (deviceType) query = query.eq('device_type', deviceType)
    if (status) query = query.eq('status', status)

    const { data, error, count } = await query

    if (error) throw error

    return new Response(JSON.stringify({
      data,
      meta: { total: count, limit, offset }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
