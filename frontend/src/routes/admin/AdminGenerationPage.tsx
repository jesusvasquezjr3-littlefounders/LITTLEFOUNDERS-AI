import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Dropdown, Icon, ProgressBar, StatCard, Table, TrendChart, type DropdownOption, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminPage, AdminEmpty, Unavailable, useAdminData } from './adminShared';
import { PipelineFlow } from './PipelineFlow';
import { LiveStats } from './LiveStats';
import { AnalyticsCharts } from './AnalyticsCharts';
import { CoachTab } from './CoachTab';
import { AlertBanner } from './AlertBanner';
import { SlotDetailModal } from './SlotDetailModal';
import { RunTimeline } from './RunTimeline';
import { RunCompare } from './RunCompare';
import type { GenerationOverview, LiveRunHeartbeat, RunDetail, SlotItem, TrackListItem } from './generationTypes';
import { failedFromI18nKey, formatPct, formatFixed } from './generationI18n';

/*
 * /admin/generation — v2 rewrite (2026-07-27). Four tabs:
 *   1. Live Monitor — real-time PipelineFlow canvas + LiveStats polling
 *   2. Run History — the original track/run inspector (retained from v1)
 *   3. Analytics   — cross-run cost/quality/cache trends
 *   4. Coach       — forge:coach improvement loop: failure diagnosis, judge
 *                    quality trends, cost efficiency, evidence-backed actions
 */

type Tab = 'live' | 'history' | 'analytics' | 'coach';

const TABS: { key: Tab; icon: string }[] = [
  { key: 'live', icon: 'sensors' },
  { key: 'history', icon: 'history' },
  { key: 'analytics', icon: 'analytics' },
  { key: 'coach', icon: 'neurology' },
];

const RUBRIC_DIMENSIONS = [
  'kid_safety', 'age_fit', 'concreteness', 'pedagogy',
  'cognitive_engagement', 'feedback_quality', 'distractor_quality',
  'narrative_quality', 'naturalness',
] as const;

const STAGE_TONES: Record<string, string> = {
  pending: 'bg-outline', planned: 'bg-accent', written: 'bg-error',
  reviewed: 'bg-warning', localized: 'bg-warning', illustrated: 'bg-accent',
  unknown: 'bg-outline',
};

const STATE_BADGE: Record<string, string> = {
  published: 'bg-success-soft text-success-strong',
  failed: 'bg-error-soft text-error-strong',
  'dry-run': 'bg-surface-sunken text-content-muted',
  skipped: 'bg-warning-soft text-warning-strong',
};

function slotLeaf(slotId: string): string {
  return slotId.split('/').slice(-2).join('/');
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminGenerationPage() {
  const { t } = useTranslation();
  const { data: overview } = useAdminData<GenerationOverview>('/admin/generation');
  const [tab, setTab] = useState<Tab>('live');
  const [liveHeartbeat, setLiveHeartbeat] = useState<LiveRunHeartbeat | null>(null);

  const handleHeartbeat = useCallback((hb: LiveRunHeartbeat | null) => {
    setLiveHeartbeat(hb);
  }, []);

  return (
    <AdminPage titleKey="admin.generation.title" subtitleKey="admin.generation.subtitle">
      {/* Tab bar */}
      <nav className="mb-5 flex gap-1 rounded-xl bg-surface-sunken p-1 w-fit" role="tablist" aria-label={t('admin.generation.tabs.aria')}>
        {TABS.map(({ key, icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-base text-content shadow-glass-sm'
                : 'text-content-muted hover:text-content',
            )}
          >
            <span className="material-symbols-outlined text-base leading-none">{icon}</span>
            <span className="hidden sm:inline">{t(`admin.generation.tabs.${key}`)}</span>
          </button>
        ))}
        {/* Live indicator dot when a run is active */}
        {liveHeartbeat && (
          <span className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-accent">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" aria-hidden />
            <span className="hidden sm:inline">{t('admin.generation.live.badge')}</span>
          </span>
        )}
      </nav>

      {/* Live anomaly alerts */}
      <AlertBanner heartbeat={liveHeartbeat} className="mb-5" />

      {overview.state === 'loading' ? (
        <Card className="p-5">
          <p className="lf-body-sm flex items-center gap-2 text-content-muted">
            <Icon name="progress_activity" className="animate-spin" /> {t('admin.generation.loading')}
          </p>
        </Card>
      ) : overview.state === 'error' ? (
        <Unavailable code={overview.code} />
      ) : tab === 'live' ? (
        <LiveTab heartbeat={liveHeartbeat} onHeartbeat={handleHeartbeat} />
      ) : tab === 'history' ? (
        <HistoryTab overview={overview.data} />
      ) : tab === 'analytics' ? (
        <AnalyticsTab overview={overview.data} />
      ) : (
        <CoachTab />
      )}
    </AdminPage>
  );
}

// ── Live Monitor tab ─────────────────────────────────────────────────────────

function LiveTab({ heartbeat, onHeartbeat }: { heartbeat: LiveRunHeartbeat | null; onHeartbeat: (hb: LiveRunHeartbeat | null) => void }) {
  return (
    <div className="space-y-5">
      <PipelineFlow heartbeat={heartbeat} />
      <LiveStats onHeartbeat={onHeartbeat} />
    </div>
  );
}

// ── Run History tab (preserved from v1) ──────────────────────────────────────

function HistoryTab({ overview }: { overview: GenerationOverview }) {
  const { t, i18n } = useTranslation();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [slotModal, setSlotModal] = useState<{ runId: string; slotId: string } | null>(null);
  const { tracks, runs } = overview;

  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);
  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD' });
  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });

  const effectiveRunId = selectedRunId ?? runs[0]?.runId ?? null;
  const runOptions: DropdownOption<string>[] = runs.map((r) => ({
    value: r.runId,
    label: `${r.runId} · ${dateFmt.format(new Date(r.updatedAt))}`,
  }));

  return (
    <div className="space-y-5">
      {tracks.length > 0 && (
        <section aria-labelledby="gen-tracks">
          <h2 id="gen-tracks" className="lf-headline mb-3">{t('admin.generation.tracks')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {tracks.map((track) => (
              <TrackCard key={track.trackId} track={track} t={t} nf={nf} usd={usd} dateFmt={dateFmt} />
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <h2 className="lf-headline">{t('admin.generation.history.runs')}</h2>
        {runs.length > 0 && (
          <Dropdown
            value={effectiveRunId ?? ''}
            options={runOptions}
            onChange={(value) => setSelectedRunId(value)}
            ariaLabel={t('admin.generation.selectRun')}
            compact
            align="right"
          />
        )}
      </div>

      {effectiveRunId === null ? (
        <AdminEmpty icon="precision_manufacturing" message={t('admin.generation.empty')} />
      ) : (
        <RunDetailSection key={effectiveRunId} runId={effectiveRunId} onSlotClick={(slotId) => setSlotModal({ runId: effectiveRunId, slotId })} />
      )}

      {/* Timeline for the selected run */}
      {effectiveRunId && (
        <RunTimeline runId={effectiveRunId} />
      )}

      {/* Run comparison */}
      {runs.length >= 2 && (
        <section>
          <h2 className="lf-headline mb-3">{t('admin.generation.compare.title')}</h2>
          <RunCompare runs={runs} />
        </section>
      )}

      {/* Slot detail modal */}
      {slotModal && (
        <SlotDetailModal
          runId={slotModal.runId}
          slotId={slotModal.slotId}
          onClose={() => setSlotModal(null)}
        />
      )}
    </div>
  );
}

function TrackCard({ track, t, nf, usd, dateFmt }: { track: TrackListItem; t: (key: string, opts?: Record<string, unknown>) => string; nf: Intl.NumberFormat; usd: Intl.NumberFormat; dateFmt: Intl.DateTimeFormat }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="lf-title min-w-0 break-all">{track.trackId}</p>
        {track.halted ? (
          <Badge className="bg-error-soft text-error-strong">{t('admin.generation.track.halted')}</Badge>
        ) : (
          <Badge className="bg-success-soft text-success-strong">{t('admin.generation.track.completed')}</Badge>
        )}
      </div>
      <p className="lf-caption mt-1 text-content-muted">
        {track.courseSlug} · {t('admin.generation.track.shards', { count: track.shards })} ·{' '}
        {dateFmt.format(new Date(track.updatedAt))}
      </p>
      <p className="lf-body-sm mt-3">
        <span className="lf-number">{nf.format(track.totals.published ?? 0)}</span>{' '}
        {t('admin.generation.kpi.published')} · <span className="lf-number">{nf.format(track.totals.failed ?? 0)}</span>{' '}
        {t('admin.generation.kpi.failed')} ·{' '}
        <span className="lf-number">{usd.format(track.totals.usd ?? 0)}</span>
        {track.budgetUsd !== null && <span className="text-content-muted"> / {usd.format(track.budgetUsd)}</span>}
      </p>
      {track.halted && <p className="lf-caption mt-2 break-words text-error">{track.halted}</p>}
      {track.mopUp.length > 0 && (
        <p className="lf-caption mt-2 text-content-muted">
          {t('admin.generation.track.mopUp', { count: track.mopUp.length })}: {track.mopUp.map(slotLeaf).join(', ')}
        </p>
      )}
    </Card>
  );
}

// ── Analytics tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ overview }: { overview: GenerationOverview }) {
  const { runs } = overview;
  const courses = [...new Set(runs.map((r) => r.courseSlug))].sort();
  return <AnalyticsCharts courses={courses} />;
}

// ── RunDetailSection (unchanged from v1 — preserved verbatim) ───────────────

function RunDetailSection({ runId, onSlotClick }: { runId: string; onSlotClick?: (slotId: string) => void }) {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<RunDetail>(`/admin/generation/runs/${encodeURIComponent(runId)}`);

  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);
  const compact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact' });
  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });
  const loc = i18n.resolvedLanguage ?? 'en-US';

  if (data.state === 'loading') {
    return (
      <Card className="p-5">
        <p className="lf-body-sm flex items-center gap-2 text-content-muted">
          <Icon name="progress_activity" className="animate-spin" /> {t('admin.generation.loading')}
        </p>
      </Card>
    );
  }
  if (data.state === 'error') return <Unavailable code={data.code} />;

  const { run, slots } = data.data;
  const cachePct = run.tokensUsed > 0 ? (run.cachedTokens / run.tokensUsed) * 100 : 0;
  const publishedCount = slots.filter((s) => s.state === 'published').length;
  const failedCount = slots.filter((s) => s.state === 'failed').length;
  const imagesBilled = slots.reduce((n, s) => n + s.imagesBilled, 0);
  const imagesInherited = slots.reduce((n, s) => n + s.imagesInherited, 0);

  const heatmap = new Map<string, number>();
  for (const slot of slots) {
    if (slot.state !== 'failed') continue;
    const stage = slot.failedFrom ?? 'unknown';
    heatmap.set(stage, (heatmap.get(stage) ?? 0) + 1);
  }
  const failedTotal = [...heatmap.values()].reduce((a, b) => a + b, 0);

  const judged = slots.filter((s) => s.rubric);
  const dimensionMeans = RUBRIC_DIMENSIONS.map((dim) => {
    const values = judged.map((s) => s.rubric?.[dim]).filter((v): v is number => typeof v === 'number');
    return { dim, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, n: values.length };
  }).filter((d) => d.mean !== null) as { dim: string; mean: number; n: number }[];

  const durationPoints = slots
    .filter((s) => s.durationMs !== null)
    .map((s) => ({ label: slotLeaf(s.slotId), value: Math.round((s.durationMs ?? 0) / 1000) }));

  const slotColumns: TableColumn<SlotItem>[] = [
    { key: 'slot', header: t('admin.generation.slots.slot'), primary: true, cell: (s) => <span className="break-all">{slotLeaf(s.slotId)}</span> },
    {
      key: 'state',
      header: t('admin.generation.slots.state'),
      cell: (s) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Badge className={STATE_BADGE[s.state] ?? 'bg-surface-sunken text-content-muted'}>
            {t(`admin.generation.states.${s.state}`, { defaultValue: s.state })}
          </Badge>
          {s.salvaged && <Badge className="bg-warning-soft text-warning-strong">{t('admin.generation.salvaged')}</Badge>}
        </span>
      ),
    },
    { key: 'stage', header: t('admin.generation.slots.stage'), cell: (s) => (s.failedFrom ? <span className="lf-number">{t(`admin.generation.failedFromLabels.${failedFromI18nKey(s.failedFrom)}`, { defaultValue: s.failedFrom })}</span> : t('admin.generation.noData')) },
    {
      key: 'cycles',
      header: t('admin.generation.slots.cycles'),
      numeric: true,
      cell: (s) =>
        s.reviewCycles === null ? t('admin.generation.noData') : (
          <span className="lf-number">
            {s.reviewCycles}
            {s.earlyStopped ? ` (${t('admin.generation.earlyStop')})` : ''}
          </span>
        ),
    },
    {
      key: 'duration',
      header: t('admin.generation.slots.duration'),
      numeric: true,
      cell: (s) => (s.durationMs === null ? t('admin.generation.noData') : <span className="lf-number">{formatFixed(Math.round(s.durationMs / 1000), loc)}{t('admin.generation.secondsUnit')}</span>),
    },
    {
      key: 'images',
      header: t('admin.generation.slots.images'),
      numeric: true,
      cell: (s) => <span className="lf-number">{s.imagesGenerated}·{s.imagesBilled}·{s.imagesInherited}</span>,
    },
    {
      key: 'error',
      header: t('admin.generation.slots.error'),
      cell: (s) => (s.error ? <span className="lf-caption break-words text-content-muted">{s.error.slice(0, 140)}</span> : t('admin.generation.noData')),
    },
  ];

  return (
    <>
      <section aria-labelledby="gen-kpis">
        <h2 id="gen-kpis" className="lf-headline mb-3">
          {t('admin.generation.runTitle', { runId: run.runId })}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
          <StatCard dense icon={<Icon name="task_alt" />} tone="primary" value={`${nf.format(publishedCount)}/${nf.format(slots.length)}`} label={t('admin.generation.kpi.published')} />
          <StatCard dense icon={<Icon name="error" />} tone="accent" value={nf.format(failedCount)} label={t('admin.generation.kpi.failed')} />
          <StatCard dense icon={<Icon name="payments" />} tone="secondary" value={usd.format(run.usdUsed)} label={t('admin.generation.kpi.cost')} />
          <StatCard dense icon={<Icon name="numbers" />} tone="primary" value={compact.format(run.tokensUsed)} label={t('admin.generation.kpi.tokens')} />
          <StatCard dense icon={<Icon name="bolt" />} tone="secondary" value={formatPct(cachePct, loc)} label={t('admin.generation.kpi.cacheHit')} />
          <StatCard dense icon={<Icon name="image" />} tone="accent" value={`${nf.format(imagesBilled)}+${nf.format(imagesInherited)}`} label={t('admin.generation.kpi.images')} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="gen-heatmap">
          <Card className="p-5">
            <h2 id="gen-heatmap" className="lf-label mb-3 text-content-muted">{t('admin.generation.heatmap.title')}</h2>
            {failedTotal === 0 ? (
              <p className="lf-body-sm text-content-muted">{t('admin.generation.heatmap.empty')}</p>
            ) : (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={t('admin.generation.heatmap.title')}>
                  {[...heatmap.entries()].map(([stage, count]) => (
                    <div key={stage} className={cn('h-full', STAGE_TONES[stage] ?? 'bg-outline')} style={{ width: `${(count / failedTotal) * 100}%` }} />
                  ))}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {[...heatmap.entries()].map(([stage, count]) => (
                    <li key={stage} className="lf-caption flex items-center gap-1.5 text-content-muted">
                      <span className={cn('h-2 w-2 rounded-full', STAGE_TONES[stage] ?? 'bg-outline')} aria-hidden />
                      {t(`admin.generation.failedFromLabels.${failedFromI18nKey(stage)}`, { defaultValue: stage })} · <span className="lf-number">{count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </section>

        <section aria-labelledby="gen-judge">
          <Card className="p-5">
            <h2 id="gen-judge" className="lf-label mb-1 text-content-muted">{t('admin.generation.judge.title', { count: judged.length })}</h2>
            <p className="lf-caption mb-3 text-content-faint">{t('admin.generation.judge.note')}</p>
            {dimensionMeans.length === 0 ? (
              <p className="lf-body-sm text-content-muted">{t('admin.generation.judge.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dimensionMeans.map(({ dim, mean }) => (
                  <li key={dim} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                    <span className="lf-caption truncate text-content-muted">{t(`admin.generation.dims.${dim}`, { defaultValue: dim })}</span>
                    <ProgressBar className="col-span-2 sm:col-span-1" value={(mean / 5) * 100} tone={mean >= 4 ? 'primary' : 'accent'} label={dim} />
                    <span className="lf-number lf-caption text-right">{formatFixed(mean, loc, 2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {durationPoints.length > 1 && (
        <section aria-labelledby="gen-duration">
          <Card className="p-5">
            <h2 id="gen-duration" className="lf-label mb-3 text-content-muted">{t('admin.generation.duration.title')}</h2>
            <TrendChart points={durationPoints} ariaLabel={t('admin.generation.duration.title')} />
          </Card>
        </section>
      )}

      <section aria-labelledby="gen-slots">
        <h2 id="gen-slots" className="lf-headline mb-3">{t('admin.generation.slots.title', { count: slots.length })}</h2>
        {slots.length === 0 ? (
          <AdminEmpty icon="inventory_2" message={t('admin.generation.slots.empty')} />
        ) : (
          <Table columns={slotColumns} rows={slots} rowKey={(s) => s.slotId} onRowClick={(s) => onSlotClick?.(s.slotId)} />
        )}
      </section>
    </>
  );
}
