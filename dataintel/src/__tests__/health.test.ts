import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, SERVICE } from '../app.js';
import { getConfig } from '../env.js';

describe('GET /health', () => {
  it('returns the ok envelope', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        service: SERVICE,
        version: expect.any(String),
        status: 'ok',
        components: { duckdb: expect.any(String), redis: expect.any(String) },
        last_sync_at: null,
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
