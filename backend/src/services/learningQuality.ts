import { z } from 'zod';
import { dPrime } from './v2VisualScorer.js';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';
import { loadLearningQaSignals, type LearningQaSignals } from './learningQaSignals.js';
import { loadEngagementHealth, type EngagementHealthReport } from './engagementHealth.js';

/*
 * S05.3d: the content team's learning-quality reads and decisions.
 *
 *   B.19  practice success band per lesson (70-85% default hypothesis), the
 *         calibration reviews it opens and the Threshold Recalibration Log;
 *   B.12  Judgment-Quality Signal Differentiation (Appendix C);
 *   B.5   Replay Non-Regression Messaging Display Rate (Appendix C).
 *
 * Every call is service-role and reaches Core only behind requireRole(admin)
 * plus requireAdminPermission('manage_content'); the SQL functions re-check
 * the actor for every write. Nothing here reads or returns a learner id.
 * Policy: docs/rebuild/PRACTICE-DIFFICULTY-CALIBRATION.md.
 */

/** Mirrors the seeded default band (practice_difficulty_calibration migration). */
export const DEFAULT_PRACTICE_BAND = { lowerPct: 70, upperPct: 85, minSample: 30 } as const;
/** Database guard rails (CHECK practice_difficulty_bands_guard_rails). */
export const PRACTICE_BAND_GUARD_RAILS = { lowestLower: 50, highestUpper: 95, minimumWidth: 5 } as const;
export const REVIEW_WINDOW_DAYS = 28;
/**
 * Appendix C "Judgment-Quality Signal Differentiation": the judgment must
 * diverge from correctness for a non-trivial share of attempts. Proposed,
 * pending calibration (Threshold Recalibration Log): below 10% divergence over
 * at least 30 judged attempts the lesson's reasoning items need review.
 */
export const JUDGMENT_DIVERGENCE_FLOOR = 0.1;
export const JUDGMENT_MIN_ATTEMPTS = 30;
/** Appendix C "Replay Non-Regression Messaging Display Rate" target. */
export const REPLAY_NOTICE_TARGET = 1;
/** Appendix C Threshold Recalibration Log cadence: quarterly for the first year (proposed). */
export const BAND_REVIEW_CADENCE_DAYS = 90;

export type PracticeBandStatus = 'insufficient_sample' | 'below_band' | 'in_band' | 'above_band';

/** The same classification the SQL metric applies, for tests and the Mentor cross-check. */
export function classifyPracticeBand(input: { firstAttempts: number; successes: number; lowerPct: number; upperPct: number; minSample: number }): PracticeBandStatus {
  if (input.firstAttempts < input.minSample || input.firstAttempts <= 0) return 'insufficient_sample';
  const pct = (100 * input.successes) / input.firstAttempts;
  if (pct < input.lowerPct) return 'below_band';
  if (pct > input.upperPct) return 'above_band';
  return 'in_band';
}

export type JudgmentSignalStatus = 'insufficient_sample' | 'distinct' | 'tracks_correctness';

/** Whether the reasoning signal measures something correctness does not (Appendix C). */
export function classifyJudgmentSignal(input: { attempts: number; divergentShare: number }): JudgmentSignalStatus {
  if (input.attempts < JUDGMENT_MIN_ATTEMPTS) return 'insufficient_sample';
  return input.divergentShare < JUDGMENT_DIVERGENCE_FLOOR ? 'tracks_correctness' : 'distinct';
}

export function bandWithinGuardRails(lowerPct: number, upperPct: number): boolean {
  return Number.isInteger(lowerPct) && Number.isInteger(upperPct)
    && lowerPct >= PRACTICE_BAND_GUARD_RAILS.lowestLower && upperPct <= PRACTICE_BAND_GUARD_RAILS.highestUpper
    && upperPct - lowerPct >= PRACTICE_BAND_GUARD_RAILS.minimumWidth;
}

const count = z.coerce.number().int().nonnegative();
const pct = z.coerce.number().min(0).max(100);

const MetricRow = z.object({
  lesson_id: z.string().uuid(),
  lesson_slug: z.string(),
  lesson_title: z.record(z.string(), z.unknown()).nullable(),
  first_attempts: count, successes: count, assisted: count,
  success_pct: pct,
  lower_pct: z.number().int(), upper_pct: z.number().int(), min_sample: z.number().int(),
  band_scope: z.enum(['default', 'lesson']),
  status: z.enum(['insufficient_sample', 'below_band', 'in_band', 'above_band']),
  families: z.array(z.object({ family: z.string(), first_attempts: count, successes: count })).nullable(),
});
export type PracticeMetricRow = z.infer<typeof MetricRow>;

const ReviewRow = z.object({
  id: z.string().uuid(),
  lesson_id: z.string().uuid(),
  direction: z.enum(['below_band', 'above_band']),
  window_days: z.number().int(),
  evidence: z.record(z.string(), z.unknown()),
  status: z.enum(['open', 'resolved']),
  decision: z.enum(['make_harder', 'make_easier', 'adjust_band', 'no_change']).nullable(),
  decision_note: z.string().nullable(),
  opened_at: z.string(),
  resolved_at: z.string().nullable(),
});
export type PracticeReviewRow = z.infer<typeof ReviewRow>;

const BandRow = z.object({
  lesson_id: z.string().uuid().nullable(),
  lower_pct: z.number().int(), upper_pct: z.number().int(), min_sample: z.number().int(),
  rationale: z.string(), set_at: z.string(),
});

const LogRow = z.object({
  lesson_id: z.string().uuid().nullable(),
  previous: z.record(z.string(), z.unknown()).nullable(),
  next: z.record(z.string(), z.unknown()),
  rationale: z.string(),
  review_id: z.string().uuid().nullable(),
  changed_at: z.string(),
});

const JudgmentRow = z.object({
  lesson_id: z.string().uuid(),
  attempts: count, correct_sound: count, correct_not_sound: count, incorrect_sound: count, incorrect_not_sound: count,
  divergent_share: z.coerce.number().min(0).max(1),
  correlation: z.coerce.number().min(-1).max(1).nullable(),
});
export type JudgmentDifferentiationRow = z.infer<typeof JudgmentRow>;

const DisplayRateRow = z.object({ below_best: count, shown: count, display_rate: z.coerce.number().min(0).max(1).nullable() });

// S05.3e (B.21, B.24): Appendix C's rest-day utilization and autonomy adoption.
const RestDayRow = z.object({
  learners_with_lapse: count, kept_by_rest_days: count, restarted: count,
  utilization_rate: z.coerce.number().min(0).max(1).nullable(), rest_days_used: count,
});
const AutonomyRow = z.object({
  lever: z.enum(['path', 'mentor', 'pace']), offered: count, exercised: count,
  adoption_rate: z.coerce.number().min(0).max(1).nullable(),
});
export type MotivationMetrics = { restDays: z.infer<typeof RestDayRow>; autonomy: z.infer<typeof AutonomyRow>[] };

// GAP-FIX-R1 (Appendix C 1.1, Appendix P Parts 4.5 and 8): the v2 receipt signals (0207).
const TransferRow = z.object({ kc: z.string(), item_role: z.enum(['practice', 'transfer']), first_attempts: count, successes: count,
  success_share: z.coerce.number().min(0).max(1) });
const ErrorSplitRow = z.object({ family: z.enum(['structure', 'answer']), diagnostic: z.string(), errors: count });
const UnaidedRow = z.object({ stage: z.enum(['concrete', 'pictorial', 'abstract']), learners: count });
const DetectionRow = z.object({ lesson_id: z.string().uuid(), responses: count, hits: count, misses: count, false_alarms: count, correct_rejections: count });
export interface V2LearningSignals {
  transfer: z.infer<typeof TransferRow>[];
  errorSplit: { structure: number; answer: number; byDiagnostic: z.infer<typeof ErrorSplitRow>[] };
  firstUnaided: z.infer<typeof UnaidedRow>[];
  detection: (z.infer<typeof DetectionRow> & { dPrime: number })[];
}

/** Null until 0207 is applied: the rest of the report does not depend on it. */
export async function loadV2LearningSignals(window: { p_since: string; p_until: string }): Promise<V2LearningSignals | null> {
  const [transfer, split, unaided, detection] = await Promise.all([
    rpc('learning_transfer_success', window, z.array(TransferRow)),
    rpc('learning_error_family_split', window, z.array(ErrorSplitRow)),
    rpc('learning_first_unaided_stage_distribution', window, z.array(UnaidedRow)),
    rpc('learning_detection_cells', window, z.array(DetectionRow)),
  ]);
  if (!transfer || !split || !unaided || !detection) return null;
  const total = (family: 'structure' | 'answer') => split.filter((row) => row.family === family).reduce((sum, row) => sum + row.errors, 0);
  return {
    transfer,
    errorSplit: { structure: total('structure'), answer: total('answer'), byDiagnostic: split },
    firstUnaided: unaided,
    detection: detection.map((row) => ({ ...row, dPrime: dPrime({ hits: row.hits, misses: row.misses, false_alarms: row.false_alarms, correct_rejections: row.correct_rejections }) })),
  };
}

async function rpc<T>(name: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T | null> {
  const result = await serviceRest<unknown>(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  const parsed = schema.safeParse(result);
  return parsed.success ? parsed.data : null;
}

export interface LearningQualityReport {
  window: { since: string; until: string; days: number };
  /** reviewDue: the default band was last set longer ago than the recalibration cadence. */
  defaultBand: (z.infer<typeof BandRow> & { reviewDue: boolean }) | null;
  lessons: PracticeMetricRow[];
  reviews: PracticeReviewRow[];
  bandLog: z.infer<typeof LogRow>[];
  judgment: (JudgmentDifferentiationRow & { status: JudgmentSignalStatus })[];
  replayNotice: z.infer<typeof DisplayRateRow> & { target: number; belowTarget: boolean };
  /**
   * Null when the motivation functions are not reachable yet (the
   * *_motivation_events.sql contract migration needs an operator dispatch);
   * the rest of the report does not depend on them.
   */
  motivation: MotivationMetrics | null;
  /**
   * B.28 (S05.3f): session efficiency and Mentor resolution efficiency, with
   * their trend. Null until the *_engagement_health.sql migration is applied.
   */
  engagementHealth: EngagementHealthReport | null;
  /** GAP-FIX-R1: transfer vs practice, structure vs answer errors, first unaided stage and d′; null until 0207 is applied. */
  v2Signals: V2LearningSignals | null;
  /** GAP-FIX-R2: Appendix P Part 8 parity, d′ pre/post, A/B and coverage; Appendix C 1.3 B.1/B.2/B.4 and defect escapes. Null until 0215 and 0217. */
  qaSignals: LearningQaSignals | null;
  thresholds: {
    judgmentDivergenceFloor: number; judgmentMinAttempts: number; replayNoticeTarget: number; bandReviewCadenceDays: number;
  };
}

/** One read for the staff panel. Any unavailable part fails the whole read (no partial numbers). */
export async function loadLearningQualityReport(days: number, now = new Date()): Promise<LearningQualityReport | null> {
  const until = now.toISOString();
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const window = { p_since: since, p_until: until };
  const [lessons, reviews, bands, log, judgment, replay, restDays, autonomy, engagementHealth, v2Signals, qaSignals] = await Promise.all([
    rpc('practice_success_band_metrics', window, z.array(MetricRow)),
    serviceRest<unknown>('/practice_difficulty_reviews?select=id,lesson_id,direction,window_days,evidence,status,decision,decision_note,opened_at,resolved_at&order=opened_at.desc&limit=100')
      .then((rows) => { const parsed = z.array(ReviewRow).safeParse(rows); return parsed.success ? parsed.data : null; }),
    serviceRest<unknown>('/practice_difficulty_bands?lesson_id=is.null&select=lesson_id,lower_pct,upper_pct,min_sample,rationale,set_at&limit=1')
      .then((rows) => { const parsed = z.array(BandRow).safeParse(rows); return parsed.success ? parsed.data : null; }),
    serviceRest<unknown>('/practice_difficulty_band_log?select=lesson_id,previous,next,rationale,review_id,changed_at&order=changed_at.desc&limit=50')
      .then((rows) => { const parsed = z.array(LogRow).safeParse(rows); return parsed.success ? parsed.data : null; }),
    rpc('learning_judgment_differentiation', window, z.array(JudgmentRow)),
    rpc('learning_replay_notice_display_rate', window, z.array(DisplayRateRow)),
    rpc('learning_rest_day_utilization', window, z.array(RestDayRow)),
    rpc('learning_autonomy_adoption', window, z.array(AutonomyRow)),
    loadEngagementHealth(now),
    loadV2LearningSignals(window),
    loadLearningQaSignals(window),
  ]);
  if (!lessons || !reviews || !bands || !log || !judgment || !replay) return null;
  const band = bands[0];
  const rate = replay[0] ?? { below_best: 0, shown: 0, display_rate: null };
  return {
    window: { since, until, days },
    defaultBand: band ? { ...band, reviewDue: now.getTime() - Date.parse(band.set_at) > BAND_REVIEW_CADENCE_DAYS * 86_400_000 } : null,
    lessons: [...lessons].sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.first_attempts - a.first_attempts),
    reviews,
    bandLog: log,
    judgment: judgment.map((row) => ({ ...row, status: classifyJudgmentSignal({ attempts: row.attempts, divergentShare: row.divergent_share }) }))
      .sort((a, b) => Number(b.status === 'tracks_correctness') - Number(a.status === 'tracks_correctness') || b.attempts - a.attempts),
    replayNotice: { ...rate, target: REPLAY_NOTICE_TARGET, belowTarget: rate.display_rate !== null && rate.display_rate < REPLAY_NOTICE_TARGET },
    motivation: restDays && autonomy ? {
      restDays: restDays[0] ?? { learners_with_lapse: 0, kept_by_rest_days: 0, restarted: 0, utilization_rate: null, rest_days_used: 0 },
      autonomy,
    } : null,
    engagementHealth,
    v2Signals,
    qaSignals,
    thresholds: {
      judgmentDivergenceFloor: JUDGMENT_DIVERGENCE_FLOOR, judgmentMinAttempts: JUDGMENT_MIN_ATTEMPTS,
      replayNoticeTarget: REPLAY_NOTICE_TARGET, bandReviewCadenceDays: BAND_REVIEW_CADENCE_DAYS,
    },
  };
}

function statusRank(status: PracticeBandStatus): number {
  return status === 'above_band' ? 0 : status === 'below_band' ? 1 : status === 'in_band' ? 2 : 3;
}

/** "Catch up on access" (no scheduler exists in this stack): open reviews the evidence now calls for. */
export async function syncPracticeReviews(windowDays = REVIEW_WINDOW_DAYS, now = new Date()): Promise<number | null> {
  return rpc('sync_practice_difficulty_reviews', { p_window_days: windowDays, p_now: now.toISOString() }, count);
}

export type ReviewDecision = 'make_harder' | 'make_easier' | 'adjust_band' | 'no_change';
export type ResolveOutcome = 'resolved' | 'not_found' | 'already_resolved' | 'wrong_direction' | 'rejected' | 'unavailable';

export async function resolvePracticeReview(input: {
  reviewId: string; actorId: string; decision: ReviewDecision; note: string;
  lowerPct?: number; upperPct?: number; minSample?: number;
}): Promise<ResolveOutcome> {
  const { ok, body } = await serviceRestRaw('/rpc/resolve_practice_difficulty_review', {
    method: 'POST',
    body: JSON.stringify({
      p_review_id: input.reviewId, p_actor: input.actorId, p_decision: input.decision, p_note: input.note,
      p_lower: input.lowerPct ?? null, p_upper: input.upperPct ?? null, p_min_sample: input.minSample ?? null,
    }),
  });
  if (!ok) return body === null ? 'unavailable' : 'rejected';
  const parsed = z.object({ status: z.enum(['resolved', 'not_found', 'already_resolved', 'wrong_direction']) }).safeParse(body);
  return parsed.success ? parsed.data.status : 'unavailable';
}

export async function setPracticeBand(input: {
  lessonId: string | null; actorId: string; lowerPct: number; upperPct: number; minSample?: number; rationale: string;
}): Promise<'set' | 'rejected' | 'unavailable'> {
  const { ok, body } = await serviceRestRaw('/rpc/set_practice_difficulty_band', {
    method: 'POST',
    body: JSON.stringify({
      p_lesson_id: input.lessonId, p_lower: input.lowerPct, p_upper: input.upperPct,
      p_min_sample: input.minSample ?? null, p_rationale: input.rationale, p_actor: input.actorId, p_review_id: null,
    }),
  });
  if (!ok) return body === null ? 'unavailable' : 'rejected';
  return z.object({ status: z.literal('set') }).safeParse(body).success ? 'set' : 'unavailable';
}
