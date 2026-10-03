import { useState, type MouseEvent } from 'react';
import { Stepper } from '../../../design/fields';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { TableToggle } from './boardKit';
import { clockMinutes, clockParts, clockSetup, clockText, handAngles, minuteAtAngle } from './measure-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumShared.css';
import './Measure.css';

type ClockSegment = Extract<HorizonteSegment, { type: 'math.clock.v2' }>;

const C = 120;
const FACE = 104;
const HOUR_HAND = 56;
const MINUTE_HAND = 84;
const point = (degrees: number, length: number) => ({ x: C + length * Math.sin((degrees * Math.PI) / 180), y: C - length * Math.cos((degrees * Math.PI) / 180) });
const twoDigits = (minute: number) => String(minute).padStart(2, '0');

/*
 * A14: an analog clock. The learner sets the hour and the minutes with the steppers, or taps the face to point the
 * minute hand; the minute hand moves in the steps the author allows. The answer is the time as minutes after 12:00; Core holds it.
 */
function Clock({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: ClockSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const { start, step } = clockSetup(segment.payload)!;
  const [time, setTime] = useState(() => clockParts(start));
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const minutes = clockMinutes(time.hour, time.minute);
  const changed = minutes !== start;
  const angles = handAngles(minutes);
  const shown = clockText(minutes);
  const hourEnd = point(angles.hour, HOUR_HAND);
  const minuteEnd = point(angles.minute, MINUTE_HAND);

  const change = (next: { hour: number; minute: number }) => { grading.reset(); setTime(next); };
  const reset = () => { grading.reset(); setTime(clockParts(start)); };
  const tapFace = (event: MouseEvent<SVGCircleElement>) => {
    if (locked) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const degrees = (Math.atan2(event.clientX - (box.left + box.width / 2), (box.top + box.height / 2) - event.clientY) * 180) / Math.PI;
    change({ ...time, minute: minuteAtAngle(degrees, step) });
  };

  return <BoardShell screen="clock" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metClock, hint: t.hintClock }} onCheck={() => grading.check({ minutes })} />}>
    <section className="lf-learning-board lf-num-board" aria-label={fillSlot(t.clockFace, shown)}>
      <svg className="lf-clock" viewBox="0 0 240 240" role="img" aria-label={fillSlot(t.clockFace, shown)} focusable="false">
        <circle className="lf-clock-face" cx={C} cy={C} r={FACE} />
        {Array.from({ length: 60 }, (_, index) => {
          const hourMark = index % 5 === 0;
          const outer = point(index * 6, FACE - 4);
          const inner = point(index * 6, FACE - (hourMark ? 16 : 10));
          return <line key={index} className={`lf-clock-mark${hourMark ? ' lf-clock-mark--hour' : ''}`} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} />;
        })}
        {Array.from({ length: 12 }, (_, index) => {
          const spot = point((index + 1) * 30, FACE - 30);
          return <text key={index} className="lf-clock-number" x={spot.x} y={spot.y} textAnchor="middle" dominantBaseline="central" data-copy-role="data">{index + 1}</text>;
        })}
        <line className="lf-clock-hand lf-clock-hand--hour" x1={C} y1={C} x2={hourEnd.x} y2={hourEnd.y} />
        <line className="lf-clock-hand lf-clock-hand--minute" x1={C} y1={C} x2={minuteEnd.x} y2={minuteEnd.y} />
        <circle className="lf-clock-pin" cx={C} cy={C} r={7} />
        <circle className="lf-clock-tap" role="presentation" cx={C} cy={C} r={FACE} onClick={tapFace} />
      </svg>
      <div className="lf-clock-set">
        <Stepper label={t.hour} value={time.hour} min={1} max={12} onValueChange={(hour) => change({ ...time, hour })} labels={{ decrease: t.less, increase: t.more }} disabled={locked} />
        <Stepper label={t.minutes} valueText={twoDigits(time.minute)} min={0} max={60 - step} step={step} value={time.minute} disabled={locked}
          labels={{ decrease: t.less, increase: t.more }} onValueChange={(minute) => change({ ...time, minute })} />
      </div>
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{t.time}: {shown}</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.clockCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.hour}</th><th scope="col" data-copy-role="data">{t.minutes}</th><th scope="col" data-copy-role="data">{t.time}</th></tr></thead>
        <tbody><tr><td data-copy-role="data">{time.hour}</td><td data-copy-role="data">{twoDigits(time.minute)}</td><td data-copy-role="data">{shown}</td></tr></tbody>
      </table> : null}
    </section>
  </BoardShell>;
}

export default function ClockBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.clock.v2' ? <Clock segment={segment} {...rest} /> : null;
}
