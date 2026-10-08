import { z } from 'zod';
import { acceptGameUrl, type AcceptedGameUrl } from './origins';
import {
  isPlainRecord, KR_CHARACTERS, KR_LENSES, KR_SPEED_CLASSES, KR_TRACK_IDS,
  type LensKey, type Mentor, type Reply, type RunReport, type SaveData,
} from './protocol';

/*
 * The client side of Core's `/learn/games` endpoints (KRV1-CONTRACT §3).
 *
 * Core is the authority on everything here: which sessions a learner has left
 * today, how long a session may run, whether a run is plausible, what the pit
 * stop's lens is. The client validates the shape and shows it; it never derives
 * a limit, a lens or a best itself. EVERY response is parsed: a malformed answer
 * is a `malformed` failure the screen says out loud, never a half-read object
 * and never a zero standing in for a number that did not arrive (a session with
 * `softMs` defaulted to 0 would end the learner's play at once).
 *
 * Transport is injected (`useLearnTransport` in the app, a fake in tests), so
 * this module imports nothing from the legacy app (Bible 02 rule 23).
 */

export const GAME_ID = 'kartrush';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const count = z.number().int().nonnegative();
const mentor = z.enum(KR_CHARACTERS);
const trackId = z.enum(KR_TRACK_IDS);
const speedClass = z.enum(KR_SPEED_CLASSES);
const band = z.enum(['6-9', '10-12', '13-17', 'adult']);
const saveData = z.custom<SaveData>((value) => isPlainRecord(value));

const bestRow = z.object({ trackId, character: mentor, speedClass, bestFinishMs: count, bestLapMs: count, runs: count });
export type BestRow = z.infer<typeof bestRow>;

const saveSnapshot = z.object({ revision: count, data: saveData.nullable() });

export const gamesListSchema = z.object({
  games: z.array(z.object({
    gameId: z.string().min(1), status: z.literal('live'), sessionsRemainingToday: count, enabled: z.boolean(),
  })),
});
export type GamesList = z.infer<typeof gamesListSchema>;

const sessionStartSchema = z.object({
  sessionId: uuid,
  sessionRef: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  game: z.object({ url: z.string().min(1), build: z.string().min(1).max(40) }),
  mentor: mentor.nullable(),
  band,
  caps: z.object({ softMs: z.number().int().positive(), hardMs: z.number().int().positive(), idleMs: z.number().int().positive() }),
  save: saveSnapshot,
  bests: z.array(bestRow),
  sessionsRemainingToday: count,
});

export interface GameSession {
  sessionId: string;
  sessionRef: string;
  /** Validated against the allow-list: this is the only address an iframe may load. */
  game: AcceptedGameUrl & { build: string };
  mentor: Mentor | null;
  band: z.infer<typeof band>;
  caps: { softMs: number; hardMs: number; idleMs: number };
  save: { revision: number; data: SaveData | null };
  bests: BestRow[];
  sessionsRemainingToday: number;
}

const heartbeatSchema = z.object({ activeSeconds: count, state: z.enum(['ok', 'soft', 'hard', 'idle']) });
export type HeartbeatState = z.infer<typeof heartbeatSchema>['state'];
export type Heartbeat = z.infer<typeof heartbeatSchema>;

const runResultSchema = z.object({ runId: uuid, lens: z.enum(KR_LENSES), newBest: z.boolean(), bests: z.array(bestRow), aiAvailable: z.boolean() });
export interface RunResult { runId: string; lens: LensKey; newBest: boolean; bests: BestRow[]; aiAvailable: boolean }

const debriefSchema = z.object({ source: z.enum(['authored', 'ai']), text: z.string().nullable() });
const okSchema = z.object({ ok: z.literal(true) });
const saveRevisionSchema = z.object({ revision: count });

export type EndReason = 'left' | 'soft' | 'hard' | 'idle';

/** Why a call did not give the learner what they asked for, as the screens tell the cases apart. */
export type GameFailure =
  | { kind: 'offline' }
  /** Not signed in, no age screen, a suspended account: nothing a retry changes. */
  | { kind: 'refused'; code: string }
  /** A guardian set the learner's sessions per day to 0 (GAME_DISABLED). */
  | { kind: 'disabled' }
  /** Today's sessions are used (GAME_DAILY_LIMIT). `resetsAt` is Core's ISO instant, when it sent one. */
  | { kind: 'limit'; resetsAt: string | null }
  | { kind: 'closed' }
  | { kind: 'expired' }
  | { kind: 'unknownGame' }
  /** Compare-and-set lost: `revision` is the one Core holds now. */
  | { kind: 'conflict'; revision: number | null }
  | { kind: 'implausible' }
  /** The answer did not match the contract. Shown as an error, never defaulted. */
  | { kind: 'malformed' }
  /** Core named a game address that is not on the allow-list. Never loaded. */
  | { kind: 'untrustedUrl' }
  | { kind: 'error'; code: string };

export type GameResult<T> = { ok: true; value: T } | { ok: false; failure: GameFailure };

export interface GamesTransport {
  (path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; keepalive?: boolean }): Promise<{ data: unknown; error: { code: string } | null }>;
}

const REFUSED = new Set(['UNAUTHORIZED', 'FORBIDDEN', 'AGE_SCREEN_REQUIRED', 'ACCOUNT_SUSPENDED']);

function field(error: object, key: string): unknown {
  return (error as Record<string, unknown>)[key];
}

/** The revision Core returned with a SAVE_CONFLICT: on the error itself, or in its `data` (the contract writes `data: { revision }`). */
function conflictRevision(error: object): number | null {
  const inner = field(error, 'data');
  const candidate = isPlainRecord(inner) ? inner.revision : field(error, 'revision');
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null;
}

export function failureOfError(error: { code: string }): GameFailure {
  const { code } = error;
  if (code === 'NETWORK' || code === 'OFFLINE') return { kind: 'offline' };
  if (REFUSED.has(code)) return { kind: 'refused', code };
  switch (code) {
    case 'GAME_DISABLED': return { kind: 'disabled' };
    case 'GAME_DAILY_LIMIT': {
      const resetsAt = field(error, 'resetsAt');
      return { kind: 'limit', resetsAt: typeof resetsAt === 'string' && !Number.isNaN(Date.parse(resetsAt)) ? resetsAt : null };
    }
    case 'SESSION_CLOSED': return { kind: 'closed' };
    case 'SESSION_EXPIRED': return { kind: 'expired' };
    case 'GAME_UNKNOWN': return { kind: 'unknownGame' };
    case 'SAVE_CONFLICT': return { kind: 'conflict', revision: conflictRevision(error) };
    case 'RUN_IMPLAUSIBLE': return { kind: 'implausible' };
    default: return { kind: 'error', code };
  }
}

async function call<T>(request: GamesTransport, path: string, init: Parameters<GamesTransport>[1], schema: z.ZodType<T>): Promise<GameResult<T>> {
  let response: Awaited<ReturnType<GamesTransport>>;
  try {
    response = await request(path, init);
  } catch {
    return { ok: false, failure: { kind: 'offline' } };
  }
  if (response.error) return { ok: false, failure: failureOfError(response.error) };
  const parsed = schema.safeParse(response.data);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, failure: { kind: 'malformed' } };
}

const base = (gameId: string) => `/learn/games/${encodeURIComponent(gameId)}`;
const sessionPath = (gameId: string, sessionId: string) => `${base(gameId)}/sessions/${encodeURIComponent(sessionId)}`;

export interface GamesClient {
  list(): Promise<GameResult<GamesList>>;
  createSession(): Promise<GameResult<GameSession>>;
  heartbeat(sessionId: string, flags: { visible: boolean; focused: boolean }): Promise<GameResult<Heartbeat>>;
  postRun(sessionId: string, report: RunReport): Promise<GameResult<RunResult>>;
  reflect(sessionId: string, runId: string, reply: Reply): Promise<GameResult<true>>;
  debrief(sessionId: string, runId: string): Promise<GameResult<{ source: 'authored' } | { source: 'ai'; text: string }>>;
  putSave(sessionId: string, body: { revision: number; data: SaveData }): Promise<GameResult<number>>;
  /** `keepalive` lets the request finish after the page is gone (a `pagehide`); Core also expires a session it never hears an end for. */
  end(sessionId: string, reason: EndReason, options?: { keepalive?: boolean }): Promise<GameResult<true>>;
}

export function createGamesClient(request: GamesTransport, gameId: string = GAME_ID): GamesClient {
  return {
    list: () => call(request, '/learn/games', undefined, gamesListSchema),
    async createSession() {
      const result = await call(request, `${base(gameId)}/sessions`, { method: 'POST', body: {} }, sessionStartSchema);
      if (!result.ok) return result;
      const accepted = acceptGameUrl(result.value.game.url);
      if (!accepted) return { ok: false, failure: { kind: 'untrustedUrl' } };
      return { ok: true, value: { ...result.value, game: { ...accepted, build: result.value.game.build } } };
    },
    heartbeat: (sessionId, flags) => call(request, `${sessionPath(gameId, sessionId)}/heartbeat`, { method: 'POST', body: flags }, heartbeatSchema),
    postRun: (sessionId, report) => call(request, `${sessionPath(gameId, sessionId)}/runs`, { method: 'POST', body: report }, runResultSchema),
    async reflect(sessionId, runId, reply) {
      const result = await call(request, `${sessionPath(gameId, sessionId)}/runs/${encodeURIComponent(runId)}/reflection`, { method: 'POST', body: { reply } }, okSchema);
      return result.ok ? { ok: true, value: true } : result;
    },
    async debrief(sessionId, runId) {
      const result = await call(request, `${sessionPath(gameId, sessionId)}/runs/${encodeURIComponent(runId)}/debrief`, { method: 'POST', body: {} }, debriefSchema);
      if (!result.ok) return result;
      const { source, text } = result.value;
      // The contract: `text` only when source is 'ai'. Anything else is not the contract, so it is not shown.
      if (source === 'ai' && typeof text === 'string' && text.trim().length > 0) return { ok: true, value: { source: 'ai', text: text.trim() } };
      return source === 'authored' && text === null ? { ok: true, value: { source: 'authored' } } : { ok: false, failure: { kind: 'malformed' } };
    },
    async putSave(sessionId, body) {
      const result = await call(request, `${sessionPath(gameId, sessionId)}/save`, { method: 'PUT', body }, saveRevisionSchema);
      return result.ok ? { ok: true, value: result.value.revision } : result;
    },
    async end(sessionId, reason, options) {
      const result = await call(request, `${sessionPath(gameId, sessionId)}/end`, { method: 'POST', body: { reason }, ...(options?.keepalive ? { keepalive: true } : {}) }, okSchema);
      return result.ok ? { ok: true, value: true } : result;
    },
  };
}

/** What the Learn home card reads: the game is offered only when Core says it is enabled for this learner. */
export function kartrushEnabled(list: GamesList): boolean {
  return list.games.some((game) => game.gameId === GAME_ID && game.enabled);
}

/** Sessions the learner has left today for one game, or null when Core does not list it. */
export function sessionsLeft(list: GamesList, gameId: string = GAME_ID): number | null {
  return list.games.find((game) => game.gameId === gameId)?.sessionsRemainingToday ?? null;
}
