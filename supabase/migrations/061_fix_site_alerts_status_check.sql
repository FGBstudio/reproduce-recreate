-- Migration: Allow 'acknowledged' status in site_alerts_status_check
-- Version: 061
-- Description: Updates site_alerts_status_check constraint to allow ('active', 'acknowledged', 'resolved').

ALTER TABLE public.site_alerts
    DROP CONSTRAINT IF EXISTS site_alerts_status_check;

ALTER TABLE public.site_alerts
    ADD CONSTRAINT site_alerts_status_check
    CHECK (status IN ('active', 'acknowledged', 'resolved'));
