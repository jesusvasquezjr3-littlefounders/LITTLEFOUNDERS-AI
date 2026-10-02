import { useState } from 'react';
import { Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PLANE1_COPY } from './copy';
import { Fraction, PlaneBoard, PlaneFigure, fmt, tickEvery, usePlaneGrade, wholeOn } from './shared';

type SlopeSegment = Extract<HorizonteSegment, { type: 'alg.slope-triangle.v2' }>;

/*
 * D15: a rising line and the run of a slope triangle. The learner sets the rise of the triangle (the top corner, a
 * handle locked to its column) until the slanted side lies on the line. The answer is the rise; Core holds it.
 */
function SlopeTriangle({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: SlopeSegment }) {
  const t = copyText(PLANE1_COPY, document.locale);
  const { locale } = document;
  const { grid, line, run, start } = segment.payload;
  const { from, to } = line;
  const [rise, setRise] = useState(start);
  const { grading, locked, change } = usePlaneGrade(segment.id, onGrade);
  const room = grid.yMax - from.y;
  const corner = { x: from.x + run, y: from.y + rise };
  const lineAt = (x: number) => from.y + ((to.y - from.y) / (to.x - from.x)) * (x - from.x);

  return <PlaneBoard screen="slope-triangle" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    changed={rise !== start} named={{ met: t.metSlope, hint: t.hintSlope }} label={t.slopeName}
    onReset={() => change(() => setRise(start))} onCheck={() => grading.check({ rise })}
    figure={<PlaneFigure locale={locale} label={t.slopeName} summary={t.slopeSummary} domain={{ xMin: 0, xMax: grid.xMax, yMin: grid.yMin, yMax: grid.yMax }}
      layers={{
        curves: [{ id: 'line', fn: lineAt, label: t.lineName, series: 1 }],
        regions: [{ id: 'triangle', points: [{ x: from.x, y: from.y }, { x: corner.x, y: from.y }, corner], label: t.triangleName, series: 2 }],
        polylines: [{ id: 'edge', points: [{ x: from.x, y: from.y }, corner], label: t.edgeName, series: 3 }],
        handles: [{ id: 'rise', x: corner.x, y: corner.y, label: t.handleTop, caption: String(rise), axis: 'y', bounds: { yMin: from.y, yMax: grid.yMax }, disabled: locked }],
      }}
      snap={wholeOn('y')} tickStep={{ x: tickEvery(grid.xMax), y: tickEvery(grid.yMax - grid.yMin) }} placeOnTap
      onHandleChange={(_, point) => change(() => setRise(Math.min(room, Math.max(0, point.y - from.y))))} />}
    status={<>{t.run}: {run}. {t.rise}: {rise}. {t.slope}: <Fraction n={rise} d={run} over={t.over} /> = {fmt(locale, rise / run)}</>}
    controls={<Slider label={t.sliderRise} valueText={String(rise)} min={0} max={room} step={1} value={Math.min(rise, room)}
      onValueChange={(next) => change(() => setRise(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />} />;
}

export default function SlopeTriangleBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'alg.slope-triangle.v2' ? <SlopeTriangle segment={segment} {...rest} /> : null;
}
