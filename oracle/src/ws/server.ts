import type { IncomingMessage, Server } from 'http';
import { getConfig } from '../env.js';
import { WebSocketServer, type WebSocket } from 'ws';
import { looksLikeSupabaseJwt, verifySessionToken } from '../session/token.js';
import {
  checkVoiceConsent,
  closeSession,
  fetchSessionContext,
  persistSafetyFlag,
  persistTurn,
  requestSegment,
  verifyGeneratedSegment,
  type SessionContext,
} from '../core/client.js';
import { getVoiceProvider } from '../voice/index.js';
import { newSpeechScope, speakLine, type SpeechScope } from '../voice/speech.js';
import { generateSegment } from '../content/generate.js';
import { moderationReadiness } from '../safety/moderation.js';
import { TutorOrchestrator, type TurnOutcome } from '../tutor/orchestrator.js';
import { CLOSE_CODES, ClientMessageSchema, type ServerMessage } from './protocol.js';

/*
 * The one browser-facing socket (/AGENTS.md §1.5 Oracle exception).
 *
 * Everything defensive about this file is in the first forty lines of
 * `handleConnection`, and it is ordered cheapest-first so that an unauthorized
 * connection costs us a signature check rather than a round trip to Core:
 *
 *   1. a token is present at all
 *   2. it is not a Supabase JWT (named explicitly, so the log says what to fix)
 *   3. the signature verifies, it has not expired, it has not been used before
 *   4. Core recognises the session and it belongs to the token's user
 *   5. moderation is available for the audience this session serves
 *   6. the microphone is refused unless consent is active RIGHT NOW
 *
 * Only after all six does a socket become a session.
 */

interface Live {
  socket: WebSocket;
  session: SessionContext;
  orchestrator: TutorOrchestrator;
  /** What this session has already paid to say. Dropped when the socket dies. */
  speech: SpeechScope;
  /** Rolling per-turn floor, so one client cannot spin the model. */
  lastTurnAtMs: number;
  microphone: boolean;
  closing: boolean;
  heartbeat: NodeJS.Timeout;
}

/** Minimum gap between learner turns. Not a rate limit — a sanity floor. */
const MIN_TURN_GAP_MS = 700;
/** How often a live session re-checks that consent is still in force. */
const CONSENT_RECHECK_EVERY_TURNS = 5;

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function tokenFrom(request: IncomingMessage): string | null {
  // Query string rather than a header: browsers cannot set headers on a
  // WebSocket handshake. The token is single-use and expires in a minute
  // precisely because it has to travel somewhere this visible.
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

export function attachTutorSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/tutor', maxPayload: 2 * 1024 * 1024 });

  wss.on('connection', (socket, request) => {
    void handleConnection(socket, request).catch((error: unknown) => {
      console.error('[oracle] connection handler threw:', error);
      socket.close(CLOSE_CODES.SERVICE_DEGRADED, 'internal error');
    });
  });

  return wss;
}

async function handleConnection(socket: WebSocket, request: IncomingMessage): Promise<void> {
  const raw = tokenFrom(request);
  if (!raw) {
    socket.close(CLOSE_CODES.UNAUTHORIZED, 'missing session token');
    return;
  }
  if (looksLikeSupabaseJwt(raw)) {
    // Named explicitly. "malformed" would send whoever wired the client
    // looking at their JSON encoding rather than at the fact that this socket
    // takes a Core-minted session token and nothing else.
    console.warn('[oracle] rejected a Supabase JWT on the tutor socket');
    socket.close(CLOSE_CODES.UNAUTHORIZED, 'this socket takes a session token, not a Supabase JWT');
    return;
  }

  const verdict = verifySessionToken(raw);
  if (!verdict.ok) {
    socket.close(CLOSE_CODES.UNAUTHORIZED, `session token ${verdict.reason}`);
    return;
  }

  const session = await fetchSessionContext(verdict.payload.sid);
  if (!session) {
    // An unreadable session is NOT an empty session (§1.14). Refuse rather
    // than starting one with defaults — defaults here would mean "not a minor,
    // no consent needed", which is the worst possible guess to get wrong.
    socket.close(CLOSE_CODES.SESSION_NOT_FOUND, 'session could not be resolved');
    return;
  }
  if (session.userId !== verdict.payload.uid) {
    console.error('[oracle] token/session user mismatch — refusing');
    socket.close(CLOSE_CODES.UNAUTHORIZED, 'token does not match session');
    return;
  }

  const readiness = moderationReadiness(session.isMinor);
  if (!readiness.ready) {
    // Refused at the door rather than turn by turn (/ORACLE.md §6): a child
    // sitting with a character who apologises forever is worse than an honest
    // "not available right now".
    console.error('[oracle] refusing a minor session: no moderation judge configured');
    socket.close(CLOSE_CODES.SERVICE_DEGRADED, 'moderation unavailable');
    return;
  }

  /*
   * THREE conditions for a minor's microphone, and all must hold: a working
   * provider, an active guardian consent, and the DPA policy flag. An adult
   * needs only the provider. See `TUTOR_VOICE_FOR_MINORS` in env.ts for why
   * the policy is a flag rather than an absent key.
   */
  const voice = getVoiceProvider().available;
  const minorVoiceAllowed = getConfig().TUTOR_VOICE_FOR_MINORS;
  const microphone = voice && (!session.isMinor || (session.voiceConsent && minorVoiceAllowed));

  const speech = newSpeechScope(session);
  const live: Live = {
    socket,
    session,
    orchestrator: new TutorOrchestrator(session, Date.now(), (turn) => speakLine(turn.say, speech)),
    speech,
    lastTurnAtMs: 0,
    microphone,
    closing: false,
    heartbeat: setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping();
    }, 30_000),
  };

  send(socket, {
    type: 'ready',
    sessionId: session.sessionId,
    character: session.character,
    companion: session.companion,
    diorama: session.diorama,
    voice,
    microphone,
    intelDegraded: session.intelDegraded,
    locale: session.locale,
  });

  socket.on('message', (data) => {
    void onMessage(live, data.toString()).catch((error: unknown) => {
      console.error('[oracle] message handler threw:', error);
      send(socket, { type: 'error', code: 'INTERNAL', message: 'Something went wrong on our side.' });
    });
  });

  socket.on('close', () => {
    clearInterval(live.heartbeat);
    live.speech.memo.clear();
    if (!live.closing) {
      // The socket died without a farewell. Record it as `learner_left`, which
      // is true, rather than as `completed`, which would quietly inflate every
      // completion metric the product has.
      void closeSession({
        sessionId: session.sessionId,
        closeReason: 'learner_left',
        turnCount: live.orchestrator.turnCount,
        segmentCount: live.orchestrator.servedSegments,
        costUsd: live.orchestrator.totalCostUsd,
      });
    }
  });

  // The opening line. Deliberately after `ready`: the client waits for the 3D
  // stage's own onReady before it plays anything, and handing over speech
  // while the assets resolve plays audio at a blank canvas (/TUTOR_3D.md §7b).
  await deliver(live, await live.orchestrator.greet(Date.now()));
}

async function onMessage(live: Live, raw: string): Promise<void> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    send(live.socket, { type: 'error', code: 'VALIDATION_ERROR', message: 'Malformed message' });
    return;
  }

  const message = ClientMessageSchema.safeParse(parsedJson);
  if (!message.success) {
    send(live.socket, { type: 'error', code: 'VALIDATION_ERROR', message: 'Unrecognised message' });
    return;
  }

  switch (message.data.type) {
    case 'ping':
      send(live.socket, {
        type: 'state',
        budget: 'running',
        remainingMs: 0,
        turnCount: live.orchestrator.turnCount,
      });
      return;

    case 'end_session':
      await deliver(live, await live.orchestrator.farewell(Date.now(), 'soft'));
      await finish(live, 'completed');
      return;

    case 'adaptation_response':
      if (message.data.accepted) live.orchestrator.applyAdaptation(message.data.adaptation);
      return;

    case 'segment_graded':
      await deliver(
        live,
        await live.orchestrator.handleSegmentResult(message.data.score, message.data.correct, Date.now()),
      );
      return;

    case 'learner_text':
      await handleLearnerTurn(live, message.data.text);
      return;

    case 'learner_audio': {
      if (!live.microphone) {
        send(live.socket, {
          type: 'error',
          code: 'CONSENT_REQUIRED',
          message: 'The microphone is not enabled for this session.',
        });
        return;
      }
      const text = await transcribe(message.data.audio, message.data.mimeType, live.session);
      if (text === null || text.trim() === '') {
        send(live.socket, { type: 'error', code: 'STT_FAILED', message: 'I did not catch that.' });
        return;
      }
      // Echoed back so the learner can see what we heard. A misheard turn that
      // the learner cannot see is a tutor answering a question nobody asked.
      send(live.socket, { type: 'transcript', text });
      await handleLearnerTurn(live, text);
      return;
    }
  }
}

async function handleLearnerTurn(live: Live, text: string): Promise<void> {
  const now = Date.now();
  if (now - live.lastTurnAtMs < MIN_TURN_GAP_MS) {
    send(live.socket, { type: 'error', code: 'RATE_LIMITED', message: 'One moment.' });
    return;
  }
  live.lastTurnAtMs = now;

  // Consent is re-checked periodically DURING a session, not only at the door.
  // /ORACLE.md §4.3 requires revocation to take effect on the next turn, and a
  // guardian who revokes while their child is mid-session means it now.
  if (
    live.microphone &&
    live.session.isMinor &&
    live.orchestrator.turnCount > 0 &&
    live.orchestrator.turnCount % CONSENT_RECHECK_EVERY_TURNS === 0
  ) {
    const active = await checkVoiceConsent(live.session.userId);
    if (active === false) {
      live.microphone = false;
      send(live.socket, {
        type: 'error',
        code: 'CONSENT_REVOKED',
        message: 'The microphone was turned off. You can keep going by tapping.',
      });
    }
  }

  // The learner's own turn goes into the transcript before the tutor answers,
  // so a guardian reading it later sees the exchange in the order it happened
  // even if the tutor's reply never arrives.
  void persistTurn({
    sessionId: live.session.sessionId,
    seq: live.orchestrator.turnCount,
    speaker: 'learner',
    text,
    source: 'stt',
  });

  await deliver(live, await live.orchestrator.handleLearnerText(text, now));
}

async function deliver(live: Live, outcome: TurnOutcome): Promise<void> {
  const { emission, safety, budget, closeReason } = outcome;

  send(live.socket, {
    type: 'turn',
    seq: emission.seq,
    say: emission.turn.say,
    emotion: emission.turn.emotion,
    action: emission.turn.action,
    audioUrl: emission.audioUrl,
    next: emission.turn.next,
  });

  void persistTurn({
    sessionId: live.session.sessionId,
    seq: emission.seq,
    speaker: 'tutor',
    text: emission.turn.say,
    emotion: emission.turn.emotion,
    action: emission.turn.action,
    audioPath: emission.audioUrl,
    source: emission.source,
    moderation: emission.moderation,
  });

  if (safety) {
    void persistSafetyFlag({
      sessionId: live.session.sessionId,
      turnSeq: safety.turnSeq,
      category: safety.category,
      severity: safety.severity,
      handled: safety.handled,
    });
  }

  if (emission.turn.offerAdaptation) {
    send(live.socket, { type: 'adaptation_offer', adaptation: emission.turn.offerAdaptation });
  }

  if (emission.turn.next === 'segment' && emission.turn.segmentRequest) {
    await serveSegment(live, emission.turn.segmentRequest);
  }

  send(live.socket, {
    type: 'state',
    budget: budget.state,
    remainingMs: budget.remainingMs,
    turnCount: live.orchestrator.turnCount,
  });

  if (closeReason) await finish(live, closeReason === 'turn_cap' ? 'hard_budget' : closeReason);
}

async function serveSegment(
  live: Live,
  requestInput: { skillKey: string; difficulty: number; framing: string; rationale: string },
): Promise<void> {
  /*
   * The ladder, from this side (/ORACLE.md §7).
   *
   * Core answers with a segment (tiers 1 and 2) or with an invitation to
   * generate one (tier 3). Generation is Oracle's, verification is Core's, and
   * either half saying no means the panel does not fill — never that something
   * generic appears in it.
   */
  let served = await requestSegment({ sessionId: live.session.sessionId, ...requestInput });

  if (served !== null && 'needsGeneration' in served) {
    const candidate = await generateSegment({
      skillKey: served.skillKey,
      tier: served.tier,
      locale: served.locale,
      difficulty: served.difficulty,
      framing: requestInput.framing,
      rationale: requestInput.rationale,
      allowedTypes: served.allowedTypes,
      recentTutorLines: live.orchestrator.recentTutorLines,
    });
    served = candidate
      ? await verifyGeneratedSegment({
          sessionId: live.session.sessionId,
          segment: candidate.segment,
          provenance: candidate.provenance,
        })
      : null;
  }

  if (served === null || 'needsGeneration' in served) {
    // Emit nothing rather than something generic (/ORACLE.md §7.3). The tutor
    // stays in conversation; the panel simply does not fill.
    send(live.socket, {
      type: 'error',
      code: 'NO_SEGMENT',
      message: 'No activity was available for that just now.',
    });
    return;
  }

  live.orchestrator.noteSegmentServed();
  send(live.socket, {
    type: 'segment',
    segmentId: served.segmentId,
    seq: served.seq,
    origin: served.origin,
    segment: served.segment,
    scoresXp: served.keyVerified,
    framing: requestInput.framing,
  });
}

async function finish(
  live: Live,
  reason: 'completed' | 'hard_budget' | 'safety_stop' | 'consent_revoked' | 'error',
): Promise<void> {
  if (live.closing) return;
  live.closing = true;
  clearInterval(live.heartbeat);

  /*
   * One line, at the one moment the whole session's economics are known.
   *
   * Model and voice are split because they behave differently and are fixed
   * differently: model cost tracks turns, voice cost tracks how much of what
   * was said had never been said before. `free` counting higher than `paid` is
   * the pre-generated set and the cache doing their job; `free: 0` on a normal
   * session means the manifest was never generated in this environment.
   */
  const speech = live.orchestrator.speechCounts;
  console.log(
    `[oracle] session closed (${reason}) — turns=${live.orchestrator.turnCount} ` +
      `model=$${live.orchestrator.modelCostUsd.toFixed(5)} voice=$${live.orchestrator.voiceCostUsd.toFixed(5)} ` +
      `speech paid=${speech.paid} free=${speech.free}`,
  );

  await closeSession({
    sessionId: live.session.sessionId,
    closeReason: reason,
    turnCount: live.orchestrator.turnCount,
    segmentCount: live.orchestrator.servedSegments,
    costUsd: live.orchestrator.totalCostUsd,
  });

  send(live.socket, { type: 'closed', reason });
  live.socket.close(reason === 'completed' ? CLOSE_CODES.NORMAL : CLOSE_CODES.BUDGET_EXHAUSTED, reason);
}

async function transcribe(
  base64: string,
  mimeType: string,
  session: SessionContext,
): Promise<string | null> {
  const provider = getVoiceProvider();
  if (!provider.available) return null;
  try {
    const result = await provider.transcribe({
      audio: Buffer.from(base64, 'base64'),
      mimeType,
      locale: session.locale,
    });
    return result.text;
  } catch (error) {
    console.warn('[oracle] transcription failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export const WS_PATH = '/ws/tutor';

/** Lets index.ts shut the socket layer down without importing `ws` itself. */
export function closeAllSockets(wss: WebSocketServer): void {
  for (const client of wss.clients) {
    client.close(CLOSE_CODES.NORMAL, 'server shutting down');
  }
  wss.close();
}
