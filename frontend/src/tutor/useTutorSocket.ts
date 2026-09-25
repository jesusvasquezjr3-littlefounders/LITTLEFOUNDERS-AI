import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Adaptation,
  BudgetState,
  ClientMessage,
  ServerMessage,
  SessionClosingSummary,
  TutorWhiteboardWire,
  WordTiming,
} from './types';
import type { CharacterAction, CharacterEmotion } from '@/components/characters/control/types';

/*
 * The live session, as a hook.
 *
 * ONE SOCKET, ONE SESSION, NO RECONNECT — and that last part is deliberate.
 * The token Core minted is single-use and expires in sixty seconds, so a
 * reconnect could not authenticate even if we tried; and a tutoring session
 * that silently resumes after a dropped connection would replay a greeting
 * into the middle of a lesson. A dropped socket ends the session, honestly,
 * and the learner starts a new one.
 *
 * The hook exposes STATE, not a stream. React components should re-render on
 * "the tutor is saying this now", not manage message plumbing.
 */

export interface TutorTurnState {
  seq: number;
  text: string;
  emotion: CharacterEmotion;
  action: CharacterAction;
  audioUrl: string | null;
  /**
   * False the instant this turn's audio question is settled — either a real
   * clip arrived via `turn_audio`, or the server said up front none is coming
   * (a resume redraw). True in the gap between this turn's TEXT landing and
   * that answer. `audioUrl !== null` alone cannot tell "still coming" apart
   * from "never coming", and `useHandsFreeTurn` needs exactly that
   * distinction to know when it is safe to open the microphone again.
   */
  audioPending: boolean;
  /**
   * Word-level timing for `audioUrl`, or `null` when this clip has none —
   * the common case today (ORACLE.md §19.5): absent on every path except a
   * fresh synthesis from a voice-provider model that actually returned it.
   * Reset to `null` on every new `turn`, same as `audioUrl` itself, so a
   * highlight can never survive into the WRONG line.
   */
  wordTimings: WordTiming[] | null;
  next: 'ask' | 'segment' | 'close';
  /**
   * v3 turn policy, per pedagogical strategy. `idleNudgeMs` is how long to let
   * a learner think before a nudge; `listenSilenceMs` is how much silence,
   * after they have spoken, ends their turn. Null while the brain is dormant,
   * and the client then uses its own patient defaults rather than zero.
   */
  policy: { idleNudgeMs: number; listenSilenceMs: number } | null;
  /** v3: tray demonstration steps to animate concurrently with the speech. */
  demonstrate: import('./types').TrayDemoStep[] | null;
  /**
   * V4: a live whiteboard synced to this turn's story — SERVER-COMPUTED
   * fields included. Null when this turn draws no board at all.
   */
  whiteboard: TutorWhiteboardWire | null;
  /**
   * Class III / S17 (TUTOR_INSTRUMENTS.md §3.4): a pre-authored roleplay
   * scene this turn started, by id — see `tutor/roleplay/scenes.ts`. Null
   * on every ordinary turn.
   */
  roleplayScene: string | null;
  /**
   * Class III `point_at` (2026-09-04): which element of `whiteboard` the
   * `action: "point"` gesture reaches for, as a plain array index. Null on
   * every turn whose action is not `point`, or that named no target.
   */
  pointAt: number | null;
}

export interface LiveSegmentState {
  segmentId: string;
  seq: number;
  origin: 'catalog' | 'bank' | 'live';
  segment: Record<string, unknown>;
  scoresXp: boolean;
  framing: string;
}

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'failed';

/*
 * A CLOSE CODE IS A NUMBER. A CHILD NEEDS A SENTENCE.
 *
 * This used to emit `SOCKET_${event.code}` — `SOCKET_1006`, `SOCKET_4001` —
 * straight into the error channel, where `ConversationView` looked it up as
 * `errors.api.SOCKET_1006`, found nothing, and fell back to the generic
 * "something went wrong on our side". Every distinct failure, from an expired
 * token to a dropped Wi-Fi connection, arrived at the learner as that one
 * sentence, and it is the sentence the owner reported seeing.
 *
 * Mapping to a CLOSED vocabulary here is what makes the copy translatable:
 * numbers are unbounded, these seven are not, and every one of them has a real
 * line in all three locales. The numeric code is not lost — it travels in
 * `message`, which is logged and never rendered.
 */
export type CloseReasonCode =
  | 'SESSION_EXPIRED'
  | 'SESSION_NOT_FOUND'
  | 'CONSENT_REQUIRED'
  | 'BUDGET_EXHAUSTED'
  | 'ALREADY_CONNECTED'
  | 'SERVICE_DEGRADED'
  | 'CONNECTION_LOST';

export function closeCodeToReason(code: number): CloseReasonCode {
  switch (code) {
    case 4001:
      return 'SESSION_EXPIRED';
    case 4003:
      return 'CONSENT_REQUIRED';
    case 4004:
      return 'SESSION_NOT_FOUND';
    case 4008:
      return 'BUDGET_EXHAUSTED';
    /*
     * A second tab or device with the same conversation open. Oracle refuses
     * the SECOND socket outright (2026-08-29, adversarial review) rather than
     * silently running two parallel, independently-budgeted sessions — which
     * is what happened before the server-side fix. The first socket is
     * untouched; only this later one sees this code.
     */
    case 4009:
      return 'ALREADY_CONNECTED';
    case 4013:
      return 'SERVICE_DEGRADED';
    /*
     * The platform-wide spend circuit breaker (/ORACLE.md §15.2 item 1) —
     * deliberately its OWN numeric code server-side (`CLOSE_CODES.
     * SPEND_CEILING`, `oracle/src/ws/protocol.ts`) so an operator's logs can
     * tell "cost control tripped" apart from "moderation is down" at a
     * glance, but mapped to the SAME learner-facing reason as 4013: a
     * business-side cost ceiling is not something to explain to a child, and
     * the honest, generic "try again soon" is the correct thing to tell them
     * either way.
     */
    case 4029:
      return 'SERVICE_DEGRADED';
    /*
     * 1006 is the one that matters most in the field: "closed abnormally, no
     * close frame" — a dropped connection, a sleeping phone, a proxy timeout.
     * It is not a server fault and must not be described as one.
     */
    default:
      return 'CONNECTION_LOST';
  }
}

export interface TutorSocket {
  connection: ConnectionState;
  /** The tutor's current line. Null before the first turn arrives. */
  turn: TutorTurnState | null;
  /** Every turn so far, for the on-screen transcript (deaf accessibility). */
  history: { speaker: 'learner' | 'tutor'; text: string; seq: number }[];
  segment: LiveSegmentState | null;
  /** V4: the lesson thread — child-facing topic + step N of M; null in open chat. */
  lesson: { topic: string | null; step: number; of: number } | null;
  budget: BudgetState;
  remainingMs: number;
  microphone: boolean;
  /**
   * Whether THIS live socket has observed a guardian revoke consent — a
   * persistent fact about the session, unlike the transient `error` banner.
   * See the `micRevoked` state's own comment in this hook's body.
   */
  micRevoked: boolean;
  intelDegraded: boolean;
  adaptationOffer: Adaptation | null;
  /** C.8/C.12: the Mentor's last turn asked "stop here, or one more?" and is waiting for the choice. */
  sessionEndOffer: boolean;
  /** C.16: how the session ended (the closing script), once the server says so. */
  closingSummary: SessionClosingSummary | null;
  /** C.19: the Mentor's last turn was the check-in ("are we on the same page?") and waits for an answer. */
  checkInOpen: boolean;
  /** C.15: the Mentor's last turn restated the session goal and waits for "yes" or "something else". */
  goalCheckOpen: boolean;
  closedReason: string | null;
  error: { code: string; message: string } | null;
  /**
   * The server said it is producing a reply. Authoritative — set by the
   * `thinking` frame the moment the turn slot is claimed, cleared by the turn
   * arriving (or by an error, or by the learner interrupting). The UI's own
   * optimistic spinner covers only the send→ack gap.
   */
  thinking: boolean;
  sendText: (text: string) => void;
  sendAudio: (audio: Blob) => Promise<void>;
  /**
   * Streamed upload, for sending the clip WHILE the learner still holds the
   * button. Chunks auto-open the stream; `commitAudioStream` seals it and
   * starts transcription server-side, returning false when no stream was ever
   * opened (the caller then falls back to `sendAudio`). `abandonAudioStream`
   * walks away from a mis-tap — the server resets on the next begin.
   */
  streamAudioChunk: (chunk: Blob, mimeType: string) => void;
  commitAudioStream: () => boolean;
  abandonAudioStream: () => void;
  /** The learner cut in: stop the in-flight production server-side too. */
  interrupt: () => void;
  /**
   * Rephrase the learner's LAST message. The working history drops the pair it
   * replaces (their line and the tutor's answer) locally AND server-side; the
   * persisted transcript keeps everything, append-only.
   */
  editLast: (text: string) => void;
  reportGrade: (
    segmentId: string,
    score: number,
    correct: boolean,
    pedagogy?: { echo: string; attemptNumber: number },
  ) => void;
  answerAdaptation: (adaptation: Adaptation, accepted: boolean) => void;
  /** C.8/C.12: answer the stop-or-continue offer. Never sent unless an offer is open. */
  answerSessionEnd: (accepted: boolean) => void;
  /** C.19: answer the check-in on its chips. Never sent unless a check-in is open. */
  answerCheckIn: (aligned: boolean) => void;
  /** C.15: answer the goal restatement on its chips. Never sent unless the goal check is open. */
  answerGoal: (agreed: boolean) => void;
  endSession: () => void;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  // Chunked: String.fromCharCode(...bytes) blows the argument limit on
  // anything longer than a second or two of audio, and the failure is a
  // RangeError inside a promise nobody is watching.
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function useTutorSocket(socketUrl: string | null): TutorSocket {
  const socketRef = useRef<WebSocket | null>(null);
  /**
   * Messages sent while the handshake is still in flight, held here rather
   * than dropped. Found by an adversarial review, 2026-08-30 (CRITICAL): the
   * composer renders fully enabled the instant `phase` becomes 'conversing',
   * the same render that starts the handshake — there is no gate on
   * `connection === 'open'` anywhere in that path. `sendText` echoes the
   * learner's line into `history` immediately (by design, for perceived
   * responsiveness on a slow connection) and then called `send()`, which
   * silently no-opped because the socket was still CONNECTING. The learner's
   * answer appeared in their own transcript as delivered; the tutor never
   * received it and never replied, with nothing to tell them why. Flushed in
   * order the moment the socket opens; cleared on every new connection.
   */
  const pendingRef = useRef<ClientMessage[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [turn, setTurn] = useState<TutorTurnState | null>(null);
  const [history, setHistory] = useState<TutorSocket['history']>([]);
  const [segment, setSegment] = useState<LiveSegmentState | null>(null);
  const [budget, setBudget] = useState<BudgetState>('running');
  const [remainingMs, setRemainingMs] = useState(0);
  const [microphone, setMicrophone] = useState(false);
  /**
   * Whether THIS live socket has observed a guardian revoke consent —
   * unlike `error`, this never clears itself on the next turn. Found by
   * adversarial review, round 30 (2026-08-30, LOW-MEDIUM): `TutorExperience`
   * computed the mic's blocked reason from `session.microphoneBlockedBy`, a
   * value fixed once at session creation and never updated after a live
   * revocation — so once the transient `CONSENT_REVOKED` error banner was
   * cleared by the tutor's own next (scripted) reply, the mic-off message
   * fell back to the generic "voice unavailable" copy instead of "a grown-up
   * needs to turn the microphone on for you," for the rest of the session.
   */
  const [micRevoked, setMicRevoked] = useState(false);
  const [intelDegraded, setIntelDegraded] = useState(false);
  const [adaptationOffer, setAdaptationOffer] = useState<Adaptation | null>(null);
  const [sessionEndOffer, setSessionEndOffer] = useState(false);
  const [closingSummary, setClosingSummary] = useState<SessionClosingSummary | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [goalCheckOpen, setGoalCheckOpen] = useState(false);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [error, setError] = useState<TutorSocket['error']>(null);
  /** V4: the lesson thread the last turn carried; null in open chat. */
  const [lesson, setLesson] = useState<{ topic: string | null; step: number; of: number } | null>(null);
  const [thinking, setThinking] = useState(false);
  /**
   * The streamed-upload state, all refs: chunk encoding is async, so sends are
   * SERIALIZED on one promise chain — chunk N+1 must never overtake chunk N on
   * the wire just because it base64-encoded faster.
   */
  const streamOpenRef = useRef(false);
  const streamChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    /*
     * EVERY ONE OF THESE BELONGS TO ONE SESSION, so every one of them is
     * cleared when the session changes — including when it changes to nothing.
     *
     * Only `connection` used to be reset here, and that single omission broke
     * "start another session" outright. The first session ends, `closedReason`
     * is set, the experience moves to the closing phase. The learner presses
     * start again, a second socket opens, and the watcher upstream reads a
     * `closedReason` that is STILL the first session's: the brand new
     * conversation is declared over before its greeting arrives. The stale
     * transcript came with it, so the second session also inherited the first
     * one's history.
     *
     * It cannot be worked around from the caller either, because a guard that
     * ignores a stale reason cannot tell it apart from a genuine close. The
     * reset has to be here, where the identity of the session is known.
     */
    setTurn(null);
    setHistory([]);
    setSegment(null);
    setBudget('running');
    setRemainingMs(0);
    setMicrophone(false);
    setIntelDegraded(false);
    setAdaptationOffer(null);
    setSessionEndOffer(false);
    setClosingSummary(null);
    setCheckInOpen(false);
    setGoalCheckOpen(false);
    setClosedReason(null);
    setError(null);
    setThinking(false);
    streamOpenRef.current = false;
    streamChainRef.current = Promise.resolve();
    pendingRef.current = [];
    setConnection('connecting');

    if (!socketUrl) return;

    /*
     * THE ACTUAL CONNECTION IS DEFERRED ONE MICROTASK, and that is
     * load-bearing rather than stylistic — see RUNBOOK.md Round 81/82.
     * React 18 StrictMode's dev-only mount -> cleanup -> mount runs
     * entirely SYNCHRONOUSLY (verified directly against this codebase's own
     * React version: a dependency that is already non-null on a component's
     * very first render gets its effect set up, torn down and set up again
     * before a microtask can ever run), so scheduling the real
     * `new WebSocket(...)` here instead of inline lets a DISCARDED run's own
     * cleanup flip `cancelled` before this callback ever executes — the
     * discarded run's socket is never constructed, and Oracle's server never
     * sees a second, redundant connection attempt with the same single-use
     * token at all.
     *
     * Before this, whenever two runs of this effect DID both reach `new
     * WebSocket(...)` — confirmed live, instrumenting the real
     * `window.WebSocket` constructor during round 82's own reproduction —
     * BOTH opened a REAL socket against Oracle with the IDENTICAL session
     * token. `close()` on a socket that is still `CONNECTING` does not
     * reliably stop its handshake from completing (spec-permitted,
     * implementation-defined — round 82's own finding), so the discarded
     * run's socket could still finish connecting for real. Oracle's
     * single-use nonce ledger (`session/token.ts`) then lets whichever
     * socket's handshake the server processes FIRST claim the token and
     * deliver the whole conversation to it — while the SURVIVING run's own
     * socket (the one this hook's state actually listens through) gets its
     * connection refused as a replayed token and closed, unable to ever
     * receive the turn its own component is rendering for. Nothing about
     * WHICH of the two sockets wins that race is decided here, so this
     * cannot be patched by choosing to keep "the other one" instead — the
     * fix is that only ONE of them may ever be allowed to dial out.
     */
    let cancelled = false;
    let socket: WebSocket | null = null;
    let keepalive: number | undefined;

    queueMicrotask(() => {
      if (cancelled) return;

      const ws = new WebSocket(socketUrl);
      socket = ws;
      socketRef.current = ws;

      ws.onopen = () => {
        setConnection('open');
        // Flush anything sent while the handshake was still in flight, in the
        // order it was queued.
        const queued = pendingRef.current;
        pendingRef.current = [];
        for (const message of queued) ws.send(JSON.stringify(message));
      };

      /*
       * KEEPALIVE, at last — `ping` sat in the protocol union unsent, so any
       * proxy or sleeping phone that dropped an idle connection ended the
       * session. It also carries the honest budget back, keeping the on-screen
       * "minutes left" moving between turns.
       */
      keepalive = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage));
        }
      }, 45_000);

      ws.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }

        switch (message.type) {
          case 'ready':
            setMicrophone(message.microphone);
            // A fresh `ready` (a genuinely new session, or a resume) is a
            // clean slate: if consent is STILL revoked, the very next
            // per-turn consent recheck will observe that again and set this
            // right back to true, promptly.
            setMicRevoked(false);
            setIntelDegraded(message.intelDegraded);
            break;
          case 'turn':
            setTurn({
              seq: message.seq,
              text: message.say,
              emotion: message.emotion,
              action: message.action,
              audioUrl: message.audioUrl,
              audioPending: message.audioPending,
              // Null on delivery, same as `audioUrl` — a new turn's caption
              // must never highlight against the PREVIOUS line's timing.
              wordTimings: null,
              next: message.next,
              policy: message.policy ?? null,
              demonstrate: message.demonstrate ?? null,
              whiteboard: message.whiteboard ?? null,
              roleplayScene: message.roleplayScene ?? null,
              pointAt: message.pointAt ?? null,
            });
            setLesson(message.lesson ?? null);
            setHistory((prev) =>
              /*
               * On resume, the server's `history` frame ALREADY includes this
               * exact tutor line (it is the on-screen turn being redrawn), and
               * this `turn` frame re-delivers the same line right after it —
               * by design, so a fresh mount that never saw `history` still gets
               * the active turn. Appending unconditionally duplicated it in
               * `history`: invisible while `TutorTranscript`'s `spokenSeq`
               * filter still matched THIS seq, but printing the same sentence
               * twice in a row in the accessible transcript the moment the
               * NEXT turn changed which seq that filter hides. Found by an
               * adversarial review, 2026-08-30 (MEDIUM).
               */
              prev.at(-1)?.speaker === 'tutor' && prev.at(-1)?.seq === message.seq
                ? prev
                : [...prev, { speaker: 'tutor', text: message.say, seq: message.seq }],
            );
            // A new turn clears the previous error banner: the tutor recovering
            // is the signal that whatever went wrong is over.
            setError(null);
            setThinking(false);
            /*
             * A new turn also clears any adaptation offer from the PREVIOUS
             * turn. Found by adversarial review, round 34 (2026-08-30, HIGH):
             * an `adaptation_offer` frame is only ever sent when THAT turn's
             * `offerAdaptation` is truthy — there is no explicit "the offer is
             * gone now" frame — and the orchestrator's own notion of "the
             * currently valid offer" moves on with every produced turn. Left
             * uncleared, the UI could keep presenting a stale offer as a
             * full-attention moment (composer hidden) after the tutor had
             * already moved the conversation forward; tapping it then looked
             * like it worked (the card clears optimistically) while the
             * orchestrator silently refused it and the tutor never remarked.
             * Safe to clear unconditionally here because the server always
             * sends `turn` BEFORE any `adaptation_offer` for the SAME emission
             * (`ws/server.ts`'s `deliver()`) — a fresh offer for this exact
             * turn arrives right after and re-sets it via its own case below.
             */
            setAdaptationOffer(null);
            // C.8/C.12: the same rule for the stop-or-continue offer — the
            // server sends `session_end_offer` right AFTER the turn that asks
            // it, so a new turn without one means the question has moved on.
            setSessionEndOffer(false);
            // C.19: likewise the check-in — `check_in` follows the turn
            // that asks it, so any new turn closes the chips first.
            setCheckInOpen(false);
            // C.15: and the goal chips — `goal_check` follows its own turn.
            setGoalCheckOpen(false);
            break;
          case 'turn_audio':
            // The voice catching up with its own turn. A stale seq is a clip for
            // a line the conversation has already moved past — dropped, so a slow
            // synthesis can never talk over a newer turn.
            setTurn((prev) =>
              prev && prev.seq === message.seq
                ? { ...prev, audioUrl: message.audioUrl, audioPending: false, wordTimings: message.wordTimings ?? null }
                : prev,
            );
            break;
          case 'thinking':
            setThinking(true);
            break;
          case 'history':
            // A resumed session redrawing the transcript the reconnect reset.
            // REPLACES rather than appends: the server's copy is the authority
            // on what was said before this socket existed.
            setHistory(message.turns.map((t) => ({ speaker: t.speaker, text: t.text, seq: t.seq })));
            break;
          case 'transcript':
            setHistory((prev) => [...prev, { speaker: 'learner', text: message.text, seq: -1 }]);
            break;
          case 'segment':
            setSegment({
              segmentId: message.segmentId,
              seq: message.seq,
              origin: message.origin,
              segment: message.segment,
              scoresXp: message.scoresXp,
              framing: message.framing,
            });
            break;
          case 'adaptation_offer':
            setAdaptationOffer(message.adaptation);
            break;
          case 'session_end_offer':
            setSessionEndOffer(true);
            break;
          case 'check_in':
            setCheckInOpen(true);
            break;
          case 'goal_check':
            setGoalCheckOpen(true);
            break;
          case 'session_closing':
            setClosingSummary({ script: message.script, effort: message.effort, topic: message.topic });
            setSessionEndOffer(false);
            setCheckInOpen(false);
            setGoalCheckOpen(false);
            break;
          case 'state':
            setBudget(message.budget);
            setRemainingMs(message.remainingMs);
            break;
          case 'closed':
            setClosedReason(message.reason);
            setThinking(false);
            break;
          case 'error':
            setError({ code: message.code, message: message.message });
            // An error frame ends whatever wait it interrupted: a spinner that
            // outlives its turn is the stuck state this flag exists to prevent.
            setThinking(false);
            if (message.code === 'CONSENT_REVOKED') {
              setMicrophone(false);
              setMicRevoked(true);
            }
            break;
        }
      };

      ws.onerror = () => setConnection('failed');
      ws.onclose = (event) => {
        /*
         * THE CLOSE EVENT CARRIES THE REASON, AND IT WAS BEING THROWN AWAY.
         *
         * Oracle closes with meaningful codes — 4001 unauthorized, 4004 session
         * not found, 4003 service degraded — and every one of them arrived here
         * as an undifferentiated 'closed'. The `error` field was only ever
         * populated from a server error FRAME, which by definition never arrives
         * when the handshake itself fails, so a socket that never opened and a
         * conversation that ended normally were indistinguishable to the UI.
         *
         * 1000 and 1005 are the normal endings (explicit and "no status"), and a
         * close AFTER the server said goodbye is expected — neither is a fault.
         */
        const clean = event.code === 1000 || event.code === 1005;
        setConnection((prev) => (prev === 'failed' ? 'failed' : 'closed'));

        /*
         * THE CLOSE EVENT'S OWN `reason` IS THE FALLBACK FOR `closedReason`,
         * and without it the single most important screen in this product
         * showed the wrong words.
         *
         * FOUND LIVE, 2026-09-02, playing a low-retention child: after the
         * safety classifier caught an indirect self-harm disclosure, the
         * database recorded `close_reason: 'safety_stop'` and the goodbye
         * screen still read "¡Nos vemos pronto! Guardada. Puedes escucharla
         * cuando quieras." — the cheerful completion copy, seconds after the
         * tutor had told a child to go find a trusted adult.
         *
         * The mechanism, and every part of it was already correct except this
         * one: Oracle sends `{type:'closed', reason}` and then IMMEDIATELY
         * calls `socket.close(code, reason)` (`ws/server.ts`). Meanwhile
         * `TutorExperience` enters the closing phase on
         * `closedReason !== null || connection === 'closed'` — either one. So
         * when the close beats the frame, the phase flips with `closedReason`
         * still null, and `ClosingInWorld`'s safety branch — which exists, is
         * correct, and has its own passing test — is simply never reached.
         * Nothing was broken; one of two racing paths carried the fact and the
         * other did not.
         *
         * `event.reason` carries the same string because the server passes it
         * as `close()`'s second argument, so this needs no protocol change.
         * `prev ?? …` because a frame that DID arrive is the authority — this
         * only fills a hole, and must never overwrite what the socket said.
         */
        if (event.reason) setClosedReason((prev) => prev ?? event.reason);
        if (!clean) {
          /*
           * THE COMMENT BELOW SAID "ALWAYS LOGGED" AND NOTHING EVER LOGGED IT.
           * Found live, testing as a real logged-in kid account, 2026-08-30
           * (MEDIUM): this whole file has zero `console.*` calls — confirmed
           * by grep — so a failed handshake (e.g. a `TUTOR_SESSION_SECRET`
           * mismatch between Core and Oracle, closing 4001 with reason
           * "session token bad_signature") surfaced to the UI as the generic
           * "the tutor is resting" line with NOTHING in the browser console to
           * diagnose it from — the exact gap that made this specific incident
           * slower to root-cause than it needed to be.
           */
          console.error(`[tutor] socket closed ${event.code}: ${event.reason || '(no reason given)'}`);
          setError((prev) =>
            prev ?? {
              code: closeCodeToReason(event.code),
              // The raw code stays in `message` — never shown, always logged.
              message: event.reason || `socket closed ${event.code}`,
            },
          );
        }
      };
    });

    return () => {
      // Cancel a still-pending deferred construction (the StrictMode-discarded
      // run, or any other cleanup that fires before the microtask above ever
      // executes): `socket` stays null, so there is nothing below to close and
      // — the whole point — `new WebSocket()` for THIS run never happens.
      cancelled = true;
      if (keepalive !== undefined) window.clearInterval(keepalive);
      if (socket) {
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, 'component unmounted');
        }
      }
      socketRef.current = null;
    };
  }, [socketUrl]);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return;
    }
    /*
     * Queue rather than silently drop — see `pendingRef`'s own comment. This
     * now covers TWO waits, not one: `socket.readyState === CONNECTING` (the
     * original case), and `socket === null`, which did not used to be
     * reachable here (the socket was constructed synchronously, inline, in
     * the same effect pass that reset this queue) but now is — construction
     * is deferred one microtask past the connecting effect (see that
     * effect's own comment). Both are the identical wait from the caller's
     * side: a connection is coming, it just is not there yet. A socket that
     * is CLOSING or CLOSED is a real, terminal problem already surfaced
     * through `connection`/`error`; queuing there would just delay the same
     * silent loss, so those two states still fall through and drop.
     */
    if (!socket || socket.readyState === WebSocket.CONNECTING) pendingRef.current.push(message);
  }, []);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '') return;
      // Echo the learner's own words immediately. Waiting for the server to
      // confirm them makes typing feel broken on a slow connection, and unlike
      // speech there is nothing to mishear.
      setHistory((prev) => [...prev, { speaker: 'learner', text: trimmed, seq: -1 }]);
      send({ type: 'learner_text', text: trimmed });
    },
    [send],
  );

  const sendAudio = useCallback(
    async (audio: Blob) => {
      const base64 = await blobToBase64(audio);
      send({ type: 'learner_audio', audio: base64, mimeType: audio.type || 'audio/webm' });
    },
    [send],
  );

  /*
   * The streamed upload. Each chunk is enqueued on ONE promise chain so wire
   * order matches recording order regardless of how long each base64 encode
   * takes — and the commit rides the same chain, so it can never overtake the
   * bytes it seals.
   */
  const streamAudioChunk = useCallback(
    (chunk: Blob, mimeType: string) => {
      if (!streamOpenRef.current) {
        streamOpenRef.current = true;
        streamChainRef.current = streamChainRef.current.then(() => {
          send({ type: 'learner_audio_begin', mimeType: mimeType || 'audio/webm' });
        });
      }
      streamChainRef.current = streamChainRef.current.then(async () => {
        const base64 = await blobToBase64(chunk);
        send({ type: 'learner_audio_chunk', audio: base64 });
      });
    },
    [send],
  );

  const commitAudioStream = useCallback(() => {
    if (!streamOpenRef.current) return false;
    streamOpenRef.current = false;
    streamChainRef.current = streamChainRef.current.then(() => {
      send({ type: 'learner_audio_commit' });
    });
    return true;
  }, [send]);

  const abandonAudioStream = useCallback(() => {
    // A mis-tap. Nothing to send: the server resets an uncommitted assembly on
    // the next begin, and never transcribes what was never committed.
    streamOpenRef.current = false;
  }, []);

  const interrupt = useCallback(() => {
    setThinking(false);
    send({ type: 'interrupt' });
  }, [send]);

  const editLast = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '') return;
      setHistory((prev) => {
        // Mirror of the server's rewind: drop the trailing tutor reply (if
        // one landed) and the learner line it answered, then echo the new one.
        const next = [...prev];
        if (next.at(-1)?.speaker === 'tutor') next.pop();
        if (next.at(-1)?.speaker === 'learner') next.pop();
        return [...next, { speaker: 'learner', text: trimmed, seq: -1 }];
      });
      send({ type: 'learner_edit', text: trimmed });
    },
    [send],
  );

  const reportGrade = useCallback(
    (segmentId: string, score: number, correct: boolean, pedagogy?: { echo: string; attemptNumber: number }) => {
      // The panel clears as soon as the result is reported: the tutor's next
      // turn is a reaction to it, and leaving the answered activity on screen
      // makes the character look like they are talking about nothing.
      setSegment(null);
      send({
        type: 'segment_graded',
        segmentId,
        score,
        correct,
        // v3: the signed receipt, relayed verbatim — Oracle verifies it.
        ...(pedagogy ? { echo: pedagogy.echo, attemptNumber: pedagogy.attemptNumber } : {}),
      });
    },
    [send],
  );

  const answerAdaptation = useCallback(
    (adaptation: Adaptation, accepted: boolean) => {
      setAdaptationOffer(null);
      send({ type: 'adaptation_response', adaptation, accepted });
    },
    [send],
  );

  const answerSessionEnd = useCallback(
    (accepted: boolean) => {
      // Cleared at once so a double tap cannot send two answers; the server
      // refuses an answer to an offer that is no longer open anyway.
      setSessionEndOffer(false);
      send({ type: 'session_end_response', accepted });
    },
    [send],
  );

  const answerCheckIn = useCallback(
    (aligned: boolean) => {
      // Cleared at once so a double tap cannot send two answers; the server
      // refuses an answer to a check-in that is no longer open anyway.
      setCheckInOpen(false);
      send({ type: 'check_in_response', aligned });
    },
    [send],
  );

  const answerGoal = useCallback(
    (agreed: boolean) => {
      // Cleared at once so a double tap cannot send two answers; the server
      // refuses an answer to a goal check that is no longer open anyway.
      setGoalCheckOpen(false);
      send({ type: 'goal_response', agreed });
    },
    [send],
  );

  const endSession = useCallback(() => send({ type: 'end_session' }), [send]);

  return {
    connection,
    turn,
    history,
    segment,
    lesson,
    budget,
    remainingMs,
    microphone,
    micRevoked,
    intelDegraded,
    adaptationOffer,
    sessionEndOffer,
    closingSummary,
    checkInOpen,
    goalCheckOpen,
    closedReason,
    error,
    thinking,
    sendText,
    sendAudio,
    streamAudioChunk,
    commitAudioStream,
    abandonAudioStream,
    interrupt,
    editLast,
    reportGrade,
    answerAdaptation,
    answerSessionEnd,
    answerCheckIn,
    answerGoal,
    endSession,
  };
}
