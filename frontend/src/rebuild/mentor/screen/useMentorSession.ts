import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgeBand } from '../../design/copyBudget';
import { MENTOR_CHARACTERS, type MentorCharacter } from '../../design/assets';
import { fetchLearnerRegister } from '../../learning/learnerRegister';
import { postAllianceCheck, type BondProxyAnswer } from '../allianceApi';
import { api } from '../session/coreApi';
import { micBlockedForOffers, micBlockedReason, narrowBlockedReason, primaryOpening } from '../session/mic';
import type { MicBlockedReason } from '../session/micForPhase';
import {
  getAgeCalibration, getOffers, getPreferences, getTranscript, gradeSegment, keepBoard as keepBoardRequest, resumeSession, saveAgeCalibration, savePreferences, startSession,
  type AgeCalibration, type StartSessionInput,
} from '../session/tutorApi';
import type { ClosingScript, EffortAct, SessionNarrative, StartedSession, TutorCatalog, TutorOffers, TutorPreferences } from '../session/types';
import { MENTOR_STAGE_LIGHTS, type MentorStageLight } from '../MentorStage';
import { coreMentorData } from './mentorData';
import { plainText } from './liveActivityModel';
import type { ActivityGrade, ActivityOutcome } from './LiveActivity';
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
 *   - W2M.3: the learner's own island (T1a: companion, island, light,
 *     nickname, how the Mentor explains) is saved to Core before it is shown;
 *     a board is kept in the notebook by naming its turn, never its content;
 *     the learning map, the notebook and past conversations are read through
 *     one small interface (`mentorData.ts`).
 *
 *   - W2M.4 (T1c, T1d, OD-28): a live activity is graded by Core and its
 *     result reported to Oracle; the learner can change their last message,
 *     start over, and pressing end asks the recap question first (a second
 *     press leaves at once).
 */

export type MentorPhase = 'loading' | 'unavailable' | 'calibration' | 'openings' | 'conversing' | 'closing';

export interface MentorClosing {
  sessionId: string | null;
  script: ClosingScript;
  effort: EffortAct | null;
  topic: string | null;
  /** the learner's own closing summary, read once the session has closed. */
  summary: SessionNarrative | null;
  /** the XP this session earned, so the close can name it. */
  xp: number | null;
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
/**
 * OD-28 (M-04): the recap question waits this long for an answer, then the talk
 * closes as the learner asked. Mirrors Oracle's `RECAP_ANSWER_WAIT_MS` (`ws/server.ts`,
 * enforced on the heartbeat), so the screen and the server agree on the same wait.
 * A draft in the field or a reply on its way holds it.
 */
export const RECAP_ANSWER_WAIT_MS = 120_000;

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
  const [catalog, setCatalog] = useState<TutorCatalog | null>(null);
  const [personalized, setPersonalized] = useState(true);
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
  /** OD-28 (M-04): the turn on screen when the learner pressed end; the recap question is the next turn. */
  const [endPressSeq, setEndPressSeq] = useState<number | null>(null);
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
      const { catalog: offeredCatalog, personalized: chosen, ...kept } = prefs.data;
      setPreferences(kept);
      setCatalog(offeredCatalog ?? null);
      setPersonalized(chosen !== false);
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
      setEndPressSeq(null);
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
          setClosing({ sessionId: target, script: 'interrupted', effort: null, topic: socket.lesson?.topic ?? null, summary: null, xp: null });
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
      topic: script === 'safety_stop' ? null : summary?.topic ?? socket.lesson?.topic ?? null, summary: null, xp: null });
    setClosedHistory(socket.history);
    setEnding(false);
    setPhase('closing');
  }, [phase, socket.closedReason, socket.connection, socket.error, socket.history, socket.closingSummary, socket.lesson, resuming, session, token, ending]);

  useEffect(() => { if (resuming && socket.connection === 'open') setResuming(false); }, [resuming, socket.connection]);

  /*
   * the closing summary. One read of the learner's own session, so the
   * end screen can say what they worked on, what was tricky and how much XP —
   * not just a goodbye line. Never for a safety stop (no topic, no numbers).
   */
  const summaryRequested = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== 'closing' || !closing || closing.script === 'safety_stop') return;
    const id = closing.sessionId;
    if (!id || summaryRequested.current === id) return;
    summaryRequested.current = id;
    void (async () => {
      const auth = token ?? await getToken();
      if (!auth) return;
      const result = await getTranscript(auth, id);
      if (!result.data) return;
      setClosing((prev) => prev && prev.sessionId === id
        ? { ...prev, summary: result.data!.narrative, xp: result.data!.session.xpAwarded } : prev);
    })();
  }, [phase, closing, token, getToken]);

  /*
   * The learner ends it (OD-28, M-04): the first press asks the Mentor's recap
   * question, which keeps the session open for one answer; a second press
   * leaves at once with the completed close. If the server answers neither,
   * the screen closes anyway.
   */
  const endSession = useCallback(() => {
    if (phase !== 'conversing') return;
    setEnding(true);
    setEndPressSeq(socket.turn?.seq ?? 0);
    socket.endSession(true);
  }, [phase, socket]);
  const recapOpen = phase === 'conversing' && endPressSeq !== null && (socket.turn?.seq ?? 0) > endPressSeq;
  useEffect(() => { if (recapOpen && ending) setEnding(false); }, [recapOpen, ending]);
  const endRef = useRef(endSession);
  endRef.current = endSession;
  const recapSeq = recapOpen ? socket.turn?.seq ?? 0 : null;
  useEffect(() => {
    if (recapSeq === null || hasDraft || awaitingReply) return undefined;
    const timer = window.setTimeout(() => endRef.current(), RECAP_ANSWER_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [recapSeq, hasDraft, awaitingReply]);
  useEffect(() => {
    if (!ending || phase !== 'conversing') return undefined;
    const timer = window.setTimeout(() => {
      if (userRef.current) write('session', ACTIVE_SESSION + userRef.current, null);
      setClosing({ sessionId: sessionRef.current?.sessionId ?? null, script: 'learner_left', effort: null, topic: null, summary: null, xp: null });
      setClosedHistory(socket.history);
      setEnding(false);
      setPhase('closing');
    }, END_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [ending, phase, socket.history]);

  /* T1c "start over": the session closes at once (no recap question) and the openings come back, re-read for today. */
  const restart = useCallback(() => {
    if (phase !== 'conversing') return;
    socket.endSession();
    if (userRef.current) write('session', ACTIVE_SESSION + userRef.current, null);
    setSession(null);
    setEnding(false);
    setEndPressSeq(null);
    resetTurnState();
    setPhase('openings');
    void (async () => {
      const auth = token ?? await getToken();
      if (!auth) return;
      const offered = await getOffers(auth);
      if (offered.data) setOffers(offered.data);
    })();
  }, [phase, socket, token, getToken]);

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

  /* T1c: the learner rephrases their last message; the conversation drops the pair it replaces. */
  const editLast = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || phase !== 'conversing') return;
    if (speaking) { setInterruptedSeq(turnSeq); socket.interrupt(); }
    socket.editLast(trimmed);
    setAwaitingReply(true);
  }, [phase, speaking, turnSeq, socket]);

  /* T1c: a live activity is graded by Core (the key never reaches the browser). A failed check is null, never a wrong answer. */
  const gradeActivity = useCallback(async (segmentId: string, answer: unknown, attempt: number): Promise<ActivityGrade | null> => {
    const auth = token ?? await getToken();
    if (!auth) return null;
    const result = await gradeSegment(auth, segmentId, answer, attempt);
    if (!result.data) return null;
    const { verdict, xpAwarded, scoresXp, pedagogy } = result.data;
    return { correct: verdict.correct, score: verdict.score, feedback: verdict.feedback_md ? plainText(verdict.feedback_md) : null,
      xpAwarded, scoresXp, pedagogy: pedagogy ? { echo: pedagogy.echo } : null };
  }, [token, getToken]);

  /* The finished activity goes to Oracle with Core's signed receipt, and the Mentor reacts to it. */
  const reportActivity = useCallback((outcome: ActivityOutcome) => {
    if (phase !== 'conversing') return;
    socket.reportGrade(outcome.segmentId, outcome.score, outcome.correct,
      outcome.pedagogy ? { echo: outcome.pedagogy.echo, attemptNumber: outcome.attempt } : undefined);
    setAwaitingReply(true);
  }, [phase, socket]);

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

  /*
   * T1a / 08 §8: every choice is saved to Core first and only then shown (a
   * refused save keeps what was there and the sheet says so). The chosen
   * character fills every Mentor slot; a companion is never the Mentor itself.
   */
  const updatePreferences = useCallback(async (patch: Partial<TutorPreferences>): Promise<boolean> => {
    const auth = token ?? await getToken();
    if (!auth) return false;
    const next = patch.character && patch.character === preferences?.companion ? { ...patch, companion: null } : patch;
    const result = await savePreferences(auth, next);
    if (!result.data) return false;
    setPreferences(result.data);
    setPersonalized(true);
    return true;
  }, [token, getToken, preferences?.companion]);
  const chooseCharacter = useCallback((character: MentorCharacter) => updatePreferences({ character }), [updatePreferences]);

  /* T1g: keep the current conversation's board in the notebook. One quiet retry: the request is idempotent. */
  const keepBoard = useCallback(async (turnSeq: number): Promise<boolean> => {
    const auth = token ?? await getToken();
    const sessionId = sessionRef.current?.sessionId;
    if (!auth || !sessionId) return false;
    let result = await keepBoardRequest(auth, sessionId, turnSeq);
    if (result.error) {
      await new Promise((done) => { window.setTimeout(done, 600); });
      result = await keepBoardRequest(auth, sessionId, turnSeq);
    }
    return !result.error;
  }, [token, getToken]);

  const data = useMemo(() => coreMentorData(getToken), [getToken]);

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
  const companionValue = session ? session.companion : preferences?.companion;
  const companion = isCharacter(companionValue) && companionValue !== character ? companionValue : null;
  const lightValue = session?.backdrop ?? preferences?.backdrop;
  const light: MentorStageLight = (MENTOR_STAGE_LIGHTS as readonly unknown[]).includes(lightValue) ? lightValue as MentorStageLight : 'auto';

  return {
    phase, ageBand, character, scene, companion, light, known: preferences !== null,
    voice: phase === 'conversing' && !!session?.voiceAvailable,
    preferences, catalog, personalized, updatePreferences, keepBoard, data,
    nickname: preferences?.nickname ?? null,
    offers, calibration, calibrationSaving, calibrationError,
    starting, startError, session,
    socket, turn, speechUrl, audioKey: turnSeq, speaking, awaitingReply, replyTimedOut, resuming, ending,
    history: phase === 'closing' ? closedHistory : socket.history,
    closing, mic, recapOpen,
    retry, chooseCalibration, start, begin, sendText, pressMic, endSession, restart, editLast, gradeActivity, reportActivity, chooseCharacter, answerAlliance,
    setHasDraft, onSpeechEnd, onSpeechBlocked,
  };
}

export type MentorSession = ReturnType<typeof useMentorSession>;
