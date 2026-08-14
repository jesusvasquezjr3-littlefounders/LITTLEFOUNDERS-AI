import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  isIpExcluded,
  normalizeIp,
  parseNetwork,
  resetExclusionsForTests,
} from '../services/analyticsExclusions.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * Internal-traffic exclusion registry (Vault 0045) — the control that makes
 * staff traffic stop counting. Covers the address arithmetic (where a silent
 * bug would either exclude nobody or exclude the whole internet), the admin
 * CRUD contract, and the two enforcement points: the public tracking decision
 * and first-party event ingest.
 */

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const OFFICE_IP = '203.0.113.7';

interface RestCall {
  url: string;
  method: string;
  body: unknown;
}

function exclusionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    network: '203.0.113.0/24',
    label: 'Office',
    reason: null,
    created_by: ADMIN_ID,
    created_at: '2026-08-13T00:00:00.000Z',
    revoked_at: null,
    revoked_by: null,
    ...overrides,
  };
}

/**
 * fetch stub over PostgREST. `exclusions: null` simulates Vault being
 * unreachable for the registry read specifically — the case that must never
 * be reported as "nothing is excluded".
 */
function stubRest(opts: {
  exclusions?: Record<string, unknown>[] | null;
  sightings?: Record<string, unknown>[] | null;
  calls?: RestCall[];
  writeStatus?: number;
  patchRows?: Record<string, unknown>[];
} = {}) {
  const { exclusions = [exclusionRow()], sightings = [], writeStatus = 201 } = opts;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      opts.calls?.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });

      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
      if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(jsonResponse(201, {}));
      if (url.includes('/rest/v1/rpc/record_staff_ip_sighting')) return Promise.resolve(jsonResponse(200, {}));
      if (url.includes('/rest/v1/profiles')) {
        return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, display_name: 'Ada' }]));
      }
      if (url.includes('/rest/v1/analytics_staff_ip_sightings')) {
        if (sightings === null) return Promise.resolve(jsonResponse(500, {}));
        return Promise.resolve(jsonResponse(200, sightings));
      }
      if (url.includes('/rest/v1/analytics_ip_exclusions')) {
        if (method === 'POST') return Promise.resolve(jsonResponse(writeStatus, [exclusionRow(opts.patchRows?.[0])]));
        if (method === 'PATCH') return Promise.resolve(jsonResponse(200, opts.patchRows ?? [exclusionRow({ revoked_at: '2026-08-13T01:00:00.000Z' })]));
        if (exclusions === null) return Promise.resolve(jsonResponse(500, {}));
        return Promise.resolve(jsonResponse(200, exclusions));
      }
      throw new Error(`analytics-exclusions.test: unexpected fetch ${url}`);
    }),
  );
}

beforeEach(() => resetExclusionsForTests());
afterEach(() => {
  vi.unstubAllGlobals();
  resetExclusionsForTests();
});

describe('address parsing', () => {
  it('treats a bare address as a single-host network', () => {
    expect(parseNetwork('203.0.113.7')).toMatchObject({ network: '203.0.113.7/32', version: 4 });
    expect(parseNetwork('2001:db8::1')).toMatchObject({ prefix: 128, version: 6 });
  });

  it('masks host bits — Postgres cidr rejects 203.0.113.7/24 outright', () => {
    expect(parseNetwork('203.0.113.7/24')).toMatchObject({ network: '203.0.113.0/24' });
    expect(parseNetwork('10.1.2.3/16')).toMatchObject({ network: '10.1.0.0/16' });
    const v6 = parseNetwork('2001:db8:1:2:3:4:5:6/48');
    expect(typeof v6 === 'object' && v6.network).toBe('2001:db8:1:0:0:0:0:0/48');
  });

  it('refuses a prefix broad enough to silence the whole platform', () => {
    expect(parseNetwork('0.0.0.0/0')).toBe('PREFIX_TOO_BROAD');
    expect(parseNetwork('10.0.0.0/8')).toBe('PREFIX_TOO_BROAD');
    expect(parseNetwork('2001:db8::/16')).toBe('PREFIX_TOO_BROAD');
  });

  it('rejects anything that is not an address or range', () => {
    for (const bad of ['', 'localhost', '203.0.113.256', '203.0.113.7/33', '203.0.113.7/x', 'DROP TABLE']) {
      expect(parseNetwork(bad)).toBe('INVALID');
    }
  });

  it('normalizes the forms Express actually hands us', () => {
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('[2001:db8::1]')).toBe('2001:db8::1');
    expect(normalizeIp('fe80::1%en0')).toBe('fe80::1');
    expect(normalizeIp('not-an-ip')).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });
});

describe('isIpExcluded', () => {
  it('matches an address inside an excluded range, and only inside it', async () => {
    stubRest();
    expect(await isIpExcluded(OFFICE_IP)).toBe(true);
    expect(await isIpExcluded('198.51.100.4')).toBe(false);
  });

  it('matches through the IPv4-mapped IPv6 form a dual-stack socket reports', async () => {
    stubRest();
    expect(await isIpExcluded('::ffff:203.0.113.7')).toBe(true);
  });

  it('answers UNKNOWN — never "not excluded" — when Vault cannot be read', async () => {
    stubRest({ exclusions: null });
    expect(await isIpExcluded(OFFICE_IP)).toBeNull();
  });
});

describe('GET /api/v1/analytics/tracking-decision', () => {
  it('tells an excluded visitor not to load any tracker', async () => {
    stubRest();
    const res = await request(createApp())
      .get('/api/v1/analytics/tracking-decision')
      .set('X-Forwarded-For', OFFICE_IP);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ excluded: true, degraded: false });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('keeps measuring a normal visitor', async () => {
    stubRest();
    const res = await request(createApp())
      .get('/api/v1/analytics/tracking-decision')
      .set('X-Forwarded-For', '198.51.100.4');
    expect(res.body.data).toEqual({ excluded: false, degraded: false });
  });

  it('flags a degraded answer instead of asserting "not excluded"', async () => {
    stubRest({ exclusions: null });
    const res = await request(createApp())
      .get('/api/v1/analytics/tracking-decision')
      .set('X-Forwarded-For', OFFICE_IP);
    expect(res.body.data).toEqual({ excluded: false, degraded: true });
  });
});

describe('POST /api/v1/events — internal-traffic gate', () => {
  const batch = { anonId: '44444444-4444-4444-8444-444444444444', events: [{ event: 'page_view', routeClass: 'marketing' }] };

  it('drops an excluded network without storing anything', async () => {
    const calls: RestCall[] = [];
    stubRest({ calls });
    const res = await request(createApp())
      .post('/api/v1/events')
      .set('X-Forwarded-For', OFFICE_IP)
      .send(batch);
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ accepted: 0 });
    expect(calls.some((c) => c.url.includes('learning_events') || c.url.includes('anon_visitors'))).toBe(false);
  });
});

describe('/api/v1/admin/analytics/exclusions', () => {
  const auth = () => `Bearer ${mintToken({ sub: ADMIN_ID })}`;

  it('reports the caller\'s own address and whether it is already covered', async () => {
    stubRest({
      sightings: [
        { address: '198.51.100.9', user_id: ADMIN_ID, first_seen_at: '2026-08-01T00:00:00.000Z', last_seen_at: '2026-08-13T00:00:00.000Z', hits: 12 },
        { address: OFFICE_IP, user_id: ADMIN_ID, first_seen_at: '2026-08-01T00:00:00.000Z', last_seen_at: '2026-08-13T00:00:00.000Z', hits: 40 },
      ],
    });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/exclusions')
      .set('Authorization', auth())
      .set('X-Forwarded-For', OFFICE_IP);
    expect(res.status).toBe(200);
    expect(res.body.data.self).toEqual({ ip: OFFICE_IP, excluded: true });
    expect(res.body.data.active).toHaveLength(1);
    // The already-covered sighting is not offered again; the open one is.
    expect(res.body.data.suggestions.map((s: { address: string }) => s.address)).toEqual(['198.51.100.9']);
    expect(res.body.data.suggestions[0].displayName).toBe('Ada');
    expect(res.body.data.coveredAddresses).toEqual([OFFICE_IP]);
  });

  it('answers 502 rather than an empty list when Vault is unreachable', async () => {
    stubRest({ exclusions: null });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/exclusions')
      .set('Authorization', auth())
      .set('X-Forwarded-For', OFFICE_IP);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('creates an exclusion from a typed range and audit-logs it', async () => {
    const calls: RestCall[] = [];
    stubRest({ exclusions: [], calls });
    const res = await request(createApp())
      .post('/api/v1/admin/analytics/exclusions')
      .set('Authorization', auth())
      .send({ network: '198.51.100.42/24', label: 'Office' });
    expect(res.status).toBe(201);
    const insert = calls.find((c) => c.method === 'POST' && c.url.includes('analytics_ip_exclusions'));
    expect((insert?.body as { network: string }).network).toBe('198.51.100.0/24');
    expect(calls.some((c) => c.url.includes('audit_logs'))).toBe(true);
  });

  it('excludes the caller\'s current address with no input at all', async () => {
    const calls: RestCall[] = [];
    stubRest({ exclusions: [], calls });
    const res = await request(createApp())
      .post('/api/v1/admin/analytics/exclusions/self')
      .set('Authorization', auth())
      .set('X-Forwarded-For', '198.51.100.9')
      .send({});
    expect(res.status).toBe(201);
    const insert = calls.find((c) => c.method === 'POST' && c.url.includes('analytics_ip_exclusions'));
    expect((insert?.body as { network: string }).network).toBe('198.51.100.9/32');
  });

  it('refuses an address an active range already covers', async () => {
    stubRest();
    const res = await request(createApp())
      .post('/api/v1/admin/analytics/exclusions')
      .set('Authorization', auth())
      .send({ network: OFFICE_IP, label: 'Duplicate' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('refuses a prefix that would silence the platform', async () => {
    stubRest({ exclusions: [] });
    const res = await request(createApp())
      .post('/api/v1/admin/analytics/exclusions')
      .set('Authorization', auth())
      .send({ network: '0.0.0.0/0', label: 'Everything' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('prefix too broad');
  });

  it('revokes softly and 404s on an id that is not active', async () => {
    stubRest();
    const revoked = await request(createApp())
      .delete('/api/v1/admin/analytics/exclusions/33333333-3333-4333-8333-333333333333')
      .set('Authorization', auth());
    expect(revoked.status).toBe(200);
    expect(revoked.body.data.revoked_at).toBeTruthy();

    resetExclusionsForTests();
    stubRest({ patchRows: [] });
    const missing = await request(createApp())
      .delete('/api/v1/admin/analytics/exclusions/33333333-3333-4333-8333-333333333333')
      .set('Authorization', auth());
    expect(missing.status).toBe(404);
  });

  it('records the staff address that makes the request (auto-detection)', async () => {
    const calls: RestCall[] = [];
    stubRest({ calls });
    await request(createApp())
      .get('/api/v1/admin/analytics/exclusions')
      .set('Authorization', auth())
      .set('X-Forwarded-For', '198.51.100.77');
    const sighting = calls.find((c) => c.url.includes('rpc/record_staff_ip_sighting'));
    expect(sighting?.body).toEqual({ p_address: '198.51.100.77', p_user_id: ADMIN_ID });
  });
});
