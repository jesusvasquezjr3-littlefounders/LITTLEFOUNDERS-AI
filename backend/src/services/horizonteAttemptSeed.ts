import crypto from 'crypto';
import { LESSON_ATTEMPT_TOKEN_TTL_SECONDS, type LessonAttemptTokenPayload } from './lessonAttemptToken.js';

/*
 * F3.0: the seed of a seeded Horizonte run. It is a pure function of the verified attempt token, so it needs no table:
 * a resume re-signs the same nonce and so yields the same seed, a miss mints a new nonce and so a new seed, and the nonce
 * is burned by the grade exactly as for every other segment. Server only: the HMAC stays out of the browser tree.
 */
const SEED_DOMAIN = 'littlefounders.horizonte.attempt-seed.v1';

type SeedInput = Pick<LessonAttemptTokenPayload, 'lid' | 'sid' | 'uid' | 'jti' | 'exp'>;

/** A subkey of the attempt secret, so a token signature can never be replayed as a seed or the reverse. */
function seedKey(secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update(SEED_DOMAIN).digest();
}

const field = (value: string | number): string => `${String(value).length}:${String(value)}`;

/** 64 lowercase hex characters: HMAC-SHA256(subkey, lesson, segment, learner, nonce, issue time), each field length prefixed. */
export function deriveAttemptSeed(input: SeedInput, secret: string): string {
  const issuedAt = input.exp - LESSON_ATTEMPT_TOKEN_TTL_SECONDS;
  return crypto.createHmac('sha256', seedKey(secret)).update([input.lid, input.sid, input.uid, input.jti, issuedAt].map(field).join('|')).digest('hex');
}
