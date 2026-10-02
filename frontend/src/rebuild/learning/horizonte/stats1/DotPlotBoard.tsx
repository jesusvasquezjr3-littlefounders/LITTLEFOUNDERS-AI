import { useState } from 'react';
import { ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { STATS1_COPY } from './copy';
import { dotCounts, dotMeasureValue, dotsMoved, sameDots, sortedDots } from './model.generated';
import { AxisTicks, Chart, PAD, TableToggle, VIEW_W, fmt, slots, tickValues } from './shared';
import '../horizonte.css';
import './stats1.css';

type DotPlotSegment = Extract<HorizonteSegment, { type: 'stats.dot-plot.v2' }>;

/*
 * C06, H03, H07: a stacked dot plot and one measure (mean, median or mode) to bring to a number by moving a few dots.
 * A dot moves by dragging its chip onto a column, tapping a chip then a column, or the Move to menu. The answer is the
 * list of dots; Core holds the target and checks the measure in whole numbers.
 */
function DotPlot({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: DotPlotSegment }) {
  const t = copyText(STATS1_COPY, document.locale);
  const { axis, dots: start, measure, moves } = segment.payload;
  const [dots, setDots] = useState<number[]>(() => sortedDots(start));
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = !sameDots(dots, start);

  const relocate = (from: number, to: number): number[] | null => {
    const index = dots.indexOf(from);
    if (index < 0 || from === to) return null;
    const next = sortedDots([...dots.slice(0, index), ...dots.slice(index + 1), to]);
    return dotsMoved(start, next) > moves ? null : next;
  };
  const place = (item: string, target: string) => {
    const next = relocate(Number(item.slice('from-'.length)), Number(target.slice('col-'.length)));
    if (next) { grading.reset(); setDots(next); }
  };
  const drag = useDragPlace<string>(place, locked);
  const carriedValue = drag.carried?.startsWith('from-') ? Number(drag.carried.slice('from-'.length)) : null;
  const allColumns = Array.from({ length: axis.max - axis.min + 1 }, (_, index) => axis.min + index);
  const targets = carriedValue === null ? [] : allColumns.filter((value) => relocate(carriedValue, value) !== null);
  const reset = () => { grading.reset(); drag.clear(); setDots(sortedDots(start)); };

  const counts = dotCounts(dots, axis);
  const startCounts = dotCounts(start, axis);
  const cw = (VIEW_W - 2 * PAD) / counts.length;
  const radius = Math.min(cw * 0.42, 15);
  const step = radius * 2 + 3;
  const base = 12 + (Math.max(...startCounts) + moves) * step;
  const x = (value: number) => PAD + (value - axis.min + 0.5) * cw;
  const value = dotMeasureValue(measure, dots);
  const used = dotsMoved(start, dots);
  const filled = allColumns.filter((column) => counts[column - axis.min]! > 0);

  return <BoardShell screen="dot-plot" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metDots, hint: t.hintDots }} onCheck={() => grading.check({ dots })} />}>
    <section className="lf-learning-board lf-stats" aria-label={t.dotPlotName}>
      <Chart label={t.dotPlotName} height={base + 44}>
        {allColumns.map((column, index) => <rect key={column} className="lf-stats-drop" x={PAD + index * cw} y={0} width={cw} height={base} {...drag.target(`col-${column}`)} />)}
        {measure === 'mode' && value !== null ? <rect className="lf-stats-mode" x={PAD + (value - axis.min) * cw} y={0} width={cw} height={base} /> : null}
        {measure !== 'mode' && value !== null ? <line className="lf-stats-marker" x1={x(value)} x2={x(value)} y1={4} y2={base} /> : null}
        {counts.flatMap((count, index) => Array.from({ length: count }, (_, row) => <circle key={`${index}-${row}`} cx={x(axis.min + index)} cy={base - (row + 0.5) * step} r={radius}
          className={row >= startCounts[index]! ? 'lf-stats-dot lf-stats-dot--moved' : 'lf-stats-dot'} />))}
        <AxisTicks ticks={tickValues(axis.min, axis.max, 11)} x={x} y={base} />
      </Chart>
      <p className="lf-stats-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t[measure]}: {value === null ? t.none : fmt(document.locale, value)}. {slots(t.movesUsed, { n: used, m: moves })}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaptionDots}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colValue}</th><th scope="col" data-copy-role="data">{t.colDots}</th></tr></thead>
        <tbody>{filled.map((column) => <tr key={column}><th scope="row" data-copy-role="data">{column}</th><td data-copy-role="data">{counts[column - axis.min]}</td></tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.moveHeading}>
      <h2 data-copy-role="heading">{t.moveHeading}</h2>
      <div className="lf-stats-tray">
        {[...new Set(dots)].map((column) => <span key={column} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip(`from-${column}`)} disabled={locked}>{slots(t.takeDot, { n: column })}</ChoiceChip>
        </span>)}
      </div>
      <MoveToChoice locale={document.locale} item={carriedValue === null ? null : { label: slots(t.takeDot, { n: carriedValue }) }}
        options={targets.map((column) => ({ value: `col-${column}`, label: slots(t.valueAt, { n: column }) }))} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function DotPlotBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'stats.dot-plot.v2' ? <DotPlot segment={segment} {...rest} /> : null;
}
