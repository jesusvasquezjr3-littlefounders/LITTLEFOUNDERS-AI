import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { fakeAudio, KEY, upload } from './helpers.js';

describe('object visibility', () => {
  it('serves a public object without any credentials', async () => {
    const app = createApp();
    const res = await upload(app, {
      bucket: 'lesson-audio',
      visibility: 'public',
      mime: 'audio/mpeg',
      bytes: fakeAudio(64, 1),
    });
    const dl = await request(app).get(`/files/${res.body.data.id}`);
    expect(dl.status).toBe(200);
  });

  it('rejects an internal object without the internal key', async () => {
    const app = createApp();
    const res = await upload(app, {
      bucket: 'lesson-audio',
      visibility: 'internal',
      mime: 'audio/mpeg',
      bytes: fakeAudio(64, 6),
    });
    const dl = await request(app).get(`/files/${res.body.data.id}`);
    expect(dl.status).toBe(401);
    expect(dl.body.error.code).toBe('UNAUTHORIZED');
  });

  it('serves an internal object with a valid internal key', async () => {
    const app = createApp();
    const res = await upload(app, {
      bucket: 'lesson-audio',
      visibility: 'internal',
      mime: 'audio/mpeg',
      bytes: fakeAudio(64, 8),
    });
    const dl = await request(app).get(`/files/${res.body.data.id}`).set('x-internal-api-key', KEY());
    expect(dl.status).toBe(200);
  });
});
