import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SiteEnergyPriceEntry {
  id: string;
  site_id: string;
  price_eur_per_kwh: number;
  currency_at_save: string;
  price_in_currency: number | null;
  effective_from: string;
  created_at: string;
  note: string | null;
}

/**
 * Returns the versioned gross energy price history for a site, sorted
 * by `effective_from` ASC, plus a helper `priceAt(date)` that returns the
 * price (in EUR/kWh) that was effective at that timestamp.
 *
 * Falls back to `sites.energy_price_kwh` for periods before the first
 * recorded change.
 */
export function useSiteEnergyPriceHistory(siteId: string | null | undefined, fallbackEur?: number | null) {
  const { data: history = [] } = useQuery({
    queryKey: ['site-energy-price-history', siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_energy_price_history' as any)
        .select('*')
        .eq('site_id', siteId!)
        .order('effective_from', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SiteEnergyPriceEntry[];
    },
  });

  const priceAt = useMemo(() => {
    return (when: Date | string | number): number => {
      const ts = typeof when === 'number' ? when : new Date(when).getTime();
      if (!history.length) return Number(fallbackEur ?? 0);
      let chosen: number | null = null;
      for (const row of history) {
        const eff = new Date(row.effective_from).getTime();
        if (eff <= ts) chosen = Number(row.price_eur_per_kwh);
        else break;
      }
      if (chosen == null) {
        // Before first recorded entry → use the oldest known price as best estimate.
        chosen = Number(history[0].price_eur_per_kwh);
      }
      return chosen;
    };
  }, [history, fallbackEur]);

  return { history, priceAt };
}