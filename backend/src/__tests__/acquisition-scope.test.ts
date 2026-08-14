import { describe, expect, it } from 'vitest';
import { ACQUISITION_SCOPE, scoped, type PlausibleQueryFilter } from '../services/pulse.js';

/*
 * The stored Plausible history predates the autoCapturePageviews fix and
 * contains /admin/* and product routes that the acquisition boundary never
 * permitted. Plausible cannot delete by filter, so the correction is applied
 * at read time — which means these predicates ARE the correction, and a
 * regression here silently republishes contaminated numbers.
 */

/** Mirrors the reference implementation of the filter Plausible evaluates. */
function inScope(path: string): boolean {
  const [, clauses] = ACQUISITION_SCOPE;
  return clauses.some((clause) => {
    const [operator, , values] = clause as [string, string, string[]];
    if (operator === 'is') return values.includes(path);
    if (operator === 'matches') return values.some((pattern) => new RegExp(pattern).test(path));
    return false;
  });
}

describe('acquisition scope', () => {
  it('admits every public marketing surface, including nested pages', () => {
    for (const path of ['/', '/how-it-works', '/families', '/faq', '/legal', '/legal/terms', '/legal/privacy']) {
      expect(inScope(path), `${path} should be in scope`).toBe(true);
    }
  });

  it('excludes the staff console, the product and the auth funnel', () => {
    // Exactly the paths production was found to be recording on 2026-08-14.
    for (const path of [
      '/admin', '/admin/content', '/admin/analytics', '/admin/users', '/admin/intel',
      '/learn', '/learn/financial-education', '/learn/lesson/5d7711fa-2c40-4984-9d96-000000000000',
      '/tutor', '/profile', '/signup', '/login', '/auth/callback',
    ]) {
      expect(inScope(path), `${path} should be out of scope`).toBe(false);
    }
  });

  it('does not admit a look-alike path that merely contains a marketing word', () => {
    // Why the filter uses anchored `matches` rather than `contains`.
    expect(inScope('/admin/families')).toBe(false);
    expect(inScope('/x/faq')).toBe(false);
    expect(inScope('/faq-internal')).toBe(false);
  });

  it('is applied even when the caller passes no filters of its own', () => {
    expect(scoped()).toEqual([ACQUISITION_SCOPE]);
    expect(scoped([])).toEqual([ACQUISITION_SCOPE]);
  });

  it('is prepended to, never replaced by, caller filters', () => {
    const user: PlausibleQueryFilter = ['is', 'visit:country', ['MX']];
    expect(scoped([user])).toEqual([ACQUISITION_SCOPE, user]);
  });
});
