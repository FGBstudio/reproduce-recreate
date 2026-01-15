#!/usr/bin/env node
// =============================================================================
// External Cron Script for DB Aggregation Jobs
// =============================================================================
// Use this if Supabase pg_cron is not available or as backup.
// 
// Setup with system cron:
//   # Hourly aggregation (every hour at minute 5)
//   5 * * * * cd /path/to/mqtt-ingestion && node scripts/cron-jobs.js hourly
//   
//   # Daily aggregation (every day at 01:15)
//   15 1 * * * cd /path/to/mqtt-ingestion && node scripts/cron-jobs.js daily
//
// Or use node-cron for in-process scheduling (see bottom of file)
// =============================================================================

const https = require('https');
const http = require('http');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const jobType = process.argv[2] || 'hourly';

async function callScheduledJobs(job) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/scheduled-jobs?job=${job}`);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, ...result });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runDirectSQL(job) {
  // Alternative: call RPC directly instead of edge function
  const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/${job === 'daily' ? 'run_daily_jobs' : 'run_scheduled_jobs'}`);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
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
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write('{}');
    req.end();
  });
}

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Running ${jobType} job...`);

  try {
    // Try edge function first
    let result = await callScheduledJobs(jobType);
    
    // Fallback to direct RPC if edge function fails
    if (result.status >= 400) {
      console.log('Edge function failed, trying direct RPC...');
      result = await runDirectSQL(jobType);
    }

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Completed in ${duration}ms`);
    console.log(JSON.stringify(result, null, 2));

    process.exit(result.status < 400 ? 0 : 1);
  } catch (error) {
    console.error('Job failed:', error.message);
    process.exit(1);
  }
}

main();

// =============================================================================
// Alternative: In-process scheduling with node-cron
// =============================================================================
// Uncomment below to run as a daemon with built-in scheduling.
// Install: npm install node-cron
//
// const cron = require('node-cron');
//
// // Hourly at minute 5
// cron.schedule('5 * * * *', () => {
//   console.log('Running hourly aggregation...');
//   runDirectSQL('hourly').then(console.log).catch(console.error);
// });
//
// // Daily at 01:15
// cron.schedule('15 1 * * *', () => {
//   console.log('Running daily aggregation...');
//   runDirectSQL('daily').then(console.log).catch(console.error);
// });
//
// console.log('Cron scheduler started...');
