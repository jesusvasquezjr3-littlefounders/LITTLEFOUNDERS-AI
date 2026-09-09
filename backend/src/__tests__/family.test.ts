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

describe('GET /api/v1/family/kids', () => {
  it('lists only VERIFIED kids with whitelisted fields', async () => {
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
