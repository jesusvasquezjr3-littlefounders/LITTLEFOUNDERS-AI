import { describe, expect, it, vi } from 'vitest';
import { runRetroChecks, type RetroCheckRow } from '../retroChecks.js';

/*
 * G.2 / Appendix N 2.3(b): the follow-up mechanism actually RUNS the bypassed
 * release verification, once per course with an open check, and reports what
 * Vault recorded afterwards. Vault's closing of the checks is proven on
 * PostgreSQL by database/scripts/verify-content-release-postgres.py.
 */

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const row = (id: number, course: string | null, state: RetroCheckRow['state']): RetroCheckRow => ({ id, course_id: course, state });

describe('content:retro-checks', () => {
  it('runs verify:course once per course with an open check and reads the result back', async () => {
    const reads = [
      [row(1, A, 'open'), row(2, A, 'overdue'), row(3, B, 'open'), row(4, B, 'closed')],
      [row(1, A, 'closed'), row(2, A, 'closed_late'), row(3, B, 'closed'), row(4, B, 'closed')],
    ];
    const verifyCourse = vi.fn(() => ({ ok: true, output: '' }));
    const outcome = await runRetroChecks({
      readChecks: async () => reads.shift() ?? null,
      courseSlugs: async () => new Map([[A, 'money'], [B, 'lemonade']]),
      verifyCourse,
    });
    expect(verifyCourse.mock.calls.map((c) => c[0])).toEqual(['money', 'lemonade']);
    expect(outcome).toMatchObject({ ok: true, problems: [] });
    expect(outcome.courses).toEqual([
      { courseId: A, slug: 'money', verified: true, openBefore: 2, openAfter: 0 },
      { courseId: B, slug: 'lemonade', verified: true, openBefore: 1, openAfter: 0 },
    ]);
  });

  it('keeps a failed verification visible, and a check with no course is a problem', async () => {
    const open = [row(1, A, 'overdue'), row(2, null, 'open')];
    const outcome = await runRetroChecks({
      readChecks: async () => open,
      courseSlugs: async () => new Map([[A, 'money']]),
      verifyCourse: () => ({ ok: false, output: 'VERIFICATION_INCOMPLETE' }),
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.courses[0]).toMatchObject({ slug: 'money', verified: false, openAfter: 1 });
    expect(outcome.problems.join(' ')).toMatch(/money: verify:course failed/);
    expect(outcome.problems.join(' ')).toMatch(/no course/);
  });

  it('lists without running anything, and an unreadable Vault is a failure, never "nothing open"', async () => {
    const verifyCourse = vi.fn(() => ({ ok: true, output: '' }));
    const listed = await runRetroChecks({ readChecks: async () => [row(1, A, 'open')], courseSlugs: async () => new Map([[A, 'money']]), verifyCourse }, { listOnly: true });
    expect(verifyCourse).not.toHaveBeenCalled();
    expect(listed.courses[0]).toMatchObject({ openBefore: 1, openAfter: 1 });
    const down = await runRetroChecks({ readChecks: async () => null, courseSlugs: async () => new Map(), verifyCourse });
    expect(down).toMatchObject({ ok: false, problems: ['could not read content_bypass_checks'] });
  });
});
