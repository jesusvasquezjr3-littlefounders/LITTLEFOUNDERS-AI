import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { fakeAudio, KEY, upload } from './helpers.js';

describe('upload → download roundtrip', () => {
  it('stores an object and serves back byte-identical content', async () => {
    const app = createApp();
    const bytes = fakeAudio(4096);

    const res = await upload(app, { bucket: 'lesson-audio', mime: 'audio/mpeg', bytes });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.deduplicated).toBe(false);
    expect(res.body.data.bytes).toBe(bytes.length);
    expect(res.body.data.mime).toBe('audio/mpeg');
    expect(res.body.data.id).toMatch(/^lesson-audio\/[a-f0-9]{64}\.mp3$/);

    const dl = await request(app).get(`/files/${res.body.data.id}`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toBe('audio/mpeg');
    expect(dl.headers['accept-ranges']).toBe('bytes');
    expect(dl.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(Buffer.compare(dl.body as Buffer, bytes)).toBe(0);
  });

  it('serves a 304 when If-None-Match matches the ETag', async () => {
    const app = createApp();
    const bytes = fakeAudio(256, 3);
    const res = await upload(app, { bucket: 'lesson-audio', mime: 'image/png', bytes });
    const id = res.body.data.id as string;

    const first = await request(app).get(`/files/${id}`);
    const etag = first.headers.etag as string;

    const cached = await request(app).get(`/files/${id}`).set('If-None-Match', etag);
    expect(cached.status).toBe(304);
  });

  it('supports HEAD without a body', async () => {
    const app = createApp();
    const bytes = fakeAudio(512, 5);
    const res = await upload(app, { bucket: 'lesson-images', mime: 'image/webp', bytes });
    const head = await request(app).head(`/files/${res.body.data.id}`);
    expect(head.status).toBe(200);
    expect(head.headers['content-length']).toBe(String(bytes.length));
  });

  it('deduplicates identical content within the same bucket', async () => {
    const app = createApp();
    const bucket = 'lesson-audio-dedup';
    const bytes = fakeAudio(1024, 9);

    const first = await upload(app, { bucket, mime: 'audio/wav', bytes });
    expect(first.body.data.deduplicated).toBe(false);

    const second = await upload(app, { bucket, mime: 'audio/wav', bytes });
    expect(second.body.data.deduplicated).toBe(true);
    expect(second.body.data.id).toBe(first.body.data.id);

    // Only one entry should show up in the listing.
    const list = await request(app).get('/api/v1/files').query({ bucket }).set('x-internal-api-key', KEY());
    expect(list.body.data.items).toHaveLength(1);
  });

  it('rejects an unsupported mime type', async () => {
    const app = createApp();
    const res = await upload(app, {
      bucket: 'lesson-audio',
      mime: 'application/x-msdownload',
      bytes: Buffer.from('MZ'),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid bucket slug', async () => {
    const app = createApp();
    const res = await upload(app, { bucket: '../../etc', mime: 'audio/mpeg', bytes: fakeAudio(32) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an upload without the internal key', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/files')
      .field('bucket', 'lesson-audio')
      .field('visibility', 'public')
      .attach('file', fakeAudio(32), { filename: 'a.mp3', contentType: 'audio/mpeg' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
