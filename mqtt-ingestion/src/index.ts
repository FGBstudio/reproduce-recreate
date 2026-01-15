import mqtt, { MqttClient } from 'mqtt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express from 'express';
import pino from 'pino';
import { z } from 'zod';

// =============================================================================
// FGB MQTT Ingestion Service - SIMPLIFIED (Raw Insert Only)
// =============================================================================
// 
// This service performs MINIMAL processing:
// 1. Receive MQTT messages
// 2. Save raw JSON to mqtt_messages_raw (audit log)
// 3. Extract basic fields and insert to telemetry_raw (normalized)
// 4. Upsert device registry
//
// ALL heavy processing (power calculation, aggregation, downsampling) 
// happens in the DATABASE via SQL functions and scheduled jobs.
// =============================================================================

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
  DEFAULT_SITE_ID: z.string().uuid().optional(),
  BATCH_SIZE: z.string().transform(Number).default('100'),
  BATCH_INTERVAL_MS: z.string().transform(Number).default('5000'),
  PORT: z.string().transform(Number).default('3001'),
  MAX_RETRIES: z.string().transform(Number).default('5'),
  RETRY_BASE_DELAY_MS: z.string().transform(Number).default('1000'),
  SAVE_RAW_MESSAGES: z.string().transform(v => v === 'true').default('true'),
});

const env = envSchema.parse(process.env);

const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================================================================
// TYPES
// =============================================================================
interface RawMessage {
  received_at: string;
  broker: string;
  topic: string;
  payload: object;
  device_external_id?: string;
  source_type?: string;
}

interface TelemetryPoint {
  device_id: string;
  site_id?: string;
  ts: string;
  metric: string;
  value: number | null;
  unit?: string;
  labels?: object;
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
  points: Omit<TelemetryPoint, 'device_id' | 'site_id'>[];
  rawMessage: Omit<RawMessage, 'received_at'>;
}

// =============================================================================
// BUFFERS & CACHES
// =============================================================================
let telemetryBuffer: TelemetryPoint[] = [];
let rawMessageBuffer: RawMessage[] = [];
const deviceCache: Map<string, { uuid: string; site_id: string }> = new Map();
let mqttClient: MqttClient | null = null;

const stats = {
  messagesReceived: 0,
  pointsBuffered: 0,
  pointsInserted: 0,
  rawMessagesInserted: 0,
  insertErrors: 0,
  devicesRegistered: 0,
  lastFlush: new Date().toISOString(),
};

// =============================================================================
// METRIC MAPPING (Canonical Names from metrics_catalog.md)
// =============================================================================
const METRIC_MAP: Record<string, { canonical: string; unit: string }> = {
  // IAQ
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
  // Environment
  'Temp': { canonical: 'env.temperature', unit: '°C' },
  'temp': { canonical: 'env.temperature', unit: '°C' },
  'temperature': { canonical: 'env.temperature', unit: '°C' },
  'Humidity': { canonical: 'env.humidity', unit: '%' },
  'humidity': { canonical: 'env.humidity', unit: '%' },
  'noise': { canonical: 'env.noise', unit: 'dB' },
  'lux': { canonical: 'env.illuminance', unit: 'lx' },
  // Energy - Individual phases (NO power calculation here!)
  'current_A': { canonical: 'energy.current_a', unit: 'A' },
  'current_a': { canonical: 'energy.current_a', unit: 'A' },
  'I1': { canonical: 'energy.current_l1', unit: 'A' },
  'I2': { canonical: 'energy.current_l2', unit: 'A' },
  'I3': { canonical: 'energy.current_l3', unit: 'A' },
  'V1': { canonical: 'energy.voltage_l1', unit: 'V' },
  'V2': { canonical: 'energy.voltage_l2', unit: 'V' },
  'V3': { canonical: 'energy.voltage_l3', unit: 'V' },
  'PF1': { canonical: 'energy.pf_l1', unit: '' },
  'PF2': { canonical: 'energy.pf_l2', unit: '' },
  'PF3': { canonical: 'energy.pf_l3', unit: '' },
  // Pre-computed power (if source provides it)
  'power_w': { canonical: 'energy.power_w', unit: 'W' },
  'power_kw': { canonical: 'energy.power_kw', unit: 'kW' },
  'energy_kwh': { canonical: 'energy.active_import_kwh', unit: 'kWh' },
  // Water
  'flow_rate': { canonical: 'water.flow_rate', unit: 'L/min' },
  'total_volume': { canonical: 'water.consumption', unit: 'm³' },
};

// =============================================================================
// PARSERS - Extract fields, NO calculations
// =============================================================================

function parseTimestamp(ts: string | number | undefined): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'number') {
    const multiplier = ts > 1e12 ? 1 : 1000;
    return new Date(ts * multiplier).toISOString();
  }
  const parsed = new Date(ts.replace(' ', 'T'));
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function isValidValue(val: any): boolean {
  if (val === null || val === undefined) return false;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return false;
  // Detect placeholder values like -555555
  if (num < -100000 || num > 100000000) return false;
  return true;
}

function extractValue(val: any): number | null {
  if (!isValidValue(val)) return null;
  return typeof val === 'string' ? parseFloat(val) : val;
}

/**
 * Parser: Air Quality (WEEL/LEED) - fosensor/iaq topic
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

  const points: Omit<TelemetryPoint, 'device_id' | 'site_id'>[] = [];
  const metricsToExtract = ['CO2', 'VOC', 'Temp', 'Humidity', 'O3', 'CO', 'PM2.5', 'PM10'];
  
  for (const key of metricsToExtract) {
    const value = extractValue(payload[key]);
    if (value !== null) {
      const mapping = METRIC_MAP[key];
      if (mapping) {
        points.push({
          ts: timestamp,
          metric: mapping.canonical,
          value,
          unit: mapping.unit,
        });
      }
    }
  }

  return points.length > 0 ? {
    device,
    points,
    rawMessage: { broker, topic, payload, device_external_id: deviceId, source_type: 'fosensor' }
  } : null;
}

/**
 * Parser: Energy Single Phase (PAN12) - bridge/*/slot*/reading
 * Saves only raw current - NO power calculation!
 */
function parseEnergyPAN12(topic: string, payload: Record<string, any>): ParseResult | null {
  const deviceId = payload.sensor_sn || payload.device_id;
  if (!deviceId) {
    logger.warn({ topic }, 'PAN12 payload missing sensor_sn');
    return null;
  }

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

  const points: Omit<TelemetryPoint, 'device_id' | 'site_id'>[] = [];
  
  // Only extract current - power_kw will be computed by DB
  const current = extractValue(payload.current_A);
  if (current !== null) {
    points.push({
      ts: timestamp,
      metric: 'energy.current_a',
      value: current,
      unit: 'A',
    });
  }

  return points.length > 0 ? {
    device,
    points,
    rawMessage: { broker, topic, payload, device_external_id: deviceId, source_type: 'bridge' }
  } : null;
}

/**
 * Parser: Energy Three Phase (MSCHN) - MSCHN/misure
 * Saves I1,I2,I3,V1,V2,V3 individually - power_kw computed by DB!
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

  const points: Omit<TelemetryPoint, 'device_id' | 'site_id'>[] = [];
  
  // Extract individual phase values - NO power calculation here!
  const phaseMetrics = ['I1', 'I2', 'I3', 'V1', 'V2', 'V3', 'PF1', 'PF2', 'PF3'];
  
  for (const key of phaseMetrics) {
    const value = extractValue(payload[key]);
    if (value !== null) {
      const mapping = METRIC_MAP[key];
      if (mapping) {
        points.push({
          ts: timestamp,
          metric: mapping.canonical,
          value,
          unit: mapping.unit,
        });
      }
    }
  }

  return points.length > 0 ? {
    device,
    points,
    rawMessage: { broker, topic, payload, device_external_id: deviceId, source_type: 'mschn' }
  } : null;
}

function matchTopicPattern(topic: string): 'air_quality' | 'pan12' | 'mschn' | null {
  if (topic.includes('fosensor') || topic.includes('iaq') || topic.includes('air')) {
    return 'air_quality';
  }
  if (/bridge\/[^/]+\/slot\d+\/reading/.test(topic)) {
    return 'pan12';
  }
  if (topic.includes('MSCHN') || topic.includes('mschn')) {
    return 'mschn';
  }
  return null;
}

// =============================================================================
// DEVICE MANAGEMENT
// =============================================================================

async function upsertDevice(info: DeviceInfo): Promise<{ uuid: string; site_id: string } | null> {
  const cacheKey = `${info.externalId}:${info.broker}`;
  
  if (deviceCache.has(cacheKey)) {
    return deviceCache.get(cacheKey)!;
  }

  const { data: existing, error: findError } = await supabase
    .from('devices')
    .select('id, site_id')
    .eq('device_id', info.externalId)
    .eq('broker', info.broker)
    .maybeSingle();

  if (findError) {
    logger.error({ error: findError, deviceId: info.externalId }, 'Failed to lookup device');
    return null;
  }

  if (existing) {
    const result = { uuid: existing.id, site_id: existing.site_id };
    deviceCache.set(cacheKey, result);
    
    // Update device last_seen
    await supabase
      .from('devices')
      .update({
        last_seen: new Date().toISOString(),
        status: 'online',
        rssi_dbm: info.rssi,
        model: info.model,
      })
      .eq('id', existing.id);
      
    return result;
  }

  // Auto-register new device
  if (!env.DEFAULT_SITE_ID) {
    logger.warn({ deviceId: info.externalId, broker: info.broker }, 
      'Device not found and DEFAULT_SITE_ID not set');
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
    .select('id, site_id')
    .single();

  if (insertError) {
    logger.error({ error: insertError, deviceId: info.externalId }, 'Failed to auto-register device');
    return null;
  }

  const result = { uuid: newDevice.id, site_id: newDevice.site_id };
  deviceCache.set(cacheKey, result);
  stats.devicesRegistered++;
  
  return result;
}

// =============================================================================
// BUFFER & FLUSH WITH RETRY
// =============================================================================

async function withRetry<T>(fn: () => Promise<T>, context: string): Promise<T | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= env.MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = env.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn({ context, attempt, maxRetries: env.MAX_RETRIES, delay, error: lastError.message }, 
        'Operation failed, retrying...');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  logger.error({ context, error: lastError?.message }, 'All retry attempts failed');
  return null;
}

async function flushBuffers(): Promise<void> {
  const telemetryBatch = telemetryBuffer.splice(0, env.BATCH_SIZE);
  const rawBatch = rawMessageBuffer.splice(0, env.BATCH_SIZE);
  
  const startTime = Date.now();
  
  // Insert raw messages (audit log)
  if (rawBatch.length > 0 && env.SAVE_RAW_MESSAGES) {
    const result = await withRetry(async () => {
      const { error } = await supabase.from('mqtt_messages_raw').insert(rawBatch);
      if (error) throw error;
      return true;
    }, 'mqtt_raw_insert');
    
    if (result) {
      stats.rawMessagesInserted += rawBatch.length;
    }
  }
  
  // Insert telemetry
  if (telemetryBatch.length > 0) {
    logger.debug({ count: telemetryBatch.length }, 'Flushing telemetry batch');

    const result = await withRetry(async () => {
      const { error } = await supabase.from('telemetry').insert(telemetryBatch);
      if (error) throw error;
      return true;
    }, 'telemetry_insert');

    if (result) {
      stats.pointsInserted += telemetryBatch.length;
      stats.lastFlush = new Date().toISOString();
      logger.info({ 
        count: telemetryBatch.length, 
        durationMs: Date.now() - startTime,
        remaining: telemetryBuffer.length 
      }, 'Inserted telemetry batch');
    } else {
      stats.insertErrors++;
      if (telemetryBuffer.length < 10000) {
        telemetryBuffer.unshift(...telemetryBatch);
        logger.warn({ count: telemetryBatch.length }, 'Re-queued failed batch');
      } else {
        logger.error({ dropped: telemetryBatch.length }, 'Buffer full, dropped failed batch');
      }
    }
  }
}

// =============================================================================
// MQTT CONNECTION
// =============================================================================

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
      .filter(t => !t.startsWith('$SYS'));
    
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
      
      // Upsert device and get UUID + site_id
      const deviceInfo = await upsertDevice(result.device);
      if (!deviceInfo) return;
      
      // Add raw message to buffer
      if (env.SAVE_RAW_MESSAGES) {
        rawMessageBuffer.push({
          ...result.rawMessage,
          received_at: new Date().toISOString(),
        });
      }
      
      // Add telemetry points with device_id and site_id
      const points: TelemetryPoint[] = result.points.map(p => ({
        ...p,
        device_id: deviceInfo.uuid,
        site_id: deviceInfo.site_id,
      }));
      
      telemetryBuffer.push(...points);
      stats.pointsBuffered += points.length;
      
      logger.debug({ topic, deviceId: result.device.externalId, points: points.length }, 'Parsed message');
      
    } catch (error) {
      logger.error({ 
        error: (error as Error).message, 
        topic,
        payload: payloadBuf.toString().slice(0, 200)
      }, 'Failed to parse MQTT message');
    }
  });

  client.on('error', (err) => logger.error({ error: err.message }, 'MQTT error'));
  client.on('offline', () => logger.warn('MQTT client offline, will reconnect...'));
  client.on('reconnect', () => logger.info('Attempting to reconnect to MQTT...'));

  return client;
}

// =============================================================================
// HEALTH CHECK SERVER
// =============================================================================

function startHealthServer(): void {
  const app = express();

  app.get('/health', (req, res) => {
    const healthy = mqttClient?.connected ?? false;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      mqtt: { connected: mqttClient?.connected ?? false, broker: env.MQTT_BROKER_URL },
      buffer: { telemetry: telemetryBuffer.length, raw: rawMessageBuffer.length, maxSize: 10000 },
      stats: { ...stats, deviceCacheSize: deviceCache.size, uptime: process.uptime() },
    });
  });

  app.get('/metrics', (req, res) => {
    const lines = [
      `# HELP mqtt_messages_received_total Total MQTT messages received`,
      `# TYPE mqtt_messages_received_total counter`,
      `mqtt_messages_received_total ${stats.messagesReceived}`,
      `# HELP telemetry_points_inserted_total Total telemetry points inserted`,
      `# TYPE telemetry_points_inserted_total counter`,
      `telemetry_points_inserted_total ${stats.pointsInserted}`,
      `# HELP mqtt_raw_messages_inserted_total Total raw messages inserted`,
      `# TYPE mqtt_raw_messages_inserted_total counter`,
      `mqtt_raw_messages_inserted_total ${stats.rawMessagesInserted}`,
      `# HELP telemetry_insert_errors_total Total insert errors`,
      `# TYPE telemetry_insert_errors_total counter`,
      `telemetry_insert_errors_total ${stats.insertErrors}`,
      `# HELP devices_registered_total Devices auto-registered`,
      `# TYPE devices_registered_total counter`,
      `devices_registered_total ${stats.devicesRegistered}`,
      `# HELP telemetry_buffer_size Current telemetry buffer size`,
      `# TYPE telemetry_buffer_size gauge`,
      `telemetry_buffer_size ${telemetryBuffer.length}`,
    ];
    res.type('text/plain').send(lines.join('\n'));
  });

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, '✓ Health server started');
  });
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('  FGB MQTT Ingestion Service (Simplified - Raw Insert Only)');
  logger.info('  Power calculation & aggregation handled by DATABASE');
  logger.info('═══════════════════════════════════════════════════════════════');

  // Verify Supabase connection
  const { error } = await supabase.from('devices').select('id').limit(1);
  if (error) {
    logger.error({ error: error.message }, 'Failed to connect to Supabase');
    process.exit(1);
  }
  logger.info({ url: env.SUPABASE_URL }, '✓ Connected to Supabase');

  mqttClient = connectMqtt();
  startHealthServer();
  
  setInterval(flushBuffers, env.BATCH_INTERVAL_MS);
  logger.info({ intervalMs: env.BATCH_INTERVAL_MS }, 'Buffer flush scheduled');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    mqttClient?.end(true);
    while (telemetryBuffer.length > 0 || rawMessageBuffer.length > 0) {
      await flushBuffers();
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
