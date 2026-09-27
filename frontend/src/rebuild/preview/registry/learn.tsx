import { useState, type ReactNode } from 'react';
import { allocationPilotDocument, donutPilotDocument, wafflePilotDocument } from '../../learning/AllocationBoard';
import { growthPilotDocument } from '../../learning/GrowthBoard';
import { learningFixtures } from '../../learning/allocationFixtures';
import { scoreV2Judgment, scoreV2Visual } from '../../learning/v2VisualScorer.generated';
import { LessonDocumentView } from '../../learning/LessonDocumentView';
import { numberLinePilotDocument } from '../../learning/NumberLineBoard';
import { sequencePilotDocument } from '../../learning/sequencePilotDocument';
import { LessonResultView } from '../../learning/LessonResultView';
import { goalBulletPilotDocument } from '../../learning/GoalBulletBoard';
import { percentGridPilotDocument } from '../../learning/PercentGridBoard';
import { placeValuePilotDocument } from '../../learning/PlaceValueBoard';
import { savingsRulePilotDocument } from '../../learning/SavingsRuleBoard';
import { runningLedgerPilotDocument } from '../../learning/RunningLedgerBoard';
import { growthComparisonPilotDocument } from '../../learning/GrowthComparisonBoard';
import { ratioTablePilotDocument } from '../../learning/RatioTableBoard';
import { taxBracketPilotDocument } from '../../learning/TaxBracketBoard';
import { fractionNumberLinePilotDocument } from '../../learning/FractionNumberLineBoard';
import { fractionAreaPilotDocument } from '../../learning/FractionAreaBoard';
import { barModelPilotDocument } from '../../learning/BarModelBoard';
import { schemaDiagramPilotDocument } from '../../learning/SchemaDiagramBoard';
import { workedExamplePilotDocument } from '../../learning/WorkedExampleBoard';
import { functionMachinePilotDocument } from '../../learning/FunctionMachineBoard';
import { cpaFadingPilotDocument } from '../../learning/CpaFadingBoard';
import { DECIDE_JUSTIFY_PILOT_RUBRIC, decideJustifyPilotDocument } from '../../learning/DecisionReasonsBoard';
import { PlacementOutcomeView } from '../../learning/PlacementOutcomeView';
import { PlacementFlowView } from '../../learning/PlacementFlowView';
import { placementPreviewFlow } from '../../learning/placementFixtures';
import { TerritoryMapView } from '../../learning/TerritoryMapView';
import { territoryPreviewStates } from '../../learning/territoryFixtures';
import { SingleStateScreen, type MentorCharacter } from '../../design/controls';
import { LessonTransportStateView } from '../../learning/LessonTransportStateView';
import { CourseView } from '../../learning/CourseView';
import { childPathFixture, coursePathPreviewStates } from '../../learning/coursePathFixtures';
import { LearnHomeView } from '../../learning/LearnHomeView';
import { SHELF_TITLES, childTree, coursePreviewStates, homePreviewShelf } from '../../learning/learnHomeFixtures';
import type { LearnLinks } from '../../learning/learnCopy';
import { NarrativeRecallView } from '../../learning/NarrativeRecallView';
import { DecisionJournalView } from '../../learning/DecisionJournalView';
import { LearnerNarrativeShortcut } from '../../learning/LearnerNarrativeShortcut';
import { journalPreviewStates, recallFixture, selfBridgesFixture } from '../../learning/narrativeFixtures';
import type { LessonMentorStage } from '../../learning/lessonDocument';
import { LearningRhythmView } from '../../learning/LearningRhythmView';
import { milestoneReceipt, rhythmPreviewStates } from '../../learning/motivationFixtures';
import { RegisterGraduationView } from '../../learning/RegisterGraduationView';
import { GuidedReviewOffer } from '../../learning/GuidedReviewOffer';
import { framed, type PreviewContext, type PreviewRegistry } from './types';

/*
 * Lane 2 (learn): the lesson player in every state, the teaching boards at the
 * ages each serves, results, placement, the course path, narrative and rhythm.
 */

/*
 * The preview's compact-stage fixture. OD-19: this stays fixed to Dina on
 * diorama-a ONLY here — the authenticated lesson route consumes the real
 * server-resolved projection instead.
 */
export const PREVIEW_MENTOR_STAGE: LessonMentorStage = { character: 'dina', scene: 'diorama-a' };

type Verdict = 'met' | 'review' | 'invalid';
const verdict = (result: string): Verdict => result === 'met' || result === 'review' ? result : 'invalid';

/*
 * W2L.1: the learner pages render no <main> of their own (on a real route the
 * learner shell's is the one landmark); the preview stands in for the shell.
 */
const LearnPreviewHost = ({ children }: { children: ReactNode }) => <main className="lf-learn-preview-host">{children}</main>;

/* W2L.1: the learner pages' links, as preview screens (a plain press opens that screen in place). */
const previewLinks: LearnLinks = {
  home: '?screen=learnhome', course: () => '?screen=course', lesson: () => '?screen=lesson', placement: () => '?screen=placement',
  territory: () => '?screen=territory', rhythm: '?screen=rhythm', journal: '?screen=journal',
};

/*
 * W2L.2: the placement flow on the shared single-state screen, as its route
 * mounts it (sky hue, no app navigation), in every state (`?flow=`); a press
 * moves to the next fixture state in place. `?mentor=` is the chosen
 * character (`none` before a choice).
 */
function PlacementPreview({ locale, theme, ageBand, params, go, t }: PreviewContext) {
  const [state, setState] = useState(params.get('flow') ?? 'welcome');
  const mentorParam = params.get('mentor') ?? 'zara';
  const mentor: MentorCharacter | null = (['rho', 'zara', 'liruf', 'dina'] as const).find((name) => name === mentorParam) ?? null;
  return <SingleStateScreen appName="LittleFounders" pageTitle={t.course.placementTitle} routeKey="placement" locale={locale} hue="sky" labels={{ skip: t.appShell.skip }}>
    <PlacementFlowView key={`${locale}:${state}`} fixture flow={placementPreviewFlow(state, locale, setState)} slug="financial-education" locale={locale}
      dark={theme === 'dark'} ageBand={ageBand} mentor={mentor} links={previewLinks} onNavigate={previewNavigate(go)} />
  </SingleStateScreen>;
}
const previewNavigate = (go: PreviewContext['go']) => (href: string) => go(new URLSearchParams(href.replace(/^[^?]*\?/, '')).get('screen') ?? 'home');

const transport = framed(({ screen, locale, go }) => <LessonTransportStateView state={screen === 'loaderror' ? 'load-error' : screen as 'opening' | 'offline'}
  locale={locale} onBack={() => go('home')} onRetry={() => go('lesson')} />);

const refusal = framed(({ screen, locale, ageBand, go }) => <LessonDocumentView key={`${screen}:${locale}:${ageBand}`}
  raw={screen === 'upgrade' ? { ...allocationPilotDocument(locale, ageBand) as Record<string, unknown>, schema_version: 3 }
    : { ...allocationPilotDocument(locale, ageBand) as Record<string, unknown>, segments: [] }}
  locale={locale} ageBand={ageBand} onBack={() => go('home')} />);

const result = framed(({ screen, locale, go }) => <LessonResultView locale={locale} onContinue={() => go('home')} fixture rawReceipt={{
  schema_version: 2, completion_id: 'sample-completion-1', lesson_id: 'pilot-savings-sequence', version_id: 'rev-1', locale,
  first_try_correct: screen === 'replay' ? 2 : 3, graded_count: 4, awarded_xp: 40, duration_seconds: 200,
  previous_best_percent: screen === 'replay' ? 90 : 60,
  // What Core sends for a passed first completion (backend celebrationBudget.ts): the one milestone this screen
  // celebrates. The replay fixture keeps its saved best and shows no celebration.
  ...(screen === 'result' ? { celebrations: ['lesson-complete'] } : {}),
}} />);

/** A board lesson with no grading callback, shown only at the ages it serves (null otherwise). */
const board = (build: (context: PreviewContext) => unknown) => framed((context) => {
  const { screen, locale, ageBand, go } = context;
  return <LessonDocumentView key={`${screen}:${locale}:${ageBand}`} raw={build(context)} locale={locale} ageBand={ageBand} onBack={() => go('home')} />;
});

export const learnPreviewScreens: PreviewRegistry = {
  opening: transport,
  offline: transport,
  loaderror: transport,
  upgrade: refusal,
  invalid: refusal,
  lesson: framed(({ locale, ageBand, theme, params, go }) => <LessonDocumentView key={`${locale}:${ageBand}`} raw={allocationPilotDocument(locale, ageBand)} locale={locale} ageBand={ageBand}
    theme={theme} onBack={() => go('home')} mentorStage={params.get('stage') === '1' ? PREVIEW_MENTOR_STAGE : null}
    onGrade={(allocation) => {
      const item = learningFixtures[ageBand].item;
      return verdict(scoreV2Visual('money.allocation.v2', { total: item.total, step: item.step }, allocation, { minimumSave: item.minimumSave }));
    }} />),
  waffle: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`waffle:${locale}:${ageBand}`}
    raw={ageBand === '6-9' ? wafflePilotDocument(locale) : null} locale={locale} ageBand={ageBand}
    onBack={() => go('home')} onGrade={(allocation) => verdict(scoreV2Visual('money.allocation.v2', { total: 10, step: 1 }, allocation, { minimumSave: 3 }))} />),
  donut: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`donut:${locale}:${ageBand}`}
    raw={ageBand === '10-12' ? donutPilotDocument(locale) : null} locale={locale} ageBand={ageBand}
    onBack={() => go('home')} onGrade={(allocation) => verdict(scoreV2Visual('money.allocation.v2', { total: 60, step: 5 }, allocation, { minimumSave: 20 }))} />),
  timeline: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`growth:${locale}:${ageBand}`} raw={growthPilotDocument(locale, ageBand)} locale={locale} ageBand={ageBand}
    onBack={() => go('home')} />),
  sequence: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`sequence:${locale}`} raw={ageBand === '6-9' ? sequencePilotDocument(locale) : null}
    locale={locale} ageBand={ageBand} onBack={() => go('home')} previewSequence
    onGrade={(allocation) => {
      const item = learningFixtures['6-9'].item;
      return verdict(scoreV2Visual('money.allocation.v2', { total: item.total, step: item.step }, allocation, { minimumSave: item.minimumSave }));
    }} />),
  numberline: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`numberline:${locale}:${ageBand}`}
    raw={ageBand === '6-9' || ageBand === '10-12' ? numberLinePilotDocument(locale, ageBand) : null} locale={locale} ageBand={ageBand}
    onBack={() => go('home')} onGradeNumberLine={({ value }) => verdict(scoreV2Visual('math.number-line.whole.v2', { minimum: 0, maximum: ageBand === '6-9' ? 10 : 100, step: 1 },
      { value }, { target: ageBand === '6-9' ? 7 : 37 }))} />),
  // The S05.3b course path's fixtures, now on the one course screen (W2L.1) under the pathway engine.
  coursepath: framed(({ locale, theme, ageBand, params, go }) => <LearnPreviewHost><CourseView key={`coursepath:${locale}`} fixture locale={locale} dark={theme === 'dark'} ageBand={ageBand}
    slug="financial-education" state={coursePathPreviewStates[params.get('path') ?? 'child'] ?? coursePathPreviewStates.child!}
    courseTitles={{ entre: 'Entrepreneurship' }} links={previewLinks} onNavigate={previewNavigate(go)} onRetry={() => go('coursepath')} /></LearnPreviewHost>),
  // W2L.1 (L2): the one course screen in every state, both course engines (`?course=`).
  course: framed(({ locale, theme, ageBand, params, go }) => <LearnPreviewHost><CourseView key={`course:${locale}:${params.get('course')}`} fixture locale={locale} dark={theme === 'dark'} ageBand={ageBand}
    slug="financial-education" state={coursePreviewStates[params.get('course') ?? 'linear'] ?? coursePreviewStates.linear!} inProgress={params.get('building') === '1'}
    courseTitles={Object.fromEntries(Object.entries(SHELF_TITLES).map(([slug, title]) => [slug, title[locale]]))}
    links={previewLinks} onNavigate={previewNavigate(go)} onRetry={() => go('course')} /></LearnPreviewHost>),
  // W2L.1 (L1): the learner home in every state (`?home=`, `?rhythm=`, `?bridges=1`, `?graduation=1`).
  learnhome: framed(({ locale, theme, ageBand, params, go }) => {
    const home = params.get('home') ?? 'child';
    const shelf = homePreviewShelf(home);
    const featured = { slug: 'financial-education', state: home === 'teen' || home === 'young'
      ? { status: 'ready' as const, detail: { engine: 'pathway' as const, path: childPathFixture() } }
      : { status: 'ready' as const, detail: { engine: 'linear' as const, tree: childTree(params.get('placement') === '1') } } };
    return <LearnPreviewHost><LearnHomeView key={`learnhome:${locale}:${home}`} fixture locale={locale} dark={theme === 'dark'} ageBand={ageBand} name={params.get('name') === '0' ? null : 'Sofía'}
      shelf={shelf} featured={featured} rhythm={rhythmPreviewStates[params.get('rhythm') ?? 'open'] ?? rhythmPreviewStates.open!}
      bridges={params.get('bridges') === '1' ? selfBridgesFixture() : []} links={previewLinks} onNavigate={previewNavigate(go)}
      onRetry={() => go('learnhome')} onBridge={async () => 'done'}
      graduation={params.get('graduation') === '1' ? <RegisterGraduationView fixture locale={locale} dark={theme === 'dark'} into="transition" onAcknowledge={async () => true} /> : null} /></LearnPreviewHost>;
  }),
  recall: framed(({ locale, theme, params, go }) => <NarrativeRecallView key={`recall:${locale}`} fixture locale={locale} dark={theme === 'dark'}
    recall={recallFixture(locale, params.get('changed') !== '0')} onContinue={() => go('home')} />),
  journal: framed(({ locale, theme, params, go }) => <LearnPreviewHost><DecisionJournalView key={`journal:${locale}:${params.get('journal')}`} fixture locale={locale} dark={theme === 'dark'}
    state={journalPreviewStates(locale)[params.get('journal') ?? 'list'] ?? journalPreviewStates(locale).list!}
    onBack={() => go('home')} onRetry={() => go('journal')} onMore={() => {}}
    onClear={async () => true} onBridge={async () => 'done'} /></LearnPreviewHost>),
  learnershortcut: framed(({ locale, theme, params, go }) => <main className="lf-family-preview" data-surface="app" data-screen="learner-shortcut-host">
    <LearnerNarrativeShortcut key={`shortcut:${locale}:${params.get('bridges')}`} fixture locale={locale} dark={theme === 'dark'}
      bridges={params.get('bridges') === '1' ? selfBridgesFixture() : []}
      onOpenJournal={() => go('journal')} onOpenRhythm={() => go('rhythm')} onBridge={async () => 'done'} />
  </main>),
  reasoning: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`reasoning:${locale}:${ageBand}`} raw={decideJustifyPilotDocument(locale, ageBand)}
    locale={locale} ageBand={ageBand} onBack={() => go('home')} onGradeReasoning={(answer) => {
      // Preview only: the private rubric stays in Core for real lessons.
      const payload = { choiceIds: ['save-first', 'spend-all'], reasonIds: ['reason-goal', 'reason-feel', 'reason-lucky'] };
      const outcome = scoreV2Visual('reasoning.decide-justify.v2', payload, answer, DECIDE_JUSTIFY_PILOT_RUBRIC);
      const judgment = scoreV2Judgment('reasoning.decide-justify.v2', payload, answer, DECIDE_JUSTIFY_PILOT_RUBRIC);
      return { verdict: verdict(outcome), ...(judgment === 'invalid' ? {} : { judgment }) };
    }} />),
  rhythm: framed(({ locale, theme, params, go }) => <LearnPreviewHost><LearningRhythmView key={`rhythm:${locale}:${params.get('rhythm')}`} fixture locale={locale} dark={theme === 'dark'}
    state={rhythmPreviewStates[params.get('rhythm') ?? 'open'] ?? rhythmPreviewStates.open!}
    onBack={() => go('home')} onRetry={() => {}} onOpenPath={() => {}} onOpenMentor={() => {}}
    onSavePace={async (goal) => ({ goal, chosen: true, passedToday: 1, goalMet: goal <= 1 })} /></LearnPreviewHost>),
  resultmilestone: framed(({ locale, go }) => <LessonResultView locale={locale} onContinue={() => go('home')} fixture rawReceipt={milestoneReceipt(locale)} />),
  resultregister: framed(({ locale, register, go }) => <LessonResultView key={`resultregister:${register}`} locale={locale} onContinue={() => go('home')} fixture
    register={register} rawReceipt={{ ...milestoneReceipt(locale), celebrations: ['lesson-complete'], streak: undefined, pace: undefined }} />),
  graduation: framed(({ locale, theme, params }) => <main className="lf-family-preview" data-surface="app" data-screen="graduation-host">
    <RegisterGraduationView key={`graduation:${locale}:${params.get('into')}`} fixture locale={locale} dark={theme === 'dark'}
      into={params.get('into') === 'teen' ? 'teen' : 'transition'} onAcknowledge={async () => params.get('save') !== 'fail'} />
  </main>),
  guidedreview: framed(({ locale, theme, register, params, go }) => <main className="lf-family-preview" data-surface="app" data-screen="guided-review-host">
    <GuidedReviewOffer key={`guided:${locale}:${register}`} fixture locale={locale} dark={theme === 'dark'} register={register}
      offer={{ skill_key: 'financial-education/saving-goal', misses: 3, character: 'dina',
        skill: params.get('skill') === '0' ? null : { 'en-US': 'Saving toward a goal', 'es-MX': 'Ahorrar para una meta', 'pt-BR': 'Poupar para uma meta' }[locale] }}
      onReview={() => go('home')} onDecline={() => go('home')} />
  </main>),
  resultkept: framed(({ locale, go }) => <LessonResultView locale={locale} onContinue={() => go('home')} fixture rawReceipt={{
    schema_version: 2, completion_id: 'sample-completion-2', lesson_id: 'pilot-decide-justify', version_id: 'rev-001', locale,
    first_try_correct: 1, graded_count: 2, awarded_xp: 0, duration_seconds: 95, previous_best_percent: 100,
    replay: { kind: 'replay', notice: 'best_kept', best_score_kept: true, xp_policy: 'improvement_only' },
    judgment: { assessed: 2, sound: 1, partial: 1, unsupported: 0 },
  }} />),
  // W2L.2 (L3): the course world in every state (`?map=`), both course engines.
  territory: framed(({ locale, theme, ageBand, params, go }) => <LearnPreviewHost><TerritoryMapView key={`territory:${locale}:${params.get('map')}`} fixture
    locale={locale} dark={theme === 'dark'} ageBand={ageBand} slug="financial-education"
    state={territoryPreviewStates[params.get('map') ?? 'linear'] ?? territoryPreviewStates.linear!}
    courseTitles={Object.fromEntries(Object.entries(SHELF_TITLES).map(([slug, title]) => [slug, title[locale]]))}
    links={previewLinks} onNavigate={previewNavigate(go)} onRetry={() => go('territory')} /></LearnPreviewHost>),
  // W2L.2 (L4): the placement flow in every state.
  placement: framed((context) => <PlacementPreview {...context} />),
  placementoutcome: framed(({ locale, theme, params, go }) => <PlacementOutcomeView key={`placement:${locale}:${params.get('start')}:${params.get('path')}`} fixture locale={locale}
    dark={theme === 'dark'} onStart={() => go('home')} onEarlier={() => go('home')} rawFrame={{
      path: params.get('path') ?? 'adaptive_quiz', start: params.get('start') === 'further_in' ? 'further_in' : 'beginning', basis: 'prior_exposure',
      learner_chosen: params.get('path') === 'learner_chose_start' || params.get('path') === 'learner_adjusted',
    }} />),
  result,
  replay: result,
  goal: board(({ locale, ageBand }) => goalBulletPilotDocument(locale, ageBand)),
  percent: board(({ locale, ageBand }) => percentGridPilotDocument(locale, ageBand)),
  placevalue: board(({ locale, ageBand }) => ageBand === '6-9' ? placeValuePilotDocument(locale) : null),
  rulebuilder: board(({ locale, ageBand }) => ageBand === '10-12' ? savingsRulePilotDocument(locale) : null),
  ledger: board(({ locale, ageBand }) => ageBand === '13-17' ? runningLedgerPilotDocument(locale) : null),
  growthcompare: board(({ locale, ageBand }) => ageBand === '13-17' ? growthComparisonPilotDocument(locale) : null),
  ratiotable: board(({ locale, ageBand }) => ageBand === '10-12' ? ratioTablePilotDocument(locale) : null),
  taxbracket: board(({ locale, ageBand }) => ageBand === '13-17' ? taxBracketPilotDocument(locale) : null),
  fractionline: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`fractionline:${locale}:${ageBand}`}
    raw={ageBand === '10-12' ? fractionNumberLinePilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
    onGradeNumberLine={({ value }) => verdict(scoreV2Visual('math.number-line.fraction.v2', { maximumWhole: 1, divisions: 4 }, { value }, { targetNumerator: 3, targetDenominator: 4, toleranceUnits: 0 }))} />),
  fractionarea: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`fractionarea:${locale}:${ageBand}`}
    raw={ageBand === '6-9' ? fractionAreaPilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
    onGradeFractionArea={({ n, d }) => verdict(scoreV2Visual('math.fraction-area.v2', { minimumParts: 2, maximumParts: 6 }, { n, d }, { targetNumerator: 1, targetDenominator: 2 }))} />),
  barmodel: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`barmodel:${locale}:${ageBand}`} raw={ageBand === '10-12' ? barModelPilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
    onGradeBarModel={(answer, segmentId) => {
      const kind = segmentId === 'bar-structure-01' ? 'math.bar-model.structure.v2' : 'math.bar-model.answer.v2';
      const rubric = segmentId === 'bar-structure-01' ? { model: 'comparison' } : { target: 19 };
      return verdict(scoreV2Visual(kind, { whole: 50, difference: 12 }, answer, rubric));
    }} />),
  schemadiagram: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`schemadiagram:${locale}:${ageBand}`} raw={ageBand === '10-12' ? schemaDiagramPilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
    onGradeSchemaDiagram={(answer, segmentId) => {
      const kind = segmentId === 'schema-structure-01' ? 'math.schema-diagram.structure.v2' : segmentId === 'schema-slots-01' ? 'math.schema-diagram.slots.v2' : 'math.schema-diagram.answer.v2';
      const rubric = segmentId === 'schema-structure-01' ? { schema: 'change' } : segmentId === 'schema-slots-01' ? { income: 24, spending: 9 } : { target: 15 };
      return verdict(scoreV2Visual(kind, { income: 24, spending: 9 }, answer, rubric));
    }} />),
  workedexample: framed(({ locale, ageBand, params, go }) => <LessonDocumentView key={'workedexample:' + locale + ':' + ageBand + ':' + params.get('fade')}
    raw={ageBand === '10-12' ? workedExamplePilotDocument(locale, params.get('fade') === '1' ? 1 : 0) : null}
    locale={locale} ageBand={ageBand} onBack={() => go('home')}
    onGradeWorkedExample={(answer) => verdict(scoreV2Visual('math.worked-example.v2',
      { response_step_ids: ['discount-subtract', 'sale-price'] }, answer,
      { expectedValues: { 'discount-subtract': '40', 'sale-price': '40' } }))} />),
  functionmachine: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`functionmachine:${locale}:${ageBand}`}
    raw={ageBand === '10-12' ? functionMachinePilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
    onGradeBarModel={(answer) => verdict(scoreV2Visual('math.function-machine.v2', { multiplierMaximum: 9, offsetMaximum: 50, exampleInputs: [1, 2, 3] }, answer,
      { multiplier: 5, offset: 10, heldOutInputs: [4, 6] }))} />),
  cpafading: framed(({ locale, ageBand, go }) => <LessonDocumentView key={`cpafading:${locale}:${ageBand}`}
    raw={ageBand === '6-9' || ageBand === '10-12' ? cpaFadingPilotDocument(locale, ageBand) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
    onGradeNumberLine={(answer, segmentId, document) => {
      const segment = document.segments.find((item) => item.id === segmentId);
      if (!segment || segment.type !== 'math.cpa-count.v2') return 'invalid';
      return verdict(scoreV2Visual('math.cpa-count.v2', { left: segment.payload.left, right: segment.payload.right }, answer,
        { target: segment.payload.left + segment.payload.right }));
    }} />),
};
