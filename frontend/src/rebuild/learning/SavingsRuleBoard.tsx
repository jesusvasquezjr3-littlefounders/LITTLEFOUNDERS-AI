import { useId, useState } from 'react';
import { pluralUnit } from '../design/plural';
import type { Locale } from '../design/copyBudget';
import { Button, SegmentedControl, ProgressBar, Stepper } from '../design/controls';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { savingsRuleCases, savingsRuleOutcome, type RuleCase, type RuleLink } from './savingsRuleModel';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import { TeachingChartBoard } from './TeachingChartBoard';
import { ConditionRuleVisual } from './pizarron';
import './learning.css';
import './savingsRule.css';
import { LessonStageSlot } from './lessonStage';
import { GradedFoot, SegmentPrompt, useSegmentGrade, type OnGradeSegment, gradeStageVerdict } from './segmentKit';
import { namedFeedback } from './namedFeedback';

type SavingsRuleSegment = Extract<LessonClientSegment, { type: 'logic.savings-rule.v2' }>;
type Labels = { reset: string; back: string; explore: string; progress: string; board: string; showTable: string; showChart: string;
  case: string; result: string; goalMet: string; goalDay: string; yes: string; no: string; and: string; or: string;
  choose: string; ready: string; wait: string; previous: string; next: string; link: string; coin: string; coins: string;
  continue: string; title: string; prompt: string;
  /* L2 graded (Part 4.6): the learner builds the savings condition, then Core runs it on hidden cases. */
  saved: string; atLeast: string; moreThan: string; compare: string; savedOnly: string; fewer: string; more: string };
const copy: Record<Locale, Labels> = {
  'en-US': { reset: 'Reset', back: 'Back', explore: 'Explore', progress: 'Lesson progress', board: 'Savings rule', showTable: 'Show as table',
    showChart: 'Show rule', case: 'Case', result: 'Result', goalMet: 'Goal met?', goalDay: 'Goal day?', yes: 'Yes', no: 'No',
    and: 'AND', or: 'OR', choose: 'Choose a link', ready: 'Rule says ready', wait: 'Rule says wait', previous: 'Previous',
    next: 'Next', link: 'Link the conditions', coin: 'coin', coins: 'coins', continue: 'Continue',
    title: 'Build a savings rule', prompt: 'Choose AND or OR. When is the goal ready?',
    saved: 'Saved amount', atLeast: 'At least', moreThan: 'More than', compare: 'How to compare', savedOnly: 'Savings only', fewer: 'Fewer', more: 'More' },
  'es-MX': { reset: 'Restablecer', back: 'Volver', explore: 'Explorar', progress: 'Progreso de lección', board: 'Regla de ahorro',
    showTable: 'Ver tabla', showChart: 'Ver regla', case: 'Caso', result: 'Resultado', goalMet: '¿Meta cumplida?',
    goalDay: '¿Llegó el día?', yes: 'Sí', no: 'No', and: 'Y', or: 'O', choose: 'Elige un nexo', ready: 'La regla dice: lista',
    wait: 'La regla dice: espera', previous: 'Anterior', next: 'Siguiente', link: 'Une las condiciones',
    coin: 'moneda', coins: 'monedas', continue: 'Continuar', title: 'Crea una regla de ahorro',
    prompt: 'Elige Y u O. ¿Cuándo está lista la meta?',
    saved: 'Cantidad ahorrada', atLeast: 'Al menos', moreThan: 'Más de', compare: 'Cómo comparar', savedOnly: 'Solo ahorro', fewer: 'Menos', more: 'Más' },
  'pt-BR': { reset: 'Recomeçar', back: 'Voltar', explore: 'Explorar', progress: 'Progresso da lição', board: 'Regra de poupança',
    showTable: 'Ver tabela', showChart: 'Ver regra', case: 'Caso', result: 'Resultado', goalMet: 'Meta atingida?',
    goalDay: 'Chegou o dia?', yes: 'Sim', no: 'Não', and: 'E', or: 'OU', choose: 'Escolha uma ligação',
    ready: 'Regra diz: pronta', wait: 'Regra diz: aguarde', previous: 'Anterior', next: 'Próximo', link: 'Ligue as condições',
    coin: 'moeda', coins: 'moedas', continue: 'Continuar', title: 'Crie uma regra de poupança',
    prompt: 'Escolha E ou OU. Quando a meta está pronta?',
    saved: 'Valor guardado', atLeast: 'Pelo menos', moreThan: 'Mais de', compare: 'Como comparar', savedOnly: 'Só poupança', fewer: 'Menos', more: 'Mais' },
};

/** Answerless L2 rule-building candidate with four visible truth cases. */
export function savingsRulePilotDocument(locale: Locale): unknown {
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'saving-rules',
    lesson_id: 'pilot-savings-rule', version_id: 'rev-1', locale, age_band: '10-12', eligibility: ageEligibilityForBand('10-12'),
    knowledge_component_ids: ['kc-conditional-decision'], adventure_scene_id: 'diorama-a', title: t.title,
    required_capabilities: ['visual.rule-diagram.v1', 'operation.choose-connective.v1', 'operation.case-step.v1'],
    segments: [{ id: 'rule-01', type: 'logic.savings-rule.v2', prompt: t.prompt, grading: 'none',
      visual: { type: 'rule-diagram' }, payload: { goal: 10, shortfall: 2 } }],
  };
}

export function SavingsRuleBoard({ document, segment, onBack, sequence, onGrade }: {
  document: LessonClientDocument; segment: SavingsRuleSegment; onBack: () => void; sequence?: LessonSequenceControl; onGrade?: OnGradeSegment;
}) {
  const t = copy[document.locale];
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server' && !!onGrade;
  const [comparator, setComparator] = useState<'>=' | '>' | null>(null);
  const [threshold, setThreshold] = useState(0);
  const [ruleLink, setRuleLink] = useState<'and' | 'or' | 'none' | null>(null);
  const cases = savingsRuleCases(segment.payload.goal, segment.payload.shortfall);
  const [link, setLink] = useState<RuleLink | null>(null);
  const linkName = useId();
  const [caseIndex, setCaseIndex] = useState(0);
  const selected = cases?.[caseIndex];
  if (!cases || !selected) return null;
  const met = selected.saved >= selected.goal;
  const result = link ? savingsRuleOutcome(selected, link) : null;
  const resultLabel = result === null ? t.choose : result ? t.ready : t.wait;
  const amount = (value: number) => `${new Intl.NumberFormat(document.locale).format(value)} ${pluralUnit(document.locale, value, { one: t.coin, other: t.coins })}`;
  const caseText = (value: RuleCase) => `${amount(value.saved)}; ${t.goalDay} ${value.goalDay ? t.yes : t.no}`;
  const progress = sequenceProgress(sequence, link !== null && caseIndex === cases.length - 1);

  return <main className="lf-learning" data-surface="app" data-screen="savings-rule">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={progress} max={100} valueText={`${progress}%`} /> : null}
        <span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.explore}</span></header><LessonStageSlot verdict={gradeStageVerdict(grading.result)} />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1>
          <SegmentPrompt segment={segment} locale={document.locale} /></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart}
          columns={[t.case, t.result]} rows={cases.map((value, index) => ({ id: index,
            label: caseText(value), value: link ? savingsRuleOutcome(value, link) ? t.ready : t.wait : '?' }))}
          chart={<ConditionRuleVisual
            label={`${t.case} ${caseIndex + 1}: ${t.goalMet} ${met ? t.yes : t.no}. ${t.goalDay} ${selected.goalDay ? t.yes : t.no}. ${resultLabel}.`}
            conditions={[{ id: 'goal-met', label: t.goalMet, valueText: met ? t.yes : t.no }, { id: 'goal-day', label: t.goalDay, valueText: selected.goalDay ? t.yes : t.no }]}
            linkText={link ? t[link] : '?'} outcomeText={resultLabel} />}>
          {() => <div className="lf-rule-controls">
            {/* Bible 05 §3: Reset restores the authored start (no connective chosen, the first case, an empty graded rule) and clears the verdict. */}
            <Button onClick={() => { grading.reset(); setLink(null); setCaseIndex(0); setComparator(null); setThreshold(0); setRuleLink(null); }}
              disabled={grading.met || link === null && caseIndex === 0 && comparator === null && threshold === 0 && ruleLink === null}>{t.reset}</Button>
            <SegmentedControl legend={t.link} legendHidden name={`${linkName}-link`} value={link}
              onValueChange={setLink} options={(['and', 'or'] as const).map((value) => ({ value, label: t[value] }))} />
            <div className="lf-rule-cases">
              <Button disabled={caseIndex === 0} onClick={() => setCaseIndex((value) => value - 1)}>{t.previous}</Button>
              <span data-copy-role="data">{t.case} {caseIndex + 1}/{cases.length}</span>
              <Button disabled={caseIndex === cases.length - 1} onClick={() => setCaseIndex((value) => value + 1)}>{t.next}</Button>
            </div>
          </div>}
        </TeachingChartBoard>
        {graded ? <section className="lf-learning-control-strip" aria-label={t.board}>
          <SegmentedControl legend={t.compare} name={`${linkName}-compare`} value={comparator} onValueChange={(value) => { grading.reset(); setComparator(value); }}
            options={[{ value: '>=' as const, label: t.atLeast }, { value: '>' as const, label: t.moreThan }]} />
          <Stepper label={t.saved} min={0} max={segment.payload.goal * 2} value={threshold} valueText={amount(threshold)}
            onValueChange={(value) => { grading.reset(); setThreshold(value); }} labels={{ decrease: t.fewer, increase: t.more }} />
          <SegmentedControl legend={t.link} name={`${linkName}-rule-link`} value={ruleLink} onValueChange={(value) => { grading.reset(); setRuleLink(value); }}
            options={document.age_band === '6-9' ? [{ value: 'none' as const, label: t.savedOnly }]
              : [{ value: 'and' as const, label: t.and }, { value: 'or' as const, label: t.or }, { value: 'none' as const, label: t.savedOnly }]} />
        </section> : null}
        {graded ? <GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'savings-rule')} feedback={segment.feedback} canCheck={comparator !== null && ruleLink !== null} sequence={sequence}
          onCheck={() => grading.check({ comparator, threshold, link: ruleLink })} /> : null}
        <footer className="lf-rule-foot"><p role="status" aria-live="polite" data-copy-role="body">{resultLabel}</p>
          {sequence && !graded ? <Button variant="accent" disabled={!link || caseIndex !== cases.length - 1}
            onClick={sequence.onAdvance}>{t.continue}</Button> : null}</footer>
      </div>
    </div>
  </main>;
}
