# FGB MQTT Ingestion Service

Servizio Node.js TypeScript per l'ingestione di dati IoT da MQTT a Supabase.

## Features

- **3 Parser specifici**:
  - `fosensor/iaq` - Sensori qualità aria (WEEL, LEED)
  - `bridge/*/slot*/reading` - Sensori energia monofase (PAN12)
  - `MSCHN/misure` - Sensori energia trifase (MSCHN)
- **Naming canonico** secondo `metrics_catalog.md` (es. `iaq.co2`, `energy.power_kw`)
- **Validazione range** con quality flags (`good`, `suspect`)
- **Auto-registrazione device** con `DEFAULT_SITE_ID`
- **Retry con exponential backoff**
- **Buffering batch** per performance
- **Health check + Prometheus metrics**

## Quick Start

```bash
# 1. Clona il repo e entra nella cartella
cd mqtt-ingestion

# 2. Configura environment
cp .env.example .env
# Edita .env con le tue credenziali Supabase

# 3. Avvia con Docker Compose
docker-compose up -d

# 4. Verifica health
curl http://localhost:3001/health
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ✅ | - | URL del progetto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | - | Service role key (con permessi write) |
| `MQTT_BROKER_URL` | ❌ | `mqtt://mosquitto:1883` | URL broker MQTT |
| `MQTT_USERNAME` | ❌ | - | Username MQTT (se richiesto) |
| `MQTT_PASSWORD` | ❌ | - | Password MQTT |
| `MQTT_TOPICS` | ❌ | `fosensor/#,bridge/#,MSCHN/#` | Topic da sottoscrivere |
| `DEFAULT_SITE_ID` | ❌ | - | UUID site per auto-registrazione device |
| `BATCH_SIZE` | ❌ | `100` | Dimensione batch insert |
| `BATCH_INTERVAL_MS` | ❌ | `5000` | Intervallo flush buffer (ms) |
| `MAX_RETRIES` | ❌ | `5` | Tentativi retry su errore |
| `RETRY_BASE_DELAY_MS` | ❌ | `1000` | Delay base per exponential backoff |
| `LOG_LEVEL` | ❌ | `info` | Livello log (debug, info, warn, error) |
| `PORT` | ❌ | `3001` | Porta health server |

## Payload Formats

### Air Quality (fosensor/iaq)
```json
{
  "Timestamp": "2025-12-31 23:59:49",
  "Broker": "cert.gwext.coolprojects.it",
  "DeviceID": "******0076",
  "MAC": "********DD8A",
  "Model": "WEEL",
  "VOC": 373, "CO2": 776, "Temp": 21.1, "Humidity": 16.3,
  "O3": 20.0, "CO": 0.0, "PM2.5": 0.0, "PM10": 0.0
}
```

### Energy Single Phase (bridge/*/slot*/reading)
```json
{
  "Timestamp": "2025-12-01 00:00:05",
  "Broker": "data.hub.fgb-studio.com",
  "Topic": "bridge/Milan-office-bridge01/slot0/reading",
  "sensor_sn": "******771",
  "type": "PAN12",
  "ts": 1764543602,
  "current_A": 1.582,
  "rssi_dBm": -62.0
}
```

### Energy Three Phase (MSCHN/misure)
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

## Canonical Metric Mapping

| Raw Field | Canonical Metric | Unit |
|-----------|------------------|------|
| `CO2` | `iaq.co2` | ppm |
| `VOC` | `iaq.voc` | µg/m³ |
| `Temp` | `env.temperature` | °C |
| `Humidity` | `env.humidity` | % |
| `current_A` | `energy.current_a` | A |
| `I1/I2/I3` | `energy.current_l1/l2/l3` | A |
| `V1/V2/V3` | `energy.voltage_l1/l2/l3` | V |

See `metrics_catalog.md` for complete list.

## Endpoints

### GET /health
```json
{
  "status": "ok",
  "mqtt": { "connected": true, "broker": "mqtt://mosquitto:1883" },
  "buffer": { "size": 42, "maxSize": 10000 },
  "stats": {
    "messagesReceived": 1234,
    "pointsBuffered": 5678,
    "pointsInserted": 5600,
    "insertErrors": 0,
    "devicesRegistered": 12
  }
}
```

### GET /metrics (Prometheus format)
```
mqtt_messages_received_total 1234
telemetry_points_buffered_total 5678
telemetry_points_inserted_total 5600
telemetry_insert_errors_total 0
devices_registered_total 12
telemetry_buffer_size 42
device_cache_size 15
```

## Development

```bash
# Install dependencies
npm install

# Run locally (requires .env)
npm run dev

# Build
npm run build

# Run production
npm start
```

## Docker Commands

```bash
# Start service + Mosquitto
docker-compose up -d

# View logs
docker-compose logs -f mqtt-ingestion

# Restart after config change
docker-compose restart mqtt-ingestion

# Stop all
docker-compose down
```

## Troubleshooting

### Device not being registered
- Verifica che `DEFAULT_SITE_ID` sia configurato con un UUID valido di un site esistente
- Controlla i log: `docker-compose logs mqtt-ingestion | grep "Device not found"`

### Messages not being parsed
- Abilita `LOG_LEVEL=debug` per vedere tutti i messaggi
- Verifica che il topic matchi uno dei pattern: `fosensor/*`, `bridge/*/slot*/reading`, `MSCHN/*`

### Insert errors
- Controlla la connessione Supabase nel health check
- Verifica che le migration siano state applicate
- Controlla i permessi della SERVICE_ROLE_KEY


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
