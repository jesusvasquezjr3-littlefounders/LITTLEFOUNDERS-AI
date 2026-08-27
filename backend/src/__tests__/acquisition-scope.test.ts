import { describe, expect, it } from 'vitest';
import {
  ACQUISITION_SCOPE,
  PLAUSIBLE_DIMENSION_KEYS,
  dimensionScope,
  scoped,
  type PlausibleQueryFilter,
} from '../services/pulse.js';

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

/*
 * The half of the correction that was missing, and the reason it was missed.
 *
 * The read-time scope shipped on 2026-08-14 was verified against `event:page`
 * and recorded in ROADMAP.md as "zero out-of-boundary rows across twelve
 * months". That was true of the dimension it measured and false of two it did
 * not: `visit:entry_page` and `visit:exit_page` describe a SESSION, and a
 * session passes an event-level filter as soon as any one of its events does.
 * A visitor who landed on `/` and then opened the staff console reported an
 * entry page of `/admin/analytics` inside a report headed "public marketing
 * traffic only".
 *
 * Found on 2026-08-25 by an outside reader of the exports, four days after the
 * verification was written down. Measured in production before the fix: 7 of
 * 11 entry-page rows and 11 of 17 exit-page rows out of boundary, `/admin/roles`
 * and `/admin/generation` among them. Zero after it.
 */
describe('scope for session-level page dimensions', () => {
  const dimensionOf = (clause: PlausibleQueryFilter): string => {
    const [, nested] = clause as ['or', PlausibleQueryFilter[]];
    const [, dimension] = nested[0] as [string, string, string[]];
    return dimension;
  };

  it('restates the allowlist against entry_page and exit_page themselves', () => {
    expect(dimensionScope('entry_page').map(dimensionOf)).toEqual(['visit:entry_page']);
    expect(dimensionScope('exit_page').map(dimensionOf)).toEqual(['visit:exit_page']);
  });

  it('admits exactly the same paths as the event-level scope', () => {
    // One definition of "public acquisition surface", expressed against a
    // second dimension — never a second, divergent definition.
    const [, eventClauses] = ACQUISITION_SCOPE;
    const [, entryClauses] = dimensionScope('entry_page')[0] as ['or', PlausibleQueryFilter[]];
    const values = (clauses: PlausibleQueryFilter[]): unknown[] =>
      clauses.map((c) => (c as [string, string, string[]])[2]);
    expect(values(entryClauses)).toEqual(values(eventClauses));
  });

  it('leaves every other dimension on the always-on scope alone', () => {
    // An extra clause on a dimension that does not need one would silently
    // narrow a breakdown; the scope must be surgical, not blanket.
    for (const key of PLAUSIBLE_DIMENSION_KEYS) {
      if (key === 'entry_page' || key === 'exit_page') continue;
      expect(dimensionScope(key), `${key} needs no extra scope`).toEqual([]);
    }
  });
});
