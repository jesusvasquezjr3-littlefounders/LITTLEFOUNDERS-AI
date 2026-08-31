import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/*
 * REGRESSION TEST for adversarial review sweep tutor-review-sweep-101
 * (voice-audio-quality dimension), 3/3 independent skeptics, HIGH.
 *
 * `transcribe()` (`ws/server.ts`) used to collapse two unrelated facts into
 * the identical `null`: "the child said nothing intelligible" (a real STT
 * call, a real empty transcript) and "the call to the STT provider itself
 * never came back" (a timeout, a dropped connection, an Inworld 5xx — every
 * shape `VoiceUnavailableError` wraps, per `voice/inworld.ts`). Both then
 * reached the learner as the SAME `STT_FAILED` — "try again, a little closer
 * to the microphone" — telling a child their microphone technique was the
 * problem when the real cause was an outage they cannot fix by speaking
 * louder.
 *
 * This drives a REAL socket against a REAL (fake) Inworld STT endpoint, the
 * same style as `hardening.test.ts` and `live-session.test.ts`: the defect
 * lives in the seam between `voice/inworld.ts` (which already throws a typed
 * error on a provider 5xx — proven in `voice.test.ts`) and `ws/server.ts`
 * (which used to swallow that distinction), so only an end-to-end drive
 * proves the seam is fixed rather than either side in isolation.
 *
 * No fake model server is needed: the greeting is fully scripted
 * (/AGENTS.md §2.2) and both cases here return before any turn ever reaches
 * `handleLearnerTurn`. `isMinor: false` in the fake session keeps consent and
 * moderation-readiness out of scope — the microphone gate is then just
 * `voice && !isMinor`, matching `ws/server.ts`'s own `microphone` computation.
 */

const SESSION_ID = '77777777-7777-4777-8777-777777777777';
const USER_ID = '88888888-8888-4888-8888-888888888888';

/** Flipped per test to shape what the fake Inworld STT endpoint answers. */
let sttMode: 'empty' | 'fail' = 'empty';

let oracleServer: Server;
let coreServer: Server;
let voiceServer: Server;
let oraclePort = 0;

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
            locale: 'en-US',
            nickname: 'Robi',
            character: 'rho',
            companion: 'liruf',
            diorama: 'diorama-a',
            intent: 'course_topic',
            adaptations: [],
            courseContext: null,
            skillStates: [],
            // Adult session: no consent gate, no judge required — the
            // microphone-availability question is what is under test here,
            // not the minor-consent machinery those two things gate.
            isMinor: false,
            voiceConsent: true,
            intelDegraded: false,
          });
        }
        if (url.includes('/turns')) return json(res, { recorded: true });
        if (url.includes('/flags')) return json(res, { recorded: true });
        return json(res, null, 404);
      })();
    }),
  );
}

/** A fake Inworld: TTS always succeeds; STT answers per `sttMode`. */
function startFakeVoice(): Promise<Server> {
  return listen(
    createServer((req, res) => {
      void (async () => {
        const url = req.url ?? '';
        await readBody(req);
        if (url.includes('/stt/')) {
          if (sttMode === 'fail') {
            // The exact shape `voice/inworld.ts`'s own comment documents:
            // Inworld's real answer on a demuxer failure, or any other 5xx.
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ code: 13, message: 'proxy has failed to process your request' }));
          }
          // A real, successful call that heard nothing usable — genuine
          // silence, not a transport failure.
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ transcription: { transcript: '' } }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ audioContent: Buffer.from('fake-mp3').toString('base64') }));
      })();
    }),
  );
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

/** Opens a socket and waits for the scripted greeting, so tests start level. */
async function openReady(): Promise<WebSocket> {
  const socket = new WebSocket(await socketUrl());
  await collect(socket, (m) => m.some((x) => x.type === 'turn'));
  return socket;
}

beforeAll(async () => {
  coreServer = await startFakeCore();
  voiceServer = await startFakeVoice();

  process.env.CORE_URL = `http://127.0.0.1:${portOf(coreServer)}`;
  process.env.VOICE_PROVIDER = 'inworld';
  process.env.INWORLD_API_BASE = `http://127.0.0.1:${portOf(voiceServer)}`;
  process.env.INWORLD_API_KEY = 'test-inworld-key-0123';
  process.env.INWORLD_VOICE_RHO_EN_US = 'test-voice-rho';

  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
  const { resetVoiceProvider } = await import('../voice/index.js');
  resetVoiceProvider();

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
    [oracleServer, coreServer, voiceServer].map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
  for (const key of ['VOICE_PROVIDER', 'INWORLD_API_BASE', 'INWORLD_API_KEY', 'INWORLD_VOICE_RHO_EN_US']) {
    delete process.env[key];
  }
});

beforeEach(() => {
  sttMode = 'empty';
});

afterEach(async () => {
  const { nonceLedger } = await import('../session/token.js');
  nonceLedger.clear();
  // A socket closed without a farewell PARKS its session for resume; sweep it
  // so the next test's fresh socket is not refused as ALREADY_CONNECTED.
  await new Promise((r) => setTimeout(r, 120));
  const { finalizeAllParked } = await import('../ws/server.js');
  finalizeAllParked();
});

describe('a failed STT call is not the same fact as genuine silence', () => {
  it('sends STT_FAILED, unchanged, when the provider genuinely heard nothing', async () => {
    sttMode = 'empty';
    const socket = await openReady();
    const audio = Buffer.from('pretend-this-is-silence').toString('base64');

    const errored = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send(JSON.stringify({ type: 'learner_audio', audio, mimeType: 'audio/webm' }));
    const messages = await errored;
    socket.close();

    const error = messages.find((m) => m.type === 'error') as { code: string };
    expect(error.code).toBe('STT_FAILED');
  });

  it('sends the NEW distinct code when the STT call itself fails, never STT_FAILED', async () => {
    sttMode = 'fail';
    const socket = await openReady();
    const audio = Buffer.from('pretend-this-is-a-real-question').toString('base64');

    const errored = collect(socket, (m) => m.some((x) => x.type === 'error'));
    socket.send(JSON.stringify({ type: 'learner_audio', audio, mimeType: 'audio/webm' }));
    const messages = await errored;
    socket.close();

    const error = messages.find((m) => m.type === 'error') as { code: string };
    // The whole point: a transport/provider failure must NOT arrive as
    // STT_FAILED, which blames the child's microphone for an outage that was
    // never theirs to fix.
    expect(error.code).not.toBe('STT_FAILED');
    expect(error.code).toBe('STT_UNAVAILABLE');
  });
});
