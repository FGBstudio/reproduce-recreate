/**
 * KPI del pannello Client Overview (specifica v2, regole 27.08).
 *
 * Una sola query su certifications per i siti del perimetro visibile:
 *  - vista Certifications: ottenute (no Energy/Air, stato certificato) e
 *    in avanzamento (no Energy/Air, tutto il resto non cancellato);
 *  - vista Monitoring: PUNTI di monitoraggio per dominio = siti distinti
 *    con riga cert_type del dominio OPPURE flag has_*_monitoring — la
 *    domanda e' "quanti sistemi sono stati installati/previsti?",
 *    indipendentemente che siano progetti singoli o a supporto di
 *    certificazioni. Gli stati vivo/spento/pipeline arrivano poi dai
 *    device (certDomainLive), non da questi flag.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { classifyCertState } from '@/hooks/useCertificationsOverview';

const NOT_BUILDING = new Set(['Energy', 'Air']);

export interface ClientOverviewKpis {
  certAchieved: number;
  certAchievedLevels: { level: string; n: number }[]; // top livelli per la sottoriga
  certAdvancing: number;
  certAdvancingBreakdown: { inProgress: number; pipeline: number; potential: number };
  energyPointSites: string[]; // siti distinti con punto energia
  airPointSites: string[];    // siti distinti con punto aria
  waterPointSites: string[];  // predisposto: oggi quasi sempre vuoto
}

const EMPTY: ClientOverviewKpis = {
  certAchieved: 0,
  certAchievedLevels: [],
  certAdvancing: 0,
  certAdvancingBreakdown: { inProgress: 0, pipeline: 0, potential: 0 },
  energyPointSites: [],
  airPointSites: [],
  waterPointSites: [],
};

export function useClientOverviewKpis(siteIds: string[]) {
  const key = [...siteIds].sort().join(',');
  return useQuery<ClientOverviewKpis>({
    queryKey: ['client-overview-kpis', key],
    queryFn: async () => {
      if (!supabase || siteIds.length === 0) return EMPTY;
      const rows: {
        site_id: string; cert_type: string | null; status: string | null;
        cert_level: string | null; has_energy_monitoring: boolean | null;
        has_iaq_monitoring: boolean | null; has_water_monitoring: boolean | null;
      }[] = [];
      const batch = 50;
      for (let i = 0; i < siteIds.length; i += batch) {
        const { data, error } = await supabase
          .from('certifications')
          .select('site_id, cert_type, status, cert_level, has_energy_monitoring, has_iaq_monitoring, has_water_monitoring')
          .in('site_id', siteIds.slice(i, i + batch));
        if (error) throw error;
        if (data) rows.push(...(data as typeof rows));
      }

      let certAchieved = 0;
      const levelCounts = new Map<string, number>();
      const adv = { inProgress: 0, pipeline: 0, potential: 0 };
      const energy = new Set<string>();
      const air = new Set<string>();
      const water = new Set<string>();

      for (const r of rows) {
        const state = classifyCertState(r.status);
        if (!state || !r.cert_type) continue; // cancellate: fuori da tutto

        if (r.cert_type === 'Energy' || r.has_energy_monitoring) energy.add(r.site_id);
        if (r.cert_type === 'Air' || r.has_iaq_monitoring) air.add(r.site_id);
        if (r.has_water_monitoring) water.add(r.site_id);

        if (NOT_BUILDING.has(r.cert_type)) continue;
        if (state === 'achieved') {
          certAchieved++;
          const lvl = r.cert_level || 'Level TBD';
          levelCounts.set(lvl, (levelCounts.get(lvl) || 0) + 1);
        } else if (state === 'in_progress') adv.inProgress++;
        else if (state === 'pipeline') adv.pipeline++;
        else if (state === 'potential') adv.potential++;
      }

      return {
        certAchieved,
        certAchievedLevels: [...levelCounts.entries()]
          .map(([level, n]) => ({ level, n }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 2),
        certAdvancing: adv.inProgress + adv.pipeline + adv.potential,
        certAdvancingBreakdown: adv,
        energyPointSites: [...energy],
        airPointSites: [...air],
        waterPointSites: [...water],
      };
    },
    enabled: isSupabaseConfigured && siteIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
