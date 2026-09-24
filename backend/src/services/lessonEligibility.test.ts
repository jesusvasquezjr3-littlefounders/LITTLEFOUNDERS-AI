import { describe, expect, it } from 'vitest';
import { lessonEligibilityForBirthDate, readLessonEligibility } from './lessonEligibility.js';

const now = new Date('2026-09-22T00:00:00.000Z');
const m6 = { schema_version: 2, eligibility: { minimum_age: 7, maximum_age: 10 } };

describe('v2 lesson eligibility', () => {
  it('derives an exact bounded decision without exposing a date or age', () => {
    expect(lessonEligibilityForBirthDate(m6, '2018-09-22', now)).toBe('eligible');
    expect(lessonEligibilityForBirthDate(m6, '2019-09-23', now)).toBe('outside-range');
    expect(lessonEligibilityForBirthDate(m6, '2015-09-22', now)).toBe('outside-range');
  });

  it('fails closed for missing, malformed or incomplete policy evidence', () => {
    expect(lessonEligibilityForBirthDate(m6, null, now)).toBe('unknown-age');
    expect(lessonEligibilityForBirthDate(m6, 'not-a-date', now)).toBe('unknown-age');
    expect(readLessonEligibility({ schema_version: 2 })).toBeNull();
    expect(readLessonEligibility({ eligibility: { minimum_age: 11, maximum_age: 10 } })).toBeNull();
  });
});
