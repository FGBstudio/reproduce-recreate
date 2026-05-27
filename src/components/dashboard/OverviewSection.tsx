/**
 * ScoreHero.tsx
 * Drop-in replacement for the overall score block inside OverviewSection.
 *
 * Usage:
 *   import { ScoreHero } from "@/components/ScoreHero";
 *
 *   <ScoreHero
 *     score={overallStatus.score}
 *     level={overallStatus.level}
 *     isLive={overallStatus.isLive}
 *     periodLabel={periodLabel}
 *     peerPercentile={8}          // optional – "top N% of buildings"
 *     modules={{
 *       energy: { score: energyStatus.score, enabled: moduleConfig.energy.enabled, isLive: energyStatus.isLive },
 *       air:    { score: airStatus.score,    enabled: moduleConfig.air.enabled,    isLive: airStatus.isLive    },
 *       water:  { score: waterStatus.score,  enabled: moduleConfig.water.enabled,  isLive: waterStatus.isLive  },
 *     }}
 *     onModuleClick={(mod) => onNavigate?.(mod)}
 *   />
 *
 * Dependencies already present in the project:
 *   - lucide-react  (Zap, Wind, Droplet, Activity)
 *   - tailwindcss
 *   - React 18+
 *
 * No new dependencies required.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Zap, Wind, Droplet } from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StatusLevel = "GOOD" | "OK" | "WARNING" | "CRITICAL";

interface ModuleData {
  score: number;
  enabled: boolean;
  isLive: boolean;
}

interface ScoreHeroProps {
  score: number;
  level: StatusLevel;
  isLive: boolean;
  periodLabel: string;
  peerPercentile?: number;     // e.g. 8 → "Top 8% of monitored buildings"
  modules: {
    energy: ModuleData;
    air: ModuleData;
    water: ModuleData;
  };
  onModuleClick?: (module: "energy" | "air" | "water") => void;
  className?: string;
}

// ─────────────────────────────────────────────
// Status tokens
// ─────────────────────────────────────────────

const STATUS_TOKENS: Record<StatusLevel, {
  word: string;
  trackColor: string;       // Tailwind bg class for the progress track fill
  ringColor: string;        // hex for the SVG stroke
  ringBg: string;           // hex for the SVG track background
  textColor: string;        // Tailwind text class
  modIconBg: string;        // Tailwind bg for active module icon
  modIconText: string;      // Tailwind text for active module icon
}> = {
  GOOD: {
    word: "Good",
    trackColor: "bg-emerald-500",
    ringColor: "#1D9E75",
    ringBg: "#E1F5EE",
    textColor: "text-emerald-600",
    modIconBg: "bg-emerald-50",
    modIconText: "text-emerald-700",
  },
  OK: {
    word: "Ok",
    trackColor: "bg-blue-500",
    ringColor: "#378ADD",
    ringBg: "#E6F1FB",
    textColor: "text-blue-600",
    modIconBg: "bg-blue-50",
    modIconText: "text-blue-700",
  },
  WARNING: {
    word: "Warning",
    trackColor: "bg-amber-500",
    ringColor: "#EF9F27",
    ringBg: "#FAEEDA",
    textColor: "text-amber-600",
    modIconBg: "bg-amber-50",
    modIconText: "text-amber-700",
  },
  CRITICAL: {
    word: "Critical",
    trackColor: "bg-red-500",
    ringColor: "#E24B4A",
    ringBg: "#FCEBEB",
    textColor: "text-red-600",
    modIconBg: "bg-red-50",
    modIconText: "text-red-700",
  },
};

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

/**
 * Animates a number from 0 to `target` over `duration` ms.
 * Restarts whenever `target` changes.
 */
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
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

/**
 * Returns true after `delay` ms — used to trigger CSS transitions
 * that need a single tick to register initial state.
 */
function useDelayedTrue(delay = 60): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  return ready;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/** Animated SVG ring. Circumference = 2π × 31 ≈ 194.78 */
const RING_R = 31;
const RING_CIRC = 2 * Math.PI * RING_R;

interface ScoreRingProps {
  score: number;
  level: StatusLevel;
  animatedScore: number;
}

function ScoreRing({ score, level, animatedScore }: ScoreRingProps) {
  const tokens = STATUS_TOKENS[level];
  const mounted = useDelayedTrue(60);

  // strokeDashoffset: full gap = RING_CIRC (empty), 0 = full
  const offset = mounted
    ? RING_CIRC * (1 - score / 100)
    : RING_CIRC;

  return (
    <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
      <svg
        width={80}
        height={80}
        viewBox="0 0 80 80"
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={40} cy={40} r={RING_R}
          fill="none"
          stroke={tokens.ringBg}
          strokeWidth={7}
        />
        {/* Fill */}
        <circle
          cx={40} cy={40} r={RING_R}
          fill="none"
          stroke={tokens.ringColor}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span
          className={`text-xl font-medium leading-none tracking-tight ${tokens.textColor}`}
          aria-live="polite"
          aria-label={`Score ${animatedScore}`}
        >
          {animatedScore}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-gray-400 mt-0.5">
          score
        </span>
      </div>
    </div>
  );
}

/** Thin animated progress bar under the status word */
function TrackBar({ score, level }: { score: number; level: StatusLevel }) {
  const tokens = STATUS_TOKENS[level];
  const mounted = useDelayedTrue(80);

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="h-[3px] w-[160px] rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${tokens.trackColor}`}
          style={{
            width: mounted ? `${score}%` : "0%",
            transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
      <span className="text-[11px] text-gray-400 tabular-nums">
        {score} / 100
      </span>
    </div>
  );
}

/** Single module indicator pill */
interface ModPillProps {
  icon: React.ReactNode;
  label: string;
  score: number;
  enabled: boolean;
  isLive: boolean;
  level: StatusLevel;
  onClick?: () => void;
}

function ModPill({ icon, label, score, enabled, isLive, level, onClick }: ModPillProps) {
  const tokens = STATUS_TOKENS[level];
  const active = enabled && isLive;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={[
        "flex flex-col items-center gap-1 min-w-[52px] group",
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
      aria-label={`${label} module — score ${enabled ? score : "disabled"}`}
    >
      {/* Icon circle */}
      <div
        className={[
          "w-9 h-9 rounded-[10px] flex items-center justify-center",
          "border transition-all duration-200",
          active
            ? `${tokens.modIconBg} ${tokens.modIconText} border-transparent group-hover:scale-105`
            : "bg-gray-50 text-gray-300 border-gray-100",
        ].join(" ")}
      >
        {icon}
      </div>

      {/* Score or dash */}
      <span
        className={[
          "text-[13px] font-medium tabular-nums leading-none",
          active ? "text-gray-800" : "text-gray-300",
        ].join(" ")}
      >
        {active ? score : "—"}
      </span>

      {/* Label */}
      <span className="text-[9px] uppercase tracking-wider text-gray-400">
        {label}
      </span>
    </button>
  );
}

/** Thin vertical separator between module pills */
function ModSep() {
  return <div className="w-px h-8 bg-gray-100 self-center flex-shrink-0" aria-hidden="true" />;
}

// ─────────────────────────────────────────────
// Live indicator badge
// ─────────────────────────────────────────────

function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wider uppercase",
        isLive
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-gray-100 text-gray-400 border border-gray-200",
      ].join(" ")}
    >
      <span
        className={[
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-300",
        ].join(" ")}
        aria-hidden="true"
      />
      {isLive ? "Live" : "Offline"}
    </span>
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export function ScoreHero({
  score,
  level,
  isLive,
  periodLabel,
  peerPercentile,
  modules,
  onModuleClick,
  className = "",
}: ScoreHeroProps) {
  const tokens = STATUS_TOKENS[level];
  const animatedScore = useCountUp(score, 1100);

  const handleModClick = useCallback(
    (mod: "energy" | "air" | "water") => () => onModuleClick?.(mod),
    [onModuleClick]
  );

  return (
    <div
      className={[
        "flex flex-col md:flex-row md:items-center gap-4 md:gap-6",
        "px-4 md:px-6 py-4 md:py-5",
        "border-b border-gray-100",
        className,
      ].join(" ")}
    >
      {/* ── LEFT: Ring + status text ── */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <ScoreRing
          score={score}
          level={level}
          animatedScore={animatedScore}
        />

        <div className="min-w-0">
          {/* eyebrow: period + live badge */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">
              {periodLabel}
            </span>
            <LiveBadge isLive={isLive} />
          </div>

          {/* status word */}
          <div
            className={[
              "text-[26px] md:text-[28px] font-medium leading-none tracking-tight",
              tokens.textColor,
            ].join(" ")}
          >
            {tokens.word}
          </div>

          {/* sub-line */}
          <div className="text-[12px] text-gray-500 mt-1 leading-snug">
            Overall performance
            {peerPercentile != null && (
              <> · Top <strong className="font-medium text-gray-700">{peerPercentile}%</strong> of monitored buildings</>
            )}
          </div>

          {/* track bar */}
          <TrackBar score={score} level={level} />
        </div>
      </div>

      {/* ── DIVIDER (md+) ── */}
      <div className="hidden md:block w-px h-12 bg-gray-100 flex-shrink-0" aria-hidden="true" />

      {/* ── RIGHT: Module pills ── */}
      <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
        <ModPill
          icon={<Zap className="w-4 h-4" aria-hidden="true" />}
          label="Energy"
          score={modules.energy.score}
          enabled={modules.energy.enabled}
          isLive={modules.energy.isLive}
          level={level}
          onClick={modules.energy.enabled ? handleModClick("energy") : undefined}
        />
        <ModSep />
        <ModPill
          icon={<Wind className="w-4 h-4" aria-hidden="true" />}
          label="Air"
          score={modules.air.score}
          enabled={modules.air.enabled}
          isLive={modules.air.isLive}
          level={level}
          onClick={modules.air.enabled ? handleModClick("air") : undefined}
        />
        <ModSep />
        <ModPill
          icon={<Droplet className="w-4 h-4" aria-hidden="true" />}
          label="Water"
          score={modules.water.score}
          enabled={modules.water.enabled}
          isLive={modules.water.isLive}
          level={level}
          onClick={modules.water.enabled ? handleModClick("water") : undefined}
        />
      </div>
    </div>
  );
}

export default ScoreHero;
