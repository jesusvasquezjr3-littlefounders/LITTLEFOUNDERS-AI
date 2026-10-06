import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  failure, FakeClient, fakeChannel, FakeFrame, FakeGame, RUN_ID, sampleReport, sampleResult, sampleSession, SESSION_ID,
} from './__fixtures__/fakes';
import { GameBridge, type BridgeChannel } from './bridge';
import { PlayController, HEARTBEAT_MS, type PlayDeps } from './controller';
import { GARAGE_STORAGE_KEY } from './selection';

/*
 * One whole visit, driven through a fake Core, a fake frame and a fake game on
 * the other end of the port: the handshake, the init, every relay (runs, saves,
 * heartbeats), the pit stop and each way out. Nothing here touches the network
 * or a real MessageChannel.
 */

const RUN_KEY = 'run-key-0001';
const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

function harness(patch: Partial<PlayDeps> = {}, storage = memoryStorage()) {
  const client = new FakeClient();
  const channel = fakeChannel();
  const frame = new FakeFrame();
  const env = { visible: true, focused: true, reduced: false };
  const exits: number[] = [];
  const controller = new PlayController({
    client, locale: 'es-MX', startLabel: 'Toca para empezar', storage,
    environment: { visible: () => env.visible, frameFocused: () => env.focused, reducedMotion: () => env.reduced },
    createBridge: (options) => new GameBridge({ ...options, createChannel: () => channel as BridgeChannel, onDrop: () => {} }),
    onExit: () => { exits.push(1); }, runRetryMs: 100, ...patch,
  });
  const game = new FakeGame(channel.port2);
  /** Go, answer the session, mount the frame, let it load and let the game say it is ready. */
  async function enter() {
    controller.start();
    await flush();
    controller.go();
    await flush();
    controller.attachFrame(frame);
    frame.fireLoad();
    game.say({ t: 'kr.ready', v: 1, build: 'abc123' });
  }
  /** enter() and the game's first race starting. */
  async function race() {
    await enter();
    game.say({ t: 'kr.runStarted', v: 1, runKey: RUN_KEY, mode: 'single', trackId: 'jungleNeck', character: 'rho' });
  }
  /** race() through to the pit stop, with Core's answer in. */
  async function pitstop(result = sampleResult()) {
    client.runAnswers = [{ ok: true, value: result }];
    await race();
    game.say({ t: 'kr.runFinished', v: 1, ...sampleReport({ runKey: RUN_KEY }) });
    await flush();
    game.say({ t: 'kr.runEnded', v: 1, runKey: RUN_KEY });
  }
  const phase = () => controller.getSnapshot().state.phase;
  return { client, channel, frame, game, env, exits, controller, enter, race, pitstop, phase, storage };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('opening the Garage', () => {
  it('asks Core whether the learner may play and keeps the sessions left', async () => {
    const { controller, client } = harness();
    controller.start();
    await flush();
    expect(client.callsOf('list')).toHaveLength(1);
    expect(controller.getSnapshot().sessionsLeft).toBe(2);
    expect(controller.getSnapshot().state.phase).toBe('garage');
  });

  it('asks only once, even if started twice (a development double mount)', async () => {
    const { controller, client } = harness();
    controller.start();
    controller.start();
    await flush();
    expect(client.callsOf('list')).toHaveLength(1);
  });

  it('shows the closed card when a guardian turned games off, or the game is not listed', async () => {
    const off = harness();
    off.client.listAnswer = { ok: true, value: { games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: 2, enabled: false }] } };
    off.controller.start();
    await flush();
    expect(off.controller.getSnapshot().state).toMatchObject({ phase: 'closed', closed: 'disabled' });
    const unlisted = harness();
    unlisted.client.listAnswer = { ok: true, value: { games: [] } };
    unlisted.controller.start();
    await flush();
    expect(unlisted.controller.getSnapshot().state).toMatchObject({ phase: 'closed', closed: 'disabled' });
  });

  it('shows the closed card when no session is left today, without opening one', async () => {
    const { controller, client } = harness();
    client.listAnswer = { ok: true, value: { games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: 0, enabled: true }] } };
    controller.start();
    await flush();
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'closed', closed: 'limit' });
    expect(client.callsOf('createSession')).toHaveLength(0);
  });

  it('leaves the Garage open when the list cannot be read: Go will say what is wrong', async () => {
    const { controller, client } = harness();
    client.listAnswer = failure({ kind: 'offline' });
    controller.start();
    await flush();
    expect(controller.getSnapshot().state.phase).toBe('garage');
    expect(controller.getSnapshot().sessionsLeft).toBeNull();
  });
});

describe('choices in the Garage', () => {
  it('remembers the last choice and reads it back on the next visit', () => {
    const storage = memoryStorage();
    const first = harness({}, storage);
    first.controller.select({ circuit: 'glacier', mode: 'timeTrial', speed: '150cc', driver: 'dina' });
    expect(JSON.parse(storage.data.get(GARAGE_STORAGE_KEY)!)).toEqual({ circuit: 'glacier', mode: 'timeTrial', speed: '150cc', driver: 'dina', muted: false });
    const second = harness({}, storage);
    expect(second.controller.getSnapshot().state.selection).toEqual({ circuit: 'glacier', mode: 'timeTrial', speed: '150cc', driver: 'dina' });
  });

  it('defaults the driver to the learner\'s own Mentor, follows a Mentor that arrives late, and stores no driver until one is picked', () => {
    const storage = memoryStorage();
    const { controller } = harness({ chosenMentor: 'liruf' }, storage);
    expect(controller.getSnapshot().state.selection.driver).toBe('liruf');
    controller.update({ chosenMentor: 'zara' });
    expect(controller.getSnapshot().state.selection.driver).toBe('zara');
    controller.select({ circuit: 'saltBay' });
    expect(JSON.parse(storage.data.get(GARAGE_STORAGE_KEY)!)).not.toHaveProperty('driver');
    controller.select({ driver: 'rho' });
    controller.update({ chosenMentor: 'dina' });
    expect(controller.getSnapshot().state.selection.driver).toBe('rho');
    expect(JSON.parse(storage.data.get(GARAGE_STORAGE_KEY)!).driver).toBe('rho');
  });

  it('works when storage throws, and ignores a stored value outside the closed vocabulary', () => {
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const { controller } = harness({}, throwing as never);
    expect(() => controller.select({ circuit: 'glacier' })).not.toThrow();
    expect(controller.getSnapshot().state.selection.circuit).toBe('glacier');
    const stale = memoryStorage({ [GARAGE_STORAGE_KEY]: JSON.stringify({ circuit: 'rainbowRoad', mode: 'grandPrix', speed: '200cc', driver: 'tutor', muted: 'yes' }) });
    const reread = harness({}, stale);
    expect(reread.controller.getSnapshot().state.selection).toEqual({ circuit: 'jungleNeck', mode: 'single', driver: 'rho', speed: '100cc' });
    expect(reread.controller.getSnapshot().state.muted).toBe(false);
  });
});

describe('Go and the session', () => {
  it('opens one Core session and exposes only the accepted game address', async () => {
    const { controller, client } = harness();
    controller.start();
    await flush();
    controller.go();
    expect(controller.getSnapshot().state.phase).toBe('loading');
    await flush();
    expect(client.callsOf('createSession')).toHaveLength(1);
    expect(controller.getSnapshot().game).toEqual({ href: 'http://localhost:4010/?embed=1', origin: 'http://localhost:4010' });
  });

  it('presses Go once: a second press while loading opens nothing', async () => {
    const { controller, client } = harness();
    controller.start();
    controller.go();
    controller.go();
    await flush();
    expect(client.callsOf('createSession')).toHaveLength(1);
  });

  it('closes a session Core opened after the learner already left, rather than leaving it to expire', async () => {
    const { controller, client } = harness();
    controller.start();
    controller.go();
    controller.stop();
    await flush();
    expect(client.callsOf('createSession')).toHaveLength(1);
    expect(client.callsOf('end')).toEqual([[SESSION_ID, 'left']]);
    expect(controller.getSnapshot().game).toBeNull();
  });

  it.each([
    [{ kind: 'limit', resetsAt: null } as const, { phase: 'closed', closed: 'limit' }],
    [{ kind: 'disabled' } as const, { phase: 'closed', closed: 'disabled' }],
    [{ kind: 'offline' } as const, { phase: 'error', error: 'offline' }],
    [{ kind: 'malformed' } as const, { phase: 'error', error: 'unavailable' }],
    [{ kind: 'untrustedUrl' } as const, { phase: 'error', error: 'unavailable' }],
    [{ kind: 'error', code: 'INTERNAL' } as const, { phase: 'error', error: 'unavailable' }],
  ])('turns %j into %j', async (reason, expected) => {
    const { controller, client } = harness();
    client.sessionAnswer = failure(reason);
    controller.start();
    controller.go();
    await flush();
    expect(controller.getSnapshot().state).toMatchObject(expected);
    expect(controller.getSnapshot().game).toBeNull();
  });
});

describe('the handshake and lf.init', () => {
  it('sends lf.init after kr.ready with everything the game needs and enters the gate', async () => {
    const { enter, game, controller, frame } = harness();
    await enter();
    expect(frame.hellos).toHaveLength(1);
    expect(frame.hellos[0]!.origin).toBe('http://localhost:4010');
    const [init] = game.ofType('lf.init');
    expect(init).toEqual({
      t: 'lf.init', v: 1, sessionRef: 'ref_abcdefgh12', locale: 'es', mentor: 'zara', muted: false, reducedMotion: false,
      startLabel: 'Toca para empezar', save: { revision: 3, data: { hints: 1 } },
      start: { mode: 'single', trackId: 'jungleNeck', character: 'rho', speedClass: '100cc' },
    });
    expect(controller.getSnapshot().state.phase).toBe('gate');
  });

  it('passes the learner\'s selection, the reduced-motion preference and the mute choice', async () => {
    const { controller, env, enter, game } = harness({}, memoryStorage({ [GARAGE_STORAGE_KEY]: JSON.stringify({ circuit: 'factory', mode: 'practice', speed: '150cc', driver: 'dina', muted: true }) }));
    env.reduced = true;
    await enter();
    expect(game.ofType('lf.init')[0]).toMatchObject({ muted: true, reducedMotion: true, start: { mode: 'practice', trackId: 'factory', character: 'dina', speedClass: '150cc' } });
    expect(controller.getSnapshot().state.selection.driver).toBe('dina');
  });

  it('falls back to the learner\'s chosen Mentor, then to rho, when Core names none', async () => {
    const chosen = harness({ chosenMentor: 'liruf' });
    chosen.client.sessionAnswer = { ok: true, value: sampleSession({ mentor: null }) };
    await chosen.enter();
    expect(chosen.game.ofType('lf.init')[0]!.mentor).toBe('liruf');
    const none = harness();
    none.client.sessionAnswer = { ok: true, value: sampleSession({ mentor: null }) };
    await none.enter();
    expect(none.game.ofType('lf.init')[0]!.mentor).toBe('rho');
  });

  it('goes to the error state when the game never says ready (20 s)', async () => {
    const { controller, frame } = harness();
    controller.start();
    controller.go();
    await flush();
    controller.attachFrame(frame);
    frame.fireLoad();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'error', error: 'unavailable' });
  });

  it('retries with the same session and a fresh frame, without opening another session', async () => {
    const { controller, frame, client } = harness();
    controller.start();
    controller.go();
    await flush();
    controller.attachFrame(frame);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(controller.getSnapshot().state.phase).toBe('error');
    controller.attachFrame(null);
    const before = controller.getSnapshot().generation;
    controller.retry();
    expect(controller.getSnapshot().generation).toBe(before + 1);
    expect(controller.getSnapshot().state.phase).toBe('loading');
    expect(client.callsOf('createSession')).toHaveLength(1);
    const next = new FakeFrame();
    controller.attachFrame(next);
    expect(next.listenerCount).toBe(1);
  });
});

describe('a race', () => {
  it('moves to racing when the game starts a run', async () => {
    const { race, phase } = harness();
    await race();
    expect(phase()).toBe('racing');
  });

  it('relays the finish to Core as the bare report, and keeps Core\'s answer for the pit stop', async () => {
    const { pitstop, client, controller } = harness();
    await pitstop(sampleResult({ lens: 'drift_patient' }));
    const [sessionId, body] = client.callsOf('postRun')[0]!;
    expect(sessionId).toBe(SESSION_ID);
    expect(body).toEqual(sampleReport({ runKey: RUN_KEY }));
    expect(body).not.toHaveProperty('t');
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'pitstop', run: { runKey: RUN_KEY, ended: true, outcome: { status: 'ready', result: { lens: 'drift_patient' } } } });
  });

  it('shows the pit stop when the replay ends before Core has answered, and fills it in when it does', async () => {
    const { race, game, controller, client } = harness();
    let release: () => void = () => {};
    client.postRun = async () => { await new Promise<void>((resolve) => { release = resolve; }); return { ok: true, value: sampleResult({ lens: 'swingy' }) } as never; };
    await race();
    game.say({ t: 'kr.runFinished', v: 1, ...sampleReport({ runKey: RUN_KEY }) });
    game.say({ t: 'kr.runEnded', v: 1, runKey: RUN_KEY });
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'pitstop', run: { outcome: { status: 'pending' } } });
    release();
    await flush();
    expect(controller.getSnapshot().state.run?.outcome).toMatchObject({ status: 'ready', result: { lens: 'swingy' } });
  });

  it('retries a dropped report once after a short wait: Core counts a run key once', async () => {
    const { race, game, client, controller } = harness();
    client.runAnswers = [failure({ kind: 'offline' }), { ok: true, value: sampleResult() }];
    await race();
    game.say({ t: 'kr.runFinished', v: 1, ...sampleReport({ runKey: RUN_KEY }) });
    await flush();
    expect(client.callsOf('postRun')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    expect(client.callsOf('postRun')).toHaveLength(2);
    expect(client.callsOf('postRun')[1]![1]).toEqual(client.callsOf('postRun')[0]![1]);
    expect(controller.getSnapshot().state.run?.outcome.status).toBe('ready');
  });

  it.each([[{ kind: 'implausible' } as const, 1], [{ kind: 'malformed' } as const, 1], [{ kind: 'offline' } as const, 2]])('gives up on %j after %i call(s) and still shows the pit stop', async (reason, calls) => {
    const { race, game, client, controller } = harness();
    client.runAnswers = [failure(reason)];
    await race();
    game.say({ t: 'kr.runFinished', v: 1, ...sampleReport({ runKey: RUN_KEY }) });
    await vi.advanceTimersByTimeAsync(500);
    await flush();
    game.say({ t: 'kr.runEnded', v: 1, runKey: RUN_KEY });
    expect(client.callsOf('postRun')).toHaveLength(calls);
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'pitstop', run: { outcome: { status: 'failed' } } });
  });

  it('does not report a practice lap: the game sends no finish, and the pit stop still comes', async () => {
    const { enter, game, client, controller } = harness();
    await enter();
    game.say({ t: 'kr.runStarted', v: 1, runKey: RUN_KEY, mode: 'practice', trackId: 'jungleNeck', character: 'rho' });
    game.say({ t: 'kr.runEnded', v: 1, runKey: RUN_KEY });
    expect(client.callsOf('postRun')).toHaveLength(0);
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'pitstop', run: { outcome: { status: 'none' } } });
  });

  it('drops a message that is not the contract, without a state change', async () => {
    const { race, game, controller, client } = harness();
    await race();
    game.say({ t: 'kr.runFinished', v: 1, ...sampleReport({ runKey: RUN_KEY }), extra: 'x' });
    game.say({ t: 'kr.runFinished', v: 1, ...sampleReport({ runKey: RUN_KEY, finishMs: 0 }) });
    await flush();
    expect(client.callsOf('postRun')).toHaveLength(0);
    expect(controller.getSnapshot().state.phase).toBe('racing');
  });
});

describe('pause and the pit stop actions', () => {
  it('pauses on the game\'s request, tells the game, and resumes', async () => {
    const { race, game, controller } = harness();
    await race();
    game.say({ t: 'kr.pauseRequested', v: 1 });
    expect(controller.getSnapshot().state.phase).toBe('paused');
    expect(game.ofType('lf.pause')).toHaveLength(1);
    controller.resume();
    expect(controller.getSnapshot().state.phase).toBe('racing');
    expect(game.ofType('lf.resume')).toHaveLength(1);
  });

  it('pauses from the host (Escape outside the frame) only while racing', async () => {
    const { enter, controller, game } = harness();
    await enter();
    controller.pause();
    expect(game.ofType('lf.pause')).toHaveLength(0);
    game.say({ t: 'kr.runStarted', v: 1, runKey: RUN_KEY, mode: 'single', trackId: 'jungleNeck', character: 'rho' });
    controller.pause();
    expect(controller.getSnapshot().state.phase).toBe('paused');
    expect(game.ofType('lf.pause')).toHaveLength(1);
  });

  it('restarts with lf.start and the same selection', async () => {
    const { race, game, controller } = harness();
    await race();
    controller.select({ circuit: 'glacier' });
    game.say({ t: 'kr.pauseRequested', v: 1 });
    controller.restart();
    expect(controller.getSnapshot().state.phase).toBe('racing');
    expect(game.ofType('lf.start')).toEqual([{ t: 'lf.start', v: 1, start: { mode: 'single', trackId: 'glacier', character: 'rho', speedClass: '100cc' } }]);
  });

  it('races again with lf.start, and changes kart through the Garage without a new session', async () => {
    const { pitstop, controller, game, client } = harness();
    await pitstop();
    controller.raceAgain();
    expect(controller.getSnapshot().state.phase).toBe('racing');
    expect(game.ofType('lf.start')).toHaveLength(1);
    game.say({ t: 'kr.runEnded', v: 1, runKey: RUN_KEY });
    expect(controller.getSnapshot().state.phase).toBe('racing');
    game.say({ t: 'kr.runStarted', v: 1, runKey: 'run-key-0002', mode: 'single', trackId: 'jungleNeck', character: 'rho' });
    game.say({ t: 'kr.runEnded', v: 1, runKey: 'run-key-0002' });
    expect(controller.getSnapshot().state.phase).toBe('pitstop');
    controller.changeKart();
    controller.select({ circuit: 'factory', driver: 'liruf' });
    controller.go();
    expect(controller.getSnapshot().state.phase).toBe('racing');
    expect(game.ofType('lf.start').at(-1)).toEqual({ t: 'lf.start', v: 1, start: { mode: 'single', trackId: 'factory', character: 'liruf', speedClass: '100cc' } });
    expect(client.callsOf('createSession')).toHaveLength(1);
  });

  it('mutes through lf.mute and remembers the choice', async () => {
    const { enter, controller, game, storage } = harness();
    await enter();
    controller.setMuted(true);
    expect(game.ofType('lf.mute')).toEqual([{ t: 'lf.mute', v: 1, muted: true }]);
    expect(JSON.parse(storage.data.get(GARAGE_STORAGE_KEY)!).muted).toBe(true);
  });
});

describe('the pit-stop reflection and the AI line', () => {
  it('posts a reply to Core once, with the run id Core gave', async () => {
    const { pitstop, controller, client } = harness();
    await pitstop();
    controller.reflect('b');
    controller.reflect('a');
    expect(client.callsOf('reflect')).toEqual([[SESSION_ID, RUN_ID, 'b']]);
    expect(controller.getSnapshot().state.run?.reply).toBe('b');
  });

  it('does not ask for a generated line when Core says none is available', async () => {
    const { pitstop, client } = harness();
    await pitstop(sampleResult({ aiAvailable: false }));
    await flush();
    expect(client.callsOf('debrief')).toHaveLength(0);
  });

  it('asks once and swaps the line when it arrives inside 6 seconds', async () => {
    const h = harness();
    h.client.debriefAnswer = { ok: true, value: { source: 'ai', text: 'You waited for the big boost.' } };
    h.client.debriefDelayMs = 2000;
    await h.pitstop(sampleResult({ aiAvailable: true }));
    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(h.client.callsOf('debrief')).toEqual([[SESSION_ID, RUN_ID]]);
    expect(h.controller.getSnapshot().state.run?.aiText).toBe('You waited for the big boost.');
  });

  it('keeps the authored line when the generated one is late, authored, or the learner already answered', async () => {
    const late = harness();
    late.client.debriefAnswer = { ok: true, value: { source: 'ai', text: 'Too late.' } };
    late.client.debriefDelayMs = 7000;
    await late.pitstop(sampleResult({ aiAvailable: true }));
    await vi.advanceTimersByTimeAsync(8000);
    await flush();
    expect(late.controller.getSnapshot().state.run?.aiText).toBeNull();

    const authored = harness();
    await authored.pitstop(sampleResult({ aiAvailable: true }));
    await flush();
    expect(authored.controller.getSnapshot().state.run?.aiText).toBeNull();

    const answered = harness();
    answered.client.debriefAnswer = { ok: true, value: { source: 'ai', text: 'After the reply.' } };
    answered.client.debriefDelayMs = 1000;
    await answered.pitstop(sampleResult({ aiAvailable: true }));
    answered.controller.reflect('a');
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(answered.controller.getSnapshot().state.run?.aiText).toBeNull();
  });

  it('never shows a generated line from an earlier race on the next one', async () => {
    const h = harness();
    h.client.debriefAnswer = { ok: true, value: { source: 'ai', text: 'Old line.' } };
    h.client.debriefDelayMs = 3000;
    await h.pitstop(sampleResult({ aiAvailable: true }));
    h.controller.raceAgain();
    h.game.say({ t: 'kr.runStarted', v: 1, runKey: 'run-key-0002', mode: 'single', trackId: 'jungleNeck', character: 'rho' });
    await vi.advanceTimersByTimeAsync(3000);
    await flush();
    expect(h.controller.getSnapshot().state.run?.aiText).toBeNull();
  });
});

describe('saves', () => {
  it('relays kr.save with the revision Core holds, and moves on to the revision Core returns', async () => {
    const { enter, game, client } = harness();
    await enter();
    game.say({ t: 'kr.save', v: 1, revision: 4, data: { hints: 2 } });
    await flush();
    game.say({ t: 'kr.save', v: 1, revision: 5, data: { hints: 3 } });
    await flush();
    expect(client.callsOf('putSave')).toEqual([
      [SESSION_ID, { revision: 3, data: { hints: 2 } }],
      [SESSION_ID, { revision: 4, data: { hints: 3 } }],
    ]);
  });

  it('ignores the games own revision counter: the revision sent is the one Core last returned', async () => {
    const { enter, game, client } = harness();
    await enter();
    game.say({ t: 'kr.save', v: 1, revision: 999, data: { n: 1 } });
    await flush();
    game.say({ t: 'kr.save', v: 1, revision: 0, data: { n: 2 } });
    await flush();
    // The session said revision 3; Core answered 4 to the first PUT. The game's 999 and 0 are never sent.
    expect(client.callsOf('putSave').map(([, body]) => (body as { revision: number }).revision)).toEqual([3, 4]);
  });

  it('retries once on SAVE_CONFLICT with the revision Core returned', async () => {
    const { enter, game, client } = harness();
    client.putSaveAnswers = [failure({ kind: 'conflict', revision: 9 }), { ok: true, value: 10 }];
    await enter();
    game.say({ t: 'kr.save', v: 1, revision: 4, data: { hints: 2 } });
    await flush();
    game.say({ t: 'kr.save', v: 1, revision: 5, data: { hints: 3 } });
    await flush();
    expect(client.callsOf('putSave').map(([, body]) => (body as { revision: number }).revision)).toEqual([3, 9, 10]);
  });

  it('gives up after a second conflict, keeps the revision Core returned, and does not loop', async () => {
    const { enter, game, client } = harness();
    client.putSaveAnswers = [failure({ kind: 'conflict', revision: 9 }), failure({ kind: 'conflict', revision: 12 })];
    await enter();
    game.say({ t: 'kr.save', v: 1, revision: 4, data: { hints: 2 } });
    await flush();
    expect(client.callsOf('putSave')).toHaveLength(2);
    game.say({ t: 'kr.save', v: 1, revision: 5, data: { hints: 3 } });
    await flush();
    expect(client.callsOf('putSave').at(-1)).toEqual([SESSION_ID, { revision: 12, data: { hints: 3 } }]);
  });

  it('does not retry a conflict that names no revision', async () => {
    const { enter, game, client } = harness();
    client.putSaveAnswers = [failure({ kind: 'conflict', revision: null })];
    await enter();
    game.say({ t: 'kr.save', v: 1, revision: 4, data: { a: 1 } });
    await flush();
    expect(client.callsOf('putSave')).toHaveLength(1);
  });

  it('sends one save at a time and keeps only the newest while one is in flight', async () => {
    const { enter, game, client } = harness();
    let release: (value: { ok: true; value: number }) => void = () => {};
    const original = client.putSave.bind(client);
    let first = true;
    client.putSave = async (sessionId: string, body: { revision: number; data: unknown }) => {
      if (first) { first = false; client.calls.push({ method: 'putSave', args: [sessionId, body] }); return new Promise((resolve) => { release = resolve as never; }); }
      return original(sessionId, body);
    };
    await enter();
    game.say({ t: 'kr.save', v: 1, revision: 4, data: { n: 1 } });
    game.say({ t: 'kr.save', v: 1, revision: 5, data: { n: 2 } });
    game.say({ t: 'kr.save', v: 1, revision: 6, data: { n: 3 } });
    await flush();
    expect(client.callsOf('putSave')).toHaveLength(1);
    release({ ok: true, value: 4 });
    await flush();
    expect(client.callsOf('putSave').map(([, body]) => (body as { data: unknown }).data)).toEqual([{ n: 1 }, { n: 3 }]);
  });
});

describe('heartbeats', () => {
  it('beats every 30 seconds with the visible and focused flags, while both are true', async () => {
    const { enter, client } = harness();
    await enter();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(client.callsOf('heartbeat')).toEqual([[SESSION_ID, { visible: true, focused: true }]]);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(client.callsOf('heartbeat')).toHaveLength(3);
  });

  it('sends nothing while the tab is hidden or the game does not hold the keys', async () => {
    const { enter, client, env } = harness();
    await enter();
    env.visible = false;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    env.visible = true;
    env.focused = false;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(client.callsOf('heartbeat')).toHaveLength(0);
    env.focused = true;
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(client.callsOf('heartbeat')).toHaveLength(1);
  });

  it('stops counting on pagehide and closes the session with a request that may outlive the page', async () => {
    const { enter, client } = harness();
    await enter();
    window.dispatchEvent(new Event('pagehide'));
    expect(client.callsOf('end')).toEqual([[SESSION_ID, 'left', { keepalive: true }]]);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(client.callsOf('heartbeat')).toHaveLength(0);
    // Leaving afterwards (the route unmounting) must not close it a second time.
    window.dispatchEvent(new Event('pagehide'));
    expect(client.callsOf('end')).toHaveLength(1);
  });

  it('shows the session as ended when a page cached at pagehide wakes, instead of resuming a closed session', async () => {
    const { enter, controller, client } = harness();
    await enter();
    window.dispatchEvent(new Event('pagehide'));
    const restored = new Event('pageshow') as Event & { persisted: boolean };
    Object.defineProperty(restored, 'persisted', { value: true });
    window.dispatchEvent(restored);
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'closed', closed: 'ended' });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(client.callsOf('heartbeat')).toHaveLength(0);
  });

  it('does nothing on pagehide when no session was opened', () => {
    const { controller, client } = harness();
    controller.start();
    window.dispatchEvent(new Event('pagehide'));
    expect(client.callsOf('end')).toHaveLength(0);
  });

  it('holds the soft break until the pit stop and then offers it, never mid race', async () => {
    const { race, client, controller, game, enter } = harness();
    void enter;
    await race();
    client.heartbeatAnswer = { ok: true, value: { activeSeconds: 900, state: 'soft' } };
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'racing', softDue: true });
    game.say({ t: 'kr.runEnded', v: 1, runKey: RUN_KEY });
    expect(controller.getSnapshot().state.phase).toBe('pitstop');
    controller.raceAgain();
    expect(controller.getSnapshot().state.phase).toBe('soft');
    expect(game.ofType('lf.start')).toHaveLength(0);
    controller.softContinue();
    expect(controller.getSnapshot().state.phase).toBe('racing');
    expect(game.ofType('lf.start')).toHaveLength(1);
  });

  it('ends the visit when Core says hard or idle: the game is told, the session closed, the card shown', async () => {
    for (const state of ['hard', 'idle'] as const) {
      const { race, client, controller, game } = harness();
      await race();
      client.heartbeatAnswer = { ok: true, value: { activeSeconds: 1500, state } };
      await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
      expect(controller.getSnapshot().state).toMatchObject({ phase: 'closed', closed: 'ended' });
      expect(game.ofType('lf.end')).toHaveLength(1);
      expect(client.callsOf('end')).toEqual([[SESSION_ID, state]]);
      await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
      expect(client.callsOf('heartbeat')).toHaveLength(1);
    }
  });

  it('closes the visit when Core says the session is closed or expired', async () => {
    const { race, client, controller } = harness();
    await race();
    client.heartbeatAnswer = failure({ kind: 'expired' });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'closed', closed: 'ended' });
  });

  it('keeps a race running through one failed heartbeat, and shows the error after three in a row', async () => {
    const { race, client, controller } = harness();
    await race();
    client.heartbeatAnswer = failure({ kind: 'offline' });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(controller.getSnapshot().state.phase).toBe('racing');
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'error', error: 'offline' });
  });

  it('treats a malformed heartbeat as a failure, never as a healthy one', async () => {
    const { race, client, controller } = harness();
    await race();
    client.heartbeatAnswer = failure({ kind: 'malformed' });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'error', error: 'unavailable' });
  });
});

describe('leaving', () => {
  it('tells the game, closes the session with the reason and calls the exit', async () => {
    const { race, controller, game, client, exits } = harness();
    await race();
    controller.leave();
    expect(game.ofType('lf.end')).toHaveLength(1);
    expect(client.callsOf('end')).toEqual([[SESSION_ID, 'left']]);
    expect(exits).toHaveLength(1);
  });

  it('ends a soft stop with the reason soft', async () => {
    const { race, controller, client } = harness();
    await race();
    controller.softStop();
    expect(client.callsOf('end')).toEqual([[SESSION_ID, 'soft']]);
  });

  it('leaves when the game asks to exit', async () => {
    const { race, game, client, exits } = harness();
    await race();
    game.say({ t: 'kr.exitRequested', v: 1 });
    expect(client.callsOf('end')).toEqual([[SESSION_ID, 'left']]);
    expect(exits).toHaveLength(1);
  });

  it('closes the session once, even if the learner leaves after a closed card', async () => {
    const { race, client, controller, exits } = harness();
    await race();
    client.heartbeatAnswer = { ok: true, value: { activeSeconds: 1500, state: 'hard' } };
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    controller.leave();
    expect(client.callsOf('end')).toHaveLength(1);
    expect(exits).toHaveLength(1);
  });

  it('closes an open session when the route unmounts, and stops asking Core anything', async () => {
    const { race, controller, client, game } = harness();
    await race();
    controller.stop();
    expect(client.callsOf('end')).toEqual([[SESSION_ID, 'left']]);
    expect(game.ofType('lf.end')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);
    expect(client.callsOf('heartbeat')).toHaveLength(0);
  });

  it('leaves quietly, with no call to Core, when no session was ever opened', () => {
    const { controller, client, exits } = harness();
    controller.start();
    controller.leave();
    expect(client.callsOf('end')).toHaveLength(0);
    expect(exits).toHaveLength(1);
  });

  it('shows the error card for a game error, naming WebGL when that is the cause', async () => {
    const { race, game, controller } = harness();
    await race();
    game.say({ t: 'kr.error', v: 1, code: 'webgl' });
    expect(controller.getSnapshot().state).toMatchObject({ phase: 'error', error: 'webgl' });
    const other = harness();
    await other.race();
    other.game.say({ t: 'kr.error', v: 1, code: 'boot' });
    expect(other.controller.getSnapshot().state).toMatchObject({ phase: 'error', error: 'unavailable' });
  });
});
