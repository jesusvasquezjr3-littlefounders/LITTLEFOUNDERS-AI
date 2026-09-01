import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLOSE_CODES } from '../ws/protocol.js';

/*
 * ORACLE.md §15.2 items 2 and 3 — end-to-end proof, through the REAL socket
 * server, of the two per-process admission controls that protect the single
 * Oracle process from being overwhelmed:
 *
 *   - a hard ceiling on concurrent LIVE sessions (item 2, narrow single-
 *     process scope — the horizontal-scale half of that item is a separate,
 *     larger, architecturally-undecided piece of work)
 *   - a rate limit on the handshake PATH itself (item 3), which
 *     `middleware/rateLimit.ts`'s `globalRateLimiter` never sees because the
 *     WebSocketServer is attached directly to the raw HTTP server
 *
 * Both gates run BEFORE the token is even read (see `ws/server.ts`'s own
 * header comment for the full ordering), so the handshake-rate-limit tests
 * below need no valid token at all — proving the refusal happens for the
 * price of the cheapest possible check, ahead of everything downstream, is
 * the whole point (`handshakeRateLimit.test.ts` covers the counter's own
 * logic at the unit level; this file covers the WIRING).
 *
 * The concurrent-cap tests DO need real, fully-established sessions — the
 * cap must not trip until N are actually live — so they drive a fake Core
 * exactly like `hardening.test.ts` and `live-session.test.ts`, but need
 * NEITHER a model NOR a voice server: `greet()` is a SCRIPTED line (no model
 * call — `orchestrator.ts`), and `moderationReadiness(isMinor=false)` passes
 * without a judge key (`safety/moderation.ts`) — both real, supported,
 * model-less postures this file leans on rather than standing up servers
 * nothing here exercises.
 */

let oracleServer: Server;
let coreServer: Server;
let oraclePort = 0;

/** sessionId → context, so the fake Core can answer MULTIPLE distinct sessions at once. */
const sessions = new Map<string, Record<string, unknown>>();

/** A mathematically valid UUIDv4-shaped id, distinct per index (§1.14 — never a placeholder like "session-1"). */
function sessionId(n: number): string {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${(n + 1).toString(16).padStart(12, '0')}`;
}
function userId(n: number): string {
  return `bbbbbbbb-bbbb-4bbb-8bbb-${(n + 1).toString(16).padStart(12, '0')}`;
}

function registerSession(n: number): void {
  sessions.set(sessionId(n), {
    sessionId: sessionId(n),
    userId: userId(n),
    tier: 2,
    locale: 'es-MX',
    nickname: 'Robi',
    character: 'rho',
    companion: 'liruf',
    diorama: 'diorama-a',
    intent: 'course_topic',
    adaptations: [],
    courseContext: null,
    skillStates: [],
    // Adult: moderationReadiness(false) passes with no judge configured, and
    // no guardian-consent machinery is in play — neither is what this file
    // tests, so the fixture stays out of their way.
    isMinor: false,
    voiceConsent: false,
    intelDegraded: false,
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += String(chunk)));
    req.on('end', () => resolve(raw));
  });
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data, error: null }));
}

function listen(server: Server): Promise<Server> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const portOf = (server: Server): number => (server.address() as AddressInfo).port;

/** A minimal fake Core: session context (for N distinct sessions), close, and no-op turns/flags/consent. */
function startFakeCore(): Promise<Server> {
  return listen(
    createServer((req, res) => {
      void (async () => {
        const url = req.url ?? '';
        if (req.method === 'POST') await readBody(req);

        if (/\/sessions\/[^/]+\/close/.test(url)) return json(res, { closed: true });
        const ctxMatch = /\/sessions\/([^/?]+)/.exec(url);
        if (ctxMatch) {
          const context = sessions.get(decodeURIComponent(ctxMatch[1] ?? ''));
          return context ? json(res, context) : json(res, null, 404);
        }
        if (url.includes('/turns')) return json(res, { recorded: true });
        if (url.includes('/flags')) return json(res, { recorded: true });
        if (url.includes('/consent/')) return json(res, { active: true });
        return json(res, null, 404);
      })();
    }),
  );
}

function collect(
  socket: WebSocket,
  predicate: (messages: Record<string, unknown>[]) => boolean,
  timeoutMs = 5_000,
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const messages: Record<string, unknown>[] = [];
    const timer = setTimeout(
      () => reject(new Error(`timed out with: ${JSON.stringify(messages.map((m) => m.type))}`)),
      timeoutMs,
    );
    socket.on('message', (data) => {
      messages.push(JSON.parse(String(data)) as Record<string, unknown>);
      if (predicate(messages)) {
        clearTimeout(timer);
        resolve(messages);
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function socketUrlFor(n: number): Promise<string> {
  const { mintSessionToken } = await import('../session/token.js');
  const token = mintSessionToken(
    { sid: sessionId(n), uid: userId(n), exp: Math.floor(Date.now() / 1000) + 60 },
    process.env.TUTOR_SESSION_SECRET as string,
  );
  return `ws://127.0.0.1:${oraclePort}/ws/tutor?token=${encodeURIComponent(token)}`;
}

/** Registers session `n`, opens it, and waits for the (scripted) greeting — a fully-established live session. */
async function openSession(n: number): Promise<WebSocket> {
  registerSession(n);
  const socket = new WebSocket(await socketUrlFor(n));
  await collect(socket, (m) => m.some((x) => x.type === 'turn'));
  return socket;
}

/** Waits for the socket to close and reports the code/reason the SERVER sent — a refusal must be a real close frame, never a hang or a silent drop. */
function waitForClose(socket: WebSocket, timeoutMs = 5_000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for the socket to close')), timeoutMs);
    socket.on('close', (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
}

beforeAll(async () => {
  coreServer = await startFakeCore();
  process.env.CORE_URL = `http://127.0.0.1:${portOf(coreServer)}`;
  // Deliberately NOT set: MODEL_API_KEY, VOICE_PROVIDER's key. Both stay in
  // their default, fully-supported, model-less/voiceless posture — see the
  // file's own top comment for why nothing here needs either upstream.

  const { attachTutorSocket } = await import('../ws/server.js');
  const { createApp } = await import('../app.js');

  oracleServer = createServer();
  attachTutorSocket(oracleServer);
  oracleServer.on('request', createApp(() => 0));
  await listen(oracleServer);
  oraclePort = portOf(oracleServer);
});

afterAll(async () => {
  await Promise.all(
    [oracleServer, coreServer].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
  delete process.env.CORE_URL;
  delete process.env.ORACLE_MAX_CONCURRENT_SESSIONS;
  delete process.env.ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX;
  delete process.env.ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS;
});

afterEach(async () => {
  const { nonceLedger } = await import('../session/token.js');
  nonceLedger.clear();
  // A socket closed without a farewell PARKS its session for resume (and
  // removes it from `liveSessions` immediately — parking is a SEPARATE map).
  // The short wait lets the server's own `close` handler actually run before
  // the next test reads `liveSessions.size`, exactly like hardening.test.ts.
  await new Promise((r) => setTimeout(r, 120));
  const { finalizeAllParked } = await import('../ws/server.js');
  finalizeAllParked();
  sessions.clear();
});

describe('the per-process concurrent-session cap (ORACLE.md §15.2 item 2)', () => {
  beforeEach(async () => {
    process.env.ORACLE_MAX_CONCURRENT_SESSIONS = '2';
    // Generous: this block is not what exercises the handshake limiter, and
    // the default is already generous enough — set explicitly anyway so a
    // change to the schema default can never accidentally couple the two.
    process.env.ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX = '1000';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
  });

  it('accepts up to the cap, then refuses the next attempt with a distinguishable reason — not a silent drop', async () => {
    const first = await openSession(0);
    const second = await openSession(1);

    // A real, otherwise-valid session — the ONLY thing wrong with this
    // attempt is that the process is already full. Registered so a refusal
    // here can only be the cap: an unregistered session would ALSO be
    // refused (gate 6, Core cannot resolve it), and that refusal would prove
    // nothing about the cap specifically.
    registerSession(2);
    const third = new WebSocket(await socketUrlFor(2));
    const { code, reason } = await waitForClose(third);

    // A clear, distinguishable reason reaches the client: a real close code
    // the frontend already maps to "The tutor is resting. Try again soon."
    // (useTutorSocket.ts), not a hang, not a bare TCP reset.
    expect(code).toBe(CLOSE_CODES.SERVICE_DEGRADED);
    expect(reason).toContain('at capacity');

    // The two sessions already holding the cap are wholly untouched by a
    // THIRD connection being refused — the cap protects capacity, it does
    // not evict anyone to make room.
    expect(first.readyState).toBe(WebSocket.OPEN);
    expect(second.readyState).toBe(WebSocket.OPEN);

    first.close();
    second.close();
  });

  it('is a dynamic ceiling, not a one-shot lockout: closing a session frees its slot for the next one', async () => {
    const first = await openSession(0);
    const second = await openSession(1);

    registerSession(2);
    const refused = new WebSocket(await socketUrlFor(2));
    expect((await waitForClose(refused)).code).toBe(CLOSE_CODES.SERVICE_DEGRADED);

    // Free a slot, and give the server's close handler time to actually
    // remove it from `liveSessions` (an async event, not synchronous with
    // the client-side `.close()` call).
    first.close();
    await new Promise((r) => setTimeout(r, 150));

    // The SAME session id that was just refused now succeeds — proving the
    // ceiling counts LIVE sessions at the moment of connection, not
    // connections ever attempted.
    const third = new WebSocket(await socketUrlFor(2));
    await collect(third, (m) => m.some((x) => x.type === 'turn'));
    expect(third.readyState).toBe(WebSocket.OPEN);

    second.close();
    third.close();
  });
});

describe('the websocket handshake rate limit (ORACLE.md §15.2 item 3)', () => {
  beforeEach(async () => {
    // Generous: this block is not what exercises the concurrent cap.
    process.env.ORACLE_MAX_CONCURRENT_SESSIONS = '1000';
    process.env.ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX = '3';
    process.env.ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS = '60000';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const { resetHandshakeRateLimitForTests } = await import('../ws/handshakeRateLimit.js');
    resetHandshakeRateLimitForTests();
  });

  it('refuses a burst of handshake attempts once the per-IP budget is spent — the PATH itself, not merely invalid tokens', async () => {
    /*
     * No token on any of these attempts, deliberately: ORACLE.md's own text
     * is explicit that token minting already bounds an UNAUTHENTICATED
     * flood, and what this gate protects is the path a burst of attempts
     * takes regardless of whether each one would even authenticate. Every
     * attempt here fails for "missing session token" too (gate 3, downstream
     * of this one) — proving the rate limit trips BEFORE that check ever
     * runs is the point, not incidental.
     */
    for (let i = 0; i < 3; i += 1) {
      const socket = new WebSocket(`ws://127.0.0.1:${oraclePort}/ws/tutor`);
      const { code } = await waitForClose(socket);
      expect(code).toBe(CLOSE_CODES.UNAUTHORIZED);
    }

    const fourth = new WebSocket(`ws://127.0.0.1:${oraclePort}/ws/tutor`);
    const { code, reason } = await waitForClose(fourth);

    // Refused with a real close frame — not silently dropped, not left to
    // hang — and a reason distinguishable in server logs from every other
    // SERVICE_DEGRADED cause (moderation unavailable, at-capacity).
    expect(code).toBe(CLOSE_CODES.SERVICE_DEGRADED);
    expect(reason).toContain('too many connection attempts');
  });

  it('also refuses a GENUINE, well-formed session attempt once the same address is over budget', async () => {
    // Spend the budget with attempts that would ALSO fail downstream
    // (missing token) — the previous test already covers that shape. This
    // one proves the limiter refuses an attempt that would otherwise have
    // succeeded completely, not merely ones that were going to fail anyway.
    // Waited out one at a time (not fired concurrently) so each is fully
    // counted before the next — and, since the server closes every one of
    // these itself (UNAUTHORIZED), there is nothing for the client to close.
    for (let i = 0; i < 3; i += 1) {
      await waitForClose(new WebSocket(`ws://127.0.0.1:${oraclePort}/ws/tutor`));
    }

    registerSession(0);
    const throttled = new WebSocket(await socketUrlFor(0));
    const { code, reason } = await waitForClose(throttled);
    expect(code).toBe(CLOSE_CODES.SERVICE_DEGRADED);
    expect(reason).toContain('too many connection attempts');
  });
});
