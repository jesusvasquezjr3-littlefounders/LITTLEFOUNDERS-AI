import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeChannel, FakeFrame, FakeGame, sampleReport } from './__fixtures__/fakes';
import { GameBridge, HANDSHAKE_TIMEOUT_MS, type BridgeChannel, type GameBridgeOptions } from './bridge';
import type { GameMessage } from './protocol';

/*
 * The handshake of contract §2, driven with a fake frame and a linked pair of
 * ports: wait for `load`, post one hello with the transferred port to the game's
 * origin, require `kr.ready`, time out after 20 seconds, and drop (never coerce)
 * anything that is not the closed vocabulary.
 */

const ORIGIN = 'http://localhost:4010';

function setup(patch: Partial<GameBridgeOptions> = {}) {
  const frame = new FakeFrame();
  const channel = fakeChannel();
  const events = { ready: [] as string[], messages: [] as GameMessage[], failures: [] as string[], drops: [] as string[] };
  const bridge = new GameBridge({
    frame, gameOrigin: ORIGIN, createChannel: () => channel as BridgeChannel,
    onReady: (build) => events.ready.push(build), onMessage: (message) => events.messages.push(message),
    onFailure: (reason) => events.failures.push(reason), onDrop: (reason) => events.drops.push(reason), ...patch,
  });
  return { frame, channel, events, bridge, game: new FakeGame(channel.port2) };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the handshake', () => {
  it('posts nothing until the frame has loaded, then exactly one hello with one transferred port to the game origin', () => {
    const { frame, bridge, channel } = setup();
    bridge.connect();
    expect(frame.hellos).toEqual([]);
    expect(bridge.state).toBe('waiting-load');
    frame.fireLoad();
    expect(frame.hellos).toHaveLength(1);
    expect(frame.hellos[0]).toMatchObject({ message: { t: 'lf.hello', v: 1 }, origin: ORIGIN });
    expect(frame.hellos[0]!.port).toBe(channel.port2);
    expect(bridge.state).toBe('waiting-ready');
  });

  it('does not post a second hello when the frame loads again', () => {
    const { frame, bridge } = setup();
    bridge.connect();
    frame.fireLoad();
    frame.fireLoad();
    expect(frame.hellos).toHaveLength(1);
  });

  it('is ready only when the game says kr.ready, and reports its build', () => {
    const { frame, bridge, game, events } = setup();
    bridge.connect();
    frame.fireLoad();
    game.say({ t: 'kr.ready', v: 1, build: 'abc123' });
    expect(events.ready).toEqual(['abc123']);
    expect(bridge.state).toBe('ready');
  });

  it('drops everything else before kr.ready, valid or not', () => {
    const { frame, bridge, game, events } = setup();
    bridge.connect();
    frame.fireLoad();
    game.say({ t: 'kr.pauseRequested', v: 1 });
    game.say({ t: 'kr.runStarted', v: 1, runKey: 'run-key-0001', mode: 'single', trackId: 'jungleNeck', character: 'rho' });
    game.say({ t: 'kr.cheat', v: 1 });
    expect(events.messages).toEqual([]);
    expect(events.drops).toHaveLength(3);
    expect(bridge.state).toBe('waiting-ready');
  });

  it('delivers validated messages after ready and refuses a second kr.ready', () => {
    const { frame, bridge, game, events } = setup();
    bridge.connect();
    frame.fireLoad();
    game.say({ t: 'kr.ready', v: 1, build: 'abc123' });
    game.say({ t: 'kr.ready', v: 1, build: 'abc123' });
    game.say({ t: 'kr.runFinished', v: 1, ...sampleReport() });
    expect(events.ready).toHaveLength(1);
    expect(events.messages.map((message) => message.t)).toEqual(['kr.runFinished']);
    expect(events.drops).toEqual(['kr.ready twice']);
  });
});

describe('the timeout', () => {
  it('fails after 20 seconds with no ready', () => {
    const { frame, bridge, events } = setup();
    bridge.connect();
    frame.fireLoad();
    vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS - 1);
    expect(events.failures).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events.failures).toEqual(['timeout']);
    expect(bridge.state).toBe('failed');
    expect(frame.listenerCount).toBe(0);
  });

  it('fails when the frame never loads, with the same 20 seconds', () => {
    const { bridge, events } = setup();
    bridge.connect();
    vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS);
    expect(events.failures).toEqual(['timeout']);
  });

  it('does not fail once ready, however long it then takes', () => {
    const { frame, bridge, game, events } = setup();
    bridge.connect();
    frame.fireLoad();
    game.say({ t: 'kr.ready', v: 1, build: 'b' });
    vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS * 3);
    expect(events.failures).toEqual([]);
    expect(bridge.state).toBe('ready');
  });

  it('closes the port when it fails, and ignores a late kr.ready', () => {
    const { frame, bridge, channel, game, events } = setup();
    bridge.connect();
    frame.fireLoad();
    vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS);
    expect(channel.port1.closed).toBe(true);
    game.say({ t: 'kr.ready', v: 1, build: 'late' });
    expect(events.ready).toEqual([]);
  });

  it('fails at once when the frame has no window to post the hello to', () => {
    const frame = new FakeFrame(false);
    const failures: string[] = [];
    const bridge = new GameBridge({ frame, gameOrigin: ORIGIN, createChannel: () => fakeChannel(), onReady: () => {}, onMessage: () => {}, onFailure: (reason) => failures.push(reason) });
    bridge.connect();
    frame.fireLoad();
    expect(failures).toEqual(['hello']);
  });
});

describe('sending', () => {
  function ready() {
    const context = setup();
    context.bridge.connect();
    context.frame.fireLoad();
    context.game.say({ t: 'kr.ready', v: 1, build: 'b' });
    return context;
  }

  it('sends host messages to the game only after ready', () => {
    const { frame, bridge, game } = setup();
    bridge.connect();
    frame.fireLoad();
    expect(bridge.send({ t: 'lf.pause', v: 1 })).toBe(false);
    expect(game.received).toEqual([]);
    game.say({ t: 'kr.ready', v: 1, build: 'b' });
    expect(bridge.send({ t: 'lf.pause', v: 1 })).toBe(true);
    expect(game.received).toEqual([{ t: 'lf.pause', v: 1 }]);
  });

  it('validates what it sends: an invalid host message never reaches the port', () => {
    const { bridge, game, events } = ready();
    const bad = { t: 'lf.init', v: 1, sessionRef: 'short' } as unknown as Parameters<GameBridge['send']>[0];
    expect(bridge.send(bad)).toBe(false);
    expect(game.received).toEqual([]);
    expect(events.drops[0]).toMatch(/lf\.init/);
  });

  it('sends nothing after dispose', () => {
    const { bridge, game } = ready();
    bridge.dispose();
    expect(bridge.send({ t: 'lf.end', v: 1 })).toBe(false);
    expect(game.received).toEqual([]);
    expect(bridge.state).toBe('closed');
  });

  it('delivers nothing after dispose, even if the game keeps talking', () => {
    const { bridge, game, events } = ready();
    bridge.dispose();
    game.say({ t: 'kr.pauseRequested', v: 1 });
    expect(events.messages).toEqual([]);
  });
});
