/*
 * The Generation section's wire shapes (S7, W2T.2): Forge's telemetry
 * (migrations 0017, 0018, 0020), read only through Core behind the
 * `manage_content` grant (G.1). Hand-mirrored from Core's `routes/admin.ts`
 * and `services/adminData.ts` and checked on arrival: the console is the only
 * reader of these tables, and a payload of the wrong shape is an error state,
 * never a blank inspector.
 *
 *   GET /admin/generation                       tracks and runs
 *   GET /admin/generation/live                  active runs (polled every 4 s)
 *   GET /admin/generation/runs/:runId           one run and its lessons
 *   GET /admin/generation/slots/:runId/:slotId  one lesson of a run
 *   GET /admin/generation/snapshots/:runId      the run's heartbeat history
 *   GET /admin/generation/compare?runA&runB     two runs side by side
 *   GET /admin/generation/analytics             trends across runs
 *   GET /admin/generation/coach                 the deterministic diagnosis
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isNullableNumber = (value: unknown): value is number | null => value === null || isNumber(value);
const arrayOf = <T>(value: unknown, item: (entry: unknown) => entry is T): value is T[] => Array.isArray(value) && value.every(item);
const isCounts = (value: unknown): value is Record<string, number> => isRecord(value) && Object.values(value).every(isNumber);

/* ---- Stages ------------------------------------------------------------- */

/** Forge's lesson pipeline, in order. `idle` counts a queue, `terminal` counts finished lessons. */
export const LIVE_STAGES: readonly { key: string; idle?: true; terminal?: true }[] = [
  { key: 'pending', idle: true }, { key: 'planning' }, { key: 'writing' }, { key: 'reviewing' }, { key: 'localizing' },
  { key: 'illustrating' }, { key: 'publishing' }, { key: 'published', terminal: true }, { key: 'skipped', terminal: true },
];

/** A checkpoint's `failedFrom` names the last stage that finished; the copy names the stage it failed in. */
const FAILED_FROM: Record<string, string> = {
  pending: 'pending', planned: 'planning', written: 'writing', reviewed: 'reviewing', localized: 'localizing', illustrated: 'illustrating',
  planning: 'planning', writing: 'writing', reviewing: 'reviewing', authoring: 'authoring', simulating: 'simulating', judging: 'judging',
  localizing: 'localizing', illustrating: 'illustrating', publishing: 'publishing',
};
export function stageOf(failedFrom: string): string {
  return FAILED_FROM[failedFrom] ?? 'unknown';
}

/** The judge's rubric dimensions (0-5), in the order the legacy console and Forge report them. */
export const RUBRIC_DIMENSIONS = [
  'kid_safety', 'age_fit', 'concreteness', 'pedagogy', 'cognitive_engagement', 'feedback_quality', 'distractor_quality', 'narrative_quality', 'naturalness',
] as const;

/** The last two parts of a slot id (course/…/topic/lesson → topic/lesson), as the legacy console showed it. */
export function slotLeaf(slotId: string): string {
  return slotId.split('/').slice(-2).join('/');
}

/* ---- Live runs ---------------------------------------------------------- */

export interface LiveRun {
  runId: string; trackId: string | null; courseSlug: string; register: string;
  activeSlots: number; completedSlots: number; failedSlots: number; skippedSlots: number; totalSlots: number;
  stageBreakdown: Record<string, number>; tokensUsed: number; usdUsed: number; cachedTokens: number;
  imagesGenerated: number; imagesBilled: number; imagesInherited: number; startedAt: string; updatedAt: string;
}
const isLiveRun = (r: unknown): r is LiveRun => isRecord(r) && isString(r.runId) && isString(r.courseSlug) && isNumber(r.completedSlots)
  && isNumber(r.failedSlots) && isNumber(r.skippedSlots) && isNumber(r.totalSlots) && isCounts(r.stageBreakdown) && isNumber(r.tokensUsed)
  && isNumber(r.usdUsed) && isNumber(r.cachedTokens) && isString(r.startedAt) && isString(r.updatedAt);
export const isLiveStatus = (value: unknown): value is { activeRuns: LiveRun[] } => isRecord(value) && arrayOf(value.activeRuns, isLiveRun);

export const processed = (run: Pick<LiveRun, 'completedSlots' | 'failedSlots' | 'skippedSlots'>) => run.completedSlots + run.failedSlots + run.skippedSlots;

/** Newest heartbeat first; a row without an id or a readable time is dropped. */
export function sortRuns(runs: readonly LiveRun[]): LiveRun[] {
  return runs.filter((run) => run.runId && Number.isFinite(Date.parse(run.updatedAt))).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

const count = (value: unknown) => { const n = Number(value ?? 0); return Number.isFinite(n) ? Math.max(0, n) : 0; };

/** One untrusted snake_case row of `generation_runs_live` (the Realtime push), sanitized. */
export function mapLiveRow(row: Record<string, unknown>): LiveRun {
  const stageBreakdown: Record<string, number> = {};
  if (isRecord(row.stage_breakdown)) {
    for (const [stage, value] of Object.entries(row.stage_breakdown)) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) stageBreakdown[stage] = n;
    }
  }
  return {
    runId: String(row.run_id ?? ''), trackId: row.track_id ? String(row.track_id) : null, courseSlug: String(row.course_slug ?? ''),
    register: String(row.register ?? 'kid'), activeSlots: count(row.active_slots), completedSlots: count(row.completed_slots),
    failedSlots: count(row.failed_slots), skippedSlots: count(row.skipped_slots), totalSlots: count(row.total_slots), stageBreakdown,
    tokensUsed: count(row.tokens_used), usdUsed: count(row.usd_used), cachedTokens: count(row.cached_tokens),
    imagesGenerated: count(row.images_generated), imagesBilled: count(row.images_billed), imagesInherited: count(row.images_inherited),
    startedAt: String(row.started_at ?? ''), updatedAt: String(row.updated_at ?? ''),
  };
}

/**
 * The push transport the route host may offer (Supabase Realtime on
 * `generation_runs_live`). Core's poll stays the reliable baseline: the push
 * only makes a change appear sooner, and its failure is reported, never
 * mistaken for ordinary polling.
 */
export type LiveFeedStatus = 'connected' | 'failed';
export interface LiveFeed {
  subscribe(handlers: { onRun: (run: LiveRun) => void; onRemove: (runId: string) => void; onStatus: (status: LiveFeedStatus) => void }): () => void;
}

/* ---- History ------------------------------------------------------------ */

export interface RunSummary {
  runId: string; trackId: string | null; courseSlug: string; register: string; published: number; failed: number; slotsEnumerated: number;
  tokensUsed: number; usdUsed: number; cachedTokens: number; imagesGenerated: number; imagesBilled: number; updatedAt: string;
}
export interface Track {
  trackId: string; courseSlug: string; budgetUsd: number | null; halted: string | null; totals: Record<string, number>;
  mopUp: string[]; shards: number; updatedAt: string;
}
export interface GenerationOverview { tracks: Track[]; runs: RunSummary[] }
const isRun = (r: unknown): r is RunSummary => isRecord(r) && isString(r.runId) && isString(r.courseSlug) && isNumber(r.published)
  && isNumber(r.failed) && isNumber(r.usdUsed) && isNumber(r.tokensUsed) && isString(r.updatedAt);
const isTrack = (t: unknown): t is Track => isRecord(t) && isString(t.trackId) && isString(t.courseSlug) && isNullableNumber(t.budgetUsd)
  && (t.halted === null || isString(t.halted)) && isCounts(t.totals) && arrayOf(t.mopUp, isString) && isNumber(t.shards) && isString(t.updatedAt);
export const isOverview = (value: unknown): value is GenerationOverview => isRecord(value) && arrayOf(value.tracks, isTrack) && arrayOf(value.runs, isRun);

export interface Slot {
  slotId: string; state: string; failedFrom: string | null; error: string | null; salvaged: boolean; droppedSegments: number;
  imagesGenerated: number; imagesBilled: number; imagesInherited: number; durationMs: number | null;
  rubric: Record<string, number | string> | null; reviewCycles: number | null; earlyStopped: boolean;
}
const isSlot = (s: unknown): s is Slot => isRecord(s) && isString(s.slotId) && isString(s.state) && (s.failedFrom === null || isString(s.failedFrom))
  && (s.error === null || isString(s.error)) && isNullableNumber(s.durationMs) && (s.rubric === null || isRecord(s.rubric)) && isNullableNumber(s.reviewCycles);
export interface RunDetail { run: RunSummary; slots: Slot[] }
export const isRunDetail = (value: unknown): value is RunDetail => isRecord(value) && isRun(value.run) && arrayOf(value.slots, isSlot);

export interface SlotDetail extends Slot { runId: string; durationHuman: string | null; updatedAt: string; run: { courseSlug: string; register: string; updatedAt: string } | null }
export const isSlotDetail = (value: unknown): value is SlotDetail => isSlot(value) && isString((value as unknown as Record<string, unknown>).runId);

export interface Snapshot { id: number; completedSlots: number; failedSlots: number; skippedSlots: number; stageBreakdown: Record<string, number>; usdUsed: number; createdAt: string }
export const isSnapshots = (value: unknown): value is { runId: string; snapshots: Snapshot[] } => isRecord(value) && arrayOf(value.snapshots,
  (s): s is Snapshot => isRecord(s) && isNumber(s.completedSlots) && isNumber(s.failedSlots) && isNumber(s.skippedSlots) && isCounts(s.stageBreakdown)
    && isNumber(s.usdUsed) && isString(s.createdAt));

export interface CompareRun {
  runId: string; courseSlug: string; published: number; failed: number; slotsEnumerated: number; usdUsed: number; cacheHitPct: number;
  imagesBilled: number; imagesInherited: number; judgeMeans: Record<string, number | null>;
}
export interface Comparison { runs: CompareRun[]; deltas: { published: number; failed: number; usdUsed: number; cacheHitPct: number } | null }
export const isComparison = (value: unknown): value is Comparison => isRecord(value) && arrayOf(value.runs,
  (r): r is CompareRun => isRecord(r) && isString(r.runId) && isNumber(r.published) && isNumber(r.failed) && isNumber(r.usdUsed)
    && isNumber(r.cacheHitPct) && isRecord(r.judgeMeans))
  && (value.deltas === null || (isRecord(value.deltas) && isNumber(value.deltas.published) && isNumber(value.deltas.failed)
    && isNumber(value.deltas.usdUsed) && isNumber(value.deltas.cacheHitPct)));

/* ---- Trends (analytics) and the Coach ----------------------------------- */

export interface Analytics {
  runsAnalyzed: number;
  costTrend: { runId: string; updatedAt: string; usdPerPublished: number | null }[];
  qualityTrend: { runId: string; updatedAt: string; dimMeans: Record<string, number | null> }[];
  cacheEfficiency: { runId: string; updatedAt: string; cacheHitPct: number }[];
  failureByStage: { stage: string; count: number; pct: number }[];
  stageSuccessRate: { passed: number; failed: number; rate: number };
  costForecast: { perLesson: number | null; perCourse: number | null; basedOn: number } | null;
  averages: { costPerPublished: number | null; tokensPerLesson: number | null; cacheHitPct: number | null };
}
export const isAnalytics = (value: unknown): value is Analytics => isRecord(value) && isNumber(value.runsAnalyzed)
  && Array.isArray(value.costTrend) && Array.isArray(value.qualityTrend) && Array.isArray(value.cacheEfficiency) && Array.isArray(value.failureByStage)
  && isRecord(value.stageSuccessRate) && isNumber(value.stageSuccessRate.rate) && isRecord(value.averages)
  && (value.costForecast === null || isRecord(value.costForecast));

export interface CoachReport {
  courseSlug: string | null; runsAnalyzed: number;
  outcomes: { published: number; failed: number; other: number };
  failureHeatmap: Record<string, number>;
  topErrors: { sample: string; count: number }[];
  judge: {
    judged: number; dimensionMeans: Record<string, number | null>; dimensionMins: Record<string, number | null>;
    cyclesHistogram: { cycle1: number; cycle2: number; cycle3: number; earlyStops: number };
    worstLessons: { slotId: string; dims: string[] }[];
  };
  cost: { totalUsd: number; totalTokens: number; cacheHitPct: number };
  images: { generated: number; billed: number; inherited: number };
  /** Structured facts per action (F4-staff-ops); read them through isCoachAction, which drops a tag this console does not know. */
  proposedActions: unknown[];
}

/*
 * Bible 02 section 1.2 and rule 16 (F4-staff-ops): Core sends each proposed
 * action as a tag and numbers only; the console writes the proposal and its
 * evidence in the viewer's locale and formats the numbers with Intl.
 */
export type CoachAction =
  | { tag: 'cost:cache'; params: { cacheHitPct: number; wastedUsd: number } }
  | { tag: `judge:${string}`; params: { dimension: string; mean: number; min: number | null; n: number } }
  | { tag: 'failure:stage'; params: { stage: string; count: number; total: number } }
  | { tag: 'cost:perLesson'; params: { usdPerLesson: number; totalUsd: number; published: number; inherited: number; billed: number } };

export function isCoachAction(value: unknown): value is CoachAction {
  if (!isRecord(value) || !isString(value.tag) || !isRecord(value.params)) return false;
  const p = value.params;
  if (value.tag === 'cost:cache') return isNumber(p.cacheHitPct) && isNumber(p.wastedUsd);
  if (value.tag.startsWith('judge:')) return isString(p.dimension) && isNumber(p.mean) && isNullableNumber(p.min) && isNumber(p.n);
  if (value.tag === 'failure:stage') return isString(p.stage) && isNumber(p.count) && isNumber(p.total);
  if (value.tag === 'cost:perLesson') {
    return isNumber(p.usdPerLesson) && isNumber(p.totalUsd) && isNumber(p.published) && isNumber(p.inherited) && isNumber(p.billed);
  }
  return false;
}
export const isCoach = (value: unknown): value is CoachReport => isRecord(value) && isNumber(value.runsAnalyzed) && isRecord(value.outcomes)
  && isCounts(value.failureHeatmap) && Array.isArray(value.topErrors) && isRecord(value.judge) && isRecord(value.judge.cyclesHistogram)
  && Array.isArray(value.judge.worstLessons) && isRecord(value.cost) && isRecord(value.images) && Array.isArray(value.proposedActions);

/* ---- Alerts ------------------------------------------------------------- */

export type Alert =
  | { id: 'liveCost'; severity: 'warning'; projected: number; spent: number; progress: number }
  | { id: 'lowCache'; severity: 'critical'; share: number }
  | { id: 'highFail'; severity: 'critical'; share: number; failed: number; total: number }
  | { id: 'qualityDrop'; severity: 'warning'; dimension: string; from: number; to: number }
  | { id: 'costSpike'; severity: 'critical'; latest: number; average: number };

/**
 * The legacy monitor's anomaly rules, with the same thresholds: a live run projected past
 * $100, a cache-hit share under 20% after 100k tokens, more than 30% of more
 * than 5 processed lessons failed; across runs, a safety, age-fit or
 * concreteness mean that fell by more than 0.8 between the last two runs, and a
 * latest cost per lesson above twice the average of at least three.
 */
export function alertsFor(run: LiveRun | null, analytics: Analytics | null): Alert[] {
  const alerts: Alert[] = [];
  if (run) {
    const done = processed(run);
    const progress = run.totalSlots > 0 ? done / run.totalSlots : 0;
    if (run.completedSlots > 0 && progress > 0.05) {
      const projected = run.usdUsed / progress;
      if (projected > 100) alerts.push({ id: 'liveCost', severity: 'warning', projected, spent: run.usdUsed, progress });
    }
    const cache = run.tokensUsed > 0 ? run.cachedTokens / run.tokensUsed : 0;
    if (run.tokensUsed > 100_000 && cache < 0.2) alerts.push({ id: 'lowCache', severity: 'critical', share: cache });
    const failRate = done > 0 ? run.failedSlots / done : 0;
    if (failRate > 0.3 && done > 5) alerts.push({ id: 'highFail', severity: 'critical', share: failRate, failed: run.failedSlots, total: done });
  }
  if (analytics && analytics.runsAnalyzed > 1) {
    // Core lists runs newest first (updated_at desc). The legacy banner read the END of these lists as "latest",
    // so it compared the two OLDEST runs; the latest run is the first entry.
    const [latest, previous] = analytics.qualityTrend;
    if (previous && latest) {
      for (const dimension of ['kid_safety', 'age_fit', 'concreteness']) {
        const from = previous.dimMeans[dimension];
        const to = latest.dimMeans[dimension];
        if (typeof from === 'number' && typeof to === 'number' && from - to > 0.8) alerts.push({ id: 'qualityDrop', severity: 'warning', dimension, from, to });
      }
    }
    const costs = analytics.costTrend.map((entry) => entry.usdPerPublished).filter((value): value is number => typeof value === 'number');
    if (costs.length >= 3) {
      const average = costs.reduce((a, b) => a + b, 0) / costs.length;
      const latestCost = costs[0]!;
      if (latestCost > average * 2) alerts.push({ id: 'costSpike', severity: 'critical', latest: latestCost, average });
    }
  }
  return alerts;
}

/** The views of the Generation page, in order. */
export const GENERATION_VIEWS = ['live', 'history', 'trends', 'coach'] as const;
export type GenerationView = (typeof GENERATION_VIEWS)[number];
/** `?view=` on the route opens one view directly. */
export function generationView(value: string | null | undefined): GenerationView {
  return (GENERATION_VIEWS as readonly string[]).includes(value ?? '') ? value as GenerationView : 'live';
}
export const POLL_MS = 4_000;
