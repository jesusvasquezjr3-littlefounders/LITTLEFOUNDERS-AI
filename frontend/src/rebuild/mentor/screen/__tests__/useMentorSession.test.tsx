import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StartedSession, TutorOffers } from '../../session/types';
import { startOfLocalDayIso, useMentorSession } from '../useMentorSession';

/*
 * W2M.2: the Mentor screen's session controller keeps every server contract
 * the legacy screen honoured (bootstrap refusals, the daily limit echo, the
 * reload resume, the guided review, the C.2 microphone policy, the closing
 * capture), with the Core client, the socket and the microphone mocked.
 */
const api = vi.hoisted(() => ({
  getPreferences: vi.fn(), getOffers: vi.fn(), getAgeCalibration: vi.fn(), saveAgeCalibration: vi.fn(),
  startSession: vi.fn(), resumeSession: vi.fn(), savePreferences: vi.fn(), keepBoard: vi.fn(), gradeSegment: vi.fn(),
}));
vi.mock('../../session/tutorApi', () => api);
const core = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../../session/coreApi', () => core);
const alliance = vi.hoisted(() => ({ postAllianceCheck: vi.fn() }));
vi.mock('../../allianceApi', () => alliance);

const socket = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const socketUrls = vi.hoisted(() => [] as (string | null)[]);
vi.mock('../../session/useTutorSocket', () => ({ useTutorSocket: (url: string | null) => { socketUrls.push(url); return socket.current; } }));
vi.mock('../../session/useMicrophone', () => ({
  useMicrophone: () => ({ permission: 'idle', recording: false, levelRef: { current: 0 }, holdBytesRef: { current: 0 }, holdMsRef: { current: 0 },
    holdFractionRef: { current: 0 }, subscribe: () => () => undefined, start: vi.fn(async () => undefined), stop: vi.fn(async () => null), release: vi.fn() }),
}));
vi.mock('../../session/useHandsFreeTurn', () => ({ useHandsFreeTurn: () => undefined }));

const USER = 'user-1';
const OFFERS: TutorOffers = {
  locale: 'en-US', lastSession: null, intelDegraded: false, canStart: true, startBlockedBy: null, sessionCapResetAt: null,
  voiceAvailable: true, microphoneBlockedBy: null, weakSkills: [], faqIds: [], canAskOpen: true,
};
const PREFS = { character: 'zara', companion: null, diorama: 'diorama-b', backdrop: 'auto', nickname: 'Ana', adaptations: [], personalized: true,
  catalog: { characters: [], dioramas: [], backdrops: [], adaptations: [], articulates: [] } };
const STARTED: StartedSession = { sessionId: 's1', socketUrl: 'wss://oracle/s1', socketExpiresAt: '2026-09-26T12:00:00Z', character: 'zara', companion: null,
  diorama: 'diorama-b', backdrop: 'auto', locale: 'en-US', voiceAvailable: true, microphoneAvailable: true, microphoneBlockedBy: null };

function freshSocket(overrides: Record<string, unknown> = {}) {
  socket.current = {
    connection: 'connecting', turn: null, history: [], segment: null, lesson: null, budget: 'running', remainingMs: 0, microphone: false,
    micRevoked: false, intelDegraded: false, adaptationOffer: null, sessionEndOffer: false, closingSummary: null, checkInOpen: false,
    goalCheckOpen: false, closedReason: null, error: null, thinking: false,
    sendText: vi.fn(), sendAudio: vi.fn(), streamAudioChunk: vi.fn(), commitAudioStream: vi.fn(() => true), abandonAudioStream: vi.fn(),
    interrupt: vi.fn(), editLast: vi.fn(), reportGrade: vi.fn(), answerAdaptation: vi.fn(), answerSessionEnd: vi.fn(), answerCheckIn: vi.fn(),
    answerGoal: vi.fn(), endSession: vi.fn(), ...overrides,
  };
}

const ok = <T,>(data: T) => ({ data, error: null });
const fail = (code: string) => ({ data: null, error: { code, message: code } });

beforeEach(() => {
  freshSocket();
  socketUrls.length = 0;
  localStorage.clear();
  sessionStorage.clear();
  api.getPreferences.mockResolvedValue(ok(PREFS));
  api.getOffers.mockResolvedValue(ok(OFFERS));
  api.getAgeCalibration.mockResolvedValue(ok({ required: false, tier: 2 }));
  api.startSession.mockResolvedValue(ok(STARTED));
  api.resumeSession.mockResolvedValue(fail('SESSION_CLOSED'));
  core.api.mockResolvedValue(ok({ register: 'transition', copy_band: '10-12', policy_version: 'unknown', graduation: null }));
});
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

function mount(reviewSkill: string | null = null) {
  const getToken = vi.fn(async () => 'token');
  return renderHook(() => useMentorSession({ getToken, userId: USER, reviewSkill }));
}

describe('bootstrap', () => {
  it('opens on the learner’s chosen character and Diorama', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    expect(result.current).toMatchObject({ character: 'zara', scene: 'diorama-b', nickname: 'Ana', known: true });
  });

  it('is unavailable, never an invented default, when preferences or openings cannot be read', async () => {
    api.getPreferences.mockResolvedValue(fail('DATA_UNAVAILABLE'));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('unavailable'));
    expect(result.current.known).toBe(false);
  });

  it('reads in the youngest register when Core’s register cannot be read (B.23)', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    // An unknown policy version is refused by the register parser: the most protective reading.
    expect(result.current.ageBand).toBe('6-9');
  });

  it('asks the age calibration first (C.1) and continues once it is saved', async () => {
    api.getAgeCalibration.mockResolvedValueOnce(ok({ required: true, tier: null }));
    api.saveAgeCalibration.mockResolvedValue(ok({ required: false, tier: 1 }));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('calibration'));
    act(() => result.current.chooseCalibration(1));
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    expect(api.saveAgeCalibration).toHaveBeenCalledWith('token', 1);
  });
});

describe('the daily limit and starting a session', () => {
  it('remembers a limit reached today, so a reload shows the refusal and not inviting chips', async () => {
    localStorage.setItem(`lf.tutor.sessionLimitDay.${USER}`, startOfLocalDayIso('en-US'));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    expect(result.current.startError).toBe('SESSION_LIMIT');
  });

  it('forgets a limit from an earlier day', async () => {
    localStorage.setItem(`lf.tutor.sessionLimitDay.${USER}`, '2020-01-01T05:00:00.000Z');
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    expect(result.current.startError).toBeNull();
    expect(localStorage.getItem(`lf.tutor.sessionLimitDay.${USER}`)).toBeNull();
  });

  it('records a SESSION_LIMIT refusal for today', async () => {
    api.startSession.mockResolvedValue(fail('SESSION_LIMIT'));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    act(() => result.current.start({ intent: 'open' }));
    await waitFor(() => expect(result.current.startError).toBe('SESSION_LIMIT'));
    expect(localStorage.getItem(`lf.tutor.sessionLimitDay.${USER}`)).toBe(startOfLocalDayIso('en-US'));
  });

  it('starts with voice only when Core allows it, and keeps the session for a reload', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    act(() => result.current.start({ intent: 'course_topic' }));
    await waitFor(() => expect(result.current.phase).toBe('conversing'));
    expect(api.startSession).toHaveBeenCalledWith('token', { intent: 'course_topic', wantsVoice: true });
    expect(JSON.parse(sessionStorage.getItem(`lf.tutor.activeSession.${USER}`)!)).toMatchObject({ sessionId: 's1' });
    expect(socketUrls.at(-1)).toBe('wss://oracle/s1');
  });

  it('sends a question typed on the openings once the Mentor has greeted', async () => {
    const { result, rerender } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    act(() => result.current.sendText('What is interest?'));
    await waitFor(() => expect(result.current.phase).toBe('conversing'));
    expect(api.startSession).toHaveBeenCalledWith('token', { intent: 'open', wantsVoice: true });
    expect(socket.current.sendText).not.toHaveBeenCalled();
    socket.current = { ...socket.current, connection: 'open', turn: { seq: 1, text: 'Hi', emotion: 'happy', action: 'wave', audioUrl: null, audioPending: false, next: 'ask', policy: null } };
    rerender();
    await waitFor(() => expect(socket.current.sendText).toHaveBeenCalledWith('What is interest?'));
  });

  it('starts the guided review a lesson offered, once, without voice (B.26)', async () => {
    const { result, rerender } = mount('money/change');
    await waitFor(() => expect(result.current.phase).toBe('conversing'));
    rerender();
    expect(api.startSession).toHaveBeenCalledTimes(1);
    expect(api.startSession).toHaveBeenCalledWith('token', { intent: 'weak_skill', skillKey: 'money/change', wantsVoice: false });
  });

  it('resumes the conversation of this tab after a reload', async () => {
    sessionStorage.setItem(`lf.tutor.activeSession.${USER}`, JSON.stringify(STARTED));
    api.resumeSession.mockResolvedValue(ok({ sessionId: 's1', socketUrl: 'wss://oracle/fresh', socketExpiresAt: 'x' }));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('conversing'));
    expect(socketUrls.at(-1)).toBe('wss://oracle/fresh');
  });
});

describe('the microphone follows Core’s C.2 answer', () => {
  it('has no microphone when a grown-up must allow it, and starts without voice', async () => {
    api.getOffers.mockResolvedValue(ok({ ...OFFERS, microphoneBlockedBy: 'CONSENT_REQUIRED' }));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    expect(result.current.mic).toMatchObject({ present: false, blockedBy: 'CONSENT_REQUIRED' });
    act(() => result.current.start({ intent: 'open' }));
    await waitFor(() => expect(api.startSession).toHaveBeenCalledWith('token', { intent: 'open', wantsVoice: false }));
  });

  it('takes the microphone away the moment a guardian revokes it mid-session', async () => {
    const { result, rerender } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    act(() => result.current.start({ intent: 'open' }));
    await waitFor(() => expect(result.current.phase).toBe('conversing'));
    socket.current = { ...socket.current, connection: 'open', microphone: true };
    rerender();
    expect(result.current.mic.present).toBe(true);
    socket.current = { ...socket.current, microphone: false, micRevoked: true };
    rerender();
    expect(result.current.mic).toMatchObject({ present: false, blockedBy: 'CONSENT_REQUIRED' });
  });
});

describe('how a session ends (C.16)', () => {
  async function conversing() {
    const hook = mount();
    await waitFor(() => expect(hook.result.current.phase).toBe('openings'));
    act(() => hook.result.current.start({ intent: 'open' }));
    await waitFor(() => expect(hook.result.current.phase).toBe('conversing'));
    return hook;
  }

  it('captures the server’s closing script and the conversation before releasing the socket', async () => {
    const { result, rerender } = await conversing();
    const history = [{ speaker: 'tutor', text: 'Hi', seq: 1 }];
    socket.current = { ...socket.current, connection: 'closed', history, closedReason: 'completed',
      closingSummary: { script: 'completed', effort: 'recovered', topic: 'Saving' } };
    rerender();
    await waitFor(() => expect(result.current.phase).toBe('closing'));
    expect(result.current.closing).toEqual({ sessionId: 's1', script: 'completed', effort: 'recovered', topic: 'Saving' });
    expect(result.current.history).toEqual(history);
    expect(sessionStorage.getItem(`lf.tutor.activeSession.${USER}`)).toBeNull();
  });

  it('shows no topic after a safety stop', async () => {
    const { result, rerender } = await conversing();
    socket.current = { ...socket.current, connection: 'closed', history: [{ speaker: 'tutor', text: 'x', seq: 1 }], closedReason: 'safety_stop' };
    rerender();
    await waitFor(() => expect(result.current.phase).toBe('closing'));
    expect(result.current.closing).toMatchObject({ script: 'safety_stop', topic: null });
  });

  it('is unavailable, not a goodbye, when the socket never carried a turn', async () => {
    const { result, rerender } = await conversing();
    socket.current = { ...socket.current, connection: 'failed' };
    rerender();
    await waitFor(() => expect(result.current.phase).toBe('unavailable'));
  });

  it('quietly resumes a dropped connection once', async () => {
    const { result, rerender } = await conversing();
    api.resumeSession.mockResolvedValue(ok({ sessionId: 's1', socketUrl: 'wss://oracle/again', socketExpiresAt: 'x' }));
    socket.current = { ...socket.current, connection: 'closed', history: [{ speaker: 'tutor', text: 'x', seq: 1 }], error: { code: 'CONNECTION_LOST', message: '' } };
    rerender();
    await waitFor(() => expect(socketUrls.at(-1)).toBe('wss://oracle/again'));
    expect(result.current.phase).toBe('conversing');
    expect(result.current.resuming).toBe(true);
  });

  it('closes as "learner left" when the learner ends it and the server says nothing more', async () => {
    const { result } = await conversing();
    vi.useFakeTimers();
    act(() => result.current.endSession());
    expect(socket.current.endSession).toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(4100); });
    expect(result.current.phase).toBe('closing');
    expect(result.current.closing).toMatchObject({ script: 'learner_left' });
  });

  it('OD-28 (M-04): pressing end asks for the recap first; the recap turn keeps the talk open and a second press ends it', async () => {
    const { result, rerender } = await conversing();
    const asking = { seq: 3, text: 'What clicked?', next: 'ask' };
    socket.current = { ...socket.current, turn: { ...asking, seq: 2 } };
    rerender();
    vi.useFakeTimers();
    act(() => result.current.endSession());
    expect(socket.current.endSession).toHaveBeenLastCalledWith(true);
    expect(result.current.ending).toBe(true);
    socket.current = { ...socket.current, turn: asking };
    rerender();
    expect(result.current.recapOpen).toBe(true);
    expect(result.current.ending).toBe(false);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.phase).toBe('conversing');
    act(() => result.current.endSession());
    expect(socket.current.endSession).toHaveBeenCalledTimes(2);
  });

  it('T1c: grades an activity through Core, and reports it to Oracle with the signed receipt', async () => {
    const { result } = await conversing();
    api.gradeSegment.mockResolvedValueOnce(ok({ verdict: { correct: true, score: 100, tier: 'perfect', feedback_md: '**Yes**, 17.', allowRetry: false },
      xpAwarded: 10, scoresXp: true, dailyXpCap: 100, pedagogy: { kcId: 'k', correct: true, pKnownAfter: 0.9, misconceptionCode: null, reviewDueAt: 'x', echo: 'signed' } }));
    let grade: unknown = 'unset';
    await act(async () => { grade = await result.current.gradeActivity('seg-1', { picked: [10, 5, 2] }, 1); });
    expect(api.gradeSegment).toHaveBeenCalledWith('token', 'seg-1', { picked: [10, 5, 2] }, 1);
    expect(grade).toEqual({ correct: true, score: 100, feedback: 'Yes, 17.', xpAwarded: 10, scoresXp: true, pedagogy: { echo: 'signed' } });
    act(() => result.current.reportActivity({ ...(grade as object), segmentId: 'seg-1', attempt: 1 } as never));
    expect(socket.current.reportGrade).toHaveBeenCalledWith('seg-1', 100, true, { echo: 'signed', attemptNumber: 1 });
    expect(result.current.awaitingReply).toBe(true);
  });

  it('T1c: a failed check is null, never a wrong answer', async () => {
    const { result } = await conversing();
    api.gradeSegment.mockResolvedValueOnce(fail('INTERNAL'));
    let grade: unknown = 'unset';
    await act(async () => { grade = await result.current.gradeActivity('seg-1', { option_id: 'a' }, 1); });
    expect(grade).toBeNull();
  });

  it('T1c: changing the last message rewinds it through the socket', async () => {
    const { result } = await conversing();
    act(() => result.current.editLast('  I meant twenty  '));
    expect(socket.current.editLast).toHaveBeenCalledWith('I meant twenty');
    expect(result.current.awaitingReply).toBe(true);
  });

  it('T1c: start over closes at once (no recap) and brings the openings back, re-read for today', async () => {
    const { result } = await conversing();
    api.getOffers.mockClear();
    act(() => result.current.restart());
    expect(socket.current.endSession).toHaveBeenLastCalledWith();
    expect(result.current.phase).toBe('openings');
    expect(socketUrls.at(-1)).toBeNull();
    await waitFor(() => expect(api.getOffers).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(`lf.tutor.activeSession.${USER}`)).toBeNull();
  });
});

describe('choosing the Mentor (08 §8)', () => {
  it('saves the character to Core before the screen shows it', async () => {
    api.savePreferences.mockResolvedValue(ok({ ...PREFS, character: 'liruf' }));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    let saved = false;
    await act(async () => { saved = await result.current.chooseCharacter('liruf'); });
    expect(saved).toBe(true);
    expect(api.savePreferences).toHaveBeenCalledWith('token', { character: 'liruf' });
    expect(result.current.character).toBe('liruf');
  });

  it('keeps the character when the save is refused', async () => {
    api.savePreferences.mockResolvedValue(fail('INTERNAL'));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    await act(async () => { await result.current.chooseCharacter('dina'); });
    expect(result.current.character).toBe('zara');
  });
});

describe('the learner island and the notebook (W2M.3, T1a, T1g)', () => {
  it('reads the first visit, the friend and the light, and never makes the Mentor its own friend', async () => {
    api.getPreferences.mockResolvedValue(ok({ ...PREFS, companion: 'dina', backdrop: 'dusk', personalized: false }));
    api.savePreferences.mockResolvedValue(ok({ ...PREFS, character: 'dina', companion: null }));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    expect(result.current).toMatchObject({ personalized: false, companion: 'dina', light: 'dusk' });
    await act(async () => { await result.current.chooseCharacter('dina'); });
    expect(api.savePreferences).toHaveBeenCalledWith('token', { character: 'dina', companion: null });
    expect(result.current).toMatchObject({ personalized: true, character: 'dina', companion: null });
  });

  it('keeps a board by naming the session and the turn, with one quiet retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.keepBoard.mockResolvedValueOnce(fail('INTERNAL')).mockResolvedValueOnce(ok({ kept: true }));
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    act(() => result.current.start({ intent: 'open' }));
    await waitFor(() => expect(result.current.phase).toBe('conversing'));
    let kept = false;
    await act(async () => { const pending = result.current.keepBoard(4); await vi.advanceTimersByTimeAsync(700); kept = await pending; });
    expect(kept).toBe(true);
    expect(api.keepBoard).toHaveBeenNthCalledWith(2, 'token', 's1', 4);
  });

  it('says voice only for a session Core started with voice', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.phase).toBe('openings'));
    expect(result.current.voice).toBe(false);
    act(() => result.current.start({ intent: 'open' }));
    await waitFor(() => expect(result.current.phase).toBe('conversing'));
    expect(result.current.voice).toBe(true);
  });
});
