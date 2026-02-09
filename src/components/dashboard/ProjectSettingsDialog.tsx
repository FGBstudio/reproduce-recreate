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

const thresholdsSchema = z.object({
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
  message: 'La temperatura minima deve essere inferiore alla massima',
  path: ['air_temp_min_c'],
}).refine((data) => {
  if (data.air_co2_warning_ppm !== null && data.air_co2_critical_ppm !== null) {
    return data.air_co2_warning_ppm < data.air_co2_critical_ppm;
  }
  return true;
}, {
  message: 'La soglia warning deve essere inferiore alla soglia critical',
  path: ['air_co2_warning_ppm'],
});

type ThresholdsForm = z.infer<typeof thresholdsSchema>;

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
  const { thresholds, isLoading, updateThresholds, isSaving } = useSiteThresholds(siteId);

  const form = useForm<ThresholdsForm>({
    resolver: zodResolver(thresholdsSchema),
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
      toast.success('Impostazioni salvate con successo');
      onOpenChange?.(false);
    } catch (error) {
      console.error('Failed to save thresholds:', error);
      toast.error('Errore durante il salvataggio');
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
            Impostazioni Progetto
          </DialogTitle>
          <DialogDescription>
            {projectName && <span className="font-medium">{projectName}</span>}
            {' '}— Configura soglie e limiti operativi
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
                  <span className="hidden sm:inline">Energia</span>
                </TabsTrigger>
                <TabsTrigger value="air" className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4" />
                  <span className="hidden sm:inline">Aria</span>
                </TabsTrigger>
                <TabsTrigger value="water" className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4" />
                  <span className="hidden sm:inline">Acqua</span>
                </TabsTrigger>
              </TabsList>

              {/* Energy Tab */}
              <TabsContent value="energy" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="energy_power_limit_kw">
                    Potenza Impegnata (kW)
                  </Label>
                  <Input
                    id="energy_power_limit_kw"
                    type="number"
                    step="0.1"
                    placeholder="es. 50"
                    {...form.register('energy_power_limit_kw', { setValueAs: parseNumber })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Soglia fisica contrattuale
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="energy_daily_budget_kwh">
                    Budget Giornaliero (kWh)
                  </Label>
                  <Input
                    id="energy_daily_budget_kwh"
                    type="number"
                    step="1"
                    placeholder="es. 500"
                    {...form.register('energy_daily_budget_kwh', { setValueAs: parseNumber })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="anomaly_detection">
                        Rilevamento Anomalie AI
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>
                              Confronta i consumi attuali con la baseline degli ultimi 90 giorni
                              per rilevare comportamenti anomali (analisi Z-score).
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Analisi statistica su base storica
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
                    <Label htmlFor="air_temp_min_c">Temp. Min (°C)</Label>
                    <Input
                      id="air_temp_min_c"
                      type="number"
                      step="0.5"
                      placeholder="18"
                      {...form.register('air_temp_min_c', { setValueAs: parseNumber })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="air_temp_max_c">Temp. Max (°C)</Label>
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
                    <Label htmlFor="air_humidity_min_pct">Umidità Min (%)</Label>
                    <Input
                      id="air_humidity_min_pct"
                      type="number"
                      step="1"
                      placeholder="30"
                      {...form.register('air_humidity_min_pct', { setValueAs: parseNumber })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="air_humidity_max_pct">Umidità Max (%)</Label>
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
                    Soglia Perdita (L/h)
                  </Label>
                  <Input
                    id="water_leak_threshold_lh"
                    type="number"
                    step="0.1"
                    placeholder="es. 5"
                    {...form.register('water_leak_threshold_lh', { setValueAs: parseNumber })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Genera un alert se il flusso supera questa soglia in modo anomalo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="water_daily_budget_liters">
                    Budget Giornaliero (L)
                  </Label>
                  <Input
                    id="water_daily_budget_liters"
                    type="number"
                    step="10"
                    placeholder="es. 1000"
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
                Annulla
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salva
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
