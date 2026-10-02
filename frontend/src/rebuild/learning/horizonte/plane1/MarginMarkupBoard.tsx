import { useState } from 'react';
import { Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PLANE1_COPY } from './copy';
import { PlaneBoard, PlaneFigure, fmt, niceCeil, slots, tickEvery, usePlaneGrade, wholeOn } from './shared';

type MarkupSegment = Extract<HorizonteSegment, { type: 'fin.margin-markup.v2' }>;

/*
 * N10: the percent a price earns over a cost, as a markup (a share of the cost) or a margin (a share of the price).
 * The learner moves the price (a handle locked to its column, or a slider) until the curve reaches the goal percent.
 * The answer is the whole price; Core holds it.
 */
function MarginMarkup({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: MarkupSegment }) {
  const t = copyText(PLANE1_COPY, document.locale);
  const { locale } = document;
  const { cost, basis, percent, maxPrice, start } = segment.payload;
  const first = Math.min(start, maxPrice);
  const [price, setPrice] = useState(first);
  const { grading, locked, change } = usePlaneGrade(segment.id, onGrade);
  const markupAt = (value: number) => ((value - cost) / cost) * 100;
  const marginAt = (value: number) => (value > 0 ? ((value - cost) / value) * 100 : Number.NEGATIVE_INFINITY);
  const earned = basis === 'markup' ? markupAt : marginAt;
  const top = basis === 'markup' ? niceCeil(percent * 1.6) : 100;
  const word = basis === 'markup' ? t.wordMarkup : t.wordMargin;
  const show = (value: number) => fmt(locale, Number.isFinite(value) ? Math.round(value * 10) / 10 : 0, 1);

  return <PlaneBoard screen="margin-markup" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    changed={price !== first} named={{ met: t.metMarkup, hint: t.hintMarkup }} label={t.markupName}
    onReset={() => change(() => setPrice(first))} onCheck={() => grading.check({ price })}
    figure={<PlaneFigure locale={locale} label={t.markupName} summary={t.markupSummary} domain={{ xMin: 0, xMax: maxPrice, yMin: 0, yMax: top }}
      xLabel={t.price} yLabel={t.axisPercent}
      layers={{
        curves: [{ id: 'percent', fn: earned, label: word, series: 1 }],
        polylines: [{ id: 'goal', points: [{ x: 0, y: percent }, { x: maxPrice, y: percent }], label: t.goalLine, series: 2 }],
        handles: [{ id: 'price', x: price, y: Math.min(top, Math.max(0, earned(price))), label: t.handlePrice, caption: String(price), axis: 'x', series: 1, bounds: { xMin: 0, xMax: maxPrice }, disabled: locked }],
      }}
      snap={wholeOn('x')} tickStep={{ x: tickEvery(maxPrice), y: 0 }} placeOnTap
      onHandleChange={(_, point) => change(() => setPrice(Math.min(maxPrice, Math.max(0, point.x))))} />}
    status={slots(t.statusMarkup, { p: fmt(locale, price), f: fmt(locale, price - cost), mk: show(markupAt(price)), mg: show(marginAt(price)) })}
    aside={<p className="lf-p1-facts" data-copy-role="data">{slots(t.factsMarkup, { c: fmt(locale, cost), w: word, n: fmt(locale, percent) })}</p>}
    controls={<Slider label={t.sliderPrice} valueText={fmt(locale, price)} min={0} max={maxPrice} step={1} value={price}
      onValueChange={(next) => change(() => setPrice(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />} />;
}

export default function MarginMarkupBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'fin.margin-markup.v2' ? <MarginMarkup segment={segment} {...rest} /> : null;
}
