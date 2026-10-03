import { useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { Prose } from '../Prose';
import { BALANCE_COPY } from './copy';
import { NumberField, fillNamed, readNumber } from './numberField';
import { proofFigure, proofGroups, type FactKey, type Pose, type ProofChoice, type ProofFigure, type ProofVisual, type Pt } from './proof.generated';
import '../horizonte.css';
import './ProofBoard.css';

type ProofSegment = Extract<HorizonteSegment, { type: 'math.visual-proof.v2' }>;
type Copy = { readonly [K in keyof typeof BALANCE_COPY]: string };

const VIEW_W = 360;
const VIEW_MAX_H = 300;

const FIGURE_NAME: Readonly<Record<ProofVisual, keyof Copy>> = {
  'parallelogram-area': 'figureParallelogram', 'triangle-area': 'figureTriangle', 'trapezoid-area': 'figureTrapezoid', 'circle-area': 'figureCircle',
  'circumference-unroll': 'figureCircumference', 'pythagoras-proof': 'figurePythagoras', 'odd-sum-proof': 'figureOdd',
};
const ANSWER_LABEL: Readonly<Record<ProofVisual, keyof Copy>> = {
  'parallelogram-area': 'answerArea', 'triangle-area': 'answerArea', 'trapezoid-area': 'answerArea', 'circle-area': 'answerArea',
  'circumference-unroll': 'answerAround', 'pythagoras-proof': 'answerSide', 'odd-sum-proof': 'answerSum',
};
const RESULT_TEXT: Readonly<Record<ProofVisual, keyof Copy>> = {
  'parallelogram-area': 'resultRectangle', 'triangle-area': 'resultTriangle', 'trapezoid-area': 'resultTrapezoid', 'circle-area': 'resultCircle',
  'circumference-unroll': 'resultCircumference', 'pythagoras-proof': 'resultSquares', 'odd-sum-proof': 'resultSquare',
};
/** The two answers that must be whole numbers; the areas can be decimals. */
const WHOLE_ANSWER: ReadonlySet<ProofVisual> = new Set(['pythagoras-proof', 'odd-sum-proof']);

const poseCss = (pose: Pose): string => `translate(${pose.dx}px, ${pose.dy}px) rotate(${pose.angle}deg)`;
const points = (polygon: readonly Pt[]): string => polygon.map(([x, y]) => `${x},${y}`).join(' ');

function factLabel(fact: FactKey, visual: ProofVisual, t: Copy): string {
  if (fact === 'count') return visual === 'circle-area' ? t['fact:slices'] : t['fact:odds'];
  return t[`fact:${fact}`];
}

function groupLabel(group: string, ordinal: number, t: Copy): string {
  if (group === 'wedge') return t.groupWedge;
  if (group === 'copy') return t.groupCopy;
  if (group === 'slices') return t.groupSlices;
  if (group === 'wheel') return t.groupWheel;
  if (group.startsWith('corner-')) return fillSlot(t.groupCorner, ordinal);
  return fillSlot(t.groupOdd, group.slice('odd-'.length));
}

/** The figure: pieces slide and turn between their two poses (motion only when the learner has not asked for less). */
function ProofDrawing({ figure, placed, label }: { figure: ProofFigure; placed: ReadonlySet<string>; label: string }) {
  const { minX, minY, maxX, maxY } = figure.extent;
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(VIEW_W / width, VIEW_MAX_H / height);
  const groups = proofGroups(figure);
  const moved = groups.filter((group) => placed.has(group)).length;
  const remainders = figure.remainders ? (moved === 0 ? figure.remainders.from : moved === groups.length ? figure.remainders.to : []) : [];
  const roll = moved === groups.length ? figure.measure : undefined;
  const tick = roll ? Math.min(0.4, roll.length / 40) : 0;
  return <svg className="lf-proof-svg" viewBox={`0 0 ${Math.round(width * scale)} ${Math.round(height * scale)}`} role="img" aria-label={label} focusable="false" data-copy-role="data">
    <g transform={`translate(${-minX * scale} ${maxY * scale}) scale(${scale} ${-scale})`}>
      {figure.fixed.map((shape) => <polygon key={shape.id} className={`lf-proof-shape lf-proof-shape--${shape.tone}`} points={points(shape.points)} />)}
      {remainders.map((shape) => <polygon key={shape.id} className={`lf-proof-shape lf-proof-shape--${shape.tone}`} points={points(shape.points)} />)}
      {figure.pieces.map((piece) => <polygon key={piece.id} className={`lf-proof-piece lf-proof-shape--${piece.tone}`} points={points(piece.base)}
        data-piece={piece.group} data-placed={placed.has(piece.group) ? 'true' : 'false'} style={{ transform: poseCss(placed.has(piece.group) ? piece.to : piece.from) }} />)}
      {roll ? <g className="lf-proof-measure">
        <line x1={roll.x0} y1={roll.y} x2={roll.x0 + roll.length} y2={roll.y} />
        {[0, ...roll.marks, roll.length].map((mark) => <line key={mark} x1={roll.x0 + mark} y1={roll.y - tick} x2={roll.x0 + mark} y2={roll.y + tick} />)}
      </g> : null}
    </g>
    {figure.labels.map((item) => <text key={`${item.text}-${item.at.join(',')}`} className="lf-proof-label" textAnchor="middle"
      x={(item.at[0] - minX) * scale + item.nudge[0]} y={(maxY - item.at[1]) * scale + item.nudge[1]}>{item.text}</text>)}
  </svg>;
}

/*
 * F1.15: a figure of rigid pieces. The learner predicts the formula first (the pieces stay locked until they do), then
 * moves every piece (drag its chip onto the figure, tap the chip then the figure, or the Move to menu) and types the
 * value. Pieces are only moved, never stretched, so the area is the same before and after. Core holds the key.
 */
function Proof({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: ProofSegment }) {
  const locale: Locale = document.locale;
  const t = copyText(BALANCE_COPY, locale);
  const visual = segment.visual.type as ProofVisual;
  const payload = segment.payload as Record<string, unknown>;
  const choices = payload.choices as readonly ProofChoice[];
  const sliceOptions = (payload.sectors as readonly number[] | undefined) ?? [];
  const [choice, setChoice] = useState<ProofChoice | null>(null);
  const [placed, setPlaced] = useState<readonly string[]>([]);
  const [sectors, setSectors] = useState<number | undefined>(sliceOptions[0]);
  const [text, setText] = useState('');
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;

  const figure = proofFigure(visual, payload, sectors);
  const groups = figure ? proofGroups(figure) : [];
  const placedSet = new Set(placed);
  const everyMoved = groups.length > 0 && groups.every((group) => placedSet.has(group));
  const predicted = choice !== null;
  const value = readNumber(text, locale, { whole: WHOLE_ANSWER.has(visual), min: 0, max: 1000 });
  const changed = predicted || placed.length > 0 || text !== '' || sectors !== sliceOptions[0];

  const touch = () => grading.reset();
  const place = (group: string, target: string) => {
    if (!predicted || locked) return;
    touch();
    setPlaced((current) => (target === 'fit' ? (current.includes(group) ? current : [...current, group]) : current.filter((item) => item !== group)));
  };
  const drag = useDragPlace<string>(place, locked || !predicted);
  const reset = () => { touch(); drag.clear(); setChoice(null); setPlaced([]); setSectors(sliceOptions[0]); setText(''); };
  const ordinalOf = (group: string) => groups.indexOf(group) + 1;
  const nameOf = (group: string) => groupLabel(group, ordinalOf(group), t);
  const carriedLabel = drag.carried === null ? null : { label: nameOf(drag.carried) };

  const facts = figure ? figure.facts.map(({ fact, value: amount }) => ({ label: factLabel(fact, visual, t), amount })) : [];
  const result = figure && everyMoved ? fillNamed(t[RESULT_TEXT[visual]], { a: figure.result.a, b: figure.result.b }) : '';
  const hint = !predicted ? t.predictHint : everyMoved ? '' : t.moveHint;

  return <BoardShell screen="visual-proof" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={predicted && everyMoved && value !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metProof, hint: t.hintProof }} onCheck={() => { if (choice !== null && value !== null) grading.check({ choice, value }); }} />}>
    <section className="lf-learning-board lf-proof" aria-label={t[FIGURE_NAME[visual]]}>
      <div className="lf-proof-stage" data-copy-role="data" {...drag.target('fit')}>
        {figure ? <ProofDrawing figure={figure} placed={placedSet} label={t[FIGURE_NAME[visual]]} /> : null}
      </div>
      <p className="lf-proof-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {facts.map((fact) => `${fact.label}: ${fact.amount}`).join(', ')}. {fillSlot(t.piecesMoved, `${placed.length} / ${groups.length}`)}. {result ? <Prose>{result}</Prose> : null}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.proofCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colMeasure}</th><th scope="col" data-copy-role="data">{t.colValue}</th></tr></thead>
        <tbody>{facts.map((fact) => <tr key={fact.label}><th scope="row" data-copy-role="data">{fact.label}</th><td data-copy-role="data">{fact.amount}</td></tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.predictHeading}>
      <h2 data-copy-role="heading">{t.predictHeading}</h2>
      <div className="lf-proof-choices">
        {choices.map((id) => <ChoiceChip key={id} selected={choice === id} disabled={locked} onToggle={() => { touch(); setChoice(id); }}>{t[`choice:${id}`]}</ChoiceChip>)}
      </div>
    </section>
    <section className="lf-learning-control-strip" aria-label={t.piecesHeading}>
      <h2 data-copy-role="heading">{t.piecesHeading}</h2>
      <div className="lf-proof-tray">
        {groups.map((group) => <span key={group} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip(group)} disabled={locked || !predicted}>{fillSlot(placedSet.has(group) ? t.placedIn : t.placedAt, nameOf(group))}</ChoiceChip>
        </span>)}
      </div>
      {sliceOptions.length > 0 ? <div className="lf-proof-slices" role="group" aria-label={t.slicesHeading}>
        {sliceOptions.map((count) => <ChoiceChip key={count} selected={sectors === count} disabled={locked || !predicted} onToggle={() => { touch(); setSectors(count); }}>{fillSlot(t.slices, count)}</ChoiceChip>)}
      </div> : null}
      {hint ? <p className="lf-proof-hint" data-copy-role="body">{hint}</p> : null}
      <MoveToChoice locale={locale} item={carriedLabel} options={[{ value: 'fit', label: t.moveFit }, { value: 'start', label: t.moveStart }]} disabled={locked || !predicted}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
    <section className="lf-learning-control-strip" aria-label={t[ANSWER_LABEL[visual]]}>
      <NumberField label={t[ANSWER_LABEL[visual]]} locale={locale} text={text} onText={(next) => { touch(); setText(next); }} disabled={locked || !predicted || !everyMoved}
        domain={{ whole: WHOLE_ANSWER.has(visual), min: 0, max: 1000 }} />
    </section>
  </BoardShell>;
}

export default function ProofBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.visual-proof.v2' ? <Proof segment={segment} {...rest} /> : null;
}
