import { api, type ApiResult } from '@/lib/api';

export interface AgeCalibration { required: boolean; tier: 1 | 2 | 3 | null }
function validateCalibration(result: ApiResult<AgeCalibration>): ApiResult<AgeCalibration> {
  if (result.error) return result;
  const value = result.data;
  if (typeof value.required === 'boolean' && (value.required ? value.tier === null : [1, 2, 3].includes(value.tier ?? 0))) return result;
  return { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Invalid calibration response' } };
}
export async function getAgeCalibration(token: string) {
  return validateCalibration(await api<AgeCalibration>('/tutor/age-calibration', { token }));
}
export async function saveAgeCalibration(token: string, tier: 1 | 2 | 3) {
  return validateCalibration(await api<AgeCalibration>('/tutor/age-calibration', { token, body: { tier } }));
}
import type {
  Adaptation,
  SessionNarrative,
  SessionSummary,
  SessionTranscript,
  StartedSession,
  TutorCatalog,
  TutorIntent,
  TutorOffers,
  TutorPreferences,
  TutorWhiteboardWire,
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

// ── The learning map (Tutor v3) ─────────────────────────────────────────────

export type TutorMapNodeState = 'locked' | 'available' | 'in_progress' | 'mastered' | 'needs_review';

export interface TutorMapNode {
  kcId: string;
  kcKey: string;
  strand: 'money_math' | 'entrepreneurship';
  title: string;
  state: TutorMapNodeState;
  mastery: number | null;
  attempts: number;
  skillKey: string | null;
}

export interface TutorMapResponse {
  nodes: TutorMapNode[];
  edges: Array<{ from: string; to: string }>;
  continueTarget: {
    kcKey: string;
    title: string;
    reason: 'review_due' | 'frontier';
    skillKey: string | null;
  } | null;
  review: { count: number };
}

/** The KC graph as this learner sees it — the same graph the planner traverses. */
export function getMap(token: string): Promise<ApiResult<TutorMapResponse>> {
  return api<TutorMapResponse>('/tutor/map', { token });
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
  sessions: (SessionSummary & { narrative: SessionNarrative | null })[];
  /**
   * True when at least one more session exists past this page (round 110,
   * 2026-08-31) — the guardian list used to hardcode 30 sessions with no way
   * back to anything older, even though the row was still there and still
   * inside the 90-day retention window.
   */
  hasMore: boolean;
  safetyFlags: {
    id: string;
    session_id: string;
    turn_seq: number | null;
    category: string;
    severity: string;
    handled: string;
    created_at: string;
  }[];
  /**
   * The SECOND flag provenance (migration 0065, /ORACLE.md §4.1b): a flag
   * raised while the learner was choosing a course, before any `tutor_sessions`
   * row existed for `safetyFlags` above to reference.
   *
   * Its own array rather than merged into `safetyFlags`, because the two row
   * shapes genuinely differ and a caller that assumes every flag has a session
   * would break on one that does not: there is no `session_id`/`turn_seq` here,
   * so there is no transcript to open, and no `handled` (placement takes
   * exactly one path on a flag — the neutral fallback — never `turn_blocked`
   * or `session_stopped`). `course_id` stands in as the only context there is.
   *
   * Required, not optional: Core returns this field unconditionally
   * (`backend/src/routes/tutor.ts`, `GET /tutor/kids/:kidUserId/sessions`), so
   * an absent one would model a response the server never sends.
   */
  placementSafetyFlags: {
    id: string;
    course_id: string | null;
    category: string;
    severity: string;
    created_at: string;
  }[];
}

export function getKidTutorHistory(
  token: string,
  kidUserId: string,
  opts: { offset?: number } = {},
): Promise<ApiResult<KidTutorHistory>> {
  const params = new URLSearchParams();
  if (opts.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return api<KidTutorHistory>(`/tutor/kids/${kidUserId}/sessions${qs ? `?${qs}` : ''}`, { token });
}

/*
 * THE PARENTAL APPROVAL GATE (/ORACLE.md §20, migration 0068).
 *
 * What the tutor believes about a child no longer writes itself. Every note a
 * session proposes about a `kid` parks until a verified guardian decides, and
 * these two calls are the portal that empties the queue.
 */
export interface PendingMemoryNote {
  id: string;
  /** The note as proposed: what the tutor would hold about this child. */
  proposed: string;
  /** What it would replace. `null` when there is no note yet. */
  expectedBefore: string | null;
  sessionId: string | null;
  createdAt: string;
}

export interface PendingMemoryNotes {
  proposals: PendingMemoryNote[];
  /**
   * The note the tutor holds TODAY, which is not always what any single
   * proposal expected: two overlapping sessions can each park a note computed
   * from the same earlier text, and approving the first moves the store out
   * from under the second. Having it lets the portal mark a stale note as
   * stale BEFORE a guardian taps approve, rather than only afterwards.
   */
  current: string | null;
}

export function getPendingMemoryNotes(
  token: string,
  kidUserId: string,
): Promise<ApiResult<PendingMemoryNotes>> {
  return api<PendingMemoryNotes>(`/tutor/kids/${kidUserId}/memory-proposals`, { token });
}

/*
 * OD-18 (24 September 2026, C.4): the CALLER'S OWN queue. A self-reviewing
 * teen (13-17, no linked guardian) decides their own parked notes; Core
 * answers 403 FORBIDDEN for anyone whose notes are not self-reviewed, so a
 * kid or adult asking for this gets told rather than shown an empty queue.
 */
export function getOwnPendingMemoryNotes(token: string): Promise<ApiResult<PendingMemoryNotes>> {
  return api<PendingMemoryNotes>('/tutor/memory-proposals', { token });
}

export function decideMemoryNote(
  token: string,
  proposalId: string,
  verdict: 'approved' | 'rejected',
): Promise<ApiResult<{ outcome: string; applied: boolean }>> {
  return api<{ outcome: string; applied: boolean }>(`/tutor/memory-proposals/${proposalId}/decision`, {
    method: 'POST',
    token,
    body: { verdict },
  });
}

// ── Class V artifacts: plan & notebook (migration 0069, /TUTOR_INSTRUMENTS.md §3.6) ──

export interface TutorPlan {
  /** A whiteboard JSONB snapshot — the SAME shape any live turn's board already is. */
  content: TutorWhiteboardWire;
  sessionId: string | null;
  updatedAt: string;
}

export function getPlan(token: string): Promise<ApiResult<{ plan: TutorPlan | null }>> {
  return api<{ plan: TutorPlan | null }>('/tutor/plan', { token });
}

export function getKidPlan(token: string, kidUserId: string): Promise<ApiResult<{ plan: TutorPlan | null }>> {
  return api<{ plan: TutorPlan | null }>(`/tutor/kids/${kidUserId}/plan`, { token });
}

export interface TutorNotebookEntry {
  id: string;
  whiteboard: TutorWhiteboardWire;
  sessionId: string | null;
  turnSeq: number | null;
  keptAt: string;
}

export function getNotebook(token: string): Promise<ApiResult<{ entries: TutorNotebookEntry[] }>> {
  return api<{ entries: TutorNotebookEntry[] }>('/tutor/notebook', { token });
}

export function getKidNotebook(
  token: string,
  kidUserId: string,
): Promise<ApiResult<{ entries: TutorNotebookEntry[] }>> {
  return api<{ entries: TutorNotebookEntry[] }>(`/tutor/kids/${kidUserId}/notebook`, { token });
}

export const ADAPTATION_KEYS: readonly Adaptation[] = [
  'slower_pacing',
  'more_examples',
  'less_text',
  'more_visual',
  'repeat_before_advancing',
];
