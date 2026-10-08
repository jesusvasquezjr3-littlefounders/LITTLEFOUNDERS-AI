import { describe, expect, it } from 'vitest';
import { sampleReport, sampleResult } from './__fixtures__/fakes';
import { initialState, reduce, type PlayEvent, type PlayState } from './machine';

/*
 * The state machine of one visit (contract §6) as a table of transitions. The
 * reducer is pure, so each row is one event applied to one state.
 */

const run = (state: PlayState, ...events: PlayEvent[]) => events.reduce(reduce, state);
const KEY = 'run-key-0001';

/** garage -> loading -> gate -> racing, with a session. */
const racing = (): PlayState => run(initialState(),
  { type: 'go' }, { type: 'sessionOpened', mentor: 'zara' }, { type: 'gameReady' }, { type: 'runStarted', runKey: KEY, mode: 'single' });
const pitstop = (): PlayState => run(racing(), { type: 'runFinished', report: sampleReport() }, { type: 'runEnded', runKey: KEY });

describe('the happy path', () => {
  it('walks garage, loading, gate, racing, pitstop and back to racing', () => {
    let state = initialState();
    expect(state.phase).toBe('garage');
    state = run(state, { type: 'go' });
    expect(state.phase).toBe('loading');
    state = run(state, { type: 'sessionOpened', mentor: 'zara' });
    expect(state).toMatchObject({ phase: 'loading', hasSession: true, mentor: 'zara' });
    state = run(state, { type: 'gameReady' });
    expect(state.phase).toBe('gate');
    state = run(state, { type: 'runStarted', runKey: KEY, mode: 'single' });
    expect(state).toMatchObject({ phase: 'racing', run: { runKey: KEY, mode: 'single', ended: false, outcome: { status: 'pending' } } });
    state = run(state, { type: 'runFinished', report: sampleReport() });
    expect(state.run?.report?.finishMs).toBe(130_000);
    expect(state.phase).toBe('racing');
    state = run(state, { type: 'runEnded', runKey: KEY });
    expect(state).toMatchObject({ phase: 'pitstop', run: { ended: true } });
    state = run(state, { type: 'raceAgain' });
    expect(state).toMatchObject({ phase: 'racing', run: { runKey: null, outcome: { status: 'pending' } } });
  });

  it('keeps Core\'s mentor over the default, and the default when Core names none', () => {
    expect(run(initialState({ mentor: 'rho' }), { type: 'go' }, { type: 'sessionOpened', mentor: null }).mentor).toBe('rho');
    expect(run(initialState({ mentor: 'rho' }), { type: 'go' }, { type: 'sessionOpened', mentor: 'liruf' }).mentor).toBe('liruf');
  });

  it('records a practice lap as a run with nothing to record', () => {
    const state = run(initialState(), { type: 'go' }, { type: 'sessionOpened', mentor: null }, { type: 'gameReady' }, { type: 'runStarted', runKey: KEY, mode: 'practice' });
    expect(state.run?.outcome).toEqual({ status: 'none' });
  });

  it('attaches Core\'s answer only to the run it was for', () => {
    const base = racing();
    const outcome = { status: 'ready', result: sampleResult() } as const;
    expect(run(base, { type: 'runOutcome', runKey: KEY, outcome }).run?.outcome).toEqual(outcome);
    expect(run(base, { type: 'runOutcome', runKey: 'another-run-key', outcome }).run?.outcome).toEqual({ status: 'pending' });
    expect(run(base, { type: 'runFinished', report: sampleReport({ runKey: 'another-run-key' }) }).run?.report).toBeNull();
    expect(run(base, { type: 'runEnded', runKey: 'another-run-key' }).phase).toBe('racing');
  });
});

describe('events out of order are ignored, never half-applied', () => {
  it.each<[string, PlayEvent]>([
    ['resume in the garage', { type: 'resumed' }],
    ['pause in the garage', { type: 'pauseRequested' }],
    ['race again in the garage', { type: 'raceAgain' }],
    ['a game-ready in the garage', { type: 'gameReady' }],
    ['a run end in the garage', { type: 'runEnded', runKey: KEY }],
    ['a restart in the garage', { type: 'restarted' }],
    ['a soft continue in the garage', { type: 'softContinue' }],
  ])('%s changes nothing', (_label, event) => {
    const state = initialState();
    expect(reduce(state, event)).toBe(state);
  });

  it('refuses a second Go while loading', () => {
    const state = run(initialState(), { type: 'go' });
    expect(reduce(state, { type: 'go' })).toBe(state);
  });

  it('ignores a pause request at the gate and at the pit stop (only a race pauses)', () => {
    const gate = run(initialState(), { type: 'go' }, { type: 'sessionOpened', mentor: null }, { type: 'gameReady' });
    expect(reduce(gate, { type: 'pauseRequested' })).toBe(gate);
    const stop = pitstop();
    expect(reduce(stop, { type: 'pauseRequested' })).toBe(stop);
  });

  it('does not let a reply or an AI line reach a race that never started', () => {
    const state = initialState();
    expect(reduce(state, { type: 'replied', reply: 'a' })).toBe(state);
    expect(reduce(state, { type: 'aiText', text: 'Hi' })).toBe(state);
  });
});

describe('pause', () => {
  it('pauses a race and resumes it', () => {
    const paused = reduce(racing(), { type: 'pauseRequested' });
    expect(paused.phase).toBe('paused');
    expect(reduce(paused, { type: 'resumed' }).phase).toBe('racing');
  });

  it('restarts the race from the pause menu with a fresh run', () => {
    const state = reduce(reduce(racing(), { type: 'pauseRequested' }), { type: 'restarted' });
    expect(state).toMatchObject({ phase: 'racing', run: { runKey: null } });
  });
});

describe('the pit stop', () => {
  it('takes a reply once it is there, and an AI line only before a reply', () => {
    const asked = pitstop();
    expect(reduce(asked, { type: 'aiText', text: 'You waited.' }).run?.aiText).toBe('You waited.');
    const answered = reduce(asked, { type: 'replied', reply: 'unsure' });
    expect(answered.run?.reply).toBe('unsure');
    expect(reduce(answered, { type: 'aiText', text: 'Too late.' }).run?.aiText).toBeNull();
  });

  it('goes back to the garage to change kart, and starts the next race from there with the session kept', () => {
    const garage = reduce(pitstop(), { type: 'changeKart' });
    expect(garage).toMatchObject({ phase: 'garage', hasSession: true });
    expect(reduce(garage, { type: 'goAgain' }).phase).toBe('racing');
  });

  it('shows the pit stop after a run that Core did not take', () => {
    const state = reduce(pitstop(), { type: 'runOutcome', runKey: KEY, outcome: { status: 'failed' } });
    expect(state).toMatchObject({ phase: 'pitstop', run: { outcome: { status: 'failed' } } });
  });
});

describe('the verdicts Core gives on time', () => {
  it('closes the visit on hard and on idle, from any live phase', () => {
    for (const phase of [racing(), pitstop(), reduce(racing(), { type: 'pauseRequested' })]) {
      for (const state of ['hard', 'idle'] as const) expect(reduce(phase, { type: 'heartbeat', state })).toMatchObject({ phase: 'closed', closed: 'ended' });
    }
  });

  it('does not close a Garage with no session on a late verdict', () => {
    const garage = initialState();
    expect(reduce(garage, { type: 'heartbeat', state: 'hard' })).toBe(garage);
  });

  it('never interrupts a race for the soft break: it waits for the pit stop, then asks on "race again"', () => {
    let state = reduce(racing(), { type: 'heartbeat', state: 'soft' });
    expect(state).toMatchObject({ phase: 'racing', softDue: true, softOffered: false });
    state = run(state, { type: 'runFinished', report: sampleReport() }, { type: 'runEnded', runKey: KEY });
    expect(state.phase).toBe('pitstop');
    state = reduce(state, { type: 'raceAgain' });
    expect(state).toMatchObject({ phase: 'soft', softReturn: 'pitstop', softOffered: true, softDue: false });
    state = reduce(state, { type: 'softContinue' });
    expect(state).toMatchObject({ phase: 'racing', softReturn: null });
  });

  it('shows the soft break at once from the gate or the pause menu, and returns there on continue', () => {
    const gate = run(initialState(), { type: 'go' }, { type: 'sessionOpened', mentor: null }, { type: 'gameReady' });
    const fromGate = reduce(gate, { type: 'heartbeat', state: 'soft' });
    expect(fromGate).toMatchObject({ phase: 'soft', softReturn: 'gate' });
    expect(reduce(fromGate, { type: 'softContinue' }).phase).toBe('gate');
    const paused = reduce(reduce(racing(), { type: 'pauseRequested' }), { type: 'heartbeat', state: 'soft' });
    expect(paused).toMatchObject({ phase: 'soft', softReturn: 'paused' });
    expect(reduce(paused, { type: 'softContinue' }).phase).toBe('paused');
  });

  it('offers the soft break once per visit: a later soft verdict after "keep playing" stays quiet', () => {
    const soft = run(racing(), { type: 'heartbeat', state: 'soft' }, { type: 'runEnded', runKey: KEY }, { type: 'raceAgain' }, { type: 'softContinue' });
    expect(soft.phase).toBe('racing');
    expect(reduce(soft, { type: 'heartbeat', state: 'soft' })).toBe(soft);
  });

  it('keeps ok quiet', () => {
    const state = racing();
    expect(reduce(state, { type: 'heartbeat', state: 'ok' })).toBe(state);
  });

  it('lets a hard stop win over a soft card', () => {
    const soft = run(initialState(), { type: 'go' }, { type: 'sessionOpened', mentor: null }, { type: 'gameReady' }, { type: 'heartbeat', state: 'soft' });
    expect(reduce(soft, { type: 'heartbeat', state: 'hard' })).toMatchObject({ phase: 'closed', closed: 'ended' });
  });
});

describe('closed and error', () => {
  it('closes the Garage when Core says the learner may not play, and not after a visit began', () => {
    expect(reduce(initialState(), { type: 'unavailable', reason: 'limit' })).toMatchObject({ phase: 'closed', closed: 'limit' });
    const live = racing();
    expect(reduce(live, { type: 'unavailable', reason: 'limit' })).toBe(live);
  });

  it('turns a refused session into the closed card, and any other failure into the error card', () => {
    const loading = run(initialState(), { type: 'go' });
    expect(reduce(loading, { type: 'sessionFailed', kind: 'closed', reason: 'limit' })).toMatchObject({ phase: 'closed', closed: 'limit' });
    expect(reduce(loading, { type: 'sessionFailed', kind: 'closed', reason: 'disabled' })).toMatchObject({ phase: 'closed', closed: 'disabled' });
    expect(reduce(loading, { type: 'sessionFailed', kind: 'error', reason: 'offline' })).toMatchObject({ phase: 'error', error: 'offline' });
  });

  it('shows the error card for a game that reports an error, in any live phase', () => {
    expect(reduce(racing(), { type: 'gameError', reason: 'webgl' })).toMatchObject({ phase: 'error', error: 'webgl' });
    const garage = initialState();
    expect(reduce(garage, { type: 'gameError', reason: 'unavailable' })).toBe(garage);
  });

  it('retries into the garage when no session exists, and reloads the game when one does', () => {
    const failedBefore = run(initialState(), { type: 'go' }, { type: 'sessionFailed', kind: 'error', reason: 'offline' });
    expect(reduce(failedBefore, { type: 'retry' })).toMatchObject({ phase: 'garage', error: null });
    const failedAfter = reduce(run(initialState(), { type: 'go' }, { type: 'sessionOpened', mentor: null }), { type: 'gameError', reason: 'unavailable' });
    expect(reduce(failedAfter, { type: 'retry' })).toMatchObject({ phase: 'loading', hasSession: true, error: null });
  });

  it('ends the visit with a reason on sessionEnded', () => {
    expect(reduce(racing(), { type: 'sessionEnded', reason: 'ended' })).toMatchObject({ phase: 'closed', closed: 'ended' });
  });
});

describe('what the state can never hold', () => {
  it('has no field a screen could render as a session timer, a countdown, a rank between people, XP, coins or a streak', () => {
    const keys = JSON.stringify(Object.keys(pitstop())) + JSON.stringify(Object.keys(pitstop().run ?? {}));
    expect(keys).not.toMatch(/timer|countdown|remaining|elapsed|seconds|podium|score|leaderboard|xp|coin|streak|rank|points|lives/i);
  });
});
