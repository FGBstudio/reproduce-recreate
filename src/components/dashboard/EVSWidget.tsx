import { useMemo } from 'react';
import { Zap, Wind, Droplet, Eye, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ModuleKey = 'energy' | 'air' | 'water';

interface ModuleState {
  enabled: boolean;
  hasLiveData: boolean;
  hasError?: boolean;
}

interface EVSWidgetProps {
  modules: Record<ModuleKey, ModuleState>;
  onActivateModule?: (module: ModuleKey) => void;
}

const MODULE_META: Record<ModuleKey, { label: string; icon: typeof Zap; activeColor: string; activeBg: string }> = {
  energy: { label: 'Energy', icon: Zap, activeColor: 'text-amber-500', activeBg: 'bg-amber-100' },
  air:    { label: 'Air',    icon: Wind, activeColor: 'text-blue-500', activeBg: 'bg-blue-100' },
  water:  { label: 'Water',  icon: Droplet, activeColor: 'text-cyan-500', activeBg: 'bg-cyan-100' },
};

const TOTAL_MODULES = 3;

/** Compact donut SVG rendered purely with stroke-dasharray */
const DonutChart = ({ percentage, color }: { percentage: number; color: string }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const filled = (percentage / 100) * circumference;
  const gap = circumference - filled;

  return (
    <svg viewBox="0 0 80 80" className="w-16 h-16 md:w-[72px] md:h-[72px]">
      {/* Background track */}
      <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="7"
        className="text-gray-200" />
      {/* Filled arc */}
      <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${filled} ${gap}`}
        strokeDashoffset={circumference * 0.25} /* start from top */
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
};

const getEVSLevel = (score: number) => {
  if (score >= 100) return { label: 'Full Control', color: '#10b981', textClass: 'text-emerald-500', Icon: ShieldCheck };
  if (score >= 66)  return { label: 'Good Coverage', color: '#3b82f6', textClass: 'text-blue-500', Icon: ShieldAlert };
  if (score >= 34)  return { label: 'Partial Vision', color: '#f59e0b', textClass: 'text-amber-500', Icon: ShieldAlert };
  return { label: 'High Risk', color: '#ef4444', textClass: 'text-red-500', Icon: ShieldX };
};

export const EVSWidget = ({ modules, onActivateModule }: EVSWidgetProps) => {
  const { score, activeCount, level } = useMemo(() => {
    const active = (Object.keys(modules) as ModuleKey[]).filter(k => modules[k].enabled).length;
    const s = Math.round((active / TOTAL_MODULES) * 100);
    return { score: s, activeCount: active, level: getEVSLevel(s) };
  }, [modules]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-3">
        {/* Donut with score */}
        <div className="relative flex-shrink-0">
          <DonutChart percentage={score} color={level.color} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold leading-none ${level.textClass}`}>{score}%</span>
          </div>
        </div>

        {/* Label + module pills */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <Eye className={`w-3.5 h-3.5 flex-shrink-0 ${level.textClass}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${level.textClass}`}>
              {level.label}
            </span>
          </div>
          <div className="text-[9px] text-gray-500 leading-tight">
            {activeCount}/{TOTAL_MODULES} moduli attivi
          </div>
          {/* Module indicators */}
          <div className="flex gap-1">
            {(Object.keys(MODULE_META) as ModuleKey[]).map(key => {
              const meta = MODULE_META[key];
              const state = modules[key];
              const Icon = meta.icon;

              const isOn = state.enabled;
              const hasError = state.enabled && state.hasError;

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOn && onActivateModule) onActivateModule(key);
                      }}
                      className={`
                        w-7 h-7 rounded-full flex items-center justify-center transition-all
                        ${hasError
                          ? 'bg-red-100 text-red-500 animate-pulse ring-1 ring-red-300'
                          : isOn
                            ? `${meta.activeBg} ${meta.activeColor}`
                            : 'bg-gray-200 text-gray-400 hover:bg-gray-300 cursor-pointer'
                        }
                      `}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <span className="font-medium">{meta.label}:</span>{' '}
                    {hasError ? 'Errore sensore' : isOn ? 'Attivo' : 'Non attivo — clicca per attivare'}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default EVSWidget;
