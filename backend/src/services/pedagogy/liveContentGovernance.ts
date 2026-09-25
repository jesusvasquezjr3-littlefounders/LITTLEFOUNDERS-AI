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
 *      refused.
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
  /** Calibration: judge-human agreement per category (pre-registered). */
  calibrationAgreement: 0.9,
  /** Calibration: human inter-rater agreement on the seed set (Appendix E §2.1, ~85%). */
  calibrationInterRater: 0.85,
  /** Calibration: seed items per category. */
  calibrationMinItemsPerCategory: 20,
  /** Calibration: re-check cadence (Appendix F §1.3: monthly in the first year), with grace. */
  calibrationMaxAgeDays: 35,
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

export interface CalibrationRow {
  id: string;
  judge_model: string;
  judge_prompt_hash: string;
  seed_set_version: string;
  seed_set_hash: string;
  raters: number;
  items_standard: number;
  items_sensitive: number;
  agreement_standard: number | string;
  agreement_sensitive: number | string;
  inter_rater_agreement: number | string;
  verdict: 'passed' | 'failed';
  created_at: string;
}

export type CalibrationState = 'passed' | 'uncalibrated' | 'stale';

/**
 * The LATEST recorded run decides: a failed recalibration un-trusts a judge
 * that passed before. A passed run older than the cadence is stale.
 */
export function calibrationStatus(
  latest: CalibrationRow | null,
  now: Date,
  t = LIVE_CONTENT_THRESHOLDS,
): { state: CalibrationState; ageDays: number | null } {
  if (latest === null || latest.verdict !== 'passed') {
    return { state: 'uncalibrated', ageDays: latest === null ? null : ageDays(latest.created_at, now) };
  }
  const age = ageDays(latest.created_at, now);
  return { state: age > t.calibrationMaxAgeDays ? 'stale' : 'passed', ageDays: age };
}

function ageDays(iso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
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

const CALIBRATION_SELECT =
  'id,judge_model,judge_prompt_hash,seed_set_version,seed_set_hash,raters,items_standard,items_sensitive,agreement_standard,agreement_sensitive,inter_rater_agreement,verdict,created_at';

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

export async function latestCalibration(): Promise<CalibrationRow | null | undefined> {
  const rows = await serviceRest<CalibrationRow[]>(
    `/tutor_content_judge_calibration?select=${CALIBRATION_SELECT}&order=created_at.desc&limit=1`,
  );
  if (rows === null) return undefined;
  return rows[0] ?? null;
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
  const [calibration, audit] = await Promise.all([latestCalibration(), killSwitchRows()]);
  if (calibration === undefined || audit === null) return unavailableGate();

  const status = calibrationStatus(calibration, now, t);
  let open = openTrips(audit);
  // Trips are only evaluated against a judge that is trusted at all; an
  // uncalibrated judge is already suspended everywhere.
  const trusted = status.state === 'passed' ? calibration : null;

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
    calibration: { state: status.state, row: calibration, ageDays: status.ageDays },
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
    const calibration = await latestCalibration();
    if (calibration === undefined) return { ok: false, why: 'could not read the calibration log' };
    if (calibration === null || calibration.verdict !== 'passed' || calibration.created_at <= trip.trippedAt) {
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

export type SeedLabel = 'pass' | 'fail';

export interface CalibrationInput {
  seedSet: { version: string; hash: string; items: { id: string; category: ContentRiskCategory }[] };
  /** One entry per human rater: that rater's label for every item. */
  ratings: { rater: string; source: 'human_panel' | string; labels: Record<string, SeedLabel> }[];
  /** The judge's verdict per item, and how the verdicts were obtained. */
  judge: { model: string; promptHash: string; mode: 'live' | 'replay' | string; verdicts: Record<string, SeedLabel> };
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
}

/**
 * Computes a calibration run from its raw parts — never from a number the
 * harness computed — so the recorded agreement is reproducible.
 *
 *   inter-rater agreement  mean pairwise percent agreement over all items
 *   the human label        the panel's majority; a tie is `fail` (half the
 *                          panel suspects a defect, which is not a pass)
 *   judge agreement        per category, judge verdict = human label
 *
 * NOT RECORDABLE (refused, whatever the numbers): fewer than two raters, a
 * rating file not from the human panel (e.g. the seed author's intended
 * labels), a judge verdict set not obtained live, or an item without a
 * label from every rater and the judge.
 */
export function computeCalibration(input: CalibrationInput, t = LIVE_CONTENT_THRESHOLDS): CalibrationResult {
  const refusals: string[] = [];
  const items = input.seedSet.items;
  if (input.ratings.length < 2) refusals.push('at least two human raters are required');
  for (const r of input.ratings) {
    if (r.source !== 'human_panel') refusals.push(`rating set "${r.rater}" is not from the human panel (source: ${r.source})`);
  }
  if (input.judge.mode !== 'live') refusals.push(`judge verdicts were not obtained live (mode: ${input.judge.mode})`);
  if (!/^[0-9a-f]{64}$/.test(input.judge.promptHash)) refusals.push('judge prompt hash is not a SHA-256');

  const humanLabel = new Map<string, SeedLabel>();
  let pairAgree = 0;
  let pairTotal = 0;
  for (const item of items) {
    const labels = input.ratings.map((r) => r.labels[item.id]);
    if (labels.some((l) => l !== 'pass' && l !== 'fail') || (input.judge.verdicts[item.id] !== 'pass' && input.judge.verdicts[item.id] !== 'fail')) {
      refusals.push(`item ${item.id} is missing a label or a judge verdict`);
      continue;
    }
    const passes = labels.filter((l) => l === 'pass').length;
    humanLabel.set(item.id, passes * 2 > labels.length ? 'pass' : 'fail');
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        pairTotal += 1;
        if (labels[i] === labels[j]) pairAgree += 1;
      }
    }
  }

  const disagreements: CalibrationResult['disagreements'] = [];
  const agreementFor = (category: ContentRiskCategory): { n: number; agreement: number } => {
    const scoped = items.filter((i) => i.category === category && humanLabel.has(i.id));
    let agree = 0;
    for (const item of scoped) {
      const human = humanLabel.get(item.id)!;
      const judge = input.judge.verdicts[item.id] as SeedLabel;
      if (human === judge) agree += 1;
      else disagreements.push({ id: item.id, category, human, judge });
    }
    return { n: scoped.length, agreement: scoped.length === 0 ? 0 : agree / scoped.length };
  };
  const standard = agreementFor('standard');
  const sensitive = agreementFor('sensitive');
  const interRater = pairTotal === 0 ? 0 : pairAgree / pairTotal;

  const passed =
    refusals.length === 0 &&
    standard.n >= t.calibrationMinItemsPerCategory &&
    sensitive.n >= t.calibrationMinItemsPerCategory &&
    standard.agreement >= t.calibrationAgreement &&
    sensitive.agreement >= t.calibrationAgreement &&
    interRater >= t.calibrationInterRater;

  return {
    recordable: refusals.length === 0,
    refusals,
    verdict: passed ? 'passed' : 'failed',
    itemsStandard: standard.n,
    itemsSensitive: sensitive.n,
    agreementStandard: round4(standard.agreement),
    agreementSensitive: round4(sensitive.agreement),
    interRater: round4(interRater),
    disagreements,
  };
}

function round4(n: number): number {
  return Math.floor(n * 10_000) / 10_000;
}

/** Records a computed calibration run (operator, service role). */
export async function recordJudgeCalibration(input: {
  result: CalibrationResult;
  seedSet: CalibrationInput['seedSet'];
  judge: CalibrationInput['judge'];
  raters: number;
  recordedBy: string;
  note: string;
}): Promise<string | null> {
  const t = LIVE_CONTENT_THRESHOLDS;
  if (!input.result.recordable) return null;
  const rows = await serviceRest<{ id: string }[]>('/tutor_content_judge_calibration', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      judge_model: input.judge.model,
      judge_prompt_hash: input.judge.promptHash,
      seed_set_version: input.seedSet.version,
      seed_set_hash: input.seedSet.hash,
      raters: input.raters,
      items_standard: input.result.itemsStandard,
      items_sensitive: input.result.itemsSensitive,
      agreement_standard: input.result.agreementStandard,
      agreement_sensitive: input.result.agreementSensitive,
      inter_rater_agreement: input.result.interRater,
      threshold_agreement: t.calibrationAgreement,
      threshold_inter_rater: t.calibrationInterRater,
      min_items_per_category: t.calibrationMinItemsPerCategory,
      verdict: input.result.verdict,
      recorded_by: input.recordedBy.slice(0, 120),
      note: input.note.slice(0, 1000),
    }),
  });
  const id = rows?.[0]?.id ?? null;
  if (id !== null) {
    resetLiveContentGateCache();
    await insertAuditLog(null, LIVE_CONTENT_CALIBRATION_RECORDED, 'tutor', {
      component: 'live_content_judge',
      calibrationId: id,
      verdict: input.result.verdict,
      judgeModel: input.judge.model,
      agreementStandard: input.result.agreementStandard,
      agreementSensitive: input.result.agreementSensitive,
      interRater: input.result.interRater,
    });
  }
  return id;
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
