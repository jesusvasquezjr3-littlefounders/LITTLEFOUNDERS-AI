import { useState } from 'react';
import { Stepper } from '../../../design/fields';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { TableToggle, fillSlots, fractionAcross } from './boardKit';
import { rulerSetup } from './measure-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumShared.css';
import './Measure.css';

type RulerSegment = Extract<HorizonteSegment, { type: 'math.ruler.v2' }>;

const WIDTH = 560;
const PAD = 28;
const BAR_Y = 18;
const EDGE_Y = 66;

/*
 * A15: a ruler with a bar that starts on a mark. The learner stretches the end of the bar to a whole mark by tapping the ruler or
 * with the stepper, whose buttons are the keyboard path. The answer is the mark the bar ends on; Core holds the target.
 */
function Ruler({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: RulerSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const { unit, from, start, max } = rulerSetup(segment.payload)!;
  const [end, setEnd] = useState(start);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const unitWord = unit === 'in' ? t.unitIn : t.unitCm;
  const x = (mark: number) => PAD + (mark * (WIDTH - PAD * 2)) / max;
  const length = end - from;

  const change = (next: number) => { grading.reset(); setEnd(next); };
  const move = (mark: number) => { if (!locked) change(Math.min(max, Math.max(from, Math.round(mark)))); };
  const reset = () => { grading.reset(); setEnd(start); };

  return <BoardShell screen="ruler" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={end === start || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={end !== start && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metRuler, hint: t.hintRuler }} onCheck={() => grading.check({ end })} />}>
    <section className="lf-learning-board lf-num-board" aria-label={t.ruler}>
      <div className="lf-num-scroll">
        <svg className="lf-ruler" viewBox={`0 0 ${WIDTH} 130`} role="img" aria-label={`${t.ruler}: ${fillSlots(t.fromTo, from, end)} ${unitWord}`} focusable="false">
          <rect className="lf-ruler-bar" x={x(from)} y={BAR_Y} width={x(end) - x(from)} height={32} rx={6} />
          <line className="lf-ruler-guide" x1={x(end)} x2={x(end)} y1={BAR_Y + 32} y2={EDGE_Y} />
          <rect className="lf-ruler-body" x={PAD / 2} y={EDGE_Y} width={WIDTH - PAD} height={58} rx={6} />
          {Array.from({ length: max + 1 }, (_, mark) => <g key={mark}>
            <line className="lf-ruler-tick" x1={x(mark)} x2={x(mark)} y1={EDGE_Y} y2={EDGE_Y + 22} />
            <text className="lf-ruler-number" x={x(mark)} y={EDGE_Y + 46} textAnchor="middle" data-copy-role="data">{mark}</text>
          </g>)}
          <rect className="lf-ruler-strip" role="presentation" x={PAD} y={BAR_Y} width={WIDTH - PAD * 2} height={EDGE_Y - BAR_Y + 58}
            onClick={(event) => move(fractionAcross(event) * max)} />
        </svg>
      </div>
      <Stepper label={t.barEnd} min={from} max={max} value={end} disabled={locked} labels={{ decrease: t.less, increase: t.more }} onValueChange={move} />
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {fillSlots(t.fromTo, from, end)}. {t.length}: {length} {unitWord}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.rulerCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colFrom}</th><th scope="col" data-copy-role="data">{t.colTo}</th><th scope="col" data-copy-role="data">{t.length}</th></tr></thead>
        <tbody><tr><td data-copy-role="data">{from}</td><td data-copy-role="data">{end}</td><td data-copy-role="data">{length} {unitWord}</td></tr></tbody>
      </table> : null}
    </section>
  </BoardShell>;
}

export default function RulerBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.ruler.v2' ? <Ruler segment={segment} {...rest} /> : null;
}
