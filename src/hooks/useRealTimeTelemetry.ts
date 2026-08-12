/**
 * Real-time telemetry hooks that connect to timeseries Edge Function
 * with fallback to mock data generation
 */

import { useMemo } from 'react';
import { format, subDays, subWeeks, subMonths, eachDayOfInterval, eachHourOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfDay, startOfYear } from "date-fns";
import { it, enUS } from "date-fns/locale";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { getDateLocale } from "@/lib/dateLocale";
import { useTimeseries,useEnergyTimeseries, ApiTimeseriesPoint, useDevices, useLatestTelemetry } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isValidUUID } from '@/lib/utils';
import { TimePeriod, DateRange } from '@/hooks/useTimeFilteredData';
import { formatChartLabel, resolveTimezone } from '@/lib/timezoneUtils';

// =============================================================================
// Types
// =============================================================================

export interface EnergyDataPoint {
  label: string;
  actual: number;
  expected: number;
  average: number;
}

export interface DeviceDataPoint {
  label: string;
  hvac: number;
  lighting: number;
  plugs: number;
}

export interface CO2DataPoint {
  label: string;
  co2: number;
  limit: number;
}

export interface WaterDataPoint {
  label: string;
  consumption: number;
  target: number;
  lastYear: number;
}

interface UseTimeseriesDataResult<T> {
  data: T[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isRealData: boolean;
  lastUpdate?: string;
  refetch: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

/**
 * Realistic diurnal (day/night) occupancy factor calculation:
 * - Night (00:00-06:00): Standby ~15%
 * - Morning Ramp (07:00-09:00): 15% -> 85%
 * - Peak Business Hours (09:00-17:00): 85% -> 100% -> 85%
 * - Evening Ramp Down (17:00-20:00): 85% -> 20%
 * - Weekend (Sat/Sun): ~15% standby load
 */
function getDiurnalFactor(date: Date): { occupancy: number; isWeekend: boolean } {
  const day = date.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = day === 0 || day === 6;
  const hour = date.getHours() + date.getMinutes() / 60;
  
  // 1. Multi-day macro weather system wave (3.7 day cycle)
  const dayStart = startOfDay(date).getTime();
  const macroWave = Math.sin((dayStart / (86400000 * 3.7)) * Math.PI) * 0.15;

  // 2. Per-day unique weather & occupancy variance (so every day has distinct peaks)
  const daySeedNoise = (seededRandom(dayStart) - 0.5) * 0.20;

  if (isWeekend) {
    const noise = (seededRandom(date.getTime() * 0.001) - 0.5) * 0.05;
    return { occupancy: Math.max(0.1, 0.15 + macroWave * 0.5 + noise), isWeekend: true };
  }

  let occupancy = 0.15; // night baseline
  if (hour >= 7 && hour < 9) {
    occupancy = 0.15 + ((hour - 7) / 2) * (0.70 + daySeedNoise);
  } else if (hour >= 9 && hour <= 17) {
    const midPeak = Math.sin(((hour - 9) / 8) * Math.PI);
    occupancy = 0.80 + midPeak * (0.20 + daySeedNoise * 0.5);
  } else if (hour > 17 && hour <= 20) {
    occupancy = 0.85 - ((hour - 17) / 3) * 0.65;
  } else {
    occupancy = 0.15 + (Math.sin(hour) * 0.02);
  }

  // Combine diurnal occupancy + multi-day weather shift + hourly noise
  const hourlyNoise = (seededRandom(date.getTime()) - 0.5) * 0.04;
  const totalFactor = occupancy + macroWave + daySeedNoise * 0.3 + hourlyNoise;

  return { occupancy: Math.max(0.12, Math.min(1.0, totalFactor)), isWeekend: false };
}

/**
 * Calculate date range and bucket based on time period
 */
function getTimeRangeParams(timePeriod: TimePeriod, dateRange?: DateRange) {
  const now = new Date();
  let start: Date;
  let end: Date = now;
  let bucket: string;

  switch (timePeriod) {
    case "today":
      start = startOfDay(now);
      bucket = "1h";
      break;
    case "week":
      start = subDays(now, 6);
      bucket = "1d";
      break;
    case "month":
      start = subWeeks(now, 3);
      bucket = "1d";
      break;
    case "year":
      start = startOfYear(now);
      bucket = "1M";
      break;
    case "custom":
      if (!dateRange) {
        start = subDays(now, 7);
        bucket = "1d";
      } else {
        start = dateRange.from;
        end = dateRange.to;
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 1) bucket = "1h";
        else if (daysDiff <= 14) bucket = "1d";
        else if (daysDiff <= 90) bucket = "1d";
        else bucket = "1M";
      }
      break;
    default:
      start = subDays(now, 7);
      bucket = "1d";
  }

  return { start, end, bucket };
}

/**
 * Transform timeseries API data to chart data points
 */
function transformTimeseriesData(
  points: ApiTimeseriesPoint[],
  timePeriod: TimePeriod,
  dateRange?: DateRange,
  siteTimezone?: string
): { labels: string[]; dataByMetric: Record<string, number[]> } {
  if (!points || points.length === 0) {
    return { labels: [], dataByMetric: {} };
  }

  const tz = resolveTimezone(siteTimezone);

  // Determine bucket from time range (same logic as backend)
  const getBucketFromPeriod = (): '15m' | '1h' | '1d' => {
    if (timePeriod === 'today') return '1h';
    if (timePeriod === 'week') return '1d';
    if (timePeriod === 'month') return '1d';
    if (timePeriod === 'year') return '1d';
    if (timePeriod === 'custom' && dateRange) {
      const diffH = (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60);
      if (diffH <= 24) return '15m';
      if (diffH <= 24 * 31) return '1h';
      return '1d';
    }
    return '1d';
  };
  const bucket = getBucketFromPeriod();

  // Group by timestamp bucket — labels in site timezone
  const bucketMap = new Map<string, Record<string, number>>();
  
  points.forEach(point => {
    const ts = new Date(point.ts_bucket);
    const label = formatChartLabel(ts, bucket, tz, timePeriod as any);

    if (!bucketMap.has(label)) {
      bucketMap.set(label, {});
    }
    bucketMap.get(label)![point.metric] = point.value_avg;
  });

  const labels = Array.from(bucketMap.keys());
  const dataByMetric: Record<string, number[]> = {};

  labels.forEach((label, idx) => {
    const metrics = bucketMap.get(label)!;
    Object.entries(metrics).forEach(([metric, value]) => {
      if (!dataByMetric[metric]) {
        dataByMetric[metric] = new Array(labels.length).fill(0);
      }
      dataByMetric[metric][idx] = value;
    });
  });

  return { labels, dataByMetric };
}

// =============================================================================
// Mock Data Generators (fallback)
// =============================================================================

function generateMockEnergyData(timePeriod: TimePeriod, dateRange?: DateRange, language: Language = 'en'): EnergyDataPoint[] {
  const now = new Date();
  const dateLocale = getDateLocale(language);
  const weekLabel = language === 'it' ? 'Sett' : 'Wk';

  switch (timePeriod) {
    case "today": {
      const hours = eachHourOfInterval({ start: startOfDay(now), end: now });
      return hours.map((hourDate, i) => {
        const { occupancy } = getDiurnalFactor(hourDate);
        const actual = Math.round(15 + occupancy * 65); // 15kW night -> 80kW peak
        return {
          label: format(hourDate, "HH:mm"),
          actual,
          expected: Math.round(actual * 1.05),
          average: Math.round(actual * 0.95),
        };
      });
    }
    case "week": {
      const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
      return days.map((dayDate, i) => {
        const { isWeekend } = getDiurnalFactor(dayDate);
        const baseKwh = isWeekend ? 180 : 620;
        const variation = (seededRandom(dayDate.getTime()) - 0.5) * 60;
        const actual = Math.round(baseKwh + variation);
        return {
          label: format(dayDate, "EEE", { locale: dateLocale }),
          actual,
          expected: Math.round(actual * 1.04),
          average: Math.round(actual * 0.96),
        };
      });
    }
    case "month": {
      const weeks = eachWeekOfInterval({ start: subWeeks(now, 3), end: now }, { weekStartsOn: 1 });
      return weeks.map((weekDate, i) => {
        const actual = Math.round(2400 + seededRandom(weekDate.getTime()) * 800);
        return {
          label: `${weekLabel} ${i + 1}`,
          actual,
          expected: Math.round(actual * 1.05),
          average: Math.round(actual * 0.95),
        };
      });
    }
    case "year": {
      const months = eachMonthOfInterval({ start: startOfYear(now), end: now });
      return months.map((monthDate, i) => {
        const monthNum = monthDate.getMonth();
        const seasonalFactor = Math.abs(Math.sin(((monthNum + 1) / 12) * Math.PI - 0.5));
        const actual = Math.round(7500 + seasonalFactor * 4500 + (seededRandom(monthDate.getTime()) - 0.5) * 800);
        return {
          label: format(monthDate, "MMM", { locale: dateLocale }),
          actual,
          expected: Math.round(actual * 1.05),
          average: Math.round(actual * 0.95),
        };
      });
    }
    case "custom": {
      if (!dateRange) return [];
      const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 1) {
        const hours = eachHourOfInterval({ start: dateRange.from, end: dateRange.to });
        return hours.map((hourDate, i) => {
          const { occupancy } = getDiurnalFactor(hourDate);
          const actual = Math.round(15 + occupancy * 65);
          return {
            label: format(hourDate, "HH:mm"),
            actual,
            expected: Math.round(actual * 1.05),
            average: Math.round(actual * 0.95),
          };
        });
      } else if (daysDiff <= 14) {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
        return days.map((dayDate, i) => {
          const { isWeekend } = getDiurnalFactor(dayDate);
          const baseKwh = isWeekend ? 180 : 620;
          const actual = Math.round(baseKwh + (seededRandom(dayDate.getTime()) - 0.5) * 60);
          return {
            label: format(dayDate, "dd/MM"),
            actual,
            expected: Math.round(actual * 1.04),
            average: Math.round(actual * 0.96),
          };
        });
      } else {
        const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
        return months.map((monthDate, i) => {
          const actual = Math.round(8000 + (seededRandom(monthDate.getTime()) - 0.5) * 2000);
          return {
            label: format(monthDate, "MMM yy", { locale: dateLocale }),
            actual,
            expected: Math.round(actual * 1.05),
            average: Math.round(actual * 0.95),
          };
        });
      }
    }
    default:
      return [];
  }
}

// =============================================================================
// Real-Time Telemetry Hooks
// =============================================================================

/**
 * Hook for real-time energy data with timeseries API integration
 */
export function useRealTimeEnergyData(
  siteId: string | undefined,
  timePeriod: TimePeriod,
  dateRange?: DateRange,
  siteTimezone?: string
): UseTimeseriesDataResult<EnergyDataPoint> {
  const { language } = useLanguage();
  // Use memoized time range to prevent unnecessary refetches
  const dateRangeFromTime = dateRange?.from?.getTime() ?? 0;
  const dateRangeToTime = dateRange?.to?.getTime() ?? 0;
  const timeRange = useMemo(() => {
    return getTimeRangeParams(timePeriod, dateRange);
  }, [timePeriod, dateRange, dateRangeFromTime, dateRangeToTime]);
  
  const { start, end, bucket } = timeRange;
  
  // Query energy timeseries directly by site_id - no need to fetch devices first
  // The energy_* tables support site_id filtering directly
  const { 
    data: timeseriesData, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useEnergyTimeseries({
    site_id: siteId,
    metrics: ['energy.power_kw', 'energy.hvac_kw', 'energy.lighting_kw', 'energy.plugs_kw'],
    start: start.toISOString(),
    end: end.toISOString(),
    bucket,
  }, {
    enabled: isSupabaseConfigured && isValidUUID(siteId),
  });

  return useMemo(() => {
    // Serie dimostrativa SOLO per la modalita' demo locale (niente Supabase)
    // o per i siti vetrina, che non hanno un UUID. Mai marcata come reale:
    // il badge deve dire DEMO.
    if (!isSupabaseConfigured || !siteId || !isValidUUID(siteId)) {
      return {
        data: generateMockEnergyData(timePeriod, dateRange, language),
        isLoading: false,
        isError: false,
        error: null,
        isRealData: false,
        refetch: () => {},
      };
    }

    // Still loading
    if (isLoading) {
      return {
        data: [],
        isLoading: true,
        isError: false,
        error: null,
        isRealData: false,
        refetch,
      };
    }

    // Sito reale senza dati nel periodo: serie VUOTA, mai una curva inventata.
    // (Prima qui scattava generateMockEnergyData con isRealData: true — ogni
    // negozio senza contatore mostrava consumi finti col badge LIVE.)
    if (!timeseriesData?.data?.length) {
      return {
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        isRealData: false,
        refetch,
      };
    }

    // Transform real data
    const { labels, dataByMetric } = transformTimeseriesData(
      timeseriesData.data,
      timePeriod,
      dateRange,
      siteTimezone
    );

    console.log('[useRealTimeEnergyData] Real data found:', {
      pointCount: timeseriesData.data.length,
      source: timeseriesData.meta?.source,
      labels: labels.length,
      metrics: Object.keys(dataByMetric),
    });

    const data: EnergyDataPoint[] = labels.map((label, i) => ({
      label,
      actual: Math.round(dataByMetric['energy.power_kw']?.[i] || 0),
      expected: Math.round((dataByMetric['energy.power_kw']?.[i] || 0) * 1.1),
      average: Math.round((dataByMetric['energy.power_kw']?.[i] || 0) * 0.95),
    }));

    return {
      data,
      isLoading: false,
      isError,
      error: error as Error | null,
      isRealData: true,
      lastUpdate: timeseriesData.meta?.end,
      refetch,
    };
  }, [timeseriesData, siteId, timePeriod, dateRange, isLoading, isError, error, refetch, siteTimezone]);
}

/**
 * Hook for latest telemetry readings with loading states
 */
export function useRealTimeLatestData(siteId: string | undefined) {
  const { 
    data: latestData, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useLatestTelemetry(
    siteId ? { site_id: siteId } : undefined,
    { enabled: !!siteId && isSupabaseConfigured }
  );

  return useMemo(() => {
    const metrics: Record<string, number> = {};
    let latestTimestamp: string | undefined;
    
    if (latestData?.data) {
      Object.values(latestData.data).forEach(deviceMetrics => {
        deviceMetrics.forEach(m => {
          // Track most recent timestamp across all metrics
          if (m.ts && (!latestTimestamp || m.ts > latestTimestamp)) {
            latestTimestamp = m.ts;
          }
          // Sum energy metrics, average others
          if (m.metric.startsWith('energy.')) {
            metrics[m.metric] = (metrics[m.metric] || 0) + m.value;
          } else {
            if (!metrics[m.metric]) {
              metrics[m.metric] = m.value;
            } else {
              metrics[m.metric] = (metrics[m.metric] + m.value) / 2;
            }
          }
        });
      });
    }

    const hasRealData = Object.keys(metrics).length > 0;
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const isStale = latestTimestamp
      ? Date.now() - new Date(latestTimestamp).getTime() > TWO_DAYS_MS
      : false;

    // Metriche diurne dimostrative SOLO per i siti vetrina (id non-UUID).
    // Un sito reale senza letture restituisce metriche vuote e
    // isRealData: false — le card mostrano NO_DATA, mai numeri inventati.
    // (Prima il fallback valeva per tutti, con isRealData sempre true:
    // potenza, CO2, umidita' e flusso d'acqua finti col badge LIVE.)
    const now = new Date();
    const isShowcaseSite = !!siteId && !isValidUUID(siteId);
    let effectiveMetrics = metrics;
    if (!hasRealData && isShowcaseSite) {
      const { occupancy } = getDiurnalFactor(now);
      const mockPowerKw = Math.round(15 + occupancy * 65);
      effectiveMetrics = {
        'energy.power_kw': mockPowerKw,
        'energy.hvac_kw': Math.round(mockPowerKw * 0.45),
        'energy.lighting_kw': Math.round(mockPowerKw * 0.35),
        'energy.plugs_kw': Math.round(mockPowerKw * 0.20),
        'iaq.co2': Math.round(415 + occupancy * 260),
        'iaq.temperature': Number((19.8 + occupancy * 2.7).toFixed(1)),
        'iaq.humidity': Math.round(48 + Math.sin(now.getTime() / 10000) * 4),
        'water.flow_rate': Number((0.2 + occupancy * 2.8).toFixed(1)),
      };
    }

    return {
      metrics: effectiveMetrics,
      isLoading,
      isError,
      error: error as Error | null,
      isRealData: hasRealData,
      isStale: hasRealData ? isStale : false,
      lastUpdate: latestTimestamp || now.toISOString(),
      refetch,
    };
  }, [latestData, isLoading, isError, error, refetch, siteId]);
}

/**
 * Combined hook for project detail with all telemetry types
 */
export function useProjectTelemetry(siteId: string | undefined, timePeriod: TimePeriod, dateRange?: DateRange, siteTimezone?: string) {
  const energyData = useRealTimeEnergyData(siteId, timePeriod, dateRange, siteTimezone);
  const latestData = useRealTimeLatestData(siteId);

  const isLoading = energyData.isLoading || latestData.isLoading;
  const isError = energyData.isError || latestData.isError;

  return {
    energy: energyData,
    latest: latestData,
    isLoading,
    isError,
    isRealData: energyData.isRealData || latestData.isRealData,
  };
}
