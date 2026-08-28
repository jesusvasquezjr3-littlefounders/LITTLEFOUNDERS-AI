import crypto from 'crypto';
import { z } from 'zod';
import { getConfig } from '../env.js';

/*
 * The grade echo (/ORACLE.md, Tutor v3).
 *
 * Core grades an activity, updates the learner's mastery, and hands the
 * CLIENT a signed receipt: `{segmentId, kcId, correct, misconceptionCode}`
 * under the shared TUTOR_SESSION_SECRET. The client relays it inside its
 * `segment_graded` frame, and THIS verification is what lets Oracle feed the
 * pedagogy event to its strategy controller.
 *
 * Why it exists: the score in `segment_graded` is client-reported (it echoes
 * Core's own verdict, and `servedSegmentSkills` already pins the id). That
 * was tolerable when the score only colored a reaction line; it is not
 * tolerable once the event STEERS a strategy machine — a fabricated
 * misconception would put words about the learner's thinking into the model's
 * mouth. With the signature, the pedagogy event is exactly as trustworthy as
 * Core's grade, because it IS Core's grade.
 *
 * FORMAT IS DUPLICATED with backend/src/services/pedagogy/recordAttempt.ts
 * (`signGradeEcho`), the same deliberate choice as the session token: no
 * shared package exists (§1.2 no-workspaces), so a parity test pins the wire
 * format on both sides instead.
 */

const ECHO_PREFIX = 'ge1';

const EchoPayloadSchema = z
  .object({
    segmentId: z.string().min(1).max(64),
    kcId: z.uuid(),
    correct: z.boolean(),
    misconceptionCode: z.string().min(1).max(96).nullable(),
    /** Unix seconds. */
    exp: z.number().int().positive(),
  })
  .strict();

export type GradeEchoPayload = z.infer<typeof EchoPayloadSchema>;

export type EchoVerdict =
  | { ok: true; payload: GradeEchoPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

/** Test-side mint, so parity is pinned against the same vectors Core signs. */
export function mintGradeEcho(payload: GradeEchoPayload, secret: string): string {
  const body = `${ECHO_PREFIX}.${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
  return `${body}.${sign(body, secret)}`;
}

export function verifyGradeEcho(token: string, nowMs = Date.now()): EchoVerdict {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== ECHO_PREFIX) return { ok: false, reason: 'malformed' };
  const body = `${parts[0]}.${parts[1]}`;

  const expected = sign(body, getConfig().TUTOR_SESSION_SECRET);
  const a = Buffer.from(crypto.createHash('sha256').update(parts[2] ?? '').digest());
  const b = Buffer.from(crypto.createHash('sha256').update(expected).digest());
  // Constant-time on fixed-width digests (§1.14) — never a length pre-check.
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' };

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const parsed = EchoPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: 'malformed' };
  if (parsed.data.exp * 1000 <= nowMs) return { ok: false, reason: 'expired' };
  return { ok: true, payload: parsed.data };
}
