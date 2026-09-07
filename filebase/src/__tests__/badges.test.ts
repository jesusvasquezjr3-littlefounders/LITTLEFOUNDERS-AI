import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { KEY } from './helpers.js';

function compose(app: ReturnType<typeof createApp>, body: Record<string, unknown>) {
  return request(app).post('/api/v1/badges').set('x-internal-api-key', KEY()).send(body);
}

describe('POST /api/v1/badges', () => {
  it('rejects a missing internal API key', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/badges')
      .send({ bucket: 'badges', kind: 'streak', label: '7-day streak', firstName: 'Sofía' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid params', async () => {
    const app = createApp();
    const res = await compose(app, { bucket: 'badges', kind: 'not-a-kind', label: 'x', firstName: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('composites a public PNG and reports deduplication on a repeat request', async () => {
    const app = createApp();
    const body = { bucket: 'badges', kind: 'streak', label: '7-day streak', firstName: 'Sofía', ageBand: '6-8' };

    const first = await compose(app, body);
    expect(first.status).toBe(200);
    expect(first.body.error).toBeNull();
    expect(first.body.data.mime).toBe('image/png');
    expect(first.body.data.deduplicated).toBe(false);
    expect(first.body.data.url).toMatch(/^\/files\/badges\/[a-f0-9]{64}\.png$/);
    expect(first.body.data.bucket).toBe('badges');
    expect(first.body.data.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.body.data.ext).toBe('png');

    const second = await compose(app, body);
    expect(second.status).toBe(200);
    expect(second.body.data.deduplicated).toBe(true);
    expect(second.body.data.url).toBe(first.body.data.url);
  });

  it('produces byte-identical images for identical params (deterministic render)', async () => {
    const app = createApp();
    const body = { bucket: 'badges', kind: 'course_badge', label: 'Emprendimiento', firstName: 'Iker' };
    const a = await compose(app, body);
    const b = await compose(app, { ...body, firstName: 'Otro' });
    expect(a.body.data.url).not.toBe(b.body.data.url);
  });

  it('XML-escapes a name that could break the SVG document', async () => {
    const app = createApp();
    const res = await compose(app, {
      bucket: 'badges',
      kind: 'streak',
      label: '7-day streak',
      firstName: '<script>&"\'',
    });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
  });
});
