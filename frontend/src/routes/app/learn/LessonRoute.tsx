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
import { AuthenticatedLessonDocument } from '@/rebuild/learning/AuthenticatedLessonDocument';
import type { OnGrade, OnGradeBarModel, OnGradeFractionArea, OnGradeNumberLine, OnGradeReasoning, OnGradeSchemaDiagram, OnGradeWorkedExample } from '@/rebuild/learning/LessonDocumentView';
import { LessonResultView } from '@/rebuild/learning/LessonResultView';
import type { JudgmentQuality } from '@/rebuild/learning/DecisionReasonsBoard';
import { LessonEligibilityStateView, type LessonEligibilityState } from '@/rebuild/learning/LessonEligibilityStateView';
import { LessonTransportStateView } from '@/rebuild/learning/LessonTransportStateView';
import { NarrativeRecallView } from '@/rebuild/learning/NarrativeRecallView';
import { parseNarrativeRecall, type NarrativeRecall } from '@/rebuild/learning/narrative';
import { useTheme } from '@/theme/useTheme';
import type { Locale } from '@/rebuild/design/copyBudget';
import { loadLessonClientDocument, type LessonClientDocument } from '@/rebuild/learning/lessonDocument';
import { GuidedReviewOffer, guidedReviewOfferSchema, type GuidedReviewOfferValue } from '@/rebuild/learning/GuidedReviewOffer';
import { fetchLearnerRegister, registerForBand, registerOf, type RegisterState } from '@/rebuild/learning/learnerRegister';
import { guidedReviewPath } from './paths';

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
  /** B.9 (S05.3c): an earlier, relevant story decision Core resurfaced for this lesson. */
  narrative_recall?: unknown;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: string; offline: boolean }
  | { status: 'ready'; document: unknown; locale: string; audio: AudioManifest; mentorStage: unknown; v2Attempt: V2Attempt | null; recall: NarrativeRecall | null };

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
  // B.5 (S05.3d): Core's authenticated completion receipt for a v2 lesson.
  const [v2Receipt, setV2Receipt] = useState<unknown>(null);
  // B.9: the recall shows once, before the lesson, and never over a lesson resumed mid-way.
  const [recallDone, setRecallDone] = useState(() => (initialCheckpoint.state?.index ?? 0) > 0);
  const { isDark } = useTheme();
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
  // B.26 / OD-1 (S05.3f): a miss costs nothing; consecutive misses on one
  // skill bring the learner's Mentor's offer to review it (never a lock).
  const [guidedReview, setGuidedReview] = useState<GuidedReviewOfferValue | null>(null);
  // B.23: the offer is worded in the learner's register, which Core resolves.
  // Read only once an offer exists (most lessons never need it); until then,
  // and if it fails, the youngest register is the reading.
  const [register, setRegister] = useState<RegisterState>({ status: 'loading' });
  const registerRequested = useRef(false);
  useEffect(() => {
    if (!guidedReview || registerRequested.current) return;
    registerRequested.current = true;
    void fetchLearnerRegister(async (path, init) => {
      const token = await getToken();
      if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
      return api<unknown>(path, { token, method: init?.method, body: init?.body });
    }).then((next) => { if (active.current) setRegister(next); });
  }, [guidedReview, getToken]);
  const grader = useMemo(() => createCoreGrader(lessonId, getToken, runId, { onGuidedReview: setGuidedReview }), [lessonId, getToken, runId]);
  const withOffer = (node: JSX.Element) => guidedReview ? <>{node}<GuidedReviewOffer offer={guidedReview} register={registerOf(register)}
    locale={localeFromI18n(i18n.language)} dark={isDark} onDecline={() => setGuidedReview(null)}
    onReview={(skillKey) => navigate(guidedReviewPath(skillKey))} /></> : node;

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
        setState({ status: 'ready', document: data.document, locale: data.locale, audio: data.audio ?? {}, mentorStage: data.mentor_stage, v2Attempt: null, recall: parseNarrativeRecall(data.narrative_recall) });
        return;
      }
      const clientDocument = loadLessonClientDocument(data.document);
      // Ungraded visual lessons remain presentation-only until the separate
      // version-pinned completion design exists; there is no token to request.
      if (clientDocument.status !== 'ready' || !clientDocument.document.segments.some(segment => segment.grading === 'server')) {
        setState({ status: 'ready', document: data.document, locale: data.locale, audio: data.audio ?? {}, mentorStage: data.mentor_stage, v2Attempt: null, recall: parseNarrativeRecall(data.narrative_recall) });
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
      setState({ status: 'ready', document: data.document, locale: data.locale, audio: data.audio ?? {}, mentorStage: data.mentor_stage, v2Attempt: attempt, recall: parseNarrativeRecall(data.narrative_recall) });
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, getToken, loadRevision]);

  const submitV2GradeDetailed = useCallback(async (answer: unknown, segmentId: string, document: LessonClientDocument) => {
    const attempt = state.status === 'ready' ? state.v2Attempt : null;
    if (!attempt || attempt.versionId !== document.version_id) throw new Error('No matching lesson attempt');
    const attemptToken = attempt.tokens[segmentId];
    const token = await getToken();
    if (!attemptToken || !token) throw new Error('No lesson attempt token');
    const { data, error } = await api<{ verdict: { correct: boolean; score: number; judgment?: { quality?: unknown } }; replayed: boolean; retry_attempt_token?: string; guided_review?: unknown }>(`/learn/lessons/${lessonId}/grade`, {
      method: 'POST', token, body: { segment_id: segmentId, answer, run_id: attempt.runId, attempt_token: attemptToken },
    });
    if (error || !data || (data.verdict.score !== 0 && data.verdict.score !== 100)) throw new Error('Could not grade v2 segment');
    const offer = guidedReviewOfferSchema.safeParse(data.guided_review);
    if (offer.success) setGuidedReview(offer.data);
    if (!data.verdict.correct && !data.replayed) {
      if (typeof data.retry_attempt_token !== 'string' || data.retry_attempt_token.length === 0) throw new Error('Could not renew v2 lesson attempt');
      setState((current) => current.status === 'ready' && current.v2Attempt?.runId === attempt.runId
        ? { ...current, v2Attempt: { ...current.v2Attempt, tokens: { ...current.v2Attempt.tokens, [segmentId]: data.retry_attempt_token! } } }
        : current);
    }
    const quality = data.verdict.judgment?.quality;
    const judgment: JudgmentQuality | undefined = quality === 'sound' || quality === 'partial' || quality === 'unsupported' ? quality : undefined;
    return { verdict: data.verdict.correct ? 'met' as const : 'review' as const, judgment };
  }, [getToken, lessonId, state]);
  const submitV2Grade = useCallback(async (answer: unknown, segmentId: string, document: LessonClientDocument) =>
    (await submitV2GradeDetailed(answer, segmentId, document)).verdict, [submitV2GradeDetailed]);

  const gradeV2: OnGrade = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2NumberLine: OnGradeNumberLine = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2FractionArea: OnGradeFractionArea = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2BarModel: OnGradeBarModel = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2SchemaDiagram: OnGradeSchemaDiagram = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2WorkedExample: OnGradeWorkedExample = useCallback((answer, segmentId, document) => submitV2Grade(answer, segmentId, document), [submitV2Grade]);
  const gradeV2Reasoning: OnGradeReasoning = useCallback((answer, segmentId, document) => submitV2GradeDetailed(answer, segmentId, document), [submitV2GradeDetailed]);
  const completeV2 = useCallback(async () => {
    const attempt = state.status === 'ready' ? state.v2Attempt : null;
    const token = await getToken();
    if (!attempt || !token) return false;
    const d = new Date();
    const { data, error } = await api<ServerCompletion & { receipt?: unknown }>(`/learn/lessons/${lessonId}/complete`, {
      method: 'POST', token, body: { run_id: attempt.runId, seconds_spent: Math.min(7200, Math.max(1, Math.round((Date.now() - v2EnteredAt.current) / 1000))), local_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` },
    });
    if (!error) {
      completedRef.current = true; clearCoursesCache();
      // The result screen validates the receipt itself and shows its own unavailable state otherwise.
      if (data?.receipt) setV2Receipt(data.receipt);
    }
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
    return <LessonTransportStateView state="opening" locale={localeFromI18n(i18n.language)} onBack={goBack} />;
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
    return <LessonTransportStateView state="placement" locale={localeFromI18n(i18n.language)} onBack={goBack} />;
  }

  if (state.status === 'error') {
    const eligibilityState = lessonEligibilityState(state.code);
    if (eligibilityState) return <LessonEligibilityStateView state={eligibilityState} locale={localeFromI18n(i18n.language)} onBack={goBack} />;
    if (state.offline) return <LessonTransportStateView state="offline" locale={localeFromI18n(i18n.language)} onBack={goBack}
      onRetry={() => setLoadRevision((revision) => revision + 1)} />;
    return <LessonTransportStateView state="load-error" locale={localeFromI18n(i18n.language)} onBack={goBack}
      onRetry={() => setLoadRevision((revision) => revision + 1)} />;
  }

  if (state.recall && !recallDone) {
    return <NarrativeRecallView recall={state.recall} locale={localeFromI18n(i18n.language)} dark={isDark} onContinue={() => setRecallDone(true)} />;
  }

  if (v2Receipt) {
    // The receipt is written in the lesson's own locale, which is the response locale.
    const receiptLocale = state.status === 'ready' && ['en-US', 'es-MX', 'pt-BR'].includes(state.locale) ? state.locale as Locale : localeFromI18n(i18n.language);
    // B.23: a v2 lesson declares its audience band, and Core admits only learners inside it (S05.2a).
    const band = state.status === 'ready' ? (state.document as { age_band?: unknown }).age_band : undefined;
    const resultRegister = band === '6-9' || band === '10-12' || band === '13-17' || band === 'adult' ? registerForBand(band) : registerOf(register);
    return <LessonResultView rawReceipt={v2Receipt} locale={receiptLocale} dark={isDark} onContinue={goBack} register={resultRegister}
      onNoticeShown={() => trackInsight('replay_notice_view', { lessonId, routeClass: 'learn' })} />;
  }

  if (!isLegacyLessonDocument(state.document)) {
    return withOffer(<AuthenticatedLessonDocument raw={state.document} responseLocale={state.locale} mentorStage={state.mentorStage} onBack={goBack}
      onGrade={state.v2Attempt ? gradeV2 : undefined} onGradeNumberLine={state.v2Attempt ? gradeV2NumberLine : undefined}
      onGradeFractionArea={state.v2Attempt ? gradeV2FractionArea : undefined} onGradeBarModel={state.v2Attempt ? gradeV2BarModel : undefined}
      onGradeSchemaDiagram={state.v2Attempt ? gradeV2SchemaDiagram : undefined} onGradeWorkedExample={state.v2Attempt ? gradeV2WorkedExample : undefined}
      onGradeReasoning={state.v2Attempt ? gradeV2Reasoning : undefined}
      onComplete={state.v2Attempt ? completeV2 : undefined} metSegmentIds={state.v2Attempt?.metSegmentIds}
      attemptedSegmentIds={state.v2Attempt?.attemptedSegmentIds} />);
  }

  return withOffer(
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
