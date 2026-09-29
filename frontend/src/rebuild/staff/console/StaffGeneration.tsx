import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Button, Card, Chip, DataTable, EmptyState, InlineNotice, List, ListRow, ProgressBar, SegmentedControl, SelectField, Sheet, type TableColumn,
} from '../../design/controls';
import {
  alertsFor, GENERATION_VIEWS, isAnalytics, isCoach, isCoachAction, isComparison, isLiveStatus, isOverview, isRunDetail, isSlotDetail, isSnapshots, LIVE_STAGES,
  POLL_MS, processed, RUBRIC_DIMENSIONS, slotLeaf, sortRuns, stageOf,
  type Alert, type Analytics, type CoachAction, type GenerationView, type LiveFeed, type LiveRun, type RunSummary, type Slot,
} from './generationApi';
import { useStaffRead, type StaffApi } from './staffConsoleApi';
import { CopyId, Facts, LoadFailure, Loading, Metrics, ShareBars, StaffPage, useFormats } from './ConsoleParts';
import { JudgeScores, SeriesChart } from './SeriesChart';
import { fill, labelOf, useConsoleCopy, type ConsoleCopy } from './staffConsoleCopy';
import type { Locale } from '../../design/copyBudget';

/*
 * S7 Generation (manage_content), W2T.2: how Forge behaved on every course
 * generation, in four views of one page.
 *
 *   Live         the active runs, polled from Core every 4 s (the reliable
 *                baseline); the route host may add Supabase Realtime as an
 *                accelerator, and a failed push is said, never passed off as
 *                ordinary polling. The legacy React Flow canvas is replaced by
 *                the same stage counts as an ordered list with a state word.
 *   Run history  mass runs (tracks), one run in detail (its lessons, failure
 *                stages, judge scores, time per lesson), its heartbeat
 *                timeline, one lesson's details, and two runs compared.
 *   Trends       cost, cache and quality across runs, the success rate and
 *                the cost forecast.
 *   Coach        the deterministic diagnosis and its evidence-backed proposals.
 *
 * Read-only: nothing here changes content or starts a run (OD-23 zero spend).
 * Every figure is written as text; a chart only repeats it.
 */

function useMoney(locale: Locale) {
  return useMemo(() => {
    const usd = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 });
    const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    const share = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
    const score = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      usd: (value: number) => usd.format(value),
      compact: (value: number) => compact.format(value),
      /** A share given as 0-1. */
      share: (value: number) => share.format(value),
      /** A share given as 0-100, as Forge's telemetry reports cache hits. */
      pct: (value: number) => share.format(value / 100),
      score: (value: number) => score.format(value),
    };
  }, [locale]);
}

const stageLabel = (copy: ConsoleCopy, stage: string) => labelOf(copy.generation.option, `stage_${stage}`).replace(/^stage_/, '');
const dimensionLabel = (copy: ConsoleCopy, dimension: string) => {
  const label = (copy.generation.option as Record<string, string>)[`dim_${dimension}`];
  return label ?? dimension;
};

function stateChip(copy: ConsoleCopy, state: string) {
  const t = copy.generation.option;
  if (state === 'published') return <Chip tone="success" glyph="check">{t.state_published}</Chip>;
  if (state === 'failed') return <Chip tone="error" glyph="cross">{t.state_failed}</Chip>;
  if (state === 'skipped') return <Chip tone="warning" glyph="info">{t.state_skipped}</Chip>;
  if (state === 'dry-run') return <Chip tone="sky" glyph="info">{t.state_dryRun}</Chip>;
  return <Chip tone="sky" glyph="info">{state}</Chip>;
}

/* ------------------------------------------------------------------------- */
/*  Alerts                                                                   */
/* ------------------------------------------------------------------------- */

function Alerts({ alerts }: { alerts: readonly Alert[] }) {
  const { copy, locale } = useConsoleCopy();
  const money = useMoney(locale);
  const t = copy.generation.body;
  if (!alerts.length) return null;
  const text = (alert: Alert): [string, string] => {
    switch (alert.id) {
      case 'liveCost': return [fill(t.alertLiveCost, { cost: money.usd(alert.projected) }), fill(t.alertLiveCostDetail, { spent: money.usd(alert.spent), progress: money.share(alert.progress) })];
      case 'lowCache': return [fill(t.alertLowCache, { share: money.share(alert.share) }), t.alertLowCacheDetail];
      case 'highFail': return [fill(t.alertHighFail, { share: money.share(alert.share) }), fill(t.alertHighFailDetail, { failed: String(alert.failed), total: String(alert.total) })];
      case 'qualityDrop': return [fill(t.alertQualityDrop, { dimension: dimensionLabel(copy, alert.dimension), from: money.score(alert.from), to: money.score(alert.to) }), t.alertQualityDropDetail];
      case 'costSpike': return [t.alertCostSpike, fill(t.alertCostSpikeDetail, { latest: money.usd(alert.latest), average: money.usd(alert.average) })];
      default: return ['', ''];
    }
  };
  return <section className="lf-staff-section" aria-labelledby="staff-alerts" data-alerts={alerts.length}>
    <h2 id="staff-alerts" data-copy-role="heading">{copy.generation.heading.alerts}</h2>
    <ul className="lf-staff-alerts">
      {alerts.map((alert, index) => {
        const [title, detail] = text(alert);
        return <li key={`${alert.id}-${index}`} data-alert={alert.id} data-severity={alert.severity}>
          {alert.severity === 'critical' ? <Chip tone="error" glyph="warning">{t.critical}</Chip> : <Chip tone="warning" glyph="info">{t.warning}</Chip>}
          <p data-copy-role="body" className="lf-staff-alert-title">{title}</p>
          <p data-copy-role="body" className="lf-staff-muted">{detail}</p>
        </li>;
      })}
    </ul>
  </section>;
}

/* ------------------------------------------------------------------------- */
/*  Live                                                                     */
/* ------------------------------------------------------------------------- */

const STALE_MS = 2 * 60 * 1000;

/** Core's poll is the baseline; a push only makes a change appear sooner and drops a run it stops hearing about after 2 minutes. */
export function useLiveRuns(api: StaffApi, feed: LiveFeed | undefined, pollMs: number) {
  const [runs, setRuns] = useState<LiveRun[]>([]);
  const [poll, setPoll] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [push, setPush] = useState<'off' | 'connected' | 'failed'>('off');
  const stale = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const clearStale = useCallback((runId: string) => {
    const timer = stale.current.get(runId);
    if (timer) clearTimeout(timer);
    stale.current.delete(runId);
  }, []);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      const result = await api.get<unknown>('/admin/generation/live');
      if (!live) return;
      if (result.ok && isLiveStatus(result.data)) {
        const next = sortRuns(result.data.activeRuns);
        next.forEach((run) => clearStale(run.runId));
        setRuns(next);
        setPoll('ready');
      } else setPoll('failed');
    };
    void tick();
    const interval = setInterval(() => void tick(), pollMs);
    return () => { live = false; clearInterval(interval); };
  }, [api, pollMs, clearStale]);
  useEffect(() => {
    if (!feed) return undefined;
    const timers = stale.current;
    const stop = feed.subscribe({
      onRun: (run) => {
        setRuns((current) => sortRuns([...current.filter((entry) => entry.runId !== run.runId), run]));
        clearStale(run.runId);
        timers.set(run.runId, setTimeout(() => setRuns((current) => current.filter((entry) => entry.runId !== run.runId)), STALE_MS));
      },
      onRemove: (runId) => { clearStale(runId); setRuns((current) => current.filter((entry) => entry.runId !== runId)); },
      onStatus: (status) => setPush(status),
    });
    return () => {
      stop();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, [feed, clearStale]);
  return { runs, poll, push };
}

function LiveView({ api, feed, pollMs }: { api: StaffApi; feed?: LiveFeed; pollMs: number }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const money = useMoney(locale);
  const t = copy.generation;
  const { runs, poll, push } = useLiveRuns(api, feed, pollMs);
  const [selected, setSelected] = useState<string | null>(null);
  const run = runs.find((entry) => entry.runId === selected) ?? runs[0] ?? null;
  const transport = push === 'connected' ? t.body.realtime : poll === 'failed' ? t.body.liveFailed : push === 'failed' ? t.body.realtimeFailed
    : poll === 'ready' ? t.body.polling : t.body.connecting;
  const alerts = useMemo(() => alertsFor(run, null), [run]);
  const done = run ? processed(run) : 0;
  return <div className="lf-staff-section" data-view="live">
    <p data-copy-role="body" className="lf-staff-transport" data-transport={push === 'connected' ? 'realtime' : poll === 'failed' ? 'failed' : push === 'failed' ? 'realtime-failed' : poll}
      role="status">{transport}</p>
    {poll === 'loading' && !run ? <Loading />
      : !run ? <EmptyState heading={poll === 'failed' ? t.body.liveFailed : t.body.idle} body={poll === 'failed' ? undefined : t.body.idleHelp} />
        : <>
          <Alerts alerts={alerts} />
          <Card heading={t.heading.run}>
            {runs.length > 1 ? <>
              <p data-copy-role="body">{fill(t.body.activeRuns, { n: format.number(runs.length) })}</p>
              <SelectField label={t.body.run} value={run.runId} onChange={(event) => setSelected(event.target.value)}
                options={runs.map((entry) => ({ value: entry.runId, label: `${entry.courseSlug} · ${entry.runId}`, role: 'data' as const }))} />
            </> : null}
            <Facts items={[
              { id: 'run', label: t.body.run, value: run.runId, ugc: true },
              { id: 'course', label: t.body.course, value: `${run.courseSlug} · ${run.register}`, ugc: true },
              { id: 'since', label: t.body.since, value: format.dateTime(run.startedAt, copy.common.body.notAvailable) },
            ]} />
            <ProgressBar label={fill(t.body.progress, { done: format.number(done), total: format.number(run.totalSlots) })} value={done} max={Math.max(run.totalSlots, 1)}
              valueText={money.share(run.totalSlots > 0 ? done / run.totalSlots : 0)} />
            <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.breakdown, { published: format.number(run.completedSlots), failed: format.number(run.failedSlots), skipped: format.number(run.skippedSlots) })}</p>
          </Card>
          <Metrics label={t.heading.run} items={[
            { id: 'published', label: t.body.published, value: format.number(run.completedSlots) },
            { id: 'failed', label: t.body.failed, value: format.number(run.failedSlots) },
            { id: 'skipped', label: t.body.skipped, value: format.number(run.skippedSlots) },
            { id: 'cost', label: t.body.cost, value: money.usd(run.usdUsed) },
            { id: 'tokens', label: t.body.tokens, value: money.compact(run.tokensUsed) },
            { id: 'cacheHits', label: t.body.cacheHits, value: money.share(run.tokensUsed > 0 ? run.cachedTokens / run.tokensUsed : 0) },
          ]} />
          <Card heading={t.heading.stages}>
            <ol className="lf-staff-stages">
              {LIVE_STAGES.map((stage) => {
                const n = run.stageBreakdown[stage.key] ?? 0;
                const state = stage.terminal ? (n > 0 ? 'done' : null) : stage.idle ? (n > 0 ? 'waiting' : null) : n > 0 ? 'working' : null;
                return <li key={stage.key} data-stage={stage.key} data-state={state ?? 'none'}>
                  <span data-copy-role="body" className="lf-staff-stage-name">{stageLabel(copy, stage.key)}</span>
                  <span data-copy-role="data">{fill(t.body.stageCount, { n: format.number(n) })}</span>
                  {state === 'working' ? <Chip tone="warning" glyph="refresh">{t.body.working}</Chip>
                    : state === 'done' ? <Chip tone="success" glyph="check">{t.body.done}</Chip>
                      : state === 'waiting' ? <Chip tone="sky" glyph="info">{t.body.waiting}</Chip> : null}
                </li>;
              })}
            </ol>
          </Card>
        </>}
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  Run history                                                              */
/* ------------------------------------------------------------------------- */

function SlotSheet({ api, runId, slotId, onClose }: { api: StaffApi; runId: string; slotId: string; onClose: () => void }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const money = useMoney(locale);
  const t = copy.generation;
  const detail = useStaffRead(api, `/admin/generation/slots/${encodeURIComponent(runId)}/${encodeURIComponent(slotId)}`, isSlotDetail);
  const data = detail.load.state === 'ready' ? detail.load.data : null;
  const rubric = data?.rubric ? RUBRIC_DIMENSIONS.flatMap((dimension) => {
    const value = data.rubric?.[dimension];
    return typeof value === 'number' ? [{ id: dimension, label: dimensionLabel(copy, dimension), value }] : [];
  }) : [];
  return <Sheet open onClose={onClose} heading={t.heading.slot} closeLabel={copy.common.action.close}>
    <div className="lf-staff-sheet" data-sheet="slot">
      {detail.load.state === 'loading' ? <Loading />
        : detail.load.state === 'error' ? (detail.load.code === 'NOT_FOUND' ? <EmptyState heading={t.body.slotMissing} /> : <LoadFailure code={detail.load.code} onRetry={detail.reload} />)
          : data ? <>
            <Facts items={[
              { id: 'lesson', label: t.body.lesson, value: slotLeaf(data.slotId), ugc: true },
              { id: 'outcome', label: t.body.outcome, value: stateChip(copy, data.state) },
              ...(data.failedFrom ? [{ id: 'failedAt', label: t.body.failedAt, value: stageLabel(copy, stageOf(data.failedFrom)) }] : []),
              { id: 'duration', label: t.body.duration, value: data.durationHuman ?? (data.durationMs === null ? t.body.notAvailable : fill(t.body.seconds, { n: format.number(Math.round(data.durationMs / 1000)) })) },
              { id: 'cycles', label: t.body.cycles, value: data.reviewCycles === null ? t.body.notAvailable : format.number(data.reviewCycles) },
              { id: 'dropped', label: t.body.dropped, value: format.number(data.droppedSegments) },
              { id: 'images', label: t.body.images, value: `${format.number(data.imagesBilled)} + ${format.number(data.imagesInherited)}` },
              ...(data.run ? [{ id: 'run', label: t.body.run, value: `${data.runId} · ${data.run.courseSlug} · ${format.dateTime(data.run.updatedAt, copy.common.body.notAvailable)}`, ugc: true }] : []),
            ]} />
            {data.salvaged || data.earlyStopped ? <div className="lf-staff-result-row">
              {data.salvaged ? <Chip tone="warning" glyph="info">{t.body.salvaged}</Chip> : null}
              {data.earlyStopped ? <Chip tone="error" glyph="warning">{t.body.earlyStop}</Chip> : null}
            </div> : null}
            {data.error ? <>
              <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.error}</h3>
              <pre className="lf-staff-code" data-copy-role="data">{data.error}</pre>
            </> : null}
            {rubric.length ? <>
              <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.judge}</h3>
              <JudgeScores label={t.heading.judge} rows={rubric} format={money.score} />
            </> : null}
            <CopyId value={data.slotId} />
          </> : null}
    </div>
  </Sheet>;
}

function RunDetailView({ api, runId }: { api: StaffApi; runId: string }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const money = useMoney(locale);
  const t = copy.generation;
  const detail = useStaffRead(api, `/admin/generation/runs/${encodeURIComponent(runId)}`, isRunDetail);
  const [slot, setSlot] = useState<string | null>(null);
  if (detail.load.state === 'loading') return <Loading />;
  if (detail.load.state === 'error') return <LoadFailure code={detail.load.code} onRetry={detail.reload} />;
  if (detail.load.state !== 'ready') return null;
  const { run, slots } = detail.load.data;
  const published = slots.filter((entry) => entry.state === 'published').length;
  const failed = slots.filter((entry) => entry.state === 'failed');
  const byStage = new Map<string, number>();
  for (const entry of failed) byStage.set(stageOf(entry.failedFrom ?? 'unknown'), (byStage.get(stageOf(entry.failedFrom ?? 'unknown')) ?? 0) + 1);
  const judged = slots.filter((entry) => entry.rubric);
  const means = RUBRIC_DIMENSIONS.flatMap((dimension) => {
    const values = judged.map((entry) => entry.rubric?.[dimension]).filter((value): value is number => typeof value === 'number');
    return values.length ? [{ id: dimension, label: dimensionLabel(copy, dimension), value: values.reduce((a, b) => a + b, 0) / values.length }] : [];
  });
  const durations = slots.filter((entry) => entry.durationMs !== null).map((entry) => ({ id: entry.slotId, label: slotLeaf(entry.slotId), value: Math.round((entry.durationMs ?? 0) / 1000) }));
  const columns: TableColumn<Slot>[] = [
    { key: 'lesson', label: t.body.lesson, value: (entry) => slotLeaf(entry.slotId), ugc: true },
    { key: 'outcome', label: t.body.outcome, value: (entry) => <span className="lf-staff-chips">{stateChip(copy, entry.state)}{entry.salvaged ? <Chip tone="warning" glyph="info">{t.body.salvaged}</Chip> : null}</span> },
    { key: 'failedAt', label: t.body.failedAt, value: (entry) => (entry.failedFrom ? stageLabel(copy, stageOf(entry.failedFrom)) : t.body.notAvailable) },
    { key: 'cycles', label: t.body.cycles, value: (entry) => (entry.reviewCycles === null ? t.body.notAvailable : `${format.number(entry.reviewCycles)}${entry.earlyStopped ? ` · ${t.body.earlyStop}` : ''}`) },
    { key: 'duration', label: t.body.duration, value: (entry) => (entry.durationMs === null ? t.body.notAvailable : fill(t.body.seconds, { n: format.number(Math.round(entry.durationMs / 1000)) })) },
    { key: 'images', label: t.body.imagesMade, value: (entry) => `${format.number(entry.imagesGenerated)} · ${format.number(entry.imagesBilled)} · ${format.number(entry.imagesInherited)}` },
    { key: 'error', label: t.body.error, value: (entry) => (entry.error ? entry.error.slice(0, 140) : t.body.notAvailable), ugc: true },
    { key: 'details', label: copy.common.body.details, value: (entry) => <Button size="sm" onClick={() => setSlot(entry.slotId)}>{copy.common.action.open}</Button> },
  ];
  return <div className="lf-staff-section" data-run={run.runId}>
    <h3 data-copy-role="data" className="lf-staff-subheading ugc">{run.runId}</h3>
    <Metrics label={t.heading.runDetail} items={[
      { id: 'published', label: t.body.published, value: `${format.number(published)} / ${format.number(slots.length)}` },
      { id: 'failed', label: t.body.failed, value: format.number(failed.length) },
      { id: 'cost', label: t.body.cost, value: money.usd(run.usdUsed) },
      { id: 'tokens', label: t.body.tokens, value: money.compact(run.tokensUsed) },
      { id: 'cacheHits', label: t.body.cacheHits, value: money.share(run.tokensUsed > 0 ? run.cachedTokens / run.tokensUsed : 0) },
      { id: 'images', label: t.body.images, value: `${format.number(slots.reduce((n, entry) => n + entry.imagesBilled, 0))} + ${format.number(slots.reduce((n, entry) => n + entry.imagesInherited, 0))}` },
    ]} />
    <div className="lf-staff-pair">
      <Card heading={t.heading.failures}>
        {failed.length === 0 ? <InlineNotice tone="success">{t.body.noFailures}</InlineNotice>
          : <ShareBars label={t.heading.failures} locale={locale} total={failed.length} tone="mint"
            rows={[...byStage.entries()].sort((a, b) => b[1] - a[1]).map(([stage, n]) => ({ id: stage, label: stageLabel(copy, stage), count: n }))} />}
      </Card>
      <Card heading={t.heading.judge}>
        <p data-copy-role="body" className="lf-staff-muted">{t.body.judgeNote}</p>
        {means.length === 0 ? <p data-copy-role="body">{t.body.judgeEmpty}</p> : <JudgeScores label={t.heading.judge} rows={means} format={money.score} />}
      </Card>
    </div>
    {durations.length > 1 ? <Card heading={t.heading.duration}>
      <SeriesChart label={t.heading.duration} points={durations} format={(value) => fill(t.body.seconds, { n: format.number(value) })} />
    </Card> : null}
    <section className="lf-staff-section" aria-labelledby="staff-slots">
      <h3 id="staff-slots" data-copy-role="heading" className="lf-staff-subheading">{t.heading.slots}</h3>
      {slots.length === 0 ? <EmptyState heading={t.body.slotsEmpty} />
        : <DataTable caption={t.heading.slots} columns={columns} rows={slots} rowKey={(entry) => entry.slotId} />}
    </section>
    <Timeline api={api} runId={run.runId} />
    {slot ? <SlotSheet key={slot} api={api} runId={run.runId} slotId={slot} onClose={() => setSlot(null)} /> : null}
  </div>;
}

function Timeline({ api, runId }: { api: StaffApi; runId: string }) {
  const { copy, locale } = useConsoleCopy();
  const money = useMoney(locale);
  const format = useFormats(locale);
  const t = copy.generation;
  const snapshots = useStaffRead(api, `/admin/generation/snapshots/${encodeURIComponent(runId)}`, isSnapshots);
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }), [locale]);
  if (snapshots.load.state === 'loading') return <Loading />;
  if (snapshots.load.state === 'error') return <LoadFailure code={snapshots.load.code} onRetry={snapshots.reload} />;
  if (snapshots.load.state !== 'ready') return null;
  const rows = snapshots.load.data.snapshots;
  if (rows.length < 2) return <Card heading={t.heading.timeline}><p data-copy-role="body">{t.body.timelineShort}</p></Card>;
  const label = (value: string) => (Number.isNaN(Date.parse(value)) ? value : time.format(new Date(value)));
  return <>
    <Card heading={t.heading.timeline}>
      <SeriesChart label={t.heading.timeline} format={format.number}
        points={rows.map((row, index) => ({ id: `${index}`, label: label(row.createdAt), value: processed(row) }))} />
    </Card>
    <Card heading={t.heading.costTimeline}>
      <SeriesChart label={t.heading.costTimeline} format={money.usd} points={rows.map((row, index) => ({ id: `${index}`, label: label(row.createdAt), value: row.usdUsed }))} />
    </Card>
    <Card heading={t.heading.stageTimeline}>
      <div className="lf-staff-multiples">
        {LIVE_STAGES.filter((stage) => !stage.idle && !stage.terminal).map((stage) => <SeriesChart key={stage.key} compact label={stageLabel(copy, stage.key)} format={format.number}
          points={rows.map((row, index) => ({ id: `${index}`, label: label(row.createdAt), value: row.stageBreakdown[stage.key] ?? 0 }))} />)}
      </div>
    </Card>
  </>;
}

function Compare({ api, runs }: { api: StaffApi; runs: readonly RunSummary[] }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const money = useMoney(locale);
  const t = copy.generation;
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const ready = a && b && a !== b;
  const comparison = useStaffRead(api, ready ? `/admin/generation/compare?runA=${encodeURIComponent(a)}&runB=${encodeURIComponent(b)}` : null, isComparison);
  const options = [{ value: '', label: t.body.chooseTwo }, ...runs.map((run) => ({ value: run.runId, label: `${run.runId} · ${format.date(run.updatedAt, '')}`, role: 'data' as const }))];
  const data = comparison.load.state === 'ready' && comparison.load.data.runs.length === 2 ? comparison.load.data : null;
  const signed = (value: number, render: (n: number) => string) => `${value > 0 ? '+' : ''}${render(value)}`;
  return <Card heading={t.heading.compare}>
    <div className="lf-staff-filters">
      <SelectField label={t.body.runA} value={a} onChange={(event) => setA(event.target.value)} options={options} />
      <SelectField label={t.body.runB} value={b} onChange={(event) => setB(event.target.value)} options={options} />
    </div>
    {a && b && a === b ? <InlineNotice tone="info">{t.body.chooseTwo}</InlineNotice> : null}
    {comparison.load.state === 'loading' ? <Loading /> : comparison.load.state === 'error' ? <InlineNotice tone="error">{t.body.compareFailed}</InlineNotice> : null}
    {data ? <>
      <div className="lf-staff-pair">
        {data.runs.map((run, index) => <div key={run.runId} className="lf-staff-stack" data-compare={index === 0 ? 'a' : 'b'}>
          <h3 data-copy-role="data" className="lf-staff-subheading ugc">{`${index === 0 ? 'A' : 'B'} · ${run.runId}`}</h3>
          <Facts items={[
            { id: 'published', label: t.body.published, value: `${format.number(run.published)} / ${format.number(run.slotsEnumerated)}` },
            { id: 'failed', label: t.body.failed, value: format.number(run.failed) },
            { id: 'cost', label: t.body.cost, value: money.usd(run.usdUsed) },
            { id: 'cacheHits', label: t.body.cacheHits, value: money.pct(run.cacheHitPct) },
            { id: 'images', label: t.body.images, value: `${format.number(run.imagesBilled)} + ${format.number(run.imagesInherited)}` },
          ]} />
        </div>)}
      </div>
      {data.deltas ? <>
        <h3 data-copy-role="heading" className="lf-staff-subheading">{t.heading.deltas}</h3>
        <Facts items={[
          { id: 'published', label: t.body.published, value: signed(data.deltas.published, format.number) },
          { id: 'failed', label: t.body.failed, value: signed(data.deltas.failed, format.number) },
          { id: 'cost', label: t.body.cost, value: signed(data.deltas.usdUsed, money.usd) },
          { id: 'cacheHits', label: t.body.cacheHits, value: signed(data.deltas.cacheHitPct, (n) => money.pct(n)) },
        ]} />
      </> : null}
      <DataTable caption={t.heading.judgeCompare} rowKey={(row) => row.id}
        columns={[
          { key: 'dimension', label: t.heading.judge, value: (row) => row.label },
          { key: 'a', label: 'A', value: (row) => (row.a === null ? t.body.notAvailable : money.score(row.a)) },
          { key: 'b', label: 'B', value: (row) => (row.b === null ? t.body.notAvailable : money.score(row.b)) },
          { key: 'diff', label: t.heading.deltas, value: (row) => (row.a === null || row.b === null ? t.body.notAvailable : signed(row.b - row.a, money.score)) },
        ]}
        rows={RUBRIC_DIMENSIONS.map((dimension) => ({ id: dimension, label: dimensionLabel(copy, dimension),
          a: data.runs[0]!.judgeMeans[dimension] ?? null, b: data.runs[1]!.judgeMeans[dimension] ?? null })).filter((row) => row.a !== null || row.b !== null)} />
    </> : null}
  </Card>;
}

function HistoryView({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const money = useMoney(locale);
  const t = copy.generation;
  const overview = useStaffRead(api, '/admin/generation', isOverview);
  const [runId, setRunId] = useState<string | null>(null);
  if (overview.load.state === 'loading') return <Loading />;
  if (overview.load.state === 'error') return <LoadFailure code={overview.load.code} onRetry={overview.reload} />;
  if (overview.load.state !== 'ready') return null;
  const { tracks, runs } = overview.load.data;
  const current = runId ?? runs[0]?.runId ?? null;
  return <div className="lf-staff-section" data-view="history">
    {tracks.length ? <section className="lf-staff-section" aria-labelledby="staff-tracks">
      <h2 id="staff-tracks" data-copy-role="heading">{t.heading.tracks}</h2>
      <ul className="lf-staff-tracks">
        {tracks.map((track) => <li key={track.trackId} className="lf-staff-track" data-track={track.trackId} data-halted={track.halted ? 'true' : 'false'}>
          <p data-copy-role="data" className="lf-staff-track-id ugc">{track.trackId}</p>
          {track.halted ? <Chip tone="error" glyph="warning">{t.body.halted}</Chip> : <Chip tone="success" glyph="check">{t.body.completed}</Chip>}
          <Facts items={[
            { id: 'course', label: t.body.course, value: `${track.courseSlug} · ${fill(t.body.shards, { n: format.number(track.shards) })}`, ugc: true },
            { id: 'updated', label: t.body.updated, value: format.dateTime(track.updatedAt, copy.common.body.notAvailable) },
            { id: 'published', label: t.body.published, value: format.number(track.totals.published ?? 0) },
            { id: 'failed', label: t.body.failed, value: format.number(track.totals.failed ?? 0) },
            { id: 'cost', label: t.body.cost, value: track.budgetUsd === null ? money.usd(track.totals.usd ?? 0) : `${money.usd(track.totals.usd ?? 0)} / ${money.usd(track.budgetUsd)}` },
          ]} />
          {track.halted ? <p data-copy-role="data" className="lf-staff-error ugc">{track.halted}</p> : null}
          {track.mopUp.length ? <p data-copy-role="data" className="ugc">{`${t.body.mopUp}: ${track.mopUp.map(slotLeaf).join(', ')}`}</p> : null}
        </li>)}
      </ul>
    </section> : null}
    <section className="lf-staff-section" aria-labelledby="staff-run">
      <h2 id="staff-run" data-copy-role="heading">{t.heading.runDetail}</h2>
      {runs.length === 0 || current === null ? <EmptyState heading={t.body.historyEmpty} /> : <>
        <SelectField label={t.body.run} value={current} onChange={(event) => setRunId(event.target.value)}
          options={runs.map((run) => ({ value: run.runId, label: `${run.runId} · ${format.dateTime(run.updatedAt, '')}`, role: 'data' as const }))} />
        <RunDetailView key={current} api={api} runId={current} />
      </>}
    </section>
    {runs.length >= 2 ? <Compare api={api} runs={runs} /> : runs.length === 1 ? <p data-copy-role="body" className="lf-staff-muted">{t.body.needTwo}</p> : null}
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  Trends and Coach                                                         */
/* ------------------------------------------------------------------------- */

function TrendsView({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const money = useMoney(locale);
  const t = copy.generation;
  const analytics = useStaffRead(api, '/admin/generation/analytics', isAnalytics);
  if (analytics.load.state === 'loading') return <Loading />;
  if (analytics.load.state === 'error') return analytics.load.code === 'DATA_UNAVAILABLE'
    ? <EmptyState heading={t.body.trendsEmpty} action={<Button size="sm" onClick={analytics.reload}>{copy.common.action.retry}</Button>} />
    : <LoadFailure code={analytics.load.code} onRetry={analytics.reload} />;
  if (analytics.load.state !== 'ready') return null;
  const data: Analytics = analytics.load.data;
  const day = (value: string) => format.date(value, value);
  // Core lists runs newest first; a chart reads left to right in time.
  const costs = [...data.costTrend].reverse().flatMap((entry) => (entry.usdPerPublished === null ? [] : [{ id: entry.runId, label: day(entry.updatedAt), value: entry.usdPerPublished }]));
  const cache = [...data.cacheEfficiency].reverse().map((entry) => ({ id: entry.runId, label: day(entry.updatedAt), value: entry.cacheHitPct }));
  const latest = data.qualityTrend[0];
  const quality = latest ? RUBRIC_DIMENSIONS.flatMap((dimension) => {
    const value = latest.dimMeans[dimension];
    return typeof value === 'number' ? [{ id: dimension, label: dimensionLabel(copy, dimension), value }] : [];
  }) : [];
  const failures = data.failureByStage.reduce((sum, entry) => sum + entry.count, 0);
  const na = t.body.notAvailable;
  return <div className="lf-staff-section" data-view="trends">
    <Metrics label={t.heading.success} items={[
      { id: 'avgCost', label: t.body.avgCost, value: data.averages.costPerPublished === null ? na : money.usd(data.averages.costPerPublished) },
      { id: 'avgTokens', label: t.body.avgTokens, value: data.averages.tokensPerLesson === null ? na : money.compact(data.averages.tokensPerLesson) },
      { id: 'avgCache', label: t.body.avgCache, value: data.averages.cacheHitPct === null ? na : money.pct(data.averages.cacheHitPct) },
    ]} />
    <Alerts alerts={alertsFor(null, data)} />
    <div className="lf-staff-pair">
      <Card heading={t.heading.success}>
        <ProgressBar label={fill(t.body.successDetail, { passed: format.number(data.stageSuccessRate.passed), total: format.number(data.stageSuccessRate.passed + data.stageSuccessRate.failed) })}
          value={data.stageSuccessRate.rate} max={100} valueText={money.pct(data.stageSuccessRate.rate)} />
      </Card>
      {data.costForecast ? <Card heading={t.heading.forecast}>
        <p data-copy-role="body">{fill(t.body.forecastLesson, { cost: money.usd(data.costForecast.perLesson ?? 0) })}</p>
        <p data-copy-role="body" className="lf-staff-emphasis">{fill(t.body.forecastCourse, { cost: money.usd(data.costForecast.perCourse ?? 0) })}</p>
        <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.forecastBasis, { n: format.number(data.costForecast.basedOn) })}</p>
      </Card> : null}
    </div>
    {costs.length > 1 ? <Card heading={t.heading.costTrend}><SeriesChart label={t.heading.costTrend} points={costs} format={money.usd} /></Card> : null}
    {cache.length > 1 ? <Card heading={t.heading.cacheTrend}><SeriesChart label={t.heading.cacheTrend} points={cache} format={money.pct} /></Card> : null}
    {quality.length ? <Card heading={t.heading.quality}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.judgeNote}</p>
      <JudgeScores label={t.heading.quality} rows={quality} format={money.score} />
    </Card> : null}
    {data.failureByStage.length ? <Card heading={t.heading.failuresAll}>
      <ShareBars label={t.heading.failuresAll} locale={locale} total={failures} tone="mint"
        rows={data.failureByStage.map((entry) => ({ id: entry.stage, label: stageLabel(copy, stageOf(entry.stage)), count: entry.count }))} />
    </Card> : null}
    <p data-copy-role="body" className="lf-staff-muted">{fill(t.body.runsAnalyzed, { n: format.number(data.runsAnalyzed) })}</p>
  </div>;
}

function CoachView({ api }: { api: StaffApi }) {
  const { copy, locale } = useConsoleCopy();
  const format = useFormats(locale);
  const money = useMoney(locale);
  const t = copy.generation;
  const coach = useStaffRead(api, '/admin/generation/coach', isCoach);
  if (coach.load.state === 'loading') return <Loading />;
  if (coach.load.state === 'error') return coach.load.code === 'DATA_UNAVAILABLE'
    ? <EmptyState heading={t.body.coachEmpty} action={<Button size="sm" onClick={coach.reload}>{copy.common.action.retry}</Button>} />
    : <LoadFailure code={coach.load.code} onRetry={coach.reload} />;
  if (coach.load.state !== 'ready') return null;
  const report = coach.load.data;
  const heat = Object.entries(report.failureHeatmap).sort((a, b) => b[1] - a[1]);
  const failures = heat.reduce((sum, [, n]) => sum + n, 0);
  const judge = RUBRIC_DIMENSIONS.flatMap((dimension) => {
    const mean = report.judge.dimensionMeans[dimension];
    const min = report.judge.dimensionMins[dimension];
    return typeof mean === 'number' ? [{ id: dimension, label: dimensionLabel(copy, dimension), value: mean,
      extra: typeof min === 'number' ? fill(t.body.lowest, { n: money.score(min) }) : undefined }] : [];
  });
  const perLesson = report.outcomes.published > 0 ? report.cost.totalUsd / report.outcomes.published : null;
  // Core sends facts only; every word is this locale's and every number is Intl-formatted (02 section 1.2, rule 16).
  const actions = report.proposedActions.filter(isCoachAction);
  const coachLines = (action: CoachAction): { label: string; proposal: string; evidence: string[] } => {
    if (action.tag === 'cost:cache') {
      const { cacheHitPct, wastedUsd } = action.params;
      return { label: t.option.coach_cache, proposal: t.body.coachCacheProposal,
        evidence: [fill(t.body.coachCacheEvidence, { share: money.pct(cacheHitPct), cost: money.usd(wastedUsd) })] };
    }
    if (action.tag === 'failure:stage') {
      const { stage, count, total } = action.params;
      const name = stageLabel(copy, stageOf(stage));
      return { label: fill(t.option.coach_stage, { stage: name }), proposal: fill(t.body.coachStageProposal, { stage: name }),
        evidence: [fill(t.body.coachStageEvidence, { n: format.number(count), total: format.number(total), share: money.share(total > 0 ? count / total : 0) })] };
    }
    if (action.tag === 'cost:perLesson') {
      const p = action.params;
      return { label: t.option.coach_perLesson, proposal: t.body.coachLessonProposal, evidence: [
        fill(t.body.coachLessonEvidence, { cost: money.usd(p.usdPerLesson), published: format.number(p.published) }),
        fill(t.body.coachLessonImages, { inherited: format.number(p.inherited), billed: format.number(p.billed) }),
      ] };
    }
    const { dimension, mean, min, n } = action.params;
    const name = dimensionLabel(copy, dimension);
    return { label: fill(t.option.coach_judge, { dimension: name }), proposal: fill(t.body.coachJudgeProposal, { dimension: name }),
      evidence: [fill(t.body.coachJudgeEvidence, { value: money.score(mean), n: format.number(n), low: money.score(min ?? mean) })] };
  };
  return <div className="lf-staff-section" data-view="coach">
    <Card heading={t.heading.coach}>
      <p data-copy-role="body">{`${report.courseSlug ? `${report.courseSlug} · ` : ''}${fill(t.body.runsAnalyzed, { n: format.number(report.runsAnalyzed) })}`}</p>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.deterministic}</p>
    </Card>
    <Metrics label={t.heading.coach} items={[
      { id: 'published', label: t.body.published, value: format.number(report.outcomes.published) },
      { id: 'failed', label: t.body.failed, value: format.number(report.outcomes.failed) },
      { id: 'cost', label: t.body.cost, value: money.usd(report.cost.totalUsd) },
      { id: 'cacheHits', label: t.body.cacheHits, value: money.pct(report.cost.cacheHitPct) },
      { id: 'images', label: t.body.images, value: `${format.number(report.images.billed)} + ${format.number(report.images.inherited)}` },
    ]} />
    <div className="lf-staff-pair">
      <Card heading={t.heading.failures}>
        {failures === 0 ? <InlineNotice tone="success">{t.body.noFailures}</InlineNotice>
          : <ShareBars label={t.heading.failures} locale={locale} total={failures} tone="mint" rows={heat.map(([stage, n]) => ({ id: stage, label: stageLabel(copy, stageOf(stage)), count: n }))} />}
      </Card>
      <Card heading={t.heading.errors}>
        {report.topErrors.length === 0 ? <p data-copy-role="body">{t.body.noErrors}</p>
          : <List label={t.heading.errors}>{report.topErrors.map((entry, index) => <ListRow key={index} title={entry.sample} titleRole="data"
            supporting={fill(t.body.times, { n: format.number(entry.count) })} />)}</List>}
      </Card>
    </div>
    {report.judge.judged > 0 ? <Card heading={t.heading.judge}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.judgeNote}</p>
      <JudgeScores label={t.heading.judge} rows={judge} format={money.score} />
      <Facts items={[
        { id: 'cycle1', label: t.body.cycle1, value: format.number(report.judge.cyclesHistogram.cycle1) },
        { id: 'cycle2', label: t.body.cycle2, value: format.number(report.judge.cyclesHistogram.cycle2) },
        { id: 'cycle3', label: t.body.cycle3, value: format.number(report.judge.cyclesHistogram.cycle3) },
        { id: 'earlyStops', label: t.body.earlyStops, value: format.number(report.judge.cyclesHistogram.earlyStops) },
      ]} />
    </Card> : null}
    {report.judge.worstLessons.length ? <Card heading={t.heading.worst}>
      <List label={t.heading.worst}>{report.judge.worstLessons.map((entry) => <ListRow key={entry.slotId} title={slotLeaf(entry.slotId)} titleRole="data"
        supporting={entry.dims.map((dimension) => dimensionLabel(copy, dimension)).join(', ')} />)}</List>
    </Card> : null}
    <Card heading={t.heading.efficiency}>
      <Facts items={[
        { id: 'totalCost', label: t.body.totalCost, value: money.usd(report.cost.totalUsd) },
        { id: 'totalTokens', label: t.body.totalTokens, value: money.compact(report.cost.totalTokens) },
        { id: 'costPerLesson', label: t.body.costPerLesson, value: perLesson === null ? t.body.notAvailable : money.usd(perLesson) },
        { id: 'imageReuse', label: t.body.imageReuse, value: report.images.generated > 0
          ? `${money.share(report.images.inherited / report.images.generated)} · ${fill(t.body.reuseDetail, { inherited: format.number(report.images.inherited), billed: format.number(report.images.billed) })}`
          : t.body.notAvailable },
      ]} />
    </Card>
    {actions.length ? <Card heading={t.heading.actions}>
      <p data-copy-role="body" className="lf-staff-muted">{t.body.actionsNote}</p>
      <ul className="lf-staff-proposals">
        {actions.map((action, index) => {
          const line = coachLines(action);
          return <li key={index} data-tag={action.tag}>
            <p data-copy-role="option" className="lf-staff-tag">{line.label}</p>
            <p data-copy-role="body">{line.proposal}</p>
            {line.evidence.map((text) => <p key={text} data-copy-role="body" className="lf-staff-muted">{text}</p>)}
          </li>;
        })}
      </ul>
    </Card> : failures === 0 ? <InlineNotice tone="success">{t.body.allClear}</InlineNotice> : null}
  </div>;
}

/* ------------------------------------------------------------------------- */
/*  The page                                                                 */
/* ------------------------------------------------------------------------- */

export function StaffGeneration({ api, liveFeed, pollMs = POLL_MS, initialView = 'live' }: {
  api: StaffApi; liveFeed?: LiveFeed; pollMs?: number; initialView?: GenerationView;
}) {
  const { copy, sections } = useConsoleCopy();
  const t = copy.generation;
  const name = useId();
  const [view, setView] = useState<GenerationView>(initialView);
  // A refresh remounts the open view, so every read in it starts again (the live view also keeps polling on its own).
  const [generation, setGeneration] = useState(0);
  return <StaffPage screen="staff-generation" title={sections.generation}
    actions={<Button size="sm" onClick={() => setGeneration((value) => value + 1)}>{copy.common.action.refresh}</Button>}>
    <SegmentedControl legend={t.body.view} name={`${name}-view`} value={view} onValueChange={setView} className="lf-staff-views"
      options={GENERATION_VIEWS.map((value) => ({ value, label: t.option[value] }))} />
    <div key={`${view}:${generation}`} className="lf-staff-section">
      {view === 'live' ? <LiveView api={api} feed={liveFeed} pollMs={pollMs} />
        : view === 'history' ? <HistoryView api={api} />
          : view === 'trends' ? <TrendsView api={api} />
            : <CoachView api={api} />}
    </div>
  </StaffPage>;
}
