import mqtt, { MqttClient } from 'mqtt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express from 'express';
import pino from 'pino';
import { z } from 'zod';

// =============================================================================
// FGB MQTT Ingestion Service - ROBUST VERSION
// =============================================================================
// 
// FLOW ORDER (robust):
// 1. Receive MQTT message
// 2. Save raw JSON to mqtt_messages_raw IMMEDIATELY (audit log)
// 3. Infer external device ID (best effort)
// 4. Upsert device (even without DEFAULT_SITE_ID → creates orphan)
// 5. Parse telemetry if recognized topic
// 6. Insert telemetry points
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

// =============================================================================
// ENVIRONMENT VALIDATION
// =============================================================================

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
  device_external_id: string | null;
  source_type: string | null;
}

interface TelemetryPoint {
  device_id: string;
  site_id: string | null;  // NULL for orphan devices
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
  deviceType: 'air_quality' | 'energy_monitor' | 'water_meter' | 'other';
  mac?: string;
  rssi?: number;
  topic?: string;
}

interface ParseResult {
  device: DeviceInfo;
  points: Omit<TelemetryPoint, 'device_id' | 'site_id'>[];
}

interface DeviceCacheEntry {
  uuid: string;
  site_id: string | null;
}

// =============================================================================
// BUFFERS & CACHES
// =============================================================================

let telemetryBuffer: TelemetryPoint[] = [];
let rawMessageBuffer: RawMessage[] = [];
const deviceCache: Map<string, DeviceCacheEntry> = new Map();
let mqttClient: MqttClient | null = null;

const stats = {
  messagesReceived: 0,
  rawMessagesBuffered: 0,
  rawMessagesInserted: 0,
  pointsBuffered: 0,
  pointsInserted: 0,
  insertErrors: 0,
  devicesRegistered: 0,
  devicesOrphan: 0,
  lastFlush: new Date().toISOString(),
};

// =============================================================================
// TIMESTAMP NORMALIZATION (Robust - handles ms/s/us/ns)
// =============================================================================

// Epoch thresholds for year 3000 in different units
const YEAR_3000_S  = 32503680000;           // seconds
const YEAR_3000_MS = YEAR_3000_S * 1000;    // milliseconds  
const YEAR_3000_US = YEAR_3000_MS * 1000;   // microseconds
const YEAR_3000_NS = YEAR_3000_US * 1000;   // nanoseconds

/**
 * Normalizes any timestamp format to ISO string with robust validation.
 * Handles: seconds, milliseconds, microseconds, nanoseconds, ISO strings.
 * Falls back to receivedAt if timestamp is invalid or too far from server time.
 */
function normalizeTimestamp(raw: unknown, receivedAt: Date, maxSkewSeconds = 86400): string {
  const fallback = receivedAt.toISOString();

  if (raw === null || raw === undefined) return fallback;

  // Handle ISO string
  if (typeof raw === 'string') {
    // Try parsing as date string
    const d = new Date(raw.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      const skew = Math.abs(d.getTime() - receivedAt.getTime()) / 1000;
      return skew > maxSkewSeconds ? fallback : d.toISOString();
    }
    
    // Try parsing as numeric string
    const asNum = Number(raw);
    if (!Number.isFinite(asNum)) return fallback;
    raw = asNum;
  }

  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;

  const abs = Math.abs(raw);
  let ms: number;

  // Detect unit based on magnitude (order: largest first)
  if (abs > YEAR_3000_NS) {
    ms = raw / 1e6;       // nanoseconds → ms
  } else if (abs > YEAR_3000_US) {
    ms = raw / 1e3;       // microseconds → ms  
  } else if (abs > YEAR_3000_MS) {
    ms = raw;             // already milliseconds (but huge, likely error)
    return fallback;
  } else if (abs > YEAR_3000_S) {
    ms = raw;             // milliseconds
  } else {
    ms = raw * 1000;      // seconds → ms
  }

  const d = new Date(ms);
  if (isNaN(d.getTime())) return fallback;

  // Validate against server time (reject if too far off)
  const skew = Math.abs(d.getTime() - receivedAt.getTime()) / 1000;
  return skew > maxSkewSeconds ? fallback : d.toISOString();
}

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
  'Hum': { canonical: 'env.humidity', unit: '%' },
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
// TOPIC PATTERN MATCHING
// =============================================================================

type TopicType = 'air_quality' | 'pan12' | 'mschn' | null;

function matchTopicPattern(topic: string): TopicType {
  if (topic.includes('fosensor') || topic.includes('iaq') || topic.includes('air')) {
    return 'air_quality';
  }
  if (/bridge\/[^/]+\/[^/]+\/reading/.test(topic)) {
    return 'pan12';
  }
  if (topic.includes('MSCHN') || topic.includes('mschn')) {
    return 'mschn';
  }
  return null;
}

// =============================================================================
// EXTERNAL ID INFERENCE (Best Effort)
// =============================================================================

/**
 * Infers the external device ID from topic and payload using multiple strategies.
 * Returns null if no ID can be determined.
 */
function inferExternalId(topic: string, payload: Record<string, unknown>): string | null {
  const topicType = matchTopicPattern(topic);

  // Strategy 1: Topic-based extraction
  if (topicType === 'air_quality') {
    // fosensor/iaq/<device_id> or fosensor/<device_id>/...
    const parts = topic.split('/');
    if (parts.length >= 2 && parts[1] && parts[1] !== 'iaq') {
      return parts[1];
    }
  }

  if (topicType === 'pan12') {
    // bridge/<bridge_name>/<slot>/reading → use sensor_sn from payload
    const sensorSn = payload?.sensor_sn;
    if (typeof sensorSn === 'string' && sensorSn.trim()) {
      return sensorSn.trim();
    }
    // Fallback: bridge name + slot
    const match = topic.match(/bridge\/([^/]+)\/([^/]+)\/reading/);
    if (match) {
      return `${match[1]}_${match[2]}`;
    }
  }

  if (topicType === 'mschn') {
    // MSCHN uses ID field in payload
    const id = payload?.ID || payload?.id || payload?.device_id || payload?.serial_number;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
    if (typeof id === 'number') {
      return String(id);
    }
  }

  // Strategy 2: Common payload fields
  const commonIdFields = ['DeviceID', 'device_id', 'deviceId', 'MAC', 'mac', 'serial', 'sensor_sn'];
  for (const field of commonIdFields) {
    const val = payload?.[field];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }

  // Strategy 3: Nested MAC address (WEEL format)
  if (payload?.MAC && typeof payload.MAC === 'object') {
    const mac = payload.MAC as { address?: string };
    if (mac.address) {
      return mac.address;
    }
  }

  return null;
}

// =============================================================================
// VALUE EXTRACTION & VALIDATION
// =============================================================================

function isValidValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (typeof num !== 'number' || isNaN(num)) return false;
  // Detect placeholder values like -555555
  if (num < -100000 || num > 100000000) return false;
  return true;
}

function extractValue(val: unknown): number | null {
  if (!isValidValue(val)) return null;
  return typeof val === 'string' ? parseFloat(val) : val as number;
}

// =============================================================================
// PARSERS - Extract fields, NO calculations
// =============================================================================

/**
 * Parser: Air Quality (WEEL/LEED) - fosensor/iaq topic
 */
function parseAirQuality(topic: string, payload: Record<string, unknown>, receivedAt: Date): ParseResult | null {
  const externalId = inferExternalId(topic, payload);
  if (!externalId) {
    logger.warn({ topic }, 'Air quality payload: cannot infer device ID');
    return null;
  }

  const timestamp = normalizeTimestamp(
    payload.Timestamp || payload.timestamp || payload.ts,
    receivedAt
  );
  const broker = typeof payload.Broker === 'string' ? payload.Broker : env.MQTT_BROKER_URL;
  
  const device: DeviceInfo = {
    externalId,
    broker,
    model: typeof payload.Model === 'string' ? payload.Model : 'UNKNOWN',
    deviceType: 'air_quality',
    mac: typeof payload.MAC === 'string' ? payload.MAC : undefined,
    topic,
  };

  const points: Omit<TelemetryPoint, 'device_id' | 'site_id'>[] = [];
  const metricsToExtract = ['CO2', 'VOC', 'Temp', 'Humidity', 'Hum', 'O3', 'CO', 'PM2.5', 'PM10'];
  
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

  return points.length > 0 ? { device, points } : null;
}

/**
 * Parser: Energy Single Phase (PAN12) - bridge/*/slot*/reading
 * Saves only raw current - NO power calculation!
 */
function parseEnergyPAN12(topic: string, payload: Record<string, unknown>, receivedAt: Date): ParseResult | null {
  const externalId = inferExternalId(topic, payload);
  if (!externalId) {
    logger.warn({ topic }, 'PAN12 payload: cannot infer device ID');
    return null;
  }

  const timestamp = normalizeTimestamp(
    payload.ts || payload.Timestamp || payload.timestamp,
    receivedAt
  );
  const broker = typeof payload.Broker === 'string' ? payload.Broker : env.MQTT_BROKER_URL;
  
  const device: DeviceInfo = {
    externalId,
    broker,
    model: typeof payload.type === 'string' ? payload.type : 'PAN12',
    deviceType: 'energy_monitor',
    rssi: typeof payload.rssi_dBm === 'number' ? payload.rssi_dBm : undefined,
    topic,
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

  return points.length > 0 ? { device, points } : null;
}

/**
 * Parser: Energy Three Phase (MSCHN) - MSCHN/misure
 * Saves I1,I2,I3,V1,V2,V3 individually - power_kw computed by DB!
 */
function parseEnergyMSCHN(topic: string, payload: Record<string, unknown>, receivedAt: Date): ParseResult | null {
  const externalId = inferExternalId(topic, payload);
  if (!externalId) {
    logger.warn({ topic }, 'MSCHN payload: cannot infer device ID');
    return null;
  }

  const timestamp = normalizeTimestamp(
    payload.time || payload.Timestamp || payload.timestamp || payload.ts,
    receivedAt
  );
  const broker = typeof payload.Broker === 'string' ? payload.Broker : env.MQTT_BROKER_URL;
  
  const device: DeviceInfo = {
    externalId,
    broker,
    model: 'MSCHN',
    deviceType: 'energy_monitor',
    topic,
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

  return points.length > 0 ? { device, points } : null;
}

// =============================================================================
// DEVICE MANAGEMENT
// =============================================================================

/**
 * Upserts device in database. Creates orphan devices (site_id=NULL) if DEFAULT_SITE_ID not set.
 * Returns device UUID and site_id for telemetry insertion.
 */
async function upsertDevice(info: DeviceInfo): Promise<DeviceCacheEntry | null> {
  const cacheKey = `${info.externalId}:${info.broker}`;
  
  // Check cache first
  if (deviceCache.has(cacheKey)) {
    return deviceCache.get(cacheKey)!;
  }

  // Try to find existing device
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
    const result: DeviceCacheEntry = { uuid: existing.id, site_id: existing.site_id };
    deviceCache.set(cacheKey, result);
    
    // Update device last_seen (fire and forget)
    supabase
      .from('devices')
      .update({
        last_seen: new Date().toISOString(),
        status: 'online',
        rssi_dbm: info.rssi,
        model: info.model,
        topic: info.topic,
      })
      .eq('id', existing.id)
      .then(() => {})
      .catch(e => logger.warn({ error: e, deviceId: info.externalId }, 'Failed to update last_seen'));
      
    return result;
  }

  // =========================================================================
  // AUTO-REGISTER NEW DEVICE (with or without site_id)
  // =========================================================================
  // If DEFAULT_SITE_ID is set → assign device to that site
  // If DEFAULT_SITE_ID is NOT set → create as orphan (site_id = NULL)
  // Orphan devices can be assigned to sites later via admin UI
  // =========================================================================

  const siteId = env.DEFAULT_SITE_ID || null;
  const isOrphan = siteId === null;

  logger.info({ 
    deviceId: info.externalId, 
    model: info.model,
    site: isOrphan ? 'ORPHAN (unassigned)' : siteId,
  }, 'Auto-registering new device');
  
  const { data: newDevice, error: insertError } = await supabase
    .from('devices')
    .insert({
      site_id: siteId,  // NULL is valid - device awaits assignment via admin UI
      device_id: info.externalId,
      broker: info.broker,
      model: info.model,
      device_type: info.deviceType,
      mac_address: info.mac,
      rssi_dbm: info.rssi,
      topic: info.topic,
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

  const result: DeviceCacheEntry = { uuid: newDevice.id, site_id: newDevice.site_id };
  deviceCache.set(cacheKey, result);
  stats.devicesRegistered++;
  if (isOrphan) stats.devicesOrphan++;
  
  logger.info({ 
    deviceId: info.externalId, 
    uuid: newDevice.id,
    orphan: isOrphan,
  }, '✓ Device registered');
  
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
  
  // 1) Insert raw messages FIRST (audit log - most important)
  if (rawBatch.length > 0 && env.SAVE_RAW_MESSAGES) {
    const result = await withRetry(async () => {
      const { error } = await supabase.from('mqtt_messages_raw').insert(rawBatch);
      if (error) throw error;
      return true;
    }, 'mqtt_raw_insert');
    
    if (result) {
      stats.rawMessagesInserted += rawBatch.length;
    } else {
      // Re-queue failed raw messages (critical audit data)
      if (rawMessageBuffer.length < 10000) {
        rawMessageBuffer.unshift(...rawBatch);
        logger.warn({ count: rawBatch.length }, 'Re-queued failed raw batch');
      }
    }
  }
  
  // 2) Insert telemetry
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
        logger.warn({ count: telemetryBatch.length }, 'Re-queued failed telemetry batch');
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

  // =========================================================================
  // MESSAGE HANDLER - ROBUST FLOW
  // =========================================================================
  client.on('message', async (topic, payloadBuf) => {
    if (topic.startsWith('$SYS')) return;

    const receivedAt = new Date();
    stats.messagesReceived++;

    // Parse payload (fallback to string if not valid JSON)
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadBuf.toString());
    } catch {
      // Store as raw string wrapped in object for audit
      payload = { _raw: payloadBuf.toString() };
    }

    // Infer external ID (best effort)
    const externalId = inferExternalId(topic, payload);
    const topicType = matchTopicPattern(topic);

    // =====================================================================
    // STEP 1: SAVE RAW MESSAGE IMMEDIATELY (before any processing)
    // =====================================================================
    if (env.SAVE_RAW_MESSAGES) {
      rawMessageBuffer.push({
        device_external_id: externalId,  // Can be null - that's OK for audit
        topic,
        payload,
        received_at: receivedAt.toISOString(),
        broker: env.MQTT_BROKER_URL,
        source_type: topicType,
      });
      stats.rawMessagesBuffered++;
    }

    // =====================================================================
    // STEP 2: If no external ID, we can't create device or telemetry
    // =====================================================================
    if (!externalId) {
      logger.debug({ topic }, 'Cannot infer device ID, raw saved but no telemetry');
      return;
    }

    // =====================================================================
    // STEP 3: Parse telemetry (if recognized topic)
    // =====================================================================
    let parseResult: ParseResult | null = null;
    
    switch (topicType) {
      case 'air_quality':
        parseResult = parseAirQuality(topic, payload, receivedAt);
        break;
      case 'pan12':
        parseResult = parseEnergyPAN12(topic, payload, receivedAt);
        break;
      case 'mschn':
        parseResult = parseEnergyMSCHN(topic, payload, receivedAt);
        break;
      default:
        // Unknown topic type - still try to create device for audit trail
        break;
    }

    // =====================================================================
    // STEP 4: ALWAYS create/update device (even if parse failed)
    // =====================================================================
    const deviceInfo = await upsertDevice({
      externalId,
      deviceType: parseResult?.device.deviceType ?? 
                  (topicType === 'air_quality' ? 'air_quality' : 
                   topicType === 'pan12' || topicType === 'mschn' ? 'energy_monitor' : 'other'),
      broker: env.MQTT_BROKER_URL,
      model: parseResult?.device.model ?? 'UNKNOWN',
      mac: parseResult?.device.mac,
      rssi: parseResult?.device.rssi,
      topic,
    });

    if (!deviceInfo) {
      logger.warn({ externalId, topic }, 'Failed to upsert device');
      return;
    }

    // =====================================================================
    // STEP 5: Insert telemetry (only if parse succeeded)
    // =====================================================================
    if (parseResult?.points?.length) {
      const points: TelemetryPoint[] = parseResult.points.map(p => ({
        ...p,
        device_id: deviceInfo.uuid,
        site_id: deviceInfo.site_id,  // Can be null for orphan devices
      }));
      
      telemetryBuffer.push(...points);
      stats.pointsBuffered += points.length;
      
      logger.debug({ 
        topic, 
        deviceId: externalId, 
        points: points.length,
        orphan: deviceInfo.site_id === null,
      }, 'Parsed message');
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
      buffer: { 
        telemetry: telemetryBuffer.length, 
        raw: rawMessageBuffer.length, 
        maxSize: 10000 
      },
      stats: { 
        ...stats, 
        deviceCacheSize: deviceCache.size, 
        uptime: process.uptime() 
      },
    });
  });

  app.get('/metrics', (req, res) => {
    const lines = [
      `# HELP mqtt_messages_received_total Total MQTT messages received`,
      `# TYPE mqtt_messages_received_total counter`,
      `mqtt_messages_received_total ${stats.messagesReceived}`,
      `# HELP mqtt_raw_messages_buffered_total Total raw messages buffered`,
      `# TYPE mqtt_raw_messages_buffered_total counter`,
      `mqtt_raw_messages_buffered_total ${stats.rawMessagesBuffered}`,
      `# HELP mqtt_raw_messages_inserted_total Total raw messages inserted`,
      `# TYPE mqtt_raw_messages_inserted_total counter`,
      `mqtt_raw_messages_inserted_total ${stats.rawMessagesInserted}`,
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
      `# HELP devices_orphan_total Orphan devices (no site assigned)`,
      `# TYPE devices_orphan_total counter`,
      `devices_orphan_total ${stats.devicesOrphan}`,
      `# HELP telemetry_buffer_size Current telemetry buffer size`,
      `# TYPE telemetry_buffer_size gauge`,
      `telemetry_buffer_size ${telemetryBuffer.length}`,
      `# HELP raw_buffer_size Current raw message buffer size`,
      `# TYPE raw_buffer_size gauge`,
      `raw_buffer_size ${rawMessageBuffer.length}`,
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
  logger.info('  FGB MQTT Ingestion Service (ROBUST VERSION)');
  logger.info('  ✓ Raw messages saved BEFORE device/telemetry processing');
  logger.info('  ✓ Orphan devices supported (site_id = NULL)');
  logger.info('  ✓ Robust timestamp normalization (ms/s/us/ns detection)');
  logger.info('  ✓ Power calculation & aggregation handled by DATABASE');
  logger.info('═══════════════════════════════════════════════════════════════');

  // Log configuration
  logger.info({ 
    defaultSiteId: env.DEFAULT_SITE_ID || 'NOT SET (orphan mode)',
    saveRaw: env.SAVE_RAW_MESSAGES,
    batchSize: env.BATCH_SIZE,
    batchIntervalMs: env.BATCH_INTERVAL_MS,
  }, 'Configuration');

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
    
    // Flush remaining buffers
    while (telemetryBuffer.length > 0 || rawMessageBuffer.length > 0) {
      logger.info({ 
        telemetry: telemetryBuffer.length, 
        raw: rawMessageBuffer.length 
      }, 'Flushing remaining buffers...');
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
