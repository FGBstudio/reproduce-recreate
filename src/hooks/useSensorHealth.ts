import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// =============================================================================
// Types
// =============================================================================

export interface SensorHealthRecord {
  sensor_id: string;
  site_id: string;
  last_seen: string | null;
  is_offline: boolean;
  is_flatlining: boolean;
  flapping_count_24h: number;
  trust_score: number;
  last_evaluated_at: string;
  // Augmented from devices table join
  device_name?: string;
  device_type?: string;
  metadata?: any;
}

export interface SiteSensorHealthStatus {
  sensors: SensorHealthRecord[];
  averageTrustScore: number;
  worstSensor: SensorHealthRecord | null;
  offlineCount: number;
  flatliningCount: number;
  flappingCount: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useSensorHealth(
  siteId: string | undefined,
  moduleFilter?: 'air' | 'energy' | 'water',
  pollingIntervalMs = 60000 // 60 seconds default to match pg_cron
): SiteSensorHealthStatus {
  const [sensors, setSensors] = useState<SensorHealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    if (!siteId || !isSupabaseConfigured) {
      if (isLoading) setIsLoading(false);
      return;
    }

    try {
      // Fetch sensor_health with a join to devices for the human-readable name
      const { data, error } = await supabase
        .from('sensor_health')
        .select(`
          *,
          devices (
            name,
            circuit_name,
            device_id,
            device_type
          )
        `)
        .eq('site_id', siteId);

      if (error) {
        console.error('[useSensorHealth] Fetch error:', error);
      } else if (data) {
        let mapped = data.map((d: any) => {
          const dev = Array.isArray(d.devices) ? d.devices[0] : d.devices;
          return {
            ...d,
            device_name: dev?.name || dev?.circuit_name || dev?.device_id || 'Unknown Sensor',
            device_type: dev?.device_type || 'unknown'
          };
        });

        // Apply module filter (air_quality vs energy_monitor vs water_meter)
        if (moduleFilter) {
          const typeToModule: Record<string, string> = {
            'air_quality': 'air',
            'energy_monitor': 'energy',
            'water_meter': 'water',
            'air': 'air',
            'energy': 'energy',
            'water': 'water'
          };
          mapped = mapped.filter((m: any) => typeToModule[m.device_type] === moduleFilter);
        }

        setSensors(mapped);
      }
    } catch (err) {
      console.error('[useSensorHealth] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  // Initial fetch and polling setup
  useEffect(() => {
    setIsLoading(true);
    fetchHealth();

    if (pollingIntervalMs > 0) {
      const intervalId = setInterval(fetchHealth, pollingIntervalMs);
      return () => clearInterval(intervalId);
    }
  }, [fetchHealth, pollingIntervalMs]);

  // Compute derived mathematical metrics
  return useMemo(() => {
    if (sensors.length === 0) {
      return {
        sensors: [],
        averageTrustScore: 100, // Default to perfect if no sensors tracked
        worstSensor: null,
        offlineCount: 0,
        flatliningCount: 0,
        flappingCount: 0,
        isLoading,
        refetch: fetchHealth
      };
    }

    const scores = sensors.map(s => s.trust_score);
    const sum = scores.reduce((acc, val) => acc + val, 0);
    const averageTrustScore = Math.round(sum / scores.length);

    // Find worst sensor
    const minScore = Math.min(...scores);
    const worstSensor = sensors.find(s => s.trust_score === minScore) || null;

    const offlineCount = sensors.filter(s => s.is_offline).length;
    const flatliningCount = sensors.filter(s => s.is_flatlining).length;
    const flappingCount = sensors.filter(s => s.flapping_count_24h > 0).length;

    return {
      sensors,
      averageTrustScore,
      worstSensor,
      offlineCount,
      flatliningCount,
      flappingCount,
      isLoading,
      refetch: fetchHealth
    };
  }, [sensors, isLoading, fetchHealth]);
}
