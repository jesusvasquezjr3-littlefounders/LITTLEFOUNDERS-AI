import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, SERVICE } from '../app.js';
import { getConfig } from '../env.js';
import { execute, initDb } from '../db/duckdb.js';
import { getSyncHealth } from '../db/sync.js';

describe('GET /health', () => {
  it('returns the ok envelope, duckdb not initialized in this test file', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        service: SERVICE,
        version: expect.any(String),
        status: 'ok',
        components: { duckdb: expect.any(String), redis: expect.any(String) },
        last_sync_at: null,
        sync_error: null,
      },
      error: null,
    });
  });

  it('unknown routes return the error envelope', async () => {
    const res = await request(createApp()).get('/unknown');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// Production incident 2026-08-09 (RUNBOOK.md): last_sync_at was a hardcoded
// null, so a sync that stopped working looked identical to a sync that never
// ran — the one field meant to distinguish "healthy" from "silently dead" and
// nobody looking. These verify it now reads dataintel_sync_state for real.
describe('getSyncHealth', () => {
  it('returns null/null before duckdb is ready — never queries a down store', async () => {
    // A fresh, un-initialized module state (this test file's own isolated
    // duckdb singleton) has isReady() === false until initDb() runs below.
    expect(await getSyncHealth()).toEqual({ last_sync_at: null, sync_error: null });
  });

  it('returns null/null once ready but before any sync has ever run', async () => {
    await initDb();
    expect(await getSyncHealth()).toEqual({ last_sync_at: null, sync_error: null });
  });

  it('reports the most recently touched sync target, success or failure', async () => {
    await execute(
      `INSERT INTO dataintel_sync_state (table_name, last_synced_at, rows_synced)
       VALUES ($1, TIMESTAMP '2026-08-01 00:00:00', 10)`,
      'users',
    );
    const afterFirst = await getSyncHealth();
    expect(afterFirst.last_sync_at).toContain('2026-08-01');
    expect(afterFirst.sync_error).toBeNull();

    // A later-touched row (even a different sync target) must win, and its
    // error must surface — this is the exact shape the 2026-08-09 incident
    // needed: the warehouse looked "ok" while sync was actually broken.
    await execute(
      `INSERT INTO dataintel_sync_state (table_name, last_synced_at, last_error)
       VALUES ($1, TIMESTAMP '2026-08-02 00:00:00', $2)`,
      'lessons',
      'PostgREST request failed: 500',
    );
    const afterSecond = await getSyncHealth();
    expect(afterSecond.last_sync_at).toContain('2026-08-02');
    expect(afterSecond.sync_error).toBe('PostgREST request failed: 500');
  });

  it('is wired end-to-end through GET /health', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.body.data.components.duckdb).toBe('up');
    expect(res.body.data.last_sync_at).toContain('2026-08-02');
    expect(res.body.data.sync_error).toBe('PostgREST request failed: 500');
  });
});

describe('/api/v1 internal-key gate', () => {
  const correctKey = getConfig().INTERNAL_API_KEY;

  it('returns 401 without x-internal-api-key', async () => {
    const res = await request(createApp()).post('/api/v1/intel/summary');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with wrong x-internal-api-key', async () => {
    const res = await request(createApp())
      .post('/api/v1/intel/summary')
      .set('x-internal-api-key', 'wrong-key-here');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 (not 401) with correct x-internal-api-key when no route exists', async () => {
    const res = await request(createApp())
      .post('/api/v1/intel/summary')
      .set('x-internal-api-key', correctKey);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
