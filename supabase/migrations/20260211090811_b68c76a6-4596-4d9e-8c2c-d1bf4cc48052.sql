
-- Backfill aggregation for last 24h
DO $$
DECLARE
    h TIMESTAMPTZ;
    d DATE;
BEGIN
    -- Hourly aggregation
    FOR h IN SELECT generate_series(
        date_trunc('hour', now() - interval '24 hours'),
        date_trunc('hour', now() - interval '1 hour'),
        interval '1 hour'
    ) LOOP
        PERFORM aggregate_telemetry_hourly(h);
    END LOOP;
    
    -- Daily aggregation
    FOR d IN SELECT generate_series(
        CURRENT_DATE - 3,
        CURRENT_DATE - 1,
        interval '1 day'
    )::date LOOP
        PERFORM aggregate_telemetry_daily(d);
    END LOOP;
    
    -- Energy sync
    PERFORM sync_telemetry_to_energy(now() - interval '24 hours');
    
    -- Energy hourly
    FOR h IN SELECT generate_series(
        date_trunc('hour', now() - interval '24 hours'),
        date_trunc('hour', now() - interval '1 hour'),
        interval '1 hour'
    ) LOOP
        PERFORM aggregate_energy_hourly(h);
    END LOOP;
    
    -- Energy daily
    FOR d IN SELECT generate_series(
        CURRENT_DATE - 3,
        CURRENT_DATE - 1,
        interval '1 day'
    )::date LOOP
        PERFORM aggregate_energy_daily(d);
    END LOOP;
END $$;
