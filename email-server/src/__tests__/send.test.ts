import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app.js';

beforeAll(() => {
  process.env.INTERNAL_API_KEY = 'test-internal-key-0123456789';
});

describe('POST /api/v1/send', () => {
  it('queues a valid email through the no-op adapter', async () => {
    const res = await request(createApp())
      .post('/api/v1/send')
      .set('x-internal-api-key', 'test-internal-key-0123456789')
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
      .set('x-internal-api-key', 'test-internal-key-0123456789')
      .send({ to: 'not-an-email', subject: '' });
    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

/*
 * H.3 contract with dataintel's alert evaluator: the body its email channel
 * sends (dataintel/src/services/alertEmail.ts) is this fixture, byte-identical
 * to dataintel's copy (dataintel's suite asserts the parity). The real route
 * must accept it.
 */
describe('POST /api/v1/send — the warehouse alert email (H.3)', () => {
  it('accepts dataintel\'s alert body with a 202', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const body = JSON.parse(readFileSync(join(here, 'fixtures/alert-email-body.json'), 'utf8')) as Record<string, unknown>;
    const res = await request(createApp())
      .post('/api/v1/send')
      .set('x-internal-api-key', 'test-internal-key-0123456789')
      .send(body);
    expect(res.status).toBe(202);
    expect(res.body.error).toBeNull();
  });
});
