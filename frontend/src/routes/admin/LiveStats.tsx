import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Card, Icon, ProgressBar, StatCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import { getSupabaseClient } from '@/lib/supabaseRealtime';
import { formatPct } from './generationI18n';
import type { LiveRunHeartbeat } from './generationTypes';

/*
 * Subscribes to generation_runs_live changes via Supabase Realtime (Postgres
 * CDC — migration 0019). Replaces the previous 2s polling with true push-based
 * updates: the dashboard receives heartbeats the instant coursegen writes them
 * to Vault. Falls back to idle state when the row is DELETEd (run finished) or
 * when Supabase is not configured.
 */

const STALE_MS = 2 * 60 * 1000;

/**
 * How often to hand Realtime a freshly minted JWT. Comfortably under Supabase's
 * default 1 h access-token lifetime, so the socket is never authorized with a
 * token that is about to expire.
 */
const REAUTH_INTERVAL_MS = 10 * 60 * 1000;

const STAGES = [
  { key: 'pending', icon: 'pending' },
  { key: 'planning', icon: 'psychology' },
  { key: 'writing', icon: 'edit_note' },
  { key: 'reviewing', icon: 'grading' },
  { key: 'localizing', icon: 'translate' },
  { key: 'illustrating', icon: 'image' },
  { key: 'publishing', icon: 'cloud_upload' },
  { key: 'published', icon: 'task_alt' },
] as const;

interface LiveStatsProps {
  onHeartbeat: (hb: LiveRunHeartbeat | null) => void;
  className?: string;
}

/** Map the snake_case Postgres row to the camelCase LiveRunHeartbeat shape. */
function mapRow(row: Record<string, unknown>): LiveRunHeartbeat {
  return {
    runId: String(row.run_id ?? ''),
    trackId: row.track_id ? String(row.track_id) : null,
    courseSlug: String(row.course_slug ?? ''),
    register: String(row.register ?? 'kid'),
    activeSlots: Number(row.active_slots ?? 0),
    completedSlots: Number(row.completed_slots ?? 0),
    failedSlots: Number(row.failed_slots ?? 0),
    totalSlots: Number(row.total_slots ?? 0),
    stageBreakdown: (row.stage_breakdown as Record<string, number>) ?? {},
    tokensUsed: Number(row.tokens_used ?? 0),
    usdUsed: Number(row.usd_used ?? 0),
    cachedTokens: Number(row.cached_tokens ?? 0),
    imagesGenerated: Number(row.images_generated ?? 0),
    imagesBilled: Number(row.images_billed ?? 0),
    imagesInherited: Number(row.images_inherited ?? 0),
    startedAt: String(row.started_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function LiveStats({ onHeartbeat, className }: LiveStatsProps) {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [heartbeat, setHeartbeat] = useState<LiveRunHeartbeat | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact' });
  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });
  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { timeStyle: 'medium' });
  const loc = i18n.resolvedLanguage ?? 'en-US';

  const applyHeartbeat = useCallback((hb: LiveRunHeartbeat) => {
    if (Date.now() - new Date(hb.updatedAt).getTime() > STALE_MS) {
      setHeartbeat(null);
      onHeartbeat(null);
      return;
    }
    setHeartbeat(hb);
    onHeartbeat(hb);
  }, [onHeartbeat]);

  // Subscribe to Postgres changes via Supabase Realtime.
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Supabase not configured — show idle state. The dashboard still
      // works for historical data; only live monitoring is unavailable.
      setConnected(false);
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function subscribe() {
      const token = await getToken();
      if (!token || cancelled) return;
      await supabase!.realtime.setAuth(token);

      channel = supabase!
        .channel('generation-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'generation_runs_live' },
          (payload) => {
            if (cancelled) return;
            // DELETE = run finished → clear
            if (payload.eventType === 'DELETE') {
              setHeartbeat(null);
              onHeartbeat(null);
              setConnected(false);
              return;
            }
            // INSERT or UPDATE → apply the new row
            const row = payload.new as Record<string, unknown>;
            applyHeartbeat(mapRow(row));
            setConnected(true);
            setError(null);

            // Stale check: if coursegen dies, the row stops updating.
            // Clear after STALE_MS of no updates.
            if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
            staleTimerRef.current = setTimeout(() => {
              setHeartbeat(null);
              onHeartbeat(null);
              setConnected(false);
            }, STALE_MS);
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setError(t('admin.generation.live.connectionLost'));
            setConnected(false);
            // Reconnect rather than sit there showing a stale banner. The
            // usual cause is an expired JWT: Realtime authorizes ONCE at
            // subscribe time, so a tab left open past the token's lifetime
            // loses the channel permanently and then reports "no active run" —
            // indistinguishable from a genuinely idle pipeline.
            scheduleResubscribe();
          }
        });
    }

    /** Tear the channel down and re-subscribe with a freshly minted token. */
    function scheduleResubscribe(delayMs = 3000) {
      if (cancelled) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (cancelled) return;
        if (channel) {
          supabase!.removeChannel(channel);
          channel = null;
        }
        void subscribe();
      }, delayMs);
    }

    void subscribe();

    /*
     * Proactive re-auth. Supabase access tokens are short-lived (1 h by
     * default) and `realtime.setAuth` pins whatever token was current when
     * subscribe() ran. Without this, the Live Monitor is guaranteed to die on
     * any admin tab left open longer than the token's lifetime.
     */
    const reauth = setInterval(() => {
      void (async () => {
        const fresh = await getToken();
        if (!fresh || cancelled) return;
        await supabase.realtime.setAuth(fresh);
      })();
    }, REAUTH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(reauth);
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };
  }, [getToken, applyHeartbeat, onHeartbeat, t]);

  // Idle state
  if (!heartbeat) {
    return (
      <Card className={cn('p-5', className)}>
        <div className="flex items-center gap-3">
          <Icon name="check_circle" className="text-success" />
          <div>
            <p className="lf-body font-medium">{t('admin.generation.live.idle')}</p>
            <p className="lf-caption text-content-muted">{t('admin.generation.live.idleNote')}</p>
          </div>
        </div>
        {error && <p className="lf-caption mt-2 text-error">{error}</p>}
      </Card>
    );
  }

  const total = heartbeat.completedSlots + heartbeat.failedSlots;
  const progressPct = heartbeat.totalSlots > 0 ? (total / heartbeat.totalSlots) * 100 : 0;
  const cachePct = heartbeat.tokensUsed > 0 ? (heartbeat.cachedTokens / heartbeat.tokensUsed) * 100 : 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Top bar: run identity + overall progress */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Icon name="precision_manufacturing" className="text-accent animate-pulse shrink-0" />
            <div className="min-w-0">
              <p className="lf-title truncate">{heartbeat.runId}</p>
              <p className="lf-caption text-content-muted">
                {heartbeat.courseSlug} · {heartbeat.register} · {t('admin.generation.live.since', { time: dateFmt.format(new Date(heartbeat.startedAt)) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name={connected ? 'bolt' : 'progress_activity'} className={connected ? 'text-accent' : 'animate-spin text-content-muted'} />
            <span className="lf-caption text-content-muted">
              {connected ? t('admin.generation.live.realtime') : t('admin.generation.live.polling')}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="lf-caption text-content-muted">
              {t('admin.generation.live.progress', { completed: total, total: heartbeat.totalSlots })}
            </span>
            <span className="lf-number lf-caption">{formatPct(progressPct, loc)}</span>
          </div>
          <ProgressBar value={progressPct} label={t('admin.generation.live.progressAria')} />
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard dense icon={<Icon name="task_alt" />} tone="primary" value={`${heartbeat.completedSlots}/${heartbeat.totalSlots}`} label={t('admin.generation.kpi.published')} />
        <StatCard dense icon={<Icon name="error" />} tone="accent" value={String(heartbeat.failedSlots)} label={t('admin.generation.kpi.failed')} />
        <StatCard dense icon={<Icon name="payments" />} tone="secondary" value={usd.format(heartbeat.usdUsed)} label={t('admin.generation.kpi.cost')} />
        <StatCard dense icon={<Icon name="numbers" />} tone="primary" value={compact.format(heartbeat.tokensUsed)} label={t('admin.generation.kpi.tokens')} />
        <StatCard dense icon={<Icon name="bolt" />} tone="secondary" value={formatPct(cachePct, loc)} label={t('admin.generation.kpi.cacheHit')} />
      </div>

      {/* Stage breakdown pills */}
      <div className="flex flex-wrap gap-2">
        {STAGES.map(({ key, icon }) => {
          const count = heartbeat.stageBreakdown[key] ?? 0;
          const isActive = key !== 'published' && key !== 'pending' && count > 0;
          return (
            <div
              key={key}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
                isActive
                  ? 'bg-accent-soft text-accent-strong'
                  : count > 0
                    ? 'bg-success-soft text-success-strong'
                    : 'bg-surface-sunken text-content-faint',
              )}
            >
              <span className="material-symbols-outlined text-sm leading-none">{icon}</span>
              <span>{t(`admin.generation.stages.${key}`, { defaultValue: key })}</span>
              <span className={cn('lf-number font-medium', isActive && 'animate-pulse')}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
