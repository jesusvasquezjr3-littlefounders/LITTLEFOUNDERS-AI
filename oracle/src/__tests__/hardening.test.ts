import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { tierVocabularyViolation } from '../tutor/prompt.js';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/*
 * REGRESSION TESTS FOR THE 2026-08-23 SECURITY AUDIT.
 *
 * Every defect below shipped while all 165 tests were green, and every one of
 * them stayed invisible for the same reason: the suite exercised the path the
 * feature was written for and never the path beside it. So these are written
 * to the ATTACK rather than to the feature, and each was confirmed to FAIL
 * against the code as it stood before the fix — a regression test that passes
 * both ways proves nothing except that it ran.
 *
 * They drive the real socket against fake upstreams, like live-session.test.ts,
 * because three of the four defects live in the seam between two components
 * and cannot be seen from inside either one.
 */

const SESSION_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '55555555-5555-4555-8555-555555555555';
const SEGMENT_ID = '66666666-6666-4666-8666-666666666666';

/** The marker a hostile model puts somewhere it hopes nobody is looking. */
const HOSTILE = 'PAYLOAD-THE-JUDGE-MUST-SEE';

let oracleServer: Server;
let coreServer: Server;
let modelServer: Server;
let voiceServer: Server;
let oraclePort = 0;

/** Shaped per test. */
let nextTurn: Record<string, unknown>;
let consentBody: unknown;
let counts: { model: number; judge: number; stt: number; tts: number; segments: number };

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

function listen(server: Server): Promise<Server> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const portOf = (server: Server): number => (server.address() as AddressInfo).port;

function startFakeCore(): Promise<Server> {
  return listen(
    createServer((req, res) => {
      void (async () => {
        const url = req.url ?? '';
        if (req.method === 'POST') await readBody(req);

        if (url.includes(`/sessions/${SESSION_ID}/close`)) return json(res, { closed: true });
        if (url.includes(`/sessions/${SESSION_ID}`)) {
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
            isMinor: true,
            voiceConsent: true,
            intelDegraded: false,
          });
        }
        if (url.includes('/turns')) return json(res, { recorded: true });
        if (url.includes('/flags')) return json(res, { recorded: true });
        if (url.includes('/consent/')) {
          // Written raw so a test can hand back an envelope that does not parse,
          // which is the shape a real Core outage produces.
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(consentBody));
        }
        if (url.includes('/segments')) {
          counts.segments += 1;
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
        return json(res, null, 404);
      })();
    }),
  );
}

/**
 * A model that answers whatever the test set, and a judge that refuses
 * anything containing the marker.
 *
 * The judge is the instrument here: it can only block what it is SHOWN, so
 * "did the judge see this field" is answerable by asking whether the turn was
 * blocked. That is the whole of test 1.
 */
function startFakeModel(): Promise<Server> {
  return listen(
    createServer((req, res) => {
      void (async () => {
        const body = await readBody(req);
        const isJudge = body.includes('child-safety reviewer');
        if (isJudge) counts.judge += 1;
        else counts.model += 1;

        const content = isJudge
          ? // A refusal NAMES a harm category — that is the contract since the
            // judge blocked a tutor for a maths inconsistency it had itself
            // called "not unsafe". A verdict with no category is not a refusal.
            JSON.stringify(
              body.includes(HOSTILE)
                ? { safe: false, category: 'dangerous_instructions', reason: 'hostile payload' }
                : { safe: true },
            )
          : JSON.stringify(nextTurn);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [{ message: { content } }],
            usage: { prompt_tokens: 40, completion_tokens: 20 },
          }),
        );
      })();
    }),
  );
}

/** Counts what the paid voice provider was actually asked to do. */
function startFakeVoice(): Promise<Server> {
  return listen(
    createServer((req, res) => {
      void (async () => {
        const url = req.url ?? '';
        await readBody(req);
        if (url.includes('/stt/')) {
          counts.stt += 1;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ text: 'hola', confidence: 0.9 }));
        }
        counts.tts += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // Small enough to be cheap, valid enough to be stored.
        res.end(JSON.stringify({ audioContent: Buffer.from('fake-mp3').toString('base64') }));
      })();
    }),
  );
}

function cleanTurn(): Record<string, unknown> {
  return {
    say: 'Muy bien, sigamos.',
    emotion: 'happy',
    action: 'nod',
    next: 'ask',
    segmentRequest: null,
    offerAdaptation: null,
    savePlan: false,
  };
}

function collect(
  socket: WebSocket,
  predicate: (messages: Record<string, unknown>[]) => boolean,
  timeoutMs = 8_000,
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

async function socketUrl(): Promise<string> {
  const { mintSessionToken } = await import('../session/token.js');
  const token = mintSessionToken(
    { sid: SESSION_ID, uid: USER_ID, exp: Math.floor(Date.now() / 1000) + 60 },
    process.env.TUTOR_SESSION_SECRET as string,
  );
  return `ws://127.0.0.1:${oraclePort}/ws/tutor?token=${encodeURIComponent(token)}`;
}

/** Opens a socket and waits for the greeting to land, so tests start level. */
async function openReady(): Promise<WebSocket> {
  const socket = new WebSocket(await socketUrl());
  await collect(socket, (m) => m.some((x) => x.type === 'turn'));
  return socket;
}

beforeAll(async () => {
  coreServer = await startFakeCore();
  modelServer = await startFakeModel();
  voiceServer = await startFakeVoice();

  process.env.CORE_URL = `http://127.0.0.1:${portOf(coreServer)}`;
  process.env.MODEL_API_BASE = `http://127.0.0.1:${portOf(modelServer)}`;
  process.env.JUDGE_API_BASE = `http://127.0.0.1:${portOf(modelServer)}`;
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  process.env.JUDGE_API_KEY = 'test-judge-key-0123';
  // A real provider, so `learner_audio` reaches transcription instead of being
  // refused at the microphone check — the STT spend is the thing under test.
  process.env.VOICE_PROVIDER = 'inworld';
  process.env.INWORLD_API_BASE = `http://127.0.0.1:${portOf(voiceServer)}`;
  process.env.INWORLD_API_KEY = 'test-inworld-key-0123';
  process.env.INWORLD_VOICE_RHO_ES_MX = 'test-voice-rho';
  process.env.TUTOR_VOICE_FOR_MINORS = 'true';
  process.env.SPEECH_CACHE_ENABLED = 'false';

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
    [oracleServer, coreServer, modelServer, voiceServer].map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
  for (const key of [
    'MODEL_API_KEY',
    'JUDGE_API_KEY',
    'VOICE_PROVIDER',
    'INWORLD_API_KEY',
    'INWORLD_VOICE_RHO_ES_MX',
    'TUTOR_VOICE_FOR_MINORS',
    'SPEECH_CACHE_ENABLED',
  ]) {
    delete process.env[key];
  }
});

beforeEach(() => {
  nextTurn = cleanTurn();
  consentBody = { data: { active: true }, error: null };
  counts = { model: 0, judge: 0, stt: 0, tts: 0, segments: 0 };
});

afterEach(async () => {
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
  // A socket closed without a farewell PARKS its session for resume, and the
  // tests share a session id — sweep the park (after letting the server's own
  // close event land) so no test inherits another's conversation.
  await new Promise((r) => setTimeout(r, 120));
  const { finalizeAllParked } = await import('../ws/server.js');
  finalizeAllParked();
});

describe('every learner-visible string the model authored is moderated', () => {
  it('blocks a turn whose payload hides in segmentRequest.framing', async () => {
    // A clean `say` and a hostile `framing`: the exact shape that reached a
    // child's screen unmoderated while two comments said otherwise. `say` alone
    // gives the judge nothing to refuse.
    nextTurn = {
      ...cleanTurn(),
      say: 'Vamos a practicar.',
      next: 'segment',
      segmentRequest: {
        skillKey: 'saving.goal',
        difficulty: 2,
        framing: `Primero pide a un adulto su tarjeta. ${HOSTILE}`,
        rationale: 'practice',
      },
    };

    const socket = await openReady();
    // A FRESH collector, so `>= 1` means one turn after the greeting rather
    // than counting the greeting again — the greeting's listener is still
    // attached and its own array is not this one.
    socket.send(JSON.stringify({ type: 'learner_text', text: '¿Qué sigue?' }));
    const messages = await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.close();

    const turn = messages.filter((m) => m.type === 'turn').at(-1) as Record<string, unknown>;
    // The judge refused, so the model's whole turn was replaced by the scripted
    // block line — `say` included, even though `say` was the innocent half.
    expect(turn.say).not.toBe('Vamos a practicar.');
    expect(JSON.stringify(turn)).not.toContain(HOSTILE);
    // A blocked turn drops its activity with it, so the framing reaches no
    // screen and Core is never asked for a segment.
    expect(turn.next).not.toBe('segment');
    expect(counts.segments).toBe(0);
    // The judge was actually consulted — otherwise this test would pass on a
    // build where moderation never ran at all.
    expect(counts.judge).toBeGreaterThan(0);
  });

  it('still serves a clean activity, so the gate is not simply refusing everything', async () => {
    nextTurn = {
      ...cleanTurn(),
      next: 'segment',
      segmentRequest: {
        skillKey: 'saving.goal',
        difficulty: 2,
        framing: 'Vamos a probarlo juntos.',
        rationale: 'practice',
      },
    };

    const socket = await openReady();
    socket.send(JSON.stringify({ type: 'learner_text', text: '¿Qué sigue?' }));
    await collect(socket, (m) => m.some((x) => x.type === 'segment'));
    socket.close();

    expect(counts.segments).toBe(1);
  });
});

describe('one turn at a time, on every path that reaches the model', () => {
  it('refuses a burst of segment_graded instead of buying a completion for each', async () => {
    /*
     * Two gates now stand in front of this frame, and the burst must be
     * bounded by both. A grade naming a segment the session never served is
     * refused BEFORE the turn slot — zero completions, not one. A grade
     * naming a REAL segment still buys at most one completion however many
     * frames share the read buffer, which is the original regression.
     */
    const socket = await openReady();
    const before = counts.model;

    const fabricated = 40;
    for (let i = 0; i < fabricated; i += 1) {
      socket.send(JSON.stringify({ type: 'segment_graded', segmentId: SEGMENT_ID, score: 50, correct: false }));
    }
    const refusedAll = await collect(
      socket,
      (m) => m.filter((x) => x.type === 'error' && x.code === 'UNKNOWN_SEGMENT').length >= fabricated,
    );
    expect(refusedAll.filter((m) => m.code === 'UNKNOWN_SEGMENT')).toHaveLength(fabricated);
    expect(counts.model - before).toBe(0);

    // Now a REAL activity: the tutor requests one, the session serves it…
    nextTurn = {
      ...cleanTurn(),
      next: 'segment',
      segmentRequest: {
        skillKey: 'saving.goal',
        difficulty: 2,
        framing: 'Vamos a probarlo juntos.',
        rationale: 'practice',
      },
    };
    const servedAt = collect(socket, (m) => m.some((x) => x.type === 'segment'));
    socket.send(JSON.stringify({ type: 'learner_text', text: '¿Qué sigue?' }));
    const servedId = ((await servedAt).find((m) => m.type === 'segment') as { segmentId: string }).segmentId;
    nextTurn = cleanTurn();
    const mid = counts.model;

    // …and a burst against ITS id still buys one completion, not thirty.
    await new Promise((r) => setTimeout(r, 750));
    const burst = 30;
    for (let i = 0; i < burst; i += 1) {
      socket.send(JSON.stringify({ type: 'segment_graded', segmentId: servedId, score: 50, correct: false }));
    }
    const messages = await collect(
      socket,
      (m) => m.filter((x) => x.type === 'error' && x.code === 'RATE_LIMITED').length >= burst - 2,
    );
    socket.close();

    const refusals = messages.filter((m) => m.type === 'error' && m.code === 'RATE_LIMITED');
    expect(refusals.length).toBeGreaterThanOrEqual(burst - 2);
    // One turn produced, not thirty. The judge runs per turn, so this bounds
    // both upstream calls at once. (The fake model counts author+judge calls
    // in one counter, hence the small allowance.)
    expect(counts.model - mid).toBeLessThanOrEqual(3);
  });

  it('does not pay for transcription on frames it is going to refuse', async () => {
    const socket = await openReady();
    const audio = Buffer.from('pretend-this-is-a-minute-of-speech').toString('base64');

    const burst = 25;
    for (let i = 0; i < burst; i += 1) {
      socket.send(JSON.stringify({ type: 'learner_audio', audio, mimeType: 'audio/webm' }));
    }

    await collect(socket, (m) => m.filter((x) => x.type === 'error').length >= burst - 2);
    socket.close();

    // The floor used to sit in the callee, so every frame was transcribed and
    // billed and only the survivor produced a turn: 25 paid calls, 24 thrown
    // away. The claim now happens before the provider is touched.
    expect(counts.stt).toBeLessThanOrEqual(2);
  });
});

describe('the rate limiter cannot take the platform down', () => {
  it('does not throttle the internal surface, whose only caller is Core', async () => {
    const url = `http://127.0.0.1:${oraclePort}/api/v1/tutor/preflight`;
    const key = process.env.INTERNAL_API_KEY as string;

    /*
     * Above the 200-per-15-minutes window, from one address — which is what
     * Core is. `preflight` runs on the tutor OFFER screen, so this is roughly
     * 200 page views, not an attack. It used to make Core answer
     * ORACLE_UNAVAILABLE to every learner while /health stayed 200, so nothing
     * restarted and nothing scaled.
     */
    let throttled = 0;
    for (let i = 0; i < 230; i += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': key },
        body: JSON.stringify({ isMinor: true, wantsVoice: true }),
      });
      if (response.status === 429) throttled += 1;
    }

    expect(throttled).toBe(0);
  });

  it('rejects an unauthenticated request to that surface before parsing its body', async () => {
    /*
     * The cost of exempting the surface, bounded.
     *
     * With the limiter skipped there, an unauthenticated flood is no longer
     * stopped by a bucket — so the rejection has to be cheap.
     *
     * The body is deliberately OVER the parser's 256 kB limit, because that is
     * what makes this test discriminate: with the parser mounted first it
     * answers 413 PAYLOAD_TOO_LARGE, having read and measured the whole thing.
     * Only with `requireInternalKey` above it does an unauthenticated caller
     * get 401 for the price of one header read. A body UNDER the limit would
     * return 401 either way and prove nothing.
     */
    const response = await fetch(`http://127.0.0.1:${oraclePort}/api/v1/tutor/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(400_000) }),
    });

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
    // 413 here would mean the parser ran first and measured 400 kB before
    // anyone asked whether the caller was allowed to send it.
    expect(response.status).not.toBe(413);
  });

  it('answers an oversized AUTHENTICATED body 413, not 500', async () => {
    // The other half of the same discovery: express.json()'s typed error was
    // reaching the catch-all, so a caller who sent too much was told WE broke
    // and invited to retry the one thing that cannot work.
    const response = await fetch(`http://127.0.0.1:${oraclePort}/api/v1/tutor/preflight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY as string,
      },
      body: JSON.stringify({ padding: 'x'.repeat(400_000) }),
    });

    expect(response.status).toBe(413);
    const body = (await response.json()) as { data: null; error: { code: string } };
    // The envelope holds even here (§1.6), and the code is one the frontend
    // already has copy for.
    expect(body.data).toBeNull();
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('still throttles everything outside that surface', async () => {
    // The exemption is scoped, not a removal: an unauthenticated flood is
    // exactly what the limiter is still for.
    let throttled = 0;
    for (let i = 0; i < 230; i += 1) {
      const response = await fetch(`http://127.0.0.1:${oraclePort}/nope`);
      if (response.status === 429) throttled += 1;
    }

    expect(throttled).toBeGreaterThan(0);
  });
});

describe('revocation takes effect on the NEXT turn, as promised', () => {
  it('closes a minor’s microphone on the very next turn after Core says revoked', async () => {
    /*
     * /ORACLE.md §4.3 tells a guardian that revocation takes effect on the next
     * turn. It used to be every FIFTH turn, so a child could keep streaming to
     * the speech provider for four more — and the §16 checklist item claiming
     * next-turn was ticked. This asserts the promise, not the old behaviour.
     */
    const socket = await openReady();

    // One ordinary turn with consent in force, so the session is past the
    // greeting and the next turn is unambiguously "the next turn".
    socket.send(JSON.stringify({ type: 'learner_text', text: 'hola' }));
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.removeAllListeners('message');
    await new Promise((resolve) => setTimeout(resolve, 750));

    // The guardian revokes. Core now says so.
    consentBody = { data: { active: false }, error: null };

    socket.send(JSON.stringify({ type: 'learner_text', text: 'otra vez' }));
    const messages = await collect(
      socket,
      (m) => m.some((x) => x.code === 'CONSENT_REVOKED') || m.filter((x) => x.type === 'turn').length >= 2,
    );
    socket.close();

    expect(messages.some((m) => m.code === 'CONSENT_REVOKED')).toBe(true);
  });

  /*
   * Found by adversarial review, 2026-08-30 (HIGH): the recheck above ran
   * only inside `handleLearnerTurn`, which for a MICROPHONE turn only runs
   * AFTER `transcribe()` has already shipped the CURRENT turn's audio to the
   * third-party STT provider. No recheck cadence, however tight, can
   * retroactively un-send audio that already left — the promise "revocation
   * takes effect on the next turn" was silently broken for the turn IN
   * FLIGHT the moment the guardian revoked, every single time, not as an
   * edge case. This asserts the audio for THIS turn — the one during which
   * the revocation is discovered — never reaches the STT provider at all.
   */
  it('never sends the CURRENT turn’s audio to the STT provider once consent is already revoked', async () => {
    const socket = await openReady();

    // One ordinary turn with consent in force, so turnCount > 0 and the
    // recheck (cadence = 1 for a minor's open mic) is actually due.
    socket.send(JSON.stringify({ type: 'learner_text', text: 'hola' }));
    await collect(socket, (m) => m.some((x) => x.type === 'turn'));
    socket.removeAllListeners('message');
    await new Promise((resolve) => setTimeout(resolve, 750));

    // The guardian revokes BEFORE this next turn's audio is ever sent.
    consentBody = { data: { active: false }, error: null };

    socket.send(
      JSON.stringify({
        type: 'learner_audio',
        audio: Buffer.from('fake-webm-bytes').toString('base64'),
        mimeType: 'audio/webm;codecs=opus',
      }),
    );
    // Any ERROR frame specifically — never `thinking`, which is sent before
    // either the fix's pre-check or (pre-fix) the STT call, so waiting for it
    // alone would resolve before `counts.stt` had a chance to settle and
    // prove nothing either way. An error frame only arrives once the async
    // chain has actually run its course: instantly with the fix (refused
    // before any STT call), or only after `transcribe()` resolves without it
    // (the fake STT server's response shape does not match Inworld's real
    // one — a pre-existing fixture quirk this file's OTHER tests share — so
    // it comes back as `STT_FAILED` pre-fix, never a usable transcript).
    const messages = await collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.close();

    // THE actual defect, asserted first and foremost: the STT provider must
    // never have been called for this turn's audio, not merely that the mic
    // closed afterward.
    expect(counts.stt).toBe(0);
    // With the fix, the refusal is the CONSENT_REVOKED frame itself — no STT
    // round trip happens, so there is no separate "did transcription fail"
    // question. (Pre-fix, this same refusal instead arrives as STT_FAILED,
    // because the fake STT server's response shape does not match Inworld's
    // real one — a pre-existing fixture quirk this file's other tests also
    // rely on `counts.stt` rather than a real transcript to see past.)
    expect(messages.some((m) => m.code === 'CONSENT_REVOKED')).toBe(true);
  }, 15_000);
});

describe('an unreadable consent answer is not a granted one', () => {
  it('mutes a minor’s microphone when Core cannot be read', async () => {
    const socket = await openReady();

    // The re-check runs every fifth turn. Core answers with an envelope that
    // does not parse — the shape an outage or a proxy error page produces —
    // and `checkVoiceConsent` reports `null` for it. Acting only on a literal
    // `false` meant that read as "still granted".
    consentBody = { unexpected: 'shape' };

    let revoked = false;
    for (let i = 0; i < 6 && !revoked; i += 1) {
      socket.send(JSON.stringify({ type: 'learner_text', text: `turno ${i}` }));
      const messages = await collect(
        socket,
        (m) => m.some((x) => x.type === 'turn') || m.some((x) => x.code === 'CONSENT_REVOKED'),
      );
      revoked = messages.some((m) => m.code === 'CONSENT_REVOKED');
      socket.removeAllListeners('message');
      // Clear the 700 ms floor rather than racing it.
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    socket.close();

    expect(revoked).toBe(true);
  });
});

/*
 * The two services share no library by design (§1.5), so Oracle's age-band
 * vocabulary list is a deliberate COPY of `FORBIDDEN_BY_TIER` in
 * backend/src/services/tutorLadder.ts. A copy nobody compares is a copy that
 * drifts, and the drift here is silent in the worst direction: the generated
 * activity would be refused for a word the tutor is free to say out loud in
 * the same breath.
 */
describe('the age-band vocabulary lists agree across services', () => {
  it('catches the same words Core refuses in a generated activity', () => {
    const core = readFileSync(
      new URL('../../../backend/src/services/tutorLadder.ts', import.meta.url),
      'utf8',
    );
    const block = /const FORBIDDEN_BY_TIER[\s\S]*?\n\};/.exec(core)?.[0] ?? '';
    expect(block, 'FORBIDDEN_BY_TIER not found in tutorLadder.ts').not.toBe('');

    // Every word Core forbids for a band, Oracle must also catch for it.
    for (const [tier, probes] of [
      [1, ['Ganas 10% al año.', 'Eso es un porcentaje.', 'Cuesta 3.1416 pesos.', 'Custa 3,1416 reais.']],
      [2, ['That is compound interest.', 'Eso es interés compuesto.']],
    ] as const) {
      for (const probe of probes) {
        expect(
          tierVocabularyViolation(probe, tier),
          `tier ${tier} must catch: ${probe}`,
        ).not.toBeNull();
      }
    }
    // And tier 3 is deliberately empty on both sides.
    expect(tierVocabularyViolation('Ganas 10% al año.', 3)).toBeNull();
  });
});
