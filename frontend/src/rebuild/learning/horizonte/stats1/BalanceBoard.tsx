import { useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { STATS1_COPY } from './copy';
import { balanceMoment, dotCounts, sortedDots } from './model.generated';
import { AxisTicks, Chart, PAD, TableToggle, VIEW_W, tickValues } from './shared';
import '../horizonte.css';
import './stats1.css';

type BalanceSegment = Extract<HorizonteSegment, { type: 'stats.balance-point.v2' }>;

const TILT_LIMIT = 14;
const TILT_FLOOR = 3;

/*
 * H06: dots sit on a beam and the learner slides the pivot until the beam is level. The beam tilts toward the heavier
 * side (the sum of distances from the pivot), and both pulls are written out. The answer is the pivot position, which
 * Core compares with the mean of the dots.
 */
function Balance({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: BalanceSegment }) {
  const t = copyText(STATS1_COPY, document.locale);
  const { axis, dots, pivot: start } = segment.payload;
  const [pivot, setPivot] = useState(start);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = pivot !== start;
  const move = (next: number) => { grading.reset(); setPivot(next); };

  const sorted = sortedDots(dots);
  const moment = balanceMoment(dots, pivot);
  const left = dots.reduce((sum, dot) => (dot < pivot ? sum + (pivot - dot) : sum), 0);
  const right = dots.reduce((sum, dot) => (dot > pivot ? sum + (dot - pivot) : sum), 0);
  const state = moment < 0 ? t.tipsLeft : moment > 0 ? t.tipsRight : t.level;

  const counts = dotCounts(dots, axis);
  const cw = (VIEW_W - 2 * PAD) / counts.length;
  const radius = Math.min(cw * 0.42, 15);
  const step = radius * 2 + 3;
  const beamY = 12 + Math.max(...counts) * step;
  const axisY = beamY + 38;
  const x = (value: number) => PAD + (value - axis.min + 0.5) * cw;
  const offset = moment / dots.length;
  const raw = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, (offset * 80) / (axis.max - axis.min)));
  const tilt = moment === 0 ? 0 : Math.abs(raw) < TILT_FLOOR ? Math.sign(raw) * TILT_FLOOR : raw;

  return <BoardShell screen="balance-point" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => { grading.reset(); setPivot(start); }} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metBalance, hint: t.hintBalance }} onCheck={() => grading.check({ pivot })} />}>
    <section className="lf-learning-board lf-stats" aria-label={t.balanceName}>
      <Chart label={t.balanceName} height={axisY + 44}>
        <g className={moment === 0 ? 'lf-stats-beam lf-stats-beam--level' : 'lf-stats-beam'} style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${x(pivot)}px ${beamY + 4}px` }}>
          <rect className="lf-stats-bar" x={PAD} y={beamY} width={VIEW_W - 2 * PAD} height={8} rx={4} />
          {counts.flatMap((count, index) => Array.from({ length: count }, (_, row) => <circle key={`${index}-${row}`} className="lf-stats-dot" cx={x(axis.min + index)} cy={beamY - (row + 0.5) * step} r={radius} />))}
        </g>
        <polygon className="lf-stats-pivot" points={`${x(pivot)},${beamY + 8} ${x(pivot) - 20},${axisY} ${x(pivot) + 20},${axisY}`} />
        <AxisTicks ticks={tickValues(axis.min, axis.max, 11)} x={x} y={axisY} />
      </Chart>
      <p className="lf-stats-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.leftPull}: {left}. {t.rightPull}: {right}. {state}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaptionBalance}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colDotAt}</th><th scope="col" data-copy-role="data">{t.colDistance}</th></tr></thead>
        <tbody>{sorted.map((dot, index) => <tr key={index}><th scope="row" data-copy-role="data">{dot}</th><td data-copy-role="data">{dot - pivot}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" data-copy-role="data">{t.net}</th><td data-copy-role="data">{moment}</td></tr></tfoot>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.pivotLabel}>
      <Slider label={t.pivotLabel} valueText={String(pivot)} min={axis.min} max={axis.max} step={1} value={pivot} onValueChange={move}
        stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function BalanceBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'stats.balance-point.v2' ? <Balance segment={segment} {...rest} /> : null;
}
