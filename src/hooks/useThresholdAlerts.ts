/**
 * Hook for evaluating live telemetry data against site thresholds
 * Returns computed alerts based on configured limits
 */

import { useMemo } from 'react';
import { useSiteThresholds, SiteThresholds } from './useSiteThresholds';

// =============================================================================
// Types
// =============================================================================

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface ThresholdAlert {
  id: string;
  severity: AlertSeverity;
  metric: string;
  message: string;
  currentValue: number;
  threshold: number;
  unit: string;
}

export interface ThresholdAlertStatus {
  alerts: ThresholdAlert[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  totalCount: number;
  hasAlerts: boolean;
  worstSeverity: AlertSeverity | null;
}

export interface LiveMetrics {
  // Energy
  'energy.power_kw'?: number;
  'energy.hvac_kw'?: number;
  'energy.lighting_kw'?: number;
  'energy.plugs_kw'?: number;
  // Air
  'iaq.co2'?: number;
  'env.temperature'?: number;
  'env.humidity'?: number;
  'iaq.voc'?: number;
  'iaq.pm25'?: number;
  'iaq.pm10'?: number;
  // Water
  'water.flow_lh'?: number;
  'water.daily_liters'?: number;
  [key: string]: number | undefined;
}

// =============================================================================
// Alert Evaluation Logic
// =============================================================================

function evaluateAlerts(
  metrics: LiveMetrics,
  thresholds: SiteThresholds | undefined
): ThresholdAlert[] {
  if (!thresholds) return [];
  
  const alerts: ThresholdAlert[] = [];

  // ---------------------------------------------------------------------------
  // ENERGY ALERTS
  // ---------------------------------------------------------------------------
  
  // Power limit exceeded
  if (thresholds.energy_power_limit_kw !== null && metrics['energy.power_kw'] !== undefined) {
    const currentPower = metrics['energy.power_kw'];
    const limit = thresholds.energy_power_limit_kw;
    
    if (currentPower > limit) {
      alerts.push({
        id: 'energy_power_exceeded',
        severity: 'critical',
        metric: 'energy.power_kw',
        message: `Potenza (${currentPower.toFixed(1)} kW) supera il limite contrattuale (${limit} kW)`,
        currentValue: currentPower,
        threshold: limit,
        unit: 'kW',
      });
    } else if (currentPower > limit * 0.9) {
      alerts.push({
        id: 'energy_power_warning',
        severity: 'warning',
        metric: 'energy.power_kw',
        message: `Potenza (${currentPower.toFixed(1)} kW) vicina al limite (${limit} kW)`,
        currentValue: currentPower,
        threshold: limit,
        unit: 'kW',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // AIR QUALITY ALERTS
  // ---------------------------------------------------------------------------

  // CO2 levels
  if (metrics['iaq.co2'] !== undefined) {
    const co2 = metrics['iaq.co2'];
    const criticalLimit = thresholds.air_co2_critical_ppm ?? 1500;
    const warningLimit = thresholds.air_co2_warning_ppm ?? 1000;
    
    if (co2 > criticalLimit) {
      alerts.push({
        id: 'air_co2_critical',
        severity: 'critical',
        metric: 'iaq.co2',
        message: `CO₂ (${Math.round(co2)} ppm) supera la soglia critica (${criticalLimit} ppm)`,
        currentValue: co2,
        threshold: criticalLimit,
        unit: 'ppm',
      });
    } else if (co2 > warningLimit) {
      alerts.push({
        id: 'air_co2_warning',
        severity: 'warning',
        metric: 'iaq.co2',
        message: `CO₂ (${Math.round(co2)} ppm) sopra la soglia warning (${warningLimit} ppm)`,
        currentValue: co2,
        threshold: warningLimit,
        unit: 'ppm',
      });
    }
  }

  // Temperature out of range
  if (metrics['env.temperature'] !== undefined) {
    const temp = metrics['env.temperature'];
    const minTemp = thresholds.air_temp_min_c ?? 18;
    const maxTemp = thresholds.air_temp_max_c ?? 26;
    
    if (temp < minTemp) {
      alerts.push({
        id: 'air_temp_low',
        severity: 'warning',
        metric: 'env.temperature',
        message: `Temperatura (${temp.toFixed(1)}°C) sotto il minimo (${minTemp}°C)`,
        currentValue: temp,
        threshold: minTemp,
        unit: '°C',
      });
    } else if (temp > maxTemp) {
      alerts.push({
        id: 'air_temp_high',
        severity: 'warning',
        metric: 'env.temperature',
        message: `Temperatura (${temp.toFixed(1)}°C) sopra il massimo (${maxTemp}°C)`,
        currentValue: temp,
        threshold: maxTemp,
        unit: '°C',
      });
    }
  }

  // Humidity out of range
  if (metrics['env.humidity'] !== undefined) {
    const humidity = metrics['env.humidity'];
    const minHum = thresholds.air_humidity_min_pct ?? 30;
    const maxHum = thresholds.air_humidity_max_pct ?? 60;
    
    if (humidity < minHum) {
      alerts.push({
        id: 'air_humidity_low',
        severity: 'info',
        metric: 'env.humidity',
        message: `Umidità (${humidity.toFixed(0)}%) sotto il minimo (${minHum}%)`,
        currentValue: humidity,
        threshold: minHum,
        unit: '%',
      });
    } else if (humidity > maxHum) {
      alerts.push({
        id: 'air_humidity_high',
        severity: 'info',
        metric: 'env.humidity',
        message: `Umidità (${humidity.toFixed(0)}%) sopra il massimo (${maxHum}%)`,
        currentValue: humidity,
        threshold: maxHum,
        unit: '%',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // WATER ALERTS
  // ---------------------------------------------------------------------------

  // Water leak detection
  if (thresholds.water_leak_threshold_lh !== null && metrics['water.flow_lh'] !== undefined) {
    const flow = metrics['water.flow_lh'];
    const leakThreshold = thresholds.water_leak_threshold_lh;
    
    if (flow > leakThreshold) {
      alerts.push({
        id: 'water_leak_detected',
        severity: 'critical',
        metric: 'water.flow_lh',
        message: `Possibile perdita: flusso (${flow.toFixed(1)} L/h) supera soglia (${leakThreshold} L/h)`,
        currentValue: flow,
        threshold: leakThreshold,
        unit: 'L/h',
      });
    }
  }

  return alerts;
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Hook to evaluate live metrics against site thresholds and return computed alerts
 * 
 * @param siteId - The site ID to fetch thresholds for
 * @param liveMetrics - Current live telemetry values
 */
export function useThresholdAlerts(
  siteId: string | undefined,
  liveMetrics: LiveMetrics
): ThresholdAlertStatus {
  const { thresholds, isLoading } = useSiteThresholds(siteId);

  return useMemo(() => {
    if (isLoading || !thresholds) {
      return {
        alerts: [],
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        totalCount: 0,
        hasAlerts: false,
        worstSeverity: null,
      };
    }

    const alerts = evaluateAlerts(liveMetrics, thresholds);
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;
    const infoCount = alerts.filter(a => a.severity === 'info').length;

    let worstSeverity: AlertSeverity | null = null;
    if (criticalCount > 0) worstSeverity = 'critical';
    else if (warningCount > 0) worstSeverity = 'warning';
    else if (infoCount > 0) worstSeverity = 'info';

    return {
      alerts,
      criticalCount,
      warningCount,
      infoCount,
      totalCount: alerts.length,
      hasAlerts: alerts.length > 0,
      worstSeverity,
    };
  }, [liveMetrics, thresholds, isLoading]);
}

/**
 * Get status color for ReadingItem based on thresholds
 */
export function getMetricStatus(
  metric: string,
  value: number | undefined,
  thresholds: SiteThresholds | undefined
): 'good' | 'warning' | 'critical' {
  if (value === undefined || !thresholds) return 'good';

  switch (metric) {
    case 'iaq.co2': {
      const critical = thresholds.air_co2_critical_ppm ?? 1500;
      const warning = thresholds.air_co2_warning_ppm ?? 1000;
      if (value > critical) return 'critical';
      if (value > warning) return 'warning';
      return 'good';
    }
    case 'env.temperature': {
      const min = thresholds.air_temp_min_c ?? 18;
      const max = thresholds.air_temp_max_c ?? 26;
      if (value < min || value > max) return 'warning';
      return 'good';
    }
    case 'env.humidity': {
      const min = thresholds.air_humidity_min_pct ?? 30;
      const max = thresholds.air_humidity_max_pct ?? 60;
      if (value < min || value > max) return 'warning';
      return 'good';
    }
    case 'energy.power_kw': {
      if (thresholds.energy_power_limit_kw !== null) {
        const limit = thresholds.energy_power_limit_kw;
        if (value > limit) return 'critical';
        if (value > limit * 0.9) return 'warning';
      }
      return 'good';
    }
    default:
      return 'good';
  }
}

/**
 * Evaluate alerts for multiple sites and aggregate counts
 * Used by BrandOverlay and HoldingOverlay
 */
export function evaluateAlertsForSites(
  sitesData: Array<{
    siteId: string;
    metrics: LiveMetrics;
    thresholds: SiteThresholds | undefined;
  }>
): { criticalCount: number; warningCount: number; infoCount: number } {
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  sitesData.forEach(({ metrics, thresholds }) => {
    const alerts = evaluateAlerts(metrics, thresholds);
    criticalCount += alerts.filter(a => a.severity === 'critical').length;
    warningCount += alerts.filter(a => a.severity === 'warning').length;
    infoCount += alerts.filter(a => a.severity === 'info').length;
  });

  return { criticalCount, warningCount, infoCount };
}
