#!/usr/bin/env node
// =============================================================================
// Energy Pipeline Backfill Script
// =============================================================================
// Processes historical telemetry data through the energy pipeline:
//   1. materialize_power_metrics  — I/V → kW
//   2. sync_telemetry_to_energy   — telemetry → energy_telemetry
//   3. aggregate_energy_hourly    — energy_telemetry → energy_hourly
//   4. aggregate_energy_daily     — energy_hourly → energy_daily
//
// Usage:
//   node scripts/backfill-energy.js                    # Auto-detect range
//   node scripts/backfill-energy.js 2026-02-01         # From date to now
//   node scripts/backfill-energy.js 2026-02-01 2026-03-01  # Specific range
//
// Env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

const https = require('https');
const http = require('http');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Set them in your .env or export them before running.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rpc(fnName, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`RPC ${fnName} HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function formatHour(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

function addHours(d, h) {
  return new Date(d.getTime() + h * 3600000);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function progressBar(current, total, width = 30) {
  const pct = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `[${bar}] ${pct}%`;
}

// ---------------------------------------------------------------------------
// Main backfill logic
// ---------------------------------------------------------------------------

async function backfill(startDate, endDate) {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          ENERGY PIPELINE BACKFILL                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`📅 Range: ${formatDate(startDate)} → ${formatDate(endDate)}`);
  console.log('');

  const totalDays = Math.ceil((endDate - startDate) / 86400000);
  let processedDays = 0;
  let totalStats = {
    power_materialized: 0,
    direct_synced: 0,
    derived_from_power: 0,
    hourly_inserted: 0,
    daily_inserted: 0,
    errors: [],
  };

  // Iterate day by day
  let current = new Date(startDate);

  while (current < endDate) {
    const dayStart = new Date(current);
    const dayEnd = addDays(dayStart, 1);
    const dayStr = formatDate(dayStart);
    processedDays++;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📆 Day ${processedDays}/${totalDays}: ${dayStr}  ${progressBar(processedDays, totalDays)}`);
    console.log(`${'─'.repeat(60)}`);

    // Step 1: Materialize power metrics (hour by hour within the day)
    let dayPowerCount = 0;
    for (let h = 0; h < 24; h++) {
      const hourStart = addHours(dayStart, h);
      try {
        const result = await rpc('materialize_power_metrics', {
          p_since: formatHour(hourStart),
        });
        const count = Array.isArray(result) && result[0]?.records_created
          ? result[0].records_created : 0;
        dayPowerCount += count;
      } catch (err) {
        totalStats.errors.push(`${dayStr} h${h} materialize: ${err.message}`);
      }
    }
    console.log(`  ⚡ materialize_power_metrics: ${dayPowerCount} records`);
    totalStats.power_materialized += dayPowerCount;

    // Step 2: Sync telemetry to energy (for the whole day)
    try {
      const result = await rpc('sync_telemetry_to_energy', {
        p_since: formatHour(dayStart),
      });
      const direct = Array.isArray(result) && result[0]?.direct_synced
        ? result[0].direct_synced : 0;
      const derived = Array.isArray(result) && result[0]?.derived_from_power
        ? result[0].derived_from_power : 0;
      totalStats.direct_synced += direct;
      totalStats.derived_from_power += derived;
      console.log(`  🔄 sync_telemetry_to_energy: ${direct} direct, ${derived} derived`);
    } catch (err) {
      console.log(`  ❌ sync_telemetry_to_energy: ${err.message}`);
      totalStats.errors.push(`${dayStr} sync: ${err.message}`);
    }

    // Step 3: Aggregate energy hourly (hour by hour)
    let dayHourlyCount = 0;
    for (let h = 0; h < 24; h++) {
      const hourTs = addHours(dayStart, h);
      try {
        const result = await rpc('aggregate_energy_hourly', {
          p_hour: formatHour(hourTs),
        });
        const inserted = Array.isArray(result) && result[0]?.rows_inserted
          ? result[0].rows_inserted : 0;
        dayHourlyCount += inserted;
      } catch (err) {
        // Some hours may have no data, that's fine
        if (!err.message.includes('no data')) {
          totalStats.errors.push(`${dayStr} h${h} hourly: ${err.message}`);
        }
      }
    }
    console.log(`  📊 aggregate_energy_hourly: ${dayHourlyCount} rows inserted`);
    totalStats.hourly_inserted += dayHourlyCount;

    // Step 4: Aggregate energy daily
    try {
      const result = await rpc('aggregate_energy_daily', {
        p_date: dayStr,
      });
      const inserted = Array.isArray(result) && result[0]?.rows_inserted
        ? result[0].rows_inserted : 0;
      totalStats.daily_inserted += inserted;
      console.log(`  📅 aggregate_energy_daily: ${inserted} rows inserted`);
    } catch (err) {
      console.log(`  ❌ aggregate_energy_daily: ${err.message}`);
      totalStats.errors.push(`${dayStr} daily: ${err.message}`);
    }

    current = dayEnd;
  }

  // Summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                   BACKFILL COMPLETE                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  📆 Days processed:        ${processedDays}`);
  console.log(`  ⚡ Power materialized:     ${totalStats.power_materialized}`);
  console.log(`  🔄 Direct synced:          ${totalStats.direct_synced}`);
  console.log(`  🔄 Derived from power:     ${totalStats.derived_from_power}`);
  console.log(`  📊 Hourly rows inserted:   ${totalStats.hourly_inserted}`);
  console.log(`  📅 Daily rows inserted:    ${totalStats.daily_inserted}`);

  if (totalStats.errors.length > 0) {
    console.log(`\n  ⚠️  Errors (${totalStats.errors.length}):`);
    totalStats.errors.forEach(e => console.log(`     - ${e}`));
  } else {
    console.log(`\n  ✅ No errors!`);
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  let startDate, endDate;

  if (args.length >= 2) {
    startDate = new Date(args[0] + 'T00:00:00Z');
    endDate = new Date(args[1] + 'T00:00:00Z');
  } else if (args.length === 1) {
    startDate = new Date(args[0] + 'T00:00:00Z');
    endDate = new Date();
  } else {
    // Auto-detect: start from earliest telemetry energy data
    console.log('🔍 Auto-detecting date range from telemetry...');
    try {
      // Default: last 45 days
      startDate = addDays(new Date(), -45);
      endDate = new Date();
      console.log(`   Using last 45 days: ${formatDate(startDate)} → ${formatDate(endDate)}`);
    } catch {
      startDate = addDays(new Date(), -30);
      endDate = new Date();
    }
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('❌ Invalid date format. Use YYYY-MM-DD');
    process.exit(1);
  }

  const startTime = Date.now();
  await backfill(startDate, endDate);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total time: ${elapsed}s`);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
