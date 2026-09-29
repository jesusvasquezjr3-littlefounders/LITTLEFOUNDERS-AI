import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { makeDb, USER_ID, COURSE_ID, COURSE_SLUG, L1, L2, L3 } from './placementAuditFixtures.js';

/*
 * Appendix C 2.2 B.1(b) and (c) (GAP-FIX-R4): the mandatory placement E2E -
 * quiz, commit, placement credit written, course progress updated, badge
 * attainable - for ALL FOUR placement methods (adaptive_quiz,
 * learner_chose_start, learner_adjusted, no_probe_content_fallback), each
 * through Core's real routes against real PostgreSQL carrying the WHOLE
 * migration chain (prepared by database/scripts/verify-placement-postgres.py
 * with LF_PG_FULL_CHAIN=1). Only the catalog and auth transport stay synthetic.
 *
 * The cluster: LF_PG_PORT (+ LF_PG_USER, LF_PG_PSQL, LF_PG_DATA) names a
 * running one, as backend CI's PostgreSQL service does; otherwise a throwaway
 * cluster is started from the local binaries (pg-verify-runner.mjs). With no
 * PostgreSQL at all the suite skips locally, and FAILS under CI: B.1 is done
 * only when this passes on every build.
 */

interface Runner {
  findPgBin(): string | null;
  externalClusterEnv(env: NodeJS.ProcessEnv): Record<string, string>;
  throwawayCluster(bin: string, label: string): Promise<{ env: Record<string, string>; stop(): void }>;
}

const root = resolve('..');
const runner = (await import(pathToFileURL(resolve(root, 'database/scripts/pg-verify-runner.mjs')).href)) as Runner;
const bin = process.env.LF_PG_PORT ? null : runner.findPgBin();
const available = Boolean(process.env.LF_PG_PORT || bin);

if (!available && process.env.CI) {
  it('has a PostgreSQL cluster in CI (Appendix C 2.2 B.1(b))', () => {
    throw new Error('CI must configure LF_PG_PORT (a PostgreSQL service): the B.1 placement E2E may not be skipped');
  });
}

const literal = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
let cluster: { env: Record<string, string>; stop(): void } | null = null;
let database = '';
let sql: (query: string) => Promise<string> = async () => '';

/** A child process, asynchronously: a synchronous spawn would stall the test worker's heartbeat for minutes. */
function exec(command: string, args: string[], options: { input?: string; env?: NodeJS.ProcessEnv } = {}): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env: options.env ?? process.env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
    child.stderr.on('data', (d: Buffer) => { err += d.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolvePromise(out.trim()) : reject(new Error(`${command} exited ${code}: ${err}`))));
    child.stdin.end(options.input ?? '');
  });
}

describe.skipIf(!available)('B.1 placement E2E on PostgreSQL (all four methods)', () => {
  beforeAll(async () => {
    cluster = process.env.LF_PG_PORT
      ? { env: runner.externalClusterEnv(process.env), stop: () => {} }
      : await runner.throwawayCluster(bin!, 'placement-e2e');
    const env = { ...process.env, ...cluster.env, LF_PG_FULL_CHAIN: '1', PYTHONIOENCODING: 'utf-8' };
    const python = process.env.LF_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
    if (!process.env.LF_PG_PORT) {
      // A fresh throwaway cluster needs the Supabase API roles before the shim runs.
      await exec(cluster.env.LF_PG_PSQL!, ['-X', '-h', '127.0.0.1', '-p', cluster.env.LF_PG_PORT!, '-U', cluster.env.LF_PG_USER!, '-d', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1'], {
        input: "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF; END $$;",
      });
    }
    const output = await exec(python, [resolve(root, 'database/scripts/verify-placement-postgres.py')], { env });
    ({ database } = JSON.parse(output.trim().split('\n').pop()!) as { database: string });
    if (!/^lf_placement_[a-f0-9]{32}$/.test(database)) throw new Error('Invalid isolated database');
    const base = ['-X', '-h', '127.0.0.1', '-p', cluster.env.LF_PG_PORT!, '-U', cluster.env.LF_PG_USER!, '-v', 'ON_ERROR_STOP=1', '-Atq', '-d', database];
    sql = (query: string) => exec(cluster!.env.LF_PG_PSQL!, base, { input: query });
    // The catalog the fake PostgREST serves, in the real schema (fixture insert only: triggers and FKs skipped).
    const catalog = makeDb();
    const rows: string[] = ['SET session_replication_role = replica;'];
    for (const c of catalog.courses ?? []) rows.push(`INSERT INTO courses (id, slug, title, badge_asset, status, position) VALUES (${literal(c.id)}, ${literal(c.slug)}, ${literal(JSON.stringify(c.title))}, ${literal(c.badge_asset)}, 'published', 1);`);
    for (const a of catalog.adventures ?? []) rows.push(`INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES (${literal(a.id)}, ${literal(a.course_id)}, ${Number(a.position)}, ${literal(a.slug)}, ${literal(a.theme)}, 'published');`);
    for (const s of catalog.sagas ?? []) rows.push(`INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES (${literal(s.id)}, ${literal(s.adventure_id)}, ${Number(s.position)}, ${literal(s.slug)}, 'published');`);
    for (const t of catalog.topics ?? []) rows.push(`INSERT INTO topics (id, saga_id, position, slug, status) VALUES (${literal(t.id)}, ${literal(t.saga_id)}, ${Number(t.position)}, ${literal(t.slug)}, 'published');`);
    for (const l of catalog.lessons ?? []) rows.push(`INSERT INTO lessons (id, topic_id, position, slug, status) VALUES (${literal(l.id)}, ${literal(l.topic_id)}, ${Number(l.position)}, ${literal(l.slug)}, 'published');`);
    await sql(rows.join('\n'));
  }, 900_000);

  afterAll(async () => {
    if (cluster && database && process.env.LF_PG_KEEP !== '1') {
      await exec(cluster.env.LF_PG_PSQL!, ['-X', '-h', '127.0.0.1', '-p', cluster.env.LF_PG_PORT!, '-U', cluster.env.LF_PG_USER!, '-d', 'postgres', '-Atq'],
        { input: `DROP DATABASE IF EXISTS ${database} WITH (FORCE);` });
    }
    cluster?.stop();
  }, 120_000);
  afterEach(() => vi.unstubAllGlobals());

  /** One learner per method: the commit is once per learner and course. */
  function world(userId: string, options: { noProbes?: boolean } = {}): FakeDb {
    const db = makeDb();
    for (const row of [...(db.account_age_declarations ?? []), ...(db.profiles ?? [])]) row.user_id = userId;
    if (options.noProbes) for (const topic of db.topics ?? []) topic.placement_probe = null;
    return db;
  }

  async function place(method: 'adaptive_quiz' | 'learner_chose_start' | 'learner_adjusted' | 'no_probe_content_fallback', options: { loseFirstResponse?: boolean } = {}) {
    const userId = method === 'adaptive_quiz' ? USER_ID : crypto.randomUUID();
    await sql(`INSERT INTO auth.users (id, email) VALUES (${literal(userId)}, ${literal(`${method}@example.com`)}) ON CONFLICT DO NOTHING;`);
    const db = world(userId, { noProbes: method === 'no_probe_content_fallback' });
    const fake = createFakeFetch(db);
    let loseResponse = options.loseFirstResponse ?? false;
    let commitErrors = 0;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rpc/commit_course_placement')) {
        const body = JSON.parse(String(init?.body)) as { p_result: unknown; p_lesson_ids: string[] };
        const array = 'ARRAY[' + body.p_lesson_ids.map((id) => literal(id) + '::uuid').join(',') + ']::uuid[]';
        let result: string;
        try {
          result = await sql(`SET ROLE service_role; SELECT commit_course_placement(${literal(JSON.stringify(body.p_result))}::jsonb, ${array});`);
        } catch (error) {
          commitErrors += 1;
          return new Response(JSON.stringify({ message: String(error) }), { status: 400 });
        }
        if (loseResponse) { loseResponse = false; return new Response('Synthetic response loss', { status: 503 }); }
        return new Response(JSON.stringify(result), { status: 200 });
      }
      // The production tree builder consumes the actual persisted SQL rows.
      for (const table of ['course_placements', 'placement_credits']) {
        if (url.includes('/' + table + '?')) db[table] = JSON.parse(await sql(`SELECT coalesce(json_agg(t), '[]') FROM ${table} t WHERE user_id = ${literal(userId)};`));
      }
      return fake(input, init);
    });
    const app = createApp();
    const token = mintToken({ sub: userId });
    const auth = (test: request.Test) => test.set('Authorization', `Bearer ${token}`);
    const tree = () => auth(request(app).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect((await tree()).status).toBe(200);

    // The quiz: every probe answered right (the fallback course has none to ask).
    const answers: { topicId: string; selectedIndex: number }[] = [];
    let result: { method: string } | null = null;
    for (let count = 0; count < 12; count++) {
      const step = await auth(request(app).post(`/api/v1/placement/${COURSE_SLUG}/step`)).send({ signals: {}, answers });
      expect(step.status).toBe(200);
      if (step.body.data.kind === 'done') { result = step.body.data.result; break; }
      expect(step.body.data.probe.correctIndex).toBeUndefined();
      answers.push({ topicId: step.body.data.probe.topicId, selectedIndex: 1 });
    }
    expect(result).not.toBeNull();
    const choice = method === 'learner_chose_start' ? { startFromBeginning: true } : method === 'learner_adjusted' ? { chosenFrontier: 1 } : {};
    const commit = () => auth(request(app).post(`/api/v1/placement/${COURSE_SLUG}/commit`)).send({ signals: {}, answers, ...choice });
    let committed = await commit();
    if (options.loseFirstResponse) {
      // The write landed but the answer was lost: the retry replays it, never a second placement.
      expect(committed.status).toBe(502);
      committed = await commit();
    }
    expect(committed.status).toBe(201);
    expect(commitErrors).toBe(0);
    const stored = await sql(`SELECT method FROM course_placements WHERE user_id = ${literal(userId)};`);
    const credits = Number(await sql(`SELECT count(*) FROM placement_credits WHERE user_id = ${literal(userId)};`));
    const after = await tree();
    expect(after.status).toBe(200);
    const badge = () => sql(`SELECT coalesce(string_agg(course_slug, ','), '') FROM get_completed_course_badges(${literal(userId)});`);
    return { userId, app, auth, committed, stored, credits, after, answers, badge };
  }

  /** Badge attainable: once the lessons placement did not credit are passed, the course badge is earned. */
  async function passRemaining(userId: string, credited: string[]) {
    for (const lesson of [L1, L2, L3].filter((id) => !credited.includes(id))) {
      await sql(`INSERT INTO lesson_progress (user_id, lesson_id, best_score, passed, attempts, completed_at) VALUES (${literal(userId)}, ${literal(lesson)}, 100, true, 1, now());`);
    }
  }

  it('adaptive_quiz: commits once after a lost response, credits every lesson the answers earned, 100% progress, badge earned', async () => {
    const r = await place('adaptive_quiz', { loseFirstResponse: true });
    expect(r.answers.length).toBeGreaterThan(0);
    expect(r.stored).toBe('adaptive_quiz');
    expect(r.committed.body.data.creditedLessonCount).toBe(3);
    expect(r.credits).toBe(3);
    expect(r.after.body.data.course.placementRequired).toBe(false);
    expect(r.after.body.data.course.progress).toEqual({ passed: 3, total: 3, pct: 100 });
    const shelf = await r.auth(request(r.app).get('/api/v1/learn/courses'));
    expect(shelf.body.data.courses.find((course: { id: string }) => course.id === COURSE_ID).progress).toEqual(r.after.body.data.course.progress);
    expect(await r.badge()).toBe(COURSE_SLUG);
    // Placement never fabricates lesson progress.
    expect(await sql(`SELECT count(*) FROM lesson_progress WHERE user_id = ${literal(r.userId)};`)).toBe('0');
  }, 120_000);

  it('learner_chose_start: commits with no credit, 0% progress, and the badge is attainable by learning', async () => {
    const r = await place('learner_chose_start');
    expect(r.stored).toBe('learner_chose_start');
    expect(r.credits).toBe(0);
    expect(r.after.body.data.course.placementRequired).toBe(false);
    expect(r.after.body.data.course.progress).toEqual({ passed: 0, total: 3, pct: 0 });
    expect(await r.badge()).toBe('');
    await passRemaining(r.userId, []);
    expect(await r.badge()).toBe(COURSE_SLUG);
  }, 120_000);

  it('learner_adjusted: moving the start earlier credits only what the learner kept, and the badge stays attainable', async () => {
    const r = await place('learner_adjusted');
    expect(r.stored).toBe('learner_adjusted');
    expect(r.credits).toBe(1);
    expect(await sql(`SELECT lesson_id FROM placement_credits WHERE user_id = ${literal(r.userId)};`)).toBe(L1);
    expect(r.after.body.data.course.progress).toEqual({ passed: 1, total: 3, pct: 33 });
    expect(await r.badge()).toBe('');
    await passRemaining(r.userId, [L1]);
    expect(await r.badge()).toBe(COURSE_SLUG);
  }, 120_000);

  it('no_probe_content_fallback: a course with no probe content still records a placement, and the badge is attainable', async () => {
    const r = await place('no_probe_content_fallback');
    expect(r.answers).toEqual([]);
    expect(r.stored).toBe('no_probe_content_fallback');
    expect(r.credits).toBe(0);
    expect(r.after.body.data.course.placementRequired).toBe(false);
    expect(r.after.body.data.course.progress).toEqual({ passed: 0, total: 3, pct: 0 });
    await passRemaining(r.userId, []);
    expect(await r.badge()).toBe(COURSE_SLUG);
  }, 120_000);
});
