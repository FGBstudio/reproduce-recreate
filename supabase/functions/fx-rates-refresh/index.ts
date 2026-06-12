import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPPORTED = ['EUR','USD','GBP','CHF','JPY','CNY','AUD','CAD','SEK','NOK','DKK','PLN','AED','SGD','HKD']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = `https://api.frankfurter.app/latest?from=EUR&to=${SUPPORTED.filter(c => c !== 'EUR').join(',')}`
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Frankfurter HTTP ${resp.status}`)
    const json = await resp.json() as { rates: Record<string, number> }
    const rates = json.rates || {}

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const rows = [
      { base: 'EUR', quote: 'EUR', rate: 1, fetched_at: new Date().toISOString() },
      ...Object.entries(rates).map(([quote, rate]) => ({
        base: 'EUR', quote, rate, fetched_at: new Date().toISOString(),
      })),
    ]

    const { error } = await supabase.from('fx_rates').upsert(rows, { onConflict: 'base,quote' })
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, updated: rows.length, rates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('fx-rates-refresh error', e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})