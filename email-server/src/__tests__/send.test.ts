import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

beforeAll(() => {
  process.env.INTERNAL_API_KEY = 'test-key';
});

describe('POST /api/v1/send', () => {
  it('queues a valid email through the no-op adapter', async () => {
    const res = await request(createApp())
      .post('/api/v1/send')
      .set('x-internal-api-key', 'test-key')
      .send({ to: 'parent@example.com', subject: 'Welcome', text: 'Hi!' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      data: { id: expect.any(String), status: 'queued' },
      error: null,
    });
  });

  it('rejects an invalid body with the error envelope', async () => {
    const res = await request(createApp())
      .post('/api/v1/send')
      .set('x-internal-api-key', 'test-key')
      .send({ to: 'not-an-email', subject: '' });
    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
