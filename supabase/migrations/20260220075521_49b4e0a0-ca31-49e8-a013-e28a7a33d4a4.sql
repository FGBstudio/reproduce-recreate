-- Add allowed_regions column to user_memberships
-- NULL or empty array means "all regions" (no restriction)
-- Non-empty array restricts visibility to listed regions only
ALTER TABLE public.user_memberships
ADD COLUMN IF NOT EXISTS allowed_regions text[] DEFAULT NULL;

COMMENT ON COLUMN public.user_memberships.allowed_regions IS 'Optional region filter: NULL/empty = all regions visible. Array of region codes (EU, AMER, APAC, MEA) to restrict visibility.';