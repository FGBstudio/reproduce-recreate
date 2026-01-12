# FGB IoT Dashboard - Data Contract Specification

> **Version:** 1.0.0  
> **Date:** 2026-01-12  
> **Status:** Draft - Ready for Implementation  
> **Architecture:** Portable (Supabase/Postgres + REST API + External MQTT Ingestion)

---

## Table of Contents

1. [Overview](#1-overview)
2. [KPI and Views Catalog](#2-kpi-and-views-catalog)
3. [Data Model (Database Schema)](#3-data-model-database-schema)
4. [API Endpoints](#4-api-endpoints)
5. [Query Logic (Pseudo-SQL)](#5-query-logic-pseudo-sql)
6. [Performance Requirements](#6-performance-requirements)
7. [Security Requirements](#7-security-requirements)
8. [Implementation Notes](#8-implementation-notes)

---

## 1. Overview

### 1.1 System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   MQTT Broker   │────▶│  Ingestion Svc   │────▶│   PostgreSQL    │
│   (Mosquitto)   │     │  (External/K8s)  │     │   (Supabase)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │    REST API      │◀─────────────┘
                        │  (Edge Functions)│
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │    Dashboard     │
                        │    (React SPA)   │
                        └──────────────────┘
```

### 1.2 Data Sources (MQTT Payloads)

#### Air Quality Sensors (WEEL/LEED Models)
```json
{
  "Timestamp": "2025-12-31 23:59:49",
  "Broker": "cert.gwext.coolprojects.it",
  "DeviceID": "******0076",
  "MAC": "********DD8A",
  "Model": "WEEL",
  "VOC": 373,
  "CO2": 776,
  "Temp": 21.1,
  "Humidity": 16.3,
  "O3": 20.0,
  "CO": 0.0,
  "PM2.5": 0.0,
  "PM10": 0.0
}
```

#### Energy Sensors (Single Phase - PAN12)
```json
{
  "Timestamp": "2025-12-01 00:00:05",
  "Broker": "data.hub.fgb-studio.com",
  "Topic": "bridge/Milan-office-bridge01/slot0/reading",
  "status": 2.0,
  "sensor_sn": "******771",
  "type": "PAN12",
  "ts": 1764543602,
  "current_A": 1.582,
  "rssi_dBm": -62.0
}
```

#### Energy Sensors (Three Phase - MSCHN)
```json
{
  "Timestamp": "2025-12-03 15:00:01",
  "Broker": "cert.gwext.coolprojects.it",
  "Topic": "MSCHN/misure",
  "I1": "7.18", "I2": "6.99", "I3": "7.55",
  "V1": "222.02", "V2": "222.61", "V3": "222.75",
  "ID": "********C8CF",
  "time": "2025-12-03 22:00:00"
}
```

---

## 2. KPI and Views Catalog

### 2.1 Global/Region Level KPIs

| KPI Name | Description | Page/Section | Unit | Update Freq | Filters | Aggregation |
|----------|-------------|--------------|------|-------------|---------|-------------|
| Avg Energy Intensity | Average energy consumption per square meter | RegionOverlay | kWh/m² | 5min polling | region | region |
| Air Quality Score | Aggregate air quality index | RegionOverlay | EXCELLENT/GOOD/MODERATE/POOR | 1min polling | region | region |
| Active Sites | Count of online stores/projects | RegionOverlay | count | 1min polling | region | region |
| Critical Alerts | Count of critical severity alerts | RegionOverlay | count | live (SSE) | region | region |

### 2.2 Brand/Holding Level KPIs

| KPI Name | Description | Page/Section | Unit | Update Freq | Filters | Aggregation |
|----------|-------------|--------------|------|-------------|---------|-------------|
| Store Count | Number of stores for brand/holding | BrandOverlay | count | on-demand | holding, brand | brand/holding |
| Total Energy | Sum of energy consumption | BrandOverlay | kWh | 5min polling | holding, brand | brand/holding |
| Avg CO₂ | Average CO₂ across stores | BrandOverlay | ppm | 5min polling | holding, brand | brand/holding |
| Total Alerts | Sum of all alerts | BrandOverlay | count | live (SSE) | holding, brand | brand/holding |
| Energy by Store (chart) | HVAC + Lighting breakdown | BrandOverlay | kWh | 5min polling | holding, brand | store |
| CO₂ by Store (chart) | CO₂ levels comparison | BrandOverlay | ppm | 5min polling | holding, brand | store |
| Performance Radar | Multi-axis comparison | BrandOverlay | normalized % | 5min polling | holding, brand | store |

### 2.3 Project/Store Level - Energy Dashboard

| KPI Name | Description | Page/Section | Unit | Update Freq | Filters | Aggregation |
|----------|-------------|--------------|------|-------------|---------|-------------|
| Total Consumption | Total energy consumed | ProjectDetail/Slide1 | kWh | 5min polling | store, date range | store |
| Estimated Cost | Calculated energy cost | ProjectDetail/Slide1 | € | 5min polling | store, date range | store |
| Efficiency Rating | Energy efficiency score | ProjectDetail/Slide1 | % | 5min polling | store, date range | store |
| Active Alerts | Current alert count | ProjectDetail/Slide1 | count | live (SSE) | store | store |
| Energy Consumption (chart) | Actual vs Expected vs Average | ProjectDetail/Slide1 | kWh | 5min polling | store, date range | hourly/daily/weekly/monthly |
| Distribution (pie) | HVAC/Lighting/Plugs/Other breakdown | ProjectDetail/Slide1 | % | 5min polling | store, date range | store |
| Device Consumption (chart) | Stacked bar by device category | ProjectDetail/Slide3 | kWh | 5min polling | store, date range | device category |
| Carbon Footprint (chart) | CO₂ emissions by month | ProjectDetail/Slide4 | kg CO₂ | daily | store, date range | weekly |
| Energy Trend (chart) | Area chart by device | ProjectDetail/Slide4 | kW | 5min polling | store, date range | daily |
| Energy vs Outdoor (chart) | HVAC vs Temperature | ProjectDetail/Slide4 | kW, °C | 5min polling | store, date range | daily |
| Occupancy Heatmap | 24x7 energy density matrix | ProjectDetail/Slide2 | kWh | hourly | store, date range | hour x day |

### 2.4 Project/Store Level - Air Quality Dashboard

| KPI Name | Description | Page/Section | Unit | Update Freq | Filters | Aggregation |
|----------|-------------|--------------|------|-------------|---------|-------------|
| Indoor Air Quality | Aggregate AQ index | ProjectDetail/Air/Slide1 | EXCELLENT/GOOD/MODERATE/POOR | live (1s) | store | store |
| CO₂ Level | Current CO₂ | ProjectDetail/Air/Slide1 | ppm | live (1s) | store | device |
| Temperature | Current temperature | ProjectDetail/Air/Slide1 | °C | live (1s) | store | device |
| Humidity | Current humidity | ProjectDetail/Air/Slide1 | % | live (1s) | store | device |
| TVOC | Total Volatile Organic Compounds | ProjectDetail/Air/Slide1 | ppb | live (1s) | store | device |
| CO₂ Trend (chart) | 24h CO₂ history | ProjectDetail/Air/Slide1 | ppm | 5min polling | store, date range | hourly |
| TVOC Trend (chart) | 24h TVOC history | ProjectDetail/Air/Slide1 | ppb | 5min polling | store, date range | hourly |
| Temp/Humidity (chart) | 24h combined chart | ProjectDetail/Air/Slide1 | °C, % | 5min polling | store, date range | hourly |
| PM2.5 Indoor/Outdoor | Weekly comparison | ProjectDetail/Air/Slide2 | µg/m³ | hourly | store, date range | daily |
| PM10 Indoor/Outdoor | Weekly comparison | ProjectDetail/Air/Slide2 | µg/m³ | hourly | store, date range | daily |
| CO Level (chart) | 24h carbon monoxide | ProjectDetail/Air/Slide3 | ppm | 5min polling | store, date range | hourly |
| O₃ Level (chart) | 24h ozone | ProjectDetail/Air/Slide3 | ppb | 5min polling | store, date range | hourly |

### 2.5 Project/Store Level - Water Dashboard

| KPI Name | Description | Page/Section | Unit | Update Freq | Filters | Aggregation |
|----------|-------------|--------------|------|-------------|---------|-------------|
| Total Consumption | Annual water usage | ProjectDetail/Water/Slide1 | m³ | daily | store, date range | store |
| Estimated Cost | Annual water cost | ProjectDetail/Water/Slide1 | € | daily | store, date range | store |
| Efficiency | Water efficiency rating | ProjectDetail/Water/Slide1 | % | daily | store, date range | store |
| Detected Leaks | Zones with anomalies | ProjectDetail/Water/Slide1 | count | live (SSE) | store | zone |
| Consumption Trend (chart) | Monthly vs Target vs LastYear | ProjectDetail/Water/Slide1 | m³ | daily | store, date range | monthly |
| Distribution (pie) | Sanitari/HVAC/Irrigazione/etc | ProjectDetail/Water/Slide1 | % | daily | store, date range | category |
| Leak Detection (list) | Zone-by-zone leak status | ProjectDetail/Water/Slide2 | %, status | live (SSE) | store | zone |
| Daily Trend (chart) | Hourly consumption peaks | ProjectDetail/Water/Slide2 | L | hourly | store, date | hourly |
| Weekly Efficiency (chart) | Efficiency vs Waste | ProjectDetail/Water/Slide2 | % | daily | store, date range | weekly |
| Water Quality (chart) | pH, Turbidity, Chlorine | ProjectDetail/Water/Slide3 | pH, NTU, mg/L | 5min polling | store, date range | hourly |
| pH Indicator | Current pH value | ProjectDetail/Water/Slide3 | pH | 5min polling | store | store |
| Turbidity Indicator | Current turbidity | ProjectDetail/Water/Slide3 | NTU | 5min polling | store | store |
| Chlorine Indicator | Residual chlorine | ProjectDetail/Water/Slide3 | mg/L | 5min polling | store | store |
| Water Temperature | Current water temp | ProjectDetail/Water/Slide3 | °C | 5min polling | store | store |

### 2.6 Certification Dashboard

| KPI Name | Description | Page/Section | Unit | Update Freq | Filters | Aggregation |
|----------|-------------|--------------|------|-------------|---------|-------------|
| LEED Score | Current LEED points | ProjectDetail/Cert/Slide1 | points/110 | on-demand | store | store |
| LEED Level | Certification level | ProjectDetail/Cert/Slide1 | Certified/Silver/Gold/Platinum | on-demand | store | store |
| BREEAM Score | BREEAM percentage | ProjectDetail/Cert/Slide1 | % | on-demand | store | store |
| BREEAM Level | Certification level | ProjectDetail/Cert/Slide1 | Pass/Good/VeryGood/Excellent/Outstanding | on-demand | store | store |
| WELL Score | WELL points | ProjectDetail/Cert/Slide1 | points/100 | on-demand | store | store |
| WELL Level | Certification level | ProjectDetail/Cert/Slide1 | Bronze/Silver/Gold/Platinum | on-demand | store | store |
| Milestones (list) | Certification progress items | ProjectDetail/Cert/Slide2 | completed/pending | on-demand | store, certification | milestone |

---

## 3. Data Model (Database Schema)

### 3.1 Core Tables

#### `holdings` - Parent Organization
```sql
CREATE TABLE holdings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_holdings_name ON holdings(name);
```

#### `brands` - Brand/Company
```sql
CREATE TABLE brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  holding_id TEXT REFERENCES holdings(id) ON DELETE CASCADE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brands_holding ON brands(holding_id);
CREATE INDEX idx_brands_name ON brands(name);
```

#### `sites` - Physical Locations (Stores/Projects)
```sql
CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE CASCADE,
  region TEXT NOT NULL, -- EU, AMER, APAC, MEA
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  area_sqm DOUBLE PRECISION, -- for kWh/m² calculation
  image_url TEXT,
  monitoring_types TEXT[] DEFAULT ARRAY['energy'], -- energy, air, water
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sites_brand ON sites(brand_id);
CREATE INDEX idx_sites_region ON sites(region);
CREATE INDEX idx_sites_location ON sites USING GIST (
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)
); -- requires PostGIS
```

#### `devices` - Sensors/Devices Registry
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY, -- DeviceID or sensor_sn
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  mac_address TEXT,
  model TEXT, -- WEEL, LEED, PAN12, MSCHN, etc.
  device_type TEXT NOT NULL, -- air_quality, energy_single, energy_three_phase, water
  category TEXT, -- hvac, lighting, plugs, general, zone
  zone TEXT, -- physical zone within site
  broker TEXT, -- MQTT broker hostname
  topic TEXT, -- MQTT topic
  installed_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  status TEXT DEFAULT 'unknown', -- online, offline, unknown
  rssi_dbm DOUBLE PRECISION,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_site ON devices(site_id);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_devices_model ON devices(model);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at);
```

### 3.2 Telemetry Tables (Time-Series)

#### `telemetry` - Generic Time-Series Data (Hypertable if using TimescaleDB)
```sql
CREATE TABLE telemetry (
  ts TIMESTAMPTZ NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  metric TEXT NOT NULL, -- co2, voc, temp, humidity, pm25, pm10, co, o3, current_a, voltage_v, power_w, etc.
  value DOUBLE PRECISION NOT NULL,
  unit TEXT, -- ppm, ppb, °C, %, µg/m³, A, V, W, kWh, m³, L
  quality TEXT DEFAULT 'good', -- good, suspect, bad
  raw JSONB, -- original payload for debugging
  PRIMARY KEY (ts, device_id, metric)
);

-- TimescaleDB hypertable (optional but recommended)
-- SELECT create_hypertable('telemetry', 'ts', chunk_time_interval => INTERVAL '1 day');

CREATE INDEX idx_telemetry_device_ts ON telemetry(device_id, ts DESC);
CREATE INDEX idx_telemetry_metric ON telemetry(metric, ts DESC);
CREATE INDEX idx_telemetry_ts ON telemetry(ts DESC);
```

#### `telemetry_latest` - Materialized Latest Values (for fast "live" queries)
```sql
CREATE TABLE telemetry_latest (
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT,
  PRIMARY KEY (device_id, metric)
);

CREATE INDEX idx_latest_device ON telemetry_latest(device_id);
```

### 3.3 Aggregated Tables (Pre-computed for Performance)

#### `telemetry_hourly` - Hourly Aggregates
```sql
CREATE TABLE telemetry_hourly (
  bucket TIMESTAMPTZ NOT NULL, -- truncated to hour
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  avg_value DOUBLE PRECISION,
  min_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  sum_value DOUBLE PRECISION,
  count INTEGER,
  PRIMARY KEY (bucket, device_id, metric)
);

CREATE INDEX idx_hourly_device_bucket ON telemetry_hourly(device_id, bucket DESC);
CREATE INDEX idx_hourly_bucket ON telemetry_hourly(bucket DESC);
```

#### `telemetry_daily` - Daily Aggregates
```sql
CREATE TABLE telemetry_daily (
  bucket DATE NOT NULL,
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  avg_value DOUBLE PRECISION,
  min_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  sum_value DOUBLE PRECISION,
  count INTEGER,
  PRIMARY KEY (bucket, device_id, metric)
);

CREATE INDEX idx_daily_device_bucket ON telemetry_daily(device_id, bucket DESC);
```

#### `site_kpis` - Pre-aggregated Site-Level KPIs
```sql
CREATE TABLE site_kpis (
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL,
  period TEXT NOT NULL, -- 'live', 'hour', 'day', 'week', 'month'
  kpi_name TEXT NOT NULL, -- energy_total, energy_hvac, energy_lighting, co2_avg, air_quality_index, etc.
  value DOUBLE PRECISION,
  unit TEXT,
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (site_id, period, kpi_name)
);

CREATE INDEX idx_site_kpis_site ON site_kpis(site_id);
```

### 3.4 Events and Alerts

#### `events` - Alarms and Notifications
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- alert, warning, info, maintenance
  severity TEXT NOT NULL, -- critical, high, medium, low
  title TEXT NOT NULL,
  description TEXT,
  metric TEXT,
  threshold_value DOUBLE PRECISION,
  actual_value DOUBLE PRECISION,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  acknowledged_by UUID, -- user id
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_site ON events(site_id);
CREATE INDEX idx_events_severity ON events(severity, triggered_at DESC);
CREATE INDEX idx_events_unresolved ON events(site_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_events_triggered ON events(triggered_at DESC);
```

### 3.5 Water-Specific Tables

#### `water_zones` - Water Monitoring Zones
```sql
CREATE TABLE water_zones (
  id SERIAL PRIMARY KEY,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zone_type TEXT, -- bathroom, kitchen, irrigation, hvac_cooling, fountain
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_water_zones_site ON water_zones(site_id);
```

#### `water_leaks` - Leak Detection Events
```sql
CREATE TABLE water_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id INTEGER REFERENCES water_zones(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leak_rate DOUBLE PRECISION, -- percentage
  status TEXT NOT NULL, -- ok, warning, critical
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_water_leaks_zone ON water_leaks(zone_id);
CREATE INDEX idx_water_leaks_active ON water_leaks(zone_id) WHERE resolved_at IS NULL;
```

### 3.6 Certification Tables

#### `certifications` - Certification Records
```sql
CREATE TABLE certifications (
  id SERIAL PRIMARY KEY,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  cert_type TEXT NOT NULL, -- LEED, BREEAM, WELL
  version TEXT, -- v4.1, 2018, v2
  level TEXT, -- Gold, Excellent, Silver, etc.
  score DOUBLE PRECISION,
  max_score DOUBLE PRECISION,
  certified_at DATE,
  expires_at DATE,
  next_audit_at DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_certifications_site ON certifications(site_id);
CREATE INDEX idx_certifications_type ON certifications(cert_type);
```

#### `certification_milestones` - Progress Tracking
```sql
CREATE TABLE certification_milestones (
  id SERIAL PRIMARY KEY,
  certification_id INTEGER REFERENCES certifications(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- energy, water, materials, indoor_quality, etc.
  name TEXT NOT NULL,
  points DOUBLE PRECISION,
  max_points DOUBLE PRECISION,
  status TEXT NOT NULL, -- completed, in_progress, pending
  completed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_milestones_cert ON certification_milestones(certification_id);
```

---

## 4. API Endpoints

### 4.1 Entity Endpoints

#### Holdings & Brands
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/holdings` | List all holdings | - |
| GET | `/api/holdings/:id` | Get holding with brands | - |
| GET | `/api/brands` | List all brands | `holding_id` |
| GET | `/api/brands/:id` | Get brand with sites | - |

**Response Example: GET /api/holdings**
```json
{
  "data": [
    {
      "id": "kering",
      "name": "Kering",
      "logo_url": "https://...",
      "brands_count": 3,
      "sites_count": 5
    }
  ]
}
```

#### Sites/Projects
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/sites` | List sites | `region`, `brand_id`, `holding_id`, `monitoring_type` |
| GET | `/api/sites/:id` | Get site details | - |
| GET | `/api/sites/:id/devices` | List site devices | `device_type`, `status` |

**Response Example: GET /api/sites?region=EU**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Gucci Milan Flagship",
      "brand": { "id": "gucci", "name": "Gucci" },
      "holding": { "id": "kering", "name": "Kering" },
      "region": "EU",
      "address": "Milan, Italy",
      "lat": 45.4642,
      "lng": 9.1900,
      "monitoring_types": ["energy", "air", "water"],
      "kpis": {
        "energy_total": 89,
        "energy_hvac": 32,
        "energy_lighting": 46,
        "co2_avg": 420,
        "temp_avg": 22,
        "air_quality": "GOOD",
        "alerts_count": 0
      }
    }
  ]
}
```

#### Devices
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/devices` | List all devices | `site_id`, `device_type`, `status` |
| GET | `/api/devices/:id` | Get device details | - |
| GET | `/api/devices/:id/status` | Get device health | - |

### 4.2 Telemetry Endpoints

#### Latest Values
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/sites/:id/latest` | Latest values for site | `metrics` (comma-separated) |
| GET | `/api/devices/:id/latest` | Latest values for device | `metrics` |

**Response Example: GET /api/sites/1/latest?metrics=co2,temp,humidity**
```json
{
  "site_id": 1,
  "updated_at": "2026-01-12T10:30:00Z",
  "metrics": {
    "co2": { "value": 485, "unit": "ppm", "device_id": "0076", "ts": "2026-01-12T10:29:45Z" },
    "temp": { "value": 21.5, "unit": "°C", "device_id": "0076", "ts": "2026-01-12T10:29:45Z" },
    "humidity": { "value": 42, "unit": "%", "device_id": "0076", "ts": "2026-01-12T10:29:45Z" }
  }
}
```

#### Time-Series Data
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/sites/:id/timeseries` | Bucketed time-series | `metrics`, `from`, `to`, `bucket` (1m/5m/1h/1d) |
| GET | `/api/devices/:id/timeseries` | Device time-series | `metrics`, `from`, `to`, `bucket` |

**Response Example: GET /api/sites/1/timeseries?metrics=co2&from=2026-01-11&to=2026-01-12&bucket=1h**
```json
{
  "site_id": 1,
  "bucket": "1h",
  "from": "2026-01-11T00:00:00Z",
  "to": "2026-01-12T23:59:59Z",
  "data": [
    { "ts": "2026-01-11T00:00:00Z", "co2": { "avg": 420, "min": 380, "max": 460 } },
    { "ts": "2026-01-11T01:00:00Z", "co2": { "avg": 395, "min": 370, "max": 420 } }
  ]
}
```

### 4.3 KPI Endpoints

#### Regional KPIs
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/regions` | List regions with KPIs | - |
| GET | `/api/regions/:code/kpis` | Get region KPIs | - |

**Response Example: GET /api/regions**
```json
{
  "data": [
    {
      "code": "EU",
      "name": "Europe",
      "center": { "lat": 48, "lng": 10 },
      "zoom": 5,
      "kpis": {
        "avg_energy_intensity": 72,
        "air_quality": "GOOD",
        "active_sites": 23,
        "critical_alerts": 2
      }
    }
  ]
}
```

#### Brand/Holding KPIs
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/holdings/:id/kpis` | Holding aggregated KPIs | - |
| GET | `/api/brands/:id/kpis` | Brand aggregated KPIs | - |
| GET | `/api/brands/:id/comparison` | Store comparison data | - |

**Response Example: GET /api/brands/gucci/comparison**
```json
{
  "brand_id": "gucci",
  "stores": [
    { "site_id": 1, "name": "Milan Flagship", "city": "Milan", "energy_total": 89, "energy_hvac": 32, "energy_lighting": 46, "co2_avg": 420, "temp_avg": 22, "alerts": 0 }
  ],
  "radar_data": [
    { "metric": "Energy", "Milan": 89, "Paris": 75 },
    { "metric": "HVAC", "Milan": 32, "Paris": 28 }
  ]
}
```

#### Site KPIs
| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/sites/:id/kpis` | Site KPIs | `period` (today/week/month/year), `from`, `to` |
| GET | `/api/sites/:id/energy` | Energy dashboard data | `period`, `from`, `to` |
| GET | `/api/sites/:id/air-quality` | Air quality dashboard data | `period`, `from`, `to` |
| GET | `/api/sites/:id/water` | Water dashboard data | `period`, `from`, `to` |
| GET | `/api/sites/:id/certifications` | Certification data | - |

**Response Example: GET /api/sites/1/energy?period=month**
```json
{
  "site_id": 1,
  "period": "month",
  "summary": {
    "total_consumption": 2450,
    "estimated_cost": 564.50,
    "efficiency": 87,
    "alerts_count": 0,
    "trend_vs_last_period": -5.2
  },
  "distribution": [
    { "category": "HVAC", "value": 35, "kwh": 857.5 },
    { "category": "Lighting", "value": 28, "kwh": 686 },
    { "category": "Plugs", "value": 18, "kwh": 441 },
    { "category": "Other", "value": 19, "kwh": 465.5 }
  ],
  "consumption_trend": [
    { "label": "Sett 1", "actual": 580, "expected": 620, "average": 600 },
    { "label": "Sett 2", "actual": 620, "expected": 620, "average": 600 }
  ],
  "device_breakdown": [
    { "label": "Sett 1", "hvac": 200, "lighting": 180, "plugs": 120 }
  ]
}
```

### 4.4 Ranking/Top N Endpoints

| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/rankings/energy` | Top stores by energy | `limit`, `order` (asc/desc), `region`, `holding_id` |
| GET | `/api/rankings/air-quality` | Stores by AQ score | `limit`, `order` |
| GET | `/api/rankings/alerts` | Stores by alert count | `limit`, `severity` |

**Response Example: GET /api/rankings/energy?limit=5&order=desc**
```json
{
  "data": [
    { "rank": 1, "site_id": 5, "name": "Fendi Dubai Mall", "value": 130, "unit": "kWh" },
    { "rank": 2, "site_id": 3, "name": "Dior NY Soho", "value": 120, "unit": "kWh" }
  ]
}
```

### 4.5 Events/Alerts Endpoints

| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/events` | List events | `site_id`, `severity`, `status`, `from`, `to` |
| GET | `/api/events/:id` | Get event details | - |
| POST | `/api/events/:id/acknowledge` | Acknowledge event | - |
| POST | `/api/events/:id/resolve` | Resolve event | - |
| GET | `/api/sites/:id/events` | Site events | `severity`, `status`, `limit` |

### 4.6 Health/Status Endpoints

| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/health` | API health check | - |
| GET | `/api/sites/:id/health` | Site device health | - |
| GET | `/api/devices/:id/health` | Device health details | - |

**Response Example: GET /api/sites/1/health**
```json
{
  "site_id": 1,
  "devices_total": 12,
  "devices_online": 10,
  "devices_offline": 2,
  "last_data_at": "2026-01-12T10:30:00Z",
  "devices": [
    { "id": "0076", "model": "WEEL", "status": "online", "rssi_dbm": -62, "last_seen": "2026-01-12T10:30:00Z" },
    { "id": "0025", "model": "LEED", "status": "offline", "last_seen": "2026-01-11T18:00:00Z" }
  ]
}
```

### 4.7 Real-Time Endpoints (WebSocket/SSE)

| Protocol | Path | Description |
|----------|------|-------------|
| SSE | `/api/sites/:id/stream` | Real-time updates for site |
| SSE | `/api/events/stream` | Real-time events stream |
| WebSocket | `/api/ws/sites/:id` | Bidirectional site updates |

**SSE Event Example:**
```
event: telemetry
data: {"device_id":"0076","metric":"co2","value":520,"ts":"2026-01-12T10:30:45Z"}

event: alert
data: {"id":"abc123","severity":"high","title":"CO2 threshold exceeded","site_id":1}
```

---

## 5. Query Logic (Pseudo-SQL)

### 5.1 Latest Values for Site
```sql
SELECT 
  tl.device_id,
  d.model,
  tl.metric,
  tl.value,
  tl.unit,
  tl.ts
FROM telemetry_latest tl
JOIN devices d ON d.id = tl.device_id
WHERE d.site_id = :site_id
  AND tl.metric IN (:metrics)
ORDER BY tl.ts DESC;
```

### 5.2 Time-Series with Bucket (1 hour)
```sql
SELECT 
  date_trunc('hour', ts) AS bucket,
  metric,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  COUNT(*) AS sample_count
FROM telemetry t
JOIN devices d ON d.id = t.device_id
WHERE d.site_id = :site_id
  AND t.metric IN (:metrics)
  AND t.ts BETWEEN :from AND :to
GROUP BY bucket, metric
ORDER BY bucket ASC;
```

### 5.3 Energy Distribution by Device Category
```sql
SELECT 
  d.category,
  SUM(th.sum_value) AS total_kwh,
  ROUND(SUM(th.sum_value) * 100.0 / SUM(SUM(th.sum_value)) OVER (), 1) AS percentage
FROM telemetry_hourly th
JOIN devices d ON d.id = th.device_id
WHERE d.site_id = :site_id
  AND d.device_type = 'energy_single' OR d.device_type = 'energy_three_phase'
  AND th.metric = 'energy_kwh'
  AND th.bucket BETWEEN :from AND :to
GROUP BY d.category
ORDER BY total_kwh DESC;
```

### 5.4 Air Quality Index Calculation
```sql
WITH latest_metrics AS (
  SELECT 
    tl.metric,
    tl.value
  FROM telemetry_latest tl
  JOIN devices d ON d.id = tl.device_id
  WHERE d.site_id = :site_id
    AND d.device_type = 'air_quality'
    AND tl.metric IN ('co2', 'voc', 'pm25', 'pm10')
)
SELECT 
  CASE 
    WHEN MAX(CASE WHEN metric = 'co2' THEN value END) > 1000 THEN 'POOR'
    WHEN MAX(CASE WHEN metric = 'co2' THEN value END) > 800 THEN 'MODERATE'
    WHEN MAX(CASE WHEN metric = 'co2' THEN value END) > 600 THEN 'GOOD'
    ELSE 'EXCELLENT'
  END AS air_quality_index
FROM latest_metrics;
```

### 5.5 Regional KPIs Aggregation
```sql
SELECT 
  s.region,
  COUNT(DISTINCT s.id) AS active_sites,
  AVG(sk.value) FILTER (WHERE sk.kpi_name = 'energy_intensity') AS avg_energy_intensity,
  COUNT(*) FILTER (WHERE e.severity = 'critical' AND e.resolved_at IS NULL) AS critical_alerts
FROM sites s
LEFT JOIN site_kpis sk ON sk.site_id = s.id AND sk.period = 'live'
LEFT JOIN events e ON e.site_id = s.id
WHERE s.region = :region
GROUP BY s.region;
```

### 5.6 Store Comparison for Brand
```sql
SELECT 
  s.id AS site_id,
  s.name,
  SPLIT_PART(s.name, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(s.name, ' '), 1)) AS city,
  COALESCE(MAX(sk.value) FILTER (WHERE sk.kpi_name = 'energy_total'), 0) AS energy_total,
  COALESCE(MAX(sk.value) FILTER (WHERE sk.kpi_name = 'energy_hvac'), 0) AS energy_hvac,
  COALESCE(MAX(sk.value) FILTER (WHERE sk.kpi_name = 'energy_lighting'), 0) AS energy_lighting,
  COALESCE(MAX(sk.value) FILTER (WHERE sk.kpi_name = 'co2_avg'), 0) AS co2_avg,
  COALESCE(MAX(sk.value) FILTER (WHERE sk.kpi_name = 'temp_avg'), 0) AS temp_avg,
  COUNT(e.id) FILTER (WHERE e.resolved_at IS NULL) AS alerts
FROM sites s
LEFT JOIN site_kpis sk ON sk.site_id = s.id AND sk.period = 'live'
LEFT JOIN events e ON e.site_id = s.id
WHERE s.brand_id = :brand_id
GROUP BY s.id, s.name
ORDER BY s.name;
```

### 5.7 Ranking Top N by Energy
```sql
SELECT 
  ROW_NUMBER() OVER (ORDER BY sk.value DESC) AS rank,
  s.id AS site_id,
  s.name,
  sk.value,
  'kWh' AS unit
FROM sites s
JOIN site_kpis sk ON sk.site_id = s.id
WHERE sk.kpi_name = 'energy_total'
  AND sk.period = 'day'
  AND (:region IS NULL OR s.region = :region)
ORDER BY sk.value DESC
LIMIT :limit;
```

### 5.8 Water Leak Detection
```sql
SELECT 
  wz.id AS zone_id,
  wz.name AS zone,
  wl.leak_rate,
  wl.status,
  CASE 
    WHEN wl.detected_at IS NULL THEN '-'
    ELSE TO_CHAR(NOW() - wl.detected_at, 'DD "giorni" HH24 "ore fa"')
  END AS detected_ago
FROM water_zones wz
LEFT JOIN LATERAL (
  SELECT * FROM water_leaks 
  WHERE zone_id = wz.id 
  ORDER BY detected_at DESC 
  LIMIT 1
) wl ON true
WHERE wz.site_id = :site_id
ORDER BY 
  CASE wl.status WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  wz.name;
```

### 5.9 Occupancy Heatmap (24x7 Matrix)
```sql
SELECT 
  EXTRACT(HOUR FROM bucket) AS hour,
  EXTRACT(DOW FROM bucket) AS day_of_week,
  AVG(sum_value) AS avg_energy
FROM telemetry_hourly th
JOIN devices d ON d.id = th.device_id
WHERE d.site_id = :site_id
  AND th.metric = 'power_kw'
  AND th.bucket BETWEEN :from AND :to
GROUP BY EXTRACT(HOUR FROM bucket), EXTRACT(DOW FROM bucket)
ORDER BY hour, day_of_week;
```

---

## 6. Performance Requirements

### 6.1 Latency Targets

| Operation | Target Latency | Notes |
|-----------|---------------|-------|
| Latest values (single site) | < 100ms | Use `telemetry_latest` table |
| Latest values (region aggregation) | < 500ms | Pre-compute in `site_kpis` |
| Time-series (1 day, 1h bucket) | < 500ms | Use `telemetry_hourly` |
| Time-series (1 month, 1d bucket) | < 500ms | Use `telemetry_daily` |
| Time-series (1 year, raw) | < 2s | Acceptable for rare queries |
| Real-time stream (SSE) | < 2s propagation | From MQTT → DB → SSE |
| Alert propagation | < 5s | Critical for safety |

### 6.2 Data Retention

| Table | Retention | Notes |
|-------|-----------|-------|
| `telemetry` (raw) | 90 days | Configurable per deployment |
| `telemetry_hourly` | 2 years | |
| `telemetry_daily` | 10 years | |
| `telemetry_latest` | Live only | Continuously updated |
| `events` | Indefinite | Audit trail |

### 6.3 Aggregation Strategy

1. **Real-time ingestion**: MQTT → Ingestion Service → `telemetry` + `telemetry_latest`
2. **Hourly rollup**: Scheduled job every hour → `telemetry_hourly`
3. **Daily rollup**: Scheduled job at 00:05 UTC → `telemetry_daily`
4. **KPI refresh**: Every 5 minutes → `site_kpis`

### 6.4 Caching Recommendations

| Data Type | Cache TTL | Strategy |
|-----------|-----------|----------|
| Holdings/Brands/Sites | 1 hour | CDN or in-memory |
| Region KPIs | 1 minute | Redis/in-memory |
| Latest values | No cache | Direct from `telemetry_latest` |
| Time-series (historical) | 1 hour | Client-side or CDN |
| Rankings | 5 minutes | Redis |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Actor | Auth Method | Permissions |
|-------|-------------|-------------|
| Dashboard (read) | API Key + RLS | Read-only access to permitted sites |
| MQTT Ingestion Service | Service Role Key | Write to telemetry tables only |
| Admin API | JWT + Role check | Full CRUD on all tables |
| Public (unauthenticated) | None | No access |

### 7.2 Row-Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Read policy for dashboard (anon key)
CREATE POLICY "Dashboard can read sites"
ON sites FOR SELECT
TO anon
USING (true); -- Or filter by user's allowed holdings

-- Write policy for ingestion service
CREATE POLICY "Ingestion can write telemetry"
ON telemetry FOR INSERT
TO service_role
WITH CHECK (true);

-- No direct write from dashboard
CREATE POLICY "Dashboard cannot write"
ON telemetry FOR INSERT
TO anon
WITH CHECK (false);
```

### 7.3 API Security

| Requirement | Implementation |
|-------------|----------------|
| CORS | Restrict to dashboard domain only |
| Rate limiting | 100 req/min for latest, 20 req/min for time-series |
| Input validation | Validate all query params (dates, IDs, metrics) |
| SQL injection | Use parameterized queries only |
| Data exposure | Never expose raw device IDs externally (mask last 4 chars) |

### 7.4 Ingestion Security

| Requirement | Implementation |
|-------------|----------------|
| MQTT TLS | Require TLS 1.2+ for broker connections |
| Service key rotation | Rotate service role key quarterly |
| Payload validation | Validate JSON schema before insert |
| Anomaly detection | Flag out-of-range values as `quality = 'suspect'` |

---

## 8. Implementation Notes

### 8.1 Migration Files Structure

```
supabase/migrations/
├── 20260112000001_create_holdings_brands.sql
├── 20260112000002_create_sites.sql
├── 20260112000003_create_devices.sql
├── 20260112000004_create_telemetry.sql
├── 20260112000005_create_telemetry_aggregates.sql
├── 20260112000006_create_site_kpis.sql
├── 20260112000007_create_events.sql
├── 20260112000008_create_water_tables.sql
├── 20260112000009_create_certifications.sql
├── 20260112000010_enable_rls_policies.sql
├── 20260112000011_create_functions.sql
└── 20260112000012_seed_initial_data.sql
```

### 8.2 Recommended Extensions

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Text search
CREATE EXTENSION IF NOT EXISTS "postgis";       -- Geo queries (optional)
-- CREATE EXTENSION IF NOT EXISTS "timescaledb"; -- Time-series optimization (if available)
```

### 8.3 MQTT Ingestion Service (External)

The ingestion service runs outside Supabase and:
1. Subscribes to MQTT topics
2. Parses incoming payloads (WEEL, LEED, PAN12, MSCHN formats)
3. Normalizes data to `(ts, device_id, metric, value, unit)` format
4. Batch inserts to `telemetry` table
5. Upserts to `telemetry_latest` table
6. Triggers alert checks for threshold violations

### 8.4 Next Steps

1. [ ] Create Supabase/Postgres database
2. [ ] Run migration scripts
3. [ ] Seed initial holdings/brands/sites data
4. [ ] Deploy ingestion service connecting to MQTT broker
5. [ ] Create Edge Functions for API endpoints
6. [ ] Update dashboard to consume real API data
7. [ ] Set up scheduled jobs for aggregations
8. [ ] Configure monitoring and alerting

---

*Document generated for FGB IoT Command Center*  
*Architecture: Portable Supabase/Postgres + External MQTT Ingestion*
