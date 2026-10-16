/**
 * Dispositivi INSTALLATI in un sito, raggruppati per tipo e modello.
 * Serve all'hero mobile: «Clair LEED · 4 installati», con rotazione fra i
 * gruppi realmente presenti (atlante §5.2). Nessun hardware mostrato dove
 * non è installato: la lista arriva da `devices`, non da una costante.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isValidUUID } from '@/lib/utils';

export type DeviceFamily = 'energy' | 'air' | 'water';

export interface SiteDeviceGroup {
  family: DeviceFamily;
  /** nome commerciale FGB + che cosa misura, es. «Greeny Energy».
   *  Niente sigla di modello (16/10: «non serve il MSCHN»). */
  label: string;
  count: number;
  /** render ufficiale in public/intro */
  img: string;
}

const FAMILY_OF: Record<string, DeviceFamily> = {
  energy_monitor: 'energy',
  air_quality: 'air',
  water_meter: 'water',
  water_quality: 'water',
};
/** nomi commerciali dei prodotti FGB (i render si chiamano come loro) */
const BRAND: Record<DeviceFamily, { name: string; img: string }> = {
  energy: { name: 'Greeny Energy', img: '/intro/hw-greeny.webp' },
  air: { name: 'Clair Air quality', img: '/intro/hw-clair.webp' },
  water: { name: 'Water meter', img: '/intro/hw-water.webp' },
};
/** i device «Virtual» non sono hardware installato e non si contano */
const isVirtual = (m: string | null) => /^virtual$/i.test((m || '').trim());

/** Sito vetrina: hardware dimostrativo, coerente col resto della demo. */
const DEMO_GROUPS: SiteDeviceGroup[] = [
  { family: 'energy', label: BRAND.energy.name, count: 15, img: BRAND.energy.img },
  { family: 'air', label: BRAND.air.name, count: 4, img: BRAND.air.img },
  { family: 'water', label: BRAND.water.name, count: 1, img: BRAND.water.img },
];

export function useSiteDevices(siteId: string | undefined | null) {
  const isShowcase = !!siteId && (!isValidUUID(siteId) || !isSupabaseConfigured);
  return useQuery<SiteDeviceGroup[]>({
    queryKey: ['site-devices-groups', siteId],
    enabled: !!siteId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (isShowcase) return DEMO_GROUPS;
      const { data } = await supabase!
        .from('devices')
        .select('device_type, model')
        .eq('site_id', siteId as string);
      const rows = (data || []) as unknown as Array<{ device_type: string | null; model: string | null }>;
      // un gruppo per FAMIGLIA (non per modello): «Greeny Energy · 15»,
      // non «Greeny PAN12 · 9» e «Greeny MSCHN · 6»
      const by = new Map<DeviceFamily, SiteDeviceGroup>();
      for (const r of rows) {
        const family = FAMILY_OF[r.device_type || ''];
        if (!family || isVirtual(r.model)) continue;
        const cur = by.get(family);
        if (cur) cur.count++;
        else by.set(family, { family, label: BRAND[family].name, count: 1, img: BRAND[family].img });
      }
      // i gruppi più numerosi per primi
      return [...by.values()].sort((a, b) => b.count - a.count);
    },
  });
}
