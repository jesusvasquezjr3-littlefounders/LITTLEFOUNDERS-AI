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
  voiceCheck,
  type SessionContext,
} from '../core/client.js';
import { verifyGradeEcho } from '../session/gradeEcho.js';
import { getVoiceProvider } from '../voice/index.js';
import { newSpeechScope, speakLine, type SpeechScope } from '../voice/speech.js';
import { generateSegment } from '../content/generate.js';
import { moderationReadiness } from '../safety/moderation.js';
import { TutorOrchestrator, type TurnOutcome } from '../tutor/orchestrator.js';
import { CLOSE_CODES, ClientMessageSchema, MAX_AUDIO_B64_CHARS, type ServerMessage } from './protocol.js';
import { assembleClip, decodeChunk } from './audioAssembly.js';

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
  /**
   * Cancels the production currently in flight, when there is one. Set by the
   * claiming handler, cleared in its finally, fired by an `interrupt` frame.
   * Firing it outside a turn does nothing — there is nothing to cancel.
   */
  abort: AbortController | null;
  /**
   * A streamed audio clip being assembled while the learner holds the button
   * (`learner_audio_begin`/`_chunk`/`_commit`). `chars` is the running base64
   * total, enforced against the SAME ceiling as the whole-clip frame so the
   * chunk path cannot carry what the single frame would refuse.
   */
  /*
    * A streamed upload, held as DECODED BYTES.
    *
    * It used to hold the base64 strings and join them at commit, which silently
    * truncated every microphone turn to its first chunk — see the commit case
    * below. Decoding on arrival makes the concatenation a byte operation, which
    * is the only kind that is correct.
    */
  assembly: { mimeType: string; parts: Buffer[]; bytes: number; chars: number } | null;
  microphone: boolean;
  closing: boolean;
  /**
   * Consecutive transcript writes that Core did not confirm. `persistTurn`
   * has always RETURNED whether the record was kept "so the caller can count
   * failures and close the session if the record is systematically not being
   * kept" — and both call sites discarded the boolean. Now the counting the
   * comment promised exists: a session whose record is not being written is a
   * different product from the one we promised a guardian, and it ends.
   */
  persistFailures: number;
  /**
   * THE TRANSCRIPT'S OWN ROW COUNTER, and it must not be the model-turn seq.
   *
   * `tutor_turns` is unique on `(session_id, seq)` and written with
   * `resolution=ignore-duplicates`, so two rows claiming one seq means the
   * second is discarded IN SILENCE. That is exactly what shipped: the learner
   * was persisted with `orchestrator.turnCount` (the counter BEFORE the turn's
   * increment) and the tutor with `emission.seq` (the same counter AFTER it),
   * so every learner line collided with the tutor line before it and was
   * dropped. Every transcript in production is the tutor talking to itself —
   * a guardian cannot read what their child said, which §1.9 makes an
   * invariant, and the owner's own written feedback to the Tutor was thrown
   * away by the database on arrival.
   *
   * The model-turn seq cannot simply be reused: it counts MODEL CALLS, it is
   * on the wire (the client correlates `turn_audio` by it), and one model turn
   * legitimately produces two transcript rows. So the transcript gets its own
   * monotonic counter, incremented for every row, learner and tutor alike.
   */
  transcriptSeq: number;
  heartbeat: NodeJS.Timeout;
  /** Last pong seen. A socket that stops answering pings is dead, not idle. */
  lastPongAtMs: number;
  /**
   * Last frame that was the LEARNER doing something — anything except `ping`.
   * Keepalives prove the tab is open, not that anyone is in front of it, and
   * an abandoned open tab must not hold a session (and its orchestrator, and
   * its transcript) in memory until the hard budget notices.
   */
  lastActivityAtMs: number;
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

const HEARTBEAT_INTERVAL_MS = 30_000;

/*
 * DROPPED SESSIONS, PARKED FOR RESUME (owner sign-off 2026-08-28).
 *
 * A socket that dies without a farewell used to end the session on the spot —
 * a sleeping phone, a proxy timeout or a stairwell cost the whole
 * conversation. Now the orchestrator (history, budget clock, paid speech memo)
 * is parked here for SESSION_RESUME_GRACE_MS. Core mints a FRESH single-use
 * token for the same session (`POST /api/v1/tutor/sessions/:id/resume`, owner
 * only) and the handshake below re-attaches instead of starting over: every
 * gate re-runs — signature, replay, user match, judge readiness, consent — so
 * a resumed socket is exactly as authenticated as a first one.
 *
 * The park is THIS PROCESS'S MEMORY, exactly like the token nonce ledger, so
 * it adds nothing new to the single-replica constraint — it rides it. A parked
 * session that nobody reclaims is finalized as `learner_left`, which is what
 * happened.
 */
interface ParkedSession {
  orchestrator: TutorOrchestrator;
  speech: SpeechScope;
  lastTurnAtMs: number;
  timer: NodeJS.Timeout;
  /**
   * Carried across the park, because the transcript's row numbers are unique
   * per session and a resumed socket keeps writing into the SAME transcript.
   * Restarting the count at zero would make every row after a reconnect
   * collide with one already stored and be dropped by `ignore-duplicates` —
   * the same silent deletion that lost every learner line, wearing a different
   * hat.
   */
  transcriptSeq: number;
}

const parkedSessions = new Map<string, ParkedSession>();

function parkSession(sessionId: string, live: Live): void {
  // A stale park for the same session (two sockets raced) is finalized first —
  // two parked orchestrators for one session would both write a close later.
  finalizeParked(sessionId);
  const entry: ParkedSession = {
    orchestrator: live.orchestrator,
    speech: live.speech,
    lastTurnAtMs: live.lastTurnAtMs,
    transcriptSeq: live.transcriptSeq,
    timer: setTimeout(() => finalizeParked(sessionId), getConfig().SESSION_RESUME_GRACE_MS),
  };
  entry.timer.unref();
  parkedSessions.set(sessionId, entry);
}

function takeParked(sessionId: string): ParkedSession | null {
  const entry = parkedSessions.get(sessionId);
  if (!entry) return null;
  clearTimeout(entry.timer);
  parkedSessions.delete(sessionId);
  return entry;
}

/** The park expired (or the process is shutting down): the session really ended. */
function finalizeParked(sessionId: string): void {
  const entry = parkedSessions.get(sessionId);
  if (!entry) return;
  clearTimeout(entry.timer);
  parkedSessions.delete(sessionId);
  entry.speech.memo.clear();
  void closeSession({
    sessionId,
    closeReason: 'learner_left',
    turnCount: entry.orchestrator.turnCount,
    segmentCount: entry.orchestrator.servedSegments,
    costUsd: entry.orchestrator.totalCostUsd,
  });
}

/** Every parked session, finalized. Called on shutdown so no close is lost. */
export function finalizeAllParked(): void {
  for (const sessionId of [...parkedSessions.keys()]) finalizeParked(sessionId);
}

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

/** After this many consecutive unconfirmed transcript writes, the session ends. */
const PERSIST_FAILURE_LIMIT = 5;

/**
 * The next row number in this session's transcript.
 *
 * Allocated EAGERLY by every caller, including the tutor's — whose write waits
 * on synthesis inside `emission.audio.then(...)`. Allocating in there would
 * number rows by the order audio happened to resolve rather than by the order
 * the conversation happened, so a learner's next line could be numbered ahead
 * of the tutor reply it was answering.
 */
function nextTranscriptSeq(live: Live): number {
  live.transcriptSeq += 1;
  return live.transcriptSeq;
}

function notePersist(live: Live, recorded: boolean): void {
  if (recorded) {
    live.persistFailures = 0;
    return;
  }
  live.persistFailures += 1;
  if (live.persistFailures >= PERSIST_FAILURE_LIMIT && !live.closing) {
    // A conversation nobody can replay and no guardian can read is not the
    // product we promised. Ending it is the honest move, and `finish` still
    // TRIES the close write — Core coming back mid-failure records the end.
    console.error(
      `[oracle] ${live.persistFailures} consecutive transcript writes unconfirmed — closing the session`,
    );
    void finish(live, 'error');
  }
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

  // A parked orchestrator for this session means this socket is a RESUME:
  // same history, same budget clock, same paid-speech memo. Every gate above
  // already re-ran against a fresh token and a fresh Core context.
  const resumed = takeParked(session.sessionId);
  const speech = resumed?.speech ?? newSpeechScope(session);
  const live: Live = {
    socket,
    session,
    orchestrator:
      /*
       * ONLY `turn.say` REACHES THE VOICE, and that is a decision now rather
       * than an oversight.
       *
       * The turn also carries `emotion` — happy, thinking, encouraging, proud
       * — chosen per turn by the pedagogical controller, which is the
       * blueprint's differentiator #2, "prosodia dirigida por pedagogía". Our
       * TTS request has no emotion field, so the only route is an inline
       * direction tag in the text.
       *
       * MEASURED on 2026-08-29 with `step=probe-prosody`, the same sentence
       * synthesized three ways against the live provider:
       *
       *   plain     97,536 bytes
       *   [warm]   120,192 bytes   ← 23% MORE audio: the tag is SPOKEN
       *   <warm>   103,680 bytes   ← within 6%: not spoken
       *
       * The blueprint recommends the square-bracket form. On this provider it
       * would have a six-year-old hear "corchete warm cierra corchete" before
       * the answer to their question — a worse defect than the one it fixes,
       * aimed at the youngest users, and invisible to every test we have
       * because the failure is in the audio.
       *
       * The angle-bracket form is not read aloud. That is NOT evidence it
       * changes the delivery; a silently dropped tag looks identical from
       * here. So nothing ships until someone LISTENS. Re-run the probe before
       * trying again — this is a provider behaviour, and it can change.
       */
      resumed?.orchestrator ?? new TutorOrchestrator(session, Date.now(), (turn) => speakLine(turn.say, speech)),
    speech,
    lastTurnAtMs: resumed?.lastTurnAtMs ?? 0,
    inFlight: false,
    abort: null,
    assembly: null,
    microphone,
    closing: false,
    persistFailures: 0,
    transcriptSeq: resumed?.transcriptSeq ?? 0,
    heartbeat: setInterval(() => {
      if (socket.readyState !== socket.OPEN) return;
      const now = Date.now();
      /*
       * LIVENESS AND IDLENESS ARE DIFFERENT DEATHS, checked from one clock.
       *
       * A socket that has not answered a ping in two-and-a-half intervals is a
       * dead TCP connection wearing an open readyState — terminate it, so the
       * close handler runs now rather than whenever the OS notices. A socket
       * that answers pings but has carried no learner frame for the idle
       * window is an abandoned tab — close it POLITELY, so the same handler
       * records `learner_left`, which is what happened.
       */
      if (now - live.lastPongAtMs > HEARTBEAT_INTERVAL_MS * 2.5) {
        socket.terminate();
        return;
      }
      if (now - live.lastActivityAtMs > getConfig().SESSION_IDLE_TIMEOUT_MS && !live.inFlight) {
        socket.close(CLOSE_CODES.NORMAL, 'idle');
        return;
      }
      socket.ping();
    }, HEARTBEAT_INTERVAL_MS),
    lastPongAtMs: Date.now(),
    lastActivityAtMs: Date.now(),
  };

  socket.on('pong', () => {
    live.lastPongAtMs = Date.now();
  });

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
    if (!live.closing) {
      // The socket died without a farewell. The session is PARKED, not ended:
      // a sleeping phone or a proxy timeout should cost the connection, never
      // the conversation. If nobody resumes inside the grace window, the park
      // finalizes it as `learner_left` — which is what will then be true —
      // and only then is the speech memo dropped.
      parkSession(session.sessionId, live);
    } else {
      live.speech.memo.clear();
    }
  });

  if (resumed) {
    /*
     * A re-attach redraws the conversation instead of greeting again: the
     * transcript so far, then the turn that was on screen when the connection
     * dropped — text only, `audioUrl` null and no `turn_audio`, because
     * replaying the clip into a learner who has already heard it reads as a
     * stutter. The final tutor entry carries the re-sent turn's real seq so
     * the caption and the log never print the same line twice.
     */
    const snapshot = live.orchestrator.resumeSnapshot;
    const lastSeq = snapshot.lastTurn?.seq ?? 0;
    let tutorLinesLeft = snapshot.turns.filter((t) => t.speaker === 'tutor').length;
    send(socket, {
      type: 'history',
      turns: snapshot.turns.map((t) => {
        if (t.speaker !== 'tutor') return { ...t, seq: -1 };
        tutorLinesLeft -= 1;
        return { ...t, seq: tutorLinesLeft === 0 ? lastSeq : 0 };
      }),
    });
    if (snapshot.lastTurn) {
      send(socket, {
        type: 'turn',
        seq: snapshot.lastTurn.seq,
        say: snapshot.lastTurn.turn.say,
        emotion: snapshot.lastTurn.turn.emotion,
        action: snapshot.lastTurn.turn.action,
        audioUrl: null,
        next: snapshot.lastTurn.turn.next === 'close' ? 'ask' : snapshot.lastTurn.turn.next,
      });
    }
    const budget = live.orchestrator.budgetAt(Date.now());
    send(socket, {
      type: 'state',
      budget: budget.state,
      remainingMs: budget.remainingMs,
      turnCount: live.orchestrator.turnCount,
    });
    return;
  }

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

  // A ping proves the tab is open; every other frame proves a person is in it.
  if (message.data.type !== 'ping') live.lastActivityAtMs = Date.now();

  switch (message.data.type) {
    case 'ping': {
      // The real budget, not a placeholder: this is the keepalive's second
      // job, keeping the on-screen "minutes left" honest between turns.
      const budget = live.orchestrator.budgetAt(Date.now());
      send(live.socket, {
        type: 'state',
        budget: budget.state,
        remainingMs: budget.remainingMs,
        turnCount: live.orchestrator.turnCount,
      });
      return;
    }

    case 'interrupt':
      // Free and idempotent: outside an in-flight production there is nothing
      // to cancel and nothing to answer. The client already went quiet locally.
      if (live.inFlight) live.abort?.abort();
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
      /*
       * THE GRADE MUST NAME AN ACTIVITY THIS SESSION SERVED. The id used to be
       * validated for shape and then dropped, so any well-formed uuid bought a
       * model turn and a glowing reaction to an activity that never existed.
       * XP was never at stake (Core grades server-side on its own surface) —
       * what was at stake is the tutor's picture of the learner, and the plan
       * that now moves on it. Checked BEFORE the claim: a refusal this cheap
       * should not spend the turn slot.
       */
      if (!live.orchestrator.wasServed(message.data.segmentId)) {
        send(live.socket, {
          type: 'error',
          code: 'UNKNOWN_SEGMENT',
          message: 'That activity is not part of this session.',
        });
        return;
      }
      /*
       * THE SIGNED ECHO (v3). Core's grade response hands the client a signed
       * receipt; only a VALID one whose segmentId matches may feed the
       * strategy controller — the bare score still only colors the reaction,
       * exactly as in v2. An invalid echo is logged and ignored rather than
       * refused: the reaction turn is harmless, the steering is what the
       * signature protects.
       */
      let pedagogy: { misconceptionCode: string | null; attemptNumber?: number } | null = null;
      if (message.data.echo) {
        const verdict = verifyGradeEcho(message.data.echo);
        if (verdict.ok && verdict.payload.segmentId === message.data.segmentId) {
          pedagogy = {
            misconceptionCode: verdict.payload.misconceptionCode,
            attemptNumber: message.data.attemptNumber ?? 1,
          };
        } else {
          console.warn(
            `[oracle] discarded grade echo (${verdict.ok ? 'segment mismatch' : verdict.reason}) for session ${live.session.sessionId}`,
          );
        }
      }
      const claim = claimTurn(live, Date.now());
      if (claim !== 'ok') return refuseTurn(live, claim);
      live.abort = new AbortController();
      send(live.socket, { type: 'thinking' });
      try {
        await deliver(
          live,
          await live.orchestrator.handleSegmentResult(
            message.data.segmentId,
            message.data.score,
            message.data.correct,
            Date.now(),
            live.abort.signal,
            pedagogy,
          ),
        );
      } finally {
        live.abort = null;
        releaseTurn(live);
      }
      return;
    }

    case 'learner_text':
    case 'learner_edit': {
      const claim = claimTurn(live, Date.now());
      if (claim !== 'ok') return refuseTurn(live, claim);
      live.abort = new AbortController();
      send(live.socket, { type: 'thinking' });
      try {
        await handleLearnerTurn(live, message.data.text, live.abort.signal, {
          edit: message.data.type === 'learner_edit',
        });
      } finally {
        live.abort = null;
        releaseTurn(live);
      }
      return;
    }

    case 'learner_audio':
      await handleAudioClip(live, decodeChunk(message.data.audio), message.data.mimeType);
      return;

    /*
     * THE STREAMED CLIP. Chunks arrive while the learner is still holding the
     * button — no turn is claimed and nothing is billed until the commit, so
     * the assembly is bounded memory (the same ceiling as the whole-clip
     * frame) and nothing else. A new `begin` resets whatever was abandoned: a
     * mis-tap simply never commits, and the next hold starts clean.
     */
    case 'learner_audio_begin':
      if (!live.microphone) {
        send(live.socket, {
          type: 'error',
          code: 'CONSENT_REQUIRED',
          message: 'The microphone is not enabled for this session.',
        });
        return;
      }
      live.assembly = { mimeType: message.data.mimeType, parts: [], bytes: 0, chars: 0 };
      return;

    case 'learner_audio_chunk': {
      const assembly = live.assembly;
      if (!assembly) {
        send(live.socket, {
          type: 'error',
          code: 'VALIDATION_ERROR',
          message: 'No audio upload in progress.',
        });
        return;
      }
      if (assembly.chars + message.data.audio.length > MAX_AUDIO_B64_CHARS) {
        // The same refusal the single frame gets, at the same total. The
        // assembly is dropped whole: a clip we cannot accept in full is not
        // worth transcribing in part.
        live.assembly = null;
        send(live.socket, { type: 'error', code: 'AUDIO_TOO_LONG', message: 'That was too long.' });
        return;
      }
      /*
       * DECODE HERE, NOT AT COMMIT. Each frame carries its OWN complete base64
       * document, padding included, so joining the strings puts `=` in the
       * middle and every decoder stops there.
       */
      const bytes = decodeChunk(message.data.audio);
      assembly.parts.push(bytes);
      assembly.bytes += bytes.byteLength;
      assembly.chars += message.data.audio.length;
      return;
    }

    case 'learner_audio_commit': {
      const assembly = live.assembly;
      live.assembly = null;
      if (!assembly || assembly.parts.length === 0) {
        send(live.socket, {
          type: 'error',
          code: 'VALIDATION_ERROR',
          message: 'No audio upload in progress.',
        });
        return;
      }
      /*
        * THE DEFECT THIS REPLACES — why the Tutor heard "Ah." when a learner
        * asked "¿Qué es el interés compuesto?".
        *
        * This was `assembly.parts.join('')`: the parts are separately base64
        * encoded frames, and concatenating base64 STRINGS is not the same
        * operation as base64-encoding concatenated BYTES. Any chunk whose byte
        * length is not a multiple of three ends in `=` padding, so joining puts
        * padding in the middle of the document and every decoder stops there.
        * Measured: two four-byte chunks joined this way decode to four bytes,
        * not eight.
        *
        * MediaRecorder's first chunk is the container header plus a fraction of
        * a second of audio, so what actually reached the transcriber was the
        * first syllable of the sentence — for every microphone turn, on every
        * browser, since streaming was introduced. Concatenating the decoded
        * buffers is the whole fix.
        */
      await handleAudioClip(live, assembleClip(assembly.parts), assembly.mimeType);
      return;
    }
  }
}

/**
 * One recorded clip, however it arrived — a single frame or a committed
 * stream. Claimed BEFORE `transcribe`, which is the whole point: transcription
 * is a billed third-party call carrying up to ~1.1 MB of audio, and it used to
 * run before any gate, so a burst of frames bought a burst of transcriptions
 * and discarded all but one.
 */
async function handleAudioClip(live: Live, audio: Buffer, mimeType: string): Promise<void> {
  if (!live.microphone) {
    send(live.socket, {
      type: 'error',
      code: 'CONSENT_REQUIRED',
      message: 'The microphone is not enabled for this session.',
    });
    return;
  }
  const claim = claimTurn(live, Date.now());
  if (claim !== 'ok') return refuseTurn(live, claim);
  live.abort = new AbortController();
  // Sent before transcription, deliberately: the wait the learner feels
  // starts the moment they release the button, not when STT returns.
  send(live.socket, { type: 'thinking' });
  try {
    const text = await transcribe(audio, mimeType, live.session);
    if (text === null || text.trim() === '') {
      send(live.socket, { type: 'error', code: 'STT_FAILED', message: 'I did not catch that.' });
      return;
    }
    // Echoed back so the learner can see what we heard. A misheard turn that
    // the learner cannot see is a tutor answering a question nobody asked.
    send(live.socket, { type: 'transcript', text });
    await handleLearnerTurn(live, text, live.abort.signal, { viaMicrophone: true });
  } finally {
    live.abort = null;
    releaseTurn(live);
  }
}

async function handleLearnerTurn(
  live: Live,
  text: string,
  signal?: AbortSignal,
  opts: { viaMicrophone?: boolean; edit?: boolean } = {},
): Promise<void> {
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
      if (opts.viaMicrophone) {
        /*
         * The words in flight came THROUGH the microphone a guardian just
         * closed, so they are not produced against — the moment the revocation
         * is observed is the moment that channel's content stops reaching a
         * model. The utterance still enters the transcript (a guardian must be
         * able to read what was said), and the tutor answers with the scripted
         * line written for exactly this — which existed, was counted in the
         * 144, and was never actually said until now.
         */
        void persistTurn({
          sessionId: live.session.sessionId,
          seq: nextTranscriptSeq(live),
          speaker: 'learner',
          text,
          source: 'stt',
        }).then((recorded) => notePersist(live, recorded));
        await deliver(live, await live.orchestrator.consentRevoked(Date.now()));
        return;
      }
    }
  }

  // The learner's own turn goes into the transcript before the tutor answers,
  // so a guardian reading it later sees the exchange in the order it happened
  // even if the tutor's reply never arrives.
  void persistTurn({
    sessionId: live.session.sessionId,
    seq: nextTranscriptSeq(live),
    speaker: 'learner',
    text,
    // 'stt' is the wire's only learner-source value today, typed or spoken —
    // widening that vocabulary is a Core schema change, not a caller choice.
    source: 'stt',
  }).then((recorded) => notePersist(live, recorded));

  /*
   * v3 VOICE-CHECK: when an activity with a single numeric answer is open and
   * the learner's short utterance plausibly carries a number, Core verifies it
   * DETERMINISTICALLY against the stored key before any model call. A
   * recognized answer produces a verdict-driven reaction turn; anything else —
   * unparseable, uncheckable, or the call failing — falls through to the
   * ordinary conversation path, because unparseable is never wrong (§1.14).
   * Edits are excluded: a rephrasing is conversation by definition.
   */
  const checkable = live.orchestrator.checkableSegmentId;
  if (!opts.edit && checkable !== null && text.length <= 120) {
    const result = await voiceCheck({
      sessionId: live.session.sessionId,
      segmentId: checkable,
      utterance: text,
      strategy: live.orchestrator.activeStrategy,
    });
    if (result?.recognized === true && typeof result.correct === 'boolean') {
      await deliver(
        live,
        await live.orchestrator.handleVoiceCheckResult(
          checkable,
          { correct: result.correct, misconceptionCode: result.misconceptionCode ?? null },
          text,
          Date.now(),
          signal,
        ),
      );
      return;
    }
  }

  // `Date.now()` here rather than the caller's stamp: for an audio turn the
  // claim happened before a transcription that may have taken a second, and
  // the budget should be measured against when the tutor actually answers.
  await deliver(
    live,
    opts.edit
      ? await live.orchestrator.handleLearnerEdit(text, Date.now(), signal)
      : await live.orchestrator.handleLearnerText(text, Date.now(), signal),
  );
}

async function deliver(live: Live, outcome: TurnOutcome | null): Promise<void> {
  if (outcome === null) {
    // An interrupted production. Nothing to say — but the client's thinking
    // state must end on a server frame, not on a guess, so the budget frame
    // still goes out.
    const budget = live.orchestrator.budgetAt(Date.now());
    send(live.socket, {
      type: 'state',
      budget: budget.state,
      remainingMs: budget.remainingMs,
      turnCount: live.orchestrator.turnCount,
    });
    return;
  }

  const { emission, safety, budget, closeReason } = outcome;

  /*
   * SPLIT DELIVERY (/ORACLE.md §6 intact): the text of an already-moderated
   * turn ships NOW; the voice follows in `turn_audio` when synthesis and
   * storage settle. The learner reads the caption while the clip is still
   * being made, which removes the entire synthesis-and-store leg from the
   * silence after they speak.
   */
  const idleNudgeMs = live.orchestrator.idleNudgeMs;
  const listenSilenceMs = live.orchestrator.listenSilenceMs;
  send(live.socket, {
    type: 'turn',
    seq: emission.seq,
    say: emission.turn.say,
    emotion: emission.turn.emotion,
    action: emission.turn.action,
    audioUrl: null,
    next: emission.turn.next,
    // v3 turn policy: per-strategy thinking time. Absent while dormant.
    ...(idleNudgeMs !== null && listenSilenceMs !== null
      ? { policy: { idleNudgeMs, listenSilenceMs } }
      : {}),
    // v3: tray demonstration steps, already schema-validated with the turn.
    ...(emission.turn.demonstrate ? { demonstrate: emission.turn.demonstrate } : {}),
  });

  /*
   * The row number is claimed HERE, not inside the callback below. The write
   * itself still waits for synthesis so it can record where the audio lives,
   * but numbering it there would order the transcript by whichever clip
   * finished first — putting the learner's next line ahead of the tutor reply
   * it was answering, in the record a guardian reads.
   */
  const tutorRowSeq = nextTranscriptSeq(live);

  void emission.audio.then((audioUrl) => {
    send(live.socket, { type: 'turn_audio', seq: emission.seq, audioUrl });
    // The transcript row waits for the clip so it records where the audio
    // actually lives; the write was always fire-and-forget. `seq` here is the
    // TRANSCRIPT's row number, never the model-turn seq on the wire above —
    // conflating the two is what silently deleted every learner line.
    void persistTurn({
      sessionId: live.session.sessionId,
      seq: tutorRowSeq,
      speaker: 'tutor',
      text: emission.turn.say,
      emotion: emission.turn.emotion,
      action: emission.turn.action,
      audioPath: audioUrl,
      source: emission.source,
      moderation: emission.moderation,
    }).then((recorded) => notePersist(live, recorded));
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

  if (closeReason) {
    // A closing turn waits for its own voice: `finish` closes the socket, and
    // a goodbye whose audio frame arrives after the close is a silent goodbye.
    // This is the ONE turn that still pays the synthesis wait, and it is the
    // turn where nobody is waiting to speak next.
    await emission.audio;
    await finish(live, closeReason === 'turn_cap' ? 'hard_budget' : closeReason);
  }
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
  /*
   * v3 OVERRIDES: the model DESCRIBES the activity it wants; the controller
   * DECIDES the pedagogy around it. When the brain is active, the difficulty
   * band comes from the controller (never rising after a failure — the model
   * cannot undo that guardrail by asking), the served content pool prefers
   * the active KC's mapped skill key, and the KC id + strategy ride along so
   * Core stamps provenance and the grade joins back to the right posterior.
   */
  const kcId = live.orchestrator.activeKcId;
  const strategy = live.orchestrator.activeStrategy;
  const difficulty = live.orchestrator.activeDifficulty ?? requestInput.difficulty;
  const skillKey = live.orchestrator.activeSkillKey ?? requestInput.skillKey;

  let served = await requestSegment({
    sessionId: live.session.sessionId,
    ...requestInput,
    skillKey,
    difficulty,
    ...(kcId ? { kcId } : {}),
    ...(strategy ? { strategy } : {}),
  });

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
          ...(kcId ? { kcId } : {}),
          ...(strategy ? { strategy } : {}),
        })
      : null;
  }

  if (served === null || 'needsGeneration' in served) {
    // Emit nothing rather than something generic (/ORACLE.md §7.3). The tutor
    // stays in conversation; the panel simply does not fill.
    /*
     * The frame still goes out so the client can clear its "preparing
     * something" placeholder — but it is no longer the whole answer. The tutor
     * teaches the idea by hand instead of leaving a promise dangling, which is
     * what a tutor without a worksheet actually does.
     */
    send(live.socket, {
      type: 'error',
      code: 'NO_SEGMENT',
      message: 'No activity was available for that just now.',
    });
    await deliver(live, await live.orchestrator.handleSegmentUnavailable(Date.now(), live.abort?.signal));
    return;
  }

  live.orchestrator.noteSegmentServed(
    served.segmentId,
    skillKey,
    typeof served.segment.type === 'string' ? served.segment.type : undefined,
    // The authored prompt already on the learner's screen, so the tutor stops
    // narrating an activity it has never read. Our own catalog text — nothing
    // the learner typed or scored travels with it.
    typeof served.segment.prompt_md === 'string' ? served.segment.prompt_md : undefined,
  );
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
      `speech paid=${speech.paid} free=${speech.free} discarded=${speech.discarded}`,
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
  audio: Buffer,
  mimeType: string,
  session: SessionContext,
): Promise<string | null> {
  const provider = getVoiceProvider();
  if (!provider.available) return null;
  try {
    const result = await provider.transcribe({
      audio,
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
  // Parked sessions have no socket to close, but they DO have a close to
  // record — a shutdown must not orphan them into sessions that never ended.
  finalizeAllParked();
  wss.close();
}
