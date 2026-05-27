"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Project } from "@/lib/data";
import { Zap, Wind, Droplet, Activity, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, RotateCcw, Fan, Lightbulb, Plug, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRealTimeLatestData } from "@/hooks/useRealTimeTelemetry";
import { DataSourceBadge } from "./DataSourceBadge";
import { useThresholdAlerts, getMetricStatus, type ThresholdAlert } from "@/hooks/useThresholdAlerts";
import { useSiteThresholds } from "@/hooks/useSiteThresholds";
import { useEnergyPowerByCategory } from "@/hooks/useEnergyPowerByCategory";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveTimezone, getPartsInTz } from "@/lib/timezoneUtils";

// ─────────────────────────────────────────────
// Types & Config
// ─────────────────────────────────────────────

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

const getLiveBadgeColor = (isLive: boolean) => isLive ? "bg-emerald-500 text-white" : "bg-gray-400 text-white";

const formatMaybe = (value: number | undefined, digits = 1) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
const formatMaybeInt = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "—";

const MODULE_WEIGHTS = { energy: 0.80, air: 0.05, water: 0.15 };

const STATUS_TOKENS: Record<StatusLevel, { word: string; trackColor: string; ringColor: string; ringBg: string; textColor: string; modIconBg: string; modIconText: string; }> = {
  GOOD: { word: "Good", trackColor: "bg-emerald-500", ringColor: "#1D9E75", ringBg: "#E1F5EE", textColor: "text-emerald-600", modIconBg: "bg-emerald-50", modIconText: "text-emerald-700" },
  OK: { word: "Ok", trackColor: "bg-blue-500", ringColor: "#378ADD", ringBg: "#E6F1FB", textColor: "text-blue-600", modIconBg: "bg-blue-50", modIconText: "text-blue-700" },
  WARNING: { word: "Warning", trackColor: "bg-amber-500", ringColor: "#EF9F27", ringBg: "#FAEEDA", textColor: "text-amber-600", modIconBg: "bg-amber-50", modIconText: "text-amber-700" },
  CRITICAL: { word: "Critical", trackColor: "bg-red-500", ringColor: "#E24B4A", ringBg: "#FCEBEB", textColor: "text-red-600", modIconBg: "bg-red-50", modIconText: "text-red-700" },
};

// ─────────────────────────────────────────────
// Fingerprint verdict — short headline + reason
// ─────────────────────────────────────────────

interface VerdictInput {
  overall: number;
  energy: { score: number; enabled: boolean };
  air:    { score: number; enabled: boolean };
  water:  { score: number; enabled: boolean };
  alerts: { hasAlerts: boolean; criticalCount: number; warningCount: number };
}

interface Verdict { headline: string; reason: string; tone: StatusLevel }

function buildFingerprintVerdict(v: VerdictInput): Verdict {
  if (v.alerts.criticalCount > 0) {
    return {
      headline: "Critical Issue Detected",
      reason: `${v.alerts.criticalCount} critical alert${v.alerts.criticalCount > 1 ? "s" : ""} need immediate attention.`,
      tone: "CRITICAL",
    };
  }
  if (v.air.enabled && v.air.score < 50) {
    return { headline: "Ventilate the Room", reason: "Indoor air quality is degrading — increase ventilation.", tone: "WARNING" };
  }
  if (v.energy.enabled && v.energy.score < 50) {
    return { headline: "Consumption a Bit High", reason: "Energy usage is above the expected baseline.", tone: "WARNING" };
  }
  if (v.water.enabled && v.water.score < 50) {
    return { headline: "Water Flow Anomaly", reason: "Detected water consumption is outside the normal range.", tone: "WARNING" };
  }
  if (v.alerts.warningCount > 2) {
    return { headline: "Multiple Warnings Active", reason: "Several non-critical anomalies are currently open.", tone: "WARNING" };
  }
  if (v.overall >= 85) {
    return { headline: "All Good", reason: "All monitored modules are within their optimal range.", tone: "GOOD" };
  }
  if (v.overall >= 65) {
    return { headline: "Operating Normally", reason: "Performance is stable, with minor room for improvement.", tone: "OK" };
  }
  return { headline: "Needs Attention", reason: "Multiple modules are below their target performance.", tone: "WARNING" };
}

// ─────────────────────────────────────────────
// Hooks for ScoreHero
// ─────────────────────────────────────────────

function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const from = 0;
    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

function useDelayedTrue(delay = 60): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  return ready;
}

// ─────────────────────────────────────────────
// ScoreHero Sub-components
// ─────────────────────────────────────────────

const RING_R = 31;
const RING_CIRC = 2 * Math.PI * RING_R;

function ScoreRing({ score, level, animatedScore }: { score: number; level: StatusLevel; animatedScore: number }) {
  const tokens = STATUS_TOKENS[level];
  const mounted = useDelayedTrue(60);
  const offset = mounted ? RING_CIRC * (1 - score / 100) : RING_CIRC;

  return (
    <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
      <svg width={80} height={80} viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={40} cy={40} r={RING_R} fill="none" stroke={tokens.ringBg} strokeWidth={7} />
        <circle cx={40} cy={40} r={RING_R} fill="none" stroke={tokens.ringColor} strokeWidth={7} strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-xl font-medium leading-none tracking-tight ${tokens.textColor}`} aria-live="polite">{animatedScore}</span>
        <span className="text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">score</span>
      </div>
    </div>
  );
}

function TrackBar({ score, level }: { score: number; level: StatusLevel }) {
  const tokens = STATUS_TOKENS[level];
  const mounted = useDelayedTrue(80);
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="h-[3px] w-[160px] rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${tokens.trackColor}`} style={{ width: mounted ? `${score}%` : "0%", transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span className="text-[11px] text-gray-400 tabular-nums">{score} / 100</span>
    </div>
  );
}

function ModPill({ icon, label, score, enabled, isLive, level, onClick }: any) {
  const tokens = STATUS_TOKENS[level];
  const active = enabled && isLive;
  return (
    <button onClick={onClick} disabled={!onClick} className={`flex flex-col items-center gap-1 min-w-[52px] group ${onClick ? "cursor-pointer" : "cursor-default"}`}>
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center border transition-all duration-200 ${active ? `${tokens.modIconBg} ${tokens.modIconText} border-transparent group-hover:scale-105` : "bg-gray-50 text-gray-300 border-gray-100"}`}>
        {icon}
      </div>
      <span className={`text-[13px] font-medium tabular-nums leading-none ${active ? "text-gray-800" : "text-gray-300"}`}>{active ? score : "—"}</span>
      <span className="text-[9px] uppercase tracking-wider text-gray-400">{label}</span>
    </button>
  );
}

function ModSep() { return <div className="w-px h-8 bg-gray-100 self-center flex-shrink-0" aria-hidden="true" />; }

function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider uppercase ${isLive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-400 border border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} aria-hidden="true" />
      {isLive ? "Live" : "Offline"}
    </span>
  );
}

function ScoreHero({ score, level, isLive, periodLabel, peerPercentile, modules, onModuleClick, className = "", isRealData, alertStatus }: any) {
  const tokens = STATUS_TOKENS[level];
  const animatedScore = useCountUp(score, 1100);
  const handleModClick = useCallback((mod: "energy" | "air" | "water") => () => onModuleClick?.(mod), [onModuleClick]);

  return (
    <Card className={`relative overflow-hidden bg-white border ${getStatusBorderColor(level)} shadow-sm transition-all hover:shadow-md ${className}`}>
      {/* Status-colored corner glow (echoes the dark-gradient screenshot, kept on a light card) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 w-[340px] h-[340px] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle at center, ${tokens.ringColor}40 0%, ${tokens.ringColor}1a 45%, transparent 72%)`,
          filter: "blur(6px)",
        }}
      />
      <div className={`relative flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-6 h-full`}>
        {/* ── LEFT: Ring + status text ── */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <ScoreRing score={score} level={level} animatedScore={animatedScore} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">{periodLabel}</span>
              <LiveBadge isLive={isLive} />
              <DataSourceBadge isRealData={isRealData} size="sm" />
            </div>
            <div className={`text-[26px] md:text-[28px] font-medium leading-none tracking-tight ${tokens.textColor}`}>
              {tokens.word}
            </div>
            <div className="text-[12px] text-gray-500 mt-1 leading-snug">
              Overall performance {peerPercentile != null && (<> · Top <strong className="font-medium text-gray-700">{peerPercentile}%</strong> of monitored buildings</>)}
            </div>
            <TrackBar score={score} level={level} />
          </div>
        </div>

        {/* ── DIVIDER (xl+) ── */}
        <div className="hidden xl:block w-px h-16 bg-gray-100 flex-shrink-0" aria-hidden="true" />

        {/* ── RIGHT: Module pills + Alerts ── */}
        <div className="flex items-center gap-3 md:gap-4 flex-shrink-0 overflow-x-auto pb-2 xl:pb-0">
          <ModPill icon={<Zap className="w-4 h-4" aria-hidden="true" />} label="Energy" score={modules.energy.score} enabled={modules.energy.enabled} isLive={modules.energy.isLive} level={level} onClick={modules.energy.enabled ? handleModClick("energy") : undefined} />
          <ModSep />
          <ModPill icon={<Wind className="w-4 h-4" aria-hidden="true" />} label="Air" score={modules.air.score} enabled={modules.air.enabled} isLive={modules.air.isLive} level={level} onClick={modules.air.enabled ? handleModClick("air") : undefined} />
          <ModSep />
          <ModPill icon={<Droplet className="w-4 h-4" aria-hidden="true" />} label="Water" score={modules.water.score} enabled={modules.water.enabled} isLive={modules.water.isLive} level={level} onClick={modules.water.enabled ? handleModClick("water") : undefined} />
          <ModSep />
          <div className="flex flex-col items-center gap-1 min-w-[52px]">
            <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center border transition-all ${alertStatus.hasAlerts ? 'bg-red-50 text-red-600 border-red-100 hover:scale-105' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {alertStatus.hasAlerts ? <AlertTriangle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
            </div>
            <span className={`text-[13px] font-medium tabular-nums leading-none ${alertStatus.hasAlerts ? 'text-red-600' : 'text-emerald-600'}`}>
              {alertStatus.hasAlerts ? alertStatus.criticalCount + alertStatus.warningCount : "0"}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-gray-400">Alerts</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Building Fingerprint (Radar Chart)
// ─────────────────────────────────────────────
function BuildingFingerprint({ axes, level }: any) {
  const size = 160;
  const center = size / 2;
  const radius = size / 2 - 25;

  const axisKeys = ["score", "energy", "air", "water", "alerts"];
  const angles = axisKeys.map((_, i) => (Math.PI * 2 * i) / 5 - Math.PI / 2);

  const getPoint = (val: number, angle: number) => {
    const r = (Math.max(0, Math.min(100, val)) / 100) * radius;
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
  };

  const pathData = axisKeys.map((key, i) => getPoint(axes[key].value, angles[i])).join(" L ") + " Z";

  const colorTokens = {
    GOOD: { fill: "#10b981", stroke: "#059669" },
    OK: { fill: "#3b82f6", stroke: "#2563eb" },
    WARNING: { fill: "#f59e0b", stroke: "#d97706" },
    CRITICAL: { fill: "#ef4444", stroke: "#dc2626" },
  };
  const theme = colorTokens[level as keyof typeof colorTokens] || colorTokens.GOOD;

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Web Background */}
        {[0.2, 0.4, 0.6, 0.8, 1].map(scale => (
          <polygon key={scale} points={axisKeys.map((_, i) => getPoint(scale * 100, angles[i])).join(" ")} fill="none" stroke="#f3f4f6" strokeWidth="1" />
        ))}
        {/* Axis Lines */}
        {angles.map((a, i) => (
          <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(a)} y2={center + radius * Math.sin(a)} stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {/* Data Polygon */}
        <polygon points={pathData} fill={theme.fill} fillOpacity="0.15" stroke={theme.stroke} strokeWidth="2" style={{ transition: "all 1s cubic-bezier(0.16,1,0.3,1)" }} />
        {/* Data Dots */}
        {axisKeys.map((key, i) => (
          <circle key={`dot-${i}`} cx={getPoint(axes[key].value, angles[i]).split(',')[0]} cy={getPoint(axes[key].value, angles[i]).split(',')[1]} r="3" fill={theme.stroke} stroke="#ffffff" strokeWidth="1.5" />
        ))}
        {/* Labels */}
        {axisKeys.map((key, i) => {
          const textR = radius + 16;
          const x = center + textR * Math.cos(angles[i]);
          const y = center + textR * Math.sin(angles[i]);
          const isDisabled = axes[key].value === 0 && key !== "score" && key !== "alerts";
          return (
            <text key={key} x={x} y={y} fontSize="9" fill={isDisabled ? "#d1d5db" : "#9ca3af"} textAnchor="middle" dominantBaseline="middle" className="font-semibold uppercase tracking-wider select-none">
              {axes[key].label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// FLIPPABLE EXECUTIVE CARDS (Custom Logic Maintained)
// ─────────────────────────────────────────────
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
  
  const avgPower = averageData?.totalGeneral;
  const showAvg = avgPower != null && currentPower != null;
  const powerDelta = showAvg ? ((currentPower - avgPower) / avgPower) * 100 : 0;
  const isPowerHigher = powerDelta > 0;

  return (
    <div className="relative w-full h-[320px]" style={{ perspective: "1500px" }}>
      <div
        className="w-full h-full cursor-pointer transition-transform duration-700 shadow-sm hover:shadow-lg rounded-xl"
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
        className="w-full h-full cursor-pointer transition-transform duration-700 shadow-sm hover:shadow-lg rounded-xl"
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
        className="w-full h-full cursor-pointer transition-transform duration-700 shadow-sm hover:shadow-lg rounded-xl"
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

// ─────────────────────────────────────────────
// MAIN COMPONENT EXPORT
// ─────────────────────────────────────────────
export const OverviewSection = ({ project, moduleConfig, timePeriod, dateRange, airAverages, energyAverages, onNavigate, benchmarkMatrix }: OverviewSectionProps) => {
  const { t, language } = useLanguage();
  
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

  // Calcolo score per gli Alert sul Fingerprint (100 = perfetto, degrada con gli allarmi)
  const alertFingerprintScore = alertStatus.hasAlerts ? Math.max(0, 100 - (alertStatus.criticalCount * 25 + alertStatus.warningCount * 10)) : 100;

  return (
    <div className="px-3 md:px-16 mb-4 md:mb-8">
      {/* ── NUOVO LAYOUT ORIZZONTALE TOP (ScoreHero + Fingerprint) ── */}
      <div className="flex flex-col xl:flex-row gap-4 mb-4 md:mb-6">
        <ScoreHero
          className="flex-1"
          score={overallStatus.score}
          level={overallStatus.level}
          isLive={overallStatus.isLive}
          periodLabel={periodLabel}
          isRealData={liveData.isRealData || powerLatest.isRealData}
          alertStatus={alertStatus}
          timePeriod={timePeriod}
          modules={{
            energy: { score: energyStatus.score, enabled: moduleConfig.energy.enabled, isLive: energyStatus.isLive },
            air:    { score: airStatus.score,    enabled: moduleConfig.air.enabled,    isLive: airStatus.isLive    },
            water:  { score: waterStatus.score,  enabled: moduleConfig.water.enabled,  isLive: waterStatus.isLive  },
          }}
          onModuleClick={(mod: string) => onNavigate && onNavigate(mod)}
        />

        <Card className="xl:w-[320px] shrink-0 p-6 flex flex-col items-center justify-center bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2 w-full text-center">Site Fingerprint</div>
          <BuildingFingerprint
            level={overallStatus.level}
            axes={{
              score:  { label: "Score",  value: overallStatus.score },
              energy: { label: "Energy", value: moduleConfig.energy.enabled ? energyStatus.score : 0 },
              air:    { label: "Air",    value: moduleConfig.air.enabled ? airStatus.score : 0 },
              water:  { label: "Water",  value: moduleConfig.water.enabled ? waterStatus.score : 0 },
              alerts: { label: "Alerts", value: alertFingerprintScore },
            }}
          />
        </Card>
      </div>
      
      {/* ── 3 EXECUTIVE CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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
