// Edge function: applies historical timezone fix for one site at a time.
// POST { site_id: string, tz: string }
// Uses service role to bypass HTTP migration timeouts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { site_id, tz } = await req.json()
    if (!site_id || !tz) {
      return new Response(JSON.stringify({ error: 'site_id and tz required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Call the SQL helper (already created by migration)
    const { data, error } = await supabase.rpc('_apply_tz_fix', {
      p_site_id: site_id,
      p_tz: tz,
    })

    if (error) {
      console.error('tz-fix error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ site_id, tz, result: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
