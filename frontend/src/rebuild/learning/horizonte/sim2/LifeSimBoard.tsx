import { useMemo, useState, type ReactNode } from 'react';
import { Button, Slider } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import { useAttemptSeed } from '../attemptSeed';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { SIM2_COPY } from './copy';
import { axisOf, compactMoney, count, fill, money, percentile, signedPercent, spokenMoney, type Axis, type MoneyShorts } from './format';
import { CHAPTER_YEARS, OUTCOME_TABLE, futuresOf, type Future, type Payload } from './model.generated';
import '../horizonte.css';
import './LifeSimBoard.css';

type LifeSegment = Extract<HorizonteSegment, { type: 'money.life-sim.v2' }>;

const PLOT_W = 480;
const PLOT_H = 260;
const TICK = 6;

const SLIDER = { portfolio: 'sliderPortfolio', retirement: 'sliderRetirement', insurance: 'sliderInsurance', life: 'sliderLife' } as const;
const VALUE = { portfolio: 'valuePortfolio', retirement: 'valueRetirement', insurance: 'valueInsurance', life: 'valueLife' } as const;

type Mark = { value: number; kind: 'finish' | 'floor' };

/** The y axis of a chart: the same for every choice, so moving the slider moves the futures and never the scale. The top clips the 5% highest values. */
function axisFor(runs: readonly Future[][], series: 'path' | 'cushions', marks: readonly Mark[]): Axis {
  const values = runs.flatMap((futures) => futures.flatMap((future) => future[series]));
  const levels = marks.map((mark) => mark.value);
  return axisOf(Math.min(0, ...values, ...levels), Math.max(percentile(values, 0.95), ...levels));
}

/** The target runs on the worth chart, the floor on the chart of what must stay above it (the cash for a life, the worth itself otherwise). */
function marksOf(finish: number, floor: number, life: boolean): { worth: Mark[]; cash: Mark[] } {
  const finishMark: Mark[] = finish > 0 ? [{ value: finish, kind: 'finish' }] : [];
  const floorMark: Mark = { value: floor, kind: 'floor' };
  return { worth: life ? finishMark : [...finishMark, floorMark], cash: [floorMark] };
}

/*
 * The drawing is the plot alone. Every word and figure of the axes is HTML beside it (Bible 05 section 5): the y labels are zero-height
 * rows spread over the plot's height, which is where the evenly spaced ticks of `axisOf` fall, and the x labels are zero-width columns.
 */
function FuturesChart({ label, locale, futures, series, axis, periods, yearsEach, marks, yearsLabel, shorts }: {
  label: string; locale: Locale; futures: readonly Future[]; series: 'path' | 'cushions'; axis: Axis; periods: number; yearsEach: number;
  marks: readonly Mark[]; yearsLabel: string; shorts: MoneyShorts;
}) {
  const x = (chapter: number) => (chapter / periods) * PLOT_W;
  const y = (value: number) => (1 - (Math.min(axis.high, Math.max(axis.low, value)) - axis.low) / (axis.high - axis.low)) * PLOT_H;
  const chapters = Array.from({ length: periods + 1 }, (_, chapter) => chapter);
  const line = (future: Future) => future[series].map((value, chapter) => `${chapter === 0 ? 'M' : 'L'}${x(chapter).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  return <div className="lf-life-chart" role="img" aria-label={label} data-copy-role="data">
    <div className="lf-life-yaxis">
      {[...axis.ticks].reverse().map((tick) => <span key={tick} className="lf-life-tick"><span className="lf-life-label">{compactMoney(locale, tick, shorts)}</span></span>)}
    </div>
    <svg className="lf-life-plot" viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} focusable="false">
      <g className="lf-life-ticks">
        {axis.ticks.map((tick) => <line key={tick} className="lf-life-grid" x1={0} x2={PLOT_W} y1={y(tick)} y2={y(tick)} />)}
        <line x1={0} x2={PLOT_W} y1={PLOT_H} y2={PLOT_H} />
        {chapters.map((chapter) => <line key={chapter} x1={x(chapter)} x2={x(chapter)} y1={PLOT_H} y2={PLOT_H + TICK} />)}
      </g>
      {futures.map((future, index) => !future.ok ? <path key={index} className="lf-life-path lf-life-path--no" d={line(future)} /> : null)}
      {futures.map((future, index) => future.ok ? <path key={index} className="lf-life-path lf-life-path--yes" d={line(future)} /> : null)}
      {marks.map((mark) => <line key={mark.kind} className={`lf-life-mark lf-life-mark--${mark.kind}`} x1={0} x2={PLOT_W} y1={y(mark.value)} y2={y(mark.value)} />)}
    </svg>
    <div className="lf-life-xaxis">
      {chapters.map((chapter) => <span key={chapter} className="lf-life-tick"><span className="lf-life-label">{count(locale, chapter * yearsEach)}</span></span>)}
    </div>
    <span className="lf-life-label lf-life-years">{yearsLabel}</span>
  </div>;
}

function Swatch({ kind }: { kind: string }) {
  return <svg viewBox="0 0 32 8" aria-hidden="true" focusable="false"><line className={kind} x1={2} x2={30} y1={4} y2={4} /></svg>;
}

function Legend({ items }: { items: ReadonlyArray<{ kind: string; text: string }> }) {
  return <ul className="lf-life-legend">{items.map((item) => <li key={item.kind}><Swatch kind={item.kind} /><span data-copy-role="data">{item.text}</span></li>)}</ul>;
}

function Measures({ caption, head, rows }: { caption: string; head: readonly [string, string]; rows: ReadonlyArray<readonly [string, ReactNode]> }) {
  return <table className="lf-hz-table" data-hz-table="">
    <caption data-copy-role="heading">{caption}</caption>
    <thead><tr><th scope="col" data-copy-role="data">{head[0]}</th><th scope="col" data-copy-role="data">{head[1]}</th></tr></thead>
    <tbody>{rows.map(([name, value]) => <tr key={name}><th scope="row" data-copy-role="data">{name}</th><td data-copy-role="data">{value}</td></tr>)}</tbody>
  </table>;
}

/*
 * F3.3: live a year or twenty in compressed time. The learner moves one slider over a few choices (a stock share, a spending level,
 * the cover bought, the pay sent to debt) and sees the same 100 seeded futures under each: a fan of lines, green where a future
 * reaches the target and keeps its cash above the floor. The count of green futures is what the check is about. Whether a future
 * succeeds is whole-number arithmetic in the model; Core replays the same seeded futures to grade the choice.
 */
function LifeSim({ document, segment, onBack, sequence, onGrade, seed }: Omit<HorizonteBoardProps, 'segment'> & { segment: LifeSegment; seed: string }) {
  const t = copyText(SIM2_COPY, document.locale);
  const { locale } = document;
  const payload = segment.payload as Payload;
  const { scenario, periods, cash, debt, flow, finish, floor, goal, choices, start } = payload;
  const startIndex = Math.max(0, choices.indexOf(start));
  const [index, setIndex] = useState(startIndex);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const change = (next: () => void) => { grading.reset(); next(); };

  const runs = useMemo(() => choices.map((choice) => futuresOf(seed, payload, choice)), [seed, payload, choices]);
  const futures = runs[index] as Future[];
  const choice = choices[index] as number;
  const wins = futures.filter((future) => future.ok).length;
  const yearsEach = CHAPTER_YEARS[scenario];
  const life = scenario === 'life';
  const showFinish = finish > 0;
  const marks = useMemo(() => marksOf(finish, floor, life), [finish, floor, life]);
  const axes = useMemo(() => ({ worth: axisFor(runs, 'path', marks.worth), cash: life ? axisFor(runs, 'cushions', marks.cash) : null }), [runs, marks, life]);
  const spoken = { finish: spokenMoney(locale, finish), floor: spokenMoney(locale, floor) };
  const worthName = life ? fill(t.chartNet, spoken) : fill(showFinish ? t.chartMoney : t.chartMoneyFloor, spoken);
  const valueText = (value: number) => fill(t[VALUE[scenario]], { v: scenario === 'retirement' ? money(locale, value) : count(locale, value) });
  const untouched = index === startIndex;
  const shorts: MoneyShorts = { thousand: t.axisThousand, million: t.axisMillion };
  const status = fill(t.status, { c: valueText(choice), n: wins, g: goal });
  const legend = [
    { kind: 'lf-life-path lf-life-path--yes', text: t.legendYes }, { kind: 'lf-life-path lf-life-path--no', text: t.legendNo },
    ...(showFinish ? [{ kind: 'lf-life-mark lf-life-mark--finish', text: t.legendFinish }] : []), { kind: 'lf-life-mark lf-life-mark--floor', text: t.legendFloor },
  ];
  const effect = (value: number) => (scenario === 'portfolio' || scenario === 'retirement' ? signedPercent(locale, value) : money(locale, value));

  const summary: Array<readonly [string, ReactNode]> = [
    [t.measureChoice, valueText(choice)],
    [t.measureTime, fill(t.timeValue, { n: periods, y: periods * yearsEach })],
    [t.measureStart, money(locale, cash)],
    ...(life ? [[t.measureDebt, money(locale, debt)] as const] : []),
    ...(flow > 0 ? [[t.measureFlow, money(locale, flow)] as const] : []),
    ...(showFinish ? [[t.measureFinish, money(locale, finish)] as const] : []),
    [t.measureFloor, money(locale, floor)],
    [t.measureWins, wins],
    [t.measureNeeded, goal],
  ];

  return <BoardShell screen="life-sim" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => change(() => setIndex(startIndex))} resetDisabled={untouched || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={!untouched && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metLife, hint: t.hintLife }} onCheck={() => grading.check({ seed, choice })} />}>
    <section className="lf-learning-board lf-life" aria-label={worthName}>
      <FuturesChart label={worthName} locale={locale} futures={futures} series="path" axis={axes.worth} periods={periods} yearsEach={yearsEach} marks={marks.worth} yearsLabel={t.axisYears} shorts={shorts} />
      {axes.cash ? <FuturesChart label={fill(t.chartCash, spoken)} locale={locale} futures={futures} series="cushions" axis={axes.cash} periods={periods} yearsEach={yearsEach}
        marks={marks.cash} yearsLabel={t.axisYears} shorts={shorts} /> : null}
      <Legend items={legend} />
      <p className="lf-life-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {table ? <>
        <Measures caption={t.tableChoice} head={[t.colMeasure, t.colValue]} rows={summary} />
        <Measures caption={t.tableOutcomes} head={[t.colOutcome, scenario === 'insurance' ? t.colCostCover : scenario === 'life' ? t.colCost : t.colReturn]}
          rows={OUTCOME_TABLE[scenario].map((value, outcome) => [String(outcome + 1), effect(value)] as const)} />
        <p className="lf-life-note" data-copy-role="body">{t.outcomesNote}</p>
        <div className="lf-life-scroll" role="region" aria-label={t.tableFutures} tabIndex={0}>
          <table className="lf-hz-table" data-hz-table="">
            <caption data-copy-role="heading">{t.tableFutures}</caption>
            <thead><tr>
              <th scope="col" data-copy-role="data">{t.colFuture}</th><th scope="col" data-copy-role="data">{t.colFinal}</th>
              <th scope="col" data-copy-role="data">{t.colLowest}</th><th scope="col" data-copy-role="data">{t.colSucceeds}</th>
            </tr></thead>
            <tbody>{futures.map((future, number) => <tr key={number}>
              <th scope="row" data-copy-role="data">{number + 1}</th><td data-copy-role="data">{money(locale, future.path[periods] as number)}</td>
              <td data-copy-role="data">{money(locale, future.lowest)}</td><td data-copy-role="data">{future.ok ? t.yes : t.no}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={worthName}>
      <Slider label={t[SLIDER[scenario]]} valueText={valueText(choice)} min={0} max={choices.length - 1} step={1} value={index}
        onValueChange={(next) => change(() => setIndex(next))} stepLabels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function LifeSimBoard({ segment, ...rest }: HorizonteBoardProps) {
  const seed = useAttemptSeed(segment.id);
  return segment.type === 'money.life-sim.v2' && seed !== null ? <LifeSim segment={segment} seed={seed} {...rest} /> : null;
}
