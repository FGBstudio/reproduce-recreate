import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

const SITE_ID = 'd93bbbd7-58b3-46fd-82d9-2cbee088b315'; // Grand Gateway

async function run() {
    console.log('--- DEBUG: Grand Gateway Energy Data (24h) ---');

    // 1. Get Devices
    const { data: devices } = await supabase.from('devices').select('id, name, category, device_id').eq('site_id', SITE_ID);
    const deviceMap = new Map((devices || []).map(d => [d.id, d]));

    console.log(`Found ${devices?.length} devices.`);

    // 2. Fetch Card Value (energy_latest)
    const { data: latest } = await supabase.from('energy_latest')
        .select('*')
        .eq('site_id', SITE_ID)
        .in('metric', ['energy.power_kw', 'power', 'energy.active_power']);

    let cardTotal = 0;
    latest?.forEach(r => {
        const d = deviceMap.get(r.device_id);
        if (d && d.category?.toLowerCase() === 'general') {
            cardTotal += Number(r.value);
        }
    });
    console.log(`\n[CARD] energy_latest Total (General): ${cardTotal.toFixed(4)} kW`);


    // 3. Fetch Graph Data (energy_telemetry - Raw) for last 24 hours
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: telemetry } = await supabase.from('energy_telemetry')
        .select('ts, device_id, metric, value')
        .eq('site_id', SITE_ID)
        .in('device_id', devices?.map(d => d.id) || [])
        .gte('ts', start)
        .in('metric', ['energy.power_kw', 'power', 'energy.active_power'])
        .order('ts', { ascending: true });

    console.log(`\n[GRAPH RAW] energy_telemetry (Last 24h, ${telemetry?.length} rows)`);

    const rawBuckets = new Map<string, number>();
    telemetry?.forEach(r => {
        const d = deviceMap.get(r.device_id);
        if (d && d.category?.toLowerCase() === 'general') {
            const key = r.ts;
            rawBuckets.set(key, (rawBuckets.get(key) || 0) + Number(r.value));
        }
    });

    // Calculate Stats
    let maxVal = 0;
    let maxTs = '';
    let minVal = 999999;
    let minTs = '';
    const sortedRawKeys = Array.from(rawBuckets.keys()).sort();

    sortedRawKeys.forEach(k => {
        const val = rawBuckets.get(k) || 0;
        if (val > maxVal) { maxVal = val; maxTs = k; }
        if (val < minVal) { minVal = val; minTs = k; }
    });

    console.log(`Min Value: ${minVal.toFixed(4)} kW at ${minTs}`);
    console.log(`Max Value: ${maxVal.toFixed(4)} kW at ${maxTs}`);

    // Print last 5 buckets
    console.log('Last 5 data points:');
    sortedRawKeys.slice(-5).forEach(k => {
        console.log(`  ${k}: ${rawBuckets.get(k)?.toFixed(4)} kW`);
    });
}

run();
