import { useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, TextField } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import { type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { StepReplay } from './StepReplay';
import { WorkedStepsList, MathExpression } from './pizarron';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import './learning.css';
import './stepReplay.css';
import { LessonStageSlot, useLessonStageRequest } from './lessonStage';
import { playerCopy, SegmentPrompt, verdictBannerText } from './segmentKit';
import { namedFeedback } from './namedFeedback';
import { LongArithmeticLayout } from './LongArithmeticLayout';
import { parseLocaleNumber } from './v2VisualScorer.generated';

type Segment = Extract<LessonClientSegment, { type: 'math.worked-example.v2' }>;
type Verdict = 'invalid' | 'met' | 'review';

const copy: Record<Locale, {
  reset: string; back: string; example: string; step: string; previous: string; next: string; play: string; pause: string;
  predict: string; predictHint: string; result: string; reveal: string; faded: string; input: string; complete: string; check: string; continue: string; unavailable: string;
}> = {
  'en-US': { reset: 'Reset', back: 'Back', example: 'Worked example', step: 'Step', previous: 'Previous', next: 'Next', play: 'Play', pause: 'Pause',
    predict: 'Predict the next result', predictHint: 'Write a result before revealing the next step.', result: 'Result', reveal: 'Show next step',
    faded: 'Your turn', input: 'Write the result', complete: 'Review the steps whenever you need.', check: 'Check', continue: 'Continue', unavailable: 'We could not check that. Try again.' },
  'es-MX': { reset: 'Restablecer', back: 'Volver', example: 'Ejemplo resuelto', step: 'Paso', previous: 'Anterior', next: 'Siguiente', play: 'Reproducir', pause: 'Pausar',
    predict: 'Predice el siguiente resultado', predictHint: 'Escribe un resultado antes de mostrar el siguiente paso.', result: 'Resultado', reveal: 'Mostrar siguiente paso',
    faded: 'Tu turno', input: 'Escribe el resultado', complete: 'Revisa los pasos cuando lo necesites.', check: 'Comprobar', continue: 'Continuar', unavailable: 'No pudimos comprobarlo. Intenta otra vez.' },
  'pt-BR': { reset: 'Recomeçar', back: 'Voltar', example: 'Exemplo resolvido', step: 'Etapa', previous: 'Anterior', next: 'Próxima', play: 'Reproduzir', pause: 'Pausar',
    predict: 'Preveja o próximo resultado', predictHint: 'Escreva um resultado antes de mostrar a próxima etapa.', result: 'Resultado', reveal: 'Mostrar próxima etapa',
    faded: 'Sua vez', input: 'Escreva o resultado', complete: 'Revise as etapas quando precisar.', check: 'Conferir', continue: 'Continuar', unavailable: 'Não foi possível conferir. Tente de novo.' },
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
  // GAP-FIX-R5 (08 §11): while a worked example is on screen the Mentor demonstrates beside the board.
  useLessonStageRequest('demonstrating');
  const steps = segment.payload.steps;
  const fadeAt = steps.length - segment.payload.fade_count;
  const [index, setIndex] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null);
  const { pending, grade } = useSingleActiveGrade();

  const revealNext = () => {
    if (pending) return;
    const next = steps[index + 1];
    if (!next) return;
    const value = index + 1 >= fadeAt ? values[next.id] ?? '' : prediction;
    if (!value.trim()) return;
    setVerdict(null);
    setValues((current) => ({ ...current, [next.id]: value }));
    setIndex(index + 1);
    setPrediction('');
  };
  // Bible 05 §3: Reset restores the authored start (the first step, no predictions or answers) and clears the verdict.
  const pristine = index === 0 && prediction === '' && Object.keys(values).length === 0 && verdict === null;
  const reset = () => { setIndex(0); setPrediction(''); setValues({}); setVerdict(null); };
  const complete = segment.payload.response_step_ids.every((stepId) => values[stepId]?.trim());
  // Appendix P Part 5 (GAP-FIX-R1): a typed number is parsed for the lesson's locale and sent as its canonical
  // value; Core compares values, not text. Anything that is not a number is sent as written.
  const canonical = (text: string) => parseLocaleNumber(text, document.locale) ?? text.trim();
  const echo = (text: string) => {
    const parsed = text.trim() ? parseLocaleNumber(text, document.locale) : null;
    return parsed === null ? null : playerCopy(document.locale).readsAs.replace('{value}', new Intl.NumberFormat(document.locale, { maximumFractionDigits: 12 }).format(Number(parsed)));
  };
  const submit = () => {
    if (verdict === 'met') { sequence?.onAdvance(); return; }
    if (!complete) return;
    const answer = Object.fromEntries(segment.payload.response_step_ids.map((stepId) => [stepId, canonical(values[stepId] ?? '')]));
    grade(() => onGrade({ values: answer }, segment.id), (result) => setVerdict(result === 'met' ? 'met' : 'review'), () => setVerdict('unavailable'));
  };

  return <main className="lf-learning" data-surface="app" data-screen="worked-example">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{t.example}</span></header><LessonStageSlot verdict={verdict} />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
        <section className="lf-learning-board" aria-labelledby="worked-example-title">
          <h2 id="worked-example-title" data-copy-role="heading">{t.example}</h2>
          {segment.payload.algorithm ? <LongArithmeticLayout algorithm={segment.payload.algorithm} locale={document.locale}
            revealed={Math.round((index + 1) / steps.length * segment.payload.algorithm.steps.length)} /> : null}
          <WorkedStepsList steps={steps.map((step, stepIndex) => {
            const faded = stepIndex >= fadeAt;
            // Bible 05 §5 (GAP-FIX-R2): a step that carries TeX notation renders it with KaTeX; spokenText is its accessible name.
            return { id: step.id, marker: String(stepIndex + 1), expression: step.notation
              ? <MathExpression tex={step.notation} spokenText={step.spokenText} fallback={step.expression} locale={document.locale} /> : step.expression,
              state: index === stepIndex ? 'active' as const : index > stepIndex ? 'complete' as const : 'pending' as const,
              detail: faded && stepIndex <= index + 1 ? <div className="lf-worked-example-blank">
                <TextField label={t.faded} aria-label={t.input + ': ' + step.expression} inputMode="decimal" autoComplete="off" disabled={pending} value={values[step.id] ?? ''}
                  onChange={(event) => { setVerdict(null); setValues((current) => ({ ...current, [step.id]: event.target.value })); }} />
                <p className="lf-number-echo" data-copy-role="body" aria-live="polite">{echo(values[step.id] ?? '') ?? '\u00a0'}</p>
              </div> : index >= stepIndex ? <span className="lf-worked-example-result" data-copy-role="data">{t.result}: {step.result}</span>
                : <span className="lf-worked-example-pending" data-copy-role="body">…</span> };
          })} />
        </section>
        <div className="lf-learning-control-strip">
          <div className="lf-learning-control-bar"><Button size="sm" onClick={reset} disabled={pending || pristine}>{t.reset}</Button></div>
          <StepReplay disabled={pending} steps={steps.length - 1} index={Math.min(index, steps.length - 1)} onChange={setIndex}
            labels={{ previous: t.previous, next: t.next, play: t.play, pause: t.pause, step: t.step }} />
          {index < steps.length - 1 && index + 1 < fadeAt ? <div className="lf-worked-example-prediction">
            <TextField disabled={pending} label={t.predict} autoComplete="off" value={prediction} onChange={(event) => setPrediction(event.target.value)}
              placeholder={t.predictHint} />
            <Button variant="accent" disabled={pending || !prediction.trim()} onClick={revealNext}>{t.reveal}</Button>
          </div> : index < steps.length - 1 ? <div className="lf-worked-example-prediction">
            <Button variant="accent" disabled={pending || !values[steps[index + 1]?.id ?? '']?.trim()} onClick={revealNext}>{t.reveal}</Button>
          </div> : <div className="lf-worked-example-complete"><p data-copy-role="body">{t.complete}</p>
            <LessonFeedback verdict={verdict}>{verdict === null ? null : verdictBannerText(document.locale, verdict, namedFeedback(document.locale, 'worked-example'), segment.feedback)}</LessonFeedback>
            <Button variant="accent" disabled={pending || !complete} onClick={submit}>{verdict === 'met' && sequence ? t.continue : t.check}</Button>
          </div>}
        </div>
      </div>
    </div>
  </main>;
}

/** A local fixture that lets visual review inspect full and faded states without Forge. */
/**
 * Bible 05 §5 (GAP-FIX-R2): a worked example that declares TeX notation (a
 * fraction and an exponent), the text-fit and board-audit state for KaTeX.
 * pt-BR reads its decimals with a comma ({,}); spokenText stays the name.
 */
export function notationPilotDocument(locale: Locale): unknown {
  const title = { 'en-US': 'Interest on interest', 'es-MX': 'Interés sobre interés', 'pt-BR': 'Juros sobre juros' }[locale];
  const prompt = { 'en-US': 'Follow two years at 10%, then predict each result.', 'es-MX': 'Sigue dos años al 10% y predice cada resultado.', 'pt-BR': 'Acompanhe dois anos a 10% e preveja cada resultado.' }[locale];
  const spoken = { 'en-US': ['Ten over one hundred is 0.1', 'One hundred times 1.1 squared is 121', 'One hundred twenty-one minus 100 is 21'],
    'es-MX': ['Diez entre cien es 0.1', 'Cien por 1.1 al cuadrado es 121', 'Ciento veintiuno menos 100 es 21'],
    'pt-BR': ['Dez sobre cem é 0,1', 'Cem vezes 1,1 ao quadrado é 121', 'Cento e vinte e um menos 100 é 21'] }[locale];
  const decimal = (text: string) => locale === 'pt-BR' ? text.replace(/(\d)\.(\d)/g, '$1,$2') : text;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-13-17', chapter_id: 'compound-interest',
    lesson_id: 'pilot-notation', version_id: 'rev-notation-1', locale, age_band: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 }, knowledge_component_ids: ['kc-compound-growth'], adventure_scene_id: 'diorama-a', title,
    required_capabilities: ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1', 'visual.math-notation.v1'],
    segments: [{ id: 'worked-notation-01', type: 'math.worked-example.v2', grading: 'server', prompt, visual: { type: 'worked-example' }, payload: {
      steps: [
        { id: 'rate-step', expression: decimal('10 / 100'), notation: '\\frac{10}{100}', result: decimal('0.1'), spokenText: spoken[0] },
        { id: 'grow-step', expression: decimal('100 × 1.1²'), notation: '100 \\times 1.1^{2}', result: '121', spokenText: spoken[1] },
        { id: 'interest-step', expression: '121 − 100', notation: '121 - 100', result: '21', spokenText: spoken[2] },
      ], fade_count: 0, response_step_ids: ['grow-step', 'interest-step'],
    } }],
  };
}

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
