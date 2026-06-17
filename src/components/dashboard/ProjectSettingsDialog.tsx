import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Zap, Wind, Droplets, Info, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSiteThresholds, SiteThresholds } from "@/hooks/useSiteThresholds";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SUPPORTED_CURRENCIES, isSupportedCurrency, CurrencyCode, getCurrencySymbol, convertAmount } from "@/lib/currency";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useSiteEnergyPriceHistory } from "@/hooks/useSiteEnergyPriceHistory";

const i18n = {
  en: {
    title: 'Project Settings',
    subtitle: 'Configure thresholds and operational limits',
    energy: 'Energy',
    air: 'Air',
    water: 'Water',
    powerLimit: 'Contracted Power (kW)',
    powerLimitHint: 'Contractual physical threshold',
    powerPlaceholder: 'e.g. 50',
    dailyBudgetEnergy: 'Daily Budget (kWh)',
    dailyBudgetPlaceholder: 'e.g. 500',
    anomalyDetection: 'AI Anomaly Detection',
    anomalyTooltip: 'Compares current consumption with the baseline of the last 90 days to detect anomalous behaviour (Z-score analysis).',
    anomalyHint: 'Statistical analysis on historical data',
    tempMin: 'Temp. Min (°C)',
    tempMax: 'Temp. Max (°C)',
    humidityMin: 'Humidity Min (%)',
    humidityMax: 'Humidity Max (%)',
    leakThreshold: 'Leak Threshold (L/h)',
    leakHint: 'Triggers an alert if the flow anomalously exceeds this threshold',
    leakPlaceholder: 'e.g. 5',
    dailyBudgetWater: 'Daily Budget (L)',
    dailyBudgetWaterPlaceholder: 'e.g. 1000',
    euiBenchmark: 'EUI Benchmark (kWh/m²)',
    euiPlaceholder: 'e.g. 150',
    areaM2: 'Site Area (m²)',
    areaPlaceholder: 'e.g. 1200',
    areaHint: 'Total surface, used for EUI and density KPIs',
    currency: 'Site Currency',
    currencyHint: 'All economic values are stored in EUR and converted live to the selected currency. FX rates refresh every 24h.',
    energyPrice: 'Gross Energy Price',
    energyPriceHint: 'Gross tariff per kWh in the selected currency. Stored in EUR and reconverted live as FX rates change.',
    energyPricePlaceholder: 'e.g. 0.25',
    cancel: 'Cancel',
    save: 'Save',
    saveSuccess: 'Settings saved successfully',
    saveError: 'Error saving settings',
    tempError: 'Minimum temperature must be lower than maximum',
    co2Error: 'Warning threshold must be lower than critical threshold',
    tvocError: 'TVOC warning threshold must be lower than critical threshold',
    hchoError: 'Formaldehyde warning threshold must be lower than critical threshold',
  },
  it: {
    title: 'Impostazioni Progetto',
    subtitle: 'Configura soglie e limiti operativi',
    energy: 'Energia',
    air: 'Aria',
    water: 'Acqua',
    powerLimit: 'Potenza Impegnata (kW)',
    powerLimitHint: 'Soglia fisica contrattuale',
    powerPlaceholder: 'es. 50',
    dailyBudgetEnergy: 'Budget Giornaliero (kWh)',
    dailyBudgetPlaceholder: 'es. 500',
    anomalyDetection: 'Rilevamento Anomalie AI',
    anomalyTooltip: 'Confronta i consumi attuali con la baseline degli ultimi 90 giorni per rilevare comportamenti anomali (analisi Z-score).',
    anomalyHint: 'Analisi statistica su base storica',
    tempMin: 'Temp. Min (°C)',
    tempMax: 'Temp. Max (°C)',
    humidityMin: 'Umidità Min (%)',
    humidityMax: 'Umidità Max (%)',
    leakThreshold: 'Soglia Perdita (L/h)',
    leakHint: 'Genera un alert se il flusso supera questa soglia in modo anomalo',
    leakPlaceholder: 'es. 5',
    dailyBudgetWater: 'Budget Giornaliero (L)',
    dailyBudgetWaterPlaceholder: 'es. 1000',
    euiBenchmark: 'Benchmark EUI (kWh/m²)',
    euiPlaceholder: 'es. 150',
    areaM2: 'Superficie Sito (m²)',
    areaPlaceholder: 'es. 1200',
    areaHint: 'Superficie totale, usata per EUI e KPI di densità',
    currency: 'Valuta del Sito',
    currencyHint: 'Tutti i valori economici sono memorizzati in EUR e convertiti in tempo reale nella valuta selezionata. Tassi aggiornati ogni 24h.',
    energyPrice: 'Prezzo Lordo Energia',
    energyPriceHint: 'Tariffa lorda per kWh nella valuta selezionata. Salvata in EUR e riconvertita in tempo reale al variare dei tassi.',
    energyPricePlaceholder: 'es. 0,25',
    cancel: 'Annulla',
    save: 'Salva',
    saveSuccess: 'Impostazioni salvate con successo',
    saveError: 'Errore durante il salvataggio',
    tempError: 'La temperatura minima deve essere inferiore alla massima',
    co2Error: 'La soglia warning deve essere inferiore alla soglia critical',
    tvocError: 'La soglia warning del TVOC deve essere inferiore alla critical',
    hchoError: 'La soglia warning della Formaldeide deve essere inferiore alla critical',
  },
  fr: {
    title: 'Paramètres du Projet',
    subtitle: 'Configurer les seuils et limites opérationnelles',
    energy: 'Énergie',
    air: 'Air',
    water: 'Eau',
    powerLimit: 'Puissance Contractée (kW)',
    powerLimitHint: 'Seuil physique contractuel',
    powerPlaceholder: 'ex. 50',
    dailyBudgetEnergy: 'Budget Quotidien (kWh)',
    dailyBudgetPlaceholder: 'ex. 500',
    anomalyDetection: 'Détection d\'Anomalies IA',
    anomalyTooltip: 'Compare la consommation actuelle avec la référence des 90 derniers jours pour détecter les comportements anormaux.',
    anomalyHint: 'Analyse statistique sur les données historiques',
    tempMin: 'Temp. Min (°C)',
    tempMax: 'Temp. Max (°C)',
    humidityMin: 'Humidité Min (%)',
    humidityMax: 'Humidité Max (%)',
    leakThreshold: 'Seuil de Fuite (L/h)',
    leakHint: 'Déclenche une alerte si le débit dépasse ce seuil de manière anormale',
    leakPlaceholder: 'ex. 5',
    dailyBudgetWater: 'Budget Quotidien (L)',
    dailyBudgetWaterPlaceholder: 'ex. 1000',
    euiBenchmark: 'Benchmark EUI (kWh/m²)',
    euiPlaceholder: 'ex. 150',
    areaM2: 'Surface du Site (m²)',
    areaPlaceholder: 'ex. 1200',
    areaHint: 'Surface totale, utilisée pour EUI et KPI de densité',
    currency: 'Devise du Site',
    currencyHint: 'Toutes les valeurs économiques sont stockées en EUR et converties en temps réel. Taux mis à jour toutes les 24h.',
    energyPrice: 'Prix Brut de l\'Énergie',
    energyPriceHint: 'Tarif brut par kWh dans la devise sélectionnée. Enregistré en EUR et reconverti en temps réel.',
    energyPricePlaceholder: 'ex. 0,25',
    cancel: 'Annuler',
    save: 'Enregistrer',
    saveSuccess: 'Paramètres enregistrés avec succès',
    saveError: 'Erreur lors de l\'enregistrement',
    tempError: 'La température minimale doit être inférieure à la maximale',
    co2Error: 'Le seuil d\'avertissement doit être inférieur au seuil critique',
    tvocError: 'Le seuil d\'avertissement COV doit être inférieur au seuil critique',
    hchoError: 'Le seuil d\'avertissement formaldéhyde doit être inférieur au seuil critique',
  },
  es: {
    title: 'Ajustes del Proyecto',
    subtitle: 'Configurar umbrales y límites operativos',
    energy: 'Energía',
    air: 'Aire',
    water: 'Agua',
    powerLimit: 'Potencia Contratada (kW)',
    powerLimitHint: 'Umbral físico contractual',
    powerPlaceholder: 'ej. 50',
    dailyBudgetEnergy: 'Presupuesto Diario (kWh)',
    dailyBudgetPlaceholder: 'ej. 500',
    anomalyDetection: 'Detección de Anomalías IA',
    anomalyTooltip: 'Compara el consumo actual con la línea base de los últimos 90 días para detectar comportamientos anómalos.',
    anomalyHint: 'Análisis estadístico sobre datos históricos',
    tempMin: 'Temp. Mín (°C)',
    tempMax: 'Temp. Máx (°C)',
    humidityMin: 'Humedad Mín (%)',
    humidityMax: 'Humedad Máx (%)',
    leakThreshold: 'Umbral de Fuga (L/h)',
    leakHint: 'Activa una alerta si el flujo supera este umbral de forma anómala',
    leakPlaceholder: 'ej. 5',
    dailyBudgetWater: 'Presupuesto Diario (L)',
    dailyBudgetWaterPlaceholder: 'ej. 1000',
    euiBenchmark: 'Referencia EUI (kWh/m²)',
    euiPlaceholder: 'ej. 150',
    areaM2: 'Superficie del Sitio (m²)',
    areaPlaceholder: 'ej. 1200',
    areaHint: 'Superficie total, usada para EUI y KPI de densidad',
    currency: 'Moneda del Sitio',
    currencyHint: 'Todos los valores económicos se almacenan en EUR y se convierten en tiempo real. Tasas actualizadas cada 24h.',
    energyPrice: 'Precio Bruto de la Energía',
    energyPriceHint: 'Tarifa bruta por kWh en la moneda seleccionada. Almacenada en EUR y reconvertida en tiempo real.',
    energyPricePlaceholder: 'ej. 0,25',
    cancel: 'Cancelar',
    save: 'Guardar',
    saveSuccess: 'Ajustes guardados con éxito',
    saveError: 'Error al guardar los ajustes',
    tempError: 'La temperatura mínima debe ser inferior a la máxima',
    co2Error: 'El umbral de advertencia debe ser inferior al umbral crítico',
    tvocError: 'El umbral de advertencia de TVOC debe ser inferior al crítico',
    hchoError: 'El umbral de advertencia de formaldehído debe ser inferior al crítico',
  },
  zh: {
    title: '项目设置',
    subtitle: '配置阈值和运行限制',
    energy: '能源',
    air: '空气',
    water: '水务',
    powerLimit: '合同功率 (kW)',
    powerLimitHint: '合同规定的物理阈值',
    powerPlaceholder: '例如 50',
    dailyBudgetEnergy: '日预算 (kWh)',
    dailyBudgetPlaceholder: '例如 500',
    anomalyDetection: 'AI 异常检测',
    anomalyTooltip: '与过去 90 天的基准能耗进行比较，检测异常行为。',
    anomalyHint: '基于历史数据的统计分析',
    tempMin: '最低温度 (°C)',
    tempMax: '最高温度 (°C)',
    humidityMin: '最低湿度 (%)',
    humidityMax: '最高湿度 (%)',
    leakThreshold: '泄漏阈值 (L/h)',
    leakHint: '如果流量异常超过此阈值，将触发警报',
    leakPlaceholder: '例如 5',
    dailyBudgetWater: '日预算 (L)',
    dailyBudgetWaterPlaceholder: '例如 1000',
    euiBenchmark: 'EUI 基准 (kWh/m²)',
    euiPlaceholder: '例如 150',
    areaM2: '场地面积 (m²)',
    areaPlaceholder: '例如 1200',
    areaHint: '总面积，用于 EUI 和密度 KPI',
    currency: '站点货币',
    currencyHint: '所有经济数值以欧元存储，按所选货币实时换算。汇率每24小时更新。',
    energyPrice: '能源毛价',
    energyPriceHint: '所选货币的每千瓦时毛价。以欧元存储，按实时汇率换算。',
    energyPricePlaceholder: '例如 0.25',
    cancel: '取消',
    save: '保存',
    saveSuccess: '设置保存成功',
    saveError: '保存设置时出错',
    tempError: '最低温度必须低于最高温度',
    co2Error: '警告阈值必须低于关键阈值',
    tvocError: 'TVOC 警告阈值必须低于关键阈值',
    hchoError: '甲醛警告阈值必须低于关键阈值',
  },
};

type ThresholdsForm = z.infer<ReturnType<typeof createSchema>>;

function createSchema(t: typeof i18n.en) {
  return z.object({
    energy_power_limit_kw: z.number().positive().nullable(),
    energy_daily_budget_kwh: z.number().positive().nullable(),
    energy_target_eui_kwh_m2: z.number().positive().nullable(),
    energy_anomaly_detection_enabled: z.boolean(),
    air_temp_min_c: z.number().min(-20).max(50).nullable(),
    air_temp_max_c: z.number().min(-20).max(50).nullable(),
    air_humidity_min_pct: z.number().min(0).max(100).nullable(),
    air_humidity_max_pct: z.number().min(0).max(100).nullable(),
    air_co2_warning_ppm: z.number().positive().max(5000).nullable(),
    air_co2_critical_ppm: z.number().positive().max(10000).nullable(),
    air_tvoc_warning_ugm3: z.number().positive().nullable(),
    air_tvoc_critical_ugm3: z.number().positive().nullable(),
    air_hcho_warning_ugm3: z.number().positive().nullable(),
    air_hcho_critical_ugm3: z.number().positive().nullable(),
    water_leak_threshold_lh: z.number().positive().nullable(),
    water_daily_budget_liters: z.number().positive().nullable(),
  }).refine((data) => {
    if (data.air_temp_min_c !== null && data.air_temp_max_c !== null) {
      return data.air_temp_min_c < data.air_temp_max_c;
    }
    return true;
  }, {
    message: t.tempError,
    path: ['air_temp_min_c'],
  }).refine((data) => {
    if (data.air_co2_warning_ppm !== null && data.air_co2_critical_ppm !== null) {
      return data.air_co2_warning_ppm < data.air_co2_critical_ppm;
    }
    return true;
  }, {
    message: t.co2Error,
    path: ['air_co2_warning_ppm'],
  }).refine((data) => {
    if (data.air_tvoc_warning_ugm3 !== null && data.air_tvoc_critical_ugm3 !== null) {
      return data.air_tvoc_warning_ugm3 < data.air_tvoc_critical_ugm3;
    }
    return true;
  }, {
    message: t.tvocError,
    path: ['air_tvoc_warning_ugm3'],
  }).refine((data) => {
    if (data.air_hcho_warning_ugm3 !== null && data.air_hcho_critical_ugm3 !== null) {
      return data.air_hcho_warning_ugm3 < data.air_hcho_critical_ugm3;
    }
    return true;
  }, {
    message: t.hchoError,
    path: ['air_hcho_warning_ugm3'],
  });
}

interface ProjectSettingsDialogProps {
  siteId: string | undefined;
  projectName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ProjectSettingsDialog({
  siteId,
  projectName,
  open,
  onOpenChange,
  trigger,
}: ProjectSettingsDialogProps) {
  const { language } = useLanguage();
  const t = (i18n as any)[language] || i18n.en;
  const { thresholds, isLoading, updateThresholds, isSaving } = useSiteThresholds(siteId);
  const queryClient = useQueryClient();
  const { rates, ratesLoaded } = useCurrency();

  // Site area (sites.area_m2)
  const { data: siteArea, isLoading: isAreaLoading } = useQuery({
    queryKey: ['site-area', siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const { data, error } = await supabase
        .from('sites')
        .select('area_m2')
        .eq('id', siteId)
        .maybeSingle();
      if (error) throw error;
      return (data?.area_m2 ?? null) as number | null;
    },
    enabled: !!siteId,
  });
  const [areaM2, setAreaM2] = useState<number | null>(null);
  useEffect(() => {
    setAreaM2(siteArea ?? null);
  }, [siteArea]);

  // Site currency (sites.currency)
  const { data: siteCurrency, isLoading: isCurrencyLoading } = useQuery({
    queryKey: ['site-currency', siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const { data, error } = await supabase
        .from('sites')
        .select('currency')
        .eq('id', siteId)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.currency ?? 'EUR') as string;
    },
    enabled: !!siteId,
  });
  const [currency, setCurrency] = useState<CurrencyCode>('EUR');
  useEffect(() => {
    setCurrency(isSupportedCurrency(siteCurrency) ? siteCurrency : 'EUR');
  }, [siteCurrency]);

  // Site energy price (sites.energy_price_kwh) - stored in EUR/kWh
  const { data: siteEnergyPriceEur, isLoading: isPriceLoading } = useQuery({
    queryKey: ['site-energy-price', siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const { data, error } = await supabase
        .from('sites')
        .select('energy_price_kwh')
        .eq('id', siteId)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.energy_price_kwh ?? null) as number | null;
    },
    enabled: !!siteId,
  });
  // Price shown in UI is in the currently selected currency
  const [priceDisplay, setPriceDisplay] = useState<number | null>(null);
  useEffect(() => {
    if (siteEnergyPriceEur == null) { setPriceDisplay(null); return; }
    if (currency === 'EUR') { setPriceDisplay(siteEnergyPriceEur); return; }
    const v = convertAmount(siteEnergyPriceEur, 'EUR', currency, rates);
    setPriceDisplay(v != null ? Number(v.toFixed(4)) : siteEnergyPriceEur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteEnergyPriceEur, currency, ratesLoaded]);

  const form = useForm<ThresholdsForm>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      energy_power_limit_kw: null,
      energy_daily_budget_kwh: null,
      energy_target_eui_kwh_m2: 200,
      energy_anomaly_detection_enabled: false,
      air_temp_min_c: 18,
      air_temp_max_c: 26,
      air_humidity_min_pct: 30,
      air_humidity_max_pct: 60,
      air_co2_warning_ppm: 1000,
      air_co2_critical_ppm: 1500,
      air_tvoc_warning_ugm3: 500,
      air_tvoc_critical_ugm3: 1000,
      air_hcho_warning_ugm3: 50,
      air_hcho_critical_ugm3: 100,
      water_leak_threshold_lh: null,
      water_daily_budget_liters: null,
    },
  });

  // Populate form when thresholds load
  useEffect(() => {
    if (thresholds) {
      form.reset({
        energy_power_limit_kw: thresholds.energy_power_limit_kw,
        energy_daily_budget_kwh: thresholds.energy_daily_budget_kwh,
        energy_target_eui_kwh_m2: thresholds.energy_target_eui_kwh_m2,
        energy_anomaly_detection_enabled: thresholds.energy_anomaly_detection_enabled ?? false,
        air_temp_min_c: thresholds.air_temp_min_c,
        air_temp_max_c: thresholds.air_temp_max_c,
        air_humidity_min_pct: thresholds.air_humidity_min_pct,
        air_humidity_max_pct: thresholds.air_humidity_max_pct,
        air_co2_warning_ppm: thresholds.air_co2_warning_ppm,
        air_co2_critical_ppm: thresholds.air_co2_critical_ppm,
        air_tvoc_warning_ugm3: thresholds.air_tvoc_warning_ugm3,
        air_tvoc_critical_ugm3: thresholds.air_tvoc_critical_ugm3,
        air_hcho_warning_ugm3: thresholds.air_hcho_warning_ugm3,
        air_hcho_critical_ugm3: thresholds.air_hcho_critical_ugm3,
        water_leak_threshold_lh: thresholds.water_leak_threshold_lh,
        water_daily_budget_liters: thresholds.water_daily_budget_liters,
      });
    }
  }, [thresholds, form]);

  const onSubmit = async (data: ThresholdsForm) => {
    try {
      await updateThresholds(data);
      if (siteId && areaM2 !== (siteArea ?? null)) {
        const { error: areaErr } = await supabase
          .from('sites')
          .update({ area_m2: areaM2 })
          .eq('id', siteId);
        if (areaErr) throw areaErr;
        queryClient.invalidateQueries({ queryKey: ['site-area', siteId] });
        queryClient.invalidateQueries({ queryKey: ['sites'] });
        queryClient.invalidateQueries({ queryKey: ['admin-sites'] });
      }
      if (siteId && currency !== (siteCurrency ?? 'EUR')) {
        const { error: curErr } = await supabase
          .from('sites')
          .update({ currency } as any)
          .eq('id', siteId);
        if (curErr) throw curErr;
        queryClient.invalidateQueries({ queryKey: ['site-currency', siteId] });
        queryClient.invalidateQueries({ queryKey: ['site-economic-settings', siteId] });
        queryClient.invalidateQueries({ queryKey: ['sites'] });
        queryClient.invalidateQueries({ queryKey: ['admin-sites'] });
      }
      // Save gross energy price (convert from selected currency back to EUR)
      {
        const desiredEur = priceDisplay == null
          ? null
          : (currency === 'EUR' ? priceDisplay : convertAmount(priceDisplay, currency, 'EUR', rates));
        const current = siteEnergyPriceEur ?? null;
        const changed = (desiredEur ?? null) !== (current ?? null);
        if (siteId && changed && desiredEur !== undefined) {
          const { error: pErr } = await supabase
            .from('sites')
            .update({ energy_price_kwh: desiredEur } as any)
            .eq('id', siteId);
          if (pErr) throw pErr;
          queryClient.invalidateQueries({ queryKey: ['site-energy-price', siteId] });
          queryClient.invalidateQueries({ queryKey: ['site-economic-settings', siteId] });
          queryClient.invalidateQueries({ queryKey: ['sites'] });
          queryClient.invalidateQueries({ queryKey: ['admin-sites'] });
        }
      }
      toast.success(t.saveSuccess);
      onOpenChange?.(false);
    } catch (error) {
      console.error('Failed to save thresholds:', error);
      toast.error(t.saveError);
    }
  };

  const parseNumber = (value: string): number | null => {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {projectName && <span className="font-medium">{projectName}</span>}
            {' '}— {t.subtitle}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="energy" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="energy" className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.energy}</span>
                </TabsTrigger>
                <TabsTrigger value="air" className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.air}</span>
                </TabsTrigger>
                <TabsTrigger value="water" className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.water}</span>
                </TabsTrigger>
              </TabsList>

              {/* Energy Tab */}
              <TabsContent value="energy" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="site_area_m2">{t.areaM2}</Label>
                  <Input
                    id="site_area_m2"
                    type="number"
                    step="1"
                    min="0"
                    placeholder={t.areaPlaceholder}
                    disabled={isAreaLoading}
                    value={areaM2 ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const n = v === '' ? null : parseFloat(v);
                      setAreaM2(n !== null && !isNaN(n) ? n : null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t.areaHint}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="site_currency">{t.currency}</Label>
                  <select
                    id="site_currency"
                    value={currency}
                    disabled={isCurrencyLoading}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol}  {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{t.currencyHint}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energy_power_limit_kw">
                    {t.powerLimit}
                  </Label>
                  <Input
                    id="energy_power_limit_kw"
                    type="number"
                    step="0.1"
                    placeholder={t.powerPlaceholder}
                    {...form.register('energy_power_limit_kw', { setValueAs: parseNumber })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.powerLimitHint}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energy_daily_budget_kwh">
                    {t.dailyBudgetEnergy}
                  </Label>
                  <Input
                    id="energy_daily_budget_kwh"
                    type="number"
                    step="1"
                    placeholder={t.dailyBudgetPlaceholder}
                    {...form.register('energy_daily_budget_kwh', { setValueAs: parseNumber })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energy_target_eui_kwh_m2">
                    {t.euiBenchmark}
                  </Label>
                  <Input
                    id="energy_target_eui_kwh_m2"
                    type="number"
                    step="1"
                    placeholder={t.euiPlaceholder}
                    {...form.register('energy_target_eui_kwh_m2', { setValueAs: parseNumber })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energy_price_kwh">
                    {t.energyPrice} ({getCurrencySymbol(currency)}/kWh)
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                      {getCurrencySymbol(currency)}
                    </span>
                    <Input
                      id="energy_price_kwh"
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder={t.energyPricePlaceholder}
                      disabled={isPriceLoading || (currency !== 'EUR' && !ratesLoaded)}
                      value={priceDisplay ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v === '' ? null : parseFloat(v);
                        setPriceDisplay(n !== null && !isNaN(n) ? n : null);
                      }}
                      className="pl-8"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                      /kWh
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.energyPriceHint}</p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="anomaly_detection">
                        {t.anomalyDetection}
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{t.anomalyTooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.anomalyHint}
                    </p>
                  </div>
                  <Switch
                    id="anomaly_detection"
                    checked={form.watch('energy_anomaly_detection_enabled')}
                    onCheckedChange={(checked) =>
                      form.setValue('energy_anomaly_detection_enabled', checked)
                    }
                  />
                </div>
              </TabsContent>

              {/* Air Tab */}
              <TabsContent value="air" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="air_temp_min_c">{t.tempMin}</Label>
                    <Input
                      id="air_temp_min_c"
                      type="number"
                      step="0.5"
                      placeholder="18"
                      {...form.register('air_temp_min_c', { setValueAs: parseNumber })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="air_temp_max_c">{t.tempMax}</Label>
                    <Input
                      id="air_temp_max_c"
                      type="number"
                      step="0.5"
                      placeholder="26"
                      {...form.register('air_temp_max_c', { setValueAs: parseNumber })}
                    />
                  </div>
                </div>
                {form.formState.errors.air_temp_min_c && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.air_temp_min_c.message}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="air_humidity_min_pct">{t.humidityMin}</Label>
                    <Input
                      id="air_humidity_min_pct"
                      type="number"
                      step="1"
                      placeholder="30"
                      {...form.register('air_humidity_min_pct', { setValueAs: parseNumber })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="air_humidity_max_pct">{t.humidityMax}</Label>
                    <Input
                      id="air_humidity_max_pct"
                      type="number"
                      step="1"
                      placeholder="60"
                      {...form.register('air_humidity_max_pct', { setValueAs: parseNumber })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="air_co2_warning_ppm">CO₂ Warning (ppm)</Label>
                    <Input
                      id="air_co2_warning_ppm"
                      type="number"
                      step="50"
                      placeholder="1000"
                      {...form.register('air_co2_warning_ppm', { setValueAs: parseNumber })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="air_co2_critical_ppm">CO₂ Critical (ppm)</Label>
                    <Input
                      id="air_co2_critical_ppm"
                      type="number"
                      step="50"
                      placeholder="1500"
                      {...form.register('air_co2_critical_ppm', { setValueAs: parseNumber })}
                    />
                  </div>
                </div>
                {form.formState.errors.air_co2_warning_ppm && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.air_co2_warning_ppm.message}
                  </p>
                )}

                {/* Modulo TVOC */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="air_tvoc_warning_ugm3">TVOC Warning (µg/m³)</Label>
                    <Input
                      id="air_tvoc_warning_ugm3"
                      type="number"
                      step="10"
                      placeholder="500"
                      {...form.register('air_tvoc_warning_ugm3', { setValueAs: parseNumber })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="air_tvoc_critical_ugm3">TVOC Critical (µg/m³)</Label>
                    <Input
                      id="air_tvoc_critical_ugm3"
                      type="number"
                      step="10"
                      placeholder="1000"
                      {...form.register('air_tvoc_critical_ugm3', { setValueAs: parseNumber })}
                    />
                  </div>
                </div>
                {form.formState.errors.air_tvoc_warning_ugm3 && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.air_tvoc_warning_ugm3.message}
                  </p>
                )}

                {/* Modulo Formaldeide */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="air_hcho_warning_ugm3">HCHO Warning (µg/m³)</Label>
                    <Input
                      id="air_hcho_warning_ugm3"
                      type="number"
                      step="5"
                      placeholder="50"
                      {...form.register('air_hcho_warning_ugm3', { setValueAs: parseNumber })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="air_hcho_critical_ugm3">HCHO Critical (µg/m³)</Label>
                    <Input
                      id="air_hcho_critical_ugm3"
                      type="number"
                      step="5"
                      placeholder="100"
                      {...form.register('air_hcho_critical_ugm3', { setValueAs: parseNumber })}
                    />
                  </div>
                </div>
                {form.formState.errors.air_hcho_warning_ugm3 && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.air_hcho_warning_ugm3.message}
                  </p>
                )}
              </TabsContent>

              {/* Water Tab */}
              <TabsContent value="water" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="water_leak_threshold_lh">
                    {t.leakThreshold}
                  </Label>
                  <Input
                    id="water_leak_threshold_lh"
                    type="number"
                    step="0.1"
                    placeholder={t.leakPlaceholder}
                    {...form.register('water_leak_threshold_lh', { setValueAs: parseNumber })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.leakHint}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="water_daily_budget_liters">
                    {t.dailyBudgetWater}
                  </Label>
                  <Input
                    id="water_daily_budget_liters"
                    type="number"
                    step="10"
                    placeholder={t.dailyBudgetWaterPlaceholder}
                    {...form.register('water_daily_budget_liters', { setValueAs: parseNumber })}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange?.(false)}
              >
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t.save}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
