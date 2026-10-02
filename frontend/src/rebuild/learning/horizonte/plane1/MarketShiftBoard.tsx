import { useState } from 'react';
import { SegmentedControl, Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PLANE1_COPY } from './copy';
import { clearingPrice, demandAt, shiftedMarket, supplyAt, type Choice } from './market.generated';
import { PlaneBoard, PlaneFigure, fmt, slots, usePlaneGrade, wholeOn } from './shared';

type MarketSegment = Extract<HorizonteSegment, { type: 'econ.market-shift.v2' }>;

const clampTo = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/*
 * N09, N13: a market and one shift of a curve. The learner says whether the price goes up or down and then puts the
 * price marker where the curves meet after the shift. The answer is the direction and the whole price; Core holds it.
 */
function MarketShift({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: MarketSegment }) {
  const t = copyText(PLANE1_COPY, document.locale);
  const { locale } = document;
  const { pMax, qMax, demand, supply, shift, start } = segment.payload;
  const first = Math.min(start, pMax);
  const [price, setPrice] = useState(first);
  const [choice, setChoice] = useState<Choice>('unset');
  const { grading, locked, change } = usePlaneGrade(segment.id, onGrade);
  const before = { demand, supply };
  const after = shiftedMarket(before, shift);
  const shifted = shift.curve === 'demand';
  const wanted = demandAt(after, price);
  const offered = supplyAt(after, price);
  const gap = Math.abs(wanted - offered);
  const state = wanted > offered ? slots(t.shortage, { n: fmt(locale, gap) }) : wanted < offered ? slots(t.surplus, { n: fmt(locale, gap) }) : t.balanced;
  const was = clearingPrice(before);
  const sentence = shift.curve === 'demand'
    ? (shift.by > 0 ? t.shiftDemandUp : t.shiftDemandDown)
    : (shift.by > 0 ? t.shiftSupplyUp : t.shiftSupplyDown);

  return <PlaneBoard screen="market-shift" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    changed={choice !== 'unset' || price !== first} canCheck={choice !== 'unset'} named={{ met: t.metMarket, hint: t.hintMarket }} label={t.marketName}
    onReset={() => change(() => { setPrice(first); setChoice('unset'); })}
    onCheck={() => { if (choice !== 'unset') grading.check({ direction: choice, price }); }}
    figure={<PlaneFigure locale={locale} label={t.marketName} summary={t.marketSummary} domain={{ xMin: 0, xMax: qMax, yMin: 0, yMax: pMax }}
      xLabel={t.quantity} yLabel={t.price}
      layers={{
        curves: [
          { id: 'demand', fn: (q) => (demand.a - q) / demand.b, label: t.demand, series: 1 },
          { id: 'supply', fn: (q) => (q - supply.c) / supply.d, label: t.supply, series: 2 },
          shifted
            ? { id: 'demand-after', fn: (q) => (after.demand.a - q) / after.demand.b, label: t.demandAfter, series: 3 as const }
            : { id: 'supply-after', fn: (q) => (q - after.supply.c) / after.supply.d, label: t.supplyAfter, series: 3 as const },
        ],
        points: [{ id: 'supply-here', x: clampTo(offered, 0, qMax), y: price, label: t.supplyHere, series: 2 }],
        handles: [{ id: 'price', x: clampTo(wanted, 0, qMax), y: price, label: t.handlePrice, caption: String(price), axis: 'y', series: 1, bounds: { yMin: 0, yMax: pMax }, disabled: locked }],
      }}
      snap={wholeOn('y')} tickStep={{ x: 0, y: pMax <= 12 ? 1 : 0 }} placeOnTap
      onHandleChange={(_, point) => change(() => setPrice(clampTo(point.y, 0, pMax)))} />}
    status={slots(t.statusMarket, { p: fmt(locale, price), d: fmt(locale, wanted), s: fmt(locale, offered), state })}
    aside={<div className="lf-p1-facts">
      <p data-copy-role="data">{slots(sentence, { n: Math.abs(shift.by) })}</p>
      {was === null ? null : <p data-copy-role="data">{slots(t.beforeMarket, { p: fmt(locale, was), q: fmt(locale, demandAt(before, was)) })}</p>}
    </div>}
    controls={<>
      <SegmentedControl legend={t.choiceLegend} name={`${segment.id}-direction`} value={choice === 'unset' ? null : choice} disabled={locked}
        options={[{ value: 'up' as const, label: t.goesUp }, { value: 'down' as const, label: t.goesDown }]}
        onValueChange={(next) => change(() => setChoice(next))} />
      <Slider label={t.sliderPrice} valueText={fmt(locale, price)} min={0} max={pMax} step={1} value={price}
        onValueChange={(next) => change(() => setPrice(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </>} />;
}

export default function MarketShiftBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'econ.market-shift.v2' ? <MarketShift segment={segment} {...rest} /> : null;
}
