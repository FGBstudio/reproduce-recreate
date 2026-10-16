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
  /** nome commerciale FGB + modello di targa, es. «Clair LEED» */
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
  energy: { name: 'Greeny', img: '/intro/hw-greeny.webp' },
  air: { name: 'Clair', img: '/intro/hw-clair.webp' },
  water: { name: 'Water meter', img: '/intro/hw-water.webp' },
};
/** «WEEL» è il refuso con cui WELL è scritto in metà delle righe */
const normModel = (m: string | null): string => {
  const s = (m || '').trim();
  if (!s || /^virtual$/i.test(s)) return '';
  return /^weel$/i.test(s) ? 'WELL' : s.toUpperCase() === s ? s : s;
};

/** Sito vetrina: hardware dimostrativo, coerente col resto della demo. */
const DEMO_GROUPS: SiteDeviceGroup[] = [
  { family: 'air', label: 'Clair WELL', count: 4, img: BRAND.air.img },
  { family: 'energy', label: 'Greeny PAN12', count: 9, img: BRAND.energy.img },
  { family: 'water', label: 'Water meter', count: 1, img: BRAND.water.img },
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
      const by = new Map<string, SiteDeviceGroup>();
      for (const r of rows) {
        const family = FAMILY_OF[r.device_type || ''];
        if (!family) continue;
        const model = normModel(r.model);
        const brand = BRAND[family];
        const label = model ? `${brand.name} ${model}` : brand.name;
        const key = `${family}|${label}`;
        const cur = by.get(key);
        if (cur) cur.count++;
        else by.set(key, { family, label, count: 1, img: brand.img });
      }
      // i gruppi più numerosi per primi, al massimo quattro frame
      return [...by.values()].sort((a, b) => b.count - a.count).slice(0, 4);
    },
  });
}
