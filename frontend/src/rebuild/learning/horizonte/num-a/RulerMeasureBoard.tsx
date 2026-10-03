import { useMemo, useState } from 'react';
import { Stepper } from '../../../design/fields';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { TableToggle, fillSlots } from './boardKit';
import { readResponse, readSetup } from './read-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumShared.css';
import './Measure.css';

type MeasureSegment = Extract<HorizonteSegment, { type: 'math.ruler.measure.v2' }>;

const WIDTH = 560;
const PAD = 28;
const OBJECT_Y = 14;
const OBJECT_H = 34;
const EDGE_Y = 72;

/*
 * F1.7: an object (a pencil or a paper strip) drawn against a ruler, with its near end on a mark that is not always 0. The learner reads
 * how long it is with the stepper and checks; the answer is the length they report. Core holds the target.
 */
function RulerMeasure({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: MeasureSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const { unit, object, from, to, max } = useMemo(() => readSetup(segment.payload)!, [segment.payload]);
  const [length, setLength] = useState(0);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const unitWord = unit === 'in' ? t.unitIn : t.unitCm;
  const objectName = object === 'pencil' ? t.objectPencil : t.objectStrip;
  const x = (mark: number) => PAD + (mark * (WIDTH - PAD * 2)) / max;
  const near = x(from);
  const far = x(to);
  const tip = Math.min(30, (far - near) * 0.4);
  const eraser = Math.min(14, (far - near) * 0.2);
  const drawn = `${fillSlots(t.objectSpan, objectName, from, to)} ${unitWord}`;

  const change = (next: number) => { grading.reset(); setLength(next); };
  const reset = () => { grading.reset(); setLength(0); };

  return <BoardShell screen="ruler-measure" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={length === 0 || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={length !== 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metRead, hint: t.hintRead }} onCheck={() => grading.check(readResponse(length))} />}>
    <section className="lf-learning-board lf-num-board" aria-label={t.measureRuler}>
      <div className="lf-num-scroll">
        <svg className="lf-ruler" viewBox={`0 0 ${WIDTH} 134`} role="img" aria-label={`${t.measureRuler}: ${drawn}`} focusable="false">
          {object === 'pencil' ? <g>
            <rect className="lf-read-body" x={near} y={OBJECT_Y} width={far - near - tip} height={OBJECT_H} />
            <rect className="lf-read-eraser" x={near} y={OBJECT_Y} width={eraser} height={OBJECT_H} />
            <polygon className="lf-read-tip" points={`${far - tip},${OBJECT_Y} ${far},${OBJECT_Y + OBJECT_H / 2} ${far - tip},${OBJECT_Y + OBJECT_H}`} />
          </g> : <rect className="lf-read-strip" x={near} y={OBJECT_Y} width={far - near} height={OBJECT_H} rx={4} />}
          <line className="lf-ruler-guide" x1={near} x2={near} y1={OBJECT_Y + OBJECT_H} y2={EDGE_Y} />
          <line className="lf-ruler-guide" x1={far} x2={far} y1={OBJECT_Y + OBJECT_H} y2={EDGE_Y} />
          <rect className="lf-ruler-body" x={PAD / 2} y={EDGE_Y} width={WIDTH - PAD} height={58} rx={6} />
          {Array.from({ length: max + 1 }, (_, mark) => <g key={mark} className="lf-ruler-mark">
            <line className="lf-ruler-tick" x1={x(mark)} x2={x(mark)} y1={EDGE_Y} y2={EDGE_Y + 22} />
            <text className="lf-ruler-number" x={x(mark)} y={EDGE_Y + 46} textAnchor="middle" data-copy-role="data">{mark}</text>
          </g>)}
        </svg>
      </div>
      <Stepper label={t.howLong} min={0} max={max} value={length} valueText={`${length} ${unitWord}`} disabled={locked}
        labels={{ decrease: t.less, increase: t.more }} onValueChange={change} />
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{drawn}. {t.yourReading}: {length} {unitWord}.</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.readCaption}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.colObject}</th><th scope="col" data-copy-role="data">{t.colFrom}</th>
          <th scope="col" data-copy-role="data">{t.colTo}</th><th scope="col" data-copy-role="data">{t.yourReading}</th>
        </tr></thead>
        <tbody><tr>
          <th scope="row" data-copy-role="data">{objectName}</th><td data-copy-role="data">{from}</td><td data-copy-role="data">{to}</td>
          <td data-copy-role="data">{length} {unitWord}</td>
        </tr></tbody>
      </table> : null}
    </section>
  </BoardShell>;
}

export default function RulerMeasureBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.ruler.measure.v2' ? <RulerMeasure segment={segment} {...rest} /> : null;
}
