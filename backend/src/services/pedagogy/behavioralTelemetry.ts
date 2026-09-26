/*
 * Core's half of Product C.9 (the Behavioral Telemetry Layer) and C.19 (the
 * disengagement check-in and repair-initiation move).
 *
 *   1. THE CLOSE RECORD. Oracle reports, at close, how the layer ran (act or
 *      shadow), how many learner turns it evaluated, how many it acted on, and
 *      every firing with its eight channel strengths and the check-in's
 *      outcome. Core stores the counts on `tutor_sessions` and each firing in
 *      `tutor_telemetry_firing` (migration *_mentor_behavioral_telemetry).
 *      Signal strength only: the strict body refuses any extra field, so an
 *      emotion label cannot even be sent.
 *   2. THE METRICS (Appendix F §1.2): the Default-to-Inaction Rate (high by
 *      design; the Stage 7 floor is 85%) and the Disengagement-Repair
 *      Initiation Rate (a hard 100% invariant: every fired signal produced the
 *      check-in). Pure summaries, unit-tested without a database;
 *      `npm run tutor:telemetry-report` prints them.
 *   3. THE STAGE 7 AUTOMATIC ROLLBACK (Appendix F Part 3). Core evaluates the
 *      kill-switch condition over the trailing window of act-mode sessions and
 *      sends Oracle `behavioralTelemetryMode: 'shadow'` in every new session's
 *      context while it holds: the layer keeps measuring and stops acting,
 *      which is the pre-C.9 baseline. A trip is written to `audit_logs`
 *      (the Kill-Switch Trigger Log) and HOLDS until an operator resolves it
 *      (`tutor:telemetry-report -- --resolve="…"`): a rollback is lifted by a
 *      root cause, never by the window going quiet.
 *
 * The vocabularies are HAND-MIRRORED from Oracle
 * (`oracle/src/tutor/behavioralTelemetry.ts`) and the migration's CHECKs;
 * `npm run telemetry:check` keeps them identical.
 */

import { z } from 'zod';
import { insertAuditLog, serviceRest } from '../supabaseRest.js';

/**
 * The optional session-context fields Core sends only to an Oracle that
 * announces it can parse them (`x-oracle-context-fields`). Mirrors Oracle's
 * `core/client.ts` CONTEXT_OPTIONAL_FIELDS (checked by `npm run telemetry:check`).
 */
export const CONTEXT_OPTIONAL_FIELDS = [
  'opening',
  'behavioralTelemetryMode',
  // C.7 / C.15 (S06.5): server-side only; see services/pedagogy/disposition.ts and alliance.ts.
  'dispositionProfile',
  'allianceContinuity',
  'allianceMode',
  // C.11 / C.17 (S06.10/S06.11): see services/pedagogy/spacedReview.ts and dialogueCalibration.ts.
  'spacedReviewMode',
  'dialogueCalibration',
] as const;

export const TELEMETRY_CHANNELS = [
  'latencyShift',
  'rapidResponse',
  'verbosityDrop',
  'repeatedAnswer',
  'hedging',
  'offTopic',
  'hintAbuse',
  'fastKnownMiss',
] as const;
export type TelemetryChannel = (typeof TELEMETRY_CHANNELS)[number];

/** Mirrors Oracle's REPORTED_CHECK_IN_OUTCOMES (checked by `npm run telemetry:check`). */
export const CHECK_IN_OUTCOMES = [
  'aligned',
  'misaligned',
  'unanswered',
  'undelivered',
  'session_ended',
  'superseded',
  'shadow',
] as const;
export type CheckInOutcome = (typeof CHECK_IN_OUTCOMES)[number];

export const TELEMETRY_MODES = ['act', 'shadow'] as const;
export type TelemetryMode = (typeof TELEMETRY_MODES)[number];

/** Outcomes where the check-in WAS asked (the repair was initiated). */
export const INITIATED_OUTCOMES: readonly CheckInOutcome[] = ['aligned', 'misaligned', 'unanswered'];
/** Outcomes where a Mentor turn could have carried it and did not: a real miss. */
export const MISSED_OUTCOMES: readonly CheckInOutcome[] = ['undelivered'];

const strength = z.number().min(0).max(1);

/** Mirrors oracle/src/tutor/behavioralTelemetry.ts EventSchema (reported shape). */
export const TelemetryEventBody = z
  .object({
    observation: z.number().int().min(1).max(10_000),
    latencyShift: strength,
    rapidResponse: strength,
    verbosityDrop: strength,
    repeatedAnswer: strength,
    hedging: strength,
    offTopic: strength,
    hintAbuse: strength,
    fastKnownMiss: strength,
    channels: z.number().int().min(0).max(8),
    mode: z.enum(TELEMETRY_MODES),
    outcome: z.enum(CHECK_IN_OUTCOMES),
    repairOffered: z.boolean().nullable(),
  })
  .strict();
export type TelemetryEvent = z.infer<typeof TelemetryEventBody>;

export const BehavioralTelemetryReportBody = z
  .object({
    mode: z.enum(TELEMETRY_MODES),
    evaluatedTurns: z.number().int().min(0).max(100_000),
    actionTurns: z.number().int().min(0).max(100_000),
    events: z.array(TelemetryEventBody).max(10),
  })
  .strict()
  .refine((r) => r.actionTurns <= r.evaluatedTurns, { message: 'actionTurns cannot exceed evaluatedTurns' })
  .refine((r) => r.mode === 'act' || (r.actionTurns === 0 && r.events.every((e) => e.mode === 'shadow')), {
    message: 'a shadow-mode layer takes no action',
  });
export type BehavioralTelemetryReport = z.infer<typeof BehavioralTelemetryReportBody>;

/**
 * Every threshold here is PROPOSED, PENDING CALIBRATION
 * (docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md).
 */
export const TELEMETRY_THRESHOLDS = {
  /** Appendix F Stage 7: the Default-to-Inaction floor. */
  defaultToInactionFloor: 0.85,
  /** Appendix F §1.2: the Disengagement-Repair Initiation Rate is a hard invariant. */
  repairInitiationTarget: 1,
  /** The kill-switch evaluates act-mode sessions closed in this trailing window. */
  killSwitchWindowDays: 14,
  /** Below this many evaluated turns the Default-to-Inaction Rate is insufficient data (never a trip). */
  killSwitchMinEvaluatedTurns: 300,
  /** How long one process reuses its kill-switch verdict. */
  killSwitchCacheMs: 10 * 60_000,
  /** Below this many evaluated turns the report prints "insufficient data". */
  reportMinEvaluatedTurns: 300,
} as const;

// ── 1. The close record ─────────────────────────────────────────────────────

/** The `tutor_sessions` columns a close writes (only when the layer ran). */
export function telemetryColumns(report: BehavioralTelemetryReport | undefined): Record<string, unknown> {
  if (report === undefined) return {};
  return {
    telemetry_mode: report.mode,
    telemetry_evaluated_turns: report.evaluatedTurns,
    telemetry_action_turns: report.actionTurns,
  };
}

/**
 * Writes each firing. Best-effort after the close landed: a failed write
 * costs Repair Initiation data points, never the close itself. Idempotent on
 * (session_id, observation).
 */
export async function recordTelemetryFirings(input: {
  sessionId: string;
  character: string;
  events: TelemetryEvent[];
}): Promise<boolean> {
  if (input.events.length === 0) return true;
  const res = await serviceRest<unknown>('/tutor_telemetry_firing?on_conflict=session_id,observation', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(
      input.events.map((e) => ({
        session_id: input.sessionId,
        character: input.character,
        observation: e.observation,
        latency_shift: e.latencyShift,
        rapid_response: e.rapidResponse,
        verbosity_drop: e.verbosityDrop,
        repeated_answer: e.repeatedAnswer,
        hedging: e.hedging,
        off_topic: e.offTopic,
        hint_abuse: e.hintAbuse,
        fast_known_miss: e.fastKnownMiss,
        channels: e.channels,
        mode: e.mode,
        outcome: e.outcome,
        repair_offered: e.repairOffered,
      })),
    ),
  });
  return res !== null;
}

// ── 2. The metrics ──────────────────────────────────────────────────────────

export interface TelemetrySessionRow {
  id: string;
  character: string;
  telemetry_mode: string | null;
  telemetry_evaluated_turns: number | null;
  telemetry_action_turns: number | null;
}

export interface TelemetryFiringRow {
  session_id: string | null;
  character: string;
  mode: string;
  outcome: string;
  repair_offered: boolean | null;
  latency_shift: number | string;
  rapid_response: number | string;
  verbosity_drop: number | string;
  repeated_answer: number | string;
  hedging: number | string;
  off_topic: number | string;
  hint_abuse: number | string;
  fast_known_miss: number | string;
}

export type MetricStatus = 'ok' | 'defect' | 'insufficient_data' | 'diagnostic';

export interface DefaultToInactionSummary {
  actSessions: number;
  shadowSessions: number;
  evaluatedTurns: number;
  actionTurns: number;
  /** 1 − action / evaluated over act-mode sessions. */
  rate: number | null;
  status: MetricStatus;
  byPersona: Record<string, { evaluatedTurns: number; actionTurns: number; rate: number | null }>;
}

/** Default-to-Inaction Rate (Appendix F §1.2): high by design; the Stage 7 floor is 85%. */
export function summarizeDefaultToInaction(
  sessions: TelemetrySessionRow[],
  thresholds = TELEMETRY_THRESHOLDS,
): DefaultToInactionSummary {
  const act = sessions.filter((s) => s.telemetry_mode === 'act');
  const evaluatedTurns = act.reduce((n, s) => n + (s.telemetry_evaluated_turns ?? 0), 0);
  const actionTurns = act.reduce((n, s) => n + (s.telemetry_action_turns ?? 0), 0);
  const rate = evaluatedTurns === 0 ? null : 1 - actionTurns / evaluatedTurns;
  const byPersona: DefaultToInactionSummary['byPersona'] = {};
  for (const s of act) {
    const p = (byPersona[s.character] ??= { evaluatedTurns: 0, actionTurns: 0, rate: null });
    p.evaluatedTurns += s.telemetry_evaluated_turns ?? 0;
    p.actionTurns += s.telemetry_action_turns ?? 0;
    p.rate = p.evaluatedTurns === 0 ? null : 1 - p.actionTurns / p.evaluatedTurns;
  }
  const status: MetricStatus =
    rate === null || evaluatedTurns < thresholds.reportMinEvaluatedTurns
      ? 'insufficient_data'
      : rate < thresholds.defaultToInactionFloor
        ? 'defect'
        : 'ok';
  return {
    actSessions: act.length,
    shadowSessions: sessions.filter((s) => s.telemetry_mode === 'shadow').length,
    evaluatedTurns,
    actionTurns,
    rate,
    status,
    byPersona,
  };
}

export interface RepairInitiationSummary {
  /** Act-mode firings a Mentor turn could have carried (initiated + missed). */
  opportunities: number;
  initiated: number;
  missed: number;
  rate: number | null;
  status: MetricStatus;
  outcomes: Record<string, number>;
  /** Of the "not really" answers, how many repairs carried an adaptation offer. */
  repairs: number;
  repairsWithOffer: number;
  shadowFirings: number;
  /** Mean strength per channel across act-mode firings (diagnostic: which signals drive firings). */
  meanStrength: Record<TelemetryChannel, number | null>;
}

const COLUMN: Record<TelemetryChannel, keyof TelemetryFiringRow> = {
  latencyShift: 'latency_shift',
  rapidResponse: 'rapid_response',
  verbosityDrop: 'verbosity_drop',
  repeatedAnswer: 'repeated_answer',
  hedging: 'hedging',
  offTopic: 'off_topic',
  hintAbuse: 'hint_abuse',
  fastKnownMiss: 'fast_known_miss',
};

/**
 * Disengagement-Repair Initiation Rate (Appendix F §1.2): a HARD invariant.
 * A firing superseded by a safety stop or a closing, or one whose session
 * ended before any Mentor turn could carry it, had no opportunity and is not
 * counted; ONE undelivered firing is a defect, whatever the sample.
 */
export function summarizeRepairInitiation(firings: TelemetryFiringRow[]): RepairInitiationSummary {
  const act = firings.filter((f) => f.mode === 'act');
  const initiated = act.filter((f) => (INITIATED_OUTCOMES as readonly string[]).includes(f.outcome)).length;
  const missed = act.filter((f) => (MISSED_OUTCOMES as readonly string[]).includes(f.outcome)).length;
  const opportunities = initiated + missed;
  const outcomes: Record<string, number> = {};
  for (const f of firings) outcomes[f.outcome] = (outcomes[f.outcome] ?? 0) + 1;
  const repairs = act.filter((f) => f.outcome === 'misaligned');
  const meanStrength = Object.fromEntries(
    TELEMETRY_CHANNELS.map((c) => [
      c,
      act.length === 0 ? null : act.reduce((n, f) => n + Number(f[COLUMN[c]]), 0) / act.length,
    ]),
  ) as Record<TelemetryChannel, number | null>;
  const rate = opportunities === 0 ? null : initiated / opportunities;
  return {
    opportunities,
    initiated,
    missed,
    rate,
    status: rate === null ? 'insufficient_data' : missed > 0 ? 'defect' : 'ok',
    outcomes,
    repairs: repairs.length,
    repairsWithOffer: repairs.filter((f) => f.repair_offered === true).length,
    shadowFirings: firings.filter((f) => f.mode === 'shadow').length,
    meanStrength,
  };
}

// ── 3. The Stage 7 automatic rollback ───────────────────────────────────────

export const KILL_SWITCH_TRIGGERED = 'mentor.kill_switch.behavioral_telemetry.triggered';
export const KILL_SWITCH_RESOLVED = 'mentor.kill_switch.behavioral_telemetry.resolved';

export type KillSwitchCause = 'default_to_inaction_below_floor' | 'repair_initiation_below_target';

export interface KillSwitchVerdict {
  tripped: boolean;
  causes: KillSwitchCause[];
  defaultToInaction: number | null;
  evaluatedTurns: number;
  repairInitiation: number | null;
  missedCheckIns: number;
}

/** The Stage 7 condition over one window of act-mode data (pure). */
export function evaluateKillSwitch(
  sessions: TelemetrySessionRow[],
  firings: TelemetryFiringRow[],
  thresholds = TELEMETRY_THRESHOLDS,
): KillSwitchVerdict {
  const inaction = summarizeDefaultToInaction(sessions, thresholds);
  const repair = summarizeRepairInitiation(firings);
  const causes: KillSwitchCause[] = [];
  // A thin sample never trips the floor: "insufficient data" is not a defect.
  if (
    inaction.rate !== null &&
    inaction.evaluatedTurns >= thresholds.killSwitchMinEvaluatedTurns &&
    inaction.rate < thresholds.defaultToInactionFloor
  ) {
    causes.push('default_to_inaction_below_floor');
  }
  // The hard invariant trips on ONE miss.
  if (repair.rate !== null && repair.rate < thresholds.repairInitiationTarget) causes.push('repair_initiation_below_target');
  return {
    tripped: causes.length > 0,
    causes,
    defaultToInaction: inaction.rate,
    evaluatedTurns: inaction.evaluatedTurns,
    repairInitiation: repair.rate,
    missedCheckIns: repair.missed,
  };
}

interface AuditRow {
  action: string;
  created_at: string;
  detail: Record<string, unknown> | null;
}

export interface KillSwitchState {
  /** What Core sends Oracle in the session context. */
  mode: TelemetryMode;
  /** The trip in force, if any. */
  trippedAt: string | null;
  causes: KillSwitchCause[];
  /** True when a read failed and the verdict could not be computed. */
  degraded: boolean;
}

let cache: { at: number; state: KillSwitchState } | null = null;

/** Test hook: forget the cached verdict. */
export function resetKillSwitchCache(): void {
  cache = null;
}

/**
 * The kill-switch state for a new session's context. Cached per process for
 * `killSwitchCacheMs`.
 *
 *   - A trip in force (the latest trigger/resolve row is a trigger) → shadow.
 *   - Otherwise the condition is evaluated over act-mode sessions closed in
 *     the trailing window AND after the latest resolution (old defects that
 *     were root-caused do not re-trip). A trip is written to `audit_logs`
 *     with its cause and numbers (no ids of learners, no text).
 *   - At most the 20,000 most recent sessions and firings of the window are
 *     read: past that volume the verdict is taken on the most recent sample.
 *   - A FAILED read is not evidence (§1.14): the verdict is `act` with
 *     `degraded`, and it is not cached, so the next session asks again. The
 *     rollback is a response to measured over-intervention; the operator's
 *     TUTOR_BEHAVIORAL_TELEMETRY switch remains available at any time.
 */
export async function getTelemetryKillSwitch(now: Date = new Date(), thresholds = TELEMETRY_THRESHOLDS): Promise<KillSwitchState> {
  if (cache !== null && now.getTime() - cache.at < thresholds.killSwitchCacheMs) return cache.state;

  const log = await serviceRest<AuditRow[]>(
    `/audit_logs?action=in.(${KILL_SWITCH_TRIGGERED},${KILL_SWITCH_RESOLVED})&select=action,created_at,detail&order=created_at.desc&limit=1`,
  );
  if (log === null) return { mode: 'act', trippedAt: null, causes: [], degraded: true };
  const latest = log[0] ?? null;
  if (latest?.action === KILL_SWITCH_TRIGGERED) {
    const causes = Array.isArray(latest.detail?.causes) ? (latest.detail.causes as KillSwitchCause[]) : [];
    const state: KillSwitchState = { mode: 'shadow', trippedAt: latest.created_at, causes, degraded: false };
    cache = { at: now.getTime(), state };
    return state;
  }

  const windowStart = new Date(now.getTime() - thresholds.killSwitchWindowDays * 86_400_000);
  const since =
    latest?.action === KILL_SWITCH_RESOLVED && new Date(latest.created_at) > windowStart ? new Date(latest.created_at) : windowStart;
  const [sessions, firings] = await Promise.all([
    serviceRest<TelemetrySessionRow[]>(
      `/tutor_sessions?select=id,character,telemetry_mode,telemetry_evaluated_turns,telemetry_action_turns` +
        `&telemetry_mode=eq.act&ended_at=gte.${since.toISOString()}&order=ended_at.desc&limit=20000`,
    ),
    serviceRest<TelemetryFiringRow[]>(
      `/tutor_telemetry_firing?select=session_id,character,mode,outcome,repair_offered,latency_shift,rapid_response,` +
        `verbosity_drop,repeated_answer,hedging,off_topic,hint_abuse,fast_known_miss` +
        `&mode=eq.act&created_at=gte.${since.toISOString()}&order=created_at.desc&limit=20000`,
    ),
  ]);
  if (sessions === null || firings === null) return { mode: 'act', trippedAt: null, causes: [], degraded: true };

  const verdict = evaluateKillSwitch(sessions, firings, thresholds);
  let state: KillSwitchState = { mode: 'act', trippedAt: null, causes: [], degraded: false };
  if (verdict.tripped) {
    const written = await insertAuditLog(null, KILL_SWITCH_TRIGGERED, 'tutor', {
      component: 'behavioral_telemetry',
      causes: verdict.causes,
      defaultToInaction: verdict.defaultToInaction,
      evaluatedTurns: verdict.evaluatedTurns,
      repairInitiation: verdict.repairInitiation,
      missedCheckIns: verdict.missedCheckIns,
      since: since.toISOString(),
    });
    if (!written) console.warn('[tutor] behavioral-telemetry kill switch tripped but its audit row did NOT land');
    console.warn(`[tutor] behavioral-telemetry kill switch TRIPPED (${verdict.causes.join(', ')}): the layer runs in shadow`);
    state = { mode: 'shadow', trippedAt: now.toISOString(), causes: verdict.causes, degraded: false };
  }
  cache = { at: now.getTime(), state };
  return state;
}

/** The operator's resolution of a trip (root-caused). Returns whether the row landed. */
export async function resolveKillSwitch(note: string): Promise<boolean> {
  resetKillSwitchCache();
  return insertAuditLog(null, KILL_SWITCH_RESOLVED, 'tutor', { component: 'behavioral_telemetry', note: note.slice(0, 500) });
}

export interface KillSwitchLogEntry {
  triggeredAt: string;
  causes: KillSwitchCause[];
  resolvedAt: string | null;
  /** Hours from trigger to resolution; null while unresolved. */
  resolutionHours: number | null;
}

/** The Kill-Switch Trigger Log (Appendix F §1.3): count, cause and resolution time of every trip. */
export function killSwitchLog(rows: AuditRow[]): KillSwitchLogEntry[] {
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out: KillSwitchLogEntry[] = [];
  let open: KillSwitchLogEntry | null = null;
  for (const row of ordered) {
    if (row.action === KILL_SWITCH_TRIGGERED && open === null) {
      open = {
        triggeredAt: row.created_at,
        causes: Array.isArray(row.detail?.causes) ? (row.detail.causes as KillSwitchCause[]) : [],
        resolvedAt: null,
        resolutionHours: null,
      };
      out.push(open);
    } else if (row.action === KILL_SWITCH_RESOLVED && open !== null) {
      open.resolvedAt = row.created_at;
      open.resolutionHours = (Date.parse(row.created_at) - Date.parse(open.triggeredAt)) / 3_600_000;
      open = null;
    }
  }
  return out;
}
