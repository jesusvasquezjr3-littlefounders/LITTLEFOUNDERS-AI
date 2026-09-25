import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { execute, initDb, query } from '../db/duckdb.js';
import { getConfig } from '../env.js';
import { applyErasureTombstones } from '../services/erasure.js';

/*
 * Product 10 E.6 — the warehouse step of an account erasure. Core calls
 * POST /api/v1/intel/erasure after the account is gone from Vault. Every
 * copied row about the account (and about the pre-signup visitor ids that
 * converted into it) goes; another learner's rows stay; and a sync batch that
 * lands after the erasure cannot bring the rows back.
 */

const KEY = getConfig().INTERNAL_API_KEY;
const erased = randomUUID();
const other = randomUUID();
const anon = randomUUID();
const otherAnon = randomUUID();
let nextEventId = 1_000_000;

async function seed(userId: string, anonId: string): Promise<void> {
  await execute(
    `INSERT INTO fact_events_raw (event_id, user_id, event_type, role, created_at) VALUES (?, ?::UUID, 'nav_view', 'parent', CURRENT_TIMESTAMP)`,
    nextEventId++, userId,
  );
  await execute(
    `INSERT INTO fact_events_raw (event_id, anon_id, event_type, role, created_at) VALUES (?, ?::UUID, 'page_view', 'anon', CURRENT_TIMESTAMP)`,
    nextEventId++, anonId,
  );
  await execute(
    `INSERT INTO fact_segment_attempts_raw (attempt_id, user_id, lesson_id, segment_id, attempt_number, score, created_at)
     VALUES (?::UUID, ?::UUID, ?::UUID, 's1', 1, 80, CURRENT_TIMESTAMP)`,
    randomUUID(), userId, randomUUID(),
  );
  await execute(
    `INSERT INTO learner_skill_states (user_id, skill_key, mastery_probability, uncertainty, evidence_count, recommended_action, reason_code)
     VALUES (?::UUID, 'money/saving', 0.5, 0.2, 3, 'practice', 'building')`,
    userId,
  );
  await execute(`INSERT INTO dim_sessions_raw (session_id, user_id) VALUES (?::UUID, ?::UUID)`, randomUUID(), userId);
  await execute(`INSERT INTO dim_users_raw (user_id, role) VALUES (?::UUID, 'parent')`, userId);
  await execute(
    `INSERT INTO dim_anon_conversions (anon_id, user_id, converted_at) VALUES (?::UUID, ?::UUID, CURRENT_TIMESTAMP)`,
    anonId, userId,
  );
}

async function remaining(userId: string, anonId: string): Promise<number> {
  const rows = await query<{ n: number | bigint }>(
    `SELECT (SELECT count(*) FROM fact_events_raw WHERE user_id = ?::UUID OR anon_id = ?::UUID)
          + (SELECT count(*) FROM fact_segment_attempts_raw WHERE user_id = ?::UUID)
          + (SELECT count(*) FROM learner_skill_states WHERE user_id = ?::UUID)
          + (SELECT count(*) FROM dim_sessions_raw WHERE user_id = ?::UUID)
          + (SELECT count(*) FROM dim_users_raw WHERE user_id = ?::UUID)
          + (SELECT count(*) FROM dim_anon_conversions WHERE user_id = ?::UUID OR anon_id = ?::UUID) AS n`,
    userId, anonId, userId, userId, userId, userId, userId, anonId,
  );
  return Number(rows[0]?.n ?? -1);
}

describe('POST /api/v1/intel/erasure', () => {
  beforeAll(async () => {
    await initDb();
    await seed(erased, anon);
    await seed(other, otherAnon);
  });

  it('is internal-key only and takes a strict body', async () => {
    expect((await request(createApp()).post('/api/v1/intel/erasure').send({ userId: erased })).status).toBe(401);
    const bad = await request(createApp()).post('/api/v1/intel/erasure').set('x-internal-api-key', KEY).send({ userId: 'nope' });
    expect(bad.status).toBe(400);
    const extra = await request(createApp()).post('/api/v1/intel/erasure').set('x-internal-api-key', KEY)
      .send({ userId: erased, anonIds: [], email: 'x@example.com' });
    expect(extra.status).toBe(400);
    expect(await remaining(erased, anon)).toBe(7);
  });

  it('removes every copied row about the account and its converted visitor ids, and only those', async () => {
    const res = await request(createApp()).post('/api/v1/intel/erasure').set('x-internal-api-key', KEY)
      .send({ userId: erased, anonIds: [anon] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      fact_events_raw: 2,
      fact_segment_attempts_raw: 1,
      learner_skill_states: 1,
      dim_sessions_raw: 1,
      dim_users_raw: 1,
      dim_anon_conversions: 1,
    });
    expect(await remaining(erased, anon)).toBe(0);
    expect(await remaining(other, otherAnon)).toBe(7);
    const tombstones = await query<{ kind: string }>('SELECT kind FROM erased_subjects WHERE subject_id IN (?::UUID, ?::UUID) ORDER BY kind', erased, anon);
    expect(tombstones.map((row) => row.kind)).toEqual(['anon', 'user']);
  });

  it('is idempotent', async () => {
    const res = await request(createApp()).post('/api/v1/intel/erasure').set('x-internal-api-key', KEY)
      .send({ userId: erased, anonIds: [anon] });
    expect(res.status).toBe(200);
    expect(Object.values(res.body.data as Record<string, number>).every((n) => n === 0)).toBe(true);
  });

  it('a sync batch that lands after the erasure cannot bring the rows back', async () => {
    await seed(erased, anon);
    expect(await remaining(erased, anon)).toBe(7);
    expect(await applyErasureTombstones()).toBe(7);
    expect(await remaining(erased, anon)).toBe(0);
    expect(await remaining(other, otherAnon)).toBe(7);
  });

  it('forgets a tombstone after 30 days', async () => {
    const stale = randomUUID();
    await execute(`INSERT INTO erased_subjects (subject_id, kind, erased_at) VALUES (?::UUID, 'user', CURRENT_TIMESTAMP - INTERVAL 31 DAY)`, stale);
    await applyErasureTombstones();
    const rows = await query<{ n: number | bigint }>('SELECT count(*) AS n FROM erased_subjects WHERE subject_id = ?::UUID', stale);
    expect(Number(rows[0]?.n)).toBe(0);
    const kept = await query<{ n: number | bigint }>('SELECT count(*) AS n FROM erased_subjects WHERE subject_id = ?::UUID', erased);
    expect(Number(kept[0]?.n)).toBe(1);
  });
});
