/*
 * Core's half of Product C.16 (end-reason-specific closing scripts) and
 * C.8/C.12 (the behavioral-signature session-end signal).
 *
 *   1. The CLOSE RECORD. Oracle reports, at close, which closing script it
 *      used, which opening the session began with, and the signal's record.
 *      Core stores the script and opening on `tutor_sessions` and each firing
 *      in `tutor_session_end_signal` (migration *_mentor_session_end_and_closing).
 *   2. THE QUEUED RE-ENGAGEMENT. A silent dropout or a budget interruption
 *      queues a short, no-blame message for the learner's return (Appendix D
 *      §3.5). Core decides it from its OWN rows when the next session's
 *      context is built (`decideOpening`), so nothing about it depends on the
 *      client or on transcript text.
 *   3. THE METRICS (Appendix F §1.1–1.2): Session-Closing Script Accuracy
 *      (target 100%) and the Early-Warning Signal Trigger Rate (diagnostic:
 *      share of evaluated sessions that fired before the hard cap, and the
 *      precision of those firings). Pure summaries, unit-tested without a
 *      database; `npm run tutor:session-end-report` prints them.
 *
 * The vocabularies and the reason → script table are HAND-MIRRORED from
 * Oracle (`oracle/src/tutor/sessionClosing.ts`, `sessionEndSignal.ts`) and
 * the migration's CHECKs; `npm run session-end:check` keeps them identical.
 */

import { z } from 'zod';
import { serviceRest } from '../supabaseRest.js';

export const CLOSING_SCRIPTS = ['completed', 'interrupted', 'learner_left', 'safety_stop'] as const;
export type ClosingScript = (typeof CLOSING_SCRIPTS)[number];

export const SESSION_OPENINGS = [
  'greeting',
  'reengage_left_resume',
  'reengage_left_fresh',
  'reengage_interrupted_resume',
  'reengage_interrupted_fresh',
] as const;
export type SessionOpening = (typeof SESSION_OPENINGS)[number];

export const CLOSE_REASONS = [
  'completed',
  'soft_budget',
  'hard_budget',
  'learner_left',
  'abandoned',
  'consent_revoked',
  'safety_stop',
  'error',
] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

/** Mirrors oracle/src/tutor/sessionClosing.ts CLOSING_SCRIPT_FOR_REASON (checked by `npm run session-end:check`). */
export const CLOSING_SCRIPT_FOR_REASON: Record<CloseReason, ClosingScript> = {
  completed: 'completed',
  soft_budget: 'completed',
  hard_budget: 'interrupted',
  error: 'interrupted',
  consent_revoked: 'interrupted',
  learner_left: 'learner_left',
  abandoned: 'learner_left',
  safety_stop: 'safety_stop',
};

/** Outcomes a REPORTED firing can carry (Oracle's `pending` is reported as `unanswered`). */
export const SIGNAL_OUTCOMES = ['accepted', 'declined', 'unanswered', 'not_offered'] as const;
export const SIGNAL_MODES = ['offer', 'shadow'] as const;

/** Mirrors oracle/src/tutor/sessionEndSignal.ts EventSchema (checked by `npm run session-end:check`). */
export const SessionEndEventBody = z
  .object({
    observation: z.number().int().min(1).max(10_000),
    elapsedMs: z.number().int().min(0).max(2_147_483_647),
    remainingMs: z.number().int().min(0).max(2_147_483_647),
    latencySdBaseline: z.number().min(0).max(999),
    latencySdWindow: z.number().min(0).max(999),
    surpriseRateBaseline: z.number().min(0).max(1),
    surpriseRateWindow: z.number().min(0).max(1),
    mode: z.enum(['offer', 'shadow']),
    outcome: z.enum(['accepted', 'declined', 'unanswered', 'not_offered']),
    confirmed: z.boolean().nullable(),
  })
  .strict();
export type SessionEndEvent = z.infer<typeof SessionEndEventBody>;

export const SessionEndReportBody = z
  .object({
    evaluated: z.boolean(),
    events: z.array(SessionEndEventBody).max(10),
  })
  .strict();
export type SessionEndReport = z.infer<typeof SessionEndReportBody>;

// ── 2. The queued re-engagement ─────────────────────────────────────────────

/** The learner's previous closed session, as `decideOpening` needs it. */
export interface PreviousCloseRow {
  close_reason: string | null;
  ended_at: string | null;
  intent: string | null;
  course_id: string | null;
  topic_id: string | null;
  skill_key: string | null;
}

/** What the session being opened is about. */
export interface OpeningTarget {
  course_id: string | null;
  topic_id: string | null;
  skill_key: string | null;
}

export const SESSION_END_THRESHOLDS = {
  /**
   * A re-engagement message is queued for the learner's NEXT session only
   * when it starts within this many days of the dropout. Past it, "last time
   * we stopped partway" names a moment the learner no longer remembers, and
   * the character's own greeting is the kinder opening. Proposed, pending
   * calibration (Threshold Recalibration Log).
   */
  reengagementMaxAgeDays: 30,
  /** Session-Closing Script Accuracy target (Appendix F §1.2): 100%. */
  closingScriptAccuracyTarget: 1,
  /** Below this many evaluated sessions the trigger rate is insufficient data. */
  triggerRateMinSessions: 50,
  /** Below this many labelled firings the precision is insufficient data. */
  precisionMinFirings: 20,
} as const;

/**
 * C.16: the opening a new session begins with, from the learner's previous
 * CLOSED session (Core's own row, never the client's word).
 *
 *   hard_budget                       → reengage_interrupted_*  ("time ran out")
 *   learner_left / abandoned / error  → reengage_left_*         ("we stopped partway")
 *   anything else, or nothing known   → greeting
 *
 * `_resume` when the new session opens the same ground (skill, topic or
 * course), `_fresh` when the learner chose something else. A consent
 * revocation or a safety stop never queues a cheerful "welcome back" line.
 */
export function decideOpening(
  previous: PreviousCloseRow | null,
  current: OpeningTarget,
  now: Date = new Date(),
  thresholds = SESSION_END_THRESHOLDS,
): SessionOpening {
  if (!previous?.ended_at || !previous.close_reason) return 'greeting';
  const ageDays = (now.getTime() - new Date(previous.ended_at).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > thresholds.reengagementMaxAgeDays) return 'greeting';
  const kind =
    previous.close_reason === 'hard_budget'
      ? 'interrupted'
      : ['learner_left', 'abandoned', 'error'].includes(previous.close_reason)
        ? 'left'
        : null;
  if (kind === null) return 'greeting';
  const same =
    (current.skill_key !== null && current.skill_key === previous.skill_key) ||
    (current.topic_id !== null && current.topic_id === previous.topic_id) ||
    (current.course_id !== null && current.course_id === previous.course_id);
  return `reengage_${kind}_${same ? 'resume' : 'fresh'}`;
}

const eu = (val: string) => encodeURIComponent(z.string().uuid().parse(val));

/**
 * The learner's most recent CLOSED session other than this one. `null` when
 * there is none; `undefined` when the read FAILED (§1.14: a failed read is
 * not an empty one — the caller then opens with the plain greeting).
 */
export async function getPreviousClosedSession(
  userId: string,
  excludeSessionId: string,
): Promise<PreviousCloseRow | null | undefined> {
  const rows = await serviceRest<PreviousCloseRow[]>(
    `/tutor_sessions?user_id=eq.${eu(userId)}&id=neq.${eu(excludeSessionId)}&ended_at=not.is.null` +
      `&select=close_reason,ended_at,intent,course_id,topic_id,skill_key&order=ended_at.desc&limit=1`,
  );
  if (rows === null) return undefined;
  return rows[0] ?? null;
}

// ── 1. The close record ─────────────────────────────────────────────────────

/**
 * Writes each firing of the session-end signal. Best-effort after the close
 * landed: a failed write costs data points on the Trigger Rate, never the
 * close itself. Idempotent on (session_id, observation).
 */
export async function recordSessionEndSignal(input: {
  sessionId: string;
  character: string;
  events: SessionEndEvent[];
}): Promise<boolean> {
  if (input.events.length === 0) return true;
  const res = await serviceRest<unknown>('/tutor_session_end_signal?on_conflict=session_id,observation', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(
      input.events.map((e) => ({
        session_id: input.sessionId,
        character: input.character,
        observation: e.observation,
        elapsed_ms: e.elapsedMs,
        remaining_ms: e.remainingMs,
        latency_sd_baseline: e.latencySdBaseline,
        latency_sd_window: e.latencySdWindow,
        surprise_rate_baseline: e.surpriseRateBaseline,
        surprise_rate_window: e.surpriseRateWindow,
        mode: e.mode,
        outcome: e.outcome,
        confirmed: e.confirmed,
      })),
    ),
  });
  return res !== null;
}

// ── 3. The metrics ──────────────────────────────────────────────────────────

export interface ClosedSessionRow {
  id: string;
  character: string;
  close_reason: string | null;
  closing_script: string | null;
  opening: string | null;
  end_signal_evaluated: boolean | null;
}

export interface SignalEventRow {
  session_id: string | null;
  character: string;
  remaining_ms: number;
  mode: string;
  outcome: string;
  confirmed: boolean | null;
}

export type MetricStatus = 'ok' | 'defect' | 'insufficient_data' | 'diagnostic';

export interface ClosingAccuracySummary {
  /** Sessions closed with a recorded closing script (built after C.16). */
  recorded: number;
  correct: number;
  accuracy: number | null;
  status: MetricStatus;
  /** Wrong-script sessions, for review. */
  mismatches: { sessionId: string; closeReason: string; closingScript: string }[];
  /** How often each re-engagement opening was delivered. */
  openings: Record<string, number>;
  defects: string[];
}

/** Session-Closing Script Accuracy (Appendix F §1.2, target 100%). */
export function summarizeClosingAccuracy(rows: ClosedSessionRow[]): ClosingAccuracySummary {
  const recorded = rows.filter((r) => r.closing_script !== null && r.close_reason !== null);
  const mismatches = recorded
    .filter((r) => CLOSING_SCRIPT_FOR_REASON[r.close_reason as CloseReason] !== r.closing_script)
    .map((r) => ({ sessionId: r.id, closeReason: r.close_reason!, closingScript: r.closing_script! }));
  const openings: Record<string, number> = {};
  for (const r of rows) if (r.opening) openings[r.opening] = (openings[r.opening] ?? 0) + 1;
  const accuracy = recorded.length === 0 ? null : (recorded.length - mismatches.length) / recorded.length;
  // A hard invariant, like corroboration compliance: ONE wrong script is a
  // defect, whatever the sample size. Zero rows is "insufficient data".
  const status: MetricStatus =
    accuracy === null ? 'insufficient_data' : accuracy < SESSION_END_THRESHOLDS.closingScriptAccuracyTarget ? 'defect' : 'ok';
  return {
    recorded: recorded.length,
    correct: recorded.length - mismatches.length,
    accuracy,
    status,
    mismatches,
    openings,
    defects:
      status === 'defect'
        ? [`session-closing script accuracy ${(accuracy! * 100).toFixed(1)}% (${mismatches.length} wrong script(s)) — target 100%`]
        : [],
  };
}

export interface TriggerRateSummary {
  evaluatedSessions: number;
  firedSessions: number;
  /** Share of evaluated sessions where the signal fired before the hard cap. */
  triggerRate: number | null;
  triggerStatus: MetricStatus;
  labelledFirings: number;
  confirmedFirings: number;
  /** Fraction of labelled firings that later evidence (or the learner) confirmed. */
  precision: number | null;
  precisionStatus: MetricStatus;
  offers: Record<string, number>;
  shadowFirings: number;
  byPersona: Record<string, { evaluated: number; fired: number }>;
}

/**
 * Early-Warning Signal Trigger Rate (Appendix F §1.1). DIAGNOSTIC — no fixed
 * target: it establishes a baseline and is watched for its trend toward high
 * precision, so it never produces a defect on its own.
 */
export function summarizeTriggerRate(sessions: ClosedSessionRow[], events: SignalEventRow[]): TriggerRateSummary {
  const evaluated = sessions.filter((s) => s.end_signal_evaluated === true);
  const evaluatedIds = new Set(evaluated.map((s) => s.id));
  const beforeCap = events.filter((e) => e.session_id !== null && evaluatedIds.has(e.session_id) && e.remaining_ms > 0);
  const firedIds = new Set(beforeCap.map((e) => e.session_id));
  const labelled = events.filter((e) => e.confirmed !== null);
  const confirmed = labelled.filter((e) => e.confirmed === true);
  const offers: Record<string, number> = {};
  for (const e of events) if (e.mode === 'offer') offers[e.outcome] = (offers[e.outcome] ?? 0) + 1;
  const byPersona: Record<string, { evaluated: number; fired: number }> = {};
  for (const s of evaluated) {
    const p = (byPersona[s.character] ??= { evaluated: 0, fired: 0 });
    p.evaluated += 1;
    if (firedIds.has(s.id)) p.fired += 1;
  }
  const triggerRate = evaluated.length === 0 ? null : firedIds.size / evaluated.length;
  const precision = labelled.length === 0 ? null : confirmed.length / labelled.length;
  return {
    evaluatedSessions: evaluated.length,
    firedSessions: firedIds.size,
    triggerRate,
    triggerStatus: evaluated.length < SESSION_END_THRESHOLDS.triggerRateMinSessions ? 'insufficient_data' : 'diagnostic',
    labelledFirings: labelled.length,
    confirmedFirings: confirmed.length,
    precision,
    precisionStatus: labelled.length < SESSION_END_THRESHOLDS.precisionMinFirings ? 'insufficient_data' : 'diagnostic',
    offers,
    shadowFirings: events.filter((e) => e.mode === 'shadow').length,
    byPersona,
  };
}
