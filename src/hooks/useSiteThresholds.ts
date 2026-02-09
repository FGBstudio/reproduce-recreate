import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SiteThresholds {
  id?: string;
  site_id: string;
  // Energy
  energy_power_limit_kw: number | null;
  energy_daily_budget_kwh: number | null;
  energy_anomaly_detection_enabled: boolean | null;
  // Air
  air_temp_min_c: number | null;
  air_temp_max_c: number | null;
  air_humidity_min_pct: number | null;
  air_humidity_max_pct: number | null;
  air_co2_warning_ppm: number | null;
  air_co2_critical_ppm: number | null;
  // Water
  water_leak_threshold_lh: number | null;
  water_daily_budget_liters: number | null;
}

const defaultThresholds: Omit<SiteThresholds, 'site_id'> = {
  energy_power_limit_kw: null,
  energy_daily_budget_kwh: null,
  energy_anomaly_detection_enabled: false,
  air_temp_min_c: 18,
  air_temp_max_c: 26,
  air_humidity_min_pct: 30,
  air_humidity_max_pct: 60,
  air_co2_warning_ppm: 1000,
  air_co2_critical_ppm: 1500,
  water_leak_threshold_lh: null,
  water_daily_budget_liters: null,
};

export function useSiteThresholds(siteId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['site-thresholds', siteId],
    queryFn: async (): Promise<SiteThresholds> => {
      if (!siteId) throw new Error('No site ID provided');
      
      const { data, error } = await supabase
        .from('site_thresholds')
        .select('*')
        .eq('site_id', siteId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        return data as SiteThresholds;
      }
      
      // Return defaults if no record exists
      return { site_id: siteId, ...defaultThresholds };
    },
    enabled: !!siteId,
  });

  const mutation = useMutation({
    mutationFn: async (thresholds: Partial<SiteThresholds>) => {
      if (!siteId) throw new Error('No site ID provided');

      const { error } = await supabase
        .from('site_thresholds')
        .upsert(
          { 
            site_id: siteId, 
            ...thresholds,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'site_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-thresholds', siteId] });
    },
  });

  return {
    thresholds: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateThresholds: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
