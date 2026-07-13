import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { fakeAudio, KEY, upload } from './helpers.js';

describe('GET /api/v1/files (pagination)', () => {
  it('paginates via cursor', async () => {
    const app = createApp();
    for (let i = 0; i < 3; i++) {
      const res = await upload(app, { bucket: 'lesson-images', mime: 'image/png', bytes: fakeAudio(50, 10 + i) });
      expect(res.status).toBe(200);
    }

    const page1 = await request(app)
      .get('/api/v1/files')
      .query({ bucket: 'lesson-images', limit: 2 })
      .set('x-internal-api-key', KEY());
    expect(page1.status).toBe(200);
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.nextCursor).not.toBeNull();

    const page2 = await request(app)
      .get('/api/v1/files')
      .query({ bucket: 'lesson-images', limit: 2, cursor: page1.body.data.nextCursor })
      .set('x-internal-api-key', KEY());
    expect(page2.status).toBe(200);
    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.nextCursor).toBeNull();
  });

  it('returns an empty page for an unknown bucket', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v1/files')
      .query({ bucket: 'never-used-bucket' })
      .set('x-internal-api-key', KEY());
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.nextCursor).toBeNull();
  });

  it('requires the internal key', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/files').query({ bucket: 'lesson-images' });
    expect(res.status).toBe(401);
  });
});
