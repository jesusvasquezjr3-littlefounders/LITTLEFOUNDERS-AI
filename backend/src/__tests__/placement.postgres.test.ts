import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch } from './fakePostgrest.js';
import { makeDb, USER_ID, COURSE_ID, COURSE_SLUG } from './placementAuditFixtures.js';

// Opt-in: this verifies actual Core routes with native SQL persistence, while
// catalog/auth transport stays synthetic. It is not a full Supabase/browser gate.
afterEach(() => vi.unstubAllGlobals());
it.skipIf(process.env.PLACEMENT_POSTGRES_AUDIT !== '1')('authored quiz commits SQL credits, updates Core progress and makes its badge attainable', async () => {
  const root = resolve('..');
  const output = execFileSync('python', [resolve(root, 'database/scripts/verify-placement-postgres.py')], { encoding: 'utf8' });
  const { database } = JSON.parse(output.trim()) as { database: string };
  if (!/^lf_placement_[a-f0-9]{32}$/.test(database)) throw new Error('Invalid isolated database');
  const base = ['-X', '-h', '127.0.0.1', '-p', '15483', '-U', 'audit_owner', '-v', 'ON_ERROR_STOP=1', '-Atq'];
  const sql = (query: string) => execFileSync(resolve(root, '.codex/audit-db/pgsql/bin/psql.exe'), [...base, '-d', database], { input: query, encoding: 'utf8' }).trim();
  expect(resolve(sql('SHOW data_directory'))).toBe(resolve(root, '.codex/audit-db/data'));
  const db = makeDb();
  const literal = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
  sql(`INSERT INTO auth.users VALUES (${literal(USER_ID)});`);
  for (const [table, columns] of [
    ['courses', ['id','slug','title','badge_asset','status','position']],
    ['adventures', ['id','course_id']], ['sagas', ['id','adventure_id']],
    ['topics', ['id','saga_id']], ['lessons', ['id','topic_id','status']],
  ] as const) {
    for (const row of db[table] ?? []) {
      const values = columns.map(column => literal(typeof row[column] === 'object' ? JSON.stringify(row[column]) : row[column]));
      sql(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')});`);
    }
  }
  const fake = createFakeFetch(db); let loseResponse = true;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/rpc/commit_course_placement')) {
      const body = JSON.parse(String(init?.body)) as { p_result: unknown; p_lesson_ids: string[] };
      const array = 'ARRAY[' + body.p_lesson_ids.map(id => literal(id) + '::uuid').join(',') + ']::uuid[]';
      const result = sql(`SET ROLE service_role; SELECT commit_course_placement(${literal(JSON.stringify(body.p_result))}::jsonb,${array});`);
      if (loseResponse) { loseResponse = false; return new Response('Synthetic response loss', { status: 503 }); }
      return new Response(JSON.stringify(result), { status: 200 });
    }
    // The production tree builder consumes the actual persisted SQL rows.
    for (const table of ['course_placements', 'placement_credits']) {
      if (url.includes('/' + table + '?')) {
        db[table] = JSON.parse(sql(`SELECT coalesce(json_agg(t),'[]') FROM ${table} t WHERE user_id=${literal(USER_ID)};`));
      }
    }
    return fake(input, init);
  });
  const app = createApp(); const token = mintToken({ sub: USER_ID });
  const auth = (test: request.Test) => test.set('Authorization', `Bearer ${token}`);
  const tree = () => auth(request(app).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
  const before = await tree(); expect(before.status).toBe(200);
  expect(before.body.data.course.placementRequired).toBe(true);
  const answers: { topicId: string; selectedIndex: number }[] = [];
  let finished = false;
  for (let count = 0; count < 12; count++) {
    const step = await auth(request(app).post(`/api/v1/placement/${COURSE_SLUG}/step`)).send({ signals: {}, answers });
    expect(step.status).toBe(200);
    if (step.body.data.kind === 'done') { finished = true; break; }
    expect(step.body.data.probe.correctIndex).toBeUndefined();
    answers.push({ topicId: step.body.data.probe.topicId, selectedIndex: 1 });
  }
  expect(finished).toBe(true); expect(answers.length).toBeGreaterThan(0);
  const commit = () => auth(request(app).post(`/api/v1/placement/${COURSE_SLUG}/commit`)).send({ signals: {}, answers });
  expect((await commit()).status).toBe(502);
  expect(sql(`SELECT count(*) FROM placement_credits WHERE user_id=${literal(USER_ID)};`)).toBe('3');
  const retry = await commit(); expect(retry.status).toBe(201);
  expect(retry.body.data.creditedLessonCount).toBe(3);
  const after = await tree(); expect(after.status).toBe(200);
  expect(after.body.data.course.placementRequired).toBe(false);
  expect(after.body.data.course.progress).toEqual({ passed: 3, total: 3, pct: 100 });
  const shelf = await auth(request(app).get('/api/v1/learn/courses'));
  expect(shelf.status).toBe(200);
  expect(shelf.body.data.courses.find((course: { id: string }) => course.id === COURSE_ID).progress).toEqual(after.body.data.course.progress);
  expect(sql(`SELECT course_slug FROM get_completed_course_badges(${literal(USER_ID)});`)).toBe(COURSE_SLUG);
  expect(sql(`SELECT count(*) FROM lesson_progress WHERE user_id=${literal(USER_ID)};`)).toBe('0');
  writeFileSync(resolve(root, 'audit-results/s02-placement-api-postgres.json'), JSON.stringify({
    database, provenance: 'Real Core routes and algorithm with SQL placement/credit persistence; synthetic auth/catalog transport; no browser or full Supabase',
    answeredQuestions: answers.length, lostResponseRecovered: true, creditedLessons: 3,
    courseProgress: after.body.data.course.progress, shelfAgrees: true, badgeAttainable: true,
    fabricatedLessonProgress: false,
  }, null, 2));
}, 30000);
