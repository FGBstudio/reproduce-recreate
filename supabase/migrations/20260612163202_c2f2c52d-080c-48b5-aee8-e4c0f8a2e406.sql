
-- 1. Add currency column to sites
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE public.sites
  DROP CONSTRAINT IF EXISTS sites_currency_check;
ALTER TABLE public.sites
  ADD CONSTRAINT sites_currency_check
  CHECK (currency IN ('EUR','USD','GBP','CHF','JPY','CNY','AUD','CAD','SEK','NOK','DKK','PLN','AED','SGD','HKD'));

-- 2. FX rates table (base EUR -> quote currency)
CREATE TABLE IF NOT EXISTS public.fx_rates (
  base TEXT NOT NULL DEFAULT 'EUR',
  quote TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (base, quote)
);

GRANT SELECT ON public.fx_rates TO anon;
GRANT SELECT ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fx_rates readable by all" ON public.fx_rates;
CREATE POLICY "fx_rates readable by all"
  ON public.fx_rates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "fx_rates service write" ON public.fx_rates;
CREATE POLICY "fx_rates service write"
  ON public.fx_rates FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 3. Seed with EUR self-rate so something is always there
INSERT INTO public.fx_rates (base, quote, rate, fetched_at)
VALUES ('EUR','EUR', 1, now())
ON CONFLICT (base, quote) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = EXCLUDED.fetched_at;
