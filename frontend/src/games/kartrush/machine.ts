import type { HeartbeatState, RunResult } from './api';
import type { GameMode, Mentor, Reply, RunReport } from './protocol';
import { DEFAULT_SELECTION, type Selection } from './selection';

/*
 * The host's state machine for one KartRush visit (KRV1-CONTRACT §6), as a pure
 * reducer: no timers, no network, no DOM. The controller (controller.ts) owns
 * every side effect and feeds this its events, so each transition can be
 * asserted without a browser.
 *
 *   garage -> loading -> gate -> racing <-> paused -> pitstop -> garage | racing
 *
 * plus `soft` (a calm break card, never a countdown or timer) and `closed` (the
 * limit was reached or the session ended), and `error` for a game that could not
 * start. The Garage is where the learner begins and where "change kart" returns.
 *
 * NOTHING HERE TICKS A VISIBLE CLOCK. The session's length lives in Core (it
 * counts active time from heartbeats); this state only learns the verdict
 * (`ok`, `soft`, `hard`, `idle`). DP-01 bans visible session timers, so there is
 * no field a screen could render as one.
 */

export type Phase = 'garage' | 'loading' | 'gate' | 'racing' | 'paused' | 'pitstop' | 'soft' | 'closed' | 'error';

/** Why the visit is over. `limit`: today's sessions are used. `ended`: the session ran out or was closed. `disabled`: a guardian turned games off. */
export type ClosedReason = 'limit' | 'ended' | 'disabled';

/** Why the game did not start. `webgl`: the device cannot draw it. `offline`: no connection. `unavailable`: anything else. */
export type ErrorReason = 'webgl' | 'offline' | 'unavailable';

/** Where the soft break card returns to when the learner keeps playing. */
export type SoftReturn = 'gate' | 'paused' | 'pitstop';

/** What Core said about the run. `pending`: asked, not answered. `none`: nothing to record (a practice lap). `failed`: Core would not take it. */
export type RunOutcome = { status: 'pending' } | { status: 'none' } | { status: 'failed' } | { status: 'ready'; result: RunResult };

export interface RunState {
  runKey: string | null;
  mode: GameMode;
  report: RunReport | null;
  outcome: RunOutcome;
  /** The finish replay is over: the pit stop may show. */
  ended: boolean;
  reply: Reply | null;
  /** An AI line that arrived inside the window; replaces the authored observation. */
  aiText: string | null;
}

export interface PlayState {
  phase: Phase;
  selection: Selection;
  muted: boolean;
  /** A Core session exists (the iframe is mounted). The Garage after a race still has one. */
  hasSession: boolean;
  /** The Mentor who speaks: Core's `mentor` for this session, else the learner's chosen one, else rho. */
  mentor: Mentor;
  closed: ClosedReason | null;
  error: ErrorReason | null;
  run: RunState | null;
  /** Core said soft and the learner has not been offered the break yet (one calm card per session). */
  softDue: boolean;
  softOffered: boolean;
  softReturn: SoftReturn | null;
}

export function initialState(init: { selection?: Selection; muted?: boolean; mentor?: Mentor | null } = {}): PlayState {
  return {
    phase: 'garage', selection: init.selection ?? DEFAULT_SELECTION, muted: init.muted ?? false, hasSession: false,
    mentor: init.mentor ?? 'rho', closed: null, error: null, run: null, softDue: false, softOffered: false, softReturn: null,
  };
}

export type PlayEvent =
  | { type: 'selected'; patch: Partial<Selection> }
  | { type: 'muted'; muted: boolean }
  /** The learner's own Mentor became known (Core's preferences, or the session). Only changes who speaks. */
  | { type: 'mentor'; mentor: Mentor }
  /** GET /learn/games said this learner may not play now. */
  | { type: 'unavailable'; reason: ClosedReason }
  | { type: 'go' }
  | { type: 'sessionOpened'; mentor: Mentor | null }
  | { type: 'sessionFailed'; reason: ClosedReason | ErrorReason; kind: 'closed' | 'error' }
  | { type: 'gameReady' }
  | { type: 'gameError'; reason: ErrorReason }
  | { type: 'runStarted'; runKey: string; mode: GameMode }
  | { type: 'runFinished'; report: RunReport }
  | { type: 'runOutcome'; runKey: string; outcome: RunOutcome }
  | { type: 'runEnded'; runKey: string }
  | { type: 'replied'; reply: Reply }
  | { type: 'aiText'; text: string }
  | { type: 'pauseRequested' }
  | { type: 'resumed' }
  | { type: 'restarted' }
  | { type: 'raceAgain' }
  | { type: 'changeKart' }
  | { type: 'goAgain' }
  | { type: 'heartbeat'; state: HeartbeatState }
  | { type: 'softContinue' }
  | { type: 'sessionEnded'; reason: ClosedReason }
  | { type: 'retry' };

const blankRun = (mode: GameMode): RunState => ({
  runKey: null, mode, report: null, outcome: mode === 'practice' ? { status: 'none' } : { status: 'pending' }, ended: false, reply: null, aiText: null,
});

/** True while a race, its replay or the gate can still be interrupted by a verdict that ends the visit. */
const live = (phase: Phase): boolean => phase !== 'garage' && phase !== 'closed' && phase !== 'error';

export function reduce(state: PlayState, event: PlayEvent): PlayState {
  switch (event.type) {
    case 'selected': {
      const selection = { ...state.selection, ...event.patch };
      return (Object.keys(selection) as (keyof Selection)[]).every((key) => selection[key] === state.selection[key]) ? state : { ...state, selection };
    }
    case 'muted': return state.muted === event.muted ? state : { ...state, muted: event.muted };
    case 'mentor': return state.mentor === event.mentor ? state : { ...state, mentor: event.mentor };
    case 'unavailable':
      return state.phase === 'garage' && !state.hasSession ? { ...state, phase: 'closed', closed: event.reason } : state;
    case 'go':
      if (state.phase !== 'garage') return state;
      return { ...state, phase: 'loading', error: null, closed: null };
    case 'sessionOpened':
      return state.phase === 'loading' ? { ...state, hasSession: true, mentor: event.mentor ?? state.mentor } : state;
    case 'sessionFailed':
      if (state.phase !== 'loading') return state;
      return event.kind === 'closed'
        ? { ...state, phase: 'closed', closed: event.reason as ClosedReason }
        : { ...state, phase: 'error', error: event.reason as ErrorReason };
    case 'gameReady':
      return state.phase === 'loading' ? { ...state, phase: 'gate' } : state;
    case 'gameError':
      return live(state.phase) ? { ...state, phase: 'error', error: event.reason } : state;
    case 'runStarted':
      // From the gate (the first race), a restart, "race again" or a mid-race notice: the game says a run began.
      if (state.phase === 'gate' || state.phase === 'racing' || state.phase === 'loading' || state.phase === 'paused' || state.phase === 'pitstop') {
        return { ...state, phase: 'racing', run: { ...blankRun(event.mode), runKey: event.runKey } };
      }
      return state;
    case 'runFinished':
      return state.run && state.run.runKey === event.report.runKey ? { ...state, run: { ...state.run, report: event.report } } : state;
    case 'runOutcome':
      return state.run && state.run.runKey === event.runKey ? { ...state, run: { ...state.run, outcome: event.outcome } } : state;
    case 'runEnded': {
      if (!state.run || state.run.runKey !== event.runKey) return state;
      const run = { ...state.run, ended: true };
      // The pit stop is the next natural break; a soft verdict that arrived mid-race is offered from there.
      return state.phase === 'racing' ? { ...state, phase: 'pitstop', run } : { ...state, run };
    }
    case 'replied': return state.run ? { ...state, run: { ...state.run, reply: event.reply } } : state;
    case 'aiText': return state.run && state.run.reply === null ? { ...state, run: { ...state.run, aiText: event.text } } : state;
    case 'pauseRequested': return state.phase === 'racing' ? { ...state, phase: 'paused' } : state;
    case 'resumed': return state.phase === 'paused' ? { ...state, phase: 'racing' } : state;
    case 'restarted': return state.phase === 'paused' ? { ...state, phase: 'racing', run: blankRun(state.selection.mode) } : state;
    case 'raceAgain': {
      if (state.phase !== 'pitstop') return state;
      if (state.softDue && !state.softOffered) return { ...state, phase: 'soft', softReturn: 'pitstop', softOffered: true, softDue: false };
      return { ...state, phase: 'racing', run: blankRun(state.selection.mode) };
    }
    case 'changeKart': return state.phase === 'pitstop' ? { ...state, phase: 'garage' } : state;
    case 'goAgain':
      if (state.phase !== 'garage' || !state.hasSession) return state;
      return state.softDue && !state.softOffered
        ? { ...state, phase: 'soft', softReturn: 'pitstop', softOffered: true, softDue: false }
        : { ...state, phase: 'racing', run: blankRun(state.selection.mode) };
    case 'heartbeat': {
      if (!live(state.phase)) return state;
      if (event.state === 'ok') return state;
      if (event.state === 'hard' || event.state === 'idle') return { ...state, phase: 'closed', closed: 'ended' };
      if (state.softOffered || state.softDue) return state;
      // A race is never cut for a break: from the gate or the pause menu the card shows now, otherwise at the pit stop.
      if (state.phase === 'gate' || state.phase === 'paused') {
        return { ...state, phase: 'soft', softReturn: state.phase, softOffered: true, softDue: false };
      }
      return { ...state, softDue: true };
    }
    case 'softContinue':
      if (state.phase !== 'soft') return state;
      return state.softReturn === 'pitstop'
        ? { ...state, phase: 'racing', softReturn: null, run: blankRun(state.selection.mode) }
        : { ...state, phase: state.softReturn ?? 'gate', softReturn: null };
    case 'sessionEnded': return { ...state, phase: 'closed', closed: event.reason };
    case 'retry':
      // A session that exists is reused (it already counts against today's sessions): the game reloads. Without one, back to the Garage.
      return state.phase === 'error' ? { ...state, phase: state.hasSession ? 'loading' : 'garage', error: null, run: null } : state;
  }
}
