import { describe, expect, it } from 'vitest';
import { journalSharedWithTutor } from './journalSharing.js';

/* OD-27 (3), L-13: only a parent-created child under 13 shares chosen options with the verified Tutor. */
const now = new Date('2026-09-27T12:00:00.000Z');
const age = (ageBand: 'under_13' | '13_to_17' | 'adult' | null, protectedOrigin = false) => ({ ageBand, protectedOrigin });

describe('journalSharedWithTutor', () => {
  it('shares for a parent-created child under 13, by birth date first', () => {
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: '2019-01-01', age: age('under_13'), now })).toBe(true);
    // The day before the 13th birthday still shares; the birthday itself does not.
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: '2013-09-28', age: age('under_13'), now })).toBe(true);
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: '2013-09-27', age: age('under_13'), now })).toBe(false);
  });

  it('keeps every teen private, whatever the role or band says', () => {
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: '2011-05-05', age: age('under_13'), now })).toBe(false);
    expect(journalSharedWithTutor({ roles: [], birthDate: '2016-05-05', age: age('under_13'), now })).toBe(false);
    expect(journalSharedWithTutor({ roles: ['parent'], birthDate: null, age: age('adult'), now })).toBe(false);
  });

  it('without a birth date the screened band decides, and an unknown age stays private', () => {
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: null, age: age('under_13'), now })).toBe(true);
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: null, age: age(null, true), now })).toBe(true);
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: null, age: age('13_to_17'), now })).toBe(false);
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: null, age: age(null), now })).toBe(false);
    expect(journalSharedWithTutor({ roles: ['kid'], birthDate: 'not-a-date', age: age(null), now })).toBe(false);
  });
});
