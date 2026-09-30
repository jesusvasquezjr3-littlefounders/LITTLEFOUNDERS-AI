import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../config.js';
import { buildIdentityReport, type IdentityCounts, type OnboardingDiscoveryCounts } from '../services/identityMetrics.js';
import { judgeOpsJob, OPS_JOB_STALE_HOURS, runSucceeded } from '../services/opsJobs.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * Gap-fix F1-staff-ops at the Core boundary:
 *   - Appendix M Part 1: GET /admin/analytics/identity (view_analytics);
 *   - H.4: the internal heartbeat, the internal and staff job status, and
 *     the watchdog's staleness verdict;
 *   - G.4: the access-review log (superadmin only, elevated grants only).
 * The SQL behind each is proven in database/scripts/verify-staff-ops-postgres.py.
 */

const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ID = '44444444-4444-4444-8444-444444444444';
const auth = (email = 'staff@littlefounders.ai') => `Bearer ${mintToken({ sub: STAFF_ID, email })}`;

const COUNTS: IdentityCounts = {
  window: { from: '2026-08-28T00:00:00Z', to: '2026-09-27T00:00:00Z', backlogCutoff: '2026-06-01T00:00:00Z' },
  guestOrigin: { requested: 4, flagged: 4, flaggedGuestsCreated: 4 },
  flagPersistence: { upgraded: 2, safeguarded: 2 },
  googleAgeScreen: { firstTime: 10, screened: 9 },
  googleUnder13: { declaredUnder13: 1, reclassified: 1 },
  entryCapture: {
    email: { created: 5, captured: 5 },
    google: { created: 10, captured: 9 },
    guest: { created: 4, captured: 4 },
    kid: { created: 3, captured: 3 },
  },
  undatedBacklog: { existing: 20, undated: 6 },
  parentTags: { holders: 5, idVerified: 3, staffGranted: 1, revoked: 1, untagged: 0 },
  staffGrantJustification: { staffGranted: 1, justified: 1, justificationsInWindow: 1 },
  revocation: { revokedRows: 1, revokedInWindow: 1, auditedRevocations: 1 },
  kidEmail: { kids: 3, restricted: 3, refusalsInWindow: 2 },
  unconsentedFlagged: { flagged: 6, flaggedActive: 4, accountsWithEvents: 0, events: 0, learningEvents: 0, familyMoneyEvents: 0 },
  faqCapabilities: { secondGuardian: true, cancellationCascade: true, reportTool: true },
  schemaFields: {
    originFlag: { produced: 6, consumed: true },
    verificationTier: { produced: 2, consumed: true },
    documentType: { declared: true, consumed: false },
    revocationStatus: { produced: 1, consumed: true },
  },
};

const DISCOVERY: OnboardingDiscoveryCounts = { answered: 8, unconsented: 0, flaggedOrigin: 0, kid: 0, under13Declared: 0, teenWithoutOptIn: 0 };

interface World {
  roles?: string[];
  permissions?: string[];
  identity?: { status: number; body: unknown };
  discovery?: { status: number; body: unknown };
  /** public.list_minor_record_tutors: Tutors whose own age record says a minor. */
  minorRecord?: { status: number; body: unknown };
  audit?: Record<string, { created_at: string; detail: Record<string, unknown> }[]>;
  auditStatus?: number;
  reviews?: { status: number; body: unknown };
  reviewRpc?: { status: number; body: unknown };
  calls?: { url: string; method: string; body?: string }[];
  /** G.2: content_bypass_metrics (the overdue retroactive checks the watchdog reads). */
  bypassMetrics?: { status: number; body: unknown };
  /** D.21: family_retention_runs rows (newest first). */
  familyRuns?: { status?: number; rows: { ran_at: string; removed: Record<string, unknown>; evidence_cleared: number | null; evidence_failed: number | null }[] };
  /** E.6: account_deletion_requests still processing, and the step-failure audit rows. */
  processing?: { status?: number; ids: string[] };
  stepFailures?: { created_at: string; detail: Record<string, unknown> }[];
  /** H.3: dataintel's undelivered alert triggers (GET /api/v1/intel/alerts/undelivered). */
  undelivered?: { status: number; body: unknown };
}

function stub(world: World = {}) {
  const calls = world.calls ?? [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, (world.roles ?? ['admin']).map((role) => ({ role }))));
    if (url.includes('/rest/v1/admin_permissions')) {
      return Promise.resolve(jsonResponse(200, (world.permissions ?? ['view_analytics', 'manage_support']).map((permission) => ({ user_id: STAFF_ID, permission }))));
    }
    if (url.includes('/rest/v1/rpc/identity_metrics')) return Promise.resolve(jsonResponse(world.identity?.status ?? 200, world.identity?.body ?? COUNTS));
    if (url.includes('/rest/v1/rpc/list_minor_record_tutors')) return Promise.resolve(jsonResponse(world.minorRecord?.status ?? 200, world.minorRecord?.body ?? []));
    if (url.includes('/rest/v1/rpc/onboarding_discovery_metrics')) return Promise.resolve(jsonResponse(world.discovery?.status ?? 200, world.discovery?.body ?? DISCOVERY));
    if (url.includes('/rest/v1/rpc/staff_access_review_status')) return Promise.resolve(jsonResponse(world.reviews?.status ?? 200, world.reviews?.body ?? { cadenceDays: 90, total: 0, stale: 0, reviewedEver: 0, grants: [] }));
    if (url.includes('/rest/v1/rpc/record_staff_access_review')) return Promise.resolve(jsonResponse(world.reviewRpc?.status ?? 200, world.reviewRpc?.body ?? 'recorded'));
    if (url.includes('/rest/v1/profiles')) return Promise.resolve(jsonResponse(200, [{ user_id: OTHER_ID, display_name: 'Ops Admin', username: 'ops' }]));
    if (url.includes('/rest/v1/rpc/content_bypass_metrics')) {
      return Promise.resolve(jsonResponse(world.bypassMetrics?.status ?? 200, world.bypassMetrics?.body
        ?? [{ publish_actions: 4, bypasses: 1, decided: 1, unverified: 0, complete: 1, overdue_open: 0 }]));
    }
    if (url.includes('/rest/v1/family_retention_runs')) {
      return Promise.resolve(jsonResponse(world.familyRuns?.status ?? 200, (world.familyRuns?.rows ?? []).slice(0, 1)));
    }
    if (url.includes('/rest/v1/account_deletion_requests')) {
      return Promise.resolve(jsonResponse(world.processing?.status ?? 200, (world.processing?.ids ?? []).map((id) => ({ id }))));
    }
    if (url.includes('/api/v1/intel/alerts/undelivered')) {
      return Promise.resolve(jsonResponse(world.undelivered?.status ?? 200, world.undelivered?.body ?? { data: { hours: 36, count: 0, alerts: [] }, error: null }));
    }
    if (url.includes('/rest/v1/audit_logs')) {
      if (world.auditStatus) return Promise.resolve(new Response(null, { status: world.auditStatus }));
      if (method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
      const action = /action=eq\.([^&]+)/.exec(url)?.[1] ?? '';
      if (action === 'account.deletion_step_failed') {
        const cutoff = /created_at=lt\.([^&]+)/.exec(url)?.[1] ?? '';
        const ids = /detail->>request_id=in\.\(([^)]*)\)/.exec(url)?.[1]?.split(',') ?? [];
        const rows = (world.stepFailures ?? []).filter((r) => r.created_at < cutoff && ids.includes(String(r.detail.request_id)));
        return Promise.resolve(jsonResponse(200, rows.map((r) => ({ detail: r.detail }))));
      }
      let rows = world.audit?.[action] ?? [];
      if (url.includes('detail->>ok=eq.true')) rows = rows.filter((r) => r.detail.ok === true);
      if (url.includes('detail->>suspensionsUnreadable=is.null')) rows = rows.filter((r) => r.detail.suspensionsUnreadable === undefined);
      if (url.includes('detail->>failed=eq.0')) rows = rows.filter((r) => r.detail.failed === 0);
      return Promise.resolve(jsonResponse(200, rows.slice(0, 1)));
    }
    throw new Error(`staffOps.test: unexpected ${method} ${url}`);
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

describe('Appendix M Part 1 — GET /api/v1/admin/analytics/identity', () => {
  it('reports every metric with its release-gate target or diagnostic mark', async () => {
    stub();
    const res = await request(createApp()).get('/api/v1/admin/analytics/identity?days=30').set('Authorization', auth());
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((res.body.data.metrics as { id: string }[]).map((m) => [m.id, m]));
    expect(Object.keys(byId)).toEqual([
      'guest_origin_flag_coverage', 'onboarding_discovery_unconsented', 'flagged_session_unconsented_events',
      'flag_persistence_through_upgrade', 'post_callback_age_screen_completion',
      'under13_google_reclassification', 'entry_path_age_capture', 'undated_account_backlog',
      'verification_status_differentiation', 'tutor_adult_age_record', 'staff_grant_justification_completeness', 'revocation_path_utilization',
      'kid_email_change_restriction', 'faq_claim_parity', 'schema_field_utilization',
    ]);
    expect(byId.guest_origin_flag_coverage).toMatchObject({ kind: 'release_gate', target: 1, value: 1, status: 'met' });
    expect(byId.onboarding_discovery_unconsented).toMatchObject({ kind: 'release_gate', part: '1.1', requirement: 'A.2', value: 1, status: 'met', detail: { unconsented: 0 } });
    expect(byId.flagged_session_unconsented_events).toMatchObject({
      kind: 'release_gate', part: '1.1', requirement: 'A.2', target: 1, numerator: 4, denominator: 4, value: 1, status: 'met',
      detail: { events: 0, flaggedActive: 4 },
    });
    expect(byId.post_callback_age_screen_completion).toMatchObject({ kind: 'release_gate', value: 0.9, status: 'missed' });
    expect(byId.undated_account_backlog).toMatchObject({ kind: 'diagnostic', target: null, value: 0.3, status: 'diagnostic' });
    expect(byId.revocation_path_utilization).toMatchObject({ kind: 'diagnostic', detail: { pathExercised: true } });
    // A declared document-type field nothing validates is reported, never assumed used.
    expect(byId.schema_field_utilization).toMatchObject({ status: 'missed', numerator: 3, denominator: 4 });
    expect(res.body.data.adversarial.map((a: { id: string }) => a.id)).toContain('age_screen_bypass');
    expect(JSON.stringify(res.body.data)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('refuses unknown query fields and an out-of-range window', async () => {
    stub();
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity?days=0').set('Authorization', auth())).status).toBe(400);
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity?user=x').set('Authorization', auth())).status).toBe(400);
  });

  it('answers 502, never zeros, when the database answer is missing or malformed', async () => {
    stub({ identity: { status: 200, body: { ...COUNTS, guestOrigin: { requested: 'many' } } } });
    const malformed = await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth());
    expect(malformed.status).toBe(502);
    stub({ identity: { status: 500, body: null } });
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth())).status).toBe(502);
    stub({ discovery: { status: 200, body: { ...DISCOVERY, unconsented: -1 } } });
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth())).status).toBe(502);
  });

  it('refuses staff without view_analytics, a family account and no session', async () => {
    const calls = stub({ permissions: ['manage_support'] });
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth())).status).toBe(403);
    expect(calls.some((c) => c.url.includes('identity_metrics'))).toBe(false);
    stub({ roles: ['parent'] });
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth())).status).toBe(403);
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity')).status).toBe(401);
  });

  it('computes rates from counts and marks an empty population as no data', () => {
    const report = buildIdentityReport({ ...COUNTS, guestOrigin: { requested: 0, flagged: 0, flaggedGuestsCreated: 0 } }, 30, DISCOVERY);
    expect(report.metrics.find((m) => m.id === 'guest_origin_flag_coverage')).toMatchObject({ value: null, status: 'no_data' });
    expect(report.releaseGate).toMatchObject({ total: 13, noData: 1 });
  });

  it('A.2/A.5: misses the Tutor age-record gate while a Tutor holds a minor age record, and names no account', async () => {
    stub({ minorRecord: { status: 200, body: [{ user_id: OTHER_ID }] } });
    const res = await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth());
    expect(res.status).toBe(200);
    const gate = (res.body.data.metrics as { id: string }[]).find((m) => m.id === 'tutor_adult_age_record');
    expect(gate).toMatchObject({ kind: 'release_gate', part: '1.2', numerator: 4, denominator: 5, status: 'missed', detail: { minorRecord: 1 } });
    expect(JSON.stringify(res.body.data)).not.toContain(OTHER_ID);
    stub();
    const clean = await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth());
    expect((clean.body.data.metrics as { id: string }[]).find((m) => m.id === 'tutor_adult_age_record')).toMatchObject({ value: 1, status: 'met' });
  });

  it('A.2/A.5: answers 502, never "no minor Tutors", when the age-record list is unreadable or malformed', async () => {
    stub({ minorRecord: { status: 500, body: null } });
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth())).status).toBe(502);
    stub({ minorRecord: { status: 200, body: [{ user_id: 'not-a-uuid' }] } });
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth())).status).toBe(502);
  });

  it('Appendix M 1.1: misses the flagged-session gate on any stored event after the flag, and reads no data with no active flagged account', () => {
    const one = buildIdentityReport({ ...COUNTS, unconsentedFlagged: {
      flagged: 6, flaggedActive: 4, accountsWithEvents: 1, events: 1, learningEvents: 0, familyMoneyEvents: 1 } }, 30, DISCOVERY);
    expect(one.metrics.find((m) => m.id === 'flagged_session_unconsented_events')).toMatchObject({
      numerator: 3, denominator: 4, status: 'missed', detail: { events: 1, familyMoneyEvents: 1, accountsWithEvents: 1 },
    });
    expect(one.releaseGate.missed).toBeGreaterThan(buildIdentityReport(COUNTS, 30, DISCOVERY).releaseGate.missed);
    // An inconsistent answer (events with no active account) still misses, never reads "no data".
    const orphan = buildIdentityReport({ ...COUNTS, unconsentedFlagged: {
      flagged: 1, flaggedActive: 0, accountsWithEvents: 0, events: 2, learningEvents: 2, familyMoneyEvents: 0 } }, 30, DISCOVERY);
    expect(orphan.metrics.find((m) => m.id === 'flagged_session_unconsented_events')).toMatchObject({ status: 'missed' });
    const idle = buildIdentityReport({ ...COUNTS, unconsentedFlagged: {
      flagged: 6, flaggedActive: 0, accountsWithEvents: 0, events: 0, learningEvents: 0, familyMoneyEvents: 0 } }, 30, DISCOVERY);
    expect(idle.metrics.find((m) => m.id === 'flagged_session_unconsented_events')).toMatchObject({ value: null, status: 'no_data' });
    // The guard's own proof stays listed as an adversarial suite.
    expect(one.adversarial.map((a) => a.id)).toContain('flagged_session_unconsented_analytics');
  });

  it('Appendix M 1.1: answers 502, never zeros, when the database omits or garbles the flagged-session count', async () => {
    const withoutFlagged: Partial<IdentityCounts> = { ...COUNTS };
    delete withoutFlagged.unconsentedFlagged;
    stub({ identity: { status: 200, body: withoutFlagged } });
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth())).status).toBe(502);
    stub({ identity: { status: 200, body: { ...COUNTS, unconsentedFlagged: { ...COUNTS.unconsentedFlagged, events: -1 } } } });
    expect((await request(createApp()).get('/api/v1/admin/analytics/identity').set('Authorization', auth())).status).toBe(502);
  });

  it('misses the A.2 target when one flagged account has a stored discovery answer', () => {
    const report = buildIdentityReport(COUNTS, 30, { ...DISCOVERY, unconsented: 1, flaggedOrigin: 1 });
    expect(report.metrics.find((m) => m.id === 'onboarding_discovery_unconsented'))
      .toMatchObject({ numerator: 7, denominator: 8, status: 'missed', detail: { flaggedOrigin: 1 } });
  });
});

describe('H.4 — the operations heartbeat and watchdog', () => {
  const key = () => getConfig().INTERNAL_API_KEY;

  it('records a heartbeat as a system action and refuses a missing key or a malformed body', async () => {
    const calls = stub();
    const res = await request(createApp()).post('/api/v1/internal/ops/heartbeat').set('x-internal-api-key', key())
      .send({ job: 'vault_backup', ok: true, bytes: 1048576 });
    expect(res.status).toBe(201);
    const audit = calls.find((c) => c.url.includes('/rest/v1/audit_logs') && c.method === 'POST');
    expect(JSON.parse(audit!.body!)).toEqual({ actor_id: null, action: 'ops.vault_backup.completed', subject: 'vault_backup', detail: { ok: true, bytes: 1048576 } });
    expect((await request(createApp()).post('/api/v1/internal/ops/heartbeat').send({ job: 'vault_backup', ok: true })).status).toBe(403);
    expect((await request(createApp()).post('/api/v1/internal/ops/heartbeat').set('x-internal-api-key', key()).send({ job: 'backup_everything', ok: true })).status).toBe(400);
    expect((await request(createApp()).post('/api/v1/internal/ops/heartbeat').set('x-internal-api-key', key()).send({ job: 'vault_drift', ok: true, extra: 1 })).status).toBe(400);
  });

  it('answers 502 when the heartbeat does not land, so the job itself fails', async () => {
    stub({ auditStatus: 500 });
    const res = await request(createApp()).post('/api/v1/internal/ops/heartbeat').set('x-internal-api-key', key()).send({ job: 'pulse_backup', ok: true });
    expect(res.status).toBe(502);
  });

  it('reports each job fresh or stale from the audit trail; never ran and a failed-only run are stale', async () => {
    stub({ audit: {
      'ops.vault_backup.completed': [{ created_at: hoursAgo(2), detail: { ok: true, bytes: 10 } }],
      'ops.pulse_backup.completed': [{ created_at: hoursAgo(1), detail: { ok: false } }],
    } });
    const res = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(res.status).toBe(200);
    const jobs = Object.fromEntries((res.body.data.jobs as { job: string }[]).map((j) => [j.job, j]));
    expect(jobs.vault_backup).toMatchObject({ stale: false, lastRunDetail: { ok: true, bytes: 10 } });
    expect(jobs.pulse_backup).toMatchObject({ stale: true, lastRunAt: null, lastAttemptOk: false });
    expect(jobs.vault_drift).toMatchObject({ stale: true, lastRunAt: null, lastAttemptAt: null });
    expect(res.body.data.anyStale).toBe(true);
    expect(res.body.data.contentRetroChecks).toEqual({ overdue: 0, windowDays: 30 });
  });

  it('G.2: carries the overdue retroactive release checks, and an unreadable count is a 502', async () => {
    stub({ bypassMetrics: { status: 200, body: [{ publish_actions: 4, bypasses: 2, decided: 2, unverified: 1, complete: 1, overdue_open: 1 }] } });
    const res = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(res.status).toBe(200);
    expect(res.body.data.contentRetroChecks).toEqual({ overdue: 1, windowDays: 30 });
    stub({ bypassMetrics: { status: 500, body: null } });
    expect((await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key())).status).toBe(502);
  });

  it('Appendix O 1.3: carries the Mentor retention sweep as a watched job, from the same trail and window as its own route', async () => {
    stub({ audit: { 'tutor.retention.swept': [{ created_at: hoursAgo(40), detail: { sessionsDeleted: 2 } }] } });
    const res = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(res.status).toBe(200);
    expect(res.body.data.tutorRetention).toMatchObject({
      job: 'tutor_retention', stale: true, staleAfterHours: 36, lastAttemptOk: true, lastRunDetail: { sessionsDeleted: 2 },
    });
    expect(res.body.data.anyStale).toBe(true);
    // The staff console shows the Mentor sweep on its own card, so it is not in `jobs`.
    expect((res.body.data.jobs as { job: string }[]).map((j) => j.job)).toEqual([
      'vault_backup', 'pulse_backup', 'vault_drift', 'learning_retention', 'insights_prune', 'account_deletions', 'family_retention', 'social_retention',
      'badge_link_retirement',
    ]);
    stub({ audit: { 'tutor.retention.swept': [{ created_at: hoursAgo(5), detail: {} }] } });
    const fresh = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(fresh.body.data.tutorRetention).toMatchObject({ stale: false });
    stub();
    const never = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(never.body.data.tutorRetention).toMatchObject({ stale: true, lastRunAt: null, lastAttemptOk: null });
  });

  it('G.4: carries the elevated grants past the 90-day access review, and an unreadable count is a 502', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stub({ calls, reviews: { status: 200, body: { cadenceDays: 90, total: 3, stale: 2, reviewedEver: 1, grants: [] } } });
    const res = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(res.status).toBe(200);
    expect(res.body.data.accessReviews).toEqual({ due: 2, total: 3, windowDays: 90 });
    const rpc = calls.find((call) => call.url.includes('/rpc/staff_access_review_status'));
    expect(JSON.parse(rpc!.body!)).toEqual({ p_cadence_days: 90 });
    stub({ reviews: { status: 500, body: null } });
    expect((await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key())).status).toBe(502);
    stub({ reviews: { status: 200, body: { cadenceDays: 90, total: 'many' } } });
    expect((await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key())).status).toBe(502);
  });

  it('H.3: carries the warehouse alert triggers that notified nobody; an unreadable warehouse is a null count, never zero and never a 502', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const failed = { alertId: 'a1', name: 'dau drop', channel: 'webhook', triggeredAt: '2026-09-29T08:00:00Z', status: 'failed', error: 'HTTP 502', attempts: 3 };
    stub({ calls, undelivered: { status: 200, body: { data: { hours: 36, count: 1, alerts: [failed] }, error: null } } });
    const res = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toEqual({ undelivered: 1, windowHours: 36, alerts: [failed] });
    const read = calls.find((call) => call.url.includes('/alerts/undelivered'))!;
    expect(read.url).toContain('hours=36');
    stub();
    expect((await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key())).body.data.alerts)
      .toEqual({ undelivered: 0, windowHours: 36, alerts: [] });
    for (const undelivered of [{ status: 502, body: { data: null, error: { code: 'DATA_UNAVAILABLE' } } }, { status: 200, body: { data: { count: 'x' }, error: null } }]) {
      stub({ undelivered });
      const down = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
      expect(down.status).toBe(200);
      expect(down.body.data.alerts).toEqual({ undelivered: null, windowHours: 36, alerts: [] });
    }
  });

  it('GAP-FIX-R6: accepts a heartbeat from the learning retention sweep and the insights prune, and none for a trail job', async () => {
    const calls = stub();
    for (const job of ['learning_retention', 'insights_prune']) {
      const res = await request(createApp()).post('/api/v1/internal/ops/heartbeat').set('x-internal-api-key', key()).send({ job, ok: true });
      expect(res.status).toBe(201);
    }
    const actions = calls.filter((c) => c.method === 'POST' && c.url.includes('/audit_logs')).map((c) => JSON.parse(c.body!).action);
    expect(actions).toEqual(['ops.learning_retention.completed', 'ops.insights_prune.completed']);
    // A trail job keeps its own record: a heartbeat can never fake one.
    for (const job of ['account_deletions', 'family_retention', 'social_retention', 'tutor_retention', 'badge_link_retirement']) {
      expect((await request(createApp()).post('/api/v1/internal/ops/heartbeat').set('x-internal-api-key', key()).send({ job, ok: true })).status).toBe(400);
    }
  });

  it('GAP-FIX-R6: judges the account-deletion, family and social sweeps from their own trails', async () => {
    stub({
      audit: {
        'account_deletions.sweep_ran': [{ created_at: hoursAgo(3), detail: { scanned: 0, suspensionsUnreadable: true } }, { created_at: hoursAgo(30), detail: { scanned: 2 } }],
        'social_retention.sweep_ran': [{ created_at: hoursAgo(40), detail: { edges: 1 } }],
        'ops.learning_retention.completed': [{ created_at: hoursAgo(4), detail: { ok: true } }],
      },
      familyRuns: { rows: [{ ran_at: hoursAgo(2), removed: { decisions: 3 }, evidence_cleared: 1, evidence_failed: 0 }] },
    });
    const res = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(res.status).toBe(200);
    const jobs = Object.fromEntries((res.body.data.jobs as { job: string }[]).map((j) => [j.job, j]));
    // The paused children were unreadable on the latest run: a failed attempt; the last good run was 30 h ago.
    expect(jobs.account_deletions).toMatchObject({ stale: false, lastAttemptOk: false, lastRunDetail: { scanned: 2 } });
    expect(jobs.family_retention).toMatchObject({ stale: false, lastAttemptOk: true, lastRunDetail: { removed: { decisions: 3 }, evidenceCleared: 1, evidenceFailed: 0 } });
    expect(jobs.social_retention).toMatchObject({ stale: true, staleAfterHours: 36, lastAttemptOk: true });
    expect(jobs.learning_retention).toMatchObject({ stale: false });
    expect(jobs.insights_prune).toMatchObject({ stale: true, lastRunAt: null, lastAttemptAt: null });
    expect(res.body.data.anyStale).toBe(true);
    expect(res.body.data.accountDeletionFailures).toEqual({ stuck: 0, afterHours: 24 });
  });

  it('GAP-FIX-R8 (F.2 under OD-20, D-08): judges the legacy badge-image purge from its own trail; a page that failed to purge is a failed attempt', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stub({ calls, audit: { 'badge_links.images_swept': [
      { created_at: hoursAgo(2), detail: { scanned: 4, purged: 2, stillReferenced: 0, failed: 2, limit: 500, offset: 0, retired: false } },
      { created_at: hoursAgo(26), detail: { scanned: 3, purged: 3, stillReferenced: 0, failed: 0, limit: 500, offset: 0, retired: false } },
    ] } });
    const res = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(res.status).toBe(200);
    const jobs = Object.fromEntries((res.body.data.jobs as { job: string }[]).map((j) => [j.job, j]));
    expect(jobs.badge_link_retirement).toMatchObject({ stale: false, staleAfterHours: 36, lastAttemptOk: false, lastRunDetail: { failed: 0, purged: 3 } });
    // The clean-run read filters on the failure count; the attempt read does not.
    const reads = calls.filter((c) => c.url.includes('action=eq.badge_links.images_swept')).map((c) => c.url);
    expect(reads.some((url) => url.includes('detail->>failed=eq.0'))).toBe(true);
    expect(reads.some((url) => !url.includes('detail->>failed=eq.0'))).toBe(true);
    // A sweep that keeps failing goes stale exactly like one that stopped.
    stub({ audit: { 'badge_links.images_swept': [
      { created_at: hoursAgo(3), detail: { scanned: 1, purged: 0, stillReferenced: 0, failed: 1 } },
      { created_at: hoursAgo(40), detail: { scanned: 1, purged: 1, stillReferenced: 0, failed: 0 } },
    ] } });
    const failing = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    const failingJob = (failing.body.data.jobs as { job: string; stale: boolean }[]).find((j) => j.job === 'badge_link_retirement');
    expect(failingJob).toMatchObject({ stale: true, lastAttemptOk: false });
    expect(failing.body.data.anyStale).toBe(true);
    // Never ran is stale too, never healthy.
    stub();
    const never = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect((never.body.data.jobs as { job: string }[]).find((j) => j.job === 'badge_link_retirement')).toMatchObject({ stale: true, lastRunAt: null, lastAttemptAt: null });
  });

  it('GAP-FIX-R8: runSucceeded counts a badge sweep page only when nothing failed', () => {
    expect(runSucceeded('badge_link_retirement', { scanned: 2, purged: 2, failed: 0 })).toBe(true);
    expect(runSucceeded('badge_link_retirement', { scanned: 2, purged: 1, failed: 1 })).toBe(false);
    expect(runSucceeded('badge_link_retirement', { scanned: 2 })).toBe(false);
    expect(runSucceeded('badge_link_retirement', null)).toBe(false);
    expect(OPS_JOB_STALE_HOURS.badge_link_retirement).toBe(36);
  });

  it('GAP-FIX-R6: a family run table that cannot be read is a 502, never "never ran"', async () => {
    stub({ familyRuns: { status: 500, rows: [] } });
    expect((await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key())).status).toBe(502);
  });

  it('E.6: counts erasures still processing whose step failed more than 24 h ago, and an unreadable list is a 502', async () => {
    const A = '0a0a0a0a-0000-4000-8000-00000000000a';
    const B = '0b0b0b0b-0000-4000-8000-00000000000b';
    const C = '0c0c0c0c-0000-4000-8000-00000000000c';
    stub({
      processing: { ids: [A, B] },
      stepFailures: [
        { created_at: hoursAgo(30), detail: { request_id: A, step: 'depot' } },
        { created_at: hoursAgo(26), detail: { request_id: A, step: 'depot' } },
        // B failed an hour ago: the sweep has not had its day yet.
        { created_at: hoursAgo(1), detail: { request_id: B, step: 'oracle' } },
        // C failed long ago but completed since, so it is no longer processing.
        { created_at: hoursAgo(80), detail: { request_id: C, step: 'dataintel' } },
      ],
    });
    const res = await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key());
    expect(res.status).toBe(200);
    expect(res.body.data.accountDeletionFailures).toEqual({ stuck: 1, afterHours: 24 });
    stub({ processing: { status: 500, ids: [] } });
    expect((await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', key())).status).toBe(502);
  });


  it('refuses the internal status without the internal key', async () => {
    stub();
    expect((await request(createApp()).get('/api/v1/internal/ops/job-status')).status).toBe(403);
    expect((await request(createApp()).get('/api/v1/internal/ops/job-status').set('x-internal-api-key', 'wrong-key-0000000000000000')).status).toBe(403);
  });

  it('shows staff the same status behind manage_support, and a failed read is a 502', async () => {
    stub({ permissions: ['view_analytics'] });
    expect((await request(createApp()).get('/api/v1/admin/ops/job-status').set('Authorization', auth())).status).toBe(403);
    stub();
    expect((await request(createApp()).get('/api/v1/admin/ops/job-status').set('Authorization', auth())).status).toBe(200);
    stub({ auditStatus: 500 });
    const down = await request(createApp()).get('/api/v1/admin/ops/job-status').set('Authorization', auth());
    expect(down.status).toBe(502);
    expect(down.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('judges staleness against the one constant per job', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const at = (h: number) => ({ created_at: new Date(now.getTime() - h * 3_600_000).toISOString(), detail: { ok: true } });
    expect(OPS_JOB_STALE_HOURS.vault_backup).toBe(36);
    expect(judgeOpsJob('vault_backup', at(35), at(35), now).stale).toBe(false);
    expect(judgeOpsJob('vault_backup', at(37), at(37), now).stale).toBe(true);
    expect(judgeOpsJob('vault_drift', undefined, undefined, now)).toMatchObject({ stale: true, hoursSinceLastRun: null });
  });
});

describe('G.4 — the access-review log (Roles & Access)', () => {
  const REVIEW_BODY = {
    cadenceDays: 90, total: 2, stale: 1, reviewedEver: 1,
    grants: [
      { userId: OTHER_ID, kind: 'role', grant: 'admin', grantedAt: '2026-01-01T00:00:00Z', lastReviewedAt: null, due: true },
      { userId: OTHER_ID, kind: 'permission', grant: 'manage_users', grantedAt: '2026-01-01T00:00:00Z', lastReviewedAt: '2026-09-01T00:00:00Z', due: false },
    ],
  };

  it('lists the elevated grants with the Appendix N compliance and stale-grant numbers', async () => {
    stub({ roles: ['superadmin'], reviews: { status: 200, body: REVIEW_BODY } });
    const res = await request(createApp()).get('/api/v1/admin/roles/reviews').set('Authorization', auth('boss@littlefounders.ai'));
    expect(res.status).toBe(200);
    expect(res.body.data.metrics).toEqual({ total: 2, stale: 1, reviewedEver: 1, compliance: 0.5, staleRate: 0.5 });
    expect(res.body.data.grants[0]).toMatchObject({ grant: 'admin', due: true, displayName: 'Ops Admin' });
  });

  it('refuses a family role or unknown grant before the database, and a plain admin entirely', async () => {
    const calls = stub({ roles: ['superadmin'] });
    for (const body of [
      { userId: OTHER_ID, kind: 'role', grant: 'parent' },
      { userId: OTHER_ID, kind: 'permission', grant: 'admin' },
      { userId: OTHER_ID, kind: 'role', grant: 'admin', note: '<script>' },
      { userId: 'nope', kind: 'role', grant: 'admin' },
    ]) {
      expect((await request(createApp()).post('/api/v1/admin/roles/review').set('Authorization', auth('boss@littlefounders.ai')).send(body)).status).toBe(400);
    }
    expect(calls.some((c) => c.url.includes('record_staff_access_review'))).toBe(false);
    stub({ roles: ['admin'] });
    expect((await request(createApp()).post('/api/v1/admin/roles/review').set('Authorization', auth()).send({ userId: OTHER_ID, kind: 'role', grant: 'admin' })).status).toBe(403);
    expect((await request(createApp()).get('/api/v1/admin/roles/reviews').set('Authorization', auth())).status).toBe(403);
  });

  it('records a kept review, and maps not-held, refused and unconfirmed outcomes', async () => {
    const calls = stub({ roles: ['superadmin'] });
    const kept = await request(createApp()).post('/api/v1/admin/roles/review').set('Authorization', auth('boss@littlefounders.ai'))
      .send({ userId: OTHER_ID, kind: 'permission', grant: 'manage_users', note: 'Quarterly review' });
    expect(kept.status).toBe(200);
    expect(JSON.parse(calls.find((c) => c.url.includes('record_staff_access_review'))!.body!)).toEqual({
      p_subject: OTHER_ID, p_kind: 'permission', p_grant_key: 'manage_users', p_actor: STAFF_ID, p_outcome: 'kept', p_note: 'Quarterly review',
    });
    stub({ roles: ['superadmin'], reviewRpc: { status: 200, body: 'not_held' } });
    expect((await request(createApp()).post('/api/v1/admin/roles/review').set('Authorization', auth('boss@littlefounders.ai'))
      .send({ userId: OTHER_ID, kind: 'role', grant: 'admin' })).status).toBe(409);
    stub({ roles: ['superadmin'], reviewRpc: { status: 403, body: { code: '42501', message: 'ACCESS_REVIEW_FORBIDDEN' } } });
    expect((await request(createApp()).post('/api/v1/admin/roles/review').set('Authorization', auth('boss@littlefounders.ai'))
      .send({ userId: OTHER_ID, kind: 'role', grant: 'admin' })).status).toBe(409);
    stub({ roles: ['superadmin'], reviewRpc: { status: 500, body: null } });
    expect((await request(createApp()).post('/api/v1/admin/roles/review').set('Authorization', auth('boss@littlefounders.ai'))
      .send({ userId: OTHER_ID, kind: 'role', grant: 'admin' })).status).toBe(502);
  });
});
