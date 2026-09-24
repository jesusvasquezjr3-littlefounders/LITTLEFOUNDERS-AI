import { describe, expect, it } from 'vitest';
import { LESSON_ATTEMPT_TOKEN_TTL_SECONDS, mintLessonAttemptToken, reissueLessonAttemptToken, verifyLessonAttemptToken } from './lessonAttemptToken.js';

const secret = 'this-is-a-local-test-secret-with-at-least-thirty-two-bytes';
const expected = { uid: 'user-1', vid: 'version-1', lid: 'lesson-1', loc: 'es-MX' as const, sid: 'segment-1', rid: 'run-1' };
const now = Date.parse('2026-09-22T12:00:00.000Z');

describe('v2 lesson attempt token', () => {
  it('pins one learner, immutable version, locale, segment and run with a fresh nonce', () => {
    const first = mintLessonAttemptToken(expected, secret, now);
    const second = mintLessonAttemptToken(expected, secret, now);
    expect(first.payload.jti).not.toBe(second.payload.jti);
    expect(first.payload.exp).toBe(Math.floor(now / 1000) + LESSON_ATTEMPT_TOKEN_TTL_SECONDS);
    expect(verifyLessonAttemptToken(first.token, secret, expected, now)).toMatchObject({ status: 'valid', payload: { vid: 'version-1', loc: 'es-MX' } });
  });

  it('refuses tampering, expiry and every cross-user or cross-version replay', () => {
    const { token } = mintLessonAttemptToken(expected, secret, now);
    expect(verifyLessonAttemptToken(`${token}x`, secret, expected, now)).toEqual({ status: 'invalid' });
    expect(verifyLessonAttemptToken(token, secret, expected, now + (LESSON_ATTEMPT_TOKEN_TTL_SECONDS * 1000))).toEqual({ status: 'expired' });
    expect(verifyLessonAttemptToken(token, secret, { ...expected, uid: 'user-2' }, now)).toEqual({ status: 'mismatch' });
    expect(verifyLessonAttemptToken(token, secret, { ...expected, vid: 'version-2' }, now)).toEqual({ status: 'mismatch' });
    expect(verifyLessonAttemptToken(token, secret, { ...expected, sid: 'segment-2' }, now)).toEqual({ status: 'mismatch' });
  });

  it('reissues only the same still-live stored nonce after a reload', () => {
    const first = mintLessonAttemptToken(expected, secret, now);
    const recovered = reissueLessonAttemptToken(first.payload, secret, now + 1_000);
    expect(recovered?.token).toBe(first.token);
    expect(verifyLessonAttemptToken(recovered!.token, secret, expected, now + 1_000)).toMatchObject({ status: 'valid', payload: { jti: first.payload.jti } });
    expect(reissueLessonAttemptToken(first.payload, secret, now + (LESSON_ATTEMPT_TOKEN_TTL_SECONDS * 1000))).toBeNull();
  });
});
