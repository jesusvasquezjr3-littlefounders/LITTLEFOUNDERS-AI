import { useMemo, useState } from 'react';
import { Button } from '../../../design/controls';
import { Stepper } from '../../../design/fields';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { TableToggle, decimalText, fractionAcross } from './boardKit';
import { zoomCanIn, zoomCanOut, zoomIn, zoomInitial, zoomMove, zoomOut, zoomScale, zoomSetup, zoomStartUnits, zoomStep, zoomWindow } from './line-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumberLine.css';

type ZoomSegment = Extract<HorizonteSegment, { type: 'math.number-line.zoom.v2' }>;

const WIDTH = 560;
const PAD = 28;
const AXIS = 76;

/*
 * A13: a number line that zooms from whole numbers into tenths and then hundredths. The marker moves by tapping the line or by the
 * stepper, whose buttons are the keyboard path; the answer is the marker's whole-number position on the finest grid.
 * Zooming in keeps the marker and shows one tick of the coarser level on each side of it. Core holds the target.
 */
function ZoomLine({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: ZoomSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const setup = useMemo(() => zoomSetup(segment.payload)!, [segment.payload]);
  const [state, setState] = useState(() => zoomInitial(setup));
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const scale = zoomScale(setup.depth);
  const step = zoomStep(setup.depth, state.level);
  const { from, to } = zoomWindow(setup, state);
  const parent = state.level === 0 ? scale : zoomStep(setup.depth, state.level - 1);
  const changed = state.units !== zoomStartUnits(setup) || state.level !== 0;
  const written = (units: number, digits = state.level) => decimalText(document.locale, units / scale, digits);
  const x = (units: number) => PAD + ((units - from) / (to - from)) * (WIDTH - PAD * 2);
  const ticks = Array.from({ length: Math.floor(to / step) - Math.ceil(from / step) + 1 }, (_, index) => (Math.ceil(from / step) + index) * step);
  const labelEvery = state.level === 0 ? (ticks.length > 11 ? 2 : 1) : 5;
  const levels = Array.from({ length: state.level + 1 }, (_, level) => ({ level, ...zoomWindow(setup, { ...state, level }), tick: zoomStep(setup.depth, level) }));

  const change = (next: typeof state) => { grading.reset(); setState(next); };
  const move = (units: number) => { if (!locked) change(zoomMove(setup, state, units)); };
  const reset = () => { grading.reset(); setState(zoomInitial(setup)); };

  return <BoardShell screen="zoom-number-line" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={state.units !== zoomStartUnits(setup) && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metZoom, hint: t.hintZoom }} onCheck={() => grading.check({ units: state.units })} />}>
    <section className="lf-learning-board lf-num-board" aria-label={t.zoomLine}>
      <div className="lf-num-scroll">
        <svg className="lf-line" viewBox={`0 0 ${WIDTH} 140`} role="img" aria-label={`${t.zoomLine}: ${fillSlot(t.zoomLevel, state.level)}, ${t.markerAt} ${written(state.units)}`} focusable="false">
          <line className="lf-line-axis" x1={PAD / 2} x2={WIDTH - PAD / 2} y1={AXIS} y2={AXIS} />
          {ticks.map((tick) => {
            const long = tick % parent === 0;
            const half = tick % (step * 5) === 0;
            return <g key={tick} className={`lf-line-point${long ? ' lf-line-point--long' : ''}`}>
              <line className="lf-line-tick" x1={x(tick)} x2={x(tick)} y1={AXIS - (long ? 22 : half ? 16 : 10)} y2={AXIS + (long ? 22 : half ? 16 : 10)} />
              {(tick / step) % labelEvery === 0 || long ? <text className="lf-line-number" x={x(tick)} y={AXIS + 48} textAnchor="middle" data-copy-role="data">{written(tick)}</text> : null}
            </g>;
          })}
          <g className="lf-zoom-marker">
            <line className="lf-zoom-pin" x1={x(state.units)} x2={x(state.units)} y1={AXIS - 40} y2={AXIS} />
            <circle className="lf-zoom-dot" cx={x(state.units)} cy={AXIS - 46} r={10} />
          </g>
          <rect className="lf-zoom-strip" role="presentation" x={PAD} y={AXIS - 60} width={WIDTH - PAD * 2} height={120} onClick={(event) => move(from + fractionAcross(event) * (to - from))} />
        </svg>
      </div>
      <Stepper label={t.marker} valueText={written(state.units)} min={from} max={to} step={step} value={state.units} disabled={locked}
        labels={{ decrease: t.tickLeft, increase: t.tickRight }} onValueChange={move} />
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {fillSlot(t.zoomLevel, state.level)}. {t.markerAt}: {written(state.units)}. {t.colFrom}: {written(from)}, {t.colTo}: {written(to)}, {t.colTick}: {written(step)}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.zoomCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colZoom}</th><th scope="col" data-copy-role="data">{t.colFrom}</th><th scope="col" data-copy-role="data">{t.colTo}</th><th scope="col" data-copy-role="data">{t.colTick}</th></tr></thead>
        <tbody>{levels.map((row) => <tr key={row.level}><th scope="row" data-copy-role="data">{row.level}</th><td data-copy-role="data">{written(row.from, row.level)}</td><td data-copy-role="data">{written(row.to, row.level)}</td><td data-copy-role="data">{written(row.tick, row.level)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" data-copy-role="data">{t.markerAt}</th><td data-copy-role="data" colSpan={3}>{written(state.units)}</td></tr></tfoot>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.zoomLine}>
      <div className="lf-num-tray">
        <Button size="lg" variant="sky" disabled={locked || !zoomCanIn(setup, state)} onClick={() => change(zoomIn(setup, state))}>{t.zoomIn}</Button>
        <Button size="lg" variant="mint" disabled={locked || !zoomCanOut(state)} onClick={() => { const out = zoomOut(setup, state); change(zoomMove(setup, out, out.units)); }}>{t.zoomOut}</Button>
      </div>
    </section>
  </BoardShell>;
}

export default function ZoomLineBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.number-line.zoom.v2' ? <ZoomLine segment={segment} {...rest} /> : null;
}
