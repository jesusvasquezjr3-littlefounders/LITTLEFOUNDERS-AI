import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { makeDb } from './learnFixtures.js';

/*
 * First-party telemetry (/INSIGHTS.md): the §1.9 consent gate is the point
 * of this suite. A kid's events are recorded ONLY while a verified guardian
 * has granted consent — fail-closed on everything else — and identity/role
 * are stamped server-side, never trusted from the client.
 */

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const KID_ID = '22222222-2222-4222-8222-222222222222';
const ADULT_ID = '33333333-3333-4333-8333-333333333333';

let db: FakeDb;

beforeEach(() => {
  db = makeDb(ADULT_ID);
  db.user_roles = [
    { user_id: PARENT_ID, role: 'parent' },
    { user_id: KID_ID, role: 'kid' },
    { user_id: ADULT_ID, role: 'universal' },
  ];
  db.guardian_links = [{ parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' }];
  db.analytics_consents = [];
  db.learning_events = [];
  db.anon_visitors = [];
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const as = (userId: string) => (req: request.Test) => req.set('Authorization', `Bearer ${mintToken({ sub: userId })}`);
const postEvents = (app: ReturnType<typeof createApp>, userId: string, events: unknown[]) =>
  as(userId)(request(app).post('/api/v1/events')).send({ events });

describe('POST /api/v1/events', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).post('/api/v1/events').send({ events: [{ event: 'session_start' }] });
    expect(res.status).toBe(401);
  });

  it('drops events outside the closed vocabulary but keeps their batch siblings', async () => {
    const res = await postEvents(createApp(), ADULT_ID, [
      { event: 'chat_message', segmentId: 'free text here!' }, // invalid: dropped
      { event: 'nav_view', routeClass: 'learn' }, // valid: kept
    ]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(1);
    expect(db.learning_events).toHaveLength(1);
    expect(db.learning_events[0]).toMatchObject({ event: 'nav_view' });
  });

  it('rejects a segmentId outside the content-id charset (no free-text channel)', async () => {
    const res = await postEvents(createApp(), ADULT_ID, [
      { event: 'audio_replay', segmentId: 'Sofia lives at 5th&Main' },
    ]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(0);
    expect(db.learning_events).toHaveLength(0);
  });

  it('still 400s when the batch envelope itself is malformed', async () => {
    const res = await postEvents(createApp(), ADULT_ID, []);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('routes an EMPTY role set through the kid gate (fail-closed), never around it', async () => {
    db.user_roles = db.user_roles.filter((r) => r.user_id !== ADULT_ID);
    const res = await postEvents(createApp(), ADULT_ID, [{ event: 'session_start' }]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(0);
    expect(db.learning_events).toHaveLength(0);
  });

  it('records adult events and stamps identity/role SERVER-side', async () => {
    const res = await postEvents(createApp(), ADULT_ID, [
      // The user_id here is an attempted spoof — the schema strips it and
      // the row must carry the SESSION's identity.
      { event: 'session_start', user_id: KID_ID },
      { event: 'nav_view', routeClass: 'learn' },
    ]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(2);
    expect(db.learning_events).toHaveLength(2);
    for (const row of db.learning_events) {
      expect(row.user_id).toBe(ADULT_ID);
      expect(row.role).toBe('universal');
    }
  });

  it('deduplicates retried client events and reports the exact accepted count', async () => {
    const event = {
      event: 'lesson_start',
      lessonId: '44444444-4444-4444-8444-444444444444',
      clientEventId: '55555555-5555-4555-8555-555555555555',
      occurredAt: new Date().toISOString(),
    };
    const app = createApp();
    const first = await postEvents(app, ADULT_ID, [event]);
    const retry = await postEvents(app, ADULT_ID, [event]);
    expect(first.body.data.accepted).toBe(1);
    expect(retry.body.data.accepted).toBe(0);
    expect(db.learning_events).toHaveLength(1);
  });

  it('drops timestamps outside the bounded client-clock window', async () => {
    const res = await postEvents(createApp(), ADULT_ID, [{
      event: 'nav_view',
      occurredAt: '2000-01-01T00:00:00.000Z',
    }]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(0);
    expect(db.learning_events).toHaveLength(0);
  });

  it('DROPS kid events when no consent exists — acknowledged, zero recorded', async () => {
    const res = await postEvents(createApp(), KID_ID, [{ event: 'lesson_start', lessonId: '44444444-4444-4444-8444-444444444444' }]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(0);
    expect(db.learning_events).toHaveLength(0);
  });

  it('records kid events while guardian consent is ACTIVE', async () => {
    db.analytics_consents = [{ kid_user_id: KID_ID, granted_by: PARENT_ID, granted_at: '2026-07-29T00:00:00Z', revoked_at: null }];
    const res = await postEvents(createApp(), KID_ID, [{ event: 'session_start' }]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(1);
    expect(db.learning_events[0]).toMatchObject({ user_id: KID_ID, role: 'kid', event: 'session_start' });
  });

  it('DROPS kid events again after consent is revoked', async () => {
    db.analytics_consents = [{ kid_user_id: KID_ID, granted_by: PARENT_ID, granted_at: '2026-07-29T00:00:00Z', revoked_at: '2026-07-29T01:00:00Z' }];
    const res = await postEvents(createApp(), KID_ID, [{ event: 'session_start' }]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(0);
    expect(db.learning_events).toHaveLength(0);
  });
});

/*
 * Regression: signup_complete is emitted in the same tick the session is
 * created, while the beacon is still anonymous. It was missing from the
 * allowlist, so funnel step 3 ("signed_up") could never be non-zero — the
 * single most important number in the acquisition funnel silently read 0.
 */
describe('anonymous acquisition path', () => {
  const ANON_ID = '77777777-7777-4777-8777-777777777777';
  const postAnon = (events: unknown[]) =>
    request(createApp()).post('/api/v1/events').send({ events, anonId: ANON_ID });

  it('records the WHOLE signup funnel, including signup_complete', async () => {
    const res = await postAnon([
      { event: 'page_view', routeClass: 'marketing' },
      { event: 'signup_start', routeClass: 'marketing' },
      { event: 'signup_submit', routeClass: 'marketing' },
      { event: 'signup_complete', routeClass: 'marketing' },
    ]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(4);
    expect(db.learning_events.map((e) => e.event)).toContain('signup_complete');
    expect(db.learning_events.every((e) => e.role === 'anon' && e.user_id === null)).toBe(true);
  });

  it('REFUSES product behaviour from an anonymous caller', async () => {
    // "Anonymous" on a product surface means "a kid whose consent we have not
    // checked" — this path must never carry learning behaviour.
    const res = await postAnon([
      { event: 'lesson_start', routeClass: 'learn' },
      { event: 'segment_submit', routeClass: 'learn', segmentId: 'quiz-1' },
      { event: 'page_view', routeClass: 'marketing' },
    ]);
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(1);
    expect(db.learning_events.map((e) => e.event)).toEqual(['page_view']);
  });

  it('registers the visitor with campaign attribution', async () => {
    await request(createApp()).post('/api/v1/events').send({
      events: [{ event: 'page_view', routeClass: 'marketing' }],
      anonId: ANON_ID,
      visitor: { referrerClass: 'campaign', utmSource: 'meta_ads', utmCampaign: 'spring_launch', device: 'mobile' },
    });
    expect(db.anon_visitors).toHaveLength(1);
    expect(db.anon_visitors[0]).toMatchObject({ utm_campaign: 'spring_launch', referrer_class: 'campaign' });
  });
});

describe('family analytics consent', () => {
  it('a verified guardian can grant, and the kids list reflects it', async () => {
    const app = createApp();
    const grant = await as(PARENT_ID)(request(app).post(`/api/v1/family/kids/${KID_ID}/analytics-consent`)).send();
    expect(grant.status).toBe(200);
    expect(grant.body.data).toEqual({ kidId: KID_ID, analyticsConsent: true });

    const kids = await as(PARENT_ID)(request(app).get('/api/v1/family/kids'));
    expect(kids.body.data.kids[0].analyticsConsent).toBe(true);
  });

  it('403s a grant for a kid without a verified link to THIS caller', async () => {
    const res = await as(PARENT_ID)(
      request(createApp()).post('/api/v1/family/kids/99999999-9999-4999-8999-999999999999/analytics-consent'),
    ).send();
    expect(res.status).toBe(403);
  });

  it('revoke stops collection immediately but keeps the audit row', async () => {
    const app = createApp();
    await as(PARENT_ID)(request(app).post(`/api/v1/family/kids/${KID_ID}/analytics-consent`)).send();

    const revoke = await as(PARENT_ID)(request(app).delete(`/api/v1/family/kids/${KID_ID}/analytics-consent`));
    expect(revoke.status).toBe(200);
    expect(revoke.body.data.analyticsConsent).toBe(false);

    // Audit row survives with revoked_at set.
    expect(db.analytics_consents).toHaveLength(1);
    expect(db.analytics_consents[0]?.revoked_at).not.toBeNull();

    // And the ingest gate honours it. Assert on the KID's rows specifically:
    // the parent's own consent_grant/consent_revoke events legitimately land
    // in the same table (family conduct), so a blanket length check would
    // conflate "the kid is not tracked" with "nothing happened at all".
    const res = await postEvents(app, KID_ID, [{ event: 'session_start' }]);
    expect(res.body.data.accepted).toBe(0);
    expect(db.learning_events.filter((e) => e.user_id === KID_ID)).toHaveLength(0);
    // The parent's decisions ARE recorded, under the parent's identity.
    expect(db.learning_events.map((e) => e.event)).toEqual(['consent_grant', 'consent_revoke']);
    expect(db.learning_events.every((e) => e.user_id === PARENT_ID && e.role === 'parent')).toBe(true);
  });

  /*
   * The ledger property that makes stored kid data defensible: after
   * grant → revoke → re-grant, BOTH periods remain in the table, so "was
   * consent active on date X?" is answerable for the whole history. An
   * upsert-style implementation collapses this to one rewritten row.
   */
  it('re-granting APPENDS a new row — the revoked period stays on record', async () => {
    const app = createApp();
    await as(PARENT_ID)(request(app).post(`/api/v1/family/kids/${KID_ID}/analytics-consent`)).send();
    await as(PARENT_ID)(request(app).delete(`/api/v1/family/kids/${KID_ID}/analytics-consent`));
    const regrant = await as(PARENT_ID)(request(app).post(`/api/v1/family/kids/${KID_ID}/analytics-consent`)).send();
    expect(regrant.status).toBe(200);

    expect(db.analytics_consents).toHaveLength(2);
    const revoked = db.analytics_consents.filter((r) => r.revoked_at);
    const open = db.analytics_consents.filter((r) => !r.revoked_at);
    expect(revoked).toHaveLength(1);
    expect(open).toHaveLength(1);

    // Collection is live again under the new open row.
    const res = await postEvents(app, KID_ID, [{ event: 'session_start' }]);
    expect(res.body.data.accepted).toBe(1);
  });

  it('granting while already active is idempotent — no duplicate open rows', async () => {
    const app = createApp();
    await as(PARENT_ID)(request(app).post(`/api/v1/family/kids/${KID_ID}/analytics-consent`)).send();
    await as(PARENT_ID)(request(app).post(`/api/v1/family/kids/${KID_ID}/analytics-consent`)).send();
    expect(db.analytics_consents).toHaveLength(1);
  });
});

describe('GET /api/v1/admin/insights/*', () => {
  beforeEach(() => {
    db.user_roles = [...db.user_roles, { user_id: ADULT_ID, role: 'admin' }];
    db.insights_segment_calibration = [
      {
        lesson_id: '44444444-4444-4444-8444-444444444444', lesson_slug: 'saving-1', lesson_title: { 'en-US': 'Saving' },
        segment_id: 'quiz-2', attempts: 40, learners: 10, avg_score: 55.2, avg_attempts_per_learner: 4.0,
        hint_rate: 0.6, first_try_avg_score: 31.0, last_attempt_at: '2026-07-29T00:00:00Z',
      },
    ];
    db.insights_daily_activity = [
      { day: '2026-07-28', role: 'kid', event: 'session_start', route_class: '', device: 'mobile', locale: 'es-MX', events: 12, users: 6, sessions: 6, total_value: null },
    ];
    // The honest distinct-user rollup the console reads for headline counts.
    db.insights_daily_users = [
      { day: '2026-07-28', role: '', users: 6, sessions: 6 },
      { day: '2026-07-28', role: 'kid', users: 6, sessions: 6 },
    ];
    db.insights_family_engagement = [
      { family_id: '55555555-5555-4555-8555-555555555555', family_created_at: '2026-07-01T00:00:00Z', members: 3, tasks_created: 9, tasks_completed: 7, last_task_at: '2026-07-28T00:00:00Z' },
    ];
    db.analytics_consents = [{ kid_user_id: KID_ID, granted_by: PARENT_ID, granted_at: '2026-07-29T00:00:00Z', revoked_at: null }];
  });

  it('calibration returns the view rows for staff', async () => {
    const res = await as(ADULT_ID)(request(createApp()).get('/api/v1/admin/insights/calibration'));
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(1);
    expect(res.body.data.entries[0]).toMatchObject({ segment_id: 'quiz-2', avg_attempts_per_learner: 4.0 });
  });

  it('activity honours the days window param and rejects a bad one', async () => {
    const app = createApp();
    const okRes = await as(ADULT_ID)(request(app).get('/api/v1/admin/insights/activity?days=7'));
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.days).toBe(7);
    const bad = await as(ADULT_ID)(request(app).get('/api/v1/admin/insights/activity?days=0'));
    expect(bad.status).toBe(400);
  });

  it('families bundles engagement + consent coverage', async () => {
    const res = await as(ADULT_ID)(request(createApp()).get('/api/v1/admin/insights/families'));
    expect(res.status).toBe(200);
    expect(res.body.data.families).toHaveLength(1);
    expect(res.body.data.consent).toEqual({ kidsTotal: 1, kidsConsented: 1 });
  });

  it('403s a non-staff caller', async () => {
    const res = await as(PARENT_ID)(request(createApp()).get('/api/v1/admin/insights/calibration'));
    expect(res.status).toBe(403);
  });
});

/*
 * Regressions from the third adversarial review. Each of these passed review
 * as "the code looks right" and was wrong in a way that silently corrupted a
 * number the console presents as fact — which is why they are pinned here.
 */
describe('insights: review regressions', () => {
  beforeEach(() => {
    db.user_roles = [...db.user_roles, { user_id: ADULT_ID, role: 'admin' }];
    db.insights_daily_users = [
      { day: '2026-07-28', role: '', users: 6, sessions: 6 },
      { day: '2026-07-28', role: 'kid', users: 6, sessions: 6 },
    ];
    db.insights_daily_activity = [
      { day: '2026-07-28', role: 'kid', event: 'session_start', route_class: '', device: 'mobile', locale: 'es-MX', events: 12, users: 6, sessions: 6, total_value: null },
    ];
  });

  it('export never emits session_id, and re-keys sessions per file', async () => {
    const app = createApp();
    db.learning_events = [
      { created_at: '2026-07-28T10:00:00Z', role: 'kid', event: 'lesson_start', route_class: 'learn', locale: 'es-MX', device: 'mobile', referrer_class: null, session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ordinal: 1, lesson_id: null, segment_id: null, value: null, user_id: KID_ID, anon_id: null },
      { created_at: '2026-07-28T10:01:00Z', role: 'kid', event: 'segment_view', route_class: 'learn', locale: 'es-MX', device: 'mobile', referrer_class: null, session_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ordinal: 2, lesson_id: null, segment_id: null, value: null, user_id: KID_ID, anon_id: null },
    ];

    const first = await as(ADULT_ID)(request(app).get('/api/v1/admin/insights/export?format=json&days=30'));
    expect(first.status).toBe(200);
    const rows = first.body.data.rows as Record<string, unknown>[];
    expect(rows).toHaveLength(2);

    // The raw identifier is gone, and no field anywhere still carries it.
    expect(JSON.stringify(rows)).not.toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(rows[0]!.session_id).toBeUndefined();

    // Within one file the pseudonym is stable, so sequence analysis works.
    expect(rows[0]!.session_ref).toBe(rows[1]!.session_ref);
    expect(String(rows[0]!.session_ref)).toMatch(/^[0-9a-f]{16}$/);

    // Across files it changes, so two exports cannot be joined on it.
    const second = await as(ADULT_ID)(request(app).get('/api/v1/admin/insights/export?format=json&days=30'));
    expect(second.body.data.rows[0].session_ref).not.toBe(rows[0]!.session_ref);
  });

  it('export declares truncation instead of clipping silently', async () => {
    const app = createApp();
    db.learning_events = Array.from({ length: 5 }, (_, i) => ({
      created_at: `2026-07-28T10:0${i}:00Z`, role: 'parent', event: 'page_view', route_class: 'marketing',
      locale: 'es-MX', device: 'desktop', referrer_class: 'direct',
      session_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ordinal: i, lesson_id: null, segment_id: null,
      value: null, user_id: PARENT_ID, anon_id: null,
    }));

    const clipped = await as(ADULT_ID)(request(app).get('/api/v1/admin/insights/export?format=json&days=30&limit=2'));
    expect(clipped.body.data.rows).toHaveLength(2);
    expect(clipped.body.data.truncated).toBe(true);
    expect(clipped.body.data.nextOffset).toBe(2);
    expect(clipped.headers['x-lf-export-truncated']).toBe('true');

    // The last page reports itself complete — the analyst can stop.
    const last = await as(ADULT_ID)(request(app).get('/api/v1/admin/insights/export?format=json&days=30&limit=2&offset=4'));
    expect(last.body.data.truncated).toBe(false);
    expect(last.headers['x-lf-export-truncated']).toBe('false');
  });

  it('attributes an OAuth signup from the conversion event, not the signup route', async () => {
    const app = createApp();
    const anonId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    db.anon_visitors = [{ anon_id: anonId, utm_campaign: 'spring', converted_user_id: null, converted_at: null }];

    // Exactly what the OAuth landing sends: it never touches /auth/signup.
    const res = await as(ADULT_ID)(request(app).post('/api/v1/events'))
      .send({ events: [{ event: 'signup_complete', routeClass: 'marketing' }], anonId });
    expect(res.status).toBe(202);

    const visitor = db.anon_visitors[0] as Record<string, unknown>;
    expect(visitor.converted_user_id).toBe(ADULT_ID);
    expect(visitor.converted_at).toBeTruthy();
  });

  it('never re-points a visitor that already converted', async () => {
    const app = createApp();
    const anonId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    db.anon_visitors = [{
      anon_id: anonId, utm_campaign: 'spring',
      converted_user_id: PARENT_ID, converted_at: '2026-07-01T00:00:00Z',
    }];

    // A second person logging in on the same family device must not steal the
    // attribution from the signup that actually came from the campaign.
    await as(ADULT_ID)(request(app).post('/api/v1/events'))
      .send({ events: [{ event: 'login_complete', routeClass: 'marketing' }], anonId });

    const visitor = db.anon_visitors[0] as Record<string, unknown>;
    expect(visitor.converted_user_id).toBe(PARENT_ID);
    expect(visitor.converted_at).toBe('2026-07-01T00:00:00Z');
  });

  it('records a consent event only when the state actually changed', async () => {
    const app = createApp();
    const grant = () => as(PARENT_ID)(request(app).post(`/api/v1/family/kids/${KID_ID}/analytics-consent`));

    expect((await grant()).status).toBe(200);
    const afterFirst = db.learning_events.filter((e) => (e as { event: string }).event === 'consent_grant').length;
    expect(afterFirst).toBe(1);

    // Re-tapping an already-on toggle is not a new guardian decision.
    expect((await grant()).status).toBe(200);
    const afterSecond = db.learning_events.filter((e) => (e as { event: string }).event === 'consent_grant').length;
    expect(afterSecond).toBe(1);

    // Revoking twice records exactly one withdrawal.
    await as(PARENT_ID)(request(app).delete(`/api/v1/family/kids/${KID_ID}/analytics-consent`));
    await as(PARENT_ID)(request(app).delete(`/api/v1/family/kids/${KID_ID}/analytics-consent`));
    const revokes = db.learning_events.filter((e) => (e as { event: string }).event === 'consent_revoke').length;
    expect(revokes).toBe(1);
  });

  it('serves distinct users from the dedicated rollup, not a sum of dimensions', async () => {
    const app = createApp();
    const res = await as(ADULT_ID)(request(app).get('/api/v1/admin/insights/activity?days=7'));
    expect(res.status).toBe(200);
    // The all-roles row is present and is the figure the console plots.
    expect(res.body.data.users).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: '', users: 6 })]),
    );
  });
});
