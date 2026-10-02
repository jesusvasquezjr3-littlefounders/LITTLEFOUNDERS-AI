import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { deriveAttemptSeed } from '../../services/horizonteAttemptSeed.js';
import { LESSON_ATTEMPT_TOKEN_TTL_SECONDS, mintLessonAttemptToken, verifyLessonAttemptToken } from '../../services/lessonAttemptToken.js';
import { createPrng } from '../../services/horizonte/seed/prng.js';
import { SAMPLE_ATTEMPT, SEEDED_RUN_CAPABILITY, isAttemptSeed, isSeededCapabilitySet, seedsEqual } from '../../services/horizonte/seed/protocol.js';

const ZERO = '0'.repeat(64);
const AAAA = 'a'.repeat(64);
const COUNTING = '0123456789abcdef'.repeat(4);

/** Golden vectors: the first eight words of the stream. Changing them breaks every attempt in flight and every replay. */
const GOLDEN: ReadonlyArray<readonly [string, readonly number[]]> = [
  [ZERO, [2257891190, 1798902692, 553019340, 2452284784, 3213142421, 717844172, 3095056369, 808003402]],
  [AAAA, [3312501913, 1270631667, 1133144255, 2413115877, 1396942164, 3483464280, 769465510, 1985839718]],
  [COUNTING, [600874686, 435836432, 3215684350, 1406915500, 3491499950, 1253854194, 3190059209, 2794193666]],
];
const GOLDEN_BELOW_6 = [0, 2, 4, 4, 2, 0, 5, 2, 2, 5, 5, 0];

/** An independent sfc32 with seed absorption on BigInt, written from the algorithm and not from prng.ts. */
function reference(seed: string, count: number): number[] {
  const M = 0xffffffffn;
  const state: bigint[] = [0x9e3779b9n, 0x243f6a88n, 0xb7e15162n, 1n];
  const step = (): bigint => {
    const [a, b, c, d] = state as [bigint, bigint, bigint, bigint];
    const t = (a + b + d) & M;
    state[3] = (d + 1n) & M;
    state[0] = b ^ (b >> 9n);
    state[1] = (c + ((c << 3n) & M)) & M;
    state[2] = ((((c << 21n) & M) | (c >> 11n)) + t) & M;
    return t;
  };
  for (let index = 0; index < 8; index += 1) {
    state[index % 4] = state[index % 4]! ^ BigInt(`0x${seed.slice(index * 8, index * 8 + 8)}`);
    step();
  }
  for (let index = 0; index < 12; index += 1) step();
  return Array.from({ length: count }, () => Number(step()));
}

describe('F3.0 seeded run protocol: the shared PRNG', () => {
  it('reproduces the golden vectors', () => {
    for (const [seed, words] of GOLDEN) {
      const prng = createPrng(seed);
      expect(Array.from({ length: words.length }, () => prng.next())).toEqual(words);
    }
    const prng = createPrng(COUNTING);
    expect(Array.from({ length: GOLDEN_BELOW_6.length }, () => prng.below(6))).toEqual(GOLDEN_BELOW_6);
  });

  it('agrees with an independent BigInt implementation over a long stream', () => {
    const seeds = [ZERO, AAAA, COUNTING, crypto.createHash('sha256').update('a').digest('hex'), crypto.createHash('sha256').update('b').digest('hex')];
    for (const seed of seeds) {
      const prng = createPrng(seed);
      expect(Array.from({ length: 2000 }, () => prng.next())).toEqual(reference(seed, 2000));
    }
  });

  it('gives every seed its own stream and the same seed the same stream', () => {
    const first = (seed: string) => { const prng = createPrng(seed); return Array.from({ length: 4 }, () => prng.next()).join(','); };
    expect(first(ZERO)).toBe(first(ZERO));
    expect(new Set(GOLDEN.map(([seed]) => first(seed))).size).toBe(GOLDEN.length);
    expect(first(`${ZERO.slice(0, 63)}1`)).not.toBe(first(ZERO));
    expect(first(`1${ZERO.slice(1)}`)).not.toBe(first(ZERO));
  });

  it('draws unbiased integers inside the bound and refuses a bad bound or seed', () => {
    const prng = createPrng(COUNTING);
    const counts = new Array<number>(6).fill(0);
    for (let index = 0; index < 60000; index += 1) {
      const value = prng.below(6);
      expect(Number.isInteger(value) && value >= 0 && value < 6).toBe(true);
      counts[value]! += 1;
    }
    for (const count of counts) expect(Math.abs(count - 10000)).toBeLessThan(500);
    expect(createPrng(ZERO).below(1)).toBe(0);
    for (const bad of [0, -1, 1.5, Number.NaN, 4294967297]) expect(() => createPrng(ZERO).below(bad)).toThrow();
    for (const bad of ['', 'x', ZERO.slice(1), `${ZERO}0`, 'A'.repeat(64), 'g'.repeat(64)]) expect(() => createPrng(bad)).toThrow();
  });

  it('stays inside a bound that does not divide 2^32 (the rejection path)', () => {
    const prng = createPrng(AAAA);
    const bound = 3_000_000_000;
    for (let index = 0; index < 4000; index += 1) {
      const value = prng.below(bound);
      expect(value >= 0 && value < bound).toBe(true);
    }
  });
});

describe('F3.0 seeded run protocol: the attempt seed', () => {
  const secret = 'seed-test-secret-0123456789abcdef0123456789abcdef';
  const base = { vid: 'ver-1', uid: '11111111-1111-4111-8111-111111111111', lid: 'lesson-1', loc: 'en-US' as const, sid: 'seg-sim', rid: 'run-1' };
  const NOW = 1_800_000_000_000;

  it('is 64 lowercase hex characters and the same for the same token', () => {
    const { payload } = mintLessonAttemptToken(base, secret, NOW);
    const seed = deriveAttemptSeed(payload, secret);
    expect(isAttemptSeed(seed)).toBe(true);
    expect(deriveAttemptSeed({ ...payload }, secret)).toBe(seed);
  });

  it('survives a resume (same nonce, same expiry) and changes with every input', () => {
    const { payload } = mintLessonAttemptToken(base, secret, NOW);
    const seed = deriveAttemptSeed(payload, secret);
    const seen = new Set([seed]);
    const changes = [{ lid: 'lesson-2' }, { sid: 'seg-other' }, { uid: '22222222-2222-4222-8222-222222222222' }, { jti: `${payload.jti.slice(1)}x` }, { exp: payload.exp + 1 }];
    for (const changed of changes) {
      const other = deriveAttemptSeed({ ...payload, ...changed }, secret);
      expect(isAttemptSeed(other)).toBe(true);
      seen.add(other);
    }
    expect(seen.size).toBe(changes.length + 1);
    expect(deriveAttemptSeed(payload, `${secret}!`)).not.toBe(seed);
  });

  it('gives each attempt its own seed, a retry included', () => {
    const first = mintLessonAttemptToken(base, secret, NOW).payload;
    const retry = mintLessonAttemptToken(base, secret, NOW).payload;
    expect(first.jti).not.toBe(retry.jti);
    expect(deriveAttemptSeed(first, secret)).not.toBe(deriveAttemptSeed(retry, secret));
  });

  it('cannot be confused across field boundaries', () => {
    const { payload } = mintLessonAttemptToken(base, secret, NOW);
    expect(deriveAttemptSeed({ ...payload, lid: 'ab', sid: 'c' }, secret)).not.toBe(deriveAttemptSeed({ ...payload, lid: 'a', sid: 'bc' }, secret));
  });

  it('is a separate key from the token signature and from a bare HMAC of the same fields', () => {
    const { token, payload } = mintLessonAttemptToken(base, secret, NOW);
    const seed = deriveAttemptSeed(payload, secret);
    expect(Buffer.from(token.split('.')[2]!, 'base64url').toString('hex')).not.toBe(seed);
    const issuedAt = payload.exp - LESSON_ATTEMPT_TOKEN_TTL_SECONDS;
    const bare = crypto.createHmac('sha256', secret).update([payload.lid, payload.sid, payload.uid, payload.jti, issuedAt].join('|')).digest('hex');
    expect(bare).not.toBe(seed);
  });

  it('is derived only from a verified token, so a forged or expired one gives nothing to derive from', () => {
    const { token } = mintLessonAttemptToken(base, secret, NOW);
    expect(verifyLessonAttemptToken(token, secret, { sid: 'seg-sim' }, NOW + 1000).status).toBe('valid');
    expect(verifyLessonAttemptToken(`${token}x`, secret, {}, NOW + 1000).status).toBe('invalid');
    expect(verifyLessonAttemptToken(token, `${secret}!`, {}, NOW + 1000).status).toBe('invalid');
    expect(verifyLessonAttemptToken(token, secret, {}, NOW + (LESSON_ATTEMPT_TOKEN_TTL_SECONDS + 1) * 1000).status).toBe('expired');
  });
});

describe('F3.0 seeded run protocol: the shared helpers', () => {
  it('recognises a seed only as 64 lowercase hex characters', () => {
    expect(isAttemptSeed(ZERO)).toBe(true);
    expect(isAttemptSeed(SAMPLE_ATTEMPT.seed)).toBe(true);
    for (const bad of [undefined, null, 0, '', 'x', ZERO.slice(1), `${ZERO}0`, 'A'.repeat(64), [ZERO]]) expect(isAttemptSeed(bad)).toBe(false);
  });

  it('compares seeds without leaking where they differ', () => {
    expect(seedsEqual(AAAA, AAAA)).toBe(true);
    expect(seedsEqual(AAAA, `${AAAA.slice(0, 63)}b`)).toBe(false);
    expect(seedsEqual(AAAA, `b${AAAA.slice(1)}`)).toBe(false);
    expect(seedsEqual(AAAA, 'x')).toBe(false);
    expect(seedsEqual(undefined, AAAA)).toBe(false);
  });

  it('names the seeded capability once', () => {
    expect(SEEDED_RUN_CAPABILITY).toBe('operation.seeded-run.v1');
    expect(isSeededCapabilitySet(['visual.x.v1', SEEDED_RUN_CAPABILITY])).toBe(true);
    expect(isSeededCapabilitySet(['visual.x.v1'])).toBe(false);
  });
});
