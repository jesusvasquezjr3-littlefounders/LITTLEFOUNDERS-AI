import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetPulseCacheForTests } from '../services/pulse.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * Umami's behavioural data went unread: the service exposed a five-number
 * aggregate and no page consumed it, while twelve dimensions sat unused. These
 * cover the contract that makes them readable — and, more importantly, the two
 * ways this can go quietly wrong: an upstream failure rendered as zero, and a
 * window that disagrees with the Plausible panel on the same screen.
 */

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const auth = () => `Bearer ${mintToken({ sub: ADMIN_ID })}`;
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

interface Captured {
  url: string;
}

function stubUmami(opts: { metrics?: unknown; series?: unknown; fail?: boolean; captured?: Captured[] } = {}) {
  vi.stubEnv('UMAMI_URL', 'http://umami.test');
  vi.stubEnv('UMAMI_USERNAME', 'test-user');
  vi.stubEnv('UMAMI_PASSWORD', 'test-password-value');
  vi.stubEnv('UMAMI_WEBSITE_ID', '82166b5f-4bb2-4e33-9b58-6ee1f93fc1ac');
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      opts.captured?.push({ url });
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
      if (url.includes('/api/auth/login')) return Promise.resolve(jsonResponse(200, { token: 'umami-token' }));
      if (opts.fail) return Promise.resolve(jsonResponse(500, {}));
      if (url.includes('/pageviews')) return Promise.resolve(jsonResponse(200, opts.series ?? { pageviews: [], sessions: [] }));
      if (url.includes('/metrics')) return Promise.resolve(jsonResponse(200, opts.metrics ?? []));
      return Promise.resolve(jsonResponse(200, {}));
    }),
  );
}

beforeEach(() => {
  vi.resetModules();
  // Responses are memoized by resolved range at module scope; without this a
  // test that stubs a failing upstream can be answered by an earlier test.
  resetPulseCacheForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/v1/admin/analytics/behavior/breakdown', () => {
  it('returns rows for a dimension and asks Umami for that dimension', async () => {
    const captured: Captured[] = [];
    stubUmami({ metrics: [{ x: '/how-it-works', y: 25 }, { x: '/learn', y: 13 }], captured });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/behavior/breakdown?period=30d&dimension=path&limit=5')
      .set('Authorization', auth())
      .set('User-Agent', BROWSER_UA);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.dimension).toBe('path');
    expect(res.body.data.rows).toEqual([
      { label: '/how-it-works', value: 25 },
      { label: '/learn', value: 13 },
    ]);
    const call = captured.find((c) => c.url.includes('/metrics'));
    expect(call?.url).toContain('type=path');
    expect(call?.url).toContain('limit=5');
  });

  it('keeps an unrecorded value as a row instead of dropping it', async () => {
    // Umami returns x:null for "no referrer". Dropping those makes the rows
    // fail to sum to the total, which reads as data loss.
    stubUmami({ metrics: [{ x: null, y: 40 }, { x: 'google.com', y: 11 }] });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/behavior/breakdown?dimension=referrer')
      .set('Authorization', auth())
      .set('User-Agent', BROWSER_UA);
    expect(res.body.data.rows).toEqual([
      { label: '', value: 40 },
      { label: 'google.com', value: 11 },
    ]);
  });

  it('502s rather than reporting an empty breakdown when Umami fails', async () => {
    // The whole point: "no answer" must never be rendered as "no traffic".
    stubUmami({ fail: true });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/behavior/breakdown?dimension=browser')
      .set('Authorization', auth())
      .set('User-Agent', BROWSER_UA);
    expect(res.status).toBe(502);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
  });

  it('400s on a dimension Umami does not have', async () => {
    stubUmami();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/behavior/breakdown?dimension=favourite_colour')
      .set('Authorization', auth())
      .set('User-Agent', BROWSER_UA);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses a non-admin', async () => {
    stubUmami();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/behavior/breakdown?dimension=path')
      .set('User-Agent', BROWSER_UA);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/admin/analytics/behavior/series', () => {
  it('joins sessions to pageviews by DATE, not by index', async () => {
    /*
     * Umami returns two independent arrays. Zipping them positionally silently
     * attributes one day's sessions to another whenever they differ in length
     * or start — which is exactly what happens on a day with pageviews but no
     * completed session.
     */
    stubUmami({
      series: {
        pageviews: [
          { x: '2026-08-01T00:00:00Z', y: 10 },
          { x: '2026-08-02T00:00:00Z', y: 20 },
          { x: '2026-08-03T00:00:00Z', y: 30 },
        ],
        sessions: [
          { x: '2026-08-03T00:00:00Z', y: 7 },
          { x: '2026-08-01T00:00:00Z', y: 3 },
        ],
      },
    });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/behavior/series?period=7d')
      .set('Authorization', auth())
      .set('User-Agent', BROWSER_UA);
    expect(res.status).toBe(200);
    expect(res.body.data.series).toEqual([
      { date: '2026-08-01', pageviews: 10, sessions: 3 },
      { date: '2026-08-02', pageviews: 20, sessions: 0 },
      { date: '2026-08-03', pageviews: 30, sessions: 7 },
    ]);
  });

  it('resolves the same window the Plausible routes do', async () => {
    const captured: Captured[] = [];
    stubUmami({ captured });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/behavior/series?period=7d')
      .set('Authorization', auth())
      .set('User-Agent', BROWSER_UA);
    expect(res.status).toBe(200);
    expect(res.body.data.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.data.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(captured.find((c) => c.url.includes('/pageviews'))?.url).toContain('unit=day');
  });

  it('502s when Umami cannot answer', async () => {
    stubUmami({ fail: true });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/behavior/series')
      .set('Authorization', auth())
      .set('User-Agent', BROWSER_UA);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
  });
});
