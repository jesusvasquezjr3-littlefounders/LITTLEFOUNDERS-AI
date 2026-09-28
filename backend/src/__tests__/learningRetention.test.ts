import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../config.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * GAP-FIX-R1: the learning_practice_days retention sweep is internal-key
 * only, runs the database function once, and never reports a false zero.
 */

interface Call { url: string; method: string }
function stub(answer: () => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('/rpc/sweep_learning_practice_days')) return Promise.resolve(answer());
    return Promise.resolve(jsonResponse(200, []));
  }));
  return calls;
}
const sweeps = (calls: Call[]) => calls.filter((c) => c.url.includes('/rpc/sweep_learning_practice_days'));
const sweep = (key: string | null, body: object = {}, bearer?: string) => {
  const req = request(createApp()).post('/api/v1/internal/learning-retention/run');
  if (key) req.set('x-internal-api-key', key);
  if (bearer) req.set('Authorization', `Bearer ${bearer}`);
  return req.send(body);
};

afterEach(() => vi.unstubAllGlobals());

describe('learning practice-day retention sweep', () => {
  it('refuses every caller without the internal key, signed in or not', async () => {
    const calls = stub(() => jsonResponse(200, 3));
    for (const bearer of [undefined, mintToken({ sub: '11111111-1111-4111-8111-111111111111' })]) {
      expect((await sweep(null, {}, bearer)).status).toBe(403);
    }
    expect((await sweep('not-the-key')).status).toBe(403);
    expect(sweeps(calls)).toHaveLength(0);
  });

  it('runs the database function once and returns its count', async () => {
    const calls = stub(() => jsonResponse(200, 3));
    const res = await sweep(getConfig().INTERNAL_API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data ?? res.body).toMatchObject({ practiceDaysRemoved: 3 });
    expect(sweeps(calls)).toEqual([expect.objectContaining({ method: 'POST' })]);
  });

  it('never turns a failed or malformed answer into zero, and refuses options', async () => {
    for (const answer of [() => jsonResponse(500, { message: 'boom' }), () => jsonResponse(200, { removed: 0 }), () => jsonResponse(200, -1)]) {
      stub(answer);
      const res = await sweep(getConfig().INTERNAL_API_KEY);
      expect(res.status).toBe(502);
    }
    const calls = stub(() => jsonResponse(200, 0));
    expect((await sweep(getConfig().INTERNAL_API_KEY, { limit: 5 })).status).toBe(400);
    expect(sweeps(calls)).toHaveLength(0);
  });
});
