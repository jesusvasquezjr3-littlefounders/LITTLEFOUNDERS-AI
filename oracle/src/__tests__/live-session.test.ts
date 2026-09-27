import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CONTEXT_OPTIONAL_FIELDS } from '../core/client.js';

/*
 * A REAL session, end to end.
 *
 * This is the test that answers "does it actually work", as opposed to "does
 * each piece behave". It stands up:
 *
 *   - Oracle's real HTTP + websocket server, on an ephemeral port
 *   - a real HTTP server standing in for Core
 *   - a real HTTP server standing in for the model provider
 *
 * and then drives an actual websocket through an actual session: handshake,
 * token burn, greeting, a learner turn, a served activity, a graded result,
 * and a farewell. Nothing is mocked at a module boundary — the only fakes are
 * the two upstreams, and they are fakes the way a staging environment is,
 * over the wire.
 *
 * What that buys over the unit tests: it is the only thing here that would
 * catch a socket that never upgrades, a token format the two sides disagree
 * about, a message the client can send that the server cannot parse, or a
 * pipeline that deadlocks between the model and moderation. Every one of those
 * passes a unit suite and fails a learner.
 */

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const SEGMENT_ID = '33333333-3333-4333-8333-333333333333';

/** Everything the fake Core was asked to persist, so the test can assert on it. */
interface CoreJournal {
  turns: {
    speaker: string;
    text: string;
    source: string;
    seq: number;
    whiteboard?: { values: number[] } | null;
    demonstrate?: { kind: string; denomination?: number }[] | null;
  }[];
  flags: { category: string; handled: string; turnSeq: number | null }[];
  /* `costUsd` is on the wire body and therefore in this journal already
   * (it is a raw `JSON.parse` of the POST); it was simply never declared,
   * so no test could assert on the ledger half of a close. */
  closes: {
    closeReason: string;
    turnCount: number;
    costUsd: number;
    /* C.16 / C.8 / C.12: what the close records beside the reason. */
    closingScript?: string;
    opening?: string;
    endSignal?: { evaluated: boolean; events: unknown[] };
  }[];
  segmentRequests: number;
}

interface ModelJournal {
  /** Raw request bodies, so the test can prove what did NOT travel. */
  bodies: string[];
}

let oracleServer: Server;
let coreServer: Server;
let modelServer: Server;
let oraclePort = 0;
let journal: CoreJournal;
let modelJournal: ModelJournal;
let send: (typeof import('../ws/server.js'))['send'];
/** Flipped per test to shape what the fake Core reports about the learner. */
let sessionIsMinor = false;
/**
 * Flipped per test to make the fake judge answer `500` on every call. Round
 * 76's resume test is the only one that wants it: an unavailable judge is the
 * ONE condition under which `isMinor` changes what a learner receives.
 */
let judgeShouldFail = false;
const sessionConsent = true;
/** Flipped per test to make the fake Core refuse every safety-flag write. */
let flagsShouldFail = false;
/**
 * The `type` the fake Core serves on `/tutor/internal/segments`. Most tests
 * want the default (`quiz_mcq`, ungraded by voice) — round 67's own test
 * flips this to a CHECKABLE type (`orchestrator.ts`'s `CHECKABLE_TYPES`) so a
 * spoken answer routes through `handleVoiceCheckResult` instead of the
 * ordinary text path.
 */
let servedSegmentType = 'quiz_mcq';
/**
 * The fake voice-check verdict. Round 67's own test needs `recognized: true`
 * with a real boolean `correct` — `ws/server.ts` only calls
 * `handleVoiceCheckResult` when both are present — regardless of what the
 * learner's utterance actually says, so the SAME utterance can carry a
 * self-harm disclosure and still be treated as "an answer was checked".
 */
let voiceCheckRecognized = true;
/**
 * What the fake Core reports as the band it ACTUALLY served (round 74). `null`
 * omits the field entirely, which is both the default here and the shape an
 * older Core produces — `ServedSegmentSchema` is `.strict()`, so every other
 * test in this file doubles as the proof that omitting it still parses.
 */
let servedSegmentDifficulty: number | null = null;
/**
 * How many of the next `/tutor/internal/segments` calls the fake Core should
 * answer WITHOUT a segment — the state most skills are actually in, and the
 * one `serveSegment`'s recovery path exists for (round 76).
 * `Number.POSITIVE_INFINITY` is a ladder that never has anything.
 */
let segmentFailuresLeft = 0;
/**
 * WHICH KIND of miss those calls are, because they cost very different money.
 *
 * `empty` is Core answering "nothing here" — one round trip and no model call.
 * `needs_generation` is the ladder handing tier 3 back to Oracle, which then
 * pays for REAL author completions before it can conclude the same thing. Both
 * land in the same `serveSegment` branch, and the bound has to hold for the
 * expensive one or it is not a cost bound at all.
 */
let segmentFailureShape: 'empty' | 'needs_generation' | 'live_suspended' = 'empty';
/**
 * A session plan for the fake Core's session response, so the v3 brain is
 * ACTIVE. Off by default: every other test in this file describes an open
 * session with no plan, which is the shape they were written against.
 */
let servedSessionPlan: unknown[] | null = null;
/**
 * How long the fake model sits on a `cuentamelotodomuydespacio` completion.
 * 1.5s by default — long enough to prove a turn is genuinely still busy, but
 * short enough that it resolves comfortably inside this suite's
 * `SESSION_RESUME_GRACE_MS` (also 1.5s) when a park races it. Round 98's own
 * test raises this well past that window, on purpose: the reachability
 * mechanism it proves is a busy turn's OWN duration outlasting the grace
 * window, with no farewell involved at all — `farewell()` is fully scripted
 * (see its own doc comment in `orchestrator.ts`) and adds no model latency,
 * so making IT slow would test the wrong thing.
 */
let slowTurnDelayMs = 1_500;
/**
 * C.16: the opening the fake Core queues for this session. `null` omits the
 * field, the shape an older Core sends (the greeting).
 */
let servedOpening: string | null = null;
/** C.9: what the last context read announced it can parse (`x-oracle-context-fields`). */
let announcedContextFields: string | null = null;
/** C.9: the Stage 7 rollback verdict the fake Core serves; `null` omits the field (an older Core). */
let servedTelemetryMode: 'act' | 'shadow' | null = null;
/** C.7/C.15: extra optional context fields the fake Core serves (the disposition projection, continuity, mode). */
let servedAllianceFields: Record<string, unknown> | null = null;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
    });
    req.on('end', () => resolve(raw));
  });
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data, error: null }));
}

function startFakeCore(): Promise<Server> {
  const server = createServer((req, res) => {
    void (async () => {
      const url = req.url ?? '';
      const body = req.method === 'POST' ? await readBody(req) : '';

      if (url.includes(`/tutor/internal/sessions/${SESSION_ID}/close`)) {
        /*
         * Real PostgREST's `ended_at=is.null` filter (`closeTutorSession`,
         * backend/src/services/tutorData.ts) means the FIRST close wins and
         * every later one matches zero rows — so this fake only ever
         * JOURNALS the first call, exactly as the real row would only ever
         * reflect the first write. `alreadyClosed` is what round 98's fix
         * reads back to tell a real update apart from a no-op that a bare
         * 2xx cannot distinguish (see `closeTutorSession`'s own comment).
         */
        const alreadyClosed = journal.closes.length > 0;
        if (!alreadyClosed) journal.closes.push(JSON.parse(body) as CoreJournal['closes'][number]);
        return json(res, { closed: true, alreadyClosed });
      }
      if (url.includes(`/tutor/internal/sessions/${SESSION_ID}`)) {
        announcedContextFields = String(req.headers['x-oracle-context-fields'] ?? '');
        return json(res, {
          sessionId: SESSION_ID,
          userId: USER_ID,
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
          isMinor: sessionIsMinor,
          voiceConsent: sessionConsent,
          intelDegraded: false,
          ...(servedSessionPlan ? { sessionPlan: servedSessionPlan } : {}),
          ...(servedOpening ? { opening: servedOpening } : {}),
          ...(servedTelemetryMode ? { behavioralTelemetryMode: servedTelemetryMode } : {}),
          ...(servedAllianceFields ?? {}),
        });
      }
      if (url.includes('/tutor/internal/turns')) {
        journal.turns.push(JSON.parse(body) as CoreJournal['turns'][number]);
        return json(res, { recorded: true });
      }
      if (url.includes('/tutor/internal/flags')) {
        journal.flags.push(JSON.parse(body) as CoreJournal['flags'][number]);
        return json(res, { recorded: !flagsShouldFail });
      }
      // MUST be checked before the plain `/tutor/internal/segments` branch
      // below — a voice-check URL (`/segments/:id/voice-check`) also
      // contains that substring, and the wrong branch would swallow it.
      if (url.includes('/voice-check')) {
        return json(res, {
          checkable: true,
          recognized: voiceCheckRecognized,
          correct: true,
        });
      }
      if (url.includes('/tutor/internal/segments')) {
        journal.segmentRequests += 1;
        if (segmentFailuresLeft > 0) {
          segmentFailuresLeft -= 1;
          if (segmentFailureShape === 'live_suspended') {
            // C.5: live generation suspended for this category (e.g. the
            // judge is uncalibrated). Oracle must not author anything.
            return json(res, { needsGeneration: false, liveSuspended: true, reason: 'uncalibrated' });
          }
          if (segmentFailureShape === 'needs_generation') {
            return json(res, {
              needsGeneration: true,
              skillKey: 'money.saving',
              tier: 3,
              locale: 'es-MX',
              difficulty: 2,
              // The fake model answers with a TURN, never a segment of this
              // type, so authoring exhausts its two attempts and gives up —
              // the ordinary "tier 3 could not produce one either" ending.
              allowedTypes: ['quiz_mcq'],
            });
          }
          // A well-formed envelope carrying no segment: `requestSegment`
          // returns `null` through its PARSE branch, which is Core saying
          // "nothing here" rather than Core being unreachable.
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ data: null, error: { code: 'NOT_FOUND', message: 'no segment' } }));
        }
        return json(res, {
          segmentId: SEGMENT_ID,
          seq: 0,
          origin: 'catalog',
          segment: {
            id: 'seg-1',
            type: servedSegmentType,
            prompt_md: '¿Cuánto juntas en 4 semanas?',
            difficulty: 2,
            xp: 20,
            payload: { options: [{ id: 'a', text_md: '100' }] },
          },
          keyVerified: true,
          ...(servedSegmentDifficulty === null ? {} : { servedDifficulty: servedSegmentDifficulty }),
        });
      }
      if (url.includes('/tutor/internal/consent/')) {
        return json(res, { active: sessionConsent });
      }
      return json(res, null, 404);
    })();
  });
  return listen(server);
}

/** A model that answers with a valid turn, and a judge that always passes. */
function startFakeModel(): Promise<Server> {
  const server = createServer((req, res) => {
    void (async () => {
      const body = await readBody(req);
      modelJournal.bodies.push(body);
      const isJudge = body.includes('child-safety reviewer');
      /*
       * A judge that is simply DOWN — the one condition under which
       * `requireModelPass` (and therefore `isMinor`) changes what a learner
       * actually receives: a minor's turn is refused, an adult's runs on the
       * deterministic pass alone (/ORACLE.md §6). Round 77's resume test is
       * the only one that turns this on.
       */
      if (isJudge && judgeShouldFail) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'judge is down' }));
        return;
      }
      // A deliberately slow completion, so a test can interrupt mid-thought.
      if (!isJudge && body.includes('cuentamelotodomuydespacio')) {
        await new Promise((r) => setTimeout(r, slowTurnDelayMs));
      }
      // A learner asking to practise gets a turn that requests an activity.
      const wantsActivity = !isJudge && body.includes('quieropracticarya');
      // V4: a learner whose message contains this asks for a growth story,
      // and gets a turn carrying a whiteboard — proving the FRAME (not just
      // the orchestrator) delivers server-computed values over a real socket.
      const wantsBoard = !isJudge && body.includes('quieropizarron');
      // V4 (/ORACLE.md §20.5 backlog): the same proof, for the two ADDITIONAL
      // whiteboard kinds — a real socket frame, not just the orchestrator's
      // own in-process object, carries the server-COMPUTED derived fields
      // (`difference`/`greater`, each mark's `position`).
      const wantsCompare = !isJudge && body.includes('quierocomparar');
      const wantsMarkedLine = !isJudge && body.includes('quierorecta');
      const wantsTokens = !isJudge && body.includes('quieromonedas');
      /*
       * Found while investigating ORACLE.md §19.5's "replaying `demonstrate`
       * animations" backlog item, 2026-09-01 — the same "prove the FRAME
       * delivers it" reasoning `wantsBoard` above exists for, applied to the
       * tutor's OTHER v3 turn-schema visual field.
       */
      const wantsDemo = !isJudge && body.includes('muestramelamoneda');
      /*
       * A DIFFERENT sentence, for a test that needs two model turns on one
       * orchestrator. The tutor repeating itself verbatim is a real defect
       * this suite tests for elsewhere, and the repair it triggers would end
       * the second turn as `scripted` for a reason that has nothing to do
       * with what that test is measuring.
       */
      const wantsSecondLine = !isJudge && body.includes('otrapreguntadistinta');
      const content = isJudge
        ? JSON.stringify({ safe: true })
        : JSON.stringify({
            say: wantsBoard
              ? 'Imaginemos que guardas 10 pesos y cada día te dan 2 más.'
              : wantsCompare
                ? 'Una playera en la Tienda A cuesta 45 pesos, y en la Tienda B cuesta 28 pesos.'
                : wantsMarkedLine
                  ? 'Tienes 22 pesos ahorrados, y unos audífonos cuestan 35 pesos.'
                  : wantsDemo
                    ? 'Mira, si agrego esta moneda de 10 y esta de 5…'
                    : wantsActivity
                      ? '¡Vamos a intentarlo!'
                      : wantsSecondLine
                        ? 'Perfecto. ¿Y qué harías con ese dinero al final del mes?'
                        : '¡Buena pregunta! ¿Cuánto crees que juntarías?',
            emotion: 'happy',
            action: 'nod',
            next: wantsActivity ? 'segment' : 'ask',
            segmentRequest: wantsActivity
              ? { skillKey: 'money.saving', difficulty: 2, framing: 'Prueba esto.', rationale: 'practice' }
              : null,
            offerAdaptation: null,
            savePlan: false,
            whiteboard: wantsBoard
              ? {
                  kind: 'sequence',
                  start: 10,
                  unit: 'day',
                  steps: [
                    { op: 'add', value: 2 },
                    { op: 'add', value: 2 },
                  ],
                  label: 'Cada día te dan 2 más',
                  currency: 'MXN',
                }
              : wantsCompare
                ? {
                    kind: 'compare',
                    left: { label: 'Tienda A', value: 45 },
                    right: { label: 'Tienda B', value: 28 },
                    label: '¿Cuál playera es más barata?',
                    currency: 'MXN',
                  }
                : wantsMarkedLine
                  ? {
                      kind: 'marked_line',
                      min: 0,
                      max: 40,
                      marks: [
                        { value: 22, label: 'Lo que tienes' },
                        { value: 35, label: 'Los audífonos' },
                      ],
                      label: '¿Cuánto te falta para los audífonos?',
                      currency: 'MXN',
                    }
                  : wantsTokens
                    ? {
                        kind: 'tokens',
                        groups: [
                          { denomination: 10, count: 3 },
                          { denomination: 1, count: 4 },
                        ],
                        label: 'Cuenta lo que hay en la mesa',
                        currency: 'MXN',
                      }
                    : null,
            demonstrate: wantsDemo
              ? [
                  { kind: 'add', denomination: 10 },
                  { kind: 'add', denomination: 5 },
                ]
              : null,
          });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 80, completion_tokens: 30 },
        }),
      );
    })();
  });
  return listen(server);
}

function listen(server: Server): Promise<Server> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function portOf(server: Server): number {
  return (server.address() as AddressInfo).port;
}

/** Collects server messages until `predicate` is satisfied, then resolves. */
function collect(
  socket: WebSocket,
  predicate: (messages: Record<string, unknown>[]) => boolean,
  timeoutMs = 3_000,
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const messages: Record<string, unknown>[] = [];
    const timer = setTimeout(
      // Whole frames, not just types: an unexpected `error` frame's code is
      // the difference between five minutes and an afternoon.
      () => reject(new Error(`timed out with: ${JSON.stringify(messages)}`)),
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

/**
 * Collects frames until the server has said NOTHING for `quietMs`.
 *
 * `collect()` waits for a predicate, which cannot express the question round
 * 75 asks: not "did the expected frame arrive" but "how much did the server do
 * off ONE learner frame, and did it ever stop". A predicate that matched the
 * first `NO_SEGMENT` would have passed happily on the runaway, because the
 * first one was always correct — it was the nineteen after it that cost money.
 *
 * `capMs` RESOLVES rather than rejects, on purpose: an unbounded loop must
 * still hand back its evidence (a count in the dozens) instead of failing as a
 * timeout that says nothing about why.
 */
function untilQuiet(socket: WebSocket, quietMs = 600, capMs = 25_000): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const messages: Record<string, unknown>[] = [];
    let quiet: NodeJS.Timeout;
    const cap = setTimeout(() => {
      clearTimeout(quiet);
      resolve(messages);
    }, capMs);
    const done = (): void => {
      clearTimeout(cap);
      resolve(messages);
    };
    quiet = setTimeout(done, quietMs);
    socket.on('message', (data) => {
      messages.push(JSON.parse(String(data)) as Record<string, unknown>);
      clearTimeout(quiet);
      quiet = setTimeout(done, quietMs);
    });
    socket.on('error', (error) => {
      clearTimeout(quiet);
      clearTimeout(cap);
      reject(error);
    });
  });
}

/*
 * A socket that REMEMBERS it closed.
 *
 * `closed()` originally just attached a `close` listener and waited. That is a
 * race, and it is the kind that passes: a test which asserts on the transcript
 * before waiting gives the server time to close first, and the listener then
 * waits forever for an event that already fired. One test passed by luck and
 * the identical pattern next to it hung.
 *
 * Recording the code AT CONSTRUCTION removes the race entirely — by the time
 * anything asks, the answer already exists or is still coming.
 */
interface TrackedSocket {
  socket: WebSocket;
  closed(timeoutMs?: number): Promise<number>;
}

function open(url: string): TrackedSocket {
  const socket = new WebSocket(url);
  let code: number | null = null;
  const waiters: ((value: number) => void)[] = [];
  socket.on('close', (received) => {
    code = received;
    waiters.splice(0).forEach((resolve) => resolve(received));
  });

  return {
    socket,
    closed(timeoutMs = 6_000) {
      if (code !== null) return Promise.resolve(code);
      return new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('socket never closed')), timeoutMs);
        waiters.push((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      });
    },
  };
}

beforeAll(async () => {
  coreServer = await startFakeCore();
  modelServer = await startFakeModel();

  // Point the real config at the fake upstreams BEFORE anything reads it.
  process.env.CORE_URL = `http://127.0.0.1:${portOf(coreServer)}`;
  process.env.MODEL_API_BASE = `http://127.0.0.1:${portOf(modelServer)}`;
  process.env.JUDGE_API_BASE = `http://127.0.0.1:${portOf(modelServer)}`;
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  process.env.JUDGE_API_KEY = 'test-judge-key-0123';
  // Short enough that the park-expiry test runs in seconds, long enough that
  // the re-attach test cannot lose the race to it.
  process.env.SESSION_RESUME_GRACE_MS = '1500';

  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();

  const { createApp } = await import('../app.js');
  const wsServer = await import('../ws/server.js');
  const { attachTutorSocket } = wsServer;
  send = wsServer.send;

  oracleServer = createServer();
  attachTutorSocket(oracleServer);
  oracleServer.on('request', createApp(() => 0));
  await listen(oracleServer);
  oraclePort = portOf(oracleServer);
});

afterAll(async () => {
  await Promise.all(
    [oracleServer, coreServer, modelServer].map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
  delete process.env.MODEL_API_KEY;
  delete process.env.JUDGE_API_KEY;
});

afterEach(async () => {
  flagsShouldFail = false;
  sessionIsMinor = false;
  judgeShouldFail = false;
  servedSegmentType = 'quiz_mcq';
  voiceCheckRecognized = true;
  servedSegmentDifficulty = null;
  servedSessionPlan = null;
  segmentFailuresLeft = 0;
  segmentFailureShape = 'empty';
  slowTurnDelayMs = 1_500;
  vi.restoreAllMocks();
  const { nonceLedger } = await import('../session/token.js');
  nonceLedger.clear();
  /*
   * The SHARED park store too — the cross-replica half of a park
   * (`ws/parkStore.ts`): a published park record and, more importantly, this
   * session's TRANSCRIPT FLOOR, which is monotonic and outlives a session by
   * design so that no replica can ever reuse a row number. These tests all
   * share one session id while pretending to be unrelated fresh sessions, so
   * without this the floor legitimately carries every earlier test's row count
   * into the next one and a "first" connection starts numbering in the
   * hundreds. Same reason `nonceLedger.clear()` is on the line above.
   */
  const { clearLocalParkStore } = await import('../ws/parkStore.js');
  clearLocalParkStore();
  // Tests share one session id, and a socket closed without a farewell PARKS
  // its orchestrator — which the next test's handshake would then resume.
  // Finalizing between tests keeps each one a first visit. The beat first:
  // the server's own close event races this hook, and a park created after
  // the sweep leaks into the next test as a mysterious resume.
  await new Promise((r) => setTimeout(r, 120));
  const { finalizeAllParked } = await import('../ws/server.js');
  finalizeAllParked();
  // And let the finalize's own fire-and-forget close call LAND before the
  // next test resets the journal — otherwise it lands after the reset and
  // reads as a mystery close inside that test.
  await new Promise((r) => setTimeout(r, 120));
});

/** A freshly minted, valid socket URL. */
async function socketUrl(overrides: { sid?: string; uid?: string; exp?: number } = {}): Promise<string> {
  const { mintSessionToken } = await import('../session/token.js');
  const token = mintSessionToken(
    {
      sid: overrides.sid ?? SESSION_ID,
      uid: overrides.uid ?? USER_ID,
      exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 60,
    },
    process.env.TUTOR_SESSION_SECRET as string,
  );
  return `ws://127.0.0.1:${oraclePort}/ws/tutor?token=${encodeURIComponent(token)}`;
}

function freshJournal(): void {
  journal = { turns: [], flags: [], closes: [], segmentRequests: 0 };
  modelJournal = { bodies: [] };
}

/**
 * OD-28 (owner review M-04): the first `end_session` asks the recap question
 * and the session waits for one answer; a second `end_session` is the learner
 * leaving without answering, which gives the completed close at once. For the
 * tests whose subject is not the close itself.
 */
function endNow(socket: WebSocket): void {
  socket.send(JSON.stringify({ type: 'end_session' }));
  socket.send(JSON.stringify({ type: 'end_session' }));
}

describe('a real live session over a real websocket', () => {
  it('serves /health without any of the upstreams being healthy', async () => {
    const response = await fetch(`http://127.0.0.1:${oraclePort}/health`);
    const body = (await response.json()) as { data: { status: string; components: Record<string, string> } };
    expect(response.status).toBe(200);
    expect(body.data.status).toBe('ok');
  });

  it('greets the learner, answers a question, serves an activity and closes', async () => {
    freshJournal();
    sessionIsMinor = false;
    const { socket, closed } = open(await socketUrl());

    // ── handshake + opening line ──
    const opening = await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const ready = opening.find((m) => m.type === 'ready');
    expect(ready).toMatchObject({ sessionId: SESSION_ID, character: 'rho', locale: 'es-MX' });
    // No voice provider is configured, so the session is honestly silent.
    expect(ready).toMatchObject({ voice: false, microphone: false });

    const greeting = opening.find((m) => m.type === 'turn');
    expect(greeting).toMatchObject({ emotion: 'happy', audioUrl: null });
    // Ordinary delivery always promises a `turn_audio` frame will follow,
    // even for a pre-generated scripted line — only a resume redraw says
    // otherwise (see "audioPending" above). This is what lets the client
    // tell "the voice is still coming" apart from "no voice is coming".
    expect(greeting).toMatchObject({ audioPending: true });
    expect(String(greeting?.say)).not.toBe('');
    // WRITTEN, not generated: the opening line costs neither a model call nor
    // a synthesis, in this session or in any session ever again.
    expect(modelJournal.bodies).toHaveLength(0);

    // ── the learner says something ──
    const answered = collect(socket, (m) => m.filter((x) => x.type === 'turn').length >= 1);
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quiero ahorrar para una bici' }));
    const reply = (await answered).find((m) => m.type === 'turn');
    expect(String(reply?.say)).toContain('?');

    // ── the transcript was written, in order, with both speakers ──
    await new Promise((r) => setTimeout(r, 150));
    expect(journal.turns.some((t) => t.speaker === 'learner' && t.text.includes('bici'))).toBe(true);
    expect(journal.turns.some((t) => t.speaker === 'tutor' && t.source === 'model')).toBe(true);

    /*
     * EVERY ROW CLAIMS ITS OWN `seq`, AND THIS IS THE ASSERTION THAT MATTERED.
     *
     * `tutor_turns` is unique on `(session_id, seq)` and written with
     * `resolution=ignore-duplicates`, so two rows claiming one number means the
     * second is discarded IN SILENCE. The learner used to be numbered with
     * `orchestrator.turnCount` (the counter before a turn's increment) and the
     * tutor with `emission.seq` (the same counter after it), so every learner
     * line collided with the tutor line before it. Every transcript in
     * production was the tutor talking to itself, and the owner's written
     * feedback to the Tutor was thrown away by the database on arrival.
     *
     * The two assertions above did NOT catch it and could not: the fake Core
     * records every write it is handed, while the real one silently drops the
     * loser of a conflict. The harness modelled the call and not the
     * constraint (§1.14), so the only honest check is the property the
     * constraint actually enforces — uniqueness.
     */
    const seqs = journal.turns.map((t) => t.seq);
    expect(new Set(seqs).size, `duplicate seq in ${JSON.stringify(journal.turns)}`).toBe(seqs.length);

    // ── OD-28 (owner review M-04): "end" asks the recap question FIRST ──
    const { recapPromptText, completedCloseText } = await import('../tutor/scripted.js');
    const recapAsked = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'end_session' }));
    const recapFrames = await recapAsked;
    expect(recapFrames.find((m) => m.type === 'turn')).toMatchObject({ say: recapPromptText('es-MX'), next: 'ask' });
    // Scripted (no model call), and the session stays open for the answer.
    const modelCallsAtRecap = modelJournal.bodies.length;
    await new Promise((r) => setTimeout(r, 750));
    expect(modelJournal.bodies).toHaveLength(modelCallsAtRecap);
    expect(journal.closes).toHaveLength(0);
    expect(socket.readyState).toBe(WebSocket.OPEN);

    // ── the answer gets the reflection and the completed close, and the close is recorded ──
    const ending = collect(socket, (m) => m.some((x) => x.type === 'closed'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'que ahorrar poquito cada semana suma' }));
    const closing = await ending;
    expect(closing.find((m) => m.type === 'closed')).toMatchObject({ reason: 'completed' });
    expect(journal.closes).toHaveLength(1);
    expect(journal.closes.at(-1)).toMatchObject({ closeReason: 'completed' });
    // The last line before the close is the completed close naming the act.
    const closingTurns = closing.filter((m) => m.type === 'turn');
    expect(closingTurns.at(-1)).toMatchObject({ say: completedCloseText('es-MX', 'talked_through') });

    // C.16: the closing state reaches the client just before `closed` — the
    // completed script, naming the act the server observed (the learner
    // talked the idea through; nothing was graded).
    const summary = closing.find((m) => m.type === 'session_closing');
    expect(summary).toMatchObject({ type: 'session_closing', script: 'completed', effort: 'talked_through' });
    expect(closing.findIndex((m) => m.type === 'session_closing')).toBeLessThan(
      closing.findIndex((m) => m.type === 'closed'),
    );
    // …and the close records the script, the opening and the end-signal record.
    expect(journal.closes.at(-1)).toMatchObject({
      closingScript: 'completed',
      opening: 'greeting',
      endSignal: { evaluated: false, events: [] },
    });

    await closed();
  });

  it('C.16: opens with the re-engagement line Core queued after a silent dropout', async () => {
    freshJournal();
    servedOpening = 'reengage_left_fresh';
    try {
      const { socket } = open(await socketUrl());
      const opening = await collect(socket, (m) => m.some((x) => x.type === 'turn'));
      const greeting = opening.find((m) => m.type === 'turn');
      const { openingResponse } = await import('../tutor/scripted.js');
      expect(greeting?.say).toBe(openingResponse('rho', 'es-MX', 'reengage_left_fresh').say);
      // Still written, not generated.
      expect(modelJournal.bodies).toHaveLength(0);
      socket.close();
    } finally {
      servedOpening = null;
    }
  });

  it('C.8/C.12: refuses a forged stop-or-continue answer when no offer is open, without a model call', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const errored = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send(JSON.stringify({ type: 'session_end_response', accepted: true }));
    expect((await errored).find((m) => m.type === 'error')).toMatchObject({ code: 'NO_SESSION_END_OFFER' });
    expect(modelJournal.bodies).toHaveLength(0);
    expect(journal.closes).toHaveLength(0);
    expect(socket.readyState).toBe(WebSocket.OPEN);

    // A malformed answer is refused by the schema like any other frame.
    const invalid = collect(socket, (m) => m.filter((x) => x.type === 'error').length >= 1);
    socket.send(JSON.stringify({ type: 'session_end_response', accepted: 'yes' }));
    expect((await invalid).find((m) => m.type === 'error')).toMatchObject({ code: 'VALIDATION_ERROR' });

    socket.close();
  });

  it('C.19: refuses a forged check-in answer when no check-in is open, without a model call', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const errored = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send(JSON.stringify({ type: 'check_in_response', aligned: false }));
    expect((await errored).find((m) => m.type === 'error')).toMatchObject({ code: 'NO_CHECK_IN' });
    expect(modelJournal.bodies).toHaveLength(0);
    expect(journal.closes).toHaveLength(0);
    expect(socket.readyState).toBe(WebSocket.OPEN);

    const invalid = collect(socket, (m) => m.filter((x) => x.type === 'error').length >= 1);
    socket.send(JSON.stringify({ type: 'check_in_response', aligned: 'not really' }));
    expect((await invalid).find((m) => m.type === 'error')).toMatchObject({ code: 'VALIDATION_ERROR' });
    socket.close();
  });

  it('C.15/C.14/C.7 over a real websocket: honest introduction, goal chips, a forged goal answer refused, and the close record', async () => {
    freshJournal();
    const { resetConfigCache } = await import('../env.js');
    process.env.TUTOR_ALLIANCE_CONTROLLER = 'act';
    process.env.TUTOR_SELF_EXPLANATION = 'act';
    resetConfigCache();
    servedAllianceFields = {
      allianceContinuity: 'persona_switch',
      dispositionProfile: {
        sessionsObserved: 5,
        helpStyle: 'independent',
        persistence: 'persists',
        explanation: 'explains',
        persistentlyDeclined: ['less_text'],
        typicalTypedReplyMs: null,
        typicalSpokenReplyMs: null,
      },
    };
    let socket: WebSocket | null = null;
    try {
      socket = open(await socketUrl()).socket;
      const opening = await collect(socket, (m) => m.some((x) => x.type === 'turn'));
      const { continuityOpeningResponse } = await import('../tutor/scripted.js');
      expect(opening.find((m) => m.type === 'turn')?.say).toBe(continuityOpeningResponse('rho', 'es-MX', 'introduce').say);

      // A forged goal answer before any goal was proposed: refused, no model call.
      const errored = collect(socket, (m) => m.some((x) => x.type === 'error'));
      socket.send(JSON.stringify({ type: 'goal_response', agreed: true }));
      expect((await errored).find((m) => m.type === 'error')).toMatchObject({ code: 'NO_GOAL_CHECK' });
      expect(modelJournal.bodies).toHaveLength(0);
      const invalid = collect(socket, (m) => m.filter((x) => x.type === 'error').length >= 1);
      socket.send(JSON.stringify({ type: 'goal_response', agreed: 'sure' }));
      expect((await invalid).find((m) => m.type === 'error')).toMatchObject({ code: 'VALIDATION_ERROR' });

      // The first learner message: the restatement arrives with the goal chips.
      const proposed = collect(socket, (m) => m.some((x) => x.type === 'goal_check'));
      socket.send(JSON.stringify({ type: 'learner_text', text: 'quiero ahorrar para una bici' }));
      const frames = await proposed;
      expect(frames.findIndex((m) => m.type === 'turn')).toBeLessThan(frames.findIndex((m) => m.type === 'goal_check'));
      // (The last body is the moderation judge's: this is a minor's session.)
      expect(modelJournal.bodies.some((body) => body.includes('GOAL AGREEMENT'))).toBe(true);
      // The disposition projection never reaches the model.
      for (const body of modelJournal.bodies) expect(body).not.toMatch(/persistentlyDeclined|sessionsObserved|helpStyle/);

      // Past the per-learner turn-rate floor (MIN_TURN_INTERVAL_MS).
      await new Promise((r) => setTimeout(r, 750));
      const answered = collect(socket, (m) => m.filter((x) => x.type === 'turn').length >= 1);
      socket.send(JSON.stringify({ type: 'goal_response', agreed: true }));
      await answered;
      expect(modelJournal.bodies.some((body) => body.includes('confirmed the goal'))).toBe(true);

      const ending = collect(socket, (m) => m.some((x) => x.type === 'closed'));
      endNow(socket);
      await ending;
      const close = journal.closes.at(-1) as Record<string, unknown>;
      expect(close).toMatchObject({
        alliance: { mode: 'act', continuity: 'persona_switch', continuityMove: 'delivered', goalAgreement: 'agreed' },
        selfExplanation: { mode: 'act', prompts: 0, events: [] },
        disposition: { profileReceived: true, applied: ['seeded_declines'] },
      });
      expect(JSON.stringify(close)).not.toContain('bici');
    } finally {
      if (socket !== null && socket.readyState === WebSocket.OPEN) socket.close();
      servedAllianceFields = null;
      process.env.TUTOR_ALLIANCE_CONTROLLER = 'off';
      process.env.TUTOR_SELF_EXPLANATION = 'off';
      resetConfigCache();
    }
  });

  it("C.9: announces the optional context fields it parses, and accepts Core's rollback verdict", async () => {
    freshJournal();
    servedTelemetryMode = 'shadow';
    try {
      const { socket } = open(await socketUrl());
      await collect(socket, (m) => m.some((x) => x.type === 'turn'));
      expect(announcedContextFields).toBe(CONTEXT_OPTIONAL_FIELDS.join(','));
      const ending = collect(socket, (m) => m.some((x) => x.type === 'closed'));
      endNow(socket);
      await ending;
      // The session ran (the context parsed) and the layer reported in shadow.
      expect(journal.closes.at(-1)).toMatchObject({ behavioralTelemetry: { mode: 'shadow', actionTurns: 0 } });
    } finally {
      servedTelemetryMode = null;
    }
  });

  /*
   * Found by adversarial review, round 85, 2026-08-31 (MEDIUM) — the end-to-end
   * proof for the unit-level fix in `orchestrator.test.ts`'s "a segment
   * request the budget already refused is suppressed before delivery". A
   * turn could carry BOTH `next: 'segment'` (a real `segmentRequest`) and an
   * ended budget, and `deliver()` served the segment unconditionally before
   * ever consulting `closeReason` — a real activity handed to the learner
   * immediately followed by the socket closing under it. This drives the
   * ONE GRACE TURN trigger over a REAL socket: the fake model here has no
   * idea a grace turn even exists (it answers by keyword alone), so it is
   * exactly the disobedient model the bug needed — proof the fix holds
   * without any cooperation from what the model says.
   */
  it('never delivers a `segment` frame for an activity the closing session will never let the learner attempt', async () => {
    freshJournal();
    // A hard budget short enough to expire from a real wall-clock wait, but
    // long enough that the handshake, greeting and first exchange below
    // never race it — see the wait after the first exchange for the margin.
    process.env.SESSION_SOFT_BUDGET_MS = '300';
    process.env.SESSION_HARD_BUDGET_MS = '600';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();

    try {
      const { socket, closed } = open(await socketUrl());
      await collect(socket, (m) => m.some((x) => x.type === 'turn'));

      // An ordinary exchange whose tutor turn ends in `ask` — the open
      // thread the ONE grace turn exists to resolve rather than cut off.
      const opened = collect(socket, (m) => m.filter((x) => x.type === 'turn').length >= 1);
      socket.send(JSON.stringify({ type: 'learner_text', text: 'quierosaber mas' }));
      const openTurn = (await opened).find((m) => m.type === 'turn');
      expect(openTurn?.next).toBe('ask');

      // The hard budget expires with that question still open.
      await new Promise((r) => setTimeout(r, 700));

      // The learner answers — the grace turn fires, and the fake model (which
      // answers this exact phrase with next:"segment" on ANY turn, grace or
      // not) asks for one more activity instead of just saying goodbye.
      const frames = untilQuiet(socket);
      socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
      const collected = await frames;

      // The grace turn is still delivered — a real, in-character line — and
      // the session still closes for the real reason. What must never
      // appear is a `segment` frame: the activity the model asked for would
      // never have been attempted before the socket closed under it.
      const graceTurn = collected.find((m) => m.type === 'turn');
      expect(graceTurn?.next).toBe('ask');
      expect(collected.some((m) => m.type === 'segment')).toBe(false);
      expect(collected.some((m) => m.type === 'closed')).toBe(true);
      expect(collected.find((m) => m.type === 'closed')).toMatchObject({ reason: 'hard_budget' });
      // The strongest proof available: the content ladder was never even
      // asked. A frame-shape assertion alone could pass on a fix that only
      // hid the segment from the WIRE while still paying for it.
      expect(journal.segmentRequests).toBe(0);

      socket.close();
      await closed();
    } finally {
      delete process.env.SESSION_SOFT_BUDGET_MS;
      delete process.env.SESSION_HARD_BUDGET_MS;
      resetConfigCache();
    }
  });

  it('the whiteboard reaches the client with SERVER-COMPUTED values (V4)', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn' && x.whiteboard != null));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropizarron, cuentame una historia' }));
    const board = (await answered).find((m) => m.type === 'turn')?.whiteboard as
      | { kind: string; start: number; unit: string; label: string; currency: string; values: number[] }
      | undefined;

    expect(board).toMatchObject({
      kind: 'sequence',
      start: 10,
      unit: 'day',
      label: 'Cada día te dan 2 más',
      currency: 'MXN',
    });
    // 10 → 12 → 14, computed by Oracle from the model's own start/steps — not
    // asserted anywhere in the model's completion body.
    expect(board?.values).toEqual([10, 12, 14]);

    socket.close();
    await closed();
  });

  /*
   * THE SAME PROOF, FOR THE TWO ADDITIONAL BOARD KINDS (V4, /ORACLE.md
   * §20.5 backlog). `difference`/`greater` and each mark's `position` are
   * SERVER-COMPUTED fields with no counterpart anywhere in the model's own
   * completion body above (`wantsCompare`/`wantsMarkedLine`) — a real wire
   * frame carrying them is the only thing that proves the wire, not just
   * the orchestrator's in-process object, attaches them.
   */
  it('the comparison board reaches the client with SERVER-COMPUTED difference/greater (V4)', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn' && x.whiteboard != null));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quierocomparar, cuentame una historia' }));
    const board = (await answered).find((m) => m.type === 'turn')?.whiteboard as
      | {
          kind: string;
          left: { label: string; value: number };
          right: { label: string; value: number };
          difference: number;
          greater: string;
        }
      | undefined;

    expect(board).toMatchObject({
      kind: 'compare',
      left: { label: 'Tienda A', value: 45 },
      right: { label: 'Tienda B', value: 28 },
    });
    // Neither field is anywhere in the model's own completion body above —
    // both are computed by Oracle from the model's raw left/right values.
    expect(board?.difference).toBe(17);
    expect(board?.greater).toBe('left');

    socket.close();
    await closed();
  });

  it('the tokens board reaches the client with SERVER-COMPUTED subtotals and total', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn' && x.whiteboard != null));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieromonedas, cuentame una historia' }));
    const board = (await answered).find((m) => m.type === 'turn')?.whiteboard as
      | { kind: string; groups: { denomination: number; count: number }[]; subtotals: number[]; total: number }
      | undefined;

    expect(board).toMatchObject({
      kind: 'tokens',
      groups: [
        { denomination: 10, count: 3 },
        { denomination: 1, count: 4 },
      ],
    });
    // NEITHER field is anywhere in the model's own completion body above: the
    // schema gives it no place to put them, because the sum of a pile is the
    // arithmetic the learner is doing.
    expect(board?.subtotals).toEqual([30, 4]);
    expect(board?.total).toBe(34);

    socket.close();
    await closed();
  });

  it('the marked-line board reaches the client with each mark\'s SERVER-COMPUTED position (V4)', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn' && x.whiteboard != null));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quierorecta, cuentame una historia' }));
    const board = (await answered).find((m) => m.type === 'turn')?.whiteboard as
      | { kind: string; min: number; max: number; marks: { value: number; label: string; position: number }[] }
      | undefined;

    expect(board).toMatchObject({ kind: 'marked_line', min: 0, max: 40 });
    // `position` is nowhere in the model's own completion body above — it is
    // computed by Oracle from the model's raw min/max/value.
    expect(board?.marks).toEqual([
      { value: 22, label: 'Lo que tienes', position: 0.55 },
      { value: 35, label: 'Los audífonos', position: 0.875 },
    ]);

    socket.close();
    await closed();
  });

  /*
   * Found by adversarial review, round 35 (2026-08-30, HIGH): a whiteboard
   * reached the learner's own screen and NOWHERE else — `PersistTurnInput`
   * had no field for it, so the transcript row Core stores, and every
   * replay and guardian read of it, lost the board silently. This proves
   * the PERSISTED row carries the SAME server-computed values the wire
   * frame above does, not a second, potentially-drifted copy.
   */
  it('persists the whiteboard on the transcript row, not only on the wire', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn' && x.whiteboard != null));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropizarron, cuentame una historia' }));
    await answered;
    // The transcript write waits for synthesis and fires after the wire frame
    // — give it the same settling window every other persisted-turn
    // assertion in this file does.
    await new Promise((r) => setTimeout(r, 150));

    const persisted = journal.turns.find((t) => t.speaker === 'tutor' && t.whiteboard != null);
    expect(persisted?.whiteboard).toMatchObject({ values: [10, 12, 14] });

    socket.close();
    await closed();
  });

  it('the tray-demonstration steps reach the client on the wire (v3)', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn' && x.demonstrate != null));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'muestramelamoneda, no entendi' }));
    const steps = (await answered).find((m) => m.type === 'turn')?.demonstrate as
      | { kind: string; denomination?: number }[]
      | undefined;

    expect(steps).toEqual([
      { kind: 'add', denomination: 10 },
      { kind: 'add', denomination: 5 },
    ]);

    socket.close();
    await closed();
  });

  /*
   * Found while investigating ORACLE.md §19.5's "replaying `demonstrate`
   * animations" backlog item, 2026-09-01 — the identical shape round 35
   * found for the whiteboard above, on the tutor's OTHER v3 visual field:
   * `PersistTurnInput` had no field for `demonstrate` and neither tutor-turn
   * `persistTurn` call site passed one, so a session where the tutor's hands
   * moved a coin left no trace once the live socket closed. Migration 0067
   * adds the column this proves the write path now actually uses.
   */
  it('persists the tray-demonstration steps on the transcript row, not only on the wire', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn' && x.demonstrate != null));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'muestramelamoneda, no entendi' }));
    await answered;
    // Same settling window as the whiteboard persistence test above: the
    // transcript write is fire-and-forget behind the audio synthesis promise.
    await new Promise((r) => setTimeout(r, 150));

    const persisted = journal.turns.find((t) => t.speaker === 'tutor' && t.demonstrate != null);
    expect(persisted?.demonstrate).toEqual([
      { kind: 'add', denomination: 10 },
      { kind: 'add', denomination: 5 },
    ]);

    socket.close();
    await closed();
  });

  it('sends the model NOTHING that identifies the learner', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    // The greeting is scripted now, so the first thing that reaches the model
    // is a learner turn. Drive one, or this asserts about an empty journal.
    // (`collect` starts a fresh buffer, so one more turn is the whole wait.)
    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quiero ahorrar para una bici' }));
    await answered;

    const sent = modelJournal.bodies.join('\n');
    expect(sent).not.toBe('');
    expect(sent).not.toContain(USER_ID);
    expect(sent).not.toContain(SESSION_ID);
    // The nickname is the ONE name-shaped value permitted to travel (§4.1).
    expect(sent).toContain('Robi');

    socket.close();
  });

  it('serves an activity when the tutor asks for one, and reacts to the result', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    // The tutor requests an activity; the ladder serves it with a real id.
    const servedAt = collect(socket, (m) => m.some((x) => x.type === 'segment'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    const served = (await servedAt).find((m) => m.type === 'segment') as { segmentId: string };
    expect(served.segmentId).toBe(SEGMENT_ID);

    // The client reports a graded result FOR THAT SEGMENT; the tutor reacts
    // to the actual score. (The per-turn floor applies between turns.)
    await new Promise((r) => setTimeout(r, 750));
    const reacted = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(
      JSON.stringify({ type: 'segment_graded', segmentId: served.segmentId, score: 100, correct: true }),
    );
    const reaction = (await reacted).find((m) => m.type === 'turn');
    expect(reaction).toBeDefined();

    // The model was told the outcome, so it can praise the thinking rather
    // than read the number out.
    expect(modelJournal.bodies.join('\n')).toContain('scored 100');

    socket.close();
  });

  /*
   * ROUND 74: THE BAND CORE ACTUALLY SERVED CROSSES THE SOCKET.
   *
   * The controller and the response schema each have their own unit tests.
   * What neither can see is the ARGUMENT — `ws/server.ts` reading
   * `served.servedDifficulty` off Core's answer and handing it to
   * `noteSegmentServed`. A line that silently never happens is exactly the
   * class §1.14 keeps paying for, so it is asserted here, over the real
   * socket, against the real ladder response.
   *
   * The observable is the controller's own two-band content-gap warning: the
   * plan asks for band 5, the fake Core answers with band 1, and nothing can
   * produce that line unless the value travelled the whole way.
   */
  it('carries the difficulty Core actually served into the controller', async () => {
    freshJournal();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    servedSessionPlan = [
      {
        kcId: '55555555-5555-4555-8555-555555555555',
        kcKey: 'money.saving',
        skillKey: null,
        reason: 'frontier',
        pKnown: 0.4,
        targetDifficulty: 5,
        objective: 'Ahorrar un poco cada semana.',
        prereqKcIds: [],
        misconceptions: [],
      },
    ];
    servedSegmentDifficulty = 1;

    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const servedAt = collect(socket, (m) => m.some((x) => x.type === 'segment'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    await servedAt;

    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('the ladder served difficulty 1 for a request at 5'))).toBe(true);

    socket.close();
  });

  /*
   * ══ ROUND 76: ONE UTTERANCE, A BOUNDED NUMBER OF LADDER ATTEMPTS ══
   *
   * `deliver()` and `serveSegment()` are mutually recursive, and until round 76
   * nothing counted the trips. A turn asks for an activity; the ladder has
   * none; `handleSegmentUnavailable()` produces a recovery turn; that turn goes
   * out through the SAME `deliver()` and can ask for an activity of its own —
   * forever. Reproduced by stashing the fix and running the first test below:
   * a single `learner_text` frame produced 20 ladder requests and 21 turns,
   * each cycle a real model completion, a real judge completion and a real
   * Core round trip.
   *
   * WHAT STOPPED IT AT TWENTY WAS THIS HARNESS, NOT THE PRODUCT — worth
   * knowing before trusting any number this file reports about a runaway.
   * `SESSION_MAX_TURNS` is 120 and the run ended at turn 22 with the budget
   * still `running`; `TURN_HISTORY_WINDOW` is also 20, so the learner's line
   * scrolled out of the model's context and the fake model's keyword trigger
   * (`quieropracticarya`) went with it. Round 74 filed the defect as "bounded
   * only by the session turn cap" on exactly this evidence, and that was an
   * inference from two numbers that happen to be equal.
   *
   * The fake model here is the adversarial case ON PURPOSE: it keeps asking
   * for an activity while the learner's line is in the working history, and it
   * ignores the recovery instruction entirely — which is what makes the fix a
   * bound rather than a request. The four tests below are the two halves of
   * the claim: the runaway is capped (in both the cheap and the EXPENSIVE
   * failure shape), and the legitimate paths are untouched.
   */
  it('bounds an empty ladder: one utterance cannot buy an unbounded run of turns', async () => {
    freshJournal();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    segmentFailuresLeft = Number.POSITIVE_INFINITY;

    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const modelCallsBefore = modelJournal.bodies.length;

    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    const frames = await untilQuiet(socket);

    // MAX_SEGMENT_RETRIES is 1, so one utterance reaches the ladder twice —
    // the original request and the single retry the bound deliberately keeps.
    expect(journal.segmentRequests).toBe(2);

    // Three turns reach the child: the one that asked, and the two recovery
    // turns that teach the idea by hand. The third refusal never produces a
    // fourth, which is where the loop used to live.
    expect(frames.filter((f) => f.type === 'turn')).toHaveLength(3);

    // THE COST, stated as a number rather than as a hope. One author
    // completion per turn, and nothing else off this one utterance.
    const authored = modelJournal.bodies
      .slice(modelCallsBefore)
      .filter((b) => !b.includes('child-safety reviewer'));
    expect(authored).toHaveLength(3);

    // Nothing is silently dropped: the client's "preparing something"
    // placeholder is cleared every time, including on the refused attempt.
    expect(frames.filter((f) => f.type === 'error' && f.code === 'NO_SEGMENT').length).toBeGreaterThanOrEqual(2);

    // LOUD, not silent — the refusal names itself in the log (§1.0).
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('refused segment request #3'))).toBe(true);

    socket.close();
  }, 30_000);

  /*
   * THE SAME BOUND, ON THE SHAPE THAT ACTUALLY COSTS MONEY. `empty` is one
   * Core round trip; `needsGeneration` hands tier 3 back to Oracle, which pays
   * for real author completions before reaching the same conclusion. A bound
   * proved only on the cheap shape is not a cost bound.
   */
  it('bounds a ladder that keeps handing tier 3 back, PAID author calls included', async () => {
    freshJournal();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    segmentFailuresLeft = Number.POSITIVE_INFINITY;
    segmentFailureShape = 'needs_generation';

    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const modelCallsBefore = modelJournal.bodies.length;

    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    const frames = await untilQuiet(socket);

    expect(journal.segmentRequests).toBe(2);
    expect(frames.filter((f) => f.type === 'turn')).toHaveLength(3);

    // 3 turn completions + 2 generation attempts × 2 author tries each. Every
    // one of those seven is billed; before the bound there was no ceiling on
    // any of them.
    const authored = modelJournal.bodies
      .slice(modelCallsBefore)
      .filter((b) => !b.includes('child-safety reviewer'));
    expect(authored).toHaveLength(7);

    socket.close();
  }, 30_000);

  /*
   * C.5 (S06.12): when Core answers that live generation is SUSPENDED for
   * this content-risk category, Oracle makes no author or judge call at all
   * (the item would be refused, and the call would cost money), and the
   * Mentor carries on in conversation exactly as when nothing is available.
   */
  it('makes no paid author call when Core suspends live generation', async () => {
    freshJournal();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    segmentFailuresLeft = Number.POSITIVE_INFINITY;
    segmentFailureShape = 'live_suspended';

    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const modelCallsBefore = modelJournal.bodies.length;

    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    const frames = await untilQuiet(socket);

    expect(journal.segmentRequests).toBe(2);
    expect(frames.filter((f) => f.type === 'error' && f.code === 'NO_SEGMENT').length).toBeGreaterThanOrEqual(1);
    // Only turn completions: not one activity-author or content-judge call.
    const authored = modelJournal.bodies.slice(modelCallsBefore).filter((b) => b.includes('You author ONE practice activity'));
    expect(authored).toHaveLength(0);
    expect(modelJournal.bodies.slice(modelCallsBefore).some((b) => b.includes('You review ONE practice activity'))).toBe(false);

    socket.close();
  }, 30_000);

  /*
   * THE CONTROL. The bound is about REPEATED FAILURES within one utterance,
   * never about the ladder's own internal rungs (nearest-band, the
   * prerequisite walk, the frontier fallback — round 59), which all live
   * inside a single `requestSegment` call. A segment that IS available still
   * costs exactly one call and produces exactly one activity.
   */
  it('leaves the ordinary success alone: one ladder call, one activity, no recovery turn', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    const frames = await untilQuiet(socket);

    expect(journal.segmentRequests).toBe(1);
    expect(frames.filter((f) => f.type === 'segment')).toHaveLength(1);
    expect(frames.filter((f) => f.type === 'turn')).toHaveLength(1);
    expect(frames.filter((f) => f.type === 'error')).toHaveLength(0);

    socket.close();
  }, 15_000);

  /*
   * THE OTHER CONTROL, and the reason the bound is ONE retry rather than zero:
   * a ladder that misses once and then serves must still reach the child. This
   * is the path that would break if a fix simply refused every recovery turn's
   * request.
   */
  it('still serves an activity when the ladder misses once and then finds one', async () => {
    freshJournal();
    segmentFailuresLeft = 1;

    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    const frames = await untilQuiet(socket);

    expect(journal.segmentRequests).toBe(2);
    // The retry landed: the learner gets the activity, one recovery turn later.
    expect(frames.filter((f) => f.type === 'segment')).toHaveLength(1);
    expect(frames.filter((f) => f.type === 'turn')).toHaveLength(2);
    expect(frames.filter((f) => f.type === 'error' && f.code === 'NO_SEGMENT')).toHaveLength(1);

    socket.close();
  }, 15_000);

  it('lets the learner rephrase their last message — the working history rewinds one exchange', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quiero ahorrar para una bici' }));
    await answered;

    await new Promise((r) => setTimeout(r, 750));
    const revised = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'learner_edit', text: 'quiero ahorrar para una patineta' }));
    expect((await revised).find((m) => m.type === 'turn')).toBeDefined();

    // The model's LAST request carries the rephrasing and NOT the original
    // pair it replaced: the tutor answers the new question, not a
    // conversation arguing with itself.
    const lastAuthorBody = [...modelJournal.bodies]
      .reverse()
      .find((b) => !b.includes('child-safety reviewer'));
    expect(lastAuthorBody).toContain('patineta');
    expect(lastAuthorBody).not.toContain('bici');

    // The persisted transcript keeps BOTH learner lines — append-only, as a
    // guardian-readable record must be.
    await new Promise((r) => setTimeout(r, 150));
    const learnerLines = journal.turns.filter((t) => t.speaker === 'learner');
    expect(learnerLines.some((t) => t.text.includes('bici'))).toBe(true);
    expect(learnerLines.some((t) => t.text.includes('patineta'))).toBe(true);

    socket.close();
  });

  it('refuses a grade for an activity this session never served', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const before = modelJournal.bodies.length;

    const refused = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send(
      JSON.stringify({ type: 'segment_graded', segmentId: SEGMENT_ID, score: 100, correct: true }),
    );
    expect((await refused).find((m) => m.type === 'error')).toMatchObject({ code: 'UNKNOWN_SEGMENT' });
    // A fabricated id used to buy a model turn and a glowing reaction to an
    // activity that never existed. Now it buys nothing.
    expect(modelJournal.bodies).toHaveLength(before);

    socket.close();
  });

  it('never lets a flagged utterance reach the model, and stops the session', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const before = modelJournal.bodies.length;

    const stopping = collect(socket, (m) => m.some((x) => x.type === 'closed'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'ya no quiero vivir' }));
    const messages = await stopping;

    // Not one extra model call: the classifier runs BEFORE the model, and once
    // text is in a context window nothing downstream can recall it.
    expect(modelJournal.bodies).toHaveLength(before);

    const turn = messages.find((m) => m.type === 'turn');
    expect(String(turn?.say)).toContain('adulta');
    await new Promise((r) => setTimeout(r, 150));
    expect(journal.flags.at(-1)).toMatchObject({ category: 'self_harm', handled: 'session_stopped' });

    await closed();
  });

  /*
   * Found by adversarial review, round 67 (2026-08-30, HIGH): the SAME
   * self-harm classification as the test above, raised through
   * `handleVoiceCheckResult` (a spoken/checked answer to an open CHECKABLE
   * activity) instead of `handleLearnerText`. The voice-check `deliver()`
   * call used to omit `learnerTurnSeq` entirely, so the persisted flag's
   * `turnSeq` fell back to `safety.turnSeq` — the orchestrator's own
   * internal per-model-turn counter, a completely different numbering space
   * from `tutor_turns.seq` — silently defeating the guardian page's
   * flagged-turn highlight (round 41) and migration 0054's recall exclusion
   * for every flag raised this way.
   */
  it('persists a voice-checked safety flag under the REAL transcript row, not the model-turn counter', async () => {
    freshJournal();
    // A CHECKABLE type, so the next utterance routes through
    // `handleVoiceCheckResult` rather than the ordinary text path.
    servedSegmentType = 'number_input';
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const served = collect(socket, (m) => m.some((x) => x.type === 'segment'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    await served;
    // Past MIN_TURN_GAP_MS (700ms), same as every other multi-turn test.
    await new Promise((r) => setTimeout(r, 750));

    const FLAGGED_TEXT = 'ya no quiero vivir';
    const stopping = collect(socket, (m) => m.some((x) => x.type === 'closed'));
    socket.send(JSON.stringify({ type: 'learner_text', text: FLAGGED_TEXT }));
    await stopping;
    await new Promise((r) => setTimeout(r, 150));

    const learnerRow = journal.turns.find((t) => t.speaker === 'learner' && t.text === FLAGGED_TEXT);
    expect(learnerRow).toBeDefined();

    const flag = journal.flags.at(-1);
    expect(flag).toMatchObject({ category: 'self_harm', handled: 'session_stopped' });
    // THE ASSERTION THAT MATTERS: the flag names the utterance's OWN
    // transcript row, not the orchestrator's internal turn counter (a much
    // smaller number at this point in the session — greeting, one exchange,
    // then this one — that used to leak into `turnSeq` and never matched a
    // real row).
    expect(flag?.turnSeq).toBe(learnerRow?.seq);

    await closed();
  });

  /*
   * Found by adversarial review, round 29 (2026-08-30, CRITICAL): a
   * `personal_data` classification BLOCKS the turn from ever reaching the
   * model (unlike `self_harm` above, it does not stop the session — the
   * conversation keeps going with a scripted line) and writes a
   * `tutor_safety_flags` row that migration 0054's episodic recall query
   * excludes on. That write used to be a bare fire-and-forget with no
   * retry and no failure counter, unlike every transcript write in this
   * same file — so a systematically failing flag write (a Core hiccup,
   * exactly as plausible here as for a transcript write) meant the child's
   * own address/phone/email sat in `tutor_turns` with no corresponding
   * flag, ready to resurface verbatim to the model on a later "¿te
   * acuerdas...?" recall. This proves the fix: the flag write now shares
   * `persistTurn`'s own `PERSIST_FAILURE_LIMIT` discipline, so a Core that
   * cannot confirm the flag closes the session instead of silently
   * accepting an unconfirmed safety record forever.
   */
  it('closes the session once safety-flag writes go unconfirmed enough times — the same discipline transcript writes already have', async () => {
    // Four paced 750ms gaps (MIN_TURN_GAP_MS) plus round trips comfortably
    // exceed the suite's default 5s test timeout.
    freshJournal();
    flagsShouldFail = true;
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    // Four personal_data turns: each is BLOCKED before the model but still
    // answered with a scripted line, so the session stays open after each
    // one on its own — `personal_data` alone never stops a session.
    for (let i = 0; i < 4; i += 1) {
      const turnReply = collect(socket, (m) => m.some((x) => x.type === 'turn'));
      socket.send(JSON.stringify({ type: 'learner_text', text: `mi telefono es 555000000${i}` }));
      await turnReply;
      expect(socket.readyState).toBe(WebSocket.OPEN);
      // Past MIN_TURN_GAP_MS (700ms), same as every other multi-turn test.
      await new Promise((r) => setTimeout(r, 750));
    }

    // The FIFTH consecutive unconfirmed flag write crosses
    // PERSIST_FAILURE_LIMIT — the session closes instead of answering.
    const closing = closed();
    socket.send(JSON.stringify({ type: 'learner_text', text: 'mi telefono es 5550000009' }));
    await closing;

    expect(journal.flags).toHaveLength(5);
    expect(
      journal.flags.every((f) => f.category === 'personal_data' && f.handled === 'turn_blocked'),
    ).toBe(true);
  }, 10_000);

  it('answers an unparseable frame with an error and keeps the session alive', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const errored = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send('this is not json');
    expect((await errored).find((m) => m.type === 'error')).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(socket.readyState).toBe(WebSocket.OPEN);

    socket.close();
  });

  it('rejects an audio frame when the microphone is not enabled', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const errored = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send(JSON.stringify({ type: 'learner_audio', audio: 'AAAA', mimeType: 'audio/webm' }));
    expect((await errored).find((m) => m.type === 'error')).toMatchObject({ code: 'CONSENT_REQUIRED' });

    socket.close();
  });
});

describe('the turn pipeline is split, acknowledged, and interruptible', () => {
  it('acknowledges a learner turn with `thinking`, then text, then its own audio frame', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    // The greeting's own `turn_audio` can straggle into this buffer, so the
    // predicate demands the audio frame FOR the turn this test provokes.
    const settled = collect(socket, (m) => {
      const turn = m.find((x) => x.type === 'turn') as { seq?: number } | undefined;
      return Boolean(turn) && m.some((x) => x.type === 'turn_audio' && x.seq === turn?.seq);
    });
    socket.send(JSON.stringify({ type: 'learner_text', text: 'quiero ahorrar para una bici' }));
    const messages = await settled;

    // The ORDER is the contract: the server says "working on it" before any
    // upstream returns, ships the moderated text as soon as it exists, and
    // the voice arrives in its own frame — never holding the text hostage.
    const types = messages.map((m) => m.type);
    const thinkingAt = types.indexOf('thinking');
    const turnAt = types.indexOf('turn');
    const audioAt = types.indexOf('turn_audio');
    expect(thinkingAt).toBeGreaterThanOrEqual(0);
    expect(turnAt).toBeGreaterThan(thinkingAt);
    expect(audioAt).toBeGreaterThan(turnAt);

    const turn = messages[turnAt] as { seq: number; audioUrl: unknown };
    const audio = messages[audioAt] as { seq: number; audioUrl: unknown };
    expect(turn.audioUrl).toBeNull();
    // Matched by seq, and honest about silence: no voice provider is
    // configured, so the clip resolves to null rather than never arriving.
    expect(audio.seq).toBe(turn.seq);
    expect(audio.audioUrl).toBeNull();

    socket.close();
  });

  it('answers a keepalive ping with the real budget, not a placeholder', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(socket, (m) => m.some((x) => x.type === 'state'));
    socket.send(JSON.stringify({ type: 'ping' }));
    const state = (await answered).find((m) => m.type === 'state') as {
      budget: string;
      remainingMs: number;
    };
    expect(state.budget).toBe('running');
    // The session just opened, so nearly the whole soft budget remains. The
    // old handler reported 0 here, which read on screen as "no time left".
    expect(state.remainingMs).toBeGreaterThan(60_000);

    socket.close();
  });

  it('aborts an in-flight production when the learner interrupts', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    // The marker makes the fake model sit for 1.5 s; the interrupt lands well
    // inside that window. What must come back is a state frame and NO turn.
    const outcome = collect(socket, (m) => m.some((x) => x.type === 'state'), 4_000);
    socket.send(JSON.stringify({ type: 'learner_text', text: 'cuentamelotodomuydespacio' }));
    await new Promise((r) => setTimeout(r, 300));
    socket.send(JSON.stringify({ type: 'interrupt' }));
    const messages = await outcome;

    expect(messages.some((m) => m.type === 'thinking')).toBe(true);
    expect(messages.some((m) => m.type === 'turn')).toBe(false);

    // The session is alive and answers the next question normally. The wait
    // is the per-turn floor: an interrupted turn still claimed its slot, so
    // the recovery message must respect the same 700 ms everyone does.
    await new Promise((r) => setTimeout(r, 750));
    const recovered = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'mejor dime cómo empiezo' }));
    expect((await recovered).find((m) => m.type === 'turn')).toBeDefined();

    socket.close();
  });

  it('treats an interrupt outside any turn as nothing at all', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    socket.send(JSON.stringify({ type: 'interrupt' }));
    await new Promise((r) => setTimeout(r, 200));
    expect(socket.readyState).toBe(WebSocket.OPEN);

    socket.close();
  });

  /*
   * Found by adversarial review, round 90 (2026-08-31, MEDIUM): a learner
   * pressing "Start over"/"Finish" on the frontend during the ORDINARY
   * `awaitingReply` window — the tutor still producing its reply, which
   * happens on every single turn — sent `end_session` straight into a turn
   * slot `claimTurn` correctly reports `'busy'`. The handler used to answer
   * that with `refuseTurn` and nothing else: `farewell()`/`finish()` were
   * never reached, so the session recorded `learner_left` once the resume
   * grace window passed instead of `completed`, and no farewell turn was
   * ever produced — contradicting /ORACLE.md §9.5's "not a timeout that
   * kills a socket" for a learner who left on purpose. `end_session` now
   * DEFERS on a busy floor (`Live.endSessionRequested`) instead of
   * refusing, and the busy turn's own `releaseTurn` retries it the instant
   * the floor frees. This proves the whole chain with the client still
   * listening: the slow reply still lands, no `RATE_LIMITED` refusal ever
   * fires for the deferred request, the Mentor's reaction to it follows as
   * its own real turn, and the close is recorded `completed`.
   *
   * Since OD-28 (owner review M-04) that reaction is the recap question, and
   * the close follows the learner's next move — here a second "end", the
   * learner leaving without answering.
   */
  it('defers an end_session that lands mid-turn instead of dropping it, and still asks the recap and closes', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const { recapPromptText } = await import('../tutor/scripted.js');

    // The marker makes the fake model sit for 1.5 s; `end_session` sent
    // partway through that window is guaranteed to land while `claimTurn`
    // still reports the floor busy.
    const asked = collect(socket, (m) => m.some((x) => x.type === 'turn' && x.say === recapPromptText('es-MX')), 4_000);
    socket.send(JSON.stringify({ type: 'learner_text', text: 'cuentamelotodomuydespacio' }));
    await new Promise((r) => setTimeout(r, 300));
    socket.send(JSON.stringify({ type: 'end_session' }));
    const beforeClose = await asked;

    // Never refused: the request was deferred, not dropped on the floor.
    expect(beforeClose.some((m) => m.type === 'error' && m.code === 'RATE_LIMITED')).toBe(false);
    // The slow turn's own reply still lands, and the recap question follows
    // it as its own real turn — two turns in this one run, not a dropped request.
    expect(beforeClose.filter((m) => m.type === 'turn').length).toBeGreaterThanOrEqual(2);
    expect(beforeClose.some((m) => m.type === 'closed')).toBe(false);

    const outcome = collect(socket, (m) => m.some((x) => x.type === 'closed'), 4_000);
    socket.send(JSON.stringify({ type: 'end_session' }));
    const messages = await outcome;
    expect(messages.some((m) => m.type === 'error' && m.code === 'RATE_LIMITED')).toBe(false);
    expect(messages.find((m) => m.type === 'session_closing')).toMatchObject({ script: 'completed' });
    expect(messages.find((m) => m.type === 'closed')).toMatchObject({ reason: 'completed' });

    await new Promise((r) => setTimeout(r, 150));
    expect(journal.closes.at(-1)).toMatchObject({ closeReason: 'completed' });

    await closed();
  });

  /*
   * The realistic shape of the race, not just the wire-level one above: the
   * frontend's actual `onRestart`/`onExit` (`TutorExperience.tsx`) fire
   * `end_session` and tear their OWN socket down immediately, without
   * waiting to learn whether the request succeeded. That close reaches this
   * socket's `close` handler while the busy turn is still running — well
   * before the deferred farewell has had a chance to set `live.closing` —
   * so it parks the session exactly as it would an honest dropped
   * connection. `finish()` now cancels that dangling park the moment the
   * deferred `end_session` actually completes; without it, the session's
   * OWN grace window (`SESSION_RESUME_GRACE_MS`, 1.5 s in this suite) would
   * finalize the same session a second time as `learner_left` — overwriting
   * nothing in a real Postgres row (`closeTutorSession`'s `ended_at IS NULL`
   * guard makes the reason itself a no-op), but still paying for a second,
   * pointless `runPostSessionReview` model call on a session that already
   * got its real one.
   */
  it('still closes completed, exactly once, when the learner\'s own socket tears down right behind end_session', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    socket.send(JSON.stringify({ type: 'learner_text', text: 'cuentamelotodomuydespacio' }));
    await new Promise((r) => setTimeout(r, 400));
    // Fire and abandon, exactly as `TutorExperience.tsx` does today: no
    // acknowledgement is awaited before the socket goes.
    socket.send(JSON.stringify({ type: 'end_session' }));
    socket.close();
    await closed();

    // Long enough for the busy turn to finish, the deferred farewell to run
    // and close gracefully, AND for the session's own resume grace window to
    // fully elapse — the window an uncancelled park would need to finalize
    // itself as `learner_left` behind the graceful close.
    await new Promise((r) => setTimeout(r, 3_000));

    expect(journal.closes.at(-1)).toMatchObject({ closeReason: 'completed' });
    expect(journal.closes).toHaveLength(1);
  });

  /*
   * OD-28 (owner review M-04), against the client that exists today: the
   * frontend fires `end_session` and tears its socket down at once
   * (`TutorExperience.tsx`'s `onExit`/`onRestart`), so nobody is left to
   * answer the recap question the press now asks. The learner asked to leave:
   * the session must still close `completed`, promptly (the closing screen
   * posts the bond proxy against a CLOSED session), and exactly once — never
   * parked until the grace window turns it into `learner_left`.
   */
  it('OD-28: end_session on a free floor, then the socket torn down at once, still closes completed promptly and once', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const { recapPromptText, completedCloseText } = await import('../tutor/scripted.js');

    socket.send(JSON.stringify({ type: 'end_session' }));
    socket.close();
    await closed();

    // Well inside this suite's 1.5 s `SESSION_RESUME_GRACE_MS`: not a park
    // waiting to be finalized.
    await new Promise((r) => setTimeout(r, 700));
    expect(journal.closes).toHaveLength(1);
    expect(journal.closes[0]).toMatchObject({ closeReason: 'completed', closingScript: 'completed' });

    // Past the grace window: still exactly one close, never a later `learner_left`.
    await new Promise((r) => setTimeout(r, 1_800));
    expect(journal.closes).toHaveLength(1);
    // The transcript holds what was said: the recap question, then the completed close.
    const tutorLines = journal.turns.filter((t) => t.speaker === 'tutor').map((t) => t.text);
    expect(tutorLines).toContain(recapPromptText('es-MX'));
    expect(tutorLines).toContain(completedCloseText('es-MX', 'none'));
    expect(tutorLines.filter((t) => t === completedCloseText('es-MX', 'none'))).toHaveLength(1);
  });

  it('OD-28: a socket that drops while the recap asked on "end" waits closes completed, not as a silent dropout', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const asked = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'end_session' }));
    await asked;
    await new Promise((r) => setTimeout(r, 200));
    expect(journal.closes).toHaveLength(0);

    socket.close();
    await closed();
    await new Promise((r) => setTimeout(r, 2_500));
    expect(journal.closes).toHaveLength(1);
    expect(journal.closes[0]).toMatchObject({ closeReason: 'completed', closingScript: 'completed' });
  });

  /*
   * OD-28 (owner review M-04): the learner is never trapped behind the
   * question. A recap asked on "end" that gets no answer closes as completed
   * once `RECAP_ANSWER_WAIT_MS` passes, driven by the existing heartbeat.
   * Only `setInterval` and `Date` are faked, so the sockets and the fake
   * upstreams still run on real I/O; each beat lets the real ping/pong round
   * trip land so the liveness check keeps seeing a live socket.
   */
  it('OD-28: an unanswered recap asked on "end" closes as completed when its wait runs out', async () => {
    freshJournal();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: Date.now() });
    try {
      const { RECAP_ANSWER_WAIT_MS } = await import('../ws/server.js');
      const { socket, closed } = open(await socketUrl());
      await collect(socket, (m) => m.some((x) => x.type === 'turn'));

      const asked = collect(socket, (m) => m.some((x) => x.type === 'turn'));
      socket.send(JSON.stringify({ type: 'end_session' }));
      await asked;
      await new Promise((r) => setTimeout(r, 200));

      const ending = collect(socket, (m) => m.some((x) => x.type === 'closed'), 6_000);
      let waitedMs = 0;
      for (let beat = 0; beat < 8 && journal.closes.length === 0; beat += 1) {
        vi.advanceTimersByTime(30_000);
        waitedMs += 30_000;
        await new Promise((r) => setTimeout(r, 150));
        // Nothing closes before the wait is over.
        if (waitedMs <= RECAP_ANSWER_WAIT_MS) expect(journal.closes).toHaveLength(0);
      }
      const messages = await ending;
      expect(waitedMs).toBeGreaterThan(RECAP_ANSWER_WAIT_MS);
      expect(messages.find((m) => m.type === 'session_closing')).toMatchObject({ script: 'completed', effort: 'none' });
      expect(messages.find((m) => m.type === 'closed')).toMatchObject({ reason: 'completed' });
      await new Promise((r) => setTimeout(r, 150));
      expect(journal.closes).toHaveLength(1);
      expect(journal.closes[0]).toMatchObject({ closeReason: 'completed' });
      await closed();
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  it('OD-28: the recap wait expires only for a pending recap asked on "end", with the floor free, inside the idle window', async () => {
    const { recapWaitExpired, RECAP_ANSWER_WAIT_MS } = await import('../ws/server.js');
    const { getConfig } = await import('../env.js');
    const base = { recapPending: true, closing: false, inFlight: false, lastActivityAtMs: 1_000 };
    const late = 1_000 + RECAP_ANSWER_WAIT_MS + 1;
    expect(recapWaitExpired(base, 1_000 + RECAP_ANSWER_WAIT_MS)).toBe(false);
    expect(recapWaitExpired(base, late)).toBe(true);
    expect(recapWaitExpired({ ...base, recapPending: false }, late)).toBe(false);
    // A turn holding the floor (the answer being produced) is never cut off.
    expect(recapWaitExpired({ ...base, inFlight: true }, late)).toBe(false);
    expect(recapWaitExpired({ ...base, closing: true }, late)).toBe(false);
    // It is what bounds the wait: shorter than the idle close that would otherwise.
    expect(RECAP_ANSWER_WAIT_MS).toBeLessThan(getConfig().SESSION_IDLE_TIMEOUT_MS);
  });

  /*
   * THE REVERSE ORDERING of the race the test above closes — round 98
   * (2026-08-31, MEDIUM, adversarial review sweep tutor-review-sweep-92).
   *
   * That test's own comment already explains the shape: the learner's real
   * socket tears down immediately behind `end_session`, `live.closing` is
   * still false when the `close` handler runs, and `parkSession` arms a
   * `SESSION_RESUME_GRACE_MS` timer exactly as it would an honest dropped
   * connection. Above, the busy turn ahead of the deferred farewell resolves
   * WELL inside that window, so `finish()`'s own `takeParked` cancels the
   * dangling park before it ever fires.
   *
   * The original finding blamed a slow FAREWELL for the reverse case — wrong:
   * `farewell()` calls a fully scripted outcome (`orchestrator.ts`, see its
   * own doc comment) with no model call at all, so it adds no latency worth
   * naming. The real mechanism, confirmed by reading the actual call chain,
   * is that the BUSY TURN ahead of the farewell can, on its own — via
   * stacked `MODEL_TIMEOUT_MS` retries, a tier-3 segment-generation chain and
   * moderation's own retry deadline — already plausibly approach or exceed
   * `SESSION_RESUME_GRACE_MS` before the farewell is ever reached. This test
   * reproduces exactly that: `slowTurnDelayMs` outlasts the grace window on
   * its own, with the farewell playing no part in the timing at all.
   *
   * When `finalizeParked`'s timer wins, it closes the session as
   * `learner_left` with whatever cost existed at THAT moment (its own doc
   * comment: cost "only increments when a synthesis promise actually
   * settles" — this turn's real cost is not in it yet) and deletes the park
   * entry. The slow turn eventually resolves, defers into the farewell, and
   * `finish()` — finding nothing left in `parkedSessions` for `takeParked`
   * to cancel — used to call `closeSession` unconditionally and never look
   * at what came back: `closeTutorSession`'s `ended_at=is.null` PATCH
   * matched zero rows, `Prefer: return=minimal` made that indistinguishable
   * from a real update, and the caller reported success anyway — a real,
   * unlogged close (a more accurate `completed` reason, this turn's true
   * final cost) silently discarded. Exactly the §1.14 "failure collapsed
   * into emptiness" shape.
   */
  it("does not silently report success when finalizeParked's grace-window timer wins the close race against a busy turn that outlasts it on its own", async () => {
    freshJournal();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    slowTurnDelayMs = 3_500;
    try {
      const { socket, closed } = open(await socketUrl());
      await collect(socket, (m) => m.some((x) => x.type === 'turn'));

      // This turn's OWN processing — no farewell involved yet — will take
      // 3.5s, comfortably longer than this suite's 1.5s
      // `SESSION_RESUME_GRACE_MS`. That gap alone is the whole mechanism.
      socket.send(JSON.stringify({ type: 'learner_text', text: 'cuentamelotodomuydespacio' }));
      await new Promise((r) => setTimeout(r, 100));
      // A deliberate leave, deferred by round 90's fix rather than refused —
      // but it is the SLOW TURN ahead of it, not this farewell, that blows
      // through the grace window.
      socket.send(JSON.stringify({ type: 'end_session' }));
      // Torn down immediately, exactly as the real frontend does. This arms
      // `finalizeParked`'s grace-window timer starting NOW, at ~100ms into a
      // turn that will not resolve for another 3.4s.
      socket.close();
      await closed();

      // Long enough for finalizeParked's 1.5s timer to fire FIRST (closing
      // the session as `learner_left` with whatever cost existed at that
      // moment), and then for the slow turn to finally resolve, defer into
      // the farewell, and reach finish()'s own close attempt against a
      // session Core already considers closed.
      await new Promise((r) => setTimeout(r, 5_000));

      // The database's real, permanent state — first close wins — is
      // `learner_left`, exactly once. finish()'s later attempt must not
      // have duplicated it or silently overwritten it.
      expect(journal.closes).toHaveLength(1);
      expect(journal.closes[0]).toMatchObject({ closeReason: 'learner_left' });

      /*
       * THE LEDGER HALF OF THE SAME RACE (oracle/AGENTS.md item 71), which
       * this test asserted nothing about until 2026-09-01 — it checked the
       * close COUNT and REASON while the cost, the actual subject of the
       * open follow-up, went unexamined.
       *
       * What is pinned here is the DOCUMENTED behaviour, not a wish: the
       * winner's snapshot is what persists, and it is a real recorded
       * number rather than a dropped field. Cost reconciliation is
       * deliberately not attempted (see `finalizeParked`'s own comment: the
       * additive RPC has no idempotency key, so a retry that cannot prove
       * the first write missed would double-count an estimate that nothing
       * reads and that `spendGuard` has already counted at spend time).
       */
      expect(typeof journal.closes[0].costUsd).toBe('number');
      expect(Number.isFinite(journal.closes[0].costUsd)).toBe(true);

      // And finish()'s own losing attempt must not be a SILENT no-op: it is
      // told by Core that its write matched zero rows, and must say so
      // loudly, naming the session, rather than reporting completion.
      const warned = warnSpy.mock.calls.some(
        ([message]) =>
          typeof message === 'string' && message.includes(SESSION_ID) && message.includes('already closed'),
      );
      expect(warned).toBe(true);

      // And that warning must NAME THE MONEY, because "reconcile manually if
      // material" is only actionable if the log says what the amount was.
      const namedCost = warnSpy.mock.calls.some(
        ([message]) => typeof message === 'string' && message.includes(SESSION_ID) && /\$\d+\.\d+/.test(message),
      );
      expect(namedCost).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  }, 10_000);

  /*
   * oracle/AGENTS.md item 71's own follow-up, closed here. The test above
   * already proves `finalizeParked` winning this race is not silently
   * reported as a success by `finish()`'s losing one; this proves the cost
   * half of the SAME finding — that the win no longer ALSO pays for a
   * second, redundant `runPostSessionReview` model call on top of the one
   * `finish()` is guaranteed to run once the busy turn actually settles.
   *
   * Two learner turns are needed before the race, not one: `review()`
   * (`session/review.ts`) skips entirely under two learner turns, and this
   * test's whole point is counting REAL attempted model calls — with only
   * the one slow turn in history, both the pre-fix and post-fix code would
   * report zero calls, and the assertion below would pass for a reason that
   * proves nothing about the dedup this test exists to catch.
   */
  it('runs the post-session review exactly once when finalizeParked wins the close race, not twice', async () => {
    freshJournal();
    slowTurnDelayMs = 3_500;
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    const firstAnswered = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'hola' }));
    await firstAnswered;

    // Past MIN_TURN_GAP_MS (700ms) — otherwise the slow turn below is
    // refused outright as `too-soon` rather than claimed, and the whole
    // race this test exists to reproduce never happens: no busy floor, no
    // park, `end_session` succeeds immediately (`attemptEndSession` claims
    // with `enforceFloor=false`), and `learnerTurns` never reaches 2 either.
    await new Promise((r) => setTimeout(r, 750));

    // The same mechanism as the test above: this turn's OWN processing —
    // no farewell involved — outlasts the 1.5s `SESSION_RESUME_GRACE_MS`
    // on its own, so `finalizeParked` wins the close race against the
    // deferred farewell that follows it.
    socket.send(JSON.stringify({ type: 'learner_text', text: 'cuentamelotodomuydespacio' }));
    await new Promise((r) => setTimeout(r, 100));
    socket.send(JSON.stringify({ type: 'end_session' }));
    socket.close();
    await closed();

    // Long enough for: `finalizeParked`'s 1.5s timer to fire (and, post-fix,
    // defer rather than review); the slow turn to resolve at ~3.5s; the
    // farewell and `finish()` to run; and `finish()`'s OWN review call to
    // reach the fake model server — which is ALSO delayed 3.5s by the same
    // `slowTurnDelayMs` mechanism, since its transcript still carries the
    // phrase that triggers it. Comfortably covers the PRE-fix timing too,
    // where `finalizeParked`'s own (stale) review would have resolved
    // around the 5s mark.
    await new Promise((r) => setTimeout(r, 8_000));

    const reviewCalls = modelJournal.bodies.filter((b) => b.includes('reflection pass'));
    expect(reviewCalls).toHaveLength(1);
  }, 12_000);

  it('holds the streamed-audio doors to the same gates as the whole clip', async () => {
    freshJournal();
    const { socket } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    // No microphone in this session (no voice provider), so `begin` is
    // refused with the same code the single-frame path uses…
    const refused = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send(JSON.stringify({ type: 'learner_audio_begin', mimeType: 'audio/webm' }));
    expect((await refused).find((m) => m.type === 'error')).toMatchObject({ code: 'CONSENT_REQUIRED' });

    // …and a chunk with no assembly open is a protocol error, not a crash.
    const orphan = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send(JSON.stringify({ type: 'learner_audio_chunk', audio: 'AAAA' }));
    expect((await orphan).find((m) => m.type === 'error')).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(socket.readyState).toBe(WebSocket.OPEN);

    socket.close();
  });
});

describe('a dropped session can be resumed on a fresh token', () => {
  it('parks the conversation and re-attaches it — history, last turn, no second greeting', async () => {
    freshJournal();
    const first = open(await socketUrl());
    await collect(first.socket, (m) => m.some((x) => x.type === 'turn'));

    // One real exchange, so the park has a conversation worth keeping.
    const answered = collect(first.socket, (m) => m.some((x) => x.type === 'turn'));
    first.socket.send(JSON.stringify({ type: 'learner_text', text: 'quiero ahorrar para una bici' }));
    const reply = (await answered).find((m) => m.type === 'turn') as { say: string; seq: number };

    // The connection DIES — no close frame, no farewell. A sleeping phone.
    first.socket.terminate();
    await first.closed();
    await new Promise((r) => setTimeout(r, 100));

    // The session is parked, not closed: Core has recorded nothing yet.
    expect(journal.closes).toHaveLength(0);

    // A FRESH single-use token for the SAME session — what Core's resume
    // endpoint mints — re-attaches instead of starting over.
    const second = open(await socketUrl());
    const rejoined = await collect(second.socket, (m) => m.some((x) => x.type === 'state'));

    const history = rejoined.find((m) => m.type === 'history') as {
      turns: { speaker: string; text: string; seq: number }[];
    };
    expect(history).toBeDefined();
    // Greeting, learner line, reply — the whole conversation came back.
    expect(history.turns.length).toBeGreaterThanOrEqual(3);
    expect(history.turns.some((t) => t.speaker === 'learner' && t.text.includes('bici'))).toBe(true);

    // The turn that was on screen is re-sent as text (no audio replay), and
    // it is the SAME turn — same words, same seq — not a new greeting.
    const redrawn = rejoined.find((m) => m.type === 'turn') as {
      say: string;
      seq: number;
      audioUrl: unknown;
      audioPending: boolean;
    };
    expect(redrawn.say).toBe(reply.say);
    expect(redrawn.seq).toBe(reply.seq);
    expect(redrawn.audioUrl).toBeNull();
    /*
     * Found by adversarial review, 2026-08-30 (HIGH): a resume redraw sends
     * no `turn_audio` at all (replaying a clip the learner already heard
     * reads as a stutter), but `audioUrl: null` alone is indistinguishable
     * from an ORDINARY turn whose voice simply has not arrived yet — the
     * client used to wait for a `turn_audio` frame that this path never
     * sends, opening hands-free listening only once that (never-coming)
     * frame settled it, or — depending on the exact race — opening it too
     * early in the gap of an ordinary turn for the identical reason. This
     * frame must say up front that nothing more is coming.
     */
    expect(redrawn.audioPending).toBe(false);
    // The history's final tutor entry carries that same seq, so the caption
    // and the log cannot print the line twice.
    expect(history.turns.at(-1)).toMatchObject({ speaker: 'tutor', seq: reply.seq });

    // The resumed session is fully alive: it can end properly.
    const ending = collect(second.socket, (m) => m.some((x) => x.type === 'closed'));
    endNow(second.socket);
    await ending;
    await new Promise((r) => setTimeout(r, 150));
    /*
     * Found by adversarial review, 2026-08-30 (HIGH): `closeSession` used to
     * report `orchestrator.turnCount` — the model-turn counter, incremented
     * only for TUTOR turns — as the session's `turnCount`. This conversation
     * has a greeting, a learner line, a reply and a farewell: 4 transcript
     * rows (`journal.turns`, every persisted row this session ever wrote),
     * only 3 of them tutor turns. The parent-facing "N líneas" list and the
     * resume player's "line X of N" both count every row, either speaker —
     * so reporting the tutor-only count here made a 4-row conversation
     * display as "3 líneas". `turnCount` must equal the transcript's own
     * row count, not the model's.
     */
    expect(journal.closes.at(-1)).toMatchObject({
      closeReason: 'completed',
      turnCount: journal.turns.length,
    });
  });

  /*
   * Found by an adversarial review, 2026-08-30 (HIGH): the resume redraw
   * rebuilt the `turn` frame by hand instead of going through `deliver()` —
   * the one function that recomputes and attaches a whiteboard. A reconnect
   * while a growth story was on screen left the learner staring at
   * narration for a board that had simply vanished.
   */
  it('redraws the open WHITEBOARD on resume, not just the narration', async () => {
    freshJournal();
    const first = open(await socketUrl());
    await collect(first.socket, (m) => m.some((x) => x.type === 'turn'));

    const boarded = collect(first.socket, (m) => m.some((x) => x.type === 'turn' && x.whiteboard != null));
    first.socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropizarron' }));
    await boarded;

    first.socket.terminate();
    await first.closed();
    await new Promise((r) => setTimeout(r, 100));

    const second = open(await socketUrl());
    const rejoined = await collect(second.socket, (m) => m.some((x) => x.type === 'state'));
    const redrawn = rejoined.find((m) => m.type === 'turn') as { whiteboard?: { values: number[] } };
    expect(redrawn.whiteboard).toBeDefined();
    expect(redrawn.whiteboard?.values).toEqual([10, 12, 14]);

    const ending = collect(second.socket, (m) => m.some((x) => x.type === 'closed'));
    endNow(second.socket);
    await ending;
  });

  /*
   * Found by the same review: the redraw never re-sent a `segment` frame
   * either, so a reconnect while an activity was open left nothing to
   * answer and no path to XP — with no error, just silence where the
   * exercise used to be.
   */
  it('redraws the open ACTIVITY on resume, not just the narration', async () => {
    freshJournal();
    const first = open(await socketUrl());
    await collect(first.socket, (m) => m.some((x) => x.type === 'turn'));

    const served = collect(first.socket, (m) => m.some((x) => x.type === 'segment'));
    first.socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    const original = (await served).find((m) => m.type === 'segment') as { segmentId: string };

    // Dropped BEFORE the activity was answered — nothing graded it.
    first.socket.terminate();
    await first.closed();
    await new Promise((r) => setTimeout(r, 100));

    const second = open(await socketUrl());
    const rejoined = await collect(second.socket, (m) => m.some((x) => x.type === 'state'));
    const redrawn = rejoined.find((m) => m.type === 'segment') as { segmentId: string } | undefined;
    expect(redrawn).toBeDefined();
    expect(redrawn?.segmentId).toBe(original.segmentId);

    // And it is answerable: grading it reaches the model exactly as before.
    await new Promise((r) => setTimeout(r, 750));
    const reacted = collect(second.socket, (m) => m.some((x) => x.type === 'turn'));
    second.socket.send(
      JSON.stringify({ type: 'segment_graded', segmentId: original.segmentId, score: 100, correct: true }),
    );
    expect((await reacted).find((m) => m.type === 'turn')).toBeDefined();

    await new Promise((r) => setTimeout(r, 750));
    const ending = collect(second.socket, (m) => m.some((x) => x.type === 'closed'));
    endNow(second.socket);
    await ending;
  });

  it('finalizes an unclaimed park as learner_left when the grace window passes', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    socket.terminate();
    await closed();

    // Inside the window: still nothing recorded, the door is open.
    await new Promise((r) => setTimeout(r, 300));
    expect(journal.closes).toHaveLength(0);

    // The window passes with nobody coming back. THAT is a learner leaving.
    await new Promise((r) => setTimeout(r, 1_700));
    expect(journal.closes.at(-1)).toMatchObject({ closeReason: 'learner_left' });
  });

  /*
   * Found by adversarial review, 2026-08-30 (MEDIUM): a session ended by a
   * dropped connection — a sleeping phone, a proxy timeout, a stairwell,
   * exactly what parking exists to survive — went through `finalizeParked`
   * rather than `finish()`, and only `finish()` ran the V4 post-session
   * review that rewrites `learner_memory`. A real conversation ended this
   * way taught the memory system nothing, silently: no error, no log line,
   * indistinguishable from a session with nothing durable to write.
   */
  it('runs the post-session review for a session that ends by a dropped connection, not just a graceful close', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));

    // Two real learner turns — the review's own floor (`learnerTurns < 2`).
    const first = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'no sé qué es ahorrar' }));
    await first;
    // Past MIN_TURN_GAP_MS (700ms) — otherwise the second send is refused
    // as too-soon rather than reaching the model at all.
    await new Promise((r) => setTimeout(r, 750));
    const second = collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.send(JSON.stringify({ type: 'learner_text', text: 'ahora sí entendí un poco' }));
    await second;

    // Dropped, not farewelled — the park path, not `finish()`.
    socket.terminate();
    await closed();

    // The window passes with nobody coming back.
    await new Promise((r) => setTimeout(r, 1_700));

    // The review's own system prompt is distinctive enough to prove it ran,
    // rather than asserting on Core's fake (which has no learner-memory
    // route and would 404 either way — the review handles that gracefully).
    expect(modelJournal.bodies.some((body) => body.includes('reflection pass'))).toBe(true);
  });

  it('still burns each token once — the resume token is new, the old one stays dead', async () => {
    freshJournal();
    const url = await socketUrl();
    const first = open(url);
    await collect(first.socket, (m) => m.some((x) => x.type === 'turn'));
    first.socket.terminate();
    await first.closed();

    // Re-dialling the ORIGINAL url is a replay, parked session or not — and
    // reads as ALREADY_CONNECTED (4009), not UNAUTHORIZED (4001): the token
    // was never malformed, unsigned or expired, it was simply spent by a
    // socket that (from Oracle's side) is still the live one. RUNBOOK.md's
    // Round 81/82 cold-mount investigation traced the client-visible half of
    // this: 4001 maps to `SESSION_EXPIRED` unconditionally, which told a
    // learner their session had expired when it had done nothing of the
    // sort — the real session was mid-conversation on the socket that won.
    const replayed = open(url);
    expect(await replayed.closed()).toBe(4009);
  });

  /*
   * Found by an adversarial review, 2026-08-29 (HIGH): with no registry of
   * genuinely-live sockets, a SECOND socket for a session whose first socket
   * never actually closed found nothing in the park (there was nothing to
   * find) and `handleConnection` spun up a second, independent
   * TutorOrchestrator running in parallel — its own budget clock, its own
   * turn cap, and (in production) a real Core resume endpoint that mints a
   * fresh token for any session the caller owns with no live-socket check at
   * all. Each extra socket bought another full session's worth of paid
   * model/judge/TTS calls and defeated the daily-session cap.
   */
  it('refuses a second socket for a session whose first socket never actually closed', async () => {
    freshJournal();
    const first = open(await socketUrl());
    await collect(first.socket, (m) => m.some((x) => x.type === 'turn'));

    // The first socket is left OPEN — no terminate, no close frame — and a
    // fresh token is minted for the SAME session, exactly what a resume
    // endpoint would hand out to a caller who never let the first socket die.
    const second = open(await socketUrl());
    expect(await second.closed()).toBe(4009);

    // The FIRST socket is unharmed: still open, still able to finish its own
    // session normally.
    expect(first.socket.readyState).toBe(first.socket.OPEN);
    const ending = collect(first.socket, (m) => m.some((x) => x.type === 'closed'));
    endNow(first.socket);
    await ending;
    expect(journal.closes).toHaveLength(1);
    expect(journal.closes[0]).toMatchObject({ closeReason: 'completed' });
  });

  /*
   * ROUND 77, 2026-08-30 (MEDIUM) — round 56's deferred finding, over a real
   * socket rather than against the orchestrator directly.
   *
   * A resume re-attaches the SAME `TutorOrchestrator`, whose `session` is set
   * once at construction and never reassigned. `isMinor` is the sole input to
   * `requireModelPass` — whether a turn no judge could clear is refused or
   * delivered — so the orchestrator kept enforcing the FIRST connection's
   * answer while every gate around it on the same reconnect (the door's
   * `moderationReadiness`, the microphone gate, the per-turn consent recheck)
   * already used the freshly fetched one.
   *
   * This is the end-to-end half of the proof: the unit tests in
   * `orchestrator.test.ts` show `refreshIsMinor` works, and this one shows
   * `handleConnection` actually calls it on the resume path.
   */
  it('re-reads isMinor from the RESUME’s own fresh context, not the first connection’s', async () => {
    freshJournal();
    judgeShouldFail = true;
    sessionIsMinor = false;

    const first = open(await socketUrl());
    await collect(first.socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(first.socket, (m) => m.some((x) => x.type === 'turn'));
    first.socket.send(JSON.stringify({ type: 'learner_text', text: 'quiero ahorrar para una bici' }));
    await answered;
    // The turn frame reaches the client before the transcript row reaches
    // Core — the persist is fire-and-forget, deliberately.
    await new Promise((r) => setTimeout(r, 150));

    // Not a minor, judge unreachable: §6 says the deterministic pass alone is
    // enough, and the model's own words were delivered.
    expect(journal.turns.at(-1)).toMatchObject({ speaker: 'tutor', source: 'model' });
    expect(journal.flags).toHaveLength(0);

    // The connection dies without a farewell — the session parks.
    first.socket.terminate();
    await first.closed();
    await new Promise((r) => setTimeout(r, 100));
    expect(journal.closes).toHaveLength(0);

    // BETWEEN the two connections, Core's answer about this learner changes.
    sessionIsMinor = true;

    const second = open(await socketUrl());
    await collect(second.socket, (m) => m.some((x) => x.type === 'state'));

    // `lastTurnAtMs` is carried across the park on purpose, so a turn sent
    // immediately after a resume is refused by the same `MIN_TURN_GAP_MS`
    // floor an ordinary too-fast turn is.
    await new Promise((r) => setTimeout(r, 750));
    const replied = collect(second.socket, (m) => m.some((x) => x.type === 'turn'));
    second.socket.send(JSON.stringify({ type: 'learner_text', text: 'otrapreguntadistinta' }));
    await replied;
    await new Promise((r) => setTimeout(r, 150));

    /*
     * Pre-fix this delivered the model turn exactly as the first connection
     * did: the resumed orchestrator still held `isMinor: false`. Now the same
     * unavailable judge refuses the turn and the scripted line goes out
     * instead, with the safety flag that says why.
     */
    expect(journal.turns.at(-1)).toMatchObject({ speaker: 'tutor', source: 'scripted' });
    expect(journal.flags.at(-1)).toMatchObject({ category: 'model_output_blocked' });

    // AWAITED: a socket left open here stays in `liveSessions`, and the next
    // test's handshake is then refused as ALREADY_CONNECTED rather than
    // failing on its own terms.
    second.socket.close();
    await second.closed();
  });
});

/*
 * ── THE SAME DROP, ONTO A DIFFERENT REPLICA ─────────────────────────────────
 *
 * Every test in the block above resumes onto the SAME process, which is the
 * only thing a single test process can do by default — and precisely the case
 * that was already working. `RUNBOOK.md` Round 142 traced what happened at
 * N>1 instead: the close handler released the session claim BEFORE parking, so
 * a reconnect load-balanced elsewhere acquired cleanly, found nothing parked,
 * and built a SECOND orchestrator with `transcriptSeq` back to 0 — every row
 * colliding in `tutor_turns` and being dropped in silence — while the original
 * replica's park timer still won the `ended_at=is.null` close, losing the live
 * replica's billed usage from Core's ledger entirely.
 *
 * `dropLocalParksForTest()` is what makes that reachable from one process. It
 * empties this process's LOCAL park map without finalizing anything, which is
 * exactly the state a second replica is always in: it never had the local
 * entry, only whatever the shared store holds. Everything after that call is
 * the code path a genuinely different replica runs.
 */
describe('a dropped session resumes on a DIFFERENT replica', () => {
  /** Park a real conversation, then become the replica that never saw it. */
  async function parkThenBecomeAnotherReplica(): Promise<{ say: string; seq: number }> {
    const first = open(await socketUrl());
    await collect(first.socket, (m) => m.some((x) => x.type === 'turn'));

    const answered = collect(first.socket, (m) => m.some((x) => x.type === 'turn'));
    first.socket.send(JSON.stringify({ type: 'learner_text', text: 'quiero ahorrar para una bici' }));
    const reply = (await answered).find((m) => m.type === 'turn') as { say: string; seq: number };

    first.socket.terminate();
    await first.closed();
    // The park (and its publish to the shared store) happens on the server's
    // own close event, which races this line — the same beat `afterEach` uses.
    await new Promise((r) => setTimeout(r, 150));
    return reply;
  }

  it('adopts the conversation from the shared park — history, last turn, no second greeting', async () => {
    freshJournal();
    const reply = await parkThenBecomeAnotherReplica();
    expect(journal.closes).toHaveLength(0);

    const { dropLocalParksForTest } = await import('../ws/server.js');
    dropLocalParksForTest();

    const second = open(await socketUrl());
    const rejoined = await collect(second.socket, (m) => m.some((x) => x.type === 'state'));

    // A `history` frame at all is the whole point: a replica that could not
    // adopt would send a fresh greeting `turn` and no history.
    const history = rejoined.find((m) => m.type === 'history') as {
      turns: { speaker: string; text: string; seq: number }[];
    };
    expect(history).toBeDefined();
    expect(history.turns.length).toBeGreaterThanOrEqual(3);
    expect(history.turns.some((t) => t.speaker === 'learner' && t.text.includes('bici'))).toBe(true);

    // The turn that was on screen comes back verbatim, with the same seq —
    // rebuilt from the snapshot on a synthesizer this process constructed.
    const redrawn = rejoined.find((m) => m.type === 'turn') as { say: string; seq: number; audioPending: boolean };
    expect(redrawn.say).toBe(reply.say);
    expect(redrawn.seq).toBe(reply.seq);
    expect(redrawn.audioPending).toBe(false);

    second.socket.close();
    await second.closed();
  });

  it('redraws the open ACTIVITY too — the frame survives the shared record round trip', async () => {
    /*
     * The record's segment frame is `.strict()`-validated on read, so a frame
     * that ever stops matching its schema would leave adoption silently
     * failing for exactly the learners who dropped mid-exercise — a subset no
     * test that never opens an activity would notice. (A compile-time check in
     * `ws/server.ts` fences the schema against the wire type; this proves the
     * round trip itself, with a real frame, end to end.)
     */
    freshJournal();
    const first = open(await socketUrl());
    await collect(first.socket, (m) => m.some((x) => x.type === 'turn'));

    const served = collect(first.socket, (m) => m.some((x) => x.type === 'segment'));
    first.socket.send(JSON.stringify({ type: 'learner_text', text: 'quieropracticarya' }));
    const original = (await served).find((m) => m.type === 'segment') as { segmentId: string };

    first.socket.terminate();
    await first.closed();
    await new Promise((r) => setTimeout(r, 150));

    const { dropLocalParksForTest } = await import('../ws/server.js');
    dropLocalParksForTest();

    const second = open(await socketUrl());
    const rejoined = await collect(second.socket, (m) => m.some((x) => x.type === 'state'));
    const redrawn = rejoined.find((m) => m.type === 'segment') as { segmentId: string } | undefined;
    expect(redrawn).toBeDefined();
    expect(redrawn?.segmentId).toBe(original.segmentId);

    // Still answerable on the new replica: the adopted orchestrator remembers
    // that it served this activity, which `segment_graded` checks.
    await new Promise((r) => setTimeout(r, 750));
    const reacted = collect(second.socket, (m) => m.some((x) => x.type === 'turn'));
    second.socket.send(
      JSON.stringify({ type: 'segment_graded', segmentId: original.segmentId, score: 100, correct: true }),
    );
    expect((await reacted).find((m) => m.type === 'turn')).toBeDefined();

    second.socket.close();
    await second.closed();
  });

  it('continues the transcript instead of restarting it at 0 — the silent-row-loss bug', async () => {
    freshJournal();
    await parkThenBecomeAnotherReplica();
    const rowsBefore = journal.turns.length;
    expect(rowsBefore).toBeGreaterThanOrEqual(3);

    const { dropLocalParksForTest } = await import('../ws/server.js');
    dropLocalParksForTest();

    const second = open(await socketUrl());
    await collect(second.socket, (m) => m.some((x) => x.type === 'state'));

    // MIN_TURN_GAP_MS is 700ms; a turn inside that window is refused.
    await new Promise((r) => setTimeout(r, 750));
    const answered = collect(second.socket, (m) => m.some((x) => x.type === 'turn'));
    second.socket.send(JSON.stringify({ type: 'learner_text', text: 'y cuanto junto en un mes' }));
    await answered;
    await new Promise((r) => setTimeout(r, 200));

    /*
     * THE ASSERTION THIS WHOLE BLOCK EXISTS FOR. `tutor_turns` is unique on
     * `(session_id, seq)` with `resolution=ignore-duplicates`, so a reused seq
     * is a row destroyed in silence. Every row this session has EVER written,
     * across both "replicas", must carry a distinct, ascending number.
     */
    const seqs = journal.turns.map((t) => t.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    // …and the new replica's first row continued past the old one's last,
    // rather than starting again at 1.
    expect(Math.min(...seqs.slice(rowsBefore))).toBeGreaterThan(Math.max(...seqs.slice(0, rowsBefore)));

    second.socket.close();
    await second.closed();
  });

  it('continues the transcript even when NO park record survived at all', async () => {
    /*
     * The park record is optional by nature — it expires, the parking process
     * crashes or is redeployed, or it was deliberately never published because
     * a graceful close was already in flight. The TRANSCRIPT FLOOR is the
     * separate, monotonic backstop that must hold in every one of those cases,
     * so this test destroys the record and keeps only the floor.
     */
    freshJournal();
    await parkThenBecomeAnotherReplica();
    const rowsBefore = journal.turns.length;

    const { dropLocalParksForTest } = await import('../ws/server.js');
    const { claimParkedSession } = await import('../ws/parkStore.js');
    dropLocalParksForTest();
    // Consume and discard the shared record: this replica finds nothing.
    const consumed = await claimParkedSession(SESSION_ID);
    expect(consumed.ok && consumed.record !== null).toBe(true);

    const second = open(await socketUrl());
    // No park anywhere, so this IS a fresh conversation — it greets rather
    // than redrawing, and that is correct. What must NOT be fresh is the seq.
    await collect(second.socket, (m) => m.some((x) => x.type === 'turn'));
    await new Promise((r) => setTimeout(r, 200));

    const seqs = journal.turns.map((t) => t.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(Math.min(...seqs.slice(rowsBefore))).toBeGreaterThan(Math.max(...seqs.slice(0, rowsBefore)));

    second.socket.close();
    await second.closed();
  });

  it('publishes the park BEFORE releasing the claim, so an adopter can never miss it', async () => {
    /*
     * The ordering is the fix, not an implementation detail. The resuming
     * socket's only gate is the session claim, so if the claim is free while
     * the park is not yet visible, a reconnect provably sails through into a
     * fresh, colliding orchestrator. Asserted as the invariant itself: at the
     * first instant the claim can be taken, the record is already there.
     */
    freshJournal();
    await parkThenBecomeAnotherReplica();

    const { acquireLock, releaseLock } = await import('../lib/lock.js');
    const { sessionLockKey, dropLocalParksForTest } = await import('../ws/server.js');
    const { claimParkedSession } = await import('../ws/parkStore.js');

    const claim = await acquireLock(sessionLockKey(SESSION_ID), 5_000);
    expect(claim.ok).toBe(true);
    try {
      const record = await claimParkedSession(SESSION_ID);
      expect(record.ok).toBe(true);
      expect(record.ok && record.record).not.toBeNull();
    } finally {
      if (claim.ok) await releaseLock(sessionLockKey(SESSION_ID), claim.owner);
      dropLocalParksForTest();
    }
  });

  it('does not close a session another replica has already adopted', async () => {
    /*
     * THE LEDGER STOMP (`RUNBOOK.md` Round 142, step 5). The parking replica's
     * grace timer keeps running after a hand-off, and Core's close filters on
     * `ended_at IS NULL` — so whichever close lands first wins. Before this
     * round, the DEAD replica's timer won, and the live conversation's real
     * billed usage never reached the ledger at all.
     *
     * Consuming the shared record is exactly what an adopting replica does to
     * it, so this reproduces the hand-off without needing a second process:
     * the local park and its timer are untouched, and the timer must now
     * decline to close a session it no longer owns.
     */
    freshJournal();
    await parkThenBecomeAnotherReplica();
    expect(journal.closes).toHaveLength(0);

    const { claimParkedSession } = await import('../ws/parkStore.js');
    const adopted = await claimParkedSession(SESSION_ID);
    expect(adopted.ok && adopted.record !== null).toBe(true);

    // SESSION_RESUME_GRACE_MS is 1500ms in this suite. Wait well past it.
    await new Promise((r) => setTimeout(r, 2_000));

    expect(journal.closes).toEqual([]);
  }, 10_000);

  it('still closes an unclaimed park — the ownership check must not disable the timer', async () => {
    /*
     * The control for the test above. A guard that declined to close
     * EVERYTHING would pass that assertion perfectly while leaking every
     * abandoned session into Core's ledger forever, so this proves the timer
     * still ends a park that genuinely nobody took.
     */
    freshJournal();
    await parkThenBecomeAnotherReplica();

    await new Promise((r) => setTimeout(r, 2_000));

    expect(journal.closes.at(-1)).toMatchObject({ closeReason: 'learner_left' });
  }, 10_000);
});

/*
 * `oracle/AGENTS.md` item 79 / `RUNBOOK.md` Round 119 — THE finding this
 * migration exists to close. Every OTHER "already connected" test in this
 * file (see above) proves the pre-existing `liveSessions.has()` guard, which
 * is local to this ONE process and was always correct for a single replica.
 * None of them could ever have failed against the pre-migration code, because
 * within one test process `liveSessions` genuinely IS shared state.
 *
 * This test proves the NEW half: a claim that exists ONLY in the distributed
 * store — never touching `liveSessions` at all — still refuses a socket.
 * That is precisely the scenario Round 119 found unreachable-but-real: a
 * SECOND replica's socket for the same session, landing on a process whose
 * OWN `liveSessions` has never heard of it. Pre-migration, this exact
 * sequence would have connected successfully (nothing but `liveSessions.has()`
 * gated it), which is the regression this test is written against.
 */
describe('the exclusivity gate also honors a claim NO local Map ever recorded', () => {
  it('refuses a socket when only the DISTRIBUTED claim — not liveSessions — already holds this session', async () => {
    freshJournal();
    const { acquireLock, releaseLock } = await import('../lib/lock.js');
    const { sessionLockKey } = await import('../ws/server.js');

    // Simulates a DIFFERENT Oracle replica's socket already holding this
    // session — acquired directly against the shared claim store, with
    // liveSessions (this process's own Map) never touched.
    const foreignClaim = await acquireLock(sessionLockKey(SESSION_ID), 60_000);
    if (!foreignClaim.ok) throw new Error('setup failed to seed the foreign claim');

    try {
      const attempt = open(await socketUrl());
      expect(await attempt.closed()).toBe(4009); // ALREADY_CONNECTED
    } finally {
      // Release what THIS test seeded, so no later test in this file — which
      // all share SESSION_ID — inherits a claim nobody will ever free.
      await releaseLock(sessionLockKey(SESSION_ID), foreignClaim.owner);
    }

    // And with the foreign claim released, an ordinary connection for the
    // same session succeeds normally — proving the refusal above was really
    // about the claim, not some other side effect of this test.
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    const ending = collect(socket, (m) => m.some((x) => x.type === 'closed'));
    endNow(socket);
    await ending;
    await closed();
  });
});

/*
 * `oracle/AGENTS.md` item 79 / `RUNBOOK.md` Round 119 point 5. The OLD
 * `closeAllSockets` called `.close()` on every socket and, in the SAME
 * synchronous breath, finalized every ALREADY-parked session — which only
 * ever caught a session parked from an EARLIER drop, because a `ws` socket's
 * own `close` event (the thing that calls `parkSession`) fires once the
 * closing handshake actually completes, asynchronously, not synchronously
 * with `.close()` being called. A session still live at the exact moment
 * `SIGTERM` arrived had nothing in `parkedSessions` yet — neither parked nor
 * closed — and by the time its socket's `close` event might eventually have
 * fired, `index.ts`'s `shutdown()` had already called `process.exit(0)`.
 *
 * A SEPARATE, throwaway server (not the shared one every other test in this
 * file depends on) — `closeAllSockets` really does call `wss.close()`, which
 * would tear down every other test's fixture if run against the shared one.
 */
describe('a shutdown mid-session gets a clean park-or-close attempt, not silence', () => {
  it('records a real close for a session that is still LIVE at the moment of shutdown', async () => {
    freshJournal();
    const { attachTutorSocket, closeAllSockets } = await import('../ws/server.js');
    const { mintSessionToken } = await import('../session/token.js');

    const shutdownServer = createServer();
    const shutdownWss = attachTutorSocket(shutdownServer);
    await listen(shutdownServer);
    const shutdownPort = portOf(shutdownServer);

    try {
      const token = mintSessionToken(
        { sid: SESSION_ID, uid: USER_ID, exp: Math.floor(Date.now() / 1000) + 60 },
        process.env.TUTOR_SESSION_SECRET as string,
      );
      const { socket } = open(`ws://127.0.0.1:${shutdownPort}/ws/tutor?token=${encodeURIComponent(token)}`);
      await collect(socket, (m) => m.some((x) => x.type === 'turn'));

      // Genuinely live right now: nothing has parked or closed it.
      expect(journal.closes).toHaveLength(0);

      closeAllSockets(shutdownWss);

      /*
       * The SAME 150ms settling window this file already uses everywhere
       * else for a fire-and-forget write to land (e.g. the persisted-turn
       * assertions above) — nowhere near `SESSION_RESUME_GRACE_MS` (1500ms
       * in this suite's config), which is exactly the point: the pre-fix
       * code would still show ZERO closes here, because the session would
       * merely be sitting PARKED with a live 1500ms timer that nothing in
       * production would ever be left running to fire.
       */
      await new Promise((r) => setTimeout(r, 150));
      expect(journal.closes).toHaveLength(1);
      expect(journal.closes[0]).toMatchObject({ closeReason: 'abandoned' });
    } finally {
      await new Promise<void>((resolve) => shutdownServer.close(() => resolve()));
    }
  });
});

describe('the socket refuses what it must', () => {
  it('closes a connection with no token', async () => {
    const { closed } = open(`ws://127.0.0.1:${oraclePort}/ws/tutor`);
    expect(await closed()).toBe(4001);
  });

  it('closes a connection carrying a Supabase JWT', async () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig';
    const { closed } = open(`ws://127.0.0.1:${oraclePort}/ws/tutor?token=${jwt}`);
    expect(await closed()).toBe(4001);
  });

  it('closes a connection whose token was already used', async () => {
    freshJournal();
    const url = await socketUrl();
    const first = open(url);
    await collect(first.socket, (m) => m.some((x) => x.type === 'ready'));
    first.socket.close();

    // Single-use: a URL captured from a screen recording is already dead —
    // and closes 4009 (ALREADY_CONNECTED), not 4001, for the same reason as
    // the resume test above: a spent token is not a malformed or expired
    // one, and the client has an honest, already-translated line for
    // exactly this shape ("You're already talking to me somewhere else").
    const replay = open(url);
    expect(await replay.closed()).toBe(4009);
  });

  /*
   * RUNBOOK.md Round 81/82's root cause, reproduced directly against the
   * server rather than waited for from a browser: two connections dialled
   * with the IDENTICAL single-use token, fired back to back with no `await`
   * between them — the exact shape a real browser was independently
   * confirmed to produce for one cold mount of the Tutor route (round 82's
   * own `window.WebSocket` instrumentation). The two tests above already
   * cover a token replayed SEQUENTIALLY, after the first socket is known to
   * be closed; this one is the harder, actually-reported case: the winner
   * is not decided by anything this test controls (whichever connection's
   * own `fetchSessionContext` round trip to Core happens to resolve first),
   * so the assertion is on the INVARIANT the fix guarantees rather than on
   * which side wins — exactly one full conversation, and the other side
   * closed 4009 naming a replayed token, never both and never neither.
   */
  it('two near-simultaneous connections sharing one fresh token: exactly one gets the conversation, the other is refused as ALREADY_CONNECTED', async () => {
    freshJournal();
    const url = await socketUrl();
    const first = open(url);
    const second = open(url);

    const outcomeOf = (tracked: TrackedSocket): Promise<'turn' | 'collect-timed-out' | `closed:${number}`> => {
      // `Promise.race` does not cancel its losing input — the LOSER side's
      // `collect()` keeps running after `closed()` has already settled this
      // race, and rejects on its own ~3s timeout regardless. Caught right
      // here, on the promise that actually owns that timeout, so it cannot
      // surface as an unhandled rejection once this test has already moved
      // on; the sentinel it resolves to can never win a race that
      // `closed()` already settled within milliseconds.
      const turn = collect(tracked.socket, (m) => m.some((x) => x.type === 'turn'))
        .then(() => 'turn' as const)
        .catch(() => 'collect-timed-out' as const);
      const closed = tracked.closed().then((code) => `closed:${code}` as const);
      return Promise.race([turn, closed]);
    };

    const [firstOutcome, secondOutcome] = await Promise.all([outcomeOf(first), outcomeOf(second)]);
    const outcomes = [firstOutcome, secondOutcome];

    expect(outcomes.filter((o) => o === 'turn')).toHaveLength(1);
    expect(outcomes.filter((o) => o !== 'turn')).toEqual(['closed:4009']);

    // Whichever socket won stays open (mid-conversation) — close it so the
    // shared SESSION_ID this suite reuses is not still "live" for the next
    // test's own fresh token.
    for (const tracked of [first, second]) {
      if (tracked.socket.readyState === tracked.socket.OPEN) tracked.socket.close();
    }
  });

  it('closes a connection whose token names a different user than the session', async () => {
    freshJournal();
    const { closed } = open(await socketUrl({ uid: '44444444-4444-4444-8444-444444444444' }));
    expect(await closed()).toBe(4001);
  });

  it('closes a minor session when no moderation judge is configured', async () => {
    freshJournal();
    sessionIsMinor = true;
    const judgeKey = process.env.JUDGE_API_KEY;
    delete process.env.JUDGE_API_KEY;
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();

    try {
      const { closed } = open(await socketUrl());
      // Refused AT THE DOOR, not turn by turn: a child sitting with a
      // character who apologises forever is worse than an honest "not
      // available right now" (/ORACLE.md §6).
      expect(await closed()).toBe(4013);
    } finally {
      process.env.JUDGE_API_KEY = judgeKey;
      resetConfigCache();
      sessionIsMinor = false;
    }
  });
});

/*
 * /ORACLE.md §15.2 item 1: nothing previously bounded what the PROCESS
 * spends in total, only what one session or one learner could cost. This
 * proves the WIRING — that `handleConnection` actually asks
 * `session/spend-guard.ts` and actually refuses — not just the guard class's
 * own arithmetic, which `session.test.ts` covers in isolation.
 */
describe('the platform-wide spend circuit breaker (/ORACLE.md §15.2 item 1)', () => {
  it('refuses a brand-new connection — before even a token is read — once the daily ceiling is reached', async () => {
    const { spendGuard } = await import('../session/spend-guard.js');
    const before = spendGuard.check();
    try {
      // Push spend past whatever the ceiling is configured to right now,
      // rather than assuming a specific number here.
      spendGuard.record(before.ceilingUsd - before.spentUsd + 1);

      // No token at all. If this closes with SPEND_CEILING rather than 4001
      // (missing token, `describe('the socket refuses what it must')`'s own
      // first test), the check is proven to run BEFORE every auth gate —
      // the whole reason it costs nothing to apply.
      const { closed } = open(`ws://127.0.0.1:${oraclePort}/ws/tutor`);
      expect(await closed()).toBe(4029);
    } finally {
      spendGuard.reset();
    }
  });
});

/*
 * Found chasing a live, intermittently-reproducing symptom, round 81
 * (2026-08-31, MEDIUM): a session whose first turn was written to Postgres
 * within seconds of starting, never once reached the screen, with no error
 * anywhere and the live-connection count never dropping. The root cause was
 * never conclusively pinned on `send()` specifically, but along the way this
 * function's own guard turned out to drop a message with total silence — no
 * log, no error — which is a real, independent gap on its own merits (§1.0)
 * and exactly the kind of gap that turns "why did nothing arrive" into a
 * permanent mystery instead of a line in the logs.
 */
describe('a dropped send is never silent', () => {
  it('warns, naming the message type and the actual readyState, when the socket is not open', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const closedSocket = { readyState: WebSocket.CLOSED, OPEN: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;

    send(closedSocket, { type: 'error', code: 'RATE_LIMITED', message: 'One moment.' });

    expect(closedSocket.send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped a "error" message'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`readyState=${WebSocket.CLOSED}`));
  });

  it('sends normally, and warns nothing, when the socket is actually open', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const openSocket = { readyState: WebSocket.OPEN, OPEN: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;

    send(openSocket, { type: 'error', code: 'RATE_LIMITED', message: 'One moment.' });

    expect(openSocket.send).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });
});

/*
 * Product 10 E.6: Core calls POST /api/v1/tutor/erasure before it removes an
 * account's rows. The learner's live socket closes and a parked session is
 * dropped WITHOUT the ordinary endings: no close written back to Core, no
 * post-session review (a paid model call) and nothing that could be resumed.
 * Another learner's session is untouched.
 */
describe('account erasure ends the learner’s Mentor sessions without writing back', () => {
  async function erase(userId: unknown, key: string | null = process.env.INTERNAL_API_KEY as string): Promise<Response> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (key !== null) headers['x-internal-api-key'] = key;
    return fetch(`http://127.0.0.1:${oraclePort}/api/v1/tutor/erasure`, { method: 'POST', headers, body: JSON.stringify({ userId }) });
  }

  it('is internal-key only and takes exactly one uuid', async () => {
    expect((await erase(USER_ID, null)).status).toBe(401);
    expect((await erase(USER_ID, 'wrong-key-wrong-key-0000')).status).toBe(401);
    expect((await erase('not-a-uuid')).status).toBe(400);
  });

  it('closes the live socket and writes no close, review or transcript afterwards', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    // The greeting's own transcript write is fire-and-forget; let it land first.
    await new Promise((r) => setTimeout(r, 300));
    const closesBefore = journal.closes.length;
    const turnsBefore = journal.turns.length;
    const response = await erase(USER_ID);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { live: 1, parked: 0 }, error: null });
    expect(await closed()).toBe(1000);
    // Past SESSION_RESUME_GRACE_MS (1.5 s here): a park would have finalized by now.
    await new Promise((r) => setTimeout(r, 1_900));
    expect(journal.closes.length).toBe(closesBefore);
    expect(journal.turns.length).toBe(turnsBefore);
    expect(modelJournal.bodies).toHaveLength(0);
    expect(await (await erase(USER_ID)).json()).toMatchObject({ data: { live: 0, parked: 0 } });
  });

  it('drops a parked session so it can never be resumed or finalized', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.close();
    await closed();
    await new Promise((r) => setTimeout(r, 150));
    const closesBefore = journal.closes.length;
    expect(await (await erase(USER_ID)).json()).toMatchObject({ data: { live: 0, parked: 1 } });
    await new Promise((r) => setTimeout(r, 1_900));
    expect(journal.closes.length).toBe(closesBefore);
    expect(modelJournal.bodies).toHaveLength(0);
  });

  it('leaves another learner’s live session alone', async () => {
    freshJournal();
    const { socket, closed } = open(await socketUrl());
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    expect(await (await erase('44444444-4444-4444-8444-444444444444')).json()).toMatchObject({ data: { live: 0, parked: 0 } });
    expect(socket.readyState).toBe(WebSocket.OPEN);
    endNow(socket);
    await closed();
  });
});
