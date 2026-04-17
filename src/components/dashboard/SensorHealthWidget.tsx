import { useState } from 'react';
import { 
  ShieldCheck, ShieldAlert, WifiOff, Activity, AlertTriangle, 
  ChevronDown, ChevronUp, ServerCrash 
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSensorHealth } from '@/hooks/useSensorHealth';
import { LegendTooltip } from '@/components/ui/LegendTooltip';

interface SensorHealthWidgetProps {
  siteId: string | undefined;
  moduleFilter?: 'air' | 'energy' | 'water';
}

export function SensorHealthWidget({ siteId, moduleFilter }: SensorHealthWidgetProps) {
  const { t } = useLanguage();
  const { 
    sensors, 
    averageTrustScore, 
    worstSensor,
    offlineCount, 
    flatliningCount, 
    flappingCount,
    isLoading 
  } = useSensorHealth(siteId, moduleFilter);

  const [expandedSensorId, setExpandedSensorId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[220px]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin mb-4" />
          <p className="text-sm font-semibold text-slate-400">Loading Health Data...</p>
        </div>
      </div>
    );
  }

  const isHealthy = averageTrustScore >= 80;
  const isWarning = averageTrustScore >= 50 && averageTrustScore < 80;
  
  const scoreColor = isHealthy ? 'text-emerald-500' : (isWarning ? 'text-amber-500' : 'text-rose-500');
  const gradientStops = isHealthy 
    ? { start: '#10b981', end: '#34d399' } // Emerald
    : isWarning 
      ? { start: '#f59e0b', end: '#fbbf24' } // Amber
      : { start: '#f43f5e', end: '#fb7185' }; // Rose

  const circleLength = 283; // 2 * pi * r (r=45)
  const strokeOffset = circleLength - (averageTrustScore / 100) * circleLength;

  const degradedSensors = sensors.filter(s => s.trust_score < 100).sort((a, b) => a.trust_score - b.trust_score);

  const flatlineReasons = sensors
    .filter(s => s.is_flatlining && s.metadata?.metric)
    .map(s => `${s.device_name} (${s.metadata.metric} stuck at ${Number(s.metadata.value).toFixed(1)} across ${s.metadata.samples} consecutive readings)`)
    .join(' • ');

  const flatlineTooltipContent = flatlineReasons 
    ? `Flatlining detected: ${flatlineReasons}` 
    : "Flatlining occurs when a sensor sends the exact same value for an extended period, indicating a stuck mechanism.";

  return (
    <div className="flex flex-col h-full">
      {/* 1. Header Gauge and Best/Worst */}
      <div className="flex items-center gap-6 mb-5">
        <div className="relative flex-shrink-0 w-28 h-28 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle 
              cx="50" cy="50" r="45" 
              fill="none" 
              stroke={`url(#scoreGradient)`} 
              strokeWidth="8" 
              strokeDasharray={circleLength}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={gradientStops.start} />
                <stop offset="100%" stopColor={gradientStops.end} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-2xl font-black tracking-tight ${scoreColor}`}>
              {averageTrustScore}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-0.5">Trust Layer Status</h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              {isHealthy ? (
                <><ShieldCheck className="w-4 h-4 text-emerald-500" /> System Healthy</>
              ) : (
                <><ShieldAlert className="w-4 h-4 text-rose-500" /> Attention Required</>
              )}
            </div>
          </div>
          
          {worstSensor && worstSensor.trust_score < 100 && (
            <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-100 mt-2">
              <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block mb-0.5">Most Degraded Sensor</span>
              <span className="text-xs text-rose-800 font-semibold truncate block w-full" title={worstSensor.device_name}>
                {worstSensor.device_name} ({worstSensor.trust_score}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Global Problem Counters */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Offline */}
        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-center relative pointer-events-auto">
          <div className="flex w-full justify-between items-start mb-1">
            <WifiOff className={`w-3.5 h-3.5 ${offlineCount > 0 ? 'text-rose-500' : 'text-slate-300'}`} />
            <LegendTooltip 
              iconSize={12} 
              content="Sensor has not communicated with the platform for over 15 minutes." 
              position="top"
            />
          </div>
          <div className={`text-lg font-black leading-none ${offlineCount > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{offlineCount}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Offline</div>
        </div>

        {/* Flatlining */}
        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-center relative">
          <div className="flex w-full justify-between items-start mb-1">
            <Activity className={`w-3.5 h-3.5 ${flatliningCount > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
            <LegendTooltip 
              iconSize={12} 
              content={flatlineTooltipContent} 
              position="top"
            />
          </div>
          <div className={`text-lg font-black leading-none ${flatliningCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>{flatliningCount}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Flatline</div>
        </div>

        {/* Flapping */}
        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-center relative">
          <div className="flex w-full justify-between items-start mb-1">
            <ServerCrash className={`w-3.5 h-3.5 ${flappingCount > 0 ? 'text-indigo-500' : 'text-slate-300'}`} />
            <LegendTooltip 
              iconSize={12} 
              content="Flapping indicates packet loss or intermittent connectivity, reducing confidence in the metric's accuracy for threshold alerts." 
              position="top"
            />
          </div>
          <div className={`text-lg font-black leading-none ${flappingCount > 0 ? 'text-indigo-700' : 'text-slate-700'}`}>{flappingCount}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Packet Loss</div>
        </div>
      </div>

      {/* 3. Detailed List of Degraded Sensors */}
      <div className="flex-1 overflow-y-auto pr-1 stylish-scrollbar mt-2 border-t border-slate-100 pt-3">
        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">{degradedSensors.length > 0 ? 'Degraded Hardware' : 'All hardware performing optimally'}</h5>
        <div className="space-y-2">
          {degradedSensors.map(sensor => {
            const isExpanded = expandedSensorId === sensor.sensor_id;
            return (
              <div 
                key={sensor.sensor_id} 
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <button 
                  onClick={() => setExpandedSensorId(isExpanded ? null : sensor.sensor_id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-800 truncate">{sensor.device_name}</span>
                    <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5 mt-0.5">
                      {sensor.is_offline && <span className="text-rose-500 font-bold">OFFLINE</span>}
                      {sensor.is_flatlining && <span className="text-amber-500 font-bold">FLATLINING</span>}
                      {sensor.flapping_count_24h > 0 && <span className="text-indigo-500 font-bold">{sensor.flapping_count_24h} DROPS/24h</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <div className="flex flex-col items-end">
                      <span className={`text-base font-black ${sensor.trust_score < 50 ? 'text-rose-500' : 'text-amber-500'}`}>
                        {sensor.trust_score}%
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-50 bg-slate-50/50">
                    <div className="flex items-start gap-2 bg-white p-2 rounded border border-slate-100 shadow-sm mt-1">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                        Phase 1 Alert Rules for this sensor are currently 
                        <span className="font-bold text-slate-800 mx-1">suppressed</span> 
                        by the Trust Layer due to hardware faults to prevent false alarms.
                      </p>
                    </div>
                    {sensor.metadata?.metric && sensor.is_flatlining && (
                      <div className="mt-2 bg-white rounded border border-slate-100 shadow-sm p-2 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Flatlined Metric</span>
                          <span className="text-xs font-semibold text-slate-700">{sensor.metadata.metric}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Stuck Value</span>
                          <span className="text-xs font-black text-amber-600">{Number(sensor.metadata.value).toFixed(2)} <span className="text-slate-400 font-medium ml-1">({sensor.metadata.samples} readings)</span></span>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 text-[9px] font-mono text-slate-400">
                      ID: {sensor.sensor_id.split('-')[0]}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
