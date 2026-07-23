import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, SERVICE } from '../app.js';

describe('GET /health', () => {
  it('returns the ok envelope', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { service: SERVICE, version: expect.any(String), status: 'ok' },
      error: null,
    });
  });

  it('unknown routes return the error envelope', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
