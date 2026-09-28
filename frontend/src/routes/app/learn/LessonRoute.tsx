import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
// The resume checkpoint is a storage record (no UI); the legacy player itself stays behind its island.
import { checkpointKey, newCheckpoint, readCheckpoint, writeCheckpoint } from '@/lesson-engine/player/checkpoint';
import { useTheme } from '@/theme/useTheme';
import { AuthenticatedLessonDocument, lessonDocumentFrame } from '@/rebuild/learning/AuthenticatedLessonDocument';
import type { OnGrade, OnGradeAny, OnGradeBarModel, OnGradeFractionArea, OnGradeNumberLine, OnGradeReasoning, OnGradeSchemaDiagram, OnGradeWorkedExample, OnView } from '@/rebuild/learning/LessonDocumentView';
import { LessonResultView } from '@/rebuild/learning/LessonResultView';
import type { JudgmentQuality } from '@/rebuild/learning/DecisionReasonsBoard';
import { LessonEligibilityStateView, type LessonEligibilityState } from '@/rebuild/learning/LessonEligibilityStateView';
import { LessonTransportStateView, type LessonTransportState } from '@/rebuild/learning/LessonTransportStateView';
import { LessonLayer } from '@/rebuild/learning/LessonLayer';
import { NarrativeRecallView } from '@/rebuild/learning/NarrativeRecallView';
import { parseNarrativeRecall, type NarrativeRecall } from '@/rebuild/learning/narrative';
import type { AgeBand, Locale } from '@/rebuild/design/copyBudget';
import { REGISTERS } from '@/rebuild/design/learnerRegisterPolicy.generated';
import { learnCopy } from '@/rebuild/learning/learnCopy';
import { loadLessonClientDocument, type LessonClientDocument } from '@/rebuild/learning/lessonDocument';
import { GuidedReviewOffer, guidedReviewOfferSchema, type GuidedReviewOfferValue } from '@/rebuild/learning/GuidedReviewOffer';
import { fetchLearnerRegister, registerForBand, registerOf, type RegisterState } from '@/rebuild/learning/learnerRegister';
import { clearCoursesCache } from './coursesCache';
import { isLegacyLessonDocument, LegacyLessonIsland, reconcileLegacyCheckpoint } from './LegacyLessonIsland';
import { coursePath, guidedReviewPath, placementPath } from './paths';

/*
 * /learn/lesson/:lessonId — the learner's lesson route (COURSE_ENGINE.md §2,
 * LESSON_ENGINE.md §7), a full-screen layer of its own outside the app shell:
 * no navigation ever renders behind a lesson.
 *
 * W2L.3: every rebuilt screen of the route renders in ONE lesson layer
 * (`LessonLayer`): opening, Core's refusals, the offline and failure states,
 * the B.9 recall, the v2 lesson with its compact Mentor stage on every board
 * (B.8), the B.5 result with the OD-7 lesson, course, badge and streak
 * moments Core named, and the B.26 guided-review offer. The layer persists
 * across them, so the document title follows the screen and focus moves to
 * each new screen's heading.
 *
 * A published v1 document still plays in the legacy Lesson Player, the one
 * sanctioned legacy island (OD-24), mounted through its single adapter
 * (`LegacyLessonIsland.tsx`) outside the rebuilt layer. Completion
 * persistence and navigation stay separate there: the player keeps its
 * results screen up after `onComplete`, and only `onExit` navigates.
 */

interface LessonResponse {
  /** W2L.4: `course_slug` names the lesson's course, so a deep link still finds its badge and its way back. */
  lesson: { id: string; slug: string; course_slug?: unknown };
  locale: string;
  document: unknown;
  /** Echo's narration manifest for a v1 lesson; the legacy island reads it. */
  audio?: unknown;
  mentor_stage?: unknown;
  /** B.8 (GAP-FIX-R1): the lesson's adventure scene theme, a closed enum. */
  adventure_theme?: unknown;
  /** B.9 (S05.3c): an earlier, relevant story decision Core resurfaced for this lesson. */
  narrative_recall?: unknown;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: string; offline: boolean }
  | { status: 'ready'; document: unknown; locale: string; audio: unknown; mentorStage: unknown; adventureTheme: unknown; v2Attempt: V2Attempt | null; recall: NarrativeRecall | null; courseSlug: string | null };

interface V2RunResponse {
  run_id: string;
  version_id: string;
  expires_at: string;
  resumed: boolean;
  met_segment_ids: string[];
  attempted_segment_ids?: string[];
  viewed_segment_ids?: string[];
  attempt_tokens: Record<string, string>;
}

interface V2Attempt {
  runId: string;
  versionId: string;
  tokens: Record<string, string>;
  metSegmentIds: string[];
  attemptedSegmentIds: string[];
  viewedSegmentIds: string[];
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
  const appLocale = localeFromI18n(i18n.language);
  const { lessonId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken, session } = useAuth();
  const storageKey = session ? checkpointKey(session.user.id, lessonId) : null;
  const [initialCheckpoint] = useState(() => storageKey ? readCheckpoint(storageKey) : newCheckpoint());
  const checkpoint = useRef(initialCheckpoint);
  const v2EnteredAt = useRef(Date.now());
  // Bible 08 §11 / B.10: help-ladder steps opened per segment, sent with its next grade.
  const hintsRef = useRef<Record<string, number>>({});
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [loadRevision, setLoadRevision] = useState(0);
  const retry = useCallback(() => setLoadRevision((revision) => revision + 1), []);
  // B.5 (S05.3d): Core's authenticated completion receipt for a v2 lesson.
  const [v2Receipt, setV2Receipt] = useState<unknown>(null);
  // B.9: the recall shows once, before the lesson, and never over a lesson resumed mid-way.
  const [recallDone, setRecallDone] = useState(() => (initialCheckpoint.state?.index ?? 0) > 0);

  // The link that opened the lesson names its course; a deep link falls back to the course Core names (W2L.4).
  const courseSlug = (location.state as LocationState | null)?.courseSlug ?? (state.status === 'ready' ? state.courseSlug : null);
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
  const reachedResults = useCallback(() => { completedRef.current = true; }, []);
  // B.26 / OD-1 (S05.3f): a miss costs nothing; consecutive misses on one
  // skill bring the learner's Mentor's offer to review it (never a lock).
  const [guidedReview, setGuidedReview] = useState<GuidedReviewOfferValue | null>(null);
  // B.23: the learner's register, which Core resolves from its own age
  // evidence. It words the guided-review offer and (S05.3g) sets the live
  // player's cast presence and milestone motion. Read once per lesson; until it
  // answers, and if it fails, the youngest register is the reading.
  const [register, setRegister] = useState<RegisterState>({ status: 'loading' });
  const registerRequested = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (registerRequested.current) return;
    registerRequested.current = true;
    void fetchLearnerRegister(async (path, init) => {
      const token = await getToken();
      if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
      return api<unknown>(path, { token, method: init?.method, body: init?.body });
    }).then((next) => { if (active.current) setRegister(next); });
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<LessonResponse>(`/learn/lessons/${lessonId}`, { token });
      if (cancelled) return;
      if (error) {
        setState({ status: 'error', code: error.code, offline: isOfflineError(error) });
        return;
      }
      const servedSlug = typeof data.lesson?.course_slug === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(data.lesson.course_slug) ? data.lesson.course_slug : null;
      const ready = { document: data.document, locale: data.locale, audio: data.audio ?? {}, mentorStage: data.mentor_stage, adventureTheme: data.adventure_theme,
        recall: parseNarrativeRecall(data.narrative_recall), courseSlug: servedSlug };
      if (isLegacyLessonDocument(data.document)) {
        checkpoint.current = reconcileLegacyCheckpoint(checkpoint.current, data.document);
        setState({ status: 'ready', ...ready, v2Attempt: null });
        return;
      }
      const clientDocument = loadLessonClientDocument(data.document);
      // GAP-FIX-R1 (OD-17): every playable v2 lesson pins a run, graded or not;
      // non-scored steps complete through Core's view receipts.
      if (clientDocument.status !== 'ready') {
        setState({ status: 'ready', ...ready, v2Attempt: null });
        return;
      }
      const resumeRunId = checkpoint.current.document?.startsWith('v2:') ? checkpoint.current.runId : undefined;
      const started = await api<V2RunResponse>(`/learn/lessons/${lessonId}/v2-runs`, { method: 'POST', token, body: resumeRunId ? { run_id: resumeRunId } : {} });
      if (cancelled) return;
      /*
       * W2L.3: a run that could not start is said as what it is. A lost
       * connection or a Core failure is the offline or retry screen, a refusal
       * is its own screen; only a run Core answered with data that does not
       * match this document fails closed as a lesson that cannot be played.
       */
      if (started.error) {
        setState({ status: 'error', code: started.error.code, offline: isOfflineError(started.error) });
        return;
      }
      const attempt = validateV2Attempt(clientDocument.document, started.data);
      if (attempt) {
        checkpoint.current.runId = attempt.runId;
        checkpoint.current.document = `v2:${attempt.versionId}`;
        if (storageKey) writeCheckpoint(storageKey, checkpoint.current);
      }
      setState({ status: 'ready', ...ready, v2Attempt: attempt });
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, getToken, loadRevision]);

  // W2L.3: an offline screen retries by itself when the connection comes back; the button stays for the learner.
  const offline = state.status === 'error' && state.offline;
  useEffect(() => {
    if (!offline) return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [offline, retry]);

  const submitV2GradeDetailed = useCallback(async (answer: unknown, segmentId: string, document: LessonClientDocument) => {
    const attempt = state.status === 'ready' ? state.v2Attempt : null;
    if (!attempt || attempt.versionId !== document.version_id) throw new Error('No matching lesson attempt');
    const attemptToken = attempt.tokens[segmentId];
    const token = await getToken();
    if (!attemptToken || !token) throw new Error('No lesson attempt token');
    const hints = hintsRef.current[segmentId];
    const { data, error } = await api<{ verdict: { correct: boolean; score: number; judgment?: { quality?: unknown }; diagnostic?: unknown }; replayed: boolean; retry_attempt_token?: string; guided_review?: unknown }>(`/learn/lessons/${lessonId}/grade`, {
      method: 'POST', token, body: { segment_id: segmentId, answer, run_id: attempt.runId, attempt_token: attemptToken, ...(hints ? { hints_used: hints } : {}) },
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
    const diagnostic = typeof data.verdict.diagnostic === 'string' ? data.verdict.diagnostic : undefined;
    return { verdict: data.verdict.correct ? 'met' as const : 'review' as const, judgment, diagnostic };
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
  // GAP-FIX-R1: every newly gradable visual and first-release family grades through one handler.
  const gradeV2Any: OnGradeAny = useCallback(async (answer, segmentId, document) => {
    const graded = await submitV2GradeDetailed(answer, segmentId, document);
    return { verdict: graded.verdict, ...(graded.diagnostic ? { diagnostic: graded.diagnostic } : {}) };
  }, [submitV2GradeDetailed]);
  // OD-17: a non-scored step is recorded with Core before the player moves past it.
  const viewV2: OnView = useCallback(async (segmentId, document) => {
    const attempt = state.status === 'ready' ? state.v2Attempt : null;
    const token = await getToken();
    if (!attempt || attempt.versionId !== document.version_id || !token) return false;
    const { error } = await api<{ recorded: boolean }>(`/learn/lessons/${lessonId}/v2-runs/${attempt.runId}/views`, {
      method: 'POST', token, body: { segment_id: segmentId },
    });
    return !error;
  }, [getToken, lessonId, state]);
  const helpUsed = useCallback((segmentId: string, steps: number) => {
    hintsRef.current[segmentId] = Math.max(hintsRef.current[segmentId] ?? 0, Math.min(2, steps));
  }, []);
  const completeV2 = useCallback(async () => {
    const attempt = state.status === 'ready' ? state.v2Attempt : null;
    const token = await getToken();
    if (!attempt || !token) return false;
    const d = new Date();
    const { data, error } = await api<{ receipt?: unknown }>(`/learn/lessons/${lessonId}/complete`, {
      method: 'POST', token, body: { run_id: attempt.runId, seconds_spent: Math.min(7200, Math.max(1, Math.round((Date.now() - v2EnteredAt.current) / 1000))), local_date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` },
    });
    if (!error) {
      completedRef.current = true; clearCoursesCache();
      // The result screen validates the receipt itself and shows its own unavailable state otherwise.
      if (data?.receipt) setV2Receipt(data.receipt);
    }
    return !error;
  }, [getToken, lessonId, state]);

  const goBack = useCallback(() => {
    navigate(courseSlug ? coursePath(courseSlug) : '/learn');
  }, [navigate, courseSlug]);

  const offer = guidedReview ? <GuidedReviewOffer offer={guidedReview} register={registerOf(register)}
    locale={appLocale} dark={isDark} onDecline={() => setGuidedReview(null)}
    onReview={(skillKey) => navigate(guidedReviewPath(skillKey))} /> : null;
  const lessonTitle = learnCopy[appLocale].lesson.pageTitle;
  const layer = (screen: string, view: JSX.Element, frame: { locale?: Locale; ageBand?: AgeBand; pageTitle?: string } = {}) =>
    <LessonLayer theme={theme} locale={frame.locale ?? appLocale} ageBand={frame.ageBand} screen={screen}
      pageTitle={frame.pageTitle ?? learnCopy[frame.locale ?? appLocale].lesson.pageTitle}>{view}{offer}</LessonLayer>;

  if (state.status === 'loading') {
    return layer('opening', <LessonTransportStateView state="opening" locale={appLocale} onBack={goBack} />);
  }

  /*
   * PLACEMENT_REQUIRED is not an error the learner can act on — it is a
   * missing STEP, and that step is one route away. `replace` keeps the
   * 403ing lesson URL out of history: the placement flow navigates forward
   * into the lesson when it commits. Only possible when the course is known —
   * courseSlug rides in router state from the link that opened the lesson. A
   * bare deep link carries no state, so it keeps the honest placement screen.
   */
  if (state.status === 'error' && state.code === 'PLACEMENT_REQUIRED' && courseSlug) {
    return <Navigate to={placementPath(courseSlug)} replace />;
  }

  if (state.status === 'error') {
    const screen = lessonErrorScreen(state.code, state.offline);
    return layer(`error:${screen.state}`, screen.kind === 'eligibility'
      ? <LessonEligibilityStateView state={screen.state} locale={appLocale} onBack={goBack} />
      : <LessonTransportStateView state={screen.state} locale={appLocale} onBack={goBack} onRetry={screen.retry ? retry : undefined} />);
  }

  if (state.recall && !recallDone) {
    return layer('recall', <NarrativeRecallView recall={state.recall} locale={appLocale} dark={isDark} onContinue={() => setRecallDone(true)} />);
  }

  if (v2Receipt) {
    // The receipt is written in the lesson's own locale, which is the response locale.
    const receiptLocale = ['en-US', 'es-MX', 'pt-BR'].includes(state.locale) ? state.locale as Locale : appLocale;
    // B.23: a v2 lesson declares its audience band, and Core admits only learners inside it (S05.2a).
    const band = (state.document as { age_band?: unknown }).age_band;
    const resultRegister = band === '6-9' || band === '10-12' || band === '13-17' || band === 'adult' ? registerForBand(band) : registerOf(register);
    return layer('result', <LessonResultView rawReceipt={v2Receipt} locale={receiptLocale} dark={isDark} onContinue={goBack} register={resultRegister}
      courseSlug={courseSlug} onNoticeShown={() => trackInsight('replay_notice_view', { lessonId, routeClass: 'learn' })} />,
    { locale: receiptLocale, ageBand: REGISTERS[resultRegister].copyBand, pageTitle: learnCopy[receiptLocale].lesson.resultTitle });
  }

  if (!isLegacyLessonDocument(state.document)) {
    const frame = lessonDocumentFrame(state.document, state.locale);
    return layer('lesson', <AuthenticatedLessonDocument raw={state.document} responseLocale={state.locale} mentorStage={state.mentorStage} adventureTheme={state.adventureTheme} theme={theme} onBack={goBack}
      onGrade={state.v2Attempt ? gradeV2 : undefined} onGradeNumberLine={state.v2Attempt ? gradeV2NumberLine : undefined}
      onGradeFractionArea={state.v2Attempt ? gradeV2FractionArea : undefined} onGradeBarModel={state.v2Attempt ? gradeV2BarModel : undefined}
      onGradeSchemaDiagram={state.v2Attempt ? gradeV2SchemaDiagram : undefined} onGradeWorkedExample={state.v2Attempt ? gradeV2WorkedExample : undefined}
      onGradeReasoning={state.v2Attempt ? gradeV2Reasoning : undefined} onGradeAny={state.v2Attempt ? gradeV2Any : undefined}
      onView={state.v2Attempt ? viewV2 : undefined} onHelpUsed={helpUsed}
      onComplete={state.v2Attempt ? completeV2 : undefined} metSegmentIds={state.v2Attempt?.metSegmentIds}
      attemptedSegmentIds={state.v2Attempt?.attemptedSegmentIds} viewedSegmentIds={state.v2Attempt?.viewedSegmentIds} />,
    { locale: frame.locale, ageBand: frame.ageBand, pageTitle: frame.title ?? lessonTitle });
  }

  // OD-24: the published v1 catalog, in its one legacy island, outside the rebuilt layer.
  return <>
    <LegacyLessonIsland lessonId={lessonId} document={state.document} audio={state.audio} checkpoint={checkpoint} storageKey={storageKey}
      register={registerOf(register)} onGuidedReview={setGuidedReview} onReachedResults={reachedResults} onExit={goBack} />
    {offer}
  </>;
}

/** Reject malformed/mismatched run data before opaque browser tokens reach a visual. */
function validateV2Attempt(document: LessonClientDocument, value: V2RunResponse | null): V2Attempt | null {
  if (!value || typeof value.run_id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.run_id)
    || value.version_id !== document.version_id || typeof value.expires_at !== 'string' || Number.isNaN(Date.parse(value.expires_at))
    || typeof value.resumed !== 'boolean' || !Array.isArray(value.met_segment_ids) || value.met_segment_ids.some((id) => typeof id !== 'string')
    || !value.attempt_tokens || typeof value.attempt_tokens !== 'object' || Array.isArray(value.attempt_tokens)) return null;
  const expected = document.segments.filter(segment => segment.grading === 'server').map(segment => segment.id).sort();
  const supplied = Object.keys(value.attempt_tokens).sort();
  // GAP-FIX-R1: a lesson with no graded step pins a run with no tokens; its steps complete by view receipts.
  if (expected.length !== supplied.length || expected.some((id, index) => id !== supplied[index])) return null;
  if (supplied.some((id) => typeof value.attempt_tokens[id] !== 'string' || value.attempt_tokens[id]!.length === 0)) return null;
  const metSegmentIds = [...new Set(value.met_segment_ids)].sort();
  if (metSegmentIds.some((id) => !expected.includes(id))) return null;
  if (value.attempted_segment_ids !== undefined
    && (!Array.isArray(value.attempted_segment_ids) || value.attempted_segment_ids.some((id) => typeof id !== 'string'))) return null;
  const attemptedSegmentIds = value.attempted_segment_ids === undefined ? [] : [...new Set(value.attempted_segment_ids)].sort();
  if (attemptedSegmentIds.some((id) => !expected.includes(id))) return null;
  if (!isOrderedCpaAttemptProjection(document, attemptedSegmentIds)) return null;
  const viewable = document.segments.filter(segment => segment.grading === 'none').map(segment => segment.id);
  if (value.viewed_segment_ids !== undefined
    && (!Array.isArray(value.viewed_segment_ids) || value.viewed_segment_ids.some((id) => typeof id !== 'string' || !viewable.includes(id)))) return null;
  const viewedSegmentIds = [...new Set(value.viewed_segment_ids ?? [])].sort();
  return { runId: value.run_id, versionId: value.version_id, tokens: value.attempt_tokens, metSegmentIds, attemptedSegmentIds, viewedSegmentIds };
}

/** A recovery projection cannot skip a CPA experience and jump the learner ahead. */
function isOrderedCpaAttemptProjection(document: LessonClientDocument, attemptedSegmentIds: string[]): boolean {
  const stages = document.representation_progressions?.[0]?.stages;
  if (!stages || attemptedSegmentIds.length === 0) return true;
  const attempted = new Set(attemptedSegmentIds);
  return stages.every((stage, index) => !attempted.has(stage.segment_id)
    || stages.slice(0, index).every((previous) => attempted.has(previous.segment_id)));
}

function localeFromI18n(value: string): Locale {
  return value === 'es-MX' || value === 'pt-BR' ? value : 'en-US';
}

/** A transport failure (the API client's network error) or a browser that knows it is offline. */
function isOfflineError(error: { message?: string }): boolean {
  return /offline|network|fetch/i.test(error.message ?? '') || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

type ErrorScreen =
  | { kind: 'eligibility'; state: LessonEligibilityState }
  | { kind: 'transport'; state: LessonTransportState; retry: boolean };

/**
 * W2L.3: every answer Core gives the lesson route has its own screen. A
 * refusal no retry can change never offers one (it would only fail again);
 * a lost connection or a Core failure always does.
 */
export function lessonErrorScreen(code: string, offline: boolean): ErrorScreen {
  switch (code) {
    case 'LESSON_AGE_ELIGIBILITY_REQUIRED': return { kind: 'eligibility', state: 'required' };
    case 'LESSON_AGE_RESTRICTED':
    case 'COURSE_AGE_RESTRICTED': return { kind: 'eligibility', state: 'restricted' };
    case 'LESSON_ELIGIBILITY_MISSING':
    case 'UNSUPPORTED_LESSON': return { kind: 'eligibility', state: 'unavailable' };
    case 'PLACEMENT_REQUIRED': return { kind: 'transport', state: 'placement', retry: false };
    case 'LESSON_LOCKED': return { kind: 'transport', state: 'locked', retry: false };
    case 'COURSE_PREREQUISITE_REQUIRED': return { kind: 'transport', state: 'prerequisite', retry: false };
    case 'NOT_FOUND': return { kind: 'transport', state: 'not-found', retry: false };
    default: return offline ? { kind: 'transport', state: 'offline', retry: true } : { kind: 'transport', state: 'load-error', retry: true };
  }
}

export default LessonRoute;
