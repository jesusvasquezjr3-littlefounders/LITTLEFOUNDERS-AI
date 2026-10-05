import { describe, expect, it } from 'vitest';
import { lessonEligibilityFor, lessonEligibilityForBirthDate, readLessonEligibility } from './lessonEligibility.js';

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

describe('v2 lesson eligibility without a stored birth date', () => {
  const teen = { schema_version: 2, eligibility: { minimum_age: 13, maximum_age: 17 } };

  it('lets a declared band settle the policy only when the whole band is inside or outside it', () => {
    expect(lessonEligibilityFor(teen, null, '13_to_17', now)).toBe('eligible');
    expect(lessonEligibilityFor(teen, null, 'adult', now)).toBe('outside-range');
    expect(lessonEligibilityFor(teen, null, 'under_13', now)).toBe('outside-range');
    expect(lessonEligibilityFor(m6, null, '13_to_17', now)).toBe('outside-range');
  });

  it('fails closed when the band straddles the range, there is no band, or the policy is missing', () => {
    expect(lessonEligibilityFor(m6, null, 'under_13', now)).toBe('unknown-age');
    expect(lessonEligibilityFor(teen, null, null, now)).toBe('unknown-age');
    expect(lessonEligibilityFor({ schema_version: 2 }, null, 'adult', now)).toBe('invalid-policy');
  });

  it('prefers the exact date over the band', () => {
    expect(lessonEligibilityFor(m6, '2018-09-22', 'adult', now)).toBe('eligible');
  });
});
