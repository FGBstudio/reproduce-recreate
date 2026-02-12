/**
 * Hook: useEnergyPowerByCategory
 * 
 * Fetches real-time power data from energy_latest table,
 * joins with devices table for category mapping, and returns
 * power breakdown by category (general, hvac, lighting, plugs, other).
 * 
 * Used by both Overview EnergyCard and Energy module Power Consumption widget.
 * 
 * Freshness rule: data older than 2 days = offline/alarm.
 */

import { useMemo } from 'react';
import { useEnergyLatest, useDevices } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';

export interface EnergyPowerBreakdown {
  /** Total power from 'general' category devices (main meter) */
  totalGeneral: number | undefined;
  /** HVAC power sum */
  hvac: number | undefined;
  /** Lighting power sum */
  lighting: number | undefined;
  /** Plugs power sum */
  plugs: number | undefined;
  /** Other = totalGeneral - (hvac + lighting + plugs), or undefined */
  other: number | undefined;
  /** Whether real data was found */
  isRealData: boolean;
  /** Whether data is stale (>2 days old) */
  isStale: boolean;
  /** Most recent timestamp across all readings */
  lastUpdate: string | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Per-device breakdown for donut chart */
  deviceBreakdown: Map<string, { label: string; category: string; value: number }>;
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function useEnergyPowerByCategory(siteId: string | undefined): EnergyPowerBreakdown {
  // Fetch devices for this site (to get category mapping)
  const { data: devicesResp } = useDevices(
    siteId ? { site_id: siteId } : undefined,
    { enabled: !!siteId && isSupabaseConfigured }
  );

  // Fetch energy_latest for this site with power metrics
  const { data: energyLatestResp, isLoading } = useEnergyLatest(
    siteId ? {
      site_id: siteId,
      metrics: ['energy.power_kw', 'energy.active_power', 'power'],
    } : undefined,
    {
      enabled: !!siteId && isSupabaseConfigured,
      refetchInterval: 30000,
    }
  );

  return useMemo(() => {
    const empty: EnergyPowerBreakdown = {
      totalGeneral: undefined,
      hvac: undefined,
      lighting: undefined,
      plugs: undefined,
      other: undefined,
      isRealData: false,
      isStale: false,
      lastUpdate: undefined,
      isLoading,
      deviceBreakdown: new Map(),
    };

    if (!energyLatestResp?.data || !devicesResp?.data) return { ...empty, isLoading };

    // Build device category map
    const deviceCategoryMap = new Map<string, { category: string; label: string }>();
    devicesResp.data.forEach((d) => {
      deviceCategoryMap.set(d.id, {
        category: d.category ? d.category.toLowerCase() : 'other',
        label: d.circuit_name || d.name || d.device_id,
      });
    });

    let totalGeneral = 0;
    let totalHVAC = 0;
    let totalLighting = 0;
    let totalPlugs = 0;
    let hasGeneral = false;
    let hasHVAC = false;
    let hasLighting = false;
    let hasPlugs = false;
    let latestTs: string | undefined;

    const deviceBreakdown = new Map<string, { label: string; category: string; value: number }>();

    Object.entries(energyLatestResp.data).forEach(([deviceId, metrics]) => {
      const info = deviceCategoryMap.get(deviceId);
      if (!info) return;

      // Find power metric
      const powerMetric = metrics.find(
        (m) =>
          m.metric === 'energy.power_kw' ||
          m.metric === 'energy.active_power' ||
          m.metric === 'power'
      );
      if (!powerMetric) return;

      const val = Number(powerMetric.value || 0);
      if (val <= 0) return;

      // Track latest timestamp
      if (powerMetric.ts && (!latestTs || powerMetric.ts > latestTs)) {
        latestTs = powerMetric.ts;
      }

      // Accumulate by category
      switch (info.category) {
        case 'general':
          totalGeneral += val;
          hasGeneral = true;
          break;
        case 'hvac':
          totalHVAC += val;
          hasHVAC = true;
          break;
        case 'lighting':
          totalLighting += val;
          hasLighting = true;
          break;
        case 'plugs':
          totalPlugs += val;
          hasPlugs = true;
          break;
        default:
          // Count towards "other defined"
          break;
      }

      deviceBreakdown.set(deviceId, { label: info.label, category: info.category, value: val });
    });

    // Check freshness
    const isStale = latestTs
      ? Date.now() - new Date(latestTs).getTime() > TWO_DAYS_MS
      : true;

    const hasAnyData = hasGeneral || hasHVAC || hasLighting || hasPlugs;

    // Calculate "other" = general - (hvac + lighting + plugs)
    const subTotal = totalHVAC + totalLighting + totalPlugs;
    const otherVal = hasGeneral && subTotal > 0 ? Math.max(0, totalGeneral - subTotal) : undefined;

    return {
      totalGeneral: hasGeneral ? totalGeneral : (hasAnyData ? subTotal : undefined),
      hvac: hasHVAC ? totalHVAC : undefined,
      lighting: hasLighting ? totalLighting : undefined,
      plugs: hasPlugs ? totalPlugs : undefined,
      other: otherVal,
      isRealData: hasAnyData && !isStale,
      isStale: hasAnyData && isStale,
      lastUpdate: latestTs,
      isLoading,
      deviceBreakdown,
    };
  }, [energyLatestResp, devicesResp, isLoading]);
}
