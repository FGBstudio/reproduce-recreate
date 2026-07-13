/**
 * Air Monitor Type Detection
 *
 * Two families of indoor air monitors coexist in the fleet:
 * - WELL (8 metrics): CO2, TVOC, PM2.5, PM10, CO, O3, TEMP, HUM
 * - LEED (4 metrics): CO2, TVOC, TEMP, HUM
 *
 * We identify a device primarily by its name/model (deterministic) and
 * fall back to telemetry (a device that has never reported any of the 4
 * extended metrics is treated as LEED).
 *
 * When we have no signal at all we default to WELL/8-metric so we don't
 * hide UI aggressively for brand-new devices.
 */

export const BASE_AIR_METRICS = [
  "iaq.co2",
  "iaq.voc",
  "env.temperature",
  "env.humidity",
] as const;

export const EXTENDED_AIR_METRICS = [
  "iaq.pm25",
  "iaq.pm10",
  "iaq.co",
  "iaq.o3",
] as const;

export const ALL_AIR_METRICS = [
  ...BASE_AIR_METRICS,
  ...EXTENDED_AIR_METRICS,
] as const;

export type AirMetric = (typeof ALL_AIR_METRICS)[number];

type AnyDevice = {
  id?: string;
  device_id?: string;
  name?: string | null;
  model?: string | null;
} | null | undefined;

type Averages = Record<string, number | null | undefined> | undefined | null;

const LEED_REGEX = /\bleed\b/i;
const WELL_REGEX = /\b(well|weel)\b/i;

function deviceNameHaystack(device: AnyDevice): string {
  if (!device) return "";
  return [device.model, device.name, device.device_id]
    .filter(Boolean)
    .join(" ");
}

/** Deterministic detection from device name/model. */
export function isLeedByName(device: AnyDevice): boolean {
  const hay = deviceNameHaystack(device);
  if (!hay) return false;
  if (WELL_REGEX.test(hay)) return false;
  return LEED_REGEX.test(hay);
}

export function isWellByName(device: AnyDevice): boolean {
  const hay = deviceNameHaystack(device);
  if (!hay) return false;
  return WELL_REGEX.test(hay);
}

/**
 * Telemetry fallback: if we have averages and none of the 4 extended
 * metrics has a numeric value, treat the device as LEED.
 */
export function isLeedByTelemetry(avg: Averages): boolean {
  if (!avg) return false;
  const keys = Object.keys(avg);
  if (keys.length === 0) return false;
  return EXTENDED_AIR_METRICS.every((m) => {
    const v = avg[m];
    return v == null || Number.isNaN(Number(v));
  });
}

/** Combined verdict — name wins when explicit, telemetry is fallback. */
export function isLeedMonitor(device: AnyDevice, avg?: Averages): boolean {
  if (isWellByName(device)) return false;
  if (isLeedByName(device)) return true;
  return isLeedByTelemetry(avg);
}

/** Set of metrics the device is expected to report. */
export function getSupportedAirMetrics(
  device: AnyDevice,
  avg?: Averages
): Set<AirMetric> {
  const base = new Set<AirMetric>(BASE_AIR_METRICS);
  if (isLeedMonitor(device, avg)) return base;
  EXTENDED_AIR_METRICS.forEach((m) => base.add(m));
  return base;
}

/** Short label for badges — "LEED" / "WELL" / null when unknown. */
export function getMonitorFamilyLabel(
  device: AnyDevice,
  avg?: Averages
): "LEED" | "WELL" | null {
  if (isWellByName(device)) return "WELL";
  if (isLeedByName(device)) return "LEED";
  if (isLeedByTelemetry(avg)) return "LEED";
  return null;
}

/** Union of supported metrics across a list of devices. */
export function getSupportedMetricsForDevices(
  devices: AnyDevice[],
  deviceAverages?: Record<string, Averages>
): Set<AirMetric> {
  const out = new Set<AirMetric>(BASE_AIR_METRICS);
  for (const d of devices) {
    const key = (d?.device_id || d?.id) as string | undefined;
    const avg = key && deviceAverages ? deviceAverages[key] : undefined;
    const set = getSupportedAirMetrics(d, avg);
    set.forEach((m) => out.add(m));
  }
  return out;
}