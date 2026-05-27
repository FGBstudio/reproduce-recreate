import { useMemo, useState } from "react";
import { Project } from "@/lib/data";
import { Zap, Wind, Droplet, Activity, TrendingUp, TrendingDown, Thermometer, Gauge, Fan, Lightbulb, Plug, MoreHorizontal, AlertTriangle, ArrowUpRight, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealTimeLatestData } from "@/hooks/useRealTimeTelemetry";
import { DataSourceBadge } from "./DataSourceBadge";
import { useThresholdAlerts, getMetricStatus, type ThresholdAlert } from "@/hooks/useThresholdAlerts";
import { useSiteThresholds } from "@/hooks/useSiteThresholds";
import { EVSWidget } from "./EVSWidget";
import { useEnergyPowerByCategory } from "@/hooks/useEnergyPowerByCategory";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveTimezone, getPartsInTz } from "@/lib/timezoneUtils";

type StatusLevel = "GOOD" | "OK" | "WARNING" | "CRITICAL";

interface ModuleStatus {
  score: number;
  level: StatusLevel;
  isLive: boolean;
  lastUpdate?: string;
}

interface OverviewSectionProps {
  project: Project;
  moduleConfig: {
    energy: { enabled: boolean };
    air: { enabled: boolean };
    water: { enabled: boolean };
  };
  timePeriod: string;
  dateRange?: { from: Date; to: Date };
  airAverages?: Record<string, number>;
  energyAverages?: any;
  onNavigate?: (tab: string) => void;
  benchmarkMatrix?: any[];
}

const getStatusLevel = (score: number): StatusLevel => {
  if (score >= 80) return "GOOD";
  if (score >= 60) return "OK";
  if (score >= 40) return "WARNING";
  return "CRITICAL";
};

const getStatusColor = (level: StatusLevel) => {
  switch (level) {
    case "GOOD": return "text-emerald-500";
    case "OK": return "text-blue-500";
    case "WARNING": return "text-amber-500";
    case "CRITICAL": return "text-red-500";
  }
};

const getStatusBorderColor = (level: StatusLevel) => {
  switch (level) {
    case "GOOD": return "border-emerald-500/40";
    case "OK": return "border-blue-500/40";
    case "WARNING": return "border-amber-500/40";
    case "CRITICAL": return "border-red-500/40";
  }
};

const getStatusIconBg = (level: StatusLevel) => {
  switch (level) {
    case "GOOD": return "bg-emerald-100";
    case "OK": return "bg-blue-100";
    case "WARNING": return "bg-amber-100";
    case "CRITICAL": return "bg-red-100";
  }
};

const getLiveBadgeColor = (isLive: boolean) => {
  return isLive ? "bg-emerald-500 text-white" : "bg-gray-400 text-white";
};

const formatMaybe = (value: number | undefined, digits = 1) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";

const formatMaybeInt = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "—";

const MODULE_WEIGHTS = {
  energy: 0.80,
  air: 0.05,
  water: 0.15,
};

// ==========================================
// OVERALL CARD
// ==========================================
const OverallCard = ({ status, moduleConfig, energyScore, airScore, waterScore, isRealData, alertStatus, liveData, timePeriod, periodLabel, onActivateModule }: any) => {
  const { t } = useLanguage();
  return (
    <Card className={`bg-white border ${getStatusBorderColor(status.level)} shadow-lg transition-all hover:shadow-xl col-span-full`}>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full ${getStatusIconBg(status.level)} flex items-center justify-center ${getStatusColor(status.level)}`}>
              <Activity className="w-7 h-7 md:w-8 md:h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${getLiveBadgeColor(status.isLive)} text-[10px] uppercase tracking-wider`}>
                  {status.isLive ? "LIVE" : "Offline"}
                </Badge>
                <DataSourceBadge isRealData={isRealData} size="sm" />
              </div>
              <div className={`text-3xl md:text-4xl font-bold ${getStatusColor(status.level)}`}>
                {status.level}
              </div>
              <div className="text-base text-gray-500 font-medium uppercase tracking-wide">
                {t('overview.overall_performance')}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            <div className="text-center">
              <div className={`text-3xl md:text-4xl font-bold ${getStatusColor(status.level)}`}>{status.score}</div>
              <div className="text-base text-gray-500">{t('overview.score')}</div>
            </div>
            <div className="hidden md:block h-12 w-px bg-gray-200" />
            <EVSWidget
              modules={{
                energy: { enabled: moduleConfig.energy.enabled, hasLiveData: liveData.isRealData && liveData.metrics['energy.power_kw'] != null },
                air: { enabled: moduleConfig.air.enabled, hasLiveData: liveData.isRealData && liveData.metrics['iaq.co2'] != null },
                water: { enabled: moduleConfig.water.enabled, hasLiveData: liveData.isRealData && liveData.metrics['water.flow_rate'] != null },
              }}
              onActivateModule={onActivateModule}
            />
            <div className="hidden md:block h-12 w-px bg-gray-200" />
            <div className="flex gap-4">
              {moduleConfig.energy.enabled && (
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-1"><Zap className="w-5 h-5 text-amber-600" /></div>
                  <div className="text-lg font-semibold text-gray-800">{energyScore}</div>
                  <div className="text-[9px] text-gray-400">{Math.round(MODULE_WEIGHTS.energy * 100)}%</div>
                </div>
              )}
              {moduleConfig.air.enabled && (
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1"><Wind className="w-5 h-5 text-blue-600" /></div>
                  <div className="text-lg font-semibold text-gray-800">{airScore}</div>
                  <div className="text-[9px] text-gray-400">{Math.round(MODULE_WEIGHTS.air * 100)}%</div>
                </div>
              )}
              {moduleConfig.water.enabled && (
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center mx-auto mb-1"><Droplet className="w-5 h-5 text-cyan-600" /></div>
                  <div className="text-lg font-semibold text-gray-800">{waterScore}</div>
                  <div className="text-[9px] text-gray-400">{Math.round(MODULE_WEIGHTS.water * 100)}%</div>
                </div>
              )}
            </div>
            <div className="hidden md:block h-12 w-px bg-gray-200" />
            {alertStatus.hasAlerts ? (
              <div className="text-center bg-red-50 rounded-xl px-4 py-2">
                <div className="flex items-center gap-1 justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-4xl md:text-3xl font-bold text-red-600">{alertStatus.criticalCount + alertStatus.warningCount}</span>
                </div>
                <div className="text-[10px] text-red-700 font-medium uppercase tracking-wide">
                  {alertStatus.criticalCount > 0 ? `${alertStatus.criticalCount} critical` : ''}{alertStatus.criticalCount > 0 && alertStatus.warningCount > 0 ? ' + ' : ''}{alertStatus.warningCount > 0 ? `${alertStatus.warningCount} warning` : ''}
                </div>
              </div>
            ) : (
              <div className="text-center bg-emerald-50 rounded-xl px-4 py-2">
                <div className="text-4xl md:text-3xl font-bold text-emerald-600">0</div>
                <div className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">{t('overview.active_alerts')}</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ==========================================
// FLIPPABLE EXECUTIVE CARDS
// ==========================================
const easeCurve = "cubic-bezier(0.25, 1, 0.5, 1)";

// --- ENERGY CARD ---
const EnergyCard = ({ status, enabled, onClick, powerData, averageData, threshold, periodLabel, project, benchmarkMatrix, isFlipped, onToggleFlip }: any) => {
  const { t } = useLanguage();
  
  const readings = useMemo(() => {
    if (!powerData?.isRealData && !powerData?.isStale) {
      return { totalPower: undefined, hvac: { value: undefined }, lighting: { value: undefined }, plugs: { value: undefined }, other: { value: undefined } };
    }
    const totalGeneral = powerData.totalGeneral;
    const hasOnlyGeneral = typeof totalGeneral === 'number' && powerData.hvac === undefined && powerData.lighting === undefined && powerData.plugs === undefined;
    
    if (hasOnlyGeneral) {
      let pct = { hvac_pct: 0.40, lighting_pct: 0.25, plugs_pct: 0.20, other_pct: 0.15 };
      if (benchmarkMatrix && benchmarkMatrix.length > 0 && powerData.lastUpdate) {
        try {
          const siteTz = resolveTimezone(project?.timezone);
          const dateObj = new Date(powerData.lastUpdate);
          if (!isNaN(dateObj.getTime())) {
            const p = getPartsInTz(dateObj, siteTz);
            const isWeekend = p.weekday === 'Sat' || p.weekday === 'Sun';
            const found = benchmarkMatrix.find(row => Number(row.month_num) === p.month && Number(row.hour_num) === p.hour && row.day_type === (isWeekend ? 'weekend' : 'weekday'));
            if (found) {
              pct = { hvac_pct: Number(found.hvac_pct), lighting_pct: Number(found.lighting_pct), plugs_pct: Number(found.plugs_pct), other_pct: Number(found.other_pct) };
            }
          }
        } catch (e) { console.error(e); }
      }
      return {
        totalPower: totalGeneral,
        hvac: { value: totalGeneral * pct.hvac_pct, isSimulated: true },
        lighting: { value: totalGeneral * pct.lighting_pct, isSimulated: true },
        plugs: { value: totalGeneral * pct.plugs_pct, isSimulated: true },
        other: { value: totalGeneral * pct.other_pct, isSimulated: true }
      };
    }
    return {
      totalPower: totalGeneral,
      hvac: { value: powerData.hvac, isSimulated: powerData.isSimulated || false },
      lighting: { value: powerData.lighting, isSimulated: powerData.isSimulated || false },
      plugs: { value: powerData.plugs, isSimulated: powerData.isSimulated || false },
      other: { value: powerData.other, isSimulated: powerData.isSimulated || false },
    };
  }, [powerData, project, benchmarkMatrix]);

  if (!enabled) return (
    <div className="w-full h-[320px] rounded-xl border bg-gray-100 flex flex-col p-6 text-gray-400">
      <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center"><Zap className="w-5 h-5" /></div><Badge className="bg-gray-400 text-white text-[10px]">DISABLED</Badge></div>
      <div className="text-4xl font-bold mb-1">N/A</div>
      <div className="text-base uppercase tracking-wide">Energy Performance</div>
    </div>
  );

  const isStale = powerData?.isStale ?? false;
  const currentPower = readings.totalPower;
  const isCriticalVal = threshold && currentPower != null && currentPower > threshold;
  
  // LOGICA MIGLIORATA: Calcolo Delta SEMPRE attivo, anche per la media giornaliera di "Oggi"
  const avgPower = averageData?.totalGeneral;
  const showAvg = avgPower != null && currentPower != null;
  const powerDelta = showAvg ? ((currentPower - avgPower) / avgPower) * 100 : 0;
  const isPowerHigher = powerDelta > 0;

  return (
    <div className="relative w-full h-[320px]" style={{ perspective: "1500px" }}>
      <div
        className="w-full h-full cursor-pointer transition-transform duration-[800ms] shadow-sm hover:shadow-lg rounded-xl"
        style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)", transitionTimingFunction: easeCurve }}
        onClick={onClick}
      >
        {/* FRONTE */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-white ${isStale ? 'border-amber-500/40' : getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden" }}>
          <div className="flex items-center justify-between mb-auto">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full ${isStale ? 'bg-amber-100 text-amber-500' : `${getStatusIconBg(status.level)} ${getStatusColor(status.level)}`} flex items-center justify-center`}>
                <Zap className="w-5 h-5" />
              </div>
              <Badge className={`${isStale ? 'bg-amber-500 text-white' : getLiveBadgeColor(status.isLive)} text-[10px] uppercase tracking-wider`}>
                {isStale ? 'STALE' : 'LIVE'}
              </Badge>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isStale ? 'text-amber-500' : getStatusColor(status.level)}`}>{isStale ? 'WARNING' : status.level}</div>
              <div className="text-[10px] text-gray-500 uppercase">Score {status.score}</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-1">{t('overview.energy_performance')}</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-5xl font-black tracking-tighter ${isCriticalVal ? 'text-red-500' : 'text-gray-900'}`}>{formatMaybe(currentPower, 1)}</span>
              <span className="text-sm font-bold text-gray-500">kW</span>
            </div>
            
            {/* Contesto Dinamico SEMPRE ATTIVO (Live vs Media Periodo Selezionato) */}
            {showAvg ? (
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="text-gray-500 font-medium">Avg {periodLabel}: <span className="font-bold text-gray-700">{formatMaybe(avgPower, 1)} kW</span></span>
                <span className={`flex items-center font-bold px-1.5 py-0.5 rounded-full ${isPowerHigher ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {isPowerHigher ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {Math.abs(powerDelta).toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="text-xs font-medium text-gray-500 mb-1">Analisi media in corso...</div>
            )}

            {threshold && (
               <div className="text-xs font-medium text-gray-500 mt-1 pt-1 border-t border-gray-100">
                  {t('overview.limit')}: <span className="font-bold text-gray-700">{threshold.toFixed(1)} kW</span>
               </div>
            )}
          </div>

          <div className="mt-auto pt-4 flex justify-between items-end">
            {isStale ? (
              <div className="bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md px-2 py-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t('overview.stale_data')}</div>
            ) : <div/>}
            <button 
              onClick={onToggleFlip}
              className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center border transition-colors shadow-sm"
            >
              <RotateCcw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* RETRO */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-gray-50 ${getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
            <span className="text-sm font-bold tracking-tight text-gray-900 uppercase">Live Load Distribution</span>
            <ArrowUpRight className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-3 text-sm flex-1">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600"><Fan className="w-4 h-4"/>HVAC</div><span className="font-bold text-gray-800">{formatMaybe(readings.hvac.value, 1)} kW</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600"><Lightbulb className="w-4 h-4"/>Lighting</div><span className="font-bold text-gray-800">{formatMaybe(readings.lighting.value, 1)} kW</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600"><Plug className="w-4 h-4"/>Plugs & Loads</div><span className="font-bold text-gray-800">{formatMaybe(readings.plugs.value, 1)} kW</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600"><MoreHorizontal className="w-4 h-4"/>Other</div><span className="font-bold text-gray-800">{formatMaybe(readings.other.value, 1)} kW</span></div>
          </div>

          <div className="mt-auto pt-4 flex justify-between items-center">
             {(readings.hvac.isSimulated) && <span className="text-[10px] text-gray-400 italic">Virtual Submeters</span>}
            <button onClick={onToggleFlip} className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 text-xs font-bold text-gray-600 border transition-colors shadow-sm ml-auto">
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- AIR CARD ---
const AirCard = ({ status, enabled, onClick, liveData, averageMetrics, periodLabel, isFlipped, onToggleFlip }: any) => {
  const { t } = useLanguage();
  
  const readings = useMemo(() => {
    const m = !!liveData?.isRealData ? liveData!.metrics : {};
    return {
      co2: { value: m['iaq.co2'] ?? m['co2'], unit: "ppm" },
      tvoc: { value: m['iaq.voc'] ?? m['tvoc'], unit: "ppb" },
      pm25: { value: m['iaq.pm25'] ?? m['pm25'], unit: "µg/m³" },
      pm10: { value: m['iaq.pm10'] ?? m['pm10'], unit: "µg/m³" },
      temp: { value: m['env.temperature'] ?? m['temperature'], unit: "°C" },
      humidity: { value: m['env.humidity'] ?? m['humidity'], unit: "%" },
    };
  }, [liveData]);

  if (!enabled) return (
    <div className="w-full h-[320px] rounded-xl border bg-gray-100 flex flex-col p-6 text-gray-400">
      <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center"><Wind className="w-5 h-5" /></div><Badge className="bg-gray-400 text-white text-[10px]">DISABLED</Badge></div>
      <div className="text-4xl font-bold mb-1">N/A</div>
      <div className="text-base uppercase tracking-wide">Indoor Air Quality</div>
    </div>
  );

  const currentCo2 = readings.co2.value;
  const avgCo2 = averageMetrics?.['iaq.co2'] ?? averageMetrics?.['co2'];
  const showAvgCo2 = avgCo2 != null && currentCo2 != null;
  const co2Delta = showAvgCo2 ? ((currentCo2 - avgCo2) / avgCo2) * 100 : 0;
  const isCo2Higher = co2Delta > 0;

  return (
    <div className="relative w-full h-[320px]" style={{ perspective: "1500px" }}>
      <div
        className="w-full h-full cursor-pointer transition-transform duration-[800ms] shadow-sm hover:shadow-lg rounded-xl"
        style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)", transitionTimingFunction: easeCurve }}
        onClick={onClick}
      >
        {/* FRONTE */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-white ${getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden" }}>
          <div className="flex items-center justify-between mb-auto">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full ${getStatusIconBg(status.level)} flex items-center justify-center ${getStatusColor(status.level)}`}><Wind className="w-5 h-5" /></div>
              <Badge className={`${getLiveBadgeColor(status.isLive)} text-[10px] uppercase tracking-wider`}>LIVE</Badge>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${getStatusColor(status.level)}`}>{status.level}</div>
              <div className="text-[10px] text-gray-500 uppercase">Score {status.score}</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-1">{t('overview.indoor_air_quality')}</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black tracking-tighter text-gray-900">{formatMaybe(currentCo2, 0)}</span>
              <span className="text-sm font-bold text-gray-500">ppm</span>
            </div>

            {/* Contesto Dinamico Aria */}
            {showAvgCo2 ? (
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="text-gray-500 font-medium">Avg {periodLabel}: <span className="font-bold text-gray-700">{formatMaybe(avgCo2, 0)} ppm</span></span>
                <span className={`flex items-center font-bold px-1.5 py-0.5 rounded-full ${isCo2Higher ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {isCo2Higher ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {Math.abs(co2Delta).toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="text-xs font-medium text-gray-500 mb-1">Analisi media in corso...</div>
            )}

            <div className="text-xs font-medium text-gray-500 mt-1 pt-1 border-t border-gray-100">
              Main Proxy: <span className="font-bold text-gray-700">Carbon Dioxide (CO₂)</span>
            </div>
          </div>

          <div className="mt-auto pt-4 flex justify-end">
            <button onClick={onToggleFlip} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center border transition-colors shadow-sm"><RotateCcw className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>

        {/* RETRO */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-gray-50 ${getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
            <span className="text-sm font-bold tracking-tight text-gray-900 uppercase">Live Gas Diagnostics</span>
            <ArrowUpRight className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm flex-1">
            <div className="flex flex-col"><span className="text-[10px] uppercase text-gray-500">TVOC</span><span className="font-bold text-gray-800">{formatMaybe(readings.tvoc.value, 0)} ppb</span></div>
            <div className="flex flex-col"><span className="text-[10px] uppercase text-gray-500">PM2.5</span><span className="font-bold text-gray-800">{formatMaybe(readings.pm25.value, 1)} µg/m³</span></div>
            <div className="flex flex-col"><span className="text-[10px] uppercase text-gray-500">PM10</span><span className="font-bold text-gray-800">{formatMaybe(readings.pm10.value, 1)} µg/m³</span></div>
            <div className="flex flex-col"><span className="text-[10px] uppercase text-gray-500">Temp</span><span className="font-bold text-gray-800">{formatMaybe(readings.temp.value, 1)} °C</span></div>
            <div className="flex flex-col col-span-2"><span className="text-[10px] uppercase text-gray-500">Humidity</span><span className="font-bold text-gray-800">{formatMaybe(readings.humidity.value, 0)} %</span></div>
          </div>

          <div className="mt-auto pt-2 flex justify-end">
            <button onClick={onToggleFlip} className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 text-xs font-bold text-gray-600 border transition-colors shadow-sm">Close Details</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- WATER CARD ---
const WaterCard = ({ status, enabled, onClick, liveData, isFlipped, onToggleFlip }: any) => {
  const { t } = useLanguage();
  const readings = useMemo(() => {
    const isReal = !!liveData?.isRealData;
    const m = isReal ? liveData!.metrics : {};
    const totalLiters = isReal ? m['water.total_liters'] : undefined;
    const flowRate = isReal ? m['water.flow_rate'] : undefined;
    return {
      dailyConsumption: typeof totalLiters === 'number' ? Math.round(totalLiters) : undefined,
      vsBaseline: undefined as number | undefined,
      activeLeaks: typeof flowRate === 'number' && flowRate > 0.5 && flowRate < 1 ? 1 : (typeof flowRate === 'number' ? 0 : undefined),
      efficiency: undefined as number | undefined,
    };
  }, [liveData]);

  if (!enabled) return (
    <div className="w-full h-[320px] rounded-xl border bg-gray-100 flex flex-col p-6 text-gray-400">
      <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center"><Droplet className="w-5 h-5" /></div><Badge className="bg-gray-400 text-white text-[10px]">DISABLED</Badge></div>
      <div className="text-4xl font-bold mb-1">N/A</div>
      <div className="text-base uppercase tracking-wide">Water Consumption</div>
    </div>
  );

  return (
    <div className="relative w-full h-[320px]" style={{ perspective: "1500px" }}>
      <div
        className="w-full h-full cursor-pointer transition-transform duration-[800ms] shadow-sm hover:shadow-lg rounded-xl"
        style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)", transitionTimingFunction: easeCurve }}
        onClick={onClick}
      >
        {/* FRONTE */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-white ${getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden" }}>
          <div className="flex items-center justify-between mb-auto">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full ${getStatusIconBg(status.level)} flex items-center justify-center ${getStatusColor(status.level)}`}><Droplet className="w-5 h-5" /></div>
              <Badge className={`${getLiveBadgeColor(status.isLive)} text-[10px] uppercase tracking-wider`}>LIVE</Badge>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${getStatusColor(status.level)}`}>{status.level}</div>
              <div className="text-[10px] text-gray-500 uppercase">Score {status.score}</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-1">{t('overview.water_consumption_title')}</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black tracking-tighter text-gray-900">{formatMaybeInt(readings.dailyConsumption)}</span>
              <span className="text-sm font-bold text-gray-500">L/day</span>
            </div>
            <div className="text-xs font-medium text-emerald-600 flex items-center gap-1"><TrendingDown className="w-3 h-3"/> Dato istantaneo LIVE</div>
          </div>

          <div className="mt-auto pt-4 flex justify-end">
            <button onClick={onToggleFlip} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center border transition-colors shadow-sm"><RotateCcw className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>

        {/* RETRO */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-gray-50 ${getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
            <span className="text-sm font-bold tracking-tight text-gray-900 uppercase">Hydric Diagnostics</span>
            <ArrowUpRight className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4 text-sm flex-1">
            <div className="flex flex-col"><span className="text-xs text-gray-500">{t('overview.efficiency')}</span><span className="text-xl font-bold text-emerald-600">98.2 %</span></div>
            <div className="flex flex-col"><span className="text-xs text-gray-500">{t('overview.active_leaks')}</span><span className={`text-xl font-black tracking-tight ${readings.activeLeaks ? "text-red-500" : "text-emerald-500"}`}>{readings.activeLeaks ? `${readings.activeLeaks} DETECTED` : "NONE"}</span></div>
          </div>

          <div className="mt-auto pt-2 flex justify-end">
            <button onClick={onToggleFlip} className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 text-xs font-bold text-gray-600 border transition-colors shadow-sm">Close Details</button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// MAIN COMPONENT EXPORT
// ==========================================
export const OverviewSection = ({ project, moduleConfig, timePeriod, dateRange, airAverages, energyAverages, onNavigate, benchmarkMatrix }: OverviewSectionProps) => {
  const { t, language } = useLanguage();
  
  // DATI LIVE SEMPRE PRESENTI
  const liveData = useRealTimeLatestData(project.siteId);
  const powerLatest = useEnergyPowerByCategory(project.siteId);

  const [flippedCards, setFlippedCards] = useState({ energy: false, air: false, water: false });
  const toggleFlip = (card: 'energy'|'air'|'water', e: React.MouseEvent) => {
    e.stopPropagation();
    setFlippedCards(prev => ({ ...prev, [card]: !prev[card] }));
  };

  const periodLabel = useMemo(() => {
    const labels: Record<string, string> = { today: language === 'it' ? 'Oggi' : 'Today', week: language === 'it' ? 'Settimana' : 'Week', month: language === 'it' ? 'Mese' : 'Month', year: language === 'it' ? 'Anno' : 'Year' };
    if (labels[timePeriod]) return labels[timePeriod];
    if (timePeriod === 'custom' && dateRange) return `${dateRange.from.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: '2-digit' })} - ${dateRange.to.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: '2-digit' })}`;
    return timePeriod;
  }, [timePeriod, dateRange, language]);

  const { thresholds } = useSiteThresholds(project.siteId);
  
  // Gli score e gli status si basano SEMPRE sui dati live
  const isAnythingStale = powerLatest.isStale || liveData.isStale;
  const alertStatus = useThresholdAlerts(project.siteId, liveData.metrics, { isStale: isAnythingStale, staleMessage: t('overview.stale_data') });

  const energyStatus = useMemo<ModuleStatus>(() => {
    const powerKw = powerLatest.totalGeneral;
    if (typeof powerKw !== 'number' || !powerLatest.isRealData) return { score: 0, level: getStatusLevel(0), isLive: false };
    const efficiency = Math.min(100, Math.max(0, 100 - (powerKw / 100) * 20));
    return { score: Math.round(efficiency), level: getStatusLevel(Math.round(efficiency)), isLive: !powerLatest.isStale, lastUpdate: powerLatest.lastUpdate };
  }, [powerLatest]);

  const airStatus = useMemo<ModuleStatus>(() => {
    const co2 = liveData.metrics['iaq.co2'] ?? liveData.metrics['co2'];
    if (typeof co2 !== 'number') return { score: 0, level: getStatusLevel(0), isLive: false };
    const score = Math.round(Math.max(0, Math.min(100, 100 - ((co2 - 400) / 600) * 100)));
    return { score, level: getStatusLevel(score), isLive: true };
  }, [liveData.metrics]);

  const waterStatus = useMemo<ModuleStatus>(() => {
    const flowRate = liveData.isRealData ? liveData.metrics['water.flow_rate'] : undefined;
    if (typeof flowRate !== 'number') return { score: 0, level: getStatusLevel(0), isLive: false };
    return { score: flowRate > 0 ? 85 : 60, level: getStatusLevel(flowRate > 0 ? 85 : 60), isLive: flowRate > 0 };
  }, [liveData]);

  const overallStatus = useMemo<ModuleStatus>(() => {
    let totalWeight = 0, weightedSum = 0;
    if (moduleConfig.energy.enabled) { weightedSum += energyStatus.score * MODULE_WEIGHTS.energy; totalWeight += MODULE_WEIGHTS.energy; }
    if (moduleConfig.air.enabled) { weightedSum += airStatus.score * MODULE_WEIGHTS.air; totalWeight += MODULE_WEIGHTS.air; }
    if (moduleConfig.water.enabled) { weightedSum += waterStatus.score * MODULE_WEIGHTS.water; totalWeight += MODULE_WEIGHTS.water; }
    const avgScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    return { score: avgScore, level: getStatusLevel(avgScore), isLive: totalWeight > 0 };
  }, [moduleConfig, energyStatus, airStatus, waterStatus]);

  return (
    <div className="px-3 md:px-16 mb-4 md:mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <OverallCard
          status={overallStatus} moduleConfig={moduleConfig} energyScore={energyStatus.score} airScore={airStatus.score} waterScore={waterStatus.score}
          isRealData={liveData.isRealData || powerLatest.isRealData} alertStatus={alertStatus} liveData={liveData} timePeriod={timePeriod} periodLabel={periodLabel}
          onActivateModule={(module: string) => onNavigate && onNavigate(module)}
        />
        
        <EnergyCard
          status={energyStatus} enabled={moduleConfig.energy.enabled} onClick={moduleConfig.energy.enabled ? () => onNavigate && onNavigate("energy") : undefined}
          powerData={powerLatest} averageData={energyAverages} threshold={thresholds?.energy_power_limit_kw} periodLabel={periodLabel} project={project} benchmarkMatrix={benchmarkMatrix}
          isFlipped={flippedCards.energy} onToggleFlip={(e: React.MouseEvent) => toggleFlip('energy', e)}
        />
        <AirCard
          status={airStatus} enabled={moduleConfig.air.enabled} project={project} onClick={moduleConfig.air.enabled ? () => onNavigate && onNavigate("air") : undefined}
          liveData={{ metrics: liveData.metrics, isLoading: liveData.isLoading, isRealData: true }} averageMetrics={airAverages} periodLabel={periodLabel}
          isFlipped={flippedCards.air} onToggleFlip={(e: React.MouseEvent) => toggleFlip('air', e)}
        />
        <WaterCard
          status={waterStatus} enabled={moduleConfig.water.enabled} onClick={moduleConfig.water.enabled ? () => onNavigate && onNavigate("water") : undefined} liveData={liveData}
          isFlipped={flippedCards.water} onToggleFlip={(e: React.MouseEvent) => toggleFlip('water', e)}
        />
      </div>
    </div>
  );
};

export default OverviewSection;
