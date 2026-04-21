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
  // Benchmarks & Health
  energy_target_eui_kwh_m2: number | null;
  connectivity_offline_threshold_min: number | null;
  connectivity_offline_threshold_energy_min: number | null;
  // Extra IAQ
  air_voc_warning_ppb: number | null;
  air_pm25_warning_ugm3: number | null;
  air_pm10_warning_ugm3: number | null;
  air_co_warning_ppm: number | null;
  air_o3_warning_ppb: number | null;
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
  energy_target_eui_kwh_m2: 200,
  connectivity_offline_threshold_min: 30,
  connectivity_offline_threshold_energy_min: 240,
  air_voc_warning_ppb: 300,
  air_pm25_warning_ugm3: 15,
  air_pm10_warning_ugm3: 25,
  air_co_warning_ppm: 4,
  air_o3_warning_ppb: 50,
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
        return data as unknown as SiteThresholds;
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
