import { useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { STATS1_COPY } from './copy';
import { normalBetween, normalPdf } from './distributions.generated';
import { AxisTicks, Chart, PAD, TableToggle, VIEW_W, fmt, linePath, tickValues } from './shared';
import '../horizonte.css';
import './stats1.css';

type NormalSegment = Extract<HorizonteSegment, { type: 'stats.normal.v2' }>;

const TOP = 36;
const PLOT_H = 200;
const SAMPLES = 160;

/*
 * H22: a normal curve with a mean and a spread, and a band of values the curve must fit by the 68-95-99.7 rule. The two
 * sliders move the mean and the spread; the edges of the curve (mean plus and minus the band's number of spreads) are drawn
 * dashed next to the band's own solid edges. The picture is scaled from the axis alone, so it never shows the answer.
 * The answer is the whole mean and spread; Core holds the pair.
 */
function Normal({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: NormalSegment }) {
  const t = copyText(STATS1_COPY, document.locale);
  const { locale } = document;
  const { axis, start, sdMax, band } = segment.payload;
  const [mean, setMean] = useState(start.mean);
  const [sd, setSd] = useState(start.sd);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = mean !== start.mean || sd !== start.sd;
  const change = (next: () => void) => { grading.reset(); next(); };

  const span = axis.max - axis.min;
  const lower = mean - band.rule * sd;
  const upper = mean + band.rule * sd;
  const share = normalBetween(band.low, band.high, mean, sd) * 100;
  const x = (value: number) => PAD + ((value - axis.min) / span) * (VIEW_W - 2 * PAD);
  const base = TOP + PLOT_H;
  const ceiling = 1.1 * normalPdf(0, 0, Math.max(2, span / 16));
  const y = (value: number) => Math.max(-400, base - (normalPdf(value, mean, sd) / ceiling) * PLOT_H);
  const curve = Array.from({ length: SAMPLES + 1 }, (_, index) => axis.min + (span * index) / SAMPLES);
  const inside = Array.from({ length: 61 }, (_, index) => band.low + ((band.high - band.low) * index) / 60);
  const edges = [lower, upper].filter((edge) => edge >= axis.min && edge <= axis.max);

  return <BoardShell screen="normal-curve" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(() => { setMean(start.mean); setSd(start.sd); })} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metNormal, hint: t.hintNormal }} onCheck={() => grading.check({ mean, sd })} />}>
    <section className="lf-learning-board lf-stats" aria-label={t.curveName}>
      <Chart label={t.curveName} height={base + 44}>
        <rect className="lf-stats-band" data-board-decoration="" x={x(band.low)} y={TOP - 8} width={x(band.high) - x(band.low)} height={PLOT_H + 8} />
        <path className="lf-stats-area" d={`M${x(band.low).toFixed(1)} ${base} ${linePath(inside.map((value) => [x(value), y(value)] as const)).replace('M', 'L')} L${x(band.high).toFixed(1)} ${base} Z`} />
        <path className="lf-stats-curve" d={linePath(curve.map((value) => [x(value), y(value)] as const))} />
        {[band.low, band.high].map((edge) => <g key={edge}>
          <line className="lf-stats-edge" x1={x(edge)} x2={x(edge)} y1={TOP - 8} y2={base} />
          <text className="lf-stats-edge-label" x={x(edge)} y={TOP - 14} textAnchor="middle">{edge}</text>
        </g>)}
        {edges.map((edge, index) => <line key={index} className="lf-stats-reach" x1={x(edge)} x2={x(edge)} y1={TOP - 8} y2={base} />)}
        <AxisTicks ticks={tickValues(axis.min, axis.max, 9)} x={x} y={base} />
      </Chart>
      <p className="lf-stats-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.lowerEdge}: {fmt(locale, lower)}. {t.upperEdge}: {fmt(locale, upper)}. {t.inside}: {fmt(locale, share, 1)}%
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaptionCurve}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colMeasure}</th><th scope="col" data-copy-role="data">{t.colValue}</th></tr></thead>
        <tbody>
          <tr><th scope="row" data-copy-role="data">{t.mean}</th><td data-copy-role="data">{mean}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.sdLabel}</th><td data-copy-role="data">{sd}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.lowerEdge}</th><td data-copy-role="data">{fmt(locale, lower)}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.upperEdge}</th><td data-copy-role="data">{fmt(locale, upper)}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.inside}</th><td data-copy-role="data">{fmt(locale, share, 1)}%</td></tr>
        </tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.curveName}>
      <Slider label={t.mean} valueText={String(mean)} min={axis.min} max={axis.max} step={1} value={mean} onValueChange={(next) => change(() => setMean(next))}
        stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
      <Slider label={t.sdLabel} valueText={String(sd)} min={1} max={sdMax} step={1} value={sd} onValueChange={(next) => change(() => setSd(next))}
        stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function NormalBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'stats.normal.v2' ? <Normal segment={segment} {...rest} /> : null;
}
