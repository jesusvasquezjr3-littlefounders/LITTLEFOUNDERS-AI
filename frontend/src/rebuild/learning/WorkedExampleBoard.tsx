import { useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, TextField } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import { type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { StepReplay } from './StepReplay';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import './learning.css';
import './stepReplay.css';
import { LessonStageSlot } from './lessonStage';
import { SegmentPrompt } from './segmentKit';

type Segment = Extract<LessonClientSegment, { type: 'math.worked-example.v2' }>;
type Verdict = 'invalid' | 'met' | 'review';

const copy: Record<Locale, {
  back: string; example: string; step: string; previous: string; next: string; play: string; pause: string;
  predict: string; predictHint: string; result: string; reveal: string; faded: string; input: string; complete: string; check: string; continue: string; correct: string; retry: string; unavailable: string;
}> = {
  'en-US': { back: 'Back', example: 'Worked example', step: 'Step', previous: 'Previous', next: 'Next', play: 'Play', pause: 'Pause',
    predict: 'Predict the next result', predictHint: 'Write a result before revealing the next step.', result: 'Result', reveal: 'Show next step',
    faded: 'Your turn', input: 'Write the result', complete: 'Review the steps whenever you need.', check: 'Check', continue: 'Continue', correct: 'Correct', retry: 'Try the values again.', unavailable: 'We could not check that. Try again.' },
  'es-MX': { back: 'Volver', example: 'Ejemplo resuelto', step: 'Paso', previous: 'Anterior', next: 'Siguiente', play: 'Reproducir', pause: 'Pausar',
    predict: 'Predice el siguiente resultado', predictHint: 'Escribe un resultado antes de mostrar el siguiente paso.', result: 'Resultado', reveal: 'Mostrar siguiente paso',
    faded: 'Tu turno', input: 'Escribe el resultado', complete: 'Revisa los pasos cuando lo necesites.', check: 'Comprobar', continue: 'Continuar', correct: 'Correcto', retry: 'Revisa los valores e intenta otra vez.', unavailable: 'No pudimos comprobarlo. Intenta otra vez.' },
  'pt-BR': { back: 'Voltar', example: 'Exemplo resolvido', step: 'Etapa', previous: 'Anterior', next: 'Próxima', play: 'Reproduzir', pause: 'Pausar',
    predict: 'Preveja o próximo resultado', predictHint: 'Escreva um resultado antes de mostrar a próxima etapa.', result: 'Resultado', reveal: 'Mostrar próxima etapa',
    faded: 'Sua vez', input: 'Escreva o resultado', complete: 'Revise as etapas quando precisar.', check: 'Conferir', continue: 'Continuar', correct: 'Correto', retry: 'Revise os valores e tente novamente.', unavailable: 'Não foi possível conferir. Tente de novo.' },
};

/**
 * A controlled M9/M10 presentation candidate. The authored values are visible
 * teaching material. Learner responses are separately recorded and Core alone
 * validates them against a private, version-pinned rubric.
 */
export function WorkedExampleBoard({ document, segment, onBack, onGrade, sequence }: {
  document: LessonClientDocument; segment: Segment; onBack: () => void;
  onGrade: (answer: { values: Record<string, string> }, segmentId: string) => Verdict | Promise<Verdict>;
  sequence?: LessonSequenceControl;
}) {
  const t = copy[document.locale];
  const steps = segment.payload.steps;
  const fadeAt = steps.length - segment.payload.fade_count;
  const [index, setIndex] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null);
  const { pending, grade } = useSingleActiveGrade();

  const revealNext = () => {
    const next = steps[index + 1];
    if (!next) return;
    const value = index + 1 >= fadeAt ? values[next.id] ?? '' : prediction;
    if (!value.trim()) return;
    setValues((current) => ({ ...current, [next.id]: value }));
    setIndex(index + 1);
    setPrediction('');
  };
  const complete = segment.payload.response_step_ids.every((stepId) => values[stepId]?.trim());
  const submit = () => {
    if (verdict === 'met') { sequence?.onAdvance(); return; }
    if (!complete) return;
    grade(() => onGrade({ values }, segment.id), (result) => setVerdict(result === 'met' ? 'met' : 'review'), () => setVerdict('unavailable'));
  };

  return <main className="lf-learning" data-surface="app" data-screen="worked-example">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{t.example}</span></header><LessonStageSlot verdict={verdict} />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
        <section className="lf-learning-board" aria-labelledby="worked-example-title">
          <h2 id="worked-example-title" data-copy-role="heading">{t.example}</h2>
          <ol className="lf-worked-example-steps">
            {steps.map((step, stepIndex) => {
              const active = index === stepIndex;
              const complete = index > stepIndex;
              const faded = stepIndex >= fadeAt;
              const className = 'lf-worked-example-step' + (active ? ' lf-worked-example-step--active' : '') + (complete ? ' lf-worked-example-step--complete' : '');
              return <li key={step.id} className={className}>
                <span className="lf-worked-example-number" data-copy-role="data">{stepIndex + 1}</span>
                <span className="lf-worked-example-expression" data-copy-role="data">{step.expression}</span>
                {faded && stepIndex <= index + 1 ? <div className="lf-worked-example-blank">
                  <TextField label={t.faded} aria-label={t.input + ': ' + step.expression} inputMode="decimal" autoComplete="off" disabled={pending} value={values[step.id] ?? ''}
                    onChange={(event) => { setVerdict(null); setValues((current) => ({ ...current, [step.id]: event.target.value })); }} />
                </div> : index >= stepIndex ? <span className="lf-worked-example-result" data-copy-role="data">{t.result}: {step.result}</span>
                  : <span className="lf-worked-example-pending" data-copy-role="body">…</span>}
              </li>;
            })}
          </ol>
        </section>
        <div className="lf-learning-control-strip">
          <StepReplay steps={steps.length - 1} index={Math.min(index, steps.length - 1)} onChange={setIndex}
            labels={{ previous: t.previous, next: t.next, play: t.play, pause: t.pause, step: t.step }} />
          {index < steps.length - 1 && index + 1 < fadeAt ? <div className="lf-worked-example-prediction">
            <TextField label={t.predict} autoComplete="off" value={prediction} onChange={(event) => setPrediction(event.target.value)}
              placeholder={t.predictHint} />
            <Button variant="accent" disabled={!prediction.trim()} onClick={revealNext}>{t.reveal}</Button>
          </div> : index < steps.length - 1 ? <div className="lf-worked-example-prediction">
            <Button variant="accent" disabled={!values[steps[index + 1]?.id ?? '']?.trim()} onClick={revealNext}>{t.reveal}</Button>
          </div> : <div className="lf-worked-example-complete"><p data-copy-role="body">{t.complete}</p>
            <LessonFeedback verdict={verdict}>{verdict === 'met' ? t.correct : verdict === 'review' ? t.retry : verdict === 'unavailable' ? t.unavailable : null}</LessonFeedback>
            <Button variant="accent" disabled={pending || !complete} onClick={submit}>{verdict === 'met' && sequence ? t.continue : t.check}</Button>
          </div>}
        </div>
      </div>
    </div>
  </main>;
}

/** A local fixture that lets visual review inspect full and faded states without Forge. */
export function workedExamplePilotDocument(locale: Locale, fadeCount = 0): unknown {
  const title = { 'en-US': 'Find a sale price', 'es-MX': 'Encuentra un precio con descuento', 'pt-BR': 'Encontre um preço com desconto' }[locale];
  const prompt = { 'en-US': 'Follow the discount, then predict the next result.', 'es-MX': 'Sigue el descuento y predice el siguiente resultado.', 'pt-BR': 'Acompanhe o desconto e preveja o próximo resultado.' }[locale];
  const spoken = { 'en-US': ['Twenty percent of 50 is 10', 'Fifty minus 10 is 40', 'The sale price is 40'],
    'es-MX': ['Veinte por ciento de 50 es 10', 'Cincuenta menos 10 es 40', 'El precio con descuento es 40'],
    'pt-BR': ['Vinte por cento de 50 é 10', 'Cinquenta menos 10 é 40', 'O preço com desconto é 40'] }[locale];
  const salePrice = { 'en-US': 'Sale price', 'es-MX': 'Precio final', 'pt-BR': 'Preço final' }[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'discounts',
    lesson_id: 'pilot-worked-example', version_id: 'rev-fade-' + fadeCount, locale, age_band: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-percent-discount'],
    adventure_scene_id: 'diorama-a', title,
    required_capabilities: ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1'],
    segments: [{ id: 'worked-example-01', type: 'math.worked-example.v2', grading: 'server', prompt,
      visual: { type: 'worked-example' }, payload: {
        steps: [
          { id: 'discount-part', expression: '20% × 50', result: '10', spokenText: spoken[0] },
          { id: 'discount-subtract', expression: '50 − 10', result: '40', spokenText: spoken[1] },
          { id: 'sale-price', expression: salePrice, result: '40', spokenText: spoken[2] },
        ], fade_count: fadeCount, response_step_ids: ['discount-subtract', 'sale-price'],
      } }],
  };
}
