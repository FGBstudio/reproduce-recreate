/**
 * Hook for fetching persistent alerts from Supabase site_alerts table.
 * Integrates with the backend-first rules engine and provides realtime updates.
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';

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
  condition?: string;
  unit?: string;
  deviceName?: string;
  deviceId?: string;
  timestamp?: string;
  description?: string;
  recommendation?: string;
  duration_minutes?: number;
  hysteresis_pct?: number;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  acknowledgedByName?: string | null;
  incidentGroupKey?: string | null;
  deviceType?: string;
}

export interface ThresholdAlertStatus {
  alerts: ThresholdAlert[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  totalCount: number;
  unacknowledgedCount: number;
  hasAlerts: boolean;
  worstSeverity: AlertSeverity | null;
  isLoading: boolean;
}

/** Minimal device info used for offline detection */
export interface DeviceInfo {
  id: string;
  name?: string | null;
  device_id: string;
  device_type: string;
  last_seen?: string | null;
  circuit_name?: string | null;
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Hook to retrieve active alerts from the database.
 * 
 * @param siteId - The site ID to fetch alerts for
 */
export function useThresholdAlerts(
  siteId: string | undefined,
  _liveMetrics?: any, // No longer strictly needed for thresholds, but kept for signature compatibility
  options?: {
    isStale?: boolean;
    lastUpdate?: string;
    staleMessage?: string;
    devices?: DeviceInfo[];
  }
): ThresholdAlertStatus {
  const [dbAlerts, setDbAlerts] = useState<ThresholdAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { language } = useLanguage();

  // 1. Initial Fetch of Active Alerts
  useEffect(() => {
    if (!siteId || !isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    async function fetchAlerts() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('site_alerts')
        .select(`
          *,
          alert_rules (
            threshold,
            condition,
            duration_minutes,
            hysteresis_pct
          )
        `)
        .eq('site_id', siteId)
        .in('status', ['active', 'acknowledged']);

      if (error) {
        console.error('[useThresholdAlerts] Fetch error:', error);
      } else if (data) {
        const mapped: ThresholdAlert[] = data.map(d => ({
          id: d.id,
          severity: d.severity as AlertSeverity,
          metric: d.metric,
          message: d.message,
          currentValue: d.current_value ?? d.value_at_trigger ?? 0,
          threshold: d.alert_rules?.threshold ?? d.threshold_value ?? 0,
          condition: d.alert_rules?.condition,
          duration_minutes: d.alert_rules?.duration_minutes ?? 0,
          hysteresis_pct: d.alert_rules?.hysteresis_pct ?? 5,
          recommendation: d.recommendation,
          timestamp: d.triggered_at,
          status: d.status as ThresholdAlert['status'],
          acknowledgedAt: d.acknowledged_at ?? null,
          acknowledgedBy: d.acknowledged_by ?? null,
          acknowledgedByName: d.acknowledged_by_name ?? null,
          incidentGroupKey: d.incident_group_key ?? null,
          deviceId: d.device_id,
        }));
        setDbAlerts(mapped);
      }
      setIsLoading(false);
    }

    fetchAlerts();

    // 2. Realtime Subscription
    const channel = supabase
      .channel(`site_alerts_${siteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_alerts',
          filter: `site_id=eq.${siteId}`,
        },
        (payload) => {
          // Optimization: Single logic to handle inserts, updates, and deletes
          setDbAlerts(current => {
            const newItem = payload.new as any;
            const oldItem = payload.old as any;

            if (payload.eventType === 'INSERT' && (newItem.status === 'active' || newItem.status === 'acknowledged')) {
              if (current.some(a => a.id === newItem.id)) return current;
              // Add new active/acknowledged alert
              return [...current, {
                id: newItem.id,
                severity: newItem.severity,
                metric: newItem.metric,
                message: newItem.message,
                currentValue: newItem.current_value ?? newItem.value_at_trigger ?? 0,
                threshold: newItem.threshold_value ?? 0,
                duration_minutes: 0,
                hysteresis_pct: 5,
                recommendation: newItem.recommendation,
                timestamp: newItem.triggered_at,
                status: newItem.status,
                acknowledgedAt: newItem.acknowledged_at ?? null,
                acknowledgedBy: newItem.acknowledged_by ?? null,
                acknowledgedByName: newItem.acknowledged_by_name ?? null,
                incidentGroupKey: newItem.incident_group_key ?? null,
                deviceId: newItem.device_id
              }];
            } else if (payload.eventType === 'UPDATE') {
              if (newItem.status === 'resolved') {
                // Remove resolved alert
                return current.filter(a => a.id !== newItem.id);
              } else {
                // Update existing alert value & acknowledgment state
                return current.map(a => a.id === newItem.id ? {
                  ...a,
                  status: newItem.status ?? a.status,
                  severity: newItem.severity ?? a.severity,
                  message: newItem.message ?? a.message,
                  currentValue: newItem.current_value ?? newItem.value_at_trigger ?? a.currentValue,
                  threshold: newItem.threshold_value ?? a.threshold,
                  timestamp: newItem.triggered_at ?? a.timestamp,
                  acknowledgedAt: newItem.acknowledged_at ?? a.acknowledgedAt,
                  acknowledgedBy: newItem.acknowledged_by ?? a.acknowledgedBy,
                  acknowledgedByName: newItem.acknowledged_by_name ?? a.acknowledgedByName,
                  incidentGroupKey: newItem.incident_group_key ?? a.incidentGroupKey,
                } : a);
              }
            } else if (payload.eventType === 'DELETE') {
              return current.filter(a => a.id !== oldItem.id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId]);

  // 3. Compute Final Status (Backend-Only)
  return useMemo(() => {
    // 1. Map Device Names to DB alerts
    let mappedDbAlerts: ThresholdAlert[] = dbAlerts.map(a => {
      const dev = options?.devices?.find(d => d.device_id === a.deviceId || d.id === a.deviceId);
      return {
        ...a,
        deviceName: dev?.name || dev?.circuit_name || a.deviceName || undefined,
        deviceType: dev?.device_type || a.deviceType || undefined
      };
    });

    // 2. Inject synthetic "Offline" alert if site is stale
    if (options?.isStale) {
      const staleAlert: ThresholdAlert = {
        id: 'system-stale-offline',
        severity: 'critical',
        metric: 'system.device_offline',
        message: options.staleMessage || (language === 'it' ? 'Sito offline' : 'Site offline'),
        currentValue: 0,
        threshold: 0,
        status: 'active',
        timestamp: options.lastUpdate || new Date().toISOString(),
        deviceName: undefined,
        deviceType: undefined
      };
      // Put it at the top
      mappedDbAlerts = [staleAlert, ...mappedDbAlerts];
    }

    // 3. Sort unacknowledged alerts above acknowledged ones
    mappedDbAlerts.sort((a, b) => {
      const ackDiff = (a.status === 'acknowledged' ? 1 : 0) - (b.status === 'acknowledged' ? 1 : 0);
      if (ackDiff !== 0) return ackDiff;
      const sevOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    });

    const criticalCount = mappedDbAlerts.filter(a => a.severity === 'critical').length;
    const warningCount = mappedDbAlerts.filter(a => a.severity === 'warning').length;
    const infoCount = mappedDbAlerts.filter(a => a.severity === 'info').length;
    const unacknowledgedCount = mappedDbAlerts.filter(a => a.status !== 'acknowledged').length;

    let worstSeverity: AlertSeverity | null = null;
    if (criticalCount > 0) worstSeverity = 'critical';
    else if (warningCount > 0) worstSeverity = 'warning';
    else if (infoCount > 0) worstSeverity = 'info';

    return {
      alerts: mappedDbAlerts,
      criticalCount,
      warningCount,
      infoCount,
      totalCount: mappedDbAlerts.length,
      unacknowledgedCount,
      hasAlerts: mappedDbAlerts.length > 0,
      worstSeverity,
      isLoading,
    };
  }, [dbAlerts, options?.devices, options?.isStale, options?.lastUpdate, options?.staleMessage, language, isLoading]);
}

export function getMetricStatus(
  metric: string,
  alerts: ThresholdAlert[]
): 'good' | 'warning' | 'critical' {
  if (!Array.isArray(alerts)) return 'good';
  const relevant = alerts.find(a => a.metric === metric);
  if (!relevant) return 'good';
  
  // Safe cast: 'info' severity maps to 'good' in this UI status context
  const sev = relevant.severity;
  if (sev === 'info') return 'good';
  return sev as 'warning' | 'critical';
}
