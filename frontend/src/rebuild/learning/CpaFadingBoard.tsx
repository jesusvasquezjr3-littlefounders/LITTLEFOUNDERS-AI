import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, IconButton, TextField } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import './learning.css';
import { LessonStageSlot } from './lessonStage';
import { SegmentPrompt } from './segmentKit';
import { AdditionDotsVisual } from './pizarron';

type Segment = Extract<LessonClientSegment, { type: 'math.cpa-count.v2' }>;
type Verdict = 'invalid' | 'met' | 'review';
type Sequence = { index: number; total: number; onAdvance: () => void };
type Copy = {
  reset: string; back: string; concrete: string; pictorial: string; abstract: string; stage: string; count: string; equation: string;
  answer: string; check: string; correct: string; retry: string; unavailable: string; plus: string; equals: string;
  worked: (left: number, right: number) => string[];
};

const copy: Record<Locale, Copy> = {
  'en-US': { reset: 'Reset', back: 'Back', concrete: 'Build it', pictorial: 'See it', abstract: 'Write it', stage: 'Step', count: 'Count the two groups', equation: 'Complete the equation', answer: 'Your answer', check: 'Check', correct: 'You found it.', retry: 'Try counting again.', unavailable: 'We could not check that. Try again.', plus: 'plus', equals: 'equals', worked: (left, right) => [`Start with ${left} coins.`, `Count ${right} more.`, 'Name the total.'] },
  'es-MX': { reset: 'Restablecer', back: 'Volver', concrete: 'Constrúyelo', pictorial: 'Míralo', abstract: 'Escríbelo', stage: 'Paso', count: 'Cuenta los dos grupos', equation: 'Completa la operación', answer: 'Tu respuesta', check: 'Comprobar', correct: 'Lo encontraste.', retry: 'Cuenta otra vez.', unavailable: 'No pudimos comprobarlo. Intenta otra vez.', plus: 'más', equals: 'es igual a', worked: (left, right) => [`Empieza con ${left} monedas.`, `Cuenta ${right} más.`, 'Di el total.'] },
  'pt-BR': { reset: 'Recomeçar', back: 'Voltar', concrete: 'Monte', pictorial: 'Veja', abstract: 'Escreva', stage: 'Etapa', count: 'Conte os dois grupos', equation: 'Complete a conta', answer: 'Sua resposta', check: 'Conferir', correct: 'Você encontrou.', retry: 'Conte de novo.', unavailable: 'Não foi possível conferir. Tente de novo.', plus: 'mais', equals: 'é igual a', worked: (left, right) => [`Comece com ${left} moedas.`, `Conte mais ${right}.`, 'Diga o total.'] },
};

/** A single M1 stage. The answer is server-graded; the client only chooses its representation. */
export function CpaFadingBoard({ document, segment, onBack, onGrade, sequence }: {
  document: LessonClientDocument; segment: Segment; onBack: () => void;
  onGrade: (answer: { value: string }, segmentId: string) => Verdict | Promise<Verdict>;
  sequence: Sequence;
}) {
  const t = copy[document.locale];
  const progression = document.representation_progressions?.find((item) => item.stages.some((stage) => stage.segment_id === segment.id));
  const stage = progression?.stages.find((item) => item.segment_id === segment.id);
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { requestId.current++; timers.current.forEach((timer) => window.clearTimeout(timer)); }, []);
  if (!progression || !stage) return null;
  const label = t[stage.stage];
  const steps = stage.worked_steps_shown;
  const valid = /^(0|[1-9]\d*)$/.test(value) && Number(value) <= segment.payload.left + segment.payload.right;
  const submit = () => {
    if (!valid || pending) return;
    const currentRequest = ++requestId.current;
    setPending(true);
    Promise.resolve().then(() => onGrade({ value }, segment.id)).then((result) => {
      if (requestId.current !== currentRequest) return;
      setVerdict(result === 'met' ? 'met' : 'review');
      // A review is a completed attempt, so the learner can continue through the
      // planned fade and Core can identify the first later stage that is met.
      // Earlier stages advance after either outcome because they are learning
      // experiences. The final symbolic stage advances only after a met
      // response, which is the M1 completion requirement.
      if (result === 'met' || result === 'review' && sequence.index < sequence.total - 1) {
        setAdvancing(true);
        // Keep the feedback legible before the current representation exits.
        timers.current.push(window.setTimeout(() => setLeaving(true), 400));
        timers.current.push(window.setTimeout(sequence.onAdvance, 650));
      }
    }).catch(() => {
      if (requestId.current === currentRequest) setVerdict('unavailable');
    }).finally(() => {
      if (requestId.current === currentRequest) setPending(false);
    });
  };

  return <main className="lf-learning lf-learning--cpa lf-learning--sticky-foot" data-surface="app" data-screen="cpa-fading"><div className="lf-learning-inner">
    <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{t.stage} {sequence.index + 1}/{sequence.total}</span></header><LessonStageSlot verdict={verdict} />
    <div className={`lf-learning-content lf-cpa-transition${leaving ? ' lf-cpa-transition--leaving' : ''}`}><div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
      <section className="lf-learning-board lf-cpa-board" aria-labelledby="cpa-stage-title" data-cpa-stage={stage.stage}>
        <div className="lf-learning-board-heading"><h2 id="cpa-stage-title" data-copy-role="heading">{label}</h2><span className="lf-cpa-stage" data-copy-role="label">{t.stage} {sequence.index + 1}</span></div>
        {stage.stage === 'concrete' || stage.stage === 'pictorial' ? <AdditionDotsVisual label={segment.payload.spokenText}
          left={segment.payload.left} right={segment.payload.right} stage={stage.stage} /> : null}
        {stage.stage === 'abstract' ? <div className="lf-cpa-equation" aria-label={segment.payload.spokenText}><strong data-copy-role="data">{segment.payload.left}</strong><span aria-hidden="true">+</span><strong data-copy-role="data">{segment.payload.right}</strong><span aria-hidden="true">=</span><strong aria-hidden="true">?</strong></div> : null}
        {steps > 0 ? <ol className="lf-cpa-steps" aria-label={t.count}>{t.worked(segment.payload.left, segment.payload.right).slice(0, steps).map((item, index) => <li key={index} data-copy-role="body">{item}</li>)}</ol> : null}
      </section>
      <div className="lf-learning-control-strip lf-cpa-answer">{/* Bible 05 §3: Reset restores the authored start (an empty answer) and clears the verdict; an icon with its name, so the 6-9 first view keeps its word budget (06 §3.1). */}<div className="lf-learning-control-bar"><IconButton glyph="refresh" label={t.reset} onClick={() => { setValue(''); setVerdict(null); }} disabled={pending || advancing || value === '' && verdict === null} /></div><TextField label={t.answer} inputMode="numeric" pattern="[0-9]*" autoComplete="off" disabled={pending} value={value} onChange={(event) => { setValue(event.target.value); setVerdict(null); }} /></div>
      <footer className="lf-learning-foot"><LessonFeedback verdict={verdict}>{verdict === 'met' ? t.correct : verdict === 'review' ? t.retry : verdict === 'unavailable' ? t.unavailable : null}</LessonFeedback><div className="lf-learning-actions"><Button variant="accent" disabled={!valid || pending || advancing} onClick={submit}>{t.check}</Button></div></footer>
    </div>
  </div></main>;
}

export function cpaFadingPilotDocument(locale: Locale, ageBand: '6-9' | '10-12' = '6-9'): unknown {
  const title = { 'en-US': 'Count your savings', 'es-MX': 'Cuenta tu ahorro', 'pt-BR': 'Conte sua poupança' }[locale];
  const prompt = { 'en-US': 'Join the coin groups.', 'es-MX': 'Junta los grupos de monedas.', 'pt-BR': 'Junte os grupos de moedas.' }[locale];
  const left = ageBand === '6-9' ? 4 : 12; const right = ageBand === '6-9' ? 3 : 8;
  const spokenText = ageBand === '6-9'
    ? { 'en-US': 'four plus three', 'es-MX': 'cuatro más tres', 'pt-BR': 'quatro mais três' }[locale]
    : { 'en-US': 'twelve plus eight', 'es-MX': 'doce más ocho', 'pt-BR': 'doze mais oito' }[locale];
  const stages = [{ id: 'cpa-concrete-01', stage: 'concrete', worked: 3 }, { id: 'cpa-pictorial-01', stage: 'pictorial', worked: 2 }, { id: 'cpa-abstract-01', stage: 'abstract', worked: 0 }] as const;
  return { schema_version: 2, course_id: 'financial-education', pathway_id: ageBand === '6-9' ? 'financial-young' : 'financial-preteen', chapter_id: 'saving-basics', lesson_id: 'pilot-cpa-fading', version_id: 'rev-001', locale, age_band: ageBand, eligibility: ageBand === '6-9' ? { minimum_age: 6, maximum_age: 9 } : { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-saving-count'], adventure_scene_id: 'diorama-a', title, required_capabilities: ['visual.cpa-count.v1', 'operation.count-objects.v1', 'operation.symbolic-answer.v1'], representation_progressions: [{ fading_group_id: 'cpa-savings-01', problem_id: 'saving-count-01', stages: stages.map((item) => ({ segment_id: item.id, stage: item.stage, worked_steps_shown: item.worked })) }], segments: stages.map((item) => ({ id: item.id, type: 'math.cpa-count.v2', grading: 'server', prompt, visual: { type: 'cpa-count' }, payload: { left, right, spokenText } })) };
}
