import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, SERVICE } from '../app.js';
import { OBJECT_TILE_STYLE_VERSION, STYLE_VERSION } from '../service/pictures.js';

describe('GET /health', () => {
  it('returns the ok envelope with the composite style version', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        service: SERVICE,
        version: expect.any(String),
        status: 'ok',
        // Forge preflight-asserts its FORGE_ILLUSTRATION_STYLE_VERSION against
        // this before a paid run.
        style_version: `${STYLE_VERSION}+${OBJECT_TILE_STYLE_VERSION}`,
      },
      error: null,
    });
  });

  it('unknown routes return the error envelope', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
