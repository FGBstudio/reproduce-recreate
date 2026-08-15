/**
 * Hook for fetching aggregated real telemetry data across multiple sites
 * Used by BrandOverlay and HoldingOverlay to display only real data
 * 
 * Uses the same proven logic as useRegionEnergyIntensity:
 * - Energy: query devices by category='general', sum energy.active_energy from energy_daily (30 days)
 * - HVAC/Lighting: query devices by category, sum energy.active_energy
 * - Air: avg CO2 from telemetry_daily for air_quality devices (30 days)
 * - Alerts: count from events table (status='active')
 * - Online: any telemetry in last 60 minutes
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAdminData } from '@/contexts/AdminDataContext';
import { Project } from '@/lib/data';
import { getDemoProfile } from '@/lib/data/demoSiteMocks';
import { isValidUUID } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

/** Stato canonico di un sito (spec §0): giudicato sui soli domini installati. */
export type SiteState = 'online' | 'offline' | 'stale' | 'not_installed';

export interface SiteRealData {
  siteId: string;
  siteName: string;
  isOnline: boolean;
  hasEnergyData: boolean;
  hasAirData: boolean;
  hasWaterData: boolean;
  /** Domini con dispositivi installati: definisce cosa ASPETTARSI dal sito */
  capabilities: { energy: boolean; air: boolean; water: boolean };
  state: SiteState;
  /** true se l'ultima lettura e' piu' vecchia di 2 giorni */
  isNoData: boolean;
  /** Variazione % della media giornaliera 30gg vs 90gg (baseline propria); null se incalcolabile */
  baselineDeltaPct: number | null;
  energy: {
    monthlyKwh: number | null;
    hvacKwh: number | null;
    lightingKwh: number | null;
    plugsKwh: number | null;
  };
  air: {
    co2: number | null;
    temperature: number | null;
    humidity: number | null;
    voc: number | null;
  };
  water: {
    consumption: number | null;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface AggregatedOverlayData {
  sites: SiteRealData[];
  sitesWithEnergy: SiteRealData[];
  sitesWithAir: SiteRealData[];
  sitesWithWater: SiteRealData[];
  totals: {
    monthlyEnergyKwh: number;
    avgCo2: number;
    sitesCount: number;
    sitesOnline: number;
    /** Siti con almeno un dispositivo installato (spec §0: "monitorati") */
    sitesMonitored: number;
    /** Sites with any data received (ever), regardless of how recent */
    sitesWithData: number;
    alertsCritical: number;
    alertsWarning: number;
    /** Siti stale (>2 giorni): segnalati come no-data, MAI sommati ai critical */
    alertsNoData: number;
  };
  isLoading: boolean;
  isError: boolean;
  hasRealData: boolean;
}

// =============================================================================
// Core data fetching — mirrors useRegionEnergyIntensity logic
// =============================================================================

interface FetchResult {
  /** site_id → total kWh (general category, 30 days) */
  monthlyEnergy: Record<string, number>;
  /** site_id → hvac kWh */
  hvacEnergy: Record<string, number>;
  /** site_id → lighting kWh */
  lightingEnergy: Record<string, number>;
  /** site_id → plugs kWh */
  plugsEnergy: Record<string, number>;
  /** site_id → { co2, temperature, humidity, voc } avg over 30 days */
  airAvg: Record<string, { co2: number | null; temperature: number | null; humidity: number | null; voc: number | null }>;
  /** site_id → true if any telemetry < 60 min */
  onlineStatus: Record<string, boolean>;
  /** site_id → alert counts */
  alerts: Record<string, { critical: number; warning: number; info: number }>;
  /** site_id → latest timestamp across all telemetry */
  latestTs: Record<string, string>;
  /** site_id → kWh 90 giorni (stessa selezione device dei 30gg), per baseline */
  energy90: Record<string, number>;
  /** site_id → domini con dispositivi installati (le "aspettative") */
  capabilities: Record<string, { energy: boolean; air: boolean; water: boolean }>;
  /** site_id → true se ultima lettura piu' vecchia di 2 giorni */
  noData: Record<string, boolean>;
}

async function fetchAggregatedDataForSites(siteIds: string[]): Promise<FetchResult> {
  if (!supabase || siteIds.length === 0) {
    return { monthlyEnergy: {}, hvacEnergy: {}, lightingEnergy: {}, plugsEnergy: {}, airAvg: {}, onlineStatus: {}, alerts: {}, latestTs: {}, energy90: {}, capabilities: {}, noData: {} };
  }

  const result: FetchResult = {
    monthlyEnergy: {}, hvacEnergy: {}, lightingEnergy: {}, plugsEnergy: {},
    airAvg: {}, onlineStatus: {}, alerts: {}, latestTs: {}, energy90: {}, capabilities: {}, noData: {},
  };

  const now = new Date();
  const thirtyDaysAgoStr = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  // Finestre di freschezza PER DOMINIO (regola approvata il 15/08/2026):
  // aria trasmette in continuo -> 60 minuti; i contatori energia caricano a
  // lotti ogni 3 ore -> 3h30, col margine che assorbe il jitter del gateway
  // (a 3h esatte un sito sano lampeggerebbe offline a ogni ciclo).
  const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const threeHalfHoursAgo = new Date(now.getTime() - 3.5 * 60 * 60 * 1000);

  // ---------------------------------------------------------------------------
  // 1) Fetch devices for these sites (all categories)
  // ---------------------------------------------------------------------------
  let allDevices: { id: string; site_id: string; category: string | null; device_type: string }[] = [];
  const batchSize = 50;
  for (let i = 0; i < siteIds.length; i += batchSize) {
    const batch = siteIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('devices')
      .select('id, site_id, category, device_type')
      .in('site_id', batch);
    if (!error && data) allDevices = allDevices.concat(data as any[]);
  }

  // Group devices by category
  const generalDevices = allDevices.filter(d => d.category === 'general');
  const hvacDevices = allDevices.filter(d => d.category === 'hvac');
  const lightingDevices = allDevices.filter(d => d.category === 'lighting');
  const plugsDevices = allDevices.filter(d => d.category === 'plugs');
  const aqDevices = allDevices.filter(d => d.device_type === 'air_quality');

  // Capability per sito e per dominio: da cosa e' INSTALLATO derivano le
  // aspettative (spec Q1a/Q5). Un sito con solo monitor aria non e' "offline
  // energia": l'energia semplicemente non e' attesa, e il KPI mostra "—".
  const ENERGY_CATEGORIES = new Set(['general', 'hvac', 'lighting', 'plugs']);
  const isEnergyDevice = (d: { category: string | null; device_type: string }) =>
    (d.category != null && ENERGY_CATEGORIES.has(d.category)) || d.device_type === 'energy_monitor';
  const energyDevices = allDevices.filter(isEnergyDevice);
  allDevices.forEach(d => {
    if (!result.capabilities[d.site_id]) {
      result.capabilities[d.site_id] = { energy: false, air: false, water: false };
    }
    const cap = result.capabilities[d.site_id];
    if (isEnergyDevice(d)) cap.energy = true;
    if (d.device_type === 'air_quality') cap.air = true;
    if (d.device_type === 'water_meter') cap.water = true;
  });

  // Siti che possiedono almeno un contatore 'general': per loro vale SOLO il
  // general (evita il doppio conteggio general + sottocarichi). Per gli altri
  // si sommano i sottocarichi / device energia non categorizzati (spec Q1a:
  // il general, quando c'e', ha sempre la precedenza).
  const sitesWithGeneral = new Set(generalDevices.map(d => d.site_id));
  const fallbackEnergyDevices = energyDevices.filter(d => !sitesWithGeneral.has(d.site_id));

  // Helper: sum energy.active_energy from energy_daily for a set of devices
  async function sumEnergyForDevices(devices: typeof allDevices, days: string): Promise<Record<string, number>> {
    if (devices.length === 0) return {};
    const deviceIds = devices.map(d => d.id);
    const deviceToSite: Record<string, string> = {};
    devices.forEach(d => { deviceToSite[d.id] = d.site_id; });

    let rows: any[] = [];
    for (let i = 0; i < deviceIds.length; i += batchSize) {
      const batch = deviceIds.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('energy_daily')
        .select('device_id, value_sum')
        .in('device_id', batch)
        .gte('ts_day', days)
        .in('metric', ['energy.active_import_kwh', 'energy.active_energy']);
      if (!error && data) rows = rows.concat(data);
    }

    const siteKwh: Record<string, number> = {};
    rows.forEach((row: any) => {
      if (row.value_sum === null) return;
      const siteId = deviceToSite[row.device_id];
      if (!siteId) return;
      siteKwh[siteId] = (siteKwh[siteId] || 0) + Number(row.value_sum);
    });
    return siteKwh;
  }

  // ---------------------------------------------------------------------------
  // 2) ENERGY: kWh 30gg (general con precedenza, fallback sottocarichi) e
  //    90gg per la baseline della Health Matrix (spec Q4: 30gg vs 90gg).
  // ---------------------------------------------------------------------------
  const ninetyDaysAgoStr = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  try {
    const [general, fallback, general90, fallback90, hvac, lighting, plugs] = await Promise.all([
      sumEnergyForDevices(generalDevices, thirtyDaysAgoStr),
      sumEnergyForDevices(fallbackEnergyDevices, thirtyDaysAgoStr),
      sumEnergyForDevices(generalDevices, ninetyDaysAgoStr),
      sumEnergyForDevices(fallbackEnergyDevices, ninetyDaysAgoStr),
      sumEnergyForDevices(hvacDevices, thirtyDaysAgoStr),
      sumEnergyForDevices(lightingDevices, thirtyDaysAgoStr),
      sumEnergyForDevices(plugsDevices, thirtyDaysAgoStr),
    ]);
    Object.assign(result.monthlyEnergy, fallback, general); // general sovrascrive
    Object.assign(result.energy90, fallback90, general90);
    Object.assign(result.hvacEnergy, hvac);
    Object.assign(result.lightingEnergy, lighting);
    Object.assign(result.plugsEnergy, plugs);
  } catch (e) {
    console.warn('[useAggregatedSiteData] energy query failed:', e);
  }

  // ---------------------------------------------------------------------------
  // 3) AIR QUALITY: avg CO2 from telemetry_daily (30 days)
  // ---------------------------------------------------------------------------
  if (aqDevices.length > 0) {
    try {
      const aqDeviceIds = aqDevices.map(d => d.id);
      const aqDeviceToSite: Record<string, string> = {};
      aqDevices.forEach(d => { aqDeviceToSite[d.id] = d.site_id; });

      let co2Rows: any[] = [];
      for (let i = 0; i < aqDeviceIds.length; i += batchSize) {
        const batch = aqDeviceIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('telemetry_daily')
          .select('device_id, metric, value_avg')
          .in('device_id', batch)
          .gte('ts_day', thirtyDaysAgoStr)
          .in('metric', ['iaq.co2', 'CO2', 'co2']);
        if (!error && data) co2Rows = co2Rows.concat(data);
      }

      // Average per site
      const siteCo2: Record<string, number[]> = {};
      co2Rows.forEach((row: any) => {
        if (row.value_avg === null) return;
        const siteId = aqDeviceToSite[row.device_id];
        if (!siteId) return;
        if (!siteCo2[siteId]) siteCo2[siteId] = [];
        siteCo2[siteId].push(Number(row.value_avg));
      });

      Object.entries(siteCo2).forEach(([siteId, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        result.airAvg[siteId] = { co2: Math.round(avg), temperature: null, humidity: null, voc: null };
      });

      // Also get latest temperature/humidity from telemetry_latest
      const { data: latestAir } = await supabase
        .from('telemetry_latest')
        .select('site_id, metric, value')
        .in('site_id', siteIds)
        .in('metric', ['env.temperature', 'env.humidity', 'iaq.voc', 'temp', 'temperature', 'humidity', 'voc', 'iaq.co2', 'co2', 'CO2']);

      // CO2 di ripiego dai valori correnti: telemetry_daily puo' non avere
      // righe anche per device che trasmettono (verificato: 119 monitor
      // Luxottica online e ZERO aggregati giornalieri — il job non li copre).
      // La media 30gg, quando esiste, ha la precedenza; altrimenti si usa la
      // media dei valori correnti per sito. Dato reale, non aggregato.
      const latestCo2BySite: Record<string, number[]> = {};

      if (latestAir) {
        latestAir.forEach((row: any) => {
          if (!row.site_id || row.value === null) return;
          if (!result.airAvg[row.site_id]) {
            result.airAvg[row.site_id] = { co2: null, temperature: null, humidity: null, voc: null };
          }
          const m = row.metric;
          if (m === 'env.temperature' || m === 'temp' || m === 'temperature') {
            result.airAvg[row.site_id].temperature = Number(row.value);
          } else if (m === 'env.humidity' || m === 'humidity') {
            result.airAvg[row.site_id].humidity = Number(row.value);
          } else if (m === 'iaq.voc' || m === 'voc') {
            result.airAvg[row.site_id].voc = Number(row.value);
          } else if (m === 'iaq.co2' || m === 'co2' || m === 'CO2') {
            (latestCo2BySite[row.site_id] = latestCo2BySite[row.site_id] || []).push(Number(row.value));
          }
        });
      }

      Object.entries(latestCo2BySite).forEach(([sId, values]) => {
        if (result.airAvg[sId]?.co2 == null && values.length > 0) {
          const valid = values.filter(v => Number.isFinite(v) && v > 0);
          if (valid.length > 0) {
            result.airAvg[sId].co2 = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
          }
        }
      });
    } catch (e) {
      console.warn('[useAggregatedSiteData] AQ query failed:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // 4) ONLINE STATUS + STALENESS: check latest timestamps per site
  // ---------------------------------------------------------------------------
  try {
    // Fetch latest ts per site from both tables (batched)
    const batchSizeOnline = 50;
    for (let i = 0; i < siteIds.length; i += batchSizeOnline) {
      const batch = siteIds.slice(i, i + batchSizeOnline);
      const [{ data: el }, { data: tl }] = await Promise.all([
        supabase.from('energy_latest').select('site_id, ts').in('site_id', batch),
        supabase.from('telemetry_latest').select('site_id, ts').in('site_id', batch),
      ]);
      // Track max ts per site e stato online. Il sito e' online se ALMENO UN
      // dominio installato e' fresco, ciascuno con la propria finestra:
      // energy_latest -> 3h30 (caricamenti a lotti), telemetry_latest -> 60 min.
      const processRows = (rows: any[] | null, freshnessCutoff: Date) => {
        rows?.forEach((r: any) => {
          if (!r.site_id || !r.ts) return;
          const ts = new Date(r.ts);
          // Update latestTs
          const existing = result.latestTs[r.site_id];
          if (!existing || ts > new Date(existing)) {
            result.latestTs[r.site_id] = r.ts;
          }
          if (ts >= freshnessCutoff) {
            result.onlineStatus[r.site_id] = true;
          }
        });
      };
      processRows(el, threeHalfHoursAgo);
      processRows(tl, sixtyMinutesAgo);
    }
  } catch (e) {
    console.warn('[useAggregatedSiteData] online/staleness query failed:', e);
  }

  // ---------------------------------------------------------------------------
  // 5) ALERTS da site_alerts (status='active') — stessa fonte della vista sito
  //    e della campanella (spec Q1b). La vecchia fonte era `events`, che in
  //    produzione ha ZERO righe: il KPI mostrava solo lo stale camuffato.
  // ---------------------------------------------------------------------------
  try {
    for (let i = 0; i < siteIds.length; i += batchSize) {
      const batch = siteIds.slice(i, i + batchSize);
      const { data: alertRows } = await supabase
        .from('site_alerts')
        .select('site_id, severity')
        .in('site_id', batch)
        .eq('status', 'active');
      alertRows?.forEach((row: any) => {
        if (!row.site_id) return;
        if (!result.alerts[row.site_id]) result.alerts[row.site_id] = { critical: 0, warning: 0, info: 0 };
        const sev = row.severity?.toLowerCase() || 'info';
        if (sev === 'critical' || sev === 'error') result.alerts[row.site_id].critical++;
        else if (sev === 'warning' || sev === 'warn') result.alerts[row.site_id].warning++;
        else result.alerts[row.site_id].info++;
      });
    }
  } catch (e) { /* ignore */ }

  // Stale (>2 giorni senza letture): segnalato a parte come "no-data",
  // MAI sommato ai critical (spec Q1b).
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  Object.entries(result.latestTs).forEach(([siteId, ts]) => {
    if (new Date(ts) < twoDaysAgo) result.noData[siteId] = true;
  });

  console.log('[useAggregatedSiteData] Fetched:', {
    sitesWithEnergy: Object.keys(result.monthlyEnergy).length,
    sitesWithHvac: Object.keys(result.hvacEnergy).length,
    sitesWithAir: Object.keys(result.airAvg).length,
    sitesOnline: Object.keys(result.onlineStatus).filter(k => result.onlineStatus[k]).length,
  });

  return result;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useAggregatedSiteData(filteredProjects: Project[]): AggregatedOverlayData {
  const siteIds = useMemo(() => {
    return filteredProjects.map(p => p.siteId || `s-demo-${p.id}`);
  }, [filteredProjects]);

  const { data: aggregatedData, isLoading, isError } = useQuery({
    queryKey: ['aggregated-site-data-v4', [...siteIds].sort().join(',')],
    queryFn: () => fetchAggregatedDataForSites(siteIds),
    enabled: isSupabaseConfigured && siteIds.length > 0,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  return useMemo(() => {
    const sites: SiteRealData[] = [];

    filteredProjects.forEach(project => {
      const siteId = project.siteId || `s-demo-${project.id}`;

      let monthlyKwh = aggregatedData?.monthlyEnergy[siteId] ?? null;
      let hvacKwh = aggregatedData?.hvacEnergy[siteId] ?? null;
      let lightingKwh = aggregatedData?.lightingEnergy[siteId] ?? null;
      let plugsKwh = aggregatedData?.plugsEnergy[siteId] ?? null;
      let airData = aggregatedData?.airAvg[siteId] ?? null;
      let isOnline = aggregatedData?.onlineStatus[siteId] ?? false;
      let alerts = aggregatedData?.alerts[siteId] ?? { critical: 0, warning: 0, info: 0 };
      const hasLatestTs = !!aggregatedData?.latestTs[siteId];

      // NEGLI AGGREGATI DECIDONO I DISPOSITIVI, NON I FLAG MODULI.
      // Verificato sul DB (13/08/2026): module_energy_enabled e' true per 11
      // siti su 1113, module_air per 107, water per 0 — Luxottica ha 119 siti
      // con device che trasmettono e ZERO flag attivi (il trigger di
      // auto-attivazione non e' mai scattato per loro). Filtrare su quei flag
      // svuota leaderboard e health matrix di dati REALI. Qui vale la
      // presenza di dati veri; i flag restano autorevoli solo nella vista di
      // dettaglio sito (ModuleGate), dove l'admin li cura esplicitamente.

      // I valori di ripiego valgono SOLO per i siti vetrina FGB, che hanno un
      // profilo esplicito con valori deterministici. Per ogni altro sito i dati
      // mancanti restano null: un negozio senza contatore non deve mai mostrare
      // consumi inventati. La versione precedente applicava il fallback anche ai
      // siti reali privi di telemetria, con la conseguenza che TUTTI finivano per
      // esporre gli stessi 45 kW * 24 * 30 = 32,4 MWh e gli stessi 420 ppm.
      const profile = getDemoProfile(project);
      if (profile) {
        monthlyKwh = monthlyKwh ?? Math.round(profile.basePowerKw * 24 * 30);
        hvacKwh = hvacKwh ?? Math.round(monthlyKwh * 0.45);
        lightingKwh = lightingKwh ?? Math.round(monthlyKwh * 0.35);
        plugsKwh = plugsKwh ?? Math.round(monthlyKwh * 0.20);
        airData = airData ?? {
          co2: profile.co2,
          temperature: profile.temperature,
          humidity: profile.humidity,
          voc: profile.tvoc,
        };
        isOnline = true;
      }

      const hasEnergyData = monthlyKwh !== null && monthlyKwh > 0;
      const hasAirData = airData !== null && (airData.co2 !== null || airData.temperature !== null);
      // Nessuna aggregazione idrica e' disponibile: finche' non esiste, il modulo
      // acqua non ha dati da mostrare. Prima qui c'era `true` con un consumo
      // fisso di 450 L, che rendeva "monitorato" ogni sito del gruppo.
      const hasWaterData = false;

      // Capability = cosa e' installato (le "aspettative", spec Q5).
      const capabilities = aggregatedData?.capabilities[siteId]
        ?? (profile
          ? { energy: profile.modules.energy, air: profile.modules.air, water: profile.modules.water }
          : { energy: false, air: false, water: false });
      const isMonitored = capabilities.energy || capabilities.air || capabilities.water;
      const isNoData = aggregatedData?.noData[siteId] ?? false;

      // Stato canonico (spec §0): giudicato SOLO sui domini installati.
      const state: SiteState = !isMonitored
        ? 'not_installed'
        : isOnline
          ? 'online'
          : isNoData || !hasLatestTs
            ? 'stale'
            : 'offline';

      // Baseline energia per la Health Matrix (spec Q4): media giornaliera
      // 30gg confrontata con la media 90gg. Null se una delle due manca.
      const kwh90 = aggregatedData?.energy90[siteId];
      const baselineDeltaPct = (monthlyKwh != null && monthlyKwh > 0 && kwh90 != null && kwh90 > 0)
        ? Math.round((((monthlyKwh / 30) - (kwh90 / 90)) / (kwh90 / 90)) * 100)
        : null;

      // Popolazione degli aggregati = siti monitorati (piu' vetrina/storico).
      if (!isMonitored && !hasEnergyData && !hasAirData && !isOnline && !hasLatestTs) return;

      sites.push({
        siteId,
        siteName: project.name,
        isOnline,
        hasEnergyData,
        hasAirData,
        hasWaterData,
        capabilities,
        state,
        isNoData,
        baselineDeltaPct,
        energy: { monthlyKwh, hvacKwh, lightingKwh, plugsKwh },
        air: airData ?? { co2: null, temperature: null, humidity: null, voc: null },
        water: { consumption: null },
        alerts,
      });
    });

    const sitesWithEnergy = sites.filter(s => s.hasEnergyData);
    const sitesWithAir = sites.filter(s => s.hasAirData);
    const sitesWithWater = sites.filter(s => s.hasWaterData);
    const sitesOnline = sites.filter(s => s.isOnline);
    const sitesMonitored = sites.filter(s => s.state !== 'not_installed');

    const totalMonthlyKwh = sitesWithEnergy.reduce((sum, s) => sum + (s.energy.monthlyKwh || 0), 0);
    const totalCo2 = sitesWithAir.reduce((sum, s) => sum + (s.air.co2 || 0), 0);
    const avgCo2 = sitesWithAir.length > 0 ? Math.round(totalCo2 / sitesWithAir.length) : 0;
    const alertsCritical = sites.reduce((sum, s) => sum + s.alerts.critical, 0);
    const alertsWarning = sites.reduce((sum, s) => sum + s.alerts.warning, 0);
    const alertsNoData = sites.filter(s => s.isNoData).length;

    return {
      sites,
      sitesWithEnergy,
      sitesWithAir,
      sitesWithWater,
      totals: {
        monthlyEnergyKwh: Math.round(totalMonthlyKwh),
        avgCo2,
        sitesCount: sites.length,
        sitesOnline: sitesOnline.length,
        sitesMonitored: sitesMonitored.length,
        sitesWithData: sites.length,
        alertsCritical,
        alertsWarning,
        alertsNoData,
      },
      isLoading,
      isError,
      hasRealData: sites.length > 0,
    };
  }, [filteredProjects, aggregatedData, isLoading, isError]);
}

/**
 * Check if a project has any active modules with real data capability
 */
export function useProjectHasRealDataCapability(project: Project | null): {
  hasEnergy: boolean;
  hasAir: boolean;
  hasWater: boolean;
  hasAny: boolean;
} {
  const { projects: adminProjects } = useAdminData();

  return useMemo(() => {
    if (!project || !project.siteId) {
      return { hasEnergy: false, hasAir: false, hasWater: false, hasAny: false };
    }

    const adminProject = adminProjects.find(
      ap => ap.siteId === project.siteId || ap.id === project.siteId
    );

    if (adminProject) {
      const hasEnergy = adminProject.modules.energy.enabled;
      const hasAir = adminProject.modules.air.enabled;
      const hasWater = adminProject.modules.water.enabled;
      return { hasEnergy, hasAir, hasWater, hasAny: hasEnergy || hasAir || hasWater };
    }

    const hasEnergy = project.monitoring?.includes('energy') ?? false;
    const hasAir = project.monitoring?.includes('air') ?? false;
    const hasWater = project.monitoring?.includes('water') ?? false;
    return { hasEnergy, hasAir, hasWater, hasAny: hasEnergy || hasAir || hasWater };
  }, [project, adminProjects]);
}
