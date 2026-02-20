import { useEffect } from "react";
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
    cancel: 'Cancel',
    save: 'Save',
    saveSuccess: 'Settings saved successfully',
    saveError: 'Error saving settings',
    tempError: 'Minimum temperature must be lower than maximum',
    co2Error: 'Warning threshold must be lower than critical threshold',
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
    cancel: 'Annulla',
    save: 'Salva',
    saveSuccess: 'Impostazioni salvate con successo',
    saveError: 'Errore durante il salvataggio',
    tempError: 'La temperatura minima deve essere inferiore alla massima',
    co2Error: 'La soglia warning deve essere inferiore alla soglia critical',
  },
};

type ThresholdsForm = z.infer<ReturnType<typeof createSchema>>;

function createSchema(t: typeof i18n.en) {
  return z.object({
    energy_power_limit_kw: z.number().positive().nullable(),
    energy_daily_budget_kwh: z.number().positive().nullable(),
    energy_anomaly_detection_enabled: z.boolean(),
    air_temp_min_c: z.number().min(-20).max(50).nullable(),
    air_temp_max_c: z.number().min(-20).max(50).nullable(),
    air_humidity_min_pct: z.number().min(0).max(100).nullable(),
    air_humidity_max_pct: z.number().min(0).max(100).nullable(),
    air_co2_warning_ppm: z.number().positive().max(5000).nullable(),
    air_co2_critical_ppm: z.number().positive().max(10000).nullable(),
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
  const t = i18n[language];
  const { thresholds, isLoading, updateThresholds, isSaving } = useSiteThresholds(siteId);

  const form = useForm<ThresholdsForm>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
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
    },
  });

  // Populate form when thresholds load
  useEffect(() => {
    if (thresholds) {
      form.reset({
        energy_power_limit_kw: thresholds.energy_power_limit_kw,
        energy_daily_budget_kwh: thresholds.energy_daily_budget_kwh,
        energy_anomaly_detection_enabled: thresholds.energy_anomaly_detection_enabled ?? false,
        air_temp_min_c: thresholds.air_temp_min_c,
        air_temp_max_c: thresholds.air_temp_max_c,
        air_humidity_min_pct: thresholds.air_humidity_min_pct,
        air_humidity_max_pct: thresholds.air_humidity_max_pct,
        air_co2_warning_ppm: thresholds.air_co2_warning_ppm,
        air_co2_critical_ppm: thresholds.air_co2_critical_ppm,
        water_leak_threshold_lh: thresholds.water_leak_threshold_lh,
        water_daily_budget_liters: thresholds.water_daily_budget_liters,
      });
    }
  }, [thresholds, form]);

  const onSubmit = async (data: ThresholdsForm) => {
    try {
      await updateThresholds(data);
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
