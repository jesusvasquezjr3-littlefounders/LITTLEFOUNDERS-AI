import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { fakeAudio, fakeGlb, KEY, upload } from './helpers.js';

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

  it('stores a .glb and serves it back with the glTF content type', async () => {
    const app = createApp();
    const bytes = fakeGlb('tutor-room');

    const res = await upload(app, {
      bucket: 'tutor-scenes',
      mime: 'model/gltf-binary',
      bytes,
      filename: 'liruf.glb',
    });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.id).toMatch(/^tutor-scenes\/[a-f0-9]{64}\.glb$/);

    // three.js GLTFLoader fetches this URL directly from the browser, so the
    // content type has to survive the roundtrip — a wrong one makes the load
    // fail in a way that looks like a corrupt asset.
    // `responseType('blob')` is required because superagent has no built-in
    // parser for `model/gltf-binary` and would otherwise hand back a parsed
    // object instead of the bytes — an artifact of the test client, not of
    // what Depot actually serves.
    const dl = await request(app).get(`/files/${res.body.data.id}`).responseType('blob');
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toBe('model/gltf-binary');
    expect(Buffer.compare(dl.body as Buffer, bytes)).toBe(0);
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

describe('cross-origin reads', () => {
  /*
   * THE BUG THIS SECTION EXISTS FOR.
   *
   * Every consumer of this route until now loaded media through an <audio> or
   * <img> tag, which are no-cors requests and need no CORS header at all. The
   * Tutor's 3D scene is the first to read the bytes IN SCRIPT, through three.js
   * GLTFLoader, which uses fetch/XHR — and those are subject to CORS.
   *
   * So the published scene failed in the browser with "Failed to fetch" while
   * `curl` reported 200, the right mime and the exact byte count. A shell client
   * cannot see this, which is why it reached production.
   */
  it('lets a browser READ a public object, not just fetch it', async () => {
    const app = createApp();
    const res = await upload(app, {
      bucket: 'tutor-scenes',
      visibility: 'public',
      mime: 'model/gltf-binary',
      bytes: fakeGlb('cors-public'),
    });
    expect(res.status).toBe(200);

    const dl = await request(app)
      .get(`/files/${res.body.data.id}`)
      .set('Origin', 'https://littlefounders.ai');
    expect(dl.status).toBe(200);
    expect(dl.headers['access-control-allow-origin']).toBe('*');
    // Without these exposed, a loader sees the body but not its length, and a
    // ranged read cannot tell where it landed.
    expect(dl.headers['access-control-expose-headers']).toContain('Content-Length');
    expect(dl.headers['access-control-expose-headers']).toContain('Content-Range');
  });

  it('never lets a browser read an INTERNAL object cross-origin', async () => {
    // Even with the key, no CORS header means script in a page can never read
    // it — the only way in stays server-to-server.
    const app = createApp();
    const res = await upload(app, {
      bucket: 'lesson-audio',
      visibility: 'internal',
      mime: 'audio/mpeg',
      bytes: fakeAudio(512, 11),
    });
    expect(res.status).toBe(200);

    const dl = await request(app)
      .get(`/files/${res.body.data.id}`)
      .set('x-internal-api-key', KEY())
      .set('Origin', 'https://littlefounders.ai');
    expect(dl.status).toBe(200);
    expect(dl.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('scopes the cache to the client for internal objects', async () => {
    // `public` on a response that required a key invites a shared cache to hand
    // it to someone who has none.
    const app = createApp();
    const res = await upload(app, {
      bucket: 'lesson-audio',
      visibility: 'internal',
      mime: 'audio/mpeg',
      bytes: fakeAudio(512, 13),
    });
    const dl = await request(app)
      .get(`/files/${res.body.data.id}`)
      .set('x-internal-api-key', KEY());
    expect(dl.headers['cache-control']).toBe('private, max-age=31536000, immutable');
  });

  it('answers the preflight a ranged read triggers', async () => {
    /*
     * `Range` is NOT a CORS-safelisted request header, so a ranged read from
     * script is preflighted — and this route advertises `Accept-Ranges: bytes`,
     * so callers will try one.
     */
    const app = createApp();
    const res = await upload(app, {
      bucket: 'tutor-scenes',
      visibility: 'public',
      mime: 'model/gltf-binary',
      bytes: fakeGlb('cors-preflight'),
    });
    const pre = await request(app)
      .options(`/files/${res.body.data.id}`)
      .set('Origin', 'https://littlefounders.ai')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'range');
    expect(pre.status).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe('*');
    expect(pre.headers['access-control-allow-headers']).toContain('Range');
    expect(pre.headers['access-control-allow-methods']).toContain('GET');
  });
});
