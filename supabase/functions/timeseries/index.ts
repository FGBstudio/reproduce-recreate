// Edge Function: GET /timeseries
// Returns time-bucketed telemetry data

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
    const deviceIds = url.searchParams.get('device_ids')?.split(',')
    const metrics = url.searchParams.get('metrics')?.split(',')
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')
    const bucket = url.searchParams.get('bucket') // 1h, 1d, 1w, 1m

    if (!deviceIds?.length || !metrics?.length || !start || !end) {
      return new Response(JSON.stringify({ 
        error: 'Required: device_ids, metrics, start, end' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data, error } = await supabase.rpc('get_telemetry_timeseries', {
      p_device_ids: deviceIds,
      p_metrics: metrics,
      p_start: start,
      p_end: end,
      p_bucket: bucket
    })

    if (error) throw error

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
