# FGB IoT - Metrics Catalog

> **Version:** 1.0.0  
> **Date:** 2026-01-15  
> **Status:** Active  
> **Purpose:** Standardized naming, units, and validation for all telemetry metrics

---

## Table of Contents

1. [Naming Convention](#1-naming-convention)
2. [Air Quality Metrics (iaq.*)](#2-air-quality-metrics-iaq)
3. [Energy Metrics (energy.*)](#3-energy-metrics-energy)
4. [Water Metrics (water.*)](#4-water-metrics-water)
5. [Environmental Metrics (env.*)](#5-environmental-metrics-env)
6. [MQTT Payload Mapping](#6-mqtt-payload-mapping)
7. [Validation Rules](#7-validation-rules)
8. [Dashboard Usage](#8-dashboard-usage)

---

## 1. Naming Convention

### Format
```
namespace.metric_name
```

### Namespaces

| Namespace | Description | Device Types |
|-----------|-------------|--------------|
| `iaq` | Indoor Air Quality | WEEL, LEED, air_quality |
| `energy` | Energy & Power | PAN12, MSCHN, energy_single, energy_three_phase |
| `water` | Water Consumption & Quality | water_meter, water_quality |
| `env` | Environmental (ambient) | weather_station, outdoor_sensor |

### Rules
- All lowercase, snake_case for multi-word metrics
- No special characters except underscore `_`
- Metric names are unique within namespace
- Unit suffixes avoided in metric names (unit stored separately)

---

## 2. Air Quality Metrics (iaq.*)

### Core IAQ Metrics

| Canonical Name | Unit | Description | Valid Range | Device Types | Dashboard Location |
|----------------|------|-------------|-------------|--------------|-------------------|
| `iaq.co2` | ppm | Carbon Dioxide concentration | 300–5000 | WEEL, LEED | Indoor Air Quality card, CO₂ Trend chart |
| `iaq.tvoc` | µg/m³ | Total Volatile Organic Compounds | 0–10000 | WEEL, LEED | Indoor Air Quality card, TVOC Trend chart |
| `iaq.temp` | °C | Indoor temperature | -10–50 | WEEL, LEED | Indoor Air Quality card, Temp/Humidity chart |
| `iaq.humidity` | % | Relative humidity | 0–100 | WEEL, LEED | Indoor Air Quality card, Temp/Humidity chart |
| `iaq.pm25` | µg/m³ | Particulate Matter ≤2.5µm | 0–500 | WEEL, LEED | Indoor Air Quality card, PM2.5 Indoor/Outdoor |
| `iaq.pm10` | µg/m³ | Particulate Matter ≤10µm | 0–600 | WEEL, LEED | Indoor Air Quality card, PM10 Indoor/Outdoor |
| `iaq.co` | ppm | Carbon Monoxide | 0–100 | WEEL, LEED | Indoor Air Quality card, CO Level chart |
| `iaq.o3` | ppb | Ozone | 0–500 | WEEL, LEED | Indoor Air Quality card, O₃ Level chart |

### Extended IAQ Metrics

| Canonical Name | Unit | Description | Valid Range | Device Types | Dashboard Location |
|----------------|------|-------------|-------------|--------------|-------------------|
| `iaq.noise` | dB | Sound level | 20–120 | LEED | Extended metrics (optional) |
| `iaq.lux` | lx | Illuminance | 0–100000 | LEED | Extended metrics (optional) |
| `iaq.radon` | Bq/m³ | Radon concentration | 0–1000 | specialized | Extended metrics (optional) |

### IAQ Thresholds (for status evaluation)

| Metric | GOOD | OK | WARNING | CRITICAL |
|--------|------|----|---------|----------|
| `iaq.co2` | < 800 | 800–1000 | 1000–1500 | > 1500 |
| `iaq.tvoc` | < 250 | 250–500 | 500–1000 | > 1000 |
| `iaq.pm25` | < 12 | 12–35 | 35–55 | > 55 |
| `iaq.pm10` | < 50 | 50–100 | 100–150 | > 150 |
| `iaq.co` | < 4 | 4–9 | 9–15 | > 15 |
| `iaq.o3` | < 50 | 50–100 | 100–150 | > 150 |
| `iaq.temp` | 20–24 | 18–26 | 16–28 | <16 or >28 |
| `iaq.humidity` | 40–60 | 30–70 | 20–80 | <20 or >80 |

---

## 3. Energy Metrics (energy.*)

### Electrical Measurements

| Canonical Name | Unit | Description | Valid Range | Device Types | Dashboard Location |
|----------------|------|-------------|-------------|--------------|-------------------|
| `energy.current_a` | A | Phase A current | 0–100 | PAN12, MSCHN | Device details |
| `energy.current_b` | A | Phase B current | 0–100 | MSCHN | Device details |
| `energy.current_c` | A | Phase C current | 0–100 | MSCHN | Device details |
| `energy.voltage_a` | V | Phase A voltage | 180–260 | PAN12, MSCHN | Device details |
| `energy.voltage_b` | V | Phase B voltage | 180–260 | MSCHN | Device details |
| `energy.voltage_c` | V | Phase C voltage | 180–260 | MSCHN | Device details |

### Power & Energy

| Canonical Name | Unit | Description | Valid Range | Device Types | Dashboard Location |
|----------------|------|-------------|-------------|--------------|-------------------|
| `energy.power_kw` | kW | Active power | 0–1000 | PAN12, MSCHN | Real-time power, Energy Trend |
| `energy.energy_kwh` | kWh | Cumulative energy (counter) | 0–∞ | PAN12, MSCHN | Total Consumption, Distribution |
| `energy.power_factor` | - | Power factor (cosφ) | 0–1 | MSCHN | Device details |
| `energy.frequency` | Hz | Grid frequency | 49–51 | MSCHN | Device details |

### Computed/Aggregated Energy Metrics

| Canonical Name | Unit | Description | Aggregation | Dashboard Location |
|----------------|------|-------------|-------------|-------------------|
| `energy.consumption_daily` | kWh | Daily consumption | sum(energy.energy_kwh) delta | Daily charts |
| `energy.consumption_monthly` | kWh | Monthly consumption | sum(daily) | Monthly charts |
| `energy.density_kwh_m2` | kWh/m² | Energy intensity | consumption / area_sqm | Actual vs Average |
| `energy.density_annual` | kWh/m²/anno | Annual energy density | yearly / area_sqm | Densità energetica card |
| `energy.cost_eur` | € | Estimated cost | consumption × tariff | Costo Stimato card |
| `energy.co2_kg` | kg | CO₂ emissions | consumption × emission_factor | Carbon Footprint |

### Energy Categories (for distribution breakdown)

| Category Key | Description | Example Devices |
|--------------|-------------|-----------------|
| `hvac` | Heating, Ventilation, Air Conditioning | AC units, fans, heaters |
| `lighting` | Illumination | LED panels, spotlights |
| `plugs` | Plug loads / equipment | Computers, appliances |
| `other` | Uncategorized | Mixed loads |

---

## 4. Water Metrics (water.*)

### Consumption Metrics

| Canonical Name | Unit | Description | Valid Range | Device Types | Dashboard Location |
|----------------|------|-------------|-------------|--------------|-------------------|
| `water.flow_rate` | L/min | Instantaneous flow rate | 0–100 | water_meter | Real-time flow |
| `water.volume` | L | Cumulative volume (counter) | 0–∞ | water_meter | Total Consumption |
| `water.volume_m3` | m³ | Cumulative volume | 0–∞ | water_meter | Annual consumption |
| `water.pressure` | bar | Water pressure | 0–10 | water_meter | System status |

### Water Quality Metrics

| Canonical Name | Unit | Description | Valid Range | Device Types | Dashboard Location |
|----------------|------|-------------|-------------|--------------|-------------------|
| `water.ph` | pH | Acidity/alkalinity | 0–14 | water_quality | Water Quality chart, pH Indicator |
| `water.turbidity` | NTU | Clarity/cloudiness | 0–1000 | water_quality | Water Quality chart, Turbidity Indicator |
| `water.chlorine` | mg/L | Residual chlorine | 0–5 | water_quality | Water Quality chart, Chlorine Indicator |
| `water.temp` | °C | Water temperature | 0–100 | water_quality | Water Temperature card |
| `water.conductivity` | µS/cm | Electrical conductivity | 0–5000 | water_quality | Extended metrics |
| `water.tds` | mg/L | Total Dissolved Solids | 0–2000 | water_quality | Extended metrics |

### Water Quality Thresholds

| Metric | Optimal Range | Warning | Critical |
|--------|---------------|---------|----------|
| `water.ph` | 6.5–8.5 | 6.0–9.0 | <6.0 or >9.0 |
| `water.turbidity` | 0–1 | 1–5 | >5 |
| `water.chlorine` | 0.2–0.5 | 0.1–1.0 | <0.1 or >1.0 |

### Water Categories (for distribution breakdown)

| Category Key | Description |
|--------------|-------------|
| `sanitary` | Restrooms, sinks |
| `hvac_cooling` | HVAC cooling towers |
| `irrigation` | Landscape irrigation |
| `kitchen` | Kitchen/food service |
| `fountain` | Decorative fountains |
| `other` | Uncategorized |

---

## 5. Environmental Metrics (env.*)

| Canonical Name | Unit | Description | Valid Range | Device Types |
|----------------|------|-------------|-------------|--------------|
| `env.temp_outdoor` | °C | Outdoor temperature | -40–60 | weather_station |
| `env.humidity_outdoor` | % | Outdoor humidity | 0–100 | weather_station |
| `env.pm25_outdoor` | µg/m³ | Outdoor PM2.5 | 0–500 | outdoor_sensor |
| `env.pm10_outdoor` | µg/m³ | Outdoor PM10 | 0–600 | outdoor_sensor |
| `env.wind_speed` | m/s | Wind speed | 0–50 | weather_station |
| `env.precipitation` | mm | Rainfall | 0–100 | weather_station |
| `env.solar_radiation` | W/m² | Solar irradiance | 0–1500 | weather_station |

---

## 6. MQTT Payload Mapping

### Source Format → Canonical Metric

#### Air Quality (WEEL/LEED Models)

**Topic patterns:** `air/#`, `iaq/#`, `sensors/air/#`

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

| Payload Key | Canonical Metric | Transformation |
|-------------|------------------|----------------|
| `CO2`, `co2` | `iaq.co2` | direct |
| `VOC`, `voc`, `TVOC`, `tvoc` | `iaq.tvoc` | direct |
| `Temp`, `temp`, `temperature` | `iaq.temp` | direct |
| `Humidity`, `humidity` | `iaq.humidity` | direct |
| `PM2.5`, `pm25`, `PM25` | `iaq.pm25` | direct |
| `PM10`, `pm10` | `iaq.pm10` | direct |
| `CO`, `co` | `iaq.co` | direct |
| `O3`, `o3` | `iaq.o3` | direct |
| `noise`, `Noise` | `iaq.noise` | direct |
| `lux`, `Lux` | `iaq.lux` | direct |
| `radon`, `Radon` | `iaq.radon` | direct |

#### Energy - Single Phase (PAN12)

**Topic patterns:** `energy/#`, `power/#`, `sensors/energy/#`

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

| Payload Key | Canonical Metric | Transformation |
|-------------|------------------|----------------|
| `current_A`, `current_a` | `energy.current_a` | direct |
| `voltage_A`, `voltage_a` | `energy.voltage_a` | direct |
| `power_w`, `power_W` | `energy.power_kw` | ÷ 1000 |
| `power_kw`, `power_kW` | `energy.power_kw` | direct |
| `energy_kwh`, `energy_kWh` | `energy.energy_kwh` | direct |

#### Energy - Three Phase (MSCHN)

**Topic patterns:** `MSCHN/#`, `energy/3phase/#`

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

| Payload Key | Canonical Metric | Transformation |
|-------------|------------------|----------------|
| `I1` | `energy.current_a` | parseFloat |
| `I2` | `energy.current_b` | parseFloat |
| `I3` | `energy.current_c` | parseFloat |
| `V1` | `energy.voltage_a` | parseFloat |
| `V2` | `energy.voltage_b` | parseFloat |
| `V3` | `energy.voltage_c` | parseFloat |
| computed | `energy.power_kw` | (V1×I1 + V2×I2 + V3×I3) ÷ 1000 |

#### Water Meters

**Topic patterns:** `water/#`, `sensors/water/#`

```json
{
  "device_id": "WM-001",
  "timestamp": "2025-01-15T10:30:00Z",
  "flow_rate": 2.5,
  "total_volume": 15234.5,
  "pressure": 3.2,
  "temperature": 18.5
}
```

| Payload Key | Canonical Metric | Transformation |
|-------------|------------------|----------------|
| `flow_rate` | `water.flow_rate` | direct |
| `total_volume`, `volume` | `water.volume` | direct |
| `pressure` | `water.pressure` | direct |
| `temperature`, `temp` | `water.temp` | direct |

---

## 7. Validation Rules

### General Rules

```typescript
interface ValidationRule {
  metric: string;
  min?: number;
  max?: number;
  required: boolean;
  nullHandling: 'reject' | 'skip' | 'default';
  defaultValue?: number;
  qualityOnOutOfRange: 'suspect' | 'bad';
}
```

### Air Quality Validation

| Metric | Min | Max | Required | Null Handling | Out of Range |
|--------|-----|-----|----------|---------------|--------------|
| `iaq.co2` | 0 | 10000 | false | skip | suspect if 300< or >5000, bad if <0 |
| `iaq.tvoc` | 0 | 50000 | false | skip | suspect if >10000 |
| `iaq.temp` | -40 | 80 | false | skip | suspect if <-10 or >50 |
| `iaq.humidity` | 0 | 100 | false | skip | bad if <0 or >100 |
| `iaq.pm25` | 0 | 1000 | false | skip | suspect if >500 |
| `iaq.pm10` | 0 | 1000 | false | skip | suspect if >600 |
| `iaq.co` | 0 | 500 | false | skip | suspect if >100 |
| `iaq.o3` | 0 | 1000 | false | skip | suspect if >500 |

### Energy Validation

| Metric | Min | Max | Required | Null Handling | Out of Range |
|--------|-----|-----|----------|---------------|--------------|
| `energy.current_*` | 0 | 500 | false | skip | suspect if >100 |
| `energy.voltage_*` | 0 | 500 | false | skip | suspect if <180 or >260 |
| `energy.power_kw` | 0 | 10000 | false | skip | suspect if negative |
| `energy.energy_kwh` | 0 | ∞ | false | skip | bad if negative or decreasing |
| `energy.power_factor` | 0 | 1 | false | skip | bad if >1 |
| `energy.frequency` | 45 | 55 | false | skip | suspect if <49 or >51 |

### Water Validation

| Metric | Min | Max | Required | Null Handling | Out of Range |
|--------|-----|-----|----------|---------------|--------------|
| `water.flow_rate` | 0 | 1000 | false | skip | suspect if >100 |
| `water.volume` | 0 | ∞ | false | skip | bad if negative or decreasing |
| `water.pressure` | 0 | 20 | false | skip | suspect if >10 |
| `water.ph` | 0 | 14 | false | skip | bad if outside 0–14 |
| `water.turbidity` | 0 | 10000 | false | skip | suspect if >1000 |
| `water.chlorine` | 0 | 10 | false | skip | suspect if >5 |

### Quality Flags

| Quality | Meaning | Action |
|---------|---------|--------|
| `good` | Value within expected range | Display normally |
| `suspect` | Value outside typical range but possible | Display with warning indicator |
| `bad` | Value invalid or impossible | Exclude from aggregations |

---

## 8. Dashboard Usage

### Metric to UI Component Mapping

#### Overview Section

| UI Element | Metrics Used | Aggregation |
|------------|--------------|-------------|
| Overall Performance | weighted(energy, air, water scores) | site-level |
| Energy Status | `energy.power_kw`, `energy.energy_kwh` | site-level latest |
| Air Quality Status | `iaq.co2`, `iaq.tvoc`, `iaq.pm25`, `iaq.pm10` | site-level latest |
| Water Status | `water.flow_rate`, `water.volume` | site-level latest |

#### Energy Dashboard

| UI Element | Metrics Used | Time Range |
|------------|--------------|------------|
| Total Consumption | `energy.energy_kwh` | selected period |
| Actual vs Average | `energy.density_kwh_m2` | selected period |
| Distribution Pie | `energy.energy_kwh` by category | selected period |
| Device Consumption | `energy.energy_kwh` by device | selected period |
| Carbon Footprint | `energy.co2_kg` | monthly |
| Energy Trend | `energy.power_kw` | hourly/daily |

#### Air Quality Dashboard

| UI Element | Metrics Used | Time Range |
|------------|--------------|------------|
| Indoor Air Quality Card | all `iaq.*` metrics | live |
| CO₂ Trend | `iaq.co2` | 24h hourly |
| TVOC Trend | `iaq.tvoc` | 24h hourly |
| PM2.5 Indoor/Outdoor | `iaq.pm25`, `env.pm25_outdoor` | weekly daily |
| PM10 Indoor/Outdoor | `iaq.pm10`, `env.pm10_outdoor` | weekly daily |
| CO Level | `iaq.co` | 24h hourly |
| O₃ Level | `iaq.o3` | 24h hourly |

#### Water Dashboard

| UI Element | Metrics Used | Time Range |
|------------|--------------|------------|
| Total Consumption | `water.volume_m3` | annual |
| Consumption Trend | `water.volume` | monthly |
| Daily Trend | `water.flow_rate`, `water.volume` | hourly |
| Water Quality | `water.ph`, `water.turbidity`, `water.chlorine` | hourly |
| Quality Indicators | `water.ph`, `water.turbidity`, `water.chlorine` | live |

---

## Appendix A: Database Column Mapping

When storing in `telemetry` table, the `metric` column uses the canonical name **without namespace prefix** for backward compatibility:

| Canonical Name | DB `metric` Column | DB `unit` Column |
|----------------|-------------------|------------------|
| `iaq.co2` | `co2` | `ppm` |
| `iaq.tvoc` | `voc` | `µg/m³` |
| `iaq.temp` | `temp` | `°C` |
| `energy.current_a` | `current_a` | `A` |
| `energy.power_kw` | `power_kw` | `kW` |
| `water.flow_rate` | `flow_rate` | `L/min` |

> **Migration Note:** Future versions may migrate to full canonical names in DB for consistency.

---

## Appendix B: Example Queries

### Get latest IAQ readings for a site
```sql
SELECT tl.metric, tl.value, tl.unit, tl.ts
FROM telemetry_latest tl
JOIN devices d ON tl.device_id = d.id
WHERE d.site_id = $site_id
  AND d.device_type = 'air_quality'
  AND tl.metric IN ('co2', 'voc', 'temp', 'humidity', 'pm25', 'pm10', 'co', 'o3');
```

### Get hourly energy consumption for a site
```sql
SELECT th.bucket, SUM(th.sum_value) as total_kwh
FROM telemetry_hourly th
JOIN devices d ON th.device_id = d.id
WHERE d.site_id = $site_id
  AND d.device_type IN ('energy_single', 'energy_three_phase')
  AND th.metric = 'energy_kwh'
  AND th.bucket BETWEEN $start AND $end
GROUP BY th.bucket
ORDER BY th.bucket;
```

---

*Document generated: 2026-01-15 | FGB IoT Platform*
