import { useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { STATS1_COPY } from './copy';
import { BINOMIAL_PCT_MAX, BINOMIAL_PCT_MIN, BINOMIAL_PCT_STEP, binomialMeanHundredths, binomialPmf, binomialVarianceTenThousandths } from './distributions.generated';
import { AxisTicks, Chart, PAD, TableToggle, VIEW_W, fmt, tickValues } from './shared';
import '../horizonte.css';
import './stats1.css';

type BinomialSegment = Extract<HorizonteSegment, { type: 'stats.binomial.v2' }>;

const TOP = 16;
const PLOT_H = 180;

/*
 * H23: the bars of a binomial for a count n and a chance of success. The learner sets both until the mean (n times the
 * chance) and the variance (n times the chance times the rest) match the goal in the prompt. The bars are scaled to their
 * own tallest bar, so the picture never shows the answer. The answer is n and the whole percent; Core holds the pair.
 */
function Binomial({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: BinomialSegment }) {
  const t = copyText(STATS1_COPY, document.locale);
  const { locale } = document;
  const { nMax, start } = segment.payload;
  const [n, setN] = useState(start.n);
  const [pct, setPct] = useState(start.pct);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = n !== start.n || pct !== start.pct;
  const change = (next: () => void) => { grading.reset(); next(); };

  const pmf = binomialPmf(n, pct);
  const tallest = Math.max(...pmf);
  const mean = binomialMeanHundredths({ n, pct }) / 100;
  const variance = binomialVarianceTenThousandths({ n, pct }) / 10000;
  const bw = (VIEW_W - 2 * PAD) / (n + 1);
  const gap = bw > 8 ? 3 : 1;
  const base = TOP + PLOT_H;
  const x = (count: number) => PAD + (count + 0.5) * bw;

  return <BoardShell screen="binomial-bars" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(() => { setN(start.n); setPct(start.pct); })} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metBinomial, hint: t.hintBinomial }} onCheck={() => grading.check({ n, pct })} />}>
    <section className="lf-learning-board lf-stats" aria-label={t.barsName}>
      <Chart label={t.barsName} height={base + 44}>
        {pmf.map((p, count) => <rect key={count} className="lf-stats-bar" x={PAD + count * bw + gap / 2} y={base - (p / tallest) * PLOT_H} width={bw - gap} height={(p / tallest) * PLOT_H} />)}
        <line className="lf-stats-marker" x1={x(mean)} x2={x(mean)} y1={TOP - 8} y2={base} />
        <AxisTicks ticks={tickValues(0, n, 11)} x={x} y={base} />
      </Chart>
      <p className="lf-stats-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.mean}: {fmt(locale, mean)}. {t.variance}: {fmt(locale, variance, 4)}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaptionBinomial}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colSuccesses}</th><th scope="col" data-copy-role="data">{t.colChance}</th></tr></thead>
        <tbody>{pmf.map((p, count) => <tr key={count}><th scope="row" data-copy-role="data">{count}</th><td data-copy-role="data">{fmt(locale, p * 100, 1)}%</td></tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.barsName}>
      <Slider label={t.nLabel} valueText={String(n)} min={1} max={nMax} step={1} value={n} onValueChange={(next) => change(() => setN(next))}
        stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
      <Slider label={t.pctLabel} valueText={`${pct}%`} min={BINOMIAL_PCT_MIN} max={BINOMIAL_PCT_MAX} step={BINOMIAL_PCT_STEP} value={pct} onValueChange={(next) => change(() => setPct(next))}
        stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function BinomialBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'stats.binomial.v2' ? <Binomial segment={segment} {...rest} /> : null;
}
