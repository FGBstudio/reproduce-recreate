// Edge Function: applies a per-site timestamp shift to energy tables.
// POST { site_id: string, shift_hours: number, fix_version: string }
// Uses direct Postgres connection to bypass PostgREST 8s timeout.

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { site_id, shift_hours, fix_version } = await req.json()
    if (!site_id || typeof shift_hours !== 'number' || !fix_version) {
      return new Response(
        JSON.stringify({ error: 'site_id, shift_hours (number) and fix_version required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    if (!dbUrl) throw new Error('SUPABASE_DB_URL not set')
    const sql = postgres(dbUrl, { max: 1, idle_timeout: 20, prepare: false })

    try {
      await sql`SET statement_timeout = 0`
      const interval = `${shift_hours} hours`
      const rows = await sql`
        SELECT * FROM public._shift_energy_site_timestamps(
          ${site_id}::uuid,
          ${interval}::interval,
          ${fix_version}::text
        )
      `
      await sql.end({ timeout: 5 })
      return new Response(
        JSON.stringify({ site_id, shift_hours, fix_version, status: 'completed', result: rows[0] ?? null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (e) {
      await sql.end({ timeout: 5 })
      throw e
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})