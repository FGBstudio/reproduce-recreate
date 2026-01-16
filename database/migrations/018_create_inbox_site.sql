-- Migration: Create Inbox/Unassigned Site
-- Version: 018
-- Description: Creates a system site for auto-registered unmapped devices

-- =====================================================
-- SYSTEM HOLDING AND BRAND FOR INBOX
-- =====================================================

-- Create system holding for unmapped resources
INSERT INTO holdings (id, name, logo_url)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '_System',
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Create system brand for inbox
INSERT INTO brands (id, holding_id, name, logo_url)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Inbox',
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Create inbox site for unmapped devices
INSERT INTO sites (id, brand_id, name, address, city, country, region, lat, lng, monitoring_types, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'Inbox / Unassigned Devices',
  'N/A',
  'N/A',
  'N/A',
  'EU',
  0,
  0,
  ARRAY['energy', 'air', 'water'],
  'UTC'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE holdings IS 'Parent companies. ID 00000000-0000-0000-0000-000000000001 is reserved for system use.';
COMMENT ON TABLE brands IS 'Brands belonging to holdings. ID 00000000-0000-0000-0000-000000000002 is reserved for Inbox.';
COMMENT ON TABLE sites IS 'Physical locations. ID 00000000-0000-0000-0000-000000000003 is the Inbox for unmapped devices.';

-- =====================================================
-- GRANT SELECT ON INBOX TO ANON (for MQTT ingestion visibility)
-- =====================================================

-- The RLS policies from migration 017 should already allow access
-- but we ensure the inbox site is visible to service role

-- Note: Use this site ID in MQTT ingestion service:
-- DEFAULT_SITE_ID=00000000-0000-0000-0000-000000000003
