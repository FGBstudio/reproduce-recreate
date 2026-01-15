import mqtt, { MqttClient } from 'mqtt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express from 'express';
import pino from 'pino';
import { z } from 'zod';

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

// Environment validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  MQTT_BROKER_URL: z.string().default('mqtt://localhost:1883'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TOPICS: z.string().default('fosensor/#,bridge/#,MSCHN/#'),
  DEFAULT_SITE_ID: z.string().uuid().optional(), // Fallback site for auto-registered devices
  BATCH_SIZE: z.string().transform(Number).default('100'),
  BATCH_INTERVAL_MS: z.string().transform(Number).default('5000'),
  PORT: z.string().transform(Number).default('3001'),
  MAX_RETRIES: z.string().transform(Number).default('5'),
  RETRY_BASE_DELAY_MS: z.string().transform(Number).default('1000'),
});

const env = envSchema.parse(process.env);

// Supabase client with service role key
const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// TYPES
// ============================================================
interface TelemetryPoint {
  device_id: string; // UUID from devices table
  ts: string;
  metric: string;
  value: number;
  unit?: string;
  quality?: string;
  raw_payload?: object;
}

interface DeviceInfo {
  externalId: string;
  broker: string;
  model: string;
  deviceType: 'air_quality' | 'energy_monitor' | 'water_meter';
  mac?: string;
  rssi?: number;
}

interface ParseResult {
  device: DeviceInfo;
  points: Omit<TelemetryPoint, 'device_id'>[];
}

// ============================================================
// CACHES & STATE
// ============================================================
let telemetryBuffer: TelemetryPoint[] = [];
const deviceCache: Map<string, string> = new Map(); // externalId:broker -> uuid
let mqttClient: MqttClient | null = null;

// Stats
const stats = {
  messagesReceived: 0,
  pointsBuffered: 0,
  pointsInserted: 0,
  insertErrors: 0,
  devicesRegistered: 0,
  lastFlush: new Date().toISOString(),
};

// ============================================================
// CANONICAL METRIC MAPPING (from metrics_catalog.md)
// ============================================================
const METRIC_MAP: Record<string, { canonical: string; unit: string }> = {
  // IAQ metrics
  'CO2': { canonical: 'iaq.co2', unit: 'ppm' },
  'co2': { canonical: 'iaq.co2', unit: 'ppm' },
  'VOC': { canonical: 'iaq.voc', unit: 'µg/m³' },
  'voc': { canonical: 'iaq.voc', unit: 'µg/m³' },
  'TVOC': { canonical: 'iaq.voc', unit: 'µg/m³' },
  'PM2.5': { canonical: 'iaq.pm25', unit: 'µg/m³' },
  'pm25': { canonical: 'iaq.pm25', unit: 'µg/m³' },
  'PM10': { canonical: 'iaq.pm10', unit: 'µg/m³' },
  'pm10': { canonical: 'iaq.pm10', unit: 'µg/m³' },
  'CO': { canonical: 'iaq.co', unit: 'ppm' },
  'co': { canonical: 'iaq.co', unit: 'ppm' },
  'O3': { canonical: 'iaq.o3', unit: 'ppb' },
  'o3': { canonical: 'iaq.o3', unit: 'ppb' },
  
  // Environment metrics
  'Temp': { canonical: 'env.temperature', unit: '°C' },
  'temp': { canonical: 'env.temperature', unit: '°C' },
  'temperature': { canonical: 'env.temperature', unit: '°C' },
  'Humidity': { canonical: 'env.humidity', unit: '%' },
  'humidity': { canonical: 'env.humidity', unit: '%' },
  'noise': { canonical: 'env.noise', unit: 'dB' },
  'lux': { canonical: 'env.illuminance', unit: 'lx' },
  
  // Energy metrics
  'current_A': { canonical: 'energy.current_a', unit: 'A' },
  'current_a': { canonical: 'energy.current_a', unit: 'A' },
  'I1': { canonical: 'energy.current_l1', unit: 'A' },
  'I2': { canonical: 'energy.current_l2', unit: 'A' },
  'I3': { canonical: 'energy.current_l3', unit: 'A' },
  'V1': { canonical: 'energy.voltage_l1', unit: 'V' },
  'V2': { canonical: 'energy.voltage_l2', unit: 'V' },
  'V3': { canonical: 'energy.voltage_l3', unit: 'V' },
  'power_w': { canonical: 'energy.power_kw', unit: 'kW' }, // Will transform
  'power_kw': { canonical: 'energy.power_kw', unit: 'kW' },
  'energy_kwh': { canonical: 'energy.active_import_kwh', unit: 'kWh' },
  
  // Water metrics
  'flow_rate': { canonical: 'water.flow_rate', unit: 'L/min' },
  'total_volume': { canonical: 'water.consumption', unit: 'm³' },
};

// ============================================================
// VALIDATION RANGES (from metrics_catalog.md)
// ============================================================
const VALIDATION_RANGES: Record<string, { min: number; max: number }> = {
  'iaq.co2': { min: 300, max: 10000 },
  'iaq.voc': { min: 0, max: 30000 },
  'iaq.pm25': { min: 0, max: 1000 },
  'iaq.pm10': { min: 0, max: 2000 },
  'iaq.co': { min: 0, max: 500 },
  'iaq.o3': { min: 0, max: 1000 },
  'env.temperature': { min: -40, max: 85 },
  'env.humidity': { min: 0, max: 100 },
  'energy.current_a': { min: 0, max: 1000 },
  'energy.current_l1': { min: 0, max: 1000 },
  'energy.current_l2': { min: 0, max: 1000 },
  'energy.current_l3': { min: 0, max: 1000 },
  'energy.voltage_l1': { min: 0, max: 500 },
  'energy.voltage_l2': { min: 0, max: 500 },
  'energy.voltage_l3': { min: 0, max: 500 },
  'energy.power_kw': { min: 0, max: 10000 },
};

function validateValue(metric: string, value: number): 'good' | 'suspect' | 'bad' {
  const range = VALIDATION_RANGES[metric];
  if (!range) return 'good';
  if (value < range.min || value > range.max) return 'suspect';
  return 'good';
}

// ============================================================
// PARSERS FOR SPECIFIC FORMATS
// ============================================================

/**
 * Parser 1: Air Quality (WEEL/LEED) - fosensor/iaq topic
 * Example payload:
 * {
 *   "Timestamp": "2025-12-31 23:59:49",
 *   "Broker": "cert.gwext.coolprojects.it",
 *   "DeviceID": "******0076",
 *   "MAC": "********DD8A",
 *   "Model": "WEEL",
 *   "VOC": 373, "CO2": 776, "Temp": 21.1, "Humidity": 16.3,
 *   "O3": 20.0, "CO": 0.0, "PM2.5": 0.0, "PM10": 0.0
 * }
 */
function parseAirQuality(topic: string, payload: Record<string, any>): ParseResult | null {
  const deviceId = payload.DeviceID || payload.device_id;
  if (!deviceId) {
    logger.warn({ topic }, 'Air quality payload missing DeviceID');
    return null;
  }

  const timestamp = parseTimestamp(payload.Timestamp || payload.timestamp);
  const broker = payload.Broker || env.MQTT_BROKER_URL;
  
  const device: DeviceInfo = {
    externalId: deviceId,
    broker,
    model: payload.Model || 'UNKNOWN',
    deviceType: 'air_quality',
    mac: payload.MAC,
  };

  const points: Omit<TelemetryPoint, 'device_id'>[] = [];
  
  // Map each metric
  const metricsToExtract = ['CO2', 'VOC', 'Temp', 'Humidity', 'O3', 'CO', 'PM2.5', 'PM10'];
  for (const key of metricsToExtract) {
    const value = payload[key];
    if (value !== undefined && value !== null && typeof value === 'number') {
      const mapping = METRIC_MAP[key];
      if (mapping) {
        const quality = validateValue(mapping.canonical, value);
        points.push({
          ts: timestamp,
          metric: mapping.canonical,
          value,
          unit: mapping.unit,
          quality,
          raw_payload: payload,
        });
      }
    }
  }

  return points.length > 0 ? { device, points } : null;
}

/**
 * Parser 2: Energy Single Phase (PAN12) - bridge/*/slot*/reading topic
 * Example payload:
 * {
 *   "Timestamp": "2025-12-01 00:00:05",
 *   "Broker": "data.hub.fgb-studio.com",
 *   "Topic": "bridge/Milan-office-bridge01/slot0/reading",
 *   "status": 2.0,
 *   "sensor_sn": "******771",
 *   "type": "PAN12",
 *   "ts": 1764543602,
 *   "current_A": 1.582,
 *   "rssi_dBm": -62.0
 * }
 */
function parseEnergyPAN12(topic: string, payload: Record<string, any>): ParseResult | null {
  const deviceId = payload.sensor_sn || payload.device_id;
  if (!deviceId) {
    logger.warn({ topic }, 'PAN12 payload missing sensor_sn');
    return null;
  }

  // Parse timestamp - could be unix epoch or ISO string
  let timestamp: string;
  if (payload.ts && typeof payload.ts === 'number') {
    timestamp = new Date(payload.ts * 1000).toISOString();
  } else {
    timestamp = parseTimestamp(payload.Timestamp || payload.timestamp);
  }

  const broker = payload.Broker || env.MQTT_BROKER_URL;
  
  const device: DeviceInfo = {
    externalId: deviceId,
    broker,
    model: payload.type || 'PAN12',
    deviceType: 'energy_monitor',
    rssi: payload.rssi_dBm,
  };

  const points: Omit<TelemetryPoint, 'device_id'>[] = [];
  
  // Current (single phase)
  if (payload.current_A !== undefined) {
    const value = parseFloat(payload.current_A);
    const quality = validateValue('energy.current_a', value);
    points.push({
      ts: timestamp,
      metric: 'energy.current_a',
      value,
      unit: 'A',
      quality,
      raw_payload: payload,
    });
  }

  return points.length > 0 ? { device, points } : null;
}

/**
 * Parser 3: Energy Three Phase (MSCHN) - MSCHN/misure topic
 * Example payload:
 * {
 *   "Timestamp": "2025-12-03 15:00:01",
 *   "Broker": "cert.gwext.coolprojects.it",
 *   "Topic": "MSCHN/misure",
 *   "I1": "7.18", "I2": "6.99", "I3": "7.55",
 *   "V1": "222.02", "V2": "222.61", "V3": "222.75",
 *   "ID": "********C8CF",
 *   "time": "2025-12-03 22:00:00"
 * }
 */
function parseEnergyMSCHN(topic: string, payload: Record<string, any>): ParseResult | null {
  const deviceId = payload.ID || payload.device_id;
  if (!deviceId) {
    logger.warn({ topic }, 'MSCHN payload missing ID');
    return null;
  }

  const timestamp = parseTimestamp(payload.time || payload.Timestamp || payload.timestamp);
  const broker = payload.Broker || env.MQTT_BROKER_URL;
  
  const device: DeviceInfo = {
    externalId: deviceId,
    broker,
    model: 'MSCHN',
    deviceType: 'energy_monitor',
  };

  const points: Omit<TelemetryPoint, 'device_id'>[] = [];
  
  // Three-phase currents
  for (const phase of ['I1', 'I2', 'I3']) {
    const rawValue = payload[phase];
    if (rawValue !== undefined) {
      const value = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
      if (!isNaN(value)) {
        const mapping = METRIC_MAP[phase];
        const quality = validateValue(mapping?.canonical || 'energy.current_l1', value);
        points.push({
          ts: timestamp,
          metric: mapping?.canonical || `energy.current_${phase.toLowerCase()}`,
          value,
          unit: 'A',
          quality,
          raw_payload: payload,
        });
      }
    }
  }
  
  // Three-phase voltages
  for (const phase of ['V1', 'V2', 'V3']) {
    const rawValue = payload[phase];
    if (rawValue !== undefined) {
      const value = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
      if (!isNaN(value)) {
        const mapping = METRIC_MAP[phase];
        const quality = validateValue(mapping?.canonical || 'energy.voltage_l1', value);
        points.push({
          ts: timestamp,
          metric: mapping?.canonical || `energy.voltage_${phase.toLowerCase()}`,
          value,
          unit: 'V',
          quality,
          raw_payload: payload,
        });
      }
    }
  }

  // Calculate total power if all phases present
  const i1 = parseFloat(payload.I1);
  const i2 = parseFloat(payload.I2);
  const i3 = parseFloat(payload.I3);
  const v1 = parseFloat(payload.V1);
  const v2 = parseFloat(payload.V2);
  const v3 = parseFloat(payload.V3);
  
  if (!isNaN(i1) && !isNaN(i2) && !isNaN(i3) && !isNaN(v1) && !isNaN(v2) && !isNaN(v3)) {
    // Approximate total power (assumes PF=1 for simplicity)
    const totalPowerW = (i1 * v1) + (i2 * v2) + (i3 * v3);
    const totalPowerKW = totalPowerW / 1000;
    const quality = validateValue('energy.power_kw', totalPowerKW);
    points.push({
      ts: timestamp,
      metric: 'energy.power_kw',
      value: Math.round(totalPowerKW * 1000) / 1000,
      unit: 'kW',
      quality,
      raw_payload: payload,
    });
  }

  return points.length > 0 ? { device, points } : null;
}

// ============================================================
// HELPERS
// ============================================================

function parseTimestamp(ts: string | number | undefined): string {
  if (!ts) return new Date().toISOString();
  
  if (typeof ts === 'number') {
    // Unix timestamp (seconds or milliseconds)
    const multiplier = ts > 1e12 ? 1 : 1000;
    return new Date(ts * multiplier).toISOString();
  }
  
  // Try parsing as date string (handles "2025-12-31 23:59:49" format)
  const parsed = new Date(ts.replace(' ', 'T'));
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function matchTopicPattern(topic: string): 'air_quality' | 'pan12' | 'mschn' | null {
  // fosensor/iaq or air quality topics
  if (topic.includes('fosensor') || topic.includes('iaq') || topic.includes('air')) {
    return 'air_quality';
  }
  
  // bridge/*/slot*/reading pattern for PAN12
  if (/bridge\/[^/]+\/slot\d+\/reading/.test(topic)) {
    return 'pan12';
  }
  
  // MSCHN/misure
  if (topic.includes('MSCHN') || topic.includes('mschn')) {
    return 'mschn';
  }
  
  return null;
}

// ============================================================
// DEVICE MANAGEMENT
// ============================================================

async function upsertDevice(info: DeviceInfo): Promise<string | null> {
  const cacheKey = `${info.externalId}:${info.broker}`;
  
  if (deviceCache.has(cacheKey)) {
    return deviceCache.get(cacheKey)!;
  }

  // Try to find existing device
  const { data: existing, error: findError } = await supabase
    .from('devices')
    .select('id')
    .eq('device_id', info.externalId)
    .eq('broker', info.broker)
    .maybeSingle();

  if (findError) {
    logger.error({ error: findError, deviceId: info.externalId }, 'Failed to lookup device');
    return null;
  }

  if (existing) {
    deviceCache.set(cacheKey, existing.id);
    
    // Update device info (last_seen, rssi, etc.)
    await supabase
      .from('devices')
      .update({
        last_seen: new Date().toISOString(),
        status: 'online',
        rssi_dbm: info.rssi,
        model: info.model,
      })
      .eq('id', existing.id);
      
    return existing.id;
  }

  // Auto-register new device if DEFAULT_SITE_ID is configured
  if (!env.DEFAULT_SITE_ID) {
    logger.warn({ deviceId: info.externalId, broker: info.broker }, 
      'Device not found and DEFAULT_SITE_ID not set - cannot auto-register');
    return null;
  }

  logger.info({ deviceId: info.externalId, model: info.model }, 'Auto-registering new device');
  
  const { data: newDevice, error: insertError } = await supabase
    .from('devices')
    .insert({
      site_id: env.DEFAULT_SITE_ID,
      device_id: info.externalId,
      broker: info.broker,
      model: info.model,
      device_type: info.deviceType,
      mac_address: info.mac,
      rssi_dbm: info.rssi,
      status: 'online',
      last_seen: new Date().toISOString(),
      name: `${info.model} - ${info.externalId.slice(-4)}`,
    })
    .select('id')
    .single();

  if (insertError) {
    logger.error({ error: insertError, deviceId: info.externalId }, 'Failed to auto-register device');
    return null;
  }

  deviceCache.set(cacheKey, newDevice.id);
  stats.devicesRegistered++;
  
  return newDevice.id;
}

// ============================================================
// BUFFER & FLUSH WITH RETRY
// ============================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= env.MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = env.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn({ 
        context, 
        attempt, 
        maxRetries: env.MAX_RETRIES, 
        delay,
        error: lastError.message 
      }, 'Operation failed, retrying...');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  logger.error({ context, error: lastError?.message }, 'All retry attempts failed');
  return null;
}

async function flushBuffer(): Promise<void> {
  if (telemetryBuffer.length === 0) return;

  const batch = telemetryBuffer.splice(0, env.BATCH_SIZE);
  const startTime = Date.now();
  
  logger.debug({ count: batch.length }, 'Flushing telemetry batch');

  const result = await withRetry(async () => {
    const { error } = await supabase
      .from('telemetry')
      .insert(batch);
    
    if (error) throw error;
    return true;
  }, 'telemetry_insert');

  if (result) {
    stats.pointsInserted += batch.length;
    stats.lastFlush = new Date().toISOString();
    logger.info({ 
      count: batch.length, 
      durationMs: Date.now() - startTime,
      remaining: telemetryBuffer.length 
    }, 'Inserted telemetry batch');
  } else {
    stats.insertErrors++;
    // Re-add failed items to buffer (with limit to prevent memory issues)
    if (telemetryBuffer.length < 10000) {
      telemetryBuffer.unshift(...batch);
      logger.warn({ count: batch.length }, 'Re-queued failed batch');
    } else {
      logger.error({ dropped: batch.length }, 'Buffer full, dropped failed batch');
    }
  }
}

// ============================================================
// MQTT CONNECTION WITH RECONNECT
// ============================================================

function connectMqtt(): MqttClient {
  const options: mqtt.IClientOptions = {
    clientId: `fgb-ingestion-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  };

  if (env.MQTT_USERNAME) {
    options.username = env.MQTT_USERNAME;
    options.password = env.MQTT_PASSWORD;
  }

  logger.info({ broker: env.MQTT_BROKER_URL }, 'Connecting to MQTT broker...');
  const client = mqtt.connect(env.MQTT_BROKER_URL, options);

  client.on('connect', () => {
    logger.info({ broker: env.MQTT_BROKER_URL }, '✓ Connected to MQTT broker');
    
    const topics = env.MQTT_TOPICS.split(',')
      .map(t => t.trim())
      .filter(t => !t.startsWith('$SYS')); // Exclude system topics
    
    topics.forEach(topic => {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          logger.error({ error: err.message, topic }, 'Failed to subscribe');
        } else {
          logger.info({ topic }, '✓ Subscribed to topic');
        }
      });
    });
  });

  client.on('message', async (topic, payloadBuf) => {
    // Skip system topics
    if (topic.startsWith('$SYS')) return;
    
    stats.messagesReceived++;
    
    try {
      const payload = JSON.parse(payloadBuf.toString());
      const topicType = matchTopicPattern(topic);
      
      let result: ParseResult | null = null;
      
      switch (topicType) {
        case 'air_quality':
          result = parseAirQuality(topic, payload);
          break;
        case 'pan12':
          result = parseEnergyPAN12(topic, payload);
          break;
        case 'mschn':
          result = parseEnergyMSCHN(topic, payload);
          break;
        default:
          logger.debug({ topic }, 'Unknown topic pattern, skipping');
          return;
      }
      
      if (!result) return;
      
      // Upsert device and get UUID
      const deviceUuid = await upsertDevice(result.device);
      if (!deviceUuid) return;
      
      // Add device UUID to points and buffer
      const points: TelemetryPoint[] = result.points.map(p => ({
        ...p,
        device_id: deviceUuid,
      }));
      
      telemetryBuffer.push(...points);
      stats.pointsBuffered += points.length;
      
      logger.debug({ 
        topic, 
        deviceId: result.device.externalId,
        points: points.length 
      }, 'Parsed message');
      
    } catch (error) {
      logger.error({ 
        error: (error as Error).message, 
        topic,
        payload: payloadBuf.toString().slice(0, 200)
      }, 'Failed to parse MQTT message');
    }
  });

  client.on('error', (err) => {
    logger.error({ error: err.message }, 'MQTT error');
  });

  client.on('offline', () => {
    logger.warn('MQTT client offline, will reconnect...');
  });

  client.on('reconnect', () => {
    logger.info('Attempting to reconnect to MQTT...');
  });

  return client;
}

// ============================================================
// HEALTH CHECK SERVER
// ============================================================

function startHealthServer(): void {
  const app = express();

  app.get('/health', (req, res) => {
    const healthy = mqttClient?.connected ?? false;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      mqtt: {
        connected: mqttClient?.connected ?? false,
        broker: env.MQTT_BROKER_URL,
      },
      buffer: {
        size: telemetryBuffer.length,
        maxSize: 10000,
      },
      stats: {
        ...stats,
        deviceCacheSize: deviceCache.size,
        uptime: process.uptime(),
      },
    });
  });

  app.get('/metrics', (req, res) => {
    // Prometheus-style metrics
    const lines = [
      `# HELP mqtt_messages_received_total Total MQTT messages received`,
      `# TYPE mqtt_messages_received_total counter`,
      `mqtt_messages_received_total ${stats.messagesReceived}`,
      `# HELP telemetry_points_buffered_total Total telemetry points buffered`,
      `# TYPE telemetry_points_buffered_total counter`,
      `telemetry_points_buffered_total ${stats.pointsBuffered}`,
      `# HELP telemetry_points_inserted_total Total telemetry points inserted`,
      `# TYPE telemetry_points_inserted_total counter`,
      `telemetry_points_inserted_total ${stats.pointsInserted}`,
      `# HELP telemetry_insert_errors_total Total insert errors`,
      `# TYPE telemetry_insert_errors_total counter`,
      `telemetry_insert_errors_total ${stats.insertErrors}`,
      `# HELP devices_registered_total Devices auto-registered`,
      `# TYPE devices_registered_total counter`,
      `devices_registered_total ${stats.devicesRegistered}`,
      `# HELP telemetry_buffer_size Current buffer size`,
      `# TYPE telemetry_buffer_size gauge`,
      `telemetry_buffer_size ${telemetryBuffer.length}`,
      `# HELP device_cache_size Device cache size`,
      `# TYPE device_cache_size gauge`,
      `device_cache_size ${deviceCache.size}`,
    ];
    res.type('text/plain').send(lines.join('\n'));
  });

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, '✓ Health server started');
  });
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  logger.info('═══════════════════════════════════════════');
  logger.info('  FGB MQTT Ingestion Service');
  logger.info('═══════════════════════════════════════════');

  // Verify Supabase connection
  const { error } = await supabase.from('devices').select('id').limit(1);
  if (error) {
    logger.error({ error: error.message }, 'Failed to connect to Supabase');
    process.exit(1);
  }
  logger.info({ url: env.SUPABASE_URL }, '✓ Connected to Supabase');

  // Start MQTT
  mqttClient = connectMqtt();

  // Start health server
  startHealthServer();

  // Periodic buffer flush
  setInterval(flushBuffer, env.BATCH_INTERVAL_MS);
  logger.info({ intervalMs: env.BATCH_INTERVAL_MS }, 'Buffer flush scheduled');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    
    // Stop accepting new messages
    mqttClient?.end(true);
    
    // Flush remaining buffer
    while (telemetryBuffer.length > 0) {
      await flushBuffer();
    }
    
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  logger.error({ error: (e as Error).message }, 'Fatal error');
  process.exit(1);
});
