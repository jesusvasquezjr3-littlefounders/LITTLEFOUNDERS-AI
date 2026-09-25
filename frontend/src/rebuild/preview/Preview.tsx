import { useEffect, useState } from 'react';
import en from '../../i18n/en-US/rebuild.json';
import es from '../../i18n/es-MX/rebuild.json';
import pt from '../../i18n/pt-BR/rebuild.json';
import { Button, Copy, Field, StatusMark } from '../design/controls';
import type { AgeBand, Locale } from '../design/copyBudget';
import { allocationPilotDocument, donutPilotDocument, wafflePilotDocument } from '../learning/AllocationBoard';
import { growthPilotDocument } from '../learning/GrowthBoard';
import { learningFixtures } from '../learning/allocationFixtures';
import { scoreV2Visual } from '../learning/v2VisualScorer.generated';
import { LessonDocumentView } from '../learning/LessonDocumentView';
import { numberLinePilotDocument } from '../learning/NumberLineBoard';
import { sequencePilotDocument } from '../learning/sequencePilotDocument';
import { LessonResultView } from '../learning/LessonResultView';
import { goalBulletPilotDocument } from '../learning/GoalBulletBoard';
import { percentGridPilotDocument } from '../learning/PercentGridBoard';
import { placeValuePilotDocument } from '../learning/PlaceValueBoard';
import { savingsRulePilotDocument } from '../learning/SavingsRuleBoard';
import { runningLedgerPilotDocument } from '../learning/RunningLedgerBoard';
import { growthComparisonPilotDocument } from '../learning/GrowthComparisonBoard';
import { ratioTablePilotDocument } from '../learning/RatioTableBoard';
import { taxBracketPilotDocument } from '../learning/TaxBracketBoard';
import { fractionNumberLinePilotDocument } from '../learning/FractionNumberLineBoard';
import { fractionAreaPilotDocument } from '../learning/FractionAreaBoard';
import { barModelPilotDocument } from '../learning/BarModelBoard';
import { schemaDiagramPilotDocument } from '../learning/SchemaDiagramBoard';
import { workedExamplePilotDocument } from '../learning/WorkedExampleBoard';
import { functionMachinePilotDocument } from '../learning/FunctionMachineBoard';
import { cpaFadingPilotDocument } from '../learning/CpaFadingBoard';
import { LessonTransportStateView } from '../learning/LessonTransportStateView';
import type { LessonMentorStage } from '../learning/lessonDocument';
import { SessionClosing, SessionEndChoice, type ClosingScript, type EffortAct } from '../mentor/SessionEnd';
import { CheckInChoice } from '../mentor/CheckIn';
import { GoalCheckChoice } from '../mentor/GoalCheck';
import { AllianceCheck } from '../mentor/AllianceCheck';
import { DispositionSummary } from '../mentor/DispositionSummary';
import type { DispositionSummaryData } from '../mentor/allianceApi';
import { LiveContentStatusPanel, LiveReviewDecision, PackRelease } from '../mentor/LiveContentGovernance';
import type { LiveContentStatus, TutorPackSummary } from '../mentor/liveContentApi';
import { MentorQualityDashboard } from '../staff/MentorQualityDashboard';
import { previewMentorQuality } from '../staff/mentorQualityFixtures';

/** C.7 preview fixture: a profile with every row populated (closed labels only). */
const PREVIEW_PROFILE: DispositionSummaryData = {
  exists: true,
  current: true,
  sessionsObserved: 7,
  helpStyle: 'tell_early',
  persistence: 'persists',
  explanation: 'needs_scaffold',
  persistentlyDeclined: ['less_text', 'more_visual'],
  typicalReplySeconds: 12,
  personas: [{ character: 'dina', sessions: 5 }, { character: 'rho', sessions: 2 }],
  effects: ['stuck_degrade_early', 'scaffolded_explanation', 'seeded_declines', 'idle_nudge_paced'],
  updatedAt: '2026-09-24T12:00:00Z',
};

/*
 * C.5 / C.6 preview fixtures for the staff surfaces. Default: everyday topics
 * open but RAISED after an issue, sensitive topics PAUSED by a Stage 7 trip.
 * `?judge=uncalibrated` shows the state production starts in until the owner
 * runs the calibration (OD-23).
 */
const PREVIEW_LIVE_STATUS = (judge: string | null): LiveContentStatus => ({
  calibration: judge === 'uncalibrated'
    ? { state: 'uncalibrated', ageDays: null, judgeModel: null, recordedAt: null, maxAgeDays: 35 }
    : { state: 'passed', ageDays: 12, judgeModel: 'qwen3-max', recordedAt: '2026-09-12T00:00:00Z', maxAgeDays: 35 },
  categories: judge === 'uncalibrated'
    ? [
      { category: 'standard', suspended: true, reasons: ['uncalibrated'], rate: 0.15, baseline: 0.15, floor: 0.15, elevated: false, decisionsToRestore: 0, pending: 0, overdue: 0 },
      { category: 'sensitive', suspended: true, reasons: ['uncalibrated'], rate: 0.5, baseline: 0.5, floor: 0.5, elevated: false, decisionsToRestore: 0, pending: 0, overdue: 0 },
    ]
    : [
      { category: 'standard', suspended: false, reasons: [], rate: 0.5, baseline: 0.15, floor: 0.15, elevated: true, decisionsToRestore: 64, pending: 3, overdue: 0 },
      { category: 'sensitive', suspended: true, reasons: ['concordance_below_floor'], rate: 1, baseline: 0.5, floor: 0.5, elevated: true, decisionsToRestore: 100, pending: 5, overdue: 2 },
    ],
  reviewSlaDays: 7,
});
const PREVIEW_PACKS: TutorPackSummary[] = [
  { id: 'pack-preview-1', skill_key: 'kc:money.percent-intro', kc_key: 'money.percent-intro', tier: 3, locale: 'es-MX', status: 'review', pack_version: 1,
    risk_category: 'standard', source: 'hand_authored', demand_pattern: 'kc_without_catalog_content',
    pack: { segments: [{ id: 'a', type: 'number_input' }, { id: 'b', type: 'number_input' }, { id: 'c', type: 'quiz_mcq' }, { id: 'd', type: 'number_input' }] } },
  { id: 'pack-preview-2', skill_key: 'kc:biz.goods-vs-services', kc_key: 'biz.goods-vs-services', tier: 1, locale: 'pt-BR', status: 'review', pack_version: 2,
    risk_category: 'standard', source: 'hand_authored', demand_pattern: 'kc_without_catalog_content',
    pack: { segments: [{ id: 'a', type: 'quiz_mcq' }, { id: 'b', type: 'true_false' }, { id: 'c', type: 'sort_buckets' }, { id: 'd', type: 'quiz_mcq' }] } },
];
const PREVIEW_REVIEW_ITEM = {
  'en-US': 'A notebook costs 7 coins. How many coins do 3 notebooks cost?',
  'es-MX': 'Un cuaderno cuesta 7 monedas. ¿Cuántas monedas cuestan 3 cuadernos?',
  'pt-BR': 'Um caderno custa 7 moedas. Quantas moedas custam 3 cadernos?',
} as const;

const translations = { 'en-US': en, 'es-MX': es, 'pt-BR': pt };
const params = new URLSearchParams(location.search);
const initialLocale = params.get('locale');

/*
 * The preview's compact-stage fixture. OD-19: this stays fixed to Dina on
 * diorama-a ONLY here — the authenticated lesson route consumes the real
 * server-resolved projection instead.
 */
export const PREVIEW_MENTOR_STAGE: LessonMentorStage = { character: 'dina', scene: 'diorama-a' };

export function Preview() {
  const [locale, setLocale] = useState<Locale>(initialLocale === 'es-MX' || initialLocale === 'pt-BR' ? initialLocale : 'en-US');
  const [theme, setTheme] = useState(params.get('theme') === 'dark' ? 'dark' : 'light');
  const [screen, setScreen] = useState(params.get('screen') ?? 'home');
  const [ageBand, setAgeBand] = useState<AgeBand>(['6-9', '10-12', '13-17', 'adult'].includes(params.get('age') ?? '') ? params.get('age') as AgeBand : '6-9');
  const [answer, setAnswer] = useState<'save' | 'spend' | null>(null);
  const [checked, setChecked] = useState(false);
  const [goal, setGoal] = useState('');
  const [formState, setFormState] = useState<'idle' | 'error' | 'saved'>('idle');
  const t = translations[locale];
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const go = (next: string) => {
    setScreen(next); setAnswer(null); setChecked(false); setFormState('idle');
    window.scrollTo(0, 0);
  };
  return <div className="lf-rebuild" data-theme={theme} data-age-band={ageBand} lang={locale}>
    {screen === 'opening' || screen === 'offline' || screen === 'loaderror'
      ? <LessonTransportStateView state={screen === 'loaderror' ? 'load-error' : screen}
        locale={locale} onBack={() => go('home')} onRetry={() => go('lesson')} />
      : screen === 'upgrade' || screen === 'invalid' ? <LessonDocumentView key={`${screen}:${locale}:${ageBand}`}
      raw={screen === 'upgrade' ? { ...allocationPilotDocument(locale, ageBand) as Record<string, unknown>, schema_version: 3 }
        : { ...allocationPilotDocument(locale, ageBand) as Record<string, unknown>, segments: [] }}
      locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'lesson' ? <LessonDocumentView key={`${locale}:${ageBand}`} raw={allocationPilotDocument(locale, ageBand)} locale={locale} ageBand={ageBand}
      theme={theme as 'light' | 'dark'} onBack={() => go('home')} mentorStage={params.get('stage') === '1' ? PREVIEW_MENTOR_STAGE : null}
      onGrade={(allocation) => {
        const item = learningFixtures[ageBand].item;
        const result = scoreV2Visual('money.allocation.v2', { total: item.total, step: item.step }, allocation,
          { minimumSave: item.minimumSave });
        return result === 'met' || result === 'review' ? result : 'invalid';
      }} />
      : screen === 'waffle' ? <LessonDocumentView key={`waffle:${locale}:${ageBand}`}
        raw={ageBand === '6-9' ? wafflePilotDocument(locale) : null} locale={locale} ageBand={ageBand}
        onBack={() => go('home')} onGrade={(allocation) => {
          const result = scoreV2Visual('money.allocation.v2', { total: 10, step: 1 }, allocation,
            { minimumSave: 3 });
          return result === 'met' || result === 'review' ? result : 'invalid';
        }} />
      : screen === 'donut' ? <LessonDocumentView key={`donut:${locale}:${ageBand}`}
        raw={ageBand === '10-12' ? donutPilotDocument(locale) : null} locale={locale} ageBand={ageBand}
        onBack={() => go('home')} onGrade={(allocation) => {
          const result = scoreV2Visual('money.allocation.v2', { total: 60, step: 5 }, allocation,
            { minimumSave: 20 });
          return result === 'met' || result === 'review' ? result : 'invalid';
        }} />
      : screen === 'timeline' ? <LessonDocumentView key={`growth:${locale}:${ageBand}`} raw={growthPilotDocument(locale, ageBand)} locale={locale} ageBand={ageBand}
        onBack={() => go('home')} />
      : screen === 'sequence' ? <LessonDocumentView key={`sequence:${locale}`} raw={ageBand === '6-9' ? sequencePilotDocument(locale) : null}
        locale={locale} ageBand={ageBand} onBack={() => go('home')} previewSequence
        onGrade={(allocation) => {
          const item = learningFixtures['6-9'].item;
          const result = scoreV2Visual('money.allocation.v2', { total: item.total, step: item.step }, allocation,
            { minimumSave: item.minimumSave });
          return result === 'met' || result === 'review' ? result : 'invalid';
        }} />
      : screen === 'numberline' ? <LessonDocumentView key={`numberline:${locale}:${ageBand}`}
        raw={ageBand === '6-9' || ageBand === '10-12' ? numberLinePilotDocument(locale, ageBand) : null} locale={locale} ageBand={ageBand}
        onBack={() => go('home')} onGradeNumberLine={({ value }) => {
          const result = scoreV2Visual('math.number-line.whole.v2', { minimum: 0, maximum: ageBand === '6-9' ? 10 : 100, step: 1 },
            { value }, { target: ageBand === '6-9' ? 7 : 37 });
          return result === 'met' || result === 'review' ? result : 'invalid';
        }} />
      : screen === 'result' || screen === 'replay' ? <LessonResultView locale={locale} onContinue={() => go('home')} fixture rawReceipt={{
        schema_version: 2, completion_id: 'sample-completion-1', lesson_id: 'pilot-savings-sequence', version_id: 'rev-1', locale,
        first_try_correct: screen === 'replay' ? 2 : 3, graded_count: 4, awarded_xp: 40, duration_seconds: 200,
        previous_best_percent: screen === 'replay' ? 90 : 60,
      }} />
      : screen === 'goal' ? <LessonDocumentView key={`goal:${locale}:${ageBand}`} raw={goalBulletPilotDocument(locale, ageBand)}
        locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'percent' ? <LessonDocumentView key={`percent:${locale}:${ageBand}`} raw={percentGridPilotDocument(locale, ageBand)}
        locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'placevalue' ? <LessonDocumentView key={`placevalue:${locale}:${ageBand}`}
        raw={ageBand === '6-9' ? placeValuePilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'rulebuilder' ? <LessonDocumentView key={`rulebuilder:${locale}:${ageBand}`}
        raw={ageBand === '10-12' ? savingsRulePilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'ledger' ? <LessonDocumentView key={`ledger:${locale}:${ageBand}`}
        raw={ageBand === '13-17' ? runningLedgerPilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'growthcompare' ? <LessonDocumentView key={`growthcompare:${locale}:${ageBand}`}
        raw={ageBand === '13-17' ? growthComparisonPilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'ratiotable' ? <LessonDocumentView key={`ratiotable:${locale}:${ageBand}`}
        raw={ageBand === '10-12' ? ratioTablePilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'taxbracket' ? <LessonDocumentView key={`taxbracket:${locale}:${ageBand}`}
        raw={ageBand === '13-17' ? taxBracketPilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')} />
      : screen === 'fractionline' ? <LessonDocumentView key={`fractionline:${locale}:${ageBand}`}
        raw={ageBand === '10-12' ? fractionNumberLinePilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
        onGradeNumberLine={({ value }) => { const result = scoreV2Visual('math.number-line.fraction.v2', { maximumWhole: 1, divisions: 4 }, { value }, { targetNumerator: 3, targetDenominator: 4, toleranceUnits: 0 }); return result === 'met' || result === 'review' ? result : 'invalid'; }} />
      : screen === 'fractionarea' ? <LessonDocumentView key={`fractionarea:${locale}:${ageBand}`}
        raw={ageBand === '6-9' ? fractionAreaPilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
        onGradeFractionArea={({ n, d }) => { const result = scoreV2Visual('math.fraction-area.v2', { minimumParts: 2, maximumParts: 6 }, { n, d }, { targetNumerator: 1, targetDenominator: 2 }); return result === 'met' || result === 'review' ? result : 'invalid'; }} />
      : screen === 'barmodel' ? <LessonDocumentView key={`barmodel:${locale}:${ageBand}`} raw={ageBand==='10-12'?barModelPilotDocument(locale):null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
        onGradeBarModel={(answer,segmentId) => { const kind=segmentId==='bar-structure-01'?'math.bar-model.structure.v2':'math.bar-model.answer.v2';const rubric=segmentId==='bar-structure-01'?{model:'comparison'}:{target:19};const result=scoreV2Visual(kind,{whole:50,difference:12},answer,rubric);return result==='met'||result==='review'?result:'invalid'; }} />
      : screen === 'schemadiagram' ? <LessonDocumentView key={`schemadiagram:${locale}:${ageBand}`} raw={ageBand==='10-12'?schemaDiagramPilotDocument(locale):null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
        onGradeSchemaDiagram={(answer,segmentId) => { const kind=segmentId==='schema-structure-01'?'math.schema-diagram.structure.v2':segmentId==='schema-slots-01'?'math.schema-diagram.slots.v2':'math.schema-diagram.answer.v2';const rubric=segmentId==='schema-structure-01'?{schema:'change'}:segmentId==='schema-slots-01'?{income:24,spending:9}:{target:15};const result=scoreV2Visual(kind,{income:24,spending:9},answer,rubric);return result==='met'||result==='review'?result:'invalid'; }} />
      : screen === 'workedexample' ? <LessonDocumentView key={'workedexample:' + locale + ':' + ageBand + ':' + params.get('fade')}
        raw={ageBand === '10-12' ? workedExamplePilotDocument(locale, params.get('fade') === '1' ? 1 : 0) : null}
        locale={locale} ageBand={ageBand} onBack={() => go('home')}
        onGradeWorkedExample={(answer) => { const result = scoreV2Visual('math.worked-example.v2',
          { response_step_ids: ['discount-subtract', 'sale-price'] }, answer,
          { expectedValues: { 'discount-subtract': '40', 'sale-price': '40' } });
        return result === 'met' || result === 'review' ? result : 'invalid'; }} />
      : screen === 'functionmachine' ? <LessonDocumentView key={`functionmachine:${locale}:${ageBand}`}
        raw={ageBand === '10-12' ? functionMachinePilotDocument(locale) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
        onGradeBarModel={(answer) => { const result = scoreV2Visual('math.function-machine.v2', { multiplierMaximum: 9, offsetMaximum: 50, exampleInputs: [1, 2, 3] }, answer,
          { multiplier: 5, offset: 10, heldOutInputs: [4, 6] }); return result === 'met' || result === 'review' ? result : 'invalid'; }} />
      : screen === 'cpafading' ? <LessonDocumentView key={`cpafading:${locale}:${ageBand}`}
        raw={ageBand === '6-9' || ageBand === '10-12' ? cpaFadingPilotDocument(locale, ageBand) : null} locale={locale} ageBand={ageBand} onBack={() => go('home')}
        onGradeNumberLine={(answer, segmentId, document) => { const segment = document.segments.find((item) => item.id === segmentId);
          if (!segment || segment.type !== 'math.cpa-count.v2') return 'invalid';
          const result = scoreV2Visual('math.cpa-count.v2', { left: segment.payload.left, right: segment.payload.right }, answer,
            { target: segment.payload.left + segment.payload.right }); return result === 'met' || result === 'review' ? result : 'invalid'; }} />
      : screen === 'mentor-session-end' ? <main className="lf-preview lf-preview--mentor-session-end" data-surface="app"
        data-screen="mentor-session-end"><div className="lf-preview-content">
        {/* C.8/C.12 + C.16 fixtures: the stop-or-continue choice and the closing state for ?script=&effort=. */}
        <SessionEndChoice copy={t.mentorSessionEnd} locale={locale} dark={theme === 'dark'} onChoose={() => undefined} />
        <SessionClosing copy={t.mentorSessionEnd} locale={locale} dark={theme === 'dark'}
          script={(['completed', 'interrupted', 'learner_left', 'safety_stop'].includes(params.get('script') ?? '')
            ? params.get('script') : 'completed') as ClosingScript}
          effort={(params.get('effort') ?? 'recovered') as EffortAct}
          topic={params.get('topic') === 'none' ? null : t.mentorSessionEnd.previewTopic} onBack={() => go('home')} />
      </div></main>
      : screen === 'mentor-check-in' ? <main className="lf-preview lf-preview--mentor-check-in" data-surface="app"
        data-screen="mentor-check-in"><div className="lf-preview-content">
        {/* C.19 fixture: the two reply chips the stage shows under the Mentor's check-in turn. */}
        <CheckInChoice copy={t.mentorCheckIn} locale={locale} dark={theme === 'dark'} onAnswer={() => undefined} />
      </div></main>
      : screen === 'mentor-goal-check' ? <main className="lf-preview lf-preview--mentor-goal-check" data-surface="app"
        data-screen="mentor-goal-check"><div className="lf-preview-content">
        {/* C.15 fixture: the two chips under the Mentor's goal restatement. */}
        <GoalCheckChoice copy={t.mentorGoalCheck} locale={locale} dark={theme === 'dark'} onAnswer={() => undefined} />
      </div></main>
      : screen === 'mentor-alliance-check' ? <main className="lf-preview lf-preview--mentor-alliance-check" data-surface="app"
        data-screen="mentor-alliance-check"><div className="lf-preview-content">
        {/* C.15 fixture: the end-of-session bond proxy for ?script=; ?result=failed shows the retry. */}
        <AllianceCheck copy={t.mentorAllianceCheck} locale={locale} dark={theme === 'dark'}
          script={(['completed', 'interrupted', 'learner_left', 'safety_stop'].includes(params.get('script') ?? '')
            ? params.get('script') : 'completed') as 'completed' | 'interrupted' | 'learner_left' | 'safety_stop'}
          onAnswer={async () => (params.get('result') === 'failed' ? 'failed' : 'recorded')} />
      </div></main>
      : screen === 'staff-live-content' ? <main className="lf-preview lf-preview--staff-live-content" data-surface="app"
        data-screen="staff-live-content"><div className="lf-preview-content">
        {/* C.5 / C.6 staff fixtures: ?state=ready|loading|failed, ?judge=uncalibrated, ?decide=failed|already, ?pack=refused|failed. */}
        <LiveContentStatusPanel copy={t.staffLiveContent} locale={locale} dark={theme === 'dark'}
          phase={params.get('state') === 'loading' ? 'loading' : params.get('state') === 'failed' ? 'failed' : 'ready'}
          status={PREVIEW_LIVE_STATUS(params.get('judge'))} />
        <LiveReviewDecision copy={t.staffLiveContent} locale={locale} dark={theme === 'dark'}
          item={{ id: 'segment-preview', category: 'standard', prompt: PREVIEW_REVIEW_ITEM[locale] }}
          onDecide={async () => (params.get('decide') === 'failed' ? 'failed' : params.get('decide') === 'already' ? 'already' : 'recorded')} />
        <PackRelease copy={t.staffLiveContent} locale={locale} dark={theme === 'dark'} packs={PREVIEW_PACKS}
          onStatus={async () => (params.get('pack') === 'refused'
            ? { ok: false, failures: ['segment pack-x-1: the key names an option that does not exist exactly once', 'tier 2 is below the knowledge component\'s tier_min 3'] }
            : params.get('pack') === 'failed' ? { ok: false } : { ok: true })} />
      </div></main>
      : screen === 'staff-mentor-quality' ? <main className="lf-preview lf-preview--staff-mentor-quality" data-surface="app"
        data-screen="staff-mentor-quality"><div className="lf-preview-content">
        {/* C.24 staff fixtures: ?state=ready|loading|failed, ?fresh=stale|never, ?viewer=none, ?flags=empty, ?act=failed|not_owner|changed, ?review=already|failed. */}
        <MentorQualityDashboard copy={t.staffMentorQuality} locale={locale} dark={theme === 'dark'}
          phase={params.get('state') === 'loading' ? 'loading' : params.get('state') === 'failed' ? 'failed' : 'ready'}
          data={previewMentorQuality({ fresh: params.get('fresh'), viewer: params.get('viewer'), empty: params.get('flags') === 'empty' })}
          onAcknowledge={async () => (params.get('act') === 'failed' ? 'failed' : params.get('act') === 'not_owner' ? 'not_owner' : params.get('act') === 'changed' ? 'changed' : 'done')}
          onResolve={async () => (params.get('act') === 'failed' ? 'failed' : params.get('act') === 'changed' ? 'changed' : 'done')}
          onReview={async () => (params.get('review') === 'already' ? 'already' : params.get('review') === 'failed' ? 'failed' : 'done')} />
      </div></main>
      : screen === 'mentor-profile' ? <main className="lf-preview lf-preview--mentor-profile" data-surface="app"
        data-screen="mentor-profile"><div className="lf-preview-content">
        {/* C.7 fixture: ?audience=own|child and ?state=ready|empty|loading|failed. */}
        <DispositionSummary copy={t.mentorProfile} locale={locale} dark={theme === 'dark'}
          audience={params.get('audience') === 'own' ? 'own' : 'child'}
          phase={params.get('state') === 'loading' ? 'loading' : params.get('state') === 'failed' ? 'failed' : 'ready'}
          data={params.get('state') === 'empty' ? { ...PREVIEW_PROFILE, exists: false } : PREVIEW_PROFILE}
          canReset onReset={() => undefined} />
      </div></main>
      : <main className={`lf-preview lf-preview--${screen}`} data-surface="app" data-screen={screen}>
      <div className="lf-preview-content">
      {screen === 'home' ? <>
        <Copy role="body">{t.preview}</Copy>
        <h1 data-copy-role="heading">{t.heading}</h1>
        <Copy role="body">{t.intro}</Copy>
        <div className="lf-actions">
          <Button variant="accent" onClick={() => go('lesson')}>{t.lessonDemo}</Button>
          <Button onClick={() => go('timeline')}>{t.timelineDemo}</Button>
          <Button onClick={() => go('numberline')}>{t.numberLineDemo}</Button>
          <Button onClick={() => go('practice')}>{t.practice}</Button>
          <Button onClick={() => go('controls')}>{t.controls}</Button>
        </div>
      </> : screen === 'practice' ? <>
        <Button onClick={() => go('home')}>{t.back}</Button>
        <h1 data-copy-role="prompt">{t.question}</h1>
        <div className="lf-choices" role="group" aria-label={t.question}>
          {(['save', 'spend'] as const).map((choice) => <button key={choice} type="button"
            className="lf-choice" data-copy-role="option" aria-pressed={answer === choice}
            disabled={checked} onClick={() => setAnswer(choice)}>
            <span className="lf-choice-marker" aria-hidden="true">{answer === choice ? '●' : '○'}</span>
            {t[choice]}
          </button>)}
        </div>
        <div role="status" className={checked ? `lf-feedback ${answer === 'save' ? 'lf-feedback--correct' : 'lf-feedback--retry'}` : undefined}>
          {checked ? <><StatusMark correct={answer === 'save'} /><Copy role="body">{answer === 'save' ? t.correct : t.hint}</Copy></> : null}
        </div>
        <Button variant="accent" disabled={!answer} onClick={() => checked ? (setChecked(false), setAnswer(null)) : setChecked(true)}>
          {checked ? t.again : t.check}
        </Button>
      </> : <>
        <Button onClick={() => go('home')}>{t.back}</Button>
        <h1 data-copy-role="heading">{t.controls}</h1>
        <form className="lf-form" onSubmit={(event) => { event.preventDefault(); setFormState(goal.trim() ? 'saved' : 'error'); }}>
          <Field label={t.name} value={goal} onChange={(event) => { setGoal(event.target.value); setFormState('idle'); }}
            aria-invalid={formState === 'error'} hint={formState === 'error' ? t.required : t.nameHint} />
          <Button variant="accent" type="submit">{t.confirm}</Button>
          <div role="status">{formState === 'saved' ? <Copy role="body">{t.confirmed}</Copy> : null}</div>
        </form>
      </>}
      </div>
    </main>}
    <aside className="lf-preview-settings" aria-label={t.preview}>
      <label data-copy-role="body">{t.language}
        <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
          {Object.keys(translations).map((value) => <option key={value} value={value} data-copy-role="data">{value}</option>)}
        </select>
      </label>
      <label data-copy-role="body">{t.theme}
        <select value={theme} onChange={(event) => setTheme(event.target.value)}>
          <option value="light" data-copy-role="option">{t.light}</option>
          <option value="dark" data-copy-role="option">{t.dark}</option>
        </select>
      </label>
      <label data-copy-role="body">{t.age}
        <select value={ageBand} onChange={(event) => setAgeBand(event.target.value as AgeBand)}>
          <option value="6-9" data-copy-role="data">6–9</option>
          <option value="10-12" data-copy-role="data">10–12</option>
          <option value="13-17" data-copy-role="data">13–17</option>
          <option value="adult" data-copy-role="option">{t.adult}</option>
        </select>
      </label>
    </aside>
  </div>;
}
