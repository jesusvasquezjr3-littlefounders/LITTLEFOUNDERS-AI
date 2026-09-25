import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import LessonPlayer from '@/lesson-engine/player/LessonPlayer';
import type { LessonDocument } from '@/lesson-engine/core/types';
import type { AudioManifest } from '@/lesson-engine/player/narration';
import type { ServerCompletion } from '@/lesson-engine/player/completion';
import { createCoreGrader } from './coreGrader';
import { clearCoursesCache } from './coursesCache';
import { coursePath, placementPath } from './paths';
import { checkpointKey, newCheckpoint, readCheckpoint, removeCheckpoint, writeCheckpoint } from '@/lesson-engine/player/checkpoint';
import type { SessionState } from '@/lesson-engine/core/session';
import { useTheme } from '@/theme/useTheme';
import { RebuildRoot } from '@/rebuild/design/controls';
import { AuthenticatedLessonDocument } from '@/rebuild/learning/AuthenticatedLessonDocument';
import type { OnGrade, OnGradeBarModel, OnGradeFractionArea, OnGradeNumberLine, OnGradeSchemaDiagram, OnGradeWorkedExample } from '@/rebuild/learning/LessonDocumentView';
import { LessonEligibilityStateView, type LessonEligibilityState } from '@/rebuild/learning/LessonEligibilityStateView';
import { LessonTransportStateView } from '@/rebuild/learning/LessonTransportStateView';
import type { Locale } from '@/rebuild/design/copyBudget';
import { loadLessonClientDocument, type LessonClientDocument } from '@/rebuild/learning/lessonDocument';

/*
 * /learn/lesson/:lessonId — the fullscreen Lesson Player wired to Core
 * (COURSE_ENGINE.md §2, LESSON_ENGINE.md §7). Registered OUTSIDE the
 * AppLayout route group in App.tsx so no dashboard chrome ever renders
 * behind it — LessonPlayer already owns a `fixed inset-0` layer.
 *
 * Deviation from the literal task brief (documented per /AGENTS.md §1.12):
 * completion persistence (`onComplete`) and navigation (`onExit`) are kept
 * separate rather than both living in `onComplete`. LessonPlayer fires
 * `onComplete` the instant it reaches the results phase — navigating away
 * there would rip the Results screen (score ring, XP stat cards, cast
 * celebration — DESIGN.md Screen Recipes → Lesson) out from under the kid
 * before they ever see it. So `onComplete` only POSTs the score; navigation
 * happens from `onExit`, which fires when the kid taps "Finish" on the
 * Results screen (or exits early) — matching the Lesson screen recipe.
 */

interface LessonResponse {
  lesson: { id: string; slug: string };
  locale: string;
  document: unknown;
  audio: AudioManifest;
  mentor_stage?: unknown;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: string; offline: boolean }
  | { status: 'ready'; document: unknown; locale: string; audio: AudioManifest; mentorStage: unknown; v2Attempt: V2Attempt | null };

interface V2RunResponse {
  run_id: string;
  version_id: string;
  expires_at: string;
  resumed: boolean;
  met_segment_ids: string[];
  attempted_segment_ids?: string[];
  attempt_tokens: Record<string, string>;
}

interface V2Attempt {
  runId: string;
  versionId: string;
  tokens: Record<string, string>;
  metSegmentIds: string[];
  attemptedSegmentIds: string[];
}

interface LocationState {
  courseSlug?: string;
}

export function LessonRoute() {
  const { session } = useAuth();
  const { lessonId } = useParams();
  // A different learner or lesson must never inherit a pending completion.
  return <LessonRouteSession key={`${session?.user.id ?? 'none'}:${lessonId}`} />;
}

function LessonRouteSession() {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const theme = isDark ? 'dark' : 'light';
  // Rebuilt state screens mount the design system's root (tokens, `app` container, mode, language); the legacy player does not use it.
  const rebuilt = (view: JSX.Element) => <RebuildRoot theme={theme} locale={localeFromI18n(i18n.language)}>{view}</RebuildRoot>;
  const { lessonId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken, session } = useAuth();
  const storageKey = session ? checkpointKey(session.user.id, lessonId) : null;
  const [initialCheckpoint] = useState(() => storageKey ? readCheckpoint(storageKey) : newCheckpoint());
  const checkpoint = useRef(initialCheckpoint);
  const v2EnteredAt = useRef(Date.now());
  const saved = useRef(false);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [loadRevision, setLoadRevision] = useState(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const courseSlug = (location.state as LocationState | null)?.courseSlug ?? null;
  // Insights (/INSIGHTS.md): lesson_start on entry; lesson_abandon on exit
  // WITHOUT completing — the drop-off signal the server cannot see, since
  // /complete only fires on the results screen. trackInsight is a no-op for
  // unconsented kids, so this wiring carries no §1.9 decision of its own.
  const completedRef = useRef(false);
  useEffect(() => {
    completedRef.current = false;
    const enteredAt = Date.now();
    trackInsight('lesson_start', { lessonId, routeClass: 'learn' });
    return () => {
      if (!completedRef.current) {
        trackInsight('lesson_abandon', { lessonId, routeClass: 'learn', value: Math.round((Date.now() - enteredAt) / 1000) });
      }
    };
  }, [lessonId]);
  // Keep the run across reloads; Finish discards it so deliberate replay starts fresh.
  const runId = checkpoint.current.runId;
  const grader = useMemo(() => createCoreGrader(lessonId, getToken, runId), [lessonId, getToken, runId]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<LessonResponse>(`/learn/lessons/${lessonId}`, { token });
      if (cancelled) return;
      if (error) {
        setState({ status: 'error', code: error.code, offline: /offline|network|fetch/i.test(error.message) });
        return;
      }
      if (isLegacyLessonDocument(data.document)) {
        const signature = JSON.stringify(data.document);
        const snapshot = checkpoint.current.state;
        const segmentIds = new Set(data.document.segments.map(segment => segment.id));
        const invalidSnapshot = snapshot && (snapshot.index >= data.document.segments.length || Object.keys(snapshot.seg).some(id => !segmentIds.has(id)));
        // Never restore segment indices/verdicts into a revised or translated document.
        if (invalidSnapshot || (checkpoint.current.document && checkpoint.current.document !== signature)) checkpoint.current = newCheckpoint();
        checkpoint.current.document = signature;
        setState({ status: 'ready', document: data.document, locale: data.locale, audio: data.audio ?? {}, mentorStage: data.mentor_stage, v2Attempt: null });
        return;
      }
      const clientDocument = loadLessonClientDocument(data.document);
      // Ungraded visual lessons remain presentation-only until the separate
      // version-pinned completion design exists; there is no token to request.
      if (clientDocument.status !== 'ready' || !clientDocument.document.segments.some(segment => segment.grading === 'server')) {
        setState({ status: 'ready', document: data.document, locale: data.locale, audio: data.audio ?? {}, mentorStage: data.mentor_stage, v2Attempt: null });
        return;
      }
      const resumeRunId = checkpoint.current.document?.startsWith('v2:') ? checkpoint.current.runId : undefined;
      const started = await api<V2RunResponse>(`/learn/lessons/${lessonId}/v2-runs`, { method: 'POST', token, body: resumeRunId ? { run_id: resumeRunId } : {} });
      if (cancelled) return;
      const attempt = started.error ? null : validateV2Attempt(clientDocument.document, started.data);
      if (attempt) {
        checkpoint.current.runId = attempt.runId;
        checkpoint.current.document = `v2:${attempt.versionId}`;
        if (storageKey) writeCheckpoint(storageKey, checkpoint.current);
      }
      setState({ status: 'ready', document: data.document, locale: data.locale, audio: data.audio ?? {}, mentorStage: data.mentor_stage, v2Attempt: attempt });
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, getToken, loadRevision]);

  const submitV2Grade = useCallback(async (answer: unknown, segmentId: string, document: LessonClientDocument) => {
    const attempt = state.status === 'ready' ? state.v2Attempt : null;
    if (!attempt || attempt.versionId !== document.version_id) throw new Error('No matching lesson attempt');
    const attemptToken = attempt.tokens[segmentId];
    const token = await getToken();
    if (!attemptToken || !token) throw new Error('No lesson attempt token');
    const { data, error } = await api<{ verdict: { correct: boolean; score: number }; replayed: boolean; retry_attempt_token?: string }>(`/learn/lessons/${lessonId}/grade`, {
      method: 'POST', token, body: { segment_id: segmentId, answer, run_id: attempt.runId, attempt_token: attemptToken },
    });
    if (error || !data || (data.verdict.score !== 0 && data.verdict.score !== 100)) throw new Error('Could not grade v2 segment');
    if (!data.verdict.correct && !data.replayed) {
      if (typeof data.retry_attempt_token !== 'string' || data.retry_attempt_token.length === 0) throw new Error('Could not renew v2 lesson attempt');
      setState((current) => current.status === 'ready' && current.v2Attempt?.runId === attempt.runId
        ? { ...current, v2Attempt: { ...current.v2Attempt, tokens: { ...current.v2Attempt.tokens, [segmentId]: data.retry_attempt_token! } } }
        : current);
    }
    return data.verdict.correct ? 'met' : 'review';
  }, [getToken, lessonId, state]);

  const gradeV2: OnGrade = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2NumberLine: OnGradeNumberLine = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2FractionArea: OnGradeFractionArea = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2BarModel: OnGradeBarModel = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2SchemaDiagram: OnGradeSchemaDiagram = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2WorkedExample: OnGradeWorkedExample = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const completeV2 = useCallback(async () => {
    const attempt = state.status === 'ready' ? state.v2Attempt : null;
    const token = await getToken();
    if (!attempt || !token) return false;
    const d = new Date();
    const { error } = await api<ServerCompletion>(`/learn/lessons/${lessonId}/complete`, {
      method: 'POST', token, body: { run_id: attempt.runId, seconds_spent: Math.min(7200, Math.max(1, Math.round((Date.now() - v2EnteredAt.current) / 1000))), local_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` },
    });
    if (!error) { completedRef.current = true; clearCoursesCache(); }
    return !error;
  }, [getToken, lessonId, state]);

  function goBack() {
    if (saved.current && storageKey) removeCheckpoint(storageKey);
    navigate(courseSlug ? coursePath(courseSlug) : '/learn');
  }

  const saveCheckpoint = useCallback((snapshot: SessionState, elapsedMs: number) => {
    if (!active.current) return;
    checkpoint.current.state = snapshot;
    checkpoint.current.elapsedMs = elapsedMs;
    if (storageKey) writeCheckpoint(storageKey, checkpoint.current);
  }, [storageKey]);

  async function persistCompletion(secondsSpent: number): Promise<ServerCompletion | null> {
    // Reaching the results phase means the lesson was NOT abandoned,
    // regardless of whether the persist below succeeds.
    completedRef.current = true;
    const d = new Date();
    checkpoint.current.completion ??= {
      seconds_spent: Math.min(7200, Math.max(1, secondsSpent)),
      run_id: checkpoint.current.runId,
      local_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    };
    if (storageKey) writeCheckpoint(storageKey, checkpoint.current);
    const token = await getToken();
    if (!active.current || !token) return null;
    // The player keeps the outcome visible and exposes an explicit retry
    // on null. Reuse the run id so a lost response cannot duplicate rewards.
    const { data, error } = await api<ServerCompletion>(`/learn/lessons/${lessonId}/complete`, {
      method: 'POST',
      token,
      body: checkpoint.current.completion,
    });
    /*
     * The shelf's cached progress is now wrong — this lesson just changed it.
     * Dropped whether or not the persist succeeded: on failure the player
     * falls back to its own numbers and the server may still have recorded
     * the attempt, so a cache kept here could show a stale count either way.
     */
    clearCoursesCache();
    if (!error) saved.current = true;
    return error ? null : data;
  }

  if (state.status === 'loading') {
    return rebuilt(<LessonTransportStateView state="opening" locale={localeFromI18n(i18n.language)} onBack={goBack} />);
  }

  /*
   * PLACEMENT_REQUIRED is not an error the learner can act on — it is a
   * missing STEP, and that step is one route away. As a banner it left a kid
   * who tapped the lesson their own /learn page had just offered them looking
   * at "Complete this course's placement quiz first" with a single button,
   * "Back to course" — which lands on the course page and is redirected to
   * that very quiz (CoursePage.tsx). Two screens and a red error to reach
   * where the first tap could have gone.
   *
   * So take them there. `replace` keeps the 403ing lesson URL out of history:
   * the quiz navigates forward into the lesson when it commits, and Back
   * should return to the list rather than to a URL that fails until it does.
   *
   * Only possible when the course is known — courseSlug rides in router state
   * from the link that opened the player. A bare deep link carries no state,
   * so it keeps the banner, which is honest about being stuck.
   */
  if (state.status === 'error' && state.code === 'PLACEMENT_REQUIRED' && courseSlug) {
    return <Navigate to={placementPath(courseSlug)} replace />;
  }

  if (state.status === 'error' && state.code === 'PLACEMENT_REQUIRED') {
    return rebuilt(<LessonTransportStateView state="placement" locale={localeFromI18n(i18n.language)} onBack={goBack} />);
  }

  if (state.status === 'error') {
    const eligibilityState = lessonEligibilityState(state.code);
    if (eligibilityState) return rebuilt(<LessonEligibilityStateView state={eligibilityState} locale={localeFromI18n(i18n.language)} onBack={goBack} />);
    if (state.offline) return rebuilt(<LessonTransportStateView state="offline" locale={localeFromI18n(i18n.language)} onBack={goBack}
      onRetry={() => setLoadRevision((revision) => revision + 1)} />);
    return rebuilt(<LessonTransportStateView state="load-error" locale={localeFromI18n(i18n.language)} onBack={goBack}
      onRetry={() => setLoadRevision((revision) => revision + 1)} />);
  }

  if (!isLegacyLessonDocument(state.document)) {
    return <AuthenticatedLessonDocument raw={state.document} responseLocale={state.locale} mentorStage={state.mentorStage} theme={theme} onBack={goBack}
      onGrade={state.v2Attempt ? gradeV2 : undefined} onGradeNumberLine={state.v2Attempt ? gradeV2NumberLine : undefined}
      onGradeFractionArea={state.v2Attempt ? gradeV2FractionArea : undefined} onGradeBarModel={state.v2Attempt ? gradeV2BarModel : undefined}
      onGradeSchemaDiagram={state.v2Attempt ? gradeV2SchemaDiagram : undefined} onGradeWorkedExample={state.v2Attempt ? gradeV2WorkedExample : undefined}
      onComplete={state.v2Attempt ? completeV2 : undefined} metSegmentIds={state.v2Attempt?.metSegmentIds}
      attemptedSegmentIds={state.v2Attempt?.attemptedSegmentIds} />;
  }

  return (
    <LessonPlayer
      document={state.document}
      lessonId={lessonId}
      grader={grader}
      audio={state.audio}
      recovery={checkpoint.current}
      onCheckpoint={saveCheckpoint}
      onExit={goBack}
      onComplete={(result) => persistCompletion(result.seconds_spent)}
    />
  );
}

/** Reject malformed/mismatched run data before opaque browser tokens reach a visual. */
function validateV2Attempt(document: LessonClientDocument, value: V2RunResponse | null): V2Attempt | null {
  if (!value || typeof value.run_id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.run_id)
    || value.version_id !== document.version_id || typeof value.expires_at !== 'string' || Number.isNaN(Date.parse(value.expires_at))
    || typeof value.resumed !== 'boolean' || !Array.isArray(value.met_segment_ids) || value.met_segment_ids.some((id) => typeof id !== 'string')
    || !value.attempt_tokens || typeof value.attempt_tokens !== 'object' || Array.isArray(value.attempt_tokens)) return null;
  const expected = document.segments.filter(segment => segment.grading === 'server').map(segment => segment.id).sort();
  const supplied = Object.keys(value.attempt_tokens).sort();
  if (expected.length === 0 || expected.length !== supplied.length || expected.some((id, index) => id !== supplied[index])) return null;
  if (supplied.some((id) => typeof value.attempt_tokens[id] !== 'string' || value.attempt_tokens[id]!.length === 0)) return null;
  const metSegmentIds = [...new Set(value.met_segment_ids)].sort();
  if (metSegmentIds.some((id) => !expected.includes(id))) return null;
  if (value.attempted_segment_ids !== undefined
    && (!Array.isArray(value.attempted_segment_ids) || value.attempted_segment_ids.some((id) => typeof id !== 'string'))) return null;
  const attemptedSegmentIds = value.attempted_segment_ids === undefined ? [] : [...new Set(value.attempted_segment_ids)].sort();
  if (attemptedSegmentIds.some((id) => !expected.includes(id))) return null;
  if (!isOrderedCpaAttemptProjection(document, attemptedSegmentIds)) return null;
  return { runId: value.run_id, versionId: value.version_id, tokens: value.attempt_tokens, metSegmentIds, attemptedSegmentIds };
}

/** A recovery projection cannot skip a CPA experience and jump the learner ahead. */
function isOrderedCpaAttemptProjection(document: LessonClientDocument, attemptedSegmentIds: string[]): boolean {
  const stages = document.representation_progressions?.[0]?.stages;
  if (!stages || attemptedSegmentIds.length === 0) return true;
  const attempted = new Set(attemptedSegmentIds);
  return stages.every((stage, index) => !attempted.has(stage.segment_id)
    || stages.slice(0, index).every((previous) => attempted.has(previous.segment_id)));
}

function isLegacyLessonDocument(document: unknown): document is LessonDocument {
  return typeof document === 'object' && document !== null && !Array.isArray(document)
    && (document as { schema_version?: unknown }).schema_version === 1;
}

function localeFromI18n(value: string): Locale {
  return value === 'es-MX' || value === 'pt-BR' ? value : 'en-US';
}

function lessonEligibilityState(code: string): LessonEligibilityState | null {
  if (code === 'LESSON_AGE_ELIGIBILITY_REQUIRED') return 'required';
  if (code === 'LESSON_AGE_RESTRICTED') return 'restricted';
  if (code === 'LESSON_ELIGIBILITY_MISSING') return 'unavailable';
  return null;
}

export default LessonRoute;
