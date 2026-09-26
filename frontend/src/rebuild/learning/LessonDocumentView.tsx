import { useLayoutEffect, useState } from 'react';
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
import { lessonVersionKey, loadLessonClientDocument, type LessonClientDocument, type LessonClientSegment, type LessonMentorStage } from './lessonDocument';

export type CheckResult = 'invalid' | 'incomplete' | 'review' | 'met';
export type OnGrade = (answer: Allocation, segmentId: string, document: LessonClientDocument) => CheckResult | Promise<CheckResult>;
export type OnGradeNumberLine = (answer: { value: string }, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
export type OnGradeFractionArea = (answer: { n: number; d: number }, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
export type OnGradeBarModel = (answer: Record<string, unknown>, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
export type OnGradeSchemaDiagram = (answer: Record<string, unknown>, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
export type OnGradeWorkedExample = (answer: { values: Record<string, string> }, segmentId: string, document: LessonClientDocument) => 'invalid' | 'met' | 'review' | Promise<'invalid' | 'met' | 'review'>;
/** B.12: a reasoning answer returns the decision verdict and, separately, the judgment quality of the reason. */
export type OnGradeReasoning = (answer: { choice: string; reason: string }, segmentId: string, document: LessonClientDocument) => ReasoningGrade | Promise<ReasoningGrade>;
const copy = { 'en-US': en, 'es-MX': es, 'pt-BR': pt };

function canRender(segment: LessonClientSegment, onGrade?: OnGrade, onGradeNumberLine?: OnGradeNumberLine, onGradeFractionArea?: OnGradeFractionArea, onGradeBarModel?: OnGradeBarModel, onGradeSchemaDiagram?: OnGradeSchemaDiagram, onGradeWorkedExample?: OnGradeWorkedExample, onGradeReasoning?: OnGradeReasoning): boolean {
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
    default: {
      const exhaustive: never = segment;
      void exhaustive;
      return false;
    }
  }
}

/** The pilot renderer refuses any document it cannot display in full. */
export function LessonDocumentView({ raw, locale, ageBand, onBack, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onGradeReasoning, onComplete, metSegmentIds = [], attemptedSegmentIds = [], mentorStage = null, theme = 'light', previewSequence = false }: {
  raw: unknown; locale: Locale; ageBand: AgeBand; onBack: () => void; onGrade?: OnGrade; onGradeNumberLine?: OnGradeNumberLine; onGradeFractionArea?: OnGradeFractionArea; onGradeBarModel?: OnGradeBarModel; onGradeSchemaDiagram?: OnGradeSchemaDiagram; onGradeWorkedExample?: OnGradeWorkedExample; onGradeReasoning?: OnGradeReasoning;
  metSegmentIds?: string[];
  attemptedSegmentIds?: string[];
  onComplete?: () => Promise<boolean>;
  mentorStage?: LessonMentorStage | null; theme?: 'light' | 'dark'; previewSequence?: boolean;
}) {
  const loaded = loadLessonClientDocument(raw);
  if (loaded.status !== 'ready') return unavailable(locale, onBack, loaded.status === 'upgrade-required' ? 'upgrade' : 'invalid');
  const supported = loaded.document.segments.every((segment) => canRender(segment, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onGradeReasoning));
  if (loaded.document.locale !== locale || loaded.document.age_band !== ageBand) return unavailable(locale, onBack, 'invalid');
  const barSequence = loaded.document.segments.length === 2 && loaded.document.segments[0]?.type === 'math.bar-model.structure.v2' && loaded.document.segments[1]?.type === 'math.bar-model.answer.v2';
  const schemaSequence = loaded.document.segments.length === 3 && loaded.document.segments[0]?.type === 'math.schema-diagram.structure.v2' && loaded.document.segments[1]?.type === 'math.schema-diagram.slots.v2' && loaded.document.segments[2]?.type === 'math.schema-diagram.answer.v2';
  const cpaSequence = loaded.document.segments.length === 3 && loaded.document.segments.every((segment) => segment.type === 'math.cpa-count.v2') && !!loaded.document.representation_progressions;
  if (!supported || loaded.document.segments.length > 1 && !previewSequence && !barSequence && !schemaSequence && !cpaSequence) return unavailable(locale, onBack, 'upgrade');
  return <ValidatedLessonView key={lessonVersionKey(loaded.document)} document={loaded.document} onBack={onBack} onGrade={onGrade}
    onGradeNumberLine={onGradeNumberLine} onGradeFractionArea={onGradeFractionArea} onGradeBarModel={onGradeBarModel} onGradeSchemaDiagram={onGradeSchemaDiagram} onGradeWorkedExample={onGradeWorkedExample} onGradeReasoning={onGradeReasoning} onComplete={onComplete} metSegmentIds={metSegmentIds} attemptedSegmentIds={attemptedSegmentIds} mentorStage={mentorStage} theme={theme} previewSequence={previewSequence||barSequence||schemaSequence||cpaSequence} />;
}

function ValidatedLessonView({ document, onBack, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onGradeReasoning, onComplete, metSegmentIds, attemptedSegmentIds, mentorStage, theme, previewSequence }: {
  document: LessonClientDocument; onBack: () => void; onGrade?: OnGrade; onGradeNumberLine?: OnGradeNumberLine; onGradeFractionArea?: OnGradeFractionArea; onGradeBarModel?: OnGradeBarModel; onGradeSchemaDiagram?: OnGradeSchemaDiagram; onGradeWorkedExample?: OnGradeWorkedExample; onGradeReasoning?: OnGradeReasoning;
  metSegmentIds: string[];
  attemptedSegmentIds: string[];
  onComplete?: () => Promise<boolean>;
  mentorStage: LessonMentorStage | null; theme: 'light' | 'dark'; previewSequence: boolean;
}) {
  const [index, setIndex] = useState(() => {
    const restored = new Set(metSegmentIds);
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
  const terminalScoredSequence = document.segments.length === 1 && !!onComplete
    && ['money.allocation.v2', 'math.number-line.whole.v2', 'math.number-line.fraction.v2', 'math.fraction-area.v2', 'math.worked-example.v2', 'math.function-machine.v2', 'reasoning.decide-justify.v2'].includes(document.segments[0]?.type ?? '');
  const sequence = (document.segments.length > 1 && previewSequence || terminalScoredSequence)
    ? { index, total: document.segments.length, onAdvance: () => {
      setIndex((current) => Math.min(current + 1, document.segments.length));
    } } : undefined;
  if (!segment) return <V2SequenceEnd locale={document.locale} onBack={onBack} onComplete={onComplete} />;
  const key = `${lessonVersionKey(document)}:${segment.id}`;
  switch (segment.type) {
    case 'money.allocation.v2': return onGrade ? <AllocationBoard key={key} document={document} segment={segment}
      onBack={onBack} onCheck={(answer, segmentId) => onGrade(answer, segmentId, document)} mentorStage={mentorStage} theme={theme} sequence={sequence} />
      : unavailable(document.locale, onBack);
    case 'visual.savings-line.v2': return <GrowthBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'visual.goal-bullet.v2': return <GoalBulletBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'visual.percent-grid.v2': return <PercentGridBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'math.place-value.v2': return document.age_band !== '6-9' ? unavailable(document.locale, onBack)
      : <PlaceValueBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'logic.savings-rule.v2': return document.age_band !== '10-12' ? unavailable(document.locale, onBack)
      : <SavingsRuleBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'money.running-ledger.v2': return document.age_band !== '13-17' ? unavailable(document.locale, onBack)
      : <RunningLedgerBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'visual.growth-comparison.v2': return document.age_band !== '13-17' ? unavailable(document.locale, onBack)
      : <GrowthComparisonBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'math.ratio-table.v2': return document.age_band !== '10-12' ? unavailable(document.locale, onBack)
      : <RatioTableBoard key={key} document={document} segment={segment} onBack={onBack} sequence={sequence} />;
    case 'visual.tax-bracket.v2': return document.age_band !== '13-17' ? unavailable(document.locale, onBack)
      : <TaxBracketBoard key={key} document={document} segment={segment} onBack={onBack} />;
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
  return <main className="lf-learning" data-surface="app" data-screen={reason === 'upgrade' ? 'lesson-upgrade' : 'lesson-unavailable'}>
    <div className="lf-learning-inner lf-learning-state"><h1 className="lf-learning-unavailable" data-copy-role="heading">
      {reason === 'upgrade' ? copy[locale].lessonUnavailable : copy[locale].lessonInvalid}</h1>
      <Button onClick={onBack}>{copy[locale].back}</Button>
    </div>
  </main>;
}
