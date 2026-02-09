import { useMemo } from "react";
import { 
  format, 
  subDays, 
  subWeeks, 
  subMonths, 
  eachDayOfInterval, 
  eachHourOfInterval, 
  eachWeekOfInterval, 
  eachMonthOfInterval, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  startOfMonth, 
  startOfYear, 
  endOfYear,
  differenceInDays 
} from "date-fns";
import { it } from "date-fns/locale";
import { useEnergyTimeseries, useWeatherTimeseries } from "../lib/api";

export type TimePeriod = "today" | "week" | "month" | "year" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

// =============================================================================
// Helper: Calculate API params from TimePeriod
// =============================================================================
export const getTimeRangeParams = (timePeriod: TimePeriod, dateRange?: DateRange) => {
  const now = new Date();
  let start = startOfDay(now);
  let end = now;
  let bucket = "1h"; // default granularity

  switch (timePeriod) {
    case "today":
      start = startOfDay(now);
      end = now;
      bucket = "15m";
      break;
    case "week":
      start = subDays(now, 7);
      end = now;
      bucket = "1h";
      break;
    case "month":
      start = subMonths(now, 1);
      end = now;
      bucket = "1h"; // Hourly resolution for month view provides better detail
      break;
    case "year":
      start = startOfYear(now);
      end = now;
      bucket = "1d"; // Daily averages for year view
      break;
    case "custom":
      if (dateRange?.from && dateRange?.to) {
        start = dateRange.from;
        end = dateRange.to;
        const days = differenceInDays(end, start);
        if (days <= 1) bucket = "15m";
        else if (days <= 60) bucket = "1h";
        else bucket = "1d";
      }
      break;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    bucket
  };
};

// =============================================================================
// Real Data Hooks (Synced with API)
// =============================================================================

/**
 * Hook for Energy vs Outdoor Conditions Chart
 * Fetches Energy (HVAC, Lighting, Total) + Weather (Temp, Humidity)
 * Joins data on timestamp
 */
export const useEnergyWeatherAnalysis = (
  siteId: string | undefined, 
  timePeriod: TimePeriod, 
  dateRange?: DateRange
) => {
  const { start, end, bucket } = useMemo(
    () => getTimeRangeParams(timePeriod, dateRange),
    [timePeriod, dateRange]
  );

  // 1. Fetch Energy Data
  const { data: energyResponse, isLoading: isEnergyLoading } = useEnergyTimeseries({
    site_id: siteId,
    // Request specific sub-meters + total power for fallback
    metrics: ['energy.hvac_kw', 'energy.lighting_kw', 'energy.power_kw'],
    start,
    end,
    bucket
  });

  // 2. Fetch Weather Data (from weather_data table)
  const { data: weatherResponse, isLoading: isWeatherLoading } = useWeatherTimeseries({
    site_id: siteId || '',
    start,
    end,
    bucket
  });

  // 3. Join & Format Data
  const joinedData = useMemo(() => {
    if (!energyResponse?.data && !weatherResponse?.data) return [];

    const map = new Map<string, any>();

    // Helper to get or create entry
    const getEntry = (ts: string) => {
      if (!map.has(ts)) {
        map.set(ts, { 
          timestamp: ts,
          // Format label based on bucket logic (simplified)
          label: format(new Date(ts), bucket === '1d' ? 'dd MMM' : 'HH:mm', { locale: it }),
          hvac: null, 
          lighting: null, 
          general: null, 
          temp: null, 
          humidity: null 
        });
      }
      return map.get(ts);
    };

    // Process Energy
    energyResponse?.data.forEach(p => {
      const ts = p.ts_bucket || p.ts;
      if (!ts) return;
      const entry = getEntry(ts);
      // Use average for power (kW)
      const val = p.value_avg ?? p.value;
      
      if (p.metric === 'energy.hvac_kw') entry.hvac = val;
      else if (p.metric === 'energy.lighting_kw') entry.lighting = val;
      else if (p.metric === 'energy.power_kw') entry.general = val;
    });

    // Process Weather
    weatherResponse?.data.forEach(p => {
      const ts = p.ts_bucket || p.ts;
      if (!ts) return;
      const entry = getEntry(ts);
      const val = p.value_avg ?? p.value;

      if (p.metric === 'weather.temperature') entry.temp = val;
      else if (p.metric === 'weather.humidity') entry.humidity = val;
    });

    // Convert Map to sorted Array
    return Array.from(map.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  }, [energyResponse, weatherResponse, bucket]);

  return {
    data: joinedData,
    isLoading: isEnergyLoading || isWeatherLoading,
    isEmpty: joinedData.length === 0
  };
};

// =============================================================================
// Mock Data Generators (Legacy / Demo Mode)
// =============================================================================

// Generate random value with some variation based on seed
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Generate energy data based on time period
export const useEnergyData = (timePeriod: TimePeriod, dateRange?: DateRange) => {
  return useMemo(() => {
    const now = new Date();
    
    switch (timePeriod) {
      case "today": {
        // Hourly data for today
        const hours = eachHourOfInterval({
          start: startOfDay(now),
          end: now
        });
        return hours.map((hour, i) => ({
          label: format(hour, "HH:mm"),
          actual: Math.round(30 + seededRandom(i * 17) * 50),
          expected: Math.round(35 + seededRandom(i * 23) * 45),
          average: Math.round(32 + seededRandom(i * 31) * 40),
        }));
      }
      case "week": {
        // Daily data for this week
        const days = eachDayOfInterval({
          start: subDays(now, 6),
          end: now
        });
        return days.map((day, i) => ({
          label: format(day, "EEE", { locale: it }),
          actual: Math.round(400 + seededRandom(i * 19) * 300),
          expected: Math.round(450 + seededRandom(i * 29) * 280),
          average: Math.round(420 + seededRandom(i * 37) * 250),
        }));
      }
      case "month": {
        // Weekly data for this month
        const weeks = eachWeekOfInterval({
          start: subWeeks(now, 3),
          end: now
        }, { weekStartsOn: 1 });
        return weeks.map((week, i) => ({
          label: `Sett ${i + 1}`,
          actual: Math.round(2000 + seededRandom(i * 41) * 1500),
          expected: Math.round(2200 + seededRandom(i * 47) * 1400),
          average: Math.round(2100 + seededRandom(i * 53) * 1200),
        }));
      }
      case "year": {
        // Monthly data for this year
        const months = eachMonthOfInterval({
          start: startOfYear(now),
          end: now
        });
        return months.map((month, i) => ({
          label: format(month, "MMM", { locale: it }),
          actual: Math.round(8000 + seededRandom(i * 59) * 4000),
          expected: Math.round(8500 + seededRandom(i * 61) * 3800),
          average: Math.round(8200 + seededRandom(i * 67) * 3500),
        }));
      }
      case "custom": {
        if (!dateRange) return [];
        const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) {
          // Hourly
          const hours = eachHourOfInterval({ start: dateRange.from, end: dateRange.to });
          return hours.map((hour, i) => ({
            label: format(hour, "HH:mm"),
            actual: Math.round(30 + seededRandom(i * 17) * 50),
            expected: Math.round(35 + seededRandom(i * 23) * 45),
            average: Math.round(32 + seededRandom(i * 31) * 40),
          }));
        } else if (daysDiff <= 14) {
          // Daily
          const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
          return days.map((day, i) => ({
            label: format(day, "dd/MM"),
            actual: Math.round(400 + seededRandom(i * 19) * 300),
            expected: Math.round(450 + seededRandom(i * 29) * 280),
            average: Math.round(420 + seededRandom(i * 37) * 250),
          }));
        } else if (daysDiff <= 90) {
          // Weekly
          const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to }, { weekStartsOn: 1 });
          return weeks.map((week, i) => ({
            label: format(week, "dd/MM"),
            actual: Math.round(2000 + seededRandom(i * 41) * 1500),
            expected: Math.round(2200 + seededRandom(i * 47) * 1400),
            average: Math.round(2100 + seededRandom(i * 53) * 1200),
          }));
        } else {
          // Monthly
          const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
          return months.map((month, i) => ({
            label: format(month, "MMM yy", { locale: it }),
            actual: Math.round(8000 + seededRandom(i * 59) * 4000),
            expected: Math.round(8500 + seededRandom(i * 61) * 3800),
            average: Math.round(8200 + seededRandom(i * 67) * 3500),
          }));
        }
      }
      default:
        return [];
    }
  }, [timePeriod, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);
};

// Generate device consumption data based on time period
export const useDeviceData = (timePeriod: TimePeriod, dateRange?: DateRange) => {
  return useMemo(() => {
    const now = new Date();
    
    const generateDataPoint = (label: string, i: number, scale: number) => ({
      label,
      hvac: Math.round((3000 + seededRandom(i * 71) * 2000) * scale),
      lighting: Math.round((1500 + seededRandom(i * 73) * 1000) * scale),
      plugs: Math.round((800 + seededRandom(i * 79) * 500) * scale),
    });

    switch (timePeriod) {
      case "today": {
        const hours = eachHourOfInterval({ start: startOfDay(now), end: now });
        return hours.map((hour, i) => generateDataPoint(format(hour, "HH:mm"), i, 0.05));
      }
      case "week": {
        const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
        return days.map((day, i) => generateDataPoint(format(day, "EEE", { locale: it }), i, 0.3));
      }
      case "month": {
        const weeks = eachWeekOfInterval({ start: subWeeks(now, 3), end: now }, { weekStartsOn: 1 });
        return weeks.map((week, i) => generateDataPoint(`Sett ${i + 1}`, i, 1));
      }
      case "year": {
        const months = eachMonthOfInterval({ start: startOfYear(now), end: now });
        return months.map((month, i) => generateDataPoint(format(month, "MMM", { locale: it }), i, 4));
      }
      case "custom": {
        if (!dateRange) return [];
        const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) {
          const hours = eachHourOfInterval({ start: dateRange.from, end: dateRange.to });
          return hours.map((hour, i) => generateDataPoint(format(hour, "HH:mm"), i, 0.05));
        } else if (daysDiff <= 14) {
          const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
          return days.map((day, i) => generateDataPoint(format(day, "dd/MM"), i, 0.3));
        } else if (daysDiff <= 90) {
          const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to }, { weekStartsOn: 1 });
          return weeks.map((week, i) => generateDataPoint(format(week, "dd/MM"), i, 1));
        } else {
          const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
          return months.map((month, i) => generateDataPoint(format(month, "MMM yy", { locale: it }), i, 4));
        }
      }
      default:
        return [];
    }
  }, [timePeriod, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);
};

// Generate CO2 data based on time period
export const useCO2Data = (timePeriod: TimePeriod, dateRange?: DateRange) => {
  return useMemo(() => {
    const now = new Date();
    
    const generateDataPoint = (label: string, i: number) => ({
      label,
      co2: Math.round(350 + seededRandom(i * 83) * 400),
      limit: 1000,
    });

    switch (timePeriod) {
      case "today": {
        const hours = eachHourOfInterval({ start: startOfDay(now), end: endOfDay(now) });
        return hours.map((hour, i) => generateDataPoint(format(hour, "HH:mm"), i));
      }
      case "week": {
        const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
        return days.map((day, i) => generateDataPoint(format(day, "EEE", { locale: it }), i));
      }
      case "month": {
        const weeks = eachWeekOfInterval({ start: subWeeks(now, 3), end: now }, { weekStartsOn: 1 });
        return weeks.map((week, i) => generateDataPoint(`Sett ${i + 1}`, i));
      }
      case "year": {
        const months = eachMonthOfInterval({ start: startOfYear(now), end: now });
        return months.map((month, i) => generateDataPoint(format(month, "MMM", { locale: it }), i));
      }
      case "custom": {
        if (!dateRange) return [];
        const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) {
          const hours = eachHourOfInterval({ start: dateRange.from, end: dateRange.to });
          return hours.map((hour, i) => generateDataPoint(format(hour, "HH:mm"), i));
        } else if (daysDiff <= 14) {
          const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
          return days.map((day, i) => generateDataPoint(format(day, "dd/MM"), i));
        } else {
          const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
          return months.map((month, i) => generateDataPoint(format(month, "MMM yy", { locale: it }), i));
        }
      }
      default:
        return [];
    }
  }, [timePeriod, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);
};

// Generate water consumption data based on time period
export const useWaterData = (timePeriod: TimePeriod, dateRange?: DateRange) => {
  return useMemo(() => {
    const now = new Date();
    
    const generateDataPoint = (label: string, i: number, scale: number) => ({
      label,
      consumption: Math.round((800 + seededRandom(i * 89) * 600) * scale),
      target: Math.round((700 + seededRandom(i * 97) * 400) * scale),
      lastYear: Math.round((850 + seededRandom(i * 101) * 550) * scale),
    });

    switch (timePeriod) {
      case "today": {
        const hours = eachHourOfInterval({ start: startOfDay(now), end: endOfDay(now) });
        return hours.map((hour, i) => generateDataPoint(format(hour, "HH:mm"), i, 0.02));
      }
      case "week": {
        const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
        return days.map((day, i) => generateDataPoint(format(day, "EEE", { locale: it }), i, 0.15));
      }
      case "month": {
        const weeks = eachWeekOfInterval({ start: subWeeks(now, 3), end: now }, { weekStartsOn: 1 });
        return weeks.map((week, i) => generateDataPoint(`Sett ${i + 1}`, i, 0.5));
      }
      case "year": {
        const months = eachMonthOfInterval({ start: startOfYear(now), end: now });
        return months.map((month, i) => generateDataPoint(format(month, "MMM", { locale: it }), i, 1.5));
      }
      case "custom": {
        if (!dateRange) return [];
        const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) {
          const hours = eachHourOfInterval({ start: dateRange.from, end: dateRange.to });
          return hours.map((hour, i) => generateDataPoint(format(hour, "HH:mm"), i, 0.02));
        } else if (daysDiff <= 14) {
          const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
          return days.map((day, i) => generateDataPoint(format(day, "dd/MM"), i, 0.15));
        } else if (daysDiff <= 90) {
          const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to }, { weekStartsOn: 1 });
          return weeks.map((week, i) => generateDataPoint(format(week, "dd/MM"), i, 0.5));
        } else {
          const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
          return months.map((month, i) => generateDataPoint(format(month, "MMM yy", { locale: it }), i, 1.5));
        }
      }
      default:
        return [];
    }
  }, [timePeriod, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);
};

// Get period label for display
export const getPeriodLabel = (timePeriod: TimePeriod, dateRange?: DateRange): string => {
  const now = new Date();
  
  switch (timePeriod) {
    case "today":
      return format(now, "dd MMMM yyyy", { locale: it });
    case "week":
      return `${format(subDays(now, 6), "dd MMM", { locale: it })} - ${format(now, "dd MMM yyyy", { locale: it })}`;
    case "month":
      return format(now, "MMMM yyyy", { locale: it });
    case "year":
      return format(now, "yyyy");
    case "custom":
      if (dateRange) {
        return `${format(dateRange.from, "dd MMM", { locale: it })} - ${format(dateRange.to, "dd MMM yyyy", { locale: it })}`;
      }
      return "Personalizzato";
    default:
      return "";
  }
};
