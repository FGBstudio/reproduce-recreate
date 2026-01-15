# Backend Setup Guide

## Overview

This project uses a **DB-centric architecture** where:
- **MQTT Ingestion**: Simple raw data insert only
- **Database**: All heavy processing (power calculation, aggregation, retention)
- **Edge Functions**: Read-only API for dashboard

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   IoT Devices   │────▶│    Mosquitto    │────▶│  MQTT Ingestion │
│  (WEEL, PAN12,  │     │     Broker      │     │   (Docker)      │
│   MSCHN, etc.)  │     │                 │     │   Raw Insert    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Supabase / PostgreSQL                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ mqtt_messages_raw│  │    telemetry     │  │     devices      │  │
│  │   (audit log)    │  │      (raw)       │  │   (registry)     │  │
│  └──────────────────┘  └────────┬─────────┘  └──────────────────┘  │
│                                 │                                   │
│           ┌─────────────────────┼─────────────────────┐             │
│           ▼                     ▼                     ▼             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ compute_power_w  │  │ aggregate_hourly │  │  aggregate_daily │  │
│  │   (WYE/DELTA)    │  │   (raw → 1h)     │  │   (1h → 1d)      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           ▼                     ▼                     ▼             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ energy.power_kw  │  │  telemetry_hourly│  │  telemetry_daily │  │
│  │  (materialized)  │  │                  │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │    Edge Functions    │
                        │  /devices /latest    │
                        │  /timeseries         │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │      Dashboard       │
                        │      (React)         │
                        └──────────────────────┘
```

## Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- A Supabase project (or local development)
- Node.js 18+
- Docker (for MQTT ingestion)

## 1. Link Supabase Project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 2. Apply Migrations

Run all migrations in order:

```bash
# Get DATABASE_URL from Supabase Dashboard → Settings → Database

# Core tables
psql $DATABASE_URL -f database/migrations/001_create_holdings_brands_sites.sql
psql $DATABASE_URL -f database/migrations/002_create_devices.sql
psql $DATABASE_URL -f database/migrations/003_create_telemetry.sql
psql $DATABASE_URL -f database/migrations/004_create_site_kpis.sql
psql $DATABASE_URL -f database/migrations/005_create_events_alerts.sql
psql $DATABASE_URL -f database/migrations/006_create_water_tables.sql
psql $DATABASE_URL -f database/migrations/007_create_certifications.sql
psql $DATABASE_URL -f database/migrations/008_create_helper_functions.sql
psql $DATABASE_URL -f database/migrations/009_create_aggregation_triggers.sql

# New: DB-centric processing
psql $DATABASE_URL -f database/migrations/010_create_raw_mqtt_table.sql
psql $DATABASE_URL -f database/migrations/011_create_panel_config.sql
psql $DATABASE_URL -f database/migrations/012_add_site_id_to_telemetry.sql
psql $DATABASE_URL -f database/migrations/013_create_power_calculation_functions.sql
psql $DATABASE_URL -f database/migrations/014_create_energy_power_view.sql
psql $DATABASE_URL -f database/migrations/015_create_downsampling_jobs.sql
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
supabase functions deploy scheduled-jobs
```

## 4. Configure Panel (WYE/DELTA)

For accurate power calculation, configure your electrical panels:

```sql
-- Site-wide default (WYE 230V)
INSERT INTO panel_config (site_id, wiring_type, vln_default, vll_default, pf_default)
VALUES ('YOUR_SITE_UUID', 'WYE', 230.0, 400.0, 0.95);

-- Device-specific override (DELTA)
INSERT INTO panel_config (site_id, device_id, wiring_type, vln_default, vll_default, pf_default)
VALUES ('YOUR_SITE_UUID', 'YOUR_DEVICE_UUID', 'DELTA', 230.0, 400.0, 0.90);
```

## 5. Set Up Scheduled Jobs

### Option A: Supabase pg_cron (Recommended)

In Supabase Dashboard → SQL Editor:

```sql
-- Enable pg_cron extension (if not enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hourly jobs (power materialization + aggregation) at minute 5
SELECT cron.schedule('hourly-jobs', '5 * * * *', 
  $$SELECT * FROM run_scheduled_jobs()$$
);

-- Daily jobs (daily aggregation + purge) at 01:15
SELECT cron.schedule('daily-jobs', '15 1 * * *', 
  $$SELECT * FROM run_daily_jobs()$$
);

-- Mark stale devices offline every 5 minutes
SELECT cron.schedule('mark-stale-offline', '*/5 * * * *', 
  $$SELECT mark_stale_devices_offline(30)$$
);
```

### Option B: GitHub Actions (Alternative)

See `.github/workflows/scheduled-jobs.yml`. Required secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Option C: External Cron Script

```bash
cd mqtt-ingestion

# System cron
crontab -e
# Add:
# 5 * * * * cd /path/to/mqtt-ingestion && node scripts/cron-jobs.js hourly
# 15 1 * * * cd /path/to/mqtt-ingestion && node scripts/cron-jobs.js daily
```

## 6. MQTT Ingestion Service

```bash
cd mqtt-ingestion
cp .env.example .env
# Edit .env with your credentials

docker-compose up -d
```

### Key Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Yes |
| `MQTT_BROKER_URL` | MQTT broker address | Yes |
| `MQTT_TOPICS` | Topics to subscribe | Yes |
| `DEFAULT_SITE_ID` | Site for auto-registered devices | Recommended |
| `SAVE_RAW_MESSAGES` | Save audit log (true/false) | No (default: true) |

## 7. Test Endpoints

### GET /devices
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/devices?site_id=UUID" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### GET /latest
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/latest?site_id=UUID&metrics=iaq.co2,energy.power_kw" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### GET /timeseries
```bash
# Auto-selects optimal data source based on range:
# - ≤48h: raw telemetry
# - ≤90 days: hourly aggregates  
# - >90 days: daily aggregates

curl "https://YOUR_PROJECT.supabase.co/functions/v1/timeseries?device_ids=UUID&metrics=energy.power_kw&start=2025-01-01&end=2025-01-14" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### POST /scheduled-jobs (Manual trigger)
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/scheduled-jobs?job=hourly" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## 8. Retention Policy

| Data Type | Retention | Location |
|-----------|-----------|----------|
| Raw telemetry | 90 days | `telemetry` |
| Hourly aggregates | 365 days | `telemetry_hourly` |
| Daily aggregates | Forever | `telemetry_daily` |
| MQTT audit log | 7 days | `mqtt_messages_raw` |

Adjust in `purge_old_telemetry()` function or when calling:
```sql
SELECT * FROM purge_old_telemetry(
  90,   -- raw retention days
  365,  -- hourly retention days
  7     -- mqtt raw retention days
);
```

## 9. Power Calculation Logic

The database computes power from I/V measurements:

**WYE (Star) Configuration:**
```
Power = PF₁×I₁×V₁ + PF₂×I₂×V₂ + PF₃×I₃×V₃
```

**DELTA Configuration:**
Same sum-per-phase calculation (Panoramic style) with voltage derivation:
```
V_L-N = V_L-L / √3
```

**Fallbacks:**
- Missing voltage → use `vln_default` from `panel_config`
- Missing PF → use `pf_default` from `panel_config`
- Placeholder values (e.g., -555555) → automatically excluded

## Troubleshooting

### No power_kw data appearing
1. Check raw I/V metrics exist: `SELECT * FROM telemetry WHERE metric LIKE 'energy.%' ORDER BY ts DESC LIMIT 10;`
2. Verify panel_config: `SELECT * FROM panel_config;`
3. Manually trigger power materialization: `SELECT * FROM materialize_power_metrics();`

### Aggregation not running
1. Check cron jobs: `SELECT * FROM cron.job;`
2. Manual test: `SELECT * FROM run_scheduled_jobs();`
3. Check job history: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

### Device not being registered
1. Ensure `DEFAULT_SITE_ID` is set in mqtt-ingestion `.env`
2. Check logs: `docker-compose logs -f mqtt-ingestion`
