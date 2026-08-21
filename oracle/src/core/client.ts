import { z } from 'zod';
import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';
import {
  ADAPTATIONS,
  CHARACTER_IDS,
  INTENTS,
  LOCALES,
  SkillStateSchema,
} from '../context/schema.js';

/*
 * Oracle talks to Core, and to nothing else that holds a learner's data.
 *
 * Oracle has NO database credentials, by design. Every fact about a learner
 * arrives through this file, already resolved and already scoped to one
 * person, and every write goes back the same way. That is what keeps the
 * privacy boundary auditable: there is one file to read to know everything
 * Oracle can possibly learn about a child.
 *
 * It also means Oracle cannot accidentally read another learner's row, run an
 * unscoped query, or bypass RLS — not because it is careful, but because it
 * has no connection.
 */

/** Mirrors migration 0047's tutor_sessions.close_reason CHECK constraint. */
export type CloseReason =
  | 'completed'
  | 'soft_budget'
  | 'hard_budget'
  | 'learner_left'
  | 'abandoned'
  | 'consent_revoked'
  | 'safety_stop'
  | 'error';

/** What Core hands back when Oracle opens a session it was given a token for. */
const SessionContextSchema = z
  .object({
    sessionId: z.uuid(),
    userId: z.uuid(),
    /** Resolved INSIDE Core from profiles.birth_date; the date never travels. */
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    locale: z.enum(LOCALES),
    nickname: z.string().min(1).max(24),
    character: z.enum(CHARACTER_IDS),
    companion: z.enum(CHARACTER_IDS).nullable(),
    diorama: z.string().min(1).max(64),
    intent: z.enum(INTENTS),
    adaptations: z.array(z.enum(ADAPTATIONS)),
    courseContext: z
      .object({
        courseId: z.uuid().nullable(),
        courseTitle: z.string().nullable(),
        topicId: z.uuid().nullable(),
        topicTitle: z.string().nullable(),
      })
      .nullable(),
    skillStates: z.array(SkillStateSchema),
    /** True when this learner is a minor: forces the model moderation pass. */
    isMinor: z.boolean(),
    /** Whether an active guardian voice consent exists RIGHT NOW. */
    voiceConsent: z.boolean(),
    /** Whether personalization could actually be read (§14: failure != empty). */
    intelDegraded: z.boolean(),
  })
  .strict();

export type SessionContext = z.infer<typeof SessionContextSchema>;

const Envelope = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    data: inner.nullable(),
    error: z.object({ code: z.string(), message: z.string() }).nullable(),
  });

async function coreFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const config = getConfig();
  const response = await withTimeout(
    fetch(`${config.CORE_URL}/api/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': config.CORE_INTERNAL_KEY,
        ...(init.headers ?? {}),
      },
    }),
    config.CORE_TIMEOUT_MS,
    `core ${path}`,
  );
  if (!response.ok) throw new Error(`core ${path} responded ${response.status}`);
  return response.json();
}

/**
 * Resolves everything Oracle is allowed to know about this session.
 *
 * Returns `null` on any failure, and the caller must REFUSE the socket rather
 * than proceeding with defaults. §1.14, stated for this specific case: an
 * unreadable context is not an empty context, and running a session as
 * "tier 2, no consent, no history" because Core hiccuped would silently open
 * a microphone we were never told we could open.
 */
export async function fetchSessionContext(sessionId: string): Promise<SessionContext | null> {
  try {
    const body = await coreFetch(`/tutor/internal/sessions/${encodeURIComponent(sessionId)}`);
    const parsed = Envelope(SessionContextSchema).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data;
  } catch {
    return null;
  }
}

export interface PersistTurnInput {
  sessionId: string;
  seq: number;
  speaker: 'learner' | 'tutor' | 'system';
  text: string;
  emotion?: string | null;
  action?: string | null;
  audioPath?: string | null;
  source: 'model' | 'scripted' | 'stt';
  moderation?: Record<string, unknown>;
}

/**
 * Appends one turn to the transcript.
 *
 * Best-effort by design: a transcript write that fails must not kill a live
 * lesson, because the lesson is the product and the transcript is the record
 * of it. It returns a boolean so the caller can count failures and close the
 * session if the record is systematically not being kept — a session nobody
 * can replay and no guardian can read is a different product from the one we
 * promised.
 */
export async function persistTurn(input: PersistTurnInput): Promise<boolean> {
  try {
    const body = await coreFetch('/tutor/internal/turns', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(z.object({ recorded: z.boolean() })).safeParse(body);
    return parsed.success && parsed.data.data?.recorded === true;
  } catch {
    return false;
  }
}

export interface PersistFlagInput {
  sessionId: string;
  turnSeq: number | null;
  category: string;
  severity: 'low' | 'medium' | 'high';
  handled: 'scripted_response' | 'turn_blocked' | 'session_stopped';
}

/** Records a safety flag. Guardian-visible (/ORACLE.md §5, migration 0047). */
export async function persistSafetyFlag(input: PersistFlagInput): Promise<boolean> {
  try {
    const body = await coreFetch('/tutor/internal/flags', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(z.object({ recorded: z.boolean() })).safeParse(body);
    return parsed.success && parsed.data.data?.recorded === true;
  } catch {
    return false;
  }
}

export interface CloseSessionInput {
  sessionId: string;
  closeReason: CloseReason;
  turnCount: number;
  segmentCount: number;
  costUsd: number;
}

export async function closeSession(input: CloseSessionInput): Promise<boolean> {
  try {
    const body = await coreFetch(`/tutor/internal/sessions/${encodeURIComponent(input.sessionId)}/close`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(z.object({ closed: z.boolean() })).safeParse(body);
    return parsed.success && parsed.data.data?.closed === true;
  } catch {
    return false;
  }
}

/** A client-safe segment: Core has already stripped the answer key. */
const ServedSegmentSchema = z
  .object({
    segmentId: z.uuid(),
    seq: z.number().int().nonnegative(),
    origin: z.enum(['catalog', 'bank', 'live']),
    /** The stripped Lesson Engine segment, shape-checked by the frontend. */
    segment: z.record(z.string(), z.unknown()),
    keyVerified: z.boolean(),
  })
  .strict();

/** Core could not serve from tiers 1 or 2, so tier 3 is Oracle's to author. */
const NeedsGenerationSchema = z
  .object({
    needsGeneration: z.literal(true),
    skillKey: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    locale: z.enum(LOCALES),
    difficulty: z.number().int().min(1).max(5),
    allowedTypes: z.array(z.string()),
  })
  .strict();

export type ServedSegment = z.infer<typeof ServedSegmentSchema>;
export type NeedsGeneration = z.infer<typeof NeedsGenerationSchema>;

const SegmentResponseSchema = z.union([ServedSegmentSchema, NeedsGenerationSchema]);

/** Core rejected a generated candidate, with the specific reasons. */
const RejectedSchema = z
  .object({ accepted: z.literal(false), failures: z.array(z.string()) })
  .strict();

export interface RequestSegmentInput {
  sessionId: string;
  skillKey: string;
  difficulty: number;
  framing: string;
  rationale: string;
}

/**
 * Asks Core for the next activity through the content ladder (/ORACLE.md §7).
 *
 * Core owns tiers 1 and 2 because they are database reads, and it owns the
 * VERIFICATION of tier 3 because that means re-running the real graders. What
 * comes back is either a served segment or an invitation to generate one —
 * never an error for the ordinary case of "no pack exists yet", which is the
 * state most skills are in.
 *
 * `null` means the call itself failed. The caller must say so honestly rather
 * than improvising an activity.
 */
export async function requestSegment(
  input: RequestSegmentInput,
): Promise<ServedSegment | NeedsGeneration | null> {
  try {
    const body = await coreFetch('/tutor/internal/segments', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = Envelope(SegmentResponseSchema).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data;
  } catch {
    return null;
  }
}

/**
 * Submits a generated candidate for verification and persistence.
 *
 * Oracle does not get to decide that its own output is good enough. Core runs
 * the deterministic gates and re-executes the answer key with the real
 * graders; only what survives is stored and served, and only what the key
 * re-execution confirmed can pay XP (/ORACLE.md §7.3, §8).
 */
export async function verifyGeneratedSegment(input: {
  sessionId: string;
  segment: Record<string, unknown>;
  provenance: Record<string, unknown>;
}): Promise<ServedSegment | null> {
  try {
    const body = await coreFetch('/tutor/internal/segments/verify', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const rejected = Envelope(RejectedSchema).safeParse(body);
    if (rejected.success && rejected.data.data) {
      console.warn(`[oracle] Core rejected a generated segment: ${rejected.data.data.failures.join('; ')}`);
      return null;
    }
    const parsed = Envelope(ServedSegmentSchema).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data;
  } catch {
    return null;
  }
}

/** Whether the learner's guardian consent is STILL active. Cheap, called per turn. */
export async function checkVoiceConsent(userId: string): Promise<boolean | null> {
  try {
    const body = await coreFetch(`/tutor/internal/consent/${encodeURIComponent(userId)}`);
    const parsed = Envelope(z.object({ active: z.boolean() })).safeParse(body);
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return parsed.data.data.active;
  } catch {
    return null;
  }
}
