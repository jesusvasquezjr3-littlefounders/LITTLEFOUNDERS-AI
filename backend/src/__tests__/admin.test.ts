import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetPulseForTests } from '../services/pulse.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * /api/v1/admin — Supertest happy + sad paths (AGENTS.md §7 "Adding an
 * endpoint"). Upstreams (PostgREST for roles, Plausible, Umami, Kuma) are
 * stubbed at the fetch layer; Pulse env is stubbed per-test via vi.stubEnv
 * (services/pulse.ts parses lazily, resetPulseForTests() drops its caches).
 */

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

const PLAUSIBLE_AGG = {
  results: [{ dimensions: [], metrics: [120, 340, 41.5, 95] }],
};
const PLAUSIBLE_SERIES = {
  results: [
    { dimensions: ['2026-07-19'], metrics: [60, 170] },
    { dimensions: ['2026-07-20'], metrics: [60, 170] },
  ],
};
const UMAMI_STATS = {
  pageviews: { value: 500 },
  visitors: { value: 200 },
  visits: { value: 250 },
  bounces: { value: 90 },
  totaltime: { value: 60000 },
};
const KUMA_PAGE = {
  publicGroupList: [
    { name: 'Services', monitorList: [{ id: 1, name: 'backend' }, { id: 2, name: 'filebase' }] },
  ],
};
const KUMA_BEATS = {
  heartbeatList: { '1': [{ status: 1, ping: 42 }], '2': [{ status: 0, ping: null }] },
  uptimeList: { '1_24': 0.999, '2_24': 0.5 },
};

function stubPulseEnv(): void {
  vi.stubEnv('PLAUSIBLE_URL', 'http://plausible.test');
  vi.stubEnv('PLAUSIBLE_API_KEY', 'plausible-key-0123456789');
  vi.stubEnv('PLAUSIBLE_SITE_ID', 'littlefounders.ai');
  vi.stubEnv('UMAMI_URL', 'http://umami.test');
  vi.stubEnv('UMAMI_USERNAME', 'core');
  vi.stubEnv('UMAMI_PASSWORD', 'core-password');
  vi.stubEnv('UMAMI_WEBSITE_ID', 'site-1');
  vi.stubEnv('KUMA_URL', 'http://kuma.test');
}

/** fetch stub: PostgREST roles + the three Pulse upstreams. */
function stubFetch(opts: { roles?: string[]; plausibleStatus?: number; umamiStatus?: number; kumaStatus?: number } = {}) {
  const roles = (opts.roles ?? ['admin']).map((role) => ({ role }));
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, roles));
      if (url.includes('plausible.test/api/v2/query')) {
        if (opts.plausibleStatus) return Promise.resolve(jsonResponse(opts.plausibleStatus, {}));
        const body = JSON.parse(String(init?.body ?? '{}')) as { dimensions?: string[] };
        return Promise.resolve(jsonResponse(200, body.dimensions?.length ? PLAUSIBLE_SERIES : PLAUSIBLE_AGG));
      }
      if (url.includes('umami.test/api/auth/login')) return Promise.resolve(jsonResponse(200, { token: 'umami-token' }));
      if (url.includes('umami.test/api/websites/')) {
        return Promise.resolve(jsonResponse(opts.umamiStatus ?? 200, opts.umamiStatus ? {} : UMAMI_STATS));
      }
      if (url.includes('kuma.test/api/status-page/heartbeat/')) {
        return Promise.resolve(jsonResponse(opts.kumaStatus ?? 200, opts.kumaStatus ? {} : KUMA_BEATS));
      }
      if (url.includes('kuma.test/api/status-page/')) {
        return Promise.resolve(jsonResponse(opts.kumaStatus ?? 200, opts.kumaStatus ? {} : KUMA_PAGE));
      }
      throw new Error(`admin.test: unexpected fetch ${url}`);
    }),
  );
}

beforeEach(() => resetPulseForTests());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetPulseForTests();
});

const authed = () => `Bearer ${mintToken({ sub: ADMIN_ID, email: 'staff@littlefounders.ai' })}`;

describe('GET /api/v1/admin/analytics/overview', () => {
  it('returns aggregate + timeseries for an admin', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/analytics/overview?period=7d').set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.aggregate).toEqual({ visitors: 120, pageviews: 340, bounce_rate: 41.5, visit_duration: 95 });
    expect(res.body.data.timeseries).toHaveLength(2);
    expect(res.body.data.timeseries[0]).toEqual({ date: '2026-07-19', visitors: 60, pageviews: 170 });
  });

  it('also unlocks for a superadmin', async () => {
    stubPulseEnv();
    stubFetch({ roles: ['superadmin'] });
    const res = await request(createApp()).get('/api/v1/admin/analytics/overview').set('Authorization', authed());
    expect(res.status).toBe(200);
  });

  it('403s for a non-staff role', async () => {
    stubPulseEnv();
    stubFetch({ roles: ['universal'] });
    const res = await request(createApp()).get('/api/v1/admin/analytics/overview').set('Authorization', authed());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/admin/analytics/overview');
    expect(res.status).toBe(401);
  });

  it('400s on an invalid period', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/analytics/overview?period=99y').set('Authorization', authed());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('503s when Plausible is not configured', async () => {
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/analytics/overview').set('Authorization', authed());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PULSE_UNCONFIGURED');
  });

  it('502s when Plausible errors', async () => {
    stubPulseEnv();
    stubFetch({ plausibleStatus: 500 });
    const res = await request(createApp()).get('/api/v1/admin/analytics/overview').set('Authorization', authed());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
  });
});

describe('GET /api/v1/admin/analytics/behavior', () => {
  it('returns Umami stats (logs in, unwraps {value} metrics)', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/analytics/behavior?period=30d').set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ period: '30d', pageviews: 500, visitors: 200, visits: 250, bounces: 90, totaltime: 60000 });
  });

  it('502s when Umami errors after login', async () => {
    stubPulseEnv();
    stubFetch({ umamiStatus: 500 });
    const res = await request(createApp()).get('/api/v1/admin/analytics/behavior').set('Authorization', authed());
    expect(res.status).toBe(502);
  });
});

describe('GET /api/v1/admin/health/services', () => {
  it('maps Kuma monitors to status + latency + uptime', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/health/services').set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ total: 2, down: 1 });
    expect(res.body.data.monitors[0]).toEqual({ id: 1, name: 'backend', status: 1, pingMs: 42, uptime24h: 0.999 });
  });

  it('503s when Kuma is not configured', async () => {
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/health/services').set('Authorization', authed());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PULSE_UNCONFIGURED');
  });
});
