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
  /**
   * Whether a turn is already being produced for this socket.
   *
   * `socket.on('message')` dispatches fire-and-forget, so without this every
   * frame already in the read buffer starts its own upstream call at the same
   * instant. The floor below cannot catch that on its own: a burst arrives
   * inside one millisecond, so they all see the same `lastTurnAtMs`.
   */
  inFlight: boolean;
  microphone: boolean;
  closing: boolean;
  heartbeat: NodeJS.Timeout;
}

/** Minimum gap between learner turns. Not a rate limit — a sanity floor. */
const MIN_TURN_GAP_MS = 700;
/**
 * How often a live session re-checks that consent is still in force.
 *
 * EVERY TURN while a minor's microphone is actually open, because /ORACLE.md
 * §4.3 promises a guardian that revocation takes effect on the next turn and
 * for two days it did not: the poll ran every fifth turn, so a guardian who
 * revoked mid-conversation could leave the child's microphone streaming for
 * four more. Documentation promised one thing, code did another, and the §16
 * checklist item was ticked.
 *
 * The cost of keeping the promise is one internal HTTP call per turn on
 * exactly the sessions where a child is speaking to a third party — which is
 * the one place in this product where an extra round trip is obviously worth
 * paying for. Every other session keeps the cheap five-turn poll: a typed
 * session has no microphone to close, and an adult's consent is not the
 * guardian's to withdraw.
 */
const CONSENT_RECHECK_MINOR_MIC_TURNS = 1;
const CONSENT_RECHECK_EVERY_TURNS = 5;

/**
 * Claims this socket's single turn slot, or says why not.
 *
 * EVERY path that can reach the model goes through here — `learner_text`,
 * `learner_audio`, `segment_graded` and the farewell. It is a function rather
 * than a check inlined in the one handler that had it because that is exactly
 * how the gap happened: the floor lived inside `handleLearnerTurn`, and
 * `segment_graded` called the orchestrator directly, so a client could buy
 * unbounded concurrent completions by sending the frame the floor did not
 * cover. A new frame type that forgets to claim cannot reach the model at all,
 * which is the failure we want.
 *
 * `enforceFloor` is off for the farewell only: a learner pressing "end" within
 * 700 ms of their last turn should be let go, not told to wait.
 */
function claimTurn(live: Live, now: number, enforceFloor = true): 'ok' | 'busy' | 'too-soon' {
  if (live.inFlight) return 'busy';
  if (enforceFloor && now - live.lastTurnAtMs < MIN_TURN_GAP_MS) return 'too-soon';
  live.inFlight = true;
  live.lastTurnAtMs = now;
  return 'ok';
}

function releaseTurn(live: Live): void {
  live.inFlight = false;
}

/** Refuses a claim out loud. Both refusals read as one moment, deliberately. */
function refuseTurn(live: Live, why: 'busy' | 'too-soon'): void {
  send(live.socket, {
    type: 'error',
    code: 'RATE_LIMITED',
    message: why === 'busy' ? 'One at a time.' : 'One moment.',
  });
}

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
    inFlight: false,
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

    case 'end_session': {
      // Claimed so a burst of `end_session` cannot produce a pile of
      // farewells, but exempt from the floor: nobody is made to wait to leave.
      const claim = claimTurn(live, Date.now(), false);
      if (claim !== 'ok') return refuseTurn(live, claim);
      try {
        await deliver(live, await live.orchestrator.farewell(Date.now(), 'soft'));
        await finish(live, 'completed');
      } finally {
        releaseTurn(live);
      }
      return;
    }

    case 'adaptation_response':
      // Local state only — no upstream call, so no slot to claim.
      if (message.data.accepted) live.orchestrator.applyAdaptation(message.data.adaptation);
      return;

    case 'segment_graded': {
      const claim = claimTurn(live, Date.now());
      if (claim !== 'ok') return refuseTurn(live, claim);
      try {
        await deliver(
          live,
          await live.orchestrator.handleSegmentResult(message.data.score, message.data.correct, Date.now()),
        );
      } finally {
        releaseTurn(live);
      }
      return;
    }

    case 'learner_text': {
      const claim = claimTurn(live, Date.now());
      if (claim !== 'ok') return refuseTurn(live, claim);
      try {
        await handleLearnerTurn(live, message.data.text);
      } finally {
        releaseTurn(live);
      }
      return;
    }

    case 'learner_audio': {
      if (!live.microphone) {
        send(live.socket, {
          type: 'error',
          code: 'CONSENT_REQUIRED',
          message: 'The microphone is not enabled for this session.',
        });
        return;
      }
      /*
       * CLAIMED BEFORE `transcribe`, which is the whole point.
       *
       * Transcription is a billed third-party call carrying up to ~1.1 MB of
       * audio, and it used to run before any gate: the floor sat in the callee,
       * so every frame was transcribed and paid for and only the survivor
       * produced a turn. A hundred frames bought a hundred transcriptions and
       * discarded ninety-nine.
       */
      const claim = claimTurn(live, Date.now());
      if (claim !== 'ok') return refuseTurn(live, claim);
      try {
        const text = await transcribe(message.data.audio, message.data.mimeType, live.session);
        if (text === null || text.trim() === '') {
          send(live.socket, { type: 'error', code: 'STT_FAILED', message: 'I did not catch that.' });
          return;
        }
        // Echoed back so the learner can see what we heard. A misheard turn that
        // the learner cannot see is a tutor answering a question nobody asked.
        send(live.socket, { type: 'transcript', text });
        await handleLearnerTurn(live, text);
      } finally {
        releaseTurn(live);
      }
      return;
    }
  }
}

async function handleLearnerTurn(live: Live, text: string): Promise<void> {
  // The floor and the single-flight slot are the CALLER's, claimed before any
  // paid work — including the transcription that precedes an audio turn. This
  // function must not re-check the floor: `claimTurn` has already stamped
  // `lastTurnAtMs`, so a second check here would refuse every turn.

  // Consent is re-checked periodically DURING a session, not only at the door.
  // /ORACLE.md §4.3 requires revocation to take effect on the next turn, and a
  // guardian who revokes while their child is mid-session means it now.
  const recheckEvery =
    live.microphone && live.session.isMinor
      ? CONSENT_RECHECK_MINOR_MIC_TURNS
      : CONSENT_RECHECK_EVERY_TURNS;

  if (
    live.microphone &&
    live.session.isMinor &&
    live.orchestrator.turnCount > 0 &&
    live.orchestrator.turnCount % recheckEvery === 0
  ) {
    /*
     * `!== true`, NOT `=== false`.
     *
     * `checkVoiceConsent` answers `null` for "could not determine" — Core
     * unreachable, timed out, or an envelope that did not parse. Acting only on
     * the literal `false` meant an unreadable answer read as "still granted",
     * so a revocation that landed during a Core outage was never observed for
     * the rest of the session and the child kept streaming to the provider.
     *
     * The door already gets this right: `fetchSessionContext` returning `null`
     * closes the socket. §1.14 — failure must be distinguishable from
     * emptiness, and the caller must refuse. This is the same upstream
     * guarding the same child-safety property, so it refuses the same way.
     */
    const active = await checkVoiceConsent(live.session.userId);
    if (active !== true) {
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

  // `Date.now()` here rather than the caller's stamp: for an audio turn the
  // claim happened before a transcription that may have taken a second, and
  // the budget should be measured against when the tutor actually answers.
  await deliver(live, await live.orchestrator.handleLearnerText(text, Date.now()));
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
