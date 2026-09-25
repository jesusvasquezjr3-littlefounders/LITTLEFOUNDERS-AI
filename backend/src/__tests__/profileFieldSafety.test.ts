import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PROFILE_FIELD_FLAGS, profileFieldFlags, reviewProfileFields } from '../services/profileFieldSafety.js';

/*
 * E.13 classifier parity. The same corpus is run against the SQL function
 * public.profile_field_flags on real PostgreSQL by
 * database/scripts/verify-social-tiers-postgres.py, so the database (which
 * enforces) and Core (which answers first) cannot drift apart unnoticed.
 */

const corpus = JSON.parse(readFileSync(fileURLToPath(new URL('../../../database/scripts/fixtures/profile-field-safety-cases.json', import.meta.url)), 'utf8')) as {
  cases: { value: string; flags: string[] }[];
};

describe('profileFieldFlags (E.13)', () => {
  it('has a non-trivial corpus that exercises every flag and ordinary names', () => {
    expect(corpus.cases.length).toBeGreaterThanOrEqual(40);
    for (const flag of PROFILE_FIELD_FLAGS) expect(corpus.cases.some((c) => c.flags.includes(flag)), flag).toBe(true);
    expect(corpus.cases.filter((c) => c.flags.length === 0).length).toBeGreaterThanOrEqual(10);
  });

  it.each(corpus.cases.map((c) => [c.value, c.flags] as const))('%j -> %j', (value, flags) => {
    expect(profileFieldFlags(value)).toEqual(flags);
  });

  it('treats a missing value as passing, and reviews both fields independently', () => {
    expect(profileFieldFlags(null)).toEqual([]);
    expect(reviewProfileFields({ username: 'ana', displayName: 'Ana' })).toEqual({ flagged: false, fields: [] });
    expect(reviewProfileFields({ username: 'ig_ana', displayName: 'Ana' })).toEqual({ flagged: true, fields: ['username'] });
    expect(reviewProfileFields({ username: 'ana', displayName: 'Ana 2014' })).toEqual({ flagged: true, fields: ['displayName'] });
  });
});
