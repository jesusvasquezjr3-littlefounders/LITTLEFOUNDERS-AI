import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../config.js';



/*
 * CORS is an origin allowlist for exactly one consumer (the SPA), with
 * credentials deliberately off — auth travels in the Authorization header,
 * never cookies (§1.14). These tests pin the parts that break silently: an
 * unknown origin must be refused, and the export's metadata headers must
 * actually reach the page that asked for them.
 */
describe('CORS', () => {
  const allowed = getConfig().FRONTEND_URL;

  it('allows the configured SPA origin, without credentials', async () => {
    const res = await request(createApp()).get('/api/v1/health').set('Origin', allowed);
    expect(res.headers['access-control-allow-origin']).toBe(allowed);
    expect(res.headers.vary).toContain('Origin');
    // Allowing credentials would make a cookie-based attack surface real for
    // an API that never reads cookies in the first place.
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('refuses an unknown origin outright', async () => {
    const res = await request(createApp()).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight for the SPA and rejects it for anyone else', async () => {
    const ok = await request(createApp()).options('/api/v1/events').set('Origin', allowed);
    expect(ok.status).toBe(204);
    expect(ok.headers['access-control-allow-headers']).toContain('Authorization');

    const bad = await request(createApp()).options('/api/v1/events').set('Origin', 'https://evil.example');
    expect(bad.status).toBe(403);
  });

  /*
   * The insights export reports truncation in response headers. Cross-origin,
   * custom headers are invisible to JS unless named in
   * Access-Control-Expose-Headers — so omitting them turns "declared
   * truncation" straight back into silent truncation, with the server
   * believing it disclosed something the page could never read.
   */
  it('exposes the export metadata headers to the SPA', async () => {
    const res = await request(createApp()).get('/api/v1/health').set('Origin', allowed);
    const exposed = res.headers['access-control-expose-headers'] ?? '';
    expect(exposed).toContain('X-LF-Export-Rows');
    expect(exposed).toContain('X-LF-Export-Truncated');
    expect(exposed).toContain('X-LF-Export-Next-Offset');
  });
});
