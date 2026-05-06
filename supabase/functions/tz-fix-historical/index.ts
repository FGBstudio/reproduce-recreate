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

    // Idempotency check
    const { data: existing } = await supabase
      .from('tz_fix_log')
      .select('id')
      .eq('site_id', site_id)
      .eq('fix_version', 'v1')
      .maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ site_id, status: 'already_applied' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // List devices via RPC
    const { data: devices, error: devErr } = await supabase
      .rpc('_tz_fix_list_devices', { p_site_id: site_id })
    if (devErr) throw devErr
    if (!devices || devices.length === 0) {
      return new Response(JSON.stringify({ site_id, status: 'no_devices' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let totalRows = 0
    const results: Array<{ device_id: string; rows: number; error?: string }> = []

    for (const d of devices) {
      const did = (d as { device_id: string }).device_id
      const { data: rows, error: fxErr } = await supabase
        .rpc('_apply_tz_fix_device', { p_device_id: did, p_tz: tz })
      if (fxErr) {
        console.error(`device ${did} failed:`, fxErr)
        results.push({ device_id: did, rows: 0, error: fxErr.message })
        // Stop on first error to avoid partial state
        return new Response(JSON.stringify({
          site_id, status: 'partial_failure', processed: results, totalRows
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const n = Number(rows ?? 0)
      totalRows += n
      results.push({ device_id: did, rows: n })
    }

    // Mark site as done
    await supabase.rpc('_tz_fix_mark_done', { p_site_id: site_id, p_rows: totalRows })

    return new Response(JSON.stringify({
      site_id, tz, status: 'completed', deviceCount: devices.length, totalRows, results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
