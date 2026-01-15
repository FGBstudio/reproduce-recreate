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

Run all migrations in order:
```bash
# Core tables (Holdings, Brands, Sites)
psql $DATABASE_URL -f database/migrations/001_create_holdings_brands_sites.sql

# Devices
psql $DATABASE_URL -f database/migrations/002_create_devices.sql

# Telemetry (raw, hourly, daily, latest)
psql $DATABASE_URL -f database/migrations/003_create_telemetry.sql

# Site KPIs
psql $DATABASE_URL -f database/migrations/004_create_site_kpis.sql

# Events & Alerts
psql $DATABASE_URL -f database/migrations/005_create_events_alerts.sql

# Water tables
psql $DATABASE_URL -f database/migrations/006_create_water_tables.sql

# Certifications
psql $DATABASE_URL -f database/migrations/007_create_certifications.sql

# Helper functions (timeseries, bucketing)
psql $DATABASE_URL -f database/migrations/008_create_helper_functions.sql

# Aggregation triggers (auto-update latest, hourly/daily cron)
psql $DATABASE_URL -f database/migrations/009_create_aggregation_triggers.sql
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

### GET /devices
List devices with optional filters:
```bash
# All devices (paginated)
curl "https://YOUR_PROJECT.supabase.co/functions/v1/devices?limit=10" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Filter by site
curl "https://YOUR_PROJECT.supabase.co/functions/v1/devices?site_id=UUID" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Filter by type and status
curl "https://YOUR_PROJECT.supabase.co/functions/v1/devices?type=air_quality&status=online" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### GET /latest
Get latest telemetry values:
```bash
# All latest values for a site
curl "https://YOUR_PROJECT.supabase.co/functions/v1/latest?site_id=UUID" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Specific devices and metrics
curl "https://YOUR_PROJECT.supabase.co/functions/v1/latest?device_ids=UUID1,UUID2&metrics=iaq.co2,iaq.voc" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### GET /timeseries
Get time-bucketed telemetry data (auto-selects optimal source):
```bash
# Auto bucket selection
curl "https://YOUR_PROJECT.supabase.co/functions/v1/timeseries?device_ids=UUID&metrics=iaq.co2&start=2025-01-01&end=2025-01-13" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Manual bucket selection
curl "https://YOUR_PROJECT.supabase.co/functions/v1/timeseries?device_ids=UUID&metrics=energy.power_kw&start=2025-01-01T00:00:00Z&end=2025-01-01T12:00:00Z&bucket=15m" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Bucket options:** `1m`, `5m`, `15m`, `30m`, `1h`, `6h`, `1d`, `1w`, `1M`

**Auto-source selection:**
- <= 3 days → raw telemetry
- <= 60 days → hourly aggregates
- \> 60 days → daily aggregates

## 5. Environment Variables

Set in Supabase Dashboard → Settings → Edge Functions:
- `SUPABASE_URL` (auto-set)
- `SUPABASE_ANON_KEY` (auto-set)

For the frontend, create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 6. MQTT Ingestion (Separate Service)

The MQTT ingestion runs externally (Docker). See `mqtt-ingestion/README.md`.

Setup:
```bash
cd mqtt-ingestion
cp .env.example .env
# Edit .env with your Supabase credentials

docker-compose up -d
```

Required environment:
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for writes)
- `MQTT_BROKER` - MQTT broker URL

## 7. Scheduled Aggregation (Cron Jobs)

Set up cron jobs via Supabase Dashboard → Database → Cron:

```sql
-- Hourly aggregation (every hour at :05)
SELECT cron.schedule('aggregate-hourly', '5 * * * *', 'SELECT aggregate_hourly()');

-- Daily aggregation (every day at 00:10)
SELECT cron.schedule('aggregate-daily', '10 0 * * *', 'SELECT aggregate_daily()');

-- Mark stale devices offline (every 5 minutes)
SELECT cron.schedule('mark-stale-offline', '*/5 * * * *', 'SELECT mark_stale_devices_offline()');
```

## Metrics Catalog

See `metrics_catalog.md` for standardized metric naming conventions (e.g., `iaq.co2`, `energy.power_kw`).

## Troubleshooting

### Empty responses from /latest or /timeseries
- Verify devices exist: `SELECT * FROM devices LIMIT 5;`
- Verify telemetry data: `SELECT * FROM telemetry ORDER BY ts DESC LIMIT 5;`
- Check metric names match catalog (e.g., `iaq.co2` not `co2`)

### Edge function errors
- Check function logs in Supabase Dashboard → Edge Functions
- Verify RLS policies allow SELECT for anon role
