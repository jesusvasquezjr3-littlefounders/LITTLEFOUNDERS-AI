/*
 * Core's half of Product C.7 — the persistent learner disposition profile.
 *
 * "The mastery model answers what the learner knows; nothing answers how
 * this specific learner learns best" (C.7 Finding). This file keeps the
 * cross-session record of HOW a learner works, populated at every close from
 * what the Behavioral Telemetry Layer (C.9) and the Alliance Controller (C.15)
 * observed, and projects it for Oracle's pedagogy controller, which reads it
 * BESIDE the mastery values when selecting a strategy.
 *
 *   1. THE FOLD (`foldSession`): pure. Exponentially weighted rates (alpha
 *      0.3, proposed pending calibration) for help-seeking, disengagement,
 *      check-in misalignment and silent dropouts; the median reply pace;
 *      decayed counts (×0.9 per session) for self-explanation and adaptation
 *      history; per-persona rapport (sessions, last session, bond answers).
 *      A safety stop, a consent revocation or an error updates ONLY the
 *      persona-rapport session count: the profile must never become a
 *      secondary record of a disclosure.
 *   2. THE TRAITS (`deriveTraits`): closed, interpretable labels, `unknown`
 *      until there is enough evidence (3 behavioural sessions; 4 decayed
 *      prompts) — never an emotion, never a score.
 *   3. THE PROJECTION (`toOracleProjection`): the closed-vocabulary shape
 *      Oracle's `DispositionProfileSchema` accepts, sent in the SESSION
 *      context only when Oracle announced it can parse it. It is not a field
 *      of the sealed model context, so nothing here reaches a model.
 *   4. THE CONTINUITY DECISION (`decideContinuity`, C.15): whether this
 *      persona has worked with this learner before, from the rapport history
 *      (plus the recent session rows for learners closed before this build).
 *   5. READ / WRITE / RESET / RETENTION, service role only; RLS lets the
 *      learner and a verified guardian SELECT the row.
 *
 * Vocabularies are HAND-MIRRORED from Oracle (`tutor/dispositionProfile.ts`,
 * `tutor/allianceController.ts`) and the migration's CHECKs;
 * `npm run alliance:check` keeps them identical.
 */

import { z } from 'zod';
import { serviceRest } from '../supabaseRest.js';

export const ADAPTATIONS = ['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'] as const;
export type Adaptation = (typeof ADAPTATIONS)[number];
export const CHARACTERS = ['dina', 'liruf', 'rho', 'zara'] as const;
export const HELP_STYLES = ['independent', 'hint_seeking', 'tell_early', 'unknown'] as const;
export const PERSISTENCE = ['persists', 'disengages_early', 'unknown'] as const;
export const EXPLANATION_STYLES = ['explains', 'needs_scaffold', 'unknown'] as const;
export const DISPOSITION_EFFECTS = ['stuck_degrade_early', 'scaffolded_explanation', 'seeded_declines', 'idle_nudge_paced'] as const;
export const CONTINUITY_KINDS = ['first_meeting', 'persona_switch', 'memory_gap', 'continuing'] as const;
export type ContinuityKind = (typeof CONTINUITY_KINDS)[number];

/** Every value is PROPOSED, PENDING CALIBRATION (docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md). */
export const DISPOSITION_THRESHOLDS = {
  /** EWMA weight of the newest session. */
  alpha: 0.3,
  /** Decay of the counted histories per session. */
  decay: 0.9,
  /** Behavioural sessions before any trait leaves `unknown`. */
  minSessions: 3,
  /** tell requests per learner turn at or above which help style is `tell_early`. */
  tellEarlyRate: 0.15,
  /** hint requests per learner turn at or above which help style is `hint_seeking`. */
  hintSeekingRate: 0.25,
  /** silent-dropout share at or above which persistence is `disengages_early`. */
  leftRate: 0.4,
  /** share of sessions with a disengagement firing at or above which persistence is `disengages_early`. */
  disengagementRate: 0.5,
  /** decayed prompts before the explanation trait leaves `unknown`. */
  minPrompts: 4,
  /** first-attempt pass share below which explanations `needs_scaffold`. */
  scaffoldBelow: 0.4,
  /** decayed declines (with at most half as many acceptances) that make an adaptation persistently declined. */
  persistentDeclines: 2,
  /** A persona not seen for this long (days) re-establishes: `memory_gap`. */
  memoryGapDays: 30,
  /** A profile older than this (days) is not current (Disposition-Profile Completeness Rate). */
  currentDays: 30,
  /** A profile not updated for this long (days) is purged. */
  retentionDays: 365,
} as const;

const count = z.number().min(0).max(100_000);
export const AdaptationHistory = z.partialRecord(z.enum(ADAPTATIONS), z.object({ accepted: count, declined: count }).strict());
export const PersonaRapport = z.partialRecord(
  z.enum(CHARACTERS),
  z.object({ sessions: count, lastAt: z.string().datetime({ offset: true }).nullable(), bondYes: count, bondAnswered: count }).strict(),
);
export type AdaptationHistoryT = z.infer<typeof AdaptationHistory>;
export type PersonaRapportT = z.infer<typeof PersonaRapport>;

/** The stored row (numbers may arrive from PostgREST as strings: numeric columns). */
export interface DispositionRow {
  user_id: string;
  sessions_observed: number;
  behavior_sessions: number;
  hint_rate: number | string | null;
  tell_rate: number | string | null;
  typed_answer_ms: number | null;
  spoken_answer_ms: number | null;
  disengagement_rate: number | string | null;
  misaligned_rate: number | string | null;
  left_rate: number | string | null;
  se_prompts: number | string;
  se_first_pass: number | string;
  adaptation_history: unknown;
  persona_rapport: unknown;
  help_style: (typeof HELP_STYLES)[number];
  persistence: (typeof PERSISTENCE)[number];
  explanation: (typeof EXPLANATION_STYLES)[number];
  last_session_at: string | null;
  updated_at: string;
}

/** Oracle's `DispositionObservation` (the close body's `disposition`). */
export const DispositionObservationBody = z
  .object({
    learnerTurns: z.number().int().min(0).max(10_000),
    hintRequests: z.number().int().min(0).max(10_000),
    tellRequests: z.number().int().min(0).max(10_000),
    typedReplyMs: z.number().int().min(0).max(600_000).nullable(),
    spokenReplyMs: z.number().int().min(0).max(600_000).nullable(),
    acceptedAdaptations: z.array(z.enum(ADAPTATIONS)).max(20),
    declinedAdaptations: z.array(z.enum(ADAPTATIONS)).max(20),
    profileReceived: z.boolean(),
    applied: z.array(z.enum(DISPOSITION_EFFECTS)).max(DISPOSITION_EFFECTS.length),
  })
  .strict()
  .refine((o) => o.hintRequests + o.tellRequests <= o.learnerTurns, { message: 'more help requests than learner turns' });
export type DispositionObservation = z.infer<typeof DispositionObservationBody>;

/** Oracle's `DispositionProfileSchema`: the projection it may receive. */
export interface OracleDispositionProjection {
  sessionsObserved: number;
  helpStyle: (typeof HELP_STYLES)[number];
  persistence: (typeof PERSISTENCE)[number];
  explanation: (typeof EXPLANATION_STYLES)[number];
  persistentlyDeclined: Adaptation[];
  typicalTypedReplyMs: number | null;
  typicalSpokenReplyMs: number | null;
}

/** What else a close tells the fold (from Core's own rows and the other reports). */
export interface SessionFacts {
  character: (typeof CHARACTERS)[number];
  closeReason: string;
  endedAt: string;
  /** Whether the C.9 layer fired at least once (act or shadow). Null: the layer did not run. */
  disengagementFired: boolean | null;
  /** Whether a C.19 check-in was answered "not really". Null: no check-in was answered. */
  checkInMisaligned: boolean | null;
  /** C.14: prompts asked and how many passed on the first attempt. */
  selfExplanationPrompts: number;
  selfExplanationFirstPass: number;
}

const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const ewma = (prev: number | null, value: number, alpha: number): number => round3(prev === null ? value : prev + alpha * (value - prev));
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Sessions whose behaviour must not enter the profile (§ SAFEGUARDS in the migration). */
export const NON_BEHAVIOURAL_CLOSES = new Set(['safety_stop', 'consent_revoked', 'error']);

export function emptyProfile(userId: string, now: string): DispositionRow {
  return {
    user_id: userId,
    sessions_observed: 0,
    behavior_sessions: 0,
    hint_rate: null,
    tell_rate: null,
    typed_answer_ms: null,
    spoken_answer_ms: null,
    disengagement_rate: null,
    misaligned_rate: null,
    left_rate: null,
    se_prompts: 0,
    se_first_pass: 0,
    adaptation_history: {},
    persona_rapport: {},
    help_style: 'unknown',
    persistence: 'unknown',
    explanation: 'unknown',
    last_session_at: null,
    updated_at: now,
  };
}

function parseHistory(raw: unknown): AdaptationHistoryT {
  const parsed = AdaptationHistory.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

function parseRapport(raw: unknown): PersonaRapportT {
  const parsed = PersonaRapport.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/** Pure: the closed, interpretable traits (`unknown` until there is enough evidence). */
export function deriveTraits(row: DispositionRow, t = DISPOSITION_THRESHOLDS): Pick<DispositionRow, 'help_style' | 'persistence' | 'explanation'> {
  const enough = row.behavior_sessions >= t.minSessions;
  const tell = num(row.tell_rate) ?? 0;
  const hint = num(row.hint_rate) ?? 0;
  const left = num(row.left_rate) ?? 0;
  const disengaged = num(row.disengagement_rate) ?? 0;
  const prompts = Number(row.se_prompts);
  const passed = Number(row.se_first_pass);
  return {
    help_style: !enough ? 'unknown' : tell >= t.tellEarlyRate ? 'tell_early' : hint >= t.hintSeekingRate ? 'hint_seeking' : 'independent',
    persistence: !enough ? 'unknown' : left >= t.leftRate || disengaged >= t.disengagementRate ? 'disengages_early' : 'persists',
    explanation: prompts < t.minPrompts ? 'unknown' : passed / prompts < t.scaffoldBelow ? 'needs_scaffold' : 'explains',
  };
}

/**
 * Pure: folds one closed session into the profile. `observation` is null for
 * an older Oracle (no report): only the rapport and end-reason facts move.
 */
export function foldSession(
  prev: DispositionRow,
  observation: DispositionObservation | null,
  facts: SessionFacts,
  now: string,
  t = DISPOSITION_THRESHOLDS,
): DispositionRow {
  const next: DispositionRow = { ...prev, updated_at: now, last_session_at: facts.endedAt };
  next.sessions_observed = prev.sessions_observed + 1;

  // Persona rapport moves on EVERY close: the next persona must not be falsely "new".
  const rapport = parseRapport(prev.persona_rapport);
  const r = rapport[facts.character] ?? { sessions: 0, lastAt: null, bondYes: 0, bondAnswered: 0 };
  rapport[facts.character] = { ...r, sessions: r.sessions + 1, lastAt: facts.endedAt };
  next.persona_rapport = rapport;

  if (NON_BEHAVIOURAL_CLOSES.has(facts.closeReason)) return { ...next, ...deriveTraits(next, t) };

  next.behavior_sessions = prev.behavior_sessions + 1;
  const left = facts.closeReason === 'learner_left' || facts.closeReason === 'abandoned' ? 1 : 0;
  next.left_rate = ewma(num(prev.left_rate), left, t.alpha);
  if (facts.disengagementFired !== null) next.disengagement_rate = ewma(num(prev.disengagement_rate), facts.disengagementFired ? 1 : 0, t.alpha);
  if (facts.checkInMisaligned !== null) next.misaligned_rate = ewma(num(prev.misaligned_rate), facts.checkInMisaligned ? 1 : 0, t.alpha);

  const decayedPrompts = Number(prev.se_prompts) * t.decay + facts.selfExplanationPrompts;
  const decayedPass = Number(prev.se_first_pass) * t.decay + Math.min(facts.selfExplanationFirstPass, facts.selfExplanationPrompts);
  next.se_prompts = round3(Math.min(1000, decayedPrompts));
  next.se_first_pass = round3(Math.min(Number(next.se_prompts), decayedPass));

  if (observation !== null) {
    if (observation.learnerTurns > 0) {
      next.hint_rate = ewma(num(prev.hint_rate), clamp01(observation.hintRequests / observation.learnerTurns), t.alpha);
      next.tell_rate = ewma(num(prev.tell_rate), clamp01(observation.tellRequests / observation.learnerTurns), t.alpha);
    }
    if (observation.typedReplyMs !== null) {
      next.typed_answer_ms = Math.round(ewma(prev.typed_answer_ms, observation.typedReplyMs, t.alpha));
    }
    if (observation.spokenReplyMs !== null) {
      next.spoken_answer_ms = Math.round(ewma(prev.spoken_answer_ms, observation.spokenReplyMs, t.alpha));
    }
    const history = parseHistory(prev.adaptation_history);
    for (const key of Object.keys(history) as Adaptation[]) {
      const h = history[key]!;
      history[key] = { accepted: round3(h.accepted * t.decay), declined: round3(h.declined * t.decay) };
    }
    for (const a of observation.acceptedAdaptations) {
      const h = history[a] ?? { accepted: 0, declined: 0 };
      history[a] = { ...h, accepted: round3(h.accepted + 1) };
    }
    for (const a of observation.declinedAdaptations) {
      const h = history[a] ?? { accepted: 0, declined: 0 };
      history[a] = { ...h, declined: round3(h.declined + 1) };
    }
    next.adaptation_history = history;
  }
  return { ...next, ...deriveTraits(next, t) };
}

/** Pure: records the end-of-session bond proxy against the persona's rapport. */
export function foldBondProxy(prev: DispositionRow, character: (typeof CHARACTERS)[number], answer: 'yes' | 'partly' | 'no', now: string): DispositionRow {
  const rapport = parseRapport(prev.persona_rapport);
  const r = rapport[character] ?? { sessions: 0, lastAt: null, bondYes: 0, bondAnswered: 0 };
  rapport[character] = {
    ...r,
    bondAnswered: r.bondAnswered + 1,
    bondYes: r.bondYes + (answer === 'yes' ? 1 : answer === 'partly' ? 0.5 : 0),
  };
  return { ...prev, persona_rapport: rapport, updated_at: now };
}

/** Pure: adaptations turned down across sessions and (almost) never taken. */
export function persistentlyDeclined(row: DispositionRow, t = DISPOSITION_THRESHOLDS): Adaptation[] {
  const history = parseHistory(row.adaptation_history);
  return (Object.keys(history) as Adaptation[]).filter((a) => {
    const h = history[a]!;
    return h.declined >= t.persistentDeclines && h.accepted <= h.declined / 2;
  });
}

/** Pure: the projection Oracle's controller reads (server-side session context only). */
export function toOracleProjection(row: DispositionRow): OracleDispositionProjection {
  return {
    sessionsObserved: row.sessions_observed,
    helpStyle: row.help_style,
    persistence: row.persistence,
    explanation: row.explanation,
    persistentlyDeclined: persistentlyDeclined(row),
    typicalTypedReplyMs: row.typed_answer_ms,
    typicalSpokenReplyMs: row.spoken_answer_ms,
  };
}

/**
 * Pure (C.15): has THIS persona worked with this learner before? From the
 * persistent rapport, merged with the learner's recent closed sessions (for
 * sessions closed before this build wrote a profile).
 */
export function decideContinuity(
  row: DispositionRow | null,
  recent: { character: string; ended_at: string | null }[],
  character: (typeof CHARACTERS)[number],
  now: Date,
  t = DISPOSITION_THRESHOLDS,
): ContinuityKind {
  const rapport = row ? parseRapport(row.persona_rapport) : {};
  const seen = new Map<string, number>();
  for (const [c, r] of Object.entries(rapport)) if (r && r.sessions > 0) seen.set(c, r.lastAt ? Date.parse(r.lastAt) : 0);
  for (const s of recent) {
    if (s.ended_at === null) continue;
    const at = Date.parse(s.ended_at);
    seen.set(s.character, Math.max(seen.get(s.character) ?? 0, at));
  }
  if (seen.size === 0) return 'first_meeting';
  const last = seen.get(character);
  if (last === undefined) return 'persona_switch';
  return now.getTime() - last > t.memoryGapDays * 86_400_000 ? 'memory_gap' : 'continuing';
}

// ── IO (service role) ───────────────────────────────────────────────────────

const PROFILE_COLUMNS =
  'user_id,sessions_observed,behavior_sessions,hint_rate,tell_rate,typed_answer_ms,spoken_answer_ms,disengagement_rate,' +
  'misaligned_rate,left_rate,se_prompts,se_first_pass,adaptation_history,persona_rapport,help_style,persistence,explanation,' +
  'last_session_at,updated_at';

/** The stored profile; `null` when the learner has none; `undefined` when the read FAILED (§1.14: not the same). */
export async function getDispositionProfile(userId: string): Promise<DispositionRow | null | undefined> {
  const rows = await serviceRest<DispositionRow[]>(
    `/learner_disposition_profile?user_id=eq.${encodeURIComponent(userId)}&select=${PROFILE_COLUMNS}`,
  );
  if (rows === null) return undefined;
  return rows[0] ?? null;
}

/** Upserts the whole row. Returns whether it landed. */
export async function writeDispositionProfile(row: DispositionRow): Promise<boolean> {
  const res = await serviceRest<unknown>('/learner_disposition_profile?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
  return res !== null;
}

/**
 * Folds one close into the learner's profile. Best-effort after the close
 * landed: a failed read is NOT an empty profile, so nothing is written over
 * real history on a read failure (§1.14). One live session per learner at a
 * time (the session lock) makes a read-modify-write race improbable; the
 * worst case is one session's contribution lost, never a corrupted row.
 */
export async function recordDispositionClose(
  userId: string,
  observation: DispositionObservation | null,
  facts: SessionFacts,
  now: Date = new Date(),
): Promise<boolean> {
  const prev = await getDispositionProfile(userId);
  if (prev === undefined) return false;
  const iso = now.toISOString();
  return writeDispositionProfile(foldSession(prev ?? emptyProfile(userId, iso), observation, facts, iso));
}

export async function recordDispositionBondProxy(
  userId: string,
  character: (typeof CHARACTERS)[number],
  answer: 'yes' | 'partly' | 'no',
  now: Date = new Date(),
): Promise<boolean> {
  const prev = await getDispositionProfile(userId);
  if (prev === undefined) return false;
  const iso = now.toISOString();
  return writeDispositionProfile(foldBondProxy(prev ?? emptyProfile(userId, iso), character, answer, iso));
}

/** The learner's (or guardian's) reset. Returns whether the delete call succeeded. */
export async function deleteDispositionProfile(userId: string): Promise<boolean> {
  const res = await serviceRest<unknown>(`/learner_disposition_profile?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  return res !== null;
}

/** Retention: purges profiles not updated for `retentionDays`. Returns how many were deleted, or null on failure. */
export async function purgeStaleDispositionProfiles(now: Date = new Date(), t = DISPOSITION_THRESHOLDS): Promise<number | null> {
  const cutoff = new Date(now.getTime() - t.retentionDays * 86_400_000).toISOString();
  const rows = await serviceRest<{ user_id: string }[]>(
    `/learner_disposition_profile?updated_at=lt.${encodeURIComponent(cutoff)}`,
    { method: 'DELETE', headers: { Prefer: 'return=representation' } },
  );
  return rows === null ? null : rows.length;
}

/** The parent- and learner-readable explanation of a profile (Appendix D §2.6: interpretable). */
export function explainProfile(row: DispositionRow | null, now: Date = new Date(), t = DISPOSITION_THRESHOLDS): {
  exists: boolean;
  current: boolean;
  sessionsObserved: number;
  helpStyle: (typeof HELP_STYLES)[number];
  persistence: (typeof PERSISTENCE)[number];
  explanation: (typeof EXPLANATION_STYLES)[number];
  persistentlyDeclined: Adaptation[];
  typicalReplySeconds: number | null;
  personas: { character: string; sessions: number }[];
  effects: (typeof DISPOSITION_EFFECTS)[number][];
  updatedAt: string | null;
} {
  if (row === null) {
    return {
      exists: false,
      current: false,
      sessionsObserved: 0,
      helpStyle: 'unknown',
      persistence: 'unknown',
      explanation: 'unknown',
      persistentlyDeclined: [],
      typicalReplySeconds: null,
      personas: [],
      effects: [],
      updatedAt: null,
    };
  }
  const projection = toOracleProjection(row);
  const effects: (typeof DISPOSITION_EFFECTS)[number][] = [];
  if (projection.persistence === 'disengages_early' || projection.helpStyle === 'tell_early') effects.push('stuck_degrade_early');
  if (projection.explanation === 'needs_scaffold') effects.push('scaffolded_explanation');
  if (projection.persistentlyDeclined.length > 0) effects.push('seeded_declines');
  const pace = Math.max(projection.typicalTypedReplyMs ?? 0, projection.typicalSpokenReplyMs ?? 0);
  if (pace > 0) effects.push('idle_nudge_paced');
  const rapport = parseRapport(row.persona_rapport);
  return {
    exists: true,
    current: now.getTime() - Date.parse(row.updated_at) <= t.currentDays * 86_400_000,
    sessionsObserved: row.sessions_observed,
    helpStyle: row.help_style,
    persistence: row.persistence,
    explanation: row.explanation,
    persistentlyDeclined: projection.persistentlyDeclined,
    typicalReplySeconds: pace > 0 ? Math.round(pace / 1000) : null,
    personas: Object.entries(rapport).map(([character, r]) => ({ character, sessions: r?.sessions ?? 0 })),
    effects,
    updatedAt: row.updated_at,
  };
}

/** The learner's recent closed sessions' personas (for learners closed before this build wrote a profile). */
export async function listRecentPersonaSessions(
  userId: string,
  excludeSessionId: string,
): Promise<{ character: string; ended_at: string | null }[] | null> {
  return serviceRest<{ character: string; ended_at: string | null }[]>(
    `/tutor_sessions?user_id=eq.${encodeURIComponent(userId)}&id=neq.${encodeURIComponent(excludeSessionId)}` +
      `&ended_at=not.is.null&select=character,ended_at&order=ended_at.desc&limit=50`,
  );
}
