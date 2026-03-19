
-- Restrict mqtt_messages_raw SELECT to admins only (no frontend reads this table)
DROP POLICY IF EXISTS "Raw messages viewable by everyone" ON public.mqtt_messages_raw;

CREATE POLICY "Admins can view raw MQTT messages" ON public.mqtt_messages_raw
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
