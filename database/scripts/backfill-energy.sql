-- =============================================================================
-- ENERGY PIPELINE BACKFILL — Supabase SQL Editor
-- =============================================================================
-- Esegue la pipeline energetica completa su dati storici:
--   1. materialize_power_metrics  — I/V → kW
--   2. sync_telemetry_to_energy   — telemetry → energy_telemetry
--   3. aggregate_energy_hourly    — energy_telemetry → energy_hourly
--   4. aggregate_energy_daily     — energy_hourly → energy_daily
--
-- ⚠️  ISTRUZIONI:
--   1. Modifica le date START/END qui sotto
--   2. Incolla tutto nel SQL Editor di Supabase
--   3. Esegui (potrebbe richiedere qualche minuto)
--
-- Le clausole ON CONFLICT nelle funzioni garantiscono l'idempotenza:
-- puoi rieseguire lo script senza duplicare dati.
-- =============================================================================

DO $$
DECLARE
  -- ═══════════════════════════════════════════
  -- ▼▼▼  CONFIGURA QUI LE DATE  ▼▼▼
  -- ═══════════════════════════════════════════
  v_start_date  DATE := '2026-02-01';   -- Data inizio backfill
  v_end_date    DATE := '2026-03-13';   -- Data fine backfill (esclusa)
  -- ═══════════════════════════════════════════

  v_current_day   DATE;
  v_hour          INT;
  v_hour_ts       TIMESTAMPTZ;
  v_day_start     TIMESTAMPTZ;

  -- Contatori globali
  v_total_power   BIGINT := 0;
  v_total_direct  BIGINT := 0;
  v_total_derived BIGINT := 0;
  v_total_hourly  BIGINT := 0;
  v_total_daily   BIGINT := 0;
  v_days_done     INT := 0;
  v_total_days    INT;
  v_errors        INT := 0;

  -- Risultati parziali
  v_power_result  RECORD;
  v_sync_result   RECORD;
  v_hourly_result RECORD;
  v_daily_result  RECORD;
  v_day_power     BIGINT;
  v_day_hourly    BIGINT;
BEGIN
  v_total_days := v_end_date - v_start_date;

  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '     ENERGY PIPELINE BACKFILL';
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE 'Range: % → %  (% giorni)', v_start_date, v_end_date, v_total_days;
  RAISE NOTICE '';

  v_current_day := v_start_date;

  WHILE v_current_day < v_end_date LOOP
    v_days_done := v_days_done + 1;
    v_day_start := v_current_day::TIMESTAMPTZ;
    v_day_power := 0;
    v_day_hourly := 0;

    RAISE NOTICE '──────────────────────────────────────────────';
    RAISE NOTICE 'Giorno %/% : %', v_days_done, v_total_days, v_current_day;
    RAISE NOTICE '──────────────────────────────────────────────';

    -- ═══════════════════════════════════════════
    -- STEP 1: materialize_power_metrics (ora per ora)
    -- ═══════════════════════════════════════════
    FOR v_hour IN 0..23 LOOP
      v_hour_ts := v_day_start + (v_hour || ' hours')::INTERVAL;
      BEGIN
        SELECT * INTO v_power_result
        FROM materialize_power_metrics(v_hour_ts);

        IF v_power_result.records_created IS NOT NULL THEN
          v_day_power := v_day_power + v_power_result.records_created;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE '  ⚠ materialize h%: %', v_hour, SQLERRM;
      END;
    END LOOP;

    v_total_power := v_total_power + v_day_power;
    RAISE NOTICE '  ⚡ materialize_power: % records', v_day_power;

    -- ═══════════════════════════════════════════
    -- STEP 2: sync_telemetry_to_energy (intero giorno)
    -- ═══════════════════════════════════════════
    BEGIN
      SELECT * INTO v_sync_result
      FROM sync_telemetry_to_energy(v_day_start);

      v_total_direct  := v_total_direct  + COALESCE(v_sync_result.direct_synced, 0);
      v_total_derived := v_total_derived + COALESCE(v_sync_result.derived_from_power, 0);
      RAISE NOTICE '  🔄 sync_energy: % direct, % derived',
        COALESCE(v_sync_result.direct_synced, 0),
        COALESCE(v_sync_result.derived_from_power, 0);
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE '  ⚠ sync_energy: %', SQLERRM;
    END;

    -- ═══════════════════════════════════════════
    -- STEP 3: aggregate_energy_hourly (ora per ora)
    -- ═══════════════════════════════════════════
    FOR v_hour IN 0..23 LOOP
      v_hour_ts := v_day_start + (v_hour || ' hours')::INTERVAL;
      BEGIN
        SELECT * INTO v_hourly_result
        FROM aggregate_energy_hourly(v_hour_ts);

        IF v_hourly_result.rows_inserted IS NOT NULL THEN
          v_day_hourly := v_day_hourly + v_hourly_result.rows_inserted;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%no data%' THEN
          v_errors := v_errors + 1;
          RAISE NOTICE '  ⚠ hourly h%: %', v_hour, SQLERRM;
        END IF;
      END;
    END LOOP;

    v_total_hourly := v_total_hourly + v_day_hourly;
    RAISE NOTICE '  📊 hourly: % rows', v_day_hourly;

    -- ═══════════════════════════════════════════
    -- STEP 4: aggregate_energy_daily
    -- ═══════════════════════════════════════════
    BEGIN
      SELECT * INTO v_daily_result
      FROM aggregate_energy_daily(v_current_day);

      v_total_daily := v_total_daily + COALESCE(v_daily_result.rows_inserted, 0);
      RAISE NOTICE '  📅 daily: % rows', COALESCE(v_daily_result.rows_inserted, 0);
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE '  ⚠ daily: %', SQLERRM;
    END;

    v_current_day := v_current_day + 1;
  END LOOP;

  -- ═══════════════════════════════════════════
  -- RIEPILOGO FINALE
  -- ═══════════════════════════════════════════
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '              BACKFILL COMPLETATO';
  RAISE NOTICE '══════════════════════════════════════════════════';
  RAISE NOTICE '  Giorni elaborati:        %', v_days_done;
  RAISE NOTICE '  Power materializzati:    %', v_total_power;
  RAISE NOTICE '  Direct synced:           %', v_total_direct;
  RAISE NOTICE '  Derived from power:      %', v_total_derived;
  RAISE NOTICE '  Hourly rows inseriti:    %', v_total_hourly;
  RAISE NOTICE '  Daily rows inseriti:     %', v_total_daily;
  RAISE NOTICE '  Errori:                  %', v_errors;
  RAISE NOTICE '══════════════════════════════════════════════════';
END;
$$;
