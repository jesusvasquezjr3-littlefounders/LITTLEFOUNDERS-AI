/**
 * useAdminAlerts Hook
 *
 * Frontend-only admin "inbox". Aggregates read-only data the panel already
 * exposes into a single list of actionable alerts for the notification bell:
 *   - Pending platform reports   → GET /reports/?status=pending
 *   - Recent edits by OTHER admins → recent_edits from /admin/stats
 *   - Active broadcast notifications → notificationsAdminApi.list({status:'active'})
 *
 * "Read" state is tracked in localStorage (`admin_alerts_seen`); no backend.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API_URL } from '@/config/api';
import { useAdminStats, type RecentEdit } from '@/hooks/useAdminStats';
import { notificationsAdminApi } from '@/lib/api/notifications';

export type AdminAlertKind = 'report' | 'edit' | 'broadcast';

export interface AdminAlert {
  id: string;
  kind: AdminAlertKind;
  title: string;
  meta: string;
  time: string;
  href: string;
}

const SEEN_KEY = 'admin_alerts_seen';
const SEEN_CAP = 200;
const REFETCH_MS = 60_000;

interface PendingReport {
  public_id: string;
  subject: string;
  report_type: string;
  created_at: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchPendingReports(): Promise<PendingReport[]> {
  const res = await fetch(`${API_URL}/reports/?status=pending&limit=20`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch pending reports');
  return res.json();
}

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  try {
    // Keep only the most recent ids to avoid unbounded growth.
    const arr = Array.from(ids).slice(-SEEN_CAP);
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/** Identifiers of the logged-in admin, used to hide their own edits. */
function getOwnIdentifiers(): Set<string> {
  const ids = new Set<string>();
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    for (const key of ['id', 'public_id', 'user_id', 'name', 'email']) {
      if (user[key]) ids.add(String(user[key]));
    }
  } catch {
    /* ignore */
  }
  return ids;
}

export function useAdminAlerts() {
  const { t, i18n } = useTranslation('admin');

  const reportsQuery = useQuery({
    queryKey: ['admin-alerts', 'reports'],
    queryFn: fetchPendingReports,
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS / 2,
  });

  const broadcastsQuery = useQuery({
    queryKey: ['admin-alerts', 'broadcasts'],
    queryFn: () => notificationsAdminApi.list({ status: 'active' }),
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS / 2,
  });

  // Reuses the cached ['admin-stats'] query shared with the dashboard.
  const statsQuery = useAdminStats();

  const [seen, setSeen] = useState<Set<string>>(readSeen);

  // Sync read-state across mounted instances / tabs.
  useEffect(() => {
    const refresh = () => setSeen(readSeen());
    window.addEventListener('admin-alerts-seen-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('admin-alerts-seen-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const alerts = useMemo<AdminAlert[]>(() => {
    const out: AdminAlert[] = [];
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

    for (const r of reportsQuery.data ?? []) {
      out.push({
        id: `report:${r.public_id}`,
        kind: 'report',
        title: r.subject || t('alerts.kinds.report'),
        meta: t('alerts.kinds.report'),
        time: r.created_at,
        href: '/admin/reports',
      });
    }

    const own = getOwnIdentifiers();
    const edits: RecentEdit[] = statsQuery.data?.recent_edits ?? [];
    for (const e of edits.slice(0, 15)) {
      if (own.has(String(e.editor_user_id)) || own.has(String(e.editor_name))) continue;
      out.push({
        id: `edit:${e.id}`,
        kind: 'edit',
        title: `${e.editor_name} · ${e.action} ${e.entity_type}`,
        meta: t('alerts.kinds.edit'),
        time: e.created_at,
        href: '/admin/history',
      });
    }

    for (const n of broadcastsQuery.data ?? []) {
      const title = lang === 'en' ? n.title_en || n.title_es : n.title_es || n.title_en;
      out.push({
        id: `broadcast:${n.public_id}`,
        kind: 'broadcast',
        title: title || t('alerts.kinds.broadcast'),
        meta: t('alerts.kinds.broadcast'),
        time: n.created_at,
        href: '/admin/notifications',
      });
    }

    out.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return out;
  }, [reportsQuery.data, broadcastsQuery.data, statsQuery.data, t, i18n.language]);

  const unreadCount = useMemo(
    () => alerts.reduce((n, a) => (seen.has(a.id) ? n : n + 1), 0),
    [alerts, seen],
  );

  const markAllSeen = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      for (const a of alerts) next.add(a.id);
      writeSeen(next);
      window.dispatchEvent(new Event('admin-alerts-seen-changed'));
      return next;
    });
  }, [alerts]);

  const dismiss = useCallback((id: string) => {
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeSeen(next);
      window.dispatchEvent(new Event('admin-alerts-seen-changed'));
      return next;
    });
  }, []);

  const refetch = useCallback(() => {
    reportsQuery.refetch();
    broadcastsQuery.refetch();
    statsQuery.refetch();
  }, [reportsQuery, broadcastsQuery, statsQuery]);

  return {
    alerts,
    unreadCount,
    seen,
    isLoading: reportsQuery.isLoading || broadcastsQuery.isLoading || statsQuery.isLoading,
    markAllSeen,
    dismiss,
    refetch,
  };
}

export default useAdminAlerts;
