/**
 * Multi-site alerts hook scoped to the user's accessible site_ids.
 * Provides realtime updates + client-side "read" tracking via localStorage.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useUserScope } from './useUserScope';
import { useAuth } from '@/contexts/AuthContext';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface UserAlert {
  id: string;
  severity: AlertSeverity;
  metric: string;
  message: string;
  siteId: string | null;
  siteName?: string | null;
  deviceId?: string | null;
  triggeredAt: string;
  recommendation?: string | null;
}

const READ_KEY = 'fgb.alerts.readIds';

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function useUserAlerts() {
  const { isAdmin } = useAuth();
  const { accessibleSiteIds, clientRole, isLoading: scopeLoading } = useUserScope();
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());

  // FGB admins see all sites; scoped users see only their accessible sites.
  const siteIds = useMemo(() => accessibleSiteIds, [accessibleSiteIds]);
  const seeAll = isAdmin || clientRole === 'ADMIN_FGB';

  useEffect(() => {
    if (!isSupabaseConfigured || scopeLoading) return;
    if (!seeAll && siteIds.length === 0) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    async function fetchAlerts() {
      setIsLoading(true);
      let query = supabase
        .from('site_alerts')
        .select('id, severity, metric, message, site_id, device_id, triggered_at, recommendation, sites(name)')
        .eq('status', 'active')
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (!seeAll) query = query.in('site_id', siteIds);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error('[useUserAlerts] fetch error', error);
        setAlerts([]);
      } else if (data) {
        setAlerts(
          data.map((d: any) => ({
            id: d.id,
            severity: d.severity,
            metric: d.metric,
            message: d.message,
            siteId: d.site_id,
            siteName: d.sites?.name ?? null,
            deviceId: d.device_id,
            triggeredAt: d.triggered_at,
            recommendation: d.recommendation,
          })),
        );
      }
      setIsLoading(false);
    }
    fetchAlerts();

    const channel = supabase
      .channel('user_alerts_panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [siteIds.join(','), seeAll, scopeLoading]);

  const unreadCount = useMemo(
    () => alerts.filter(a => !readIds.has(a.id)).length,
    [alerts, readIds],
  );

  const markAllRead = useCallback(() => {
    const next = new Set(readIds);
    alerts.forEach(a => next.add(a.id));
    setReadIds(next);
    saveReadIds(next);
  }, [alerts, readIds]);

  const sorted = useMemo(() => {
    const sevRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return [...alerts].sort((a, b) => {
      const s = sevRank[a.severity] - sevRank[b.severity];
      if (s !== 0) return s;
      return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
    });
  }, [alerts]);

  return {
    alerts: sorted,
    unreadCount,
    isLoading,
    markAllRead,
    isRead: (id: string) => readIds.has(id),
  };
}