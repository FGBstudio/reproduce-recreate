// Edge Function: POST /geo-timezone
// Populates sites.timezone with IANA timezone strings based on lat/lng coordinates
// Uses a simplified timezone lookup algorithm based on coordinates

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// =============================================================================
// Timezone lookup from coordinates
// Uses a simplified geo-timezone approach based on longitude + known regions
// For production accuracy, this maps known lat/lng ranges to IANA timezones
// =============================================================================

interface TimezoneRule {
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
  tz: string
}

// Major timezone regions mapped by coordinate ranges
// Ordered from most specific to least specific
const TIMEZONE_RULES: TimezoneRule[] = [
  // === ASIA ===
  // China (all uses Asia/Shanghai)
  { latMin: 18, latMax: 54, lngMin: 73, lngMax: 135, tz: 'Asia/Shanghai' },
  // Japan
  { latMin: 24, latMax: 46, lngMin: 123, lngMax: 154, tz: 'Asia/Tokyo' },
  // South Korea
  { latMin: 33, latMax: 43, lngMin: 124, lngMax: 132, tz: 'Asia/Seoul' },
  // Malaysia / Singapore
  { latMin: -2, latMax: 8, lngMin: 99, lngMax: 120, tz: 'Asia/Kuala_Lumpur' },
  // Thailand
  { latMin: 5, latMax: 21, lngMin: 97, lngMax: 106, tz: 'Asia/Bangkok' },
  // India
  { latMin: 6, latMax: 36, lngMin: 68, lngMax: 98, tz: 'Asia/Kolkata' },
  // UAE / Dubai
  { latMin: 22, latMax: 27, lngMin: 51, lngMax: 57, tz: 'Asia/Dubai' },
  // Qatar / Doha
  { latMin: 24, latMax: 27, lngMin: 50, lngMax: 52, tz: 'Asia/Qatar' },
  // Saudi Arabia
  { latMin: 15, latMax: 33, lngMin: 34, lngMax: 56, tz: 'Asia/Riyadh' },
  // Hong Kong
  { latMin: 22, latMax: 23, lngMin: 113, lngMax: 115, tz: 'Asia/Hong_Kong' },
  // Taiwan
  { latMin: 21, latMax: 26, lngMin: 119, lngMax: 123, tz: 'Asia/Taipei' },

  // === EUROPE ===
  // UK
  { latMin: 49, latMax: 61, lngMin: -9, lngMax: 2, tz: 'Europe/London' },
  // Portugal
  { latMin: 36, latMax: 43, lngMin: -10, lngMax: -6, tz: 'Europe/Lisbon' },
  // Iceland
  { latMin: 63, latMax: 67, lngMin: -25, lngMax: -13, tz: 'Atlantic/Reykjavik' },
  // Italy
  { latMin: 36, latMax: 47, lngMin: 6, lngMax: 19, tz: 'Europe/Rome' },
  // France
  { latMin: 41, latMax: 51, lngMin: -5, lngMax: 9, tz: 'Europe/Paris' },
  // Germany
  { latMin: 47, latMax: 55, lngMin: 5, lngMax: 16, tz: 'Europe/Berlin' },
  // Spain
  { latMin: 35, latMax: 44, lngMin: -10, lngMax: 5, tz: 'Europe/Madrid' },
  // Netherlands / Belgium
  { latMin: 50, latMax: 54, lngMin: 3, lngMax: 8, tz: 'Europe/Amsterdam' },
  // Switzerland
  { latMin: 45, latMax: 48, lngMin: 5, lngMax: 11, tz: 'Europe/Zurich' },
  // Austria
  { latMin: 46, latMax: 49, lngMin: 9, lngMax: 17, tz: 'Europe/Vienna' },
  // Greece
  { latMin: 34, latMax: 42, lngMin: 19, lngMax: 30, tz: 'Europe/Athens' },
  // Turkey
  { latMin: 35, latMax: 43, lngMin: 25, lngMax: 45, tz: 'Europe/Istanbul' },
  // Sweden
  { latMin: 55, latMax: 70, lngMin: 10, lngMax: 25, tz: 'Europe/Stockholm' },
  // Poland
  { latMin: 49, latMax: 55, lngMin: 14, lngMax: 25, tz: 'Europe/Warsaw' },
  // Czech Republic
  { latMin: 48, latMax: 52, lngMin: 12, lngMax: 19, tz: 'Europe/Prague' },
  // Russia (Moscow)
  { latMin: 50, latMax: 70, lngMin: 30, lngMax: 60, tz: 'Europe/Moscow' },

  // === AMERICAS ===
  // US Eastern
  { latMin: 24, latMax: 48, lngMin: -85, lngMax: -66, tz: 'America/New_York' },
  // US Central
  { latMin: 25, latMax: 50, lngMin: -105, lngMax: -85, tz: 'America/Chicago' },
  // US Mountain
  { latMin: 25, latMax: 50, lngMin: -115, lngMax: -105, tz: 'America/Denver' },
  // US Pacific
  { latMin: 32, latMax: 50, lngMin: -125, lngMax: -115, tz: 'America/Los_Angeles' },
  // US Arizona (no DST)
  { latMin: 31, latMax: 37, lngMin: -115, lngMax: -109, tz: 'America/Phoenix' },
  // US Hawaii
  { latMin: 18, latMax: 23, lngMin: -161, lngMax: -154, tz: 'Pacific/Honolulu' },
  // Canada Eastern
  { latMin: 42, latMax: 62, lngMin: -80, lngMax: -60, tz: 'America/Toronto' },
  // Mexico City
  { latMin: 14, latMax: 24, lngMin: -106, lngMax: -86, tz: 'America/Mexico_City' },
  // Brazil (São Paulo)
  { latMin: -34, latMax: -5, lngMin: -53, lngMax: -34, tz: 'America/Sao_Paulo' },
  // Argentina
  { latMin: -55, latMax: -22, lngMin: -74, lngMax: -53, tz: 'America/Argentina/Buenos_Aires' },
  // Chile
  { latMin: -56, latMax: -17, lngMin: -76, lngMax: -66, tz: 'America/Santiago' },
  // Colombia
  { latMin: -5, latMax: 14, lngMin: -80, lngMax: -66, tz: 'America/Bogota' },

  // === OCEANIA ===
  // Australia East
  { latMin: -44, latMax: -10, lngMin: 140, lngMax: 155, tz: 'Australia/Sydney' },
  // Australia West
  { latMin: -36, latMax: -10, lngMin: 112, lngMax: 130, tz: 'Australia/Perth' },
  // New Zealand
  { latMin: -48, latMax: -34, lngMin: 165, lngMax: 179, tz: 'Pacific/Auckland' },

  // === AFRICA ===
  // South Africa
  { latMin: -35, latMax: -22, lngMin: 16, lngMax: 33, tz: 'Africa/Johannesburg' },
  // Egypt
  { latMin: 22, latMax: 32, lngMin: 24, lngMax: 37, tz: 'Africa/Cairo' },
  // Morocco
  { latMin: 27, latMax: 36, lngMin: -13, lngMax: -1, tz: 'Africa/Casablanca' },
  // Nigeria
  { latMin: 4, latMax: 14, lngMin: 2, lngMax: 15, tz: 'Africa/Lagos' },
  // Kenya
  { latMin: -5, latMax: 5, lngMin: 33, lngMax: 42, tz: 'Africa/Nairobi' },
]

function lookupTimezone(lat: number, lng: number): string {
  // Check specific rules first
  for (const rule of TIMEZONE_RULES) {
    if (lat >= rule.latMin && lat <= rule.latMax && lng >= rule.lngMin && lng <= rule.lngMax) {
      return rule.tz
    }
  }

  // Fallback: estimate timezone from longitude
  // Each timezone is roughly 15 degrees of longitude wide
  const offsetHours = Math.round(lng / 15)
  
  // Map common offsets to IANA zones
  const offsetMap: Record<number, string> = {
    '-12': 'Etc/GMT+12',
    '-11': 'Pacific/Midway',
    '-10': 'Pacific/Honolulu',
    '-9': 'America/Anchorage',
    '-8': 'America/Los_Angeles',
    '-7': 'America/Denver',
    '-6': 'America/Chicago',
    '-5': 'America/New_York',
    '-4': 'America/Halifax',
    '-3': 'America/Sao_Paulo',
    '-2': 'Atlantic/South_Georgia',
    '-1': 'Atlantic/Azores',
    '0': 'Europe/London',
    '1': 'Europe/Paris',
    '2': 'Europe/Helsinki',
    '3': 'Europe/Moscow',
    '4': 'Asia/Dubai',
    '5': 'Asia/Karachi',
    '6': 'Asia/Dhaka',
    '7': 'Asia/Bangkok',
    '8': 'Asia/Shanghai',
    '9': 'Asia/Tokyo',
    '10': 'Australia/Sydney',
    '11': 'Pacific/Noumea',
    '12': 'Pacific/Auckland',
  }

  return offsetMap[String(offsetHours)] || 'UTC'
}

// Validate that a string looks like a valid IANA timezone
function isValidIANA(tz: string): boolean {
  if (!tz || tz === 'UTC') return true
  // Must contain a slash and no "UTC+" pattern
  if (tz.startsWith('UTC+') || tz.startsWith('UTC-')) return false
  if (tz.startsWith('GMT+') || tz.startsWith('GMT-')) return false
  // Basic IANA format: Region/City
  return /^[A-Za-z]+\/[A-Za-z_]+/.test(tz)
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse optional body for filtering
    let filter: { site_ids?: string[], force?: boolean } = {}
    try {
      const body = await req.json()
      filter = body || {}
    } catch {
      // No body = update all sites
    }

    // Fetch sites with coordinates
    let query = supabase
      .from('sites')
      .select('id, name, lat, lng, timezone')

    if (filter.site_ids?.length) {
      query = query.in('id', filter.site_ids)
    }

    const { data: sites, error: fetchError } = await query

    if (fetchError) throw fetchError

    const results: Array<{ id: string; name: string; old_tz: string; new_tz: string; updated: boolean }> = []
    let updatedCount = 0

    for (const site of sites || []) {
      const oldTz = site.timezone || 'UTC'
      const alreadyValid = isValidIANA(oldTz) && oldTz !== 'UTC'

      // Skip if already has valid IANA timezone (unless force=true)
      if (alreadyValid && !filter.force) {
        results.push({ id: site.id, name: site.name, old_tz: oldTz, new_tz: oldTz, updated: false })
        continue
      }

      // Need coordinates for lookup
      if (site.lat == null || site.lng == null) {
        results.push({ id: site.id, name: site.name, old_tz: oldTz, new_tz: oldTz, updated: false })
        continue
      }

      const newTz = lookupTimezone(Number(site.lat), Number(site.lng))

      // Update the site
      const { error: updateError } = await supabase
        .from('sites')
        .update({ timezone: newTz })
        .eq('id', site.id)

      if (updateError) {
        console.error(`Failed to update timezone for site ${site.name}:`, updateError)
        results.push({ id: site.id, name: site.name, old_tz: oldTz, new_tz: newTz, updated: false })
      } else {
        updatedCount++
        results.push({ id: site.id, name: site.name, old_tz: oldTz, new_tz: newTz, updated: true })
      }
    }

    return new Response(JSON.stringify({
      message: `Updated ${updatedCount} of ${sites?.length || 0} sites`,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('geo-timezone error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
