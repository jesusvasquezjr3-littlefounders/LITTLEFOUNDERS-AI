import { useState } from 'react';
import { Button } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { TableToggle } from './boardKit';
import { LINE_MAX, landing } from './line-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumberLine.css';

type EmptyLineSegment = Extract<HorizonteSegment, { type: 'math.number-line.empty.v2' }>;

const WIDTH = 560;
const PAD = 36;
const AXIS = 96;
const signed = (jump: number) => `${jump < 0 ? '−' : '+'}${Math.abs(jump)}`;

/*
 * A12: an empty number line. The learner draws jumps of the sizes the author allows, forward or back, one tap each; the jumps
 * sit in the order they were made, not to scale. The answer is the signed list of jumps; Core holds the target.
 * There is no drag, so no handle: every jump is a 64 px button.
 */
function EmptyLine({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: EmptyLineSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const { start, sizes, max } = segment.payload;
  const [jumps, setJumps] = useState<number[]>([]);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const at = landing(start, jumps);
  const ordered = [...sizes].sort((a, b) => a - b);
  const x = (index: number) => PAD + (index * (WIDTH - PAD * 2)) / max;
  const points = jumps.reduce<number[]>((list, jump) => [...list, list[list.length - 1]! + jump], [start]);

  const change = (next: number[]) => { grading.reset(); setJumps(next); };
  const canJump = (jump: number) => !locked && jumps.length < max && at + jump >= 0 && at + jump <= LINE_MAX;
  const reset = () => { grading.reset(); setJumps([]); };

  const group = (direction: 1 | -1) => <div className="lf-num-jumps" role="group" aria-labelledby={`${segment.id}-${direction > 0 ? 'fwd' : 'back'}`}>
    <span id={`${segment.id}-${direction > 0 ? 'fwd' : 'back'}`} className="lf-num-jumps-label" data-copy-role="data">{direction > 0 ? t.forward : t.backward}</span>
    {ordered.map((size) => <Button key={size} size="lg" variant={direction > 0 ? 'sky' : 'mint'} disabled={!canJump(direction * size)}
      aria-label={fillSlot(direction > 0 ? t.jumpForward : t.jumpBack, size)} onClick={() => change([...jumps, direction * size])}>{signed(direction * size)}</Button>)}
  </div>;

  return <BoardShell screen="empty-line" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={jumps.length === 0 || locked}
    controls={<>
      <TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />
      <Button size="sm" disabled={jumps.length === 0 || locked} onClick={() => change(jumps.slice(0, -1))}>{t.undo}</Button>
    </>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={jumps.length > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metLine, hint: t.hintLine }} onCheck={() => grading.check({ jumps })} />}>
    <section className="lf-learning-board lf-num-board" aria-label={t.emptyLine}>
      <div className="lf-num-scroll">
        <svg className="lf-line" viewBox={`0 0 ${WIDTH} 150`} role="img" aria-label={t.emptyLine} focusable="false">
          <line className="lf-line-axis" x1={PAD / 2} x2={WIDTH - PAD / 2} y1={AXIS} y2={AXIS} />
          {jumps.map((jump, index) => {
            const from = x(index);
            const to = x(index + 1);
            const mid = (from + to) / 2;
            return <g key={index} className={`lf-line-jump lf-line-jump--${jump > 0 ? 'sky' : 'mint'}`}>
              <path className="lf-line-arc" pathLength={1} d={`M ${from} ${AXIS} Q ${mid} ${AXIS - 64} ${to} ${AXIS}`} />
              <text className="lf-line-sign" x={mid} y={AXIS - 40} textAnchor="middle" data-copy-role="data">{signed(jump)}</text>
            </g>;
          })}
          {points.map((point, index) => <g key={index} className="lf-line-point">
            <line className="lf-line-tick" x1={x(index)} x2={x(index)} y1={AXIS - 10} y2={AXIS + 10} />
            <text className="lf-line-number" x={x(index)} y={AXIS + 34} textAnchor="middle" data-copy-role="data">{point}</text>
          </g>)}
        </svg>
      </div>
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.start}: {start}. {jumps.length > 0 ? `${jumps.map(signed).join(', ')}. ` : ''}{t.nowAt}: {at}. {t.jumpsLeft}: {max - jumps.length}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.lineCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colStep}</th><th scope="col" data-copy-role="data">{t.colJump}</th><th scope="col" data-copy-role="data">{t.colLands}</th></tr></thead>
        <tbody>
          <tr><th scope="row" data-copy-role="data">{t.start}</th><td data-copy-role="data" /><td data-copy-role="data">{start}</td></tr>
          {jumps.map((jump, index) => <tr key={index}><th scope="row" data-copy-role="data">{index + 1}</th><td data-copy-role="data">{signed(jump)}</td><td data-copy-role="data">{points[index + 1]}</td></tr>)}
        </tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.emptyLine}>
      {group(1)}
      {group(-1)}
    </section>
  </BoardShell>;
}

export default function EmptyLineBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.number-line.empty.v2' ? <EmptyLine segment={segment} {...rest} /> : null;
}
