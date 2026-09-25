/*
 * Core's half of Product C.15 (the Alliance Controller) and C.14 (the
 * self-explanation move).
 *
 *   1. THE CLOSE RECORD. Oracle reports, at close, the Alliance Controller's
 *      session state (continuity move, goal agreement, adaptation offers /
 *      acceptances / declines, bond references, every renegotiation with its
 *      outcome and whether the session improved after it) and the
 *      self-explanation move's events. Core stores them in
 *      `tutor_session_alliance`, `tutor_alliance_renegotiation` and
 *      `tutor_self_explanation_event` (migration
 *      *_mentor_alliance_and_disposition): labels and counts, no user id, no
 *      text. The strict bodies refuse any extra field, so an emotion label or
 *      the learner's words cannot even be sent.
 *   2. THE BOND PROXY. The learner answers "did I get what you were going for
 *      today?" after the session closes (`POST /tutor/sessions/:id/alliance-check`):
 *      their own session only, once, within a day, never after a safety stop.
 *   3. THE METRICS (Appendix F §1.2): Goal-Agreement Completion Rate (near
 *      100% above a turn floor), Adaptation-Offer Renegotiation Trigger Rate
 *      (diagnostic), Alliance Bond Proxy Score per persona (diagnostic),
 *      Self-Explanation Quality-Check Pass Rate (diagnostic) and the
 *      Disposition-Profile Completeness Rate (diagnostic). Pure summaries,
 *      unit-tested without a database; `npm run tutor:alliance-report`.
 *   4. THE STAGE 7 AUTOMATIC ROLLBACK (Appendix F Part 3): a persona's bond
 *      proxy more than 15% below its established baseline, or the latest 50
 *      renegotiations not improving sessions, makes Core send Oracle
 *      `allianceMode: 'shadow'` — the renegotiation trigger and the continuity
 *      re-establishment are suspended, the passive tracking continues. A trip
 *      is written to `audit_logs` and HOLDS until an operator resolves it.
 *
 * Vocabularies are HAND-MIRRORED from Oracle and the migration;
 * `npm run alliance:check` keeps them identical.
 */

import { z } from 'zod';
import { insertAuditLog, serviceRest } from '../supabaseRest.js';

export const ALLIANCE_MODES = ['act', 'shadow'] as const;
export const CONTINUITY_KINDS = ['first_meeting', 'persona_switch', 'memory_gap', 'continuing'] as const;
export const CONTINUITY_MOVES = ['delivered', 'shadow', 'not_needed', 'unknown'] as const;
export const GOAL_AGREEMENTS = ['agreed', 'renegotiated', 'unconfirmed', 'not_reached'] as const;
export const RENEGOTIATION_OUTCOMES = ['answered', 'unanswered', 'undelivered', 'session_ended', 'superseded', 'shadow'] as const;
export const DECISION_SOURCES = ['activity', 'conversation'] as const;
export const CONCEPT_FAMILIES = ['saving', 'spending', 'needs_wants', 'price_value', 'budget', 'earning', 'trade', 'sharing', 'time'] as const;
export const PROMPT_VARIANTS = ['why', 'how', 'scaffolded'] as const;
export const EXPLANATION_QUALITIES = ['concept', 'off_concept', 'filler', 'misconception', 'help', 'unanswered'] as const;
export const SELF_EXPLANATION_OUTCOMES = [
  'passed_first',
  'passed_followup',
  'explained_by_mentor',
  'misconception_corrected',
  'skipped_help',
  'unanswered',
  'undelivered',
  'superseded',
  'shadow',
] as const;
export const BOND_PROXY_ANSWERS = ['yes', 'partly', 'no'] as const;
export type BondProxyAnswer = (typeof BOND_PROXY_ANSWERS)[number];

const turns = z.number().int().min(0).max(10_000);

export const RenegotiationEventBody = z
  .object({
    observation: z.number().int().min(1).max(10),
    atTurn: turns,
    mode: z.enum(ALLIANCE_MODES),
    outcome: z.enum(RENEGOTIATION_OUTCOMES),
    improved: z.boolean().nullable(),
  })
  .strict();

/** Mirrors oracle/src/tutor/allianceController.ts `AllianceReport`. */
export const AllianceReportBody = z
  .object({
    mode: z.enum(ALLIANCE_MODES),
    continuity: z.enum(CONTINUITY_KINDS).nullable(),
    continuityMove: z.enum(CONTINUITY_MOVES),
    goalAgreement: z.enum(GOAL_AGREEMENTS),
    goalSettledAtTurn: z.number().int().min(1).max(10_000).nullable(),
    learnerTurns: turns,
    adaptationOffers: turns,
    adaptationAccepts: turns,
    adaptationDeclines: turns,
    bondSpecificTurns: turns,
    bondGenericTurns: turns,
    renegotiations: z.array(RenegotiationEventBody).max(6),
  })
  .strict()
  .refine((r) => (r.goalAgreement === 'agreed' || r.goalAgreement === 'renegotiated') === (r.goalSettledAtTurn !== null), {
    message: 'a settled goal needs the turn it settled on, and only a settled goal has one',
  })
  .refine((r) => r.adaptationAccepts + r.adaptationDeclines <= r.adaptationOffers, {
    message: 'more answers than adaptation offers',
  })
  .refine((r) => r.mode === 'act' || r.renegotiations.every((e) => e.mode === 'shadow'), {
    message: 'a shadow-mode controller renegotiates nothing',
  });
export type AllianceReport = z.infer<typeof AllianceReportBody>;

export const SelfExplanationEventBody = z
  .object({
    observation: z.number().int().min(1).max(20),
    source: z.enum(DECISION_SOURCES),
    family: z.enum(CONCEPT_FAMILIES),
    variant: z.enum(PROMPT_VARIANTS),
    mode: z.enum(ALLIANCE_MODES),
    firstQuality: z.enum(EXPLANATION_QUALITIES).nullable(),
    followupQuality: z.enum(EXPLANATION_QUALITIES).nullable(),
    outcome: z.enum(SELF_EXPLANATION_OUTCOMES),
  })
  .strict();

/** Mirrors oracle/src/tutor/selfExplanation.ts `SelfExplanationReport`. */
export const SelfExplanationReportBody = z
  .object({
    mode: z.enum(ALLIANCE_MODES),
    prompts: z.number().int().min(0).max(20),
    events: z.array(SelfExplanationEventBody).max(12),
  })
  .strict()
  .refine((r) => r.mode === 'act' || (r.prompts === 0 && r.events.every((e) => e.mode === 'shadow')), {
    message: 'a shadow-mode move prompts nothing',
  });
export type SelfExplanationReport = z.infer<typeof SelfExplanationReportBody>;

/** Every threshold here is PROPOSED, PENDING CALIBRATION (THRESHOLD-RECALIBRATION-LOG.md). */
export const ALLIANCE_THRESHOLDS = {
  /** Goal-Agreement Completion Rate counts sessions with at least this many learner turns. */
  goalTurnFloor: 3,
  /** "Near 100%": below this completion rate (with enough sessions) the metric is a defect. */
  goalCompletionTarget: 0.95,
  reportMinSessions: 50,
  /** Stage 7: a persona's bond proxy dropping more than this share below its baseline trips the switch. */
  bondDropShare: 0.15,
  /** Baseline window: answers older than the current window, back this many days. */
  bondBaselineDays: 90,
  /** Current window (days). */
  bondCurrentDays: 14,
  bondBaselineMinAnswers: 50,
  bondCurrentMinAnswers: 30,
  /** Stage 7: the most recent renegotiations judged for improvement. */
  renegotiationSample: 50,
  /** Below this improved share over the full sample, renegotiation is "no measurable improvement". */
  renegotiationImprovedFloor: 0.5,
  killSwitchCacheMs: 10 * 60_000,
  /** The bond proxy may be answered for this long after the session closed. */
  bondProxyWindowHours: 24,
} as const;

// ── 1. The close record ─────────────────────────────────────────────────────

/** Writes the per-session record and the ledgers. Best-effort after the close landed; idempotent. */
export async function recordAllianceClose(input: {
  sessionId: string;
  character: string;
  alliance: AllianceReport | undefined;
  selfExplanation: SelfExplanationReport | undefined;
}): Promise<boolean> {
  let ok = true;
  if (input.alliance !== undefined) {
    const a = input.alliance;
    const row = await serviceRest<unknown>('/tutor_session_alliance?on_conflict=session_id', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({
        session_id: input.sessionId,
        character: input.character,
        mode: a.mode,
        continuity: a.continuity,
        continuity_move: a.continuityMove,
        goal_agreement: a.goalAgreement,
        goal_settled_at_turn: a.goalSettledAtTurn,
        learner_turns: a.learnerTurns,
        adaptation_offers: a.adaptationOffers,
        adaptation_accepts: a.adaptationAccepts,
        adaptation_declines: a.adaptationDeclines,
        bond_specific_turns: a.bondSpecificTurns,
        bond_generic_turns: a.bondGenericTurns,
        self_explanation_mode: input.selfExplanation?.mode ?? null,
        self_explanation_prompts: input.selfExplanation?.prompts ?? null,
      }),
    });
    ok = ok && row !== null;
    if (a.renegotiations.length > 0) {
      const res = await serviceRest<unknown>('/tutor_alliance_renegotiation?on_conflict=session_id,observation', {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
        body: JSON.stringify(
          a.renegotiations.map((e) => ({
            session_id: input.sessionId,
            character: input.character,
            observation: e.observation,
            at_turn: e.atTurn,
            mode: e.mode,
            outcome: e.outcome,
            improved: e.improved,
          })),
        ),
      });
      ok = ok && res !== null;
    }
  }
  if (input.selfExplanation !== undefined && input.selfExplanation.events.length > 0) {
    const res = await serviceRest<unknown>('/tutor_self_explanation_event?on_conflict=session_id,observation', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(
        input.selfExplanation.events.map((e) => ({
          session_id: input.sessionId,
          character: input.character,
          observation: e.observation,
          source: e.source,
          family: e.family,
          variant: e.variant,
          mode: e.mode,
          first_quality: e.firstQuality,
          followup_quality: e.followupQuality,
          outcome: e.outcome,
        })),
      ),
    });
    ok = ok && res !== null;
  }
  return ok;
}

// ── 2. The bond proxy ───────────────────────────────────────────────────────

export interface AllianceRowForProxy {
  id: string;
  character: string;
  bond_proxy: string | null;
}

export async function getAllianceRow(sessionId: string): Promise<AllianceRowForProxy | null | undefined> {
  const rows = await serviceRest<AllianceRowForProxy[]>(
    `/tutor_session_alliance?session_id=eq.${encodeURIComponent(sessionId)}&select=id,character,bond_proxy`,
  );
  if (rows === null) return undefined;
  return rows[0] ?? null;
}

/** Writes the answer once: the `bond_proxy=is.null` filter makes a second answer a no-op. */
export async function writeBondProxy(allianceId: string, answer: BondProxyAnswer, now: Date = new Date()): Promise<'written' | 'already' | 'failed'> {
  const rows = await serviceRest<{ id: string }[]>(
    `/tutor_session_alliance?id=eq.${encodeURIComponent(allianceId)}&bond_proxy=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ bond_proxy: answer, bond_proxy_at: now.toISOString() }),
    },
  );
  if (rows === null) return 'failed';
  return rows.length > 0 ? 'written' : 'already';
}

// ── 3. The metrics ──────────────────────────────────────────────────────────

export type MetricStatus = 'ok' | 'defect' | 'insufficient_data' | 'diagnostic';

export interface AllianceSessionRow {
  character: string;
  mode: string;
  continuity: string | null;
  continuity_move: string;
  goal_agreement: string;
  learner_turns: number;
  adaptation_offers: number;
  adaptation_declines: number;
  bond_specific_turns: number;
  bond_generic_turns: number;
  bond_proxy: string | null;
  bond_proxy_at: string | null;
  created_at: string;
}

export interface RenegotiationRow {
  character: string;
  mode: string;
  outcome: string;
  improved: boolean | null;
  created_at: string;
}

export interface SelfExplanationRow {
  character: string;
  family: string;
  mode: string;
  first_quality: string | null;
  outcome: string;
}

/** Goal-Agreement Completion Rate (Appendix F §1.2): near 100% above the turn floor. */
export function summarizeGoalAgreement(rows: AllianceSessionRow[], t = ALLIANCE_THRESHOLDS): {
  eligible: number;
  agreed: number;
  rate: number | null;
  status: MetricStatus;
  outcomes: Record<string, number>;
  continuity: Record<string, { sessions: number; delivered: number }>;
} {
  const eligible = rows.filter((r) => r.learner_turns >= t.goalTurnFloor);
  const agreed = eligible.filter((r) => r.goal_agreement === 'agreed' || r.goal_agreement === 'renegotiated').length;
  const outcomes: Record<string, number> = {};
  for (const r of eligible) outcomes[r.goal_agreement] = (outcomes[r.goal_agreement] ?? 0) + 1;
  const continuity: Record<string, { sessions: number; delivered: number }> = {};
  for (const r of rows) {
    const key = r.continuity ?? 'unknown';
    const c = (continuity[key] ??= { sessions: 0, delivered: 0 });
    c.sessions += 1;
    if (r.continuity_move === 'delivered') c.delivered += 1;
  }
  const rate = eligible.length === 0 ? null : agreed / eligible.length;
  return {
    eligible: eligible.length,
    agreed,
    rate,
    status: rate === null || eligible.length < t.reportMinSessions ? 'insufficient_data' : rate < t.goalCompletionTarget ? 'defect' : 'ok',
    outcomes,
    continuity,
  };
}

/** Adaptation-Offer Renegotiation Trigger Rate (diagnostic): the pattern fired → the move reached the learner. */
export function summarizeRenegotiation(rows: RenegotiationRow[]): {
  patterns: number;
  delivered: number;
  rate: number | null;
  improved: number;
  notImproved: number;
  unknown: number;
  shadow: number;
  outcomes: Record<string, number>;
  status: MetricStatus;
} {
  const act = rows.filter((r) => r.mode === 'act');
  const opportunities = act.filter((r) => r.outcome !== 'superseded' && r.outcome !== 'session_ended');
  const delivered = opportunities.filter((r) => r.outcome === 'answered' || r.outcome === 'unanswered').length;
  const outcomes: Record<string, number> = {};
  for (const r of rows) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  return {
    patterns: opportunities.length,
    delivered,
    rate: opportunities.length === 0 ? null : delivered / opportunities.length,
    improved: act.filter((r) => r.improved === true).length,
    notImproved: act.filter((r) => r.improved === false).length,
    unknown: act.filter((r) => r.improved === null).length,
    shadow: rows.length - act.length,
    outcomes,
    status: 'diagnostic',
  };
}

const bondValue = (answer: string | null): number | null => (answer === 'yes' ? 1 : answer === 'partly' ? 0.5 : answer === 'no' ? 0 : null);

/** Alliance Bond Proxy Score per persona (diagnostic; the Stage 7 input). */
export function summarizeBondProxy(rows: AllianceSessionRow[]): Record<string, { answered: number; score: number | null; specificShare: number | null }> {
  const out: Record<string, { answered: number; score: number | null; specificShare: number | null; sum: number; specific: number; praised: number }> = {};
  for (const r of rows) {
    const p = (out[r.character] ??= { answered: 0, score: null, specificShare: null, sum: 0, specific: 0, praised: 0 });
    const v = bondValue(r.bond_proxy);
    if (v !== null) {
      p.answered += 1;
      p.sum += v;
      p.score = p.sum / p.answered;
    }
    p.specific += r.bond_specific_turns;
    p.praised += r.bond_specific_turns + r.bond_generic_turns;
    p.specificShare = p.praised === 0 ? null : p.specific / p.praised;
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, { answered: v.answered, score: v.score, specificShare: v.specificShare }]),
  );
}

/** Self-Explanation Quality-Check Pass Rate (diagnostic): % of prompts passing on the first attempt. */
export function summarizeSelfExplanation(rows: SelfExplanationRow[]): {
  prompts: number;
  firstPass: number;
  rate: number | null;
  byFamily: Record<string, { prompts: number; firstPass: number }>;
  outcomes: Record<string, number>;
  shadow: number;
  status: MetricStatus;
} {
  const answered = rows.filter((r) => r.mode === 'act' && r.first_quality !== null && r.first_quality !== 'unanswered' && r.first_quality !== 'help');
  const firstPass = answered.filter((r) => r.first_quality === 'concept').length;
  const byFamily: Record<string, { prompts: number; firstPass: number }> = {};
  for (const r of answered) {
    const f = (byFamily[r.family] ??= { prompts: 0, firstPass: 0 });
    f.prompts += 1;
    if (r.first_quality === 'concept') f.firstPass += 1;
  }
  const outcomes: Record<string, number> = {};
  for (const r of rows) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  return {
    prompts: answered.length,
    firstPass,
    rate: answered.length === 0 ? null : firstPass / answered.length,
    byFamily,
    outcomes,
    shadow: rows.filter((r) => r.mode === 'shadow').length,
    status: 'diagnostic',
  };
}

/** Disposition-Profile Completeness Rate (diagnostic): active learners with a current profile. */
export function summarizeCompleteness(activeLearners: number, currentProfiles: number): { active: number; current: number; rate: number | null; status: MetricStatus } {
  return {
    active: activeLearners,
    current: Math.min(currentProfiles, activeLearners),
    rate: activeLearners === 0 ? null : Math.min(currentProfiles, activeLearners) / activeLearners,
    status: 'diagnostic',
  };
}

// ── 4. The Stage 7 automatic rollback ───────────────────────────────────────

export const ALLIANCE_KILL_SWITCH_TRIGGERED = 'mentor.kill_switch.alliance.triggered';
export const ALLIANCE_KILL_SWITCH_RESOLVED = 'mentor.kill_switch.alliance.resolved';
export type AllianceKillSwitchCause = 'bond_proxy_drop' | 'renegotiation_without_improvement';

export interface AllianceKillSwitchVerdict {
  tripped: boolean;
  causes: AllianceKillSwitchCause[];
  /** Personas whose current bond proxy is below (1 − dropShare) × baseline. */
  droppedPersonas: { character: string; baseline: number; current: number }[];
  renegotiationImprovedShare: number | null;
}

/**
 * Pure. `bond` holds every answered bond-proxy row from the baseline start;
 * `renegotiations` the most recent act-mode renegotiations with a known
 * result (newest first).
 */
export function evaluateAllianceKillSwitch(
  bond: { character: string; bond_proxy: string | null; bond_proxy_at: string | null }[],
  renegotiations: { improved: boolean | null }[],
  now: Date,
  t = ALLIANCE_THRESHOLDS,
): AllianceKillSwitchVerdict {
  const currentStart = now.getTime() - t.bondCurrentDays * 86_400_000;
  const baselineStart = now.getTime() - t.bondBaselineDays * 86_400_000;
  const byPersona = new Map<string, { base: number[]; current: number[] }>();
  for (const row of bond) {
    const v = bondValue(row.bond_proxy);
    if (v === null || row.bond_proxy_at === null) continue;
    const at = Date.parse(row.bond_proxy_at);
    if (at < baselineStart) continue;
    const p = byPersona.get(row.character) ?? { base: [], current: [] };
    (at >= currentStart ? p.current : p.base).push(v);
    byPersona.set(row.character, p);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const droppedPersonas: AllianceKillSwitchVerdict['droppedPersonas'] = [];
  for (const [character, p] of byPersona) {
    // A thin sample is never a trip: "insufficient data" is not a defect.
    if (p.base.length < t.bondBaselineMinAnswers || p.current.length < t.bondCurrentMinAnswers) continue;
    const baseline = mean(p.base);
    const current = mean(p.current);
    if (baseline > 0 && current < baseline * (1 - t.bondDropShare)) droppedPersonas.push({ character, baseline, current });
  }
  const known = renegotiations.filter((r) => r.improved !== null).slice(0, t.renegotiationSample);
  const improvedShare = known.length < t.renegotiationSample ? null : known.filter((r) => r.improved === true).length / known.length;
  const causes: AllianceKillSwitchCause[] = [];
  if (droppedPersonas.length > 0) causes.push('bond_proxy_drop');
  if (improvedShare !== null && improvedShare < t.renegotiationImprovedFloor) causes.push('renegotiation_without_improvement');
  return { tripped: causes.length > 0, causes, droppedPersonas, renegotiationImprovedShare: improvedShare };
}

interface AuditRow {
  action: string;
  created_at: string;
  detail: Record<string, unknown> | null;
}

export interface AllianceKillSwitchState {
  mode: 'act' | 'shadow';
  trippedAt: string | null;
  causes: AllianceKillSwitchCause[];
  degraded: boolean;
}

let cache: { at: number; state: AllianceKillSwitchState } | null = null;

/** Test hook: forget the cached verdict. */
export function resetAllianceKillSwitchCache(): void {
  cache = null;
}

/**
 * The kill-switch state for a new session's context (cached per process).
 * A trip in force → shadow. Otherwise the condition is evaluated over data
 * after the latest resolution; a trip is written to `audit_logs` (personas and
 * numbers only) and holds until resolved. A FAILED read is not evidence
 * (§1.14): `act` with `degraded`, not cached.
 */
export async function getAllianceKillSwitch(now: Date = new Date(), t = ALLIANCE_THRESHOLDS): Promise<AllianceKillSwitchState> {
  if (cache !== null && now.getTime() - cache.at < t.killSwitchCacheMs) return cache.state;
  const log = await serviceRest<AuditRow[]>(
    `/audit_logs?action=in.(${ALLIANCE_KILL_SWITCH_TRIGGERED},${ALLIANCE_KILL_SWITCH_RESOLVED})&select=action,created_at,detail&order=created_at.desc&limit=1`,
  );
  if (log === null) return { mode: 'act', trippedAt: null, causes: [], degraded: true };
  const latest = log[0] ?? null;
  if (latest?.action === ALLIANCE_KILL_SWITCH_TRIGGERED) {
    const causes = Array.isArray(latest.detail?.causes) ? (latest.detail.causes as AllianceKillSwitchCause[]) : [];
    const state: AllianceKillSwitchState = { mode: 'shadow', trippedAt: latest.created_at, causes, degraded: false };
    cache = { at: now.getTime(), state };
    return state;
  }
  const baselineStart = new Date(now.getTime() - t.bondBaselineDays * 86_400_000);
  const since = latest?.action === ALLIANCE_KILL_SWITCH_RESOLVED && new Date(latest.created_at) > baselineStart ? new Date(latest.created_at) : baselineStart;
  const [bond, renegotiations] = await Promise.all([
    serviceRest<{ character: string; bond_proxy: string | null; bond_proxy_at: string | null }[]>(
      `/tutor_session_alliance?select=character,bond_proxy,bond_proxy_at&bond_proxy=not.is.null` +
        `&bond_proxy_at=gte.${since.toISOString()}&order=bond_proxy_at.desc&limit=20000`,
    ),
    serviceRest<{ improved: boolean | null }[]>(
      `/tutor_alliance_renegotiation?select=improved&mode=eq.act&improved=not.is.null` +
        `&created_at=gte.${since.toISOString()}&order=created_at.desc&limit=${t.renegotiationSample}`,
    ),
  ]);
  if (bond === null || renegotiations === null) return { mode: 'act', trippedAt: null, causes: [], degraded: true };
  const verdict = evaluateAllianceKillSwitch(bond, renegotiations, now, t);
  let state: AllianceKillSwitchState = { mode: 'act', trippedAt: null, causes: [], degraded: false };
  if (verdict.tripped) {
    const written = await insertAuditLog(null, ALLIANCE_KILL_SWITCH_TRIGGERED, 'tutor', {
      component: 'alliance_controller',
      causes: verdict.causes,
      droppedPersonas: verdict.droppedPersonas,
      renegotiationImprovedShare: verdict.renegotiationImprovedShare,
      since: since.toISOString(),
    });
    if (!written) console.warn('[tutor] alliance kill switch tripped but its audit row did NOT land');
    console.warn(`[tutor] alliance kill switch TRIPPED (${verdict.causes.join(', ')}): renegotiation and continuity run in shadow`);
    state = { mode: 'shadow', trippedAt: now.toISOString(), causes: verdict.causes, degraded: false };
  }
  cache = { at: now.getTime(), state };
  return state;
}

/** The operator's resolution of a trip (root-caused). */
export async function resolveAllianceKillSwitch(note: string): Promise<boolean> {
  resetAllianceKillSwitchCache();
  return insertAuditLog(null, ALLIANCE_KILL_SWITCH_RESOLVED, 'tutor', { component: 'alliance_controller', note: note.slice(0, 500) });
}

/** The Kill-Switch Trigger Log for the Alliance Controller (Appendix F §1.3). */
export function allianceKillSwitchLog(rows: AuditRow[]): {
  triggeredAt: string;
  causes: AllianceKillSwitchCause[];
  resolvedAt: string | null;
  resolutionHours: number | null;
}[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out: ReturnType<typeof allianceKillSwitchLog> = [];
  let open: (typeof out)[number] | null = null;
  for (const row of ordered) {
    if (row.action === ALLIANCE_KILL_SWITCH_TRIGGERED && open === null) {
      open = {
        triggeredAt: row.created_at,
        causes: Array.isArray(row.detail?.causes) ? (row.detail.causes as AllianceKillSwitchCause[]) : [],
        resolvedAt: null,
        resolutionHours: null,
      };
      out.push(open);
    } else if (row.action === ALLIANCE_KILL_SWITCH_RESOLVED && open !== null) {
      open.resolvedAt = row.created_at;
      open.resolutionHours = (Date.parse(row.created_at) - Date.parse(open.triggeredAt)) / 3_600_000;
      open = null;
    }
  }
  return out;
}
