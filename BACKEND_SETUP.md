# Backend Setup Guide

## Overview
This project uses a portable PostgreSQL/Supabase architecture for IoT telemetry data.

## Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- A Supabase project (or local development)
- Node.js 18+

## 1. Link Supabase Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

## 2. Apply Migrations

```bash
# Run all migrations in order
psql $DATABASE_URL -f database/migrations/001_create_holdings_brands_sites.sql
psql $DATABASE_URL -f database/migrations/002_create_devices.sql
psql $DATABASE_URL -f database/migrations/003_create_telemetry.sql
psql $DATABASE_URL -f database/migrations/004_create_site_kpis.sql
psql $DATABASE_URL -f database/migrations/005_create_events_alerts.sql
psql $DATABASE_URL -f database/migrations/006_create_water_tables.sql
psql $DATABASE_URL -f database/migrations/007_create_certifications.sql
psql $DATABASE_URL -f database/migrations/008_create_helper_functions.sql
```

Or via Supabase CLI:
```bash
supabase db push
```

## 3. Deploy Edge Functions

```bash
supabase functions deploy devices
supabase functions deploy latest
supabase functions deploy timeseries
```

## 4. Test Endpoints

```bash
# Get devices
curl "https://YOUR_PROJECT.supabase.co/functions/v1/devices?limit=10" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Get latest values
curl "https://YOUR_PROJECT.supabase.co/functions/v1/latest?site_id=UUID" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Get timeseries
curl "https://YOUR_PROJECT.supabase.co/functions/v1/timeseries?device_ids=UUID&metrics=co2,temp&start=2025-01-01&end=2025-01-13" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Environment Variables

Set in Supabase Dashboard → Settings → Edge Functions:
- `SUPABASE_URL` (auto-set)
- `SUPABASE_ANON_KEY` (auto-set)

## MQTT Ingestion (Separate Service)

The MQTT ingestion runs externally. It should:
1. Connect to your Mosquitto broker
2. Subscribe to sensor topics
3. POST data to Supabase using service role key

See `data_contract.md` for payload formats.
