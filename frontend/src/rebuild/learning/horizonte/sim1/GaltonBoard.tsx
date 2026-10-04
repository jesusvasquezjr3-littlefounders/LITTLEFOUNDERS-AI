import { useMemo, useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import { useAttemptSeed } from '../attemptSeed';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { SIM1_COPY } from './copy';
import { binChance, binCounts, galtonBallBins, galtonSteps } from './model.generated';
import { Chart, PAD, ShareChart, TableToggle, VIEW_W, chanceText, fmt, linePath, percent, runCount, slots } from './shared';
import '../horizonte.css';
import './sim1.css';

type GaltonSegment = Extract<HorizonteSegment, { type: 'math.galton-sim.v2' }>;

const TOP = 20;
const ROW_H = 22;
const BIN_H = 110;

/*
 * H21: a Galton board (pegs send a ball left or right) or a random walk (each step goes left or right), run from a seed Core issued
 * with the attempt. The bins fill like the bars of a binomial, and the share of balls in the target bin settles on its chance. The
 * run is a prefix of one seeded stream; Core replays that stream to grade.
 */
function Galton({ document, segment, onBack, sequence, onGrade, seed }: Omit<HorizonteBoardProps, 'segment'> & { segment: GaltonSegment; seed: string }) {
  const t = copyText(SIM1_COPY, document.locale);
  const { locale } = document;
  const { view, rows, rightPct, bin, stops, tolerance, minBalls } = segment.payload;
  const walk = view === 'walk';
  const [index, setIndex] = useState(0);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const count = runCount(stops, index);
  const change = (next: () => void) => { grading.reset(); next(); };

  const chance = binChance(rows, rightPct, bin);
  const steps = useMemo(() => galtonSteps(seed, rows, rightPct, stops[stops.length - 1] as number), [seed, rows, rightPct, stops]);
  const ballBins = useMemo(() => galtonBallBins(steps, rows), [steps, rows]);
  const hits = useMemo(() => {
    const running = new Array<number>(ballBins.length);
    let total = 0;
    ballBins.forEach((place, ball) => { if (place === bin) total += 1; running[ball] = total; });
    return running;
  }, [ballBins, bin]);
  const counts = useMemo(() => binCounts(ballBins, rows, count), [ballBins, rows, count]);
  const lastPath = useMemo(() => {
    if (count === 0) return [] as number[];
    const path = [0];
    for (let peg = 0; peg < rows; peg += 1) path.push((path[peg] as number) + (steps[(count - 1) * rows + peg] as number));
    return path;
  }, [steps, rows, count]);

  const inBin = count === 0 ? 0 : (hits[count - 1] as number);
  const written = chanceText(t.chanceOf, locale, chance);
  const dx = Math.min(48, (VIEW_W - 2 * PAD) / (rows + 1));
  const middle = VIEW_W / 2;
  const binX = (place: number) => middle + (place - rows / 2) * dx;
  const tallest = Math.max(1, ...counts);
  const pegsBottom = TOP + rows * ROW_H;
  const base = (walk ? 0 : pegsBottom) + 20 + BIN_H;
  const shown = stops.slice(0, index);
  const slider = walk ? t.runWalk : t.runBall;

  const bins = <>
    <line className="lf-sim-axis" x1={binX(0) - dx / 2} x2={binX(rows) + dx / 2} y1={base} y2={base} />
    {counts.map((balls, place) => {
      const height = (balls / tallest) * BIN_H;
      return <g key={place}>
        <rect className={place === bin ? 'lf-sim-bar lf-sim-bar--target' : 'lf-sim-bar'} x={binX(place) - dx / 2 + 3} y={base - height} width={dx - 6} height={height} />
        {balls > 0 ? <text className="lf-sim-count" x={binX(place)} y={base - height - 6} textAnchor="middle">{fmt(locale, balls, 0)}</text> : null}
        <text className={place === bin ? 'lf-sim-face--event' : undefined} x={binX(place)} y={base + 28} textAnchor="middle">{place}</text>
        {place === bin ? <line className="lf-sim-event-mark" x1={binX(place) - dx / 2 + 3} x2={binX(place) + dx / 2 - 3} y1={base + 42} y2={base + 42} /> : null}
      </g>;
    })}
  </>;

  return <BoardShell screen="galton-sim" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(() => setIndex(0))} resetDisabled={index === 0 || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={count > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metRun, hint: t.hintRun }} onCheck={() => grading.check({ seed, balls: count })} />}>
    <section className="lf-learning-board lf-sim" aria-label={walk ? t.walkShareName : t.ballShareName}>
      <ShareChart label={walk ? t.walkShareName : t.ballShareName} locale={locale} hits={hits} count={count} chance={chance} tolerance={tolerance} floor={minBalls} stops={stops} />
      {walk ? <Chart label={t.pathName} height={TOP + rows * ROW_H + 52}>
        <g className="lf-sim-ticks">
          {Array.from({ length: rows + 1 }, (_, place) => <g key={place}>
            <line className="lf-sim-grid" x1={PAD + 40} x2={VIEW_W - PAD} y1={TOP + (rows - place) * ROW_H} y2={TOP + (rows - place) * ROW_H} />
            <text x={PAD + 28} y={TOP + (rows - place) * ROW_H + 7} textAnchor="end">{place}</text>
          </g>)}
        </g>
        {lastPath.length > 0 ? <>
          <path className="lf-sim-line" d={linePath(lastPath.map((place, step) => [PAD + 56 + (step * (VIEW_W - 2 * PAD - 80)) / rows, TOP + (rows - place) * ROW_H] as const))} />
          {lastPath.map((place, step) => <circle key={step} className="lf-sim-now" cx={PAD + 56 + (step * (VIEW_W - 2 * PAD - 80)) / rows} cy={TOP + (rows - place) * ROW_H} r={5} />)}
        </> : null}
      </Chart> : null}
      <Chart label={walk ? t.placesName : t.pegsName} height={base + 56}>
        {walk ? null : <>
          {Array.from({ length: rows }, (_, row) => Array.from({ length: row + 1 }, (_, peg) =>
            <circle key={`${row}-${peg}`} className="lf-sim-peg" cx={middle + (peg - row / 2) * dx} cy={TOP + row * ROW_H} r={4} />))}
          {lastPath.length > 0 ? <path className="lf-sim-line" d={linePath(lastPath.map((place, row) => [middle + (place - row / 2) * dx, TOP + row * ROW_H] as const))} /> : null}
        </>}
        {bins}
      </Chart>
      <p className="lf-sim-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {count === 0
          ? slots(walk ? t.walkNone : t.ballNone, { b: bin, c: written })
          : slots(walk ? t.walkStatus : t.ballStatus, { n: fmt(locale, count, 0), b: bin, h: fmt(locale, inBin, 0), s: percent(locale, inBin / count), c: written })}
      </p>
      <p className="lf-sim-goal" data-copy-role="data">{slots(walk ? t.walkGoal : t.ballGoal, { n: fmt(locale, minBalls, 0), t: tolerance })}</p>
      {table ? <>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{walk ? t.tableCaptionPlaces : t.tableCaptionBins}</caption>
          <thead><tr>
            <th scope="col" data-copy-role="data">{walk ? t.colStepsRight : t.colBin}</th><th scope="col" data-copy-role="data">{walk ? t.colWalks : t.colBalls}</th><th scope="col" data-copy-role="data">{t.colTarget}</th>
          </tr></thead>
          <tbody>
            {counts.map((balls, place) => <tr key={place}>
              <th scope="row" data-copy-role="data">{place}</th><td data-copy-role="data">{fmt(locale, balls, 0)}</td><td data-copy-role="data">{place === bin ? t.yes : t.no}</td>
            </tr>)}
            <tr><th scope="row" data-copy-role="data">{t.total}</th><td data-copy-role="data">{fmt(locale, count, 0)}</td><td data-copy-role="data">{fmt(locale, inBin, 0)}</td></tr>
          </tbody>
        </table>
        {shown.length > 0 ? <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.tableCaptionStops}</caption>
          <thead><tr><th scope="col" data-copy-role="data">{walk ? t.colWalks : t.colBalls}</th><th scope="col" data-copy-role="data">{t.colTarget}</th><th scope="col" data-copy-role="data">{t.colShare}</th></tr></thead>
          <tbody>{shown.map((stop) => <tr key={stop}>
            <th scope="row" data-copy-role="data">{fmt(locale, stop, 0)}</th><td data-copy-role="data">{fmt(locale, hits[stop - 1] as number, 0)}</td>
            <td data-copy-role="data">{percent(locale, (hits[stop - 1] as number) / stop)}</td>
          </tr>)}</tbody>
        </table> : null}
      </> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={walk ? t.walkShareName : t.ballShareName}>
      <Slider label={slider} valueText={index === 0 ? t.noRun : fmt(locale, count, 0)} min={0} max={stops.length} step={1} value={index}
        onValueChange={(next) => change(() => setIndex(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function GaltonBoard({ segment, ...rest }: HorizonteBoardProps) {
  const seed = useAttemptSeed(segment.id);
  return segment.type === 'math.galton-sim.v2' && seed !== null ? <Galton segment={segment} seed={seed} {...rest} /> : null;
}
