/*
 * Product C.5 — the judge-approved live-generation tier, governed by
 * Appendix E §3.1.1 ("live per-item content judging is its own tier") and
 * instrumented for Appendix F §1.3 and Part 3 Stage 7.
 *
 * Before this, every live-generated activity a model judge approved was
 * served, and a fixed 15% die roll queued it for a staff review nothing
 * acted on. Now, in Core (the service that certifies what a learner sees):
 *
 *   1. RISK-SCALED SAMPLING. Each served item has a content-risk category
 *      (`contentRisk.ts`: standard, or sensitive when it touches a sensitive
 *      topic). The baseline staff-review rate is at least 15% for standard
 *      and at least 50% for sensitive items. The floors are Tier-1-adjacent:
 *      configuration may raise them, never lower them, and the database
 *      refuses a lower rate as well.
 *   2. DYNAMIC SAMPLING. The first staff rejection (a real quality or safety
 *      issue) in a category raises that category's rate to its ELEVATED rate
 *      at once. The rate returns to baseline only after a run of consecutive
 *      clean review batches (5 batches of 20 decisions, proposed): any
 *      rejection restarts the count.
 *   3. A CALIBRATED JUDGE. No approval is trusted at any rate until the judge
 *      (model + prompt hash) has a passed calibration against a human-rated
 *      seed set (Appendix E §2.1/§3.2), no older than the re-check cadence.
 *      An item approved by a different judge than the calibrated one is
 *      refused. Since C.23 (S06.14) the calibration standard, its records
 *      and the trust rule are the shared ones in `judgeCalibration.ts`
 *      (`mentor_judge_calibration`), the same for every evaluation judge.
 *   4. STAGE 7. If staff disagree with the judge too often (the Judge
 *      Approval-Quality Concordance Rate below 90%) or staff review falls
 *      below the floor, live generation for that category is SUSPENDED: the
 *      ladder serves the human-approved tiers (published lessons and curated
 *      packs, C.6) or nothing, and Oracle is told not to author. The trip is
 *      logged in `audit_logs` and holds until an operator resolves it — and a
 *      concordance trip only after the judge was recalibrated.
 *
 * Every threshold is PROPOSED, pending calibration:
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md (C.5 rows). The written
 * policy is docs/rebuild/mentor/LIVE-CONTENT-GOVERNANCE-POLICY.md.
 */

import { getConfig } from '../../config.js';
import { insertAuditLog, serviceRest } from '../supabaseRest.js';
import type { ContentRiskCategory } from './contentRisk.js';
import {
  computeJudgeCalibration,
  judgeTrust,
  readCalibrationRows,
  recordCalibration,
  type CalibrationComputation,
  type CalibrationRecordRow,
  type JudgeLabel,
} from './judgeCalibration.js';

// ── vocabularies and thresholds ──────────────────────────────────────────────

export const RISK_CATEGORIES = ['standard', 'sensitive'] as const;

/** Appendix E §3.1.1 floors. Tier-1-adjacent: never lowered without full human review. */
export const LIVE_CONTENT_FLOORS: Record<ContentRiskCategory, number> = { standard: 0.15, sensitive: 0.5 };

export const LIVE_CONTENT_THRESHOLDS = {
  /** The rate a category runs at after a staff-found issue, until restored. */
  elevatedRate: { standard: 0.5, sensitive: 1 } as Record<ContentRiskCategory, number>,
  /** One review batch = this many consecutive staff decisions in a category. */
  batchSize: 20,
  /** Consecutive clean batches that restore the baseline rate (the SPEC's proposed 5). */
  cleanBatchesToRestore: 5,
  /** Appendix F Stage 7: the Judge Approval-Quality Concordance floor. */
  concordanceFloor: 0.9,
  /** The concordance is read over the latest N decisions under the current calibration. */
  concordanceWindow: 100,
  /** Below this many decisions the concordance is "insufficient data", not a trip. */
  concordanceMinDecisions: 20,
  /** A sampled item still undecided after this many days counts as not reviewed. */
  reviewSlaDays: 7,
  /** The review-coverage window: items served between reviewWindowDays and reviewSlaDays ago. */
  reviewWindowDays: 30,
  /** Below this many served items in the window, coverage is not judged. */
  reviewMinServed: 20,
  // The calibration bar and cadence live in `judgeCalibration.ts`
  // (JUDGE_REGISTRY.live_content_judge.standard), shared by every judge (C.23).
  gateCacheMs: 60_000,
} as const;

export const SUSPENSION_REASONS = [
  'uncalibrated',
  'calibration_stale',
  'concordance_below_floor',
  'review_rate_below_floor',
] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

/** Why one candidate was refused at verification (a superset of the category reasons). */
export const REFUSAL_REASONS = [...SUSPENSION_REASONS, 'judge_not_calibrated', 'gate_unavailable'] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export const LADDER_OUTCOMES = ['catalog', 'bank', 'needs_generation', 'live_suspended', 'live_served', 'live_refused'] as const;
export const LADDER_ROUTES = ['named_skill', 'kc_pack', 'prerequisite', 'frontier', 'none', 'verify'] as const;
export const LADDER_EVENT_REASONS = [...REFUSAL_REASONS, 'verification_failed'] as const;
export type LadderOutcome = (typeof LADDER_OUTCOMES)[number];
export type LadderRoute = (typeof LADDER_ROUTES)[number];
export type LadderEventReason = (typeof LADDER_EVENT_REASONS)[number];

export const REVIEW_ISSUES = ['quality', 'safety'] as const;
export type ReviewIssue = (typeof REVIEW_ISSUES)[number];

// ── 1. baseline rates (floored) ──────────────────────────────────────────────

/**
 * The configured baselines, each floored. A configured value below its floor
 * is IGNORED (reported in `ignored`), never obeyed: Appendix E §3.1.1 lets a
 * human decision tighten the floor at any time and never loosen it.
 */
export function baselineRates(configured: { standard: number; sensitive: number }): {
  rates: Record<ContentRiskCategory, number>;
  ignored: ContentRiskCategory[];
} {
  const ignored: ContentRiskCategory[] = [];
  const rates = {} as Record<ContentRiskCategory, number>;
  for (const category of RISK_CATEGORIES) {
    const value = configured[category];
    const floor = LIVE_CONTENT_FLOORS[category];
    if (!Number.isFinite(value) || value < floor) {
      ignored.push(category);
      rates[category] = floor;
    } else {
      rates[category] = Math.min(1, value);
    }
  }
  return { rates, ignored };
}

export function configuredBaselines(): { rates: Record<ContentRiskCategory, number>; ignored: ContentRiskCategory[] } {
  const config = getConfig();
  return baselineRates({
    standard: config.TUTOR_LIVE_REVIEW_SAMPLE_RATE,
    sensitive: config.TUTOR_LIVE_REVIEW_SENSITIVE_SAMPLE_RATE,
  });
}

// ── 2. the dynamic rate (pure) ───────────────────────────────────────────────

export interface SamplingState {
  elevated: boolean;
  rate: number;
  baseline: number;
  /** Complete clean batches since the latest issue (0 when never elevated). */
  cleanBatches: number;
  /** Clean decisions still needed before the baseline returns (0 when not elevated). */
  decisionsToRestore: number;
  latestIssueAt: string | null;
}

/**
 * The category's current rate. `cleanDecisionsSinceIssue` counts the
 * APPROVALS decided after the latest rejection (any later rejection would
 * itself be the latest). Elevated until the approvals fill
 * `cleanBatchesToRestore` complete batches; never below the baseline, and
 * the elevated rate is never below the baseline either (a baseline raised by
 * configuration above the default elevated rate stays in force).
 */
export function samplingState(
  category: ContentRiskCategory,
  baseline: number,
  latestIssueAt: string | null,
  cleanDecisionsSinceIssue: number,
  t = LIVE_CONTENT_THRESHOLDS,
): SamplingState {
  const needed = t.batchSize * t.cleanBatchesToRestore;
  if (latestIssueAt === null) {
    return { elevated: false, rate: baseline, baseline, cleanBatches: 0, decisionsToRestore: 0, latestIssueAt: null };
  }
  const clean = Math.max(0, Math.floor(cleanDecisionsSinceIssue));
  const cleanBatches = Math.floor(clean / t.batchSize);
  if (cleanBatches >= t.cleanBatchesToRestore) {
    return { elevated: false, rate: baseline, baseline, cleanBatches, decisionsToRestore: 0, latestIssueAt };
  }
  return {
    elevated: true,
    rate: Math.max(baseline, t.elevatedRate[category]),
    baseline,
    cleanBatches,
    decisionsToRestore: needed - clean,
    latestIssueAt,
  };
}

// ── 3. the calibrated judge (pure) ───────────────────────────────────────────

/** A recorded calibration run of the live-content judge (`mentor_judge_calibration`, C.23). */
export type CalibrationRow = CalibrationRecordRow;

export type CalibrationState = 'passed' | 'uncalibrated' | 'stale';

/**
 * The live-content judge's trust, from its recorded runs (C.23's shared
 * rule): the latest full calibration decides, so a failed recalibration
 * un-trusts a judge that passed before; a failed spot check requires a new
 * calibration; a pass not re-verified within the cadence is stale. For this
 * gate every other untrusted state suspends as `uncalibrated`.
 */
export function calibrationStatus(
  rows: readonly CalibrationRecordRow[],
  now: Date,
): { state: CalibrationState; ageDays: number | null; row: CalibrationRecordRow | null } {
  const trust = judgeTrust('live_content_judge', rows, now);
  const state: CalibrationState = trust.state === 'passed' ? 'passed' : trust.state === 'stale' ? 'stale' : 'uncalibrated';
  return { state, ageDays: trust.ageDays, row: state === 'passed' ? trust.calibration : null };
}

/** Whether the judge that approved an item is the calibrated one. */
export function judgeMatches(
  calibration: Pick<CalibrationRow, 'judge_model' | 'judge_prompt_hash'> | null,
  judgeModel: unknown,
  judgePromptHash: unknown,
): boolean {
  return (
    calibration !== null &&
    typeof judgeModel === 'string' &&
    typeof judgePromptHash === 'string' &&
    judgeModel === calibration.judge_model &&
    judgePromptHash === calibration.judge_prompt_hash
  );
}

// ── 4. Stage 7 conditions (pure) ─────────────────────────────────────────────

/** Judge Approval-Quality Concordance: staff approvals over staff decisions. */
export function concordance(
  decisions: readonly { review_verdict: string | null }[],
  t = LIVE_CONTENT_THRESHOLDS,
): { rate: number | null; decided: number; approved: number; belowFloor: boolean } {
  const decided = decisions.filter((d) => d.review_verdict === 'approved' || d.review_verdict === 'rejected');
  const approved = decided.filter((d) => d.review_verdict === 'approved').length;
  if (decided.length < t.concordanceMinDecisions) {
    return { rate: null, decided: decided.length, approved, belowFloor: false };
  }
  const rate = approved / decided.length;
  return { rate, decided: decided.length, approved, belowFloor: rate < t.concordanceFloor };
}

/**
 * Staff review coverage over items old enough to have been reviewed (served
 * between `reviewWindowDays` and `reviewSlaDays` ago). Sampling is
 * systematic (the credit accumulator in the claim function), so at least
 * floor(served × floor) of them were sampled; fewer REVIEWED than that means
 * the human-reviewed rate is below the floor — exactly, not statistically.
 */
export function reviewCoverage(
  category: ContentRiskCategory,
  rows: readonly { sampled: boolean; reviewed_at: string | null; sample_rate: number | string }[],
  t = LIVE_CONTENT_THRESHOLDS,
): { served: number; sampled: number; reviewed: number; required: number; share: number | null; belowFloor: boolean; underSampled: number } {
  const served = rows.length;
  const sampled = rows.filter((r) => r.sampled).length;
  const reviewed = rows.filter((r) => r.sampled && r.reviewed_at !== null).length;
  const floor = LIVE_CONTENT_FLOORS[category];
  // A row recorded below the floor is a defect the database should have refused.
  const underSampled = rows.filter((r) => Number(r.sample_rate) < floor).length;
  const required = Math.floor(served * floor);
  if (served < t.reviewMinServed) {
    return { served, sampled, reviewed, required, share: null, belowFloor: underSampled > 0, underSampled };
  }
  return { served, sampled, reviewed, required, share: reviewed / served, belowFloor: reviewed < required || underSampled > 0, underSampled };
}

// ── 5. the gate (pure composition) ───────────────────────────────────────────

export interface CategoryGate {
  category: ContentRiskCategory;
  suspended: boolean;
  reasons: SuspensionReason[];
  sampling: SamplingState;
}

export interface OpenTrip {
  category: ContentRiskCategory;
  cause: 'concordance_below_floor' | 'review_rate_below_floor';
  trippedAt: string;
}

export function composeCategoryGate(input: {
  category: ContentRiskCategory;
  calibration: CalibrationState;
  openTrips: readonly OpenTrip[];
  sampling: SamplingState;
}): CategoryGate {
  const reasons: SuspensionReason[] = [];
  if (input.calibration === 'uncalibrated') reasons.push('uncalibrated');
  if (input.calibration === 'stale') reasons.push('calibration_stale');
  for (const trip of input.openTrips) {
    if (trip.category === input.category && !reasons.includes(trip.cause)) reasons.push(trip.cause);
  }
  return { category: input.category, suspended: reasons.length > 0, reasons, sampling: input.sampling };
}

// ── 6. the kill-switch log in audit_logs ─────────────────────────────────────

export const LIVE_CONTENT_KILL_SWITCH_TRIGGERED = 'mentor.kill_switch.live_content.triggered';
export const LIVE_CONTENT_KILL_SWITCH_RESOLVED = 'mentor.kill_switch.live_content.resolved';
export const LIVE_CONTENT_CALIBRATION_RECORDED = 'mentor.live_content.judge_calibration_recorded';

interface AuditRow {
  action: string;
  created_at: string;
  detail: Record<string, unknown> | null;
}

/** Folds the trip/resolve log (any order) into the trips still open. */
export function openTrips(rows: readonly AuditRow[]): OpenTrip[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const open = new Map<string, OpenTrip>();
  for (const row of ordered) {
    const category = row.detail?.category;
    const cause = row.detail?.cause;
    if ((category !== 'standard' && category !== 'sensitive') ||
      (cause !== 'concordance_below_floor' && cause !== 'review_rate_below_floor')) continue;
    const key = `${category}:${cause}`;
    if (row.action === LIVE_CONTENT_KILL_SWITCH_TRIGGERED && !open.has(key)) {
      open.set(key, { category, cause, trippedAt: row.created_at });
    } else if (row.action === LIVE_CONTENT_KILL_SWITCH_RESOLVED) {
      open.delete(key);
    }
  }
  return [...open.values()];
}

/** The Kill-Switch Trigger Log (Appendix F §1.3) for the live-content judge. */
export function liveContentKillSwitchLog(rows: readonly AuditRow[]): {
  category: string;
  cause: string;
  triggeredAt: string;
  resolvedAt: string | null;
  resolutionHours: number | null;
}[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out: ReturnType<typeof liveContentKillSwitchLog> = [];
  const open = new Map<string, (typeof out)[number]>();
  for (const row of ordered) {
    const key = `${String(row.detail?.category)}:${String(row.detail?.cause)}`;
    if (row.action === LIVE_CONTENT_KILL_SWITCH_TRIGGERED && !open.has(key)) {
      const entry = {
        category: String(row.detail?.category),
        cause: String(row.detail?.cause),
        triggeredAt: row.created_at,
        resolvedAt: null as string | null,
        resolutionHours: null as number | null,
      };
      out.push(entry);
      open.set(key, entry);
    } else if (row.action === LIVE_CONTENT_KILL_SWITCH_RESOLVED && open.has(key)) {
      const entry = open.get(key)!;
      entry.resolvedAt = row.created_at;
      entry.resolutionHours = (Date.parse(row.created_at) - Date.parse(entry.triggeredAt)) / 3_600_000;
      open.delete(key);
    }
  }
  return out;
}

// ── 7. the gate, from the database (cached) ──────────────────────────────────

export interface LiveContentGate {
  degraded: boolean;
  calibration: { state: CalibrationState; row: CalibrationRow | null; ageDays: number | null };
  categories: Record<ContentRiskCategory, CategoryGate>;
  ignoredBaselines: ContentRiskCategory[];
}

let gateCache: { at: number; gate: LiveContentGate } | null = null;

/** Test hook: forget the cached gate. */
export function resetLiveContentGateCache(): void {
  gateCache = null;
}

/** A gate that suspends everything: what a failed read means (fail closed). */
function unavailableGate(): LiveContentGate {
  const { rates, ignored } = configuredBaselines();
  const categories = {} as Record<ContentRiskCategory, CategoryGate>;
  for (const category of RISK_CATEGORIES) {
    categories[category] = {
      category,
      suspended: true,
      reasons: [],
      sampling: samplingState(category, rates[category], null, 0),
    };
  }
  return { degraded: true, calibration: { state: 'uncalibrated', row: null, ageDays: null }, categories, ignoredBaselines: ignored };
}

/** The live-content judge's recorded runs (newest first), or undefined when the read failed. */
export async function calibrationRows(): Promise<CalibrationRecordRow[] | undefined> {
  const rows = await readCalibrationRows('live_content_judge', 50);
  return rows === null ? undefined : rows;
}

async function killSwitchRows(): Promise<AuditRow[] | null> {
  return serviceRest<AuditRow[]>(
    `/audit_logs?action=in.(${LIVE_CONTENT_KILL_SWITCH_TRIGGERED},${LIVE_CONTENT_KILL_SWITCH_RESOLVED})&select=action,created_at,detail&order=created_at.desc&limit=200`,
  );
}

async function categorySampling(
  category: ContentRiskCategory,
  baseline: number,
): Promise<SamplingState | null> {
  const latestIssue = await serviceRest<{ reviewed_at: string }[]>(
    `/tutor_live_content_log?risk_category=eq.${category}&review_verdict=eq.rejected&select=reviewed_at&order=reviewed_at.desc&limit=1`,
  );
  if (latestIssue === null) return null;
  const issueAt = latestIssue[0]?.reviewed_at ?? null;
  if (issueAt === null) return samplingState(category, baseline, null, 0);
  const needed = LIVE_CONTENT_THRESHOLDS.batchSize * LIVE_CONTENT_THRESHOLDS.cleanBatchesToRestore;
  const clean = await serviceRest<{ id: string }[]>(
    `/tutor_live_content_log?risk_category=eq.${category}&review_verdict=eq.approved&reviewed_at=gt.${encodeURIComponent(issueAt)}&select=id&limit=${needed}`,
  );
  if (clean === null) return null;
  return samplingState(category, baseline, issueAt, clean.length);
}

/**
 * Evaluates the Stage 7 conditions for one category and writes a trip when
 * one newly holds. Returns false when a read failed (not evidence either way).
 */
async function evaluateTrips(
  category: ContentRiskCategory,
  calibration: CalibrationRow | null,
  open: readonly OpenTrip[],
  now: Date,
): Promise<OpenTrip[] | null> {
  const t = LIVE_CONTENT_THRESHOLDS;
  const tripped: OpenTrip[] = [];
  const has = (cause: OpenTrip['cause']) => open.some((o) => o.category === category && o.cause === cause);

  if (calibration !== null && !has('concordance_below_floor')) {
    const decisions = await serviceRest<{ review_verdict: string | null }[]>(
      `/tutor_live_content_log?risk_category=eq.${category}&calibration_id=eq.${encodeURIComponent(calibration.id)}&reviewed_at=not.is.null&select=review_verdict&order=reviewed_at.desc&limit=${t.concordanceWindow}`,
    );
    if (decisions === null) return null;
    const verdict = concordance(decisions, t);
    if (verdict.belowFloor) {
      const written = await insertAuditLog(null, LIVE_CONTENT_KILL_SWITCH_TRIGGERED, 'tutor', {
        component: 'live_content_judge',
        category,
        cause: 'concordance_below_floor',
        concordance: verdict.rate,
        decided: verdict.decided,
        calibrationId: calibration.id,
      });
      if (!written) console.warn('[tutor] live-content kill switch tripped but its audit row did NOT land');
      console.warn(`[tutor] live-content judge SUSPENDED for ${category}: concordance ${verdict.rate?.toFixed(3)} < ${t.concordanceFloor}`);
      tripped.push({ category, cause: 'concordance_below_floor', trippedAt: now.toISOString() });
    }
  }

  if (!has('review_rate_below_floor')) {
    const from = new Date(now.getTime() - t.reviewWindowDays * 86_400_000).toISOString();
    const to = new Date(now.getTime() - t.reviewSlaDays * 86_400_000).toISOString();
    const rows = await serviceRest<{ sampled: boolean; reviewed_at: string | null; sample_rate: number | string }[]>(
      `/tutor_live_content_log?risk_category=eq.${category}&created_at=gte.${encodeURIComponent(from)}&created_at=lt.${encodeURIComponent(to)}&select=sampled,reviewed_at,sample_rate&limit=20000`,
    );
    if (rows === null) return null;
    const coverage = reviewCoverage(category, rows, t);
    if (coverage.belowFloor) {
      const written = await insertAuditLog(null, LIVE_CONTENT_KILL_SWITCH_TRIGGERED, 'tutor', {
        component: 'live_content_judge',
        category,
        cause: 'review_rate_below_floor',
        served: coverage.served,
        reviewed: coverage.reviewed,
        required: coverage.required,
        underSampled: coverage.underSampled,
      });
      if (!written) console.warn('[tutor] live-content kill switch tripped but its audit row did NOT land');
      console.warn(`[tutor] live-content judge SUSPENDED for ${category}: ${coverage.reviewed} reviewed < ${coverage.required} required`);
      tripped.push({ category, cause: 'review_rate_below_floor', trippedAt: now.toISOString() });
    }
  }
  return tripped;
}

/**
 * The live-content gate for a new request (cached per process). A FAILED
 * read suspends live generation (fail closed, `degraded`, not cached): for a
 * control whose purpose is "no unmonitored live content reaches a child", not
 * knowing is a reason to serve only the human-approved tiers.
 */
export async function getLiveContentGate(now: Date = new Date()): Promise<LiveContentGate> {
  const t = LIVE_CONTENT_THRESHOLDS;
  if (gateCache !== null && now.getTime() - gateCache.at < t.gateCacheMs) return gateCache.gate;

  const { rates, ignored } = configuredBaselines();
  if (ignored.length > 0) {
    console.warn(`[tutor] live-content sampling baseline below the Appendix E floor ignored for: ${ignored.join(', ')}`);
  }
  const [rows, audit] = await Promise.all([calibrationRows(), killSwitchRows()]);
  if (rows === undefined || audit === null) return unavailableGate();

  const status = calibrationStatus(rows, now);
  let open = openTrips(audit);
  // Trips are only evaluated against a judge that is trusted at all; an
  // uncalibrated judge is already suspended everywhere.
  const trusted = status.row;

  const categories = {} as Record<ContentRiskCategory, CategoryGate>;
  for (const category of RISK_CATEGORIES) {
    const sampling = await categorySampling(category, rates[category]);
    if (sampling === null) return unavailableGate();
    if (trusted !== null) {
      const tripped = await evaluateTrips(category, trusted, open, now);
      if (tripped === null) return unavailableGate();
      open = [...open, ...tripped];
    }
    categories[category] = composeCategoryGate({ category, calibration: status.state, openTrips: open, sampling });
  }

  const gate: LiveContentGate = {
    degraded: false,
    calibration: { state: status.state, row: status.row, ageDays: status.ageDays },
    categories,
    ignoredBaselines: ignored,
  };
  gateCache = { at: now.getTime(), gate };
  return gate;
}

/**
 * The verdict for one candidate at verification: may it be served, under
 * which rate, and against which calibration. The category must not be
 * suspended, and the judge that approved it must be the calibrated one.
 */
export function admitLiveCandidate(
  gate: LiveContentGate,
  category: ContentRiskCategory,
  judgeModel: unknown,
  judgePromptHash: unknown,
): { admitted: true; rate: number; elevated: boolean; calibrationId: string } | { admitted: false; reason: RefusalReason } {
  if (gate.degraded) return { admitted: false, reason: 'gate_unavailable' };
  const entry = gate.categories[category];
  if (entry.suspended) return { admitted: false, reason: entry.reasons[0] ?? 'gate_unavailable' };
  const row = gate.calibration.row;
  if (row === null || !judgeMatches(row, judgeModel, judgePromptHash)) {
    return { admitted: false, reason: 'judge_not_calibrated' };
  }
  return { admitted: true, rate: entry.sampling.rate, elevated: entry.sampling.elevated, calibrationId: row.id };
}

/** Whether Oracle may even try to author for a request of this category. */
export function liveGenerationOpen(
  gate: LiveContentGate,
  category: ContentRiskCategory,
): { open: true } | { open: false; reason: RefusalReason } {
  if (gate.degraded) return { open: false, reason: 'gate_unavailable' };
  const entry = gate.categories[category];
  if (entry.suspended) return { open: false, reason: entry.reasons[0] ?? 'gate_unavailable' };
  return { open: true };
}

// ── 8. writes ────────────────────────────────────────────────────────────────

/** Whether the session has any recorded safety flag (a sensitive-context signal). */
export async function sessionSafetyFlagCount(sessionId: string): Promise<number | null> {
  const rows = await serviceRest<{ id: string }[]>(
    `/tutor_safety_flags?session_id=eq.${encodeURIComponent(sessionId)}&select=id&limit=1`,
  );
  return rows === null ? null : rows.length;
}

const CATALOG_KEY = /^(kc:)?[a-z0-9][a-z0-9._/-]{0,127}$/;

/** One content-ladder decision (C.6 demand signal). Best-effort: never fails the request. */
export async function recordLadderEvent(input: {
  outcome: LadderOutcome;
  route: LadderRoute;
  kcId: string | null;
  skillKey: string | null;
  tier: number;
  locale: string;
  riskCategory?: ContentRiskCategory | null;
  reason?: LadderEventReason | null;
}): Promise<void> {
  const skillKey = input.skillKey !== null && CATALOG_KEY.test(input.skillKey) ? input.skillKey : null;
  const res = await serviceRest<unknown>('/tutor_content_ladder_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      outcome: input.outcome,
      route: input.route,
      kc_id: input.kcId,
      skill_key: skillKey,
      tier: input.tier,
      locale: input.locale,
      risk_category: input.riskCategory ?? null,
      reason: input.reason ?? null,
    }),
  });
  if (res === null) console.warn('[tutor] content-ladder event not recorded');
}

/** The staff decision on a sampled live item, in one transaction (migration function). */
export async function recordLiveReview(input: {
  segmentId: string;
  verdict: 'approved' | 'rejected';
  issue: ReviewIssue | null;
  reviewerId: string;
}): Promise<'recorded' | 'recorded_legacy' | 'not_pending' | null> {
  const res = await serviceRest<string>('/rpc/record_tutor_live_review', {
    method: 'POST',
    body: JSON.stringify({
      p_segment_id: input.segmentId,
      p_verdict: input.verdict,
      p_issue: input.issue,
      p_reviewer: input.reviewerId,
    }),
  });
  if (res === 'recorded' || res === 'recorded_legacy' || res === 'not_pending') {
    // A decision can change a category's rate or open a trip; the next
    // request must see it rather than a minute-old gate.
    resetLiveContentGateCache();
    return res;
  }
  return null;
}

/** Sampled items still undecided, per category, and how many are past the review SLA. */
export async function liveReviewBacklog(
  now: Date = new Date(),
): Promise<Record<ContentRiskCategory, { pending: number; overdue: number }> | null> {
  const rows = await serviceRest<{ risk_category: ContentRiskCategory; created_at: string }[]>(
    '/tutor_live_content_log?sampled=eq.true&reviewed_at=is.null&select=risk_category,created_at&limit=20000',
  );
  if (rows === null) return null;
  const sla = now.getTime() - LIVE_CONTENT_THRESHOLDS.reviewSlaDays * 86_400_000;
  const out = { standard: { pending: 0, overdue: 0 }, sensitive: { pending: 0, overdue: 0 } };
  for (const row of rows) {
    const bucket = out[row.risk_category];
    if (!bucket) continue;
    bucket.pending += 1;
    if (Date.parse(row.created_at) < sla) bucket.overdue += 1;
  }
  return out;
}

/** The operator's resolution of a trip. Refuses what the rule says is not resolved. */
export async function resolveLiveContentKillSwitch(input: {
  category: ContentRiskCategory;
  cause: OpenTrip['cause'];
  note: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; why: string }> {
  const now = input.now ?? new Date();
  const audit = await killSwitchRows();
  if (audit === null) return { ok: false, why: 'could not read the kill-switch log' };
  const trip = openTrips(audit).find((o) => o.category === input.category && o.cause === input.cause);
  if (!trip) return { ok: false, why: `no open ${input.cause} trip for ${input.category}` };
  if (input.cause === 'concordance_below_floor') {
    // Appendix E §3.1.1(b): suspended "until the judge is recalibrated".
    const rows = await calibrationRows();
    if (rows === undefined) return { ok: false, why: 'could not read the calibration log' };
    const current = calibrationStatus(rows, now).row;
    if (current === null || current.created_at <= trip.trippedAt) {
      return { ok: false, why: 'a concordance trip resolves only after a PASSED calibration recorded after the trip' };
    }
  }
  if (input.cause === 'review_rate_below_floor') {
    const t = LIVE_CONTENT_THRESHOLDS;
    const from = new Date(now.getTime() - t.reviewWindowDays * 86_400_000).toISOString();
    const to = new Date(now.getTime() - t.reviewSlaDays * 86_400_000).toISOString();
    const rows = await serviceRest<{ sampled: boolean; reviewed_at: string | null; sample_rate: number | string }[]>(
      `/tutor_live_content_log?risk_category=eq.${input.category}&created_at=gte.${encodeURIComponent(from)}&created_at=lt.${encodeURIComponent(to)}&select=sampled,reviewed_at,sample_rate&limit=20000`,
    );
    if (rows === null) return { ok: false, why: 'could not read the live-content log' };
    if (reviewCoverage(input.category, rows, t).belowFloor) {
      return { ok: false, why: 'staff review is still below the floor for this category; clear the backlog first' };
    }
  }
  resetLiveContentGateCache();
  const written = await insertAuditLog(null, LIVE_CONTENT_KILL_SWITCH_RESOLVED, 'tutor', {
    component: 'live_content_judge',
    category: input.category,
    cause: input.cause,
    note: input.note.slice(0, 500),
  });
  return written ? { ok: true } : { ok: false, why: 'the resolution row did not land' };
}

// ── 9. calibration against a human-rated seed set (Appendix E §2.1/§3.2) ────
//
// Since C.23 the computation is the shared standard in `judgeCalibration.ts`
// (inter-rater agreement raw and chance-corrected, the judge per category
// with both labels present, Cohen's kappa, the verbosity and self-
// enhancement checks). This is the content judge's adapter: one question
// ("approve"), pass/fail only, strata = the two risk categories.

export type SeedLabel = 'pass' | 'fail';

export interface CalibrationInput {
  seedSet: { version: string; hash: string; items: { id: string; category: ContentRiskCategory; length?: number }[] };
  /** One entry per human rater: that rater's label for every item. */
  ratings: { rater: string; source: 'human_panel' | string; labels: Record<string, SeedLabel> }[];
  /** The judge's verdict per item, and how the verdicts were obtained. */
  judge: { model: string; promptHash: string; mode: 'live' | 'replay' | string; authorModel?: string | null; verdicts: Record<string, SeedLabel> };
}

export interface CalibrationResult {
  recordable: boolean;
  refusals: string[];
  verdict: 'passed' | 'failed';
  itemsStandard: number;
  itemsSensitive: number;
  agreementStandard: number;
  agreementSensitive: number;
  interRater: number;
  disagreements: { id: string; category: ContentRiskCategory; human: SeedLabel; judge: SeedLabel }[];
  /** The full shared computation (kappas, bias checks, failure reasons). */
  general: CalibrationComputation;
}

const asQuestion = (labels: Record<string, SeedLabel>): Record<string, Record<string, JudgeLabel>> =>
  Object.fromEntries(Object.entries(labels).map(([id, l]) => [id, { approve: l }]));

/**
 * Computes a content-judge calibration run from its raw parts — never from a
 * number the harness computed — with the shared C.23 standard. NOT
 * RECORDABLE whatever the numbers: fewer than two raters, a rating file not
 * from the human panel, a judge not run live, or a missing label/verdict.
 */
export function computeCalibration(input: CalibrationInput): CalibrationResult {
  const general = computeJudgeCalibration({
    judgeId: 'live_content_judge',
    kind: 'calibration',
    seedSet: {
      version: input.seedSet.version,
      hash: input.seedSet.hash,
      items: input.seedSet.items.map((i) => ({ id: i.id, stratum: i.category, length: i.length ?? 0 })),
    },
    ratings: input.ratings.map((r) => ({ rater: r.rater, source: r.source, labels: asQuestion(r.labels) })),
    judge: {
      model: input.judge.model,
      promptHash: input.judge.promptHash,
      mode: input.judge.mode,
      authorModel: input.judge.authorModel ?? null,
      verdicts: asQuestion(input.judge.verdicts),
    },
  });
  const stratum = (c: ContentRiskCategory) => general.strata.find((s) => s.question === 'approve' && s.stratum === c);
  return {
    recordable: general.recordable,
    refusals: general.refusals,
    verdict: general.verdict,
    itemsStandard: stratum('standard')?.items ?? 0,
    itemsSensitive: stratum('sensitive')?.items ?? 0,
    agreementStandard: stratum('standard')?.agreement ?? 0,
    agreementSensitive: stratum('sensitive')?.agreement ?? 0,
    interRater: general.interRaterAgreement,
    disagreements: general.disagreements.map((d) => ({
      id: d.item,
      category: d.stratum as ContentRiskCategory,
      human: d.panel as SeedLabel,
      judge: d.judge as SeedLabel,
    })),
    general,
  };
}

/** Records a computed content-judge calibration run (operator, service role). */
export async function recordJudgeCalibration(input: {
  result: CalibrationResult;
  seedSet: CalibrationInput['seedSet'];
  judge: CalibrationInput['judge'];
  recordedBy: string;
  note: string;
}): Promise<{ ok: true; id: string } | { ok: false; why: string }> {
  const outcome = await recordCalibration({
    result: input.result.general,
    seedSet: { version: input.seedSet.version, hash: input.seedSet.hash },
    judge: { model: input.judge.model, promptHash: input.judge.promptHash, authorModel: input.judge.authorModel ?? null },
    verifiesId: null,
    recordedBy: input.recordedBy,
    note: input.note,
  });
  if (!outcome.ok) return outcome;
  resetLiveContentGateCache();
  await insertAuditLog(null, LIVE_CONTENT_CALIBRATION_RECORDED, 'tutor', {
    component: 'live_content_judge',
    calibrationId: outcome.id,
    verdict: input.result.verdict,
    judgeModel: input.judge.model,
    agreementStandard: input.result.agreementStandard,
    agreementSensitive: input.result.agreementSensitive,
    interRater: input.result.interRater,
  });
  return outcome;
}

// ── 10. the claim ────────────────────────────────────────────────────────────

/** The live claim: segment + systematic sampling decision + log row, one transaction. */
export async function insertLiveSegmentChecked<Row>(input: {
  sessionId: string;
  sourceKey: string | null;
  segmentType: string;
  payload: Record<string, unknown>;
  answer: Record<string, unknown> | null;
  keyVerified: boolean;
  provenance: Record<string, unknown>;
  riskCategory: ContentRiskCategory;
  riskSignals: readonly string[];
  tier: number;
  locale: string;
  sampleRate: number;
  elevated: boolean;
  judgeModel: string;
  judgePromptHash: string;
  calibrationId: string;
}): Promise<Row | 'conflict' | null> {
  const rows = await serviceRest<Row[]>('/rpc/insert_tutor_live_segment_checked', {
    method: 'POST',
    body: JSON.stringify({
      p_session_id: input.sessionId,
      p_source_key: input.sourceKey,
      p_segment_type: input.segmentType,
      p_payload: input.payload,
      p_answer: input.answer,
      p_key_verified: input.keyVerified,
      p_provenance: input.provenance,
      p_risk_category: input.riskCategory,
      p_risk_signals: input.riskSignals,
      p_tier: input.tier,
      p_locale: input.locale,
      p_sample_rate: input.sampleRate,
      p_elevated: input.elevated,
      p_judge_model: input.judgeModel,
      p_judge_prompt_hash: input.judgePromptHash,
      p_calibration_id: input.calibrationId,
    }),
  });
  if (rows === null) return null;
  return rows.length > 0 ? rows[0]! : 'conflict';
}

// ── 11. the report (pure) ────────────────────────────────────────────────────

export interface LiveLogRow {
  risk_category: ContentRiskCategory;
  sampled: boolean;
  sample_rate: number | string;
  elevated: boolean;
  review_verdict: 'approved' | 'rejected' | null;
  review_issue: ReviewIssue | null;
  reviewed_at: string | null;
  calibration_id: string | null;
  segment_type: string;
  created_at: string;
}

export interface LadderEventRow {
  outcome: LadderOutcome;
  route: LadderRoute;
  kc_id: string | null;
  skill_key: string | null;
  tier: number;
  locale: string;
  reason: string | null;
  created_at: string;
}

/** Per category: served, sampled, decided, issues by class, backlog past SLA. */
export function summarizeLiveLog(rows: readonly LiveLogRow[], now: Date, t = LIVE_CONTENT_THRESHOLDS) {
  const sla = now.getTime() - t.reviewSlaDays * 86_400_000;
  return RISK_CATEGORIES.map((category) => {
    const scoped = rows.filter((r) => r.risk_category === category);
    const decided = scoped.filter((r) => r.review_verdict !== null);
    const rejected = decided.filter((r) => r.review_verdict === 'rejected');
    return {
      category,
      served: scoped.length,
      sampled: scoped.filter((r) => r.sampled).length,
      servedElevated: scoped.filter((r) => r.elevated).length,
      decided: decided.length,
      approved: decided.length - rejected.length,
      rejectedQuality: rejected.filter((r) => r.review_issue === 'quality').length,
      rejectedSafety: rejected.filter((r) => r.review_issue === 'safety').length,
      rejectedUnclassified: rejected.filter((r) => r.review_issue === null).length,
      backlogPastSla: scoped.filter((r) => r.sampled && r.review_verdict === null && Date.parse(r.created_at) < sla).length,
      belowFloorRows: scoped.filter((r) => Number(r.sample_rate) < LIVE_CONTENT_FLOORS[category]).length,
    };
  });
}

/**
 * C.6's measure: the share of served activities per rung, the demand the
 * curated tier does not cover yet (ranked request patterns that fell through
 * to live generation), and the live share per week (it must fall as packs
 * land).
 */
export function summarizeLadder(rows: readonly LadderEventRow[]) {
  const served = rows.filter((r) => r.outcome === 'catalog' || r.outcome === 'bank' || r.outcome === 'live_served');
  const share = (o: LadderOutcome) => (served.length === 0 ? null : served.filter((r) => r.outcome === o).length / served.length);
  const demand = new Map<string, { pattern: string; kcId: string | null; skillKey: string | null; tier: number; locale: string; invitations: number; suspended: number }>();
  for (const r of rows) {
    if (r.outcome !== 'needs_generation' && r.outcome !== 'live_suspended') continue;
    const pattern = `${r.kc_id ?? r.skill_key ?? 'unknown'}|t${r.tier}|${r.locale}`;
    const entry = demand.get(pattern) ?? { pattern, kcId: r.kc_id, skillKey: r.skill_key, tier: r.tier, locale: r.locale, invitations: 0, suspended: 0 };
    if (r.outcome === 'needs_generation') entry.invitations += 1;
    else entry.suspended += 1;
    demand.set(pattern, entry);
  }
  const weekly = new Map<string, { week: string; served: number; live: number }>();
  for (const r of served) {
    const week = isoWeekStart(r.created_at);
    const entry = weekly.get(week) ?? { week, served: 0, live: 0 };
    entry.served += 1;
    if (r.outcome === 'live_served') entry.live += 1;
    weekly.set(week, entry);
  }
  return {
    served: served.length,
    catalogShare: share('catalog'),
    bankShare: share('bank'),
    liveShare: share('live_served'),
    unmetDemand: [...demand.values()].sort((a, b) => b.invitations + b.suspended - (a.invitations + a.suspended)),
    weekly: [...weekly.values()].sort((a, b) => a.week.localeCompare(b.week)),
    refusals: rows.filter((r) => r.outcome === 'live_refused').length,
  };
}

function isoWeekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
