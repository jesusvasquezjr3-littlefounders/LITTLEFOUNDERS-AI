import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

beforeAll(() => {
  process.env.INTERNAL_API_KEY = 'test-internal-key-0123456789';
});

const auth = (app: ReturnType<typeof createApp>, path: string) =>
  request(app).get(path).set('x-internal-api-key', 'test-internal-key-0123456789');

describe('GET /api/v1/logs', () => {
  it('defaults limit and offset when the query is empty', async () => {
    const res = await auth(createApp(), '/api/v1/logs');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(Array.isArray(res.body.data.entries)).toBe(true);
    expect(res.body.data.total).toBeTypeOf('number');
  });

  it('accepts in-range limit and offset', async () => {
    const res = await auth(createApp(), '/api/v1/logs?limit=10&offset=5');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
  });

  it('filters the fallback history server-side by search, status, and template', async () => {
    const app = createApp();
    await request(app).post('/api/v1/logs').set('x-internal-api-key', 'test-internal-key-0123456789')
      .send({ messageId: 'welcome-1', to: 'parent@example.com', subject: 'Welcome', templateType: 'auth', status: 'relayed' });
    await request(app).post('/api/v1/logs').set('x-internal-api-key', 'test-internal-key-0123456789')
      .send({ messageId: 'reset-1', to: 'other@example.com', subject: 'Reset', templateType: 'recovery', status: 'failed' });

    const res = await request(app).get('/api/v1/logs?q=parent&status=relayed&templateType=auth')
      .set('x-internal-api-key', 'test-internal-key-0123456789');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.entries[0].messageId).toBe('welcome-1');
  });

  // Regression: these used to be bare z.parse(), so a bad value threw inside
  // the handler and Express answered 500 text/html with a stack trace —
  // violating the §1.6 envelope and leaking absolute paths.
  it.each([
    ['non-numeric limit', '/api/v1/logs?limit=abc'],
    ['limit above the 200 cap', '/api/v1/logs?limit=999'],
    ['negative offset', '/api/v1/logs?offset=-1'],
  ])('rejects %s with a 400 envelope, not a 500 stack trace', async (_label, path) => {
    const res = await auth(createApp(), path);
    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires the internal API key', async () => {
    const res = await request(createApp()).get('/api/v1/logs');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/v1/logs/summary', () => {
  it('returns the summary in the envelope', async () => {
    const res = await auth(createApp(), '/api/v1/logs/summary');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toBeTypeOf('object');
    expect(res.body.data.trend).toHaveLength(30);
  });
});

describe('envelope error handler', () => {
  it('answers a malformed JSON body with a 400 envelope, not HTML', async () => {
    const res = await request(createApp())
      .post('/api/v1/send')
      .set('x-internal-api-key', 'test-internal-key-0123456789')
      .set('Content-Type', 'application/json')
      .send('{"to": broken');
    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
