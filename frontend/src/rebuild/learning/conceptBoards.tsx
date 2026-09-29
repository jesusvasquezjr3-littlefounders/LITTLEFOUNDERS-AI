import { useCallback, useMemo, useState } from 'react';
import { AnswerChoice, Button, Slider, Stepper } from '../design/controls';
import { TeachingChart } from './charts/TeachingChart';
import { conceptCopy, conceptMoney, conceptPercent, fill } from './conceptCopy';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { BeforeAfter, ChartOrTable, CurveShift, DragPoint, GhostTracePlot, GuidedSandbox, ReactiveText, ScaleToggle, ThresholdPlot, TradeOffChooser, useGhost, WhatIfBranch } from './operations/operations';
import { tokensLeft } from './operations/operationsModel';
import { GrowthLinesVisual, RiskReturnVisual, StackedColumnsVisual, SupplyDemandVisual } from './pizarron';
import { BoardShell, GradedFoot, NumberAnswer, playerCopy, useSegmentGrade, ViewedFoot, type OnGradeSegment } from './segmentKit';
import { amortizationSchedule, compoundValue, equilibrium, lemonadeDay, payoff, portfolio, type PayoffResult } from './v2ConceptBoards.generated';
import './conceptBoards.css';

/*
 * GAP-FIX-R1 learning (Appendix A Part 3; B.7 part 2): the concept boards.
 * Each composes the Part 2 primitives (operations/), draws from the canonical
 * concept model (v2ConceptBoards.generated.ts, the byte copy of Core's), and
 * sends only integers and ids to Core, which grades with its private rubric.
 * Where a board asks for a prediction, the value it predicts stays hidden
 * until Core has met the answer; an explored board shows everything live.
 */

type Seg<T extends LessonClientSegment['type']> = Extract<LessonClientSegment, { type: T }>;
interface BoardProps<T extends LessonClientSegment['type']> {
  document: LessonClientDocument; segment: Seg<T>; onBack: () => void; sequence?: LessonSequenceControl; onGrade?: OnGradeSegment;
}
const verdictOf = (grading: ReturnType<typeof useSegmentGrade>) => grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null;
/** Bible 05 §3/§6 (GAP-FIX-R4): the "Show as table" labels of the player, in the lesson's locale. */
const tableLabels = (locale: LessonClientDocument['locale']) => ({ showTable: playerCopy(locale).showTable, showChart: playerCopy(locale).showChart });
/** A two-or-more column data table for a concept chart (the same numbers the chart draws). */
function DataTable({ label, columns, rows }: { label: string; columns: readonly string[]; rows: ReadonlyArray<{ id: string | number; cells: readonly string[] }> }) {
  return <table className="lf-learning-table" aria-label={label}>
    <thead><tr>{columns.map((column) => <th key={column} scope="col" data-copy-role="data">{column}</th>)}</tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => index === 0
      ? <th key={index} scope="row" data-label={columns[0]} data-copy-role="data">{cell}</th>
      : <td key={index} data-label={columns[index]} data-copy-role="data">{cell}</td>)}</tr>)}</tbody>
  </table>;
}
/** A typed canonical amount in the board's unit: whole coins, or minor units of the market currency. */
function toMinor(canonical: string | null, currency: 'coins' | 'local'): string | null {
  if (canonical === null) return null;
  const value = Number(canonical) * (currency === 'local' ? 100 : 1);
  return Number.isSafeInteger(Math.round(value)) && Math.abs(value - Math.round(value)) < 1e-9 ? String(Math.round(value)) : null;
}

/* Loan amortization: scrub payment by payment (pattern 6). */
export function AmortizationBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.amortization.v2'>) {
  const t = conceptCopy[document.locale];
  const p = segment.payload;
  const money = conceptMoney(document.locale, p.currency);
  const rows = useMemo(() => amortizationSchedule(p.principal_minor, p.rate_bps, p.months), [p.principal_minor, p.rate_bps, p.months]);
  const [month, setMonth] = useState(0);
  const [typed, setTyped] = useState<string | null>(null);
  const onTyped = useCallback((value: string | null) => setTyped(value), []);
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server';
  const row = month > 0 ? rows[month - 1]! : null;
  const before = month <= 1 ? p.principal_minor : rows[month - 2]!.balance;
  const hideAfter = graded && !grading.met;
  const go = (next: number) => { grading.reset(); setMonth(Math.min(rows.length, Math.max(0, next))); };
  const balance = toMinor(typed, p.currency);
  // The table never shows a balance the learner is asked for.
  const shownRows = rows.filter((r) => !hideAfter || r.month < month);
  return <BoardShell screen="amortization" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={graded ? grading.met : true} verdict={verdictOf(grading)}
    onReset={() => go(0)} resetDisabled={month === 0 || grading.pending || grading.met}
    foot={graded ? <GradedFoot locale={document.locale} grading={grading} canCheck={month > 0 && balance !== null} sequence={sequence} onCheck={() => grading.check({ month, balance })} />
      : <ViewedFoot locale={document.locale} sequence={sequence} ready={month > 0} />}>
    <section className="lf-learning-board lf-concept-board" aria-label={t.schedule} data-operation="operation.step-replay.v1">
      <ChartOrTable labels={tableLabels(document.locale)}
        chart={<StackedColumnsVisual label={`${t.schedule}. ${fill(t.monthN, { n: month })}`}
          keys={[{ id: 'interest', label: t.interest, series: 'berry' }, { id: 'principal', label: t.toLoan, series: 'sky' }]}
          columns={rows.map((r) => ({ id: String(r.month), current: r.month === month,
            parts: [{ id: 'interest', value: r.interest, series: 'berry' as const }, { id: 'principal', value: r.principal, series: 'sky' as const }] }))} />}
        table={<DataTable label={t.schedule} columns={[t.month, t.payment, t.interest, t.toLoan, t.balanceAfter]}
          rows={shownRows.map((r) => ({ id: r.month, cells: [String(r.month), money(r.payment), money(r.interest), money(r.principal), money(r.balance)] }))} />} />
      <Slider label={t.month} valueText={fill(t.monthN, { n: month })} min={0} max={rows.length} value={month} onValueChange={go}
        stepLabels={{ decrease: t.less, increase: t.more }} />
      <dl className="lf-concept-facts" aria-live="polite">
        <div><dt data-copy-role="data">{t.startBalance}</dt><dd data-copy-role="data">{money(before)}</dd></div>
        {row ? <>
          <div><dt data-copy-role="data">{t.payment}</dt><dd data-copy-role="data">{money(row.payment)}</dd></div>
          <div><dt data-copy-role="data">{t.interest}</dt><dd data-copy-role="data">{money(row.interest)}</dd></div>
          <div><dt data-copy-role="data">{t.toLoan}</dt><dd data-copy-role="data">{money(row.principal)}</dd></div>
          <div><dt data-copy-role="data">{t.balanceAfter}</dt><dd data-copy-role="data">{hideAfter ? t.hidden : money(row.balance)}</dd></div>
        </> : null}
      </dl>
    </section>
    {graded ? <section className="lf-learning-control-strip"><NumberAnswer label={t.yourBalance} locale={document.locale} onChange={onTyped} disabled={grading.met} /></section> : null}
  </BoardShell>;
}

/* Supply and demand: drag or step a whole curve; the equilibrium follows (patterns 2 and 12). */
export function SupplyDemandBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'econ.supply-demand.v2'>) {
  const t = conceptCopy[document.locale];
  const p = segment.payload;
  const number = new Intl.NumberFormat(document.locale, { maximumFractionDigits: 2 });
  const [shift, setShift] = useState({ demand: 0, supply: 0 });
  const [price, setPrice] = useState<'up' | 'down' | 'same' | null>(null);
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server';
  const W = 300; const H = 200;
  const pMax = p.demand.intercept + p.max_shift * p.shift_step;
  const qMax = pMax / p.demand.slope;
  const x = (q: number) => q / qMax * W; const y = (value: number) => H - value / pMax * H;
  const a = p.demand.intercept + shift.demand * p.shift_step; const c = p.supply.intercept + shift.supply * p.shift_step;
  const eq = equilibrium(p.demand, p.supply, p.shift_step, shift.demand, shift.supply);
  const unit = p.shift_step / pMax * H;
  const set = (curve: 'demand' | 'supply', value: number) => { grading.reset(); setShift((s) => ({ ...s, [curve]: value })); };
  const qd = Math.min(qMax, a / p.demand.slope);
  const qs = Math.min(qMax, Math.max(0, (pMax - c) / p.supply.slope));
  const nx = (q: number) => q / qMax; const ny = (value: number) => value / pMax;
  const moved = shift.demand !== 0 || shift.supply !== 0;
  return <BoardShell screen="supply-demand" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={graded ? grading.met : true} verdict={verdictOf(grading)}
    onReset={() => { grading.reset(); setShift({ demand: 0, supply: 0 }); setPrice(null); }} resetDisabled={(!moved && price === null) || grading.pending || grading.met}
    foot={graded ? <GradedFoot locale={document.locale} grading={grading} canCheck={price !== null} sequence={sequence}
      onCheck={() => grading.check({ demand_shift: shift.demand, supply_shift: shift.supply, price })} />
      : <ViewedFoot locale={document.locale} sequence={sequence} ready={shift.demand !== 0 || shift.supply !== 0} />}>
    <section className="lf-learning-board lf-concept-board">
      {/* GAP-FIX-R4 (B.7; Bible 05 §5, §6): the shared Pizarrón picture; words are HTML; the handles are pointer-only
          inside the aria-hidden drawing, and the steppers below are the accessible way to move each curve. */}
      <figure className="lf-op">
        <ChartOrTable labels={tableLabels(document.locale)}
          chart={<SupplyDemandVisual label={`${t.market}. ${t.priceNow}: ${number.format(eq.price)}. ${p.labels.quantity}: ${number.format(eq.quantity)}.`}
            xLabel={p.labels.quantity} yLabel={p.labels.price} point={{ x: nx(eq.quantity), y: ny(eq.price) }}
            lines={[
              { id: 'demand', label: p.labels.demand, series: 'sky', from: { x: 0, y: ny(a) }, to: { x: nx(qd), y: ny(a - p.demand.slope * qd) },
                labelAt: { x: nx(qd * 0.1), y: ny(a - p.demand.slope * qd * 0.1) } },
              { id: 'supply', label: p.labels.supply, series: 'berry', from: { x: 0, y: ny(c) }, to: { x: nx(qs), y: ny(c + p.supply.slope * qs) },
                labelAt: { x: nx(qs * 0.7), y: ny(c + p.supply.slope * qs * 0.7) } },
            ]}
            overlay={<>
              <DragPoint presentational x={x(qd * 0.2)} y={y(a - p.demand.slope * qd * 0.2)} axis="y" length={unit * 2 * p.max_shift} value={shift.demand} min={-p.max_shift} max={p.max_shift}
                label={fill(t.shift, { x: p.labels.demand })} valueText={fill(t.shiftValue, { n: shift.demand })} onChange={(value) => set('demand', value)} disabled={grading.met} />
              <DragPoint presentational x={x(qs * 0.8)} y={y(c + p.supply.slope * qs * 0.8)} axis="y" length={unit * 2 * p.max_shift} value={shift.supply} min={-p.max_shift} max={p.max_shift}
                label={fill(t.shift, { x: p.labels.supply })} valueText={fill(t.shiftValue, { n: shift.supply })} onChange={(value) => set('supply', value)} disabled={grading.met} />
            </>} />}
          table={<DataTable label={t.market} columns={['', p.labels.quantity, p.labels.price]} rows={[
            { id: 'demand', cells: [p.labels.demand, number.format(0), number.format(a)] },
            { id: 'supply', cells: [p.labels.supply, number.format(0), number.format(c)] },
            { id: 'now', cells: [t.priceNow, number.format(eq.quantity), number.format(eq.price)] },
          ]} />} />
        <figcaption className="lf-op-status" aria-live="polite" data-copy-role="data">{`${t.priceNow}: ${number.format(eq.price)}`}</figcaption>
      </figure>
      <div className="lf-concept-controls">
        <CurveShift label={fill(t.shift, { x: p.labels.demand })} value={shift.demand} max={p.max_shift} valueText={fill(t.shiftValue, { n: shift.demand })}
          labels={{ decrease: t.less, increase: t.more }} onChange={(value) => set('demand', value)} disabled={grading.met} />
        <CurveShift label={fill(t.shift, { x: p.labels.supply })} value={shift.supply} max={p.max_shift} valueText={fill(t.shiftValue, { n: shift.supply })}
          labels={{ decrease: t.less, increase: t.more }} onChange={(value) => set('supply', value)} disabled={grading.met} />
      </div>
    </section>
    {graded ? <section className="lf-learning-control-strip" aria-label={t.priceMoves}>
      <p data-copy-role="prompt">{t.priceMoves}</p>
      <div className="lf-story-options" role="group" aria-label={t.priceMoves}>
        {(['up', 'down', 'same'] as const).map((value) => <AnswerChoice key={value} label={t[value]} selected={price === value} disabled={grading.pending || grading.met}
          onSelect={() => { grading.reset(); setPrice(value); }} />)}
      </div>
    </section> : null}
  </BoardShell>;
}

/* Opportunity cost: spend a few tokens; what you gave up stays in view (pattern 11). */
export function OpportunityCostBoard({ document, segment, onBack, sequence }: BoardProps<'money.opportunity-cost.v2'>) {
  const t = conceptCopy[document.locale];
  const p = segment.payload;
  const [picked, setPicked] = useState<string[]>([]);
  const left = tokensLeft(p.options, picked, p.tokens);
  const done = picked.length > 0 && p.options.every((option) => picked.includes(option.id) || option.cost > left);
  return <BoardShell screen="opportunity-cost" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    onReset={() => setPicked([])} resetDisabled={picked.length === 0}
    finished={done} foot={<ViewedFoot locale={document.locale} sequence={sequence} ready={done} />}>
    <section className="lf-learning-board lf-concept-board">
      <TradeOffChooser legend={t.choose} tokens={p.tokens} options={p.options} picked={picked} onChange={setPicked}
        labels={{ left: (n) => fill(t.tokensLeft, { n }), cost: (n) => fill(t.costs, { n }), gaveUp: t.gaveUp }} />
    </section>
  </BoardShell>;
}

/* Inflation: sliders, a near/far view, today versus later, and a sentence whose numbers are controls (patterns 1, 7, 14, 16). */
export function InflationBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.inflation.v2'>) {
  const t = conceptCopy[document.locale];
  const p = segment.payload;
  const money = conceptMoney(document.locale, p.currency);
  const percent = conceptPercent(document.locale);
  const [rate, setRate] = useState(p.min_rate_bps);
  const [years, setYears] = useState(p.min_years);
  const [scale, setScale] = useState<'near' | 'far'>('near');
  const [later, setLater] = useState(false);
  const [guess, setGuess] = useState(p.price_minor);
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server';
  const hide = graded && !grading.met;
  const extent = scale === 'near' ? Math.min(5, p.max_years) : p.max_years;
  const series = useMemo(() => Array.from({ length: extent + 1 }, (_, year) => compoundValue(p.price_minor, rate, year)), [extent, p.price_minor, rate]);
  const cost = compoundValue(p.price_minor, rate, years);
  const top = compoundValue(p.price_minor, p.max_rate_bps, extent);
  const change = (id: string, value: number) => { grading.reset(); if (id === 'rate') setRate(value); else setYears(value); };
  const changed = rate !== p.min_rate_bps || years !== p.min_years || scale !== 'near' || later || guess !== p.price_minor;
  const reset = () => { grading.reset(); setRate(p.min_rate_bps); setYears(p.min_years); setScale('near'); setLater(false); setGuess(p.price_minor); };
  return <BoardShell screen="inflation" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={graded ? grading.met : true} verdict={verdictOf(grading)} onReset={reset} resetDisabled={!changed || grading.pending || grading.met}
    foot={graded ? <GradedFoot locale={document.locale} grading={grading} canCheck sequence={sequence} onCheck={() => grading.check({ rateBps: rate, years, predictionMinor: guess })} />
      : <ViewedFoot locale={document.locale} sequence={sequence} />}>
    <section className="lf-learning-board lf-concept-board" data-operation="operation.parameter-slider.v1">
      <ReactiveText labels={{ decrease: t.less, increase: t.more }} onChange={change} result={hide ? t.hidden : money(cost)} parts={[
        t.sentence[0], { id: 'rate', value: rate, min: p.min_rate_bps, max: p.max_rate_bps, step: p.rate_step_bps, label: t.rate, text: percent(rate) },
        t.sentence[1], { id: 'years', value: years, min: p.min_years, max: p.max_years, step: p.year_step, label: t.years, text: String(years) },
        t.sentence[2],
      ]} />
      <div data-operation="operation.scale-toggle.v1"><ScaleToggle legend={t.view} value={scale} onChange={setScale} options={[{ value: 'near', label: t.near }, { value: 'far', label: t.far }]} /></div>
      {/* GAP-FIX-R4 (B.7): the price line is the shared Pizarrón growth lines, with its table one press away. */}
      {hide ? null : <ChartOrTable labels={tableLabels(document.locale)}
        chart={<GrowthLinesVisual label={`${money(series[0]!)} → ${money(series[series.length - 1]!)}`} max={top}
          series={[{ id: 'price', label: t.price, values: series, endText: money(series[series.length - 1]!), series: 'sky' }]}
          startLabel={t.today} endLabel={fill(t.laterN, { n: extent })} maxText={money(top)} />}
        table={<DataTable label={t.growth} columns={[t.years, t.price]} rows={series.map((value, year) => ({ id: year, cells: [String(year), money(value)] }))} />} />}
      <BeforeAfter label={t.later} stateLabels={{ on: fill(t.laterN, { n: years }), off: t.today }} value={later} onChange={setLater}
        before={<p data-copy-role="data">{fill(t.costsThen, { x: money(p.price_minor) })}</p>}
        after={<p data-copy-role="data">{fill(t.costsThen, { x: hide ? t.hidden : money(cost) })}</p>} />
    </section>
    {graded ? <section className="lf-learning-control-strip">
      <Slider label={t.predict} valueText={money(guess)} min={p.price_minor} max={p.prediction_max_minor} step={p.prediction_step_minor} value={guess}
        onValueChange={(value) => { grading.reset(); setGuess(value); }} stepLabels={{ decrease: t.less, increase: t.more }} disabled={grading.met} />
    </section> : null}
  </BoardShell>;
}

/* Rule of 72: a rate slider and the doubling flag that appears where the curve crosses double (patterns 1 and 10). */
export function RuleOf72Board({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.rule-of-72.v2'>) {
  const t = conceptCopy[document.locale];
  const p = segment.payload;
  const percent = conceptPercent(document.locale);
  const [rate, setRate] = useState(p.min_rate_bps);
  const [guess, setGuess] = useState(10);
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server';
  const horizon = Math.min(100, Math.ceil(7_200 / p.min_rate_bps) + 4);
  const values = useMemo(() => Array.from({ length: horizon + 1 }, (_, year) => compoundValue(p.principal_minor, rate, year)), [horizon, p.principal_minor, rate]);
  const estimate = new Intl.NumberFormat(document.locale, { maximumFractionDigits: 1 }).format(7_200 / rate);
  const money = conceptMoney(document.locale, 'coins');
  const revealed = !graded || grading.met;
  return <BoardShell screen="rule-of-72" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={graded ? grading.met : true} verdict={verdictOf(grading)}
    onReset={() => { grading.reset(); setRate(p.min_rate_bps); setGuess(10); }} resetDisabled={(rate === p.min_rate_bps && guess === 10) || grading.pending || grading.met}
    foot={graded ? <GradedFoot locale={document.locale} grading={grading} canCheck sequence={sequence} onCheck={() => grading.check({ rateBps: rate, years: guess })} />
      : <ViewedFoot locale={document.locale} sequence={sequence} />}>
    <section className="lf-learning-board lf-concept-board" data-operation="operation.parameter-slider.v1">
      <Slider label={t.growthRate} valueText={fill(t.perYear, { n: percent(rate) })} min={p.min_rate_bps} max={p.max_rate_bps} step={p.rate_step_bps} value={rate}
        onValueChange={(value) => { grading.reset(); setRate(value); }} stepLabels={{ decrease: t.less, increase: t.more }} disabled={grading.met} />
      <p className="lf-concept-rule" data-copy-role="data">{fill(t.ruleEstimate, { n: estimate })}</p>
      <ChartOrTable labels={tableLabels(document.locale)}
        chart={<ThresholdPlot values={values} threshold={p.principal_minor * 2} max={Math.max(...values, p.principal_minor * 2)} revealed={revealed} title={t.growth}
          labels={{ threshold: t.doubleLine, crossed: (n) => fill(t.doublesAt, { n }), notYet: t.notYet }} />}
        // The table lists the growth, never the doubling year the learner is asked for until Core has met it.
        table={<DataTable label={t.growth} columns={[t.years, t.growth]} rows={values.map((value, year) => ({ id: year,
          cells: [String(year), revealed || value < p.principal_minor * 2 ? money(value) : t.hidden] }))} />} />
    </section>
    {graded ? <section className="lf-learning-control-strip">
      <Stepper label={t.guessYears} value={guess} min={1} max={100} onValueChange={(value) => { grading.reset(); setGuess(value); }} labels={{ decrease: t.less, increase: t.more }} disabled={grading.met} />
    </section> : null}
  </BoardShell>;
}

/* Debt payoff: both plans simulated side by side, the previous plan ghosted under the current one (patterns 5 and 15). */
export function DebtPayoffBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.debt-payoff.v2'>) {
  const t = conceptCopy[document.locale];
  const p = segment.payload;
  const money = conceptMoney(document.locale, p.currency);
  const debts = useMemo(() => p.debts.map((d) => ({ id: d.id, balance: d.balance_minor, rate_bps: d.rate_bps, minimum: d.minimum_minor })), [p.debts]);
  const runs = useMemo<Record<'snowball' | 'avalanche', PayoffResult>>(() => ({ snowball: payoff(debts, p.budget_minor, 'snowball'), avalanche: payoff(debts, p.budget_minor, 'avalanche') }), [debts, p.budget_minor]);
  const [chosen, setChosen] = useState<'snowball' | 'avalanche' | null>(null);
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server';
  const start = debts.reduce((sum, d) => sum + d.balance, 0);
  const trace = chosen ? [start, ...runs[chosen].balances] : [start];
  const ghost = useGhost(chosen ?? 'none', trace);
  const count = Math.max(runs.snowball.months, runs.avalanche.months) + 1;
  const firstName = (run: PayoffResult) => p.debts.find((d) => d.id === run.order[0])?.label ?? '';
  return <BoardShell screen="debt-payoff" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={graded ? grading.met : chosen !== null} verdict={verdictOf(grading)}
    onReset={() => { grading.reset(); setChosen(null); }} resetDisabled={chosen === null || grading.pending || grading.met}
    foot={graded ? <GradedFoot locale={document.locale} grading={grading} canCheck={chosen !== null} sequence={sequence} onCheck={() => grading.check({ strategy: chosen })} />
      : <ViewedFoot locale={document.locale} sequence={sequence} ready={chosen !== null} />}>
    <section className="lf-learning-board lf-concept-board">
      <WhatIfBranch legend={t.strategy} chosen={chosen} onChoose={(id) => { grading.reset(); setChosen(id); }} disabled={grading.met}
        branches={[{ id: 'snowball', label: t.snowball }, { id: 'avalanche', label: t.avalanche }]}
        render={(id) => <dl className="lf-concept-facts">
          <div><dt data-copy-role="data">{t.months}</dt><dd data-copy-role="data">{runs[id].months}</dd></div>
          <div><dt data-copy-role="data">{t.totalInterest}</dt><dd data-copy-role="data">{money(runs[id].totalInterest)}</dd></div>
          <div><dt data-copy-role="data">{t.firstPaid}</dt><dd data-copy-role="data">{`${firstName(runs[id])} · ${fill(t.monthN, { n: runs[id].firstClearMonth })}`}</dd></div>
        </dl>} />
      <ChartOrTable labels={tableLabels(document.locale)}
        chart={<GhostTracePlot current={trace} ghost={ghost} max={start} count={count} title={t.balanceTrace}
          labels={{ current: t.thisRun, ghost: t.ghost, summary: chosen ? fill(t.traceSummary, { n: runs[chosen].months }) : '' }} />}
        table={<DataTable label={t.balanceTrace} columns={[t.month, t.thisRun, ...(ghost ? [t.ghost] : [])]}
          rows={trace.map((value, month) => ({ id: month, cells: [String(month), money(value), ...(ghost ? [ghost[month] === undefined ? '' : money(ghost[month]!)] : [])] }))} />} />
    </section>
  </BoardShell>;
}

/** Moves one step of weight to or from the next asset with room, so the whole stays 100%. */
export function reallocate(weights: Record<string, number>, ids: readonly string[], id: string, direction: 1 | -1, step: number): Record<string, number> {
  const index = ids.indexOf(id);
  if (direction === -1 && (weights[id] ?? 0) < step) return weights;
  for (let offset = 1; offset < ids.length; offset += 1) {
    const other = ids[(index + offset) % ids.length]!;
    if (direction === 1 && (weights[other] ?? 0) >= step) return { ...weights, [id]: (weights[id] ?? 0) + step, [other]: weights[other]! - step };
    if (direction === -1) return { ...weights, [id]: weights[id]! - step, [other]: (weights[other] ?? 0) + step };
  }
  return weights;
}

/* Diversification: reallocate the whole; the risk/return point follows (patterns 3 and 2). */
export function DiversificationBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.diversification.v2'>) {
  const t = conceptCopy[document.locale];
  const p = segment.payload;
  const percent = conceptPercent(document.locale);
  const ids = p.assets.map((a) => a.id);
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(ids.map((id, index) => [id, index === 0 ? 100 : 0])));
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server';
  const point = portfolio(p.assets, weights);
  const maxRisk = Math.max(...p.assets.map((a) => a.risk_bps), 1); const maxReturn = Math.max(...p.assets.map((a) => a.return_bps), 1);
  const X = (risk: number) => risk / maxRisk * 0.9; const Y = (ret: number) => ret / maxReturn * 0.9;
  const initial = () => Object.fromEntries(ids.map((id, index) => [id, index === 0 ? 100 : 0]));
  const move = (id: string, value: number) => {
    grading.reset();
    const direction = value > (weights[id] ?? 0) ? 1 : -1;
    setWeights((current) => reallocate(current, ids, id, direction, p.step));
  };
  return <BoardShell screen="diversification" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={graded ? grading.met : true} verdict={verdictOf(grading)}
    onReset={() => { grading.reset(); setWeights(initial()); }} resetDisabled={weights[ids[0]!] === 100 || grading.pending || grading.met}
    foot={graded ? <GradedFoot locale={document.locale} grading={grading} canCheck sequence={sequence} onCheck={() => grading.check({ weights })} />
      : <ViewedFoot locale={document.locale} sequence={sequence} />}>
    <section className="lf-learning-board lf-concept-board">
      <div className="lf-concept-controls" data-operation="operation.reallocate.v1">
        {p.assets.map((asset) => <Stepper key={asset.id} label={fill(t.weight, { x: asset.label })} valuePlacement="label" value={weights[asset.id] ?? 0} valueText={`${weights[asset.id] ?? 0}%`}
          min={0} max={100} step={p.step} onValueChange={(value) => move(asset.id, value)} labels={{ decrease: t.less, increase: t.more }} disabled={grading.met} />)}
        <p data-copy-role="data">{fill(t.total, { n: Object.values(weights).reduce((sum, w) => sum + w, 0) })}</p>
      </div>
      <figure className="lf-op" data-operation="operation.linked-representations.v1">
        <ChartOrTable labels={tableLabels(document.locale)}
          chart={<RiskReturnVisual label={`${t.portfolioPoint}. ${t.risk}: ${percent(point.riskBps)}. ${t.return}: ${percent(point.returnBps)}.`}
            xLabel={t.risk} yLabel={t.return} marked={{ x: X(point.riskBps), y: Y(point.returnBps) }}
            points={p.assets.map((asset) => ({ id: asset.id, label: asset.label, x: X(asset.risk_bps), y: Y(asset.return_bps) }))} />}
          table={<DataTable label={t.portfolioPoint} columns={['', t.risk, t.return]} rows={[
            ...p.assets.map((asset) => ({ id: asset.id, cells: [asset.label, percent(asset.risk_bps), percent(asset.return_bps)] })),
            { id: 'mix', cells: [t.portfolioPoint, percent(point.riskBps), percent(point.returnBps)] }]} />} />
        <figcaption className="lf-op-status" aria-live="polite" data-copy-role="data">{`${t.risk}: ${percent(point.riskBps)} · ${t.return}: ${percent(point.returnBps)}`}</figcaption>
      </figure>
    </section>
  </BoardShell>;
}

/* Lemonade stand: a guided sandbox with a running ledger and a sales-to-profit waterfall (patterns 8 and 13). */
export function LemonadeStandBoard({ document, segment, onBack, sequence, onGrade }: BoardProps<'money.lemonade-stand.v2'>) {
  const t = conceptCopy[document.locale];
  const p = segment.payload;
  const money = conceptMoney(document.locale, p.currency);
  const [price, setPrice] = useState(0);
  const [cups, setCups] = useState(0);
  const [days, setDays] = useState<Array<{ day: number; price: number; cups: number; sold: number; profit: number }>>([]);
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server';
  const today = lemonadeDay(p, price, cups);
  const last = days[days.length - 1];
  const lastDay = last ? lemonadeDay(p, last.price, last.cups) : null;
  const demand = last ? Math.max(0, p.demand_at_zero - p.cups_lost_per_step * (last.price / p.price_step_minor)) : 0;
  const running = days.reduce((sum, d) => sum + d.profit, 0);
  const major = (minor: number) => p.currency === 'local' ? minor / 100 : minor;
  const open = () => { grading.reset(); setDays((current) => [...current, { day: current.length + 1, price, cups, sold: today.sold, profit: today.profit }].slice(-30)); };
  return <BoardShell screen="lemonade-stand" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={graded ? grading.met : days.length > 0} verdict={verdictOf(grading)}
    onReset={() => { grading.reset(); setPrice(0); setCups(0); setDays([]); }} resetDisabled={(price === 0 && cups === 0 && days.length === 0) || grading.pending || grading.met}
    foot={graded ? <GradedFoot locale={document.locale} grading={grading} canCheck={days.length > 0} sequence={sequence} onCheck={() => grading.check({ price, cups })} />
      : <ViewedFoot locale={document.locale} sequence={sequence} ready={days.length > 0} />}>
    <section className="lf-learning-board lf-concept-board">
      <GuidedSandbox cues={[
        { id: 'leftover', text: t.cueLeftover, active: !!last && last.sold < last.cups },
        { id: 'waiting', text: t.cueWaiting, active: !!last && last.sold === last.cups && demand > last.cups },
        { id: 'loss', text: t.cueLoss, active: !!last && last.profit < 0 },
      ]}>
        <div className="lf-concept-controls">
          <Stepper label={t.price} valuePlacement="label" value={price} valueText={money(price)} min={0} max={p.max_price_minor} step={p.price_step_minor}
            onValueChange={(value) => { grading.reset(); setPrice(value); }} labels={{ decrease: t.less, increase: t.more }} disabled={grading.met} />
          <Stepper label={t.cups} valuePlacement="label" value={cups} min={0} max={p.max_cups} onValueChange={(value) => { grading.reset(); setCups(value); }}
            labels={{ decrease: t.less, increase: t.more }} disabled={grading.met} />
          <Button variant="sky" onClick={open} disabled={grading.met}>{t.openStand}</Button>
        </div>
      </GuidedSandbox>
      {lastDay ? <TeachingChart kind="waterfall" title={t.waterfall} locale={document.locale} data={{
        unit: p.currency, categories: [{ id: 'step-revenue', label: t.revenue }, { id: 'step-cups', label: t.cupCost }, { id: 'step-stand', label: t.fixed }],
        series: [{ id: 'series-day', label: t.profit, values: [major(lastDay.revenue), -major(lastDay.cupCost), -major(lastDay.fixed)] }],
      }} /> : null}
      {days.length > 0 ? <table className="lf-learning-table" aria-label={t.ledger} data-operation="operation.running-ledger.v1">
        <thead><tr><th scope="col" data-copy-role="data">{fill(t.day, { n: '' }).trim()}</th><th scope="col" data-copy-role="data">{t.sold}</th>
          <th scope="col" data-copy-role="data">{t.profit}</th><th scope="col" data-copy-role="data">{t.running}</th></tr></thead>
        <tbody>{days.map((d, index) => <tr key={d.day}><th scope="row" data-copy-role="data">{fill(t.day, { n: d.day })}</th><td data-copy-role="data">{d.sold}</td>
          <td data-copy-role="data">{money(d.profit)}</td><td data-copy-role="data">{money(days.slice(0, index + 1).reduce((sum, e) => sum + e.profit, 0))}</td></tr>)}</tbody>
      </table> : null}
      <p className="lf-op-status" aria-live="polite" data-copy-role="data">{days.length > 0 ? `${t.running}: ${money(running)}` : ''}</p>
    </section>
  </BoardShell>;
}

