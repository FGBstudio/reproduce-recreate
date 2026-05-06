// Edge function: applies historical timezone fix for one site at a time.
// POST { site_id: string, tz: string }
// Uses service role to bypass HTTP migration timeouts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

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

    // Connect directly to Postgres to bypass PostgREST 8s timeout
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    if (!dbUrl) throw new Error('SUPABASE_DB_URL not set')
    const sql = postgres(dbUrl, { max: 1, idle_timeout: 20, prepare: false })

    let totalRows = 0
    const results: Array<{ device_id: string; rows: number; error?: string }> = []

    try {
      // Lift session-level statement_timeout
      await sql`SET statement_timeout = 0`

      for (const d of devices) {
        const did = (d as { device_id: string }).device_id
        try {
          const r = await sql`SELECT public._apply_tz_fix_device(${did}::uuid, ${tz}::text) AS rows`
          const n = Number((r as Array<{ rows: number }>)[0]?.rows ?? 0)
          totalRows += n
          results.push({ device_id: did, rows: n })
        } catch (e) {
          console.error(`device ${did} failed:`, e)
          results.push({ device_id: did, rows: 0, error: String(e) })
          await sql.end({ timeout: 5 })
          return new Response(JSON.stringify({
            site_id, status: 'partial_failure', processed: results, totalRows
          }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }
    } finally {
      // ensure we don't leak the connection
    }
    await sql.end({ timeout: 5 })

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
