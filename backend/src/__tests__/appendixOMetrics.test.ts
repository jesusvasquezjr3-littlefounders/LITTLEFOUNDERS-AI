import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { buildDisclosureCoverage, type DisclosureCounts } from '../services/disclosureCoverage.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * Gap-fix F2-data-platform at the Core boundary, Appendix O Part 1:
 *   - 1.1 (H.1): GET /admin/analytics/consent-coverage (view_analytics),
 *     the teen/guest disclosure coverage against its 100% target;
 *   - 1.3 (H.3): GET /admin/intel/alerts/delivery reaches the warehouse's
 *     delivery rate through the read-only /admin/intel proxy.
 * The SQL is proven in database/scripts/verify-analytics-disclosure-postgres.py;
 * the warehouse computation in dataintel/src/__tests__/alert-delivery-rate.test.ts.
 */

const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const auth = () => `Bearer ${mintToken({ sub: STAFF_ID, email: 'staff@littlefounders.ai' })}`;

const COUNTS: DisclosureCounts = {
  window: { from: '2026-08-28T00:00:00Z', to: '2026-09-27T00:00:00Z' },
  teens: { active: 8, disclosed: 6, optedIn: 4, optedOut: 2, protectedOrigin: 1, measuredWithoutOptIn: 1, covered: 6 },
  guests: { active: 2, suppressed: 2, measured: 0 },
};

interface World {
  roles?: string[];
  permissions?: string[];
  coverage?: { status: number; body: unknown };
}

function stub(world: World = {}) {
  const calls: { url: string; method: string; body?: string }[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, (world.roles ?? ['admin']).map((role) => ({ role }))));
    if (url.includes('/rest/v1/admin_permissions')) {
      return Promise.resolve(jsonResponse(200, (world.permissions ?? ['view_analytics']).map((permission) => ({ user_id: STAFF_ID, permission }))));
    }
    if (url.includes('/rest/v1/rpc/analytics_disclosure_coverage')) {
      return Promise.resolve(jsonResponse(world.coverage?.status ?? 200, world.coverage?.body ?? COUNTS));
    }
    if (url.includes('/api/v1/intel/alerts/delivery')) {
      return Promise.resolve(jsonResponse(200, {
        data: { days: 30, triggered: 4, delivered: 3, failed: 1, unconfigured: 0, pending: 0, rate: 0.75, target: 1 }, error: null,
      }));
    }
    return Promise.resolve(jsonResponse(200, []));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('Appendix O 1.1 — GET /api/v1/admin/analytics/consent-coverage', () => {
  it('reports the covered share of active teens and guests against the 100% target', async () => {
    const calls = stub();
    const res = await request(createApp()).get('/api/v1/admin/analytics/consent-coverage?days=30').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ days: 30, covered: 8, population: 10, coverage: 0.8, target: 1, status: 'missed' });
    expect(res.body.data.teens.measuredWithoutOptIn).toBe(1);
    const rpc = calls.find((c) => c.url.includes('analytics_disclosure_coverage'));
    expect(rpc?.method).toBe('POST');
    const window = JSON.parse(rpc!.body!) as { p_from: string; p_to: string };
    expect(Date.parse(window.p_to) - Date.parse(window.p_from)).toBe(30 * 86_400_000);
    expect(JSON.stringify(res.body.data)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('refuses unknown query fields and an out-of-range window before any read', async () => {
    const calls = stub();
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage?days=0').set('Authorization', auth())).status).toBe(400);
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage?days=367').set('Authorization', auth())).status).toBe(400);
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage?user=x').set('Authorization', auth())).status).toBe(400);
    expect(calls.some((c) => c.url.includes('analytics_disclosure_coverage'))).toBe(false);
  });

  it('answers 502, never zeros, when the database answer is missing or malformed', async () => {
    stub({ coverage: { status: 200, body: { ...COUNTS, teens: { active: 'many' } } } });
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage').set('Authorization', auth())).status).toBe(502);
    stub({ coverage: { status: 500, body: null } });
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage').set('Authorization', auth())).status).toBe(502);
  });

  it('refuses staff without view_analytics, a family account, a learner and no session', async () => {
    const calls = stub({ permissions: ['manage_support', 'manage_users'] });
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage').set('Authorization', auth())).status).toBe(403);
    expect(calls.some((c) => c.url.includes('analytics_disclosure_coverage'))).toBe(false);
    stub({ roles: ['parent'] });
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage').set('Authorization', auth())).status).toBe(403);
    stub({ roles: ['universal'] });
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage').set('Authorization', auth())).status).toBe(403);
    expect((await request(createApp()).get('/api/v1/admin/analytics/consent-coverage')).status).toBe(401);
  });

  it('computes the verdict from counts: met at 100%, no data for an empty population', () => {
    expect(buildDisclosureCoverage({ ...COUNTS, teens: { ...COUNTS.teens, covered: 8, measuredWithoutOptIn: 0 } }, 30))
      .toMatchObject({ coverage: 1, status: 'met' });
    expect(buildDisclosureCoverage({ ...COUNTS, teens: { ...COUNTS.teens, active: 0, covered: 0, measuredWithoutOptIn: 0 }, guests: { active: 0, suppressed: 0, measured: 0 } }, 7))
      .toMatchObject({ population: 0, coverage: null, status: 'no_data', gap: { measured: 0, rate: null, status: 'no_data' } });
  });

  it('reports the Consent-Gate Population Gap Rate: teens measured without an opt-in plus measured guests, target zero', () => {
    expect(buildDisclosureCoverage(COUNTS, 30).gap).toEqual({ measured: 1, rate: 0.1, target: 0, status: 'missed' });
    expect(buildDisclosureCoverage({ ...COUNTS, guests: { active: 2, suppressed: 1, measured: 1 } }, 30).gap)
      .toMatchObject({ measured: 2, rate: 0.2, status: 'missed' });
    expect(buildDisclosureCoverage({ ...COUNTS, teens: { ...COUNTS.teens, measuredWithoutOptIn: 0 } }, 30).gap)
      .toMatchObject({ measured: 0, rate: 0, status: 'met' });
  });
});

describe('Appendix O 1.3 — GET /api/v1/admin/intel/alerts/delivery', () => {
  it('reaches the warehouse delivery rate through the read-only proxy', async () => {
    const calls = stub();
    const res = await request(createApp()).get('/api/v1/admin/intel/alerts/delivery?days=30').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ triggered: 4, delivered: 3, rate: 0.75, target: 1 });
    expect(calls.some((c) => c.url.endsWith('/api/v1/intel/alerts/delivery?days=30') && c.method === 'GET')).toBe(true);
  });

  it('refuses staff without view_analytics before the warehouse is reached', async () => {
    const calls = stub({ permissions: ['manage_support'] });
    expect((await request(createApp()).get('/api/v1/admin/intel/alerts/delivery').set('Authorization', auth())).status).toBe(403);
    expect(calls.some((c) => c.url.includes('/api/v1/intel/'))).toBe(false);
  });
});
