import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, BellOff, ChevronDown, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it as itLocale, enUS } from 'date-fns/locale';
import { useUserAlerts } from '@/hooks/useUserAlerts';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const sevConfig = {
  critical: { Icon: AlertCircle, tone: 'text-[hsl(var(--rose))] bg-[hsl(var(--rose))]/10' },
  warning: { Icon: AlertTriangle, tone: 'text-orange-400 bg-orange-500/10' },
  info: { Icon: Info, tone: 'text-[hsl(var(--fgb-accent))] bg-[hsl(var(--fgb-accent))]/10' },
} as const;

export const NotificationsTab = () => {
  const { alerts, unreadCount, markAllRead, isLoading, isRead } = useUserAlerts();
  const { language } = useLanguage();
  const locale = language === 'it' ? itLocale : enUS;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Group alerts by site
  const groups = alerts.reduce<Record<string, { name: string; items: typeof alerts }>>((acc, a) => {
    const key = a.siteName || (language === 'it' ? 'Altro' : 'Other');
    if (!acc[key]) acc[key] = { name: key, items: [] };
    acc[key].items.push(a);
    return acc;
  }, {});
  const groupEntries = Object.values(groups).sort((a, b) => {
    // sites with critical first, then by unread count
    const sevRank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
    const aMin = Math.min(...a.items.map(i => sevRank(i.severity)));
    const bMin = Math.min(...b.items.map(i => sevRank(i.severity)));
    if (aMin !== bMin) return aMin - bMin;
    return b.items.length - a.items.length;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-medium text-foreground">
          {language === 'it' ? 'Notifiche' : 'Notifications'}
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[hsl(var(--rose))] text-white text-[10px] font-semibold">
              {unreadCount}
            </span>
          )}
        </div>
        {alerts.length > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {language === 'it' ? 'Segna tutto come letto' : 'Mark all read'}
          </button>
        )}
      </div>

      <div className="max-h-[340px] overflow-y-auto pr-1 space-y-2">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {language === 'it' ? 'Caricamento…' : 'Loading…'}
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
            <BellOff className="w-8 h-8 opacity-40" />
            <p className="text-xs text-center">
              {language === 'it'
                ? 'Nessun allarme attivo. Tutti i siti funzionano regolarmente.'
                : 'No active alerts. All sites operating normally.'}
            </p>
          </div>
        ) : (
          groupEntries.map(group => {
            const unreadInGroup = group.items.filter(i => !isRead(i.id)).length;
            const isCollapsed = collapsed[group.name] ?? false;
            const topSev = group.items.reduce<'critical' | 'warning' | 'info'>((acc, i) => {
              if (i.severity === 'critical') return 'critical';
              if (i.severity === 'warning' && acc !== 'critical') return 'warning';
              return acc;
            }, 'info');
            const dotTone =
              topSev === 'critical'
                ? 'bg-[hsl(var(--rose))]'
                : topSev === 'warning'
                ? 'bg-orange-400'
                : 'bg-[hsl(var(--fgb-accent))]';
            return (
              <div
                key={group.name}
                className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
              >
                <button
                  onClick={() =>
                    setCollapsed(prev => ({ ...prev, [group.name]: !isCollapsed }))
                  }
                  className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/[0.03] transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[12px] font-medium text-foreground truncate flex-1 text-left">
                    {group.name}
                  </span>
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotTone)} />
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {unreadInGroup > 0 ? `${unreadInGroup}/${group.items.length}` : group.items.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-muted-foreground transition-transform',
                      isCollapsed && '-rotate-90'
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <div className="px-1.5 pb-1.5 space-y-1">
                    {group.items.map(a => {
                      const cfg = sevConfig[a.severity];
                      const unread = !isRead(a.id);
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            'group flex gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors',
                            unread ? 'bg-white/[0.03]' : 'opacity-70'
                          )}
                        >
                          <div
                            className={cn(
                              'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                              cfg.tone
                            )}
                          >
                            <cfg.Icon className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[12px] text-foreground/90 leading-snug line-clamp-2">
                                {a.message}
                              </p>
                              {unread && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--rose))] mt-1 shrink-0" />
                              )}
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(a.triggeredAt), {
                                addSuffix: true,
                                locale,
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsTab;