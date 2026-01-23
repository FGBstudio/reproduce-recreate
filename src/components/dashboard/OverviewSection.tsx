import { useMemo } from "react";
import { Project } from "@/lib/data";
import { Zap, Wind, Droplet, Activity, TrendingUp, TrendingDown, Thermometer, Gauge, Fan, Lightbulb, Plug, MoreHorizontal, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealTimeLatestData } from "@/hooks/useRealTimeTelemetry";
import { DataSourceBadge } from "./DataSourceBadge";

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
  onNavigate?: (tab: string) => void;
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
  return isLive
    ? "bg-emerald-500 text-white" 
    : "bg-gray-400 text-white";
};

const formatMaybe = (value: number | undefined, digits = 1) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";

const formatMaybeInt = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "—";

// Reading item component for detailed metrics
interface ReadingItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  status?: "good" | "warning" | "critical";
}

const ReadingItem = ({ icon, label, value, unit, status = "good" }: ReadingItemProps) => {
  const statusColors = {
    good: "text-emerald-600",
    warning: "text-amber-600",
    critical: "text-red-600"
  };
  
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
          {icon}
        </div>
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <div className={`text-sm font-semibold ${statusColors[status]}`}>
        {value} <span className="text-xs text-gray-400 font-normal">{unit}</span>
      </div>
    </div>
  );
};

// Module weights for overall score calculation (80/5/15)
const MODULE_WEIGHTS = {
  energy: 0.80,
  air: 0.05,
  water: 0.15,
};

// Mock CO2 equivalent saved value (will be connected to backend later)
const YEARLY_CO2_SAVED = 12450; // kg CO2 eq

// Overall Performance Card - Full width, prominent
const OverallCard = ({ status, moduleConfig, energyScore, airScore, waterScore, isRealData }: {
  status: ModuleStatus;
  moduleConfig: { energy: { enabled: boolean }; air: { enabled: boolean }; water: { enabled: boolean } };
  energyScore: number;
  airScore: number;
  waterScore: number;
  isRealData: boolean;
}) => {
  return (
    <Card className={`bg-white border ${getStatusBorderColor(status.level)} shadow-lg transition-all hover:shadow-xl col-span-full`}>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: Status */}
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
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                OVERALL PERFORMANCE
              </div>
            </div>
          </div>
          
          {/* Center: Score and CO2 */}
          <div className="flex items-center gap-6 md:gap-8">
            <div className="text-center">
              <div className={`text-3xl md:text-4xl font-bold ${getStatusColor(status.level)}`}>
                {status.score}
              </div>
              <div className="text-xs text-gray-500">Score</div>
            </div>
            
            <div className="h-12 w-px bg-gray-200" />
            
            {/* CO2 Equivalent Saved */}
            <div className="text-center bg-emerald-50 rounded-xl px-4 py-2">
              <div className="text-2xl md:text-3xl font-bold text-emerald-600">
                {YEARLY_CO2_SAVED.toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium uppercase tracking-wide">
                Yearly kg CO₂ eq saved till today
              </div>
            </div>
            
            <div className="h-12 w-px bg-gray-200" />
            
            {/* Module breakdown with weights */}
            <div className="flex gap-4">
              {moduleConfig.energy.enabled && (
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-1">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="text-sm font-semibold text-gray-800">{energyScore}</div>
                  <div className="text-[9px] text-gray-400">{Math.round(MODULE_WEIGHTS.energy * 100)}%</div>
                </div>
              )}
              {moduleConfig.air.enabled && (
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1">
                    <Wind className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-sm font-semibold text-gray-800">{airScore}</div>
                  <div className="text-[9px] text-gray-400">{Math.round(MODULE_WEIGHTS.air * 100)}%</div>
                </div>
              )}
              {moduleConfig.water.enabled && (
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center mx-auto mb-1">
                    <Droplet className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="text-sm font-semibold text-gray-800">{waterScore}</div>
                  <div className="text-[9px] text-gray-400">{Math.round(MODULE_WEIGHTS.water * 100)}%</div>
                </div>
              )}
            </div>
            
            <div className="h-12 w-px bg-gray-200" />
            
            <div className="text-center">
              <div className="flex items-center gap-1 text-emerald-600">
                <TrendingUp className="w-5 h-5" />
                <span className="text-lg font-semibold">+5%</span>
              </div>
              <div className="text-xs text-gray-500">vs last period</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Energy Card with detailed readings - connected to real-time data
const EnergyCard = ({ status, enabled, onClick, liveData }: { 
  status: ModuleStatus; 
  enabled: boolean; 
  onClick?: () => void;
  liveData?: { metrics: Record<string, number>; isLoading: boolean; isRealData: boolean };
}) => {
  // Use real-time data if available, otherwise use mock
  const readings = useMemo(() => {
    const isReal = !!liveData?.isRealData;
    const m = isReal ? liveData!.metrics : {};

    const totalPower = isReal ? m['energy.power_kw'] : undefined;
    const hvacValue = isReal ? m['energy.hvac_kw'] : undefined;
    const lightingValue = isReal ? m['energy.lighting_kw'] : undefined;
    const plugsValue = isReal ? m['energy.plugs_kw'] : undefined;
    const otherValue =
      typeof totalPower === 'number' &&
      typeof hvacValue === 'number' &&
      typeof lightingValue === 'number' &&
      typeof plugsValue === 'number'
        ? Math.max(0, totalPower - hvacValue - lightingValue - plugsValue)
        : undefined;

    return {
      totalPower,
      hvac: {
        value: hvacValue,
        status: typeof hvacValue === 'number' && hvacValue > 30 ? "warning" as const : "good" as const,
      },
      lighting: {
        value: lightingValue,
        status: typeof lightingValue === 'number' && lightingValue > 20 ? "warning" as const : "good" as const,
      },
      plugs: {
        value: plugsValue,
        status: typeof plugsValue === 'number' && plugsValue > 12 ? "warning" as const : "good" as const,
      },
      other: { value: otherValue, status: "good" as const },
    };
  }, [liveData]);

  if (!enabled) {
    return (
      <Card className="border bg-gray-100/80 backdrop-blur-sm h-full">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
              <Zap className="w-5 h-5" />
            </div>
            <Badge className="bg-gray-400 text-white text-[10px] uppercase tracking-wider">
              Disabilitato
            </Badge>
          </div>
          <div className="text-2xl font-bold text-gray-400 mb-1">N/A</div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">ENERGY PERFORMANCE</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white border ${getStatusBorderColor(status.level)} shadow-lg transition-all hover:shadow-xl h-full cursor-pointer`} onClick={onClick}>
      <CardContent className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full ${getStatusIconBg(status.level)} flex items-center justify-center ${getStatusColor(status.level)}`}>
              <Zap className="w-5 h-5" />
            </div>
            <Badge className={`${getLiveBadgeColor(status.isLive)} text-[10px] uppercase tracking-wider`}>
              LIVE
            </Badge>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold ${getStatusColor(status.level)}`}>{status.level}</div>
            <div className="text-[10px] text-gray-500 uppercase">Score {status.score}</div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">ENERGY PERFORMANCE</div>
        
        {/* Total consumption highlight */}
        <div className="bg-white/60 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Consumo Attuale</span>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-gray-800">{formatMaybe(readings.totalPower, 1)}</span>
              <span className="text-sm text-gray-500">kW</span>
            </div>
          </div>
        </div>
        
        {/* Detailed readings */}
        <div className="bg-white/40 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 uppercase font-medium mb-2">Ultime Rilevazioni</div>
          <ReadingItem 
            icon={<Fan className="w-3.5 h-3.5" />}
            label="HVAC"
            value={formatMaybe(readings.hvac.value, 1)}
            unit="kW"
            status={readings.hvac.status}
          />
          <ReadingItem 
            icon={<Lightbulb className="w-3.5 h-3.5" />}
            label="Lighting"
            value={formatMaybe(readings.lighting.value, 1)}
            unit="kW"
            status={readings.lighting.status}
          />
          <ReadingItem 
            icon={<Plug className="w-3.5 h-3.5" />}
            label="Plugs & Loads"
            value={formatMaybe(readings.plugs.value, 1)}
            unit="kW"
            status={readings.plugs.status}
          />
          <ReadingItem 
            icon={<MoreHorizontal className="w-3.5 h-3.5" />}
            label="Other"
            value={formatMaybe(readings.other.value, 1)}
            unit="kW"
            status={readings.other.status}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Air Quality Card with all monitored parameters - connected to real-time data
const AirCard = ({ status, enabled, project, onClick, liveData }: { 
  status: ModuleStatus; 
  enabled: boolean; 
  project: Project; 
  onClick?: () => void;
  liveData?: { metrics: Record<string, number>; isLoading: boolean; isRealData: boolean };
}) => {
  // Use real-time data if available
  const readings = useMemo(() => {
    const isReal = !!liveData?.isRealData;
    const m = isReal ? liveData!.metrics : {};
    const co2Val = isReal ? m['iaq.co2'] : undefined;
    // DB normalizes TVOC as iaq.voc
    const tvocVal = isReal ? m['iaq.voc'] : undefined;
    const pm25Val = isReal ? m['iaq.pm25'] : undefined;
    const pm10Val = isReal ? m['iaq.pm10'] : undefined;
    const tempVal = isReal ? m['env.temperature'] : undefined;
    const humidityVal = isReal ? m['env.humidity'] : undefined;
    const coVal = isReal ? m['iaq.co'] : undefined;
    const o3Val = isReal ? m['iaq.o3'] : undefined;
    
    return {
      co2: { value: co2Val, unit: "ppm", status: typeof co2Val === 'number' ? (co2Val < 600 ? "good" as const : co2Val < 800 ? "warning" as const : "critical" as const) : "good" as const },
      // Keep label 'TVOC' in UI, metric key is iaq.voc
      tvoc: { value: tvocVal, unit: "ppb", status: typeof tvocVal === 'number' ? (tvocVal < 200 ? "good" as const : tvocVal < 400 ? "warning" as const : "critical" as const) : "good" as const },
      pm25: { value: pm25Val, unit: "µg/m³", status: typeof pm25Val === 'number' ? (pm25Val < 15 ? "good" as const : pm25Val < 25 ? "warning" as const : "critical" as const) : "good" as const },
      pm10: { value: pm10Val, unit: "µg/m³", status: typeof pm10Val === 'number' ? (pm10Val < 25 ? "good" as const : pm10Val < 50 ? "warning" as const : "critical" as const) : "good" as const },
      temp: { value: tempVal, unit: "°C", status: typeof tempVal === 'number' ? (tempVal > 18 && tempVal < 26 ? "good" as const : "warning" as const) : "good" as const },
      humidity: { value: humidityVal, unit: "%", status: typeof humidityVal === 'number' ? (humidityVal > 30 && humidityVal < 60 ? "good" as const : "warning" as const) : "good" as const },
      co: { value: coVal, unit: "ppm", status: "good" as const },
      o3: { value: o3Val, unit: "ppb", status: "good" as const },
    };
  }, [liveData]);

  if (!enabled) {
    return (
      <Card className="border bg-gray-100/80 backdrop-blur-sm h-full">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
              <Wind className="w-5 h-5" />
            </div>
            <Badge className="bg-gray-400 text-white text-[10px] uppercase tracking-wider">
              Disabilitato
            </Badge>
          </div>
          <div className="text-2xl font-bold text-gray-400 mb-1">N/A</div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">INDOOR AIR QUALITY</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white border ${getStatusBorderColor(status.level)} shadow-lg transition-all hover:shadow-xl h-full cursor-pointer`} onClick={onClick}>
      <CardContent className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full ${getStatusIconBg(status.level)} flex items-center justify-center ${getStatusColor(status.level)}`}>
              <Wind className="w-5 h-5" />
            </div>
            <Badge className={`${getLiveBadgeColor(status.isLive)} text-[10px] uppercase tracking-wider`}>
              LIVE
            </Badge>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold ${getStatusColor(status.level)}`}>{status.level}</div>
            <div className="text-[10px] text-gray-500 uppercase">Score {status.score}</div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">INDOOR AIR QUALITY</div>
        
        {/* All parameters grid */}
        <div className="bg-white/40 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 uppercase font-medium mb-2">Parametri Monitorati</div>
          <div className="grid grid-cols-2 gap-x-4">
            <ReadingItem 
              icon={<Gauge className="w-3.5 h-3.5" />}
              label="CO₂"
              value={formatMaybe(readings.co2.value, 0)}
              unit={readings.co2.unit}
              status={readings.co2.status}
            />
            <ReadingItem 
              icon={<Wind className="w-3.5 h-3.5" />}
              label="TVOC"
              value={formatMaybe(readings.tvoc.value, 0)}
              unit={readings.tvoc.unit}
              status={readings.tvoc.status}
            />
            <ReadingItem 
              icon={<Activity className="w-3.5 h-3.5" />}
              label="PM2.5"
              value={formatMaybe(readings.pm25.value, 1)}
              unit={readings.pm25.unit}
              status={readings.pm25.status}
            />
            <ReadingItem 
              icon={<Activity className="w-3.5 h-3.5" />}
              label="PM10"
              value={formatMaybe(readings.pm10.value, 1)}
              unit={readings.pm10.unit}
              status={readings.pm10.status}
            />
            <ReadingItem 
              icon={<Thermometer className="w-3.5 h-3.5" />}
              label="Temp"
              value={formatMaybe(readings.temp.value, 1)}
              unit={readings.temp.unit}
              status={readings.temp.status}
            />
            <ReadingItem 
              icon={<Droplet className="w-3.5 h-3.5" />}
              label="Humidity"
              value={formatMaybe(readings.humidity.value, 0)}
              unit={readings.humidity.unit}
              status={readings.humidity.status}
            />
            <ReadingItem 
              icon={<Gauge className="w-3.5 h-3.5" />}
              label="CO"
              value={formatMaybe(readings.co.value, 2)}
              unit={readings.co.unit}
              status={readings.co.status}
            />
            <ReadingItem 
              icon={<Gauge className="w-3.5 h-3.5" />}
              label="O₃"
              value={formatMaybe(readings.o3.value, 0)}
              unit={readings.o3.unit}
              status={readings.o3.status}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Water Card with detailed readings - connected to real-time data
const WaterCard = ({ status, enabled, onClick, liveData }: { 
  status: ModuleStatus; 
  enabled: boolean; 
  onClick?: () => void;
  liveData?: { metrics: Record<string, number>; isLoading: boolean; isRealData: boolean };
}) => {
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

  if (!enabled) {
    return (
      <Card className="border bg-gray-100/80 backdrop-blur-sm h-full">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
              <Droplet className="w-5 h-5" />
            </div>
            <Badge className="bg-gray-400 text-white text-[10px] uppercase tracking-wider">
              Disabilitato
            </Badge>
          </div>
          <div className="text-2xl font-bold text-gray-400 mb-1">N/A</div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">WATER CONSUMPTION</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white border ${getStatusBorderColor(status.level)} shadow-lg transition-all hover:shadow-xl h-full cursor-pointer`} onClick={onClick}>
      <CardContent className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full ${getStatusIconBg(status.level)} flex items-center justify-center ${getStatusColor(status.level)}`}>
              <Droplet className="w-5 h-5" />
            </div>
            <Badge className={`${getLiveBadgeColor(status.isLive)} text-[10px] uppercase tracking-wider`}>
              LIVE
            </Badge>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold ${getStatusColor(status.level)}`}>{status.level}</div>
            <div className="text-[10px] text-gray-500 uppercase">Score {status.score}</div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">WATER CONSUMPTION</div>
        
        {/* Main metrics */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/60 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-800">{formatMaybeInt(readings.dailyConsumption)}</div>
            <div className="text-[10px] text-gray-500">L/giorno</div>
          </div>
          <div className="bg-white/60 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-600">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xl font-bold">{readings.vsBaseline == null ? '—' : `${readings.vsBaseline}%`}</span>
            </div>
            <div className="text-[10px] text-gray-500">vs baseline</div>
          </div>
        </div>
        
        {/* Additional metrics */}
        <div className="bg-white/40 rounded-lg p-3">
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
            <span className="text-xs text-gray-600">Efficienza</span>
            <span className="text-sm font-semibold text-emerald-600">{readings.efficiency == null ? '—' : `${readings.efficiency}%`}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-gray-600">Perdite Attive</span>
            <span className={`text-sm font-semibold ${readings.activeLeaks === 0 ? 'text-emerald-600' : readings.activeLeaks == null ? 'text-gray-500' : 'text-red-600'}`}>
              {readings.activeLeaks == null ? '—' : readings.activeLeaks}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const OverviewSection = ({ project, moduleConfig, onNavigate }: OverviewSectionProps) => {
  // Fetch real-time telemetry data for this site
  const liveData = useRealTimeLatestData(project.siteId);
  
  // Calculate status for each module based on real-time or project data
  const energyStatus = useMemo<ModuleStatus>(() => {
    const powerKw = liveData.isRealData ? liveData.metrics['energy.power_kw'] : undefined;
    if (typeof powerKw !== 'number') {
      return { score: 0, level: getStatusLevel(0), isLive: false };
    }

    const efficiency = Math.min(100, Math.max(0, 100 - (powerKw / 100) * 20));
    const score = Math.min(100, Math.max(0, efficiency));
    return {
      score,
      level: getStatusLevel(score),
      isLive: true,
      lastUpdate: new Date().toISOString(),
    };
  }, [project, liveData]);

  const airStatus = useMemo<ModuleStatus>(() => {
    const co2 = liveData.isRealData ? liveData.metrics['iaq.co2'] : undefined;
    if (typeof co2 !== 'number') {
      return { score: 0, level: getStatusLevel(0), isLive: false };
    }

    const co2Score = Math.max(0, Math.min(100, 100 - ((co2 - 400) / 600) * 100));
    const score = Math.round(co2Score);
    return { score, level: getStatusLevel(score), isLive: true };
  }, [project, liveData]);

  const waterStatus = useMemo<ModuleStatus>(() => {
    const flowRate = liveData.isRealData ? liveData.metrics['water.flow_rate'] : undefined;
    if (typeof flowRate !== 'number') {
      return { score: 0, level: getStatusLevel(0), isLive: false };
    }

    const score = flowRate > 0 ? 85 : 60;
    return { score, level: getStatusLevel(score), isLive: flowRate > 0 };
  }, [project, liveData]);

  const overallStatus = useMemo<ModuleStatus>(() => {
    // Weighted average: Energy 80%, Air 5%, Water 15%
    let totalWeight = 0;
    let weightedSum = 0;
    
    if (moduleConfig.energy.enabled) {
      weightedSum += energyStatus.score * MODULE_WEIGHTS.energy;
      totalWeight += MODULE_WEIGHTS.energy;
    }
    if (moduleConfig.air.enabled) {
      weightedSum += airStatus.score * MODULE_WEIGHTS.air;
      totalWeight += MODULE_WEIGHTS.air;
    }
    if (moduleConfig.water.enabled) {
      weightedSum += waterStatus.score * MODULE_WEIGHTS.water;
      totalWeight += MODULE_WEIGHTS.water;
    }
    
    // Normalize the weighted average based on active modules
    const avgScore = totalWeight > 0 
      ? Math.round(weightedSum / totalWeight)
      : 0;
    
    return {
      score: avgScore,
      level: getStatusLevel(avgScore),
      isLive: totalWeight > 0,
    };
  }, [moduleConfig, energyStatus, airStatus, waterStatus]);

  const handleCardClick = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    }
  };

  return (
    <div className="px-3 md:px-16 mb-4 md:mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {/* Overall Performance - Full width on top */}
        <OverallCard 
          status={overallStatus}
          moduleConfig={moduleConfig}
          energyScore={energyStatus.score}
          airScore={airStatus.score}
          waterScore={waterStatus.score}
          isRealData={liveData.isRealData}
        />
        
        {/* Three detail cards below */}
        <EnergyCard 
          status={energyStatus} 
          enabled={moduleConfig.energy.enabled} 
          onClick={moduleConfig.energy.enabled ? () => handleCardClick("energy") : undefined}
          liveData={liveData}
        />
        <AirCard 
          status={airStatus} 
          enabled={moduleConfig.air.enabled} 
          project={project}
          onClick={moduleConfig.air.enabled ? () => handleCardClick("air") : undefined}
          liveData={liveData}
        />
        <WaterCard 
          status={waterStatus} 
          enabled={moduleConfig.water.enabled}
          onClick={moduleConfig.water.enabled ? () => handleCardClick("water") : undefined}
          liveData={liveData}
        />
      </div>
    </div>
  );
};

export default OverviewSection;
