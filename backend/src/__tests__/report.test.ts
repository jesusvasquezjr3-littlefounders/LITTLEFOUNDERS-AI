import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { makeDb } from './learnFixtures.js';

/*
 * E.3 report escalation: the profile report action (bounded, child-safe
 * input; session-owned reporter; discovery-admitted target), the guardian
 * safety-notice read, and the staff review queue under manage_support.
 */

const REPORTER_ID = '33333333-3333-4333-8333-333333333333';
const TARGET_ID = '11111111-1111-4111-8111-111111111111';
const REPORT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const PARENT_ID = '55555555-5555-4555-8555-555555555555';
const KID_ID = '22222222-2222-4222-8222-222222222222';
const SUBJECT_ADULT = '66666666-6666-4666-8666-666666666666';
const SUBJECT_HIDDEN = '77777777-7777-4777-8777-777777777777';

const PROFILE_ROW = {
  user_id: TARGET_ID,
  display_name: 'Ana',
  username: 'ana',
  locale: 'es-MX',
  theme: 'system',
  cover: { preset: 'sunset' },
  birth_date: '1990-05-01',
  created_at: '2026-07-12T00:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

interface ReportStubOpts {
  reportResult?: unknown;
  reportStatus?: number;
  targetRoles?: string[] | null;
  guardianIds?: string[] | null;
  profileRows?: unknown[];
  /** social_tier answered for every account other than the target. */
  otherTier?: string;
  calls?: { url: string; method: string; body?: string }[];
}

function stubReport(opts: ReportStubOpts = {}) {
  const calls: { url: string; method: string; body?: string }[] = opts.calls ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (url.includes('/rpc/submit_social_report')) {
        return Promise.resolve(jsonResponse(opts.reportStatus ?? 200, opts.reportResult === undefined ? REPORT_ID : opts.reportResult));
      }
      if (url.includes('/rpc/social_tier')) {
        const id = (JSON.parse(String(init?.body ?? '{}')) as { p_user?: string }).p_user;
        if (id !== TARGET_ID) return Promise.resolve(jsonResponse(200, opts.otherTier ?? 'adult'));
        if (opts.targetRoles === null) return Promise.resolve(jsonResponse(200, null));
        return Promise.resolve(jsonResponse(200, (opts.targetRoles ?? ['parent']).includes('kid') ? 'guardian' : 'adult'));
      }
      if (url.includes('/rpc/has_current_social_approval')) return Promise.resolve(jsonResponse(200, false));
      if (url.includes('/rest/v1/profiles') && url.includes('user_id=in.')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/rest/v1/profiles')) return Promise.resolve(jsonResponse(200, opts.profileRows ?? [PROFILE_ROW]));
      if (url.includes('/rest/v1/guardian_links')) {
        return Promise.resolve(jsonResponse(200, opts.guardianIds === null ? null : (opts.guardianIds ?? []).map((parent_user_id) => ({ parent_user_id }))));
      }
      if (url.includes('/rest/v1/user_roles')) {
        return Promise.resolve(jsonResponse(200, opts.targetRoles === null ? null : (opts.targetRoles ?? ['parent']).map((role) => ({ role }))));
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

describe('POST /api/v1/profiles/:username/report', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).post('/api/v1/profiles/ana/report').send({ category: 'harassment' });
    expect(res.status).toBe(401);
  });

  it('refuses a self-report without invoking the report transaction', async () => {
    const calls = stubReport();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: TARGET_ID })}`)
      .send({ category: 'harassment' });
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.url.includes('/rpc/submit_social_report'))).toBe(false);
  });

  it('404s for a target the caller cannot currently see (hidden kid account)', async () => {
    const calls = stubReport({ targetRoles: ['kid'], guardianIds: [] });
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: REPORTER_ID })}`)
      .send({ category: 'harassment' });
    expect(res.status).toBe(404);
    expect(calls.some((c) => c.url.includes('/rpc/submit_social_report'))).toBe(false);
  });

  it('rejects an unknown category without invoking the report transaction', async () => {
    const calls = stubReport();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: REPORTER_ID })}`)
      .send({ category: 'free_form_anything' });
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.url.includes('/rpc/submit_social_report'))).toBe(false);
  });

  it('rejects a note longer than the 140-character cap', async () => {
    const calls = stubReport();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: REPORTER_ID })}`)
      .send({ category: 'harassment', note: 'x'.repeat(141) });
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.url.includes('/rpc/submit_social_report'))).toBe(false);
  });

  it('rejects caller-supplied identity fields (strict body)', async () => {
    const calls = stubReport();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: REPORTER_ID })}`)
      .send({ category: 'harassment', reporterId: TARGET_ID });
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.url.includes('/rpc/submit_social_report'))).toBe(false);
  });

  it('submits the report as the session user and returns the persisted receipt', async () => {
    const calls = stubReport();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: REPORTER_ID })}`)
      .send({ category: 'harassment', note: 'Kept asking me' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ reported: true, reportId: REPORT_ID });
    const rpc = calls.find((c) => c.url.includes('/rpc/submit_social_report'));
    expect(rpc?.method).toBe('POST');
    expect(JSON.parse(rpc!.body!)).toEqual({
      p_reporter_id: REPORTER_ID,
      p_subject_id: TARGET_ID,
      p_category: 'harassment',
      p_note: 'Kept asking me',
    });
  });

  it('passes every report from independent teens to the transaction as that teen (OD-3: the pattern counts by age)', async () => {
    // E.3 + OD-3 + D-19: three self-registered teens (teen tier, no kid role,
    // no guardian) reporting one adult. Core must not filter reporters by
    // role: each report reaches submit_social_report as the session teen, and
    // the database rule (evaluate_social_pattern, proven on PostgreSQL by
    // verify-social-pattern-postgres.py) opens the pattern case at the third.
    const teens = [
      'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
      'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
      'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
    ];
    const calls = stubReport({ targetRoles: ['universal'], otherTier: 'teen' });
    for (const teen of teens) {
      const res = await request(createApp())
        .post('/api/v1/profiles/ana/report')
        .set('Authorization', `Bearer ${mintToken({ sub: teen })}`)
        .send({ category: 'unwanted_contact' });
      expect(res.status).toBe(201);
    }
    const reporters = calls
      .filter((c) => c.url.includes('/rpc/submit_social_report'))
      .map((c) => (JSON.parse(c.body!) as { p_reporter_id: string; p_subject_id: string }));
    expect(reporters.map((r) => r.p_reporter_id)).toEqual(teens);
    expect(new Set(reporters.map((r) => r.p_subject_id))).toEqual(new Set([TARGET_ID]));
  });

  it('submits a null note when none is provided', async () => {
    const calls = stubReport();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: REPORTER_ID })}`)
      .send({ category: 'unwanted_contact' });
    expect(res.status).toBe(201);
    const rpc = calls.find((c) => c.url.includes('/rpc/submit_social_report'));
    expect(JSON.parse(rpc!.body!).p_note).toBeNull();
  });

  it('maps a transaction refusal (P0001) to 400 without claiming success', async () => {
    stubReport({ reportStatus: 400, reportResult: { code: 'P0001', message: 'INVALID_SOCIAL_REPORT' } });
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: REPORTER_ID })}`)
      .send({ category: 'other' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps a malformed transaction receipt to 502', async () => {
    stubReport({ reportStatus: 200, reportResult: 'not-a-uuid' });
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/report')
      .set('Authorization', `Bearer ${mintToken({ sub: REPORTER_ID })}`)
      .send({ category: 'other' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});

describe('GET /api/v1/family/social-notices', () => {
  let db: FakeDb;
  beforeEach(() => {
    db = makeDb(PARENT_ID);
    db.user_roles = [{ user_id: PARENT_ID, role: 'parent' }];
    db.parent_verifications = [{ user_id: PARENT_ID, status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' }];
    db.profiles = [{ user_id: SUBJECT_ADULT, display_name: 'Zed', username: 'zed' }];
    db.user_roles.push({ user_id: SUBJECT_ADULT, role: 'parent' });
    db.social_safety_notices = [
      { id: REPORT_ID, guardian_id: PARENT_ID, kid_user_id: KID_ID, kind: 'social.report', subject_id: SUBJECT_ADULT, report_id: null, created_at: '2026-09-24T10:00:00Z' },
    ];
    vi.stubGlobal('fetch', createFakeFetch(db));
  });

  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/family/social-notices');
    expect(res.status).toBe(401);
  });

  it('403s for a non-parent role', async () => {
    db.user_roles = [{ user_id: PARENT_ID, role: 'universal' }];
    const res = await request(createApp())
      .get('/api/v1/family/social-notices')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`);
    expect(res.status).toBe(403);
  });

  it('lists notices for this guardian with discoverable subject names', async () => {
    const res = await request(createApp())
      .get('/api/v1/family/social-notices')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.notices).toEqual([
      { noticeId: REPORT_ID, kidUserId: KID_ID, kind: 'social.report', subjectId: SUBJECT_ADULT, reportId: null, createdAt: '2026-09-24T10:00:00Z', subjectName: 'Zed' },
    ]);
    expect(res.body.data.nextOffset).toBeNull();
  });

  it('keeps a hidden subject private rather than leaking its name through the notice', async () => {
    db.user_roles.push({ user_id: SUBJECT_HIDDEN, role: 'kid' });
    db.social_safety_notices[0] = { ...db.social_safety_notices[0]!, subject_id: SUBJECT_HIDDEN };
    const res = await request(createApp())
      .get('/api/v1/family/social-notices')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.notices[0].subjectId).toBe(SUBJECT_HIDDEN);
    expect(res.body.data.notices[0].subjectName).toBeNull();
  });

  it('returns 502 for a malformed notice row rather than a successful partial list', async () => {
    db.social_safety_notices[0] = { ...db.social_safety_notices[0]!, kind: 'free_form_kind' };
    const res = await request(createApp())
      .get('/api/v1/family/social-notices')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`);
    expect(res.status).toBe(502);
  });
});

interface AdminReportStubOpts {
  roles?: unknown[] | null;
  grants?: unknown[] | null;
  cases?: unknown[] | null;
  caseDetail?: unknown[];
  reportStatusRows?: unknown[];
  reportDetailRows?: unknown[];
  resolveResult?: unknown;
  resolveStatus?: number;
  calls?: { url: string; method: string; body?: string }[];
}

const CASE_ROW = {
  subject_id: TARGET_ID,
  origin: 'report',
  status: 'open',
  first_seen_at: '2026-09-20T10:00:00Z',
  last_seen_at: '2026-09-24T10:00:00Z',
  resolved_at: null,
  resolved_by: null,
};

function stubAdminReports(opts: AdminReportStubOpts = {}) {
  const calls: { url: string; method: string; body?: string }[] = opts.calls ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (url.includes('/rest/v1/rpc/resolve_social_review_case')) {
        return Promise.resolve(jsonResponse(opts.resolveStatus ?? 200, opts.resolveResult === undefined ? true : opts.resolveResult));
      }
      if (url.includes('/rest/v1/user_roles')) {
        return Promise.resolve(jsonResponse(200, opts.roles === null ? null : (opts.roles ?? [{ role: 'admin' }])));
      }
      if (url.includes('/rest/v1/admin_permissions')) {
        return Promise.resolve(jsonResponse(200, opts.grants === null ? null : (opts.grants ?? [{ user_id: ADMIN_ID, permission: 'manage_support' }])));
      }
      if (url.includes('/rest/v1/social_review_cases') && url.includes('subject_id=eq.')) {
        return Promise.resolve(jsonResponse(200, opts.caseDetail ?? []));
      }
      if (url.includes('/rest/v1/social_review_cases')) {
        return Promise.resolve(jsonResponse(200, opts.cases === null ? null : (opts.cases ?? [])));
      }
      if (url.includes('/rest/v1/social_reports') && url.includes('subject_id=in.')) {
        return Promise.resolve(jsonResponse(200, opts.reportStatusRows ?? []));
      }
      if (url.includes('/rest/v1/social_reports')) {
        return Promise.resolve(jsonResponse(200, opts.reportDetailRows ?? []));
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

const adminAuth = (sub = ADMIN_ID) => `Bearer ${mintToken({ sub })}`;

describe('staff report queue (manage_support)', () => {
  it('denies GET /admin/reports without the manage_support grant before any queue read', async () => {
    const calls = stubAdminReports({ grants: [] });
    const res = await request(createApp()).get('/api/v1/admin/reports').set('Authorization', adminAuth());
    expect(res.status).toBe(403);
    expect(calls.some((c) => c.url.includes('/rest/v1/social_review_cases'))).toBe(false);
  });

  it('denies report resolution without the manage_support grant', async () => {
    const calls = stubAdminReports({ grants: [] });
    const res = await request(createApp())
      .post(`/api/v1/admin/reports/${TARGET_ID}/status`)
      .set('Authorization', adminAuth())
      .send({ status: 'resolved' });
    expect(res.status).toBe(403);
    expect(calls.some((c) => c.url.includes('/rest/v1/rpc/resolve_social_review_case'))).toBe(false);
  });

  it('lists open cases first with report counts', async () => {
    stubAdminReports({
      cases: [CASE_ROW, { ...CASE_ROW, subject_id: SUBJECT_ADULT, status: 'resolved', origin: 'pattern' }],
      reportStatusRows: [
        { subject_id: TARGET_ID, status: 'open' },
        { subject_id: TARGET_ID, status: 'open' },
        { subject_id: TARGET_ID, status: 'resolved' },
        { subject_id: SUBJECT_ADULT, status: 'resolved' },
      ],
    });
    const res = await request(createApp()).get('/api/v1/admin/reports').set('Authorization', adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.cases).toEqual([
      { subjectId: TARGET_ID, origin: 'report', status: 'open', firstSeenAt: '2026-09-20T10:00:00Z', lastSeenAt: '2026-09-24T10:00:00Z', resolvedAt: null, resolvedBy: null, reportCount: 3, openReportCount: 2 },
      { subjectId: SUBJECT_ADULT, origin: 'pattern', status: 'resolved', firstSeenAt: '2026-09-20T10:00:00Z', lastSeenAt: '2026-09-24T10:00:00Z', resolvedAt: null, resolvedBy: null, reportCount: 1, openReportCount: 0 },
    ]);
  });

  it('returns 502 when the queue read fails', async () => {
    stubAdminReports({ cases: null });
    const res = await request(createApp()).get('/api/v1/admin/reports').set('Authorization', adminAuth());
    expect(res.status).toBe(502);
  });

  it('returns the case detail with its reports and capped note', async () => {
    stubAdminReports({
      caseDetail: [CASE_ROW],
      reportDetailRows: [
        { id: REPORT_ID, reporter_id: REPORTER_ID, subject_id: TARGET_ID, category: 'harassment', note: 'Kept asking me', status: 'open', created_at: '2026-09-20T10:00:00Z', resolved_at: null },
      ],
    });
    const res = await request(createApp()).get(`/api/v1/admin/reports/${TARGET_ID}`).set('Authorization', adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.reports).toEqual([
      { id: REPORT_ID, reporterId: REPORTER_ID, category: 'harassment', note: 'Kept asking me', status: 'open', createdAt: '2026-09-20T10:00:00Z', resolvedAt: null },
    ]);
    expect(res.body.data.openReportCount).toBe(1);
  });

  it('returns 404 for an account with no case', async () => {
    stubAdminReports({ caseDetail: [] });
    const res = await request(createApp()).get(`/api/v1/admin/reports/${TARGET_ID}`).set('Authorization', adminAuth());
    expect(res.status).toBe(404);
  });

  it('resolves a case through the service-only transaction with the staff actor', async () => {
    const calls = stubAdminReports();
    const res = await request(createApp())
      .post(`/api/v1/admin/reports/${TARGET_ID}/status`)
      .set('Authorization', adminAuth())
      .send({ status: 'resolved' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ subjectId: TARGET_ID, status: 'resolved' });
    const rpc = calls.find((c) => c.url.includes('/rest/v1/rpc/resolve_social_review_case'));
    expect(JSON.parse(rpc!.body!)).toEqual({ p_subject: TARGET_ID, p_resolved_by: ADMIN_ID });
  });

  it('returns 404 when the transaction reports no case', async () => {
    stubAdminReports({ resolveStatus: 200, resolveResult: false });
    const res = await request(createApp())
      .post(`/api/v1/admin/reports/${TARGET_ID}/status`)
      .set('Authorization', adminAuth())
      .send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });

  it('rejects a non-resolved status body', async () => {
    const calls = stubAdminReports();
    const res = await request(createApp())
      .post(`/api/v1/admin/reports/${TARGET_ID}/status`)
      .set('Authorization', adminAuth())
      .send({ status: 'dismissed' });
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.url.includes('/rest/v1/rpc/resolve_social_review_case'))).toBe(false);
  });
});
