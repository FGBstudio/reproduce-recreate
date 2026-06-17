
CREATE TABLE IF NOT EXISTS public.site_energy_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  price_eur_per_kwh NUMERIC NOT NULL,
  currency_at_save TEXT NOT NULL DEFAULT 'EUR',
  price_in_currency NUMERIC,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seph_site_effective
  ON public.site_energy_price_history (site_id, effective_from DESC);

GRANT SELECT, INSERT ON public.site_energy_price_history TO authenticated;
GRANT ALL ON public.site_energy_price_history TO service_role;

ALTER TABLE public.site_energy_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read price history"
  ON public.site_energy_price_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert price history"
  ON public.site_energy_price_history FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Service role manages price history"
  ON public.site_energy_price_history FOR ALL
  TO service_role USING (true) WITH CHECK (true);
