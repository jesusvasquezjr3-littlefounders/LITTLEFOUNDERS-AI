import { useState, type CSSProperties } from 'react';
import { MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { isAreaDivisionPayload, isAreaModelPayload, isArrayPayload, type AreaDivisionPayload, type AreaModelPayload, type ArrayPayload } from './arrayAreaModel.generated';
import { DataTable, Handle, MAX_TYPED, NumBFrame, NumField, fill, typedNumber } from './boardKit';
import { NUM_B_COPY } from './copy';
import './ArrayAreaBoard.css';

type ArrayAreaSegment = Extract<HorizonteSegment, { type: 'math.array-area.v2' }>;
type Props<P> = Omit<HorizonteBoardProps, 'segment'> & { segment: ArrayAreaSegment; payload: P };

const BOX_WIDTH = 300;
const boxHeight = (down: number, across: number) => Math.min(160, Math.max(60, Math.round((BOX_WIDTH * down) / across)));

/* The friendly cuts of a side: every ten below it, and its middle. Any cut is sound; Core accepts them all. */
const cutPoints = (across: number): number[] => {
  const points = new Set<number>([Math.floor(across / 2)]);
  for (let at = 10; at < across; at += 10) points.add(at);
  return [...points].sort((a, b) => a - b);
};

/* F1.4 array: the learner counts equal rows (a scaffold that is never graded), then types the total. */
function ArrayBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<ArrayPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const { rows, columns } = payload;
  const [counted, setCounted] = useState<boolean[]>(() => Array.from({ length: rows }, () => false));
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const value = typedNumber(text, locale, MAX_TYPED, 1);
  const rowsCounted = counted.filter(Boolean).length;
  const rowName = (index: number) => fill(t.arrayRow, { n: index + 1 });
  const reset = () => { grading.reset(); setText(''); setCounted(counted.map(() => false)); };

  return <NumBFrame screen="array-area" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={value !== null} answer={{ value: value ?? '' }} named={{ met: t.metArray, hint: t.hintArray }} changed={text !== '' || rowsCounted > 0}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.arrayLabel}
    status={fill(t.arrayFacts, { rows, columns, counted: rowsCounted, dots: rowsCounted * columns })}
    board={<div className="lf-arr-rows" role="group" aria-label={t.arrayLabel}>
      {counted.map((on, index) => <button key={index} type="button" className="lf-arr-row" aria-pressed={on} disabled={locked}
        aria-label={`${rowName(index)}, ${fill(t.rowDots, { n: columns })}`}
        onClick={() => setCounted(counted.map((now, at) => (at === index ? !now : now)))}>
        <svg className="lf-arr-dots" style={{ '--cols': columns } as CSSProperties} viewBox={`0 0 ${columns * 24} 24`} aria-hidden="true" focusable="false">
          {Array.from({ length: columns }, (_, at) => <circle key={at} className={on ? 'lf-arr-dot lf-arr-dot--on' : 'lf-arr-dot'} cx={12 + at * 24} cy={12} r={8} />)}
        </svg>
      </button>)}
    </div>}
    tableNode={<DataTable caption={t.arrayCaption} head={[t.colRow, t.colDots, t.colCounted]}
      rows={counted.map((on, index) => [rowName(index), String(columns), on ? t.yes : t.no])}
      foot={[t.total, String(rowsCounted * columns), String(rowsCounted)]} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-answer`}>
      <h2 id={`${segment.id}-answer`} data-copy-role="heading">{t.answerHeading}</h2>
      <NumField label={t.totalDots} locale={locale} value={text} onText={(next) => { grading.reset(); setText(next); }} disabled={locked} min={1} />
    </section>
  </NumBFrame>;
}

/* F1.4 multiplication box: cut the long side, find two partial products, add them. The learner chooses the cut. */
function AreaModelBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<AreaModelPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const { across, down } = payload;
  const [split, setSplit] = useState(0);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [whole, setWhole] = useState('');
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const cut = (at: number) => { grading.reset(); setSplit(at); setFirst(''); setSecond(''); };
  const drag = useDragPlace<string>((_item, target) => cut(Number(target.slice('split-'.length))), locked);
  const cuts = cutPoints(across);
  const a = typedNumber(first, locale, MAX_TYPED, 1);
  const b = typedNumber(second, locale, MAX_TYPED, 1);
  const c = typedNumber(whole, locale, MAX_TYPED, 1);
  const height = boxHeight(down, across);
  const leftWidth = split > 0 ? (BOX_WIDTH * split) / across : 0;
  const edit = (set: (text: string) => void) => (next: string) => { grading.reset(); set(next); };
  const reset = () => { grading.reset(); drag.clear(); setSplit(0); setFirst(''); setSecond(''); setWhole(''); };

  return <NumBFrame screen="array-area" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={split > 0 && a !== null && b !== null && c !== null} answer={{ split, partials: [a ?? '', b ?? ''], value: c ?? '' }}
    named={{ met: t.metBox, hint: t.hintBox }} changed={split > 0 || first !== '' || second !== '' || whole !== ''}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.boxLabel}
    status={split > 0 ? fill(t.boxFacts, { across, a: split, b: across - split, down }) : fill(t.boxFactsUncut, { across, down })}
    board={<>
      <svg className="lf-area-svg" viewBox={`-28 -24 ${BOX_WIDTH + 40} ${height + 32}`} role="img" aria-label={t.boxLabel}>
        {split > 0 ? <>
          <rect className="lf-area-rect lf-area-rect--sky" x={0} y={0} width={leftWidth} height={height} />
          <rect className="lf-area-rect lf-area-rect--mint" x={leftWidth} y={0} width={BOX_WIDTH - leftWidth} height={height} />
          <text data-copy-role="data" x={leftWidth / 2} y={-8} textAnchor="middle">{split}</text>
          <text data-copy-role="data" x={leftWidth + (BOX_WIDTH - leftWidth) / 2} y={-8} textAnchor="middle">{across - split}</text>
        </> : <>
          <rect className="lf-area-rect" x={0} y={0} width={BOX_WIDTH} height={height} />
          <text data-copy-role="data" x={BOX_WIDTH / 2} y={-8} textAnchor="middle">{across}</text>
        </>}
        <text data-copy-role="data" x={-8} y={height / 2} textAnchor="end" dominantBaseline="middle">{down}</text>
      </svg>
      <div className="lf-area-ticks" role="group" aria-label={t.cutHeading}>
        {cuts.map((at) => <div key={at} className="lf-area-tick" {...drag.target(`split-${at}`)}>
          <button type="button" aria-pressed={split === at} disabled={locked} data-copy-role="data" aria-label={fill(t.cutAt, { n: at })}
            onClick={() => { if (drag.carried) return; cut(split === at ? 0 : at); }}>{at}</button>
        </div>)}
      </div>
    </>}
    tableNode={<DataTable caption={t.boxCaption} head={[t.colPart, t.colWidth, t.colHeight, t.colArea]}
      rows={split > 0 ? [[t.leftName, String(split), String(down), a ?? '?'], [t.rightName, String(across - split), String(down), b ?? '?']] : []}
      foot={[t.wholeBox, String(across), String(down), c ?? '?']} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-cut`}>
      <h2 id={`${segment.id}-cut`} data-copy-role="heading">{t.cutHeading}</h2>
      <div className="lf-area-cutter">
        <Handle drag={drag} id="cut" label={t.cutChip} disabled={locked} />
        <MoveToChoice locale={locale} item={drag.carried === null ? null : { label: t.cutChip }} disabled={locked}
          options={cuts.map((at) => ({ value: `split-${at}`, label: fill(t.cutAt, { n: at }) }))}
          onChange={(target) => { if (drag.carried) { cut(Number(target.slice('split-'.length))); drag.clear(); } }} />
      </div>
    </section>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-answer`}>
      <h2 id={`${segment.id}-answer`} data-copy-role="heading">{t.answerHeading}</h2>
      {split > 0 ? <>
        <NumField label={fill(t.leftBox, { a: split, b: down })} locale={locale} value={first} onText={edit(setFirst)} disabled={locked} min={1} />
        <NumField label={fill(t.rightBox, { a: across - split, b: down })} locale={locale} value={second} onText={edit(setSecond)} disabled={locked} min={1} />
        <NumField label={t.boxTotal} locale={locale} value={whole} onText={edit(setWhole)} disabled={locked} min={1} />
      </> : <p data-copy-role="body">{t.cutFirst}</p>}
    </section>
  </NumBFrame>;
}

/* F1.4 missing-area division: take the area away in parts of the known side, then name the other side. */
function AreaDivisionBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<AreaDivisionPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const { dividend, divisor } = payload;
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [whole, setWhole] = useState('');
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const a = typedNumber(first, locale, MAX_TYPED, 1);
  const b = typedNumber(second, locale, MAX_TYPED, 1);
  const c = typedNumber(whole, locale, MAX_TYPED, 1);
  const taken = a !== null && Number(a) * divisor <= dividend ? Number(a) * divisor : null;
  const left = taken === null ? null : dividend - taken;
  const takenWidth = taken === null ? 0 : (BOX_WIDTH * taken) / dividend;
  const height = 100;
  const edit = (set: (text: string) => void) => (next: string) => { grading.reset(); set(next); };
  const reset = () => { grading.reset(); setFirst(''); setSecond(''); setWhole(''); };

  return <NumBFrame screen="array-area" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={a !== null && b !== null && c !== null} answer={{ partials: [a ?? '', b ?? ''], value: c ?? '' }}
    named={{ met: t.metDiv, hint: t.hintDiv }} changed={first !== '' || second !== '' || whole !== ''}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.divLabel}
    status={fill(t.divFacts, { dividend, divisor, left: left ?? '?' })}
    board={<svg className="lf-area-svg" viewBox={`-28 -24 ${BOX_WIDTH + 40} ${height + 32}`} role="img" aria-label={t.divLabel}>
      <rect className="lf-area-rect" x={0} y={0} width={BOX_WIDTH} height={height} />
      {taken !== null ? <rect className="lf-area-rect lf-area-rect--sky" x={0} y={0} width={takenWidth} height={height} /> : null}
      <text data-copy-role="data" x={BOX_WIDTH / 2} y={-8} textAnchor="middle">?</text>
      <text data-copy-role="data" x={-8} y={height / 2} textAnchor="end" dominantBaseline="middle">{divisor}</text>
      <text data-copy-role="data" x={taken !== null && takenWidth > 40 ? takenWidth / 2 : BOX_WIDTH / 2} y={height / 2} textAnchor="middle" dominantBaseline="middle">{taken ?? dividend}</text>
    </svg>}
    tableNode={<DataTable caption={t.divCaption} head={[t.colItem, t.colValue]}
      rows={[[t.areaItem, String(dividend)], [t.knownSide, String(divisor)], [t.firstArea, taken === null ? '?' : String(taken)], [t.areaLeft, left === null ? '?' : String(left)]]} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-answer`}>
      <h2 id={`${segment.id}-answer`} data-copy-role="heading">{t.answerHeading}</h2>
      <NumField label={t.firstPart} locale={locale} value={first} onText={edit(setFirst)} disabled={locked} min={1} />
      <NumField label={t.secondPart} locale={locale} value={second} onText={edit(setSecond)} disabled={locked} min={1} />
      <NumField label={t.wholeSide} locale={locale} value={whole} onText={edit(setWhole)} disabled={locked} min={1} />
    </section>
  </NumBFrame>;
}

export default function ArrayAreaBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.array-area.v2') return null;
  const { payload } = segment;
  if (isArrayPayload(payload)) return <ArrayBoard segment={segment} payload={payload} {...rest} />;
  if (isAreaModelPayload(payload)) return <AreaModelBoard segment={segment} payload={payload} {...rest} />;
  if (isAreaDivisionPayload(payload)) return <AreaDivisionBoard segment={segment} payload={payload} {...rest} />;
  return null;
}
