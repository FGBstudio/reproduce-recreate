/**
 * SiteAlertsWidget — Master-Detail in-place alert navigation
 * Enterprise-grade with live durations and backend recommendations.
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp, 
  AlertTriangle, Wifi, WifiOff, Info, Shield, 
  Wind, Zap, Droplets, Thermometer, Activity,
  CheckCircle, Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import type { ThresholdAlertStatus, ThresholdAlert, AlertSeverity } from '@/hooks/useThresholdAlerts';

// Severity display mapping
type DisplaySeverity = 'critical' | 'medium' | 'low';

const severityMap: Record<AlertSeverity, DisplaySeverity> = {
  critical: 'critical',
  warning: 'medium',
  info: 'low',
};

const severityConfig: Record<DisplaySeverity, {
  labelKey: string;
  textColor: string;
  bgColor: string;
  badgeBg: string;
  badgeText: string;
  icon: typeof AlertTriangle;
}> = {
  critical: {
    labelKey: 'pd.site_alerts.critical',
    textColor: 'text-rose-600',
    bgColor: 'bg-rose-50',
    badgeBg: 'bg-rose-500',
    badgeText: 'text-white',
    icon: AlertTriangle,
  },
  medium: {
    labelKey: 'pd.site_alerts.medium',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    icon: AlertTriangle,
  },
  low: {
    labelKey: 'pd.site_alerts.low',
    textColor: 'text-sky-500',
    bgColor: 'bg-sky-50',
    badgeBg: 'bg-sky-400',
    badgeText: 'text-white',
    icon: Info,
  },
};

const SEVERITY_ORDER: DisplaySeverity[] = ['critical', 'medium', 'low'];

/** Icon mapping for professional metrics */
const getMetricIcon = (metric: string) => {
  if (metric.includes('co2')) return Wind;
  if (metric.includes('power') || metric.includes('energy')) return Zap;
  if (metric.includes('voc') || metric.includes('pm')) return Activity;
  if (metric.includes('water')) return Droplets;
  if (metric.includes('temp')) return Thermometer;
  if (metric.includes('system')) return Shield;
  return Info;
};

interface SiteAlertsWidgetProps {
  alertStatus: ThresholdAlertStatus;
  moduleFilter?: 'energy' | 'air' | 'water';
}

const MODULE_METRIC_PATTERNS: Record<string, string[]> = {
  energy: ['energy', 'power'],
  air: ['iaq', 'env'],
  water: ['water', 'leak'],
};

export function SiteAlertsWidget({ alertStatus, moduleFilter }: SiteAlertsWidgetProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'it' ? it : enUS;

  // Live timer state for "Active for..." durations
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Filter alerts by module if specified
  const filteredAlerts = useMemo(() => {
    if (!moduleFilter) return alertStatus.alerts;
    const patterns = MODULE_METRIC_PATTERNS[moduleFilter] || [];
    
    // Mapping DB device_types to module filters
    const typeToModule: Record<string, string> = {
      'air_quality': 'air',
      'energy_monitor': 'energy',
      'water_meter': 'water',
      'air': 'air',
      'energy': 'energy',
      'water': 'water'
    };

    return alertStatus.alerts.filter(a => {
      if (!a.metric) return false;
      const m = a.metric.toLowerCase();
      
      // If it's a system/offline alert, filter by device type
      if (m.startsWith('system.')) {
        if (!a.deviceType) return false; // Don't show system alerts if type is missing/unknown for this view
        const targetModule = typeToModule[a.deviceType];
        return targetModule === moduleFilter;
      }

      // Otherwise apply standard metric pattern filter (iaq, env, etc.)
      return patterns.some(p => m.includes(p));
    });
  }, [alertStatus.alerts, moduleFilter]);

  // Group alerts by display severity
  const grouped = useMemo(() => {
    const map: Record<DisplaySeverity, ThresholdAlert[]> = { critical: [], medium: [], low: [] };
    filteredAlerts.forEach(a => {
      const ds = severityMap[a.severity];
      map[ds].push(a);
    });
    return map;
  }, [filteredAlerts]);

  const totalCount = filteredAlerts.length;
  const hasAlerts = totalCount > 0;
  const worstSeverity = hasAlerts
    ? filteredAlerts.reduce<AlertSeverity>((worst, a) => {
        const order: AlertSeverity[] = ['critical', 'warning', 'info'];
        return order.indexOf(a.severity) < order.indexOf(worst) ? a.severity : worst;
      }, 'info')
    : null;

  // State: null = master view, string = focused category
  const [focusedCategory, setFocusedCategory] = useState<DisplaySeverity | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [isAckLoading, setIsAckLoading] = useState<string | null>(null);

  const handleAcknowledge = async (alertId: string) => {
    setIsAckLoading(alertId);
    try {
      await supabase
        .from('site_alerts')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', alertId);
      // Row will be updated via realtime hook in useThresholdAlerts
    } catch (err) {
      console.error('Ack error:', err);
    } finally {
      setIsAckLoading(null);
    }
  };

  const handleCategoryClick = (cat: DisplaySeverity) => {
    setFocusedCategory(cat);
    setExpandedAlertId(null);
  };

  // ─── MASTER VIEW ───────────────────────────────────────────────────────────
  if (focusedCategory === null) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-4 mb-3 p-4 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{t('pd.open_now')}</p>
            <div className="relative inline-block">
              <p className={`text-5xl font-extrabold tracking-tight ${hasAlerts ? 'text-rose-600' : 'text-slate-300'}`}>
                {totalCount}
              </p>
              {hasAlerts && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
              )}
            </div>
            {!hasAlerts && (
              <div className="mt-2 flex items-center justify-center gap-1 text-emerald-600 font-semibold text-[11px]">
                <CheckCircle className="w-3 h-3" />
                {t('pd.site_alerts.all_clear')}
              </div>
            )}
            {hasAlerts && worstSeverity && (
              <div className={`mt-2 px-2 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-tight ${severityConfig[severityMap[worstSeverity]].badgeBg} ${severityConfig[severityMap[worstSeverity]].badgeText}`}>
                {severityMap[worstSeverity].toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1.5 pt-1">
            {SEVERITY_ORDER.map(sev => {
              const cfg = severityConfig[sev];
              const count = grouped[sev].length;
              const latestAlert = grouped[sev][0];

              return (
                <div
                  key={sev}
                  onClick={() => count > 0 && handleCategoryClick(sev)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all border ${
                    count > 0 
                      ? `cursor-pointer ${cfg.bgColor} border-current/10 hover:shadow-md hover:-translate-y-0.5` 
                      : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <cfg.icon className={`w-4 h-4 ${count > 0 ? cfg.textColor : 'text-slate-300'}`} />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-xs font-bold ${count > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                        {t(cfg.labelKey)}
                      </span>
                      {latestAlert && (
                        <span className="text-[10px] text-slate-500 truncate max-w-[140px] flex items-center gap-1">
                          {latestAlert.deviceName && <span className="font-bold text-slate-700">{latestAlert.deviceName}:</span>}
                          {latestAlert.message}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-black ${count > 0 ? cfg.textColor : 'text-slate-300'}`}>
                      {count}
                    </span>
                    {count > 0 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── DETAIL VIEW ───────────────────────────────────────────────────────────
  const activeAlerts = grouped[focusedCategory];
  const cfg = severityConfig[focusedCategory];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setFocusedCategory(null)}
          className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('pd.back').toUpperCase()}
        </button>
        <div className="flex gap-1">
          {SEVERITY_ORDER.map(sev => {
            const count = grouped[sev].length;
            if (count === 0) return null;
            const sc = severityConfig[sev];
            return (
              <button
                key={sev}
                onClick={() => handleCategoryClick(sev)}
                className={`w-2 h-2 rounded-full ${sev === focusedCategory ? sc.badgeBg : 'bg-slate-200'}`}
              />
            );
          })}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[220px] space-y-2 pr-1 custom-scrollbar">
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
            <Shield className="w-8 h-8 opacity-20" />
            <p className="text-xs font-semibold">{t('pd.site_alerts.no_alerts')}</p>
          </div>
        ) : (
          activeAlerts.map(alert => {
            const isExpanded = expandedAlertId === alert.id;
            const MetricIcon = getMetricIcon(alert.metric);
            const activeSince = alert.timestamp ? formatDistanceToNow(new Date(alert.timestamp), { locale: dateLocale, addSuffix: false }) : null;

            return (
              <div
                key={alert.id}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isExpanded 
                    ? `${cfg.bgColor} border-current/20 shadow-sm` 
                    : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                }`}
              >
                <button
                  onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left group"
                >
                  <div className={`p-1.5 rounded-lg ${isExpanded ? 'bg-white/60' : cfg.bgColor}`}>
                    <MetricIcon className={`w-4 h-4 ${cfg.textColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${cfg.textColor}`}>
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {activeSince}
                      </span>
                      {alert.deviceName && (
                        <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                          {alert.deviceName}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3">
                    <div className="h-px bg-current/5 w-full" />
                    
                    {/* Recommendation Box */}
                    {alert.recommendation && (
                      <div className="bg-white/50 p-3 rounded-lg border border-current/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          {t('pd.site_alerts.recommendation')}
                        </p>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed">
                          {alert.recommendation}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {alert.metric && !alert.metric.startsWith('system.') && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{t('pd.site_alerts.reading')}</p>
                          <p className="text-xs font-black text-slate-800">
                             {alert.currentValue.toFixed(1)} <span className="text-[10px] opacity-60 font-medium">{alert.unit}</span>
                          </p>
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{t('pd.site_alerts.threshold')}</p>
                        <p className="text-xs font-black text-slate-800">
                          {alert.threshold.toFixed(1)} <span className="text-[10px] opacity-60 font-medium">{alert.unit}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={!!isAckLoading}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                          isAckLoading === alert.id 
                            ? 'bg-slate-100 text-slate-400 cursor-wait' 
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-95'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t('pd.site_alerts.acknowledge')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
