/**
 * Real-time telemetry hooks that connect to timeseries Edge Function
 * with fallback to mock data generation
 */

import { useMemo } from 'react';
import { format, subDays, subWeeks, subMonths, eachDayOfInterval, eachHourOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfDay, startOfYear } from "date-fns";
import { it } from "date-fns/locale";
import { useTimeseries, ApiTimeseriesPoint, useDevices, useLatestTelemetry } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { TimePeriod, DateRange } from '@/hooks/useTimeFilteredData';

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
      end = endOfDay(now);
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
  dateRange?: DateRange
): { labels: string[]; dataByMetric: Record<string, number[]> } {
  if (!points || points.length === 0) {
    return { labels: [], dataByMetric: {} };
  }

  // Group by timestamp bucket
  const bucketMap = new Map<string, Record<string, number>>();
  
  points.forEach(point => {
    const ts = new Date(point.ts_bucket);
    let label: string;
    
    switch (timePeriod) {
      case "today":
        label = format(ts, "HH:mm");
        break;
      case "week":
        label = format(ts, "EEE", { locale: it });
        break;
      case "month":
        label = format(ts, "dd/MM");
        break;
      case "year":
        label = format(ts, "MMM", { locale: it });
        break;
      case "custom":
        if (dateRange) {
          const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 1) label = format(ts, "HH:mm");
          else if (daysDiff <= 90) label = format(ts, "dd/MM");
          else label = format(ts, "MMM yy", { locale: it });
        } else {
          label = format(ts, "dd/MM");
        }
        break;
      default:
        label = format(ts, "dd/MM");
    }

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

function generateMockEnergyData(timePeriod: TimePeriod, dateRange?: DateRange): EnergyDataPoint[] {
  const now = new Date();
  
  const generatePoint = (label: string, i: number) => ({
    label,
    actual: Math.round(30 + seededRandom(i * 17) * 50),
    expected: Math.round(35 + seededRandom(i * 23) * 45),
    average: Math.round(32 + seededRandom(i * 31) * 40),
  });

  switch (timePeriod) {
    case "today": {
      const hours = eachHourOfInterval({ start: startOfDay(now), end:(now) });
      return hours.map((hour, i) => generatePoint(format(hour, "HH:mm"), i));
    }
    case "week": {
      const days = eachDayOfInterval({ start: subDays(now, 6), end: (now) });
      return days.map((day, i) => ({
        ...generatePoint(format(day, "EEE", { locale: it }), i),
        actual: Math.round(400 + seededRandom(i * 19) * 300),
        expected: Math.round(450 + seededRandom(i * 29) * 280),
        average: Math.round(420 + seededRandom(i * 37) * 250),
      }));
    }
    case "month": {
      const weeks = eachWeekOfInterval({ start: subWeeks(now, 3), end: (now) }, { weekStartsOn: 1 });
      return weeks.map((week, i) => ({
        ...generatePoint(`Sett ${i + 1}`, i),
        actual: Math.round(2000 + seededRandom(i * 41) * 1500),
        expected: Math.round(2200 + seededRandom(i * 47) * 1400),
        average: Math.round(2100 + seededRandom(i * 53) * 1200),
      }));
    }
    case "year": {
      const months = eachMonthOfInterval({ start: startOfYear(now), end: (now) });
      return months.map((month, i) => ({
        ...generatePoint(format(month, "MMM", { locale: it }), i),
        actual: Math.round(8000 + seededRandom(i * 59) * 4000),
        expected: Math.round(8500 + seededRandom(i * 61) * 3800),
        average: Math.round(8200 + seededRandom(i * 67) * 3500),
      }));
    }
    case "custom": {
      if (!dateRange) return [];
      const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 1) {
        const hours = eachHourOfInterval({ start: dateRange.from, end: dateRange.to });
        return hours.map((hour, i) => generatePoint(format(hour, "HH:mm"), i));
      } else if (daysDiff <= 14) {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
        return days.map((day, i) => ({
          ...generatePoint(format(day, "dd/MM"), i),
          actual: Math.round(400 + seededRandom(i * 19) * 300),
          expected: Math.round(450 + seededRandom(i * 29) * 280),
          average: Math.round(420 + seededRandom(i * 37) * 250),
        }));
      } else {
        const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
        return months.map((month, i) => ({
          ...generatePoint(format(month, "MMM yy", { locale: it }), i),
          actual: Math.round(8000 + seededRandom(i * 59) * 4000),
          expected: Math.round(8500 + seededRandom(i * 61) * 3800),
          average: Math.round(8200 + seededRandom(i * 67) * 3500),
        }));
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
  dateRange?: DateRange
): UseTimeseriesDataResult<EnergyDataPoint> {
  const { data: devicesData } = useDevices(
    siteId ? { site_id: siteId } : undefined,
    { enabled: !!siteId }
  );
  const devices = devicesData?.data || [];
  const deviceIds = devices.map(d => d.id);
  
  const { start, end, bucket } = getTimeRangeParams(timePeriod, dateRange);
  
  const { 
    data: timeseriesData, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useTimeseries({
    device_ids: deviceIds,
    metrics: ['energy.power_kw', 'energy.hvac_kw', 'energy.lighting_kw'],
    start: start.toISOString(),
    end: end.toISOString(),
    bucket,
  }, {
    enabled: isSupabaseConfigured && deviceIds.length > 0,
  });

  return useMemo(() => {
    // If no Supabase or no devices, use mock data
    if (!isSupabaseConfigured || deviceIds.length === 0 || !timeseriesData?.data?.length) {
      return {
        data: generateMockEnergyData(timePeriod, dateRange),
        isLoading: false,
        isError: false,
        error: null,
        isRealData: false,
        refetch: () => {},
      };
    }

    // Transform real data
    const { labels, dataByMetric } = transformTimeseriesData(
      timeseriesData.data,
      timePeriod,
      dateRange
    );

    const data: EnergyDataPoint[] = labels.map((label, i) => ({
      label,
      actual: Math.round(dataByMetric['energy.power_kw']?.[i] || 0),
      expected: Math.round((dataByMetric['energy.power_kw']?.[i] || 0) * 1.1),
      average: Math.round((dataByMetric['energy.power_kw']?.[i] || 0) * 0.95),
    }));

    return {
      data,
      isLoading,
      isError,
      error: error as Error | null,
      isRealData: true,
      lastUpdate: timeseriesData.meta?.end,
      refetch,
    };
  }, [timeseriesData, deviceIds.length, timePeriod, dateRange, isLoading, isError, error, refetch]);
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
    
    if (latestData?.data) {
      Object.values(latestData.data).forEach(deviceMetrics => {
        deviceMetrics.forEach(m => {
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

    // Provide mock defaults if no real data
    const defaults = {
      'energy.power_kw': 45.2 + Math.random() * 10,
      'energy.hvac_kw': 22.5 + Math.random() * 5,
      'energy.lighting_kw': 12.8 + Math.random() * 3,
      'iaq.co2': 520 + Math.random() * 100,
      'iaq.tvoc': 85 + Math.random() * 30,
      'env.temperature': 22.5 + Math.random() * 2,
      'env.humidity': 48 + Math.random() * 10,
    };

    const hasRealData = Object.keys(metrics).length > 0;

    return {
      metrics: hasRealData ? metrics : defaults,
      isLoading,
      isError,
      error: error as Error | null,
      isRealData: hasRealData,
      refetch,
    };
  }, [latestData, isLoading, isError, error, refetch]);
}

/**
 * Combined hook for project detail with all telemetry types
 */
export function useProjectTelemetry(siteId: string | undefined, timePeriod: TimePeriod, dateRange?: DateRange) {
  const energyData = useRealTimeEnergyData(siteId, timePeriod, dateRange);
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
