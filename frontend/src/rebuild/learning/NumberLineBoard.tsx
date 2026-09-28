import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, Stepper, ProgressBar } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import { NumberAxisVisual } from './pizarron';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import './learning.css';
import './numberLine.css';
import { LessonStageSlot } from './lessonStage';

type NumberLineSegment = Extract<LessonClientSegment, { type: 'math.number-line.whole.v2' }>;
type Verdict = 'met' | 'review';
type Labels = { back: string; practice: string; progress: string; board: string; line: string; place: string;
  reset: string; hint: string; check: string; checking: string; again: string; continue: string; left: string; right: string; met: string; review: string; unavailable: string; marker: string };
const copy: Record<Locale, Labels> = {
  'en-US': { back: 'Back', practice: 'Practice', progress: 'Lesson progress', board: 'Board', line: 'Number line', place: 'Place the point',
    reset: 'Reset', hint: 'Tap or drag', check: 'Check', checking: 'Checking…', again: 'Try again', continue: 'Continue', left: 'Move left', right: 'Move right',
    met: 'Your point is in the right place.', review: 'Try a different place.', unavailable: 'Could not check. Try again.', marker: 'Your point' },
  'es-MX': { back: 'Volver', practice: 'Práctica', progress: 'Progreso de lección', board: 'Pizarrón', line: 'Recta numérica', place: 'Coloca el punto',
    reset: 'Restablecer', hint: 'Toca o arrastra', check: 'Comprobar', checking: 'Comprobando…', again: 'Reintentar', continue: 'Continuar', left: 'Mover a la izquierda', right: 'Mover a la derecha',
    met: 'Tu punto está en el lugar correcto.', review: 'Prueba otro lugar.', unavailable: 'No se pudo comprobar. Reintenta.', marker: 'Tu punto' },
  'pt-BR': { back: 'Voltar', practice: 'Prática', progress: 'Progresso da lição', board: 'Quadro', line: 'Reta numérica', place: 'Coloque o ponto',
    reset: 'Recomeçar', hint: 'Toque ou arraste', check: 'Conferir', checking: 'Conferindo…', again: 'Tentar de novo', continue: 'Continuar', left: 'Mover à esquerda', right: 'Mover à direita',
    met: 'Seu ponto está no lugar certo.', review: 'Tente outro lugar.', unavailable: 'Não foi possível conferir. Tente de novo.', marker: 'Seu ponto' },
};

export function numberLinePilotDocument(locale: Locale, ageBand: '6-9' | '10-12'): unknown {
  const young = ageBand === '6-9';
  const title = young ? { 'en-US': 'Find your place', 'es-MX': 'Encuentra tu lugar', 'pt-BR': 'Encontre seu lugar' }
    : { 'en-US': 'Estimate a place', 'es-MX': 'Estima un lugar', 'pt-BR': 'Estime um lugar' };
  const prompt = young ? { 'en-US': 'Place 7 on the line.', 'es-MX': 'Coloca el 7 en la recta.', 'pt-BR': 'Coloque o 7 na reta.' }
    : { 'en-US': 'Place 37 on the line.', 'es-MX': 'Coloca el 37 en la recta.', 'pt-BR': 'Coloque o 37 na reta.' };
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `financial-${ageBand}`, chapter_id: 'counting-on',
    lesson_id: `pilot-number-line-${ageBand}`, version_id: 'rev-1', locale, age_band: ageBand, eligibility: ageEligibilityForBand(ageBand),
    knowledge_component_ids: ['kc-number-magnitude'], adventure_scene_id: 'diorama-a', title: title[locale],
    required_capabilities: ['visual.number-line.v1', 'operation.place-point.v1'],
    segments: [{ id: 'place-01', type: 'math.number-line.whole.v2', prompt: prompt[locale], grading: 'server',
      visual: { type: 'number-line' }, payload: { minimum: 0, maximum: young ? 10 : 100, step: 1, initial: 0 } }],
  };
}

/** Pure interaction view; the scoring rubric lives behind onGrade. */
export function NumberLineBoard({ document, segment, onBack, onGrade, sequence }: {
  document: LessonClientDocument; segment: NumberLineSegment; onBack: () => void;
  onGrade: (answer: { value: string }, segmentId: string) => Verdict | 'invalid' | Promise<Verdict | 'invalid'>; sequence?: LessonSequenceControl;
}) {
  const t = copy[document.locale];
  const { minimum, maximum, step, initial } = segment.payload;
  const [value, setValue] = useState(initial);
  const [verdict, setVerdict] = useState<Verdict | 'unavailable' | null>(null);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
  const id = useId();
  useEffect(() => () => { requestId.current++; }, []);
  const setPoint = (next: number) => {
    if (!Number.isSafeInteger(next) || next < minimum || next > maximum || (next - minimum) % step !== 0) return;
    requestId.current++; setPending(false); setVerdict(null); setValue(next);
  };
  const reset = () => setPoint(initial);
  const check = () => {
    if (verdict === 'met') { if (sequence) sequence.onAdvance(); else reset(); return; }
    const currentRequest = ++requestId.current;
    setPending(true);
    try {
      Promise.resolve(onGrade({ value: String(value) }, segment.id)).then((result) => {
        if (requestId.current === currentRequest) setVerdict(result === 'met' || result === 'review' ? result : 'unavailable');
      }).catch(() => { if (requestId.current === currentRequest) setVerdict('unavailable'); })
        .finally(() => { if (requestId.current === currentRequest) setPending(false); });
    } catch { if (requestId.current === currentRequest) { setPending(false); setVerdict('unavailable'); } }
  };
  const percent = (value - minimum) / (maximum - minimum);

  return <main className="lf-learning" data-surface="app" data-screen="numberline">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={sequenceProgress(sequence, verdict === 'met')} max={100} valueText={`${sequenceProgress(sequence, verdict === 'met')}%`} /><span data-copy-role="data">{sequence ? `${sequence.index + 1}/${sequence.total}` : t.practice}</span></header><LessonStageSlot verdict={verdict} />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><p data-copy-role="prompt">{segment.prompt}</p></div>
        <div className="lf-learning-workspace">
          <section className="lf-learning-board" aria-labelledby={`${id}-title`}>
            <h2 id={`${id}-title`} data-copy-role="heading">{t.board}</h2>
            <div className="lf-number-line-drawing">
              <NumberAxisVisual label={`${t.line}: ${minimum}–${maximum}`} />
              <input className="lf-number-line-slider" type="range" min={minimum} max={maximum} step={step} value={value}
                aria-label={t.place} aria-valuetext={String(value)} onChange={(event) => setPoint(Number(event.target.value))} />
              <span className="lf-number-line-marker" style={{ left: `${8 + percent * 84}%` }} aria-hidden="true" />
              <div className="lf-number-line-labels" aria-hidden="true"><span data-copy-role="data">{minimum}</span><span data-copy-role="data">{(minimum + maximum) / 2}</span><span data-copy-role="data">{maximum}</span></div>
            </div>
          </section>
          <div className="lf-learning-control-strip">
            <div className="lf-learning-control-bar"><Button onClick={reset} disabled={value === initial}>{t.reset}</Button>
              <span className="lf-number-line-hint" data-copy-role="body">{t.hint}</span></div>
            <Stepper className="lf-number-line-stepper" label={t.place} labelHidden showValue={false} value={value} min={minimum} max={maximum} step={step}
              onValueChange={setPoint} labels={{ decrease: t.left, increase: t.right }} />
          </div>
        </div>
        <footer className="lf-learning-foot">
          <LessonFeedback verdict={verdict}>{verdict ? `${t[verdict]} ${t.marker}: ${value}.` : null}</LessonFeedback>
          <div className="lf-learning-actions"><Button variant="accent" disabled={pending} onClick={check}>{pending ? t.checking : verdict === 'met' ? sequence ? t.continue : t.again : t.check}</Button></div>
        </footer>
      </div>
    </div>
  </main>;
}
