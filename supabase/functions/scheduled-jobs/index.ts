// Edge Function: Scheduled Jobs Runner
// Endpoint to trigger hourly/daily aggregation and maintenance jobs
//
// POST /scheduled-jobs?job=hourly|daily
// Authorization: Bearer <service_role_key>
//
// This should be called by:
// - Supabase pg_cron (if available)
// - External cron service
// - GitHub Actions scheduled workflow

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Verify authorization (service role required)
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Use service role for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const jobType = url.searchParams.get('job') || 'hourly'

    const results: { job: string; status: string; details: any }[] = []
    const startTime = Date.now()

    if (jobType === 'hourly' || jobType === 'all') {
      // Run hourly jobs (general telemetry)
      const { data, error } = await supabase.rpc('run_scheduled_jobs')
      
      if (error) {
        results.push({ job: 'hourly', status: 'error', details: error.message })
      } else {
        results.push({ job: 'hourly', status: 'success', details: data })
      }

      // Sync telemetry to energy tables (direct + derived from power)
      const { data: syncData, error: syncError } = await supabase.rpc('sync_telemetry_to_energy')
      
      if (syncError) {
        results.push({ job: 'energy_sync', status: 'error', details: syncError.message })
      } else {
        results.push({ job: 'energy_sync', status: 'success', details: syncData })
      }

      // Run energy hourly aggregation for the LAST 6 HOURS
      // This covers retroactive data uploaded every 3h that includes previous hours
      const now = new Date()
      for (let i = 1; i <= 6; i++) {
        const hourToAggregate = new Date(now)
        hourToAggregate.setMinutes(0, 0, 0)
        hourToAggregate.setHours(hourToAggregate.getHours() - i)
        const hourISO = hourToAggregate.toISOString()
        
        const { data: energyData, error: energyError } = await supabase.rpc('aggregate_energy_hourly', {
          p_hour: hourISO
        })
        
        if (energyError) {
          results.push({ job: `energy_hourly_h-${i}`, status: 'error', details: energyError.message })
        } else {
          results.push({ job: `energy_hourly_h-${i}`, status: 'success', details: energyData })
        }
      }
    }

    if (jobType === 'daily' || jobType === 'all') {
      // Run daily jobs (general telemetry)
      const { data, error } = await supabase.rpc('run_daily_jobs')
      
      if (error) {
        results.push({ job: 'daily', status: 'error', details: error.message })
      } else {
        results.push({ job: 'daily', status: 'success', details: data })
      }

      // Run energy daily aggregation for the LAST 3 DAYS
      // This covers retroactive data and ensures no gaps in daily aggregates
      for (let i = 0; i < 3; i++) {
        const dayToAggregate = new Date()
        dayToAggregate.setDate(dayToAggregate.getDate() - i)
        const dayISO = dayToAggregate.toISOString().split('T')[0] // YYYY-MM-DD
        
        const { data: energyData, error: energyError } = await supabase.rpc('aggregate_energy_daily', {
          p_date: dayISO
        })
        
        if (energyError) {
          results.push({ job: `energy_daily_d-${i}`, status: 'error', details: energyError.message })
        } else {
          results.push({ job: `energy_daily_d-${i}`, status: 'success', details: energyData })
        }
      }
    }

    if (jobType === 'power') {
      // Just run power materialization
      const { data, error } = await supabase.rpc('materialize_power_metrics')
      
      if (error) {
        results.push({ job: 'power', status: 'error', details: error.message })
      } else {
        results.push({ job: 'power', status: 'success', details: data })
      }
    }

    if (jobType === 'purge') {
      // Just run purge
      const { data, error } = await supabase.rpc('purge_old_telemetry', {
        p_raw_retention_days: 90,
        p_hourly_retention_days: 365,
        p_mqtt_raw_retention_days: 7
      })
      
      if (error) {
        results.push({ job: 'purge', status: 'error', details: error.message })
      } else {
        results.push({ job: 'purge', status: 'success', details: data })
      }
    }

    return new Response(JSON.stringify({
      success: results.every(r => r.status === 'success'),
      duration_ms: Date.now() - startTime,
      job_type: jobType,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Scheduled jobs error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})