-- Fix column name mismatch in run_scheduled_jobs
-- The sync_telemetry_to_energy function returns (direct_synced, derived_from_power)
-- but run_scheduled_jobs references v_result.synced_direct (wrong name)

CREATE OR REPLACE FUNCTION public.run_scheduled_jobs()
 RETURNS TABLE(job_name text, status text, details jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result RECORD;
BEGIN
    -- 1. Materialize power metrics
    BEGIN
        SELECT * INTO v_result FROM materialize_power_metrics(now() - INTERVAL '1 hour');
        RETURN QUERY SELECT 'materialize_power'::TEXT, 'success'::TEXT, 
            jsonb_build_object('records_created', v_result.records_created);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'materialize_power'::TEXT, 'error'::TEXT, 
            jsonb_build_object('error', SQLERRM);
    END;
    
    -- 2. Sync telemetry to energy tables (FIXED: use correct column names)
    BEGIN
        SELECT * INTO v_result FROM sync_telemetry_to_energy(now() - INTERVAL '2 hours');
        RETURN QUERY SELECT 'sync_energy'::TEXT, 'success'::TEXT,
            jsonb_build_object('direct_synced', v_result.direct_synced, 'derived_from_power', v_result.derived_from_power);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'sync_energy'::TEXT, 'error'::TEXT,
            jsonb_build_object('error', SQLERRM);
    END;
    
    -- 3. Energy hourly aggregation
    BEGIN
        SELECT * INTO v_result FROM aggregate_energy_hourly();
        RETURN QUERY SELECT 'energy_hourly'::TEXT, 'success'::TEXT,
            jsonb_build_object('result', to_jsonb(v_result));
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'energy_hourly'::TEXT, 'error'::TEXT,
            jsonb_build_object('error', SQLERRM);
    END;
    
    -- 4. Hourly aggregation (general telemetry)
    BEGIN
        SELECT * INTO v_result FROM aggregate_telemetry_hourly(date_trunc('hour', now() - INTERVAL '1 hour'));
        RETURN QUERY SELECT 'hourly_aggregation'::TEXT, 'success'::TEXT,
            jsonb_build_object('processed', v_result.rows_processed, 'inserted', v_result.rows_inserted);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'hourly_aggregation'::TEXT, 'error'::TEXT,
            jsonb_build_object('error', SQLERRM);
    END;
    
    -- 5. Mark stale devices offline
    BEGIN
        PERFORM mark_stale_devices_offline(30);
        RETURN QUERY SELECT 'mark_stale_offline'::TEXT, 'success'::TEXT, '{}'::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'mark_stale_offline'::TEXT, 'error'::TEXT,
            jsonb_build_object('error', SQLERRM);
    END;
END;
$function$;