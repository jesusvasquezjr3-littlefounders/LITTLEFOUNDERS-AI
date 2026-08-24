import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Adaptation,
  BudgetState,
  ClientMessage,
  ServerMessage,
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
  next: 'ask' | 'segment' | 'close';
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
    case 4013:
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
  budget: BudgetState;
  remainingMs: number;
  microphone: boolean;
  intelDegraded: boolean;
  adaptationOffer: Adaptation | null;
  closedReason: string | null;
  error: { code: string; message: string } | null;
  sendText: (text: string) => void;
  sendAudio: (audio: Blob) => Promise<void>;
  reportGrade: (segmentId: string, score: number, correct: boolean) => void;
  answerAdaptation: (adaptation: Adaptation, accepted: boolean) => void;
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
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [turn, setTurn] = useState<TutorTurnState | null>(null);
  const [history, setHistory] = useState<TutorSocket['history']>([]);
  const [segment, setSegment] = useState<LiveSegmentState | null>(null);
  const [budget, setBudget] = useState<BudgetState>('running');
  const [remainingMs, setRemainingMs] = useState(0);
  const [microphone, setMicrophone] = useState(false);
  const [intelDegraded, setIntelDegraded] = useState(false);
  const [adaptationOffer, setAdaptationOffer] = useState<Adaptation | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [error, setError] = useState<TutorSocket['error']>(null);

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
    setClosedReason(null);
    setError(null);
    setConnection('connecting');

    if (!socketUrl) return;

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => setConnection('open');

    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case 'ready':
          setMicrophone(message.microphone);
          setIntelDegraded(message.intelDegraded);
          break;
        case 'turn':
          setTurn({
            seq: message.seq,
            text: message.say,
            emotion: message.emotion,
            action: message.action,
            audioUrl: message.audioUrl,
            next: message.next,
          });
          setHistory((prev) => [...prev, { speaker: 'tutor', text: message.say, seq: message.seq }]);
          // A new turn clears the previous error banner: the tutor recovering
          // is the signal that whatever went wrong is over.
          setError(null);
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
        case 'state':
          setBudget(message.budget);
          setRemainingMs(message.remainingMs);
          break;
        case 'closed':
          setClosedReason(message.reason);
          break;
        case 'error':
          setError({ code: message.code, message: message.message });
          if (message.code === 'CONSENT_REVOKED') setMicrophone(false);
          break;
      }
    };

    socket.onerror = () => setConnection('failed');
    socket.onclose = (event) => {
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
      if (!clean) {
        setError((prev) =>
          prev ?? {
            code: closeCodeToReason(event.code),
            // The raw code stays in `message` — never shown, always logged.
            message: event.reason || `socket closed ${event.code}`,
          },
        );
      }
    };

    return () => {
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'component unmounted');
      }
      socketRef.current = null;
    };
  }, [socketUrl]);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
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

  const reportGrade = useCallback(
    (segmentId: string, score: number, correct: boolean) => {
      // The panel clears as soon as the result is reported: the tutor's next
      // turn is a reaction to it, and leaving the answered activity on screen
      // makes the character look like they are talking about nothing.
      setSegment(null);
      send({ type: 'segment_graded', segmentId, score, correct });
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

  const endSession = useCallback(() => send({ type: 'end_session' }), [send]);

  return {
    connection,
    turn,
    history,
    segment,
    budget,
    remainingMs,
    microphone,
    intelDegraded,
    adaptationOffer,
    closedReason,
    error,
    sendText,
    sendAudio,
    reportGrade,
    answerAdaptation,
    endSession,
  };
}
