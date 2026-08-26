/**
 * Superficie del sito (sites.area_m2) e sua tipologia (sites.area_basis).
 * QueryKey condivisa con ProjectSettingsDialog: quando l'utente salva dal
 * dialog, tutte le "i" informative sui grafici kWh/m2 si aggiornano da sole.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isValidUUID } from '@/lib/utils';

export interface SiteAreaInfo {
  area: number | null;
  basis: string | null;
}

export function useSiteArea(siteId: string | null | undefined) {
  return useQuery<SiteAreaInfo | null>({
    queryKey: ['site-area', siteId],
    queryFn: async () => {
      if (!supabase || !siteId) return null;
      // cast: area_basis aggiunta al DB il 26/08, i tipi generati da Lovable
      // non la conoscono (file auto-generato, non modificabile a mano)
      const { data, error } = (await supabase
        .from('sites')
        .select('area_m2, area_basis')
        .eq('id', siteId)
        .maybeSingle()) as { data: { area_m2: number | null; area_basis: string | null } | null; error: unknown };
      if (error) throw error;
      return { area: data?.area_m2 ?? null, basis: data?.area_basis ?? null };
    },
    enabled: isSupabaseConfigured && !!siteId && isValidUUID(siteId),
    staleTime: 5 * 60 * 1000,
  });
}
