/**
 * FGB MQTT Ingestion Service
 * 
 * Connects to MQTT broker and writes to Supabase:
 * - Raw messages → mqtt_messages_raw (audit log)
 * - Normalized metrics → telemetry (long format with labels)
 * 
 * Topics supported:
 * - bridge/+/+/reading (energy monitors)
 * - bridge/+/status (bridge status)
 * - fosensor/iaq (air quality)
 * - MSCHN/misure (3-phase energy)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import mqtt, { MqttClient } from 'mqtt';
import pino from 'pino';
import express from 'express';
import { z } from 'zod';

// ============================================================
// Configuration
// ============================================================

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MQTT_URL: z.string().default('mqtt://data.hub.fgb-studio.com'),
  MQTT_PORT: z.string().default('1883'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TOPICS: z.string().default('bridge/+/+/reading,bridge/+/status,fosensor/iaq,MSCHN/misure'),
  DEFAULT_SITE_ID: z.string().uuid().optional(),
  BATCH_SIZE: z.string().default('100'),
  BATCH_INTERVAL_MS: z.string().default('5000'),
  LOG_LEVEL: z.string().default('info'),
  PORT: z.string().default('3001'),
});

const env = envSchema.parse(process.env);

const logger = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// Types
// ============================================================

interface RawMessage {
  received_at: string;
  broker: string;
  topic: string;
  payload: Record<string, unknown>;
  device_external_id: string | null;
  source_type: string;
  processed: boolean;
  error_message: string | null;
}

interface TelemetryPoint {
  device_id: string; // UUID from devices table
  site_id: string;   // UUID from sites table
  ts: string;
  metric: string;
  value: number;
  unit: string;
  quality: string;
  raw_payload: Record<string, unknown>;
  labels: Record<string, string>;
}

interface DeviceInfo {
  id: string;
  site_id: string;
  device_type: string;
}

// ============================================================
// Buffers and Caches
// ============================================================

const rawBuffer: RawMessage[] = [];
const telemetryBuffer: TelemetryPoint[] = [];
const deviceCache: Map<string, DeviceInfo> = new Map();

const stats = {
  messagesReceived: 0,
  messagesProcessed: 0,
  messagesFailed: 0,
  telemetryInserted: 0,
  rawInserted: 0,
  devicesCreated: 0,
};

// ============================================================
// Validation
// ============================================================

const VALID_RANGES: Record<string, { min: number; max: number }> = {
  current_a: { min: 0, max: 1000 },
  rssi_dbm: { min: -120, max: 0 },
  voc: { min: 0, max: 60000 },
  co2: { min: 0, max: 10000 },
  temp_c: { min: -40, max: 85 },
  humidity_rh: { min: 0, max: 100 },
  pm25: { min: 0, max: 1000 },
  pm10: { min: 0, max: 1000 },
  co: { min: 0, max: 1000 },
  o3: { min: 0, max: 500 },
  i1_a: { min: 0, max: 10000 },
  i2_a: { min: 0, max: 10000 },
  i3_a: { min: 0, max: 10000 },
  v1_v: { min: 0, max: 500 },
  v2_v: { min: 0, max: 500 },
  v3_v: { min: 0, max: 500 },
  energy_import_kwh: { min: 0, max: 1e12 },
  energy_export_kwh: { min: 0, max: 1e12 },
};

function isValidMeasurement(metric: string, value: number): boolean {
  // Check for placeholder values (e.g., -55555)
  if (value < -50000 || value > 1e15) return false;
  
  const range = VALID_RANGES[metric];
  if (range) {
    return value >= range.min && value <= range.max;
  }
  return true; // No range defined, assume valid
}

function getQuality(metric: string, value: number): string {
  if (!isValidMeasurement(metric, value)) return 'invalid';
  return 'good';
}

// ============================================================
// Topic Parsers
// ============================================================

type SourceType = 'bridge_reading' | 'bridge_status' | 'fosensor' | 'mschn';

interface ParsedTopic {
  sourceType: SourceType;
  externalId: string;
  labels: Record<string, string>;
}

function parseTopic(topic: string): ParsedTopic | null {
  // bridge/<bridge_name>/<slot>/reading
  const bridgeReadingMatch = topic.match(/^bridge\/([^/]+)\/([^/]+)\/reading$/);
  if (bridgeReadingMatch) {
    const bridgeName = bridgeReadingMatch[1];
    const circuitKey = bridgeReadingMatch[2];
    // Extract group_key: alphabetic prefix (e.g., "General1" → "General", "HVAC2" → "HVAC")
    const groupMatch = circuitKey.match(/^([A-Za-z]+)/);
    const groupKey = groupMatch ? groupMatch[1] : circuitKey;
    
    return {
      sourceType: 'bridge_reading',
      externalId: bridgeName,
      labels: {
        bridge_name: bridgeName,
        circuit_key: circuitKey,
        group_key: groupKey,
      }
    };
  }

  // bridge/<bridge_name>/status
  const bridgeStatusMatch = topic.match(/^bridge\/([^/]+)\/status$/);
  if (bridgeStatusMatch) {
    return {
      sourceType: 'bridge_status',
      externalId: bridgeStatusMatch[1],
      labels: { bridge_name: bridgeStatusMatch[1] }
    };
  }

  // fosensor/iaq
  if (topic === 'fosensor/iaq') {
    return {
      sourceType: 'fosensor',
      externalId: '', // Will be extracted from payload MAC
      labels: {}
    };
  }

  // MSCHN/misure
  if (topic === 'MSCHN/misure') {
    return {
      sourceType: 'mschn',
      externalId: '', // Will be extracted from payload ID
      labels: {}
    };
  }

  return null;
}

// ============================================================
// Payload Parsers
// ============================================================

interface MetricData {
  metric: string;
  value: number;
  unit: string;
}

interface ParseResult {
  externalId: string;
  deviceType: string;
  ts: string;
  metrics: MetricData[];
  labels: Record<string, string>;
}

function parseBridgeReading(payload: Record<string, unknown>, labels: Record<string, string>): ParseResult | null {
  const metrics: MetricData[] = [];
  
  // current_A
  if (typeof payload.current_A === 'number') {
    metrics.push({ metric: 'current_a', value: payload.current_A, unit: 'A' });
  }
  
  // rssi_dBm
  if (typeof payload.rssi_dBm === 'number') {
    metrics.push({ metric: 'rssi_dbm', value: payload.rssi_dBm, unit: 'dBm' });
  }
  
  // status (convert to numeric)
  if (payload.status !== undefined) {
    const statusVal = payload.status === 'ON' || payload.status === 1 || payload.status === true ? 1 : 0;
    metrics.push({ metric: 'status', value: statusVal, unit: '' });
  }

  // Timestamp
  let ts = new Date().toISOString();
  if (typeof payload.ts === 'number') {
    ts = new Date(payload.ts * 1000).toISOString();
  } else if (typeof payload.ts === 'string') {
    ts = new Date(payload.ts).toISOString();
  }

  // sensor_sn for additional identification
  const sensorSn = typeof payload.sensor_sn === 'string' ? payload.sensor_sn : undefined;
  if (sensorSn) {
    labels.sensor_sn = sensorSn;
  }

  if (metrics.length === 0) return null;

  return {
    externalId: labels.bridge_name,
    deviceType: 'energy_monitor',
    ts,
    metrics,
    labels
  };
}

function parseBridgeStatus(payload: Record<string, unknown>, labels: Record<string, string>): ParseResult | null {
  const metrics: MetricData[] = [];
  
  // alive
  if (payload.alive !== undefined) {
    const aliveVal = payload.alive === true || payload.alive === 1 ? 1 : 0;
    metrics.push({ metric: 'alive', value: aliveVal, unit: '' });
  }

  let ts = new Date().toISOString();
  if (typeof payload.ts === 'number') {
    ts = new Date(payload.ts * 1000).toISOString();
  } else if (typeof payload.ts === 'string') {
    ts = new Date(payload.ts).toISOString();
  }

  if (metrics.length === 0) return null;

  return {
    externalId: labels.bridge_name,
    deviceType: 'energy_monitor',
    ts,
    metrics,
    labels
  };
}

function parseFosensorIAQ(payload: Record<string, unknown>): ParseResult | null {
  const metrics: MetricData[] = [];
  const labels: Record<string, string> = {};

  // Extract MAC address as external ID
  let externalId = '';
  if (payload.MAC && typeof payload.MAC === 'object') {
    const mac = payload.MAC as { address?: string };
    if (mac.address) {
      externalId = mac.address;
      labels.mac = mac.address;
    }
  }
  
  if (!externalId) {
    logger.warn({ payload }, 'fosensor/iaq missing MAC.address');
    return null;
  }

  // Model
  if (typeof payload.Model === 'string') {
    labels.model = payload.Model;
  }

  // Metrics mapping
  const metricMap: Record<string, { metric: string; unit: string }> = {
    VOC: { metric: 'voc', unit: 'ppb' },
    CO2: { metric: 'co2', unit: 'ppm' },
    Temp: { metric: 'temp_c', unit: '°C' },
    Hum: { metric: 'humidity_rh', unit: '%' },
    PM25: { metric: 'pm25', unit: 'µg/m³' },
    PM10: { metric: 'pm10', unit: 'µg/m³' },
    CO: { metric: 'co', unit: 'ppm' },
    O3: { metric: 'o3', unit: 'ppb' },
    Noise: { metric: 'noise_db', unit: 'dB' },
    Lux: { metric: 'lux', unit: 'lx' },
    Radon: { metric: 'radon', unit: 'Bq/m³' },
  };

  for (const [key, mapping] of Object.entries(metricMap)) {
    if (typeof payload[key] === 'number') {
      metrics.push({ metric: mapping.metric, value: payload[key] as number, unit: mapping.unit });
    }
  }

  // Timestamp
  let ts = new Date().toISOString();
  if (typeof payload.ts === 'number') {
    ts = new Date(payload.ts * 1000).toISOString();
  } else if (typeof payload.Timestamp === 'string') {
    ts = new Date(payload.Timestamp).toISOString();
  }

  if (metrics.length === 0) return null;

  return {
    externalId,
    deviceType: 'air_quality',
    ts,
    metrics,
    labels
  };
}

function parseMSCHNMisure(payload: Record<string, unknown>): ParseResult | null {
  const metrics: MetricData[] = [];
  const labels: Record<string, string> = {};

  // Extract stable ID
  let externalId = '';
  if (typeof payload.ID === 'string' || typeof payload.ID === 'number') {
    externalId = String(payload.ID);
    labels.mschn_id = externalId;
  } else if (typeof payload.DeviceID === 'string') {
    externalId = payload.DeviceID;
    labels.mschn_id = externalId;
  } else {
    // Generate from payload hash if no ID
    externalId = `mschn_${Date.now()}`;
    logger.warn({ payload }, 'MSCHN/misure missing stable ID, using timestamp');
  }

  // Current per phase
  const currentMap: Record<string, string> = { I1: 'i1_a', I2: 'i2_a', I3: 'i3_a' };
  for (const [key, metric] of Object.entries(currentMap)) {
    if (typeof payload[key] === 'number') {
      metrics.push({ metric, value: payload[key] as number, unit: 'A' });
    }
  }

  // Voltage per phase
  const voltageMap: Record<string, string> = { V1: 'v1_v', V2: 'v2_v', V3: 'v3_v' };
  for (const [key, metric] of Object.entries(voltageMap)) {
    if (typeof payload[key] === 'number') {
      metrics.push({ metric, value: payload[key] as number, unit: 'V' });
    }
  }

  // Energy counters
  if (typeof payload['Total Active Energy Import'] === 'number') {
    metrics.push({ 
      metric: 'energy_import_kwh', 
      value: payload['Total Active Energy Import'] as number, 
      unit: 'kWh' 
    });
  }
  if (typeof payload['Total Active Energy Export'] === 'number') {
    metrics.push({ 
      metric: 'energy_export_kwh', 
      value: payload['Total Active Energy Export'] as number, 
      unit: 'kWh' 
    });
  }

  // Additional power metrics if present
  const powerMetrics: Record<string, { metric: string; unit: string }> = {
    'Active Power': { metric: 'power_w', unit: 'W' },
    'Reactive Power': { metric: 'reactive_power_var', unit: 'VAR' },
    'Apparent Power': { metric: 'apparent_power_va', unit: 'VA' },
    'Power Factor': { metric: 'power_factor', unit: '' },
    'Frequency': { metric: 'frequency_hz', unit: 'Hz' },
  };
  
  for (const [key, mapping] of Object.entries(powerMetrics)) {
    if (typeof payload[key] === 'number') {
      metrics.push({ metric: mapping.metric, value: payload[key] as number, unit: mapping.unit });
    }
  }

  // Timestamp
  let ts = new Date().toISOString();
  if (typeof payload.Timestamp === 'string') {
    ts = new Date(payload.Timestamp).toISOString();
  } else if (typeof payload.ts === 'number') {
    ts = new Date(payload.ts * 1000).toISOString();
  }

  if (metrics.length === 0) return null;

  return {
    externalId,
    deviceType: 'energy_meter',
    ts,
    metrics,
    labels
  };
}

// ============================================================
// Device Management
// ============================================================

async function getOrCreateDevice(
  externalId: string, 
  deviceType: string, 
  broker: string
): Promise<DeviceInfo | null> {
  const cacheKey = `${externalId}:${broker}`;
  
  // Check cache first
  if (deviceCache.has(cacheKey)) {
    return deviceCache.get(cacheKey)!;
  }

  try {
    // Try to find existing device
    const { data: existing, error: findError } = await supabase
      .from('devices')
      .select('id, site_id, device_type')
      .eq('device_id', externalId)
      .eq('broker', broker)
      .maybeSingle();

    if (findError) {
      logger.error({ error: findError, externalId }, 'Error finding device');
      return null;
    }

    if (existing) {
      const deviceInfo: DeviceInfo = {
        id: existing.id,
        site_id: existing.site_id,
        device_type: existing.device_type,
      };
      deviceCache.set(cacheKey, deviceInfo);
      
      // Update last_seen
      await supabase
        .from('devices')
        .update({ last_seen: new Date().toISOString(), status: 'online' })
        .eq('id', existing.id);
      
      return deviceInfo;
    }

    // Auto-create device if DEFAULT_SITE_ID is set
    if (!env.DEFAULT_SITE_ID) {
      logger.warn({ externalId, broker }, 'Device not found and DEFAULT_SITE_ID not set');
      return null;
    }

    const { data: newDevice, error: createError } = await supabase
      .from('devices')
      .insert({
        device_id: externalId,
        site_id: env.DEFAULT_SITE_ID,
        device_type: deviceType,
        broker: broker,
        name: `Auto: ${externalId}`,
        status: 'online',
        last_seen: new Date().toISOString(),
        metadata: { auto_created: true, created_at: new Date().toISOString() }
      })
      .select('id, site_id, device_type')
      .single();

    if (createError) {
      logger.error({ error: createError, externalId }, 'Error creating device');
      return null;
    }

    const deviceInfo: DeviceInfo = {
      id: newDevice.id,
      site_id: newDevice.site_id,
      device_type: newDevice.device_type,
    };
    deviceCache.set(cacheKey, deviceInfo);
    stats.devicesCreated++;
    logger.info({ externalId, deviceId: newDevice.id }, 'Auto-created device');

    return deviceInfo;
  } catch (err) {
    logger.error({ error: err, externalId }, 'Exception in getOrCreateDevice');
    return null;
  }
}

// ============================================================
// Message Processing
// ============================================================

async function processMessage(topic: string, payloadStr: string, broker: string): Promise<void> {
  stats.messagesReceived++;
  
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadStr);
  } catch (err) {
    logger.warn({ topic, error: err }, 'Invalid JSON payload');
    rawBuffer.push({
      received_at: new Date().toISOString(),
      broker,
      topic,
      payload: { raw: payloadStr },
      device_external_id: null,
      source_type: 'unknown',
      processed: false,
      error_message: 'Invalid JSON'
    });
    stats.messagesFailed++;
    return;
  }

  const parsedTopic = parseTopic(topic);
  if (!parsedTopic) {
    logger.debug({ topic }, 'Unknown topic pattern');
    rawBuffer.push({
      received_at: new Date().toISOString(),
      broker,
      topic,
      payload,
      device_external_id: null,
      source_type: 'unknown',
      processed: false,
      error_message: 'Unknown topic pattern'
    });
    stats.messagesFailed++;
    return;
  }

  // Parse payload based on source type
  let parseResult: ParseResult | null = null;
  
  switch (parsedTopic.sourceType) {
    case 'bridge_reading':
      parseResult = parseBridgeReading(payload, parsedTopic.labels);
      break;
    case 'bridge_status':
      parseResult = parseBridgeStatus(payload, parsedTopic.labels);
      break;
    case 'fosensor':
      parseResult = parseFosensorIAQ(payload);
      break;
    case 'mschn':
      parseResult = parseMSCHNMisure(payload);
      break;
  }

  // Get external ID (from topic or payload)
  const externalId = parseResult?.externalId || parsedTopic.externalId;
  
  // Save raw message
  rawBuffer.push({
    received_at: new Date().toISOString(),
    broker,
    topic,
    payload,
    device_external_id: externalId || null,
    source_type: parsedTopic.sourceType,
    processed: parseResult !== null,
    error_message: parseResult === null ? 'Failed to parse payload' : null
  });

  if (!parseResult) {
    stats.messagesFailed++;
    return;
  }

  // Get or create device
  const device = await getOrCreateDevice(externalId, parseResult.deviceType, broker);
  if (!device) {
    stats.messagesFailed++;
    return;
  }

  // Create telemetry points
  for (const metric of parseResult.metrics) {
    const quality = getQuality(metric.metric, metric.value);
    
    // Skip invalid measurements
    if (quality === 'invalid') {
      logger.debug({ metric: metric.metric, value: metric.value }, 'Skipping invalid measurement');
      continue;
    }

    telemetryBuffer.push({
      device_id: device.id,
      site_id: device.site_id,
      ts: parseResult.ts,
      metric: metric.metric,
      value: metric.value,
      unit: metric.unit,
      quality,
      raw_payload: payload,
      labels: parseResult.labels
    });
  }

  stats.messagesProcessed++;
}

// ============================================================
// Buffer Flushing
// ============================================================

async function flushBuffers(): Promise<void> {
  const rawBatch = rawBuffer.splice(0, parseInt(env.BATCH_SIZE));
  const telemetryBatch = telemetryBuffer.splice(0, parseInt(env.BATCH_SIZE));

  if (rawBatch.length === 0 && telemetryBatch.length === 0) {
    return;
  }

  const startTime = Date.now();

  // Insert raw messages
  if (rawBatch.length > 0) {
    try {
      const { error } = await supabase.from('mqtt_messages_raw').insert(rawBatch);
      if (error) {
        logger.error({ error, count: rawBatch.length }, 'Failed to insert raw messages');
        // Put back in buffer for retry
        rawBuffer.unshift(...rawBatch);
      } else {
        stats.rawInserted += rawBatch.length;
        logger.debug({ count: rawBatch.length }, 'Inserted raw messages');
      }
    } catch (err) {
      logger.error({ error: err }, 'Exception inserting raw messages');
      rawBuffer.unshift(...rawBatch);
    }
  }

  // Insert telemetry
  if (telemetryBatch.length > 0) {
    try {
      const { error } = await supabase.from('telemetry').insert(telemetryBatch);
      if (error) {
        logger.error({ error, count: telemetryBatch.length }, 'Failed to insert telemetry');
        // Put back in buffer for retry
        telemetryBuffer.unshift(...telemetryBatch);
      } else {
        stats.telemetryInserted += telemetryBatch.length;
        logger.info({ 
          count: telemetryBatch.length, 
          durationMs: Date.now() - startTime 
        }, 'Inserted telemetry');
      }
    } catch (err) {
      logger.error({ error: err }, 'Exception inserting telemetry');
      telemetryBuffer.unshift(...telemetryBatch);
    }
  }
}

// ============================================================
// MQTT Connection
// ============================================================

function connectMQTT(): MqttClient {
  const brokerUrl = `${env.MQTT_URL}:${env.MQTT_PORT}`;
  
  const options: mqtt.IClientOptions = {
    clientId: `fgb-ingestion-${Date.now()}`,
    clean: true,
    connectTimeout: 30000,
    reconnectPeriod: 5000,
  };

  if (env.MQTT_USERNAME) {
    options.username = env.MQTT_USERNAME;
    options.password = env.MQTT_PASSWORD;
  }

  logger.info({ brokerUrl, topics: env.MQTT_TOPICS }, 'Connecting to MQTT broker');

  const client = mqtt.connect(brokerUrl, options);

  client.on('connect', () => {
    logger.info({ brokerUrl }, 'Connected to MQTT broker');
    
    const topics = env.MQTT_TOPICS.split(',').map(t => t.trim());
    for (const topic of topics) {
      client.subscribe(topic, (err) => {
        if (err) {
          logger.error({ topic, error: err }, 'Failed to subscribe');
        } else {
          logger.info({ topic }, 'Subscribed to topic');
        }
      });
    }
  });

  client.on('message', (topic, message) => {
    processMessage(topic, message.toString(), env.MQTT_URL);
  });

  client.on('error', (err) => {
    logger.error({ error: err }, 'MQTT error');
  });

  client.on('close', () => {
    logger.warn('MQTT connection closed');
  });

  client.on('reconnect', () => {
    logger.info('Reconnecting to MQTT broker...');
  });

  return client;
}

// ============================================================
// Health Server
// ============================================================

function startHealthServer(): void {
  const app = express();
  const port = parseInt(env.PORT);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      stats,
      buffers: {
        raw: rawBuffer.length,
        telemetry: telemetryBuffer.length
      },
      config: {
        mqttUrl: env.MQTT_URL,
        topics: env.MQTT_TOPICS.split(','),
        batchSize: env.BATCH_SIZE,
        batchIntervalMs: env.BATCH_INTERVAL_MS
      }
    });
  });

  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(`
# HELP mqtt_messages_received Total MQTT messages received
# TYPE mqtt_messages_received counter
mqtt_messages_received ${stats.messagesReceived}

# HELP mqtt_messages_processed Total MQTT messages successfully processed
# TYPE mqtt_messages_processed counter
mqtt_messages_processed ${stats.messagesProcessed}

# HELP mqtt_messages_failed Total MQTT messages that failed processing
# TYPE mqtt_messages_failed counter
mqtt_messages_failed ${stats.messagesFailed}

# HELP telemetry_inserted Total telemetry points inserted
# TYPE telemetry_inserted counter
telemetry_inserted ${stats.telemetryInserted}

# HELP raw_inserted Total raw messages inserted
# TYPE raw_inserted counter
raw_inserted ${stats.rawInserted}

# HELP devices_created Total devices auto-created
# TYPE devices_created counter
devices_created ${stats.devicesCreated}

# HELP buffer_raw_size Current size of raw message buffer
# TYPE buffer_raw_size gauge
buffer_raw_size ${rawBuffer.length}

# HELP buffer_telemetry_size Current size of telemetry buffer
# TYPE buffer_telemetry_size gauge
buffer_telemetry_size ${telemetryBuffer.length}
`.trim());
  });

  app.listen(port, () => {
    logger.info({ port }, 'Health server started');
  });
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  logger.info('Starting FGB MQTT Ingestion Service');

  // Verify Supabase connection
  try {
    const { error } = await supabase.from('sites').select('id').limit(1);
    if (error) throw error;
    logger.info('Supabase connection verified');
  } catch (err) {
    logger.error({ error: err }, 'Failed to connect to Supabase');
    process.exit(1);
  }

  // Start health server
  startHealthServer();

  // Connect to MQTT
  const client = connectMQTT();

  // Flush buffers periodically
  setInterval(flushBuffers, parseInt(env.BATCH_INTERVAL_MS));

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    client.end();
    await flushBuffers(); // Flush remaining data
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ error: err }, 'Fatal error');
  process.exit(1);
});
