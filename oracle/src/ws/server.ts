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
import { runPostSessionReview } from '../session/review.js';
import { getVoiceProvider } from '../voice/index.js';
import { newSpeechScope, speakLine, type SpeechScope } from '../voice/speech.js';
import { generateSegment } from '../content/generate.js';
import { moderationReadiness } from '../safety/moderation.js';
import { TutorOrchestrator, type TurnOutcome } from '../tutor/orchestrator.js';
import {
  CLOSE_CODES,
  ClientMessageSchema,
  MAX_AUDIO_B64_CHARS,
  type ServerMessage,
  type WireWhiteboard,
} from './protocol.js';
import { computeWhiteboardValues } from '../tutor/whiteboard.js';
import { sanitizePreferredTypes } from '../tutor/turnSchema.js';
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
   * An `end_session` arrived while another turn held the floor (`claimTurn`
   * returned `'busy'`) and was DEFERRED rather than refused — see the
   * `end_session` case and `releaseTurn`'s own comment.
   *
   * Found by adversarial review, round 90 (2026-08-31, MEDIUM): before this
   * flag existed, a busy `end_session` was refused outright — the ordinary
   * outcome of a learner pressing "Start over"/"Finish" on the frontend's
   * OWN `awaitingReply` window, which exists on every single turn — and
   * `farewell()`/`finish()` were never called at all. The client tears its
   * own socket down unconditionally, without waiting to find out whether
   * the request worked (`TutorExperience.tsx`'s `onRestart`/`onExit`), so
   * the socket's `close` handler saw `live.closing` still false and parked
   * the session exactly as it would an honest dropped connection — a
   * deliberate ending recorded as `learner_left` after the resume grace
   * window, with no farewell ever delivered, contradicting /ORACLE.md
   * §9.5's "not a timeout that kills a socket" outright.
   */
  endSessionRequested: boolean;
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
   * Consecutive safety-flag writes Core did not confirm — deliberately its
   * OWN counter, not shared with `persistFailures`. Found while proving the
   * round-29 (2026-08-30, CRITICAL) fix live: a personal_data-blocked turn
   * ALSO writes the learner's raw text via the ordinary `persistTurn` call
   * just above it, which succeeds against a healthy Core even when the flag
   * write is the one failing — so a SHARED counter gets reset back to zero
   * by that success every single turn and can never reach the limit,
   * regardless of how many consecutive flag writes fail. A dedicated
   * counter is the only way "the flag endpoint specifically is
   * systematically failing" is ever actually detectable.
   */
  flagPersistFailures: number;
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
  /**
   * The most recent `segment` frame actually sent, or `null` once it has been
   * answered (graded, or resolved by voice-check) — a redraw target for
   * resume, NOT a live "what's currently open" flag (that is
   * `orchestrator.checkableSegmentId`/`servedSegmentSkills`).
   *
   * Found missing by an adversarial review, 2026-08-30 (HIGH): resume redrew
   * the conversation's TEXT but never re-sent the segment frame, so an
   * ordinary reconnect (a sleeping phone, a wifi drop — exactly what park
   * exists to survive) while an activity was on screen left the learner
   * staring at a tutor line that referenced an exercise with nothing to
   * answer, no XP reachable, no way to recover except leaving and starting a
   * new topic.
   */
  lastSegmentFrame: Extract<ServerMessage, { type: 'segment' }> | null;
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
 * HOW MANY TIMES ONE LEARNER UTTERANCE MAY RE-ENTER THE CONTENT LADDER AFTER
 * IT HAS ALREADY COME BACK EMPTY.
 *
 * `deliver()` and `serveSegment()` are mutually recursive by design: a turn
 * that asks for an activity is served by `serveSegment`, and when the ladder
 * has nothing, `handleSegmentUnavailable()` produces a recovery turn that is
 * delivered through the SAME `deliver()` — which can itself carry a
 * `segmentRequest`. The recovery instruction asks the model not to, and until
 * this constant existed that instruction was the ONLY thing standing between a
 * content gap and an unbounded loop.
 *
 * Found by adversarial review, round 76 (2026-08-30, HIGH), and reproduced
 * rather than reasoned about: a SINGLE `learner_text` frame produced twenty
 * `turn` + `NO_SEGMENT` pairs, each pair a real model completion, a real judge
 * completion and a real Core round trip, plus paid author calls whenever the
 * ladder answered `needsGeneration`. That is the §1.0 "money leaves DIRECTLY"
 * shape exactly — an uncached retry loop that multiplies real spend per
 * learner utterance — and a real child would meanwhile have watched a long,
 * confusing burst of tutor turns scroll past.
 *
 * WHAT STOPPED IT AT TWENTY WAS NOT A GUARD, and the correction matters more
 * than the number. Round 74 filed this defect as "bounded only by the session
 * turn cap"; measured, it was not — `SESSION_MAX_TURNS` is 120, the run ended
 * at turn 22 with the budget still `running` and no close frame. It stopped
 * because `TURN_HISTORY_WINDOW` is also 20, so the learner's own line
 * eventually scrolled out of the context and the harness's model stopped
 * asking. Nothing in the product ended it. A real model wanting an activity
 * because of the CONVERSATION rather than one phrase in it had the whole turn
 * cap to spend.
 *
 * ONE retry, and the reason is arithmetic rather than taste. When the
 * pedagogical brain is awake, `serveSegment` overrides both the skill key and
 * the difficulty with the controller's own (`activeSkillKey`,
 * `activeDifficulty`), so a second request built from the same conversational
 * state is very often the IDENTICAL request the ladder just refused — paying
 * twice for a guaranteed answer. The one retry that IS kept covers the case
 * where the recovery turn moves the conversation somewhere the ladder can
 * reach. Past that the tutor keeps its recovery turn — a real, honest turn
 * that teaches the idea by hand — and simply stops asking, which is the same
 * "emit nothing rather than something generic" posture /ORACLE.md §7.3 already
 * takes for an exhausted ladder.
 *
 * This bounds REPEATED FAILURES within one utterance and nothing else. The
 * ladder's own internal rungs (nearest-band search, the prerequisite walk, the
 * frontier fallback — round 59) all live inside a SINGLE `requestSegment` call
 * and are untouched by this: a segment that is found, however many rungs down,
 * costs one attempt and serves normally.
 */
const MAX_SEGMENT_RETRIES = 1;
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
  /** Carried across the park so a resume can redraw the open activity, if any. */
  lastSegmentFrame: Extract<ServerMessage, { type: 'segment' }> | null;
}

const parkedSessions = new Map<string, ParkedSession>();

/*
 * Every socket that is GENUINELY connected right now, keyed by session id —
 * distinct from `parkedSessions`, which holds a session whose socket already
 * closed. Found missing by an adversarial review, 2026-08-29 (HIGH): with no
 * registry of live sockets, `POST /sessions/:id/resume` (backend) will mint a
 * fresh token for any session the caller owns with `ended_at IS NULL`, with
 * no way to know a socket for it is already open. A second socket opened
 * with that token found nothing in `parkedSessions` (the first one never
 * closed) and `handleConnection` happily spun up a SECOND, independent
 * `TutorOrchestrator` for the same session — its own budget clock, its own
 * turn cap, running in parallel. Each extra socket bought another full
 * session's worth of paid model/judge/TTS calls, defeated the daily-session
 * cap (`MAX_SESSIONS_PER_DAY`, the product's own anti-addiction control), and
 * corrupted the record two ways at once: `closeTutorSession` guards on
 * `ended_at IS NULL` (first close wins), so every orchestrator but the first
 * to close had its real, billed usage vanish from Core's cost ledger; and
 * both sockets' `transcriptSeq` restarted at 0, so their rows collided in
 * `tutor_turns` and the `ignore-duplicates` constraint silently dropped one
 * side — the "guardian can't read what their child said" failure this file
 * already fixed once, reopened by a different door.
 */
const liveSessions = new Map<string, Live>();

function parkSession(sessionId: string, live: Live): void {
  // A stale park for the same session (two sockets raced) is finalized first —
  // two parked orchestrators for one session would both write a close later.
  finalizeParked(sessionId);
  const entry: ParkedSession = {
    orchestrator: live.orchestrator,
    speech: live.speech,
    lastTurnAtMs: live.lastTurnAtMs,
    transcriptSeq: live.transcriptSeq,
    lastSegmentFrame: live.lastSegmentFrame,
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
    // The transcript's own row count, not the model-turn count — see
    // `CloseSessionInput.turnCount`'s comment.
    turnCount: entry.transcriptSeq,
    segmentCount: entry.orchestrator.servedSegments,
    costUsd: entry.orchestrator.totalCostUsd,
  });

  /*
   * V4's slow chamber, for the session that ended THIS way too.
   *
   * Found by adversarial review, 2026-08-30 (MEDIUM): this path — a sleeping
   * phone, a proxy timeout, a stairwell, exactly what parking exists to
   * survive — closed the session directly and never called
   * `runPostSessionReview`, unlike `finish()`'s graceful close. A session
   * with a real conversation in it, ended only by a dropped connection,
   * silently taught the memory system nothing: no error, no log line,
   * indistinguishable from a session with nothing worth writing. Fired the
   * same fire-and-forget way `finish()` fires it.
   */
  void runPostSessionReview({
    session: entry.orchestrator.sessionContext,
    history: entry.orchestrator.resumeSnapshot.turns,
  }).catch((error) =>
    console.warn('[oracle] post-session review crashed:', error instanceof Error ? error.message : error),
  );
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
  /*
   * A LEARNER WHO ASKED TO LEAVE WHILE SOMEONE ELSE'S TURN HELD THE FLOOR IS
   * NOT MADE TO ASK AGAIN (round 90, 2026-08-31, MEDIUM — see
   * `Live.endSessionRequested`'s own comment for the failure this closes).
   *
   * This is the ONE place every turn's `finally` already funnels through
   * (`claimTurn`'s own comment says so), which is what makes it the right
   * place to notice the floor just freed and a farewell is waiting for it —
   * the alternative would be teaching every future `finally` block to check
   * this flag itself, which is exactly how the analogous gap in `claimTurn`
   * happened in the first place.
   *
   * Fired rather than awaited: this function runs inside a `finally` and
   * must stay synchronous. `attemptEndSession` claims and releases its own
   * slot, and does so SYNCHRONOUSLY up to its first `await` — nothing else
   * can run between `live.inFlight = false` above and its own `claimTurn`
   * call below, so it always wins the floor it was just handed.
   */
  if (live.endSessionRequested && !live.closing) {
    live.endSessionRequested = false;
    void attemptEndSession(live);
  }
}

/** Refuses a claim out loud. Both refusals read as one moment, deliberately. */
function refuseTurn(live: Live, why: 'busy' | 'too-soon'): void {
  send(live.socket, {
    type: 'error',
    code: 'RATE_LIMITED',
    message: why === 'busy' ? 'One at a time.' : 'One moment.',
  });
}

/**
 * Exported only so a test can call it directly against a socket it has
 * already closed — the case this guard exists for.
 *
 * A dropped send here used to be silent: no log, no error, nothing. Found by
 * adversarial review, round 81 (2026-08-31, MEDIUM), chasing a live,
 * intermittently-reproducing symptom (a turn written to Postgres within
 * seconds of a session starting, never reaching the screen, with a live
 * connection count that never dropped) — never conclusively pinned on this
 * function, but the silence itself was a real, independent gap: §1.0 ("make
 * failure LOUD and distinguishable from emptiness") does not carve out an
 * exception for a socket that closed a moment before its last message tried
 * to leave. Every one of this file's other failure paths already logs;
 * this was the one that didn't.
 */
export function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
    return;
  }
  console.warn(
    `[oracle] dropped a "${message.type}" message — socket was not open (readyState=${socket.readyState})`,
  );
}

/**
 * The farewell turn plus the graceful close — the whole body of ending a
 * session, factored out so it can run from two places: the `end_session`
 * case when the floor is free on arrival, and `releaseTurn` when a deferred
 * request (`Live.endSessionRequested`) finds the floor free after the fact.
 *
 * Claims its own slot with `enforceFloor=false`, exactly as the ORIGINAL
 * `end_session` handling always did — leaving is never gated on the 700 ms
 * floor, only on the single-turn slot every production shares.
 */
async function attemptEndSession(live: Live): Promise<void> {
  const claim = claimTurn(live, Date.now(), false);
  if (claim !== 'ok') {
    /*
     * Something else claimed the floor in the gap between `endSessionRequested`
     * being read and this call running — a fresh learner frame that arrived
     * on the same tick, most likely. Re-arm rather than dropping the
     * learner's request a second time; the NEXT `releaseTurn` retries it.
     */
    live.endSessionRequested = true;
    return;
  }
  try {
    await deliver(live, await live.orchestrator.farewell(Date.now(), 'soft'));
    await finish(live, 'completed');
  } finally {
    releaseTurn(live);
  }
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

/**
 * `notePersist`'s sibling for safety-flag writes specifically — a SEPARATE
 * counter, not a shared one. Found by adversarial review, round 29
 * (2026-08-30, CRITICAL): a blocked turn (e.g. `personal_data`) ALSO writes
 * the learner's raw text via the ordinary `persistTurn` above it, which
 * succeeds against a healthy Core even when the flag write is the one
 * failing — so routing both through `notePersist`'s single counter let the
 * transcript write's success reset it to zero every turn, and it could
 * never reach `PERSIST_FAILURE_LIMIT` no matter how many consecutive flag
 * writes failed. Migration 0054's episodic recall exclusion is a `NOT
 * EXISTS` against the flag table it writes to; a systematically-unconfirmed
 * flag write means a turn the classifier correctly blocked (a child's own
 * address, phone, email) sits in the transcript with nothing marking it,
 * ready to resurface verbatim to the model on a later "¿te acuerdas...?"
 * recall. This counter is the only thing that can actually detect that.
 */
function noteFlagPersist(live: Live, recorded: boolean): void {
  if (recorded) {
    live.flagPersistFailures = 0;
    return;
  }
  live.flagPersistFailures += 1;
  if (live.flagPersistFailures >= PERSIST_FAILURE_LIMIT && !live.closing) {
    console.error(
      `[oracle] ${live.flagPersistFailures} consecutive safety-flag writes unconfirmed — closing the session`,
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

  /*
   * SEVENTH GATE: the session must not already have a live socket. A genuine
   * resume only ever reaches this point after the ORIGINAL socket's `close`
   * handler has already removed it from `liveSessions` (and parked the
   * orchestrator, below) — so a session that is still here is not a dropped
   * connection being reclaimed, it is a second socket racing the first one.
   */
  if (liveSessions.has(session.sessionId)) {
    socket.close(CLOSE_CODES.ALREADY_CONNECTED, 'this session already has an active connection');
    return;
  }

  // A parked orchestrator for this session means this socket is a RESUME:
  // same history, same budget clock, same paid-speech memo. Every gate above
  // already re-ran against a fresh token and a fresh Core context.
  const resumed = takeParked(session.sessionId);
  /*
   * THE ONE FIELD THE RE-ATTACHED ORCHESTRATOR RE-READS from this connection's
   * own fresh context.
   *
   * Found by adversarial review as round 56's deferred MEDIUM, closed as round
   * 77 (2026-08-30): the orchestrator's `session` is set once at construction
   * and never reassigned, so a resumed instance kept enforcing whatever
   * `isMinor` the FIRST connection fetched — for the whole grace window, and
   * indefinitely across repeated parks and resumes, since nothing ever
   * re-fetched it. Every gate AROUND it on this same reconnect already uses
   * the fresh value: `moderationReadiness(session.isMinor)` a few lines above,
   * the `microphone` computation below it, and `refreshMicConsent`'s live
   * per-turn call. `isMinor` is the sole input to `requireModelPass` — whether
   * a turn no judge could clear is refused or delivered — so this one being
   * stale is a safety gate reading last connection's answer.
   *
   * Only `isMinor`. Every other field on `SessionContext` was audited the same
   * day and is correctly pinned to the original connection (an in-flight
   * `courseContext` lesson plan, the `tier` the vocabulary gate judges against,
   * the FSM's deliberate decision-clock snapshots) or checked freshly
   * elsewhere. `refreshIsMinor` takes a boolean rather than a context so this
   * cannot drift into refreshing them too.
   */
  if (resumed) resumed.orchestrator.refreshIsMinor(session.isMinor);
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
    endSessionRequested: false,
    persistFailures: 0,
    flagPersistFailures: 0,
    transcriptSeq: resumed?.transcriptSeq ?? 0,
    lastSegmentFrame: resumed?.lastSegmentFrame ?? null,
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

  liveSessions.set(session.sessionId, live);

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
    liveSessions.delete(session.sessionId);
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
      /*
       * The whiteboard, redrawn the SAME way `deliver()` sends it the first
       * time — recomputed from the model's own `start`/`steps`, never
       * trusted from wherever it was last computed. Found missing entirely
       * by an adversarial review, 2026-08-30 (HIGH): this frame used to omit
       * `whiteboard` outright, so an ordinary reconnect while a growth story
       * was on screen left the learner staring at narration for a board that
       * had simply vanished.
       */
      const board = snapshot.lastTurn.turn.whiteboard;
      const boardValues = board ? computeWhiteboardValues(board) : null;
      send(socket, {
        type: 'turn',
        seq: snapshot.lastTurn.seq,
        say: snapshot.lastTurn.turn.say,
        emotion: snapshot.lastTurn.turn.emotion,
        action: snapshot.lastTurn.turn.action,
        audioUrl: null,
        // No `turn_audio` follows a resume redraw (see the comment above) —
        // the client must not wait for one, or hold hands-free listening
        // closed forever.
        audioPending: false,
        next: snapshot.lastTurn.turn.next === 'close' ? 'ask' : snapshot.lastTurn.turn.next,
        ...(boardValues !== null && board ? { whiteboard: { ...board, values: boardValues } } : {}),
      });
    }
    /*
     * The open activity, redrawn verbatim — same reason as the whiteboard
     * above. Re-running `serveSegment()` here would serve a DIFFERENT
     * exercise, not restore the one the learner was looking at, so the exact
     * last-sent frame is cached (`Live.lastSegmentFrame`) and resent as-is
     * rather than regenerated.
     */
    if (live.lastSegmentFrame) send(socket, live.lastSegmentFrame);
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

    case 'end_session':
      /*
       * `attemptEndSession` claims with `enforceFloor=false` — nobody is
       * made to wait to leave — but still respects the single-turn slot.
       * Busy is the ORDINARY case, not an edge one: it is exactly what a
       * learner pressing "Start over"/"Finish" finds on every single turn,
       * during the `awaitingReply` window while the tutor is still
       * producing its reply. `refuseTurn` used to be called here on
       * anything but `'ok'`, which dropped the request outright —
       * `farewell()`/`finish()` were simply never reached — while the
       * client tears its own socket down regardless, without waiting to
       * find out (`TutorExperience.tsx`'s `onRestart`/`onExit`). Found by
       * adversarial review, round 90 (2026-08-31, MEDIUM): the session's
       * own `close` handler then saw `live.closing` still false and parked
       * it exactly as an honest dropped connection, so a DELIBERATE ending
       * recorded as `learner_left` after the resume grace window, with no
       * farewell ever delivered — contradicting /ORACLE.md §9.5's "not a
       * timeout that kills a socket" outright. `attemptEndSession` re-arms
       * `Live.endSessionRequested` on anything but `'ok'` instead of
       * refusing, and `releaseTurn` — the one place every turn's `finally`
       * already funnels through — retries it the instant the busy turn
       * frees the floor.
       */
      await attemptEndSession(live);
      return;

    case 'adaptation_response':
      // Local state only — no upstream call, so no slot to claim.
      //
      // Found by adversarial review, round 67 (2026-08-30, MEDIUM): a decline
      // used to be dropped entirely here — "local state only" meant no state
      // at all — so the tutor re-offered the identical adaptation on the very
      // next failure of the same skill. `declineAdaptation` now records it on
      // the plan (see `LessonPlan.declinedAdaptations`), the same way
      // `applyAdaptation` already records an acceptance.
      if (message.data.accepted) live.orchestrator.applyAdaptation(message.data.adaptation);
      else live.orchestrator.declineAdaptation(message.data.adaptation);
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
      // Answered — no longer a redraw target for a future resume.
      live.lastSegmentFrame = null;
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
/**
 * Whether THIS turn is due a fresh, live consent check, per the cadence
 * `/ORACLE.md` §4.3 sets — for a minor with the mic on, that cadence is
 * "every turn" (`CONSENT_RECHECK_MINOR_MIC_TURNS = 1`).
 */
function dueForMicConsentRecheck(live: Live): boolean {
  const recheckEvery =
    live.microphone && live.session.isMinor
      ? CONSENT_RECHECK_MINOR_MIC_TURNS
      : CONSENT_RECHECK_EVERY_TURNS;
  return (
    live.microphone &&
    live.session.isMinor &&
    live.orchestrator.turnCount > 0 &&
    live.orchestrator.turnCount % recheckEvery === 0
  );
}

/**
 * Performs the fresh check when one is due, mutating `live.microphone` and
 * sending `CONSENT_REVOKED` on a revocation. Returns whether the mic is
 * (still) usable for THIS turn.
 *
 * MUST run before the CURRENT turn's audio reaches the third-party STT
 * provider, not only before the NEXT turn's — found by adversarial review,
 * 2026-08-30 (HIGH). This check used to live only inside
 * `handleLearnerTurn`, which for a microphone turn only ever runs AFTER
 * `transcribe()` has already shipped the audio to the provider: no recheck
 * cadence, however tight, can retroactively un-send audio that already
 * left. `handleAudioClip` now calls this itself, before `transcribe()`, so
 * a revocation observed on THIS turn refuses the STT call rather than only
 * closing the mic for the next one.
 */
async function refreshMicConsent(live: Live): Promise<boolean> {
  if (!dueForMicConsentRecheck(live)) return live.microphone;
  /*
   * `!== true`, NOT `=== false` — see the identical reasoning where this
   * check used to live, a few lines below in `handleLearnerTurn`.
   */
  const active = await checkVoiceConsent(live.session.userId);
  if (active !== true) {
    live.microphone = false;
    send(live.socket, {
      type: 'error',
      code: 'CONSENT_REVOKED',
      message: 'The microphone was turned off. You can keep going by tapping.',
    });
    return false;
  }
  return true;
}

async function handleAudioClip(live: Live, audio: Buffer, mimeType: string): Promise<void> {
  if (!live.microphone) {
    send(live.socket, {
      type: 'error',
      code: 'CONSENT_REQUIRED',
      message: 'The microphone is not enabled for this session.',
    });
    return;
  }
  // Fresh, BEFORE anything is sent to the STT provider — see
  // `refreshMicConsent`'s own comment for why this cannot live only inside
  // `handleLearnerTurn`, downstream of `transcribe()`.
  if (!(await refreshMicConsent(live))) return;

  const claim = claimTurn(live, Date.now());
  if (claim !== 'ok') return refuseTurn(live, claim);
  live.abort = new AbortController();
  // Sent before transcription, deliberately: the wait the learner feels
  // starts the moment they release the button, not when STT returns.
  send(live.socket, { type: 'thinking' });
  try {
    const outcome = await transcribe(audio, mimeType, live.session);
    if ('unavailable' in outcome) {
      // The STT call itself never came back — a timeout, a dropped
      // connection, a provider 5xx. Never told as "I did not catch that":
      // the child did nothing wrong here, and a mic-technique apology for an
      // outage we caused is the exact defect this code distinguishes.
      send(live.socket, {
        type: 'error',
        code: 'STT_UNAVAILABLE',
        message: 'The speech-to-text provider did not respond.',
      });
      return;
    }
    const text = outcome.text;
    if (text.trim() === '') {
      send(live.socket, { type: 'error', code: 'STT_FAILED', message: 'I did not catch that.' });
      return;
    }
    // Echoed back so the learner can see what we heard. A misheard turn that
    // the learner cannot see is a tutor answering a question nobody asked.
    send(live.socket, { type: 'transcript', text });
    // Consent was already freshly checked above, for this exact turn — skip
    // the redundant second round trip to Core `handleLearnerTurn` would
    // otherwise make for every microphone turn.
    await handleLearnerTurn(live, text, live.abort.signal, {
      viaMicrophone: true,
      micConsentAlreadyChecked: true,
    });
  } finally {
    live.abort = null;
    releaseTurn(live);
  }
}

async function handleLearnerTurn(
  live: Live,
  text: string,
  signal?: AbortSignal,
  opts: { viaMicrophone?: boolean; edit?: boolean; micConsentAlreadyChecked?: boolean } = {},
): Promise<void> {
  // The floor and the single-flight slot are the CALLER's, claimed before any
  // paid work — including the transcription that precedes an audio turn. This
  // function must not re-check the floor: `claimTurn` has already stamped
  // `lastTurnAtMs`, so a second check here would refuse every turn.

  /*
   * Consent is re-checked periodically DURING a session, not only at the
   * door. /ORACLE.md §4.3 requires revocation to take effect on the next
   * turn, and a guardian who revokes while their child is mid-session means
   * it now.
   *
   * `micConsentAlreadyChecked` — `handleAudioClip` already ran this exact
   * check, fresh, BEFORE calling `transcribe()` (found missing there by
   * adversarial review, 2026-08-30, HIGH: this check used to run only here,
   * always AFTER the audio had already reached the STT provider — no
   * cadence, however tight, can retroactively un-send it). Skipping it here
   * for that path avoids a second, redundant round trip to Core for the
   * identical turn; a text-based turn (`micConsentAlreadyChecked` unset)
   * still gets the check here as before.
   */
  if (!opts.micConsentAlreadyChecked && dueForMicConsentRecheck(live)) {
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
  //
  // CAPTURED, not left inline: `tutor_safety_flags.turn_seq` must name THIS
  // row for episodic recall's exclusion query to ever match it (see
  // `deliver`'s `learnerTurnSeq` parameter below). `SafetyEvent.turnSeq`
  // (`this.seq` inside the orchestrator) counts MODEL turns, a different
  // numbering space from `tutor_turns.seq` — the exact conflation this
  // file's own `tutorRowSeq` comment already warns cost a deleted learner
  // line once. Using it for the flag would have looked like a fix while
  // silently matching nothing.
  const learnerTurnSeq = nextTranscriptSeq(live);
  void persistTurn({
    sessionId: live.session.sessionId,
    seq: learnerTurnSeq,
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
      // Answered — no longer a redraw target for a future resume.
      live.lastSegmentFrame = null;
      /*
       * `learnerTurnSeq`, THE SAME WAY THE ORDINARY TEXT/EDIT CALL BELOW
       * PASSES IT — round 67 (2026-08-30, HIGH). This call used to omit the
       * third argument entirely, on the reasoning (recorded on `deliver`'s
       * own parameter below, and now corrected) that a voice-check verdict
       * can never raise a safety flag. It can:
       * `handleVoiceCheckResult`'s own classify-before-model gate reacts to
       * self-harm, personal data and the rest of the closed vocabulary in a
       * SPOKEN answer exactly as `handleLearnerText` does for a typed one.
       * Omitting `learnerTurnSeq` here meant `deliver`'s
       * `turnSeq: learnerTurnSeq ?? safety.turnSeq` always fell back to
       * `safety.turnSeq` for this path — the orchestrator's own internal
       * per-model-turn counter, a different numbering space from
       * `tutor_turns.seq` — so a flag raised through a checked answer was
       * persisted against a row that does not exist, silently defeating
       * both the guardian page's flagged-turn highlight (round 41) and
       * migration 0054's recall exclusion for this class of flag.
       */
      await deliver(
        live,
        await live.orchestrator.handleVoiceCheckResult(
          checkable,
          { correct: result.correct, misconceptionCode: result.misconceptionCode ?? null },
          text,
          Date.now(),
          signal,
        ),
        learnerTurnSeq,
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
    learnerTurnSeq,
  );
}

async function deliver(
  live: Live,
  outcome: TurnOutcome | null,
  /**
   * The transcript row `seq` the learner's own utterance was just persisted
   * under, when this call is the direct result of one — text, edit, OR a
   * voice-check verdict (`handleVoiceCheckResult`'s own classify-before-model
   * gate reacts to a spoken utterance exactly as `handleLearnerText` does to
   * a typed one, so it can produce a `safety` flag too). Absent for every
   * OTHER caller of `deliver` (greet, farewell, consent-revoked, an
   * unavailable segment) — none of those react to fresh learner-authored
   * text, so none of them can produce a `safety` flag.
   *
   * Found by adversarial review, round 67 (2026-08-30, HIGH): this comment
   * used to claim a voice-check verdict "cannot produce a `safety` flag in
   * the first place" — false, and the voice-check call site omitted this
   * parameter on that same false premise, so a flag raised through a spoken
   * answer was persisted under the orchestrator's internal turn counter
   * (`safety.turnSeq` below) instead of its real transcript row.
   */
  learnerTurnSeq?: number,
  /**
   * How many times the content ladder has ALREADY come back empty inside the
   * handling of this one learner utterance — see `MAX_SEGMENT_RETRIES`. Zero
   * for every entry point (greet, farewell, learner text/edit, a graded
   * result, a voice-check verdict, consent revoked); only `serveSegment`'s own
   * recovery call increments it, which is what confines the count to a single
   * recursion chain and lets the next utterance start fresh.
   */
  segmentAttempt = 0,
): Promise<void> {
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
  const boardValues = emission.turn.whiteboard ? computeWhiteboardValues(emission.turn.whiteboard) : null;
  /*
   * Captured ONCE, used for both the wire send below and the persisted
   * transcript row further down — the same object either way, never
   * recomputed a second time for storage. Found by adversarial review,
   * round 35 (2026-08-30, HIGH): this board reached the learner's screen
   * and nowhere else, so replay and the guardian transcript viewer lost it
   * silently.
   */
  const wireBoard: WireWhiteboard | null =
    boardValues !== null && emission.turn.whiteboard ? { ...emission.turn.whiteboard, values: boardValues } : null;
  send(live.socket, {
    type: 'turn',
    seq: emission.seq,
    say: emission.turn.say,
    emotion: emission.turn.emotion,
    action: emission.turn.action,
    audioUrl: null,
    // `turn_audio` for this exact seq always follows — `emission.audio` never
    // rejects (synthesis failures resolve to null, still sent as a frame).
    audioPending: true,
    next: emission.turn.next,
    // v3 turn policy: per-strategy thinking time. Absent while dormant.
    ...(idleNudgeMs !== null && listenSilenceMs !== null
      ? { policy: { idleNudgeMs, listenSilenceMs } }
      : {}),
    // v3: tray demonstration steps, already schema-validated with the turn.
    ...(emission.turn.demonstrate ? { demonstrate: emission.turn.demonstrate } : {}),
    // V4: the lesson thread — our own plan text, so the HUD can say "this is
    // a lesson", which is the difference between a class and a chat.
    ...(live.orchestrator.lessonThread ? { lesson: live.orchestrator.lessonThread } : {}),
    /*
     * V4: the whiteboard. `values` are RECOMPUTED here from the model's own
     * `start`/`steps` rather than trusted from wherever they were last
     * computed — the client must never redo arithmetic that could drift from
     * what was verified, and a value that fails to compute at this point
     * (should not happen; the turn was already checked before delivery) drops
     * the whiteboard rather than send an unverified one.
     */
    ...(wireBoard !== null ? { whiteboard: wireBoard } : {}),
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
      whiteboard: wireBoard,
    }).then((recorded) => notePersist(live, recorded));
  });

  if (safety) {
    /*
     * `learnerTurnSeq` — the TRANSCRIPT row's own seq — wins whenever this
     * `deliver` call came from fresh learner-authored text: an ordinary
     * text/edit turn OR a voice-check verdict, the two places a `safety`
     * flag can actually be produced (both callers now pass it — see the
     * voice-check call site's own comment, round 67, 2026-08-30, HIGH).
     * `safety.turnSeq` (the orchestrator's internal turn counter, a
     * DIFFERENT numbering space from `tutor_turns.seq`) is kept only as a
     * fallback for a caller this function does not currently have —
     * recording SOMETHING is still better than dropping the flag, but it
     * will not match a real transcript row, so `search_tutor_turns`
     * (migration 0054) can only exclude a flagged turn from episodic recall
     * when the accurate seq reached here. Until round 67's fix, the
     * voice-check caller silently WAS that fallback case on every call —
     * omitting `learnerTurnSeq` for a path that can and does raise flags — so
     * a flagged spoken utterance's OWN transcript row was never identifiable
     * from the flag record at all. See the `learnerTurnSeq` capture above
     * for the original incident this comment already described.
     */
    /*
     * CHAINED THROUGH noteFlagPersist — its OWN counter, not `notePersist`'s.
     * Found by adversarial review, round 29 (2026-08-30, CRITICAL): this used
     * to be a bare fire-and-forget with no retry and no failure counter at
     * all, unlike its transcript-write siblings. Migration 0054's whole
     * recall exclusion is a `NOT EXISTS` against `tutor_safety_flags` — with
     * no flag row (a transient Core hiccup, exactly as plausible here as for
     * a transcript write), a turn the classifier correctly BLOCKED from the
     * model (a child's own address, phone, email — `personal_data` →
     * `turn_blocked`, the session keeps going) is indistinguishable from an
     * ordinary safe one, and a later "¿te acuerdas cuando te dije...?" query
     * resurfaces that PII verbatim into the model context. It is its OWN
     * counter rather than sharing `notePersist`'s because the learner's raw
     * text is ALSO persisted via the ordinary `persistTurn` call above,
     * which succeeds against a healthy Core even when this flag write fails
     * — a shared counter would be reset to zero by that success every
     * single turn and could never detect the flag endpoint specifically
     * failing, no matter how many times in a row it did.
     */
    void persistSafetyFlag({
      sessionId: live.session.sessionId,
      turnSeq: learnerTurnSeq ?? safety.turnSeq,
      category: safety.category,
      severity: safety.severity,
      handled: safety.handled,
    }).then((recorded) => noteFlagPersist(live, recorded));
  }

  if (emission.turn.offerAdaptation) {
    send(live.socket, { type: 'adaptation_offer', adaptation: emission.turn.offerAdaptation });
  }

  if (emission.turn.next === 'segment' && emission.turn.segmentRequest) {
    if (segmentAttempt > MAX_SEGMENT_RETRIES) {
      /*
       * THE BOUND, and it is here rather than inside `serveSegment` because
       * this is the edge the recursion actually crosses: the request is
       * refused BEFORE it costs a Core round trip, a tier-3 author call or a
       * judge call. See `MAX_SEGMENT_RETRIES` for the reproduction.
       *
       * The learner is not left hanging and nothing is silently dropped. The
       * turn above has already gone out — a real, honest recovery turn whose
       * own instruction told the model to teach the idea by hand and (on this
       * last attempt) not to promise an activity at all. What is refused is
       * only the ask behind it, and the `NO_SEGMENT` frame is still sent for
       * exactly the reason the ladder-failure path sends it: it is what clears
       * the client's "preparing something" placeholder, and without it the
       * panel would wait forever for a segment the server has already decided
       * will never come.
       *
       * LOUD, not silent (§1.0 "blind flight"): reaching this line means the
       * model ignored an explicit instruction AND the ladder had nothing for
       * this learner twice in a row, which is a content gap worth a line in
       * the log — in the same spirit as the ladder's own prerequisite and
       * frontier warnings.
       */
      console.warn(
        `[oracle] refused segment request #${segmentAttempt + 1} in one turn for session ` +
          `${live.session.sessionId} (skill ${emission.turn.segmentRequest.skillKey}): ` +
          `the ladder came back empty ${segmentAttempt} times already`,
      );
      send(live.socket, {
        type: 'error',
        code: 'NO_SEGMENT',
        message: 'No activity was available for that just now.',
      });
    } else {
      await serveSegment(live, emission.turn.segmentRequest, segmentAttempt);
    }
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
  requestInput: {
    skillKey: string;
    difficulty: number;
    framing: string;
    rationale: string;
    preferredTypes?: readonly string[] | null;
  },
  /**
   * How many times the ladder has already come back empty inside this one
   * learner utterance's handling — see `MAX_SEGMENT_RETRIES`. `deliver()`
   * refuses the call outright once it exceeds the bound, so this value is only
   * ever passed on: it is what the recovery turn is delivered with, and what
   * decides whether that turn is told it is the last one.
   */
  attempt = 0,
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
  /*
   * SANITIZED HERE, NOT REJECTED AT THE SCHEMA. `turnSchema.ts` deliberately
   * accepts any strings for this field — see `sanitizePreferredTypes`'s own
   * comment for the live incident that made a strict schema the wrong
   * choice. Core still enforces the closed enum itself, so an unsanitized
   * value would fail the WHOLE `/segments` request, not just this hint.
   */
  const preferredTypes = sanitizePreferredTypes(requestInput.preferredTypes);

  let served = await requestSegment({
    sessionId: live.session.sessionId,
    ...requestInput,
    skillKey,
    preferredTypes,
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
      isMinor: live.session.isMinor,
      // Round 64 (2026-08-30, HIGH): neither of these reached tier-3
      // generation before — a learner's interrupt could not actually stop
      // the paid author/judge calls, and their real cost never reached the
      // session's own ledger. `live.abort` is the SAME controller the
      // ordinary turn pipeline is already interrupted through.
      signal: live.abort?.signal,
      onCost: (usd) => live.orchestrator.noteGenerationCost(usd),
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
    /*
     * THE RECURSION, now counted (round 76, 2026-08-30, HIGH). This recovery
     * turn goes out through the same `deliver()` as every other, so it can ask
     * for an activity of its own — and used to be able to do so for as long as
     * the model kept asking. `attempt + 1` is what `deliver()` measures against
     * `MAX_SEGMENT_RETRIES`; `lastAttempt` tells the model, in the SAME breath,
     * that a request in this turn will not be served, so the child hears a
     * tutor teaching rather than a promise nobody will keep.
     */
    const lastAttempt = attempt + 1 > MAX_SEGMENT_RETRIES;
    await deliver(
      live,
      await live.orchestrator.handleSegmentUnavailable(Date.now(), live.abort?.signal, { lastAttempt }),
      undefined,
      attempt + 1,
    );
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
    /*
     * WHAT THE LADDER ACTUALLY SERVED, which is not necessarily the
     * `difficulty` we sent it a few lines above: the nearest-match search and
     * the prerequisite/frontier fallbacks can all answer with another band,
     * correctly. Reported by Core since round 74 (2026-08-30) precisely so
     * the controller's ratchet stops adjusting from its own guess. The `??`
     * covers a Core that predates the field — see `ServedSegmentSchema`.
     */
    served.servedDifficulty ?? null,
  );
  const segmentFrame: Extract<ServerMessage, { type: 'segment' }> = {
    type: 'segment',
    segmentId: served.segmentId,
    seq: served.seq,
    origin: served.origin,
    segment: served.segment,
    scoresXp: served.keyVerified,
    framing: requestInput.framing,
  };
  // A redraw target for resume — see `Live.lastSegmentFrame`'s own comment.
  live.lastSegmentFrame = segmentFrame;
  send(live.socket, segmentFrame);
}

async function finish(
  live: Live,
  reason: 'completed' | 'hard_budget' | 'safety_stop' | 'consent_revoked' | 'error',
): Promise<void> {
  if (live.closing) return;
  live.closing = true;
  clearInterval(live.heartbeat);

  /*
   * A GRACEFUL CLOSE CAN RACE AN ALREADY-PARKED SOCKET (round 90,
   * 2026-08-31, MEDIUM — the deferred `end_session` this fixes is the
   * reason it becomes reachable). Deferring `end_session` until a busy
   * turn's `finally` frees the floor is real async time — long enough for
   * the client's own socket teardown (`TutorExperience.tsx` closes
   * immediately after sending `end_session`, without waiting for any
   * reply) to reach this socket's `close` handler FIRST. That handler
   * cannot know a graceful close is already in flight — `live.closing` is
   * exactly what it checks, and this function had not set it yet — so it
   * parks the session on a timer, exactly as it would an honest dropped
   * connection. Canceling that park HERE, the moment a graceful close
   * actually lands, is what keeps `finalizeParked` from firing
   * `learner_left` over this same session `SESSION_RESUME_GRACE_MS` later.
   * Core's own `ended_at IS NULL` guard (`closeTutorSession`) would no-op
   * that second write's close REASON — first close wins — but would NOT
   * no-op its fire-and-forget `runPostSessionReview` call, which would pay
   * a second time to grade a conversation this function is already
   * grading below.
   */
  takeParked(live.session.sessionId);

  /*
   * Found by adversarial review, round 24 (2026-08-30, MEDIUM): a blocked
   * turn's discarded speculative synthesis is paid for but fired without
   * being awaited, so its cost only reaches `voiceCostUsd` whenever its own
   * promise happens to settle. If THIS turn was also the one that ended the
   * session, everything below read the ledger before that promise had a
   * chance to resolve, and a real, billed cost was permanently lost from
   * what gets persisted. This is the one moment the whole session's
   * economics are treated as final, so it is also the one moment worth
   * waiting the (typically already-settled, at most a few hundred ms)
   * outstanding discards.
   */
  await live.orchestrator.awaitPendingCosts();

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

  const closeOutcome = await closeSession({
    sessionId: live.session.sessionId,
    closeReason: reason,
    // The transcript's own row count (both speakers), not the model-turn
    // count — see `CloseSessionInput.turnCount`'s comment (found by
    // adversarial review, 2026-08-30, HIGH).
    turnCount: live.transcriptSeq,
    segmentCount: live.orchestrator.servedSegments,
    costUsd: live.orchestrator.totalCostUsd,
  });

  /*
   * FINALIZEPARKED WON THE RACE (round 98, 2026-08-31, MEDIUM). `takeParked`
   * above only cancels a park whose timer has not fired YET; here it already
   * has — `parkedSessions` had nothing left for it to cancel, `finish()`
   * proceeded anyway, and Core's `ended_at=is.null` filter matched zero rows
   * because `finalizeParked` already wrote `learner_left` with whatever cost
   * existed at THE MOMENT its timer fired (its own doc comment: cost "only
   * increments when a synthesis promise actually settles" — this turn's own
   * eventual cost is not in that snapshot).
   *
   * This is reachable with NO farewell slowness at all — `farewell()` calls
   * a fully scripted outcome with no model call (see its own doc comment) —
   * because the turn that was already occupying the floor when the learner
   * asked to leave can, on its own, chain enough `MODEL_TIMEOUT_MS` retries,
   * tier-3 segment generation and moderation retry time to approach or
   * exceed `SESSION_RESUME_GRACE_MS` before the farewell is ever reached.
   *
   * Logged LOUDLY rather than treated as a success: a silent no-op here is
   * exactly the "failure collapsed into emptiness" shape §1.14 forbids.
   * Cost reconciliation is deliberately NOT attempted here — computing a
   * correction that does not double-count `finalizeParked`'s own snapshot
   * would need either a fresh authoritative read of the row Core already
   * holds (a new internal endpoint, for a value this ledger's own header
   * comment already calls an ESTIMATE, not an invoice) or a new
   * migration-backed atomic op — both bigger than this round's scope. The
   * true final cost is named in the log below so it can be reconciled by
   * hand if it is ever material.
   */
  if (closeOutcome === 'already-closed') {
    console.warn(
      `[oracle] session ${live.session.sessionId}'s '${reason}' close lost a race to finalizeParked — ` +
        `Core reports the session was already closed (its 'ended_at IS NULL' write matched zero rows), so ` +
        `this close's reason and cost were NOT persisted. The busy turn ahead of it outlasted ` +
        `SESSION_RESUME_GRACE_MS on its own, with no farewell involved. This turn's true final cost was ` +
        `$${live.orchestrator.totalCostUsd.toFixed(5)} — reconcile manually if material. See RUNBOOK Round 98.`,
    );
  } else if (closeOutcome === 'failed') {
    console.warn(
      `[oracle] session ${live.session.sessionId}'s '${reason}' close call to Core failed outright — ` +
        `the close reason and the final cost of $${live.orchestrator.totalCostUsd.toFixed(5)} were NOT persisted.`,
    );
  }

  /*
   * V4: THE SLOW CHAMBER WAKES UP AS THE FAST ONE GOES TO SLEEP.
   *
   * Fire-and-forget on purpose: the learner's socket must close now, and the
   * review is between-sessions work by definition. It reads the conversation
   * that just ended and rewrites the two curated memory stores — which is
   * what makes the NEXT session start where a human tutor would start.
   *
   * Deliberately NOT skipped when `closeOutcome === 'already-closed'` above:
   * `finalizeParked` already ran this same review once, on a snapshot from
   * mid-turn — missing exactly the reply this function is closing out — and
   * suppressing the more complete run here would leave ONLY the stale one as
   * this session's lasting memory, which is worse than paying for both.
   * Running both IS a real, avoidable extra model call (§1.0's "directly"
   * cost) with no dedup between them; left open for a follow-up round rather
   * than resolved by guessing at which of the two writes should win.
   */
  void runPostSessionReview({
    session: live.session,
    history: live.orchestrator.resumeSnapshot.turns,
  }).catch((error) =>
    console.warn('[oracle] post-session review crashed:', error instanceof Error ? error.message : error),
  );

  send(live.socket, { type: 'closed', reason });
  live.socket.close(reason === 'completed' ? CLOSE_CODES.NORMAL : CLOSE_CODES.BUDGET_EXHAUSTED, reason);
}

/**
 * `transcribe()`'s two failure shapes look identical to a caller that only
 * gets a `string | null` back, and that collapse WAS the bug (found by
 * adversarial review sweep tutor-review-sweep-101, voice-audio-quality
 * dimension, 3/3 skeptics, HIGH; see RUNBOOK.md Round 102). "The child said
 * nothing intelligible" (a real call, a real empty transcript) and "the call
 * to the voice provider itself never came back" (a timeout, a dropped
 * connection, a provider 5xx — everything `VoiceUnavailableError` wraps, per
 * `voice/provider.ts`) are different facts, and only one of them is something
 * a child can fix by speaking louder. `unavailable: true` keeps the second
 * fact alive for `handleAudioClip` to act on separately, instead of both
 * arriving at the caller as the same `null`.
 */
type TranscribeOutcome = { text: string } | { unavailable: true };

async function transcribe(
  audio: Buffer,
  mimeType: string,
  session: SessionContext,
): Promise<TranscribeOutcome> {
  const provider = getVoiceProvider();
  if (!provider.available) return { unavailable: true };
  try {
    const result = await provider.transcribe({
      audio,
      mimeType,
      locale: session.locale,
    });
    return { text: result.text };
  } catch (error) {
    console.warn('[oracle] transcription failed:', error instanceof Error ? error.message : error);
    return { unavailable: true };
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
