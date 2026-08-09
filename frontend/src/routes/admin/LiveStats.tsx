import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Dropdown, Icon, ProgressBar, StatCard, type DropdownOption } from '@/components/ui';
import { cn } from '@/lib/utils';
import { getSupabaseClient } from '@/lib/supabaseRealtime';
import { formatPct } from './generationI18n';
import { processedSlots, resolveGenerationKind, stagesForKind, type LiveGenerationStatus, type LiveRunHeartbeat } from './generationTypes';

/*
 * Live Monitor data flow:
 *   1. Core hydrates the current state and polls as the reliable baseline.
 *   2. Supabase Realtime accelerates updates when it is configured and healthy.
 *   3. Realtime failure never hides a heartbeat that Core can still provide.
 *
 * This ordering is intentional. A subscription can start after an INSERT and
 * receive no initial row, while production may also omit the public Supabase
 * variables from a frontend deployment. Neither condition may turn a healthy
 * generation into a false "connection lost" state.
 */

const POLL_INTERVAL_MS = 4_000;
const STALE_MS = 2 * 60 * 1000;
const REAUTH_INTERVAL_MS = 10 * 60 * 1000;

interface LiveStatsProps {
  onHeartbeat: (hb: LiveRunHeartbeat | null) => void;
  className?: string;
}

function sortRuns(runs: LiveRunHeartbeat[]): LiveRunHeartbeat[] {
  return runs
    .filter((run) => run.runId && Number.isFinite(Date.parse(run.updatedAt)))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** Map and sanitize an untrusted snake_case PostgREST row. */
export function mapRow(row: Record<string, unknown>): LiveRunHeartbeat {
  const rawBreakdown = row.stage_breakdown;
  const stageBreakdown: Record<string, number> = {};
  if (typeof rawBreakdown === 'object' && rawBreakdown !== null && !Array.isArray(rawBreakdown)) {
    for (const [stage, value] of Object.entries(rawBreakdown)) {
      const count = Number(value);
      if (Number.isFinite(count) && count >= 0) stageBreakdown[stage] = count;
    }
  }
  return {
    runId: String(row.run_id ?? ''),
    trackId: row.track_id ? String(row.track_id) : null,
    courseSlug: String(row.course_slug ?? ''),
    register: String(row.register ?? 'kid'),
    kind: typeof row.kind === 'string' && row.kind !== '' ? row.kind : null,
    activeSlots: nonNegativeNumber(row.active_slots),
    completedSlots: nonNegativeNumber(row.completed_slots),
    failedSlots: nonNegativeNumber(row.failed_slots),
    skippedSlots: nonNegativeNumber(row.skipped_slots),
    totalSlots: nonNegativeNumber(row.total_slots),
    stageBreakdown,
    tokensUsed: nonNegativeNumber(row.tokens_used),
    usdUsed: nonNegativeNumber(row.usd_used),
    cachedTokens: nonNegativeNumber(row.cached_tokens),
    imagesGenerated: nonNegativeNumber(row.images_generated),
    imagesBilled: nonNegativeNumber(row.images_billed),
    imagesInherited: nonNegativeNumber(row.images_inherited),
    startedAt: String(row.started_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function upsertRun(current: LiveRunHeartbeat[], next: LiveRunHeartbeat): LiveRunHeartbeat[] {
  return sortRuns([...current.filter((run) => run.runId !== next.runId), next]);
}

function nonNegativeNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function LiveStats({ onHeartbeat, className }: LiveStatsProps) {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [runs, setRuns] = useState<LiveRunHeartbeat[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pollingReady, setPollingReady] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const staleTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const compact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact' });
  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });
  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { timeStyle: 'medium' });
  const loc = i18n.resolvedLanguage ?? 'en-US';

  const chooseAvailableRun = useCallback((nextRuns: LiveRunHeartbeat[]) => {
    setSelectedRunId((current) => current && nextRuns.some((run) => run.runId === current) ? current : nextRuns[0]?.runId ?? null);
  }, []);

  const removeRealtimeStaleTimer = useCallback((runId: string) => {
    const timer = staleTimersRef.current.get(runId);
    if (timer) clearTimeout(timer);
    staleTimersRef.current.delete(runId);
  }, []);

  const applyPolledRuns = useCallback((status: LiveGenerationStatus) => {
    const nextRuns = sortRuns(Array.isArray(status.activeRuns) ? status.activeRuns : []);
    for (const run of nextRuns) removeRealtimeStaleTimer(run.runId);
    setRuns(nextRuns);
    chooseAvailableRun(nextRuns);
    setPollingReady(true);
    setPollError(null);
  }, [chooseAvailableRun, removeRealtimeStaleTimer]);

  const applyRealtimeRun = useCallback((next: LiveRunHeartbeat) => {
    setRuns((current) => upsertRun(current, next));
    setSelectedRunId((current) => current ?? next.runId);
    removeRealtimeStaleTimer(next.runId);
    const timer = setTimeout(() => {
      setRuns((current) => {
        const nextRuns = current.filter((run) => run.runId !== next.runId);
        chooseAvailableRun(nextRuns);
        return nextRuns;
      });
    }, STALE_MS);
    staleTimersRef.current.set(next.runId, timer);
  }, [chooseAvailableRun, removeRealtimeStaleTimer]);

  const removeRun = useCallback((runId: string) => {
    removeRealtimeStaleTimer(runId);
    setRuns((current) => {
      const nextRuns = current.filter((run) => run.runId !== runId);
      chooseAvailableRun(nextRuns);
      return nextRuns;
    });
  }, [chooseAvailableRun, removeRealtimeStaleTimer]);

  // Core is the authoritative hydration and polling path. It works even when
  // Realtime is disabled, silent, or the page opened after the row was inserted.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const token = await getToken();
      if (!token || cancelled) return;
      const result = await api<LiveGenerationStatus>('/admin/generation/live', { token });
      if (cancelled) return;
      if (result.error || !result.data) {
        setPollError(result.error?.code ?? 'INTERNAL');
        return;
      }
      applyPolledRuns(result.data);
    }
    void poll();
    const interval = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [applyPolledRuns, getToken]);

  // Realtime is an accelerator, not the only source of truth.
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function subscribe() {
      const token = await getToken();
      if (!token || cancelled) return;
      await supabase!.realtime.setAuth(token);
      channel = supabase!
        .channel('generation-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'generation_runs_live' }, (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Record<string, unknown>;
            removeRun(String(oldRow.run_id ?? ''));
            return;
          }
          applyRealtimeRun(mapRow(payload.new as Record<string, unknown>));
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeConnected(true);
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeConnected(false);
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              if (cancelled) return;
              if (channel) supabase!.removeChannel(channel);
              channel = null;
              void subscribe();
            }, 3_000);
          }
        });
    }

    void subscribe();
    const reauth = setInterval(() => {
      void (async () => {
        const fresh = await getToken();
        if (!fresh || cancelled) return;
        await supabase.realtime.setAuth(fresh);
      })();
    }, REAUTH_INTERVAL_MS);

    return () => {
      cancelled = true;
      setRealtimeConnected(false);
      clearInterval(reauth);
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [applyRealtimeRun, getToken, removeRun]);

  useEffect(() => {
    return () => {
      for (const timer of staleTimersRef.current.values()) clearTimeout(timer);
      staleTimersRef.current.clear();
    };
  }, []);

  const heartbeat = runs.find((run) => run.runId === selectedRunId) ?? runs[0] ?? null;
  useEffect(() => {
    onHeartbeat(heartbeat);
  }, [heartbeat, onHeartbeat]);

  const transportKey = realtimeConnected ? 'realtime' : pollError ? 'degraded' : pollingReady ? 'automatic' : 'polling';
  const transportIcon = realtimeConnected ? 'bolt' : pollError ? 'cloud_off' : pollingReady ? 'sync' : 'progress_activity';
  const runOptions: DropdownOption<string>[] = runs.map((run) => ({
    value: run.runId,
    label: `${run.courseSlug} · ${run.runId}`,
  }));

  if (!heartbeat) {
    return (
      <Card className={cn('p-5', className)}>
        <div className="flex items-start gap-3">
          <Icon name={pollError ? 'cloud_off' : 'check_circle'} className={pollError ? 'text-error' : 'text-success'} />
          <div className="min-w-0">
            <p className="lf-body font-medium">{t(pollError ? 'admin.generation.live.unavailableTitle' : 'admin.generation.live.idle')}</p>
            <p className="lf-caption mt-1 text-content-muted">{t(pollError ? 'admin.generation.live.unavailableNote' : 'admin.generation.live.idleNote')}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 text-content-muted">
            <Icon name={transportIcon} className={cn('!text-[18px]', !pollingReady && !pollError && 'animate-spin')} />
            <span className="lf-caption hidden sm:inline">{t(`admin.generation.live.${transportKey}`)}</span>
          </div>
        </div>
      </Card>
    );
  }

  const stages = stagesForKind(resolveGenerationKind(heartbeat));
  const processed = processedSlots(heartbeat);
  const progressPct = heartbeat.totalSlots > 0 ? (processed / heartbeat.totalSlots) * 100 : 0;
  const cachePct = heartbeat.tokensUsed > 0 ? (heartbeat.cachedTokens / heartbeat.tokensUsed) * 100 : 0;

  return (
    <div className={cn('space-y-4', className)}>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Icon name="precision_manufacturing" className="shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="lf-title truncate">{heartbeat.runId}</p>
              <p className="lf-caption text-content-muted">
                {heartbeat.courseSlug} · {heartbeat.register} · {t('admin.generation.live.since', { time: dateFmt.format(new Date(heartbeat.startedAt)) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-content-muted">
            <Icon name={transportIcon} className={cn('!text-[18px]', !realtimeConnected && !pollingReady && 'animate-spin')} />
            <span className="lf-caption">{t(`admin.generation.live.${transportKey}`)}</span>
          </div>
        </div>

        {runs.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-outline/40 pt-3">
            <span className="lf-caption text-content-muted">{t('admin.generation.live.activeRuns', { count: runs.length })}</span>
            <Dropdown value={heartbeat.runId} options={runOptions} onChange={setSelectedRunId} ariaLabel={t('admin.generation.live.selectRun')} compact align="right" />
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="lf-caption text-content-muted">
              {t('admin.generation.live.progress', { completed: processed, total: heartbeat.totalSlots })}
            </span>
            <span className="lf-number lf-caption">{formatPct(progressPct, loc)}</span>
          </div>
          <ProgressBar value={progressPct} label={t('admin.generation.live.progressAria')} />
          <p className="lf-caption mt-2 text-content-faint">{t('admin.generation.live.breakdown', { published: heartbeat.completedSlots, failed: heartbeat.failedSlots, skipped: heartbeat.skippedSlots })}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard dense icon={<Icon name="task_alt" />} tone="primary" value={String(heartbeat.completedSlots)} label={t('admin.generation.kpi.published')} />
        <StatCard dense icon={<Icon name="conversion_path" />} tone="primary" value={`${processed}/${heartbeat.totalSlots}`} label={t('admin.generation.kpi.processed')} />
        <StatCard dense icon={<Icon name="error" />} tone="accent" value={String(heartbeat.failedSlots)} label={t('admin.generation.kpi.failed')} />
        <StatCard dense icon={<Icon name="skip_next" />} tone="secondary" value={String(heartbeat.skippedSlots)} label={t('admin.generation.kpi.skipped')} />
        <StatCard dense icon={<Icon name="payments" />} tone="secondary" value={usd.format(heartbeat.usdUsed)} label={t('admin.generation.kpi.cost')} />
        <StatCard dense icon={<Icon name="numbers" />} tone="primary" value={compact.format(heartbeat.tokensUsed)} label={t('admin.generation.kpi.tokens')} />
        <StatCard dense icon={<Icon name="bolt" />} tone="secondary" value={formatPct(cachePct, loc)} label={t('admin.generation.kpi.cacheHit')} />
      </div>

      <div className="flex flex-wrap gap-2">
        {stages.map(({ key, icon, terminal, idle }) => {
          const count = heartbeat.stageBreakdown[key] ?? 0;
          const isActive = !terminal && !idle && count > 0;
          return (
            <div
              key={key}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors duration-150',
                isActive ? 'bg-accent-soft text-accent-strong' : count > 0 ? 'bg-success-soft text-success-strong' : 'bg-surface-sunken text-content-faint',
              )}
            >
              <Icon name={icon} className="!text-[16px]" />
              <span>{t(`admin.generation.stages.${key}`, { defaultValue: key })}</span>
              <span className={cn('lf-number font-medium', isActive && 'animate-pulse')}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
