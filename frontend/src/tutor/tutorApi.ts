import { api, type ApiResult } from '@/lib/api';
import type {
  Adaptation,
  SessionSummary,
  SessionTranscript,
  StartedSession,
  TutorCatalog,
  TutorIntent,
  TutorOffers,
  TutorPreferences,
} from './types';

/*
 * Core is the only service the browser calls for Tutor DATA (/AGENTS.md §1.5).
 *
 * The one exception is the websocket, which goes straight to Oracle carrying a
 * token Core minted — the fourth documented §1.5 exception. Even there, the
 * URL comes from THIS file's `startSession`: the client never builds it, never
 * sees the raw token as a separate value, and cannot point it somewhere else.
 */

export interface PreferencesResponse extends TutorPreferences {
  catalog: TutorCatalog;
  /**
   * Whether this learner has ever saved a preference — the server-side "has
   * been offered the picker" marker (the picker's Done always saves).
   */
  personalized: boolean;
}

export function getPreferences(token: string): Promise<ApiResult<PreferencesResponse>> {
  return api<PreferencesResponse>('/tutor/preferences', { token });
}

export function savePreferences(
  token: string,
  patch: Partial<TutorPreferences>,
): Promise<ApiResult<TutorPreferences>> {
  return api<TutorPreferences>('/tutor/preferences', { method: 'PUT', body: patch, token });
}

export function getOffers(token: string): Promise<ApiResult<TutorOffers>> {
  return api<TutorOffers>('/tutor/offers', { token });
}

export interface StartSessionInput {
  intent: TutorIntent;
  courseId?: string | null;
  topicId?: string | null;
  skillKey?: string | null;
  wantsVoice: boolean;
}

export function startSession(token: string, input: StartSessionInput): Promise<ApiResult<StartedSession>> {
  return api<StartedSession>('/tutor/sessions', { method: 'POST', body: input, token });
}

export interface ResumedSession {
  sessionId: string;
  socketUrl: string;
  socketExpiresAt: string;
}

/**
 * A fresh single-use socket URL for a session whose connection dropped. Oracle
 * parks the conversation for a grace window; `409 SESSION_CLOSED` means the
 * window passed and there is nothing to go back to.
 */
export function resumeSession(token: string, sessionId: string): Promise<ApiResult<ResumedSession>> {
  return api<ResumedSession>(`/tutor/sessions/${sessionId}/resume`, { method: 'POST', body: {}, token });
}

export function listSessions(token: string): Promise<ApiResult<{ sessions: SessionSummary[] }>> {
  return api<{ sessions: SessionSummary[] }>('/tutor/sessions', { token });
}

export function getTranscript(token: string, sessionId: string): Promise<ApiResult<SessionTranscript>> {
  return api<SessionTranscript>(`/tutor/sessions/${sessionId}`, { token });
}

export interface GradeResponse {
  verdict: {
    correct: boolean;
    score: number;
    tier: 'perfect' | 'great' | 'almost' | 'tryAgain';
    feedback_md?: string;
    reveal?: unknown;
    allowRetry: boolean;
  };
  xpAwarded: number;
  /** False when the server could not re-derive the key — it teaches, it does not pay. */
  scoresXp: boolean;
  dailyXpCap: number;
  /**
   * v3: the pedagogy join. `echo` is Core's SIGNED grade receipt — the client
   * relays it verbatim inside `segment_graded` so Oracle's strategy
   * controller can trust the event; the other fields are display-grade.
   * Null while the v3 brain is off or the segment carried no KC.
   */
  pedagogy: {
    kcId: string;
    correct: boolean;
    pKnownAfter: number;
    misconceptionCode: string | null;
    reviewDueAt: string;
    echo: string;
  } | null;
}

export function gradeSegment(
  token: string,
  segmentId: string,
  answer: unknown,
  attemptNumber: number,
  hintsUsed = 0,
): Promise<ApiResult<GradeResponse>> {
  return api<GradeResponse>(`/tutor/segments/${segmentId}/grade`, {
    method: 'POST',
    body: { answer, attemptNumber, hintsUsed },
    token,
  });
}

// ── Consent (/ORACLE.md §4.3) ───────────────────────────────────────────────

export interface ConsentState {
  active: boolean;
  grantedAt: string | null;
  locale: string | null;
  /**
   * Whether policy currently permits a minor's microphone AT ALL — the DPA
   * gate (`TUTOR_VOICE_FOR_MINORS`, /ORACLE.md §16), which is a separate fact
   * from whether this guardian has consented. While it is `blocked` there is
   * nothing to consent TO, and the control must not offer it.
   */
  policy: 'allowed' | 'blocked';
}

export function getVoiceConsent(token: string, userId: string): Promise<ApiResult<ConsentState>> {
  return api<ConsentState>(`/tutor/consent/${userId}`, { token });
}

/**
 * Grants microphone consent for a dependant.
 *
 * `consentText` is the EXACT wording the guardian was shown, and the caller
 * must pass the rendered string rather than a key: a dispute is resolved
 * against what was on the screen, not against whatever the current build's
 * translation file says today.
 */
export function grantVoiceConsent(
  token: string,
  input: { kidUserId: string; consentText: string; locale: string },
): Promise<ApiResult<{ granted: boolean; grantedAt: string }>> {
  return api<{ granted: boolean; grantedAt: string }>('/tutor/consent', {
    method: 'POST',
    body: input,
    token,
  });
}

export function revokeVoiceConsent(token: string, userId: string): Promise<ApiResult<{ revoked: boolean }>> {
  return api<{ revoked: boolean }>(`/tutor/consent/${userId}`, { method: 'DELETE', token });
}

export interface KidTutorHistory {
  sessions: SessionSummary[];
  safetyFlags: {
    id: string;
    session_id: string;
    turn_seq: number | null;
    category: string;
    severity: string;
    handled: string;
    created_at: string;
  }[];
}

export function getKidTutorHistory(token: string, kidUserId: string): Promise<ApiResult<KidTutorHistory>> {
  return api<KidTutorHistory>(`/tutor/kids/${kidUserId}/sessions`, { token });
}

export const ADAPTATION_KEYS: readonly Adaptation[] = [
  'slower_pacing',
  'more_examples',
  'less_text',
  'more_visual',
  'repeat_before_advancing',
];
