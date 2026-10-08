import type { GameFailure, GameResult, GamesClient, GamesList, GameSession, Heartbeat, RunResult } from '../api';
import type { BridgeChannel, FrameLike, PortLike } from '../bridge';
import type { GameMessage, HostMessage, RunReport } from '../protocol';

/*
 * Test doubles for the KartRush host: a pair of linked ports, a frame that
 * records the hello, a fake game that answers on its end of the port, and a
 * scripted Core client. Delivery is synchronous and goes through
 * `structuredClone`, as a real MessagePort would copy the message, so a test
 * cannot pass by mutating an object both ends share.
 */

export class FakePort implements PortLike {
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  peer: FakePort | null = null;
  closed = false;
  readonly sent: unknown[] = [];
  postMessage(message: unknown): void {
    if (this.closed) return;
    const copy = structuredClone(message);
    this.sent.push(copy);
    this.peer?.onmessage?.({ data: copy });
  }
  start(): void { /* a real port starts delivering here; this one always does */ }
  close(): void { this.closed = true; }
}

export function fakeChannel(): BridgeChannel & { port1: FakePort; port2: FakePort } {
  const port1 = new FakePort();
  const port2 = new FakePort();
  port1.peer = port2;
  port2.peer = port1;
  return { port1, port2 };
}

export interface HelloRecord { message: unknown; origin: string; port: FakePort | null }

export class FakeFrame implements FrameLike {
  private readonly loadListeners = new Set<() => void>();
  readonly hellos: HelloRecord[] = [];
  contentWindow: FrameLike['contentWindow'];
  constructor(hasWindow = true) {
    this.contentWindow = hasWindow ? {
      postMessage: (message: unknown, origin: string, transfer: Transferable[]) => {
        this.hellos.push({ message, origin, port: (transfer[0] as unknown as FakePort | undefined) ?? null });
      },
    } : null;
  }
  addEventListener(_type: 'load', listener: () => void): void { this.loadListeners.add(listener); }
  removeEventListener(_type: 'load', listener: () => void): void { this.loadListeners.delete(listener); }
  get listenerCount(): number { return this.loadListeners.size; }
  fireLoad(): void { for (const listener of [...this.loadListeners]) listener(); }
}

/** The game's end of the port: what it received from the host, and a way to speak as the game. */
export class FakeGame {
  readonly received: HostMessage[] = [];
  constructor(readonly port: FakePort) {
    port.onmessage = (event) => { this.received.push(event.data as HostMessage); };
  }
  say(message: GameMessage | Record<string, unknown>): void { this.port.postMessage(message); }
  ofType<T extends HostMessage['t']>(type: T): Extract<HostMessage, { t: T }>[] {
    return this.received.filter((message): message is Extract<HostMessage, { t: T }> => message.t === type);
  }
}

export const SESSION_ID = '11111111-2222-4333-8444-555555555555';
export const RUN_ID = '66666666-7777-4888-8999-000000000000';

export function sampleSession(patch: Partial<GameSession> = {}): GameSession {
  return {
    sessionId: SESSION_ID, sessionRef: 'ref_abcdefgh12', game: { href: 'http://localhost:4010/?embed=1', origin: 'http://localhost:4010', build: 'b1' },
    mentor: 'zara', band: '6-9', caps: { softMs: 900_000, hardMs: 1_500_000, idleMs: 600_000 },
    save: { revision: 3, data: { hints: 1 } }, bests: [], sessionsRemainingToday: 1, ...patch,
  };
}

export function sampleReport(patch: Partial<RunReport> = {}): RunReport {
  return {
    runKey: 'run-key-0001', mode: 'single', trackId: 'jungleNeck', character: 'rho', kartBody: 'balanced', speedClass: '100cc', finished: true,
    finishMs: 130_000, bestLapMs: 42_000, lapMs: [44_000, 42_000, 44_000], rank: 2,
    lens: { itemHoldMs: 4000, boxesPassedWhileHolding: 0, itemsUsed: 2, driftReleases: { t0: 0, t1: 2, t2: 1, t3: 0 }, recoveries: 0 },
    ...patch,
  };
}

export function sampleResult(patch: Partial<RunResult> = {}): RunResult {
  return { runId: RUN_ID, lens: 'steady', newBest: false, bests: [], aiAvailable: false, ...patch };
}

type Call = { method: string; args: unknown[] };

/** A scripted Core: every endpoint answers from a setter, and every call is recorded. */
export class FakeClient implements GamesClient {
  readonly calls: Call[] = [];
  listAnswer: GameResult<GamesList> = { ok: true, value: { games: [{ gameId: 'kartrush', status: 'live', sessionsRemainingToday: 2, enabled: true }] } };
  sessionAnswer: GameResult<GameSession> = { ok: true, value: sampleSession() };
  heartbeatAnswer: GameResult<Heartbeat> = { ok: true, value: { activeSeconds: 30, state: 'ok' } };
  runAnswers: GameResult<RunResult>[] = [{ ok: true, value: sampleResult() }];
  putSaveAnswers: GameResult<number>[] = [];
  debriefAnswer: GameResult<{ source: 'authored' } | { source: 'ai'; text: string }> = { ok: true, value: { source: 'authored' } };
  debriefDelayMs = 0;

  private record(method: string, ...args: unknown[]): void { this.calls.push({ method, args }); }
  callsOf(method: string): unknown[][] { return this.calls.filter((call) => call.method === method).map((call) => call.args); }

  async list() { this.record('list'); return this.listAnswer; }
  async createSession() { this.record('createSession'); return this.sessionAnswer; }
  async heartbeat(sessionId: string, flags: { visible: boolean; focused: boolean }) { this.record('heartbeat', sessionId, flags); return this.heartbeatAnswer; }
  async postRun(sessionId: string, report: RunReport) {
    this.record('postRun', sessionId, report);
    return this.runAnswers.length > 1 ? this.runAnswers.shift()! : this.runAnswers[0]!;
  }
  async reflect(sessionId: string, runId: string, reply: string) { this.record('reflect', sessionId, runId, reply); return { ok: true, value: true } as const; }
  async debrief(sessionId: string, runId: string) {
    this.record('debrief', sessionId, runId);
    if (this.debriefDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.debriefDelayMs));
    return this.debriefAnswer;
  }
  async putSave(sessionId: string, body: { revision: number; data: unknown }) {
    this.record('putSave', sessionId, body);
    return this.putSaveAnswers.length > 0 ? this.putSaveAnswers.shift()! : { ok: true, value: body.revision + 1 } as GameResult<number>;
  }
  async end(sessionId: string, reason: string, options?: { keepalive?: boolean }) {
    this.record('end', ...(options?.keepalive ? [sessionId, reason, options] : [sessionId, reason]));
    return { ok: true, value: true } as const;
  }
}

export const failure = (value: GameFailure): { ok: false; failure: GameFailure } => ({ ok: false, failure: value });
