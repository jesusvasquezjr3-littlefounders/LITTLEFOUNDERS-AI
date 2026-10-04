import { useState } from 'react';
import { Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PLANE1_COPY } from './copy';
import { Fraction, PlaneBoard, PlaneFigure, fmt, slots, usePlaneGrade, wholeOn } from './shared';

type ElasticSegment = Extract<HorizonteSegment, { type: 'econ.elasticity.v2' }>;

/*
 * N13: a demand line and a goal elasticity. The learner moves the price marker along the demand line until the elasticity
 * (the price over the quantity, times the slope) reaches the goal. The answer is the whole price; Core holds it.
 */
function Elasticity({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: ElasticSegment }) {
  const t = copyText(PLANE1_COPY, document.locale);
  const { locale } = document;
  const { pMax, demand, goal, start } = segment.payload;
  const first = Math.min(Math.max(start, 1), pMax);
  const [price, setPrice] = useState(first);
  const { grading, locked, change } = usePlaneGrade(segment.id, onGrade);
  const quantity = demand.a - demand.b * price;
  const spend = demand.b * price;
  const elasticity = quantity > 0 ? spend / quantity : 0;
  const kind = spend > quantity ? t.kindElastic : spend === quantity ? t.kindUnit : t.kindInelastic;

  return <PlaneBoard screen="elasticity" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    changed={price !== first} named={{ met: t.metElastic, hint: t.hintElastic }} label={t.elasticName}
    onReset={() => change(() => setPrice(first))} onCheck={() => grading.check({ price })}
    figure={<PlaneFigure locale={locale} label={t.elasticName} summary={t.elasticSummary} domain={{ xMin: 0, xMax: demand.a, yMin: 0, yMax: pMax }}
      xLabel={t.quantity} yLabel={t.price}
      layers={{
        curves: [{ id: 'demand', fn: (q) => (demand.a - q) / demand.b, label: t.demand, series: 1 }],
        handles: [{ id: 'price', x: quantity, y: price, label: t.handlePrice, caption: String(price), axis: 'y', series: 1, bounds: { yMin: 1, yMax: pMax }, disabled: locked }],
      }}
      snap={wholeOn('y')} tickStep={{ x: 0, y: pMax <= 12 ? 1 : 0 }} placeOnTap
      onHandleChange={(_, point) => change(() => setPrice(Math.min(pMax, Math.max(1, point.y))))} />}
    status={slots(t.statusElastic, { p: fmt(locale, price), q: fmt(locale, quantity), e: fmt(locale, elasticity), kind })}
    aside={<p className="lf-p1-facts" data-copy-role="data">{t.goalElastic}: {goal.den === 1 ? goal.num : <Fraction n={goal.num} d={goal.den} over={t.over} />}</p>}
    controls={<Slider label={t.sliderPrice} valueText={fmt(locale, price)} min={1} max={pMax} step={1} value={price}
      onValueChange={(next) => change(() => setPrice(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />} />;
}

export default function ElasticityBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'econ.elasticity.v2' ? <Elasticity segment={segment} {...rest} /> : null;
}
