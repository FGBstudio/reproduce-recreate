
-- Fix sync_telemetry_to_energy to derive kWh from energy_telemetry (Virtual Meters)
-- The trigger now writes power_kw directly to energy_telemetry, not telemetry.
-- Step 2 must also scan energy_telemetry for power_kw to derive active_energy.

CREATE OR REPLACE FUNCTION public.sync_telemetry_to_energy(p_since timestamp with time zone DEFAULT (now() - '01:00:00'::interval))
 RETURNS TABLE(direct_synced bigint, derived_from_power bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_direct BIGINT := 0;
    v_derived BIGINT := 0;
    v_derived_virt BIGINT := 0;
BEGIN
    -- 1. Direct sync: energy.active_energy from telemetry to energy_telemetry
    WITH direct AS (
        INSERT INTO energy_telemetry (device_id, site_id, ts, metric, value, unit, quality, labels)
        SELECT t.device_id, t.site_id, t.ts, t.metric, t.value, t.unit,
               COALESCE(t.quality, 'good'), COALESCE(t.labels, '{}'::jsonb)
        FROM telemetry t
        WHERE t.ts >= p_since
          AND t.metric = 'energy.active_energy'
          AND NOT EXISTS (
              SELECT 1 FROM energy_telemetry et
              WHERE et.device_id = t.device_id AND et.ts = t.ts AND et.metric = t.metric
          )
        ON CONFLICT (device_id, ts, metric) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_direct FROM direct;

    -- 2. Derive energy from power_kw in TELEMETRY table (legacy physical devices)
    WITH pwr AS (
        SELECT t.device_id, t.site_id,
               date_trunc('minute', t.ts) - (EXTRACT(MINUTE FROM t.ts)::int % 15) * INTERVAL '1 minute' as ts_bucket,
               AVG(t.value) as kw
        FROM telemetry t
        WHERE t.ts >= p_since
          AND t.metric = 'energy.power_kw'
          AND t.value IS NOT NULL
        GROUP BY t.device_id, t.site_id, 3
    ),
    derived AS (
        INSERT INTO energy_telemetry (device_id, site_id, ts, metric, value, unit, quality, labels)
        SELECT p.device_id, p.site_id, p.ts_bucket,
               'energy.active_energy', p.kw * 0.25, 'kWh', 'computed',
               '{"source":"derived_from_power_kw"}'::jsonb
        FROM pwr p
        WHERE NOT EXISTS (
            SELECT 1 FROM energy_telemetry et
            WHERE et.device_id = p.device_id AND et.ts = p.ts_bucket
              AND et.metric = 'energy.active_energy' AND et.quality != 'computed'
        )
        ON CONFLICT (device_id, ts, metric) DO UPDATE SET
            value = EXCLUDED.value,
            labels = EXCLUDED.labels
        WHERE energy_telemetry.quality = 'computed'
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_derived FROM derived;

    -- 3. Derive energy from power_kw in ENERGY_TELEMETRY table (Virtual Meters)
    --    Virtual Meters write power_kw directly to energy_telemetry, not telemetry.
    WITH virt_pwr AS (
        SELECT et.device_id, et.site_id, et.ts as ts_bucket,
               et.value as kw
        FROM energy_telemetry et
        WHERE et.ts >= p_since
          AND et.metric = 'energy.power_kw'
          AND et.value IS NOT NULL
    ),
    virt_derived AS (
        INSERT INTO energy_telemetry (device_id, site_id, ts, metric, value, unit, quality, labels)
        SELECT vp.device_id, vp.site_id, vp.ts_bucket,
               'energy.active_energy', vp.kw * 0.25, 'kWh', 'computed',
               '{"source":"derived_from_virtual_meter_power_kw"}'::jsonb
        FROM virt_pwr vp
        WHERE NOT EXISTS (
            SELECT 1 FROM energy_telemetry et2
            WHERE et2.device_id = vp.device_id AND et2.ts = vp.ts_bucket
              AND et2.metric = 'energy.active_energy' AND et2.quality != 'computed'
        )
        ON CONFLICT (device_id, ts, metric) DO UPDATE SET
            value = EXCLUDED.value,
            labels = EXCLUDED.labels
        WHERE energy_telemetry.quality = 'computed'
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_derived_virt FROM virt_derived;

    RETURN QUERY SELECT v_direct, v_derived + v_derived_virt;
END;
$function$;
