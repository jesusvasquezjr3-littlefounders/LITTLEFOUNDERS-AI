import { useState } from 'react';
import { Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PLANE1_COPY } from './copy';
import { PlaneBoard, PlaneFigure, fmt, niceCeil, slots, tickEvery, usePlaneGrade, wholeOn } from './shared';

type BreakEvenSegment = Extract<HorizonteSegment, { type: 'fin.break-even.v2' }>;

/*
 * N08, N09: revenue and cost against the units sold. The learner moves the units (a handle locked to its row, or a
 * slider) to the point where the two lines meet. The answer is the whole number of units; Core holds it.
 */
function BreakEven({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: BreakEvenSegment }) {
  const t = copyText(PLANE1_COPY, document.locale);
  const { locale } = document;
  const { fixed, price, unit, maxUnits, start } = segment.payload;
  const first = Math.min(start, maxUnits);
  const [units, setUnits] = useState(first);
  const { grading, locked, change } = usePlaneGrade(segment.id, onGrade);
  const revenue = price * units;
  const cost = fixed + unit * units;
  const top = niceCeil(Math.max(price * maxUnits, fixed + unit * maxUnits));

  return <PlaneBoard screen="break-even" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    changed={units !== first} named={{ met: t.metBreak, hint: t.hintBreak }} label={t.breakName}
    onReset={() => change(() => setUnits(first))} onCheck={() => grading.check({ units })}
    figure={<PlaneFigure locale={locale} label={t.breakName} summary={t.breakSummary} domain={{ xMin: 0, xMax: maxUnits, yMin: 0, yMax: top }}
      xLabel={t.axisUnitsSold} yLabel={t.axisMoney}
      layers={{
        curves: [
          { id: 'revenue', fn: (x) => price * x, label: t.revenue, series: 1 },
          { id: 'cost', fn: (x) => fixed + unit * x, label: t.cost, series: 2 },
        ],
        points: [{ id: 'cost-here', x: units, y: cost, label: t.costHere, series: 2 }],
        handles: [{ id: 'units', x: units, y: revenue, label: t.handleUnitsSold, caption: String(units), axis: 'x', series: 1, bounds: { xMin: 0, xMax: maxUnits }, disabled: locked }],
      }}
      snap={wholeOn('x')} tickStep={{ x: tickEvery(maxUnits), y: 0 }} placeOnTap
      onHandleChange={(_, point) => change(() => setUnits(Math.min(maxUnits, Math.max(0, point.x))))} />}
    status={slots(t.statusBreak, { n: fmt(locale, units), r: fmt(locale, revenue), c: fmt(locale, cost), p: fmt(locale, revenue - cost) })}
    aside={<p className="lf-p1-facts" data-copy-role="data">{slots(t.factsBreak, { f: fmt(locale, fixed), p: fmt(locale, price), u: fmt(locale, unit) })}</p>}
    controls={<Slider label={t.sliderUnitsSold} valueText={fmt(locale, units)} min={0} max={maxUnits} step={1} value={units}
      onValueChange={(next) => change(() => setUnits(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />} />;
}

export default function BreakEvenBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'fin.break-even.v2' ? <BreakEven segment={segment} {...rest} /> : null;
}
