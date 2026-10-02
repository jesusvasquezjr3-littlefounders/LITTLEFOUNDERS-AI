import { useState } from 'react';
import { Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PLANE1_COPY } from './copy';
import { PlaneBoard, PlaneFigure, ValueTable, fmt, slots, tickEvery, usePlaneGrade, wholeOn } from './shared';

type RateSegment = Extract<HorizonteSegment, { type: 'alg.rate-of-change.v2' }>;

/*
 * D16: a value that starts at a point and grows by the same amount each step. The learner puts the graph point at the
 * asked step (a handle locked to its column) at the value that keeps the rate. The table lists the steps beside the
 * graph. The answer is the value at that step; Core holds it.
 */
function RateOfChange({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: RateSegment }) {
  const t = copyText(PLANE1_COPY, document.locale);
  const { locale } = document;
  const { grid, origin, rate, at, start } = segment.payload;
  const [value, setValue] = useState(start);
  const { grading, locked, change } = usePlaneGrade(segment.id, onGrade);
  const next = origin.x + 1;
  const showNext = next < at;
  const yours = { x: at, y: value };
  const perStep = (value - origin.y) / (at - origin.x);

  return <PlaneBoard screen="rate-table-graph" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    changed={value !== start} named={{ met: t.metRate, hint: t.hintRate }} label={t.rateName}
    onReset={() => change(() => setValue(start))} onCheck={() => grading.check({ y: value })}
    figure={<PlaneFigure locale={locale} label={t.rateName} summary={t.rateSummary} domain={{ xMin: 0, xMax: grid.xMax, yMin: grid.yMin, yMax: grid.yMax }}
      xLabel={t.axisStep} yLabel={t.axisValue}
      layers={{
        points: [
          { id: 'origin', x: origin.x, y: origin.y, label: slots(t.stepN, { n: origin.x }), series: 1 },
          ...(showNext ? [{ id: 'next', x: next, y: origin.y + rate, label: slots(t.stepN, { n: next }), series: 1 as const }] : []),
        ],
        polylines: [{ id: 'yours', points: [{ x: origin.x, y: origin.y }, yours], label: t.yourLine, series: 2 }],
        handles: [{ id: 'value', x: at, y: value, label: slots(t.handleGraphAt, { n: at }), caption: String(value), axis: 'y', series: 1, disabled: locked }],
      }}
      snap={wholeOn('y')} tickStep={{ x: tickEvery(grid.xMax), y: tickEvery(grid.yMax - grid.yMin) }} placeOnTap
      onHandleChange={(_, point) => change(() => setValue(point.y))} />}
    status={slots(t.statusRate, { r: fmt(locale, rate), n: at, v: fmt(locale, value), c: fmt(locale, perStep) })}
    aside={<ValueTable caption={t.tableSteps} columns={[t.colStep, t.colValue]} rows={[
      [fmt(locale, origin.x), fmt(locale, origin.y)],
      ...(showNext ? [[fmt(locale, next), fmt(locale, origin.y + rate)]] : []),
      [fmt(locale, at), fmt(locale, value)],
    ]} />}
    controls={<Slider label={slots(t.sliderValueAt, { n: at })} valueText={fmt(locale, value)} min={grid.yMin} max={grid.yMax} step={1} value={value}
      onValueChange={(nextValue) => change(() => setValue(nextValue))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />} />;
}

export default function RateOfChangeBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'alg.rate-of-change.v2' ? <RateOfChange segment={segment} {...rest} /> : null;
}
