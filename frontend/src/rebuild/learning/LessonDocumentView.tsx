import { useLayoutEffect, useState } from 'react';
import { InlineNotice } from '../design/controls';
import en from '../../i18n/en-US/rebuild-learn.json';
import es from '../../i18n/es-MX/rebuild-learn.json';
import pt from '../../i18n/pt-BR/rebuild-learn.json';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import { AllocationBoard } from './AllocationBoard';
import { GrowthBoard } from './GrowthBoard';
import { GoalBulletBoard } from './GoalBulletBoard';
import { NumberLineBoard } from './NumberLineBoard';
import { PercentGridBoard } from './PercentGridBoard';
import { PlaceValueBoard } from './PlaceValueBoard';
import { SavingsRuleBoard } from './SavingsRuleBoard';
import { RunningLedgerBoard } from './RunningLedgerBoard';
import { GrowthComparisonBoard } from './GrowthComparisonBoard';
import { RatioTableBoard } from './RatioTableBoard';
import { TaxBracketBoard } from './TaxBracketBoard';
import { FractionNumberLineBoard } from './FractionNumberLineBoard';
import { FractionAreaBoard } from './FractionAreaBoard';
import { BarModelBoard } from './BarModelBoard';
import { SchemaDiagramBoard } from './SchemaDiagramBoard';
import { WorkedExampleBoard } from './WorkedExampleBoard';
import { FunctionMachineBoard } from './FunctionMachineBoard';
import { CpaFadingBoard } from './CpaFadingBoard';
import { DecisionReasonsBoard, type ReasoningGrade } from './DecisionReasonsBoard';
import type { Allocation } from './allocationModel';
import { LessonStageProvider } from './lessonStage';
import { lessonVersionKey, loadLessonClientDocument, type AdventureTheme, type LessonClientDocument, type LessonClientSegment, type LessonMentorStage } from './lessonDocument';
import { AmortizationBoard, DebtPayoffBoard, DiversificationBoard, InflationBoard, LemonadeStandBoard, OpportunityCostBoard, RuleOf72Board, SupplyDemandBoard } from './conceptBoards';
import { V2_CONCEPT_TYPES } from './v2ConceptBoards.generated';
import { ChartBoard, CoinTrayBoard, EulerBoard, FlowchartBoard, MentorEpisodeBoard, MentorTurnBoard, MessageListBoard, RuleCardsBoard, SortBinsBoard, StoryChoiceBoard } from './familyBoards';
import { LessonPlayerProvider, playerCopy, type SegmentGrade } from './segmentKit';

export type CheckResult = 'invalid' | 'incomplete' | 'review' | 'met';
export type OnGrade = (answer: Allocation, segmentId: string, document: LessonClientDocument) => CheckResult | Promise<CheckResult>;
export type OnGradeNumberLine = (answer: { value: string }, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
export type OnGradeFractionArea = (answer: { n: number; d: number }, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
export type OnGradeBarModel = (answer: Record<string, unknown>, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
export type OnGradeSchemaDiagram = (answer: Record<string, unknown>, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
export type OnGradeWorkedExample = (answer: { values: Record<string, string> }, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
/** B.12: a reasoning answer returns the decision verdict and, separately, the judgment quality of the reason. */
export type OnGradeReasoning = (answer: { choice: string; reason: string }, segmentId: string, document: LessonClientDocument) => ReasoningGrade | Promise<ReasoningGrade>;
/** GAP-FIX-R1: one grader for every newly gradable visual and first-release family (the answer is whatever the board built). */
export type OnGradeAny = (answer: unknown, segmentId: string, document: LessonClientDocument) => SegmentGrade | Promise<SegmentGrade>;
/** GAP-FIX-R1 (OD-17): Core's view receipt for a non-scored step; false keeps the learner on the step. */
export type OnView = (segmentId: string, document: LessonClientDocument) => Promise<boolean>;
const copy = { 'en-US': en, 'es-MX': es, 'pt-BR': pt };

/** The kinds introduced for the first release: each needs the generic grader when graded. */
const FAMILY_TYPES = new Set(['logic.rule-checker.v2', 'logic.euler.v2', 'logic.flowchart.v2', 'money.spend-decision.v2', 'logic.sort-by-rule.v2', 'money.needs-wants.v2',
  'logic.scam-spotter.v2', 'money.scam-check.v2', 'money.coin-tray.v2', 'money.making-change.v2', 'story.branch.v2', 'story.dialogue-choice.v2', 'story.would-you-rather.v2']);

function canRender(segment: LessonClientSegment, onGrade?: OnGrade, onGradeNumberLine?: OnGradeNumberLine, onGradeFractionArea?: OnGradeFractionArea, onGradeBarModel?: OnGradeBarModel, onGradeSchemaDiagram?: OnGradeSchemaDiagram, onGradeWorkedExample?: OnGradeWorkedExample, onGradeReasoning?: OnGradeReasoning, onGradeAny?: OnGradeAny): boolean {
  // A formerly presentation-only visual that the document now grades needs the generic grader (Appendix P Part 7).
  if (segment.grading === 'server' && (FAMILY_TYPES.has(segment.type) || (V2_CONCEPT_TYPES as readonly string[]).includes(segment.type) || ['visual.chart.v2', 'visual.goal-bullet.v2', 'visual.percent-grid.v2', 'math.place-value.v2', 'logic.savings-rule.v2',
    'money.running-ledger.v2', 'visual.growth-comparison.v2', 'visual.tax-bracket.v2', 'math.ratio-table.v2'].includes(segment.type))) return !!onGradeAny;
  switch (segment.type) {
    case 'money.allocation.v2': return !!onGrade;
    case 'math.number-line.whole.v2': return !!onGradeNumberLine;
    case 'math.number-line.fraction.v2': return !!onGradeNumberLine;
    case 'math.fraction-area.v2': return !!onGradeFractionArea;
    case 'math.bar-model.structure.v2':
    case 'math.bar-model.answer.v2': return !!onGradeBarModel;
    case 'math.function-machine.v2': return !!onGradeBarModel;
    case 'math.cpa-count.v2': return !!onGradeNumberLine;
    case 'math.schema-diagram.structure.v2':
    case 'math.schema-diagram.slots.v2':
    case 'math.schema-diagram.answer.v2': return !!onGradeSchemaDiagram;
    case 'visual.savings-line.v2':
    case 'visual.goal-bullet.v2':
    case 'visual.percent-grid.v2': return true;
    case 'math.place-value.v2': return true;
    case 'logic.savings-rule.v2': return true;
    case 'money.running-ledger.v2': return true;
    case 'visual.growth-comparison.v2': return true;
    case 'math.ratio-table.v2': return true;
    case 'visual.tax-bracket.v2': return true;
    case 'math.worked-example.v2': return !!onGradeWorkedExample;
    case 'reasoning.decide-justify.v2': return !!onGradeReasoning;
    case 'voice.mentor-turn.v2':
    case 'voice.mentor-episode.v2': return true;
    case 'visual.chart.v2': return segment.grading === 'none' || !!onGradeAny;
    case 'logic.rule-checker.v2': case 'logic.euler.v2': case 'logic.flowchart.v2': case 'money.spend-decision.v2': case 'logic.sort-by-rule.v2':
    case 'money.needs-wants.v2': case 'logic.scam-spotter.v2': case 'money.scam-check.v2': case 'money.coin-tray.v2': case 'money.making-change.v2':
    case 'story.branch.v2': case 'story.dialogue-choice.v2': case 'story.would-you-rather.v2': return !!onGradeAny;
    // Appendix A Part 3 concept boards: explored boards render anywhere; graded ones need the generic grader (checked above).
    case 'money.amortization.v2': case 'econ.supply-demand.v2': case 'money.opportunity-cost.v2': case 'money.inflation.v2': case 'money.rule-of-72.v2':
    case 'money.debt-payoff.v2': case 'money.diversification.v2': case 'money.lemonade-stand.v2': return true;
    default: {
      const exhaustive: never = segment;
      void exhaustive;
      return false;
    }
  }
}

/** The pilot renderer refuses any document it cannot display in full. */
/**
 * GAP-FIX-R1 (OD-17, OD-24, B.7): the general ordered-segment player. Any mix
 * of supported segments plays in order with progress across all of them; the
 * M1 fading rules apply only to groups declared in `representation_progressions`
 * (Core validates them). A segment this build cannot render, or a document it
 * cannot parse because it is newer, is the B.4 update-required screen.
 */
export function LessonDocumentView({ raw, locale, ageBand, onBack, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onGradeReasoning, onGradeAny, onView, onHelpUsed, onComplete, metSegmentIds = [], attemptedSegmentIds = [], viewedSegmentIds = [], mentorStage = null, adventureTheme = null, theme = 'light', previewSequence = false }: {
  raw: unknown; locale: Locale; ageBand: AgeBand; onBack: () => void; onGrade?: OnGrade; onGradeNumberLine?: OnGradeNumberLine; onGradeFractionArea?: OnGradeFractionArea; onGradeBarModel?: OnGradeBarModel; onGradeSchemaDiagram?: OnGradeSchemaDiagram; onGradeWorkedExample?: OnGradeWorkedExample; onGradeReasoning?: OnGradeReasoning;
  onGradeAny?: OnGradeAny; onView?: OnView; onHelpUsed?: (segmentId: string, steps: number) => void;
  metSegmentIds?: string[];
  attemptedSegmentIds?: string[];
  viewedSegmentIds?: string[];
  onComplete?: () => Promise<boolean>;
  mentorStage?: LessonMentorStage | null; adventureTheme?: AdventureTheme | null; theme?: 'light' | 'dark'; previewSequence?: boolean;
}) {
  const loaded = loadLessonClientDocument(raw);
  if (loaded.status !== 'ready') return loaded.status === 'upgrade-required' ? <UpdateRequired locale={locale} onBack={onBack} /> : unavailable(locale, onBack, 'invalid');
  const supported = loaded.document.segments.every((segment) => canRender(segment, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onGradeReasoning, onGradeAny));
  if (loaded.document.locale !== locale || loaded.document.age_band !== ageBand) return unavailable(locale, onBack, 'invalid');
  if (!supported) return <UpdateRequired locale={locale} onBack={onBack} />;
  // W2L.3 (B.8): every board's stage slot reads Core's projection from here; the allocation pilot keeps its own prop.
  return <LessonStageProvider stage={mentorStage} ageBand={loaded.document.age_band} theme={theme} adventureTheme={adventureTheme}>
    <LessonPlayerProvider stage={mentorStage} theme={theme} onHelpUsed={onHelpUsed}>
      <ValidatedLessonView key={lessonVersionKey(loaded.document)} document={loaded.document} onBack={onBack} onGrade={onGrade}
        onGradeNumberLine={onGradeNumberLine} onGradeFractionArea={onGradeFractionArea} onGradeBarModel={onGradeBarModel} onGradeSchemaDiagram={onGradeSchemaDiagram} onGradeWorkedExample={onGradeWorkedExample} onGradeReasoning={onGradeReasoning}
        onGradeAny={onGradeAny} onView={onView} onComplete={onComplete} metSegmentIds={metSegmentIds} attemptedSegmentIds={attemptedSegmentIds} viewedSegmentIds={viewedSegmentIds}
        mentorStage={mentorStage} theme={theme} previewSequence={previewSequence} />
    </LessonPlayerProvider>
  </LessonStageProvider>;
}

function ValidatedLessonView({ document, onBack, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onGradeReasoning, onGradeAny, onView, onComplete, metSegmentIds, attemptedSegmentIds, viewedSegmentIds, mentorStage, theme, previewSequence }: {
  document: LessonClientDocument; onBack: () => void; onGrade?: OnGrade; onGradeNumberLine?: OnGradeNumberLine; onGradeFractionArea?: OnGradeFractionArea; onGradeBarModel?: OnGradeBarModel; onGradeSchemaDiagram?: OnGradeSchemaDiagram; onGradeWorkedExample?: OnGradeWorkedExample; onGradeReasoning?: OnGradeReasoning;
  onGradeAny?: OnGradeAny; onView?: OnView;
  metSegmentIds: string[];
  attemptedSegmentIds: string[];
  viewedSegmentIds: string[];
  onComplete?: () => Promise<boolean>;
  mentorStage: LessonMentorStage | null; theme: 'light' | 'dark'; previewSequence: boolean;
}) {
  const [viewFailed, setViewFailed] = useState(false);
  const [index, setIndex] = useState(() => {
    const restored = new Set([...metSegmentIds, ...viewedSegmentIds]);
    // M1 reviews are valid experiences for the next representation, but never
    // become a met receipt or completion authority. A review of the final
    // symbolic stage must reopen that stage rather than expose Finish.
    if (document.representation_progressions) {
      const finalStageIds = new Set(document.representation_progressions
        .flatMap((progression) => progression.stages)
        .filter((stage) => stage.stage === 'abstract')
        .map((stage) => stage.segment_id));
      for (const id of attemptedSegmentIds) if (!finalStageIds.has(id)) restored.add(id);
    }
    const firstPending = document.segments.findIndex((item) => !restored.has(item.id));
    return firstPending === -1 ? document.segments.length : firstPending;
  });
  useLayoutEffect(() => { try { window.scrollTo(0, 0); } catch { /* jsdom has no scroll implementation */ } }, [index]);
  const segment = document.segments[index];
  // Every multi-step document, and every authenticated one, advances through the same sequence control.
  const sequence = (document.segments.length > 1 || !!onComplete || previewSequence)
    ? { index, total: document.segments.length, onAdvance: () => {
      void (async () => {
        // A non-scored step is recorded with Core before the learner moves on (version-pinned completion).
        if (segment && segment.grading === 'none' && onView && !(await onView(segment.id, document))) { setViewFailed(true); return; }
        setViewFailed(false);
        setIndex((current) => Math.min(current + 1, document.segments.length));
      })();
    } } : undefined;
  if (!segment) return <V2SequenceEnd locale={document.locale} onBack={onBack} onComplete={onComplete} />;
  const key = `${lessonVersionKey(document)}:${segment.id}`;
  const board = renderSegment(segment, key);
  return viewFailed ? <>{board}<div className="lf-learning-view-failed"><InlineNotice tone="error" live>{playerCopy(document.locale).viewFailed}</InlineNotice></div></> : board;

  function renderSegment(segment: LessonClientSegment, key: string) {
  const any = onGradeAny ? (answer: unknown, id: string) => onGradeAny(answer, id, document) : undefined;
  switch (segment.type) {
    case 'logic.rule-checker.v2': return <RuleCardsBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'logic.euler.v2': return <EulerBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'logic.flowchart.v2':
    case 'money.spend-decision.v2': return <FlowchartBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'logic.sort-by-rule.v2':
    case 'money.needs-wants.v2': return <SortBinsBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'logic.scam-spotter.v2':
    case 'money.scam-check.v2': return <MessageListBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'money.coin-tray.v2':
    case 'money.making-change.v2': return <CoinTrayBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'story.branch.v2':
    case 'story.dialogue-choice.v2':
    case 'story.would-you-rather.v2': return <StoryChoiceBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'visual.chart.v2': return <ChartBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'voice.mentor-turn.v2': return <MentorTurnBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'voice.mentor-episode.v2': return <MentorEpisodeBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'money.amortization.v2': return <AmortizationBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'econ.supply-demand.v2': return <SupplyDemandBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'money.opportunity-cost.v2': return <OpportunityCostBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'money.inflation.v2': return <InflationBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'money.rule-of-72.v2': return <RuleOf72Board key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'money.debt-payoff.v2': return <DebtPayoffBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'money.diversification.v2': return <DiversificationBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'money.lemonade-stand.v2': return <LemonadeStandBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'money.allocation.v2': return onGrade ? <AllocationBoard key={key} document={document} segment={segment}
      onBack={onBack} onCheck={(answer, segmentId) => onGrade(answer, segmentId, document)} mentorStage={mentorStage} theme={theme} sequence={sequence} />
      : unavailable(document.locale, onBack);
    case 'visual.savings-line.v2': return <GrowthBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'visual.goal-bullet.v2': return <GoalBulletBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'visual.percent-grid.v2': return <PercentGridBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'math.place-value.v2': return document.age_band !== '6-9' ? unavailable(document.locale, onBack)
      : <PlaceValueBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'logic.savings-rule.v2': return document.age_band !== '10-12' ? unavailable(document.locale, onBack)
      : <SavingsRuleBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'money.running-ledger.v2': return document.age_band !== '13-17' ? unavailable(document.locale, onBack)
      : <RunningLedgerBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'visual.growth-comparison.v2': return document.age_band !== '13-17' ? unavailable(document.locale, onBack)
      : <GrowthComparisonBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'math.ratio-table.v2': return document.age_band !== '10-12' ? unavailable(document.locale, onBack)
      : <RatioTableBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'visual.tax-bracket.v2': return document.age_band !== '13-17' ? unavailable(document.locale, onBack)
      : <TaxBracketBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={any} />;
    case 'math.worked-example.v2': return document.age_band !== '10-12' || !onGradeWorkedExample ? unavailable(document.locale, onBack)
      : <WorkedExampleBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence}
        onGrade={(answer, id) => onGradeWorkedExample(answer, id, document)} />;
    case 'math.function-machine.v2': return document.age_band !== '10-12' || !onGradeBarModel ? unavailable(document.locale, onBack)
      : <FunctionMachineBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence}
        onGrade={(answer, id) => onGradeBarModel(answer, id, document)} />;
    case 'math.cpa-count.v2': return !onGradeNumberLine || !sequence ? unavailable(document.locale, onBack)
      : <CpaFadingBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence}
        onGrade={(answer, id) => onGradeNumberLine(answer, id, document)} />;
    case 'math.number-line.whole.v2': return onGradeNumberLine ? <NumberLineBoard key={key}
      document={document} segment={segment} onBack={onBack} sequence={sequence}
      onGrade={(answer, segmentId) => onGradeNumberLine(answer, segmentId, document)} />
      : unavailable(document.locale, onBack);
    case 'math.number-line.fraction.v2': return document.age_band !== '10-12' ? unavailable(document.locale, onBack)
      : onGradeNumberLine ? <FractionNumberLineBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence}
        onGrade={(answer, segmentId) => onGradeNumberLine(answer, segmentId, document)} /> : unavailable(document.locale, onBack);
    case 'math.fraction-area.v2': return document.age_band !== '6-9' ? unavailable(document.locale, onBack)
      : onGradeFractionArea ? <FractionAreaBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence}
        onGrade={(answer, segmentId) => onGradeFractionArea(answer, segmentId, document)} /> : unavailable(document.locale, onBack);
    case 'reasoning.decide-justify.v2': return onGradeReasoning ? <DecisionReasonsBoard key={key} document={document} segment={segment} onBack={onBack}
      sequence={sequence} onGrade={(answer, id) => onGradeReasoning(answer, id, document)} /> : unavailable(document.locale, onBack, 'upgrade');
    case 'math.bar-model.structure.v2':
    case 'math.bar-model.answer.v2': return onGradeBarModel ? <BarModelBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={(answer, id) => onGradeBarModel(answer, id, document)} /> : unavailable(document.locale, onBack, 'upgrade');
    case 'math.schema-diagram.structure.v2':
    case 'math.schema-diagram.slots.v2':
    case 'math.schema-diagram.answer.v2': return onGradeSchemaDiagram ? <SchemaDiagramBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} onGrade={(answer, id) => onGradeSchemaDiagram(answer, id, document)} /> : unavailable(document.locale, onBack, 'upgrade');
    default: {
      const exhaustive: never = segment;
      void exhaustive;
      return unavailable(document.locale, onBack);
    }
  }
  }
}

/**
 * B.4 (GAP-FIX-R1): the lesson is newer than this app. The learner is asked
 * to update the app, never told the lesson is broken; Reload drops cached
 * lazy chunks and reloads with a cache-busting query, and Back stays second.
 */
function UpdateRequired({ locale, onBack }: { locale: Locale; onBack: () => void }) {
  const t = playerCopy(locale);
  const [reloading, setReloading] = useState(false);
  const reload = async () => {
    setReloading(true);
    try {
      if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
    } catch { /* A browser without the Cache API still reloads. */ }
    const url = new URL(window.location.href);
    url.searchParams.set('app-reload', String(Date.now()));
    window.location.replace(url.toString());
  };
  return <main className="lf-learning" data-surface="app" data-screen="lesson-update">
    <div className="lf-learning-inner lf-learning-state lf-learning-update">
      <h1 className="lf-learning-unavailable" data-copy-role="heading">{t.updateTitle}</h1>
      <p data-copy-role="body">{t.updateBody}</p>
      <div className="lf-learning-update-actions">
        <Button variant="accent" pending={reloading} onClick={() => { void reload(); }}>{t.reload}</Button>
        <Button onClick={onBack}>{copy[locale].back}</Button>
      </div>
    </div>
  </main>;
}

function V2SequenceEnd({ locale, onBack, onComplete }: { locale: Locale; onBack: () => void; onComplete?: () => Promise<boolean> }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed' | 'done'>('idle');
  const finish = async () => {
    if (!onComplete) return onBack();
    setStatus('saving');
    setStatus((await onComplete()) ? 'done' : 'failed');
  };
  const c = endCopy[locale];
  const authenticated = !!onComplete;
  return <main className="lf-learning" data-surface="app" data-screen="lesson-preview-end"><div className="lf-learning-inner lf-learning-preview-end">
    <h1 data-copy-role="heading">{authenticated ? c.heading : c.previewHeading}</h1><p data-copy-role="body">{authenticated ? status === 'failed' ? c.failed : c.body : c.previewBody}</p>
    <Button variant="accent" onClick={finish} disabled={status === 'saving'}>{authenticated ? status === 'saving' ? c.saving : status === 'done' ? copy[locale].back : c.finish : copy[locale].back}</Button>
  </div></main>;
}

const endCopy = {
  'en-US': { heading: 'Lesson ready', body: 'Save your progress.', finish: 'Finish lesson', saving: 'Saving', failed: 'Could not save. Try again.', previewHeading: 'Preview finished', previewBody: 'Progress is not saved.' },
  'es-MX': { heading: 'Lección lista', body: 'Guarda tu avance.', finish: 'Terminar lección', saving: 'Guardando', failed: 'No se pudo guardar. Intenta otra vez.', previewHeading: 'Vista terminada', previewBody: 'El progreso no se guarda.' },
  'pt-BR': { heading: 'Lição pronta', body: 'Salve seu progresso.', finish: 'Concluir lição', saving: 'Salvando', failed: 'Não foi possível salvar. Tente de novo.', previewHeading: 'Prévia concluída', previewBody: 'O progresso não é salvo.' },
};

function unavailable(locale: Locale, onBack: () => void, reason: 'upgrade' | 'invalid' = 'invalid') {
  if (reason === 'upgrade') return <UpdateRequired locale={locale} onBack={onBack} />;
  return <main className="lf-learning" data-surface="app" data-screen="lesson-unavailable">
    <div className="lf-learning-inner lf-learning-state"><h1 className="lf-learning-unavailable" data-copy-role="heading">{copy[locale].lessonInvalid}</h1>
      <Button onClick={onBack}>{copy[locale].back}</Button>
    </div>
  </main>;
}
