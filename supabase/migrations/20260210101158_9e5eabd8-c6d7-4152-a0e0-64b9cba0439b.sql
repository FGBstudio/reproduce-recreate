-- Clean up future data from energy tables (data imported with wrong timestamps)
-- Only delete records with dates strictly after today (2026-02-10)

DELETE FROM energy_daily WHERE ts_day > CURRENT_DATE;

DELETE FROM energy_hourly WHERE ts_hour > now();

-- Also clean energy_telemetry if any future records exist
DELETE FROM energy_telemetry WHERE ts > now();