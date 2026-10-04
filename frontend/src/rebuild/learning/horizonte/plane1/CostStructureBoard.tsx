import { useState } from 'react';
import { Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PLANE1_COPY } from './copy';
import { PlaneBoard, PlaneFigure, fmt, niceCeil, slots, tickEvery, usePlaneGrade, wholeOn } from './shared';

type CostSegment = Extract<HorizonteSegment, { type: 'fin.cost-structure.v2' }>;

/*
 * N28: a fixed cost and an extra cost per unit make an average cost per unit that falls as the units grow. The learner
 * moves the units (a handle locked to its row, or a slider) to where the average meets the goal. The answer is the
 * whole number of units; Core holds it.
 */
function CostStructure({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: CostSegment }) {
  const t = copyText(PLANE1_COPY, document.locale);
  const { locale } = document;
  const { fixed, variable, maxUnits, goal, start } = segment.payload;
  const first = Math.min(Math.max(start, 1), maxUnits);
  const [units, setUnits] = useState(first);
  const { grading, locked, change } = usePlaneGrade(segment.id, onGrade);
  const average = (count: number) => fixed / count + variable;
  const top = niceCeil(Math.max(goal.average * 2, variable * 1.5));
  const here = average(units);

  return <PlaneBoard screen="cost-structure" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    changed={units !== first} named={{ met: t.metCost, hint: t.hintCost }} label={t.costName}
    onReset={() => change(() => setUnits(first))} onCheck={() => grading.check({ units })}
    figure={<PlaneFigure locale={locale} label={t.costName} summary={t.costSummary} domain={{ xMin: 0, xMax: maxUnits, yMin: 0, yMax: top }}
      xLabel={t.axisUnitsMade} yLabel={t.axisCostPer}
      layers={{
        curves: [{ id: 'average', fn: average, from: 1, label: t.averageCost, series: 1 }],
        polylines: [
          { id: 'goal', points: [{ x: 0, y: goal.average }, { x: maxUnits, y: goal.average }], label: t.goalLine, series: 2 },
          { id: 'floor', points: [{ x: 0, y: variable }, { x: maxUnits, y: variable }], label: t.extraCost, series: 3 },
        ],
        handles: [{ id: 'units', x: units, y: Math.min(here, top), label: t.handleUnitsMade, caption: String(units), axis: 'x', series: 1, bounds: { xMin: 1, xMax: maxUnits }, disabled: locked }],
      }}
      snap={wholeOn('x')} tickStep={{ x: tickEvery(maxUnits), y: 0 }} placeOnTap
      onHandleChange={(_, point) => change(() => setUnits(Math.min(maxUnits, Math.max(1, point.x))))} />}
    status={slots(t.statusCost, { n: fmt(locale, units), t: fmt(locale, fixed + variable * units), a: fmt(locale, here), g: fmt(locale, goal.average) })}
    aside={<p className="lf-p1-facts" data-copy-role="data">{slots(t.factsCost, { f: fmt(locale, fixed), v: fmt(locale, variable) })}</p>}
    controls={<Slider label={t.sliderUnitsMade} valueText={fmt(locale, units)} min={1} max={maxUnits} step={1} value={units}
      onValueChange={(next) => change(() => setUnits(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />} />;
}

export default function CostStructureBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'fin.cost-structure.v2' ? <CostStructure segment={segment} {...rest} /> : null;
}
