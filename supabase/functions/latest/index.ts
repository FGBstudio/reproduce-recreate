// Edge Function: GET /latest
// Returns latest telemetry values for devices

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
    const deviceId = url.searchParams.get('device_id')
    const siteId = url.searchParams.get('site_id')
    const metrics = url.searchParams.get('metrics')?.split(',')

    if (!deviceId && !siteId) {
      return new Response(JSON.stringify({ error: 'device_id or site_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let query = supabase
      .from('telemetry_latest')
      .select(`*, devices!inner(id, device_id, model, site_id)`)

    if (deviceId) query = query.eq('device_id', deviceId)
    if (siteId) query = query.eq('devices.site_id', siteId)
    if (metrics?.length) query = query.in('metric', metrics)

    const { data, error } = await query

    if (error) throw error

    return new Response(JSON.stringify({ data }), {
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
