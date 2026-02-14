
-- Backfill energy_daily from energy_hourly, deduplicating by site_id NOT NULL first
INSERT INTO energy_daily (device_id, site_id, ts_day, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
SELECT 
    device_id,
    site_id,
    ts_day,
    metric,
    value_avg,
    value_min,
    value_max,
    value_sum,
    sample_count,
    unit,
    labels
FROM (
    SELECT 
        device_id,
        site_id,
        ts_hour::date as ts_day,
        metric,
        AVG(value_avg) as value_avg,
        MIN(value_min) as value_min,
        MAX(value_max) as value_max,
        SUM(value_sum) as value_sum,
        SUM(sample_count)::INTEGER as sample_count,
        MAX(unit) as unit,
        jsonb_build_object('hourly_rows', COUNT(*), 'aggregated_at', now(), 'backfill', true) as labels,
        ROW_NUMBER() OVER (
            PARTITION BY device_id, ts_hour::date, metric
            ORDER BY site_id NULLS LAST
        ) as rn
    FROM energy_hourly
    WHERE ts_hour >= '2026-02-07'::date
      AND ts_hour < now()
    GROUP BY device_id, site_id, ts_hour::date, metric
) sub
WHERE rn = 1
ON CONFLICT (device_id, ts_day, metric) 
DO UPDATE SET
    value_avg = EXCLUDED.value_avg,
    value_min = EXCLUDED.value_min,
    value_max = EXCLUDED.value_max,
    value_sum = EXCLUDED.value_sum,
    sample_count = EXCLUDED.sample_count,
    site_id = COALESCE(EXCLUDED.site_id, energy_daily.site_id),
    labels = EXCLUDED.labels;
