import { useMemo, useState } from 'react';
import { Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import { useAttemptSeed } from '../attemptSeed';
import { BoardLabel } from '../BoardLabel';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { SIM1_COPY } from './copy';
import { chanceFaces, eventChance } from './model.generated';
import { Chart, PAD, ShareChart, TableToggle, VIEW_W, chanceText, fmt, percent, runCount, slots } from './shared';
import '../horizonte.css';
import './sim1.css';

type ChanceSegment = Extract<HorizonteSegment, { type: 'math.chance-sim.v2' }>;

const TOP = 28;
const PLOT_H = 120;

/*
 * H20: a coin, a die or a spinner, run from a seed Core issued with the attempt. The learner picks how many trials to run from the
 * authored stops and watches the share of the event settle on its chance (the law of large numbers). The run is a prefix of one
 * seeded stream, so a longer run only adds trials. Core replays the same stream to grade; this board is the picture of it.
 */
function Chance({ document, segment, onBack, sequence, onGrade, seed }: Omit<HorizonteBoardProps, 'segment'> & { segment: ChanceSegment; seed: string }) {
  const t = copyText(SIM1_COPY, document.locale);
  const { locale } = document;
  const { machine, event, stops, tolerance, minTrials } = segment.payload;
  const [index, setIndex] = useState(0);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const count = runCount(stops, index);
  const change = (next: () => void) => { grading.reset(); next(); };

  const chance = eventChance(machine, event);
  const inside = useMemo(() => new Set(event), [event]);
  const faces = useMemo(() => chanceFaces(seed, machine.weights, stops[stops.length - 1] as number), [seed, machine.weights, stops]);
  const hits = useMemo(() => {
    const running = new Array<number>(faces.length);
    let total = 0;
    faces.forEach((face, trial) => { if (inside.has(face)) total += 1; running[trial] = total; });
    return running;
  }, [faces, inside]);
  const tally = useMemo(() => {
    const counts = new Array<number>(machine.weights.length).fill(0);
    for (let trial = 0; trial < count; trial += 1) counts[faces[trial] as number] = (counts[faces[trial] as number] as number) + 1;
    return counts;
  }, [faces, count, machine.weights.length]);

  const inEvent = count === 0 ? 0 : (hits[count - 1] as number);
  const written = chanceText(t.chanceOf, locale, chance);
  const faceName = (face: number) => (machine.kind === 'coin' ? (face === 0 ? t.faceHeads : t.faceTails) : String(face + 1));
  const run = machine.kind === 'coin' ? t.runCoin : machine.kind === 'die' ? t.runDie : t.runSpinner;
  const bw = (VIEW_W - 2 * PAD) / tally.length;
  const gap = bw > 24 ? 8 : 3;
  const base = TOP + PLOT_H;
  const chartH = base + 56;
  const box = { width: VIEW_W, height: chartH };
  const words = machine.kind === 'coin';
  const tallest = Math.max(1, ...tally);
  const shown = stops.slice(0, index);

  return <BoardShell screen="chance-sim" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(() => setIndex(0))} resetDisabled={index === 0 || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={count > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metRun, hint: t.hintRun }} onCheck={() => grading.check({ seed, trials: count })} />}>
    <section className="lf-learning-board lf-sim" aria-label={t.shareName}>
      <ShareChart label={t.shareName} locale={locale} hits={hits} count={count} chance={chance} tolerance={tolerance} floor={minTrials} stops={stops} />
      <Chart label={t.tallyName} height={chartH}
        labels={words ? tally.map((_, face) => <BoardLabel key={face} box={box} x={PAD + face * bw + bw / 2} y={base + 16} align="middle" valign="top" room={bw - gap}>{faceName(face)}</BoardLabel>) : null}>
        <line className="lf-sim-axis" x1={PAD} x2={VIEW_W - PAD} y1={base} y2={base} />
        {tally.map((times, face) => {
          const height = (times / tallest) * PLOT_H;
          const left = PAD + face * bw;
          const marked = inside.has(face);
          return <g key={face}>
            <rect className={marked ? 'lf-sim-bar lf-sim-bar--event' : 'lf-sim-bar'} x={left + gap / 2} y={base - height} width={bw - gap} height={height} />
            {times > 0 ? <text className="lf-sim-count" x={left + bw / 2} y={base - height - 6} textAnchor="middle">{fmt(locale, times, 0)}</text> : null}
            {words ? null : <text className={marked ? 'lf-sim-face--event' : undefined} x={left + bw / 2} y={base + 36} textAnchor="middle">{faceName(face)}</text>}
            {marked ? <line className="lf-sim-event-mark" x1={left + gap / 2} x2={left + bw - gap / 2} y1={base + 8} y2={base + 8} /> : null}
          </g>;
        })}
      </Chart>
      <p className="lf-sim-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {count === 0 ? slots(t.chanceNone, { c: written }) : slots(t.chanceStatus, { n: fmt(locale, count, 0), h: fmt(locale, inEvent, 0), s: percent(locale, inEvent / count), c: written })}
      </p>
      <p className="lf-sim-goal" data-copy-role="data">{slots(t.chanceGoal, { n: fmt(locale, minTrials, 0), t: tolerance })}</p>
      {table ? <>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.tableCaptionTally}</caption>
          <thead><tr><th scope="col" data-copy-role="data">{t.colOutcome}</th><th scope="col" data-copy-role="data">{t.colTimes}</th><th scope="col" data-copy-role="data">{t.colInEvent}</th></tr></thead>
          <tbody>
            {tally.map((times, face) => <tr key={face}>
              <th scope="row" data-copy-role="data">{faceName(face)}</th><td data-copy-role="data">{fmt(locale, times, 0)}</td><td data-copy-role="data">{inside.has(face) ? t.yes : t.no}</td>
            </tr>)}
            <tr><th scope="row" data-copy-role="data">{t.total}</th><td data-copy-role="data">{fmt(locale, count, 0)}</td><td data-copy-role="data">{fmt(locale, inEvent, 0)}</td></tr>
          </tbody>
        </table>
        {shown.length > 0 ? <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.tableCaptionStops}</caption>
          <thead><tr><th scope="col" data-copy-role="data">{t.colTrials}</th><th scope="col" data-copy-role="data">{t.colInEvent}</th><th scope="col" data-copy-role="data">{t.colShare}</th></tr></thead>
          <tbody>{shown.map((stop) => <tr key={stop}>
            <th scope="row" data-copy-role="data">{fmt(locale, stop, 0)}</th><td data-copy-role="data">{fmt(locale, hits[stop - 1] as number, 0)}</td>
            <td data-copy-role="data">{percent(locale, (hits[stop - 1] as number) / stop)}</td>
          </tr>)}</tbody>
        </table> : null}
      </> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.shareName}>
      <Slider label={run} valueText={index === 0 ? t.noRun : fmt(locale, count, 0)} min={0} max={stops.length} step={1} value={index}
        onValueChange={(next) => change(() => setIndex(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function ChanceBoard({ segment, ...rest }: HorizonteBoardProps) {
  const seed = useAttemptSeed(segment.id);
  return segment.type === 'math.chance-sim.v2' && seed !== null ? <Chance segment={segment} seed={seed} {...rest} /> : null;
}
