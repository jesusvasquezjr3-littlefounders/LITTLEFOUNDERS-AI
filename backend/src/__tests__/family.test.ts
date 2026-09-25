import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { COURSE_SLUG, LESSON_1_ID, makeDb } from './learnFixtures.js';

/*
 * /api/v1/family — the guardian guard is the whole point: a parent reads a
 * kid's territory ONLY through a VERIFIED guardian_links row, re-checked on
 * every kid-scoped request. Content flows through the parent's own token;
 * only the kid's progress/stats use the service role, post-guard.
 */

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const KID_ID = '22222222-2222-4222-8222-222222222222';
const STRANGER_KID = '99999999-9999-4999-8999-999999999999';

let db: FakeDb;
let token: string;

beforeEach(() => {
  token = mintToken({ sub: PARENT_ID });
  db = makeDb(PARENT_ID);
  db.user_roles = [{ user_id: PARENT_ID, role: 'parent' }];
  db.parent_verifications = [{ user_id: PARENT_ID, status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' }];
  db.guardian_links = [
    { parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' },
    { parent_user_id: PARENT_ID, kid_user_id: STRANGER_KID, verification_status: 'pending' },
  ];
  db.profiles = [{ user_id: KID_ID, display_name: 'Niño Test', username: 'ninotest' }];
  db.learning_stats = [
    { user_id: KID_ID, xp_points: 120, lessons_completed: 3, streak_days: 2, longest_streak: 5, last_active_date: '2026-07-24' },
  ];
  // The KID passed lesson 1 (the parent has no progress of their own here).
  db.lesson_progress = [{ user_id: KID_ID, lesson_id: LESSON_1_ID, best_score: 90, passed: true, attempts: 1, xp_earned: 30 }];
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

describe('current verified-parent boundary', () => {
  it.each(['missing', 'revoked', 'wrong-method', 'minor', 'kid-role'])('blocks family reads and management for %s evidence', async variant => {
    if (variant === 'missing') db.parent_verifications = [];
    if (variant === 'revoked') db.parent_verifications[0]!.status = 'revoked';
    if (variant === 'wrong-method') db.parent_verifications[0]!.method = 'staff-grant';
    if (variant === 'minor') db.parent_verifications[0]!.birth_date = '2016-01-01';
    if (variant === 'kid-role') db.user_roles.push({ user_id: PARENT_ID, role: 'kid' });
    const before = JSON.stringify(db);
    const app = createApp();
    for (const action of [
      request(app).get('/api/v1/family/kids'),
      request(app).patch(`/api/v1/family/kids/${KID_ID}`).send({ displayName: 'Forbidden' }),
      request(app).post(`/api/v1/family/kids/${KID_ID}/passphrase`).send({ passphrase: 'forbidden-passphrase' }),
      request(app).post(`/api/v1/family/kids/${KID_ID}/badge`).send({ type: 'streak' }),
      request(app).post(`/api/v1/family/kids/${KID_ID}/analytics-consent`).send(),
    ]) {
      expect((await auth(action)).status).toBe(403);
    }
    expect(JSON.stringify(db)).toBe(before);
  });
});

describe('GET /api/v1/family/kids', () => {
  it('lists only VERIFIED kids with whitelisted fields', async () => {
    db.user_roles.push({ user_id: KID_ID, role: 'kid' });
    const res = await auth(request(createApp()).get('/api/v1/family/kids'));
    expect(res.status).toBe(200);
    // Deliberately an exact-shape assertion, not a subset match: this test is the
    // PII whitelist for the family payload, so any field that appears here must be
    // added on purpose.
    expect(res.body.data.kids).toEqual([
      {
        userId: KID_ID,
        displayName: 'Niño Test',
        username: 'ninotest',
        analyticsConsent: false,
        pendingApprovalCount: 0,
        walletTotal: 0,
        taskStreakDays: 0,
        // S07.2: a display hint, never an access decision ('teen' = a
        // self-registered teen who linked this parent).
        accountType: 'child',
      },
    ]);
  });

  it('rolls up the Family Hub card facts: tasks awaiting approval, wallet total, chore streak', async () => {
    db.tasks = [
      { id: 'aaaaaaaa-0000-4000-8000-000000000001', assigned_to: KID_ID, assigned_by: PARENT_ID, status: 'done', reward_coins: 5, allocated: false, recurrence: 'once', due_at: null, title: 'Make the bed', created_at: '2026-09-08T00:00:00Z' },
      { id: 'aaaaaaaa-0000-4000-8000-000000000002', assigned_to: KID_ID, assigned_by: PARENT_ID, status: 'done', reward_coins: 5, allocated: false, recurrence: 'once', due_at: null, title: 'Feed the dog', created_at: '2026-09-08T00:00:00Z' },
      { id: 'aaaaaaaa-0000-4000-8000-000000000003', assigned_to: KID_ID, assigned_by: PARENT_ID, status: 'open', reward_coins: 5, allocated: false, recurrence: 'once', due_at: null, title: 'Tidy the desk', created_at: '2026-09-08T00:00:00Z' },
    ];
    db.wallet_ledger = [
      { id: 1, kid_user_id: KID_ID, bucket: 'save', amount: 10, reason: 'task_approved', task_id: null, goal_id: null, redemption_id: null, created_by: PARENT_ID, created_at: '2026-09-01T00:00:00Z' },
      { id: 2, kid_user_id: KID_ID, bucket: 'spend', amount: 3, reason: 'task_approved', task_id: null, goal_id: null, redemption_id: null, created_by: PARENT_ID, created_at: '2026-09-01T00:00:00Z' },
    ];
    // S07.3 (D.2): the card's streak is computed by the lapse-tolerant model
    // from recorded practised days; one missed day (a rest day) keeps it.
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    db.chore_streak_days = [4, 3, 1, 0].map((n) => ({ kid_user_id: KID_ID, local_date: day(n), completions: 1, legacy: false }));
    db.chore_streak_pauses = [];
    db.kid_task_streaks = [{ kid_user_id: KID_ID, current_streak_days: 4, longest_streak_days: 6, last_completed_date: '2026-09-08' }];

    const res = await auth(request(createApp()).get('/api/v1/family/kids'));
    expect(res.status).toBe(200);
    const kid = res.body.data.kids[0];
    // Two `done` tasks await this parent's approval; `open` does not count.
    expect(kid.pendingApprovalCount).toBe(2);
    expect(kid.walletTotal).toBe(13);
    expect(kid.taskStreakDays).toBe(4);
  });

  it('403s for a non-parent role', async () => {
    db.user_roles = [{ user_id: PARENT_ID, role: 'universal' }];
    const res = await auth(request(createApp()).get('/api/v1/family/kids'));
    expect(res.status).toBe(403);
  });

  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/family/kids');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/family/kids/:kidId/courses/:slug/territory', () => {
  it("returns the KID's tree (their progress, not the parent's) plus the stats strip", async () => {
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/${KID_ID}/courses/${COURSE_SLUG}/territory`),
    );
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    // Kid passed lesson 1 of 2 → course progress reflects THE KID.
    expect(res.body.data.tree.course.progress).toEqual({ passed: 1, total: 2, pct: 50 });
    expect(res.body.data.stats).toEqual({
      xpPoints: 120,
      lessonsCompleted: 3,
      streakDays: 2,
      longestStreak: 5,
      lastActiveDate: '2026-07-24',
    });
    // Topic states came along (territory payload shape).
    const topic = res.body.data.tree.adventures[0].sagas[0].topics[0];
    expect(topic.state).toBeDefined();
  });

  it('403s for a kid whose link is NOT verified — pending is not enough', async () => {
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/${STRANGER_KID}/courses/${COURSE_SLUG}/territory`),
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403s for a kid with no link at all', async () => {
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/33333333-3333-4333-8333-333333333399/courses/${COURSE_SLUG}/territory`),
    );
    expect(res.status).toBe(403);
  });

  it('404s on an unknown course', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/family/kids/${KID_ID}/courses/nope/territory`));
    expect(res.status).toBe(404);
  });
});

describe('POST/DELETE /api/v1/family/kids/:kidId/analytics-consent — kidId validation', () => {
  it('400s a non-uuid kidId on grant, without ever reaching the guardian-link lookup', async () => {
    const res = await auth(request(createApp()).post('/api/v1/family/kids/not-a-uuid/analytics-consent'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400s a non-uuid kidId on revoke, without ever reaching the guardian-link lookup', async () => {
    const res = await auth(request(createApp()).delete('/api/v1/family/kids/not-a-uuid/analytics-consent'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('still 403s a well-formed but unlinked kidId (uuid shape alone is not authorization)', async () => {
    const res = await auth(
      request(createApp()).post(`/api/v1/family/kids/${STRANGER_KID}/analytics-consent`),
    );
    expect(res.status).toBe(403);
  });
});


describe('E.2 guardian social graph', () => {
  const endpoint = `/api/v1/family/kids/${KID_ID}/social?direction=followers`;
  beforeEach(() => {
    db.follows = [{ follower_id: PARENT_ID, followed_id: KID_ID }];
    db.profiles.push({ user_id: PARENT_ID, display_name: 'Guardian', username: 'guardian', email: 'private@example.invalid' });
  });
  it('returns whitelisted connected users for the verified guardian', async () => {
    const res = await auth(request(createApp()).get(endpoint));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ users: [{ userId: PARENT_ID, displayName: 'Guardian', username: 'guardian', avatarOptions: {}, isTutor: true }], nextOffset: null });
  });
  it.each(['pending', 'revoked'])('refuses a %s guardian link', async status => {
    db.guardian_links[0]!.verification_status = status;
    const res = await auth(request(createApp()).get(endpoint));
    expect(res.status).toBe(404);
  });
  it('requires a current verified adult and a session', async () => {
    expect((await request(createApp()).get(endpoint)).status).toBe(401);
    db.parent_verifications = [];
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(403);
  });
  it('hides unrelated protected children appearing in legacy edges', async () => {
    db.user_roles.push({ user_id: STRANGER_KID, role: 'kid' });
    db.profiles.push({ user_id: STRANGER_KID, display_name: 'Hidden', username: 'hidden' });
    db.follows = [{ follower_id: STRANGER_KID, followed_id: KID_ID }];
    const res = await auth(request(createApp()).get(endpoint));
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([]);
  });
  it('reports unavailable graph reads instead of an empty successful graph', async () => {
    const fake = createFakeFetch(db);
    vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(input).includes('/rest/v1/follows')) return new Response('{}', { status: 503 });
      return fake(input, init);
    });
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(502);
  });
  it('reads the following direction independently of followers', async () => {
    db.follows = [{ follower_id: KID_ID, followed_id: PARENT_ID }];
    const res = await auth(request(createApp()).get(endpoint.replace('followers', 'following')));
    expect(res.status).toBe(200);
    expect(res.body.data.users.map((user: { userId: string }) => user.userId)).toEqual([PARENT_ID]);
    expect((await auth(request(createApp()).get(endpoint))).body.data.users).toEqual([]);
  });
  it('reports unavailable card hydration instead of dropping every connection', async () => {
    const fake = createFakeFetch(db);
    vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(input).includes('/rest/v1/avatars')) return new Response('{}', { status: 503 });
      return fake(input, init);
    });
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(502);
  });
  it('rechecks a link revoked during graph loading', async () => {
    const fake = createFakeFetch(db);
    vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const response = await fake(input, init);
      if (String(input).includes('/rest/v1/follows')) db.guardian_links[0]!.verification_status = 'revoked';
      return response;
    });
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(404);
  });
  it.each(['direction=blocked', 'direction=followers&offset=-1', 'direction=following&offset=1.5', 'direction=followers&kidId=other'])('rejects invalid query %s', async query => {
    expect((await auth(request(createApp()).get(`/api/v1/family/kids/${KID_ID}/social?${query}`))).status).toBe(400);
  });
  it('pages a graph without silently truncating it at sixty members', async () => {
    db.follows = Array.from({ length: 61 }, (_, index) => {
      const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`;
      db.user_roles.push({ user_id: id, role: 'universal' });
      db.profiles.push({ user_id: id, display_name: `Connection ${index}`, username: `connection${index}` });
      return { follower_id: id, followed_id: KID_ID };
    });
    const first = await auth(request(createApp()).get(endpoint));
    expect(first.body.data.users).toHaveLength(60);
    expect(first.body.data.nextOffset).toBe(60);
    const last = await auth(request(createApp()).get(endpoint + '&offset=60'));
    expect(last.body.data.users).toHaveLength(1);
    expect(last.body.data.nextOffset).toBeNull();
  });
});


describe('E.2 guardian social history', () => {
  const endpoint = `/api/v1/family/kids/${KID_ID}/social/audit`;
  const entry = { id: 1, actor_id: null, action: 'social.follow', detail: { origin: 'database-trigger', follower_id: KID_ID, followed_id: PARENT_ID, privateNote: 'must never escape' }, created_at: '2026-09-21T00:00:00Z' };
  let rows: unknown[];
  let unavailable: boolean;
  let revokeDuringRead: boolean;
  let auditReads: string[];
  beforeEach(() => {
    rows = [entry]; unavailable = false; revokeDuringRead = false; auditReads = [];
    const fake = createFakeFetch(db);
    vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(input).includes('/rest/v1/audit_logs?')) {
        auditReads.push(String(input));
        if (revokeDuringRead) db.guardian_links[0]!.verification_status = 'revoked';
        return new Response(JSON.stringify(rows), { status: unavailable ? 503 : 200 });
      }
      return fake(input, init);
    });
  });
  it('returns only whitelisted social history for this child', async () => {
    rows.push({ ...entry, id: 2, detail: { origin: 'database-trigger', follower_id: STRANGER_KID, followed_id: PARENT_ID } });
    const res = await auth(request(createApp()).get(endpoint));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ entries: [{ id: 1, actorId: null, action: 'social.follow', sourceId: KID_ID, targetId: PARENT_ID, createdAt: entry.created_at, sourceName: null, targetName: null, actorName: null }], nextOffset: null });
    expect(auditReads[0]).toContain(`follower_id.eq.${KID_ID}`);
    expect(auditReads[0]).toContain(`blocked_id.eq.${KID_ID}`);
    expect(auditReads[0]).toContain('action=in.(social.follow,social.unfollow,social.block,social.unblock)');
  });
  it.each(['pending', 'revoked'])('denies a %s guardian without reading logs', async status => {
    db.guardian_links[0]!.verification_status = status;
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(404);
    expect(auditReads).toEqual([]);
  });
  it('resolves currently visible names but hides an unrelated kid participant', async () => {
    db.user_roles.push({ user_id: KID_ID, role: 'kid' }, { user_id: STRANGER_KID, role: 'kid' });
    db.profiles.push({ user_id: STRANGER_KID, display_name: 'Protected name' });
    rows = [{ ...entry, detail: { origin: 'database-trigger', follower_id: KID_ID, followed_id: STRANGER_KID } }];
    const res = await auth(request(createApp()).get(endpoint));
    expect(res.status).toBe(200);
    expect(res.body.data.entries[0].sourceName).toBe('Niño Test');
    expect(res.body.data.entries[0].targetName).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('Protected name');
  });
  it('denies missing adult verification before reading logs', async () => {
    db.parent_verifications = [];
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(403);
    expect(auditReads).toEqual([]);
  });
  it('discards a graph read after link revocation', async () => {
    revokeDuringRead = true;
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(404);
  });
  it('distinguishes empty history from unavailable history', async () => {
    rows = [];
    expect((await auth(request(createApp()).get(endpoint))).body.data.entries).toEqual([]);
    unavailable = true;
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(502);
  });
  it('does not expose arbitrary audit event shapes', async () => {
    rows = [{ ...entry, action: 'private.event' }];
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(502);
  });
  it('refuses client-supplied child/action filters', async () => {
    expect((await auth(request(createApp()).get(endpoint + '?subject=other'))).status).toBe(400);
    expect(auditReads).toEqual([]);
  });
  it('signals another page instead of silently dropping older history', async () => {
    rows = Array.from({ length: 61 }, (_, index) => ({ ...entry, id: index + 1 }));
    const res = await auth(request(createApp()).get(endpoint));
    expect(res.body.data.entries).toHaveLength(60); expect(res.body.data.nextOffset).toBe(60);
  });
});


describe('E.2 pending social queue', () => {
  const endpoint = `/api/v1/family/kids/${KID_ID}/social/requests`;
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  beforeEach(() => {
    db.social_connection_requests = [{ id, requester_id: PARENT_ID, kid_user_id: KID_ID, status: 'pending', requested_at: '2026-09-21T00:00:00Z', private_field: 'must not escape' }];
    db.profiles.push({ user_id: PARENT_ID, display_name: 'Guardian' });
  });
  it('returns pending requests with visible names and no arbitrary fields', async () => {
    const res = await auth(request(createApp()).get(endpoint));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ requests: [{ requestId: id, requesterId: PARENT_ID, requesterName: 'Guardian', requestedAt: '2026-09-21T00:00:00Z', status: 'pending' }], nextOffset: null });
  });
  it.each(['pending', 'revoked'])('requires a verified guardian rather than a %s link', async status => {
    db.guardian_links[0]!.verification_status = status;
    expect((await auth(request(createApp()).get(endpoint))).status).toBe(404);
  });
  it('excludes decided requests and other children', async () => {
    db.social_connection_requests[0]!.status = 'denied';
    db.social_connection_requests.push({ id, requester_id: PARENT_ID, kid_user_id: STRANGER_KID, status: 'pending', requested_at: '2026-09-21T00:00:00Z' });
    expect((await auth(request(createApp()).get(endpoint))).body.data.requests).toEqual([]);
  });
  it('rejects caller-supplied status filters', async () => {
    expect((await auth(request(createApp()).get(endpoint + '?status=approved'))).status).toBe(400);
  });
});


describe('guardian social decisions', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const endpoint = `/api/v1/family/kids/${KID_ID}/social/requests/${id}/decision`;
  let receipt: unknown;
  let rpcStatus: number;
  let writes: unknown[];
  beforeEach(() => {
    receipt = 'approved'; rpcStatus = 200; writes = [];
    db.social_connection_requests = [{ id, requester_id: PARENT_ID, kid_user_id: KID_ID, status: 'pending' }];
    const base = createFakeFetch(db);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/rpc/decide_social_connection')) {
        writes.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify(receipt), { status: rpcStatus, headers: { 'Content-Type': 'application/json' } });
      }
      return base(input, init);
    }));
  });
  it.each(['approve', 'deny'] as const)('confirms %s with session-sourced guardian identity', async decision => {
    receipt = decision === 'approve' ? 'approved' : 'denied';
    const result = await auth(request(createApp()).post(endpoint).send({ decision }));
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ requestId: id, status: receipt });
    expect(writes).toEqual([{ p_request_id: id, p_guardian_id: PARENT_ID, p_approve: decision === 'approve' }]);
  });
  it.each([{}, { decision: true }, { decision: 'approved' }, { decision: 'approve', guardianId: STRANGER_KID }, { decision: 'approve', kidId: STRANGER_KID }])('refuses an invalid or identity-bearing payload: %j', async body => {
    expect((await auth(request(createApp()).post(endpoint).send(body))).status).toBe(400);
    expect(writes).toEqual([]);
  });
  it('refuses malformed request ids and client-supplied query filters', async () => {
    for (const path of [endpoint.replace(id, 'not-a-uuid'), endpoint + '?guardianId=' + PARENT_ID]) {
      expect((await auth(request(createApp()).post(path).send({ decision: 'approve' }))).status).toBe(400);
    }
    expect(writes).toEqual([]);
  });
  it('refuses a missing request without issuing a decision', async () => {
    db.social_connection_requests = [];
    expect((await auth(request(createApp()).post(endpoint).send({ decision: 'approve' }))).status).toBe(404);
    expect(writes).toEqual([]);
  });
  it('refuses anonymous decisions', async () => {
    expect((await request(createApp()).post(endpoint).send({ decision: 'approve' })).status).toBe(401);
    expect(writes).toEqual([]);
  });
  it('refuses an unverified guardian before any decision write', async () => {
    db.parent_verifications = [];
    expect((await auth(request(createApp()).post(endpoint).send({ decision: 'approve' }))).status).toBe(403);
    expect(writes).toEqual([]);
  });
  it('refuses a request belonging to another child even when the path child is linked', async () => {
    db.social_connection_requests[0]!.kid_user_id = STRANGER_KID;
    expect((await auth(request(createApp()).post(endpoint).send({ decision: 'approve' }))).status).toBe(404);
    expect(writes).toEqual([]);
  });
  it('refuses an unlinked path child', async () => {
    db.guardian_links[0]!.verification_status = 'revoked';
    expect((await auth(request(createApp()).post(endpoint).send({ decision: 'approve' }))).status).toBe(404);
    expect(writes).toEqual([]);
  });
  it.each([
    ['GUARDIAN_DECISION_FORBIDDEN', 403], ['SOCIAL_REQUEST_NOT_FOUND', 404],
    ['SOCIAL_DECISION_CONFLICT', 409], ['SOCIAL_CONNECTION_BLOCKED', 409], ['SOCIAL_REQUEST_UNAVAILABLE', 409], ['INJECTED_FAILURE', 502],
  ])('maps transactional refusal %s without success', async (message, status) => {
    rpcStatus = 400; receipt = { code: 'P0001', message };
    const response = await auth(request(createApp()).post(endpoint).send({ decision: 'approve' }));
    expect(response.status).toBe(status); expect(response.body.data).toBeNull();
  });
  it.each([null, true, {}, 'denied'])('does not claim approval from a mismatched receipt: %j', async value => {
    receipt = value;
    expect((await auth(request(createApp()).post(endpoint).send({ decision: 'approve' }))).status).toBe(502);
  });
});
