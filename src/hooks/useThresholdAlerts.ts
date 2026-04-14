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
  unit?: string;
  deviceName?: string;
  deviceId?: string;
  timestamp?: string;
  description?: string;
  recommendation?: string;
  status: 'active' | 'resolved';
  deviceType?: string;
}

export interface ThresholdAlertStatus {
  alerts: ThresholdAlert[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  totalCount: number;
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
        .select('*')
        .eq('site_id', siteId)
        .eq('status', 'active');

      if (error) {
        console.error('[useThresholdAlerts] Fetch error:', error);
      } else if (data) {
        const mapped: ThresholdAlert[] = data.map(d => ({
          id: d.id,
          severity: d.severity,
          metric: d.metric,
          message: d.message,
          currentValue: d.current_value,
          threshold: d.threshold_value,
          recommendation: d.recommendation,
          timestamp: d.triggered_at,
          status: d.status,
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

            if (payload.eventType === 'INSERT' && newItem.status === 'active') {
              // Add new active alert
              return [...current, {
                id: newItem.id,
                severity: newItem.severity,
                metric: newItem.metric,
                message: newItem.message,
                currentValue: newItem.current_value,
                threshold: newItem.threshold_value,
                recommendation: newItem.recommendation,
                timestamp: newItem.triggered_at,
                status: newItem.status,
                deviceId: newItem.device_id
              }];
            } else if (payload.eventType === 'UPDATE') {
              if (newItem.status === 'resolved') {
                // Remove resolved alert
                return current.filter(a => a.id !== newItem.id);
              } else {
                // Update existing alert value
                return current.map(a => a.id === newItem.id ? {
                  ...a,
                  currentValue: newItem.current_value,
                  timestamp: newItem.triggered_at
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
    const mappedDbAlerts = dbAlerts.map(a => {
      const dev = options?.devices?.find(d => d.device_id === a.deviceId || d.id === a.deviceId);
      return {
        ...a,
        deviceName: dev?.name || dev?.circuit_name || a.deviceName || undefined,
        deviceType: dev?.device_type || a.deviceType || undefined
      };
    });

    const criticalCount = mappedDbAlerts.filter(a => a.severity === 'critical').length;
    const warningCount = mappedDbAlerts.filter(a => a.severity === 'warning').length;
    const infoCount = mappedDbAlerts.filter(a => a.severity === 'info').length;

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
      hasAlerts: mappedDbAlerts.length > 0,
      worstSeverity,
      isLoading,
    };
  }, [dbAlerts, options?.devices, language, isLoading]);
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
