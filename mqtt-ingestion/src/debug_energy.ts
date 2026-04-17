import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Load env from .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugEnergy() {
    console.log('--- Debugging Energy: Grand Gateway ---');
    const TARGET_SITE_ID = 'd93bbbd7-58b3-46fd-82d9-2cbee088b315'; // Grand Gateway

    // 1. Fetch Devices
    const { data: devices, error: devError } = await supabase
        .from('devices')
        .select('id, name, device_id, category, circuit_name, site_id')
        .eq('site_id', TARGET_SITE_ID);

    if (devError) {
        console.error('Error fetching devices:', devError);
        return;
    }

    const deviceMap = new Map();
    devices.forEach(d => {
        deviceMap.set(d.id, {
            category: d.category ? d.category.toLowerCase() : 'other',
            name: d.circuit_name || d.name || d.device_id,
            id: d.id
        });
    });
    console.log(`Loaded ${devices.length} devices for site.`);

    // 2. Fetch Energy Latest
    const { data: energyData, error: energyError } = await supabase
        .from('energy_latest')
        .select('*')
        .eq('site_id', TARGET_SITE_ID);

    if (energyError) {
        console.error('Error fetching energy_latest:', energyError);
        return;
    }

    console.log(`Loaded ${energyData.length} rows from energy_latest.`);

    let totalCard = 0;
    let totalGraphCandidate = 0;

    console.log('\n--- Details ---');
    energyData.forEach(r => {
        if (!['energy.power_kw', 'energy.active_power', 'power'].includes(r.metric)) return;

        const val = Number(r.value);
        const info = deviceMap.get(r.device_id);

        // CARD LOGIC: Requires Info + Category
        let includedInCard = false;
        if (info && info.category === 'general') {
            totalCard += val;
            includedInCard = true;
        }

        // GRAPH LOGIC approximation:
        // (info && info.category === 'general') || (!info)
        let includedInGraph = false;
        if ((info && info.category === 'general') || !info) {
            totalGraphCandidate += val;
            includedInGraph = true;
        }

        console.log(`Device: ${info ? info.name : 'UNKNOWN'} (${r.device_id})`);
        console.log(`  Metric: ${r.metric}, Value: ${val} kW`);
        console.log(`  Category: ${info ? info.category : 'N/A'}`);
        console.log(`  Included in Card (General)? ${includedInCard}`);
        console.log(`  Included in Graph (General/Unknown)? ${includedInGraph}`);
        console.log(`  Timestamp: ${r.ts}`);
        console.log('---');
    });

    console.log(`\n=== SUMMARY ===`);
    console.log(`Card Total (Strict 'general'): ${totalCard.toFixed(4)} kW`);
    console.log(`Graph Candidate Total (General + Unknown): ${totalGraphCandidate.toFixed(4)} kW`);
}

debugEnergy();
