import { useState } from 'react';
import { Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { SLOPE_LIMIT } from './model.generated';
import { PLANE1_COPY } from './copy';
import { PlaneBoard, PlaneFigure, Spoken, ValueTable, equation, fmt, slots, tickEvery, usePlaneGrade, wholeOn } from './shared';

type LinkedSegment = Extract<HorizonteSegment, { type: 'alg.linked-views.v2' }>;

const clampTo = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/*
 * D18: a table, a graph and an equation of one line. Two table points are given; the learner edits the slope and the
 * intercept (two handles, or two sliders) until the line passes through both. The answer is the pair m and b; Core
 * holds it.
 */
function LinkedViews({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: LinkedSegment }) {
  const t = copyText(PLANE1_COPY, document.locale);
  const { locale } = document;
  const { grid, given, start } = segment.payload;
  const [m, setM] = useState(start.m);
  const [b, setB] = useState(start.b);
  const { grading, locked, change } = usePlaneGrade(segment.id, onGrade);
  const eq = equation({ sayEquals: t.sayEquals, sayPlus: t.sayPlus, sayMinus: t.sayMinus }, m, b);
  const slopeAt = clampTo(b + m, grid.yMin, grid.yMax);

  return <PlaneBoard screen="linked-views" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    changed={m !== start.m || b !== start.b} named={{ met: t.metLinked, hint: t.hintLinked }} label={t.linkedName}
    onReset={() => change(() => { setM(start.m); setB(start.b); })} onCheck={() => grading.check({ m, b })}
    figure={<PlaneFigure locale={locale} label={t.linkedName} summary={t.linkedSummary} domain={{ xMin: 0, xMax: grid.xMax, yMin: grid.yMin, yMax: grid.yMax }}
      layers={{
        curves: [{ id: 'line', fn: (x) => m * x + b, label: t.yourLine, series: 1 }],
        points: given.map((point, index) => ({ id: `given-${index}`, x: point.x, y: point.y, label: slots(t.tablePoint, { n: index + 1 }), series: 2 as const })),
        handles: [
          { id: 'intercept', x: 0, y: b, label: t.handleIntercept, caption: `b ${b}`, axis: 'y', series: 1, disabled: locked },
          { id: 'slope', x: 1, y: slopeAt, label: t.handleSlope, caption: `m ${m}`, axis: 'y', series: 3, disabled: locked,
            bounds: { yMin: Math.max(grid.yMin, b - SLOPE_LIMIT), yMax: Math.min(grid.yMax, b + SLOPE_LIMIT) } },
        ],
      }}
      snap={wholeOn('y')} tickStep={{ x: tickEvery(grid.xMax), y: tickEvery(grid.yMax - grid.yMin) }} placeOnTap
      onHandleChange={(id, point) => change(() => {
        if (id === 'intercept') setB(point.y);
        else setM(clampTo(point.y - b, -SLOPE_LIMIT, SLOPE_LIMIT));
      })} />}
    status={<>{t.equation}: <Spoken text={eq.text} spoken={eq.spoken} />. {t.slope}: {fmt(locale, m)}. {t.intercept}: {fmt(locale, b)}</>}
    aside={<ValueTable caption={t.tableLinked} columns={[t.colX, t.colGiven, t.colLine]}
      rows={given.map((point) => [fmt(locale, point.x), fmt(locale, point.y), fmt(locale, m * point.x + b)])} />}
    controls={<>
      <Slider label={t.sliderSlope} valueText={fmt(locale, m)} min={-SLOPE_LIMIT} max={SLOPE_LIMIT} step={1} value={m}
        onValueChange={(next) => change(() => setM(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
      <Slider label={t.sliderIntercept} valueText={fmt(locale, b)} min={grid.yMin} max={grid.yMax} step={1} value={b}
        onValueChange={(next) => change(() => setB(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </>} />;
}

export default function LinkedViewsBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'alg.linked-views.v2' ? <LinkedViews segment={segment} {...rest} /> : null;
}
