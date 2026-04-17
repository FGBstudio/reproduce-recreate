import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

const DEVICE_ID = '2740908b-f8c5-4414-a6da-f934351889a8';

async function run() {
    console.log(`--- INVESTIGATING DEVICE: ${DEVICE_ID} ---`);

    // 1. Get Device Details
    const { data: device, error: devError } = await supabase
        .from('devices')
        .select('*')
        .eq('id', DEVICE_ID)
        .single();

    if (devError) { console.error('Device fetch error:', devError); }
    else {
        console.log('Device Info:', device);
    }

    // 2. Check Energy Latest (The "Bad" Record)
    const { data: latest } = await supabase
        .from('energy_latest')
        .select('*')
        .eq('device_id', DEVICE_ID);

    console.log('\n[Energy Latest] Records:');
    latest?.forEach(r => console.log(r));

    // 3. Search Energy Telemetry for Future Dates
    // We'll look for anything after "Tomorrow"
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: futureData } = await supabase
        .from('energy_telemetry')
        .select('*')
        .eq('device_id', DEVICE_ID)
        .gt('ts', tomorrow.toISOString())
        .order('ts', { ascending: false })
        .limit(10);

    console.log('\n[Energy Telemetry] Future Records (> Tomorrow):');
    if (futureData && futureData.length > 0) {
        futureData.forEach(r => {
            console.log(`  ${r.ts} | ${r.metric} | ${r.value} | Labels: ${JSON.stringify(r.labels)}`);
        });
    } else {
        console.log('  None found. The bad data might have been deleted from telemetry but Stuck in latest?');
    }

    // 4. Check "Normal" recent data to see if it's working otherwise
    const { data: recentData } = await supabase
        .from('energy_telemetry')
        .select('*')
        .eq('device_id', DEVICE_ID)
        .lt('ts', new Date().toISOString())
        .order('ts', { ascending: false })
        .limit(5);

    console.log('\n[Energy Telemetry] Recent Valid Records:');
    recentData?.forEach(r => {
        console.log(`  ${r.ts} | ${r.metric} | ${r.value}`);
    });

}

run();
