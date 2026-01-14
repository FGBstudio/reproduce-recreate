import { useMemo } from "react";
import { Project } from "@/lib/data";
import { Zap, Wind, Droplet, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StatusLevel = "GOOD" | "OK" | "WARNING" | "CRITICAL";

interface ModuleStatus {
  score: number;
  level: StatusLevel;
  kpi1: { label: string; value: string };
  kpi2: { label: string; value: string };
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

const getStatusBgColor = (level: StatusLevel) => {
  switch (level) {
    case "GOOD": return "bg-emerald-500/10 border-emerald-500/30";
    case "OK": return "bg-blue-500/10 border-blue-500/30";
    case "WARNING": return "bg-amber-500/10 border-amber-500/30";
    case "CRITICAL": return "bg-red-500/10 border-red-500/30";
  }
};

const getLiveBadgeColor = (isLive: boolean) => {
  return isLive 
    ? "bg-emerald-500 text-white" 
    : "bg-gray-400 text-white";
};

interface StatusCardProps {
  title: string;
  subtitle: string;
  status: ModuleStatus;
  icon: React.ReactNode;
  enabled: boolean;
}

const StatusCard = ({ title, subtitle, status, icon, enabled }: StatusCardProps) => {
  if (!enabled) {
    return (
      <Card className={`border bg-gray-100/80 backdrop-blur-sm`}>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-500">
                {icon}
              </div>
              <Badge className="bg-gray-400 text-white text-[10px] uppercase tracking-wider">
                Disabilitato
              </Badge>
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-400 mb-1">N/A</div>
          <div className="text-xs md:text-sm text-gray-500 font-medium uppercase tracking-wide">{subtitle}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border ${getStatusBgColor(status.level)} backdrop-blur-sm transition-all hover:shadow-lg`}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${getStatusBgColor(status.level)} flex items-center justify-center ${getStatusColor(status.level)}`}>
              {icon}
            </div>
            <Badge className={`${getLiveBadgeColor(status.isLive)} text-[10px] uppercase tracking-wider`}>
              {status.isLive ? "LIVE" : `${status.lastUpdate || "Offline"}`}
            </Badge>
          </div>
        </div>
        <div className={`text-2xl md:text-3xl font-bold ${getStatusColor(status.level)} mb-1`}>
          {status.level}
        </div>
        <div className="text-xs md:text-sm text-gray-600 font-medium uppercase tracking-wide mb-4">{subtitle}</div>
        
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/60 rounded-lg p-2 md:p-3">
            <div className="text-lg md:text-xl font-bold text-gray-800">{status.kpi1.value}</div>
            <div className="text-[10px] md:text-xs text-gray-500">{status.kpi1.label}</div>
          </div>
          <div className="bg-white/60 rounded-lg p-2 md:p-3">
            <div className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-1">
              {status.kpi2.value}
              {status.kpi2.value.includes("-") ? (
                <TrendingDown className="w-4 h-4 text-emerald-500" />
              ) : status.kpi2.value.includes("+") ? (
                <TrendingUp className="w-4 h-4 text-amber-500" />
              ) : null}
            </div>
            <div className="text-[10px] md:text-xs text-gray-500">{status.kpi2.label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const OverviewSection = ({ project, moduleConfig }: OverviewSectionProps) => {
  // Calculate status for each module based on project data
  const energyStatus = useMemo<ModuleStatus>(() => {
    // Calculate energy score based on efficiency
    const efficiency = project.data.hvac || 85;
    const score = Math.min(100, Math.max(0, efficiency));
    const kwhToday = Math.round(project.data.hvac * 10 + Math.random() * 50);
    const vsBaseline = -Math.round(5 + Math.random() * 10);
    
    return {
      score,
      level: getStatusLevel(score),
      kpi1: { label: "kWh oggi", value: `${kwhToday}` },
      kpi2: { label: "vs baseline", value: `${vsBaseline}%` },
      isLive: true,
    };
  }, [project]);

  const airStatus = useMemo<ModuleStatus>(() => {
    // Calculate air score based on CO2 and AQ
    const co2 = project.data.co2 || 500;
    const co2Score = Math.max(0, Math.min(100, 100 - ((co2 - 400) / 600) * 100));
    const aqMultiplier = project.data.aq === "EXCELLENT" ? 1 : 
                          project.data.aq === "GOOD" ? 0.9 : 
                          project.data.aq === "MODERATE" ? 0.7 : 0.5;
    const score = Math.round(co2Score * aqMultiplier);
    const tvoc = Math.round(50 + Math.random() * 200);
    
    return {
      score,
      level: getStatusLevel(score),
      kpi1: { label: "CO₂ (ppm)", value: `${co2}` },
      kpi2: { label: "TVOC (ppb)", value: `${tvoc}` },
      isLive: true,
    };
  }, [project]);

  const waterStatus = useMemo<ModuleStatus>(() => {
    // Calculate water score
    const baseConsumption = 1200 + Math.random() * 500;
    const efficiency = 70 + Math.random() * 25;
    const score = Math.round(efficiency);
    const vsBaseline = -Math.round(3 + Math.random() * 8);
    
    return {
      score,
      level: getStatusLevel(score),
      kpi1: { label: "L/giorno", value: `${Math.round(baseConsumption)}` },
      kpi2: { label: "vs baseline", value: `${vsBaseline}%` },
      isLive: true,
    };
  }, [project]);

  const overallStatus = useMemo<ModuleStatus>(() => {
    // Calculate weighted average based on enabled modules
    const enabledModules = [];
    if (moduleConfig.energy.enabled) enabledModules.push(energyStatus.score);
    if (moduleConfig.air.enabled) enabledModules.push(airStatus.score);
    if (moduleConfig.water.enabled) enabledModules.push(waterStatus.score);
    
    const avgScore = enabledModules.length > 0 
      ? Math.round(enabledModules.reduce((a, b) => a + b, 0) / enabledModules.length)
      : 0;
    
    const trend = avgScore >= 75 ? "+5%" : avgScore >= 50 ? "+2%" : "-3%";
    
    return {
      score: avgScore,
      level: getStatusLevel(avgScore),
      kpi1: { label: "Score", value: `${avgScore}/100` },
      kpi2: { label: "vs periodo prec.", value: trend },
      isLive: enabledModules.length > 0,
    };
  }, [moduleConfig, energyStatus, airStatus, waterStatus]);

  return (
    <div className="px-3 md:px-16 mb-4 md:mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatusCard
          title="Energy"
          subtitle="ENERGY PERFORMANCE"
          status={energyStatus}
          icon={<Zap className="w-4 h-4 md:w-5 md:h-5" />}
          enabled={moduleConfig.energy.enabled}
        />
        <StatusCard
          title="Air"
          subtitle="INDOOR AIR QUALITY"
          status={airStatus}
          icon={<Wind className="w-4 h-4 md:w-5 md:h-5" />}
          enabled={moduleConfig.air.enabled}
        />
        <StatusCard
          title="Water"
          subtitle="WATER CONSUMPTION"
          status={waterStatus}
          icon={<Droplet className="w-4 h-4 md:w-5 md:h-5" />}
          enabled={moduleConfig.water.enabled}
        />
        <StatusCard
          title="Overall"
          subtitle="OVERALL PERFORMANCE"
          status={overallStatus}
          icon={<Activity className="w-4 h-4 md:w-5 md:h-5" />}
          enabled={true}
        />
      </div>
    </div>
  );
};

export default OverviewSection;
