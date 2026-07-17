"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Project } from "@/lib/data";
import { Zap, Wind, Droplet, Activity, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, RotateCcw, Fan, Lightbulb, Plug, MoreHorizontal, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRealTimeLatestData } from "@/hooks/useRealTimeTelemetry";
import { DataSourceBadge } from "./DataSourceBadge";
import { useThresholdAlerts, getMetricStatus, type ThresholdAlert } from "@/hooks/useThresholdAlerts";
import { useSiteThresholds } from "@/hooks/useSiteThresholds";
import { useEnergyPowerByCategory } from "@/hooks/useEnergyPowerByCategory";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveTimezone, getPartsInTz } from "@/lib/timezoneUtils";
import { useFingerprintVerdict } from "@/hooks/useFingerprintVerdict";

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

const getLiveBadgeColor = (isLive: boolean) => isLive ? "bg-emerald-500 text-foreground" : "bg-gray-400 text-foreground";

const formatMaybe = (value: number | undefined, digits = 1) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
const formatMaybeInt = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "—";

const MODULE_WEIGHTS = { energy: 0.80, air: 0.05, water: 0.15 };

const STATUS_TOKENS: Record<StatusLevel, { word: string; trackColor: string; ringColor: string; ringBg: string; textColor: string; modIconBg: string; modIconText: string; }> = {
  GOOD: { word: "Good", trackColor: "bg-[#009293]", ringColor: "#009293", ringBg: "#E4F3F3", textColor: "text-[#006367]", modIconBg: "bg-[#E4F3F3]", modIconText: "text-[#006367]" },
  OK: { word: "Ok", trackColor: "bg-[#a0d5d6]", ringColor: "#a0d5d6", ringBg: "#EEF7F7", textColor: "text-[#006367]", modIconBg: "bg-[#EEF7F7]", modIconText: "text-[#006367]" },
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

const RING_R = 76;
const RING_CIRC = 2 * Math.PI * RING_R;

function ScoreRing({ score, level, animatedScore }: { score: number; level: StatusLevel; animatedScore: number }) {
  const tokens = STATUS_TOKENS[level];
  const mounted = useDelayedTrue(60);
  const offset = mounted ? RING_CIRC * (1 - score / 100) : RING_CIRC;

  return (
    <div className="relative flex-shrink-0 w-[140px] h-[140px] md:w-[180px] md:h-[180px]">
      <svg className="w-full h-full" viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={90} cy={90} r={RING_R} fill="none" stroke={tokens.ringBg} strokeWidth={12} />
        <circle cx={90} cy={90} r={RING_R} fill="none" stroke={tokens.ringColor} strokeWidth={12} strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-[44px] md:text-[64px] font-semibold leading-none tracking-tight ${tokens.textColor}`} aria-live="polite">{animatedScore}</span>
        <span className="text-[10px] md:text-[12px] uppercase tracking-widest text-[#006367]/70 mt-1 md:mt-1.5 font-medium">score</span>
      </div>
    </div>
  );
}

function TrackBar({ score, level }: { score: number; level: StatusLevel }) {
  const tokens = STATUS_TOKENS[level];
  const mounted = useDelayedTrue(80);
  return (
    <div className="flex items-center gap-2 md:gap-3 mt-2 md:mt-3">
      <div className="h-[4px] md:h-[6px] w-full max-w-[200px] md:max-w-[280px] rounded-full bg-[#E4F3F3] overflow-hidden">
        <div className={`h-full rounded-full ${tokens.trackColor}`} style={{ width: mounted ? `${score}%` : "0%", transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span className="text-[13px] md:text-[15px] text-[#006367] tabular-nums font-medium">{score} / 100</span>
    </div>
  );
}

function InfoDot({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[#006367]/60 hover:text-[#006367] hover:bg-[#E4F3F3] transition-colors"
            aria-label="More info"
            onClick={(e) => e.stopPropagation()}
          >
            <Info className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-[12px] leading-snug bg-white text-slate-700 border border-[#a0d5d6]/60 shadow-md">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const MOD_INFO: Record<string, string> = {
  energy: "Punteggio Energia (0-100). Confronta i consumi reali con la baseline attesa: valori più alti indicano un edificio efficiente e vicino al target di consumo.",
  air: "Punteggio Aria (0-100). Basato su CO₂, VOC, PM2.5 e temperatura indoor rispetto alle soglie WHO: valori alti = aria salubre.",
  water: "Punteggio Acqua (0-100). Confronta i consumi idrici e le anomalie di flusso con la baseline: valori alti = uso efficiente e nessuna perdita.",
  alerts: "Numero di anomalie aperte (Critical + Warning) sul sito. Le Critical richiedono intervento immediato.",
};

function ModPill({ icon, label, score, enabled, isLive, level, onClick, infoText }: any) {
  const tokens = STATUS_TOKENS[level];
  const active = enabled && isLive;
  return (
    <div className="flex flex-col items-center gap-1.5 md:gap-2 min-w-[72px] @[860px]:min-w-[92px]">
      <button onClick={onClick} disabled={!onClick} className={`flex flex-col items-center gap-1.5 md:gap-2 group ${onClick ? "cursor-pointer" : "cursor-default"}`}>
      <div className={`w-[56px] h-[56px] md:w-[72px] md:h-[72px] rounded-[14px] md:rounded-[18px] flex items-center justify-center border transition-all duration-200 ${active ? `${tokens.modIconBg} ${tokens.modIconText} border-transparent group-hover:scale-105` : "bg-gray-50 text-slate-600 border-gray-100"}`}>
        {icon}
      </div>
      <span className={`text-[24px] md:text-[30px] font-semibold tabular-nums leading-none ${active ? "text-[#006367]" : "text-slate-600"}`}>{active ? score : "—"}</span>
      </button>
      <div className="flex items-center gap-1">
        <span className="text-[10px] md:text-[12px] uppercase tracking-wider text-[#006367]/80 font-medium">{label}</span>
        {infoText && <InfoDot text={infoText} />}
      </div>
    </div>
  );
}

function ModSep() { return <div className="hidden @[560px]:block w-px h-12 md:h-16 bg-[#a0d5d6]/40 self-center flex-shrink-0" aria-hidden="true" />; }

function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider uppercase ${isLive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-slate-600 border border-gray-200"}`}>
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
      <div className={`relative flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-8 px-4 md:px-8 py-4 md:py-8 h-full`}>
        {/* ── LEFT: Ring + status text ── */}
        <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
          <ScoreRing score={score} level={level} animatedScore={animatedScore} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] md:text-[11px] uppercase tracking-widest text-[#006367] font-semibold">{periodLabel}</span>
              <LiveBadge isLive={isLive} />
              <DataSourceBadge isRealData={isRealData} size="sm" />
            </div>
            <div className={`text-[36px] md:text-[56px] font-semibold leading-none tracking-tight ${tokens.textColor}`}>
              {tokens.word}
            </div>
            <div className="text-[14px] md:text-[16px] text-[#006367] mt-1.5 md:mt-2 leading-snug flex items-center gap-1.5 flex-wrap">
              <span className="font-medium">Overall performance</span>
              <InfoDot text="Media ponderata dei tre indici del sito: 80% Energia, 15% Acqua, 5% Aria. Un valore alto (≥ 80) significa un edificio efficiente, con aria salubre e nessuna perdita d'acqua." />
              {peerPercentile != null && (<span className="text-slate-500">· Top <strong className="font-semibold text-[#006367]">{peerPercentile}%</strong> of monitored buildings</span>)}
            </div>
            <TrackBar score={score} level={level} />
          </div>
        </div>

        {/* ── DIVIDER (xl+) ── */}
        <div className="hidden xl:block w-px h-32 bg-[#a0d5d6]/40 flex-shrink-0" aria-hidden="true" />

        {/* ── RIGHT: Module pills + Alerts ── */}
        <div className="flex items-center gap-4 md:gap-7 flex-shrink-0 overflow-x-auto pb-2 xl:pb-0">
          <ModPill icon={<Zap className="w-6 h-6 md:w-7 md:h-7" aria-hidden="true" />} label="Energy" score={modules.energy.score} enabled={modules.energy.enabled} isLive={modules.energy.isLive} level={level} onClick={modules.energy.enabled ? handleModClick("energy") : undefined} infoText={MOD_INFO.energy} />
          <ModSep />
          <ModPill icon={<Wind className="w-6 h-6 md:w-7 md:h-7" aria-hidden="true" />} label="Air" score={modules.air.score} enabled={modules.air.enabled} isLive={modules.air.isLive} level={level} onClick={modules.air.enabled ? handleModClick("air") : undefined} infoText={MOD_INFO.air} />
          <ModSep />
          <ModPill icon={<Droplet className="w-6 h-6 md:w-7 md:h-7" aria-hidden="true" />} label="Water" score={modules.water.score} enabled={modules.water.enabled} isLive={modules.water.isLive} level={level} onClick={modules.water.enabled ? handleModClick("water") : undefined} infoText={MOD_INFO.water} />
          <ModSep />
          <div className="flex flex-col items-center gap-1.5 md:gap-2 min-w-[76px] md:min-w-[92px]">
            <div className={`w-[56px] h-[56px] md:w-[72px] md:h-[72px] rounded-[14px] md:rounded-[18px] flex items-center justify-center border transition-all ${alertStatus.hasAlerts ? 'bg-red-50 text-red-600 border-red-100 hover:scale-105' : 'bg-[#E4F3F3] text-[#006367] border-[#a0d5d6]/40'}`}>
              {alertStatus.hasAlerts ? <AlertTriangle className="w-6 h-6 md:w-7 md:h-7" /> : <Activity className="w-6 h-6 md:w-7 md:h-7" />}
            </div>
            <span className={`text-[24px] md:text-[30px] font-semibold tabular-nums leading-none ${alertStatus.hasAlerts ? 'text-red-600' : 'text-[#006367]'}`}>
              {alertStatus.hasAlerts ? alertStatus.criticalCount + alertStatus.warningCount : "0"}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] md:text-[12px] uppercase tracking-wider text-[#006367]/80 font-medium">Alerts</span>
              <InfoDot text={MOD_INFO.alerts} />
            </div>
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
const EnergyCard = ({ status, enabled, onClick, powerData, averageData, threshold, periodLabel, project, benchmarkMatrix, isFlipped, onToggleFlip, timePeriod }: any) => {
  const { t } = useLanguage();
  
  const isToday = timePeriod === 'today';
  const isStale = (powerData?.isStale ?? false) && isToday;

  const readings = useMemo(() => {
    if ((!powerData?.isRealData && !powerData?.isStale) || isStale) {
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
  }, [powerData, project, benchmarkMatrix, isStale]);

  if (!enabled) return (
    <div className="w-full h-[320px] rounded-xl border bg-gray-100 flex flex-col p-6 text-slate-600">
      <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center"><Zap className="w-5 h-5" /></div><Badge className="bg-gray-400 text-foreground text-[10px]">DISABLED</Badge></div>
      <div className="text-4xl font-bold mb-1">N/A</div>
      <div className="text-base uppercase tracking-wide">Energy Performance</div>
    </div>
  );

  const currentPower = isStale ? undefined : readings.totalPower;
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
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-white ${isStale ? 'border-gray-200' : getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden" }}>
          <div className="flex items-center justify-between mb-auto">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full ${isStale ? 'bg-gray-100 text-gray-400' : `${getStatusIconBg(status.level)} ${getStatusColor(status.level)}`} flex items-center justify-center`}>
                <Zap className="w-5 h-5" />
              </div>
              <Badge className={`${isToday ? (isStale ? 'bg-gray-400 text-foreground' : getLiveBadgeColor(status.isLive)) : 'bg-gray-500 text-foreground'} text-[10px] uppercase tracking-wider`}>
                {isToday ? (isStale ? '-' : 'LIVE') : timePeriod.toUpperCase()}
              </Badge>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isStale ? 'text-gray-400' : getStatusColor(status.level)}`}>{isStale ? '-' : status.level}</div>
              <div className="text-[10px] text-slate-600 uppercase">Score {status.score}</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-xs font-bold tracking-widest text-slate-600 uppercase mb-1">{t('overview.energy_performance')}</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-5xl font-black tracking-tighter ${isCriticalVal ? 'text-red-500' : 'text-gray-900'}`}>{formatMaybe(currentPower, 1)}</span>
              <span className="text-sm font-bold text-slate-600">kW</span>
            </div>
            
            {showAvg ? (
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="text-slate-600 font-medium">Avg {periodLabel}: <span className="font-bold text-gray-700">{formatMaybe(avgPower, 1)} kW</span></span>
                <span className={`flex items-center font-bold px-1.5 py-0.5 rounded-full ${isPowerHigher ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {isPowerHigher ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {Math.abs(powerDelta).toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="text-xs font-medium text-slate-600 mb-1">Analisi media in corso...</div>
            )}

            {threshold && (
               <div className="text-xs font-medium text-slate-600 mt-1 pt-1 border-t border-gray-100">
                  {t('overview.limit')}: <span className="font-bold text-gray-700">{threshold.toFixed(1)} kW</span>
               </div>
            )}
          </div>

          <div className="mt-auto pt-4 flex justify-between items-end">
            <div/>
            <button 
              onClick={onToggleFlip}
              className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center border transition-colors shadow-sm"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* RETRO */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-gray-50 ${getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
            <span className="text-sm font-bold tracking-tight text-gray-900 uppercase">Live Load Distribution</span>
            <ArrowUpRight className="w-5 h-5 text-slate-600" />
          </div>
          
          <div className="space-y-3 text-sm flex-1">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600"><Fan className="w-4 h-4"/>HVAC</div><span className="font-bold text-gray-800">{formatMaybe(readings.hvac.value, 1)} kW</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600"><Lightbulb className="w-4 h-4"/>Lighting</div><span className="font-bold text-gray-800">{formatMaybe(readings.lighting.value, 1)} kW</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600"><Plug className="w-4 h-4"/>Plugs & Loads</div><span className="font-bold text-gray-800">{formatMaybe(readings.plugs.value, 1)} kW</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-2 text-gray-600"><MoreHorizontal className="w-4 h-4"/>Other</div><span className="font-bold text-gray-800">{formatMaybe(readings.other.value, 1)} kW</span></div>
          </div>

          <div className="mt-auto pt-4 flex justify-between items-center">
             {(readings.hvac.isSimulated) && <span className="text-[10px] text-slate-600 italic">Virtual Submeters</span>}
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
const AirCard = ({ status, enabled, onClick, liveData, averageMetrics, periodLabel, isFlipped, onToggleFlip, timePeriod, isStale }: any) => {
  const { t } = useLanguage();
  
  const isToday = timePeriod === 'today';
  const isCardStale = isStale && isToday;

  const readings = useMemo(() => {
    const m = (!!liveData?.isRealData && !isCardStale) ? liveData!.metrics : {};
    return {
      co2: { value: m['iaq.co2'] ?? m['co2'], unit: "ppm" },
      tvoc: { value: m['iaq.voc'] ?? m['tvoc'], unit: "ppb" },
      pm25: { value: m['iaq.pm25'] ?? m['pm25'], unit: "µg/m³" },
      pm10: { value: m['iaq.pm10'] ?? m['pm10'], unit: "µg/m³" },
      temp: { value: m['env.temperature'] ?? m['temperature'], unit: "°C" },
      humidity: { value: m['env.humidity'] ?? m['humidity'], unit: "%" },
    };
  }, [liveData, isCardStale]);

  if (!enabled) return (
    <div className="w-full h-[320px] rounded-xl border bg-gray-100 flex flex-col p-6 text-slate-600">
      <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center"><Wind className="w-5 h-5" /></div><Badge className="bg-gray-400 text-foreground text-[10px]">DISABLED</Badge></div>
      <div className="text-4xl font-bold mb-1">N/A</div>
      <div className="text-base uppercase tracking-wide">Indoor Air Quality</div>
    </div>
  );

  const currentCo2 = isCardStale ? undefined : readings.co2.value;
  const avgCo2 = averageMetrics?.['iaq.co2'] ?? averageMetrics?.['co2'];

  // Indice sintetico = stesso score aria dell'app (già passato via `status.score`).
  // Calcolo lo score medio periodo con la stessa formula usata in airStatus (CO2 → 0-100).
  const co2ToScore = (co2: number) => Math.round(Math.max(0, Math.min(100, 100 - ((co2 - 400) / 600) * 100)));
  const currentScore = isCardStale ? undefined : (typeof status?.score === 'number' ? status.score : undefined);
  const avgScore = typeof avgCo2 === 'number' ? co2ToScore(avgCo2) : undefined;
  const showAvgScore = avgScore != null && currentScore != null && avgScore > 0;
  const scoreDelta = showAvgScore ? currentScore - avgScore : 0;
  const isScoreBetter = scoreDelta > 0; // score più alto = aria migliore

  // 4 bande stile Dyson
  const AQI_BANDS = [
    { min: 0,  max: 39,  label: 'Critical',  bg: 'bg-red-500',     text: 'text-red-600',     gradient: 'bg-gradient-to-br from-red-500 to-red-400'     },
    { min: 40, max: 64,  label: 'OK',        bg: 'bg-amber-500',   text: 'text-amber-600',   gradient: 'bg-gradient-to-br from-amber-500 to-amber-400'   },
    { min: 65, max: 84,  label: 'Good',      bg: 'bg-lime-400',    text: 'text-lime-600',    gradient: 'bg-gradient-to-br from-lime-400 to-lime-300'    },
    { min: 85, max: 100, label: 'Very Good', bg: 'bg-emerald-500', text: 'text-emerald-600', gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-400' },
  ];
  const activeBandIdx = typeof currentScore === 'number'
    ? AQI_BANDS.findIndex(b => currentScore >= b.min && currentScore <= b.max)
    : -1;
  const activeBand = activeBandIdx >= 0 ? AQI_BANDS[activeBandIdx] : null;
  const scoreClass = isCardStale || currentScore == null
    ? "text-5xl font-black tracking-tighter text-gray-400"
    : activeBand
      ? `text-5xl font-black tracking-tighter bg-clip-text text-transparent ${activeBand.gradient}`
      : "text-5xl font-black tracking-tighter text-gray-900";

  return (
    <div className="relative w-full h-[320px]" style={{ perspective: "1500px" }}>
      <div
         className="w-full h-full cursor-pointer transition-transform duration-700 shadow-sm hover:shadow-lg rounded-xl"
         style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)", transitionTimingFunction: easeCurve }}
         onClick={onClick}
      >
        {/* FRONTE */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-white ${isCardStale ? 'border-gray-200' : getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden" }}>
          <div className="flex items-center justify-between mb-auto">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full ${isCardStale ? 'bg-gray-100 text-gray-400' : `${getStatusIconBg(status.level)} ${getStatusColor(status.level)}`} flex items-center justify-center`}><Wind className="w-5 h-5" /></div>
              <Badge className={`${isToday ? (isCardStale ? 'bg-gray-400 text-foreground' : getLiveBadgeColor(status.isLive)) : 'bg-gray-500 text-foreground'} text-[10px] uppercase tracking-wider`}>
                {isToday ? (isCardStale ? '-' : 'LIVE') : timePeriod.toUpperCase()}
              </Badge>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold uppercase ${isCardStale ? 'text-gray-400' : (activeBand ? activeBand.text : getStatusColor(status.level))}`}>
                {isCardStale ? '-' : (activeBand ? activeBand.label : status.level)}
              </div>
              <div className="text-[10px] text-slate-600 uppercase">Score {status.score}</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-xs font-bold tracking-widest text-slate-600 uppercase mb-1">{t('overview.indoor_air_quality')}</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className={scoreClass}>{currentScore ?? '—'}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('overview.aqi_title')}</span>
            </div>

            {showAvgScore ? (
              <div className="flex items-center gap-2 text-xs mb-2">
                <span className="text-slate-600 font-medium">Avg {periodLabel}: <span className="font-bold text-gray-700">{avgScore}</span></span>
                <span className={`flex items-center font-bold px-1.5 py-0.5 rounded-full ${isScoreBetter ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {isScoreBetter ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {Math.abs(scoreDelta)}
                </span>
              </div>
            ) : (
              <div className="text-xs font-medium text-slate-600 mb-2">Analisi media in corso...</div>
            )}

            {/* Etichette bande AQI */}
            <div className="mt-2 flex justify-between text-[9px] uppercase tracking-wider">
              {AQI_BANDS.map((b, i) => (
                <span key={i} className={activeBandIdx === i ? `font-bold ${b.text}` : 'text-slate-400 font-medium'}>
                  {t(`overview.aqi_band_${b.label.toLowerCase().replace(' ', '_')}`) || b.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4 flex justify-between items-end">
            <div/>
            <button onClick={onToggleFlip} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center border transition-colors shadow-sm"><RotateCcw className="w-4 h-4 text-slate-600" /></button>
          </div>
        </div>

        {/* RETRO */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-gray-50 ${getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
            <span className="text-sm font-bold tracking-tight text-gray-900 uppercase">Live Gas Diagnostics</span>
            <ArrowUpRight className="w-5 h-5 text-slate-600" />
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm flex-1">
            <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-600">CO₂</span><span className="font-bold text-gray-800">{formatMaybe(readings.co2.value, 0)} ppm</span></div>
            <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-600">TVOC</span><span className="font-bold text-gray-800">{formatMaybe(readings.tvoc.value, 0)} ppb</span></div>
            <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-600">PM2.5</span><span className="font-bold text-gray-800">{formatMaybe(readings.pm25.value, 1)} µg/m³</span></div>
            <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-600">PM10</span><span className="font-bold text-gray-800">{formatMaybe(readings.pm10.value, 1)} µg/m³</span></div>
            <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-600">Temp</span><span className="font-bold text-gray-800">{formatMaybe(readings.temp.value, 1)} °C</span></div>
            <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-600">Humidity</span><span className="font-bold text-gray-800">{formatMaybe(readings.humidity.value, 0)} %</span></div>
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
const WaterCard = ({ status, enabled, onClick, liveData, isFlipped, onToggleFlip, timePeriod, isStale }: any) => {
  const { t } = useLanguage();
  
  const isToday = timePeriod === 'today';
  const isCardStale = isStale && isToday;

  const readings = useMemo(() => {
    const isReal = !!liveData?.isRealData && !isCardStale;
    const m = isReal ? liveData!.metrics : {};
    const totalLiters = isReal ? m['water.total_liters'] : undefined;
    const flowRate = isReal ? m['water.flow_rate'] : undefined;
    return {
      dailyConsumption: typeof totalLiters === 'number' ? Math.round(totalLiters) : undefined,
      vsBaseline: undefined as number | undefined,
      activeLeaks: typeof flowRate === 'number' && flowRate > 0.5 && flowRate < 1 ? 1 : (typeof flowRate === 'number' ? 0 : undefined),
      efficiency: undefined as number | undefined,
    };
  }, [liveData, isCardStale]);

  if (!enabled) return (
    <div className="w-full h-[320px] rounded-xl border bg-gray-100 flex flex-col p-6 text-slate-600">
      <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center"><Droplet className="w-5 h-5" /></div><Badge className="bg-gray-400 text-foreground text-[10px]">DISABLED</Badge></div>
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
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-white ${isCardStale ? 'border-gray-200' : getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden" }}>
          <div className="flex items-center justify-between mb-auto">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full ${isCardStale ? 'bg-gray-100 text-gray-400' : `${getStatusIconBg(status.level)} ${getStatusColor(status.level)}`} flex items-center justify-center`}><Droplet className="w-5 h-5" /></div>
              <Badge className={`${isToday ? (isCardStale ? 'bg-gray-400 text-foreground' : getLiveBadgeColor(status.isLive)) : 'bg-gray-500 text-foreground'} text-[10px] uppercase tracking-wider`}>
                {isToday ? (isCardStale ? '-' : 'LIVE') : timePeriod.toUpperCase()}
              </Badge>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isCardStale ? 'text-gray-400' : getStatusColor(status.level)}`}>{isCardStale ? '-' : status.level}</div>
              <div className="text-[10px] text-slate-600 uppercase">Score {status.score}</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-xs font-bold tracking-widest text-slate-600 uppercase mb-1">{t('overview.water_consumption_title')}</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black tracking-tighter text-gray-900">{formatMaybeInt(readings.dailyConsumption)}</span>
              <span className="text-sm font-bold text-slate-600">L/day</span>
            </div>
            <div className="text-xs font-medium text-emerald-600 flex items-center gap-1"><TrendingDown className="w-3 h-3"/> Live water metrics</div>
          </div>

          <div className="mt-auto pt-4 flex justify-between items-end">
            <div/>
            <button onClick={onToggleFlip} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center border transition-colors shadow-sm"><RotateCcw className="w-4 h-4 text-slate-600" /></button>
          </div>
        </div>

        {/* RETRO */}
        <div className={`absolute inset-0 p-6 flex flex-col rounded-xl border bg-gray-50 ${getStatusBorderColor(status.level)}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
            <span className="text-sm font-bold tracking-tight text-gray-900 uppercase">Hydric Diagnostics</span>
            <ArrowUpRight className="w-5 h-5 text-slate-600" />
          </div>
          
          <div className="space-y-4 text-sm flex-1">
            <div className="flex flex-col"><span className="text-xs text-slate-600">{t('overview.efficiency')}</span><span className="text-xl font-bold text-emerald-600">98.2 %</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">{t('overview.active_leaks')}</span><span className={`text-xl font-black tracking-tight ${readings.activeLeaks ? "text-red-500" : "text-emerald-500"}`}>{readings.activeLeaks ? `${readings.activeLeaks} DETECTED` : "NONE"}</span></div>
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

  const ruleVerdict = useMemo(() => buildFingerprintVerdict({
    overall: overallStatus.score,
    energy: { score: energyStatus.score, enabled: moduleConfig.energy.enabled },
    air:    { score: airStatus.score,    enabled: moduleConfig.air.enabled },
    water:  { score: waterStatus.score,  enabled: moduleConfig.water.enabled },
    alerts: alertStatus,
  }), [overallStatus.score, energyStatus.score, airStatus.score, waterStatus.score, moduleConfig, alertStatus]);

  const verdict = useFingerprintVerdict({
    siteId: project.siteId,
    siteName: project.name,
    overall: overallStatus.score,
    modules: {
      energy: { enabled: moduleConfig.energy.enabled, score: energyStatus.score },
      air:    { enabled: moduleConfig.air.enabled,    score: airStatus.score },
      water:  { enabled: moduleConfig.water.enabled,  score: waterStatus.score },
    },
    alerts: { critical: alertStatus.criticalCount, warning: alertStatus.warningCount },
    telemetry: {
      co2:         liveData.metrics['iaq.co2'] ?? liveData.metrics['co2'] ?? null,
      temperature: liveData.metrics['env.temperature'] ?? liveData.metrics['temperature'] ?? null,
      humidity:    liveData.metrics['env.humidity'] ?? liveData.metrics['humidity'] ?? null,
      voc:         liveData.metrics['iaq.voc'] ?? liveData.metrics['voc'] ?? null,
      pm25:        liveData.metrics['iaq.pm25'] ?? liveData.metrics['pm25'] ?? null,
      powerKw:         powerLatest.isRealData ? (powerLatest.totalGeneral ?? null) : null,
      baselinePowerKw: energyAverages?.averagePowerKw ?? energyAverages?.avgPowerKw ?? null,
      hvacKw:          powerLatest.isRealData ? (powerLatest.hvac ?? null) : null,
      lightingKw:      powerLatest.isRealData ? (powerLatest.lighting ?? null) : null,
      waterFlow:       liveData.metrics['water.flow_rate'] ?? null,
      leakDetected:    (alertStatus.alerts || []).some((a: any) =>
        typeof a?.metric === 'string' && a.metric.toLowerCase().includes('leak')
      ),
    },
    fallback: ruleVerdict,
  });

  return (
    <div className="px-3 md:px-16 mb-4 md:mb-8">
      {/* ── NUOVO LAYOUT ORIZZONTALE TOP (ScoreHero + Fingerprint) ── */}
      <div className="flex flex-col xl:flex-row gap-4 mb-4 md:mb-6">
        <ScoreHero
          className="xl:flex-[2] min-w-0"
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

        <Card className="xl:flex-1 xl:min-w-[380px] xl:max-w-[460px] shrink-0 p-6 flex flex-col items-center justify-center bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="text-xs font-bold tracking-widest text-slate-600 uppercase mb-2 w-full text-center">Site Fingerprint</div>
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
          <div className="w-full mt-3 pt-3 border-t border-gray-100 flex flex-col items-center text-center">
            <div className={`text-sm font-semibold leading-tight ${STATUS_TOKENS[verdict.tone].textColor}`}>
              {verdict.headline}
            </div>
            <div className="text-[11px] text-slate-600 leading-snug mt-1 px-2">
              {verdict.reason}
            </div>
          </div>
        </Card>
      </div>
      
      {/* ── 3 EXECUTIVE CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <EnergyCard
          status={energyStatus} enabled={moduleConfig.energy.enabled} onClick={moduleConfig.energy.enabled ? () => onNavigate && onNavigate("energy") : undefined}
          powerData={powerLatest} averageData={energyAverages} threshold={thresholds?.energy_power_limit_kw} periodLabel={periodLabel} project={project} benchmarkMatrix={benchmarkMatrix}
          isFlipped={flippedCards.energy} onToggleFlip={(e: React.MouseEvent) => toggleFlip('energy', e)}
          timePeriod={timePeriod}
        />
        <AirCard
          status={airStatus} enabled={moduleConfig.air.enabled} project={project} onClick={moduleConfig.air.enabled ? () => onNavigate && onNavigate("air") : undefined}
          liveData={liveData} averageMetrics={airAverages} periodLabel={periodLabel}
          isFlipped={flippedCards.air} onToggleFlip={(e: React.MouseEvent) => toggleFlip('air', e)}
          timePeriod={timePeriod} isStale={liveData.isStale}
        />
        <WaterCard
          status={waterStatus} enabled={moduleConfig.water.enabled} onClick={moduleConfig.water.enabled ? () => onNavigate && onNavigate("water") : undefined} liveData={liveData}
          isFlipped={flippedCards.water} onToggleFlip={(e: React.MouseEvent) => toggleFlip('water', e)}
          timePeriod={timePeriod} isStale={liveData.isStale}
        />
      </div>
    </div>
  );
};

export default OverviewSection;
