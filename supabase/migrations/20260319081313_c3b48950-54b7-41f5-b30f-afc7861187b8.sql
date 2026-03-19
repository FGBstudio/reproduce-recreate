
-- Enable RLS on all unprotected public tables
-- Add appropriate SELECT policies to maintain data flow

-- 1. device_migration_log (backend only, contains MAC addresses)
ALTER TABLE public.device_migration_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.device_migration_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view migration log" ON public.device_migration_log FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 2. device_provisioning_map (backend only, contains MAC addresses)
ALTER TABLE public.device_provisioning_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.device_provisioning_map FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view provisioning map" ON public.device_provisioning_map FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 3. device_serial_mac_map (contains MAC addresses)
ALTER TABLE public.device_serial_mac_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.device_serial_mac_map FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view serial mac map" ON public.device_serial_mac_map FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 4. device_serial_mac_map_persistent (contains MAC addresses)
ALTER TABLE public.device_serial_mac_map_persistent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.device_serial_mac_map_persistent FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view persistent mac map" ON public.device_serial_mac_map_persistent FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 5. energy_site_config (config data, needed by edge functions via service_role)
ALTER TABLE public.energy_site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.energy_site_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read energy site config" ON public.energy_site_config FOR SELECT TO authenticated USING (true);

-- 6. energy_site_daily (dashboard reads this)
ALTER TABLE public.energy_site_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.energy_site_daily FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read energy site daily" ON public.energy_site_daily FOR SELECT TO authenticated USING (true);

-- 7. energy_site_device_allowlist (config data)
ALTER TABLE public.energy_site_device_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.energy_site_device_allowlist FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read device allowlist" ON public.energy_site_device_allowlist FOR SELECT TO authenticated USING (true);

-- 8. energy_site_hourly (dashboard reads this)
ALTER TABLE public.energy_site_hourly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.energy_site_hourly FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read energy site hourly" ON public.energy_site_hourly FOR SELECT TO authenticated USING (true);

-- 9. energy_telemetry_swapfix_backup (backup table, no frontend access needed)
ALTER TABLE public.energy_telemetry_swapfix_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.energy_telemetry_swapfix_backup FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. energy_telemetry_ts_backup (backup table, no frontend access needed)
ALTER TABLE public.energy_telemetry_ts_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.energy_telemetry_ts_backup FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 11. historical_energy (historical data)
ALTER TABLE public.historical_energy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.historical_energy FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read historical energy" ON public.historical_energy FOR SELECT TO authenticated USING (true);

-- 12. site_device_config (config data)
ALTER TABLE public.site_device_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.site_device_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read site device config" ON public.site_device_config FOR SELECT TO authenticated USING (true);

-- 13. weather_data (frontend reads this for dashboard)
ALTER TABLE public.weather_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.weather_data FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read weather data" ON public.weather_data FOR SELECT TO authenticated USING (true);
