import { useState, type CSSProperties } from 'react';
import { Button } from '../../../design/controls';
import { fractionName } from '../../fractionName';
import { MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { DataTable, FractionFields, Handle, NumBFrame, fill, useFractionText } from './boardKit';
import { NUM_B_COPY } from './copy';
import { gcd, isFractionPayload, type EquivalentPayload, type PairPayload } from './fractionWallModel.generated';
import './FractionWallBoard.css';

type WallSegment = Extract<HorizonteSegment, { type: 'math.fraction-wall.v2' }>;
type Props<P> = Omit<HorizonteBoardProps, 'segment'> & { segment: WallSegment; payload: P };

const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/* A row of equal parts, the first `shaded` of them filled; decoration only, so the spoken line and the table carry the state. */
function Bar({ cells, shaded, hue }: { cells: number; shaded: number; hue: 'sky' | 'mint' }) {
  return <div className="lf-wall-row" style={{ '--row-cells': cells } as CSSProperties} data-dense={cells > 24} aria-hidden="true">
    {Array.from({ length: cells }, (_, index) => <span key={index} className="lf-fcell" data-on={index < shaded} data-hue={hue} />)}
  </div>;
}

/* F1.6 fraction wall: shade the parts of a finer row that match the given row. The learner chooses how far to shade. */
function WallBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<EquivalentPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const [n, d] = payload.fraction;
  const parts = payload.denominator;
  const [shaded, setShaded] = useState(0);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const shade = (to: number) => { grading.reset(); setShaded(to); };
  const drag = useDragPlace<string>((_item, target) => shade(Number(target.slice('cell-'.length))), locked);
  const name = fractionName(n, d, locale);
  const reset = () => { grading.reset(); drag.clear(); setShaded(0); };

  return <NumBFrame screen="fraction-wall" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={shaded >= 1} answer={{ n: shaded, d: parts }} named={{ met: t.metWall, hint: t.hintWall }} changed={shaded > 0}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.wallLabel}
    status={fill(t.wallFacts, { name, d: parts, k: shaded })}
    board={<div className="lf-wall-scroll"><div className="lf-wall" data-tap="true" style={{ '--cells': parts } as CSSProperties}>
      <p className="lf-numb-legend" data-copy-role="data">{fill(t.givenRow, { name })}</p>
      <Bar cells={d} shaded={n} hue="mint" />
      <p className="lf-numb-legend" data-copy-role="data">{fill(t.targetRow, { n: parts })}</p>
      <div className="lf-wall-row" role="group" aria-label={fill(t.targetRow, { n: parts })} style={{ '--row-cells': parts } as CSSProperties}>
        {Array.from({ length: parts }, (_, index) => {
          const part = index + 1;
          return <div key={part} className="lf-wall-cell" {...drag.target(`cell-${part}`)}>
            <button type="button" className="lf-fcell lf-fcell--button" data-on={part <= shaded} data-hue="sky" aria-pressed={part <= shaded} disabled={locked}
              aria-label={fill(t.partOf, { n: part, d: parts })} onClick={() => { if (drag.carried) return; shade(shaded === part ? part - 1 : part); }} />
          </div>;
        })}
      </div>
    </div></div>}
    tableNode={<DataTable caption={t.wallCaption} head={[t.colItem, t.colParts, t.colShaded]}
      rows={[[t.rowGiven, String(d), String(n)], [t.rowYours, String(parts), String(shaded)]]} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-shade`}>
      <h2 id={`${segment.id}-shade`} data-copy-role="heading">{t.shadeHeading}</h2>
      <div className="lf-numb-row">
        <Handle drag={drag} id="shade" label={t.shadeChip} disabled={locked} />
        <MoveToChoice locale={locale} item={drag.carried === null ? null : { label: t.shadeChip }} disabled={locked}
          options={[{ value: 'cell-0', label: t.shadeNone }, ...Array.from({ length: parts }, (_, index) => ({ value: `cell-${index + 1}`, label: fill(t.shadeTo, { n: index + 1 }) }))]}
          onChange={(target) => { if (drag.carried) { shade(Number(target.slice('cell-'.length))); drag.clear(); } }} />
      </div>
    </section>
  </NumBFrame>;
}

/* F1.6 bars: two bars of different parts; recut both into common parts, then write the sum or the difference. */
function BarsBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<PairPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const [a, b] = payload.left;
  const [c, d] = payload.right;
  const adding = payload.op === 'add';
  const [common, setCommon] = useState(false);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const fraction = useFractionText(locale, grading);
  const parts = lcm(b, d);
  const leftCommon = (a * parts) / b;
  const rightCommon = (c * parts) / d;
  const left = fractionName(a, b, locale);
  const right = fractionName(c, d, locale);
  const task = fill(adding ? t.addFacts : t.subtractFacts, { left, right });
  const reset = () => { grading.reset(); fraction.clear(); setCommon(false); };

  return <NumBFrame screen="fraction-wall" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={fraction.ready} answer={fraction.answer} named={{ met: adding ? t.metAdd : t.metSubtract, hint: t.hintBars }} changed={common || fraction.typed}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.barsLabel}
    status={common ? `${task} ${fill(t.commonFacts, { l: parts, x: leftCommon, y: rightCommon })}` : task}
    board={<div className="lf-wall-scroll"><div className="lf-wall">
      <p className="lf-numb-legend" data-copy-role="data">{fill(t.leftBar, { name: left })}</p>
      <Bar cells={common ? parts : b} shaded={common ? leftCommon : a} hue="sky" />
      <p className="lf-numb-legend" data-copy-role="data">{fill(t.rightBar, { name: right })}</p>
      <Bar cells={common ? parts : d} shaded={common ? rightCommon : c} hue="mint" />
    </div></div>}
    tableNode={<DataTable caption={t.barsCaption} head={[t.colBar, t.colParts, t.colShaded]}
      rows={[[t.rowFirst, String(b), String(a)], [t.rowSecond, String(d), String(c)],
        ...(common ? [[t.rowFirstCommon, String(parts), String(leftCommon)], [t.rowSecondCommon, String(parts), String(rightCommon)]] : [])]} />}>
    <section className="lf-learning-control-strip" aria-label={t.barsLabel}>
      <Button size="sm" disabled={locked} onClick={() => setCommon((now) => !now)}>{common ? t.commonOff : t.commonOn}</Button>
    </section>
    <FractionFields id={segment.id} t={t} locale={locale} fraction={fraction} locked={locked} />
  </NumBFrame>;
}

/* F1.6 product grid: columns for one fraction, rows for the other; the cells shaded twice are the product. */
function ProductBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<PairPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const [, columns] = payload.left;
  const [, rows] = payload.right;
  const [cols, setCols] = useState<boolean[]>(() => Array.from({ length: columns }, () => false));
  const [lines, setLines] = useState<boolean[]>(() => Array.from({ length: rows }, () => false));
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const fraction = useFractionText(locale, grading);
  const toggle = (set: (next: boolean[]) => void, now: boolean[], at: number) => { grading.reset(); set(now.map((on, index) => (index === at ? !on : on))); };
  const shadedCols = cols.filter(Boolean).length;
  const shadedRows = lines.filter(Boolean).length;
  const task = fill(t.gridTask, { left: fractionName(payload.left[0], columns, locale), right: fractionName(payload.right[0], rows, locale) });
  const reset = () => { grading.reset(); fraction.clear(); setCols(cols.map(() => false)); setLines(lines.map(() => false)); };

  return <NumBFrame screen="fraction-wall" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={fraction.ready} answer={fraction.answer} named={{ met: t.metProduct, hint: t.hintProduct }} changed={shadedCols > 0 || shadedRows > 0 || fraction.typed}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.gridLabel}
    status={`${task} ${fill(t.gridFacts, { c: columns, r: rows, sc: shadedCols, sr: shadedRows })}`}
    board={<div className="lf-grid" role="group" aria-label={t.gridLabel} style={{ '--cols': columns } as CSSProperties}>
      <div className="lf-grid-line">
        <span aria-hidden="true" />
        {cols.map((on, index) => <button key={index} type="button" className="lf-grid-strip" data-hue="sky" aria-pressed={on} disabled={locked} data-copy-role="data"
          aria-label={fill(t.gridColumn, { n: index + 1 })} onClick={() => toggle(setCols, cols, index)}>{index + 1}</button>)}
      </div>
      {lines.map((rowOn, row) => <div key={row} className="lf-grid-line">
        <button type="button" className="lf-grid-strip" data-hue="mint" aria-pressed={rowOn} disabled={locked} data-copy-role="data"
          aria-label={fill(t.gridRow, { n: row + 1 })} onClick={() => toggle(setLines, lines, row)}>{row + 1}</button>
        {cols.map((colOn, col) => <span key={col} className="lf-grid-cell" aria-hidden="true" data-shade={colOn && rowOn ? 'both' : colOn ? 'col' : rowOn ? 'row' : 'none'} />)}
      </div>)}
    </div>}
    tableNode={<DataTable caption={t.productCaption} head={[t.colItem, t.colValue]}
      rows={[[t.columnsItem, String(columns)], [t.shadedColumnsItem, String(shadedCols)], [t.rowsItem, String(rows)], [t.shadedRowsItem, String(shadedRows)], [t.cellsItem, String(columns * rows)]]} />}>
    <FractionFields id={segment.id} t={t} locale={locale} fraction={fraction} locked={locked} />
  </NumBFrame>;
}

/* F1.6 measuring: lay tiles of one length along another and read how many fit, the part left over included. */
function MeasureBoard({ document, segment, onBack, sequence, onGrade, payload }: Props<PairPayload>) {
  const { locale } = document;
  const t = copyText(NUM_B_COPY, locale);
  const [a, b] = payload.left;
  const [c, d] = payload.right;
  const maxTiles = Math.ceil((a * d) / (b * c));
  const [tiles, setTiles] = useState(0);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const fraction = useFractionText(locale, grading);
  const left = fractionName(a, b, locale);
  const right = fractionName(c, d, locale);
  const unit = 360;
  const length = (unit * a) / b;
  const tile = (unit * c) / d;
  const lay = (next: number) => { grading.reset(); setTiles(Math.max(0, Math.min(maxTiles, next))); };
  const reset = () => { grading.reset(); fraction.clear(); setTiles(0); };

  return <NumBFrame screen="fraction-wall" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={fraction.ready} answer={fraction.answer} named={{ met: t.metMeasure, hint: t.hintMeasure }} changed={tiles > 0 || fraction.typed}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.measureLabel}
    status={fill(t.measureFacts, { left, right, t: tiles })}
    board={<>
      <p className="lf-numb-legend" data-copy-role="data">{fill(t.lengthRow, { name: left })}</p>
      <p className="lf-numb-legend" data-copy-role="data">{fill(t.tileRow, { name: right })}</p>
      <svg className="lf-measure-svg" viewBox={`-12 0 ${unit + 24} 96`} role="img" aria-label={t.measureLabel}>
        <rect className="lf-measure-unit" x={0} y={18} width={unit} height={24} />
        <rect className="lf-measure-length" x={0} y={18} width={length} height={24} />
        <text data-copy-role="data" x={0} y={12} textAnchor="middle">0</text>
        <text data-copy-role="data" x={unit} y={12} textAnchor="middle">1</text>
        {Array.from({ length: tiles }, (_, index) => {
          const start = index * tile;
          const end = start + tile;
          const inside = Math.max(0, Math.min(end, length) - start);
          return <g key={index}>
            {inside > 0 ? <rect className="lf-measure-tile" x={start} y={52} width={inside} height={24} /> : null}
            {end > length && length < unit ? <rect className="lf-measure-over" x={start + inside} y={52} width={Math.max(0, Math.min(end, unit) - start - inside)} height={24} /> : null}
          </g>;
        })}
      </svg>
    </>}
    tableNode={<DataTable caption={t.measureCaption} head={[t.colItem, t.colValue]}
      rows={[[t.lengthItem, left], [t.tileItem, right], [t.tilesItem, String(tiles)]]} />}>
    <section className="lf-learning-control-strip" aria-labelledby={`${segment.id}-tiles`}>
      <h2 id={`${segment.id}-tiles`} data-copy-role="heading">{t.tilesHeading}</h2>
      <div className="lf-numb-row">
        <Button size="sm" disabled={locked || tiles >= maxTiles} onClick={() => lay(tiles + 1)}>{t.addTile}</Button>
        <Button size="sm" disabled={locked || tiles <= 0} onClick={() => lay(tiles - 1)}>{t.removeTile}</Button>
      </div>
    </section>
    <FractionFields id={segment.id} t={t} locale={locale} fraction={fraction} locked={locked} />
  </NumBFrame>;
}

export default function FractionWallBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.fraction-wall.v2') return null;
  const { payload } = segment;
  if (!isFractionPayload(payload)) return null;
  if (payload.op === 'equivalent') return <WallBoard segment={segment} payload={payload} {...rest} />;
  if (payload.op === 'add' || payload.op === 'subtract') return <BarsBoard segment={segment} payload={payload} {...rest} />;
  if (payload.op === 'multiply') return <ProductBoard segment={segment} payload={payload} {...rest} />;
  return <MeasureBoard segment={segment} payload={payload} {...rest} />;
}
