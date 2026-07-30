import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { COURSE_SLUG, LESSON_1_ID, TOPIC_ID, makeDb } from './learnFixtures.js';

/*
 * /api/v1/family — the GAME half of parent visibility (GAME_ENGINE.md §6-§7).
 *
 * Games are the second category of kid activity, and parent visibility into a
 * kid's activity is a product invariant, not a feature flag (/AGENTS.md §1.9).
 * So this file pins BOTH halves of that invariant:
 *
 *   - a VERIFIED guardian sees their kid's game plays, best scores, pass state
 *     and game XP — a dashboard that showed only lessons would under-report
 *     what the child actually does here;
 *   - everyone else sees nothing, and "everyone else" includes a parent whose
 *     guardian_links row exists but is still PENDING. A uuid is not
 *     authorization; a verified link is.
 *
 * Existing family tests cover the lesson/consent surface; this file is scoped
 * to the game additions so the two suites can move independently.
 */

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const KID_ID = '22222222-2222-4222-8222-222222222222';
/** Linked, but the link is PENDING — not a guardian for access purposes. */
const PENDING_KID_ID = '99999999-9999-4999-8999-999999999999';
/** No link to this parent at all. */
const UNLINKED_KID_ID = '33333333-3333-4333-8333-333333333399';

const GAME_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const GAME_B_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

/** Values that appear ONLY on a kid this caller may not read. If one of these
 *  numbers shows up in a response, something leaked. */
const PENDING_KID_XP = 4242;
const PENDING_KID_PLAYS = 4243;

let db: FakeDb;
let token: string;

function gameRow(id: string, position: number): Record<string, unknown> {
  return {
    id,
    topic_id: TOPIC_ID,
    position,
    slug: `game-${position}`,
    mechanic: 'sorter',
    title: { 'en-US': 'Sort it out' },
    tier: 1,
    xp_max: 10,
    estimated_minutes: 3,
    status: 'published',
  };
}

beforeEach(() => {
  token = mintToken({ sub: PARENT_ID });
  db = makeDb(PARENT_ID);
  db.user_roles = [{ user_id: PARENT_ID, role: 'parent' }];
  db.guardian_links = [
    { parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' },
    { parent_user_id: PARENT_ID, kid_user_id: PENDING_KID_ID, verification_status: 'pending' },
  ];
  db.profiles = [
    { user_id: KID_ID, display_name: 'Niño Test', username: 'ninotest' },
    { user_id: PENDING_KID_ID, display_name: 'Otro Niño', username: 'otronino' },
  ];
  db.learning_stats = [
    { user_id: KID_ID, xp_points: 120, lessons_completed: 3, streak_days: 2, longest_streak: 5, last_active_date: '2026-07-24' },
  ];
  db.lesson_progress = [{ user_id: KID_ID, lesson_id: LESSON_1_ID, best_score: 90, passed: true, attempts: 1, xp_earned: 30 }];
  db.games = [gameRow(GAME_A_ID, 1), gameRow(GAME_B_ID, 2)];
  db.game_progress = [
    {
      user_id: KID_ID,
      game_id: GAME_A_ID,
      best_score: 90,
      plays: 3,
      passed: true,
      xp_earned: 8,
      last_played_at: '2026-07-29T10:00:00.000Z',
    },
    // Unlocked but never played — a real row with zero plays, which the rollup
    // must NOT count as "a game played".
    { user_id: KID_ID, game_id: GAME_B_ID, best_score: 0, plays: 0, passed: false, xp_earned: 0, last_played_at: null },
    // The kid this caller is NOT verified for.
    {
      user_id: PENDING_KID_ID,
      game_id: GAME_A_ID,
      best_score: 100,
      plays: PENDING_KID_PLAYS,
      passed: true,
      xp_earned: PENDING_KID_XP,
      last_played_at: '2026-07-30T10:00:00.000Z',
    },
  ];
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

describe('GET /api/v1/family/kids — the lifetime game rollup', () => {
  it('gives a VERIFIED guardian their kid\'s game activity', async () => {
    const res = await auth(request(createApp()).get('/api/v1/family/kids'));
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.kids).toHaveLength(1);
    expect(res.body.data.kids[0]).toMatchObject({ userId: KID_ID });
    expect(res.body.data.kids[0].games).toEqual({
      // Two progress rows, but only one has plays > 0.
      gamesPlayed: 1,
      gamesPassed: 1,
      totalPlays: 3,
      xpEarned: 8,
      lastPlayedAt: '2026-07-29T10:00:00.000Z',
    });
  });

  it('leaks nothing about a kid whose link is only PENDING', async () => {
    const res = await auth(request(createApp()).get('/api/v1/family/kids'));
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(PENDING_KID_ID);
    expect(body).not.toContain(String(PENDING_KID_XP));
    expect(body).not.toContain(String(PENDING_KID_PLAYS));
  });

  it('403s for a non-parent role — game activity is not a public surface', async () => {
    db.user_roles = [{ user_id: PARENT_ID, role: 'universal' }];
    const res = await auth(request(createApp()).get('/api/v1/family/kids'));
    expect(res.status).toBe(403);
  });

  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/family/kids');
    expect(res.status).toBe(401);
  });

  /*
   * Under-reporting a child's activity is the §1.9-sensitive direction: a
   * parent told "0 games played" cannot tell a failed read from an idle week.
   * The route must fail loudly instead of degrading to zeros.
   */
  it('502s rather than reporting zero games when the progress read fails', async () => {
    const inner = createFakeFetch(db);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/game_progress') && method === 'GET') {
        return new Response('{"message":"down"}', { status: 503 });
      }
      return inner(input, init);
    }));
    const res = await auth(request(createApp()).get('/api/v1/family/kids'));
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});

describe('GET /api/v1/family/kids/:kidId/courses/:slug/territory — course game activity', () => {
  it('gives a VERIFIED guardian the per-game breakdown and the course totals', async () => {
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/${KID_ID}/courses/${COURSE_SLUG}/territory`),
    );
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();

    expect(res.body.data.games.totals).toEqual({
      gamesPlayed: 1,
      gamesPassed: 1,
      totalPlays: 3,
      xpEarned: 8,
      lastPlayedAt: '2026-07-29T10:00:00.000Z',
    });

    const items = res.body.data.games.items;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      gameId: GAME_A_ID,
      topicId: TOPIC_ID,
      mechanic: 'sorter',
      xpMax: 10,
      bestScore: 90,
      passed: true,
      plays: 3,
      xpEarned: 8,
      lastPlayedAt: '2026-07-29T10:00:00.000Z',
    });
    // Never played → zeros that mean ABSENCE, reachable only because the read
    // above succeeded (a failed read 502s).
    expect(items[1]).toMatchObject({ gameId: GAME_B_ID, bestScore: 0, passed: false, plays: 0, xpEarned: 0, lastPlayedAt: null });
  });

  it('hangs every game off the topic it reinforces, so the territory map can place it', async () => {
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/${KID_ID}/courses/${COURSE_SLUG}/territory`),
    );
    const topicIds: string[] = res.body.data.tree.adventures.flatMap(
      (a: { sagas: { topics: { id: string }[] }[] }) => a.sagas.flatMap((s) => s.topics.map((t) => t.id)),
    );
    for (const item of res.body.data.games.items as { topicId: string }[]) {
      expect(topicIds).toContain(item.topicId);
    }
  });

  it('403s a kid whose guardian link is only PENDING — and returns no game data', async () => {
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/${PENDING_KID_ID}/courses/${COURSE_SLUG}/territory`),
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.data).toBeNull();
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(String(PENDING_KID_XP));
    expect(body).not.toContain(String(PENDING_KID_PLAYS));
  });

  it('403s a kid with no guardian link at all', async () => {
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/${UNLINKED_KID_ID}/courses/${COURSE_SLUG}/territory`),
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403s a non-parent caller even for their own id', async () => {
    db.user_roles = [{ user_id: PARENT_ID, role: 'universal' }];
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/${KID_ID}/courses/${COURSE_SLUG}/territory`),
    );
    expect(res.status).toBe(403);
  });

  it('502s rather than showing an empty games section when the kid game read fails', async () => {
    const inner = createFakeFetch(db);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/game_progress') && method === 'GET') {
        return new Response('{"message":"down"}', { status: 503 });
      }
      return inner(input, init);
    }));
    const res = await auth(
      request(createApp()).get(`/api/v1/family/kids/${KID_ID}/courses/${COURSE_SLUG}/territory`),
    );
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});
