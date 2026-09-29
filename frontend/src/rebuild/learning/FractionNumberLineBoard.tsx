import { useCallback, useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, SegmentedControl, Stepper } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { type LessonSequenceControl } from './lessonSequence';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import './learning.css';
import './numberLine.css';
import { LessonStageSlot } from './lessonStage';
import { NumberAnswer, SegmentPrompt, verdictBannerText } from './segmentKit';
import { namedFeedback } from './namedFeedback';
import { FractionCellsVisual, NumberAxisVisual } from './pizarron';
import { lineUnits } from './v2VisualScorer.generated';
import { formatLineNumber, fractionName } from './fractionName';

type Segment = Extract<LessonClientSegment, { type: 'math.number-line.fraction.v2' }>;
/** M3 answers (GAP-FIX-R5): one number (a fraction, or a typed decimal parsed for the locale), or two placed points and, for a comparison, the choice. */
export type FractionLineAnswer = { value: string } | { placements: { first: string; second: string }; choice?: 'first' | 'second' | 'same' };
type Copy = { back: string; explore: string; board: string; line: string; area: string; place: string; reset: string; left: string; right: string; estimate: string; representation: string; value: string; showTable: string; showVisual: string; check: string; continue: string; unavailable: string;
  typeIt: string; move: string; larger: string; same: string; onePoint: string };
const copy: Record<Locale, Copy> = {
  'en-US': { back: 'Back', explore: 'Explore', board: 'Fraction board', line: 'Number line', area: 'Equal parts', place: 'Place the fraction', reset: 'Reset', left: 'Move left', right: 'Move right', estimate: 'Choose a place', representation: 'Representation', value: 'Value', showTable: 'Show as table', showVisual: 'Show board', check: 'Check', continue: 'Continue', unavailable: 'We could not check that. Try again.',
    typeIt: 'Or type the number', move: 'Point to move', larger: 'Which is larger?', same: 'Same size', onePoint: 'Place both. Do they meet?' },
  'es-MX': { back: 'Volver', explore: 'Explorar', board: 'Pizarrón de fracciones', line: 'Recta numérica', area: 'Partes iguales', place: 'Coloca la fracción', reset: 'Restablecer', left: 'Mover a la izquierda', right: 'Mover a la derecha', estimate: 'Elige un lugar', representation: 'Representación', value: 'Valor', showTable: 'Ver tabla', showVisual: 'Ver pizarrón', check: 'Comprobar', continue: 'Continuar', unavailable: 'No pudimos comprobarlo. Intenta otra vez.',
    typeIt: 'O escribe el número', move: 'Punto que mueves', larger: '¿Cuál es mayor?', same: 'Mismo tamaño', onePoint: 'Coloca los dos. ¿Se juntan?' },
  'pt-BR': { back: 'Voltar', explore: 'Explorar', board: 'Quadro de frações', line: 'Reta numérica', area: 'Partes iguais', place: 'Coloque a fração', reset: 'Recomeçar', left: 'Mover à esquerda', right: 'Mover à direita', estimate: 'Escolha um lugar', representation: 'Representação', value: 'Valor', showTable: 'Ver tabela', showVisual: 'Ver quadro', check: 'Conferir', continue: 'Continuar', unavailable: 'Não foi possível conferir. Tente de novo.',
    typeIt: 'Ou digite o número', move: 'Ponto que você move', larger: 'Qual é maior?', same: 'Mesmo tamanho', onePoint: 'Coloque os dois. Eles se encontram?' },
};

export function fractionNumberLinePilotDocument(locale: Locale): unknown {
  const title = { 'en-US': 'Fractions have a place', 'es-MX': 'Las fracciones tienen lugar', 'pt-BR': 'Frações têm lugar' }[locale];
  const prompt = { 'en-US': 'Move the point. Three quarters and 0.75 name the same size.', 'es-MX': 'Mueve el punto. Tres cuartos y 0.75 nombran el mismo tamaño.', 'pt-BR': 'Mova o ponto. Três quartos e 0,75 dão nome ao mesmo tamanho.' }[locale];
  const spokenText = { 'en-US': 'three quarters, zero point seven five', 'es-MX': 'tres cuartos, cero punto setenta y cinco', 'pt-BR': 'três quartos, zero vírgula setenta e cinco' }[locale];
  return { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'fraction-magnitude', lesson_id: 'pilot-fraction-number-line', version_id: 'rev-1', locale, age_band: '10-12', eligibility: ageEligibilityForBand('10-12'), knowledge_component_ids: ['kc-fraction-magnitude'], adventure_scene_id: 'diorama-a', title, required_capabilities: ['visual.number-line.v1', 'visual.fraction-area.v1', 'operation.place-point.v1', 'operation.linked-representations.v1'], segments: [{ id: 'fraction-01', type: 'math.number-line.fraction.v2', grading: 'server', prompt, visual: { type: 'number-line' }, payload: { maximumWhole: 1, divisions: 4, initialUnits: 0, spokenText } }] };
}

type Point = 'first' | 'second';

export function FractionNumberLineBoard({ document, segment, onBack, onGrade, sequence }: { document: LessonClientDocument; segment: Segment; onBack: () => void; onGrade: (answer: FractionLineAnswer, segmentId: string) => 'met' | 'review' | 'invalid' | Promise<'met' | 'review' | 'invalid'>; sequence?: LessonSequenceControl }) {
  const t = copy[document.locale]; const p = segment.payload; const locale = document.locale;
  // M3 (GAP-FIX-R5): a comparison or an equivalents pair places two points; a single placement may also be typed as a decimal.
  const pair = p.compare_values ?? p.equivalent_values ?? null;
  const comparing = p.compare_values !== undefined;
  const [units, setUnits] = useState<Record<Point, number>>({ first: p.initialUnits, second: p.initialUnits });
  const [active, setActive] = useState<Point>('first');
  const [typed, setTyped] = useState<string | null>(null);
  const [choice, setChoice] = useState<'first' | 'second' | 'same' | null>(null);
  const [showTable, setShowTable] = useState(false); const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null); const id = useId(); const total = p.maximumWhole * p.divisions;
  const { pending, grade } = useSingleActiveGrade();
  const current = units[active];
  const fraction = (value: number) => `${value}/${p.divisions}`;
  const decimal = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value / p.divisions);
  const spoken = (value: number) => `${fractionName(value, p.divisions, locale)}, ${decimal(value)}`;
  const benchmarks = p.maximumWhole === 1 ? [0, .5, 1] : [0, .5, 1, 1.5, 2];
  const pointLabel = (point: Point) => pair ? formatLineNumber(pair[point === 'first' ? 0 : 1], locale) : t.place;
  const change = (next: number) => { setVerdict(null); setTyped(null); setUnits((currentUnits) => ({ ...currentUnits, [active]: next })); };
  // A typed decimal (parsed for the locale by NumberAnswer) moves the point when it lands on the snap grid; it is then what is sent.
  const onTyped = useCallback((canonical: string | null) => {
    setVerdict(null); setTyped(canonical);
    const landed = canonical === null ? null : lineUnits(canonical, p.maximumWhole, p.divisions);
    if (landed !== null) setUnits((currentUnits) => ({ ...currentUnits, first: landed }));
  }, [p.maximumWhole, p.divisions]);
  const typedOnLine = typed !== null && lineUnits(typed, p.maximumWhole, p.divisions) !== null;
  const answer = (): FractionLineAnswer => !pair ? { value: typedOnLine ? typed! : fraction(units.first) }
    : { placements: { first: fraction(units.first), second: fraction(units.second) }, ...(comparing && choice ? { choice } : {}) };
  const canCheck = !pair || !comparing || choice !== null;
  const submit = () => { if (verdict === 'met') { sequence?.onAdvance(); return; } grade(() => onGrade(answer(), segment.id), (result) => setVerdict(result === 'met' ? 'met' : 'review'), () => setVerdict('unavailable')); };
  const reset = () => { setVerdict(null); setTyped(null); setChoice(null); setActive('first'); setUnits({ first: p.initialUnits, second: p.initialUnits }); };
  const changed = units.first !== p.initialUnits || units.second !== p.initialUnits || choice !== null;
  const shown = pair ? (['first', 'second'] as const) : (['first'] as const);
  const table = <table className="lf-learning-table" aria-label={t.board}><thead><tr><th scope="col" data-copy-role="data">{t.representation}</th><th scope="col" data-copy-role="data">{t.value}</th></tr></thead><tbody>{shown.map((point) => <tr key={point}><th scope="row" data-label={t.representation} data-copy-role="data">{pair ? pointLabel(point) : t.line}</th><td data-label={t.value} data-copy-role="data">{fraction(units[point])} = {decimal(units[point])}</td></tr>)}</tbody></table>;
  const visual = <><FractionCellsVisual label={`${t.area}: ${fraction(current)}, ${decimal(current)}. ${p.spokenText}`} parts={total} shaded={current} /><div className="lf-number-line-drawing"><NumberAxisVisual label={`${t.line}: 0–${p.maximumWhole}; ${shown.map((point) => `${fraction(units[point])}, ${decimal(units[point])}`).join('; ')}`} ticks={benchmarks.map((value) => value / p.maximumWhole)} tall />
    <input className="lf-number-line-slider" type="range" min="0" max={total} step="1" value={current} disabled={pending} aria-label={pair ? `${t.place}: ${pointLabel(active)}` : t.place} aria-valuetext={spoken(current)} onChange={(event) => change(Number(event.target.value))} />
    {shown.map((point) => <span key={point} className={point === 'second' ? 'lf-number-line-marker lf-number-line-marker--second' : 'lf-number-line-marker'} style={{ left: `${8 + units[point] / total * 84}%` }} aria-hidden="true">
      {pair ? <span className="lf-number-line-marker-label" data-copy-role="data">{pointLabel(point)}</span> : null}</span>)}
    <div className="lf-number-line-labels" aria-hidden="true">{benchmarks.map((value) => <span key={value} data-copy-role="data">{value}</span>)}</div></div></>;
  return <main className="lf-learning" data-surface="app" data-screen="fraction-numberline"><div className="lf-learning-inner"><header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="body">{t.explore}</span></header><LessonStageSlot verdict={verdict} /><div className="lf-learning-content"><div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={locale} /></div><div className="lf-learning-workspace"><section className="lf-learning-board" aria-labelledby={`${id}-title`}><h2 id={`${id}-title`} data-copy-role="heading">{t.board}</h2>{showTable ? table : visual}</section>
    <div className="lf-learning-control-strip"><div className="lf-learning-control-bar"><Button onClick={reset} disabled={pending || !changed}>{t.reset}</Button><strong data-copy-role="data">{verdict ? shown.map((point) => `${fraction(units[point])} = ${decimal(units[point])}`).join('; ') : pair && !comparing ? t.onePoint : t.estimate}</strong><Button variant="sky" size="sm" className="lf-learning-view-toggle" onClick={() => setShowTable((currentTable) => !currentTable)}>{showTable ? t.showVisual : t.showTable}</Button></div>
      {pair ? <SegmentedControl legend={t.move} name={`${segment.id}-point`} value={active} disabled={pending} onValueChange={setActive}
        options={[{ value: 'first', label: pointLabel('first') }, { value: 'second', label: pointLabel('second') }]} /> : null}
      <Stepper className="lf-number-line-stepper" label={pair ? `${t.place}: ${pointLabel(active)}` : t.place} labelHidden showValue={false} value={current} min={0} max={total} disabled={pending} onValueChange={change} labels={{ decrease: t.left, increase: t.right }} />
      {!pair ? <NumberAnswer label={t.typeIt} locale={locale} onChange={onTyped} disabled={pending} /> : null}
      {comparing ? <SegmentedControl legend={t.larger} name={`${segment.id}-larger`} value={choice} disabled={pending} onValueChange={(value) => { setVerdict(null); setChoice(value); }}
        options={[{ value: 'first', label: pointLabel('first') }, { value: 'second', label: pointLabel('second') }, { value: 'same', label: t.same }]} /> : null}
    </div></div><footer className="lf-learning-foot"><LessonFeedback verdict={verdict}>{verdict === null ? null : verdictBannerText(document.locale, verdict, namedFeedback(document.locale, 'fraction-line', { value: pair ? new Intl.ListFormat(locale, { type: 'conjunction' }).format([pointLabel('first'), pointLabel('second')]) : fraction(units.first) }), segment.feedback)}</LessonFeedback><div className="lf-learning-actions"><Button variant="accent" disabled={pending || !canCheck} onClick={submit}>{verdict === 'met' && sequence ? t.continue : t.check}</Button></div></footer></div></div></main>;
}
