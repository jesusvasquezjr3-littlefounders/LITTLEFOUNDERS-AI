import { useMemo, useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import { useAttemptSeed } from '../attemptSeed';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { SIM1_COPY } from './copy';
import { covers, sampleHits, waldInterval } from './interval.generated';
import { Chart, PAD, TableToggle, VIEW_W, chanceText, fmt, percent, slots } from './shared';
import '../horizonte.css';
import './sim1.css';

type CoverageSegment = Extract<HorizonteSegment, { type: 'stats.coverage-sim.v2' }>;

const TOP = 20;
const ROW = 5;
const SAMPLES = 100;
const TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

/*
 * H26: 100 samples of the same population, each with its confidence interval. The learner picks the level and the sample size and
 * counts how many intervals cover the true share. Whether one covers is decided with integer arithmetic (`covers`), never from the
 * drawn ends. Core replays the same seeded samples to grade the choice.
 */
function Coverage({ document, segment, onBack, sequence, onGrade, seed }: Omit<HorizonteBoardProps, 'segment'> & { segment: CoverageSegment; seed: string }) {
  const t = copyText(SIM1_COPY, document.locale);
  const { locale } = document;
  const { truth, levels, sizes, start, goal } = segment.payload;
  const startLevel = Math.max(0, levels.indexOf(start.level));
  const startSize = Math.max(0, sizes.indexOf(start.size));
  const [levelIndex, setLevelIndex] = useState(startLevel);
  const [sizeIndex, setSizeIndex] = useState(startSize);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const level = levels[levelIndex] as number;
  const size = sizes[sizeIndex] as number;
  const untouched = levelIndex === startLevel && sizeIndex === startSize;
  const change = (next: () => void) => { grading.reset(); next(); };

  const hits = useMemo(() => sampleHits(seed, truth, size), [seed, truth, size]);
  const rows = useMemo(() => hits.map((count) => ({ ...waldInterval(count, size, level), covered: covers(count, size, truth, level) })), [hits, size, level, truth]);
  const covering = rows.filter((row) => row.covered).length;
  const share = truth.num / truth.den;
  const x = (value: number) => PAD + value * (VIEW_W - 2 * PAD);
  const base = TOP + SAMPLES * ROW;
  const status = slots(t.coverageStatus, { l: level, n: fmt(locale, size, 0), c: covering, g: goal.covered });

  return <BoardShell screen="coverage-sim" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(() => { setLevelIndex(startLevel); setSizeIndex(startSize); })} resetDisabled={untouched || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={!untouched && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metCoverage, hint: t.hintCoverage }} onCheck={() => grading.check({ seed, level, size })} />}>
    <section className="lf-learning-board lf-sim" aria-label={t.intervalsName}>
      <Chart label={t.intervalsName} height={base + 40}>
        <g className="lf-sim-ticks">
          {TICKS.map((tick) => <g key={tick}>
            <line className="lf-sim-grid" x1={x(tick)} x2={x(tick)} y1={TOP} y2={base} />
            <text x={x(tick)} y={base + 28} textAnchor="middle">{percent(locale, tick, 0)}</text>
          </g>)}
        </g>
        {rows.map((row, sample) => {
          const y = TOP + sample * ROW + ROW / 2;
          return row.high - row.low < 0.002
            ? <circle key={sample} className={row.covered ? 'lf-sim-dot lf-sim-dot--cover' : 'lf-sim-dot lf-sim-dot--miss'} cx={x(row.low)} cy={y} r={2} />
            : <line key={sample} className={row.covered ? 'lf-sim-interval lf-sim-interval--cover' : 'lf-sim-interval lf-sim-interval--miss'} x1={x(row.low)} x2={x(row.high)} y1={y} y2={y} />;
        })}
        <line className="lf-sim-truth" x1={x(share)} x2={x(share)} y1={TOP - 8} y2={base} />
        <text className="lf-sim-count" x={x(share)} y={TOP - 12} textAnchor="middle">{t.truthMark}</text>
      </Chart>
      <ul className="lf-sim-legend">
        <li>
          <svg viewBox="0 0 32 8" aria-hidden="true" focusable="false"><line className="lf-sim-interval lf-sim-interval--cover" x1={2} x2={30} y1={4} y2={4} /></svg>
          <span data-copy-role="data">{t.legendCovers}</span>
        </li>
        <li>
          <svg viewBox="0 0 32 8" aria-hidden="true" focusable="false"><line className="lf-sim-interval lf-sim-interval--miss" x1={2} x2={30} y1={4} y2={4} /></svg>
          <span data-copy-role="data">{t.legendMisses}</span>
        </li>
      </ul>
      <p className="lf-sim-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {table ? <>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.tableCaptionCoverage}</caption>
          <thead><tr><th scope="col" data-copy-role="data">{t.colMeasure}</th><th scope="col" data-copy-role="data">{t.colValue}</th></tr></thead>
          <tbody>
            <tr><th scope="row" data-copy-role="data">{t.measureLevel}</th><td data-copy-role="data">{level}%</td></tr>
            <tr><th scope="row" data-copy-role="data">{t.measureSize}</th><td data-copy-role="data">{fmt(locale, size, 0)}</td></tr>
            <tr><th scope="row" data-copy-role="data">{t.measureTruth}</th><td data-copy-role="data">{chanceText(t.chanceOf, locale, truth)}</td></tr>
            <tr><th scope="row" data-copy-role="data">{t.measureCovering}</th><td data-copy-role="data">{covering}</td></tr>
            <tr><th scope="row" data-copy-role="data">{t.measureMissing}</th><td data-copy-role="data">{SAMPLES - covering}</td></tr>
            <tr><th scope="row" data-copy-role="data">{t.measureGoal}</th><td data-copy-role="data">{goal.covered}</td></tr>
          </tbody>
        </table>
        <div className="lf-sim-scroll" role="region" aria-label={t.tableCaptionSamples} tabIndex={0}>
          <table className="lf-hz-table" data-hz-table="">
            <caption data-copy-role="heading">{t.tableCaptionSamples}</caption>
            <thead><tr>
              <th scope="col" data-copy-role="data">{t.colSample}</th><th scope="col" data-copy-role="data">{t.colLow}</th><th scope="col" data-copy-role="data">{t.colHigh}</th>
              <th scope="col" data-copy-role="data">{t.legendCovers}</th>
            </tr></thead>
            <tbody>{rows.map((row, sample) => <tr key={sample}>
              <th scope="row" data-copy-role="data">{sample + 1}</th><td data-copy-role="data">{percent(locale, row.low)}</td><td data-copy-role="data">{percent(locale, row.high)}</td>
              <td data-copy-role="data">{row.covered ? t.yes : t.no}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.intervalsName}>
      <Slider label={t.levelSlider} valueText={`${level}%`} min={0} max={levels.length - 1} step={1} value={levelIndex}
        onValueChange={(next) => change(() => setLevelIndex(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
      <Slider label={t.sizeSlider} valueText={fmt(locale, size, 0)} min={0} max={sizes.length - 1} step={1} value={sizeIndex}
        onValueChange={(next) => change(() => setSizeIndex(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function CoverageBoard({ segment, ...rest }: HorizonteBoardProps) {
  const seed = useAttemptSeed(segment.id);
  return segment.type === 'stats.coverage-sim.v2' && seed !== null ? <Coverage segment={segment} seed={seed} {...rest} /> : null;
}
