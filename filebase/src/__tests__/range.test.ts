import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { fakeAudio, upload } from './helpers.js';

describe('Range requests', () => {
  it('returns a 206 with the correct byte slice', async () => {
    const app = createApp();
    const bytes = fakeAudio(2000, 11);
    const res = await upload(app, { bucket: 'lesson-audio', mime: 'audio/mpeg', bytes });

    const range = await request(app).get(`/files/${res.body.data.id}`).set('Range', 'bytes=100-199');
    expect(range.status).toBe(206);
    expect(range.headers['content-range']).toBe(`bytes 100-199/${bytes.length}`);
    expect(range.headers['content-length']).toBe('100');
    expect(Buffer.compare(range.body as Buffer, bytes.subarray(100, 200))).toBe(0);
  });

  it('supports an open-ended range (bytes=N-)', async () => {
    const app = createApp();
    const bytes = fakeAudio(500, 2);
    const res = await upload(app, { bucket: 'lesson-audio', mime: 'audio/mpeg', bytes });

    const range = await request(app).get(`/files/${res.body.data.id}`).set('Range', 'bytes=450-');
    expect(range.status).toBe(206);
    expect(Buffer.compare(range.body as Buffer, bytes.subarray(450))).toBe(0);
  });

  it('returns 416 when the range starts past the end of the file', async () => {
    const app = createApp();
    const bytes = fakeAudio(100, 4);
    const res = await upload(app, { bucket: 'lesson-audio', mime: 'audio/mpeg', bytes });

    const range = await request(app).get(`/files/${res.body.data.id}`).set('Range', 'bytes=5000-6000');
    expect(range.status).toBe(416);
    expect(range.body.error.code).toBe('VALIDATION_ERROR');
  });
});
