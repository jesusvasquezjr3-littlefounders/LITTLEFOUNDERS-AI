import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, Stepper, ProgressBar, SegmentedControl } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import { NumberAxisVisual } from './pizarron';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import './learning.css';
import './numberLine.css';
import { LessonStageSlot } from './lessonStage';
import { SegmentPrompt } from './segmentKit';

type NumberLineSegment = Extract<LessonClientSegment, { type: 'math.number-line.whole.v2' }>;
type Verdict = 'met' | 'review';
/** M2 answers: one point, counting on (the hops), or every labelled item placed (GAP-FIX-R5). */
export type NumberLineAnswer = { value: string; hops?: number[] } | { placements: Record<string, string> };
type Labels = { back: string; practice: string; progress: string; board: string; line: string; place: string;
  reset: string; hint: string; check: string; checking: string; again: string; continue: string; left: string; right: string; met: string; review: string; unavailable: string; marker: string;
  undoHop: string; hops: string; countOn: string; items: string; placeAll: string };
const copy: Record<Locale, Labels> = {
  'en-US': { back: 'Back', practice: 'Practice', progress: 'Lesson progress', board: 'Board', line: 'Number line', place: 'Place the point',
    reset: 'Reset', hint: 'Tap or drag', check: 'Check', checking: 'Checking…', again: 'Try again', continue: 'Continue', left: 'Move left', right: 'Move right',
    met: 'Your point is in the right place.', review: 'Try a different place.', unavailable: 'Could not check. Try again.', marker: 'Your point',
    undoHop: 'Undo hop', hops: 'Hops', countOn: 'Count on from', items: 'Place each one', placeAll: 'Move each one to its place.' },
  'es-MX': { back: 'Volver', practice: 'Práctica', progress: 'Progreso de lección', board: 'Pizarrón', line: 'Recta numérica', place: 'Coloca el punto',
    reset: 'Restablecer', hint: 'Toca o arrastra', check: 'Comprobar', checking: 'Comprobando…', again: 'Reintentar', continue: 'Continuar', left: 'Mover a la izquierda', right: 'Mover a la derecha',
    met: 'Tu punto está en el lugar correcto.', review: 'Prueba otro lugar.', unavailable: 'No se pudo comprobar. Reintenta.', marker: 'Tu punto',
    undoHop: 'Deshacer salto', hops: 'Saltos', countOn: 'Cuenta desde', items: 'Coloca cada uno', placeAll: 'Mueve cada uno a su lugar.' },
  'pt-BR': { back: 'Voltar', practice: 'Prática', progress: 'Progresso da lição', board: 'Quadro', line: 'Reta numérica', place: 'Coloque o ponto',
    reset: 'Recomeçar', hint: 'Toque ou arraste', check: 'Conferir', checking: 'Conferindo…', again: 'Tentar de novo', continue: 'Continuar', left: 'Mover à esquerda', right: 'Mover à direita',
    met: 'Seu ponto está no lugar certo.', review: 'Tente outro lugar.', unavailable: 'Não foi possível conferir. Tente de novo.', marker: 'Seu ponto',
    undoHop: 'Desfazer salto', hops: 'Saltos', countOn: 'Conte a partir de', items: 'Coloque cada um', placeAll: 'Mova cada um para o seu lugar.' },
};

/**
 * The M2 pilot. Appendix P scopes the whole-number line to ages 6-9 (V2_AGE_SCOPE), so there is no 10-12 pilot:
 * a 10-12 document of this kind is refused as invalid, exactly as Core refuses it.
 */
export function numberLinePilotDocument(locale: Locale, ageBand: '6-9' = '6-9'): unknown {
  const title = { 'en-US': 'Find your place', 'es-MX': 'Encuentra tu lugar', 'pt-BR': 'Encontre seu lugar' };
  const prompt = { 'en-US': 'Place 7 on the line.', 'es-MX': 'Coloca el 7 en la recta.', 'pt-BR': 'Coloque o 7 na reta.' };
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `financial-${ageBand}`, chapter_id: 'counting-on',
    lesson_id: `pilot-number-line-${ageBand}`, version_id: 'rev-1', locale, age_band: ageBand, eligibility: ageEligibilityForBand(ageBand),
    knowledge_component_ids: ['kc-number-magnitude'], adventure_scene_id: 'diorama-a', title: title[locale],
    required_capabilities: ['visual.number-line.v1', 'operation.place-point.v1'],
    segments: [{ id: 'place-01', type: 'math.number-line.whole.v2', prompt: prompt[locale], grading: 'server',
      visual: { type: 'number-line' }, payload: { minimum: 0, maximum: 10, step: 1, initial: 0 } }],
  };
}

/** Pure interaction view; the scoring rubric lives behind onGrade. */
export function NumberLineBoard({ document, segment, onBack, onGrade, sequence }: {
  document: LessonClientDocument; segment: NumberLineSegment; onBack: () => void;
  onGrade: (answer: NumberLineAnswer, segmentId: string) => Verdict | 'invalid' | Promise<Verdict | 'invalid'>; sequence?: LessonSequenceControl;
}) {
  const t = copy[document.locale];
  const { minimum, maximum, step, initial } = segment.payload;
  // M2 / $2 (GAP-FIX-R2): with hop sizes, the learner counts ON from the current square; the point is where the hops land.
  const hopSizes = segment.payload.hops;
  // M2 (GAP-FIX-R5): with items, each labelled item is placed in turn; Core grades their order, then each one's distance.
  const items = segment.payload.items;
  const [hops, setHops] = useState<number[]>([]);
  const [placed, setValue] = useState(initial);
  const [active, setActive] = useState<string | null>(items?.[0]?.id ?? null);
  const [positions, setPositions] = useState<Record<string, number>>(() => Object.fromEntries((items ?? []).map((item) => [item.id, initial])));
  const [moved, setMoved] = useState<ReadonlySet<string>>(new Set());
  const activeItem = items?.find((item) => item.id === active) ?? null;
  const value = hopSizes ? hops.reduce((sum, hop) => sum + hop, initial) : activeItem ? positions[activeItem.id]! : placed;
  const [verdict, setVerdict] = useState<Verdict | 'unavailable' | null>(null);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
  const id = useId();
  useEffect(() => () => { requestId.current++; }, []);
  const setPoint = (next: number) => {
    if (!Number.isSafeInteger(next) || next < minimum || next > maximum || (next - minimum) % step !== 0) return;
    requestId.current++; setPending(false); setVerdict(null);
    if (activeItem) {
      setPositions((current) => ({ ...current, [activeItem.id]: next }));
      setMoved((current) => new Set([...current, activeItem.id]));
    } else setValue(next);
  };
  const reset = () => {
    requestId.current++; setPending(false); setVerdict(null); setHops([]); setValue(initial);
    setPositions(Object.fromEntries((items ?? []).map((item) => [item.id, initial]))); setMoved(new Set()); setActive(items?.[0]?.id ?? null);
  };
  const changed = hopSizes ? hops.length > 0 : items ? moved.size > 0 : placed !== initial;
  const hop = (size: number | null) => { requestId.current++; setPending(false); setVerdict(null); setHops((current) => size === null ? current.slice(0, -1) : [...current, size]); };
  const answer = (): NumberLineAnswer => hopSizes ? { value: String(value), hops }
    : items ? { placements: Object.fromEntries(items.map((item) => [item.id, String(positions[item.id])])) } : { value: String(value) };
  const check = () => {
    if (verdict === 'met') { if (sequence) sequence.onAdvance(); else reset(); return; }
    const currentRequest = ++requestId.current;
    setPending(true);
    try {
      Promise.resolve(onGrade(answer(), segment.id)).then((result) => {
        if (requestId.current === currentRequest) setVerdict(result === 'met' || result === 'review' ? result : 'unavailable');
      }).catch(() => { if (requestId.current === currentRequest) setVerdict('unavailable'); })
        .finally(() => { if (requestId.current === currentRequest) setPending(false); });
    } catch { if (requestId.current === currentRequest) { setPending(false); setVerdict('unavailable'); } }
  };
  const at = (point: number) => `${8 + (point - minimum) / (maximum - minimum) * 84}%`;
  const ready = hopSizes ? hops.length > 0 : items ? moved.size === items.length : true;
  const readout = items ? items.map((item) => `${item.label}: ${positions[item.id]}`).join(', ') : `${t.marker}: ${value}`;

  return <main className="lf-learning" data-surface="app" data-screen="numberline">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={sequenceProgress(sequence, verdict === 'met')} max={100} valueText={`${sequenceProgress(sequence, verdict === 'met')}%`} /><span data-copy-role="data">{sequence ? `${sequence.index + 1}/${sequence.total}` : t.practice}</span></header><LessonStageSlot verdict={verdict} />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
        <div className="lf-learning-workspace">
          <section className="lf-learning-board" aria-labelledby={`${id}-title`}>
            <h2 id={`${id}-title`} data-copy-role="heading">{t.board}</h2>
            <div className="lf-number-line-drawing">
              <NumberAxisVisual label={`${t.line}: ${minimum}–${maximum}`} />
              {hopSizes ? null : <input className="lf-number-line-slider" type="range" min={minimum} max={maximum} step={step} value={value}
                aria-label={activeItem ? `${t.place}: ${activeItem.label}` : t.place} aria-valuetext={activeItem ? `${activeItem.label}: ${value}` : String(value)}
                onChange={(event) => setPoint(Number(event.target.value))} />}
              {items ? items.map((item) => <span key={item.id} className="lf-number-line-marker lf-number-line-marker--item" style={{ left: at(positions[item.id]!) }}
                data-active={item.id === active ? 'true' : 'false'} data-moved={moved.has(item.id) ? 'true' : 'false'} aria-hidden="true">
                <span className="lf-number-line-marker-label" data-copy-role="option">{item.label}</span></span>)
                : <span className="lf-number-line-marker" style={{ left: at(value) }} aria-hidden="true" />}
              <div className="lf-number-line-labels" aria-hidden="true"><span data-copy-role="data">{minimum}</span><span data-copy-role="data">{(minimum + maximum) / 2}</span><span data-copy-role="data">{maximum}</span></div>
            </div>
          </section>
          <div className="lf-learning-control-strip">
            <div className="lf-learning-control-bar"><Button onClick={reset} disabled={!changed}>{t.reset}</Button>
              <span className="lf-number-line-hint" data-copy-role="body">{hopSizes ? `${t.countOn} ${initial}` : items ? t.placeAll : t.hint}</span></div>
            {items ? <SegmentedControl legend={t.items} name={`${segment.id}-item`} value={active} disabled={pending}
              options={items.map((item) => ({ value: item.id, label: item.label }))} onValueChange={setActive} /> : null}
            {hopSizes ? <div className="lf-number-line-hops" role="group" aria-label={t.hops}>
              {hopSizes.map((size) => <Button key={size} disabled={pending || value + size > maximum} onClick={() => hop(size)}>{`+${size}`}</Button>)}
              <Button disabled={pending || hops.length === 0} onClick={() => hop(null)}>{t.undoHop}</Button>
              <p className="lf-number-line-hop-trail" aria-live="polite" data-copy-role="data">{[initial, ...hops.map((_, index) => initial + hops.slice(0, index + 1).reduce((sum, item) => sum + item, 0))].join(' → ')}</p>
            </div> : <Stepper className="lf-number-line-stepper" label={activeItem ? `${t.place}: ${activeItem.label}` : t.place} labelHidden showValue={false} value={value} min={minimum} max={maximum} step={step}
              onValueChange={setPoint} labels={{ decrease: t.left, increase: t.right }} />}
          </div>
        </div>
        <footer className="lf-learning-foot">
          {/* GAP-FIX-R6 (B.20): the author's feedback, else the board's line naming where the point landed. */}
          <LessonFeedback verdict={verdict}>{verdict === 'met' && segment.feedback?.met ? segment.feedback.met : verdict === 'review' && segment.feedback?.not_yet ? segment.feedback.not_yet : verdict ? `${t[verdict]} ${readout}.` : null}</LessonFeedback>
          <div className="lf-learning-actions"><Button variant="accent" disabled={pending || !ready} onClick={check}>{pending ? t.checking : verdict === 'met' ? sequence ? t.continue : t.again : t.check}</Button></div>
        </footer>
      </div>
    </div>
  </main>;
}
