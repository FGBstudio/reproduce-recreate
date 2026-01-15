# FGB MQTT Ingestion Service

Dockerized service that subscribes to MQTT topics and writes telemetry data to Supabase.

## Features

- **Batch Inserts**: Buffers messages and inserts in batches for efficiency
- **Multi-Protocol**: Supports air quality, energy, and water sensor payloads
- **Device Resolution**: Maps external device IDs to Supabase UUIDs
- **Health Endpoint**: `/health` and `/metrics` endpoints for monitoring
- **Graceful Shutdown**: Flushes buffer on SIGTERM

## Quick Start

1. Copy environment file:
```bash
cp .env.example .env
```

2. Configure your Supabase credentials in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Start with Docker Compose:
```bash
docker-compose up -d
```

## MQTT Payload Formats

### Air Quality (topic: `air/#` or `sensors/air/#`)
```json
{
  "device_id": "WEEL-001",
  "timestamp": "2025-01-15T10:30:00Z",
  "co2": 450,
  "voc": 120,
  "temp": 22.5,
  "humidity": 45,
  "pm25": 12,
  "pm10": 25,
  "co": 0.5,
  "o3": 15
}
```

### Energy (topic: `energy/#` or `sensors/energy/#`)
```json
{
  "device_id": "PAN12-001",
  "timestamp": "2025-01-15T10:30:00Z",
  "current_a": 12.5,
  "current_b": 11.8,
  "current_c": 12.1,
  "voltage_a": 230,
  "voltage_b": 231,
  "voltage_c": 229,
  "power_kw": 8.5,
  "energy_kwh": 1250.5,
  "power_factor": 0.95
}
```

### Water (topic: `water/#`)
```json
{
  "device_id": "WATER-001",
  "timestamp": "2025-01-15T10:30:00Z",
  "flow_rate": 5.2,
  "total_volume": 1500,
  "pressure": 2.5,
  "temperature": 18.5
}
```

## Device Registration

Devices must be registered in the `devices` table before data can be ingested:

```sql
INSERT INTO devices (site_id, device_id, model, device_type, broker, name)
VALUES (
  'your-site-uuid',
  'WEEL-001',
  'WEEL',
  'air_quality',
  'mqtt://mosquitto:1883',
  'Air Quality Sensor - Floor 1'
);
```

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Sensors   │────▶│  Mosquitto MQTT  │────▶│  Ingestion   │
│  (IoT/PLC)  │     │     Broker       │     │   Service    │
└─────────────┘     └──────────────────┘     └──────┬───────┘
                                                    │
                                                    ▼
                                             ┌──────────────┐
                                             │   Supabase   │
                                             │  PostgreSQL  │
                                             └──────────────┘
```

## Monitoring

- **Health Check**: `GET http://localhost:3001/health`
- **Metrics**: `GET http://localhost:3001/metrics`

## Production Considerations

1. **Security**: Configure MQTT authentication in `mosquitto.conf`
2. **TLS**: Add TLS for MQTT and enable SSL for Supabase connection
3. **Scaling**: Increase `BATCH_SIZE` for high-throughput scenarios
4. **Retention**: Configure `purge_old_telemetry()` cron job
