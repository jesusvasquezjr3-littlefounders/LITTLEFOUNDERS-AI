import type { IncomingMessage, Server } from 'http';
import { z } from 'zod';
import { getConfig } from '../env.js';
import { WebSocketServer, type WebSocket } from 'ws';
import { looksLikeSupabaseJwt, verifySessionToken } from '../session/token.js';
import { acquireLock, releaseLock, renewLock } from '../lib/lock.js';
import {
  checkVoiceConsent,
  closeSession,
  fetchSessionContext,
  persistSafetyFlag,
  persistTurn,
  requestSegment,
  SessionContextSchema,
  verifyGeneratedSegment,
  voiceCheck,
  type CloseReason,
  type SessionContext,
} from '../core/client.js';
import {
  claimParkedSession,
  publishParkedSession,
  raiseTranscriptFloor,
  readTranscriptFloor,
  releaseParkIfOwned,
} from './parkStore.js';
import { verifyGradeEcho } from '../session/gradeEcho.js';
import { runPostSessionReview } from '../session/review.js';
import { spendGuard } from '../session/spend-guard.js';
import { emitTutorTrajectory } from '../session/trajectory.js';
import { getVoiceProvider } from '../voice/index.js';
import { newSpeechScope, speakLine, type SpeechScope } from '../voice/speech.js';
import { generateSegment } from '../content/generate.js';
import { moderationReadiness } from '../safety/moderation.js';
import { OrchestratorSnapshotSchema, TutorOrchestrator, type TurnOutcome } from '../tutor/orchestrator.js';
import {
  CLOSE_CODES,
  ClientMessageSchema,
  MAX_AUDIO_B64_CHARS,
  type ServerMessage,
  type WireWhiteboard,
} from './protocol.js';
import {
  computeCategories,
  computeComparison,
  computeMarkedLine,
  computeSequence,
  computeTokens,
  computeBarModel,
  computePartWhole,
  computeFlow,
  computeGoalBar,
  computeWorked,
  computeTenFrame,
  computeOpenNumberLine,
  computeArray,
  computeFractionStrip,
  computePartition,
  computeTable,
  computeScale,
  computeTwoBins,
  computeVenn,
  computeRanking,
  computeChance,
  computeDeal,
  computeChange,
  computeRegroup,
  computeEquationBar,
  computeReceipt,
  computeLedger,
  computePriceTag,
  computeInventory,
  computeBudgetPlate,
  computePictograph,
  computeBeadString,
  computeTally,
  computeFractionCircle,
  computeStack,
  computeSequenceCompare,
  computeWhatif,
  computeYourTurn,
  computeTimeline,
  computeBeforeAfter,
} from '../tutor/whiteboard.js';
import { sanitizePreferredTypes, type Whiteboard } from '../tutor/turnSchema.js';
import { assembleClip, decodeChunk } from './audioAssembly.js';
import { isHandshakeRateLimited } from './handshakeRateLimit.js';

/*
 * The one browser-facing socket (/AGENTS.md §1.5 Oracle exception).
 *
 * Everything defensive about this file is in the first lines of
 * `handleConnection`, and it is ordered cheapest-first so that an unwanted
 * connection costs us the least expensive check that can refuse it — a
 * Map.size read before a Redis round trip, either before a signature check,
 * every one of those before a round trip to Core:
 *
 *   1. this process is not already at its concurrent-session ceiling
 *      (ORACLE.md §15.2 item 2 — per-process admission control; a plain
 *      `liveSessions.size` read, no I/O at all)
 *   2. this IP has not exceeded the handshake rate limit (§15.2 item 3 — see
 *      `handshakeRateLimit.ts`; one Redis round trip, fails open on an outage)
 *   3. a token is present at all
 *   4. it is not a Supabase JWT (named explicitly, so the log says what to fix)
 *   5. the signature verifies, it has not expired, it has not been used before
 *   6. Core recognises the session and it belongs to the token's user
 *   7. moderation is available for the audience this session serves
 *   8. the microphone is refused unless consent is active RIGHT NOW
 *
 * Only after all eight does a socket become a session — and even then, a
 * NINTH gate (this exact session id is not already live, below) still guards
 * a resume racing a fresh connection for the same session.
 *
 * Gates 1 and 2 close with `CLOSE_CODES.SERVICE_DEGRADED` — the SAME code
 * gate 7 (moderation) already uses, deliberately: ORACLE.md's own text calls
 * the frontend's existing "the tutor is resting" copy for that code the
 * honest surface for exactly this family of refusal, and a child does not
 * need to know WHICH internal control declined the connection. The `reason`
 * string passed to `socket.close()` still differs per gate — logged, never
 * rendered (see `useTutorSocket.ts`'s own comment) — so an operator reading
 * Railway logs can tell them apart even though the learner sees one message.
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
  /**
   * This connection's own owner token for the distributed session-exclusivity
   * claim (item 79 / RUNBOOK Round 119) — opaque, minted by `acquireLock` at
   * connection time. Carried so the heartbeat can RENEW the claim (keeping it
   * alive for the session's whole life without holding it forever — see
   * `SESSION_LOCK_TTL_MS`) and the close handler can RELEASE exactly the
   * claim this socket acquired, never a later connection's.
   */
  lockOwner: string;
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

/**
 * How long this socket's distributed session-exclusivity claim (item 79 /
 * RUNBOOK Round 119) survives without a renewal. Derived from the heartbeat
 * cadence, not chosen independently: it must outlive at least two missed
 * renewal ticks (a single transient Redis hiccup must not drop a claim out
 * from under a perfectly healthy, ongoing conversation — see the heartbeat's
 * own renewal comment for why a failed renewal never kills the socket), while
 * staying short enough that a crashed process's claim frees itself in a
 * bounded time rather than outliving the crash it was meant to survive
 * (Round 119 point 4 — this service's `restartPolicyMaxRetries: 10` treats
 * crash-and-restart as routine, and a claim that outlives it for long would
 * regress today's actual behavior: a legitimate resume against a
 * freshly-restarted, necessarily-empty process succeeding immediately).
 * Happens to land near `SESSION_RESUME_GRACE_MS`'s own default (90s) — a
 * sanity check that the order of magnitude is right, not a shared constant;
 * the two guard different things (a claim's cross-process validity vs. how
 * long a DROPPED socket's conversation waits to be reclaimed) and should stay
 * free to diverge.
 */
const SESSION_LOCK_TTL_MS = HEARTBEAT_INTERVAL_MS * 3;

/**
 * Namespaced so `lib/lock.ts`'s test-mode `clearLocalClaims` can scope a
 * sweep to exactly this caller — see that function's own comment. Exported
 * (like `send`/`finalizeAllParked` above it) so `live-session.test.ts` can
 * simulate a DIFFERENT replica already holding a session's claim — the one
 * scenario a bare `liveSessions.has()` can never be made to see from a test
 * in this same process, since `liveSessions` itself is only ever local.
 */
export function sessionLockKey(sessionId: string): string {
  return `oracle:lock:session:${sessionId}`;
}

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
 * The park is THIS PROCESS'S MEMORY *and*, since round 143, a published
 * snapshot any replica can adopt (`ws/parkStore.ts`). It used to be the LAST
 * structure holding Oracle at one replica (`/ORACLE.md` §16); the local map
 * below is now the FAST PATH — a same-replica reconnect gets the very objects
 * the last socket was using — and the shared record is the fallback that makes
 * a reconnect landing anywhere else resume the same lesson instead of starting
 * over. See `ParkedSession` and `publishPark` for what crosses and what
 * deliberately does not.
 *
 * AND THE SESSION LOCK DOES NOT COVER IT, which is the part that is easy to
 * get wrong from the outside (established round 142, 2026-09-01). The lock
 * refuses a SECOND CONCURRENT socket; it says nothing about a resume, because
 * the close handler below deliberately RELEASES the claim before parking, so
 * a genuine resume can re-acquire immediately instead of waiting out
 * `SESSION_LOCK_TTL_MS`. At N>1 that means a reconnect load-balanced to a
 * different replica acquires the free lock cleanly, finds `takeParked` empty,
 * and builds a SECOND `TutorOrchestrator` — no history, `transcriptSeq` back
 * to 0 (so every row collides in `tutor_turns` and is dropped in silence by
 * `ignore-duplicates`, the failure this file already fixed twice), a fresh
 * budget clock and turn cap, and the learner greeted again instead of
 * redrawn. Meanwhile the ORIGINAL replica's park timer still fires
 * `SESSION_RESUME_GRACE_MS` later and closes the session in Core; that PATCH
 * filters on `ended_at=is.null` (`backend/src/services/tutorData.ts`), so the
 * first close wins and the live replica's real, billed usage never reaches
 * the cost ledger at all. A parked session that nobody reclaims is finalized
 * as `learner_left`, which is what happened.
 */
/**
 * The re-drawable `segment` frame, as it goes into a shared park record.
 *
 * Mirrors `ServerMessage`'s own `segment` variant field for field. `segment`
 * is `Record<string, unknown>` THERE too — a stripped Lesson Engine payload
 * Core has already validated on its way in — so accepting it as one here is
 * the declared type rather than a relaxation of it.
 */
const ParkedSegmentFrameSchema = z
  .object({
    type: z.literal('segment'),
    segmentId: z.string(),
    seq: z.number().int(),
    origin: z.enum(['catalog', 'bank', 'live']),
    segment: z.record(z.string(), z.unknown()),
    scoresXp: z.boolean(),
    framing: z.string(),
  })
  .strict();

/**
 * The schema above and `ServerMessage`'s own `segment` variant must stay
 * EXACTLY the same shape, and this makes a divergence a compile error rather
 * than a silent runtime one.
 *
 * Without it, adding a field to the wire type would leave this `.strict()`
 * schema rejecting every park record belonging to a session with an activity
 * on screen — which does not break a build, does not fail a test that never
 * opens an activity, and shows up only as "resume sometimes forgets the
 * conversation" for the subset of learners who dropped mid-exercise. Exactly
 * the class of defect this file keeps finding the expensive way.
 */
type ExactlyTheSame<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _parkedSegmentFrameMatchesTheWire: ExactlyTheSame<
  Extract<ServerMessage, { type: 'segment' }>,
  z.infer<typeof ParkedSegmentFrameSchema>
> = true;
void _parkedSegmentFrameMatchesTheWire;

/**
 * THE SHARED PARK RECORD — everything a different replica needs to keep this
 * exact lesson going, and nothing it does not.
 *
 * `session` and `startedAtMs` are the PINNED originals rather than the
 * resuming connection's own: a resumed orchestrator deliberately keeps the
 * context it was built with (see `TutorOrchestrator`'s `minorPosture` comment
 * for the full audit of why), and re-pins exactly one field, `isMinor`,
 * through `refreshIsMinor`. Carrying them here is what lets the far side
 * reproduce that asymmetry instead of guessing at it.
 *
 * `.strict()` throughout, and validated on read: a record is an input from a
 * shared store, and a half-understood one must be REFUSED rather than
 * best-effort restored (/AGENTS.md §1.6, §1.14).
 */
const ParkRecordSchema = z
  .object({
    session: SessionContextSchema,
    startedAtMs: z.number(),
    orchestrator: OrchestratorSnapshotSchema,
    transcriptSeq: z.number().int().min(0),
    lastTurnAtMs: z.number(),
    lastSegmentFrame: ParkedSegmentFrameSchema.nullable(),
  })
  .strict();

type ParkRecord = z.infer<typeof ParkRecordSchema>;

interface ParkedSession {
  orchestrator: TutorOrchestrator;
  speech: SpeechScope;
  lastTurnAtMs: number;
  timer: NodeJS.Timeout;
  /**
   * This park's owner token in the SHARED store, once the record has actually
   * landed — `null` while the write is still in flight, or if it never landed
   * (the store was down), or if this park was deliberately never published.
   *
   * It is what makes the grace timer safe at N>1: the timer stays a local
   * `setTimeout`, but the AUTHORITY to end the session is a compare-and-delete
   * against this token. A park that another replica has already adopted no
   * longer matches, so this replica's timer declines to close a session
   * somebody else is live on — the `ended_at=is.null` stomp `RUNBOOK.md`
   * Round 142 traced, where the dead replica's close wins and the live
   * replica's billed usage never reaches Core's ledger.
   *
   * `null` is not ambiguous here: nothing was published, so nothing could have
   * been adopted, so this replica is unambiguously the one that must close.
   */
  parkOwner: string | null;
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
  /**
   * A copy of `Live.endSessionRequested`, taken at the moment this session
   * was parked — see that field's own comment for what sets it and why.
   *
   * This is what lets `finalizeParked` tell apart the two shapes of park
   * (item 71 / round 98, closed here): a genuinely dropped connection, where
   * NOTHING else will ever call `runPostSessionReview` for this session, from
   * one that raced an in-flight `attemptEndSession` that WILL still reach
   * `finish()` — guaranteed, by construction, since `releaseTurn` (the one
   * place every turn's own `finally` already funnels through) re-fires
   * `attemptEndSession` the instant the busy turn frees the floor, and that
   * function's `try` always reaches `finish()` after the scripted, model-free
   * `farewell()`. See `finalizeParked`'s own comment for what this buys.
   */
  endSessionRequested: boolean;
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

function parkSession(sessionId: string, live: Live): ParkedSession {
  // A stale park for the same session (two sockets raced) is finalized first —
  // two parked orchestrators for one session would both write a close later.
  finalizeParked(sessionId);
  const entry: ParkedSession = {
    orchestrator: live.orchestrator,
    speech: live.speech,
    lastTurnAtMs: live.lastTurnAtMs,
    transcriptSeq: live.transcriptSeq,
    lastSegmentFrame: live.lastSegmentFrame,
    endSessionRequested: live.endSessionRequested,
    parkOwner: null,
    timer: setTimeout(() => finalizeParked(sessionId), getConfig().SESSION_RESUME_GRACE_MS),
  };
  entry.timer.unref();
  parkedSessions.set(sessionId, entry);
  return entry;
}

/**
 * Publishes a local park to the shared store so ANOTHER replica can adopt it.
 *
 * Returns once the record has landed (or provably has not), because the
 * caller must not release this session's exclusivity claim until then — see
 * the close handler's own comment for why that ordering is the whole fix.
 *
 * TWO parks are deliberately never published:
 *
 *   - One whose entry is no longer the live one. `await`ing the pending audio
 *     below is real async time, and a resume can land inside it; publishing
 *     afterwards would advertise a conversation this process has already
 *     handed over, and the adopter would find TWO records for one session
 *     across its life. Re-reading the map after every await is what makes
 *     this safe rather than merely unlikely.
 *   - One with `endSessionRequested` set. That park raced an in-flight
 *     `attemptEndSession`, and `finalizeParked`'s deferral rests on `finish()`
 *     being GUARANTEED to still run — a guarantee made by a `finally`-chain
 *     INSIDE this process, which does not exist across processes. Rather than
 *     re-deriving that guarantee for a fleet, a session that has already asked
 *     to end simply never becomes adoptable: there is nothing left to resume,
 *     and its transcript continuity is held by the floor below regardless.
 *     (`RUNBOOK.md` Round 142's requirement 5.)
 */
async function publishPark(sessionId: string, entry: ParkedSession): Promise<void> {
  if (entry.endSessionRequested) return;

  /*
   * The ledger is folded up BEFORE the snapshot, never after. `voiceUsd` only
   * grows when a discarded speculative synthesis actually settles, so a
   * snapshot taken with promises still outstanding hands the adopting replica
   * a cost that is real money short — and that replica's close is the one
   * Core will record. This is the one call site that answers Round 142's
   * "unsettled paid-TTS promises" question: they are SETTLED, not dropped and
   * not carried.
   */
  await entry.orchestrator.awaitPendingCosts();
  if (parkedSessions.get(sessionId) !== entry) return;

  let json: string;
  try {
    const record: ParkRecord = {
      session: entry.orchestrator.sessionContext,
      startedAtMs: entry.orchestrator.startedAt,
      orchestrator: entry.orchestrator.snapshot(),
      transcriptSeq: entry.transcriptSeq,
      lastTurnAtMs: entry.lastTurnAtMs,
      lastSegmentFrame: entry.lastSegmentFrame,
    };
    /*
     * VALIDATED HERE, WHERE IT IS CAUSED — not only on the far side where it
     * is suffered. `adoptParkedSession` re-validates because a record from a
     * shared store is an untrusted input; this validates because a record this
     * process cannot even write correctly is a bug in THIS deploy, and finding
     * it in the log of the replica that produced it is worth far more than
     * finding it in the log of whichever replica later failed to adopt.
     * Refusing to publish is also the right outcome: a record that will be
     * rejected on read is worse than no record, because it wastes the grace
     * window pretending a hand-off is possible.
     */
    const valid = ParkRecordSchema.safeParse(record);
    if (!valid.success) {
      console.error(
        `[oracle] session ${sessionId}: refusing to publish a park record that does not match its own ` +
          `schema — this session stays resumable only on THIS replica. ${valid.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
      );
      return;
    }
    json = JSON.stringify(record);
  } catch (error) {
    // LOUD: a session that cannot be snapshotted is one no other replica can
    // ever take over, and silence here would look exactly like a healthy park.
    console.error(
      `[oracle] session ${sessionId}: could not snapshot the parked conversation — ` +
        `it stays resumable only on THIS replica:`,
      error instanceof Error ? error.message : error,
    );
    return;
  }

  const owner = await publishParkedSession(sessionId, json, getConfig().SESSION_RESUME_GRACE_MS);
  if (parkedSessions.get(sessionId) === entry) entry.parkOwner = owner;
}

function takeParked(sessionId: string): ParkedSession | null {
  const entry = parkedSessions.get(sessionId);
  if (!entry) return null;
  clearTimeout(entry.timer);
  parkedSessions.delete(sessionId);
  /*
   * The shared advertisement goes with it. This replica is either resuming
   * the session itself or cancelling the park outright (`finish()`), and in
   * both cases a record left behind is an invitation for a THIRD process to
   * adopt a conversation that is already live here. Fire-and-forget: nothing
   * downstream waits on it, and a failed delete simply ages out on the
   * record's own TTL.
   */
  if (entry.parkOwner) void releaseParkIfOwned(sessionId, entry.parkOwner);
  return entry;
}

/**
 * What a resuming socket needs, from EITHER park — this process's own map or
 * another replica's published record. `ParkedSession` is a superset of it, so
 * a local resume satisfies this without conversion and the handshake below
 * has exactly one shape to reason about rather than two nearly-identical ones.
 */
interface ResumedSession {
  orchestrator: TutorOrchestrator;
  speech: SpeechScope;
  lastTurnAtMs: number;
  transcriptSeq: number;
  lastSegmentFrame: Extract<ServerMessage, { type: 'segment' }> | null;
}

/**
 * Takes another replica's published park and rebuilds this conversation here.
 *
 * Returns `null` for every "no" — there is nothing parked, the store could not
 * be reached, the record was written by a replica running a different snapshot
 * version, or it failed validation. That collapse is deliberate and is the
 * opposite of the transcript floor's posture two gates below, because the
 * STAKES are opposite: a missing adoption costs the learner their conversation
 * history and re-greets them, which is bad; a missing floor silently destroys
 * rows already written, which is unrecoverable. So this one degrades and says
 * so, and that one refuses.
 *
 * Nothing here is best-effort restored. `ParkRecordSchema` is `.strict()` and
 * the snapshot carries an explicit version, because a partially-understood
 * conversation is indistinguishable from a healthy one right up until a
 * transcript row or a dollar goes missing (/AGENTS.md §1.14).
 */
async function adoptParkedSession(sessionId: string): Promise<ResumedSession | null> {
  const claim = await claimParkedSession(sessionId);
  if (!claim.ok) {
    console.warn(
      `[oracle] session ${sessionId}: could not check for a parked conversation on another replica ` +
        `(shared store unreachable) — continuing as a fresh conversation.`,
    );
    return null;
  }
  if (claim.record === null) return null;

  let parsed: ParkRecord;
  try {
    const validated = ParkRecordSchema.safeParse(JSON.parse(claim.record));
    if (!validated.success) {
      console.error(
        `[oracle] session ${sessionId}: a parked conversation was found on the shared store but did NOT ` +
          `validate — refusing to restore it partially. ${validated.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
      );
      return null;
    }
    parsed = validated.data;
  } catch (error) {
    console.error(
      `[oracle] session ${sessionId}: a parked conversation on the shared store was unreadable:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  /*
   * The `Synthesizer`, rebuilt (Round 142's requirement 2). It is the one
   * thing in the snapshot that genuinely cannot travel — a closure over this
   * process's `SpeechScope` — so it is constructed here exactly the way the
   * first connection constructed it, from the record's PINNED session so the
   * voice and locale are the ones this conversation has been using.
   *
   * The paid-speech memo does NOT come with it: `SpeechScope.memo` is a
   * per-process cache of already-synthesized lines, and the worst a cold one
   * costs is re-synthesizing a line this learner hears again — real money, but
   * cents, and the shared speech cache (`voice/cache.ts`, 180-day TTL) already
   * absorbs most of it. `SpeechScope.inFlight` must NEVER be shared at all;
   * `voice/speech.ts` records why, and Round 142 proved it serves one child's
   * session audio into another child's session.
   */
  const speech = newSpeechScope(parsed.session);
  const orchestrator = TutorOrchestrator.restore(
    parsed.orchestrator,
    parsed.session,
    parsed.startedAtMs,
    (turn) => speakLine(turn.say, speech),
  );

  console.log(
    `[oracle] session ${sessionId}: adopted a conversation parked by another replica — ` +
      `${parsed.orchestrator.history.length} turns, transcript seq ${parsed.transcriptSeq}.`,
  );

  return {
    orchestrator,
    speech,
    lastTurnAtMs: parsed.lastTurnAtMs,
    transcriptSeq: parsed.transcriptSeq,
    lastSegmentFrame: parsed.lastSegmentFrame,
  };
}

/**
 * Test seam: drops this process's LOCAL park entries without finalizing them.
 *
 * This is the one condition a single-process test cannot otherwise reach, and
 * it is the exact condition a second replica is always in — it never had the
 * local entry, only whatever the shared store holds. Dropping the local map
 * mid-test turns "resume on the same replica" into "resume on a different
 * one", which is the whole scenario this file's cross-replica behaviour
 * exists for. Named so it cannot be mistaken for a production affordance;
 * there is deliberately no non-test caller.
 */
export function dropLocalParksForTest(): void {
  for (const entry of parkedSessions.values()) clearTimeout(entry.timer);
  parkedSessions.clear();
}

/**
 * The two things a caller can tell `finalizeParked` about ITSELF, both of
 * which only the shutdown path ever sets — see `finalizeAllParked`.
 */
interface FinalizeParkedOptions {
  /** Run the post-session review even when a graceful close is still in flight. */
  forceReview?: boolean;
  /** Do not WAIT on the shared store; this process is about to stop existing. */
  shuttingDown?: boolean;
}

/**
 * The park expired (or the process is shutting down): the session really
 * ended. `closeReason` defaults to the ordinary grace-window-timeout meaning
 * ("nobody came back") — `closeAllSockets` passes `'abandoned'` explicitly
 * for the shutdown case, where that is not true: the PROCESS is what is
 * leaving, not the learner.
 *
 * `opts.forceReview` exists for exactly one caller, `finalizeAllParked` —
 * see its own comment for why the deferral below must never apply there.
 */
function finalizeParked(
  sessionId: string,
  closeReason: CloseReason = 'learner_left',
  opts: FinalizeParkedOptions = {},
): void {
  const entry = parkedSessions.get(sessionId);
  if (!entry) return;
  clearTimeout(entry.timer);
  parkedSessions.delete(sessionId);
  entry.speech.memo.clear();
  void finalizeParkedOnce(sessionId, entry, closeReason, opts);
}

/**
 * The half of `finalizeParked` that must ask the FLEET a question first.
 *
 * Split out, and fired rather than awaited, so `finalizeParked` itself stays
 * synchronous — it is called from a `setTimeout`, from `parkSession`'s
 * stale-park sweep and from the shutdown path, none of which can await.
 */
async function finalizeParkedOnce(
  sessionId: string,
  entry: ParkedSession,
  closeReason: CloseReason,
  opts: FinalizeParkedOptions,
): Promise<void> {
  /*
   * DID ANYONE ELSE TAKE THIS PARK? — the fleet-owned half of the grace
   * window (`RUNBOOK.md` Round 142's requirement 4).
   *
   * The timer that brought us here is still a local `setTimeout`: a
   * distributed scheduler is a great deal of machinery for a question a local
   * clock already answers correctly. What could not stay local is the
   * AUTHORITY to act on it. At N>1 this replica's timer would otherwise close
   * a session another replica has since resumed — and because Core's close
   * filters on `ended_at IS NULL`, the DEAD replica's close wins and the live
   * conversation's real, billed usage never reaches the ledger at all. That
   * is the precise accounting failure Round 142 traced.
   *
   * `unreachable` closes anyway, and that is a decision rather than a
   * fallthrough. Adoption itself REQUIRES the shared store — a resuming socket
   * cannot get past the session lock (which fails CLOSED, see the handshake's
   * own call site) nor read the park record without it — so "the store is
   * down" implies "nobody adopted this". The exposure that remains is only a
   * store that was up at adoption and down one grace window later. Weighed
   * against the alternative: declining to close on an unreachable store would
   * leave EVERY abandoned session open in Core's ledger for the whole
   * duration of any outage, cost unrecorded, `ended_at` null forever, with no
   * process that will ever revisit it. A certain §1.0 blind flight versus a
   * narrow race — so this closes, and says so.
   */
  if (entry.parkOwner && opts.shuttingDown === true) {
    /*
     * SHUTDOWN DOES NOT WAIT FOR THE ANSWER, and that keeps this path's timing
     * exactly what it was before any of this existed.
     *
     * `index.ts`'s `shutdown()` budgets ~250ms before `process.exit(0)` and
     * disconnects Redis on its way past. `releaseParkIfOwned` is bounded by
     * the same 250ms command timeout — so awaiting it here could consume the
     * entire remaining budget and lose the `closeSession` call altogether,
     * turning a best-effort close into no close at all. A session whose row
     * stays open forever, cost unrecorded, is a worse outcome than the narrow
     * case this check protects against (a park published by an EARLIER drop,
     * adopted by a sibling replica, inside the last grace window before this
     * process was told to stop).
     *
     * The record is still dropped, just without waiting: a shared record left
     * pointing at a session this process is about to close is an invitation
     * for a sibling to adopt a conversation that has already ended.
     */
    void releaseParkIfOwned(sessionId, entry.parkOwner);
  } else if (entry.parkOwner) {
    const verdict = await releaseParkIfOwned(sessionId, entry.parkOwner);
    if (verdict === 'taken') {
      console.log(
        `[oracle] session ${sessionId}'s park was adopted by another replica — declining to close it ` +
          `here; that replica owns this session's ending now.`,
      );
      return;
    }
    if (verdict === 'unreachable') {
      console.warn(
        `[oracle] session ${sessionId}: could not confirm whether another replica adopted this park ` +
          `(shared store unreachable). Closing as '${closeReason}' rather than leaving the row open ` +
          `forever — see finalizeParkedOnce's comment for the trade.`,
      );
    }
  }

  /*
   * THIS CLOSE'S OUTCOME IS READ, NOT DISCARDED (2026-09-01).
   *
   * It used to be a bare `void closeSession({...})`. `finish()` — the OTHER
   * close path, the one that can lose the race to this one — has warned
   * loudly on both `already-closed` and `failed` since round 98. This path
   * had no branch at all, so when THIS side was the one that failed (Core
   * unreachable, a 5xx, a malformed envelope) the session's `ended_at`,
   * `close_reason` and entire cost were silently never written, and the only
   * trace anywhere was a row that stays open forever. That is precisely the
   * "failure collapsed into emptiness" shape §1.14 forbids, and it was
   * hiding in the half of the race nobody had instrumented.
   *
   * Observability ONLY — this deliberately does NOT retry and does NOT
   * reconcile the cost. `add_tutor_session_cost` (migration 0062) is
   * additive with NO idempotency key, so a retry that could not prove the
   * first write missed would DOUBLE-count. Over-counting is strictly worse
   * than under-counting here: `cost_usd` is written by exactly this path and
   * read by nothing — no route returns it, no UI renders it, nothing bills
   * from it — while its one real purpose is spotting a session that cost ten
   * times the normal amount, which a double-count would trigger falsely. The
   * money itself is NOT lost from view either way: `spendGuard.record()`
   * fires inside `addModelCost`/`addVoiceCost` at the moment of spend, so
   * every dollar already counts against the daily ceiling regardless of
   * whether this row ever hears about it. See oracle/AGENTS.md item 71.
   */
  void closeSession({
    sessionId,
    closeReason,
    // The transcript's own row count, not the model-turn count — see
    // `CloseSessionInput.turnCount`'s comment.
    turnCount: entry.transcriptSeq,
    segmentCount: entry.orchestrator.servedSegments,
    costUsd: entry.orchestrator.totalCostUsd,
  })
    .then((outcome) => {
      if (outcome === 'closed') return;
      const cost = entry.orchestrator.totalCostUsd.toFixed(5);
      if (outcome === 'already-closed') {
        console.warn(
          `[oracle] parked session ${sessionId}'s '${closeReason}' close found it ALREADY closed — ` +
            `something else (a resumed socket's own finish(), or a second finalize) got there first, so ` +
            `this snapshot's cost of $${cost} was NOT persisted. Reconcile manually if material.`,
        );
        return;
      }
      console.warn(
        `[oracle] parked session ${sessionId}'s '${closeReason}' close call to Core FAILED outright — ` +
          `the session row is still open with no close reason and no cost ($${cost} unrecorded). ` +
          `Nothing will retry this: the row stays open until the retention sweep reaps it.`,
      );
    })
    // `closeSession` catches its own transport errors and answers 'failed',
    // so this is unreachable today — but an unhandled rejection raised from a
    // bare `setTimeout` callback takes the whole process down, and this one
    // is armed on every parked session.
    .catch((err: unknown) => {
      console.warn(
        `[oracle] parked session ${sessionId}'s close threw unexpectedly: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
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

  /*
   * DEFER TO THE GRACEFUL CLOSE THAT IS STILL COMING (item 71 / round 98,
   * closed here — was left open on purpose, see `finish()`'s own comment on
   * its unconditional review call for the other half of this fix).
   *
   * `entry.endSessionRequested` being true means this park raced an
   * in-flight `attemptEndSession`: the busy turn ahead of the farewell
   * outlasted `SESSION_RESUME_GRACE_MS` ON ITS OWN, this timer won the close
   * against `finish()`'s later attempt, and `finish()` is GUARANTEED to
   * still run — `entry.endSessionRequested`'s own doc comment names the
   * `finally`-chain that makes that a certainty, not a hope.
   *
   * The naive fix here would be "the loser of the close race skips its own
   * review" — and it would be WRONG, because the loser in this race is
   * `finish()`, and `entry.orchestrator` is the exact same object `finish()`
   * reads from: `resumeSnapshot.turns` is a snapshot taken AT CALL TIME
   * (`orchestrator.ts`'s own `.map()`), so THIS call, firing the instant the
   * grace window expires, is the STALE one — missing exactly the busy turn's
   * own reply, which is what made this race reachable in the first place.
   * Skipping the loser would keep only that stale review and silently
   * discard the complete one forever. So this defers instead: the review
   * that was about to run on incomplete data is skipped HERE, in favour of
   * the one `finish()` is guaranteed to run on the complete conversation —
   * the double-pay is closed without losing the more complete write either
   * way, which is what "left open for a follow-up" in the old comment here
   * used to mean.
   *
   * `opts.forceReview` overrides this for exactly one caller: process
   * shutdown. A finally-chain guarantee is only as good as there being an
   * event loop left to run it on, and `finalizeAllParked` exists precisely
   * because there is about to not be one — deferring there would mean this
   * review NEVER fires, the one outcome worse than paying for it twice.
   */
  if (entry.endSessionRequested && opts.forceReview !== true) {
    console.log(
      `[oracle] session ${sessionId} parked with a graceful close already in flight — ` +
        `deferring its post-session review to that close's own, more complete one.`,
    );
    return;
  }

  void runPostSessionReview({
    session: entry.orchestrator.sessionContext,
    history: entry.orchestrator.resumeSnapshot.turns,
  }).catch((error) =>
    console.warn('[oracle] post-session review crashed:', error instanceof Error ? error.message : error),
  );

  /*
   * V4 harness backlog: TRAJECTORY EMISSION, for the session that ended THIS
   * way too — the exact same fire-and-forget seam as the review just above.
   * A no-op when the controller never activated this session (empty log).
   */
  void emitTutorTrajectory({
    sessionId: entry.orchestrator.sessionContext.sessionId,
    userId: entry.orchestrator.sessionContext.userId,
    steps: entry.orchestrator.trajectorySteps,
  }).catch((error) =>
    console.warn('[oracle] trajectory emission crashed:', error instanceof Error ? error.message : error),
  );
}

/**
 * Every parked session, finalized. Called on shutdown so no close is lost —
 * the only caller is the SIGTERM handler below, always with `'abandoned'`.
 *
 * `forceReview: true` on every one of them: `finalizeParked`'s own deferral
 * (item 71) trusts a `finally`-chain elsewhere in this process to still call
 * `finish()` later, and shutdown is precisely the moment that trust runs out
 * — there is no "later" left to defer to. Skipping the review here on that
 * same trust would make it never run at all, for a session that had a real
 * conversation in it.
 *
 * `shuttingDown: true` for the sibling reason, one layer down: the shared-park
 * ownership check is a bounded round trip, and this function runs inside
 * `index.ts`'s ~250ms exit budget. See `finalizeParkedOnce` for why the answer
 * is worth less here than the close it would delay.
 *
 * NOTE, and it is a real limitation rather than an oversight: a REDEPLOY still
 * ends every live session as `'abandoned'` instead of handing it to a sibling
 * replica. Cross-replica adoption covers a learner who DROPS; it deliberately
 * does not change what a deploy does to a learner mid-lesson, which
 * `RUNBOOK.md` Round 142 (requirement 6) calls an owner decision rather than a
 * refactor — and which would need a fleet-liveness signal this service does
 * not have, since "is a sibling still there to resume into?" is exactly the
 * question a process on its way out cannot answer about itself.
 */
export function finalizeAllParked(closeReason: CloseReason = 'abandoned'): void {
  for (const sessionId of [...parkedSessions.keys()]) {
    finalizeParked(sessionId, closeReason, { forceReview: true, shuttingDown: true });
  }
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
  /*
   * Published to the shared floor so that whichever replica serves this
   * session NEXT — after a drop, a crash or a redeploy — continues the
   * transcript instead of restarting it. Fire-and-forget by design (see
   * `raiseTranscriptFloor`): this is the live turn path, the learner must
   * never wait on it, and a lost raise is absorbed by the next row.
   *
   * Raised on ALLOCATION rather than after the row is confirmed written,
   * deliberately. The floor's job is "no future row may reuse this number",
   * and a number that was allocated and then failed to persist must still
   * never be reused: `persistTurn` can fail, and a retry of the CONVERSATION
   * would otherwise be free to hand the same seq to different text. Being one
   * or two ahead of what Core actually holds costs nothing — the column has
   * no meaning beyond ordering — while being one behind is the silent
   * collision this whole mechanism exists to prevent.
   */
  raiseTranscriptFloor(live.session.sessionId, live.transcriptSeq);
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

/**
 * The caller's address, for the handshake rate limit — read BEFORE the token,
 * so it is available even for a request the token gates would refuse anyway.
 *
 * Mirrors `app.ts`'s `trust proxy: 1`: Railway terminates in front of this
 * process, so the raw socket's own `remoteAddress` is the proxy's address,
 * not the caller's. `x-forwarded-for` may carry a chain of proxies; the FIRST
 * entry is the original client, the same hop `trust proxy: 1` trusts.
 */
function handshakeIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
  return first || request.socket.remoteAddress || 'unknown';
}

/**
 * THE WHITEBOARD, RECOMPUTED AT THE WIRE — never trusted from wherever it
 * was last computed, dispatched to the right pure function for its `kind`
 * (`tutor/whiteboard.ts`). The ONE place both call sites that put a board on
 * the wire (the normal `deliver()` path and a reconnect's resume redraw,
 * below) go through, so the two can never verify a new kind two different
 * ways — the exact drift `computeSequence` being called out twice, by hand,
 * used to risk before this existed.
 */
function toWireWhiteboard(board: Whiteboard | null | undefined): WireWhiteboard | null {
  if (board == null) return null;
  switch (board.kind) {
    case 'sequence': {
      const values = computeSequence(board);
      return values === null ? null : { ...board, values };
    }
    case 'compare': {
      const result = computeComparison(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'marked_line': {
      const marks = computeMarkedLine(board);
      return marks === null ? null : { ...board, marks };
    }
    case 'categories': {
      const values = computeCategories(board);
      return values === null ? null : { ...board, values };
    }
    case 'tokens': {
      const result = computeTokens(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'bar_model': {
      const result = computeBarModel(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'part_whole': {
      // Nothing to attach: every value is stated, and what this compute adds is
      // the REFUSAL of a bond that does not balance.
      return computePartWhole(board) === null ? null : { ...board };
    }
    case 'flow': {
      const result = computeFlow(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'goal_bar': {
      const result = computeGoalBar(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'worked': {
      const result = computeWorked(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'ten_frame': {
      const result = computeTenFrame(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'open_number_line': {
      const result = computeOpenNumberLine(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'array': {
      const result = computeArray(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'fraction_strip': {
      const result = computeFractionStrip(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'partition': {
      const result = computePartition(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'table': {
      const result = computeTable(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'scale': {
      const result = computeScale(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'two_bins': {
      const result = computeTwoBins(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'venn': {
      const result = computeVenn(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'ranking': {
      const result = computeRanking(board);
      return result === null ? null : { ...board, ...result };
    }
    // Prose only: nothing to attach, and nothing a computation could verify.
    // Moderation is what guards these two.
    case 'outcomes':
    case 'trade':
      return { ...board };
    case 'chance': {
      const result = computeChance(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'deal': {
      const result = computeDeal(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'change': {
      const result = computeChange(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'regroup': {
      const result = computeRegroup(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'equation_bar': {
      const result = computeEquationBar(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'receipt': {
      const result = computeReceipt(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'ledger': {
      const result = computeLedger(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'price_tag': {
      const result = computePriceTag(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'inventory': {
      const result = computeInventory(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'budget_plate': {
      const result = computeBudgetPlate(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'pictograph': {
      const result = computePictograph(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'bead_string': {
      const result = computeBeadString(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'tally': {
      const result = computeTally(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'fraction_circle': {
      const result = computeFractionCircle(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'stack': {
      const result = computeStack(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'sequence_compare': {
      const result = computeSequenceCompare(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'timeline': {
      const result = computeTimeline(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'before_after': {
      const result = computeBeforeAfter(board);
      return result === null ? null : { ...board, ...result };
    }
    // Prose only; moderation is its guard.
    case 'cycle':
      return { ...board };
    case 'grab':
      // Nothing computed: see `whiteboardComputesOk`'s own comment on this
      // kind for why — no cross-field relationship exists to validate,
      // let alone attach.
      return { ...board };
    case 'fill':
      return { ...board };
    case 'whatif': {
      const result = computeWhatif(board);
      return result === null ? null : { ...board, ...result };
    }
    case 'your_turn': {
      const result = computeYourTurn(board);
      return result === null ? null : { ...board, ...result };
    }
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
  /*
   * THREE GATES, IN COST ORDER, ALL AHEAD OF EVERY AUTH CHECK BELOW rather
   * than threaded in as more items on that list: when any one of them has
   * already decided to refuse the connection, WHO is asking is not a
   * question worth a token parse, a signature check or a Core round-trip to
   * answer — that work is about to be thrown away regardless of how it
   * comes out. Ordered cheapest-first, each one a strict subset of the
   * remaining budget the next one would otherwise spend:
   *
   * GATE 1 — THE SPEND CIRCUIT BREAKER (/ORACLE.md §15.2 item 1). Touches
   * nothing but this process's own in-memory ledger — the cheapest possible
   * check, and the one most worth failing on first, since a tripped spend
   * ceiling means every other gate's work is certain to be wasted.
   */
  const admission = spendGuard.check();
  if (!admission.admitting) {
    console.error(
      `[oracle] refusing a new session — platform spend ceiling reached: ` +
        `$${admission.spentUsd.toFixed(4)} spent against a $${admission.ceilingUsd.toFixed(2)} daily ceiling`,
    );
    socket.close(CLOSE_CODES.SPEND_CEILING, 'daily spend ceiling reached');
    return;
  }

  /*
   * GATE 2: this process is not already holding its configured ceiling of
   * live sessions (ORACLE.md §15.2 item 2). Still a single `Map.size` read —
   * no I/O — so it stays ahead of gate 3, which can genuinely reach Redis.
   */
  if (liveSessions.size >= getConfig().ORACLE_MAX_CONCURRENT_SESSIONS) {
    socket.close(CLOSE_CODES.SERVICE_DEGRADED, 'at capacity — try again shortly');
    return;
  }

  /*
   * GATE 3: this IP has not exceeded the handshake rate limit (§15.2 item 3).
   * The one gate of the three that is genuinely async — memory-backed in
   * test/dev, Redis-backed in production — so it runs last among these
   * three despite still running ahead of every token/auth check below.
   * See `handshakeRateLimit.ts` for why this is not simply
   * `middleware/rateLimit.ts`'s `globalRateLimiter` reused — that limiter is
   * Express-only and never sees this path in the first place.
   */
  if (await isHandshakeRateLimited(handshakeIp(request))) {
    socket.close(CLOSE_CODES.SERVICE_DEGRADED, 'too many connection attempts — try again in a moment');
    return;
  }

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

  const verdict = await verifySessionToken(raw);
  if (!verdict.ok) {
    /*
     * `replayed` IS `ALREADY_CONNECTED`, ONE CONNECTION EARLIER — chased down
     * during RUNBOOK.md's Round 81/82 cold-mount investigation. A replayed
     * token means a DIFFERENT socket already spent this exact single-use
     * nonce (`token.ts`'s `nonceLedger`) and, being first, is the one Oracle
     * is actually talking to — the SEVENTH GATE below refuses a second
     * socket on THOSE terms once `liveSessions` has an entry, but a nonce
     * replay is caught earlier, before that map is ever touched, and used to
     * fall into the same generic `UNAUTHORIZED`/4001 bucket as a malformed,
     * unsigned or genuinely expired token. Verified against this exact
     * server with two real sockets racing one real token: the loser closes
     * 4001 "session token replayed" while the winner is mid-conversation —
     * and the client's own `closeCodeToReason` reads 4001 as `SESSION_EXPIRED`
     * unconditionally, so whichever socket a mounted component is actually
     * listening to reported a session that was never close to expiring as
     * "expired," with nothing to do about it. `ALREADY_CONNECTED` is the
     * honest reason — someone/something else already claimed this token —
     * and it already carries its own translated copy in all three locales
     * naming exactly this shape ("You're already talking to me somewhere
     * else"), so this reuses that vocabulary instead of inventing a fourth.
     *
     * `store_unreachable` is a THIRD, distinct shape, and not an auth failure
     * at all — it is the SAME `nonceLedger`'s shared store (item 79 / RUNBOOK
     * Round 119) failing CLOSED because it could not confirm this token
     * unused, most likely a Redis outage. Every other reason here really is
     * the client's fault; this one is ours, and the client already has a
     * close code and a copy for exactly that distinction (`SERVICE_DEGRADED`
     * — "The tutor is resting. Try again soon.") from the
     * moderation-unavailable refusal a few lines down.
     */
    const code =
      verdict.reason === 'replayed'
        ? CLOSE_CODES.ALREADY_CONNECTED
        : verdict.reason === 'store_unreachable'
          ? CLOSE_CODES.SERVICE_DEGRADED
          : CLOSE_CODES.UNAUTHORIZED;
    socket.close(code, `session token ${verdict.reason}`);
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
   * NINTH GATE: the session must not already have a live socket. A genuine
   * resume only ever reaches this point after the ORIGINAL socket's `close`
   * handler has already removed it from `liveSessions` (and parked the
   * orchestrator, below) — so a session that is still here is not a dropped
   * connection being reclaimed, it is a second socket racing the first one.
   *
   * TWO checks, cheapest first. `liveSessions.has()` is the original,
   * zero-latency, same-process guard — unchanged, and still what catches the
   * overwhelming majority of real "second socket" attempts, since Oracle runs
   * as one replica per deploy by default. The distributed claim below is what makes this
   * gate ACTUALLY hold once that stops being true (`oracle/AGENTS.md` item 79
   * / `RUNBOOK.md` Round 119): a second socket for this session landing on a
   * DIFFERENT process would find this process's `liveSessions` empty and sail
   * through with no second check at all — which is exactly the gap Round 119
   * investigated, found real, and deliberately left open pending this work.
   */
  if (liveSessions.has(session.sessionId)) {
    socket.close(CLOSE_CODES.ALREADY_CONNECTED, 'this session already has an active connection');
    return;
  }

  /*
   * THE FAIL-CLOSED DECISION — written here because this is the call site,
   * per `oracle/AGENTS.md` item 79's own instruction that it be recorded
   * "prominently... exactly the way this repo's other architecture decisions
   * are documented."
   *
   * `acquireLock` (`lib/lock.ts`) is deliberately neutral: it reports `held`
   * or `unreachable` and leaves the decision to each call site. This one
   * chooses FAIL CLOSED — refuse the connection when the shared store cannot
   * confirm exclusivity — rather than fail OPEN (`lib/lock.ts` unreachable →
   * treat as acquired). Reasoning, weighed against this repo's own existing
   * precedent rather than assumed:
   *
   *   - §1.14 already has a fail-OPEN control — the rate limiter — and its
   *     own comment states why: "a degraded limiter must never be able to
   *     take the platform down." That reasoning applies to an AVAILABILITY
   *     control, where the failure being guarded against (a flood) is
   *     symmetric with the failure fail-open risks (an outage) — both are
   *     "the platform stops working." THIS lock's job is different in kind:
   *     it is what keeps two orchestrators from running the SAME session
   *     concurrently, and the failure it exists to prevent — a second,
   *     independent `TutorOrchestrator` racing the first (the exact bug item
   *     8 fixed on 2026-08-30, and the one this whole migration exists to
   *     keep fixed once a second replica exists) — is duplicate paid
   *     model/judge/TTS calls and a corrupted transcript row count, not a
   *     brief unavailability. Failing open here would not degrade the
   *     platform; it would silently REMOVE the protection during exactly the
   *     infrastructure instability (a Redis blip, a redeploy) it exists for
   *     — RUNBOOK Round 119's own §3 named this precisely.
   *   - Failing closed does NOT touch `GET /health`, which has never
   *     consulted Redis and still does not — so a Redis outage degrades
   *     Oracle's ability to START or RESUME a session, specifically, and
   *     nothing else. An already-live session is completely unaffected (this
   *     gate runs once, at connection time; see the heartbeat's renewal
   *     below for what an outage during an ONGOING session does instead —
   *     deliberately NOT this).
   *   - The crash-and-restart regression Round 119 point 4 warned about (a
   *     durable claim outliving the crashed process that held it) is why the
   *     claim carries a bounded TTL and is renewed periodically rather than
   *     held forever — see `SESSION_LOCK_TTL_MS` below — not a reason to
   *     fail open on an ordinary blip.
   *
   * One bounded retry already happened inside `acquireLock` itself before
   * this ever sees `ok: false` — see `lib/lock.ts`'s `RETRY_DELAY_MS`
   * comment for exactly which race that closes (our own just-closed socket's
   * not-yet-landed release) and which one it does not (a genuine conflict or
   * a real outage).
   */
  const lockKey = sessionLockKey(session.sessionId);
  const claimed = await acquireLock(lockKey, SESSION_LOCK_TTL_MS);
  if (!claimed.ok) {
    socket.close(
      claimed.reason === 'held' ? CLOSE_CODES.ALREADY_CONNECTED : CLOSE_CODES.SERVICE_DEGRADED,
      claimed.reason === 'held'
        ? 'this session already has an active connection'
        : 'could not confirm session exclusivity',
    );
    return;
  }

  /*
   * TENTH GATE: THE TRANSCRIPT MUST NEVER RESTART AT ZERO.
   *
   * `tutor_turns` is unique on `(session_id, seq)` and written with
   * `resolution=ignore-duplicates`, so a second row claiming a seq that
   * already exists is discarded IN SILENCE — the "a guardian cannot read what
   * their child said" failure this file has now fixed three times, each time
   * through a different door. The third door was topology: at N>1 a reconnect
   * landing on a replica with no local park had no way to know this session
   * had ever written a row, so it started at 0 and every row after it
   * collided.
   *
   * The floor closes that door for good, and deliberately does NOT depend on
   * the park record surviving. A park can legitimately be absent — it expired,
   * the parking process crashed or was redeployed, or it was never published
   * because a graceful close was already in flight — and in every one of those
   * cases the transcript must still continue. The floor is raised per row by
   * whichever replica wrote it, so it is the one fact that outlives all of
   * them.
   *
   * FAILS CLOSED, matching this file's other shared-store call site verbatim:
   * `{ seq: 0 }` and "could not ask" are different answers, and treating the
   * second as the first is exactly the §1.14 defaulting-on-an-unconfirmed-read
   * shape (`getLearningStatsForUpdate` erasing a child's XP) — here it would
   * silently destroy a transcript instead. It costs nothing that was not
   * already lost: a socket only reaches this line by ACQUIRING the claim
   * above, which itself fails closed on the same store, so the conditions
   * under which this refuses are conditions under which the connection was
   * already being refused one gate earlier.
   */
  const floor = await readTranscriptFloor(session.sessionId);
  if (!floor.ok) {
    await releaseLock(lockKey, claimed.owner);
    console.warn(
      `[oracle] session ${session.sessionId}: refusing the socket — could not read the transcript floor, ` +
        `and starting a transcript that may collide with rows already written is silent data loss.`,
    );
    socket.close(CLOSE_CODES.SERVICE_DEGRADED, 'could not confirm transcript continuity');
    return;
  }

  // A parked orchestrator for this session means this socket is a RESUME:
  // same history, same budget clock, same paid-speech memo. Every gate above
  // already re-ran against a fresh token and a fresh Core context.
  //
  // TWO places it can be parked, checked cheapest first. The local map is a
  // same-replica reconnect — the overwhelmingly common case, and a
  // full-fidelity one, since it hands back the very objects the last socket
  // was using. The shared record (`adoptParkedSession`) is the cross-replica
  // case: the same conversation, rebuilt from a versioned snapshot, with a
  // freshly constructed `Synthesizer` because a closure cannot travel between
  // processes.
  const resumed: ResumedSession | null =
    takeParked(session.sessionId) ?? (await adoptParkedSession(session.sessionId));
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
    /*
     * The HIGHER of what this park remembers and what the shared floor has
     * seen — never either one alone.
     *
     * The park is the more informative number when it exists, but it can be
     * stale by a row or two (the floor is raised on every write; a park record
     * is written once, at drop). The floor is authoritative about what has
     * been WRITTEN but knows nothing about the conversation. Taking the max
     * means a resumed transcript continues past every row any replica has
     * ever written for this session, which is the only property that actually
     * has to hold.
     */
    transcriptSeq: Math.max(resumed?.transcriptSeq ?? 0, floor.seq),
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
      /*
       * RENEW, NEVER REVOKE. A failed renewal (a Redis blip mid-session)
       * deliberately does NOT close or otherwise punish this socket — the
       * lock's only job is refusing a SECOND connection at the door
       * (the SEVENTH GATE above), and this conversation already cleared that
       * gate once. Tearing down a healthy, ongoing session over a transient
       * renewal miss would trade a narrow, bounded exclusivity gap (another
       * connection attempt slipping through before the claim's TTL expires)
       * for a much worse, certain one (an active lesson cut off mid-turn) —
       * the wrong side of this file's own §1.0 cost accounting. Logged, not
       * silent, so a sustained outage is visible in the logs even though no
       * single session acts on it.
       */
      void renewLock(sessionLockKey(session.sessionId), live.lockOwner, SESSION_LOCK_TTL_MS).then((renewed) => {
        if (!renewed) console.warn(`[oracle] session ${session.sessionId}: could not renew the exclusivity claim`);
      });
    }, HEARTBEAT_INTERVAL_MS),
    lastPongAtMs: Date.now(),
    lastActivityAtMs: Date.now(),
    lockOwner: claimed.owner,
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
      /*
       * The socket died without a farewell. The session is PARKED, not ended:
       * a sleeping phone or a proxy timeout should cost the connection, never
       * the conversation. If nobody resumes inside the grace window, the park
       * finalizes it as `learner_left` — which is what will then be true —
       * and only then is the speech memo dropped.
       *
       * PARK, PUBLISH, *THEN* RELEASE THE CLAIM — and the order is the fix,
       * not an implementation detail (`RUNBOOK.md` Round 142's requirement 6).
       *
       * This used to release the claim FIRST and park afterwards, deliberately,
       * so a genuine resume need not wait out `SESSION_LOCK_TTL_MS`. At one
       * replica that was harmless. At N>1 it was the whole bug: a resuming
       * socket's only gate is the session claim, so releasing it before the
       * park was visible anywhere SHARED meant a reconnect could acquire
       * cleanly, find nothing parked, and build a SECOND orchestrator with
       * `transcriptSeq` back to 0 — every row then colliding in `tutor_turns`
       * and being dropped in silence — while this replica's park timer still
       * won the `ended_at=is.null` close, so the live replica's billed usage
       * never reached the ledger.
       *
       * Releasing LAST makes the guarantee positive rather than probabilistic:
       * anything that successfully acquires this session's claim is, by
       * construction, looking at a shared store where this park is already
       * published. The property the old ordering bought is kept — the claim is
       * still RELEASED rather than left to expire, so a genuine resume never
       * waits out the TTL — it just happens a few milliseconds later, and
       * those milliseconds are exactly what `acquireLock`'s own bounded retry
       * already absorbs (`lib/lock.ts`'s `RETRY_DELAY_MS`, which exists for
       * this same just-closed-socket race).
       *
       * `.finally` rather than `.then`: a publish that throws must still
       * release the claim, or a failed snapshot would strand this session
       * behind a claim nobody holds until its TTL expires.
       */
      const entry = parkSession(session.sessionId, live);
      void publishPark(session.sessionId, entry).finally(() => {
        void releaseLock(sessionLockKey(session.sessionId), live.lockOwner);
      });
    } else {
      live.speech.memo.clear();
      /*
       * A graceful close has nothing to publish and nothing to hand over, so
       * the claim goes immediately — the ordering above buys nothing here.
       * Fire-and-forget: a `close` event handler cannot make its emitter await.
       */
      void releaseLock(sessionLockKey(session.sessionId), live.lockOwner);
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
      const wireBoard = toWireWhiteboard(snapshot.lastTurn.turn.whiteboard);
      send(socket, {
        type: 'turn',
        seq: snapshot.lastTurn.seq,
        say: snapshot.lastTurn.turn.say,
        emotion: snapshot.lastTurn.turn.emotion,
        action: snapshot.lastTurn.turn.action,
        roleplayScene: snapshot.lastTurn.turn.roleplayScene ?? null,
        pointAt: snapshot.lastTurn.turn.pointAt ?? null,
        audioUrl: null,
        // No `turn_audio` follows a resume redraw (see the comment above) —
        // the client must not wait for one, or hold hands-free listening
        // closed forever.
        audioPending: false,
        next: snapshot.lastTurn.turn.next === 'close' ? 'ask' : snapshot.lastTurn.turn.next,
        ...(wireBoard !== null ? { whiteboard: wireBoard } : {}),
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
  /*
   * Captured ONCE, used for both the wire send below and the persisted
   * transcript row further down — the same object either way, never
   * recomputed a second time for storage. Found by adversarial review,
   * round 35 (2026-08-30, HIGH): this board reached the learner's screen
   * and nowhere else, so replay and the guardian transcript viewer lost it
   * silently.
   */
  const wireBoard: WireWhiteboard | null = toWireWhiteboard(emission.turn.whiteboard);
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
    ...(emission.turn.roleplayScene ? { roleplayScene: emission.turn.roleplayScene } : {}),
    ...(emission.turn.pointAt != null ? { pointAt: emission.turn.pointAt } : {}),
  });

  /*
   * The row number is claimed HERE, not inside the callback below. The write
   * itself still waits for synthesis so it can record where the audio lives,
   * but numbering it there would order the transcript by whichever clip
   * finished first — putting the learner's next line ahead of the tutor reply
   * it was answering, in the record a guardian reads.
   */
  const tutorRowSeq = nextTranscriptSeq(live);

  void emission.audio.then(({ url: audioUrl, wordTimings }) => {
    send(live.socket, {
      type: 'turn_audio',
      seq: emission.seq,
      audioUrl,
      // Omitted rather than sent `null`/`[]` — see this field's own comment
      // on `ws/protocol.ts`. Never persisted: `wordTimings` is live-playback
      // metadata for the clip currently in the learner's speaker, not
      // conversation content, and a resume redraw already sends no
      // `turn_audio` at all (the comment above `audioUrl: null` on the
      // resume path), so there is nothing to replay it FROM even if it were.
      ...(wordTimings && wordTimings.length > 0 ? { wordTimings } : {}),
    });
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
      // Tutor v3's tray-demonstration steps, the same ones just sent on the
      // wire frame above — migration 0067 closes the exact gap round 35
      // found for `whiteboard`: unpersisted, this animation existed only for
      // the length of the live socket and vanished from replay and from the
      // guardian transcript viewer the instant the session ended.
      demonstrate: emission.turn.demonstrate ?? null,
      savePlan: emission.turn.savePlan,
      roleplayScene: emission.turn.roleplayScene ?? null,
      pointAt: emission.turn.pointAt ?? null,
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
   * ALWAYS fires here, even when `closeOutcome === 'already-closed'` above —
   * this call's own snapshot is the MORE complete one in exactly that race:
   * this function only reaches this point after the busy turn ahead of the
   * farewell has settled, while `finalizeParked`'s own snapshot (when it
   * wins that race) is taken mid-turn, missing exactly the reply this
   * function is closing out. Round 98 found this and correctly declined to
   * suppress it — running both was a real, avoidable extra model call
   * (§1.0's "directly" cost), but suppressing THIS one would have kept only
   * the stale review as this session's lasting memory, which is worse.
   *
   * Item 71 closes that follow-up on the OTHER side: `finalizeParked` now
   * checks `Live.endSessionRequested` (copied onto its `ParkedSession` entry
   * at park time) before it fires ITS OWN review — a guaranteed sign, by
   * construction of `releaseTurn`'s own `finally`-chain, that a call exactly
   * like this one is still coming — and defers to it instead of paying for a
   * redundant one on stale data. See `finalizeParked`'s own comment.
   */
  void runPostSessionReview({
    session: live.session,
    history: live.orchestrator.resumeSnapshot.turns,
  }).catch((error) =>
    console.warn('[oracle] post-session review crashed:', error instanceof Error ? error.message : error),
  );

  /*
   * V4 harness backlog: TRAJECTORY EMISSION. Unlike the review just above,
   * firing this unconditionally (even when `finalizeParked` already ran it
   * once) is never a double cost worth avoiding: this batch is per-row
   * idempotent on (session_id, turn_seq) — see migration 0065 — so a session
   * closed by both paths simply has its later, more-complete step log
   * insert its NEW rows while the overlapping ones no-op, rather than the
   * review's own "pick one whole replacement" dilemma.
   */
  void emitTutorTrajectory({
    sessionId: live.session.sessionId,
    userId: live.session.userId,
    steps: live.orchestrator.trajectorySteps,
  }).catch((error) =>
    console.warn('[oracle] trajectory emission crashed:', error instanceof Error ? error.message : error),
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

/**
 * Lets index.ts shut the socket layer down without importing `ws` itself.
 *
 * `oracle/AGENTS.md` item 79 / `RUNBOOK.md` Round 119 point 5: a `ws` socket's
 * `close` EVENT — the thing that calls `parkSession`, a few hundred lines up
 * — fires once the closing handshake actually completes, which is NOT
 * synchronous with `.close()` being called below. The OLD version of this
 * function called `client.close()` on everything and then, in the SAME
 * synchronous breath, finalized every ALREADY-parked session — which only
 * ever caught sessions parked from an EARLIER drop. A session still live at
 * the exact moment `SIGTERM` arrived had nothing in `parkedSessions` yet, so
 * it was silently abandoned: neither parked (its socket had not finished
 * closing) nor closed (`finalizeAllParked` had already run and returned) —
 * and by the time that socket's own `close` event might eventually have
 * fired, `index.ts`'s `shutdown()` had already called `process.exit(0)`.
 * Core's ledger kept that session open (`ended_at IS NULL`) forever, with no
 * process left that would ever call `closeSession` for it.
 *
 * Fixed by doing, SYNCHRONOUSLY and up front, exactly what each of those
 * sockets' own `close` handler would eventually have done anyway: park every
 * session that is still live right now, directly from its in-memory `Live`
 * object, and release its exclusivity claim (item 79) immediately rather than
 * leaving it to expire on `SESSION_LOCK_TTL_MS` — freeing it for whichever
 * instance answers next during a rolling redeploy, without that instance
 * waiting out the claim's TTL first. `parkSession` is the SAME function an
 * ordinary dropped connection already uses; this is not a new code path, only
 * the existing one invoked from a place that cannot wait for an event to
 * fire, within the same bounded ~250ms grace period `index.ts`'s `shutdown()`
 * already budgets before it exits.
 */
export function closeAllSockets(wss: WebSocketServer): void {
  for (const live of [...liveSessions.values()]) {
    parkSession(live.session.sessionId, live);
    void releaseLock(sessionLockKey(live.session.sessionId), live.lockOwner);
    /*
     * Deleted here rather than left for the socket's own (still-pending)
     * `close` handler to do: a new connection attempt for this SAME session
     * landing back on THIS process in the ~250ms before `index.ts`'s
     * `shutdown()` calls `process.exit(0)` — a redeploy's load balancer
     * racing its own drain — would otherwise see a STALE `liveSessions.has()`
     * true and be wrongly refused as `ALREADY_CONNECTED`, even though the
     * distributed claim above has already been correctly released. The
     * eventual async `close` event still runs its own (now redundant, and
     * harmless — see `parkSession`'s "stale park" guard) delete/park; nothing
     * here depends on this running exactly once.
     */
    liveSessions.delete(live.session.sessionId);
  }
  for (const client of wss.clients) {
    client.close(CLOSE_CODES.NORMAL, 'server shutting down');
  }
  /*
   * Every session parked above (by THIS shutdown) or already parked earlier
   * (an ordinary dropped connection still inside its resume grace window) is
   * finalized NOW rather than waiting out `SESSION_RESUME_GRACE_MS` — there
   * is no process left for anyone to resume into once this one exits.
   * `'abandoned'` ("The connection dropped and was never resumed" —
   * `tutor.json`'s existing, already-translated guardian copy for exactly
   * this reason) is accurate here in a way the park's own default,
   * `learner_left`, is not: nobody chose to leave: the deploy pulled the
   * socket out from under them.
   */
  finalizeAllParked('abandoned');
  wss.close();
}
