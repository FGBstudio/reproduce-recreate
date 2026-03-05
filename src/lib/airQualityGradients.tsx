import React from "react";

/**
 * Air Quality Y-axis gradient configurations.
 * Each gradient goes bottom→top (y1=1, y2=0), mapping value ranges
 * to color stops based on criticality thresholds.
 *
 * Colors:
 *   Blue (cold):  #60a5fa
 *   Green (good): #34d399
 *   Yellow (warn): #fbbf24
 *   Red (critical): #f87171
 */

interface GradientConfig {
  id: string;
  /** Chart Y-axis domain: [min, max] */
  domain: [number, number];
  /** Stops: { value, color } — will be mapped to offset % */
  stops: { value: number; color: string }[];
}

const COLORS = {
  blue: "#60a5fa",
  green: "#34d399",
  greenLight: "#6ee7b7",
  yellow: "#fbbf24",
  red: "#f87171",
};

function valueToOffset(value: number, domain: [number, number]): number {
  const [min, max] = domain;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function buildStops(config: GradientConfig) {
  return config.stops.map((s) => ({
    offset: `${valueToOffset(s.value, config.domain)}%`,
    color: s.color,
  }));
}

// ─── Gradient Configs ───────────────────────────────────────────

export const gradientConfigs: Record<string, GradientConfig> = {
  co2: {
    id: "iaqGradCo2",
    domain: [0, 1200],
    stops: [
      { value: 0, color: COLORS.green },
      { value: 700, color: COLORS.green },
      { value: 800, color: COLORS.yellow },
      { value: 1000, color: COLORS.yellow },
      { value: 1050, color: COLORS.red },
      { value: 1200, color: COLORS.red },
    ],
  },
  tvoc: {
    id: "iaqGradTvoc",
    domain: [0, 600],
    stops: [
      { value: 0, color: COLORS.green },
      { value: 200, color: COLORS.green },
      { value: 250, color: COLORS.yellow },
      { value: 500, color: COLORS.yellow },
      { value: 520, color: COLORS.red },
      { value: 600, color: COLORS.red },
    ],
  },
  temp: {
    id: "iaqGradTemp",
    domain: [10, 35],
    stops: [
      { value: 10, color: COLORS.blue },
      { value: 16, color: COLORS.blue },
      { value: 18, color: COLORS.green },
      { value: 26, color: COLORS.green },
      { value: 28, color: COLORS.red },
      { value: 35, color: COLORS.red },
    ],
  },
  tempInline: {
    id: "iaqGradTempInline",
    domain: [18, 28],
    stops: [
      { value: 18, color: COLORS.blue },
      { value: 19, color: COLORS.greenLight },
      { value: 20, color: COLORS.green },
      { value: 25, color: COLORS.green },
      { value: 26, color: COLORS.yellow },
      { value: 28, color: COLORS.red },
    ],
  },
  humidity: {
    id: "iaqGradHumidity",
    domain: [0, 100],
    stops: [
      { value: 0, color: COLORS.yellow },
      { value: 25, color: COLORS.yellow },
      { value: 30, color: COLORS.green },
      { value: 60, color: COLORS.green },
      { value: 65, color: COLORS.red },
      { value: 100, color: COLORS.red },
    ],
  },
  humidityInline: {
    id: "iaqGradHumidityInline",
    domain: [20, 70],
    stops: [
      { value: 20, color: COLORS.yellow },
      { value: 30, color: COLORS.yellow },
      { value: 32, color: COLORS.green },
      { value: 58, color: COLORS.green },
      { value: 60, color: COLORS.red },
      { value: 70, color: COLORS.red },
    ],
  },
  pm25: {
    id: "iaqGradPm25",
    domain: [0, 50],
    stops: [
      { value: 0, color: COLORS.green },
      { value: 12, color: COLORS.green },
      { value: 15, color: COLORS.yellow },
      { value: 25, color: COLORS.yellow },
      { value: 28, color: COLORS.red },
      { value: 50, color: COLORS.red },
    ],
  },
  pm10: {
    id: "iaqGradPm10",
    domain: [0, 80],
    stops: [
      { value: 0, color: COLORS.green },
      { value: 20, color: COLORS.green },
      { value: 25, color: COLORS.yellow },
      { value: 50, color: COLORS.yellow },
      { value: 55, color: COLORS.red },
      { value: 80, color: COLORS.red },
    ],
  },
};

// ─── React SVG <defs> component ─────────────────────────────────

/** Renders one or more gradient <defs> inside a Recharts chart.
 *  Usage: place `<IAQGradientDefs keys={['co2','tvoc']} />` as a
 *  child of <LineChart> (Recharts renders unknown children into the SVG).
 */
export const IAQGradientDefs = ({ keys }: { keys: string[] }) => {
  return (
    <defs>
      {keys.map((k) => {
        const cfg = gradientConfigs[k];
        if (!cfg) return null;
        const stops = buildStops(cfg);
        return (
          <linearGradient key={cfg.id} id={cfg.id} x1="0" y1="1" x2="0" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.85} />
            ))}
          </linearGradient>
        );
      })}
    </defs>
  );
};

/** YAxis axisLine prop for a given gradient key */
export const gradientAxisLine = (key: string) => {
  const cfg = gradientConfigs[key];
  if (!cfg) return { stroke: "#e2e8f0" };
  return {
    stroke: `url(#${cfg.id})`,
    strokeWidth: 4,
    strokeLinecap: "round" as const,
  };
};
