/**
 * SiteAlertsWidget — Master-Detail in-place alert navigation
 * No layout shift. Fixed height with internal scrolling.
 */

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp, AlertTriangle, Wifi, WifiOff, Info, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
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
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    badgeBg: 'bg-red-500',
    badgeText: 'text-white',
    icon: AlertTriangle,
  },
  medium: {
    labelKey: 'pd.site_alerts.medium',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    icon: WifiOff,
  },
  low: {
    labelKey: 'pd.site_alerts.low',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    badgeBg: 'bg-blue-400',
    badgeText: 'text-white',
    icon: Info,
  },
};

const SEVERITY_ORDER: DisplaySeverity[] = ['critical', 'medium', 'low'];

interface SiteAlertsWidgetProps {
  alertStatus: ThresholdAlertStatus;
}

export function SiteAlertsWidget({ alertStatus }: SiteAlertsWidgetProps) {
  const { t } = useLanguage();

  // Group alerts by display severity
  const grouped = useMemo(() => {
    const map: Record<DisplaySeverity, ThresholdAlert[]> = { critical: [], medium: [], low: [] };
    alertStatus.alerts.forEach(a => {
      const ds = severityMap[a.severity];
      map[ds].push(a);
    });
    return map;
  }, [alertStatus.alerts]);

  // State: null = master view, string = focused category
  const [focusedCategory, setFocusedCategory] = useState<DisplaySeverity | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  // Reset expanded when switching categories
  const handleCategoryClick = (cat: DisplaySeverity) => {
    setFocusedCategory(cat);
    setExpandedAlertId(null);
  };

  // ─── MASTER VIEW ───────────────────────────────────────────────────────────
  if (focusedCategory === null) {
    return (
      <div className="space-y-1">
        {/* Counters row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-center">
            <p className="text-xs text-gray-500">{t('pd.open_now')}</p>
            <p className={`text-4xl font-bold ${alertStatus.hasAlerts ? 'text-red-600' : 'text-gray-800'}`}>
              {alertStatus.totalCount}
            </p>
            {!alertStatus.hasAlerts && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-medium">
                {t('pd.site_alerts.all_clear')}
              </span>
            )}
            {alertStatus.hasAlerts && alertStatus.worstSeverity && (
              <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full font-medium ${severityConfig[severityMap[alertStatus.worstSeverity]].badgeBg} ${severityConfig[severityMap[alertStatus.worstSeverity]].badgeText}`}>
                {alertStatus.totalCount} {t(severityConfig[severityMap[alertStatus.worstSeverity]].labelKey)}
              </span>
            )}
          </div>

          {/* Category rows */}
          <div className="flex-1 space-y-1">
            {SEVERITY_ORDER.map(sev => {
              const cfg = severityConfig[sev];
              const count = grouped[sev].length;
              const latestAlert = grouped[sev][0];

              return (
                <div
                  key={sev}
                  onClick={() => count > 0 && handleCategoryClick(sev)}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${
                    count > 0 ? 'cursor-pointer hover:bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-sm font-semibold ${count > 0 ? cfg.textColor : 'text-gray-400'}`}>
                      {t(cfg.labelKey)}
                    </span>
                    {latestAlert && (
                      <span className="text-xs text-gray-500 truncate max-w-[180px]">
                        — {latestAlert.message}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium ${count > 0 ? cfg.textColor : 'text-gray-400'}`}>
                      {count}
                    </span>
                    {count > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
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
    <div className="space-y-2">
      {/* Category tabs */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={() => setFocusedCategory(null)}
          className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mr-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {SEVERITY_ORDER.map(sev => {
          const c = severityConfig[sev];
          const count = grouped[sev].length;
          const isActive = sev === focusedCategory;
          return (
            <button
              key={sev}
              onClick={() => handleCategoryClick(sev)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
                isActive
                  ? `${c.badgeBg} ${c.badgeText}`
                  : count > 0
                    ? `${c.bgColor} ${c.textColor} hover:opacity-80`
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {t(c.labelKey)} ({count})
            </button>
          );
        })}
      </div>

      {/* Scrollable alert list */}
      <div className="overflow-y-auto max-h-[200px] space-y-1 pr-1 custom-scrollbar">
        {activeAlerts.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">{t('pd.site_alerts.no_alerts')}</p>
        ) : (
          activeAlerts.map(alert => {
            const isExpanded = expandedAlertId === alert.id;
            const isDeviceOffline = alert.metric === 'system.device_offline';

            return (
              <div
                key={alert.id}
                className={`rounded-lg border transition-colors ${isExpanded ? cfg.bgColor + ' border-current/10' : 'border-transparent hover:bg-gray-50'}`}
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                >
                  <span className={`text-xs ${cfg.textColor}`}>
                    {isDeviceOffline ? (
                      <WifiOff className="w-3.5 h-3.5 inline" />
                    ) : alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️'}
                  </span>
                  <span className={`text-sm font-medium ${cfg.textColor} truncate flex-1`}>
                    {alert.message}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* Accordion detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 text-xs space-y-1.5 border-t border-gray-100 pt-2 ml-6">
                    {alert.timestamp && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-16 flex-shrink-0">{t('pd.site_alerts.timestamp')}</span>
                        <span className="text-gray-700">{new Date(alert.timestamp).toLocaleString()}</span>
                      </div>
                    )}
                    {alert.description && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-16 flex-shrink-0">{t('pd.site_alerts.description')}</span>
                        <span className="text-gray-700">{alert.description}</span>
                      </div>
                    )}
                    {alert.deviceName && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-16 flex-shrink-0">{t('pd.site_alerts.device')}</span>
                        <span className="text-gray-700">{alert.deviceName}</span>
                      </div>
                    )}
                    {alert.metric && alert.metric !== 'system.staleness' && alert.metric !== 'system.device_offline' && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-16 flex-shrink-0">{t('pd.site_alerts.metric')}</span>
                        <span className="text-gray-700">{alert.metric}: {alert.currentValue} {alert.unit} (limit: {alert.threshold} {alert.unit})</span>
                      </div>
                    )}
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
