import { afterEach, describe, expect, it } from 'vitest';
import { getConfig, resetConfigForTests } from '../config.js';

/*
 * Found live, testing as a real logged-in kid account in the browser,
 * 2026-08-30 (HIGH): TUTOR_SESSION_SECRET used to default to
 * 'replace-me-with-a-64-char-random-string-0000' — a value checked into
 * this repository's own git history — while oracle/src/env.ts requires the
 * SAME shared secret with no default at all. With backend/.env genuinely
 * missing this var (reproduced directly, not hypothetically), Core silently
 * signed every Tutor session token with the public placeholder while Oracle
 * verified against its own real secret, and every websocket handshake
 * failed — the entire Tutor product broken, silently, with no error at
 * boot. A shared authentication secret must fail CLOSED (refuse to boot)
 * like every other required secret in this file, never default to a value
 * anyone reading the source already knows.
 */
describe('TUTOR_SESSION_SECRET has no insecure default', () => {
  const ORIGINAL = process.env.TUTOR_SESSION_SECRET;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TUTOR_SESSION_SECRET;
    else process.env.TUTOR_SESSION_SECRET = ORIGINAL;
    resetConfigForTests();
  });

  it('refuses to boot when the var is missing, rather than defaulting to a known placeholder', () => {
    delete process.env.TUTOR_SESSION_SECRET;
    resetConfigForTests();
    expect(() => getConfig()).toThrow();
  });

  it('never silently becomes the old placeholder value even by accident', () => {
    process.env.TUTOR_SESSION_SECRET = 'test-secret-that-is-at-least-32-chars-long';
    resetConfigForTests();
    expect(getConfig().TUTOR_SESSION_SECRET).not.toBe('replace-me-with-a-64-char-random-string-0000');
    expect(getConfig().TUTOR_SESSION_SECRET).toBe('test-secret-that-is-at-least-32-chars-long');
  });
});

describe('LESSON_ATTEMPT_SECRET has no insecure fallback', () => {
  const ORIGINAL = process.env.LESSON_ATTEMPT_SECRET;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.LESSON_ATTEMPT_SECRET;
    else process.env.LESSON_ATTEMPT_SECRET = ORIGINAL;
    resetConfigForTests();
  });

  it('leaves the inactive v2 path unconfigured instead of minting with a known secret', () => {
    delete process.env.LESSON_ATTEMPT_SECRET;
    resetConfigForTests();
    expect(getConfig().LESSON_ATTEMPT_SECRET).toBeUndefined();
  });

  it('accepts only an operator-supplied secret for the v2 attempt path', () => {
    process.env.LESSON_ATTEMPT_SECRET = 'test-lesson-attempt-secret-0123456789abcd';
    resetConfigForTests();
    expect(getConfig().LESSON_ATTEMPT_SECRET).toBe('test-lesson-attempt-secret-0123456789abcd');
  });

  it('refuses the checked-in example placeholder if it is copied unchanged', () => {
    process.env.LESSON_ATTEMPT_SECRET = 'replace-me-with-a-separate-64-char-random-string-0000';
    resetConfigForTests();
    expect(() => getConfig()).toThrow();
  });
});
