import { useMemo, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Button, Slider, ProgressBar } from '../design/controls';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import { percentOutcome } from './percentModel';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import { TeachingChartBoard } from './TeachingChartBoard';
import { PercentGridVisual } from './pizarron';
import './learning.css';
import './percentGrid.css';
import { LessonStageSlot } from './lessonStage';
import { GradedFoot, NumberAnswer, SegmentPrompt, useSegmentGrade, type OnGradeSegment } from './segmentKit';


type PercentSegment = Extract<LessonClientSegment, { type: 'visual.percent-grid.v2' }>;
type Labels = { back: string; explore: string; progress: string; board: string; showTable: string; showChart: string; reset: string;
  measure: string; value: string; original: string; percent: string; discount: string; tax: string; final: string; change: string;
  less: string; more: string; grid: string; bar: string; ofHundred: string; coin: string; coins: string; continue: string;
  title: string; prompt: string };
const copy: Record<Locale, Labels> = {
  'en-US': { back: 'Back', explore: 'Explore', progress: 'Lesson progress', board: 'Board', showTable: 'Show as table', showChart: 'Show chart',
    reset: 'Reset', measure: 'Measure', value: 'Value', original: 'Original', percent: 'Percent', discount: 'Discount', tax: 'Sample tax',
    final: 'New price', change: 'Change percent', less: 'Less', more: 'More', grid: '100-grid and percent bar', bar: 'bar',
    ofHundred: 'of 100', coin: 'coin', coins: 'coins', continue: 'Continue',
    title: 'See a discount', prompt: 'Move the percent. What is the new price?' },
  'es-MX': { back: 'Volver', explore: 'Explorar', progress: 'Progreso de lección', board: 'Pizarrón', showTable: 'Ver tabla', showChart: 'Ver gráfico',
    reset: 'Restablecer', measure: 'Medida', value: 'Valor', original: 'Original', percent: 'Porcentaje', discount: 'Descuento', tax: 'Impuesto de ejemplo',
    final: 'Precio nuevo', change: 'Cambia el porcentaje', less: 'Menos', more: 'Más', grid: 'Cuadrícula de 100 y barra', bar: 'barra',
    ofHundred: 'de 100', coin: 'moneda', coins: 'monedas', continue: 'Continuar',
    title: 'Mira un descuento', prompt: 'Mueve el porcentaje. ¿Cuál es el precio nuevo?' },
  'pt-BR': { back: 'Voltar', explore: 'Explorar', progress: 'Progresso da lição', board: 'Quadro', showTable: 'Ver tabela', showChart: 'Ver gráfico',
    reset: 'Recomeçar', measure: 'Medida', value: 'Valor', original: 'Original', percent: 'Percentual', discount: 'Desconto', tax: 'Imposto de exemplo',
    final: 'Novo preço', change: 'Mude o percentual', less: 'Menos', more: 'Mais', grid: 'Grade de 100 e barra', bar: 'barra',
    ofHundred: 'de 100', coin: 'moeda', coins: 'moedas', continue: 'Continuar',
    title: 'Veja um desconto', prompt: 'Mova o percentual. Qual é o novo preço?' },
};
const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };
const fixtures: Record<'10-12', PercentSegment['payload']> = {
  '10-12': { baseUnits: 100, step: 5, initialPercent: 20, mode: 'discount', currency: 'coins' },
};

/** An answerless, controlled M15 candidate for the youngest Appendix P-compatible pathway. */
export function percentGridPilotDocument(locale: Locale, ageBand: AgeBand): unknown {
  if (ageBand !== '10-12') return null;
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `financial-${ageBand}`, chapter_id: 'percent-decisions',
    lesson_id: `pilot-percent-${ageBand}`, version_id: 'rev-1', locale, age_band: ageBand,
    eligibility: { minimum_age: 10, maximum_age: 12 },
    knowledge_component_ids: ['kc-percent-change'], adventure_scene_id: 'diorama-a', title: t.title,
    required_capabilities: ['visual.percent-grid.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
    segments: [{ id: 'percent-01', type: 'visual.percent-grid.v2', prompt: t.prompt, grading: 'none',
      visual: { type: 'percent-grid' }, payload: fixtures[ageBand] }],
  };
}

export function PercentGridBoard({ document, segment, onBack, sequence, onGrade }: {
  document: LessonClientDocument; segment: PercentSegment; onBack: () => void; sequence?: LessonSequenceControl; onGrade?: OnGradeSegment;
}) {
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server' && !!onGrade;
  const [typed, setTyped] = useState<string | null>(null);
  const t = copy[document.locale];
  const { baseUnits, step, initialPercent, mode, currency } = segment.payload;
  const [percent, setPercent] = useState(initialPercent);
  const outcome = percentOutcome(segment.payload, percent);
  const formatter = useMemo(() => new Intl.NumberFormat(document.locale, currency === 'local'
    ? { style: 'currency', currency: localCurrency[document.locale], currencyDisplay: 'code', maximumFractionDigits: 0 }
    : { maximumFractionDigits: 0 }), [document.locale, currency]);
  const amount = (n: number) => currency === 'coins' ? `${formatter.format(n)} ${n === 1 ? t.coin : t.coins}` : formatter.format(n);
  const setRate = (value: number) => { grading.reset(); if (percentOutcome(segment.payload, value)) setPercent(value); };
  const changed = mode === 'discount' ? t.discount : t.tax;

  return <main className="lf-learning" data-surface="app" data-screen="percent">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={sequenceProgress(sequence, percent !== initialPercent)} max={100} valueText={`${sequenceProgress(sequence, percent !== initialPercent)}%`} /> : null}
        <span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.explore}</span></header><LessonStageSlot />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart}
          controlLeading={<Button onClick={() => setPercent(initialPercent)} disabled={percent === initialPercent}>{t.reset}</Button>}
          columns={[t.measure, t.value]} rows={[
            { id: 'original', label: t.original, value: amount(baseUnits) },
            { id: 'percent', label: t.percent, value: `${percent}%` },
            ...(graded && !grading.met ? [] : [{ id: 'change', label: changed, value: amount(outcome?.change ?? 0) },
              { id: 'final', label: t.final, value: amount(outcome?.final ?? 0) }]),
          ]} chart={<PercentGridVisual
            label={graded && !grading.met ? `${t.grid}: ${percent} ${t.ofHundred}.` : `${t.grid}: ${percent} ${t.ofHundred}. ${changed}: ${amount(outcome?.change ?? 0)}. ${t.final}: ${amount(outcome?.final ?? 0)}.`}
            percent={percent} percentText={`${percent}%`} ofHundredText={`${percent} ${t.ofHundred}`} />}>
          {() => <Slider label={t.change} valueText={`${percent}%`}
            min={0} max={100} step={step} value={percent} onValueChange={setRate}
            stepLabels={{ decrease: t.less, increase: t.more }} />}
        </TeachingChartBoard>
        {graded ? <><NumberAnswer label={changed} locale={document.locale} onChange={setTyped} disabled={grading.pending || grading.met} />
          <GradedFoot locale={document.locale} grading={grading} canCheck={typed !== null} sequence={sequence} onCheck={() => grading.check({ percent, amount: typed })} /></> : null}
        {graded && !grading.met ? null : <footer className="lf-percent-foot"><div className="lf-percent-outcome" role="status" aria-live="polite">
          <span data-copy-role="body">{t.final}</span><strong data-copy-role="data">{amount(outcome?.final ?? 0)}</strong></div>
          {sequence && !graded ? <Button variant="accent" disabled={percent === initialPercent} onClick={sequence.onAdvance}>{t.continue}</Button> : null}</footer>}
      </div>
    </div>
  </main>;
}
