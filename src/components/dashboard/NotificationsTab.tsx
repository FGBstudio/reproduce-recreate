import { AlertTriangle, AlertCircle, Info, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it as itLocale, enUS } from 'date-fns/locale';
import { useUserAlerts } from '@/hooks/useUserAlerts';
import { useLanguage } from '@/contexts/LanguageContext';

const sevConfig = {
  critical: { Icon: AlertCircle, tone: 'text-[hsl(var(--rose))] bg-[hsl(var(--rose))]/10' },
  warning: { Icon: AlertTriangle, tone: 'text-orange-400 bg-orange-500/10' },
  info: { Icon: Info, tone: 'text-[hsl(var(--fgb-accent))] bg-[hsl(var(--fgb-accent))]/10' },
} as const;

export const NotificationsTab = () => {
  const { alerts, unreadCount, markAllRead, isLoading, isRead } = useUserAlerts();
  const { language } = useLanguage();
  const locale = language === 'it' ? itLocale : enUS;

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

      <div className="max-h-[340px] overflow-y-auto pr-1 space-y-1.5">
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
          alerts.map(a => {
            const cfg = sevConfig[a.severity];
            const unread = !isRead(a.id);
            return (
              <div
                key={a.id}
                className={`group flex gap-2.5 p-2.5 rounded-xl border border-white/5 hover:bg-white/5 transition-colors ${
                  unread ? 'bg-white/[0.03]' : 'opacity-70'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.tone}`}>
                  <cfg.Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] text-foreground/90 leading-snug line-clamp-2">{a.message}</p>
                    {unread && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--rose))] mt-1 shrink-0" />}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {a.siteName && <span className="truncate">{a.siteName}</span>}
                    {a.siteName && <span>·</span>}
                    <span>
                      {formatDistanceToNow(new Date(a.triggeredAt), { addSuffix: true, locale })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsTab;