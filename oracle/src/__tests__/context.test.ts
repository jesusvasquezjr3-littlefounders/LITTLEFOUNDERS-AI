import { describe, expect, it } from 'vitest';
import {
  NicknameSchema,
  sealContext,
  tierForBirthDate,
  TutorContextSchema,
  type TutorContext,
} from '../context/schema.js';

/*
 * The privacy boundary, pinned.
 *
 * /ORACLE.md §4.1 is a table in a document, and a table in a document does not
 * stop anybody. These tests are what actually stop them, and the most
 * important one is `rejects an unlisted field` — it is the difference between
 * a schema that documents intent and one that enforces it.
 */

function validContext(overrides: Partial<TutorContext> = {}): TutorContext {
  return {
    nickname: 'Robi',
    tier: 2,
    locale: 'es-MX',
    character: 'rho',
    intent: 'course_topic',
    adaptations: [],
    courseContext: null,
    skillStates: [],
    turnHistory: [],
    planState: null,
    previousSessions: [],
    ...overrides,
  };
}

describe('the model context boundary', () => {
  it('accepts a well-formed context', () => {
    expect(() => sealContext(validContext())).not.toThrow();
  });

  it.each([
    ['birthDate', '2016-04-02'],
    ['userId', '11111111-1111-4111-8111-111111111111'],
    ['email', 'kid@example.com'],
    ['displayName', 'Real Name'],
    ['surname', 'Vasquez'],
    ['city', 'Monterrey'],
    ['school', 'Escuela Primaria'],
    ['age', 8],
    ['avatarUrl', 'https://example.com/a.png'],
    ['familyId', '22222222-2222-4222-8222-222222222222'],
    ['rawEvents', []],
  ])('refuses to send an unlisted field: %s', (key, value) => {
    // A silent drop would be worse than a throw: the developer who added the
    // field would see their feature "work" and ship a no-op.
    expect(() => sealContext({ ...validContext(), [key]: value })).toThrow(
      /refusing to send an invalid model context/,
    );
  });

  it('names the offending field in the error, so the fix is obvious', () => {
    expect(() => sealContext({ ...validContext(), birthDate: '2016-04-02' })).toThrow(/birthDate/);
  });

  it('rejects a nickname that is really a full name with punctuation', () => {
    expect(NicknameSchema.safeParse('Jesús Vásquez, Jr.').success).toBe(false);
  });

  it('accepts ordinary nicknames in all three locales', () => {
    for (const nick of ['Robi', 'Chío', 'João', 'Zeta_9', "O'Ryan", 'Ana-Lu']) {
      expect(NicknameSchema.safeParse(nick).success).toBe(true);
    }
  });

  it('accepts a memory digest, and refuses one smuggling transcript text', () => {
    const digest = {
      topic: 'Ahorro',
      skillKeys: ['money.saving'],
      outcome: 'completed' as const,
      gradedCorrect: 2,
      gradedTotal: 3,
      daysAgo: 4,
    };
    expect(() => sealContext(validContext({ previousSessions: [digest] }))).not.toThrow();
    // The exception to "this session only" is the digest's SHAPE. A field of
    // prose — a transcript, a note, a quote — is exactly what it must reject.
    expect(() =>
      sealContext(
        validContext({
          previousSessions: [{ ...digest, transcript: 'el niño dijo…' } as never],
        }),
      ),
    ).toThrow(/refusing to send an invalid model context/);
  });

  it('caps turn history so an old injection cannot ride along forever', () => {
    const tooMany = Array.from({ length: 41 }, () => ({ speaker: 'learner' as const, text: 'hi' }));
    expect(TutorContextSchema.safeParse(validContext({ turnHistory: tooMany })).success).toBe(false);
  });

  it('rejects a skill state carrying extra warehouse columns', () => {
    const leaky = {
      skillKey: 'money.saving',
      masteryProbability: 0.4,
      uncertainty: 0.3,
      evidenceCount: 5,
      recommendedAction: 'practice' as const,
      reasonCode: 'low_recent_accuracy',
      // Real column names from the warehouse. None of them belong here.
      lastPracticedAt: '2026-08-01T00:00:00.000Z',
      userId: '33333333-3333-4333-8333-333333333333',
    };
    expect(() => sealContext(validContext({ skillStates: [leaky] as never }))).toThrow();
  });
});

describe('tierForBirthDate', () => {
  const now = new Date('2026-08-21T00:00:00.000Z');

  it.each([
    ['2020-01-01', 1],
    ['2019-08-22', 1],
    ['2018-01-01', 2],
    ['2016-08-22', 2],
    ['2016-08-20', 3],
    ['2005-01-01', 3],
  ])('maps %s to tier %i', (birthDate, expected) => {
    expect(tierForBirthDate(birthDate, now)).toBe(expected);
  });

  it('falls back to the MIDDLE band when the birth date is unknown', () => {
    // Not tier 3: an unknown date must never hand a seven-year-old adult
    // vocabulary on the strength of a missing field.
    expect(tierForBirthDate(null, now)).toBe(2);
    expect(tierForBirthDate(undefined, now)).toBe(2);
    expect(tierForBirthDate('not-a-date', now)).toBe(2);
  });

  it('does not go below tier 1 for a date in the future', () => {
    expect(tierForBirthDate('2030-01-01', now)).toBe(2);
  });
});
