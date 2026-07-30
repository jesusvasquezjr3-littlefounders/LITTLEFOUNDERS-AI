import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb, type FakeRow } from './fakePostgrest.js';
import { LESSON_1_ID, SAGA_ID, TOPIC_ID, makeDb } from './learnFixtures.js';
import { runBot } from '../game-contract/core/replay.js';
import { seedFromString } from '../game-contract/core/rng.js';
import { getMechanic } from '../game-contract/registry.js';
import { sorterSimulator } from '../game-contract/mechanics/sorter/simulate.js';
import { sorterBots } from '../game-contract/mechanics/sorter/bots.js';
import { explorerBots } from '../game-contract/mechanics/explorer/bots.js';
import type { GameDocument, GameInputEvent } from '../game-contract/core/types.js';
import { maxTicksFor } from '../services/gameDocument.js';
import { EXPLORER_DOCUMENT } from './gameContractFixtures.js';

/*
 * /api/v1/games — the HTTP surface of the Game Engine (GAME_ENGINE.md §6-§8).
 *
 * The three properties this file exists to pin, none of which a green
 * type-check would catch:
 *
 *  1. THE SIDECAR NEVER LEAVES CORE. `game_documents.validation` carries the
 *     reward ceiling and the anti-cheat envelope — exactly what forging a
 *     maximal run needs. The fake PostgREST below deliberately IGNORES the
 *     `select=` list and hands every column back, so these tests fail the
 *     moment the route serializes the row instead of the whitelisted fields.
 *  2. THE REWARD IS REPLAYED, NOT REPORTED. The completion body carries no
 *     score at all; a forged, over-cap or out-of-order log must earn NOTHING
 *     and must write NOTHING.
 *  3. A GAME IS NOT A LESSON. `lessons_completed` is never touched, and a
 *     learning_stats read that FAILED must never be mistaken for zeros.
 *  4. THE REWARD IS EARNED. XP requires PASSING, passing requires actually
 *     playing (§5b), the grading seed is the SERVER's (derived from the run id,
 *     never the client's choice), and one run is paid exactly once even when two
 *     completions race past the attempt pre-check.
 *
 * The sorter manifest is transcribed inline (identical to the one in
 * game-contract.test.ts): frontend/ is not a dependency of backend/, and a
 * fixture never gets a relaxed schema (§1.14). Curriculum content only — no
 * child, no PII (§1.9).
 */

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TOPIC_2_ID = '66666666-6666-4666-8666-666666666667';
const LESSON_3_ID = '77777777-7777-4777-8777-777777777779';
/** Bound to the topic the fixture user has PASSED a lesson in → unlocked. */
const GAME_READY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
/** Bound to a topic with no passed lesson → locked. */
const GAME_LOCKED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
/** Published-chain gate: a draft row must be indistinguishable from absent. */
const GAME_DRAFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
/** A published game naming a mechanic this release cannot replay. */
const GAME_UNSUPPORTED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
/** Planted per-test (§5b): a manifest whose DO-NOTHING score clears its own bar. */
const GAME_IDLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
const UNKNOWN_GAME_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
/**
 * NOT a free-standing number: the seed is a pure function of the run id, derived
 * with the same `seedFromString` the browser uses, and the server refuses any
 * other. A test that hard-coded a seed would be testing a contract no honest
 * client can satisfy.
 */
const SEED = seedFromString(RUN_ID);
const LOCAL_DATE = '2026-07-30';

/**
 * The string planted in the SERVER-ONLY sidecar. No client response may contain
 * it — anywhere, at any nesting depth.
 */
const SIDECAR_MARKER = 'sidecar-marker-must-never-reach-a-browser';

// ---- The manifest (transcribed; passes the production schemas unmodified) ------

const SORTER_DOCUMENT: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'necesito-o-quiero',
    title: 'Necesito o quiero',
    locale: 'es-MX',
    mechanic: 'sorter',
    concept: {
      topic_path: 'mi-primer-dinero/decidir-con-calma/necesidades-y-deseos',
      recap_md:
        'Una **necesidad** es algo sin lo que no puedes estar bien; un **deseo** te gusta pero puede esperar.',
    },
    tier: 1,
    estimated_minutes: 3,
    cast: ['dina'],
  },
  skin: { palette: 'forest-pear', sprites: {}, sfx: { correct: 'correct', place: 'drop' } },
  config: {
    mode: 'static',
    category_count: 2,
    field: { width: 900, height: 540, lanes: 3, item_size: 132 },
    ladder: [
      { spawn_interval_ticks: 2, fall_speed: 0, speed_variance: 0, max_active: 6, item_tiers: [1], points_per_correct: 5 },
      { spawn_interval_ticks: 2, fall_speed: 0, speed_variance: 0, max_active: 6, item_tiers: [1, 2], points_per_correct: 7 },
    ],
    level_up: { correct_per_level: 6 },
    combo: { step: 3, max: 3 },
    penalty: {
      wrong_drop: { score_pct: 4, lives: 0, combo_reset: true, return_item: true },
      miss: { score_pct: 0, lives: 0, combo_reset: false },
    },
    trash_zone: true,
    repeat_items: false,
    initial_fill: 6,
    round: { target_correct: 10, target_points: 90, tick_budget: 2400 },
    score_weights: { accuracy: 0.5, progress: 0.3, points: 0.2 },
  },
  content: {
    categories: [
      { id: 'necesito', label_md: 'Necesito', description_md: 'Cosas sin las que no estoy bien.' },
      { id: 'quiero', label_md: 'Quiero', description_md: 'Cosas que me gustan y pueden esperar.' },
    ],
    items: [
      { id: 'agua', label_md: 'Agua para tomar', category: 'necesito', icon: 'water_drop', tier: 1 },
      { id: 'lonche', label_md: 'El lonche de la escuela', category: 'necesito', icon: 'restaurant', tier: 1 },
      { id: 'medicina', label_md: 'La medicina del doctor', category: 'necesito', icon: 'medical_services', tier: 1 },
      { id: 'cuaderno', label_md: 'Un cuaderno para la tarea', category: 'necesito', icon: 'menu_book', tier: 1 },
      { id: 'videojuego', label_md: 'Un videojuego nuevo', category: 'quiero', icon: 'videogame_asset', tier: 1 },
      { id: 'dulces', label_md: 'Dulces de la tiendita', category: 'quiero', icon: 'cake', tier: 1 },
      { id: 'juguete', label_md: 'Otro juguete igual al que tengo', category: 'quiero', icon: 'toys', tier: 1 },
      { id: 'cine', label_md: 'Un boleto para el cine', category: 'quiero', icon: 'movie', tier: 1 },
      {
        id: 'dia-soleado',
        label_md: 'Un dia soleado',
        icon: 'sunny',
        tier: 1,
        misconception_md: 'No se compra ni se paga, asi que no cabe en ninguna de las dos cajas.',
      },
      {
        id: 'abrazo',
        label_md: 'Un abrazo de tu familia',
        icon: 'volunteer_activism',
        tier: 1,
        misconception_md: 'Es gratis y no se vende: no es un gasto, es algo que ya tienes.',
      },
    ],
    feedback: {
      correct_md: ['Esa va justo ahi.', 'Lo pensaste bien.'],
      incorrect_md: ['Casi. Piensa que pasa si no lo tienes.'],
      results_md: 'Separar lo que necesito de lo que quiero es el primer paso para decidir mi dinero.',
    },
  },
  scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null, target: 10 },
};

/** The server's own tick ceiling for this document — the bot plays under it. */
const MAX_TICKS = maxTicksFor(SORTER_DOCUMENT);

/**
 * A GENUINE run: the perfect bot's log, produced by the same simulator Core
 * replays. Nothing about it is hand-written, so a test that passes here is a
 * test an honest player passes.
 */
function perfectLog(): GameInputEvent[] {
  return runBot({
    simulator: sorterSimulator,
    document: SORTER_DOCUMENT,
    seed: SEED,
    bot: sorterBots.perfect,
    maxTicks: MAX_TICKS,
  }).inputLog;
}

/**
 * A stored `document` jsonb that ALSO carries a sidecar inside itself — the
 * shape `stripValidation()` exists for. The row's own `validation` column is
 * planted separately.
 */
function documentWithInlineSidecar(): Record<string, unknown> {
  return {
    ...SORTER_DOCUMENT,
    validation: { max_score: 100, min_duration_seconds: 0, max_events: 200, notes: SIDECAR_MARKER },
  };
}

function gameRow(id: string, topicId: string, position: number, overrides: FakeRow = {}): FakeRow {
  return {
    id,
    topic_id: topicId,
    position,
    slug: `game-${position}`,
    mechanic: 'sorter',
    title: { 'en-US': 'Sort it out' },
    tier: 1,
    xp_max: 10,
    estimated_minutes: 3,
    status: 'published',
    ...overrides,
  };
}

function documentRows(gameId: string): FakeRow[] {
  return ['en-US', 'es-MX'].map((locale) => ({
    game_id: gameId,
    locale,
    schema_version: 1,
    document: documentWithInlineSidecar(),
    // SERVER-ONLY (0027). min_duration_seconds is 1 so a zero-second submission
    // is refusable; max_events is generous so only the deliberate over-cap test trips it.
    validation: { max_score: 100, min_duration_seconds: 1, max_events: 200, notes: SIDECAR_MARKER },
  }));
}

function makeGamesDb(userId: string): FakeDb {
  const db = makeDb(userId);
  db.topics = [
    ...db.topics,
    { id: TOPIC_2_ID, saga_id: SAGA_ID, position: 2, slug: 'topic-2', title: {}, status: 'published' },
  ];
  db.lessons = [
    ...db.lessons,
    {
      id: LESSON_3_ID,
      topic_id: TOPIC_2_ID,
      position: 3,
      slug: 'lesson-3',
      title: { 'en-US': 'Lesson Three' },
      difficulty: 1,
      xp_total: 10,
      estimated_minutes: 5,
      status: 'published',
    },
  ];
  // The concept gate: this learner PASSED a lesson in topic-1 and nothing in topic-2.
  db.lesson_progress = [{ user_id: userId, lesson_id: LESSON_1_ID, best_score: 100, passed: true, attempts: 1, xp_earned: 20 }];
  // Real accumulated history — the numbers a broken read-modify-write would erase.
  db.learning_stats = [
    {
      user_id: userId,
      xp_points: 40,
      minutes_learned: 12,
      lessons_completed: 7,
      streak_days: 0,
      longest_streak: 3,
      last_active_date: null,
      updated_at: '2020-01-01T00:00:00.000Z',
    },
  ];
  db.games = [
    gameRow(GAME_READY_ID, TOPIC_ID, 1),
    gameRow(GAME_LOCKED_ID, TOPIC_2_ID, 1),
    gameRow(GAME_DRAFT_ID, TOPIC_ID, 2, { status: 'draft', slug: 'game-draft' }),
    gameRow(GAME_UNSUPPORTED_ID, TOPIC_ID, 3, { mechanic: 'launcher', slug: 'game-launcher' }),
  ];
  db.game_documents = [
    ...documentRows(GAME_READY_ID),
    ...documentRows(GAME_LOCKED_ID),
    ...documentRows(GAME_UNSUPPORTED_ID),
  ];
  db.game_progress = [];
  db.game_attempts = [];
  return db;
}

// ---- Write recorder --------------------------------------------------------------

interface WriteCall {
  table: string;
  method: string;
  body: unknown;
}

let db: FakeDb;
let token: string;
let writes: WriteCall[];

/** Every non-read PostgREST call, so "no reward was written" is an assertion about
 *  calls made — not merely about the final state of a table. */
function recordingFetch(database: FakeDb): typeof fetch {
  const inner = createFakeFetch(database);
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      const url = String(input);
      const table = url.slice(url.indexOf('/rest/v1/') + '/rest/v1/'.length).split('?')[0] ?? '';
      let body: unknown = null;
      if (init?.body) {
        try {
          body = JSON.parse(String(init.body));
        } catch {
          body = null;
        }
      }
      writes.push({ table, method, body });
    }
    return inner(input, init);
  }) as unknown as typeof fetch;
}

const writesTo = (table: string): WriteCall[] => writes.filter((w) => w.table === table);

function patchBodyFor(table: string): Record<string, unknown> {
  const call = writes.find((w) => w.table === table && w.method === 'PATCH');
  return (call?.body ?? {}) as Record<string, unknown>;
}

function statsRow(): FakeRow {
  return db.learning_stats.find((r) => r.user_id === USER_ID) ?? {};
}

beforeEach(() => {
  token = mintToken({ sub: USER_ID });
  db = makeGamesDb(USER_ID);
  writes = [];
  vi.stubGlobal('fetch', recordingFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

function completeBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    run_id: RUN_ID,
    seed: SEED,
    input_log: perfectLog(),
    duration_seconds: 120,
    local_date: LOCAL_DATE,
    ...overrides,
  };
}

// ---- 1. GET /api/v1/games ---------------------------------------------------------

describe('GET /api/v1/games', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/games');
    expect(res.status).toBe(401);
  });

  it('returns the envelope with per-game state, and locks a game whose topic has no passed lesson', async () => {
    const res = await auth(request(createApp()).get('/api/v1/games'));
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();

    const topics = res.body.data.courses[0].adventures[0].topics;
    const byTopic = new Map<string, { unlocked: boolean; games: { id: string; state: string }[] }>(
      topics.map((t: { id: string; unlocked: boolean; games: { id: string; state: string }[] }) => [t.id, t]),
    );

    // topic-1: a lesson was passed → the concept gate is open.
    expect(byTopic.get(TOPIC_ID)?.unlocked).toBe(true);
    expect(byTopic.get(TOPIC_ID)?.games.map((g) => [g.id, g.state])).toEqual([
      [GAME_READY_ID, 'ready'],
      [GAME_UNSUPPORTED_ID, 'ready'],
    ]);

    // topic-2: nothing passed → LOCKED, even though the game row is published.
    expect(byTopic.get(TOPIC_2_ID)?.unlocked).toBe(false);
    expect(byTopic.get(TOPIC_2_ID)?.games.map((g) => [g.id, g.state])).toEqual([[GAME_LOCKED_ID, 'locked']]);
  });

  it('never lists a draft game', async () => {
    const res = await auth(request(createApp()).get('/api/v1/games'));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(GAME_DRAFT_ID);
  });

  it('reports `played` once a run has been recorded, rather than inventing progress', async () => {
    db.game_progress = [
      { user_id: USER_ID, game_id: GAME_READY_ID, best_score: 80, plays: 2, passed: true, xp_earned: 8, last_played_at: '2026-07-29T10:00:00.000Z' },
    ];
    const res = await auth(request(createApp()).get('/api/v1/games'));
    const topic = res.body.data.courses[0].adventures[0].topics.find((t: { id: string }) => t.id === TOPIC_ID);
    const game = topic.games.find((g: { id: string }) => g.id === GAME_READY_ID);
    expect(game).toMatchObject({ state: 'played', best_score: 80, plays: 2, passed: true, xp_earned: 8 });
  });

  it('502s rather than reporting an empty catalog when Vault is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    const res = await auth(request(createApp()).get('/api/v1/games'));
    expect(res.status).toBe(502);
  });
});

// ---- 2 & 3. GET /api/v1/games/:gameId ---------------------------------------------

describe('GET /api/v1/games/:gameId', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).get(`/api/v1/games/${GAME_READY_ID}`);
    expect(res.status).toBe(401);
  });

  it('serves the game meta plus the locale-resolved document', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/games/${GAME_READY_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.game).toMatchObject({
      id: GAME_READY_ID,
      mechanic: 'sorter',
      xp_max: 10,
      best_score: 0,
      plays: 0,
      passed: false,
    });
    expect(res.body.data.locale).toBe('en-US'); // the fixture profile's locale
    expect(res.body.data.document.meta.mechanic).toBe('sorter');
  });

  it('403s GAME_LOCKED for a game whose topic has no passed lesson', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/games/${GAME_LOCKED_ID}`));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GAME_LOCKED');
    expect(res.body.data).toBeNull();
  });

  it('never serves the document of a locked game — the manifest itself is gated', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/games/${GAME_LOCKED_ID}`));
    expect(res.body.data).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('necesito-o-quiero');
  });

  it('404s NOT_FOUND for an unknown game id', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/games/${UNKNOWN_GAME_ID}`));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404s NOT_FOUND for a DRAFT game — unpublished is indistinguishable from absent', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/games/${GAME_DRAFT_ID}`));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404s NOT_FOUND for a malformed game id, without a stack trace or a 500', async () => {
    const res = await auth(request(createApp()).get('/api/v1/games/not-a-uuid'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  /*
   * THE SIDECAR TEST. `game_documents.validation` holds `max_score`, the event
   * cap and the minimum duration — the exact numbers needed to forge a maximal
   * run that survives the replay's bounds checks.
   *
   * Note the fake PostgREST IGNORES `select=` and returns every column, so this
   * suite cannot be satisfied by the column list alone: the assertions below
   * fail for a route that spreads the row (`{ ...picked }`), that selects `*`,
   * or that hands back `picked.document` without stripping an inlined sidecar.
   */
  it('NEVER includes the validation sidecar in the response body', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/games/${GAME_READY_ID}`));
    expect(res.status).toBe(200);
    // The absence of the KEY — a future refactor that re-adds it fails here.
    expect(res.body.data).not.toHaveProperty('validation');
    expect(res.body.data.document).not.toHaveProperty('validation');
    // And the absence of the VALUE, at any nesting depth.
    expect(JSON.stringify(res.body)).not.toContain(SIDECAR_MARKER);
  });

  it('502s rather than serving a partial payload when the document read fails', async () => {
    const inner = recordingFetch(db);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/game_documents')) return new Response('{"message":"down"}', { status: 503 });
      return inner(input, init);
    }));
    const res = await auth(request(createApp()).get(`/api/v1/games/${GAME_READY_ID}`));
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('INTERNAL');
  });
});

// ---- 4. POST /:gameId/complete — the happy path -----------------------------------

describe('POST /api/v1/games/:gameId/complete — the reward is replayed, not reported', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`).send(completeBody());
    expect(res.status).toBe(401);
  });

  it('derives the score and the XP from the REPLAY, ignoring anything the client claims', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send({
      ...completeBody(),
      // A client trying to grade itself. The body schema has no score field at
      // all, so these are stripped before the route ever sees them.
      score: 100,
      xp_earned: 999,
      passed: true,
      stats: { correct: 9999 },
    });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    // The perfect bot's run: score 100 at this seed (pinned in game-contract.test.ts).
    expect(res.body.data).toMatchObject({
      score: 100,
      passed: true,
      xp_earned: 10, // min(games.xp_max, document.scoring.xp_max)
      xp_delta: 10,
      best_score: 100,
      plays: 1,
      minutes_delta: 2, // 120s credited
      streak_days: 1,
      streak_extended: true,
      first_today: true,
    });
    // Derived aggregates, from the simulator — not from the body above.
    expect(res.body.data.stats).toMatchObject({ correct: 10, wrong: 0, accuracy: 100 });
    expect(res.body.data.stats.correct).not.toBe(9999);

    // Persisted: one attempt, one progress row, the stats delta.
    const attempt = db.game_attempts[0];
    expect(attempt).toMatchObject({ user_id: USER_ID, game_id: GAME_READY_ID, run_id: RUN_ID, score: 100 });
    expect(db.game_progress[0]).toMatchObject({ best_score: 100, plays: 1, passed: true, xp_earned: 10 });
    expect(statsRow()).toMatchObject({ xp_points: 50, minutes_learned: 14, streak_days: 1, longest_streak: 3 });
  });

  it('never persists the raw input log — only derived aggregates (§1.9)', async () => {
    await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody());
    const attempt = db.game_attempts[0] ?? {};
    expect(attempt).not.toHaveProperty('input_log');
    expect(JSON.stringify(attempt)).not.toContain('"tick"');
  });

  it('refuses to credit the same run twice — plays and minutes cannot be farmed by re-POSTing', async () => {
    const app = createApp();
    const first = await auth(request(app).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody());
    expect(first.status).toBe(200);

    const replayed = await auth(request(app).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody());
    expect(replayed.status).toBe(422);
    expect(replayed.body.error.code).toBe('RESULT_REJECTED');
    expect(db.game_attempts).toHaveLength(1);
    expect(statsRow().minutes_learned).toBe(14);
  });

  /*
   * THE RACE the pre-check above cannot win. `countAttemptsForRun` and the attempt
   * INSERT are separated by the document read and the replay, so two concurrent
   * POSTs carrying ONE run id both read zero attempts and both used to be
   * credited. The fix is the database's: migration 0029's UNIQUE
   * (user_id, game_id, run_id), which Core writes against with `ON CONFLICT DO
   * NOTHING` and reads the verdict of.
   *
   * The stub below is that database. It has to be, twice over: the fake PostgREST
   * enforces no constraints at all, and it answers an ignored duplicate with the
   * row that was SUBMITTED rather than with the empty representation real
   * PostgREST returns for `ON CONFLICT DO NOTHING`. Both halves are modelled here
   * — the pre-check reading zero (the race window) and the DB refusing the second
   * row — so what is asserted is exactly what production does.
   */
  it('credits a run exactly ONCE when two completions race past the attempt pre-check', async () => {
    const app = createApp();
    const inner = recordingFetch(db);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

      // The race window: neither request can see the other's attempt yet.
      if (url.includes('/game_attempts') && method === 'GET') return json([], 200);

      if (url.includes('/game_attempts') && method === 'POST') {
        const row = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const clash = db.game_attempts.some(
          (r) => r.user_id === row.user_id && r.game_id === row.game_id && r.run_id === row.run_id,
        );
        // ON CONFLICT DO NOTHING ... RETURNING id → no row for the loser.
        if (clash) return json([], 201);
      }
      return inner(input, init);
    }));

    const first = await auth(request(app).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody());
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ xp_delta: 10, plays: 1 });

    const second = await auth(request(app).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody());
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe('RESULT_REJECTED');
    expect(second.body.error.message).toBe('run_already_recorded');

    // Paid once: one attempt row, one progress upsert, one stats PATCH across BOTH
    // requests — and the ledger reads as a single 120-second play.
    expect(db.game_attempts).toHaveLength(1);
    expect(writesTo('game_progress')).toHaveLength(1);
    expect(writesTo('learning_stats')).toHaveLength(1);
    expect(db.game_progress[0]).toMatchObject({ plays: 1, xp_earned: 10 });
    expect(statsRow()).toMatchObject({ xp_points: 50, minutes_learned: 14 });
  });

  it('403s GAME_LOCKED on a locked game and writes nothing', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_LOCKED_ID}/complete`)).send(completeBody());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GAME_LOCKED');
    expect(writesTo('game_attempts')).toHaveLength(0);
  });

  it('404s for an unknown game', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${UNKNOWN_GAME_ID}/complete`)).send(completeBody());
    expect(res.status).toBe(404);
  });

  it('422s RESULT_REJECTED for a mechanic this release cannot replay, rather than trusting a score it cannot derive', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_UNSUPPORTED_ID}/complete`)).send(completeBody());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RESULT_REJECTED');
    expect(writesTo('game_attempts')).toHaveLength(0);
  });
});

// ---- 5. The anti-cheat guarantee ---------------------------------------------------

describe('POST /:gameId/complete — a forged log earns nothing and writes nothing', () => {
  /** Every write path the reward touches. None may be called for a refused run. */
  function expectNoRewardWritten(): void {
    expect(writesTo('game_attempts')).toHaveLength(0);
    expect(writesTo('game_progress')).toHaveLength(0);
    expect(writesTo('learning_stats')).toHaveLength(0);
    expect(db.game_attempts).toHaveLength(0);
    expect(db.game_progress).toHaveLength(0);
    expect(statsRow()).toMatchObject({ xp_points: 40, minutes_learned: 12, lessons_completed: 7, streak_days: 0 });
  }

  it('422s a FABRICATED log naming an action the mechanic does not declare', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      completeBody({ input_log: [{ tick: 0, action: 'teleport', n: 1 }] }),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RESULT_REJECTED');
    expect(res.body.error.message).toBe('unknown_action');
    expectNoRewardWritten();
  });

  it('422s an OUT-OF-ORDER log', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      completeBody({
        input_log: [
          { tick: 5, action: 'place', slot: 'necesito', n: 1 },
          { tick: 2, action: 'place', slot: 'necesito', n: 2 },
        ],
      }),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RESULT_REJECTED');
    expect(res.body.error.message).toBe('tick_out_of_order');
    expectNoRewardWritten();
  });

  it('422s an OVER-CAP log — the sidecar tightens the ceiling the client can see', async () => {
    // The client cannot know this number; it is server-only by construction.
    for (const row of db.game_documents) {
      if (row.game_id === GAME_READY_ID) row.validation = { max_score: 100, min_duration_seconds: 1, max_events: 3 };
    }
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RESULT_REJECTED');
    expect(res.body.error.message).toBe('log_too_long');
    expectNoRewardWritten();
  });

  it('422s a log stamped past the tick ceiling', async () => {
    // One tick past the server's own budget, with a duration long enough that the
    // wall-clock check passes — so this isolates `tick_after_max`.
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      completeBody({
        input_log: [{ tick: MAX_TICKS + 1, action: 'place', slot: 'necesito', n: 1 }],
        duration_seconds: 600,
      }),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RESULT_REJECTED');
    expect(res.body.error.message).toBe('tick_after_max');
    expectNoRewardWritten();
  });

  it('422s a duration shorter than the sidecar minimum', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      completeBody({ duration_seconds: 0 }),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('duration_below_minimum');
    expectNoRewardWritten();
  });

  it('scores an EMPTY log at zero rather than refusing it — a quit is not a cheat', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      completeBody({ input_log: [] }),
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ score: 0, passed: false, xp_earned: 0, xp_delta: 0 });
    // No XP, no streak — but the play IS recorded.
    expect(statsRow()).toMatchObject({ xp_points: 40, streak_days: 0 });
    expect(db.game_progress[0]).toMatchObject({ plays: 1, passed: false, xp_earned: 0 });
  });

  it('422s a seed the run id does not derive — a player cannot shop for a layout', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      // One away from the derived seed: enough to be a DIFFERENT shuffle of the
      // same content, which is the whole point of picking your own number.
      completeBody({ seed: SEED + 1 }),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RESULT_REJECTED');
    expect(res.body.error.message).toBe('seed_mismatch');
    expectNoRewardWritten();
  });

  it('422s a seed that is plausible but simply not this run id\'s', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      // The seed of a DIFFERENT run: a valid uint32, and one a seed-shopper would
      // have found by re-rolling run ids locally until a layout looked easy.
      completeBody({ seed: seedFromString('dddddddd-dddd-4ddd-8ddd-dddddddddddd') }),
    );
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('seed_mismatch');
    expectNoRewardWritten();
  });
});

// ---- 5b. XP is EARNED: the pass gate and the engagement floor ----------------------

/*
 * The audit's measurement: an EMPTY input log scores 45, 44, 41, 40, 28 and 23 on
 * the explorer, runner, flyer, autobattler and launcher manifests — several
 * mechanics award partial credit for state the simulation reaches on its own. XP
 * was `round(score / 100 * xp_max)` with no pass gate, so opening a game and
 * submitting nothing paid real XP into a child's learning_stats.
 *
 * Two properties close it, and both are asserted here:
 *   1. XP requires PASSING — a failed run pays nothing, however close it came.
 *   2. PASSING requires PLAYING — a run that does not beat what doing nothing
 *      scores under the same seed cannot pass, whatever bar the manifest sets.
 */
describe('POST /:gameId/complete — XP is earned, not accrued', () => {
  it('pays NO XP for an honest run that missed the bar', async () => {
    // Two of the perfect bot's ten placements: a real partial run, scoring 58
    // against this manifest's pass_score of 60.
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      completeBody({ input_log: perfectLog().slice(0, 2) }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ score: 58, passed: false, xp_earned: 0, xp_delta: 0 });
    // Not 6 XP (58% of xp_max) for a run the game itself calls a loss.
    expect(statsRow()).toMatchObject({ xp_points: 40, streak_days: 0 });
    expect(db.game_progress[0]).toMatchObject({ plays: 1, passed: false, xp_earned: 0 });
  });

  /**
   * A published explorer manifest whose bar sits BELOW its own idle score: doing
   * nothing scores 44 at this run's seed, and `pass_score` is 40. `pass_score`'s
   * schema floor is 0, so this is a manifest the pipeline can emit — and the §9
   * winnability gate bounds `pass_score` against the random bot, never against
   * doing nothing at all.
   */
  function plantIdleGame(): void {
    const document = { ...EXPLORER_DOCUMENT, scoring: { ...EXPLORER_DOCUMENT.scoring, pass_score: 40 } };
    db.games = [...db.games, gameRow(GAME_IDLE_ID, TOPIC_ID, 4, { mechanic: 'explorer', slug: 'game-idle' })];
    db.game_documents = [
      ...db.game_documents,
      ...['en-US', 'es-MX'].map((locale) => ({
        game_id: GAME_IDLE_ID,
        locale,
        schema_version: 1,
        document,
        validation: { max_score: 100, min_duration_seconds: 1, max_events: 200 },
      })),
    ];
  }

  it('refuses to PASS an empty log even when idling outscores the manifest bar', async () => {
    plantIdleGame();
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_IDLE_ID}/complete`)).send(
      completeBody({ input_log: [] }),
    );

    expect(res.status).toBe(200);
    // The score is reported honestly — it is what the simulation reached — but it
    // was not EARNED, so it is not a pass and it buys nothing.
    expect(res.body.data).toMatchObject({ score: 44, passed: false, xp_earned: 0, xp_delta: 0 });
    expect(statsRow()).toMatchObject({ xp_points: 40, streak_days: 0, last_active_date: null });
    expect(db.game_progress[0]).toMatchObject({ plays: 1, passed: false, xp_earned: 0 });
  });

  it('still pays a genuinely played run on that same manifest — the floor is engagement, not difficulty', async () => {
    plantIdleGame();
    const document = { ...EXPLORER_DOCUMENT, scoring: { ...EXPLORER_DOCUMENT.scoring, pass_score: 40 } };
    const slice = getMechanic('explorer');
    if (slice === null) throw new Error('the explorer slice must be registered for this test to mean anything');
    const inputLog = runBot({
      simulator: slice.simulator,
      document,
      seed: SEED,
      bot: explorerBots.perfect,
      maxTicks: maxTicksFor(document),
    }).inputLog;

    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_IDLE_ID}/complete`)).send(
      // Long enough that the wall-clock plausibility check is not what is being
      // tested here: the explorer's honest run spans more ticks than the sorter's.
      completeBody({ input_log: inputLog, duration_seconds: 900 }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ score: 100, passed: true });
    expect(res.body.data.xp_earned).toBeGreaterThan(0);
    expect(statsRow().xp_points).toBeGreaterThan(40);
  });
});

// ---- 6. lessons_completed is never touched ----------------------------------------

describe('POST /:gameId/complete — a game is not a lesson', () => {
  it('NEVER increments lessons_completed, and never writes the column back at all', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody());
    expect(res.status).toBe(200);

    // The stored value is untouched...
    expect(statsRow().lessons_completed).toBe(7);
    // ...and the column is ABSENT from the PATCH body, not merely echoed back at
    // its read value: echoing it would clobber a lesson finished concurrently.
    const patch = patchBodyFor('learning_stats');
    expect(Object.keys(patch)).not.toContain('lessons_completed');
    expect(Object.keys(patch).sort()).toEqual(['last_active_date', 'longest_streak', 'minutes_learned', 'streak_days', 'xp_points']);
  });

  it('does not touch lessons_completed on a failed run either', async () => {
    await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody({ input_log: [] }));
    expect(statsRow().lessons_completed).toBe(7);
    expect(Object.keys(patchBodyFor('learning_stats'))).not.toContain('lessons_completed');
  });
});

// ---- 7. The read-modify-write regression -------------------------------------------

/*
 * The documented §1.14 incident, in its game-shaped form: `learning_stats` is
 * READ, modified and WRITTEN BACK. When the READ collapses a transient failure
 * into zeros, the following PATCH is a blind overwrite that erases XP, minutes
 * and BOTH streak columns behind a 200 — permanently, because those numbers
 * exist nowhere else. The read must refuse instead.
 */
describe('POST /:gameId/complete — a failed stats read never becomes zeros', () => {
  it('502s and writes NO stats when the learning_stats read fails transiently', async () => {
    const inner = recordingFetch(db);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      // Fault ONLY the learning_stats GET — everything else still succeeds.
      if (url.includes('/learning_stats') && method === 'GET') {
        return new Response('{"message":"no more connections allowed"}', { status: 503 });
      }
      return inner(input, init);
    }));

    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(completeBody());

    expect(res.status).toBe(502);
    // No PATCH was issued at all — the refusal happens BEFORE the write.
    expect(writesTo('learning_stats')).toHaveLength(0);
    // And the learner's accumulated history is exactly as it was.
    expect(statsRow()).toMatchObject({
      xp_points: 40,
      minutes_learned: 12,
      lessons_completed: 7,
      streak_days: 0,
      longest_streak: 3,
    });
  });
});

// ---- 8. Body validation --------------------------------------------------------------

describe('POST /:gameId/complete — malformed bodies are refused at the edge', () => {
  const badBodies: [string, Record<string, unknown>][] = [
    ['a run_id that is not a uuid', { run_id: 'run-1' }],
    ['a missing run_id', { run_id: undefined }],
    ['a missing local_date', { local_date: undefined }],
    ['a local_date that is not YYYY-MM-DD', { local_date: '30/07/2026' }],
    ['a local_date with a two-digit year', { local_date: '26-07-30' }],
    ['a negative seed', { seed: -1 }],
    ['a non-integer seed', { seed: 1.5 }],
    ['a negative duration', { duration_seconds: -1 }],
    ['a tick that is not an integer', { input_log: [{ tick: 1.5, action: 'place' }] }],
    ['a non-finite coordinate', { input_log: [{ tick: 0, action: 'place', x: 'NaN' }] }],
    ['an unknown field inside an event', { input_log: [{ tick: 0, action: 'place', score: 100 }] }],
  ];

  for (const [label, override] of badBodies) {
    it(`400s VALIDATION_ERROR on ${label}`, async () => {
      const body = completeBody(override);
      if (override.run_id === undefined && 'run_id' in override) delete body.run_id;
      if (override.local_date === undefined && 'local_date' in override) delete body.local_date;
      const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.data).toBeNull();
      expect(writesTo('game_attempts')).toHaveLength(0);
    });
  }

  it('400s VALIDATION_ERROR on an oversized input_log, before any replay is attempted', async () => {
    // One past MAX_EVENTS_CEILING (20 000). Rejected by Zod at the edge, so the
    // simulator is never even initialised.
    const oversized = Array.from({ length: 20_001 }, () => ({ tick: 0, action: 'place' }));
    const res = await auth(request(createApp()).post(`/api/v1/games/${GAME_READY_ID}/complete`)).send(
      completeBody({ input_log: oversized }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(writesTo('game_attempts')).toHaveLength(0);
  });

  it('404s a malformed :gameId before parsing the body', async () => {
    const res = await auth(request(createApp()).post('/api/v1/games/not-a-uuid/complete')).send(completeBody());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
