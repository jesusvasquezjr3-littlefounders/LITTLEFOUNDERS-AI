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
function stubFetch(opts: { roles?: string[]; plausibleStatus?: number; umamiStatus?: number; kumaStatus?: number; retentionStatus?: number; capture?: string[] } = {}) {
  const roles = (opts.roles ?? ['admin']).map((role) => ({ role }));
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      opts.capture?.push(url);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, roles));
      if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, permission: 'view_analytics' }]));
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
    /*
     * The series covers the WINDOW, not just the days upstream had traffic on
     * — 7 days of `7d` plus the 2 fixture days that sit outside it. Asserting
     * the raw upstream rows is what let a quiet tail shorten the chart and
     * relabel its axis, which is how "the chart stops on the 18th" happened.
     */
    expect(res.body.data.timeseries).toHaveLength(9);
    expect(res.body.data.timeseries[0]).toEqual({ date: '2026-07-19', visitors: 60, pageviews: 170 });
    expect(res.body.data.timeseries.every((r: { date: string }) => /^\d{4}-\d\d-\d\d$/.test(r.date))).toBe(true);
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
    expect(res.body.data).toMatchObject({ period: '30d', pageviews: 500, visitors: 200, visits: 250, bounces: 90, totaltime: 60000 });
    // The behavioural card states the same resolved window the web-analytics
    // cards do; it used to translate the period on its own and describe a
    // different one under the same label.
    expect(res.body.data.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.data.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('asks Umami for the same calendar window Plausible resolves for "month"', async () => {
    stubPulseEnv();
    const urls: string[] = [];
    stubFetch({ capture: urls });
    await request(createApp()).get('/api/v1/admin/analytics/behavior?period=month').set('Authorization', authed());
    const statsCall = urls.find((url) => url.includes('/api/websites/') && url.includes('startAt='));
    expect(statsCall).toBeTruthy();
    const startAt = Number(new URL(statsCall as string).searchParams.get('startAt'));
    expect(new Date(startAt).getUTCDate()).toBe(1); // month-to-date, not "30 days ago"
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
  options: { releaseRefusal?: { code: string; message: string }; auditInsertStatus?: number; overview?: OverviewStub; permissions?: string[]; permissionStatus?: number; minorRecord?: string[]; minorRecordStatus?: number; parentGrant?: { status: number; body: unknown }; courseAssemblyIncidents?: { course_id: string; occurrence_count: number; first_seen_at: string; last_seen_at: string }[] } = {},
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
        if (url.includes('/courses')) total = (overviewCounts.courses as Record<string, number>)[decodeURIComponent(new URL(url).searchParams.get('status')?.replace('eq.', '') ?? '')] ?? 0;
        if (url.includes('/lessons')) total = (overviewCounts.lessons as Record<string, number>)[decodeURIComponent(new URL(url).searchParams.get('status')?.replace('eq.', '') ?? '')] ?? 0;
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
      // A.5: the users directory now projects each account's latest
      // verification row; the stub serves an empty verification history.
      if (url.includes('/rest/v1/parent_verifications')) return Promise.resolve(jsonResponse(200, []));
      // A.2/A.5 (F3-identity-site): Tutors whose own age record says a minor.
      if (url.includes('/rest/v1/rpc/list_minor_record_tutors')) {
        if (options.minorRecordStatus) return Promise.resolve(jsonResponse(options.minorRecordStatus, { message: 'unavailable' }));
        return Promise.resolve(jsonResponse(200, (options.minorRecord ?? []).map((user_id) => ({ user_id }))));
      }
      // A.5 / OD-3 section 2: the audited staff parent grant (one database call).
      if (url.includes('/rest/v1/rpc/grant_parent_role_with_justification')) {
        return Promise.resolve(jsonResponse(options.parentGrant?.status ?? 200, options.parentGrant?.body ?? 'granted'));
      }
      if (url.includes('/rest/v1/rpc/release_lesson')) {
        return Promise.resolve(jsonResponse(200, [{
          ok: !options.releaseRefusal,
          code: options.releaseRefusal?.code ?? 'RELEASED',
          message: options.releaseRefusal?.message ?? 'Lesson released.',
          lessons_published: 1,
        }]));
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
      if (url.includes('/rest/v1/course_assembly_incidents')) {
        return Promise.resolve(jsonResponse(200, options.courseAssemblyIncidents ?? []));
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
        if (options.permissionStatus) return Promise.resolve(jsonResponse(options.permissionStatus, { message: 'unavailable' }));
        return Promise.resolve(jsonResponse(200, (options.permissions ?? ['manage_users', 'manage_content', 'view_analytics', 'manage_support']).map((permission) => ({ user_id: ADMIN_ID, permission }))));
      }
      throw new Error(`admin.test data: unexpected fetch ${url}`);
    }),
  );
}

const staffAuth = (role: 'admin' | 'superadmin' | 'universal') =>
  `Bearer ${mintToken({ sub: ADMIN_ID, email: role === 'superadmin' ? 'boss@littlefounders.ai' : 'staff@littlefounders.ai' })}`;

describe('GET /api/v1/admin/overview', () => {
  it('projects only a support grant and never reads Users or Content totals', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: ['manage_support'] });
    const res = await request(createApp()).get('/api/v1/admin/overview').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data)).toEqual(['audit']);
    expect(capture.calls.some(({ url }) => url.includes('/profiles') || url.includes('/courses') || url.includes('/lessons'))).toBe(false);
  });

  it('projects only a Content grant and skips Users and Audit totals', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: ['manage_content'] });
    const res = await request(createApp()).get('/api/v1/admin/overview').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data)).toEqual(['content']);
    expect(capture.calls.some(({ url }) => url.includes('/profiles') || url.includes('/audit_logs'))).toBe(false);
  });

  it('returns no cross-family totals to an Analytics-only Admin', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: ['view_analytics'] });
    const res = await request(createApp()).get('/api/v1/admin/overview').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});
    expect(capture.calls.filter(({ url }) => !url.includes('/user_roles') && !url.includes('/admin_permissions'))).toEqual([]);
  });

  it('rejects an Admin with no grants before a platform read', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: [] });
    const res = await request(createApp()).get('/api/v1/admin/overview').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(403);
    expect(capture.calls.filter(({ url }) => !url.includes('/user_roles') && !url.includes('/admin_permissions'))).toEqual([]);
  });

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
  it('denies an admin without manage_users before reading the directory or its timeline', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: ['manage_content'] });
    for (const path of ['/api/v1/admin/users', '/api/v1/admin/users/timeline']) {
      const res = await request(createApp()).get(path).set('Authorization', staffAuth('admin'));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    expect(capture.calls.some(({ url }) => url.includes('/profiles'))).toBe(false);
    expect(capture.calls.some(({ url }) => url.includes('/admin_permissions?user_id=eq.'))).toBe(true);
  });

  it('fails closed when the current permission grant cannot be verified', async () => {
    stubData('admin', undefined, { permissionStatus: 503 });
    const res = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(502);
  });

  it('honors a grant revocation on the next request', async () => {
    const options = { permissions: ['manage_users'] };
    stubData('admin', undefined, options);
    const first = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'));
    expect(first.status).toBe(200);
    options.permissions = [];
    const second = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'));
    expect(second.status).toBe(403);
  });

  it('lets a superadmin access Users without a granular grant', async () => {
    stubData('superadmin', undefined, { permissions: [] });
    const res = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('superadmin'));
    expect(res.status).toBe(200);
  });

  it('lists users with their roles', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.users[0]).toMatchObject({ userId: ADMIN_ID, displayName: 'Staff', roles: ['admin', 'universal'] });
  });

  it('A.2/A.5: flags a Tutor whose own age record says a minor, and fails closed when that list is unreadable', async () => {
    stubData('admin', undefined, { minorRecord: [ADMIN_ID] });
    const flagged = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'));
    expect(flagged.status).toBe(200);
    expect(flagged.body.data.users[0]).toMatchObject({ userId: ADMIN_ID, ageRecordMinor: true });
    stubData('admin');
    const clean = await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'));
    expect(clean.body.data.users[0]).toMatchObject({ ageRecordMinor: false });
    stubData('admin', undefined, { minorRecordStatus: 503 });
    expect((await request(createApp()).get('/api/v1/admin/users').set('Authorization', staffAuth('admin'))).status).toBe(502);
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

describe('view_analytics staff boundary', () => {
  it('denies Analytics, Insights, Intelligence, exports and shared metrics without the grant', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: ['manage_users', 'manage_content', 'manage_support'] });
    const paths = [
      '/analytics/overview', '/analytics/behavior', '/analytics/report.pdf',
      '/analytics/behavior/export', '/analytics/exclusions',
      '/insights/activity', '/insights/export', '/intel/metrics/summary',
      '/intel-export.csv', '/intel-export.xlsx', '/health/services', '/learning/retention',
    ];
    for (const path of paths) {
      const res = await request(createApp()).get(`/api/v1/admin${path}`).set('Authorization', staffAuth('admin'));
      expect(res.status, path).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    expect(capture.calls.filter(({ url }) => !url.includes('/user_roles') && !url.includes('/admin_permissions'))).toEqual([]);
  });

  it('keeps analytics exclusion changes and Intelligence writes outside a view-only grant', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: ['view_analytics'] });
    const app = createApp();
    const attempts = [
      request(app).get('/api/v1/admin/analytics/exclusions'),
      request(app).post('/api/v1/admin/analytics/exclusions').send({ network: '192.0.2.1' }),
      request(app).post('/api/v1/admin/analytics/exclusions/self').send({}),
      request(app).delete('/api/v1/admin/analytics/exclusions/11111111-1111-4111-8111-111111111111'),
      request(app).post('/api/v1/admin/intel/alerts').send({}),
    ];
    for (const attempt of attempts) {
      const res = await attempt.set('Authorization', staffAuth('admin'));
      expect(res.status).toBe(403);
    }
    expect(capture.calls.filter(({ url }) => !url.includes('/user_roles') && !url.includes('/admin_permissions'))).toEqual([]);
  });
});

describe('manage_support staff boundary', () => {
  it('denies Emails, Audit and Tutor retention status before upstream reads without manage_support', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: ['manage_users', 'manage_content', 'view_analytics'] });
    for (const path of ['/emails/logs', '/emails/summary', '/audit', '/tutor/retention-status']) {
      const res = await request(createApp()).get(`/api/v1/admin${path}`).set('Authorization', staffAuth('admin'));
      expect(res.status, path).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    expect(capture.calls.filter(({ url }) => !url.includes('/user_roles') && !url.includes('/admin_permissions'))).toEqual([]);
  });

  it('honors revocation on the next support request without granting other families', async () => {
    const options = { permissions: ['manage_support'] };
    stubData('admin', undefined, options);
    expect((await request(createApp()).get('/api/v1/admin/audit').set('Authorization', staffAuth('admin'))).status).toBe(200);
    for (const path of ['/users', '/content', '/analytics/overview']) {
      expect((await request(createApp()).get(`/api/v1/admin${path}`).set('Authorization', staffAuth('admin'))).status, path).toBe(403);
    }
    options.permissions = [];
    expect((await request(createApp()).get('/api/v1/admin/audit').set('Authorization', staffAuth('admin'))).status).toBe(403);
  });

  it('preserves Superadmin Audit access', async () => {
    stubData('superadmin', undefined, { permissions: [] });
    expect((await request(createApp()).get('/api/v1/admin/audit').set('Authorization', staffAuth('superadmin'))).status).toBe(200);
  });
});

describe('independent staff grant matrix', () => {
  it('makes each of the four grants admit only its own named API family', async () => {
    const cases = [
      { grant: 'manage_users', path: '/users', admittedStatus: 200 },
      { grant: 'manage_content', path: '/content', admittedStatus: 200 },
      { grant: 'view_analytics', path: '/analytics/overview', admittedStatus: 503 },
      { grant: 'manage_support', path: '/audit', admittedStatus: 200 },
    ] as const;
    for (const granted of cases) {
      stubData('admin', undefined, { permissions: [granted.grant] });
      for (const target of cases) {
        const res = await request(createApp()).get(`/api/v1/admin${target.path}`).set('Authorization', staffAuth('admin'));
        if (granted.grant === target.grant) {
          expect(res.status, `${granted.grant} -> ${target.path}`).toBe(target.admittedStatus);
          if (target.grant === 'view_analytics') expect(res.body.error.code).toBe('PULSE_UNCONFIGURED');
        } else {
          expect(res.status, `${granted.grant} -> ${target.path}`).toBe(403);
          expect(res.body.error.code).toBe('FORBIDDEN');
        }
      }
    }
  });
});

describe('GET + POST /api/v1/admin/content', () => {
  it('rejects direct Content, Generation and review requests without manage_content before data access', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { permissions: ['manage_users', 'view_analytics', 'manage_support'] });
    const paths = [
      '/content', '/content/11111111-1111-4111-8111-111111111111/status',
      '/generation', '/generation/live', '/generation/runs/fixture',
      '/moderation', '/moderation/11111111-1111-4111-8111-111111111111',
      '/moderation/11111111-1111-4111-8111-111111111111/status',
      '/tutor/review-queue', '/tutor/review-queue/11111111-1111-4111-8111-111111111111/status',
      // C.5 / C.6: the live-content status and the curated-pack release gate.
      '/tutor/live-content/status', '/tutor/packs', '/tutor/packs/11111111-1111-4111-8111-111111111111/status',
    ];
    for (const path of paths) {
      const req = path.endsWith('/status') ? request(createApp()).post(`/api/v1/admin${path}`).send({ status: 'review' })
        : request(createApp()).get(`/api/v1/admin${path}`);
      const res = await req.set('Authorization', staffAuth('admin'));
      expect(res.status, path).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    expect(capture.calls.filter(({ url }) => !url.includes('/user_roles') && !url.includes('/admin_permissions'))).toEqual([]);
  });

  it('honors a Content grant revocation on the next request and fails closed if it cannot be read', async () => {
    const options: { permissions: string[]; permissionStatus?: number } = { permissions: ['manage_content'] };
    stubData('admin', undefined, options);
    expect((await request(createApp()).get('/api/v1/admin/content').set('Authorization', staffAuth('admin'))).status).toBe(200);
    options.permissions = [];
    expect((await request(createApp()).get('/api/v1/admin/content').set('Authorization', staffAuth('admin'))).status).toBe(403);
    options.permissionStatus = 503;
    expect((await request(createApp()).get('/api/v1/admin/content').set('Authorization', staffAuth('admin'))).status).toBe(502);
  });

  it('preserves Superadmin Content access without a granular grant', async () => {
    stubData('superadmin', undefined, { permissions: [] });
    expect((await request(createApp()).get('/api/v1/admin/content').set('Authorization', staffAuth('superadmin'))).status).toBe(200);
  });

  it('lists courses with status and picks a display title', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/content').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.courses[0]).toMatchObject({ slug: 'money-basics', title: 'Money Basics', status: 'draft' });
    expect(res.body.data.courses[0]).toMatchObject({ lessonCount: 1, topicCount: 1 });
    expect(res.body.data.summary.lessons.total).toBe(1);
  });

  it('includes a persistent course-assembly signal for the Content console', async () => {
    stubData('admin', undefined, {
      courseAssemblyIncidents: [{
        course_id: COURSE.id,
        occurrence_count: 3,
        first_seen_at: '2026-09-22T12:00:00.000Z',
        last_seen_at: '2026-09-22T12:05:00.000Z',
      }],
    });
    const res = await request(createApp()).get('/api/v1/admin/content').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.courseAssemblyIncidents).toEqual([{
      courseId: COURSE.id,
      courseTitle: 'Money Basics',
      occurrenceCount: 3,
      firstSeenAt: '2026-09-22T12:00:00.000Z',
      lastSeenAt: '2026-09-22T12:05:00.000Z',
    }]);
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
    ['VERIFICATION_INCOMPLETE', 409, 'RELEASE_VERIFICATION_INCOMPLETE'],
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

// S05.4c lane review (Product G.2): approving a lesson in the moderation queue
// used to PATCH lessons.status = 'published' directly, so a regenerated lesson
// of a live course reached children with no Forge verification. Publishing is
// now Vault's release_lesson, which shares the course release preflight.
describe('POST /api/v1/admin/moderation/:lessonId/status', () => {
  it('publishes a lesson only through release_lesson, never a status write, and audits the release', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture);
    const res = await request(createApp())
      .post(`/api/v1/admin/moderation/${REVIEW_LESSON.id}/status`)
      .set('Authorization', staffAuth('admin'))
      .send({ status: 'published' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: REVIEW_LESSON.id, status: 'published' });
    const rpc = capture.calls.find((c) => c.method === 'POST' && c.url.includes('/rpc/release_lesson'));
    expect(rpc?.body && JSON.parse(rpc.body)).toEqual({ p_lesson_id: REVIEW_LESSON.id });
    expect(capture.calls.some((c) => c.method === 'PATCH' && c.url.includes('/lessons'))).toBe(false);
    const audit = capture.calls.find((c) => c.method === 'POST' && c.url.includes('/audit_logs'));
    expect(audit?.body).toContain('admin.lesson.release');
  });

  it.each([
    ['VERIFICATION_REQUIRED', 409, 'RELEASE_VERIFICATION_REQUIRED'],
    ['VERIFICATION_INCOMPLETE', 409, 'RELEASE_VERIFICATION_INCOMPLETE'],
    ['COURSE_RELEASE_REQUIRED', 409, 'RELEASE_COURSE_RELEASE_REQUIRED'],
    ['INCOMPLETE_LOCALES', 409, 'RELEASE_INCOMPLETE_LOCALES'],
    ['LESSONS_NOT_REVIEWABLE', 409, 'RELEASE_LESSONS_NOT_REVIEWABLE'],
    ['ARCHIVED', 409, 'RELEASE_ARCHIVED'],
    ['NOT_FOUND', 404, 'RELEASE_NOT_FOUND'],
  ])('maps the %s lesson release refusal to %i %s with no status write or audit', async (rpcCode, status, envelopeCode) => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture, { releaseRefusal: { code: rpcCode, message: `Refused: ${rpcCode}` } });
    const res = await request(createApp())
      .post(`/api/v1/admin/moderation/${REVIEW_LESSON.id}/status`)
      .set('Authorization', staffAuth('admin'))
      .send({ status: 'published' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(envelopeCode);
    expect(res.body.error.message).toBe(`Refused: ${rpcCode}`);
    expect(capture.calls.some((c) => c.method === 'PATCH' && c.url.includes('/lessons'))).toBe(false);
    expect(capture.calls.some((c) => c.method === 'POST' && c.url.includes('/audit_logs'))).toBe(false);
  });

  it('refuses a family account and a staff member without manage_content before any release call', async () => {
    for (const [role, permissions] of [
      ['universal', undefined],
      ['admin', ['manage_users', 'view_analytics', 'manage_support']],
    ] as const) {
      const capture = { calls: [] as { url: string; method: string; body?: string }[] };
      stubData(role, capture, permissions ? { permissions: [...permissions] } : {});
      const res = await request(createApp())
        .post(`/api/v1/admin/moderation/${REVIEW_LESSON.id}/status`)
        .set('Authorization', staffAuth(role))
        .send({ status: 'published' });
      expect(res.status, role).toBe(403);
      expect(capture.calls.some((c) => c.url.includes('/rpc/release_lesson')), role).toBe(false);
      expect(capture.calls.some((c) => c.method === 'PATCH' && c.url.includes('/lessons')), role).toBe(false);
    }
  });

  it('keeps a non-publishing decision as an audited status update', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture);
    const res = await request(createApp())
      .post(`/api/v1/admin/moderation/${REVIEW_LESSON.id}/status`)
      .set('Authorization', staffAuth('admin'))
      .send({ status: 'draft' });
    expect(res.status).toBe(200);
    const patch = capture.calls.find((c) => c.method === 'PATCH' && c.url.includes('/lessons'));
    expect(patch?.body && JSON.parse(patch.body)).toEqual({ status: 'draft' });
    expect(capture.calls.some((c) => c.url.includes('/rpc/release_lesson'))).toBe(false);
  });
});

describe('the tutor live-content review queue (/ORACLE.md §7.3)', () => {
  const SEGMENT_ID = '77777777-7777-4777-8777-777777777777';
  const PENDING_ROW = {
    id: SEGMENT_ID,
    session_id: '88888888-8888-4888-8888-888888888888',
    seq: 0,
    origin: 'live',
    segment_type: 'quiz_mcq',
    payload: { id: 'seg-1', type: 'quiz_mcq', prompt_md: '¿Cuánto juntas en 4 semanas?' },
    provenance: { model: 'test', tier: 3 },
    score: 100,
    review_status: 'pending',
    created_at: '2026-08-27T10:00:00Z',
  };

  function stubTutorReview(capture: { url: string; method: string; body?: string }[] = [], reviewOutcome: string = 'recorded') {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        capture.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
        if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
        if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, permission: 'manage_content' }]));
        if (url.includes('/rest/v1/tutor_segments')) {
          if (init?.method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
          return Promise.resolve(jsonResponse(200, [PENDING_ROW]));
        }
        if (url.includes('/rpc/record_tutor_live_review')) return Promise.resolve(jsonResponse(200, reviewOutcome));
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
  }

  it('lists the sampled segments — the reader §15.2 admitted did not exist', async () => {
    stubTutorReview();
    const res = await request(createApp()).get('/api/v1/admin/tutor/review-queue').set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.segments[0]).toMatchObject({ id: SEGMENT_ID, origin: 'live', segment_type: 'quiz_mcq' });
  });

  it('records a verdict, and only against a row still pending', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stubTutorReview(calls);
    const res = await request(createApp())
      .post(`/api/v1/admin/tutor/review-queue/${SEGMENT_ID}/status`)
      .set('Authorization', authed())
      .send({ status: 'rejected' });
    expect(res.status).toBe(200);
    // C.5: the verdict moves the segment AND the governance log in one
    // transaction (`record_tutor_live_review`), whose own filter is the
    // pending guard: a second reviewer's stale tab changes nothing.
    const rpc = calls.find((c) => c.url.includes('/rpc/record_tutor_live_review'));
    expect(JSON.parse(rpc?.body ?? '{}')).toEqual({
      p_segment_id: SEGMENT_ID,
      p_verdict: 'rejected',
      p_issue: null,
      p_reviewer: ADMIN_ID,
    });
    // G.3: the central audit row is written by record_tutor_live_review in
    // the verdict's own transaction (migration audited_staff_decisions,
    // proven in verify-staff-ops-postgres.py), so the route posts no second,
    // best-effort row that could fail after the decision committed.
    expect(calls.some((c) => c.url.includes('/rest/v1/audit_logs') && c.method === 'POST')).toBe(false);
  });

  it('refuses an invented status', async () => {
    stubTutorReview();
    const res = await request(createApp())
      .post(`/api/v1/admin/tutor/review-queue/${SEGMENT_ID}/status`)
      .set('Authorization', authed())
      .send({ status: 'published' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/admin/tutor/retention-status (/ORACLE.md §15.2 item 4)', () => {
  function stubRetentionStatus(row: { created_at: string; detail: Record<string, unknown> } | null | 'db-down') {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
        if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, permission: 'manage_support' }]));
        if (url.includes('/rest/v1/audit_logs')) {
          if (row === 'db-down') return Promise.resolve(new Response(null, { status: 500 }));
          return Promise.resolve(jsonResponse(200, row ? [row] : []));
        }
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
  }

  it('reports the last run as fresh, not stale, the morning after an ordinary nightly sweep', async () => {
    stubRetentionStatus({
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      detail: { sessionsDeleted: 3 },
    });
    const res = await request(createApp())
      .get('/api/v1/admin/tutor/retention-status')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ stale: false, lastRunDetail: { sessionsDeleted: 3 } });
  });

  it('reports stale when the sweep has never recorded a run at all', async () => {
    stubRetentionStatus(null);
    const res = await request(createApp())
      .get('/api/v1/admin/tutor/retention-status')
      .set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ stale: true, lastRunAt: null });
  });

  it('answers 502, not a stale 200, when the status read itself cannot reach the database', async () => {
    // The two failure shapes must stay distinguishable (§1.14): a database
    // outage is not the same claim as "the sweep has genuinely never run",
    // and collapsing them would make an outage LOOK like a legal-risk finding.
    stubRetentionStatus('db-down');
    const res = await request(createApp())
      .get('/api/v1/admin/tutor/retention-status')
      .set('Authorization', authed());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});

describe('GET /api/v1/admin/audit', () => {
  it('returns audit entries newest-first', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/audit?limit=10').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.entries[0]).toMatchObject({ id: 7, action: 'admin.course.set_status' });
    expect(res.body.data.total).toBe(1);
  });

  it('validates date filters and forwards exact filters to the source of truth', async () => {
    const capture = { calls: [] as { url: string; method: string; body?: string }[] };
    stubData('admin', capture);
    const res = await request(createApp())
      .get('/api/v1/admin/audit?action=admin.course.set_status&from=2026-07-01&to=2026-07-31')
      .set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(200);
    const auditCalls = capture.calls.filter((call) => call.url.includes('/rest/v1/audit_logs'));
    expect(auditCalls.some((call) => call.url.includes('action=eq.admin.course.set_status'))).toBe(true);
    expect(auditCalls.length).toBe(2);
  });

  it('rejects an inverted audit date range', async () => {
    stubData('admin');
    const res = await request(createApp()).get('/api/v1/admin/audit?from=2026-08-02&to=2026-08-01').set('Authorization', staffAuth('admin'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
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

  // F4-staff-ops (A.5, OD-3 section 2, Appendix M 1.2): the staff grant
  // follows the age record. The database refuses a kid-role, under-13-origin
  // or declared-minor target before any write; Core answers 409
  // AGE_RECORD_MINOR, never "granted", and writes nothing of its own.
  it('refuses a staff parent grant to a minor-record account with 409 AGE_RECORD_MINOR and no direct write', async () => {
    const minorRefusal = { code: '42501', message: "PARENT_GRANT_MINOR_RECORD: the account's age record is a minor's; correct it through the age review first" };
    for (const target of ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666']) {
      const capture = { calls: [] as { url: string; method: string; body?: string }[] };
      stubData('superadmin', capture, { parentGrant: { status: 403, body: minorRefusal } });
      const res = await request(createApp())
        .post('/api/v1/admin/roles/grant')
        .set('Authorization', staffAuth('superadmin'))
        .send({ userId: target, role: 'parent', justification: 'Support case 5678: re-verified in person' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('AGE_RECORD_MINOR');
      expect(res.body.data?.granted).toBeUndefined();
      const rpc = capture.calls.filter((c) => c.url.includes('/rpc/grant_parent_role_with_justification'));
      expect(rpc).toHaveLength(1);
      expect(JSON.parse(rpc[0]!.body ?? '{}')).toMatchObject({ p_user: target });
      // No fallback write: no direct role insert, no separate audit row.
      expect(capture.calls.some((c) => c.method !== 'GET' && (c.url.includes('/rest/v1/user_roles') || c.url.includes('/rest/v1/audit_logs')))).toBe(false);
    }
  });

  it('keeps other database refusals distinct from the age refusal', async () => {
    stubData('superadmin', undefined, { parentGrant: { status: 403, body: { code: '42501', message: 'PARENT_GRANT_FORBIDDEN: only a superadmin grants the parent role' } } });
    const forbidden = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', staffAuth('superadmin'))
      .send({ userId: '55555555-5555-4555-8555-555555555555', role: 'parent', justification: 'Support case 5678: re-verified in person' });
    expect(forbidden.status).toBe(409);
    expect(forbidden.body.error.code).toBe('ROLE_REJECTED');
    stubData('superadmin');
    const adult = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', staffAuth('superadmin'))
      .send({ userId: '55555555-5555-4555-8555-555555555555', role: 'parent', justification: 'Support case 5678: re-verified in person' });
    expect(adult.status).toBe(200);
    expect(adult.body.data).toMatchObject({ role: 'parent', granted: true });
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

  it('400s on an unknown permission', async () => {
    stubData('superadmin');
    const res = await request(createApp())
      .post('/api/v1/admin/roles/permissions/grant')
      .set('Authorization', staffAuth('superadmin'))
      .send({ userId: '55555555-5555-4555-8555-555555555555', permission: 'everything' });
    expect(res.status).toBe(400);
  });

  it('offers a read-only candidate search for grants', async () => {
    stubData('superadmin');
    const res = await request(createApp()).get('/api/v1/admin/roles/candidates?q=Staff').set('Authorization', staffAuth('superadmin'));
    expect(res.status).toBe(200);
    expect(res.body.data.candidates[0]).toMatchObject({ userId: ADMIN_ID, displayName: 'Staff' });
  });

  it('prevents a superadmin from revoking their own top-level access', async () => {
    stubData('superadmin');
    const res = await request(createApp())
      .post('/api/v1/admin/roles/revoke')
      .set('Authorization', staffAuth('superadmin'))
      .send({ userId: ADMIN_ID, role: 'superadmin' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROLE_REJECTED');
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
        if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, permission: 'view_analytics' }]));
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

/*
 * S06.12 — C.5 staff decisions feed the dynamic sampling rate and the judge's
 * concordance; C.6 packs are released by a human through a contract check.
 * Populations: a staff member with manage_content (allowed), staff without it,
 * a non-staff account (kid) and no session (all refused before any data read).
 */
describe('S06.12 C.5/C.6 — staff governance surfaces', () => {
  const SEGMENT_ID = '66666666-6666-4666-8666-666666666666';
  const PACK_ID = '77777777-7777-4777-8777-777777777777';

  interface World {
    roles?: string[];
    permissions?: string[];
    reviewOutcome?: unknown;
    packs?: unknown[];
    calibration?: unknown[];
    backlog?: unknown[];
  }

  function stubGovernance(world: World, calls: { url: string; method: string; body?: string }[] = []) {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push({ url, method, body: init?.body as string | undefined });
        if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, (world.roles ?? ['admin']).map((role) => ({ role }))));
        if (url.includes('/rest/v1/admin_permissions')) {
          return Promise.resolve(jsonResponse(200, (world.permissions ?? ['manage_content']).map((permission) => ({ user_id: ADMIN_ID, permission }))));
        }
        if (url.includes('/rpc/record_tutor_live_review')) return Promise.resolve(jsonResponse(200, world.reviewOutcome ?? 'recorded'));
        if (url.includes('/rest/v1/mentor_judge_calibration')) return Promise.resolve(jsonResponse(200, world.calibration ?? []));
        if (url.includes('/rest/v1/tutor_live_content_log')) {
          if (url.includes('reviewed_at=is.null')) return Promise.resolve(jsonResponse(200, world.backlog ?? []));
          return Promise.resolve(jsonResponse(200, []));
        }
        if (url.includes('/rest/v1/tutor_packs')) {
          if (method === 'PATCH') {
            const patch = JSON.parse(String(init?.body)) as Record<string, unknown>;
            return Promise.resolve(jsonResponse(200, [{ ...(world.packs?.[0] as object), ...patch }]));
          }
          return Promise.resolve(jsonResponse(200, world.packs ?? []));
        }
        if (url.includes('/rest/v1/kc?')) return Promise.resolve(jsonResponse(200, [{ tier_min: 3 }]));
        if (url.includes('/rest/v1/audit_logs')) {
          if (method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
          return Promise.resolve(jsonResponse(200, []));
        }
        throw new Error(`unexpected ${method} ${url}`);
      }),
    );
  }

  const decide = (body: object) =>
    request(createApp()).post(`/api/v1/admin/tutor/review-queue/${SEGMENT_ID}/status`).set('Authorization', authed()).send(body);

  it('records a classified rejection (the input of the elevated rate) in one transaction', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stubGovernance({}, calls);
    const res = await decide({ status: 'rejected', issue: 'safety' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: SEGMENT_ID, status: 'rejected', issue: 'safety' });
    const rpc = calls.find((c) => c.url.includes('/rpc/record_tutor_live_review'));
    expect(JSON.parse(rpc?.body ?? '{}')).toMatchObject({ p_verdict: 'rejected', p_issue: 'safety', p_reviewer: ADMIN_ID });
    expect(calls.some((c) => c.url.includes('audit_logs') && c.method === 'POST')).toBe(false);
  });

  it('refuses an issue on an approval, an unknown issue class and extra fields', async () => {
    stubGovernance({});
    expect((await decide({ status: 'approved', issue: 'quality' })).status).toBe(400);
    expect((await decide({ status: 'rejected', issue: 'boring' })).status).toBe(400);
    expect((await decide({ status: 'rejected', rate: 0 })).status).toBe(400);
  });

  it('answers 502, never 200, when the verdict and its audit row cannot be confirmed', async () => {
    stubGovernance({ reviewOutcome: { code: 'XX000', message: 'audit store unavailable' } });
    const res = await decide({ status: 'approved' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('answers 409 when another reviewer already decided the item', async () => {
    stubGovernance({ reviewOutcome: 'not_pending' });
    const res = await decide({ status: 'approved' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_DECIDED');
  });

  it('shows staff the per-category rate, floor, suspension and overdue backlog', async () => {
    stubGovernance({
      backlog: [
        { risk_category: 'sensitive', created_at: new Date(Date.now() - 9 * 86_400_000).toISOString() },
        { risk_category: 'sensitive', created_at: new Date().toISOString() },
      ],
    });
    const res = await request(createApp()).get('/api/v1/admin/tutor/live-content/status').set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data.calibration).toMatchObject({ state: 'uncalibrated', maxAgeDays: 35 });
    expect(res.body.data.categories).toEqual([
      expect.objectContaining({ category: 'standard', suspended: true, reasons: ['uncalibrated'], rate: 0.15, floor: 0.15, pending: 0 }),
      expect.objectContaining({ category: 'sensitive', suspended: true, rate: 0.5, floor: 0.5, pending: 2, overdue: 1 }),
    ]);
  });

  it('refuses every governance surface to staff without manage_content, a non-staff account and no session', async () => {
    const paths: [string, 'get' | 'post'][] = [
      ['/tutor/live-content/status', 'get'],
      ['/tutor/packs', 'get'],
      [`/tutor/packs/${PACK_ID}/status`, 'post'],
      [`/tutor/review-queue/${SEGMENT_ID}/status`, 'post'],
    ];
    for (const [path, verb] of paths) {
      const calls: { url: string; method: string; body?: string }[] = [];
      stubGovernance({ permissions: ['view_analytics', 'manage_support'] }, calls);
      const staff = await request(createApp())[verb](`/api/v1/admin${path}`).set('Authorization', authed()).send({ status: 'published' });
      expect(staff.status, path).toBe(403);
      expect(calls.filter((c) => !c.url.includes('/user_roles') && !c.url.includes('/admin_permissions'))).toEqual([]);

      stubGovernance({ roles: ['kid'] });
      const kid = await request(createApp())[verb](`/api/v1/admin${path}`).set('Authorization', authed()).send({ status: 'published' });
      expect(kid.status, path).toBe(403);

      const anonymous = await request(createApp())[verb](`/api/v1/admin${path}`).send({ status: 'published' });
      expect(anonymous.status, path).toBe(401);
    }
  });

  it('refuses to publish a pack whose stored content breaks tutor-pack.v1, listing why (422)', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stubGovernance({
      packs: [{
        id: PACK_ID, skill_key: 'kc:money.percent-intro', kc_key: 'money.percent-intro', tier: 3, locale: 'en-US', status: 'review',
        pack: { contract: 'tutor-pack.v1', segments: [{ id: 'pack-x-1', type: 'quiz_mcq', prompt_md: 'Q', difficulty: 2, xp: 10, explanation_md: 'E', payload: { options: [{ id: 'a', text_md: 'A' }, { id: 'b', text_md: 'B' }] } }], answers: { 'pack-x-1': { correct_option_id: 'z' } } },
        pack_version: 1, content_hash: null, source: 'hand_authored', demand_pattern: 'kc_without_catalog_content', risk_category: 'standard',
        released_by: null, released_at: null, validated_at: null, updated_at: '2026-09-24T00:00:00Z',
      }],
    }, calls);
    const res = await request(createApp()).post(`/api/v1/admin/tutor/packs/${PACK_ID}/status`).set('Authorization', authed()).send({ status: 'published' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PACK_CONTRACT_FAILED');
    expect(res.body.error.failures.join('\n')).toMatch(/4-12 segments|teaching rationale|exactly once/);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('refuses an invented pack status and a malformed id', async () => {
    stubGovernance({});
    expect((await request(createApp()).post(`/api/v1/admin/tutor/packs/${PACK_ID}/status`).set('Authorization', authed()).send({ status: 'live' })).status).toBe(400);
    expect((await request(createApp()).post('/api/v1/admin/tutor/packs/nope/status').set('Authorization', authed()).send({ status: 'published' })).status).toBe(400);
    expect((await request(createApp()).get('/api/v1/admin/tutor/packs?status=draft').set('Authorization', authed())).status).toBe(400);
  });

  it('lists packs for review, answer keys included (staff judge the whole item)', async () => {
    stubGovernance({ packs: [{ id: PACK_ID, status: 'review', pack: { answers: { x: { value: 8 } } } }] });
    const res = await request(createApp()).get('/api/v1/admin/tutor/packs?status=review').set('Authorization', authed());
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});
