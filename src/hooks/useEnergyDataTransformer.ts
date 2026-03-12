/**
 * useEnergyDataTransformer
 *
 * Universal data-normalisation layer that sits between the timeseries API
 * response and every energy widget on the dashboard.
 *
 * It converts heterogeneous backend data (power-kW *and* native-kWh metrics,
 * across 15 min / 1 h / 1 d buckets) into a single, widget-ready shape
 * computed in a single O(n) pass via `useMemo`.
 */

import { useMemo } from 'react';
import { getHourInTz, resolveTimezone } from '@/lib/timezoneUtils';

// ---------------------------------------------------------------------------
// 1. Input types
// ---------------------------------------------------------------------------

export type Bucket = '15m' | '1h' | '1d';

/** Single data-point as returned by the timeseries Edge Function. */
export interface EnergyDataPoint {
  ts: string;
  metric: string;
  value?: number | null;
  value_avg?: number | null;
  value_sum?: number | null;
  value_min?: number | null;
  value_max?: number | null;
  category?: string | null;
  device_id?: string | null;
  labels?: Record<string, string> | null;
}

/** The shape the Edge Function returns. */
export interface EnergyApiResponse {
  data: EnergyDataPoint[];
  meta: { bucket: Bucket; [k: string]: unknown };
}

/** Site-level parameters required for derived KPIs. */
export interface SiteParams {
  /** Site area in m² – 0 or undefined → density calculations skipped */
  areaM2?: number;
  /** Energy tariff in currency/kWh */
  tariffPrice?: number;
  /** CO₂ emission factor in kgCO₂e / kWh (default 0.233) */
  emissionFactor?: number;
  /** IANA timezone of the site (e.g. "Europe/Rome") */
  timezone?: string | null;
}

// ---------------------------------------------------------------------------
// 2. Output types
// ---------------------------------------------------------------------------

export interface KpiTotals {
  totalEnergyKwh: number;
  estimatedCost: number;
  carbonFootprint: number;
  averageDensity: number | null; // null when area is 0 / missing
}

/** One row per unique `ts`, with total + per-category kWh columns. */
export interface TimeSeriesRow {
  ts: string;
  /** UTC Date for chart rendering */
  date: Date;
  /** Total normalised kWh at this timestamp */
  kwh: number;
  /** Raw power value (kW) – useful only for 15 m line charts */
  kw: number;
  /** kWh / m² – null when area is unavailable */
  kwhPerSqm: number | null;
  /** Dynamic per-category columns: hvac_kwh, lighting_kwh, … */
  [categoryKwh: string]: unknown;
}

export interface DistributionEntry {
  name: string;
  value: number; // kWh
}

export interface DayNightTotals {
  dayKwh: number;   // 08:00 – 19:59
  nightKwh: number; // 20:00 – 07:59
}

export interface EnergyTransformerResult {
  kpiTotals: KpiTotals;
  timeSeriesData: TimeSeriesRow[];
  distributionTotals: DistributionEntry[];
  dayNightTotals: DayNightTotals;
}

// ---------------------------------------------------------------------------
// 3. Pure helpers (no hooks – testable in isolation)
// ---------------------------------------------------------------------------

const POWER_METRIC_PATTERNS = ['power', '_kw', 'power_kw', 'internal_calc_kw'];
const ENERGY_METRIC_PATTERNS = ['energy', 'active_energy', 'active_import', '_kwh'];

function isPowerMetric(metric: string): boolean {
  const m = metric.toLowerCase();
  return POWER_METRIC_PATTERNS.some((p) => m.includes(p));
}

function isEnergyMetric(metric: string): boolean {
  const m = metric.toLowerCase();
  return ENERGY_METRIC_PATTERNS.some((p) => m.includes(p));
}

/** Safe number accessor – null / undefined → 0 */
const n = (v: number | null | undefined): number => (v != null && Number.isFinite(v) ? v : 0);

/**
 * Extract the normalised kWh value from a single data-point, plus the
 * raw kW value for optional power-line rendering.
 */
function extractKwhAndKw(
  dp: EnergyDataPoint,
  bucket: Bucket,
): { kwh: number; kw: number } {
  if (isPowerMetric(dp.metric)) {
    // CASO A – Potenza → derivo volume
    switch (bucket) {
      case '15m': {
        const raw = n(dp.value);
        return { kwh: raw * 0.25, kw: raw };
      }
      case '1h': {
        const avg = n(dp.value_avg);
        return { kwh: avg * 1, kw: avg };
      }
      case '1d': {
        const avg = n(dp.value_avg);
        return { kwh: avg * 24, kw: avg };
      }
    }
  }

  if (isEnergyMetric(dp.metric)) {
    // CASO B – Energia nativa → uso somme dirette
    switch (bucket) {
      case '15m': {
        const raw = n(dp.value);
        return { kwh: raw, kw: 0 };
      }
      case '1h':
      case '1d': {
        const sum = n(dp.value_sum);
        return { kwh: sum, kw: 0 };
      }
    }
  }

  // Fallback: treat unknown metrics as energy sums
  const fallback = n(dp.value_sum ?? dp.value_avg ?? dp.value);
  return { kwh: fallback, kw: n(dp.value_avg ?? dp.value) };
}

/**
 * Normalise a category string into a stable label.
 * DB stores lowercase keys like 'hvac', 'lighting', 'plugs', 'general'.
 */
function normaliseCategory(raw: string | null | undefined): string {
  if (!raw) return 'general';
  const lc = raw.toLowerCase().trim();
  if (lc === 'hvac' || lc === 'climatizzazione') return 'hvac';
  if (lc === 'lighting' || lc === 'illuminazione' || lc === 'luci') return 'lighting';
  if (lc === 'plugs' || lc === 'prese') return 'plugs';
  if (lc === 'general' || lc === 'generale' || lc === 'total') return 'general';
  return lc; // preserve unknown categories as-is
}

const CATEGORY_LABELS: Record<string, string> = {
  hvac: 'HVAC',
  lighting: 'Lighting',
  plugs: 'Plugs',
  general: 'General',
};

// ---------------------------------------------------------------------------
// 4. The hook
// ---------------------------------------------------------------------------

export function useEnergyDataTransformer(
  apiResponse: EnergyApiResponse | null | undefined,
  siteParams: SiteParams,
): EnergyTransformerResult {
  const {
    areaM2 = 0,
    tariffPrice = 0,
    emissionFactor = 0.233,
    timezone,
  } = siteParams;

  const tz = resolveTimezone(timezone);

  return useMemo<EnergyTransformerResult>(() => {
    // ---- empty guard ----
    if (!apiResponse?.data?.length) {
      return {
        kpiTotals: { totalEnergyKwh: 0, estimatedCost: 0, carbonFootprint: 0, averageDensity: null },
        timeSeriesData: [],
        distributionTotals: [],
        dayNightTotals: { dayKwh: 0, nightKwh: 0 },
      };
    }

    const { data, meta } = apiResponse;
    const bucket = meta.bucket;

    // ---- accumulators (single-pass) ----
    let totalKwh = 0;
    let dayKwh = 0;
    let nightKwh = 0;

    // ts → { kwh, kw, per-category kwh }
    const tsMap = new Map<string, { kwh: number; kw: number; date: Date; cats: Map<string, number> }>();

    // category → total kwh
    const catMap = new Map<string, number>();

    // Track all category keys for stacked columns
    const allCats = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const dp = data[i];
      const { kwh, kw } = extractKwhAndKw(dp, bucket);
      const cat = normaliseCategory(dp.category);
      allCats.add(cat);

      // ---- KPI totals ----
      totalKwh += kwh;

      // ---- Day / Night ----
      const date = new Date(dp.ts);
      const hour = getHourInTz(date, tz);
      if (hour >= 8 && hour <= 19) {
        dayKwh += kwh;
      } else {
        nightKwh += kwh;
      }

      // ---- Time-series grouping ----
      let row = tsMap.get(dp.ts);
      if (!row) {
        row = { kwh: 0, kw: 0, date, cats: new Map() };
        tsMap.set(dp.ts, row);
      }
      row.kwh += kwh;
      row.kw += kw;
      row.cats.set(cat, (row.cats.get(cat) ?? 0) + kwh);

      // ---- Distribution ----
      catMap.set(cat, (catMap.get(cat) ?? 0) + kwh);
    }

    // ---- build output arrays ----
    const hasArea = areaM2 > 0;

    // Time-series (sorted by timestamp)
    const timeSeriesData: TimeSeriesRow[] = [];
    const sortedEntries = Array.from(tsMap.entries()).sort((a, b) =>
      a[1].date.getTime() - b[1].date.getTime(),
    );

    for (const [ts, row] of sortedEntries) {
      const obj: TimeSeriesRow = {
        ts,
        date: row.date,
        kwh: row.kwh,
        kw: row.kw,
        kwhPerSqm: hasArea ? row.kwh / areaM2 : null,
      };
      // Stacked category columns
      for (const cat of allCats) {
        obj[`${cat}_kwh`] = row.cats.get(cat) ?? 0;
      }
      timeSeriesData.push(obj);
    }

    // Distribution (sorted descending by value)
    const distributionTotals: DistributionEntry[] = Array.from(catMap.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name: CATEGORY_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }));

    // KPI totals
    const kpiTotals: KpiTotals = {
      totalEnergyKwh: totalKwh,
      estimatedCost: totalKwh * tariffPrice,
      carbonFootprint: totalKwh * emissionFactor,
      averageDensity: hasArea ? totalKwh / areaM2 : null,
    };

    return {
      kpiTotals,
      timeSeriesData,
      distributionTotals,
      dayNightTotals: { dayKwh, nightKwh },
    };
  }, [apiResponse, areaM2, tariffPrice, emissionFactor, tz]);
}

// ---------------------------------------------------------------------------
// 5. Re-exports for testing / direct usage of the pure helpers
// ---------------------------------------------------------------------------

export { extractKwhAndKw, isPowerMetric, isEnergyMetric, normaliseCategory };

// ---------------------------------------------------------------------------
// 6. Usage example (commented out)
// ---------------------------------------------------------------------------

/*
import { useEnergyDataTransformer } from '@/hooks/useEnergyDataTransformer';

function EnergyDashboard({ apiResponse, site }) {
  const { kpiTotals, timeSeriesData, distributionTotals, dayNightTotals } =
    useEnergyDataTransformer(apiResponse, {
      areaM2: site.area_m2,
      tariffPrice: site.energy_price_kwh ?? 0.22,
      timezone: site.timezone,
    });

  return (
    <>
      <KpiCard label="Total" value={`${kpiTotals.totalEnergyKwh.toFixed(1)} kWh`} />
      <KpiCard label="Cost"  value={`€${kpiTotals.estimatedCost.toFixed(2)}`} />
      <KpiCard label="CO₂"   value={`${kpiTotals.carbonFootprint.toFixed(1)} kg`} />
      {kpiTotals.averageDensity != null && (
        <KpiCard label="Density" value={`${kpiTotals.averageDensity.toFixed(2)} kWh/m²`} />
      )}

      <BarChart data={timeSeriesData} dataKey="kwh" />
      <PieChart data={distributionTotals} />
      <DayNightWidget day={dayNightTotals.dayKwh} night={dayNightTotals.nightKwh} />
    </>
  );
}
*/
