/**
 * Dati PEER REALI per il grafico Actual vs Average (kWh/m2).
 *
 * Chiama la RPC get_peer_energy_density (creata in produzione il 26/08/2026):
 * SECURITY DEFINER che restituisce SOLO aggregati anonimi (avg/min/max, mai
 * identificativi) calcolati sui siti con la stessa typology del sito
 * osservato, area_m2 > 0 e contatore 'general', escludendo il sito stesso.
 * Ogni bucket esiste solo se ci sono almeno 3 peer (k-anonimato); sotto quella
 * soglia la mappa resta vuota e il grafico nasconde le serie peer.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isValidUUID } from '@/lib/utils';
import { TimePeriod, DateRange } from '@/hooks/useTimeFilteredData';

export interface PeerBucketStats {
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface PeerDensityData {
  byBucket: Map<string, PeerBucketStats>;
  peerCount: number;
}

export function usePeerEnergyDensity(
  siteId: string | null | undefined,
  timePeriod: TimePeriod,
  dateRange?: DateRange,
) {
  // Stessa granularita' dei bucket del grafico: oggi -> profilo orario,
  // anno -> mesi, altrimenti giorni.
  const granularity = timePeriod === 'today' ? 'hour' : timePeriod === 'year' ? 'month' : 'day';

  return useQuery<PeerDensityData>({
    queryKey: ['peer-energy-density', siteId, timePeriod, dateRange?.from?.getTime(), dateRange?.to?.getTime()],
    queryFn: async () => {
      const empty: PeerDensityData = { byBucket: new Map(), peerCount: 0 };
      if (!supabase || !siteId) return empty;

      const now = new Date();
      let start: Date;
      let end: Date = now;
      switch (timePeriod) {
        case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case 'week': start = new Date(now.getTime() - 6 * 86400000); break;
        case 'month': start = new Date(now.getTime() - 29 * 86400000); break;
        case 'year': start = new Date(now.getFullYear(), 0, 1); break;
        case 'custom':
          start = dateRange?.from || new Date(now.getTime() - 29 * 86400000);
          end = dateRange?.to || now;
          break;
        default: start = new Date(now.getTime() - 29 * 86400000);
      }

      // cast: la RPC non esiste nei tipi generati da Lovable
      const { data, error } = await (supabase.rpc as any)('get_peer_energy_density', {
        p_site_id: siteId,
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_granularity: granularity,
      });
      if (error) throw error;

      const byBucket = new Map<string, PeerBucketStats>();
      let peerCount = 0;
      (data || []).forEach((r: any) => {
        byBucket.set(String(r.bucket), {
          avg: Number(r.peer_avg),
          min: Number(r.peer_min),
          max: Number(r.peer_max),
          count: Number(r.peer_count),
        });
        peerCount = Math.max(peerCount, Number(r.peer_count));
      });
      return { byBucket, peerCount };
    },
    enabled: isSupabaseConfigured && !!siteId && isValidUUID(siteId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * EUI target annuo (kWh/m2/anno) del sito, SOLO se salvato esplicitamente in
 * site_thresholds: il default 200 che precompila il form dei settings non
 * deve diventare una linea Benchmark non voluta nel grafico.
 */
export function useSiteEuiTarget(siteId: string | null | undefined) {
  return useQuery<number | null>({
    queryKey: ['site-eui-target', siteId],
    queryFn: async () => {
      if (!supabase || !siteId) return null;
      const { data, error } = await supabase
        .from('site_thresholds')
        .select('energy_target_eui_kwh_m2')
        .eq('site_id', siteId)
        .maybeSingle();
      if (error) throw error;
      const v = (data as { energy_target_eui_kwh_m2: number | null } | null)?.energy_target_eui_kwh_m2;
      return typeof v === 'number' && v > 0 ? v : null;
    },
    enabled: isSupabaseConfigured && !!siteId && isValidUUID(siteId),
    staleTime: 5 * 60 * 1000,
  });
}
