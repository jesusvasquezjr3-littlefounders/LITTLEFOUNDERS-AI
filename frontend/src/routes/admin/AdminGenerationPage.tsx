import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Dropdown, Icon, ProgressBar, StatCard, Table, TrendChart, type DropdownOption, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminPage, AdminEmpty, Unavailable, useAdminData } from './adminShared';

/*
 * Generation — the console's window into coursegen's agentic pipeline
 * (/DESIGN.md §Screen Recipes → Console). Everything here reads the 0017
 * telemetry tables through Core (/api/v1/admin/generation*): per-track
 * reports, per-run summaries, and per-slot outcomes with judge rubrics —
 * the permanent record for "what failed, what can we optimize" evaluations.
 * The browser never touches Vault; Core holds the service role.
 */

// ── Contract shapes (mirror backend/src/services/adminData.ts) ───────────────

interface RunListItem {
  runId: string;
  trackId: string | null;
  courseSlug: string;
  register: string;
  published: number;
  failed: number;
  slotsEnumerated: number;
  tokensUsed: number;
  usdUsed: number;
  cachedTokens: number;
  imagesGenerated: number;
  imagesBilled: number;
  updatedAt: string;
}

interface TrackListItem {
  trackId: string;
  courseSlug: string;
  budgetUsd: number | null;
  halted: string | null;
  totals: Record<string, number>;
  failureHeatmap: Record<string, number>;
  mopUp: string[];
  shards: number;
  updatedAt: string;
}

interface GenerationOverview {
  tracks: TrackListItem[];
  runs: RunListItem[];
}

interface SlotItem {
  slotId: string;
  state: string;
  failedFrom: string | null;
  error: string | null;
  salvaged: boolean;
  droppedSegments: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  durationMs: number | null;
  rubric: Record<string, number | string> | null;
  reviewCycles: number | null;
  earlyStopped: boolean;
}

interface RunDetail {
  run: RunListItem;
  slots: SlotItem[];
}

/** The judge's gated dimensions, in rubric order (narrative/naturalness scored but unfloored). */
const RUBRIC_DIMENSIONS = [
  'kid_safety',
  'age_fit',
  'concreteness',
  'pedagogy',
  'cognitive_engagement',
  'feedback_quality',
  'distractor_quality',
  'narrative_quality',
  'naturalness',
] as const;

const STAGE_TONES: Record<string, string> = {
  pending: 'bg-outline',
  planned: 'bg-accent',
  written: 'bg-error',
  reviewed: 'bg-warning',
  localized: 'bg-warning',
  illustrated: 'bg-accent',
  unknown: 'bg-outline',
};

/** Slot final state → Badge soft/strong tone classes (StatusBadge grammar). */
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
  const { t, i18n } = useTranslation();
  const { data: overview } = useAdminData<GenerationOverview>('/admin/generation');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);
  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD' });
  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });

  if (overview.state === 'loading') {
    return (
      <AdminPage titleKey="admin.generation.title" subtitleKey="admin.generation.subtitle">
        <Card className="p-5">
          <p className="lf-body-sm flex items-center gap-2 text-content-muted">
            <Icon name="progress_activity" className="animate-spin" /> {t('admin.generation.loading')}
          </p>
        </Card>
      </AdminPage>
    );
  }
  if (overview.state === 'error') {
    return (
      <AdminPage titleKey="admin.generation.title" subtitleKey="admin.generation.subtitle">
        <Unavailable code={overview.code} />
      </AdminPage>
    );
  }

  const { tracks, runs } = overview.data;
  const effectiveRunId = selectedRunId ?? runs[0]?.runId ?? null;
  const runOptions: DropdownOption<string>[] = runs.map((r) => ({
    value: r.runId,
    label: `${r.runId} · ${dateFmt.format(new Date(r.updatedAt))}`,
  }));

  return (
    <AdminPage
      titleKey="admin.generation.title"
      subtitleKey="admin.generation.subtitle"
      actions={
        runs.length > 0 ? (
          <Dropdown
            value={effectiveRunId ?? ''}
            options={runOptions}
            onChange={(value) => setSelectedRunId(value)}
            ariaLabel={t('admin.generation.selectRun')}
            compact
            align="right"
          />
        ) : undefined
      }
    >
      {tracks.length > 0 && (
        <section aria-labelledby="gen-tracks">
          <h2 id="gen-tracks" className="lf-headline mb-3">
            {t('admin.generation.tracks')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {tracks.map((track) => (
              <Card key={track.trackId} className="p-5">
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
                  {track.budgetUsd !== null && (
                    <span className="text-content-muted"> / {usd.format(track.budgetUsd)}</span>
                  )}
                </p>
                {track.halted && <p className="lf-caption mt-2 break-words text-error">{track.halted}</p>}
                {track.mopUp.length > 0 && (
                  <p className="lf-caption mt-2 text-content-muted">
                    {t('admin.generation.track.mopUp', { count: track.mopUp.length })}: {track.mopUp.map(slotLeaf).join(', ')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {effectiveRunId === null ? (
        <AdminEmpty icon="precision_manufacturing" message={t('admin.generation.empty')} />
      ) : (
        <RunDetailSection key={effectiveRunId} runId={effectiveRunId} />
      )}
    </AdminPage>
  );
}

// ── Run detail (owns its own fetch, BreakdownCard pattern) ───────────────────

function RunDetailSection({ runId }: { runId: string }) {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<RunDetail>(`/admin/generation/runs/${encodeURIComponent(runId)}`);

  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);
  const compact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact' });
  // narrowSymbol: "$2.96", never "USD 2.96" — the dense KPI track has no room
  // for a currency code (verified truncating at 1280px with the sidebar open).
  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });

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
  // Outcome/image KPIs from the SLOT rows (cumulative across every pass and
  // mop-up of this run-id) — the run row's summary reflects only the LATEST
  // invocation, which after a `--slots` mop-up enumerates a subset.
  const publishedCount = slots.filter((s) => s.state === 'published').length;
  const failedCount = slots.filter((s) => s.state === 'failed').length;
  const imagesBilled = slots.reduce((n, s) => n + s.imagesBilled, 0);
  const imagesInherited = slots.reduce((n, s) => n + s.imagesInherited, 0);

  // Failure heatmap by the stage each failure came from.
  const heatmap = new Map<string, number>();
  for (const slot of slots) {
    if (slot.state !== 'failed') continue;
    const stage = slot.failedFrom ?? 'unknown';
    heatmap.set(stage, (heatmap.get(stage) ?? 0) + 1);
  }
  const failedTotal = [...heatmap.values()].reduce((a, b) => a + b, 0);

  // Judge dimension means over every slot that carries a rubric.
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
    { key: 'stage', header: t('admin.generation.slots.stage'), cell: (s) => (s.failedFrom ? <span className="lf-number">{s.failedFrom}</span> : '—') },
    {
      key: 'cycles',
      header: t('admin.generation.slots.cycles'),
      numeric: true,
      cell: (s) =>
        s.reviewCycles === null ? '—' : (
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
      cell: (s) => (s.durationMs === null ? '—' : <span className="lf-number">{nf.format(Math.round(s.durationMs / 1000))}s</span>),
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
      cell: (s) => (s.error ? <span className="lf-caption break-words text-content-muted">{s.error.slice(0, 140)}</span> : '—'),
    },
  ];

  return (
    <>
      <section aria-labelledby="gen-kpis">
        <h2 id="gen-kpis" className="lf-headline mb-3">
          {t('admin.generation.runTitle', { runId: run.runId })}
        </h2>
        {/* 3 columns until 2xl: six KPI cells at lg truncate with the sidebar open (measured at 1280px). */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
          <StatCard dense icon={<Icon name="task_alt" />} tone="primary" value={`${nf.format(publishedCount)}/${nf.format(slots.length)}`} label={t('admin.generation.kpi.published')} />
          <StatCard dense icon={<Icon name="error" />} tone="accent" value={nf.format(failedCount)} label={t('admin.generation.kpi.failed')} />
          <StatCard dense icon={<Icon name="payments" />} tone="secondary" value={usd.format(run.usdUsed)} label={t('admin.generation.kpi.cost')} />
          <StatCard dense icon={<Icon name="numbers" />} tone="primary" value={compact.format(run.tokensUsed)} label={t('admin.generation.kpi.tokens')} />
          <StatCard dense icon={<Icon name="bolt" />} tone="secondary" value={`${cachePct.toFixed(1)}%`} label={t('admin.generation.kpi.cacheHit')} />
          <StatCard dense icon={<Icon name="image" />} tone="accent" value={`${nf.format(imagesBilled)}+${nf.format(imagesInherited)}`} label={t('admin.generation.kpi.images')} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="gen-heatmap">
          <Card className="p-5">
            <h2 id="gen-heatmap" className="lf-label mb-3 text-content-muted">
              {t('admin.generation.heatmap.title')}
            </h2>
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
                      {stage} · <span className="lf-number">{count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </section>

        <section aria-labelledby="gen-judge">
          <Card className="p-5">
            <h2 id="gen-judge" className="lf-label mb-1 text-content-muted">
              {t('admin.generation.judge.title', { count: judged.length })}
            </h2>
            <p className="lf-caption mb-3 text-content-faint">{t('admin.generation.judge.note')}</p>
            {dimensionMeans.length === 0 ? (
              <p className="lf-body-sm text-content-muted">{t('admin.generation.judge.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dimensionMeans.map(({ dim, mean }) => (
                  <li key={dim} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                    <span className="lf-caption truncate text-content-muted">{t(`admin.generation.dims.${dim}`, { defaultValue: dim })}</span>
                    <ProgressBar className="col-span-2 sm:col-span-1" value={(mean / 5) * 100} tone={mean >= 4 ? 'primary' : 'accent'} label={dim} />
                    <span className="lf-number lf-caption text-right">{mean.toFixed(2)}</span>
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
            <h2 id="gen-duration" className="lf-label mb-3 text-content-muted">
              {t('admin.generation.duration.title')}
            </h2>
            <TrendChart points={durationPoints} ariaLabel={t('admin.generation.duration.title')} />
          </Card>
        </section>
      )}

      <section aria-labelledby="gen-slots">
        <h2 id="gen-slots" className="lf-headline mb-3">
          {t('admin.generation.slots.title', { count: slots.length })}
        </h2>
        {slots.length === 0 ? (
          <AdminEmpty icon="inventory_2" message={t('admin.generation.slots.empty')} />
        ) : (
          <Table columns={slotColumns} rows={slots} rowKey={(s) => s.slotId} />
        )}
      </section>
    </>
  );
}
