import { useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { MathExpression } from '../../pizarron/MathExpression';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { Prose } from '../Prose';
import { BALANCE_COPY } from './copy';
import { BALANCE_MAX_ANSWER, applyOp, canApply, equationTex, isRouteOp, isSolved, levelScale, replay, tiltDegrees, type BalanceOp, type Pan, type RouteOp, type Scale, type SlipOp } from './model.generated';
import { NumberField, readNumber } from './numberField';
import '../horizonte.css';
import './BalanceBoard.css';

type BalanceSegment = Extract<HorizonteSegment, { type: 'math.equation-balance.v2' }>;
type Copy = { readonly [K in keyof typeof BALANCE_COPY]: string };

/* The drawing: a 360 by 240 box, beam pivot at (180, 44), pans hang 150 below each beam end. */
const PIVOT_X = 180;
const PIVOT_Y = 44;
const ARM = 90;
const HANG = 150;
const X_SIZE = 22;
const X_PITCH = 25;
const X_PER_ROW = 4;
const U_PITCH = 14;
const U_PER_ROW = 7;

/** Where each x-block and unit counter of a pan sits, in the pan's own space (origin at the beam end, plate top at y = HANG). */
function panItems(pan: Pan) {
  const blocks = Array.from({ length: pan.x }, (_, index) => ({
    x: -((X_PER_ROW * X_PITCH - (X_PITCH - X_SIZE)) / 2) + (index % X_PER_ROW) * X_PITCH,
    y: HANG - X_SIZE - Math.floor(index / X_PER_ROW) * X_PITCH,
  }));
  const blockTop = HANG - Math.ceil(pan.x / X_PER_ROW) * X_PITCH;
  const units = Array.from({ length: pan.u }, (_, index) => ({
    cx: -((U_PER_ROW * U_PITCH) / 2) + U_PITCH / 2 + (index % U_PER_ROW) * U_PITCH,
    cy: blockTop - U_PITCH / 2 - Math.floor(index / U_PER_ROW) * U_PITCH,
  }));
  return { blocks, units };
}

function PanDrawing({ pan, side, offset }: { pan: Pan; side: 'left' | 'right'; offset: number }) {
  const { blocks, units } = panItems(pan);
  const x = side === 'left' ? PIVOT_X - ARM : PIVOT_X + ARM;
  return <g className="lf-balance-pan" style={{ transform: `translate(${x}px, ${PIVOT_Y + offset}px)` }} data-pan={side}>
    <line className="lf-balance-string" x1="0" y1="0" x2="-52" y2={HANG} />
    <line className="lf-balance-string" x1="0" y1="0" x2="52" y2={HANG} />
    <rect className="lf-balance-plate" x="-56" y={HANG} width="112" height="6" rx="3" />
    {blocks.map((block, index) => <g key={`x${index}`} className="lf-balance-block">
      <rect x={block.x} y={block.y} width={X_SIZE} height={X_SIZE} rx="4" />
      <text x={block.x + X_SIZE / 2} y={block.y + X_SIZE / 2 + 5} textAnchor="middle">x</text>
    </g>)}
    {units.map((unit, index) => <circle key={`u${index}`} className="lf-balance-unit" cx={unit.cx} cy={unit.cy} r="6" />)}
  </g>;
}

function ScaleDrawing({ scale }: { scale: Scale }) {
  const tilt = tiltDegrees(scale);
  const offset = Math.round(ARM * Math.sin((tilt * Math.PI) / 180) * 100) / 100;
  return <svg className="lf-balance-svg" viewBox="0 0 360 240" aria-hidden="true" focusable="false" data-copy-role="data" data-tilt={tilt}>
    <line className="lf-balance-post" x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2="226" />
    <rect className="lf-balance-base" x="140" y="226" width="80" height="8" rx="4" />
    <g className="lf-balance-beam" style={{ transform: `rotate(${-tilt}deg)`, transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px` }}>
      <line x1={PIVOT_X - ARM} y1={PIVOT_Y} x2={PIVOT_X + ARM} y2={PIVOT_Y} />
    </g>
    <circle className="lf-balance-pivot" cx={PIVOT_X} cy={PIVOT_Y} r="6" />
    <PanDrawing pan={scale.l} side="left" offset={offset} />
    <PanDrawing pan={scale.r} side="right" offset={-offset} />
  </svg>;
}

/** One pan as words: "3 x plus 2", "x", "8". Spoken text for math lives in copy because the payload is the same in every locale. */
function spokenPan(pan: Pan, t: Copy): string {
  const parts: string[] = [];
  if (pan.x > 0) parts.push(pan.x === 1 ? t.wordX : `${pan.x} ${t.wordX}`);
  if (pan.u > 0 || pan.x === 0) parts.push(String(pan.u));
  return parts.join(` ${t.wordPlus} `);
}

function opLabel(op: BalanceOp, t: Copy): string {
  switch (op) {
    case 'sub-x': return t.opSubX;
    case 'sub-unit': return t.opSubUnit;
    case 'add-unit': return t.opAddUnit;
    case 'slip-left': return t.opSlipLeft;
    case 'slip-right': return t.opSlipRight;
    default: return fillSlot(t.opDiv, op.slice('div-'.length));
  }
}

const DOMAIN = { whole: true, min: 0, max: BALANCE_MAX_ANSWER } as const;

/*
 * F1.8: a scale holds `a x + b = c x + d`. The learner picks one operation at a time (drag its chip onto the scale, tap the
 * chip then the scale, or the Move to menu) and it is done on both pans, so the scale stays level. The two "one pan only"
 * moves tip it, which teaches why; Undo levels it again and a tipped scale cannot be checked. The answer is the ordered
 * operations plus x, typed once x stands alone. Core holds x and the key route.
 */
function Balance({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: BalanceSegment }) {
  const locale: Locale = document.locale;
  const t = copyText(BALANCE_COPY, locale);
  const { start, ops } = segment.payload;
  const [steps, setSteps] = useState<RouteOp[]>([]);
  const [slip, setSlip] = useState<SlipOp | null>(null);
  const [text, setText] = useState('');
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;

  const level = replay(start, steps) ?? levelScale(start);
  const scale = (slip === null ? null : applyOp(level, slip)) ?? level;
  const solved = isSolved(scale);
  const answer = readNumber(text, locale, DOMAIN);
  const changed = steps.length > 0 || slip !== null || text !== '';

  const apply = (op: BalanceOp) => {
    if (locked || !canApply(scale, op)) return;
    grading.reset();
    if (isRouteOp(op)) setSteps([...steps, op]);
    else setSlip(op as SlipOp);
  };
  const undo = () => { grading.reset(); if (slip !== null) setSlip(null); else setSteps(steps.slice(0, -1)); };
  const place = (item: string) => apply(item as BalanceOp);
  const drag = useDragPlace<string>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setSteps([]); setSlip(null); setText(''); };
  const carriedLabel = drag.carried === null ? null : { label: opLabel(drag.carried as BalanceOp, t) };

  const spoken = `${spokenPan(scale.l, t)} ${t.wordEquals} ${spokenPan(scale.r, t)}`;
  const tilt = tiltDegrees(scale);
  const state = tilt === 0 ? t.scaleLevel : tilt > 0 ? t.scaleLeftLow : t.scaleRightLow;
  const pans = [{ name: t.panLeft, pan: scale.l }, { name: t.panRight, pan: scale.r }];

  return <BoardShell screen="equation-balance" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<>
      <Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>
      <Button size="sm" disabled={locked || (steps.length === 0 && slip === null)} onClick={undo}>{t.undo}</Button>
    </>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={solved && answer !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metBalance, hint: t.hintBalance }} onCheck={() => { if (answer !== null) grading.check({ steps, answer }); }} />}>
    <section className="lf-learning-board lf-balance" aria-label={t.balanceCaption}>
      <div className="lf-balance-equation" data-balance-equation="">
        {tilt === 0
          ? <MathExpression tex={equationTex(scale)} spokenText={spoken} fallback={equationTex(scale)} locale={locale} block />
          : <p data-copy-role="body">{t.tipHint}</p>}
      </div>
      <div className="lf-balance-stage" {...drag.target('scale')}><ScaleDrawing scale={scale} /></div>
      <p className="lf-balance-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.panLeft}: {spokenPan(scale.l, t)}. {t.panRight}: {spokenPan(scale.r, t)}. <Prose>{state}</Prose> {fillSlot(t.moves, steps.length)}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.balanceCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colPan}</th><th scope="col" data-copy-role="data">{t.colX}</th><th scope="col" data-copy-role="data">{t.colUnits}</th></tr></thead>
        <tbody>{pans.map(({ name, pan }) => <tr key={name}><th scope="row" data-copy-role="data">{name}</th><td data-copy-role="data">{pan.x}</td><td data-copy-role="data">{pan.u}</td></tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.movesHeading}>
      <h2 data-copy-role="heading">{t.movesHeading}</h2>
      <div className="lf-balance-tray">
        {ops.map((op) => <span key={op} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip(op)} disabled={locked || !canApply(scale, op)}>{opLabel(op, t)}</ChoiceChip>
        </span>)}
      </div>
      <p className="lf-balance-hint" data-copy-role="body">{t.greyHint}</p>
      <MoveToChoice locale={locale} item={carriedLabel} options={[{ value: 'scale', label: t.onScale }]} disabled={locked}
        onChange={() => { if (drag.carried) { place(drag.carried); drag.clear(); } }} />
    </section>
    <section className="lf-learning-control-strip" aria-label={t.answerLabel}>
      <NumberField label={t.answerLabel} locale={locale} text={text} onText={(next) => { grading.reset(); setText(next); }} disabled={locked || !solved} domain={DOMAIN} />
      {solved ? null : <p className="lf-balance-hint" data-copy-role="body">{t.typeHint}</p>}
    </section>
  </BoardShell>;
}

export default function BalanceBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.equation-balance.v2' ? <Balance segment={segment} {...rest} /> : null;
}
