import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { fakeAudio, KEY, upload } from './helpers.js';

describe('DELETE /api/v1/files/:bucket/:hash.:ext', () => {
  it('removes the object and its metadata', async () => {
    const app = createApp();
    const res = await upload(app, { bucket: 'lesson-audio', mime: 'audio/ogg', bytes: fakeAudio(128, 3) });
    const id = res.body.data.id as string;

    const del = await request(app).delete(`/api/v1/files/${id}`).set('x-internal-api-key', KEY());
    expect(del.status).toBe(200);
    expect(del.body.data).toEqual({ deleted: true, id });

    const dl = await request(app).get(`/files/${id}`);
    expect(dl.status).toBe(404);
  });

  it('404s deleting an object that does not exist', async () => {
    const app = createApp();
    const missingId = 'lesson-audio/' + 'a'.repeat(64) + '.mp3';
    const del = await request(app).delete(`/api/v1/files/${missingId}`).set('x-internal-api-key', KEY());
    expect(del.status).toBe(404);
    expect(del.body.error.code).toBe('NOT_FOUND');
  });

  it('requires the internal key', async () => {
    const app = createApp();
    const res = await upload(app, { bucket: 'lesson-audio', mime: 'audio/ogg', bytes: fakeAudio(128, 4) });
    const del = await request(app).delete(`/api/v1/files/${res.body.data.id}`);
    expect(del.status).toBe(401);
  });
});
