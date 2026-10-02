import { useMemo, useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import { useAttemptSeed } from '../attemptSeed';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { SIM1_COPY } from './copy';
import { bootstrapEdges, resampleSums } from './interval.generated';
import { Chart, PAD, TableToggle, VIEW_W, fmt, runCount, slots, tickValues } from './shared';
import '../horizonte.css';
import './sim1.css';

type BootstrapSegment = Extract<HorizonteSegment, { type: 'stats.bootstrap-sim.v2' }>;

const DOT = 7;
const DATA_TOP = 14;
const HIST_TOP = 28;
const HIST_H = 130;
const MAX_BINS = 40;

/*
 * H27: a small sample, resampled with replacement. Each resample adds up to a total; the middle part of the totals gives the interval.
 * The learner runs more resamples from the authored stops and watches the two edges stop moving. The edges drawn here come from the
 * run itself; the settled edges stay in the private rubric, which Core replays against the seed to grade.
 */
function Bootstrap({ document, segment, onBack, sequence, onGrade, seed }: Omit<HorizonteBoardProps, 'segment'> & { segment: BootstrapSegment; seed: string }) {
  const t = copyText(SIM1_COPY, document.locale);
  const { locale } = document;
  const { axis, data, level, stops, minResamples } = segment.payload;
  const [index, setIndex] = useState(0);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const count = runCount(stops, index);
  const previous = index >= 2 ? (stops[index - 2] as number) : 0;
  const change = (next: () => void) => { grading.reset(); next(); };

  const sums = useMemo(() => resampleSums(seed, data, stops[stops.length - 1] as number), [seed, data, stops]);
  const edges = useMemo(() => (count === 0 ? null : bootstrapEdges(sums.slice(0, count), level)), [sums, count, level]);
  const before = useMemo(() => (previous === 0 ? null : bootstrapEdges(sums.slice(0, previous), level)), [sums, previous, level]);

  const n = data.length;
  const lo = n * axis.min;
  const hi = n * axis.max;
  const width = Math.ceil((hi - lo + 1) / MAX_BINS);
  const binCount = Math.ceil((hi - lo + 1) / width);
  const counts = useMemo(() => {
    const found = new Array<number>(binCount).fill(0);
    for (let resample = 0; resample < count; resample += 1) {
      const place = Math.floor(((sums[resample] as number) - lo) / width);
      found[place] = (found[place] as number) + 1;
    }
    return found;
  }, [sums, count, lo, width, binCount]);
  const tallest = Math.max(1, ...counts);

  const plot = VIEW_W - 2 * PAD;
  const xSum = (sum: number) => PAD + (((sum - lo + 0.5) / (binCount * width)) * plot);
  const xData = (value: number) => PAD + ((value - axis.min) / (axis.max - axis.min)) * plot;
  const stacked = useMemo(() => {
    const seen = new Map<number, number>();
    return data.map((value) => { const layer = seen.get(value) ?? 0; seen.set(value, layer + 1); return { value, layer }; });
  }, [data]);
  const tallestStack = Math.max(...stacked.map((dot) => dot.layer)) + 1;
  const dataBase = DATA_TOP + tallestStack * (2 * DOT + 2);
  const histBase = HIST_TOP + HIST_H;
  const low = edges ? edges.low : 0;
  const high = edges ? edges.high : 0;
  const status = edges ? slots(t.bootStatus, { n: fmt(locale, count, 0), l: level, a: fmt(locale, low, 0), b: fmt(locale, high, 0) }) : slots(t.bootNone, { l: level });
  const dataTicks = tickValues(axis.min, axis.max, 11);
  const sumTicks = tickValues(lo, hi, 8);

  return <BoardShell screen="bootstrap-sim" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(() => setIndex(0))} resetDisabled={index === 0 || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={count > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metBootstrap, hint: t.hintBootstrap }} onCheck={() => grading.check({ seed, resamples: count })} />}>
    <section className="lf-learning-board lf-sim" aria-label={t.sumsName}>
      <Chart label={t.dataName} height={dataBase + 40}>
        <line className="lf-sim-axis" x1={PAD} x2={VIEW_W - PAD} y1={dataBase} y2={dataBase} />
        <g className="lf-sim-ticks">
          {dataTicks.map((tick) => <g key={tick}>
            <line x1={xData(tick)} x2={xData(tick)} y1={dataBase} y2={dataBase + 6} />
            <text x={xData(tick)} y={dataBase + 30} textAnchor="middle">{fmt(locale, tick, 0)}</text>
          </g>)}
        </g>
        {stacked.map((dot, place) => <circle key={place} className="lf-sim-dot lf-sim-dot--data" cx={xData(dot.value)} cy={dataBase - DOT - 1 - dot.layer * (2 * DOT + 2)} r={DOT} />)}
      </Chart>
      <Chart label={t.sumsName} height={histBase + 40}>
        {edges ? <rect className="lf-sim-band" x={xSum(low)} width={Math.max(1, xSum(high) - xSum(low))} y={HIST_TOP} height={HIST_H} /> : null}
        <line className="lf-sim-axis" x1={PAD} x2={VIEW_W - PAD} y1={histBase} y2={histBase} />
        <g className="lf-sim-ticks">
          {sumTicks.map((tick) => <g key={tick}>
            <line x1={xSum(tick)} x2={xSum(tick)} y1={histBase} y2={histBase + 6} />
            <text x={xSum(tick)} y={histBase + 30} textAnchor="middle">{fmt(locale, tick, 0)}</text>
          </g>)}
        </g>
        {counts.map((times, place) => {
          const height = (times / tallest) * HIST_H;
          return times === 0 ? null : <rect key={place} className="lf-sim-bar" x={PAD + (place * width * plot) / (binCount * width) + 1} y={histBase - height}
            width={Math.max(1, (width * plot) / (binCount * width) - 2)} height={height} />;
        })}
        {before ? <>
          <line className="lf-sim-ghost" x1={xSum(before.low)} x2={xSum(before.low)} y1={HIST_TOP} y2={histBase} />
          <line className="lf-sim-ghost" x1={xSum(before.high)} x2={xSum(before.high)} y1={HIST_TOP} y2={histBase} />
        </> : null}
        {edges ? <>
          <line className="lf-sim-edge" x1={xSum(low)} x2={xSum(low)} y1={HIST_TOP - 8} y2={histBase} />
          <line className="lf-sim-edge" x1={xSum(high)} x2={xSum(high)} y1={HIST_TOP - 8} y2={histBase} />
        </> : null}
      </Chart>
      <p className="lf-sim-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {before && edges ? <p className="lf-sim-goal" data-copy-role="data">{slots(t.bootPrev, { a: fmt(locale, before.low, 0), b: fmt(locale, before.high, 0) })}</p> : null}
      <p className="lf-sim-goal" data-copy-role="data">{slots(t.bootData, { v: data.map((value) => fmt(locale, value, 0)).join(', ') })}</p>
      <p className="lf-sim-goal" data-copy-role="data">{slots(t.bootGoal, { n: fmt(locale, minResamples, 0) })}</p>
      {table ? <>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.tableCaptionEdges}</caption>
          <thead><tr><th scope="col" data-copy-role="data">{t.colMeasure}</th><th scope="col" data-copy-role="data">{t.colValue}</th></tr></thead>
          <tbody>
            <tr><th scope="row" data-copy-role="data">{t.measureResamples}</th><td data-copy-role="data">{fmt(locale, count, 0)}</td></tr>
            {edges ? <>
              <tr><th scope="row" data-copy-role="data">{t.measureLowEdge}</th><td data-copy-role="data">{fmt(locale, low, 0)}</td></tr>
              <tr><th scope="row" data-copy-role="data">{t.measureHighEdge}</th><td data-copy-role="data">{fmt(locale, high, 0)}</td></tr>
            </> : null}
            {before ? <>
              <tr><th scope="row" data-copy-role="data">{t.measurePrevLow}</th><td data-copy-role="data">{fmt(locale, before.low, 0)}</td></tr>
              <tr><th scope="row" data-copy-role="data">{t.measurePrevHigh}</th><td data-copy-role="data">{fmt(locale, before.high, 0)}</td></tr>
            </> : null}
          </tbody>
        </table>
        {count > 0 ? <div className="lf-sim-scroll" role="region" aria-label={t.tableCaptionSums} tabIndex={0}>
          <table className="lf-hz-table" data-hz-table="">
            <caption data-copy-role="heading">{t.tableCaptionSums}</caption>
            <thead><tr><th scope="col" data-copy-role="data">{t.colTotal}</th><th scope="col" data-copy-role="data">{t.colResamples}</th></tr></thead>
            <tbody>{counts.map((times, place) => times === 0 ? null : <tr key={place}>
              <th scope="row" data-copy-role="data">{width === 1 ? fmt(locale, lo + place, 0) : slots(t.rangeOf, { a: fmt(locale, lo + place * width, 0), b: fmt(locale, Math.min(hi, lo + (place + 1) * width - 1), 0) })}</th>
              <td data-copy-role="data">{fmt(locale, times, 0)}</td>
            </tr>)}</tbody>
          </table>
        </div> : null}
      </> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.sumsName}>
      <Slider label={t.runResample} valueText={index === 0 ? t.noRun : fmt(locale, count, 0)} min={0} max={stops.length} step={1} value={index}
        onValueChange={(next) => change(() => setIndex(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function BootstrapBoard({ segment, ...rest }: HorizonteBoardProps) {
  const seed = useAttemptSeed(segment.id);
  return segment.type === 'stats.bootstrap-sim.v2' && seed !== null ? <Bootstrap segment={segment} seed={seed} {...rest} /> : null;
}
