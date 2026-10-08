import { describe, expect, it, vi } from 'vitest';
import { sampleReport, SESSION_ID, RUN_ID } from './__fixtures__/fakes';
import { createGamesClient, failureOfError, kartrushEnabled, sessionsLeft, type GamesTransport } from './api';

/*
 * Every Core answer is parsed against the contract; one that does not match is a
 * `malformed` failure the screen says out loud. These tests feed the client a
 * scripted transport and assert on what it asked for and on what it refuses to
 * believe.
 */

const sessionBody = {
  sessionId: SESSION_ID, sessionRef: 'ref_abcdefgh12', game: { url: 'http://localhost:4010/?embed=1', build: 'b1' }, mentor: 'dina', band: '6-9',
  caps: { softMs: 900_000, hardMs: 1_500_000, idleMs: 600_000 }, save: { revision: 3, data: { a: 1 } },
  bests: [{ trackId: 'glacier', character: 'rho', speedClass: '100cc', bestFinishMs: 120_000, bestLapMs: 40_000, runs: 2 }], sessionsRemainingToday: 1,
};

function client(answer: (path: string, init?: { method?: string; body?: unknown }) => { data: unknown; error: { code: string } | null }) {
  const transport = vi.fn(async (path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }) => answer(path, init));
  return { transport, games: createGamesClient(transport as GamesTransport) };
}
const ok = (data: unknown) => ({ data, error: null });

describe('GET /learn/games', () => {
  it('lists the games and reads enabled and the sessions left', async () => {
    const { games, transport } = client(() => ok({ games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: 2, enabled: true }] }));
    const result = await games.list();
    expect(transport).toHaveBeenCalledWith('/learn/games', undefined);
    expect(result.ok && kartrushEnabled(result.value)).toBe(true);
    expect(result.ok && sessionsLeft(result.value)).toBe(2);
  });

  it('reads enabled: false as off, and an unlisted game as null sessions', async () => {
    const { games } = client(() => ok({ games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: 0, enabled: false }] }));
    const result = await games.list();
    expect(result.ok && kartrushEnabled(result.value)).toBe(false);
    expect(result.ok && sessionsLeft(result.value, 'other')).toBeNull();
  });

  it.each([
    ['no games array', {}],
    ['a status the contract does not have', { games: [{ gameId: 'kartrush', status: 'beta', sessionsRemainingToday: 1, enabled: true }] }],
    ['a string count', { games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: '1', enabled: true }] }],
    ['a missing enabled flag', { games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: 1 }] }],
    ['a negative count', { games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: -1, enabled: true }] }],
    ['null', null],
  ])('treats %s as malformed, never as zero sessions', async (_label, data) => {
    const { games } = client(() => ok(data));
    expect(await games.list()).toEqual({ ok: false, failure: { kind: 'malformed' } });
  });
});

describe('POST /sessions', () => {
  it('sends an empty body and returns the validated session with the accepted game URL', async () => {
    const { games, transport } = client(() => ok(sessionBody));
    const result = await games.createSession();
    expect(transport).toHaveBeenCalledWith('/learn/games/kartrush/sessions', { method: 'POST', body: {} });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.game).toEqual({ href: 'http://localhost:4010/?embed=1', origin: 'http://localhost:4010', build: 'b1' });
    expect(result.value.caps.softMs).toBe(900_000);
    expect(result.value.mentor).toBe('dina');
  });

  it('accepts a null mentor and null save data', async () => {
    const { games } = client(() => ok({ ...sessionBody, mentor: null, save: { revision: 0, data: null } }));
    const result = await games.createSession();
    expect(result.ok && result.value.mentor).toBeNull();
    expect(result.ok && result.value.save.data).toBeNull();
  });

  it('refuses a game URL outside the allow-list, so no iframe is built for it', async () => {
    const { games } = client(() => ok({ ...sessionBody, game: { url: 'https://evil.example/?embed=1', build: 'b1' } }));
    expect(await games.createSession()).toEqual({ ok: false, failure: { kind: 'untrustedUrl' } });
  });

  it.each([
    ['a missing cap', { ...sessionBody, caps: { softMs: 1, hardMs: 2 } }],
    ['a zero cap, which would end play at once', { ...sessionBody, caps: { softMs: 0, hardMs: 1, idleMs: 1 } }],
    ['a string cap', { ...sessionBody, caps: { softMs: '900000', hardMs: 1, idleMs: 1 } }],
    ['a session id that is not a uuid', { ...sessionBody, sessionId: 'abc' }],
    ['a session reference with a space', { ...sessionBody, sessionRef: 'ref abcdefgh' }],
    ['an unknown mentor', { ...sessionBody, mentor: 'tutor' }],
    ['an unknown band', { ...sessionBody, band: '4-5' }],
    ['array save data', { ...sessionBody, save: { revision: 1, data: [] } }],
    ['a best row with an unknown track', { ...sessionBody, bests: [{ trackId: 'nowhere', character: 'rho', speedClass: '100cc', bestFinishMs: 1, bestLapMs: 1, runs: 1 }] }],
    ['no game', { ...sessionBody, game: undefined }],
  ])('treats %s as malformed', async (_label, data) => {
    const { games } = client(() => ok(data));
    expect(await games.createSession()).toEqual({ ok: false, failure: { kind: 'malformed' } });
  });
});

describe('the other endpoints', () => {
  it('posts a heartbeat with the visible and focused flags', async () => {
    const { games, transport } = client(() => ok({ activeSeconds: 31, state: 'soft' }));
    const result = await games.heartbeat(SESSION_ID, { visible: true, focused: true });
    expect(transport).toHaveBeenCalledWith(`/learn/games/kartrush/sessions/${SESSION_ID}/heartbeat`, { method: 'POST', body: { visible: true, focused: true } });
    expect(result).toEqual({ ok: true, value: { activeSeconds: 31, state: 'soft' } });
  });

  it.each([['an unknown state', { activeSeconds: 1, state: 'warn' }], ['a missing count', { state: 'ok' }], ['a negative count', { activeSeconds: -1, state: 'ok' }]])(
    'treats a heartbeat with %s as malformed', async (_label, data) => {
      const { games } = client(() => ok(data));
      expect(await games.heartbeat(SESSION_ID, { visible: true, focused: true })).toEqual({ ok: false, failure: { kind: 'malformed' } });
    });

  it('posts a run report body as it is and returns the validated result', async () => {
    const answer = { runId: RUN_ID, lens: 'item_hold', newBest: true, bests: [], aiAvailable: true };
    const { games, transport } = client(() => ok(answer));
    const report = sampleReport();
    const result = await games.postRun(SESSION_ID, report);
    expect(transport).toHaveBeenCalledWith(`/learn/games/kartrush/sessions/${SESSION_ID}/runs`, { method: 'POST', body: report });
    expect(result).toEqual({ ok: true, value: answer });
  });

  it.each([['an unknown lens', { runId: RUN_ID, lens: 'tilted', newBest: false, bests: [], aiAvailable: false }],
    ['a missing aiAvailable', { runId: RUN_ID, lens: 'steady', newBest: false, bests: [] }],
    ['a run id that is not a uuid', { runId: 'r1', lens: 'steady', newBest: false, bests: [], aiAvailable: false }]])(
    'treats a run answer with %s as malformed', async (_label, data) => {
      const { games } = client(() => ok(data));
      expect(await games.postRun(SESSION_ID, sampleReport())).toEqual({ ok: false, failure: { kind: 'malformed' } });
    });

  it('posts the reflection reply and the end reason', async () => {
    const { games, transport } = client(() => ok({ ok: true }));
    expect(await games.reflect(SESSION_ID, RUN_ID, 'unsure')).toEqual({ ok: true, value: true });
    expect(transport).toHaveBeenLastCalledWith(`/learn/games/kartrush/sessions/${SESSION_ID}/runs/${RUN_ID}/reflection`, { method: 'POST', body: { reply: 'unsure' } });
    expect(await games.end(SESSION_ID, 'soft')).toEqual({ ok: true, value: true });
    expect(transport).toHaveBeenLastCalledWith(`/learn/games/kartrush/sessions/${SESSION_ID}/end`, { method: 'POST', body: { reason: 'soft' } });
  });

  it('lets the end request outlive the page only when asked', async () => {
    const { games, transport } = client(() => ok({ ok: true }));
    await games.end(SESSION_ID, 'left', { keepalive: true });
    expect(transport).toHaveBeenLastCalledWith(`/learn/games/kartrush/sessions/${SESSION_ID}/end`, { method: 'POST', body: { reason: 'left' }, keepalive: true });
    await games.end(SESSION_ID, 'left');
    expect(transport).toHaveBeenLastCalledWith(`/learn/games/kartrush/sessions/${SESSION_ID}/end`, { method: 'POST', body: { reason: 'left' } });
  });

  it('puts the save with its revision and returns the new revision', async () => {
    const { games, transport } = client(() => ok({ revision: 5 }));
    expect(await games.putSave(SESSION_ID, { revision: 4, data: { a: 1 } })).toEqual({ ok: true, value: 5 });
    expect(transport).toHaveBeenCalledWith(`/learn/games/kartrush/sessions/${SESSION_ID}/save`, { method: 'PUT', body: { revision: 4, data: { a: 1 } } });
  });

  it('accepts an AI debrief only with text, and an authored one only without', async () => {
    const run = async (data: unknown) => client(() => ok(data)).games.debrief(SESSION_ID, RUN_ID);
    expect(await run({ source: 'ai', text: '  You waited well.  ' })).toEqual({ ok: true, value: { source: 'ai', text: 'You waited well.' } });
    expect(await run({ source: 'authored', text: null })).toEqual({ ok: true, value: { source: 'authored' } });
    expect(await run({ source: 'ai', text: null })).toEqual({ ok: false, failure: { kind: 'malformed' } });
    expect(await run({ source: 'ai', text: '   ' })).toEqual({ ok: false, failure: { kind: 'malformed' } });
    expect(await run({ source: 'authored', text: 'sneaky' })).toEqual({ ok: false, failure: { kind: 'malformed' } });
  });

  it('encodes ids in paths so a hostile id cannot add a segment', async () => {
    const { games, transport } = client(() => ok({ ok: true }));
    await games.end('a/../../b', 'left');
    expect(transport).toHaveBeenCalledWith('/learn/games/kartrush/sessions/a%2F..%2F..%2Fb/end', expect.anything());
  });
});

describe('failures', () => {
  it.each([
    ['NETWORK', { kind: 'offline' }], ['OFFLINE', { kind: 'offline' }],
    ['UNAUTHORIZED', { kind: 'refused', code: 'UNAUTHORIZED' }], ['AGE_SCREEN_REQUIRED', { kind: 'refused', code: 'AGE_SCREEN_REQUIRED' }],
    ['GAME_DISABLED', { kind: 'disabled' }], ['SESSION_CLOSED', { kind: 'closed' }], ['SESSION_EXPIRED', { kind: 'expired' }],
    ['GAME_UNKNOWN', { kind: 'unknownGame' }], ['RUN_IMPLAUSIBLE', { kind: 'implausible' }], ['VALIDATION_ERROR', { kind: 'error', code: 'VALIDATION_ERROR' }],
  ])('maps %s', (code, expected) => {
    expect(failureOfError({ code })).toEqual(expected);
  });

  it('reads the reset instant of a daily limit only when it is a real date', () => {
    expect(failureOfError({ code: 'GAME_DAILY_LIMIT', resetsAt: '2026-10-07T05:00:00.000Z' } as { code: string })).toEqual({ kind: 'limit', resetsAt: '2026-10-07T05:00:00.000Z' });
    expect(failureOfError({ code: 'GAME_DAILY_LIMIT', resetsAt: 'soon' } as { code: string })).toEqual({ kind: 'limit', resetsAt: null });
    expect(failureOfError({ code: 'GAME_DAILY_LIMIT' })).toEqual({ kind: 'limit', resetsAt: null });
  });

  it('reads the conflict revision from the error data, or from the error itself, and never guesses one', () => {
    expect(failureOfError({ code: 'SAVE_CONFLICT', data: { revision: 7 } } as { code: string })).toEqual({ kind: 'conflict', revision: 7 });
    expect(failureOfError({ code: 'SAVE_CONFLICT', revision: 8 } as { code: string })).toEqual({ kind: 'conflict', revision: 8 });
    expect(failureOfError({ code: 'SAVE_CONFLICT', data: { revision: '7' } } as { code: string })).toEqual({ kind: 'conflict', revision: null });
    expect(failureOfError({ code: 'SAVE_CONFLICT', data: { revision: -1 } } as { code: string })).toEqual({ kind: 'conflict', revision: null });
    expect(failureOfError({ code: 'SAVE_CONFLICT' })).toEqual({ kind: 'conflict', revision: null });
  });

  it('turns a throwing transport into offline', async () => {
    const games = createGamesClient(async () => { throw new Error('boom'); });
    expect(await games.list()).toEqual({ ok: false, failure: { kind: 'offline' } });
  });

  it('turns a Core error into its failure through the client', async () => {
    const { games } = client(() => ({ data: null, error: { code: 'GAME_DAILY_LIMIT' } }));
    expect(await games.createSession()).toEqual({ ok: false, failure: { kind: 'limit', resetsAt: null } });
  });
});
