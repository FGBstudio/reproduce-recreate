import mqtt, { MqttClient } from 'mqtt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express from 'express';
import pino from 'pino';
import { z } from 'zod';

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Environment validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  MQTT_BROKER_URL: z.string().default('mqtt://localhost:1883'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TOPICS: z.string().default('sensors/#,energy/#'),
  BATCH_SIZE: z.string().transform(Number).default('100'),
  BATCH_INTERVAL_MS: z.string().transform(Number).default('5000'),
  PORT: z.string().transform(Number).default('3001'),
});

const env = envSchema.parse(process.env);

// Supabase client with service role key
const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// Telemetry buffer for batch inserts
interface TelemetryPoint {
  device_id: string;
  ts: string;
  metric: string;
  value: number;
  unit?: string;
  quality?: string;
  raw_payload?: object;
}

let telemetryBuffer: TelemetryPoint[] = [];
let deviceCache: Map<string, string> = new Map(); // device_id -> uuid

// Payload schemas for different sensor types
const airQualitySchema = z.object({
  device_id: z.string(),
  timestamp: z.string().optional(),
  co2: z.number().optional(),
  voc: z.number().optional(),
  tvoc: z.number().optional(),
  temp: z.number().optional(),
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  pm25: z.number().optional(),
  pm10: z.number().optional(),
  co: z.number().optional(),
  o3: z.number().optional(),
  noise: z.number().optional(),
  lux: z.number().optional(),
  radon: z.number().optional(),
});

const energySchema = z.object({
  device_id: z.string(),
  timestamp: z.string().optional(),
  current_a: z.number().optional(),
  current_b: z.number().optional(),
  current_c: z.number().optional(),
  voltage_a: z.number().optional(),
  voltage_b: z.number().optional(),
  voltage_c: z.number().optional(),
  power_w: z.number().optional(),
  power_kw: z.number().optional(),
  energy_kwh: z.number().optional(),
  power_factor: z.number().optional(),
  frequency: z.number().optional(),
});

const waterSchema = z.object({
  device_id: z.string(),
  timestamp: z.string().optional(),
  flow_rate: z.number().optional(),
  total_volume: z.number().optional(),
  pressure: z.number().optional(),
  temperature: z.number().optional(),
});

// Get or create device UUID from external device_id
async function getDeviceUuid(externalDeviceId: string, broker: string): Promise<string | null> {
  const cacheKey = `${externalDeviceId}:${broker}`;
  
  if (deviceCache.has(cacheKey)) {
    return deviceCache.get(cacheKey)!;
  }

  const { data, error } = await supabase
    .from('devices')
    .select('id')
    .eq('device_id', externalDeviceId)
    .eq('broker', broker)
    .maybeSingle();

  if (error) {
    logger.error({ error, externalDeviceId }, 'Failed to lookup device');
    return null;
  }

  if (data) {
    deviceCache.set(cacheKey, data.id);
    return data.id;
  }

  logger.warn({ externalDeviceId, broker }, 'Device not found in registry');
  return null;
}

// Parse MQTT payload and extract metrics
function parsePayload(topic: string, payload: Buffer): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  
  try {
    const data = JSON.parse(payload.toString());
    const timestamp = data.timestamp || new Date().toISOString();
    const deviceId = data.device_id;

    if (!deviceId) {
      logger.warn({ topic }, 'Payload missing device_id');
      return points;
    }

    // Determine sensor type from topic
    if (topic.includes('air') || topic.includes('iaq')) {
      const parsed = airQualitySchema.safeParse(data);
      if (parsed.success) {
        const d = parsed.data;
        if (d.co2 !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'co2', value: d.co2, unit: 'ppm' });
        if (d.voc !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'voc', value: d.voc, unit: 'µg/m³' });
        if (d.tvoc !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'voc', value: d.tvoc, unit: 'µg/m³' });
        if (d.temp !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'temp', value: d.temp, unit: '°C' });
        if (d.temperature !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'temp', value: d.temperature, unit: '°C' });
        if (d.humidity !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'humidity', value: d.humidity, unit: '%' });
        if (d.pm25 !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'pm25', value: d.pm25, unit: 'µg/m³' });
        if (d.pm10 !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'pm10', value: d.pm10, unit: 'µg/m³' });
        if (d.co !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'co', value: d.co, unit: 'ppm' });
        if (d.o3 !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'o3', value: d.o3, unit: 'ppb' });
        if (d.noise !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'noise', value: d.noise, unit: 'dB' });
        if (d.lux !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'lux', value: d.lux, unit: 'lx' });
        if (d.radon !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'radon', value: d.radon, unit: 'Bq/m³' });
      }
    } else if (topic.includes('energy') || topic.includes('power')) {
      const parsed = energySchema.safeParse(data);
      if (parsed.success) {
        const d = parsed.data;
        if (d.current_a !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'current_a', value: d.current_a, unit: 'A' });
        if (d.current_b !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'current_b', value: d.current_b, unit: 'A' });
        if (d.current_c !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'current_c', value: d.current_c, unit: 'A' });
        if (d.voltage_a !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'voltage_a', value: d.voltage_a, unit: 'V' });
        if (d.voltage_b !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'voltage_b', value: d.voltage_b, unit: 'V' });
        if (d.voltage_c !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'voltage_c', value: d.voltage_c, unit: 'V' });
        if (d.power_w !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'power_kw', value: d.power_w / 1000, unit: 'kW' });
        if (d.power_kw !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'power_kw', value: d.power_kw, unit: 'kW' });
        if (d.energy_kwh !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'energy_kwh', value: d.energy_kwh, unit: 'kWh' });
        if (d.power_factor !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'power_factor', value: d.power_factor, unit: '' });
        if (d.frequency !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'frequency', value: d.frequency, unit: 'Hz' });
      }
    } else if (topic.includes('water')) {
      const parsed = waterSchema.safeParse(data);
      if (parsed.success) {
        const d = parsed.data;
        if (d.flow_rate !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'flow_rate', value: d.flow_rate, unit: 'L/min' });
        if (d.total_volume !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'volume', value: d.total_volume, unit: 'L' });
        if (d.pressure !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'pressure', value: d.pressure, unit: 'bar' });
        if (d.temperature !== undefined) points.push({ device_id: deviceId, ts: timestamp, metric: 'water_temp', value: d.temperature, unit: '°C' });
      }
    }

    // Add raw payload for debugging
    points.forEach(p => p.raw_payload = data);
    
  } catch (e) {
    logger.error({ error: e, topic }, 'Failed to parse payload');
  }

  return points;
}

// Flush buffer to Supabase
async function flushBuffer(): Promise<void> {
  if (telemetryBuffer.length === 0) return;

  const batch = telemetryBuffer.splice(0, env.BATCH_SIZE);
  
  // Resolve device UUIDs
  const resolvedBatch = await Promise.all(
    batch.map(async (point) => {
      const uuid = await getDeviceUuid(point.device_id, env.MQTT_BROKER_URL);
      if (!uuid) return null;
      return { ...point, device_id: uuid };
    })
  );

  const validBatch = resolvedBatch.filter((p): p is TelemetryPoint => p !== null);

  if (validBatch.length === 0) return;

  const { error } = await supabase
    .from('telemetry')
    .insert(validBatch);

  if (error) {
    logger.error({ error, count: validBatch.length }, 'Failed to insert telemetry batch');
    // Re-add failed items to buffer (with limit)
    if (telemetryBuffer.length < 10000) {
      telemetryBuffer.push(...batch);
    }
  } else {
    logger.info({ count: validBatch.length }, 'Inserted telemetry batch');
  }
}

// MQTT connection
function connectMqtt(): MqttClient {
  const options: mqtt.IClientOptions = {
    clientId: `fgb-ingestion-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
  };

  if (env.MQTT_USERNAME) {
    options.username = env.MQTT_USERNAME;
    options.password = env.MQTT_PASSWORD;
  }

  const client = mqtt.connect(env.MQTT_BROKER_URL, options);

  client.on('connect', () => {
    logger.info({ broker: env.MQTT_BROKER_URL }, 'Connected to MQTT broker');
    
    const topics = env.MQTT_TOPICS.split(',').map(t => t.trim());
    topics.forEach(topic => {
      client.subscribe(topic, (err) => {
        if (err) {
          logger.error({ error: err, topic }, 'Failed to subscribe');
        } else {
          logger.info({ topic }, 'Subscribed to topic');
        }
      });
    });
  });

  client.on('message', (topic, payload) => {
    const points = parsePayload(topic, payload);
    telemetryBuffer.push(...points);
    
    logger.debug({ topic, points: points.length }, 'Received message');
  });

  client.on('error', (err) => {
    logger.error({ error: err }, 'MQTT error');
  });

  client.on('offline', () => {
    logger.warn('MQTT client offline');
  });

  return client;
}

// Health check server
function startHealthServer(): void {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      bufferSize: telemetryBuffer.length,
      deviceCacheSize: deviceCache.size,
      uptime: process.uptime(),
    });
  });

  app.get('/metrics', async (req, res) => {
    const { count } = await supabase
      .from('telemetry')
      .select('*', { count: 'exact', head: true });

    res.json({
      telemetryCount: count,
      bufferSize: telemetryBuffer.length,
      deviceCacheSize: deviceCache.size,
    });
  });

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Health server started');
  });
}

// Main
async function main(): Promise<void> {
  logger.info('Starting FGB MQTT Ingestion Service');

  // Verify Supabase connection
  const { error } = await supabase.from('devices').select('id').limit(1);
  if (error) {
    logger.error({ error }, 'Failed to connect to Supabase');
    process.exit(1);
  }
  logger.info('Connected to Supabase');

  // Start MQTT
  connectMqtt();

  // Start health server
  startHealthServer();

  // Periodic buffer flush
  setInterval(flushBuffer, env.BATCH_INTERVAL_MS);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await flushBuffer();
    process.exit(0);
  });
}

main().catch((e) => {
  logger.error({ error: e }, 'Fatal error');
  process.exit(1);
});
