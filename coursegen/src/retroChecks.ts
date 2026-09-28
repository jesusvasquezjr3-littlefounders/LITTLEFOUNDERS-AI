/*
 * retroChecks.ts — G.2's follow-up mechanism (Appendix N 2.3(b)): RUN the
 * bypassed release verification retroactively.
 *
 *   npm run content:retro-checks            verify every course with an open check
 *   npm run content:retro-checks -- --list  list them, run nothing
 *
 * Vault records every bypass of the release check (a justified database-owner
 * patch of a live document, a Superadmin's emergency activation, a legacy
 * publication on a live lesson) in content_retro_checks, due 30 days later
 * (`*_content_bypass_retro_checks.sql`). This command reads the open checks
 * (content_bypass_checks), runs Forge `verify:course` for each course once,
 * then reads them again: a complete, current verification closes the course's
 * checks in Vault (closed_at, closing_verified_at, audit
 * 'content.retro_check_closed'). A course whose verification fails keeps its
 * checks open, and the operations watchdog alerts once they pass 30 days.
 *
 * Zero spend: verify:course reads Vault and writes one attestation row; no
 * model, image or voice call.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RetroCheckRow { id: number; course_id: string | null; state: 'open' | 'closed' | 'closed_late' | 'overdue' }

export interface RetroCheckDeps {
  /** content_bypass_checks(p_days) through the service role. */
  readChecks: () => Promise<RetroCheckRow[] | null>;
  /** Course id to slug. */
  courseSlugs: (ids: string[]) => Promise<Map<string, string> | null>;
  /** Forge verify:course for one course. */
  verifyCourse: (slug: string) => { ok: boolean; output: string };
}

export interface RetroCheckOutcome {
  ok: boolean;
  courses: { courseId: string; slug: string | null; verified: boolean; openBefore: number; openAfter: number }[];
  problems: string[];
}

const isOpen = (row: RetroCheckRow) => row.state === 'open' || row.state === 'overdue';

/** Runs the retroactive check for every course with an open check. */
export async function runRetroChecks(deps: RetroCheckDeps, options: { listOnly?: boolean } = {}): Promise<RetroCheckOutcome> {
  const before = await deps.readChecks();
  if (before === null) return { ok: false, courses: [], problems: ['could not read content_bypass_checks'] };
  const open = before.filter(isOpen);
  const unattached = open.filter((row) => row.course_id === null).length;
  const problems = unattached > 0 ? [`${unattached} open check(s) have no course (the lesson no longer resolves to one): resolve them by hand`] : [];
  const ids = [...new Set(open.map((row) => row.course_id).filter((id): id is string => id !== null))].sort();
  const slugs = ids.length === 0 ? new Map<string, string>() : await deps.courseSlugs(ids);
  if (slugs === null) return { ok: false, courses: [], problems: [...problems, 'could not read the course slugs'] };
  const verified = new Map<string, boolean>();
  if (!options.listOnly) {
    for (const id of ids) {
      const slug = slugs.get(id);
      if (!slug) { problems.push(`course ${id}: no slug`); verified.set(id, false); continue; }
      const result = deps.verifyCourse(slug);
      verified.set(id, result.ok);
      if (!result.ok) problems.push(`${slug}: verify:course failed; its checks stay open`);
    }
  }
  const after = options.listOnly ? before : await deps.readChecks();
  if (after === null) return { ok: false, courses: [], problems: [...problems, 'could not re-read content_bypass_checks'] };
  const courses = ids.map((id) => ({
    courseId: id,
    slug: slugs.get(id) ?? null,
    verified: verified.get(id) ?? false,
    openBefore: open.filter((row) => row.course_id === id).length,
    openAfter: after.filter((row) => row.course_id === id && isOpen(row)).length,
  }));
  const stillOpen = courses.some((course) => course.openAfter > 0);
  return { ok: !options.listOnly && !stillOpen && problems.length === 0, courses, problems };
}

function defaultDeps(): RetroCheckDeps {
  const S = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!S || !K) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const headers = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
  const here = path.dirname(fileURLToPath(import.meta.url));
  return {
    readChecks: async () => {
      const res = await fetch(`${S}/rest/v1/rpc/content_bypass_checks`, { method: 'POST', headers, body: JSON.stringify({ p_days: 365 }) }).catch(() => null);
      if (!res?.ok) return null;
      const rows = (await res.json()) as unknown;
      return Array.isArray(rows) ? (rows as RetroCheckRow[]) : null;
    },
    courseSlugs: async (ids) => {
      const res = await fetch(`${S}/rest/v1/courses?id=in.(${ids.join(',')})&select=id,slug`, { headers }).catch(() => null);
      if (!res?.ok) return null;
      const rows = (await res.json()) as { id: string; slug: string }[];
      return new Map(rows.map((row) => [row.id, row.slug]));
    },
    verifyCourse: (slug) => {
      const run = spawnSync('npm', ['--prefix', path.resolve(here, '..'), 'run', 'verify:course', '--', slug], { encoding: 'utf8', shell: process.platform === 'win32' });
      return { ok: run.status === 0, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const listOnly = process.argv.includes('--list');
  runRetroChecks(defaultDeps(), { listOnly }).then((outcome) => {
    for (const course of outcome.courses) {
      console.log(`${course.slug ?? course.courseId}: ${course.openBefore} open check(s)${listOnly ? '' : `, verify:course ${course.verified ? 'passed' : 'failed'}, ${course.openAfter} still open`}`);
    }
    for (const problem of outcome.problems) console.error(`content:retro-checks: ${problem}`);
    if (outcome.courses.length === 0 && outcome.problems.length === 0) console.log('content:retro-checks: no open retroactive check');
    process.exitCode = listOnly || outcome.ok || (outcome.courses.length === 0 && outcome.problems.length === 0) ? 0 : 1;
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
}
