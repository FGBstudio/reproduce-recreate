import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CurrencyCode, isSupportedCurrency } from '@/lib/currency';

/**
 * Returns the configured native currency for a site (defaults to EUR).
 * Cached for 10 minutes.
 */
export function useSiteCurrency(siteId: string | null | undefined): CurrencyCode {
  const { data } = useQuery({
    queryKey: ['site-currency', siteId],
    enabled: !!siteId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sites')
        .select('currency')
        .eq('id', siteId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.currency as string | null;
    },
  });
  return isSupportedCurrency(data) ? data : 'EUR';
}