import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgeBand } from '../../design/copyBudget';
import { MENTOR_CHARACTERS, type MentorCharacter } from '../../design/assets';
import { fetchLearnerRegister } from '../../learning/learnerRegister';
import { postAllianceCheck, type BondProxyAnswer } from '../allianceApi';
import { api } from '../session/coreApi';
import { micBlockedForOffers, micBlockedReason, narrowBlockedReason, primaryOpening } from '../session/mic';
import type { MicBlockedReason } from '../session/micForPhase';
import {
  getAgeCalibration, getOffers, getPreferences, resumeSession, saveAgeCalibration, savePreferences, startSession,
  type AgeCalibration, type StartSessionInput,
} from '../session/tutorApi';
import type { ClosingScript, EffortAct, StartedSession, TutorOffers, TutorPreferences } from '../session/types';
import { useHandsFreeTurn } from '../session/useHandsFreeTurn';
import { useMicrophone, type Microphone } from '../session/useMicrophone';
import { useTutorSocket, type TutorSocket } from '../session/useTutorSocket';

/*
 * The Mentor screen's session, as one controller (Frontend Bible 08; Block C).
 *
 * It keeps every server contract the legacy screen honoured, rewritten for the
 * rebuilt screen rather than imported from it (02 rule 23):
 *
 *   - bootstrap: preferences, openings, the C.1 age calibration and the B.23
 *     register are read before anything is offered; a failed preferences or
 *     openings read is "unavailable", never an invented default character;
 *   - the daily session limit (SESSION_LIMIT) is remembered for the learner's
 *     own calendar day, so a reload shows the same refusal instead of inviting
 *     chips (an echo only: Core stays the authority);
 *   - a reload mid-conversation resumes it (the session is kept for this tab),
 *     and a dropped connection is resumed quietly once;
 *   - a guided review accepted in a lesson (`?review=`) starts its weak-skill
 *     session once, when the day allows one;
 *   - the microphone exists only where Core's C.2 policy allows it (the offers
 *     before a session, the session's own answer after, a guardian's live
 *     revocation above both); hands-free listening opens only between turns and
 *     never while the learner is typing;
 *   - the wait for a reply has a ceiling, the learner can cut the Mentor off,
 *     and every server refusal is carried through as a code the screen words;
 *   - how the session ended (C.16) is captured before the socket is released,
 *     so the closing state shows the server's own script.
 *
 * Personalisation beyond the character, saved-conversation replay, the
 * learning map and the live activity renderers are not carried by this screen
 * yet (docs/rebuild/sprints/W2-MENTOR-STAGE.md, W2M.2 limitations).
 */

export type MentorPhase = 'loading' | 'unavailable' | 'calibration' | 'openings' | 'conversing' | 'closing';

export interface MentorClosing {
  sessionId: string | null;
  script: ClosingScript;
  effort: EffortAct | null;
  topic: string | null;
}

export interface MentorMic {
  /** Whether the microphone control exists on this screen right now (C.2). */
  present: boolean;
  /** Why it does not, when Core said so. */
  blockedBy: MicBlockedReason | null;
  denied: boolean;
  recording: boolean;
  microphone: Microphone;
}

export interface MentorSessionOptions {
  getToken: () => Promise<string | null>;
  userId: string | null;
  /** A guided review accepted in a lesson (`/tutor?review=<skill>`), already validated by the route. */
  reviewSkill: string | null;
}

const ACTIVE_SESSION = 'lf.tutor.activeSession.';
const SESSION_LIMIT_DAY = 'lf.tutor.sessionLimitDay.';
const REPLY_CEILING_MS = 25_000;
const END_GRACE_MS = 4_000;

const read = (storage: 'local' | 'session', key: string): string | null => {
  try { return (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key); } catch { return null; }
};
const write = (storage: 'local' | 'session', key: string, value: string | null) => {
  try {
    const target = storage === 'local' ? window.localStorage : window.sessionStorage;
    if (value === null) target.removeItem(key); else target.setItem(key, value);
  } catch { /* private mode or a blocked origin: never worth failing a session over */ }
};

/*
 * The calendar day the daily limit counts against, in the learner's own
 * timezone for their locale: the same boundary Core uses
 * (`backend/src/routes/tutor.ts` `startOfLocalDayIso`), floored to the second
 * so two reads on one day compare equal.
 */
const DAY_ZONE: Record<string, string> = { 'es-MX': 'America/Mexico_City', 'pt-BR': 'America/Sao_Paulo', 'en-US': 'America/New_York' };
export function startOfLocalDayIso(locale: string, now: Date = new Date()): string {
  const timeZone = DAY_ZONE[locale] ?? DAY_ZONE['es-MX'];
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(now).map((p) => [p.type, p.value])) as Record<string, string>;
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  const offset = asUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - offset).toISOString();
}

const isCharacter = (value: unknown): value is MentorCharacter => (MENTOR_CHARACTERS as readonly unknown[]).includes(value);

export function useMentorSession({ getToken, userId, reviewSkill }: MentorSessionOptions) {
  const [phase, setPhase] = useState<MentorPhase>('loading');
  const [attempt, setAttempt] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<TutorPreferences | null>(null);
  const [offers, setOffers] = useState<TutorOffers | null>(null);
  const [calibration, setCalibration] = useState<AgeCalibration | null>(null);
  const [calibrationSaving, setCalibrationSaving] = useState(false);
  const [calibrationError, setCalibrationError] = useState(false);
  const [ageBand, setAgeBand] = useState<AgeBand>('6-9');
  const [session, setSession] = useState<StartedSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [closing, setClosing] = useState<MentorClosing | null>(null);
  const [closedHistory, setClosedHistory] = useState<TutorSocket['history']>([]);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [replyTimedOut, setReplyTimedOut] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interruptedSeq, setInterruptedSeq] = useState<number | null>(null);
  const [resuming, setResuming] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [ending, setEnding] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const userRef = useRef(userId);
  userRef.current = userId;

  const socket = useTutorSocket(phase === 'conversing' ? (session?.socketUrl ?? null) : null);

  /* Bootstrap: every read the openings depend on, or an honest "unavailable". */
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    void (async () => {
      const auth = await getToken();
      if (cancelled) return;
      if (!auth) { setPhase('unavailable'); return; }
      setToken(auth);
      const [prefs, offered, calibrated, register] = await Promise.all([
        getPreferences(auth), getOffers(auth), getAgeCalibration(auth),
        fetchLearnerRegister((path, init) => api(path, { token: auth, method: init?.method, body: init?.body })),
      ]);
      if (cancelled) return;
      // The youngest register is the most protective reading when Core's is unknown (B.23).
      setAgeBand(register.status === 'ready' ? register.value.copy_band : '6-9');
      if (!prefs.data || !offered.data) { setPhase('unavailable'); return; }
      const { catalog: _catalog, personalized: _personalized, ...kept } = prefs.data;
      setPreferences(kept);
      setOffers(offered.data);
      setCalibration(calibrated.data);
      setCalibrationError(!!calibrated.error);
      setCalibrationSaving(false);
      if (!calibrated.data || calibrated.data.required) { setPhase('calibration'); return; }
      const today = startOfLocalDayIso(offered.data.locale);
      if (userRef.current && read('local', SESSION_LIMIT_DAY + userRef.current) === today) setStartError('SESSION_LIMIT');
      else if (userRef.current) write('local', SESSION_LIMIT_DAY + userRef.current, null);
      // A reload mid-conversation resumes it before any opening is shown.
      const stored = userRef.current ? read('session', ACTIVE_SESSION + userRef.current) : null;
      if (stored) {
        try {
          const previous = JSON.parse(stored) as StartedSession;
          const resumed = await resumeSession(auth, previous.sessionId);
          if (cancelled) return;
          if (resumed.data) {
            setSession({ ...previous, socketUrl: resumed.data.socketUrl, socketExpiresAt: resumed.data.socketExpiresAt });
            setPhase('conversing');
            return;
          }
        } catch { /* malformed record: a fresh start */ }
        if (userRef.current) write('session', ACTIVE_SESSION + userRef.current, null);
      }
      setPhase('openings');
    })();
    return () => { cancelled = true; };
  }, [getToken, attempt, userId]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const chooseCalibration = useCallback((tier: 1 | 2 | 3) => {
    setCalibrationSaving(true);
    setCalibrationError(false);
    void (async () => {
      const auth = await getToken();
      const result = auth ? await saveAgeCalibration(auth, tier) : null;
      setCalibrationSaving(false);
      if (!result?.data || result.data.required) { setCalibrationError(true); return; }
      setCalibration(result.data);
      setAttempt((n) => n + 1);
    })();
  }, [getToken]);

  const resetTurnState = () => { setInterruptedSeq(null); setAwaitingReply(false); setReplyTimedOut(false); };

  const begin = useCallback((input: StartSessionInput, firstText: string | null = null) => {
    if (!token || !calibration || calibration.required || starting) return;
    setStarting(true);
    setStartError(null);
    void startSession(token, input).then((result) => {
      setStarting(false);
      if (!result.data) {
        const code = result.error?.code ?? 'INTERNAL';
        setStartError(code);
        if (code === 'SESSION_LIMIT' && userRef.current) write('local', SESSION_LIMIT_DAY + userRef.current, startOfLocalDayIso(offers?.locale ?? 'es-MX'));
        return;
      }
      if (userRef.current) {
        write('local', SESSION_LIMIT_DAY + userRef.current, null);
        write('session', ACTIVE_SESSION + userRef.current, JSON.stringify(result.data));
      }
      resetTurnState();
      setClosing(null);
      setClosedHistory([]);
      setEnding(false);
      setPendingText(firstText);
      setSession(result.data);
      setPhase('conversing');
    });
  }, [token, calibration, starting, offers]);

  const voiceBlocked = offers ? micBlockedReason(offers.voiceAvailable, offers.microphoneBlockedBy) : 'VOICE_UNAVAILABLE';
  const start = useCallback((input: Omit<StartSessionInput, 'wantsVoice'>, firstText: string | null = null) =>
    begin({ ...input, wantsVoice: voiceBlocked === null }, firstText), [begin, voiceBlocked]);

  /* B.26 / OD-1: the guided review the learner accepted in a lesson starts once. */
  const reviewStarted = useRef(false);
  useEffect(() => {
    if (!reviewSkill || reviewStarted.current || session || phase !== 'openings' || !offers?.canStart || startError === 'SESSION_LIMIT') return;
    reviewStarted.current = true;
    begin({ intent: 'weak_skill', skillKey: reviewSkill, wantsVoice: false });
  }, [reviewSkill, session, phase, offers, startError, begin]);

  /* The question typed on the openings goes out once the Mentor has greeted. */
  useEffect(() => {
    if (phase !== 'conversing' || pendingText === null || socket.turn === null) return;
    socket.sendText(pendingText);
    setPendingText(null);
    setAwaitingReply(true);
  }, [phase, pendingText, socket.turn, socket]);

  /* The end of a conversation: resume a dropped link once, otherwise capture how it ended. */
  const resumeAttempted = useRef<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    if (phase !== 'conversing') return;
    const ended = socket.closedReason !== null || socket.connection === 'closed' || socket.connection === 'failed';
    if (!ended || resuming) return;
    const dropped = socket.closedReason === null && (socket.error === null || socket.error.code === 'CONNECTION_LOST');
    if (dropped && session && token && socket.history.length > 0 && resumeAttempted.current !== session.sessionId && !ending) {
      resumeAttempted.current = session.sessionId;
      const target = session.sessionId;
      setResuming(true);
      void resumeSession(token, target).then((result) => {
        if (result.data) {
          const fresh = result.data;
          setSession((prev) => (prev && prev.sessionId === fresh.sessionId ? { ...prev, socketUrl: fresh.socketUrl, socketExpiresAt: fresh.socketExpiresAt } : prev));
          return;
        }
        setResuming(false);
        if (sessionRef.current?.sessionId === target) {
          if (userRef.current) write('session', ACTIVE_SESSION + userRef.current, null);
          setClosing({ sessionId: target, script: 'interrupted', effort: null, topic: socket.lesson?.topic ?? null });
          setClosedHistory(socket.history);
          setPhase('closing');
        }
      });
      return;
    }
    if (userRef.current) write('session', ACTIVE_SESSION + userRef.current, null);
    if (socket.history.length === 0) { setPhase('unavailable'); return; }
    const summary = socket.closingSummary;
    const script: ClosingScript = summary?.script
      ?? (socket.closedReason === 'safety_stop' ? 'safety_stop' : ending ? 'learner_left' : 'interrupted');
    setClosing({ sessionId: session?.sessionId ?? null, script, effort: summary?.effort ?? null,
      topic: script === 'safety_stop' ? null : summary?.topic ?? socket.lesson?.topic ?? null });
    setClosedHistory(socket.history);
    setEnding(false);
    setPhase('closing');
  }, [phase, socket.closedReason, socket.connection, socket.error, socket.history, socket.closingSummary, socket.lesson, resuming, session, token, ending]);

  useEffect(() => { if (resuming && socket.connection === 'open') setResuming(false); }, [resuming, socket.connection]);

  /* The learner ends it: the Mentor still gets its closing; if the server never answers, the screen closes anyway. */
  const endSession = useCallback(() => {
    if (phase !== 'conversing') return;
    setEnding(true);
    socket.endSession();
  }, [phase, socket]);
  useEffect(() => {
    if (!ending || phase !== 'conversing') return undefined;
    const timer = window.setTimeout(() => {
      if (userRef.current) write('session', ACTIVE_SESSION + userRef.current, null);
      setClosing({ sessionId: sessionRef.current?.sessionId ?? null, script: 'learner_left', effort: null, topic: null });
      setClosedHistory(socket.history);
      setEnding(false);
      setPhase('closing');
    }, END_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [ending, phase, socket.history]);

  /* Turns, speech and the wait for a reply. */
  const turn = phase === 'conversing' ? socket.turn : null;
  const turnSeq = turn?.seq ?? 0;
  const interrupted = interruptedSeq !== null && interruptedSeq === turnSeq;
  const speechUrl = turn && !interrupted ? turn.audioUrl : null;
  useEffect(() => { setSpeaking(speechUrl !== null); }, [speechUrl, turnSeq]);
  useEffect(() => { setAwaitingReply(false); setReplyTimedOut(false); }, [turnSeq]);
  useEffect(() => { if (!socket.thinking && socket.error !== null) setAwaitingReply(false); }, [socket.thinking, socket.error]);
  useEffect(() => {
    if (!awaitingReply) return undefined;
    setReplyTimedOut(false);
    const timer = window.setTimeout(() => { setAwaitingReply(false); setReplyTimedOut(true); }, REPLY_CEILING_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingReply]);
  const onSpeechEnd = useCallback(() => setSpeaking(false), []);
  const onSpeechBlocked = useCallback((blocked: boolean) => { if (blocked) setSpeaking(false); }, []);

  const handleClip = useCallback((clip: Blob | null) => {
    if (!clip) { socket.abandonAudioStream(); return; }
    setAwaitingReply(true);
    if (!socket.commitAudioStream()) void socket.sendAudio(clip);
  }, [socket]);

  const microphone = useMicrophone(phase === 'conversing' && socket.microphone, { onAutoRelease: handleClip, onChunk: socket.streamAudioChunk });
  useHandsFreeTurn({
    enabled: phase === 'conversing' && socket.microphone && !hasDraft,
    speaking, awaitingReply,
    audioPending: !interrupted && (turn?.audioPending ?? false),
    policy: turn?.policy ?? null, turnSeq, microphone, onTurn: handleClip,
  });

  /* C.2: where the microphone may exist, from Core's answer for this learner. */
  const blockedBy: MicBlockedReason | null = phase === 'conversing' && session
    ? (socket.micRevoked ? 'CONSENT_REQUIRED' : narrowBlockedReason(session.microphoneBlockedBy) ?? (socket.microphone ? null : 'VOICE_UNAVAILABLE'))
    : offers ? micBlockedForOffers(offers) : 'VOICE_UNAVAILABLE';
  const mic: MentorMic = {
    present: blockedBy === null && (phase === 'openings' || phase === 'conversing'),
    blockedBy: phase === 'openings' || phase === 'conversing' ? blockedBy : null,
    denied: microphone.permission === 'denied',
    recording: microphone.recording,
    microphone,
  };

  const pressMic = useCallback(() => {
    if (phase === 'openings') {
      if (offers && offers.canStart && startError !== 'SESSION_LIMIT') begin({ ...primaryOpening(offers), wantsVoice: true });
      return;
    }
    if (phase !== 'conversing') return;
    if (microphone.recording) { void microphone.stop().then(handleClip); return; }
    if (speaking) {
      // Cut in: the voice stops here and the reply in production stops costing anything.
      setInterruptedSeq(turnSeq);
      setAwaitingReply(false);
      socket.interrupt();
    }
    void microphone.start();
  }, [phase, offers, startError, begin, microphone, handleClip, speaking, turnSeq, socket]);

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (phase === 'openings') {
      if (offers?.canAskOpen && offers.canStart && startError !== 'SESSION_LIMIT') start({ intent: 'open' }, trimmed);
      return;
    }
    if (phase !== 'conversing') return;
    if (speaking) { setInterruptedSeq(turnSeq); socket.interrupt(); }
    socket.sendText(trimmed);
    setAwaitingReply(true);
  }, [phase, offers, startError, start, speaking, turnSeq, socket]);

  /* 08 §8: the chosen character fills every Mentor slot; saved to Core before it is shown as chosen. */
  const chooseCharacter = useCallback(async (character: MentorCharacter): Promise<boolean> => {
    const auth = token ?? await getToken();
    if (!auth) return false;
    const result = await savePreferences(auth, { character });
    if (!result.data) return false;
    setPreferences(result.data);
    return true;
  }, [token, getToken]);

  const answerAlliance = useCallback(async (answer: BondProxyAnswer) => {
    const auth = token ?? await getToken();
    if (!auth || !closing?.sessionId) return 'failed' as const;
    return postAllianceCheck(auth, closing.sessionId, answer);
  }, [token, getToken, closing]);

  const character: MentorCharacter = useMemo(() => {
    const value = session?.character ?? preferences?.character;
    return isCharacter(value) ? value : 'rho';
  }, [session, preferences]);
  const scene = (session?.diorama ?? preferences?.diorama) === 'diorama-b' ? 'diorama-b' as const : 'diorama-a' as const;

  return {
    phase, ageBand, character, scene, known: preferences !== null,
    nickname: preferences?.nickname ?? null,
    offers, calibration, calibrationSaving, calibrationError,
    starting, startError, session,
    socket, turn, speechUrl, audioKey: turnSeq, speaking, awaitingReply, replyTimedOut, resuming, ending,
    history: phase === 'closing' ? closedHistory : socket.history,
    closing, mic,
    retry, chooseCalibration, start, begin, sendText, pressMic, endSession, chooseCharacter, answerAlliance,
    setHasDraft, onSpeechEnd, onSpeechBlocked,
  };
}

export type MentorSession = ReturnType<typeof useMentorSession>;
