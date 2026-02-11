
-- Drop existing versions to avoid signature conflicts
DROP FUNCTION IF EXISTS sync_telemetry_to_energy(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS sync_telemetry_to_energy(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS sync_telemetry_to_energy();

-- Create the unified sync function
CREATE OR REPLACE FUNCTION sync_telemetry_to_energy(
    p_since TIMESTAMPTZ DEFAULT now() - INTERVAL '1 hour'
)
RETURNS TABLE (
    direct_synced BIGINT,
    derived_from_power BIGINT
) AS $$
DECLARE
    v_direct BIGINT := 0;
    v_derived BIGINT := 0;
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

    -- 2. Derive energy from power_kw (kWh = kW * 0.25 for 15-min buckets)
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

    RETURN QUERY SELECT v_direct, v_derived;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION sync_telemetry_to_energy(TIMESTAMPTZ) TO service_role;
COMMENT ON FUNCTION sync_telemetry_to_energy IS 'Sync energy data from telemetry to energy_telemetry, deriving from power_kw when needed';
