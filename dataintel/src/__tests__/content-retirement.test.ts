import request from 'supertest';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { getConfig } from '../env.js';
import { CONTENT_RESET_OPERATION, beginContentRetirement, contentRetirementGate, digestIds, inventoryRetiredContent, resetContentRetirementForTest } from '../services/contentRetirement.js';
import { initDb, withConnection } from '../db/duckdb.js';

const fetchState = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock('../db/sync.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../db/sync.js')>();
  return { ...original, fetchFromVault: fetchState.fetch };
});

vi.mock('../db/duckdb.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../db/duckdb.js')>();
  return { ...original, isReady: () => true };
});

const key = getConfig().INTERNAL_API_KEY;
const auth = (req: request.Test) => req.set('x-internal-api-key', key);

afterEach(() => {
  resetContentRetirementForTest();
  fetchState.fetch.mockReset();
});

describe('one-off content retirement maintenance boundary', () => {
  it('pins the request contract and rejects unauthenticated or arbitrary operations before any warehouse work', async () => {
    const app = createApp();
    expect((await request(app).post('/api/v1/intel/content-retirement/begin')
      .send({ operation: CONTENT_RESET_OPERATION })).status).toBe(401);
    expect((await auth(request(app).post('/api/v1/intel/content-retirement/begin'))
      .send({ operation: 'DELETE FROM fact_events_raw' })).status).toBe(400);
    expect((await auth(request(app).post('/api/v1/intel/content-retirement/begin'))
      .send({ operation: CONTENT_RESET_OPERATION, sql: 'DELETE FROM fact_events_raw' })).status).toBe(400);
    expect((await auth(request(app).post('/api/v1/intel/content-retirement/purge'))
      .send({ operation: CONTENT_RESET_OPERATION, leaseId: 'bad', backupSha256: '0'.repeat(64) })).status).toBe(400);
    expect(fetchState.fetch).not.toHaveBeenCalled();
  });

  it('rejects a changed Vault catalog and releases the maintenance gate', async () => {
    fetchState.fetch.mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]);
    const app = createApp();
    const result = await auth(request(app).post('/api/v1/intel/content-retirement/begin'))
      .send({ operation: CONTENT_RESET_OPERATION });
    expect(result.status).toBe(409);
    expect(result.body.error.message).toMatch(/pinned content-reset scope/);
    const normalRoute = await auth(request(app).get('/api/v1/intel/does-not-exist'));
    expect(normalRoute.status).not.toBe(503);
  });

  it('allows only one active preparation and blocks ordinary warehouse requests until it aborts', async () => {
    let resolveFetch!: (rows: { id: string }[]) => void;
    fetchState.fetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    const app = createApp();
    const first = auth(request(app).post('/api/v1/intel/content-retirement/begin'))
      .send({ operation: CONTENT_RESET_OPERATION });
    const pending = first.then((result) => result);
    for (let i = 0; i < 100 && fetchState.fetch.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(fetchState.fetch).toHaveBeenCalled();
    expect((await auth(request(app).post('/api/v1/intel/content-retirement/begin'))
      .send({ operation: CONTENT_RESET_OPERATION })).status).toBe(409);
    expect((await auth(request(app).get('/api/v1/intel/does-not-exist'))).status).toBe(503);
    resolveFetch([{ id: '11111111-1111-4111-8111-111111111111' }]);
    expect((await pending).status).toBe(409);
    expect((await auth(request(app).get('/api/v1/intel/does-not-exist'))).status).not.toBe(503);
  });

  it('uses stable sorted ID digests so reordered IDs do not change the pinned scope', () => {
    expect(digestIds(['b', 'a'])).toBe(digestIds(['a', 'b']));
    expect(digestIds(['a', 'b'])).not.toBe(digestIds(['a', 'c']));
  });

  it('does not treat a disconnected async request as a drained warehouse writer', async () => {
    fetchState.fetch.mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]);
    const response = new EventEmitter();
    const next = vi.fn();
    contentRetirementGate({ path: '/slow-writer' } as Request, response as Response, next);
    expect(next).toHaveBeenCalledOnce();
    const preparation = beginContentRetirement();
    await new Promise((resolve) => setTimeout(resolve, 60));
    response.emit('close');
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fetchState.fetch).not.toHaveBeenCalled();
    response.emit('finish');
    await expect(preparation).rejects.toThrow(/pinned content-reset scope/);
  });

  it('retains NULL-linked unrelated events and detects a change to their contents', async () => {
    await initDb();
    const course = '11111111-1111-4111-8111-111111111111';
    const lesson = '22222222-2222-4222-8222-222222222222';
    await withConnection(async (connection) => {
      await connection.exec('CREATE TEMP TABLE lf_retired_courses (id UUID)');
      await connection.exec('CREATE TEMP TABLE lf_retired_lessons (id UUID)');
      await connection.exec(`INSERT INTO lf_retired_courses VALUES ('${course}')`);
      await connection.exec(`INSERT INTO lf_retired_lessons VALUES ('${lesson}')`);
      await connection.exec(`INSERT INTO fact_events_raw (event_id, course_id, lesson_id, event_type, value, created_at)
        VALUES (1, '${course}', '${lesson}', 'lesson_start', 1, CURRENT_TIMESTAMP),
               (2, NULL, NULL, 'unrelated_action', 2, CURRENT_TIMESTAMP)`);
      const before = await inventoryRetiredContent(connection);
      expect(before.events).toBe(1);
      expect(before.eventTotal).toBe(2);
      await connection.exec('UPDATE fact_events_raw SET value = 3 WHERE event_id = 2');
      const after = await inventoryRetiredContent(connection);
      expect(after.events).toBe(1);
      expect(after.eventTotal).toBe(2);
      expect(after.unrelatedEventDigest).not.toBe(before.unrelatedEventDigest);
    });
  });
});
