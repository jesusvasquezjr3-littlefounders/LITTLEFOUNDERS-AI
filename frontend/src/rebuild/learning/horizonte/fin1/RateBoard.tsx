import { useMemo, useState, type ReactNode } from 'react';
import { Button, Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, NumberAnswer, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { Locale } from '../../../design/copyBudget';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { FIN1_COPY } from './copy';
import { CHART, fill, money, percent, plot, polyline, spokenMoney, spokenPercent, thin } from './format';
import { cardRows, discountedCents, npvAtBps, periodBalanceCents, type RatePayload } from './model.generated';
import '../horizonte.css';
import './Fin1Boards.css';

type RateSegment = Extract<HorizonteSegment, { type: 'money.rate-return.v2' }>;
type Text = { readonly [K in keyof typeof FIN1_COPY]: string };

type CardRows = NonNullable<ReturnType<typeof cardRows>>;
const START_CENTS = 10_000;
const IRR_DIAL_MAX = 1000;
const NPV_RATE_MAX = 3000;
const PLOT_HEIGHT = CHART.height - CHART.top - CHART.bottom;
const FLOOR = CHART.height - CHART.bottom;

interface View {
  slider: { label: string; valueText: string; min: number; max: number; step: number };
  info: string[];
  readout: { text: string; role: 'data' | 'body' }[];
  chartLabel: string;
  chart: ReactNode;
  legend: { swatch: string; text: string }[];
  status: string;
  caption: string;
  head: string[];
  rows: string[][];
  answer: { label: string; min: number; max: number; whole: boolean };
  named: { met: string; hint: string };
}

/** The step of the discount-rate dial: a multiple of 50 basis points when the task rate allows it, so the task rate is on the dial. */
const npvStep = (rateBps: number): number => (rateBps % 50 === 0 ? 50 : rateBps % 10 === 0 ? 10 : 1);
const initialPosition = (p: RatePayload): number => (p.kind === 'npv' ? p.rateBps : 0);

const axis = () => <line className="lf-fin-axis" x1={CHART.left} y1={FLOOR} x2={CHART.width - CHART.right} y2={FLOOR} />;
const marker = (x: number, y: number) => <circle className="lf-fin-marker" cx={x} cy={y} r="5" />;

/*
 * F2.12: one board, four kinds. Each kind is a scrub or a dial over a model figure and ends in a typed number:
 *  - effective: scrub the compounding periods of one year to see a balance grow; type the effective annual rate.
 *  - card: scrub the months of minimum payments; type the months to pay off, or the interest paid.
 *  - npv: slide the discount rate to watch each payment shrink to its worth today; type the net value at the task rate.
 *  - irr: dial a trial rate and read the net value and its sign; type the rate where it reaches zero.
 * Every figure comes from the pure model in whole cents and basis points; the chart has a text line and a table beside it.
 * The answer is `{ value, final: true }`; Core holds the key.
 */
function Rate({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: RateSegment }) {
  const locale = document.locale;
  const t = copyText(FIN1_COPY, locale);
  const p = segment.payload as RatePayload;
  const [pos, setPos] = useState<number>(() => initialPosition(p));
  const [text, setText] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;

  const balances = useMemo(() => p.kind === 'effective'
    ? Array.from({ length: p.periodsPerYear + 1 }, (_, period) => periodBalanceCents(START_CENTS, p.nominalBps, p.periodsPerYear, period) ?? START_CENTS) : [], [p]);
  const schedule = useMemo(() => (p.kind === 'card' ? cardRows(p) ?? [] : []), [p]);
  const view = buildView(p, pos, t, locale, balances, schedule);
  const changed = text !== '' || pos !== initialPosition(p);

  const reset = () => { grading.reset(); setPos(initialPosition(p)); setText(''); setValue(null); };
  const stepLabels = { decrease: t.less, increase: t.more };

  return <BoardShell screen="rate-return" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={value !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={view.named} onCheck={() => grading.check({ value, final: true })} />}>
    <section className="lf-learning-board lf-fin" aria-label={view.caption}>
      <div className="lf-fin-info">{view.info.map((line) => <p key={line} data-copy-role="data">{line}</p>)}</div>
      <svg className="lf-fin-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={view.chartLabel}>{view.chart}</svg>
      {view.legend.length > 0 ? <div className="lf-fin-legend" data-copy-role="data">
        {view.legend.map((item) => <span key={item.text}><i className={`lf-fin-swatch ${item.swatch}`} aria-hidden="true" />{item.text}</span>)}
      </div> : null}
      <div className="lf-fin-info">{view.readout.map((line) => <p key={line.text} data-copy-role={line.role}>{line.text}</p>)}</div>
      <p className="lf-fin-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{view.status}</p>
      {table ? <div className="lf-fin-table-wrap"><table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{view.caption}</caption>
        <thead><tr>{view.head.map((label) => <th key={label} scope="col" data-copy-role="data">{label}</th>)}</tr></thead>
        <tbody>{view.rows.map((row) => <tr key={row[0]}>
          {row.map((cell, index) => (index === 0
            ? <th key={`${row[0]}-${index}`} scope="row" data-copy-role="data">{cell}</th>
            : <td key={`${row[0]}-${index}`} data-copy-role="data">{cell}</td>))}
        </tr>)}</tbody>
      </table></div> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={view.slider.label}>
      <Slider label={view.slider.label} valueText={view.slider.valueText} min={view.slider.min} max={view.slider.max} step={view.slider.step} value={pos}
        onValueChange={(next) => { grading.reset(); setPos(next); }} disabled={locked} stepLabels={stepLabels} />
    </section>
    <section className="lf-learning-control-strip lf-fin-answer" aria-label={view.answer.label}>
      <NumberAnswer label={view.answer.label} locale={locale} value={text} onTextChange={(next) => { grading.reset(); setText(next); }} onChange={setValue}
        whole={view.answer.whole} min={view.answer.min} max={view.answer.max} disabled={locked} />
    </section>
  </BoardShell>;
}

function buildView(p: RatePayload, pos: number, t: Text, locale: Locale, balances: number[], schedule: CardRows): View {
  switch (p.kind) {
    case 'effective': return effectiveView(p, pos, t, locale, balances);
    case 'card': return cardView(p, pos, t, locale, schedule);
    case 'npv': return npvView(p, pos, t, locale);
    case 'irr': return irrView(p, pos, t, locale);
  }
}

function effectiveView(p: Extract<RatePayload, { kind: 'effective' }>, pos: number, t: Text, locale: Locale, balances: number[]): View {
  const m = p.periodsPerYear;
  const period = Math.min(pos, m);
  const balance = balances[period] ?? START_CENTS;
  const top = balances[m] ?? START_CENTS;
  const points = thin(balances.map((cents, index) => ({ index, cents })), 60).map((point) => plot(CHART, point.index, point.cents, m, top, START_CENTS));
  const here = plot(CHART, period, balance, m, top, START_CENTS);
  const periodText = fill(t.efPeriodValue, { n: period, m });
  const balanceText = fill(t.efBalance, { amount: money(balance, locale) });
  const gainedText = fill(t.efGained, { amount: money(balance - START_CENTS, locale) });
  const marks = thin(Array.from({ length: m + 1 }, (_, index) => index), 7);
  return {
    slider: { label: t.efPeriod, valueText: periodText, min: 0, max: m, step: 1 },
    info: [fill(t.efNominal, { rate: percent(p.nominalBps, locale), n: m }), fill(t.efStart, { amount: money(START_CENTS, locale) })],
    readout: [{ text: periodText, role: 'data' }, { text: balanceText, role: 'data' }, { text: gainedText, role: 'data' }],
    chartLabel: fill(t.efChartLabel, { start: spokenMoney(START_CENTS, locale), n: period, m, balance: spokenMoney(balance, locale) }),
    chart: <>{axis()}<polyline className="lf-fin-line lf-fin-line--main" points={polyline(points)} />{marker(here.x, here.y)}</>,
    legend: [],
    status: `${periodText}. ${balanceText}. ${gainedText}`,
    caption: t.efTableCaption,
    head: [t.efColPeriod, t.efColBalance],
    rows: marks.map((index) => [String(index), money(balances[index] ?? START_CENTS, locale)]),
    answer: { label: t.efAnswer, min: 0, max: 1000, whole: false },
    named: { met: t.efMet, hint: t.efHint },
  };
}

function cardView(p: Extract<RatePayload, { kind: 'card' }>, pos: number, t: Text, locale: Locale, schedule: CardRows): View {
  const last = Math.max(0, schedule.length - 1);
  const month = Math.min(pos, last);
  const row = schedule[month] ?? { month: 0, balanceCents: p.balanceCents, interestPaidCents: 0, paidCents: 0 };
  const end = schedule[last] ?? row;
  const maxY = Math.max(p.balanceCents, end.interestPaidCents, 1);
  const series = thin(schedule, 60);
  const owedLine = polyline(series.map((point) => plot(CHART, point.month, point.balanceCents, last, maxY)));
  const interestLine = polyline(series.map((point) => plot(CHART, point.month, point.interestPaidCents, last, maxY)));
  const here = plot(CHART, month, row.balanceCents, last, maxY);
  const monthText = fill(t.cdMonthValue, { n: month });
  const owedText = row.balanceCents === 0 ? t.cdZero : fill(t.cdNow, { amount: money(row.balanceCents, locale) });
  const interestText = fill(t.cdInterest, { amount: money(row.interestPaidCents, locale) });
  const paidText = fill(t.cdPaid, { amount: money(row.paidCents, locale) });
  const marks = schedule.filter((point) => point.month % 12 === 0 || point.month === last);
  const months = p.ask === 'months';
  return {
    slider: { label: t.cdMonth, valueText: monthText, min: 0, max: last, step: 1 },
    info: [fill(t.cdOwed, { amount: money(p.balanceCents, locale), rate: percent(p.aprBps, locale) })],
    readout: [{ text: monthText, role: 'data' }, { text: owedText, role: row.balanceCents === 0 ? 'body' : 'data' }, { text: interestText, role: 'data' }, { text: paidText, role: 'data' }],
    chartLabel: fill(t.cdChartLabel, { n: month, balance: spokenMoney(row.balanceCents, locale), interest: spokenMoney(row.interestPaidCents, locale) }),
    chart: <>{axis()}<polyline className="lf-fin-line lf-fin-line--interest" points={interestLine} /><polyline className="lf-fin-line lf-fin-line--main" points={owedLine} />{marker(here.x, here.y)}</>,
    legend: [{ swatch: '', text: t.cdLegendOwed }, { swatch: 'lf-fin-swatch--interest', text: t.cdLegendInterest }],
    status: `${monthText}. ${owedText} ${interestText}. ${paidText}`,
    caption: t.cdTableCaption,
    head: [t.cdColMonth, t.cdColOwed, t.cdColInterest],
    rows: marks.map((point) => [String(point.month), money(point.balanceCents, locale), money(point.interestPaidCents, locale)]),
    answer: months ? { label: t.cdAnswerMonths, min: 0, max: 600, whole: true } : { label: t.cdAnswerInterest, min: 0, max: 1_000_000, whole: false },
    named: months ? { met: t.cdMetMonths, hint: t.cdHintMonths } : { met: t.cdMetInterest, hint: t.cdHintInterest },
  };
}

function npvView(p: Extract<RatePayload, { kind: 'npv' }>, pos: number, t: Text, locale: Locale): View {
  const rate = Math.min(pos, NPV_RATE_MAX);
  const items = p.flowsCents.map((cents, index) => ({ year: index + 1, cents, worth: discountedCents(rate, index + 1, cents) ?? 0 }));
  const maxY = Math.max(1, ...items.map((item) => item.cents));
  const group = (CHART.width - CHART.left - CHART.right) / items.length;
  const barWidth = Math.min(34, group / 2 - 4);
  const height = (cents: number) => Math.max(1, Math.round((cents / maxY) * PLOT_HEIGHT));
  const list = items.map((item) => fill(t.npListItem, { n: item.year, cash: money(item.cents, locale), worth: money(item.worth, locale) })).join('; ');
  const spokenList = items.map((item) => fill(t.npListItem, { n: item.year, cash: spokenMoney(item.cents, locale), worth: spokenMoney(item.worth, locale) })).join('; ');
  return {
    slider: { label: t.npRate, valueText: percent(rate, locale), min: 0, max: NPV_RATE_MAX, step: npvStep(p.rateBps) },
    info: [fill(t.npTask, { rate: percent(p.rateBps, locale) }), fill(t.npOutlay, { amount: money(p.outlayCents, locale) })],
    readout: [],
    chartLabel: fill(t.npChartLabel, { rate: spokenPercent(rate, locale), list: spokenList }),
    chart: <>{axis()}{items.map((item, index) => {
      const x = CHART.left + index * group + group / 2;
      return <g key={item.year}>
        <rect className="lf-fin-bar--cash" x={x - barWidth - 1} y={FLOOR - height(item.cents)} width={barWidth} height={height(item.cents)} />
        <rect className="lf-fin-bar--worth" x={x + 1} y={FLOOR - height(item.worth)} width={barWidth} height={height(item.worth)} />
      </g>;
    })}</>,
    legend: [{ swatch: 'lf-fin-swatch--cash', text: t.npLegendCash }, { swatch: 'lf-fin-swatch--worth', text: t.npLegendWorth }],
    status: list,
    caption: t.npTableCaption,
    head: [t.npColYear, t.npColCash, t.npColWorth],
    rows: items.map((item) => [String(item.year), money(item.cents, locale), money(item.worth, locale)]),
    answer: { label: t.npAnswer, min: -100_000, max: 1_000_000, whole: false },
    named: { met: t.npMet, hint: t.npHint },
  };
}

function irrView(p: Extract<RatePayload, { kind: 'irr' }>, pos: number, t: Text, locale: Locale): View {
  const dial = Math.min(pos, IRR_DIAL_MAX);
  const bps = dial * 10;
  const net = npvAtBps(bps, p.outlayCents, p.flowsCents) ?? 0;
  const samples = Array.from({ length: 21 }, (_, step) => ({ percent: step * 5, cents: npvAtBps(step * 500, p.outlayCents, p.flowsCents) ?? 0 }));
  const minY = Math.min(0, ...samples.map((point) => point.cents));
  const maxY = Math.max(0, ...samples.map((point) => point.cents));
  const curve = polyline(samples.map((point) => plot(CHART, point.percent, point.cents, 100, maxY, minY)));
  const zeroY = plot(CHART, 0, 0, 100, maxY, minY).y;
  const here = plot(CHART, dial / 10, net, 100, maxY, minY);
  const sign = net > 0 ? t.irAbove : net < 0 ? t.irBelow : t.irAt;
  const hereText = fill(t.irHere, { rate: percent(bps, locale), amount: money(net, locale) });
  const flows = p.flowsCents.map((cents, index) => `${fill(t.npYear, { n: index + 1 })}: ${money(cents, locale)}`).join('; ');
  return {
    slider: { label: t.irDial, valueText: percent(bps, locale), min: 0, max: IRR_DIAL_MAX, step: 1 },
    info: [fill(t.npOutlay, { amount: money(p.outlayCents, locale) }), flows],
    readout: [{ text: hereText, role: 'data' }, { text: sign, role: 'body' }],
    chartLabel: fill(t.irChartLabel, { rate: spokenPercent(bps, locale), amount: spokenMoney(net, locale) }),
    chart: <><line className="lf-fin-axis" x1={CHART.left} y1={zeroY} x2={CHART.width - CHART.right} y2={zeroY} />
      <polyline className="lf-fin-line lf-fin-line--main" points={curve} />{marker(here.x, here.y)}</>,
    legend: [],
    status: `${hereText}. ${sign}`,
    caption: t.irTableCaption,
    head: [t.irColRate, t.irColValue],
    rows: samples.filter((point) => point.percent % 10 === 0).map((point) => [percent(point.percent * 100, locale), money(point.cents, locale)]),
    answer: { label: t.irAnswer, min: 0, max: 100, whole: false },
    named: { met: t.irMet, hint: t.irHint },
  };
}

export default function RateBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'money.rate-return.v2' ? <Rate segment={segment} {...rest} /> : null;
}
