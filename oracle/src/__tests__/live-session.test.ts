import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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
  turns: { speaker: string; text: string; source: string; seq: number }[];
  flags: { category: string; handled: string }[];
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
const sessionConsent = true;

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
        });
      }
      if (url.includes('/tutor/internal/turns')) {
        journal.turns.push(JSON.parse(body) as CoreJournal['turns'][number]);
        return json(res, { recorded: true });
      }
      if (url.includes('/tutor/internal/flags')) {
        journal.flags.push(JSON.parse(body) as CoreJournal['flags'][number]);
        return json(res, { recorded: true });
      }
      if (url.includes('/tutor/internal/segments')) {
        journal.segmentRequests += 1;
        return json(res, {
          segmentId: SEGMENT_ID,
          seq: 0,
          origin: 'catalog',
          segment: {
            id: 'seg-1',
            type: 'quiz_mcq',
            prompt_md: '¿Cuánto juntas en 4 semanas?',
            difficulty: 2,
            xp: 20,
            payload: { options: [{ id: 'a', text_md: '100' }] },
          },
          keyVerified: true,
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
      const content = isJudge
        ? JSON.stringify({ safe: true })
        : JSON.stringify({
            say: wantsBoard
              ? 'Imaginemos que guardas 10 pesos y cada día te dan 2 más.'
              : wantsActivity
                ? '¡Vamos a intentarlo!'
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
    const board = (await answered).find((m) => m.type === 'turn')?.whiteboard;

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
    const redrawn = rejoined.find((m) => m.type === 'turn') as { say: string; seq: number; audioUrl: unknown };
    expect(redrawn.say).toBe(reply.say);
    expect(redrawn.seq).toBe(reply.seq);
    expect(redrawn.audioUrl).toBeNull();
    // The history's final tutor entry carries that same seq, so the caption
    // and the log cannot print the line twice.
    expect(history.turns.at(-1)).toMatchObject({ speaker: 'tutor', seq: reply.seq });

    // The resumed session is fully alive: it can end properly.
    const ending = collect(second.socket, (m) => m.some((x) => x.type === 'closed'));
    second.socket.send(JSON.stringify({ type: 'end_session' }));
    await ending;
    expect(journal.closes.at(-1)).toMatchObject({ closeReason: 'completed' });
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
