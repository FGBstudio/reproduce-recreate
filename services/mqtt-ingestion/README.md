# FGB MQTT Ingestion Service

Servizio Node.js/TypeScript che connette il broker MQTT a Supabase, salvando:
- **Raw messages** → tabella `mqtt_messages_raw` (audit log)
- **Telemetry normalizzata** → tabella `telemetry` (formato long con labels)

## Architettura

```
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│   MQTT Broker   │ ───▶ │  Ingestion Service  │ ───▶ │    Supabase     │
│ data.hub.fgb    │      │   (Node.js/Docker)  │      │   PostgreSQL    │
└─────────────────┘      └─────────────────────┘      └─────────────────┘
                                   │
                                   ▼
                         ┌─────────────────┐
                         │  Health Server  │
                         │  :3001/health   │
                         └─────────────────┘
```

## Topic Supportati

| Topic Pattern | Tipo Sensore | External ID | Metriche |
|--------------|--------------|-------------|----------|
| `bridge/+/+/reading` | Energy Monitor | bridge_name | current_a, rssi_dbm, status |
| `bridge/+/status` | Bridge Status | bridge_name | alive |
| `fosensor/iaq` | Air Quality | MAC.address | voc, co2, temp_c, humidity_rh, pm25, pm10 |
| `MSCHN/misure` | 3-Phase Energy | ID/DeviceID | i1-3_a, v1-3_v, energy_import/export_kwh |

## Quick Start

### 1. Configurazione

```bash
cd services/mqtt-ingestion
cp .env.example .env
# Modifica .env con le tue credenziali
```

### 2. Avvio con Docker

```bash
docker-compose up -d
```

### 3. Verifica

```bash
# Controlla i log
docker-compose logs -f

# Verifica health endpoint
curl http://localhost:3001/health
```

## Configurazione Ambiente

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `SUPABASE_URL` | URL del progetto Supabase | **Obbligatorio** |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (non anon!) | **Obbligatorio** |
| `MQTT_URL` | URL del broker MQTT | `mqtt://data.hub.fgb-studio.com` |
| `MQTT_PORT` | Porta MQTT | `1883` |
| `MQTT_USERNAME` | Username MQTT | - |
| `MQTT_PASSWORD` | Password MQTT | - |
| `MQTT_TOPICS` | Topic da sottoscrivere (comma-sep) | Tutti i pattern |
| `DEFAULT_SITE_ID` | UUID del site "Inbox" per nuovi device | - |
| `BATCH_SIZE` | Dimensione batch per insert | `100` |
| `BATCH_INTERVAL_MS` | Intervallo flush buffer (ms) | `5000` |
| `LOG_LEVEL` | Livello log (trace/debug/info/warn/error) | `info` |

## Labels per Telemetria

I dati vengono salvati con metadati in formato JSONB nella colonna `labels`:

### Energy (bridge)
```json
{
  "bridge_name": "PAN12_001",
  "circuit_key": "slot0",
  "group_key": "slot"
}
```

### Air Quality (fosensor)
```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "model": "WEEL"
}
```

### 3-Phase Energy (MSCHN)
```json
{
  "mschn_id": "12345"
}
```

## Validazione Dati

Il servizio valida automaticamente i valori:
- Valori placeholder (es. -55555) vengono scartati
- Valori fuori range ricevono `quality='invalid'`
- Range definiti per ogni metrica (vedi `VALID_RANGES` nel codice)

## Device Auto-Registration

Se un device non esiste nel database:
1. Se `DEFAULT_SITE_ID` è configurato → crea automaticamente il device
2. Se non configurato → messaggio salvato solo in `raw`, non in `telemetry`

## Endpoints

### GET /health
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "stats": {
    "messagesReceived": 1234,
    "messagesProcessed": 1200,
    "messagesFailed": 34,
    "telemetryInserted": 5000,
    "rawInserted": 1234
  },
  "buffers": {
    "raw": 12,
    "telemetry": 45
  }
}
```

### GET /metrics
Prometheus-compatible metrics.

## Sviluppo Locale

```bash
# Installa dipendenze
npm install

# Avvia in dev mode
npm run dev

# Build
npm run build

# Start production
npm start
```

## Comandi Docker

```bash
# Avvia
docker-compose up -d

# Logs in tempo reale
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Rebuild dopo modifiche
docker-compose up -d --build
```

## Verifica in Supabase

### 1. Controlla raw messages
```sql
SELECT * FROM mqtt_messages_raw 
ORDER BY received_at DESC 
LIMIT 10;
```

### 2. Controlla telemetry
```sql
SELECT 
  ts, 
  metric, 
  value, 
  unit, 
  labels
FROM telemetry 
ORDER BY ts DESC 
LIMIT 20;
```

### 3. Controlla device auto-creati
```sql
SELECT * FROM devices 
WHERE metadata->>'auto_created' = 'true'
ORDER BY created_at DESC;
```

## Troubleshooting

### "Failed to connect to Supabase"
- Verifica `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
- Assicurati di usare il Service Role Key, non l'anon key

### "Device not found and DEFAULT_SITE_ID not set"
- Configura `DEFAULT_SITE_ID` con l'UUID di un site "Inbox"
- Oppure pre-registra i device manualmente

### Nessun dato in telemetry
- Controlla `mqtt_messages_raw.processed = false` per errori
- Verifica che i payload matchino i pattern attesi
- Controlla `mqtt_messages_raw.error_message`

## Sicurezza

⚠️ **IMPORTANTE**: 
- Il `SUPABASE_SERVICE_ROLE_KEY` ha accesso completo al database
- Non committare mai il file `.env` nel repository
- Questo servizio deve girare SOLO su server sicuri, MAI nel frontend
