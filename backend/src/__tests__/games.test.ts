import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetConfigForTests } from '../config.js';
import { earliestLocalDayStartIso } from '../lib/localDay.js';
import { mintToken } from './helpers.js';
import { installFakeFetch, newWorld, type GamesWorld } from './gamesFakeDb.js';

/*
 * Games in /learn at Core's boundary (docs/games/KRV1-CONTRACT.md section 3).
 *
 * The atomic rules live in the database and are proven on PostgreSQL in
 * database/scripts/verify-game-records-postgres.py. Here the suite proves Core:
 * the contract's shapes and error codes, that nothing is written before the
 * limits, consent and reads that gate it, that an unreadable answer is never an
 * empty success, that the guardian can only lower, that no identifier leaves
 * Core, that the AI line is reached only behind both switches, the guardian's
 * consent and the cap, and that a race awards nothing (no XP, coins, streak or
 * kc_attempt call exists anywhere on these routes).
 */

const mocks = vi.hoisted(() => ({
  register: 'young' as 'young' | 'transition' | 'teen' | 'adult',
  prefs: { character: 'zara', updated_at: '2026-09-01T00:00:00.000Z' } as { character: string; updated_at: string },
}));

vi.mock('../services/ageScreen.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/ageScreen.js')>()),
  readAgeScreen: vi.fn(async () => ({ required: false, ageBand: 'under_13', protectedOrigin: false })),
}));
vi.mock('../services/learnerRegister.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/learnerRegister.js')>()),
  resolveLearnerRegister: vi.fn(async () => mocks.register),
}));
vi.mock('../services/tutorData.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/tutorData.js')>()),
  getTutorPreferences: vi.fn(async () => ({
    user_id: 'x', companion: null, diorama: 'diorama-a', backdrop: 'auto', nickname: null, adaptations: [], ...mocks.prefs,
  })),
}));

const KID = '11111111-1111-4111-8111-111111111111';
const OTHER_KID = '22222222-2222-4222-8222-222222222222';
const PARENT = '33333333-3333-4333-8333-333333333333';
const STRANGER = '44444444-4444-4444-8444-444444444444';
const UNVERIFIED = '55555555-5555-4555-8555-555555555555';

let w: GamesWorld;

beforeEach(() => {
  w = newWorld();
  w.roles.set(KID, ['universal', 'kid']);
  w.roles.set(OTHER_KID, ['universal', 'kid']);
  w.roles.set(PARENT, ['universal', 'parent']);
  w.roles.set(STRANGER, ['universal', 'parent']);
  w.roles.set(UNVERIFIED, ['universal', 'parent']);
  w.verifiedAdults.add(PARENT);
  w.verifiedAdults.add(STRANGER);
  w.links.add(`${PARENT}:${KID}`);
  mocks.register = 'young';
  mocks.prefs = { character: 'zara', updated_at: '2026-09-01T00:00:00.000Z' };
  delete process.env.GAME_AI_DEBRIEF;
  delete process.env.GAME_AI_DAILY_LINES;
  resetConfigForTests();
  installFakeFetch(w);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GAME_AI_DEBRIEF;
  delete process.env.GAME_AI_DAILY_LINES;
  resetConfigForTests();
});

// One app for the file: building Core's router tree per request made a whole play-through slower than the test timeout on a busy machine.
const app = createApp();
vi.setConfig({ testTimeout: 20_000 });

const auth = (sub: string, extra: Record<string, unknown> = {}) => `Bearer ${mintToken({ sub, ...extra })}`;
const call = (verb: 'get' | 'post' | 'put', sub: string, path: string, body?: unknown) => {
  const req = request(app)[verb](`/api/v1${path}`).set('Authorization', auth(sub));
  return body === undefined ? req : req.send(body as object);
};
const open = async (sub = KID) => {
  const res = await call('post', sub, '/learn/games/kartrush/sessions', {});
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data as { sessionId: string; sessionRef: string };
};
const base = (sessionId: string) => `/learn/games/kartrush/sessions/${sessionId}`;
/** The learner finishes a session on purpose (a break card, a hard stop): it is never reopened, so the next start is a new one. */
const finish = (sessionId: string, sub = KID) => call('post', sub, `${base(sessionId)}/end`, { reason: 'soft' });

function report(overrides: Record<string, unknown> = {}) {
  return {
    runKey: 'run-abcdef01', mode: 'single', trackId: 'jungleNeck', character: 'rho', kartBody: 'fossilRunner', speedClass: '150cc',
    finished: true, finishMs: 95_000, bestLapMs: 31_000, lapMs: [31_000, 32_000, 32_000], rank: 3,
    lens: { itemHoldMs: 0, boxesPassedWhileHolding: 0, itemsUsed: 2, driftReleases: { t0: 1, t1: 2, t2: 1, t3: 0 }, recoveries: 0 },
    ...overrides,
  };
}

describe('GET /learn/games', () => {
  it('lists the live game with the sessions left today and whether it is enabled', async () => {
    const res = await call('get', KID, '/learn/games');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: 2, enabled: true }] }, error: null });
    await open();
    expect((await call('get', KID, '/learn/games')).body.data.games[0].sessionsRemainingToday).toBe(1);
  });

  it('is disabled when a guardian set zero sessions, and when a migrated child has no consent to game records', async () => {
    w.limits.set(KID, { sessions: 0, minutes: 25 });
    expect((await call('get', KID, '/learn/games')).body.data.games[0].enabled).toBe(false);
    w.limits.delete(KID);
    w.migrated.add(KID);
    expect((await call('get', KID, '/learn/games')).body.data.games[0].enabled).toBe(false);
    w.consents.add(`${KID}:game_play_records`);
    expect((await call('get', KID, '/learn/games')).body.data.games[0].enabled).toBe(true);
  });

  it('shows no game that is not live, and an unreadable catalog is a 502, not an empty list', async () => {
    w.catalog = [{ game_id: 'kartrush', status: 'hidden', min_band: '6-9' }];
    expect((await call('get', KID, '/learn/games')).body.data.games).toEqual([]);
    w.broken.add('game_catalog');
    const res = await call('get', KID, '/learn/games');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('needs a session', async () => {
    expect((await request(app).get('/api/v1/learn/games')).status).toBe(401);
  });
});

describe('POST /learn/games/:gameId/sessions', () => {
  it('opens a session with exactly the contract shape, and no account id anywhere in it', async () => {
    const res = await call('post', KID, '/learn/games/kartrush/sessions', {});
    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual(['bests', 'band', 'caps', 'game', 'mentor', 'save', 'sessionId', 'sessionRef', 'sessionsRemainingToday'].sort());
    expect(data.sessionRef).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(data.game).toEqual({ url: 'https://kartrush-production.up.railway.app', build: 'unknown' });
    expect(data.mentor).toBe('zara');
    expect(data.band).toBe('6-9');
    expect(data.caps).toEqual({ softMs: 15 * 60_000, hardMs: 25 * 60_000, idleMs: 10 * 60_000 });
    expect(data.save).toEqual({ revision: 0, data: null });
    expect(data.bests).toEqual([]);
    expect(data.sessionsRemainingToday).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain(KID);
    expect(w.sessions[0]).toMatchObject({ user_id: KID, locale: 'es-MX', mentor: 'zara', band: '6-9', max_minutes: 25 });
  });

  it('reads the game url and build from the environment', async () => {
    process.env.KARTRUSH_URL = 'https://game.example.test';
    process.env.KARTRUSH_BUILD = 'b-42';
    resetConfigForTests();
    try {
      const { sessionId } = await open();
      expect(w.sessions.find((s) => s.id === sessionId)?.client_build).toBe('b-42');
      const next = await call('post', OTHER_KID, '/learn/games/kartrush/sessions', {});
      expect(next.body.data.game).toEqual({ url: 'https://game.example.test', build: 'b-42' });
    } finally {
      delete process.env.KARTRUSH_URL;
      delete process.env.KARTRUSH_BUILD;
      resetConfigForTests();
    }
  });

  it('answers a null mentor until the learner has chosen one', async () => {
    mocks.prefs = { character: 'rho', updated_at: new Date(0).toISOString() };
    const res = await call('post', KID, '/learn/games/kartrush/sessions', {});
    expect(res.body.data.mentor).toBeNull();
    expect(w.sessions[0]!.mentor).toBeNull();
  });

  it('stops at two sessions a learner-local day, naming the reset instant; the window is the local midnight', async () => {
    await finish((await open()).sessionId);
    await finish((await open()).sessionId);
    const third = await call('post', KID, '/learn/games/kartrush/sessions', {});
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('GAME_DAILY_LIMIT');
    expect(new Date(third.body.error.resetsAt).getTime()).toBeGreaterThan(Date.now());
    expect(third.body.error.resetsAt).toBe(earliestLocalDayStartIso(new Date(), 1));
    expect(w.sessions).toHaveLength(2);
    const since = w.calls.filter((c) => c.url.includes('/rpc/start_game_session_checked')).at(-1)!.body!.p_since;
    expect(since).toBe(earliestLocalDayStartIso());
    expect(w.calls.filter((c) => c.url.includes('/rpc/start_game_session_checked')).at(-1)!.body!.p_cap).toBe(2);
  });

  it('a guardian-lowered limit lowers the caps and the daily count; zero admits nobody', async () => {
    w.limits.set(KID, { sessions: 1, minutes: 10 });
    const res = await call('post', KID, '/learn/games/kartrush/sessions', {});
    expect(res.body.data.caps).toEqual({ softMs: 5 * 60_000, hardMs: 10 * 60_000, idleMs: 10 * 60_000 });
    expect(res.body.data.sessionsRemainingToday).toBe(0);
    await finish(res.body.data.sessionId);
    expect((await call('post', KID, '/learn/games/kartrush/sessions', {})).status).toBe(429);
    w.limits.set(OTHER_KID, { sessions: 0, minutes: 25 });
    const none = await call('post', OTHER_KID, '/learn/games/kartrush/sessions', {});
    expect(none.status).toBe(403);
    expect(none.body.error.code).toBe('GAME_DISABLED');
    expect(w.sessions.filter((s) => s.user_id === OTHER_KID)).toHaveLength(0);
  });

  it('refuses an unknown or non-live game, a bad id and a body with anything in it', async () => {
    expect((await call('post', KID, '/learn/games/pong/sessions', {})).body.error.code).toBe('GAME_UNKNOWN');
    expect((await call('post', KID, '/learn/games/Bad-Id/sessions', {})).status).toBe(404);
    w.catalog = [{ game_id: 'kartrush', status: 'retired', min_band: '6-9' }];
    expect((await call('post', KID, '/learn/games/kartrush/sessions', {})).status).toBe(404);
    w.catalog = [{ game_id: 'kartrush', status: 'live', min_band: '6-9' }];
    expect((await call('post', KID, '/learn/games/kartrush/sessions', { nickname: 'x' })).status).toBe(400);
    expect(w.sessions).toHaveLength(0);
  });

  it('a migrated child needs the Tutor\'s consent to game records before any session exists', async () => {
    w.migrated.add(KID);
    const res = await call('post', KID, '/learn/games/kartrush/sessions', {});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GAME_DISABLED');
    expect(w.sessions).toHaveLength(0);
    w.consents.add(`${KID}:game_play_records`);
    expect((await call('post', KID, '/learn/games/kartrush/sessions', {})).status).toBe(201);
  });

  it('a game whose minimum band is above the learner\'s is not available', async () => {
    w.catalog = [{ game_id: 'kartrush', status: 'live', min_band: '13-17' }];
    expect((await call('post', KID, '/learn/games/kartrush/sessions', {})).body.error.code).toBe('GAME_DISABLED');
    mocks.register = 'teen';
    expect((await call('post', KID, '/learn/games/kartrush/sessions', {})).status).toBe(201);
  });

  it.each(['learner_play_limits', 'game_saves', 'game_progress', 'game_sessions'])(
    'an unreadable %s fails closed: 502 and no slot of the day is used',
    async (table) => {
      w.broken.add(table);
      const res = await call('post', KID, '/learn/games/kartrush/sessions', {});
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
      expect(w.sessions).toHaveLength(0);
      expect(w.calls.some((c) => c.url.includes('/rpc/start_game_session_checked'))).toBe(false);
    },
  );

  it('an unreadable consent registry is a 502, not "not available" (neither a yes nor a no)', async () => {
    w.broken.add('rpc:data_practice_applies');
    const res = await call('post', KID, '/learn/games/kartrush/sessions', {});
    expect(res.status).toBe(502);
    expect(w.sessions).toHaveLength(0);
  });

  it('hands the learner their save and bests from the server', async () => {
    w.saves.push({ user_id: KID, game_id: 'kartrush', revision: 4, save: { hints: [1] } });
    w.progress.push({ user_id: KID, game_id: 'kartrush', track_id: 'glacier', character: 'dina', speed_class: '100cc', best_finish_ms: 100_000, best_lap_ms: 33_000, runs: 3 });
    w.progress.push({ user_id: OTHER_KID, game_id: 'kartrush', track_id: 'glacier', character: 'dina', speed_class: '100cc', best_finish_ms: 1, best_lap_ms: 1, runs: 1 });
    const { body } = await call('post', KID, '/learn/games/kartrush/sessions', {});
    expect(body.data.save).toEqual({ revision: 4, data: { hints: [1] } });
    expect(body.data.bests).toEqual([{ trackId: 'glacier', character: 'dina', speedClass: '100cc', bestFinishMs: 100_000, bestLapMs: 33_000, runs: 3 }]);
  });
});

describe('a refresh or a quick trip away reopens the session instead of using a slot', () => {
  const start = () => call('post', KID, '/learn/games/kartrush/sessions', {});
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('a refresh returns the same session, with a fresh ref, and the remaining count does not move', async () => {
    const first = await start();
    expect(first.body.data.sessionsRemainingToday).toBe(1);
    w.sessions[0]!.active_seconds = 120;
    const again = await start();
    expect(again.status).toBe(201);
    expect(again.body.data.sessionId).toBe(first.body.data.sessionId);
    expect(again.body.data.sessionRef).not.toBe(first.body.data.sessionRef);
    expect(again.body.data.sessionsRemainingToday).toBe(1);
    expect(Object.keys(again.body.data).sort()).toEqual(Object.keys(first.body.data).sort());
    expect(w.sessions).toHaveLength(1);
    expect(w.sessions[0]!.active_seconds).toBe(120);
    // The reopened session lives for its remaining active budget plus a minute, not another full session.
    const left = Date.parse(String(w.sessions[0]!.expires_at)) - Date.now();
    expect(left).toBeGreaterThan((25 * 60 - 120 + 50) * 1000);
    expect(left).toBeLessThan((25 * 60 - 120 + 70) * 1000);
  });

  it('a session the learner left a moment ago comes back, and can then be played', async () => {
    const first = (await start()).body.data.sessionId as string;
    await call('post', KID, `${base(first)}/end`, { reason: 'left' });
    const again = await start();
    expect(again.body.data.sessionId).toBe(first);
    expect(w.sessions[0]).toMatchObject({ ended_at: null, close_reason: null });
    expect((await call('post', KID, `${base(first)}/heartbeat`, { visible: true, focused: true })).body.data.state).toBe('ok');
    expect(again.body.data.sessionsRemainingToday).toBe(1);
  });

  it('at the daily cap a reopen still works, and a new session is still refused', async () => {
    const one = (await start()).body.data.sessionId as string;
    w.sessions[0]!.last_heartbeat_at = ago(11 * 60_000);
    const two = (await start()).body.data.sessionId as string;
    expect(two).not.toBe(one);
    expect(w.sessions).toHaveLength(2);
    const third = await start();
    expect(third.status).toBe(201);
    expect(third.body.data.sessionId).toBe(two);
    expect(third.body.data.sessionsRemainingToday).toBe(0);
    expect(w.sessions).toHaveLength(2);
    await call('post', KID, `${base(two)}/end`, { reason: 'soft' });
    expect((await start()).body.error.code).toBe('GAME_DAILY_LIMIT');
  });

  it.each(['soft', 'hard', 'idle'])('a session closed as %s is never reopened', async (reason) => {
    const first = (await start()).body.data.sessionId as string;
    await call('post', KID, `${base(first)}/end`, { reason });
    const next = await start();
    expect(next.status).toBe(201);
    expect(next.body.data.sessionId).not.toBe(first);
    expect(w.sessions.find((s) => s.id === first)).toMatchObject({ close_reason: reason });
    expect(next.body.data.sessionsRemainingToday).toBe(0);
    expect((await start()).body.data.sessionId).toBe(next.body.data.sessionId);
  });

  it('a hard stop reached by heartbeat stays closed, and at the cap nothing replaces it', async () => {
    await open();
    w.sessions[0]!.last_heartbeat_at = ago(11 * 60_000);
    const second = (await start()).body.data.sessionId as string;
    w.sessions.find((s) => s.id === second)!.active_seconds = 1500;
    await call('post', KID, `${base(second)}/heartbeat`, { visible: true, focused: true });
    expect(w.sessions.find((s) => s.id === second)).toMatchObject({ close_reason: 'hard' });
    expect((await start()).body.error.code).toBe('GAME_DAILY_LIMIT');
  });

  it.each([
    ['a heartbeat more than 10 minutes old', { last_heartbeat_at: ago(10 * 60_000 + 5_000) }],
    ['a session out of active time', { active_seconds: 1500 }],
    ['a session long expired', { expires_at: ago(11 * 60_000) }],
    ['a session whose wall-clock life ended a moment ago', { expires_at: ago(1000) }],
  ])('%s is not reopened: a new session starts and the stale one is closed as left', async (_label, change) => {
    const first = (await start()).body.data.sessionId as string;
    Object.assign(w.sessions[0]!, change);
    const next = await start();
    expect(next.body.data.sessionId).not.toBe(first);
    expect(w.sessions.find((s) => s.id === first)).toMatchObject({ close_reason: 'left' });
    expect(next.body.data.sessionsRemainingToday).toBe(0);
  });

  it('a guardian who lowered the minutes since is honoured on the reopened session', async () => {
    const first = (await start()).body.data.sessionId as string;
    w.sessions[0]!.active_seconds = 400;
    w.limits.set(KID, { sessions: 2, minutes: 10 });
    const again = await start();
    expect(again.body.data.sessionId).toBe(first);
    expect(again.body.data.caps.hardMs).toBe(10 * 60_000);
    w.limits.set(KID, { sessions: 2, minutes: 5 });
    expect((await start()).body.data.sessionId).not.toBe(first);
  });
});

describe('wall-clock life, the daily window, run limits and failed closes', () => {
  const start = () => call('post', KID, '/learn/games/kartrush/sessions', {});
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const expiresIn = (sessionId: string) => Date.parse(String(w.sessions.find((x) => x.id === sessionId)!.expires_at)) - Date.now();

  it('a new session lives for its minutes plus 10, not hours', async () => {
    const { sessionId } = await open();
    expect(expiresIn(sessionId)).toBeGreaterThan((35 * 60 - 5) * 1000);
    expect(expiresIn(sessionId)).toBeLessThanOrEqual(35 * 60 * 1000);
    w.limits.set(OTHER_KID, { sessions: 2, minutes: 10 });
    const lowered = (await open(OTHER_KID)).sessionId;
    expect(expiresIn(lowered)).toBeLessThanOrEqual(20 * 60 * 1000);
    expect(expiresIn(lowered)).toBeGreaterThan((20 * 60 - 5) * 1000);
  });

  it('a reopen is not activity (the idle clock keeps its value) and never stretches the session past its wall-clock life', async () => {
    const first = (await start()).body.data.sessionId as string;
    const stamp = ago(5 * 60_000);
    Object.assign(w.sessions[0]!, { started_at: ago(30 * 60_000), last_active_at: stamp, last_heartbeat_at: ago(60_000), active_seconds: 60 });
    const again = await start();
    expect(again.body.data.sessionId).toBe(first);
    expect(w.sessions[0]!.last_active_at).toBe(stamp);
    // 25 min of budget would run to 24 min from now; the row's life ends at started_at + 35 min, 5 min from now.
    expect(expiresIn(first)).toBeLessThanOrEqual(5 * 60_000 + 1000);
    expect(expiresIn(first)).toBeGreaterThan(4 * 60_000);
    // Past its life, it is not reopened at all: a new session instead.
    Object.assign(w.sessions[0]!, { started_at: ago(36 * 60_000), expires_at: new Date(Date.now() + 60_000).toISOString() });
    expect((await start()).body.data.sessionId).not.toBe(first);
  });

  it('the daily window is the same for every profile locale, so changing the locale cannot reset the cap', async () => {
    await finish((await open()).sessionId);
    await finish((await open()).sessionId);
    for (const locale of ['en-US', 'pt-BR', 'es-MX']) {
      w.locale = locale;
      const res = await start();
      expect(res.status, locale).toBe(429);
      expect(res.body.error.resetsAt).toBe(earliestLocalDayStartIso(new Date(), 1));
    }
    const sinces = new Set(w.calls.filter((c) => c.url.includes('/rpc/start_game_session_checked')).map((c) => c.body!.p_since));
    expect(sinces.size).toBe(1);
  });

  it('a heartbeat that ends a session as idle but cannot close it is not reported as closed', async () => {
    const { sessionId } = await open();
    w.sessions[0]!.last_active_at = ago(11 * 60_000);
    w.broken.add('rpc:end_game_session');
    const res = await call('post', KID, `${base(sessionId)}/heartbeat`, { visible: false, focused: false });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
    expect(w.sessions[0]!.ended_at).toBeNull();
  });

  it('a session records at most 40 runs (429 RUN_LIMIT), and a repeat of a stored run still answers', async () => {
    const { sessionId } = await open();
    for (let i = 0; i < 40; i += 1) {
      const res = await call('post', KID, `${base(sessionId)}/runs`, report({ runKey: `run-limit-${String(i).padStart(3, '0')}` }));
      expect(res.status, String(i)).toBe(201);
    }
    const over = await call('post', KID, `${base(sessionId)}/runs`, report({ runKey: 'run-limit-040' }));
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('RUN_LIMIT');
    expect(w.runs).toHaveLength(40);
    expect((await call('post', KID, `${base(sessionId)}/runs`, report({ runKey: 'run-limit-000' }))).status).toBe(200);
  });

  it.each(['fossilRunner', 'stoneHauler', 'brassCoupe', 'sparkplug', 'driftFrame', 'circuitCrown'])('accepts the game\'s kart %s', async (kartBody) => {
    const { sessionId } = await open();
    expect((await call('post', KID, `${base(sessionId)}/runs`, report({ kartBody }))).status).toBe(201);
  });

  it('refuses a kart the game does not have, even a well-formed id', async () => {
    const { sessionId } = await open();
    expect((await call('post', KID, `${base(sessionId)}/runs`, report({ kartBody: 'turboToaster' }))).status).toBe(400);
    expect(w.runs).toHaveLength(0);
  });

  it('keeps a legal 64 KB save: the compact cap is Core\'s, the database measures its own wider text with an allowance', async () => {
    const { sessionId } = await open();
    const data = { blob: 'x'.repeat(65_000) };
    expect((await call('put', KID, `${base(sessionId)}/save`, { revision: 0, data })).status).toBe(200);
    expect((await call('put', KID, `${base(sessionId)}/save`, { revision: 1, data: { blob: 'x'.repeat(66_000) } })).status).toBe(413);
  });
});

describe('POST .../heartbeat', () => {
  const beat = (sid: string, body: unknown = { visible: true, focused: true }) => call('post', KID, `${base(sid)}/heartbeat`, body);
  const session = (sid: string) => w.sessions.find((s) => s.id === sid)!;
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('credits elapsed time only while the tab is visible and the frame focused', async () => {
    const { sessionId } = await open();
    session(sessionId).last_heartbeat_at = ago(40_000);
    const visible = await beat(sessionId);
    expect(visible.status).toBe(200);
    expect(visible.body.data.state).toBe('ok');
    expect(visible.body.data.activeSeconds).toBeGreaterThanOrEqual(40);
    expect(visible.body.data.activeSeconds).toBeLessThanOrEqual(42);
    const before = session(sessionId).active_seconds;
    session(sessionId).last_heartbeat_at = ago(40_000);
    expect((await beat(sessionId, { visible: false, focused: true })).body.data.activeSeconds).toBe(before);
    session(sessionId).last_heartbeat_at = ago(40_000);
    expect((await beat(sessionId, { visible: true, focused: false })).body.data.activeSeconds).toBe(before);
    expect(w.calls.filter((c) => c.url.includes('/rpc/credit_game_session')).map((c) => c.body!.p_credit)).toEqual([true, false, false]);
    expect(w.calls.find((c) => c.url.includes('/rpc/credit_game_session'))!.body!.p_max_credit_seconds).toBe(90);
  });

  it.each([
    [0, 'ok'], [899, 'ok'], [900, 'soft'], [1499, 'soft'], [1500, 'hard'], [4000, 'hard'],
  ])('at %i active seconds the state is %s (soft 15 min, hard 25 min)', async (seconds, state) => {
    const { sessionId } = await open();
    session(sessionId).active_seconds = seconds;
    expect((await beat(sessionId)).body.data.state).toBe(state);
  });

  it('the state follows the guardian-lowered minutes', async () => {
    w.limits.set(KID, { sessions: 2, minutes: 10 });
    const { sessionId } = await open();
    session(sessionId).active_seconds = 300;
    expect((await beat(sessionId)).body.data.state).toBe('soft');
    session(sessionId).active_seconds = 600;
    expect((await beat(sessionId)).body.data.state).toBe('hard');
  });

  it('a hard stop and an idle gap close the session, and a closed session then answers 409', async () => {
    const { sessionId } = await open();
    session(sessionId).active_seconds = 1500;
    expect((await beat(sessionId)).body.data.state).toBe('hard');
    expect(session(sessionId)).toMatchObject({ close_reason: 'hard' });
    const after = await beat(sessionId);
    expect(after.status).toBe(409);
    expect(after.body.error.code).toBe('SESSION_CLOSED');

    const { sessionId: second } = await open();
    session(second).last_active_at = ago(11 * 60_000);
    expect((await beat(second, { visible: false, focused: false })).body.data.state).toBe('idle');
    expect(session(second)).toMatchObject({ close_reason: 'idle' });
  });

  it('a soft break does not end the session', async () => {
    const { sessionId } = await open();
    session(sessionId).active_seconds = 960;
    expect((await beat(sessionId)).body.data.state).toBe('soft');
    expect(session(sessionId).ended_at).toBeNull();
  });

  it('a session whose wall-clock life is over answers hard and is closed; another learner\'s session is not found and credits nothing', async () => {
    const { sessionId } = await open();
    session(sessionId).expires_at = ago(1000);
    const gone = await beat(sessionId);
    expect(gone.status).toBe(200);
    expect(gone.body.data.state).toBe('hard');
    expect(session(sessionId)).toMatchObject({ close_reason: 'hard' });
    expect((await beat(sessionId)).status).toBe(409);
    const { sessionId: mine } = await open();
    const foreign = await call('post', OTHER_KID, `${base(mine)}/heartbeat`, { visible: true, focused: true });
    expect(foreign.status).toBe(404);
    expect(session(mine).active_seconds).toBe(0);
  });

  it('refuses a body that is not exactly visible and focused', async () => {
    const { sessionId } = await open();
    for (const body of [{}, { visible: true }, { visible: 'yes', focused: true }, { visible: true, focused: true, input: 'a' }]) {
      expect((await beat(sessionId, body)).status).toBe(400);
    }
    expect((await call('post', KID, '/learn/games/kartrush/sessions/not-a-uuid/heartbeat', { visible: true, focused: true })).status).toBe(400);
  });
});

describe('POST .../runs', () => {
  const post = (sid: string, body: unknown, sub = KID) => call('post', sub, `${base(sid)}/runs`, body);

  it('records a run, picks the lens on the server, and returns the bests', async () => {
    const { sessionId } = await open();
    const res = await post(sessionId, report());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ lens: 'steady', newBest: true, aiAvailable: false });
    expect(res.body.data.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.data.bests).toEqual([{ trackId: 'jungleNeck', character: 'rho', speedClass: '150cc', bestFinishMs: 95_000, bestLapMs: 31_000, runs: 1 }]);
    const sent = w.calls.find((c) => c.url.includes('/rpc/record_game_run'))!.body!;
    expect(sent).toMatchObject({ p_user_id: KID, p_session_id: sessionId, p_lens: 'steady', p_best_lap_ms: 31_000, p_lap_ms: [31_000, 32_000, 32_000] });
    expect(sent.p_metrics).toEqual({
      itemHoldMs: 0, boxesPassedWhileHolding: 0, itemsUsed: 2, driftT0: 1, driftT1: 2, driftT2: 1, driftT3: 0, recoveries: 0,
    });
  });

  it('is idempotent: the same run key returns the stored run with 200 and writes nothing twice', async () => {
    const { sessionId } = await open();
    const first = await post(sessionId, report());
    const again = await post(sessionId, report());
    expect(again.status).toBe(200);
    expect(again.body.data.runId).toBe(first.body.data.runId);
    expect(again.body.data.newBest).toBe(true);
    expect(w.runs).toHaveLength(1);
    expect(w.progress[0]!.runs).toBe(1);
  });

  it('keeps the best per (track, character, speed class): a slower run is not a new best, a faster one is', async () => {
    const { sessionId } = await open();
    await post(sessionId, report());
    const slower = await post(sessionId, report({ runKey: 'run-abcdef02', finishMs: 99_000, lapMs: [33_000, 33_000, 33_000], bestLapMs: 33_000 }));
    expect(slower.body.data.newBest).toBe(false);
    expect(slower.body.data.bests[0]).toMatchObject({ bestFinishMs: 95_000, bestLapMs: 31_000, runs: 2 });
    const faster = await post(sessionId, report({ runKey: 'run-abcdef03', finishMs: 90_000, lapMs: [30_000, 30_000, 30_000], bestLapMs: 30_000 }));
    expect(faster.body.data.newBest).toBe(true);
    expect(faster.body.data.bests[0]).toMatchObject({ bestFinishMs: 90_000, bestLapMs: 30_000, runs: 3 });
    const other = await post(sessionId, report({ runKey: 'run-abcdef04', trackId: 'glacier' }));
    expect(other.body.data.bests).toHaveLength(2);
  });

  it.each([
    ['a lap faster than the physical minimum', { lapMs: [19_000, 38_000, 38_000], bestLapMs: 19_000, finishMs: 95_000 }],
    ['a finish that is not the sum of its laps', { finishMs: 120_000 }],
    ['a best lap that is not the fastest lap', { bestLapMs: 32_000 }],
    ['a finish faster than the minimum for its laps', { finishMs: 50_000, lapMs: [20_000, 20_000, 10_000], bestLapMs: 10_000 }],
  ])('refuses %s as RUN_IMPLAUSIBLE and writes nothing', async (_label, overrides) => {
    const { sessionId } = await open();
    const res = await post(sessionId, report(overrides));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RUN_IMPLAUSIBLE');
    expect(w.calls.some((c) => c.url.includes('/rpc/record_game_run'))).toBe(false);
  });

  it('accepts the boundaries the contract allows: laps of exactly 20 s, a finish within 3 s of the sum', async () => {
    const { sessionId } = await open();
    const edge = await post(sessionId, report({ lapMs: [20_000, 20_000, 20_000], bestLapMs: 20_000, finishMs: 63_000 }));
    expect(edge.status).toBe(201);
    const over = await post(sessionId, report({ runKey: 'run-abcdef09', lapMs: [20_000, 20_000, 20_000], bestLapMs: 20_000, finishMs: 63_001 }));
    expect(over.status).toBe(422);
  });

  it.each([
    ['an unknown field', { extra: 1 }],
    ['an unknown track', { trackId: 'testCircuit' }],
    ['practice mode', { mode: 'practice' }],
    ['an unfinished run', { finished: false }],
    ['a rank of 9', { rank: 9 }],
    ['six laps', { lapMs: [30_000, 30_000, 30_000, 30_000, 30_000, 30_000], finishMs: 180_000, bestLapMs: 30_000 }],
    ['a short run key', { runKey: 'abc' }],
    ['a free-text kart body', { kartBody: 'My Kart! <script>' }],
    ['a finish over 30 minutes', { finishMs: 1_800_001 }],
    ['an extra lens field', { lens: { ...report().lens, nickname: 'x' } }],
  ])('refuses %s with 400', async (_label, overrides) => {
    const { sessionId } = await open();
    const res = await post(sessionId, report(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses a closed, an expired and another learner\'s session', async () => {
    const { sessionId } = await open();
    const sess = w.sessions.find((s) => s.id === sessionId)!;
    expect((await post(sessionId, report(), OTHER_KID)).status).toBe(404);
    sess.expires_at = new Date(Date.now() - 1000).toISOString();
    const expired = await post(sessionId, report());
    expect(expired.status).toBe(410);
    expect(expired.body.error.code).toBe('SESSION_EXPIRED');
    sess.expires_at = new Date(Date.now() + 60_000).toISOString();
    await call('post', KID, `${base(sessionId)}/end`, { reason: 'left' });
    const closed = await post(sessionId, report());
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe('SESSION_CLOSED');
    expect(w.runs).toHaveLength(0);
  });

  it('a read that fails after the run is stored is a retryable 502 (the repeat returns the stored run)', async () => {
    const { sessionId } = await open();
    w.broken.add('game_progress');
    expect((await post(sessionId, report())).status).toBe(502);
    expect(w.runs).toHaveLength(1);
    w.broken.delete('game_progress');
    const retry = await post(sessionId, report());
    expect(retry.status).toBe(200);
    expect(w.runs).toHaveLength(1);
  });

  it('awards nothing: no XP, coin, streak, mastery or analytics call anywhere in a whole play', async () => {
    const { sessionId } = await open();
    await call('post', KID, `${base(sessionId)}/heartbeat`, { visible: true, focused: true });
    const run = await post(sessionId, report());
    await call('post', KID, `${base(sessionId)}/runs/${run.body.data.runId}/reflection`, { reply: 'a' });
    await call('post', KID, `${base(sessionId)}/runs/${run.body.data.runId}/debrief`, {});
    await call('put', KID, `${base(sessionId)}/save`, { revision: 0, data: { a: 1 } });
    await call('post', KID, `${base(sessionId)}/end`, { reason: 'left' });
    const touched = w.calls.map((c) => c.url).filter((u) => /kc_attempt|learning_stats|learning_events|wallet|complete_lesson|award|streak|learner_kc_mastery|memory_card/i.test(u));
    expect(touched).toEqual([]);
    const writes = w.calls.filter((c) => c.method !== 'GET').map((c) => /\/(?:rpc\/)?([a-z_]+)\?|\/(?:rpc\/)?([a-z_]+)$/.exec(c.url)).map((m) => m?.[1] ?? m?.[2])
      // Consent and registry questions are POSTs to read-only functions: reads, not writes.
      .filter((name) => name !== 'data_practice_applies' && name !== 'has_data_practice_consent');
    expect(new Set(writes)).toEqual(new Set([
      'credit_game_session', 'record_game_run', 'game_runs', 'save_game_snapshot', 'end_game_session', 'start_game_session_checked',
    ]));
  });

  it('reports the AI line as available only behind both switches, the guardian\'s consent and an unclaimed run', async () => {
    const { sessionId } = await open();
    expect((await post(sessionId, report())).body.data.aiAvailable).toBe(false);
    process.env.GAME_AI_DEBRIEF = 'on';
    resetConfigForTests();
    expect((await post(sessionId, report({ runKey: 'run-abcdef05' }))).body.data.aiAvailable).toBe(false);
    w.consents.add(`${KID}:game_ai_debrief`);
    expect((await post(sessionId, report({ runKey: 'run-abcdef06' }))).body.data.aiAvailable).toBe(true);
    process.env.GAME_AI_DAILY_LINES = '0';
    resetConfigForTests();
    expect((await post(sessionId, report({ runKey: 'run-abcdef07' }))).body.data.aiAvailable).toBe(false);
  });
});

describe('reflection', () => {
  it('stores the learner\'s own reply on their own run, and nothing else', async () => {
    const { sessionId } = await open();
    const run = (await call('post', KID, `${base(sessionId)}/runs`, report())).body.data.runId as string;
    const url = `${base(sessionId)}/runs/${run}/reflection`;
    expect((await call('post', KID, url, { reply: 'unsure' })).body).toEqual({ data: { ok: true }, error: null });
    expect(w.runs[0]!.reflection).toBe('unsure');
    expect((await call('post', KID, url, { reply: 'maybe' })).status).toBe(400);
    expect((await call('post', KID, url, { reply: 'a', note: 'free text' })).status).toBe(400);
    expect((await call('post', OTHER_KID, url, { reply: 'a' })).status).toBe(404);
    expect((await call('post', KID, `${base(sessionId)}/runs/${'9'.repeat(8)}-9999-4999-8999-${'9'.repeat(12)}/reflection`, { reply: 'a' })).status).toBe(404);
  });
});

describe('POST .../debrief', () => {
  async function played() {
    const { sessionId } = await open();
    const runId = (await call('post', KID, `${base(sessionId)}/runs`, report())).body.data.runId as string;
    return { sessionId, runId, url: `${base(sessionId)}/runs/${runId}/debrief` };
  }
  const oracleCalls = () => w.calls.filter((c) => c.url.includes('/api/v1/game/line'));
  const on = () => { process.env.GAME_AI_DEBRIEF = 'on'; resetConfigForTests(); };

  it('is the authored line, and Oracle is never reached, while the switch is off', async () => {
    const { url } = await played();
    w.consents.add(`${KID}:game_ai_debrief`);
    const res = await call('post', KID, url, {});
    expect(res.body).toEqual({ data: { source: 'authored', text: null }, error: null });
    expect(oracleCalls()).toHaveLength(0);
  });

  it('is the authored line without the guardian\'s consent to the practice, even with the switch on', async () => {
    on();
    const { url } = await played();
    expect((await call('post', KID, url, {})).body.data).toEqual({ source: 'authored', text: null });
    expect(oracleCalls()).toHaveLength(0);
    expect(w.runs[0]!.ai_line_at).toBeNull();
  });

  it('sends Oracle exactly four closed values, returns its line, and records what it cost', async () => {
    on();
    w.consents.add(`${KID}:game_ai_debrief`);
    const { url } = await played();
    const res = await call('post', KID, url, {});
    expect(res.body.data).toEqual({ source: 'ai', text: 'Nice patience on those drifts.' });
    expect(oracleCalls()).toHaveLength(1);
    expect(oracleCalls()[0]!.body).toEqual({ mentor: 'zara', locale: 'es-MX', band: '6-9', lens: 'steady' });
    expect(w.runs[0]!.ai_cost_usd).toBe(0.0002);
    expect(JSON.stringify(oracleCalls()[0]!.body)).not.toContain(KID);
  });

  it('gives each run one line only, and stops at the learner\'s daily cap', async () => {
    on();
    process.env.GAME_AI_DAILY_LINES = '1';
    resetConfigForTests();
    w.consents.add(`${KID}:game_ai_debrief`);
    const first = await played();
    expect((await call('post', KID, first.url, {})).body.data.source).toBe('ai');
    expect((await call('post', KID, first.url, {})).body.data.source).toBe('authored');
    const second = await call('post', KID, `${base(first.sessionId)}/runs`, report({ runKey: 'run-abcdef08' }));
    const next = await call('post', KID, `${base(first.sessionId)}/runs/${second.body.data.runId}/debrief`, {});
    expect(next.body.data).toEqual({ source: 'authored', text: null });
    expect(oracleCalls()).toHaveLength(1);
  });

  it.each([
    ['a server error', { status: 500, body: { data: null, error: { code: 'X', message: 'x' } } }],
    ['a neutral 204', { status: 204 }],
    ['a malformed answer', { status: 200, body: { data: { text: 42 }, error: null } }],
    ['an Oracle error envelope', { status: 200, body: { data: null, error: { code: 'MODEL', message: 'down' } } }],
    ['an unreachable Oracle', { status: 200, throws: true }],
  ])('falls back to the authored line on %s', async (_label, oracle) => {
    on();
    w.consents.add(`${KID}:game_ai_debrief`);
    w.oracle = oracle;
    const { url } = await played();
    const res = await call('post', KID, url, {});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ source: 'authored', text: null });
  });

  it('is the authored line when the learner has not chosen a Mentor', async () => {
    on();
    w.consents.add(`${KID}:game_ai_debrief`);
    mocks.prefs = { character: 'rho', updated_at: new Date(0).toISOString() };
    const { url } = await played();
    expect((await call('post', KID, url, {})).body.data.source).toBe('authored');
    expect(oracleCalls()).toHaveLength(0);
  });

  it('is not found for another learner\'s run, and takes no body', async () => {
    on();
    w.consents.add(`${KID}:game_ai_debrief`);
    const { url } = await played();
    expect((await call('post', OTHER_KID, url, {})).status).toBe(404);
    expect((await call('post', KID, url, { text: 'hi' })).status).toBe(400);
    expect(oracleCalls()).toHaveLength(0);
  });
});

describe('PUT .../save', () => {
  const put = (sid: string, body: unknown) => call('put', KID, `${base(sid)}/save`, body);

  it('is compare-and-set on the revision the client last saw', async () => {
    const { sessionId } = await open();
    expect((await put(sessionId, { revision: 0, data: { hints: [1] } })).body).toEqual({ data: { revision: 1 }, error: null });
    const stale = await put(sessionId, { revision: 0, data: { hints: [2] } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('SAVE_CONFLICT');
    // `data` is null on purpose: the SPA's shared client only surfaces an error when it is.
    expect(stale.body.data).toBeNull();
    expect(stale.body.error.revision).toBe(1);
    expect((await put(sessionId, { revision: 1, data: { hints: [3] } })).body.data).toEqual({ revision: 2 });
    expect(w.saves[0]!.save).toEqual({ hints: [3] });
  });

  it('hands the stored save to the next session', async () => {
    const { sessionId } = await open();
    await put(sessionId, { revision: 0, data: { hints: [1] } });
    await finish(sessionId);
    expect((await open()).sessionId).not.toBe(sessionId);
    expect(w.calls.filter((c) => c.url.includes('/game_saves?')).length).toBeGreaterThan(1);
  });

  it('caps the save at 64 KB (413) and accepts nothing but an object', async () => {
    const { sessionId } = await open();
    expect((await put(sessionId, { revision: 0, data: { blob: 'x'.repeat(70_000) } })).status).toBe(413);
    expect((await put(sessionId, { revision: 0, data: { blob: 'x'.repeat(60_000) } })).status).toBe(200);
    expect((await put(sessionId, { revision: 1, data: [1] })).status).toBe(400);
    expect((await put(sessionId, { revision: -1, data: {} })).status).toBe(400);
    expect((await put(sessionId, { revision: 1.5, data: {} })).status).toBe(400);
    expect((await put(sessionId, { revision: 1, data: {}, extra: true })).status).toBe(400);
  });

  it('takes a save right at the cap even though its request body is past the global 64 KB parser limit', async () => {
    const { sessionId } = await open();
    // The data is 65,530 bytes (under the cap); with the revision wrapper the body is 65,552, over the global limit.
    const data = { blob: 'x'.repeat(65_519) };
    expect(JSON.stringify(data).length).toBe(65_530);
    const res = await put(sessionId, { revision: 0, data });
    expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(200);
    expect(res.body.data).toEqual({ revision: 1 });
  });

  it('needs an open session of the learner\'s own', async () => {
    const { sessionId } = await open();
    expect((await call('put', OTHER_KID, `${base(sessionId)}/save`, { revision: 0, data: {} })).status).toBe(404);
    await call('post', KID, `${base(sessionId)}/end`, { reason: 'left' });
    const closed = await put(sessionId, { revision: 0, data: {} });
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe('SESSION_CLOSED');
    expect(w.saves).toHaveLength(0);
  });
});

describe('POST .../end', () => {
  it('closes the learner\'s session with the reason given, once', async () => {
    const { sessionId } = await open();
    const first = await call('post', KID, `${base(sessionId)}/end`, { reason: 'soft' });
    expect(first.body).toEqual({ data: { ok: true }, error: null });
    await call('post', KID, `${base(sessionId)}/end`, { reason: 'left' });
    expect(w.sessions[0]).toMatchObject({ close_reason: 'soft' });
  });

  it('refuses another learner\'s session, an unknown reason and extra fields', async () => {
    const { sessionId } = await open();
    expect((await call('post', OTHER_KID, `${base(sessionId)}/end`, { reason: 'left' })).status).toBe(404);
    expect((await call('post', KID, `${base(sessionId)}/end`, { reason: 'bored' })).status).toBe(400);
    expect((await call('post', KID, `${base(sessionId)}/end`, { reason: 'left', why: 'x' })).status).toBe(400);
    expect(w.sessions[0]!.ended_at).toBeNull();
  });
});

describe('/family/play-limits — the verified Tutor may only lower', () => {
  const path = (kid: string) => `/family/play-limits/kids/${kid}`;

  it('reads the platform ceiling until a limit is set, then returns what was set', async () => {
    expect((await call('get', PARENT, path(KID))).body).toEqual({ data: { maxSessionsPerDay: 2, maxSessionMinutes: 25 }, error: null });
    const saved = await call('put', PARENT, path(KID), { maxSessionsPerDay: 1, maxSessionMinutes: 10 });
    expect(saved.body.data).toEqual({ maxSessionsPerDay: 1, maxSessionMinutes: 10 });
    expect((await call('get', PARENT, path(KID))).body.data).toEqual({ maxSessionsPerDay: 1, maxSessionMinutes: 10 });
    const rpcArgs = w.calls.find((c) => c.url.includes('/rpc/game_play_limits_write'))!.body;
    expect(rpcArgs).toEqual({ p_guardian: PARENT, p_kid: KID, p_sessions: 1, p_minutes: 10 });
  });

  it('the lowered limit then governs the child\'s sessions end to end', async () => {
    await call('put', PARENT, path(KID), { maxSessionsPerDay: 1, maxSessionMinutes: 5 });
    const res = await call('post', KID, '/learn/games/kartrush/sessions', {});
    expect(res.body.data.caps).toEqual({ softMs: 60_000, hardMs: 5 * 60_000, idleMs: 10 * 60_000 });
    await finish(res.body.data.sessionId);
    expect((await call('post', KID, '/learn/games/kartrush/sessions', {})).status).toBe(429);
  });

  it.each([
    [{ maxSessionsPerDay: 3, maxSessionMinutes: 25 }],
    [{ maxSessionsPerDay: -1, maxSessionMinutes: 25 }],
    [{ maxSessionsPerDay: 2, maxSessionMinutes: 26 }],
    [{ maxSessionsPerDay: 2, maxSessionMinutes: 4 }],
    [{ maxSessionsPerDay: 1.5, maxSessionMinutes: 10 }],
    [{ maxSessionsPerDay: 1 }],
    [{ maxSessionsPerDay: 1, maxSessionMinutes: 10, other: 1 }],
  ])('refuses %j (raising past the ceiling or a malformed body)', async (body) => {
    const res = await call('put', PARENT, path(KID), body);
    expect(res.status).toBe(400);
    expect(w.limits.size).toBe(0);
  });

  it('answers 404 for a child the parent is not linked to, and never confirms another family\'s child', async () => {
    expect((await call('get', STRANGER, path(KID))).status).toBe(404);
    expect((await call('put', STRANGER, path(KID), { maxSessionsPerDay: 0, maxSessionMinutes: 5 })).status).toBe(404);
    expect((await call('get', PARENT, path(OTHER_KID))).status).toBe(404);
    expect(w.limits.size).toBe(0);
  });

  it('is a parent-only, verified-adult surface', async () => {
    expect((await call('get', KID, path(KID))).status).toBe(403);
    expect((await call('put', KID, path(KID), { maxSessionsPerDay: 0, maxSessionMinutes: 5 })).status).toBe(403);
    const unverified = await call('get', UNVERIFIED, path(KID));
    expect(unverified.status).toBe(403);
    expect(unverified.body.error.code).toBe('PARENT_VERIFICATION_REQUIRED');
    expect((await call('get', PARENT, '/family/play-limits/kids/not-a-uuid')).status).toBe(400);
    expect((await request(app).get(`/api/v1${path(KID)}`)).status).toBe(401);
    expect(w.limits.size).toBe(0);
  });
});
