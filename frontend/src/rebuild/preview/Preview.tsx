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
import { DECIDE_JUSTIFY_PILOT_RUBRIC, decideJustifyPilotDocument } from '../learning/DecisionReasonsBoard';
import { scoreV2Judgment } from '../learning/v2VisualScorer.generated';
import { PlacementOutcomeView } from '../learning/PlacementOutcomeView';
import { LearningQualityPanel } from '../learning/LearningQualityPanel';
import { learningQualityFixture } from '../learning/learningQualityFixtures';
import { LessonTransportStateView } from '../learning/LessonTransportStateView';
import { CoursePathView } from '../learning/CoursePathView';
import { coursePathPreviewStates } from '../learning/coursePathFixtures';
import { NarrativeRecallView } from '../learning/NarrativeRecallView';
import { DecisionJournalView } from '../learning/DecisionJournalView';
import { LearnerNarrativeShortcut } from '../learning/LearnerNarrativeShortcut';
import { journalPreviewStates, recallFixture, selfBridgesFixture } from '../learning/narrativeFixtures';
import { LearningNarrative } from '../family/LearningNarrative';
import { LearningBridges } from '../family/LearningBridges';
import { bridgesFixture, narrativePreviewStates } from '../family/familyLearningFixtures';
import type { LessonMentorStage } from '../learning/lessonDocument';

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
      : screen === 'coursepath' ? <CoursePathView key={`coursepath:${locale}`} fixture locale={locale} dark={theme === 'dark'}
        state={coursePathPreviewStates[params.get('path') ?? 'child'] ?? coursePathPreviewStates.child!}
        missingTitles={['Entrepreneurship']} onOpenLesson={() => go('lesson')} onPlacement={() => go('home')} onBack={() => go('home')} onRetry={() => go('coursepath')} />
      : screen === 'recall' ? <NarrativeRecallView key={`recall:${locale}`} fixture locale={locale} dark={theme === 'dark'}
        recall={recallFixture(locale, params.get('changed') !== '0')} onContinue={() => go('home')} />
      : screen === 'journal' ? <DecisionJournalView key={`journal:${locale}:${params.get('journal')}`} fixture locale={locale} dark={theme === 'dark'}
        state={journalPreviewStates(locale)[params.get('journal') ?? 'list'] ?? journalPreviewStates(locale).list!}
        onBack={() => go('home')} onRetry={() => go('journal')} onMore={() => {}}
        onClear={async () => true} onBridge={async () => 'done'} />
      : screen === 'learnershortcut' ? <main className="lf-family-preview" data-surface="app" data-screen="learner-shortcut-host">
        <LearnerNarrativeShortcut key={`shortcut:${locale}:${params.get('bridges')}`} fixture locale={locale} dark={theme === 'dark'}
          bridges={params.get('bridges') === '1' ? selfBridgesFixture() : []}
          onOpenJournal={() => go('journal')} onBridge={async () => 'done'} />
      </main>
      : screen === 'familylearning' ? <main className="lf-family-preview" data-surface="app" data-screen="family-learning-preview">
        <LearningBridges key={`bridges:${locale}`} fixture locale={locale} dark={theme === 'dark'}
          state={params.get('bridges') === '0' ? { status: 'ready', prompts: [] } : bridgesFixture(locale)}
          onAct={async () => 'created'} onDismiss={async () => 'dismissed'} onRetry={() => {}} />
        <LearningNarrative key={`narrative:${locale}`} fixture locale={locale} dark={theme === 'dark'} open={params.get('open') !== '0'}
          state={narrativePreviewStates(locale)[params.get('narrative') ?? 'ready'] ?? narrativePreviewStates(locale).ready!}
          onToggle={() => {}} onRetry={() => {}} onMore={() => {}} />
      </main>
      : screen === 'reasoning' ? <LessonDocumentView key={`reasoning:${locale}:${ageBand}`} raw={decideJustifyPilotDocument(locale, ageBand)}
        locale={locale} ageBand={ageBand} onBack={() => go('home')} onGradeReasoning={(answer) => {
          // Preview only: the private rubric stays in Core for real lessons.
          const payload = { choiceIds: ['save-first', 'spend-all'], reasonIds: ['reason-goal', 'reason-feel', 'reason-lucky'] };
          const verdict = scoreV2Visual('reasoning.decide-justify.v2', payload, answer, DECIDE_JUSTIFY_PILOT_RUBRIC);
          const judgment = scoreV2Judgment('reasoning.decide-justify.v2', payload, answer, DECIDE_JUSTIFY_PILOT_RUBRIC);
          return { verdict: verdict === 'met' || verdict === 'review' ? verdict : 'invalid', ...(judgment === 'invalid' ? {} : { judgment }) };
        }} />
      : screen === 'resultkept' ? <LessonResultView locale={locale} onContinue={() => go('home')} fixture rawReceipt={{
        schema_version: 2, completion_id: 'sample-completion-2', lesson_id: 'pilot-decide-justify', version_id: 'rev-001', locale,
        first_try_correct: 1, graded_count: 2, awarded_xp: 0, duration_seconds: 95, previous_best_percent: 100,
        replay: { kind: 'replay', notice: 'best_kept', best_score_kept: true, xp_policy: 'improvement_only' },
        judgment: { assessed: 2, sound: 1, partial: 1, unsupported: 0 },
      }} />
      : screen === 'placementoutcome' ? <PlacementOutcomeView key={`placement:${locale}:${params.get('start')}:${params.get('path')}`} fixture locale={locale}
        dark={theme === 'dark'} onStart={() => go('home')} onEarlier={() => go('home')} rawFrame={{
          path: params.get('path') ?? 'adaptive_quiz', start: params.get('start') === 'further_in' ? 'further_in' : 'beginning', basis: 'prior_exposure',
          learner_chosen: params.get('path') === 'learner_chose_start' || params.get('path') === 'learner_adjusted',
        }} />
      : screen === 'learningquality' ? <main className="lf-family-preview" data-surface="app" data-screen="learning-quality-host">
        <LearningQualityPanel key={`quality:${locale}:${params.get('quality')}`} fixture locale={locale} dark={theme === 'dark'}
          state={params.get('quality') === 'error' ? { status: 'error' } : params.get('quality') === 'loading' ? { status: 'loading' }
            : params.get('quality') === 'empty' ? { status: 'ready', report: { ...learningQualityFixture(), lessons: [], reviews: [], judgment: [],
              replayNotice: { below_best: 0, shown: 0, display_rate: null, target: 1, belowTarget: false } } }
            : { status: 'ready', report: learningQualityFixture() }}
          onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />
      </main>
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
