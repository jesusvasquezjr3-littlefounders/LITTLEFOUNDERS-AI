import { kartrushEnabled, sessionsLeft, type EndReason, type GameFailure, type GameSession, type GamesClient } from './api';
import { GameBridge, type FrameLike, type GameBridgeOptions } from './bridge';
import { initialState, reduce, type ClosedReason, type ErrorReason, type PlayEvent, type PlayState } from './machine';
import {
  reportBody, toGameLocale, type GameMessage, type KrRunFinished, type KrSave, type Mentor, type Reply, type SaveData,
} from './protocol';
import { readGaragePrefs, startSpecOf, writeGaragePrefs, type Selection } from './selection';

/*
 * Everything the host DOES during one KartRush visit: it opens the Core session,
 * hosts the game's handshake, relays the game's saves and run reports to Core,
 * counts active time with heartbeats, and turns Core's verdicts into the pure
 * reducer's events (machine.ts). The DOM, the clock and the network arrive as
 * dependencies, so a test drives the whole visit with a fake port, a fake
 * transport and fake timers.
 *
 * Two rules shape most of the code:
 *
 *  - The game is a sensor, Core is the authority. A run, a save or a heartbeat
 *    is relayed, and what Core answers is what the screens show.
 *  - A failure never strands the learner on an empty frame: every path ends in a
 *    state with words and a way out (the Garage, the error card, the closed card).
 */

export interface PlayEnvironment {
  /** The document is visible (the tab is in front). */
  visible(): boolean;
  /** The game's iframe holds keyboard focus inside a focused window. */
  frameFocused(): boolean;
  reducedMotion(): boolean;
}

export type ExitDestination = 'learn' | 'mentor';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface PlayDeps {
  client: GamesClient;
  locale: 'en-US' | 'es-MX' | 'pt-BR';
  /** The label the game shows on its one Start target (1..24 characters). */
  startLabel: string;
  environment: PlayEnvironment;
  storage: StorageLike | null;
  /** The learner's own Mentor when they have chosen one; the default driver and who speaks. */
  chosenMentor?: Mentor | null;
  /** Called after the visit is torn down, to leave the page (the route navigates): back to Learn, or on to the Mentor. */
  onExit?: (destination: ExitDestination) => void;
  /** Builds the bridge; tests substitute a bridge over a fake channel. */
  createBridge?: (options: GameBridgeOptions) => GameBridge;
  heartbeatMs?: number;
  /** How long a generated pit-stop line may take before the authored one stands. */
  debriefWindowMs?: number;
  /** The wait before the single retry of a run report that did not arrive. */
  runRetryMs?: number;
}

/** What a screen renders: the machine state plus the facts only the controller knows. */
export interface PlaySnapshot {
  state: PlayState;
  /** The address the iframe loads, already checked against the allow-list. Null before a session exists. */
  game: { href: string; origin: string } | null;
  /** Bumps when the iframe must be rebuilt from scratch (a retry), so React remounts it. */
  generation: number;
  /** Sessions Core says are left today (from the list; null when unknown). */
  sessionsLeft: number | null;
}

export const HEARTBEAT_MS = 30_000;
export const DEBRIEF_WINDOW_MS = 6_000;
const RUN_RETRY_MS = 2_500;
/** Heartbeats that failed in a row before the visit says the connection is gone (about 90 s). */
const MAX_FAILED_BEATS = 3;

const closedFor = (failure: GameFailure): ClosedReason | null =>
  failure.kind === 'limit' ? 'limit' : failure.kind === 'disabled' ? 'disabled' : failure.kind === 'closed' || failure.kind === 'expired' ? 'ended' : null;

const errorFor = (failure: GameFailure): ErrorReason => (failure.kind === 'offline' ? 'offline' : 'unavailable');

export class PlayController {
  private state: PlayState;
  private snapshot: PlaySnapshot;
  private readonly listeners = new Set<() => void>();
  private deps: PlayDeps;
  private session: GameSession | null = null;
  private bridge: GameBridge | null = null;
  private frame: FrameLike | null = null;
  private generation = 0;
  private left: number | null = null;
  private active = false;
  private finished = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatBusy = false;
  private failedBeats = 0;
  private saveRevision = 0;
  private pendingSave: SaveData | null = null;
  private saveBusy = false;
  private listRequested = false;
  /** The page was hidden for good and the session closed with it (so a cached page that wakes has nothing to resume). */
  private pageEnded = false;
  /** The learner picked a driver themselves (now or on an earlier visit): their Mentor no longer sets the default. */
  private driverChosen: boolean;

  constructor(deps: PlayDeps) {
    this.deps = deps;
    const prefs = readGaragePrefs(deps.storage, deps.chosenMentor ?? null);
    this.driverChosen = prefs.rememberedDriver;
    this.state = initialState({ selection: prefs.selection, muted: prefs.muted, mentor: deps.chosenMentor ?? null });
    this.snapshot = this.compute();
  }

  /* ------------------------------------------------------------ subscription */

  getSnapshot = (): PlaySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private compute(): PlaySnapshot {
    return {
      state: this.state,
      game: this.session ? { href: this.session.game.href, origin: this.session.game.origin } : null,
      generation: this.generation,
      sessionsLeft: this.left,
    };
  }

  private dispatch(event: PlayEvent): PlayState {
    const next = reduce(this.state, event);
    if (next !== this.state) {
      this.state = next;
      this.snapshot = this.compute();
      for (const listener of [...this.listeners]) listener();
    }
    return this.state;
  }

  private refresh(): void {
    this.snapshot = this.compute();
    for (const listener of [...this.listeners]) listener();
  }

  /** Dependencies that change between renders (the transport after a token refresh, the locale, the chosen Mentor). */
  update(patch: Partial<PlayDeps>): void {
    this.deps = { ...this.deps, ...patch };
    const mentor = patch.chosenMentor;
    if (mentor && !this.session?.mentor) {
      this.dispatch({ type: 'mentor', mentor });
      // The default driver is the learner's Mentor until they pick one themselves (the Mentor can arrive after the Garage opens).
      if (!this.driverChosen && this.state.phase === 'garage') this.dispatch({ type: 'selected', patch: { driver: mentor } });
    }
  }

  /* ------------------------------------------------------------ lifecycle */

  /** Starts the visit: asks Core whether this learner may play today. Idempotent (a development double mount calls it twice). */
  start(): void {
    this.active = true;
    this.finished = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHide);
      window.addEventListener('pageshow', this.onPageShow);
    }
    if (this.listRequested) return;
    this.listRequested = true;
    void this.deps.client.list().then((result) => {
      if (!this.active || !result.ok) return;
      this.left = sessionsLeft(result.value);
      // A list that does not offer the game at all is the same "off" as a guardian's zero.
      if (!kartrushEnabled(result.value)) this.dispatch({ type: 'unavailable', reason: 'disabled' });
      else if (this.left === 0) this.dispatch({ type: 'unavailable', reason: 'limit' });
      this.refresh();
    });
  }

  /** Leaves quietly (the route unmounted): ends the session if one is open. */
  stop(): void {
    this.active = false;
    this.listRequested = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
      window.removeEventListener('pageshow', this.onPageShow);
    }
    this.teardown('left');
  }

  /**
   * The page is going away (a refresh, a closed tab, a navigation to another site): stop counting, and close the session with
   * a request that may outlive the page. Core reuses an open session when the learner comes straight back, so this costs no slot.
   */
  private readonly onPageHide = (): void => {
    this.stopHeartbeat();
    if (this.session && !this.finished) {
      this.teardown('left', true);
      this.pageEnded = true;
    }
  };
  private readonly onPageShow = (event: Event): void => {
    // A page restored from the back/forward cache wakes with its session closed and its timers cleared: say so, with the way out.
    if ((event as PageTransitionEvent).persisted && this.pageEnded) {
      this.pageEnded = false;
      this.dispatch({ type: 'sessionEnded', reason: 'ended' });
    }
  };

  /* ------------------------------------------------------------ the Garage */

  select(patch: Partial<Selection>): void {
    if (patch.driver) this.driverChosen = true;
    const next = this.dispatch({ type: 'selected', patch });
    writeGaragePrefs(this.deps.storage, { selection: next.selection, muted: next.muted }, this.driverChosen);
  }

  setMuted(muted: boolean): void {
    const next = this.dispatch({ type: 'muted', muted });
    writeGaragePrefs(this.deps.storage, { selection: next.selection, muted: next.muted }, this.driverChosen);
    this.bridge?.send({ t: 'lf.mute', v: 1, muted });
  }

  /** The Go press. A new visit opens a Core session; a visit already in progress (change kart) just starts the next race. */
  go(): void {
    if (this.state.phase !== 'garage') return;
    if (this.session) {
      const next = this.dispatch({ type: 'goAgain' });
      if (next.phase === 'racing') this.startRace();
      return;
    }
    this.dispatch({ type: 'go' });
    void this.openSession();
  }

  private async openSession(): Promise<void> {
    const result = await this.deps.client.createSession();
    if (!this.active || this.finished) {
      // The learner left while Core was opening the session: it exists now, so close it instead of leaving it to expire.
      if (result.ok) void this.deps.client.end(result.value.sessionId, 'left');
      return;
    }
    if (!result.ok) {
      const closed = closedFor(result.failure);
      this.dispatch(closed
        ? { type: 'sessionFailed', kind: 'closed', reason: closed }
        : { type: 'sessionFailed', kind: 'error', reason: errorFor(result.failure) });
      return;
    }
    this.session = result.value;
    this.saveRevision = result.value.save.revision;
    this.failedBeats = 0;
    this.dispatch({ type: 'sessionOpened', mentor: result.value.mentor });
    this.startHeartbeat();
    this.refresh();
  }

  /* ------------------------------------------------------------ the frame and the bridge */

  /** The iframe's ref callback: builds the bridge when a frame arrives and drops it when the frame goes. */
  attachFrame(frame: FrameLike | null): void {
    if (frame === this.frame) return;
    this.bridge?.dispose();
    this.bridge = null;
    this.frame = frame;
    if (!frame || !this.session || this.finished) return;
    const options: GameBridgeOptions = {
      frame, gameOrigin: this.session.game.origin,
      onReady: () => this.onReady(),
      onMessage: (message) => this.onGameMessage(message),
      onFailure: () => this.onBridgeFailure(),
    };
    this.bridge = this.deps.createBridge ? this.deps.createBridge(options) : new GameBridge(options);
    this.bridge.connect();
  }

  private onReady(): void {
    const session = this.session;
    if (!session) return;
    this.dispatch({ type: 'gameReady' });
    this.bridge?.send({
      t: 'lf.init', v: 1, sessionRef: session.sessionRef, locale: toGameLocale(this.deps.locale),
      mentor: this.state.mentor, muted: this.state.muted, reducedMotion: this.deps.environment.reducedMotion(),
      startLabel: this.deps.startLabel, save: { revision: session.save.revision, data: session.save.data }, start: startSpecOf(this.state.selection),
    });
  }

  private onBridgeFailure(): void {
    this.bridge = null;
    this.dispatch({ type: 'gameError', reason: 'unavailable' });
  }

  private onGameMessage(message: GameMessage): void {
    switch (message.t) {
      case 'kr.runStarted': this.dispatch({ type: 'runStarted', runKey: message.runKey, mode: message.mode }); return;
      case 'kr.runFinished': void this.relayRun(message); return;
      case 'kr.runEnded': this.dispatch({ type: 'runEnded', runKey: message.runKey }); return;
      case 'kr.save': this.relaySave(message); return;
      case 'kr.pauseRequested': this.pause(); return;
      case 'kr.exitRequested': this.leave(); return;
      case 'kr.error': this.dispatch({ type: 'gameError', reason: message.code === 'webgl' ? 'webgl' : 'unavailable' }); return;
      case 'kr.ready': return;
    }
  }

  private send(message: Parameters<GameBridge['send']>[0]): void {
    this.bridge?.send(message);
  }

  private startRace(): void {
    this.send({ t: 'lf.start', v: 1, start: startSpecOf(this.state.selection) });
  }

  /* ------------------------------------------------------------ pause, restart, race again */

  /** Pause is the game's own request, or the host's Escape while the game does not hold the keys. */
  pause(): void {
    if (this.state.phase !== 'racing') return;
    this.dispatch({ type: 'pauseRequested' });
    this.send({ t: 'lf.pause', v: 1 });
  }

  resume(): void {
    if (this.state.phase !== 'paused') return;
    this.dispatch({ type: 'resumed' });
    this.send({ t: 'lf.resume', v: 1 });
  }

  restart(): void {
    if (this.state.phase !== 'paused') return;
    this.dispatch({ type: 'restarted' });
    this.startRace();
  }

  raceAgain(): void {
    if (this.state.phase !== 'pitstop') return;
    const next = this.dispatch({ type: 'raceAgain' });
    if (next.phase === 'racing') this.startRace();
  }

  changeKart(): void {
    this.dispatch({ type: 'changeKart' });
  }

  /** The soft-break card's "keep playing". */
  softContinue(): void {
    const from = this.state.softReturn;
    const next = this.dispatch({ type: 'softContinue' });
    if (from === 'pitstop' && next.phase === 'racing') this.startRace();
  }

  /** The soft-break card's "take a break": the visit ends for now, by choice. */
  softStop(): void {
    this.leave('soft');
  }

  /** A retry after an error: a session that already exists is reused (it counts against today's sessions), with a fresh frame. */
  retry(): void {
    if (this.state.phase !== 'error') return;
    this.bridge?.dispose();
    this.bridge = null;
    if (this.session) {
      this.generation += 1;
      this.dispatch({ type: 'retry' });
      // The reducer sends a visit without a session back to the Garage; with one it reloads the game.
      this.refresh();
    } else {
      this.dispatch({ type: 'retry' });
    }
  }

  /* ------------------------------------------------------------ the reflection */

  reflect(reply: Reply): void {
    const run = this.state.run;
    if (!run || run.reply !== null || !this.session) return;
    this.dispatch({ type: 'replied', reply });
    if (run.outcome.status === 'ready') {
      // Self-report, ungraded: a reply that does not reach Core is dropped, never shown as an error.
      void this.deps.client.reflect(this.session.sessionId, run.outcome.result.runId, reply);
    }
  }

  /* ------------------------------------------------------------ relays */

  private async relayRun(message: KrRunFinished): Promise<void> {
    const session = this.session;
    if (!session) return;
    const report = reportBody(message);
    this.dispatch({ type: 'runFinished', report });
    let result = await this.deps.client.postRun(session.sessionId, report);
    // A report is idempotent by runKey in Core, so one more try after a dropped request cannot count a race twice.
    if (!result.ok && (result.failure.kind === 'offline' || result.failure.kind === 'error')) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.deps.runRetryMs ?? RUN_RETRY_MS));
      if (this.finished) return;
      result = await this.deps.client.postRun(session.sessionId, report);
    }
    if (this.finished) return;
    if (!result.ok) {
      this.dispatch({ type: 'runOutcome', runKey: report.runKey, outcome: { status: 'failed' } });
      this.onVerdictFailure(result.failure);
      return;
    }
    this.dispatch({ type: 'runOutcome', runKey: report.runKey, outcome: { status: 'ready', result: result.value } });
    if (result.value.aiAvailable) this.requestDebrief(session.sessionId, report.runKey, result.value.runId);
  }

  /** One generated line per race, taken only if it arrives inside the window and the learner has not already answered. */
  private requestDebrief(sessionId: string, runKey: string, runId: string): void {
    let open = true;
    const window = setTimeout(() => { open = false; }, this.deps.debriefWindowMs ?? DEBRIEF_WINDOW_MS);
    void this.deps.client.debrief(sessionId, runId).then((result) => {
      clearTimeout(window);
      if (!open || this.finished || !result.ok || result.value.source !== 'ai') return;
      if (this.state.run?.runKey === runKey) this.dispatch({ type: 'aiText', text: result.value.text });
    });
  }

  /**
   * The game's saves, one in flight at a time (the newest waits). The revision is the one Core last
   * confirmed; a lost compare-and-set retries once with the revision Core returned, then gives up
   * until the next save, so a stale device can never loop.
   */
  private relaySave(message: KrSave): void {
    this.pendingSave = message.data;
    void this.pumpSave();
  }

  private async pumpSave(): Promise<void> {
    const session = this.session;
    if (this.saveBusy || !this.pendingSave || !session || this.finished) return;
    this.saveBusy = true;
    const data = this.pendingSave;
    this.pendingSave = null;
    try {
      let result = await this.deps.client.putSave(session.sessionId, { revision: this.saveRevision, data });
      if (!result.ok && result.failure.kind === 'conflict' && result.failure.revision !== null) {
        this.saveRevision = result.failure.revision;
        result = await this.deps.client.putSave(session.sessionId, { revision: this.saveRevision, data });
      }
      if (result.ok) this.saveRevision = result.value;
      else if (result.failure.kind === 'conflict' && result.failure.revision !== null) this.saveRevision = result.failure.revision;
      else this.onVerdictFailure(result.failure);
    } finally {
      this.saveBusy = false;
    }
    if (this.pendingSave) void this.pumpSave();
  }

  /** A session Core calls closed or expired is over, wherever the answer came from. */
  private onVerdictFailure(failure: GameFailure): void {
    if (failure.kind === 'closed' || failure.kind === 'expired') this.closeVisit('ended', 'hard');
  }

  /* ------------------------------------------------------------ heartbeats */

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => { void this.beat(); }, this.deps.heartbeatMs ?? HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /**
   * Active time counts only while the tab is in front AND the game holds the keys, so a tick with
   * either missing sends nothing (the flags are sent so Core can check them too). Core's verdict
   * (`ok`, `soft`, `hard`, `idle`) is the only thing the visit learns about time.
   */
  async beat(): Promise<void> {
    const session = this.session;
    if (!session || this.finished || this.heartbeatBusy) return;
    const flags = { visible: this.deps.environment.visible(), focused: this.deps.environment.frameFocused() };
    if (!flags.visible || !flags.focused) return;
    this.heartbeatBusy = true;
    try {
      const result = await this.deps.client.heartbeat(session.sessionId, flags);
      if (this.finished) return;
      if (!result.ok) {
        if (result.failure.kind === 'closed' || result.failure.kind === 'expired') return this.closeVisit('ended', 'hard');
        this.failedBeats += 1;
        if (this.failedBeats >= MAX_FAILED_BEATS) {
          this.failedBeats = 0;
          this.dispatch({ type: 'gameError', reason: result.failure.kind === 'offline' ? 'offline' : 'unavailable' });
        }
        return;
      }
      this.failedBeats = 0;
      if (result.value.state === 'hard' || result.value.state === 'idle') return this.closeVisit('ended', result.value.state);
      this.dispatch({ type: 'heartbeat', state: result.value.state });
    } finally {
      this.heartbeatBusy = false;
    }
  }

  /* ------------------------------------------------------------ leaving */

  /** The visit ends: the game is told to free the GPU and audio, the session is closed in Core, and the page may leave. */
  leave(reason: Extract<EndReason, 'left' | 'soft'> = 'left', destination: ExitDestination = 'learn'): void {
    this.teardown(reason);
    this.deps.onExit?.(destination);
  }

  /** The pit stop's "Ask {Mentor}": the visit ends and the Mentor screen opens (no race data is sent along in this release). */
  askMentor(): void {
    this.leave('left', 'mentor');
  }

  /** Core (or the clock) ended the visit: say so on a card; the learner leaves from there. */
  private closeVisit(closed: ClosedReason, reason: EndReason): void {
    this.dispatch({ type: 'sessionEnded', reason: closed });
    this.teardown(reason);
  }

  /** Frees the game and the Core session once; a second call (the learner leaves after a closed card) only navigates. */
  private teardown(reason: EndReason, keepalive = false): void {
    this.stopHeartbeat();
    if (this.bridge) {
      this.bridge.send({ t: 'lf.end', v: 1 });
      this.bridge.dispose();
      this.bridge = null;
    }
    if (this.session && !this.finished) {
      // Best effort: Core also expires a session that never hears from the page again.
      void this.deps.client.end(this.session.sessionId, reason, keepalive ? { keepalive: true } : undefined);
    }
    this.finished = true;
  }
}
