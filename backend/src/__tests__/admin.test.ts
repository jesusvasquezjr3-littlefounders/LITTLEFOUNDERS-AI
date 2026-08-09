import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetPulseForTests } from '../services/pulse.js';
import { insertAuditLog } from '../services/supabaseRest.js';
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
function stubFetch(opts: { roles?: string[]; plausibleStatus?: number; umamiStatus?: number; kumaStatus?: number; retentionStatus?: number } = {}) {
  const roles = (opts.roles ?? ['admin']).map((role) => ({ role }));
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, roles));
      if (url.includes('/rest/v1/rpc/admin_retention_at_distance')) {
        if (opts.retentionStatus) return Promise.resolve(jsonResponse(opts.retentionStatus, {}));
        return Promise.resolve(jsonResponse(200, [{ bucket: '7-13', n: 4, avg_first_attempt_score: 82.5 }]));
      }
      if (url.includes('/rest/v1/rpc/admin_retention_by_topic')) {
        if (opts.retentionStatus) return Promise.resolve(jsonResponse(opts.retentionStatus, {}));
        return Promise.resolve(
          jsonResponse(200, [
            { source_topic_slug: 'tipos-money', source_topic_title: { 'en-US': 'The Money Box' }, n: 4, avg_first_attempt_score: 82.5 },
          ]),
        );
      }
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

// ── Console data panels (service-role reads + mutations) ─────────────────────

const PROFILE = { user_id: ADMIN_ID, display_name: 'Staff', username: 'staff', locale: 'en-US', created_at: '2026-07-12T00:00:00Z' };
const SECOND_USER_ID = '66666666-6666-4666-8666-666666666666';
const ADVENTURE_ID = '77777777-7777-4777-8777-777777777777';
const SAGA_ID = '88888888-8888-4888-8888-888888888888';
const TOPIC_ID = '99999999-9999-4999-8999-999999999999';
const COURSE = { id: '33333333-3333-4333-8333-333333333333', slug: 'money-basics', title: { 'en-US': 'Money Basics' }, description: { 'en-US': 'A practical introduction to money.' }, subject: 'money', status: 'draft', position: 1, created_at: '2026-07-12T00:00:00Z' };
const ADVENTURE = { id: ADVENTURE_ID, course_id: COURSE.id, title: { 'en-US': 'The Money Trail' }, status: 'draft' };
const SAGA = { id: SAGA_ID, adventure_id: ADVENTURE_ID, title: { 'en-US': 'First Steps' }, status: 'draft' };
const TOPIC = { id: TOPIC_ID, saga_id: SAGA_ID, title: { 'en-US': 'Needs and Wants' }, status: 'draft' };
const REVIEW_LESSON = { id: '44444444-4444-4444-8444-444444444444', topic_id: TOPIC_ID, slug: 'l1', title: { 'en-US': 'Lesson 1' }, difficulty: 2, xp_total: 20, estimated_minutes: 8, status: 'review', created_at: '2026-07-13T00:00:00Z' };
const OVERFLOW_LESSON = { ...REVIEW_LESSON, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slug: 'l1001', title: { 'en-US': 'Lesson 1001' } };
const LESSON_DOCUMENT = { lesson_id: REVIEW_LESSON.id, locale: 'en-US', schema_version: 1, document: { schema_version: 1, meta: { slug: 'l1', title: 'Lesson 1', locale: 'en-US', subject: 'money', estimated_minutes: 8, objectives: ['Understand needs'], cast: [] }, scoring: { pass_threshold: 70, hint_penalty_pct: 0, max_attempts: 3, hearts: null }, segments: [] }, answer_keys: {}, audio: {} };
const AUDIT = { id: 7, actor_id: ADMIN_ID, action: 'admin.course.set_status', subject: COURSE.id, detail: { status: 'published' }, created_at: '2026-07-20T00:00:00Z' };

type OverviewStub = {
  profiles?: { user_id: string; display_name?: string; username?: string; locale?: string; created_at?: string }[];
  roles?: { user_id: string; role: string }[];
  counts?: { courses?: Record<string, number>; lessons?: Record<string, number>; audit?: number };
  countFailure?: 'courses' | 'lessons' | 'audit_logs';
  lessonOverflow?: boolean;
};

/** fetch stub over the service-role PostgREST surface + the auth role check. */
function stubData(
  callerRole: 'admin' | 'superadmin' | 'universal',
  capture?: { calls: { url: string; method: string; body?: string }[] },
  options: { releaseRefusal?: { code: string; message: string }; auditInsertStatus?: number; overview?: OverviewStub } = {},
) {
  const overviewProfiles = options.overview?.profiles ?? [PROFILE];
  const overviewRoles = options.overview?.roles ?? [{ user_id: ADMIN_ID, role: 'admin' }, { user_id: ADMIN_ID, role: 'universal' }];
  const overviewCounts = {
    courses: { draft: 1, published: 0, archived: 0, ...options.overview?.counts?.courses },
    lessons: { draft: 0, review: 1, published: 0, archived: 0, ...options.overview?.counts?.lessons },
    audit: options.overview?.counts?.audit ?? 1,
  };

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      capture?.calls.push({ url, method, body: init?.body as string | undefined });
      const headers = new Headers(init?.headers);
      if (headers.get('Prefer')?.includes('count=exact')) {
        if (options.overview?.countFailure && url.includes(`/${options.overview.countFailure}`)) {
          return Promise.resolve(jsonResponse(503, { message: 'upstream unavailable' }));
        }
        let total = 0;
        if (url.includes('/courses')) total = overviewCounts.courses[decodeURIComponent(new URL(url).searchParams.get('status')?.replace('eq.', '') ?? '')] ?? 0;
        if (url.includes('/lessons')) total = overviewCounts.lessons[decodeURIComponent(new URL(url).searchParams.get('status')?.replace('eq.', '') ?? '')] ?? 0;
        if (url.includes('/audit_logs')) total = overviewCounts.audit;
        return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Range': `0-0/${total}` } }));
      }
      if (url.includes('/rest/v1/user_roles')) {
        if (method === 'POST' || method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        if (url.includes('user_id=eq.')) return Promise.resolve(jsonResponse(200, [{ role: callerRole }])); // auth check
        if (url.includes('role=neq.universal')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, role: 'admin' }]));
        if (url.includes('user_id=in.(')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, role: 'admin' }]));
        return Promise.resolve(jsonResponse(200, overviewRoles));
      }
      if (url.includes('/rest/v1/rpc/release_course')) {
        return Promise.resolve(jsonResponse(200, [{
          ok: !options.releaseRefusal,
          code: options.releaseRefusal?.code ?? 'RELEASED',
          message: options.releaseRefusal?.message ?? 'Course hierarchy released.',
          adventures_published: 1,
          sagas_published: 1,
          topics_published: 1,
          lessons_published: 1,
        }]));
      }
      if (url.includes('/rest/v1/profiles')) return Promise.resolve(jsonResponse(200, overviewProfiles));
      if (url.includes('/rest/v1/courses')) {
        if (method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(jsonResponse(200, [COURSE]));
      }
      if (url.includes('/rest/v1/adventures')) return Promise.resolve(jsonResponse(200, [ADVENTURE]));
      if (url.includes('/rest/v1/sagas')) return Promise.resolve(jsonResponse(200, [SAGA]));
      if (url.includes('/rest/v1/topics')) return Promise.resolve(jsonResponse(200, [TOPIC]));
      if (url.includes('/rest/v1/lessons')) {
        if (method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
        if (options.overview?.lessonOverflow && url.includes('order=topic_id')) {
          const offset = Number(new URL(url).searchParams.get('offset') ?? '0');
          if (offset === 0) return Promise.resolve(jsonResponse(200, Array.from({ length: 1000 }, () => REVIEW_LESSON)));
          if (offset === 1000) return Promise.resolve(jsonResponse(200, [OVERFLOW_LESSON]));
        }
        return Promise.resolve(jsonResponse(200, [REVIEW_LESSON]));
      }
      if (url.includes('/rest/v1/lesson_documents')) return Promise.resolve(jsonResponse(200, [LESSON_DOCUMENT]));
      if (url.includes('/rest/v1/audit_logs')) {
        if (method === 'POST') return Promise.resolve(new Response(null, { status: options.auditInsertStatus ?? 204 }));
        return Promise.resolve(jsonResponse(200, [AUDIT]));
      }
      if (url.includes('/rest/v1/admin_permissions')) {
        if (method === 'POST' || method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, permission: 'manage_users' }]));
      }
      throw new Error(`admin.test data: unexpected fetch ${url}`);
    }),
  );
}

const staffAuth = (role: 'admin' | 'superadmin' | 'universal') =>
  `Bearer ${mintToken({ sub: ADMIN_ID, email: role === 'superadmin' ? 'boss@littlefounders.ai' : 'staff@littlefounders.ai' })}`;

describe('GET /api/v1/admin/overview', () => {
  it('returns platform counts', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/overview').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.users.total).toBe(1);
    expect(res.body.data.users.staff).toBe(1);
    expect(res.body.data.content.reviewQueue).toBe(1); // the stubbed lesson is status='review'
    expect(res.body.data.audit.total).toBe(1);
  });

  it('counts people once, pages roles, and uses the exact audit total', async () => {
    const secondProfile = { user_id: SECOND_USER_ID, display_name: 'Second', username: 'second', locale: 'en-US', created_at: '2026-07-13T00:00:00Z' };
    stubData('admin', undefined, {
      overview: {
        profiles: [PROFILE, secondProfile],
        roles: [
          { user_id: ADMIN_ID, role: 'universal' },
          { user_id: ADMIN_ID, role: 'admin' },
          { user_id: SECOND_USER_ID, role: 'universal' },
          { user_id: SECOND_USER_ID, role: 'superadmin' },
        ],
        counts: { courses: { published: 42 }, lessons: { review: 17, published: 99 }, audit: 1250 },
      },
    });
    const res = await request(createApp()).get('/api/v1/admin/overview').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual({ total: 2, byRole: { admin: 1, superadmin: 1 }, staff: 2 });
    expect(res.body.data.content).toMatchObject({ courses: { published: 42, draft: 1, archived: 0 }, lessons: { review: 17, published: 99 }, reviewQueue: 17 });
    expect(res.body.data.audit.total).toBe(1250);
  });

  it('fails closed when an exact KPI count is unavailable', async () => {
    stubData('admin', undefined, { overview: { countFailure: 'audit_logs' } });
    const res = await request(createApp()).get('/api/v1/admin/overview').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(502);
    expect(res.body.data).toBeNull();
  });
});

describe('GET /api/v1/admin/users', () => {
  it('lists users with their roles', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.users[0]).toMatchObject({ userId: ADMIN_ID, displayName: 'Staff', roles: ['admin', 'universal'] });
  });

  it('uses paged upstream reads so the directory and its statistics are not capped at 100 users', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture);
    const res = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(capture.calls.some(({ url }) => url.includes('/profiles') && url.includes('limit=1000'))).toBe(true);
    expect(capture.calls.some(({ url }) => url.includes('/user_roles') && url.includes('limit=1000'))).toBe(true);
  });
});

describe('GET + POST /api/v1/admin/content', () => {
  it('lists courses with status and picks a display title', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/content').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.courses[0]).toMatchObject({ slug: 'money-basics', title: 'Money Basics', status: 'draft' });
    expect(res.body.data.courses[0]).toMatchObject({ lessonCount: 1, topicCount: 1 });
    expect(res.body.data.summary.lessons.total).toBe(1);
  });

  it('fails closed when an exact content total is unavailable', async () => {
    stubData('admin', undefined, { overview: { countFailure: 'lessons' } });
    const res = await request(createApp()).get('/api/v1/admin/content').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('releases a complete course atomically (and audits it)', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture);
    const res = await request(createApp())
      .post(`/api/v1/admin/content/${COURSE.id}/status`)
      .set('Authorization', staffAuth('admin'))
      .send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: COURSE.id, status: 'published' });
    expect(capture.calls.some((c) => c.method === 'POST' && c.url.includes('/rpc/release_course'))).toBe(true);
    expect(capture.calls.some((c) => c.method === 'PATCH' && c.url.includes('/courses'))).toBe(false);
    expect(capture.calls.some((c) => c.method === 'POST' && c.url.includes('/audit_logs'))).toBe(true);
  });

  // Each Vault refusal must reach the console as its own envelope code with
  // the RPC's message intact — a single generic CONFLICT hid why a release
  // was refused (and the UI could not map it to a specific i18n string).
  it.each([
    ['NOT_FOUND', 404, 'RELEASE_NOT_FOUND'],
    ['ARCHIVED', 409, 'RELEASE_ARCHIVED'],
    ['INCOMPLETE_HIERARCHY', 409, 'RELEASE_INCOMPLETE_HIERARCHY'],
    ['LESSONS_NOT_REVIEWABLE', 409, 'RELEASE_LESSONS_NOT_REVIEWABLE'],
    ['INCOMPLETE_LOCALES', 409, 'RELEASE_INCOMPLETE_LOCALES'],
    ['VERIFICATION_REQUIRED', 409, 'RELEASE_VERIFICATION_REQUIRED'],
  ])('maps the %s release refusal to %i %s', async (rpcCode, status, envelopeCode) => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { releaseRefusal: { code: rpcCode, message: `Refused: ${rpcCode}` } });
    const res = await request(createApp())
      .post(`/api/v1/admin/content/${COURSE.id}/status`)
      .set('Authorization', staffAuth('admin'))
      .send({ status: 'published' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(envelopeCode);
    expect(res.body.error.message).toBe(`Refused: ${rpcCode}`);
    expect(capture.calls.some((c) => c.method === 'PATCH' && c.url.includes('/courses'))).toBe(false);
    expect(capture.calls.some((c) => c.method === 'POST' && c.url.includes('/audit_logs'))).toBe(false);
  });

  it('degrades an unknown refusal code to the generic RELEASE_BLOCKED', async () => {
    stubData('admin', undefined, { releaseRefusal: { code: 'FUTURE_RULE', message: 'A new gate refused it.' } });
    const res = await request(createApp())
      .post(`/api/v1/admin/content/${COURSE.id}/status`)
      .set('Authorization', staffAuth('admin'))
      .send({ status: 'published' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RELEASE_BLOCKED');
    expect(res.body.error.message).toBe('A new gate refused it.');
  });

  it('still releases when the audit write fails, but logs the lost trail loudly', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      stubData('admin', undefined, { auditInsertStatus: 500 });
      const res = await request(createApp())
        .post(`/api/v1/admin/content/${COURSE.id}/status`)
        .set('Authorization', staffAuth('admin'))
        .send({ status: 'published' });
      expect(res.status).toBe(200); // the release already committed in Vault
      const logged = errorSpy.mock.calls.map((args) => args.join(' ')).join('\n');
      expect(logged).toContain('admin.course.release');
      expect(logged).toContain(`course=${COURSE.id}`);
      expect(logged).toContain(`actor=${ADMIN_ID}`);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('400s on an invalid status', async () => {
    stubData('admin');
    const res = await request(createApp())
      .post(`/api/v1/admin/content/${COURSE.id}/status`)
      .set('Authorization', staffAuth('admin'))
      .send({ status: 'launched' });
    expect(res.status).toBe(400);
  });
});

describe('insertAuditLog', () => {
  it('reports whether the audit row landed (a lost trail must be detectable)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
    await expect(insertAuditLog(ADMIN_ID, 'admin.course.release', COURSE.id, {})).resolves.toBe(true);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))));
    await expect(insertAuditLog(ADMIN_ID, 'admin.course.release', COURSE.id, {})).resolves.toBe(false);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
    await expect(insertAuditLog(ADMIN_ID, 'admin.course.release', COURSE.id, {})).resolves.toBe(false);
  });
});

describe('GET /api/v1/admin/moderation', () => {
  it('lists lessons in review', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/moderation').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.lessons[0]).toMatchObject({ slug: 'l1', status: 'review' });
    expect(res.body.data.lessons[0]).toMatchObject({ courseTitle: 'Money Basics', topicTitle: 'Needs and Wants', locales: ['en-US'] });
    expect(res.body.data.total).toBe(1);
  });

  it('returns the client-safe lesson document for human preview', async () => {
    stubData('admin');
    const res = await request(createApp()).get(`/api/v1/admin/moderation/${REVIEW_LESSON.id}`).set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.documents[0]).toMatchObject({ locale: 'en-US', schemaVersion: 1 });
    expect(res.body.data.documents[0].document).not.toHaveProperty('answer_keys');
  });

  it('loads every review lesson past PostgREST’s 1,000-row page', async () => {
    stubData('admin', undefined, { overview: { lessonOverflow: true } });
    const res = await request(createApp()).get('/api/v1/admin/moderation').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1001);
    expect(res.body.data.lessons.at(-1)).toMatchObject({ slug: 'l1001' });
  });
});

describe('GET /api/v1/admin/audit', () => {
  it('returns audit entries newest-first', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/audit?limit=10').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.entries[0]).toMatchObject({ id: 7, action: 'admin.course.set_status' });
  });
});

describe('Roles & Access (superadmin-only)', () => {
  it('lists role holders for a superadmin', async () => {
    stubData('superadmin');
    const res = await request(createApp()).get('/api/v1/admin/roles').set('Authorization', staffAuth('superadmin'));
    expect(res.status).toBe(200);
    expect(res.body.data.holders[0]).toMatchObject({ userId: ADMIN_ID, roles: ['admin'] });
  });

  it('403s a plain admin from the roles list', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/roles').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(403);
  });

  it('grants a role for a superadmin', async () => {
    stubData('superadmin');
    const res = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', staffAuth('superadmin'))
      .send({ userId: '55555555-5555-4555-8555-555555555555', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ granted: true, role: 'admin' });
  });

  it('403s a plain admin from granting', async () => {
    stubData('admin');
    const res = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', staffAuth('admin'))
      .send({ userId: '55555555-5555-4555-8555-555555555555', role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('400s on an unknown role', async () => {
    stubData('superadmin');
    const res = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', staffAuth('superadmin'))
      .send({ userId: '55555555-5555-4555-8555-555555555555', role: 'wizard' });
    expect(res.status).toBe(400);
  });

  it('revokes a role for a superadmin', async () => {
    stubData('superadmin');
    const res = await request(createApp())
      .post('/api/v1/admin/roles/revoke')
      .set('Authorization', staffAuth('superadmin'))
      .send({ userId: '55555555-5555-4555-8555-555555555555', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ revoked: true });
  });
});

describe('GET /api/v1/admin/learning/retention', () => {
  it('returns retention buckets + per-topic rows for an admin', async () => {
    stubFetch();
    const res = await request(createApp()).get('/api/v1/admin/learning/retention').set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.buckets).toEqual([{ bucket: '7-13', n: 4, avg_first_attempt_score: 82.5 }]);
    expect(res.body.data.byTopic).toEqual([{ slug: 'tipos-money', title: 'The Money Box', n: 4, avgFirstAttemptScore: 82.5 }]);
  });

  it('403s for a non-staff role', async () => {
    stubFetch({ roles: ['universal'] });
    const res = await request(createApp()).get('/api/v1/admin/learning/retention').set('Authorization', authed());
    expect(res.status).toBe(403);
  });

  it('502s when Vault does not answer', async () => {
    stubFetch({ retentionStatus: 500 });
    const res = await request(createApp()).get('/api/v1/admin/learning/retention').set('Authorization', authed());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});

describe('GET /api/v1/admin/intel/* (dataintel proxy)', () => {
  it('forwards to the mount-relative dataintel path, not the doubled /api/v1/intel/api/v1/admin/intel/... path', async () => {
    const intelCalls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
        intelCalls.push({ url, method: (init?.method ?? 'GET').toUpperCase() });
        return Promise.resolve(jsonResponse(200, { data: { segments: [] }, error: null }));
      }),
    );

    const res = await request(createApp())
      .get('/api/v1/admin/intel/segments?limit=5')
      .set('Authorization', authed());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { segments: [] }, error: null });
    expect(intelCalls).toHaveLength(1);
    // Regression guard: a req.originalUrl-based path build re-prepends the
    // full /api/v1/admin/intel prefix onto itself instead of stripping it.
    expect(intelCalls[0].url).toBe('http://localhost:4008/api/v1/intel/segments?limit=5');
  });

  it('403s for a non-staff role without ever reaching dataintel', async () => {
    const intelCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'universal' }]));
        intelCalls.push(url);
        return Promise.resolve(jsonResponse(200, { data: null, error: null }));
      }),
    );

    const res = await request(createApp()).get('/api/v1/admin/intel/segments').set('Authorization', authed());

    expect(res.status).toBe(403);
    expect(intelCalls).toHaveLength(0);
  });
});
