import { useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { STATS1_COPY } from './copy';
import { meanPmf, populationMoments, populationPmf } from './distributions.generated';
import { AxisTicks, Chart, PAD, TableToggle, VIEW_W, fmt, slots } from './shared';
import '../horizonte.css';
import './stats1.css';

type CltSegment = Extract<HorizonteSegment, { type: 'stats.clt.v2' }>;

const TOP = 14;
const PLOT_H = 90;

type Bar = { value: number; p: number };

function Panel({ label, bars, step, values, mean, spread }: { label: string; bars: readonly Bar[]; step: number; values: number; mean: number; spread: number }) {
  const span = VIEW_W - 2 * PAD;
  const x = (value: number) => PAD + ((value - 0.5) / values) * span;
  const base = TOP + PLOT_H;
  const tallest = Math.max(...bars.map((bar) => bar.p));
  const width = Math.max(1, (span / values) * step * 0.8);
  return <div className="lf-stats-panel">
    <h3 data-copy-role="data">{label}</h3>
    <Chart label={label} height={base + 44}>
      <rect className="lf-stats-band" data-board-decoration="" x={x(mean - spread)} y={TOP - 6} width={x(mean + spread) - x(mean - spread)} height={PLOT_H + 6} />
      {bars.map((bar) => <rect key={bar.value} className="lf-stats-bar" x={x(bar.value) - width / 2} y={base - (bar.p / tallest) * PLOT_H} width={width} height={(bar.p / tallest) * PLOT_H} />)}
      {[mean - spread, mean + spread].map((edge, index) => <line key={index} className="lf-stats-edge" x1={x(edge)} x2={x(edge)} y1={TOP - 6} y2={base} />)}
      <line className="lf-stats-marker" x1={x(mean)} x2={x(mean)} y1={TOP - 6} y2={base} />
      <AxisTicks ticks={Array.from({ length: values }, (_, index) => index + 1)} x={x} y={base} />
    </Chart>
  </div>;
}

/*
 * H25: a population that is not a bell (weights on the values 1, 2, 3 and so on), and the spread of the mean of n draws.
 * The learner sets the sample size n and watches the distribution of the mean narrow while its centre stays put. The
 * distribution is the exact one, built by convolution, so the picture is the same every time and nothing is random.
 * The answer is the sample size; Core holds the n that makes the spread the stated number of times smaller.
 */
function Clt({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: CltSegment }) {
  const t = copyText(STATS1_COPY, document.locale);
  const { locale } = document;
  const { weights, nMax, start, goal } = segment.payload;
  const [n, setN] = useState(start.n);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = n !== start.n;
  const change = (next: number) => { grading.reset(); setN(next); };

  const { mean, sd } = populationMoments(weights);
  const spread = sd / Math.sqrt(n);
  const shrink = Math.sqrt(n);
  const one = populationPmf(weights).map((p, index) => ({ value: index + 1, p }));
  const means = meanPmf(weights, n).map((point) => ({ value: point.mean, p: point.p }));

  return <BoardShell screen="sampling-mean" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(start.n)} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metClt, hint: t.hintClt }} onCheck={() => grading.check({ n })} />}>
    <section className="lf-learning-board lf-stats" aria-label={t.meanOfDraws}>
      <Panel label={t.oneDraw} bars={one} step={1} values={weights.length} mean={mean} spread={sd} />
      <Panel label={t.meanOfDraws} bars={means} step={1 / n} values={weights.length} mean={mean} spread={spread} />
      <p className="lf-stats-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.spreadOne}: {fmt(locale, sd)}. {t.spreadMean}: {fmt(locale, spread)}. {t.timesSmaller}: {fmt(locale, shrink)}. {slots(t.goalShrink, { n: goal.shrink })}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaptionClt}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colMeasure}</th><th scope="col" data-copy-role="data">{t.oneDraw}</th><th scope="col" data-copy-role="data">{t.meanOfDraws}</th></tr></thead>
        <tbody>
          <tr><th scope="row" data-copy-role="data">{t.mean}</th><td data-copy-role="data">{fmt(locale, mean)}</td><td data-copy-role="data">{fmt(locale, mean)}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.spread}</th><td data-copy-role="data">{fmt(locale, sd)}</td><td data-copy-role="data">{fmt(locale, spread)}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.timesSmaller}</th><td data-copy-role="data">1</td><td data-copy-role="data">{fmt(locale, shrink)}</td></tr>
        </tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.sampleLabel}>
      <Slider label={t.sampleLabel} valueText={String(n)} min={1} max={nMax} step={1} value={n} onValueChange={change}
        stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function CltBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'stats.clt.v2' ? <Clt segment={segment} {...rest} /> : null;
}
