/*
 * Core's half of Product C.11 — the two-tier spaced review (Appendix D §2.4),
 * instrumented for Appendix F §1.1 (Spaced-Review Routing Accuracy) and
 * Part 3 Stage 7.
 *
 *   1. THE ROUTING LOG. Oracle's router (`oracle/src/tutor/spacedReview.ts`)
 *      reports every routing decision at close, WITH the inputs the rule read.
 *      Each is a row of `tutor_review_routing` (migration
 *      *_mentor_spaced_review_and_dialogue_calibration.sql): ids of our own
 *      catalog, closed labels and numbers — never the learner's words.
 *   2. THE HAND-OFF. Every knowledge component the session did not retire in
 *      its within-session tier (routed cross-session, still queued at close,
 *      or a re-check the learner never answered) is handed to the
 *      cross-session scheduler: its memory card is made due no later than
 *      `handoffHours` after the close, so the NEXT session's plan brings it
 *      back as review debt (`sessionPlan.ts`). The card is only ever brought
 *      FORWARD, never pushed later. The other half of the scheduler's C.11
 *      change is the short-horizon rule in `fsrs.ts`.
 *   3. THE AUDIT. The rule is pure and mirrored here (`routeWrongAnswer`,
 *      kept identical to Oracle's by `npm run review-calibration:check`), so
 *      every recorded decision can be RE-EVALUATED from its recorded inputs:
 *      a decision the rule does not reproduce is a misroute, visible and
 *      countable. The quarterly spot check (`npm --prefix backend run
 *      tutor:spaced-review-report -- --sample=N`) draws a reproducible sample
 *      for the human auditor beside the automatic re-evaluation.
 *   4. STAGE 7. The automatic rollback: a recorded decision the rule does not
 *      reproduce (a bug — the Routing Accuracy target is "no systematic
 *      misrouting"), or within-session routings that mostly never get their
 *      re-check before the session ends (the budget prediction failing
 *      systematically) → `audit_logs`, and new sessions run the router in
 *      shadow (decisions recorded, no re-check detours, no hand-offs) until an
 *      operator records the resolution.
 *
 * Every threshold is PROPOSED, pending calibration:
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md (C.11 rows).
 */

import crypto from 'crypto';
import { z } from 'zod';
import { insertAuditLog, serviceRest } from '../supabaseRest.js';

// ── the vocabularies and the rule (hand-mirrored from Oracle) ────────────────

export const SPACED_REVIEW_RULE_VERSION = 'c11.v1';
export const SPACED_REVIEW_MODES = ['act', 'shadow'] as const;
export const REVIEW_TIERS = ['within_session', 'cross_session'] as const;
export const ROUTING_REASONS = [
  'no_plan_entry',
  'wrapping',
  'time_budget',
  'turn_budget',
  'reexposure_cap',
  'far_from_threshold',
  'queue_full',
  'near_threshold',
] as const;
export const ROUTING_SOURCES = ['first_miss', 'reexposure_miss'] as const;
export const ROUTING_OUTCOMES = ['retired', 'rerouted', 'session_ended', 'abandoned', 'handed_off'] as const;
export const BUDGET_STATES = ['running', 'wrapping', 'ended'] as const;

export type ReviewTier = (typeof REVIEW_TIERS)[number];
export type RoutingReason = (typeof ROUTING_REASONS)[number];
export type RoutingOutcome = (typeof ROUTING_OUTCOMES)[number];

/** The rule's thresholds — identical to Oracle's `SPACED_REVIEW_THRESHOLDS` (parity-checked). */
export const SPACED_REVIEW_THRESHOLDS = {
  nearThresholdFloor: 0.5,
  minTurnsRemaining: 8,
  minMsUntilWrap: 4 * 60_000,
  reexposureGapTurns: 3,
  maxReexposuresPerKc: 3,
  retireAtNet: 1,
  maxQueued: 3,
  reviewOpenTurns: 3,
  maxDecisions: 40,
} as const;

/** Core-only operational numbers (Stage 7, the hand-off). */
export const SPACED_REVIEW_OPERATIONS = {
  /** A handed-off KC is due again no later than this long after the close. */
  handoffHours: 12,
  /** Stage 7: the latest act-mode decisions re-evaluated against the rule. */
  complianceSample: 200,
  /** Stage 7: the latest act-mode within-session decisions with a final outcome. */
  deliverySample: 100,
  /** Stage 7: above this share of them ending without their re-check, the budget prediction is failing. */
  undeliveredCeiling: 0.5,
  killSwitchCacheMs: 10 * 60_000,
  /** Report: fewer decisions than this is "insufficient data", never "healthy". */
  reportMinDecisions: 30,
} as const;

export interface RoutingInputs {
  planned: boolean;
  p_before: number;
  turns_remaining: number;
  ms_until_wrap: number;
  budget_state: (typeof BUDGET_STATES)[number];
  reexposures_before: number;
  queued_before: number;
}

/** THE decision rule, mirrored from Oracle (Appendix D §2.4). Pure. */
export function routeWrongAnswer(
  input: RoutingInputs,
  t = SPACED_REVIEW_THRESHOLDS,
): { tier: ReviewTier; reason: RoutingReason } {
  const cross = (reason: RoutingReason) => ({ tier: 'cross_session' as const, reason });
  if (!input.planned) return cross('no_plan_entry');
  if (input.budget_state !== 'running') return cross('wrapping');
  if (input.ms_until_wrap < t.minMsUntilWrap) return cross('time_budget');
  if (input.turns_remaining < t.minTurnsRemaining) return cross('turn_budget');
  if (input.reexposures_before >= t.maxReexposuresPerKc) return cross('reexposure_cap');
  if (input.p_before < t.nearThresholdFloor) return cross('far_from_threshold');
  if (input.queued_before >= t.maxQueued) return cross('queue_full');
  return { tier: 'within_session', reason: 'near_threshold' };
}

// ── 1. the close body ────────────────────────────────────────────────────────

const WITHIN_OUTCOMES: readonly RoutingOutcome[] = ['retired', 'rerouted', 'session_ended', 'abandoned'];

export const RoutingDecisionBody = z
  .object({
    observation: z.number().int().min(1).max(200),
    kcId: z.string().uuid(),
    tier: z.enum(REVIEW_TIERS),
    reason: z.enum(ROUTING_REASONS),
    source: z.enum(ROUTING_SOURCES),
    pBefore: z.number().min(0).max(1),
    pAfter: z.number().min(0).max(1),
    turnsRemaining: z.number().int().min(0).max(100_000),
    msUntilWrap: z.number().int().min(0).max(86_400_000),
    budgetState: z.enum(BUDGET_STATES),
    planned: z.boolean(),
    reexposuresBefore: z.number().int().min(0).max(50),
    queuedBefore: z.number().int().min(0).max(50),
    atTurn: z.number().int().min(0).max(100_000),
    outcome: z.enum(ROUTING_OUTCOMES),
    successes: z.number().int().min(0).max(50),
    failures: z.number().int().min(0).max(50),
  })
  .strict()
  // A within-session decision is only ever "near_threshold", and the reverse.
  .refine((d) => (d.tier === 'within_session') === (d.reason === 'near_threshold'), 'tier and reason disagree')
  // A cross-session decision is handed off from the miss on; a within one never is.
  .refine((d) => (d.tier === 'cross_session' ? d.outcome === 'handed_off' : WITHIN_OUTCOMES.includes(d.outcome)), 'outcome does not fit the tier')
  .refine((d) => d.outcome !== 'retired' || d.successes >= 1, 'retired without a spaced success');

export const SpacedReviewReportBody = z
  .object({
    mode: z.enum(SPACED_REVIEW_MODES),
    ruleVersion: z.string().min(1).max(16),
    learnerTurns: z.number().int().min(0).max(100_000),
    detoursOpened: z.number().int().min(0).max(10_000),
    overflow: z.number().int().min(0).max(10_000),
    decisions: z.array(RoutingDecisionBody).max(SPACED_REVIEW_THRESHOLDS.maxDecisions),
  })
  .strict()
  // Shadow never opens a re-check detour.
  .refine((r) => r.mode === 'act' || r.detoursOpened === 0, 'a shadow router opened a re-check')
  .refine((r) => new Set(r.decisions.map((d) => d.observation)).size === r.decisions.length, 'duplicate observation');
export type SpacedReviewReport = z.infer<typeof SpacedReviewReportBody>;

// ── 2. the routing log and the hand-off ──────────────────────────────────────

/** The KCs this session hands to the cross-session scheduler (act mode only). */
export function handoffKcIds(report: SpacedReviewReport): string[] {
  if (report.mode !== 'act') return [];
  const final = new Map<string, RoutingOutcome>();
  for (const d of [...report.decisions].sort((a, b) => a.observation - b.observation)) final.set(d.kcId, d.outcome);
  return [...final].filter(([, outcome]) => outcome !== 'retired' && outcome !== 'rerouted').map(([kcId]) => kcId);
}

/**
 * Writes the routing rows (idempotent on a retried close) and applies the
 * hand-offs. Best-effort after the close landed: a failed write costs audit
 * rows or one early review, never the close.
 */
export async function recordSpacedReviewClose(input: {
  sessionId: string;
  userId: string;
  character: string;
  report: SpacedReviewReport;
  closedAt: Date;
}): Promise<{ recorded: boolean; handedOff: number }> {
  const { report } = input;
  let recorded = true;
  if (report.decisions.length > 0) {
    const rows = await serviceRest<unknown>('/tutor_review_routing?on_conflict=session_id,observation', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(
        report.decisions.map((d) => ({
          session_id: input.sessionId,
          character: input.character,
          mode: report.mode,
          rule_version: report.ruleVersion.slice(0, 16),
          observation: d.observation,
          kc_id: d.kcId,
          tier: d.tier,
          reason: d.reason,
          source: d.source,
          p_before: d.pBefore,
          p_after: d.pAfter,
          turns_remaining: d.turnsRemaining,
          ms_until_wrap: d.msUntilWrap,
          budget_state: d.budgetState,
          planned: d.planned,
          reexposures_before: d.reexposuresBefore,
          queued_before: d.queuedBefore,
          at_turn: d.atTurn,
          outcome: d.outcome,
          successes: d.successes,
          failures: d.failures,
        })),
      ),
    });
    recorded = rows !== null;
  }
  const due = new Date(input.closedAt.getTime() + SPACED_REVIEW_OPERATIONS.handoffHours * 3_600_000).toISOString();
  let handedOff = 0;
  for (const kcId of handoffKcIds(report)) {
    // Only ever brings the card forward: the filter matches a card due LATER than the hand-off.
    const moved = await serviceRest<{ kc_id: string }[]>(
      `/memory_card?user_id=eq.${encodeURIComponent(input.userId)}&kc_id=eq.${encodeURIComponent(kcId)}&due_at=gt.${encodeURIComponent(due)}`,
      { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ due_at: due }) },
    );
    if (moved === null) recorded = false;
    else handedOff += moved.length;
  }
  return { recorded, handedOff };
}

// ── 3. the audit ─────────────────────────────────────────────────────────────

export interface RoutingRow extends RoutingInputs {
  session_id: string | null;
  mode: 'act' | 'shadow';
  rule_version: string;
  observation: number;
  kc_id: string;
  tier: ReviewTier;
  reason: RoutingReason;
  source: string;
  outcome: RoutingOutcome;
  created_at: string;
}

export type MetricStatus = 'ok' | 'defect' | 'insufficient_data' | 'diagnostic';

/** Re-evaluates every recorded decision from its recorded inputs. */
export function evaluateRoutingCompliance(rows: RoutingRow[]): {
  evaluated: number;
  mismatches: { sessionId: string | null; observation: number; recorded: string; rule: string }[];
  rate: number | null;
} {
  const mismatches: { sessionId: string | null; observation: number; recorded: string; rule: string }[] = [];
  for (const row of rows) {
    const rule = routeWrongAnswer({ ...row, p_before: Number(row.p_before) });
    if (rule.tier !== row.tier || rule.reason !== row.reason) {
      mismatches.push({ sessionId: row.session_id, observation: row.observation, recorded: `${row.tier}/${row.reason}`, rule: `${rule.tier}/${rule.reason}` });
    }
  }
  return { evaluated: rows.length, mismatches, rate: rows.length === 0 ? null : (rows.length - mismatches.length) / rows.length };
}

/** The routing picture for the report: tiers, reasons, outcomes, and the within-session delivery share. */
export function summarizeRouting(rows: RoutingRow[], t = SPACED_REVIEW_OPERATIONS): {
  decisions: number;
  byTier: Record<string, number>;
  byReason: Record<string, number>;
  byOutcome: Record<string, number>;
  withinFinal: number;
  retiredShare: number | null;
  undeliveredShare: number | null;
  compliance: ReturnType<typeof evaluateRoutingCompliance>;
  status: MetricStatus;
  findings: string[];
} {
  const count = (key: (r: RoutingRow) => string) =>
    rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [key(r)]: (acc[key(r)] ?? 0) + 1 }), {});
  const act = rows.filter((r) => r.mode === 'act');
  const withinFinal = act.filter((r) => r.tier === 'within_session' && r.outcome !== 'rerouted');
  const undelivered = withinFinal.filter((r) => r.outcome === 'session_ended' || r.outcome === 'abandoned').length;
  const compliance = evaluateRoutingCompliance(rows);
  const findings: string[] = [];
  if (compliance.mismatches.length > 0) {
    findings.push(`${compliance.mismatches.length} recorded decision(s) the rule does not reproduce — a misroute is a defect`);
  }
  const undeliveredShare = withinFinal.length === 0 ? null : undelivered / withinFinal.length;
  if (undeliveredShare !== null && withinFinal.length >= t.reportMinDecisions && undeliveredShare > t.undeliveredCeiling) {
    findings.push(
      `${(undeliveredShare * 100).toFixed(1)}% of within-session routings never got their re-check before the session ended — the budget prediction is systematically misrouting`,
    );
  }
  const status: MetricStatus =
    findings.length > 0 ? 'defect' : rows.length < t.reportMinDecisions ? 'insufficient_data' : 'ok';
  return {
    decisions: rows.length,
    byTier: count((r) => r.tier),
    byReason: count((r) => r.reason),
    byOutcome: count((r) => r.outcome),
    withinFinal: withinFinal.length,
    retiredShare: withinFinal.length === 0 ? null : withinFinal.filter((r) => r.outcome === 'retired').length / withinFinal.length,
    undeliveredShare,
    compliance,
    status,
    findings,
  };
}

/**
 * The quarterly manual spot check (Appendix F §1.1): a REPRODUCIBLE sample of
 * decisions (the same seed draws the same rows), stratified so both tiers are
 * represented, for a human to read against the Appendix D §2.4 rule.
 */
export function drawAuditSample(rows: RoutingRow[], size: number, seed: string): RoutingRow[] {
  const rank = (r: RoutingRow) =>
    crypto.createHash('sha256').update(`${seed}:${r.session_id ?? 'none'}:${r.observation}`).digest('hex');
  const byTier = REVIEW_TIERS.map((tier) => rows.filter((r) => r.tier === tier).sort((a, b) => rank(a).localeCompare(rank(b))));
  const out: RoutingRow[] = [];
  for (let i = 0; out.length < size && byTier.some((list) => i < list.length); i += 1) {
    for (const list of byTier) if (i < list.length && out.length < size) out.push(list[i]!);
  }
  return out;
}

// ── 4. Stage 7 ───────────────────────────────────────────────────────────────

export const SPACED_REVIEW_KILL_SWITCH_TRIGGERED = 'mentor.kill_switch.spaced_review.triggered';
export const SPACED_REVIEW_KILL_SWITCH_RESOLVED = 'mentor.kill_switch.spaced_review.resolved';
export type SpacedReviewKillSwitchCause = 'rule_mismatch' | 'reexposure_not_delivered';

/** Pure. `recent`: the latest act-mode decisions, newest first. */
export function evaluateSpacedReviewKillSwitch(
  recent: RoutingRow[],
  t = SPACED_REVIEW_OPERATIONS,
): { tripped: boolean; causes: SpacedReviewKillSwitchCause[]; mismatches: number; undeliveredShare: number | null } {
  const sample = recent.slice(0, t.complianceSample);
  const mismatches = evaluateRoutingCompliance(sample).mismatches.length;
  const within = recent.filter((r) => r.tier === 'within_session' && r.outcome !== 'rerouted').slice(0, t.deliverySample);
  const undeliveredShare =
    within.length < t.deliverySample
      ? null
      : within.filter((r) => r.outcome === 'session_ended' || r.outcome === 'abandoned').length / within.length;
  const causes: SpacedReviewKillSwitchCause[] = [];
  if (mismatches > 0) causes.push('rule_mismatch');
  if (undeliveredShare !== null && undeliveredShare > t.undeliveredCeiling) causes.push('reexposure_not_delivered');
  return { tripped: causes.length > 0, causes, mismatches, undeliveredShare };
}

export interface SpacedReviewKillSwitchState {
  mode: 'act' | 'shadow';
  trippedAt: string | null;
  causes: SpacedReviewKillSwitchCause[];
  degraded: boolean;
}

interface AuditRow {
  action: string;
  created_at: string;
  detail: Record<string, unknown> | null;
}

let cache: { at: number; state: SpacedReviewKillSwitchState } | null = null;

/** Test hook: forget the cached verdict. */
export function resetSpacedReviewKillSwitchCache(): void {
  cache = null;
}

const ROUTING_SELECT =
  'session_id,mode,rule_version,observation,kc_id,tier,reason,source,p_before,turns_remaining,ms_until_wrap,budget_state,planned,reexposures_before,queued_before,outcome,created_at';
export { ROUTING_SELECT };

/**
 * The kill-switch state for a new session's context (cached per process).
 * A trip in force → shadow; otherwise the condition is evaluated over the
 * decisions recorded after the latest resolution, and a trip is written to
 * `audit_logs` (counts only). A FAILED read is not evidence (§1.14): `act`
 * with `degraded`, not cached.
 */
export async function getSpacedReviewKillSwitch(now: Date = new Date(), t = SPACED_REVIEW_OPERATIONS): Promise<SpacedReviewKillSwitchState> {
  if (cache !== null && now.getTime() - cache.at < t.killSwitchCacheMs) return cache.state;
  const log = await serviceRest<AuditRow[]>(
    `/audit_logs?action=in.(${SPACED_REVIEW_KILL_SWITCH_TRIGGERED},${SPACED_REVIEW_KILL_SWITCH_RESOLVED})&select=action,created_at,detail&order=created_at.desc&limit=1`,
  );
  if (log === null) return { mode: 'act', trippedAt: null, causes: [], degraded: true };
  const latest = log[0] ?? null;
  if (latest?.action === SPACED_REVIEW_KILL_SWITCH_TRIGGERED) {
    const causes = Array.isArray(latest.detail?.causes) ? (latest.detail.causes as SpacedReviewKillSwitchCause[]) : [];
    const state: SpacedReviewKillSwitchState = { mode: 'shadow', trippedAt: latest.created_at, causes, degraded: false };
    cache = { at: now.getTime(), state };
    return state;
  }
  const since = latest?.action === SPACED_REVIEW_KILL_SWITCH_RESOLVED ? `&created_at=gt.${encodeURIComponent(latest.created_at)}` : '';
  const recent = await serviceRest<RoutingRow[]>(
    `/tutor_review_routing?select=${ROUTING_SELECT}&mode=eq.act${since}&order=created_at.desc&limit=${Math.max(t.complianceSample, t.deliverySample * 4)}`,
  );
  if (recent === null) return { mode: 'act', trippedAt: null, causes: [], degraded: true };
  const verdict = evaluateSpacedReviewKillSwitch(recent, t);
  let state: SpacedReviewKillSwitchState = { mode: 'act', trippedAt: null, causes: [], degraded: false };
  if (verdict.tripped) {
    const written = await insertAuditLog(null, SPACED_REVIEW_KILL_SWITCH_TRIGGERED, 'tutor', {
      component: 'spaced_review_router',
      causes: verdict.causes,
      mismatches: verdict.mismatches,
      undeliveredShare: verdict.undeliveredShare,
    });
    if (!written) console.warn('[tutor] spaced-review kill switch tripped but its audit row did NOT land');
    console.warn(`[tutor] spaced-review kill switch TRIPPED (${verdict.causes.join(', ')}): the router runs in shadow`);
    state = { mode: 'shadow', trippedAt: now.toISOString(), causes: verdict.causes, degraded: false };
  }
  cache = { at: now.getTime(), state };
  return state;
}

/** The operator's resolution of a trip (root-caused). */
export async function resolveSpacedReviewKillSwitch(note: string): Promise<boolean> {
  resetSpacedReviewKillSwitchCache();
  return insertAuditLog(null, SPACED_REVIEW_KILL_SWITCH_RESOLVED, 'tutor', { component: 'spaced_review_router', note: note.slice(0, 500) });
}

/** The Kill-Switch Trigger Log for the router (Appendix F §1.3). */
export function spacedReviewKillSwitchLog(rows: AuditRow[]): {
  triggeredAt: string;
  causes: SpacedReviewKillSwitchCause[];
  resolvedAt: string | null;
  resolutionHours: number | null;
}[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out: ReturnType<typeof spacedReviewKillSwitchLog> = [];
  let open: (typeof out)[number] | null = null;
  for (const row of ordered) {
    if (row.action === SPACED_REVIEW_KILL_SWITCH_TRIGGERED && open === null) {
      open = {
        triggeredAt: row.created_at,
        causes: Array.isArray(row.detail?.causes) ? (row.detail.causes as SpacedReviewKillSwitchCause[]) : [],
        resolvedAt: null,
        resolutionHours: null,
      };
      out.push(open);
    } else if (row.action === SPACED_REVIEW_KILL_SWITCH_RESOLVED && open !== null) {
      open.resolvedAt = row.created_at;
      open.resolutionHours = (Date.parse(row.created_at) - Date.parse(open.triggeredAt)) / 3_600_000;
      open = null;
    }
  }
  return out;
}

// ── 5. the quarterly human spot check (Appendix F §1.1) ──────────────────────

/** A completed human audit of a drawn sample, recorded by the auditor. */
export const ROUTING_AUDIT_RECORDED = 'mentor.review_routing.quarterly_audit';
/** Quarterly, with a week of grace. Proposed, pending calibration. */
export const ROUTING_AUDIT_CADENCE_DAYS = 99;

/**
 * Whether the quarterly spot check is overdue: the router has been recording
 * decisions for longer than the cadence and no human audit was recorded
 * within it. A router with less than a quarter of history is not yet due.
 */
export function routingAuditCadence(
  lastAuditAt: string | null,
  oldestDecisionAt: string | null,
  now: Date,
  cadenceDays = ROUTING_AUDIT_CADENCE_DAYS,
): { overdue: boolean; daysSinceAudit: number | null } {
  const days = (iso: string) => (now.getTime() - Date.parse(iso)) / 86_400_000;
  const daysSinceAudit = lastAuditAt === null ? null : Math.floor(days(lastAuditAt));
  const liveLongEnough = oldestDecisionAt !== null && days(oldestDecisionAt) > cadenceDays;
  return { overdue: liveLongEnough && (daysSinceAudit === null || daysSinceAudit > cadenceDays), daysSinceAudit };
}

/** Records the auditor's completed spot check: the seed, the sample size, the misroutes found, the note. */
export async function recordRoutingAudit(input: { seed: string; sampled: number; misroutesFound: number; note: string }): Promise<boolean> {
  return insertAuditLog(null, ROUTING_AUDIT_RECORDED, 'tutor', {
    component: 'spaced_review_router',
    seed: input.seed.slice(0, 64),
    sampled: input.sampled,
    misroutesFound: input.misroutesFound,
    note: input.note.slice(0, 1000),
  });
}
