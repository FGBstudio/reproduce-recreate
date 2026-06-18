/**
 * Lightweight, deterministic mock data for showcase sites that have no
 * real telemetry behind them (FGB Paris, FGB London HQ, FGB LA Office).
 *
 * All generators are seeded by `siteKey` so values are stable across renders
 * but differ per site. Geographic baselines are tuned to be plausible for an
 * office in each region (LA: warm/dry, London: cool/wet, Paris: temperate).
 */

import {
  eachHourOfInterval,
  eachDayOfInterval,
  differenceInHours,
  parseISO,
} from "date-fns";
import type { Project } from "@/lib/data";

export type DemoModuleScope = {
  energy: boolean;
  air: boolean;
  water: boolean;
  certification: boolean;
  bills: boolean;
};

export interface DemoSiteProfile {
  siteKey: string;
  // Air baselines
  co2: number;       // ppm
  tvoc: number;      // ppb
  pm25: number;      // µg/m³
  pm10: number;      // µg/m³
  co: number;        // ppm
  o3: number;        // ppb
  temperature: number; // °C
  humidity: number;    // %
  // Diurnal swing amplitudes
  tempSwing: number;
  humiditySwing: number;
  // Energy / power
  basePowerKw: number;
  // Modules to render in demo
  modules: DemoModuleScope;
  // Optional certifications already obtained (for the cert tab)
  certifications?: Array<"LEED" | "BREEAM" | "WELL">;
}

// Keyed by Project.id (frontend mock projects)
const PROFILES: Record<number, DemoSiteProfile> = {
  // FGB Paris Office — temperate continental
  2: {
    siteKey: "fgb-paris",
    co2: 560, tvoc: 180, pm25: 11, pm10: 18, co: 0.3, o3: 28,
    temperature: 21.5, humidity: 55,
    tempSwing: 2.5, humiditySwing: 12,
    basePowerKw: 38,
    modules: { energy: true, air: true, water: false, certification: false, bills: false },
  },
  // FGB London HQ — cool, humid, big city
  6: {
    siteKey: "fgb-london",
    co2: 610, tvoc: 220, pm25: 14, pm10: 22, co: 0.4, o3: 24,
    temperature: 20.5, humidity: 62,
    tempSwing: 2.0, humiditySwing: 14,
    basePowerKw: 52,
    modules: { energy: true, air: true, water: true, certification: true, bills: true },
    certifications: ["LEED", "BREEAM", "WELL"],
  },
  // FGB LA Office — warm, dry, sunny
  7: {
    siteKey: "fgb-la",
    co2: 520, tvoc: 160, pm25: 13, pm10: 25, co: 0.5, o3: 42,
    temperature: 23.5, humidity: 42,
    tempSwing: 3.5, humiditySwing: 10,
    basePowerKw: 46,
    modules: { energy: true, air: true, water: true, certification: false, bills: false },
  },
};

export const getDemoProfile = (project: Project | null | undefined): DemoSiteProfile | null => {
  if (!project) return null;
  // Only treat as demo if explicitly flagged AND in our profile map.
  if (!(project as any).demoMockup) return null;
  return PROFILES[project.id] ?? null;
};

// ---- Seeded RNG -------------------------------------------------------------
const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const seeded = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x); // 0..1
};

// Diurnal variation: occupancy-driven sine (peak ~14:00, low ~04:00)
const diurnal = (hour: number) => {
  return Math.sin(((hour - 8) / 24) * Math.PI * 2) * 0.5 + 0.5;
};

// ---- Synthetic air timeseries ----------------------------------------------

export interface DemoAirPoint {
  ts_bucket: string;
  device_id: string;
  metric: string;
  value_avg: number;
}

const AIR_METRICS = [
  "iaq.co2",
  "iaq.tvoc",
  "iaq.pm25",
  "iaq.pm10",
  "iaq.co",
  "iaq.o3",
  "env.temperature",
  "env.humidity",
] as const;

/**
 * Pick a baseline for a given metric from the profile.
 */
const baselineFor = (profile: DemoSiteProfile, metric: string): number => {
  switch (metric) {
    case "iaq.co2": return profile.co2;
    case "iaq.tvoc": return profile.tvoc;
    case "iaq.pm25": return profile.pm25;
    case "iaq.pm10": return profile.pm10;
    case "iaq.co": return profile.co;
    case "iaq.o3": return profile.o3;
    case "env.temperature": return profile.temperature;
    case "env.humidity": return profile.humidity;
    default: return 0;
  }
};

const swingFor = (profile: DemoSiteProfile, metric: string): number => {
  switch (metric) {
    case "iaq.co2": return 200;
    case "iaq.tvoc": return 100;
    case "iaq.pm25": return 8;
    case "iaq.pm10": return 12;
    case "iaq.co": return 0.2;
    case "iaq.o3": return 18;
    case "env.temperature": return profile.tempSwing;
    case "env.humidity": return profile.humiditySwing;
    default: return 0;
  }
};

export const getDemoAirDeviceId = (profile: DemoSiteProfile) => `demo-air-${profile.siteKey}`;

export const getDemoAirDevices = (profile: DemoSiteProfile) => [
  {
    id: getDemoAirDeviceId(profile),
    name: "Open Space",
    location: "Open Space",
    device_id: getDemoAirDeviceId(profile),
    device_type: "air_quality",
  } as any,
];

/**
 * Generate timeseries points covering [startISO, endISO] at hourly granularity
 * (downsampled to daily when range > 31 days). One fake device, all air metrics.
 */
export const generateDemoAirTimeseries = (
  profile: DemoSiteProfile,
  startISO: string,
  endISO: string,
) => {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return { data: [] as DemoAirPoint[] };
  }
  const hours = differenceInHours(end, start);
  const useDaily = hours > 24 * 31;
  const buckets = useDaily
    ? eachDayOfInterval({ start, end })
    : eachHourOfInterval({ start, end });

  const deviceId = getDemoAirDeviceId(profile);
  const seedBase = hashStr(profile.siteKey);
  const points: DemoAirPoint[] = [];

  buckets.forEach((b, idx) => {
    const hour = b.getHours();
    const occ = useDaily ? 0.7 : diurnal(hour); // 0..1
    AIR_METRICS.forEach((metric, mIdx) => {
      const base = baselineFor(profile, metric);
      const swing = swingFor(profile, metric);
      const noise = (seeded(seedBase + idx * 31 + mIdx * 7) - 0.5) * 0.4;
      let value: number;
      if (metric === "env.humidity") {
        // humidity inversely correlated to occupancy/temp
        value = base + swing * (0.4 - occ * 0.6) + noise * swing * 0.3;
      } else {
        value = base + swing * (occ - 0.4) + noise * swing * 0.5;
      }
      if (metric.startsWith("iaq.")) value = Math.max(0, value);
      points.push({
        ts_bucket: b.toISOString(),
        device_id: deviceId,
        metric,
        value_avg: Math.round(value * 100) / 100,
      });
    });
  });

  return { data: points };
};

/**
 * Latest reading snapshot — used to populate Overview KPI cards.
 */
export const generateDemoLatestMetrics = (profile: DemoSiteProfile): Record<string, number> => {
  const seed = hashStr(profile.siteKey + ":latest");
  const jitter = (k: number, span: number) => (seeded(seed + k) - 0.5) * span;
  return {
    "iaq.co2": Math.round(profile.co2 + jitter(1, 60)),
    "iaq.tvoc": Math.round(profile.tvoc + jitter(2, 40)),
    "iaq.pm25": Math.round((profile.pm25 + jitter(3, 4)) * 10) / 10,
    "iaq.pm10": Math.round((profile.pm10 + jitter(4, 6)) * 10) / 10,
    "iaq.co": Math.round((profile.co + jitter(5, 0.1)) * 100) / 100,
    "iaq.o3": Math.round(profile.o3 + jitter(6, 6)),
    "env.temperature": Math.round((profile.temperature + jitter(7, 1.0)) * 10) / 10,
    "env.humidity": Math.round(profile.humidity + jitter(8, 4)),
    "energy.power_kw": Math.round((profile.basePowerKw + jitter(9, 6)) * 10) / 10,
  };
};
