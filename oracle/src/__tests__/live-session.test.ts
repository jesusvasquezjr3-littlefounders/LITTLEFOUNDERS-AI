import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
  }[];
  flags: { category: string; handled: string; turnSeq: number | null }[];
  closes: { closeReason: string; turnCount: number }[];
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
let segmentFailureShape: 'empty' | 'needs_generation' = 'empty';
/**
 * A session plan for the fake Core's session response, so the v3 brain is
 * ACTIVE. Off by default: every other test in this file describes an open
 * session with no plan, which is the shape they were written against.
 */
let servedSessionPlan: unknown[] | null = null;

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
        journal.closes.push(JSON.parse(body) as CoreJournal['closes'][number]);
        return json(res, { closed: true });
      }
      if (url.includes(`/tutor/internal/sessions/${SESSION_ID}`)) {
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
        await new Promise((r) => setTimeout(r, 1_500));
      }
      // A learner asking to practise gets a turn that requests an activity.
      const wantsActivity = !isJudge && body.includes('quieropracticarya');
      // V4: a learner whose message contains this asks for a growth story,
      // and gets a turn carrying a whiteboard — proving the FRAME (not just
      // the orchestrator) delivers server-computed values over a real socket.
      const wantsBoard = !isJudge && body.includes('quieropizarron');
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
  const { attachTutorSocket } = await import('../ws/server.js');

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
  vi.restoreAllMocks();
  const { nonceLedger } = await import('../session/token.js');
  nonceLedger.clear();
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

    // ── the farewell is a real turn, and the close is recorded ──
    const ending = collect(socket, (m) => m.some((x) => x.type === 'closed'));
    socket.send(JSON.stringify({ type: 'end_session' }));
    const closing = await ending;
    expect(closing.find((m) => m.type === 'closed')).toMatchObject({ reason: 'completed' });
    expect(journal.closes.at(-1)).toMatchObject({ closeReason: 'completed' });

    await closed();
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
    second.socket.send(JSON.stringify({ type: 'end_session' }));
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
    second.socket.send(JSON.stringify({ type: 'end_session' }));
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
    second.socket.send(JSON.stringify({ type: 'end_session' }));
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

    // Re-dialling the ORIGINAL url is a replay, parked session or not.
    const replayed = open(url);
    expect(await replayed.closed()).toBe(4001);
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
    first.socket.send(JSON.stringify({ type: 'end_session' }));
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

    // Single-use: a URL captured from a screen recording is already dead.
    const replay = open(url);
    expect(await replay.closed()).toBe(4001);
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
