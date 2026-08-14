import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Response as SupertestResponse } from 'superagent';
import { createApp } from '../app.js';
import { ACQUISITION_SCOPE } from '../services/pulse.js';
import { resetPulseForTests } from '../services/pulse.js';
import { resetExclusionsForTests } from '../services/analyticsExclusions.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * Requests in these tests carry a real browser agent because production ones
 * always do. Core drops analytics traffic with a missing or crawler user agent
 * (services/botDetection.ts), so a UA-less supertest request is not a neutral
 * default — it is a bot as far as the gate is concerned.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';


/*
 * /api/v1/admin/analytics — breakdown / report / report.pdf / exclusions
 * (admin.test.ts pattern: Plausible + the PostgREST role check stubbed at the
 * fetch layer, Pulse env via vi.stubEnv, caches dropped between tests).
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
const PLAUSIBLE_BREAKDOWN = {
  results: [
    { dimensions: ['Google'], metrics: [90, 210, 40.2, 87] },
    { dimensions: ['Direct / None'], metrics: [30, 130, 55.1, 61] },
  ],
};

function stubPulseEnv(): void {
  vi.stubEnv('PLAUSIBLE_URL', 'http://plausible.test');
  vi.stubEnv('PLAUSIBLE_API_KEY', 'plausible-key-0123456789');
  vi.stubEnv('PLAUSIBLE_SITE_ID', 'littlefounders.ai');
}

interface CapturedQuery {
  dimensions?: string[];
  metrics?: string[];
  order_by?: [string, string][];
  pagination?: { limit: number };
  filters?: unknown;
}

/** fetch stub: PostgREST role check + Plausible v2 (agg vs timeseries vs breakdown by body shape). */
function stubFetch(opts: { plausibleStatus?: number; capture?: CapturedQuery[] } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
      if (url.includes('plausible.test/api/v2/query')) {
        if (opts.plausibleStatus) return Promise.resolve(jsonResponse(opts.plausibleStatus, {}));
        const body = JSON.parse(String(init?.body ?? '{}')) as CapturedQuery;
        opts.capture?.push(body);
        if (!body.dimensions?.length) return Promise.resolve(jsonResponse(200, PLAUSIBLE_AGG));
        if (body.dimensions[0] === 'time:day') return Promise.resolve(jsonResponse(200, PLAUSIBLE_SERIES));
        return Promise.resolve(jsonResponse(200, PLAUSIBLE_BREAKDOWN));
      }
      throw new Error(`analytics.test: unexpected fetch ${url}`);
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

const ROW_SHAPE = { label: 'Google', visitors: 90, pageviews: 210, bounceRate: 40.2, visitDuration: 87 };

describe('GET /api/v1/admin/analytics/breakdown', () => {
  it('returns camelCase rows and sends the v2 breakdown query shape', async () => {
    stubPulseEnv();
    const capture: CapturedQuery[] = [];
    stubFetch({ capture });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/breakdown?period=7d&dimension=source&limit=5')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.period).toBe('7d');
    expect(res.body.data.dimension).toBe('source');
    expect(res.body.data.rows).toEqual([ROW_SHAPE, { label: 'Direct / None', visitors: 30, pageviews: 130, bounceRate: 55.1, visitDuration: 61 }]);
    expect(capture).toHaveLength(1);
    expect(capture[0]).toMatchObject({
      metrics: ['visitors', 'pageviews', 'bounce_rate', 'visit_duration'],
      dimensions: ['visit:source'],
      order_by: [['visitors', 'desc']],
      pagination: { limit: 5 },
      include: { imports: true }, // GA4-imported history is merged into every query
    });
    /*
     * Every Plausible query carries the acquisition scope, even when the
     * caller asked for no filters — the stored history predates the
     * autoCapturePageviews fix and contains /admin/* and product routes that
     * were never in scope (RUNBOOK, 2026-08-14). It is applied inside
     * plausibleQuery so no call site can omit it.
     */
    expect(capture[0]?.filters).toEqual([ACQUISITION_SCOPE]);
  });

  it('passes validated filters through to Plausible, ANDed with the acquisition scope', async () => {
    stubPulseEnv();
    const capture: CapturedQuery[] = [];
    stubFetch({ capture });
    const filters = [['is', 'visit:country', ['US']]];
    const res = await request(createApp())
      .get(`/api/v1/admin/analytics/breakdown?dimension=page&filters=${encodeURIComponent(JSON.stringify(filters))}`)
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    // Caller filters are preserved verbatim, ANDed after the always-on scope.
    expect(capture[0]?.filters).toEqual([ACQUISITION_SCOPE, ...filters]);
    expect(capture[0]?.dimensions).toEqual(['event:page']);
    expect(capture[0]?.pagination).toEqual({ limit: 8 }); // default
  });

  it('400s on an unknown dimension', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/breakdown?dimension=favorite_color')
      .set('Authorization', authed());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400s on an out-of-range limit', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/breakdown?dimension=source&limit=201')
      .set('Authorization', authed());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400s on malformed filters JSON', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/breakdown?dimension=source&filters=not-json')
      .set('Authorization', authed());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400s on well-formed JSON that is not a filter tuple array', async () => {
    stubPulseEnv();
    stubFetch();
    const bad = encodeURIComponent(JSON.stringify([{ op: 'is' }]));
    const res = await request(createApp())
      .get(`/api/v1/admin/analytics/breakdown?dimension=source&filters=${bad}`)
      .set('Authorization', authed());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('503s when Plausible is not configured', async () => {
    stubFetch();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/breakdown?dimension=source')
      .set('Authorization', authed());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PULSE_UNCONFIGURED');
  });

  it('502s when Plausible errors', async () => {
    stubPulseEnv();
    stubFetch({ plausibleStatus: 500 });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/breakdown?dimension=source')
      .set('Authorization', authed());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
  });

  it('falls back to fewer metrics when a dimension rejects pageviews (entry_page)', async () => {
    stubPulseEnv();
    const bodies: CapturedQuery[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
        if (url.includes('plausible.test/api/v2/query')) {
          const body = JSON.parse(String(init?.body ?? '{}')) as CapturedQuery;
          bodies.push(body);
          // Plausible v2 rejects the pageviews (event) metric with visit:entry_page.
          if (body.dimensions?.[0] === 'visit:entry_page' && body.metrics?.includes('pageviews')) {
            return Promise.resolve(jsonResponse(400, { error: 'pageviews unsupported with visit:entry_page' }));
          }
          return Promise.resolve(jsonResponse(200, { results: [{ dimensions: ['/learn'], metrics: [42, 3.1, 77] }] }));
        }
        throw new Error(`analytics.test: unexpected fetch ${url}`);
      }),
    );
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/breakdown?dimension=entry_page&limit=8')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    // Renders visitor counts (pageviews unavailable for this dimension → 0), not a 502.
    expect(res.body.data.rows).toEqual([{ label: '/learn', visitors: 42, pageviews: 0, bounceRate: 3.1, visitDuration: 77 }]);
    // The full-metric query was rejected, then retried without pageviews.
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(bodies[0].metrics).toContain('pageviews');
    expect(bodies[1].metrics).not.toContain('pageviews');
  });
});

describe('GET /api/v1/admin/analytics/overview (filters extension)', () => {
  it('passes filters through to every Plausible query, comparison included', async () => {
    stubPulseEnv();
    const capture: CapturedQuery[] = [];
    stubFetch({ capture });
    const filters = [['is', 'visit:device', ['Mobile']]];
    const res = await request(createApp())
      .get(`/api/v1/admin/analytics/overview?filters=${encodeURIComponent(JSON.stringify(filters))}`)
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(capture).toHaveLength(3); // aggregate + timeseries + previous period
    // A comparison drawn from an unfiltered baseline would invent a trend, so
    // the previous-window query carries the same filters as the other two.
    for (const query of capture) expect(query.filters).toEqual([ACQUISITION_SCOPE, ...filters]);
  });

  it('resolves the window and compares it against the one before it', async () => {
    stubPulseEnv();
    const capture: CapturedQuery[] = [];
    stubFetch({ capture });
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/overview?period=7d')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.data.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.data.previous).toMatchObject({ visitors: 120 });
    const comparison = capture.find((q) => Array.isArray((q as { date_range?: unknown }).date_range));
    expect(comparison).toBeTruthy();
  });

  it('accepts an explicit custom range and rejects an impossible one', async () => {
    stubPulseEnv();
    const capture: CapturedQuery[] = [];
    stubFetch({ capture });
    const okRes = await request(createApp())
      .get('/api/v1/admin/analytics/overview?period=custom&from=2026-06-01&to=2026-06-30')
      .set('Authorization', authed());
    expect(okRes.status).toBe(200);
    expect((capture[0] as { date_range?: unknown }).date_range).toEqual(['2026-06-01', '2026-06-30']);

    for (const query of [
      'period=custom&from=2026-06-30&to=2026-06-01',
      'period=custom&from=2026-06-01',
      'period=custom&from=not-a-date&to=2026-06-30',
      'period=fortnight',
    ]) {
      const bad = await request(createApp())
        .get(`/api/v1/admin/analytics/overview?${query}`)
        .set('Authorization', authed());
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('400s on malformed filters', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/overview?filters={{{')
      .set('Authorization', authed());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

/*
 * The exclusions control was removed in 02758833 because it claimed an
 * enforcement (a Plausible CE `IP_BLOCKLIST`) that does not exist. It is back
 * in Vault 0045 with enforcement we actually own — the tracker gate and
 * first-party ingest — and the guarantee this file has to keep is that the
 * route never again becomes decoration: an excluded address must change the
 * public tracking decision. Full CRUD coverage lives in
 * analytics-exclusions.test.ts.
 */
describe('analytics exclusions are enforced, not decorative', () => {
  it('turns an excluded address into a do-not-track decision the SPA obeys', async () => {
    resetExclusionsForTests();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/rest/v1/analytics_ip_exclusions')) {
          return Promise.resolve(
            jsonResponse(200, [
              {
                id: '33333333-3333-4333-8333-333333333333',
                network: '203.0.113.0/24',
                label: 'Office',
                reason: null,
                created_by: ADMIN_ID,
                created_at: '2026-08-13T00:00:00.000Z',
                revoked_at: null,
                revoked_by: null,
              },
            ]),
          );
        }
        throw new Error(`analytics.test: unexpected fetch ${url}`);
      }),
    );
    const res = await request(createApp())
      .get('/api/v1/analytics/tracking-decision')
      .set('User-Agent', BROWSER_UA)
      .set('X-Forwarded-For', '203.0.113.7');
    expect(res.status).toBe(200);
    expect(res.body.data.excluded).toBe(true);
    resetExclusionsForTests();
  });
});

const MARKETING_DIMS = ['source', 'channel', 'utm_campaign', 'utm_source', 'country', 'referrer'];
const FULL_DIMS = [...MARKETING_DIMS, 'entry_page', 'device', 'page', 'exit_page', 'browser', 'os'];

describe('GET /api/v1/admin/analytics/report', () => {
  it('assembles aggregate + timeseries + the audience breakdowns (marketing)', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/report?period=7d&audience=marketing')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.period).toBe('7d');
    expect(res.body.data.audience).toBe('marketing');
    expect(new Date(res.body.data.generatedAt).toString()).not.toBe('Invalid Date');
    expect(res.body.data.aggregate).toEqual({ visitors: 120, pageviews: 340, bounceRate: 41.5, visitDuration: 95 });
    expect(res.body.data.timeseries).toEqual([
      { date: '2026-07-19', visitors: 60, pageviews: 170 },
      { date: '2026-07-20', visitors: 60, pageviews: 170 },
    ]);
    expect(Object.keys(res.body.data.breakdowns)).toEqual(MARKETING_DIMS);
    expect(res.body.data.breakdowns.source[0]).toEqual(ROW_SHAPE);
  });

  it('defaults to the full audience (stable deduped dimension union)', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/analytics/report').set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data.audience).toBe('full');
    expect(Object.keys(res.body.data.breakdowns)).toEqual(FULL_DIMS);
  });

  it('400s on an unknown audience', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/report?audience=finance')
      .set('Authorization', authed());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('502s when any Plausible read fails', async () => {
    stubPulseEnv();
    stubFetch({ plausibleStatus: 500 });
    const res = await request(createApp()).get('/api/v1/admin/analytics/report').set('Authorization', authed());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
  });
});

/** Collect the raw PDF bytes — superagent has no default parser for application/pdf. */
function binaryParser(res: SupertestResponse, cb: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('GET /api/v1/admin/analytics/report.pdf', () => {
  it('streams a real PDF with the download headers (envelope exception)', async () => {
    stubPulseEnv();
    stubFetch();
    const res = await request(createApp())
      .get('/api/v1/admin/analytics/report.pdf?period=30d&audience=marketing')
      .set('Authorization', authed())
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    // The filename carries the WINDOW, not the label: two "30d" exports taken
    // a week apart are different documents and must not share a name.
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="littlefounders-analytics-marketing-\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.pdf"$/,
    );
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(1000); // a real multi-section document, not a stub
  });

  it('falls back to the JSON envelope when Plausible is not configured', async () => {
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/analytics/report.pdf').set('Authorization', authed());
    expect(res.status).toBe(503);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual({ data: null, error: { code: 'PULSE_UNCONFIGURED', message: expect.any(String) } });
  });

  it('falls back to the JSON envelope when Plausible errors', async () => {
    stubPulseEnv();
    stubFetch({ plausibleStatus: 500 });
    const res = await request(createApp()).get('/api/v1/admin/analytics/report.pdf').set('Authorization', authed());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
  });
});
