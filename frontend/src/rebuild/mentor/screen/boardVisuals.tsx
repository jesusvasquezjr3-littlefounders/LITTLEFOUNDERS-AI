import type { ReactElement } from 'react';
import {
  ArrayVisual, BalanceScaleVisual, BarModelVisual, BeadStringVisual, CoinGroupsVisual, DealVisual, FillContainerVisual, FractionCellsVisual,
  FractionCircleVisual, GrowthLinesVisual, IconArrayVisual, LedgerVisual, NumberLineVisual, PictographVisual, RatioLinesVisual, SeriesBarsVisual,
  SortBinsVisual, TallyVisual, TenFrameVisual, TextCardsVisual, VennVisual, WaffleVisual, WorkedStepsVisual, seriesTone,
  type PizarronVisualName, type TapeSegment,
} from '../../learning/pizarron';
import type { TutorWhiteboardWire } from '../session/types';
import type { BoardFormat, BoardModel, BoardWords } from './boardModel';

/*
 * THE MENTOR'S BOARD DRAWS WITH THE LESSONS' VISUALS (product B.7 "one
 * component set"; Frontend Bible 08 §2 layer 4, 05).
 *
 * Every Oracle whiteboard kind maps to the shared Pizarrón visual that draws
 * that concept (`learning/pizarron`): a number line for a number line, a tape
 * for a bar model, ratio lines for unit prices, a running ledger for a ledger,
 * a ten frame for a ten frame. Values are Oracle's server-computed figures,
 * passed read-only: nothing here adds, subtracts or divides anything a learner
 * reads (a share of the board's width is drawing, not arithmetic). The table
 * view (`boardModel` rows in `TeachingChartBoard`) stays the accessible
 * alternative.
 *
 * `BOARD_RENDERERS` is the manifest the whiteboard parity gate reads
 * (agent/tools/check-instrument-parity.mjs): every wire kind must name a
 * visual exported by `learning/pizarron`.
 */

type Kind = TutorWhiteboardWire['kind'];

export const BOARD_RENDERERS = {
  sequence: 'GrowthLinesVisual',
  compare: 'BarModelVisual',
  marked_line: 'NumberLineVisual',
  categories: 'WaffleVisual',
  tokens: 'CoinGroupsVisual',
  bar_model: 'BarModelVisual',
  part_whole: 'BarModelVisual',
  flow: 'BarModelVisual',
  goal_bar: 'BarModelVisual',
  worked: 'WorkedStepsVisual',
  ten_frame: 'TenFrameVisual',
  open_number_line: 'NumberLineVisual',
  array: 'ArrayVisual',
  fraction_strip: 'FractionCellsVisual',
  partition: 'BarModelVisual',
  table: 'RatioLinesVisual',
  scale: 'BalanceScaleVisual',
  two_bins: 'SortBinsVisual',
  venn: 'VennVisual',
  ranking: 'SeriesBarsVisual',
  outcomes: 'TextCardsVisual',
  trade: 'TextCardsVisual',
  chance: 'IconArrayVisual',
  deal: 'DealVisual',
  change: 'BarModelVisual',
  regroup: 'CoinGroupsVisual',
  equation_bar: 'BarModelVisual',
  receipt: 'BarModelVisual',
  ledger: 'LedgerVisual',
  price_tag: 'TextCardsVisual',
  inventory: 'BarModelVisual',
  budget_plate: 'BarModelVisual',
  pictograph: 'PictographVisual',
  bead_string: 'BeadStringVisual',
  tally: 'TallyVisual',
  fraction_circle: 'FractionCircleVisual',
  stack: 'BarModelVisual',
  sequence_compare: 'GrowthLinesVisual',
  timeline: 'NumberLineVisual',
  cycle: 'WorkedStepsVisual',
  before_after: 'BarModelVisual',
  grab: 'SortBinsVisual',
  fill: 'FillContainerVisual',
  whatif: 'GrowthLinesVisual',
  your_turn: 'GrowthLinesVisual',
} as const satisfies Record<Kind, PizarronVisualName>;

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);

/** The static chart's description: the title, then every row of the table, in order (05 §4: type → values → takeaway). */
export function boardDescription(model: BoardModel): string {
  return [model.title, ...model.rows.map((row) => `${row.label}: ${row.value}`)].join('. ');
}

/** Learner state an interactive board passes in: the chosen branch, the values shown, the amount filled, the items placed. */
export interface BoardVisualState { chosen?: number; shown?: number; filled?: number; placed?: Record<number, string> }

export function BoardVisual({ board, model, words, format, state = {} }: {
  board: TutorWhiteboardWire; model: BoardModel; words: BoardWords; format: BoardFormat; state?: BoardVisualState;
}): ReactElement {
  const label = boardDescription(model);
  const step = (unit: 'day' | 'week' | 'month' | 'year', n: number) => fill(words.step[unit], { n });
  const share = (value: number, whole: number) => (whole > 0 ? value / whole : 0);
  const seg = (id: string, text: string, value: string, s: number, index: number, extra: Partial<TapeSegment> = {}): TapeSegment =>
    ({ id, label: text, value, share: s, series: seriesTone(index), ...extra });

  switch (board.kind) {
    case 'sequence': {
      const values = [board.start, ...board.values];
      return <GrowthLinesVisual label={label} startLabel={words.start} endLabel={step(board.unit, board.values.length)}
        maxText={format.money(Math.max(...values), board.currency)}
        series={[{ id: 's', label: model.title, values, endText: format.money(values[values.length - 1] ?? board.start, board.currency), series: 'sky' }]} />;
    }
    case 'compare': {
      const max = Math.max(board.left.value, board.right.value);
      return <BarModelVisual label={label} note={`${words.difference}: ${format.money(board.difference, board.currency)}`} rows={[
        { id: 'left', label: board.left.label, segments: [seg('l', board.left.label, format.money(board.left.value, board.currency), share(board.left.value, max), 0, { marked: board.greater === 'left' })] },
        { id: 'right', label: board.right.label, segments: [seg('r', board.right.label, format.money(board.right.value, board.currency), share(board.right.value, max), 1, { marked: board.greater === 'right' })] },
      ]} />;
    }
    case 'marked_line':
      return <NumberLineVisual label={label} minLabel={format.money(board.min, board.currency)} maxLabel={format.money(board.max, board.currency)}
        marks={board.marks.map((mark, i) => ({ id: String(i), position: mark.position, label: `${mark.label} ${format.money(mark.value, board.currency)}` }))} />;
    case 'categories': {
      const values = board.categories.map((c, i) => board.values[i] ?? c.value);
      const whole = values.reduce((a, b) => a + b, 0);
      return <WaffleVisual label={label} categories={board.categories.map((c, i) => ({
        id: String(i), label: c.label, value: format.money(values[i] ?? 0, board.currency), share: share(values[i] ?? 0, whole), series: seriesTone(i),
      }))} />;
    }
    case 'tokens':
      return <CoinGroupsVisual label={label} total={`${words.total}: ${format.money(board.total, board.currency)}`}
        groups={board.groups.map((g, i) => ({ id: String(i), label: format.money(g.denomination, board.currency), count: g.count, subtotal: format.money(board.subtotals[i] ?? 0, board.currency) }))} />;
    case 'bar_model':
      return <BarModelVisual label={label} rows={[
        { id: 'whole', label: board.whole.label, segments: [seg('w', board.whole.label, format.money(board.whole.value, board.currency), 1, 0)] },
        { id: 'parts', label: board.parts.map((p) => p.label).join(' + '), segments: board.parts.map((p, i) => seg(String(i), p.label,
          p.value === null ? words.unknown : format.money(p.value, board.currency), board.widths[i] ?? 0, i, { unknown: board.unknownIndex === i })) },
      ]} />;
    case 'part_whole':
      return <BarModelVisual label={label} rows={[
        { id: 'whole', label: board.whole.label, segments: [seg('w', board.whole.label, format.money(board.whole.value, board.currency), 1, 0)] },
        { id: 'parts', label: `${board.left.label} + ${board.right.label}`, segments: [
          seg('l', board.left.label, format.money(board.left.value, board.currency), share(board.left.value, board.whole.value), 1),
          seg('r', board.right.label, format.money(board.right.value, board.currency), share(board.right.value, board.whole.value), 2),
        ] },
      ]} />;
    case 'flow':
      return <BarModelVisual label={label} rows={[
        { id: 'income', label: board.income.label, segments: [seg('i', board.income.label, format.money(board.income.value, board.currency), 1, 0)] },
        { id: 'split', label: `${board.spent.label} + ${board.keptLabel}`, segments: [
          seg('s', board.spent.label, format.money(board.spent.value, board.currency), share(board.spent.value, board.income.value), 2),
          seg('k', board.keptLabel, format.money(board.kept, board.currency), share(board.kept, board.income.value), 1, { marked: true }),
        ] },
      ]} />;
    case 'goal_bar':
      return <BarModelVisual label={label} note={`${board.saved.label}: ${format.percent(board.savedFraction)}`} rows={[
        { id: 'goal', label: board.goal.label, total: format.money(board.goal.value, board.currency), segments: [
          seg('saved', board.saved.label, format.money(board.saved.value, board.currency), board.savedFraction, 1),
          seg('remaining', words.remaining, format.money(board.remaining, board.currency), 1 - board.savedFraction, 0),
        ] },
      ]} />;
    case 'worked':
      return <WorkedStepsVisual label={label} steps={[
        { id: 'start', marker: '0', expression: words.start, result: format.money(board.start, board.currency), state: 'complete' },
        ...board.steps.map((s, i) => ({
          id: String(i), marker: String(i + 1), state: 'complete' as const,
          expression: `${format.money(i === 0 ? board.start : (board.values[i - 1] ?? 0), board.currency)} ${s.op === 'subtract' ? '−' : '+'} ${format.money(s.value, board.currency)}`,
          result: format.money(board.values[i] ?? 0, board.currency),
        })),
        { id: 'check', marker: '✓', expression: words.check, result: format.money(board.checkValue, board.currency), state: 'active' },
      ]} />;
    case 'ten_frame':
      return <TenFrameVisual label={label} frames={board.frames} total={`${words.total}: ${format.number(board.count)}`} />;
    case 'open_number_line': {
      const positions = board.positions;
      return <NumberLineVisual label={label} minLabel={format.money(board.from, board.currency)} maxLabel={format.money(board.to, board.currency)}
        marks={board.stops.map((stop, i) => ({ id: String(i), position: positions[i] ?? 0, label: format.money(stop, board.currency), marked: i === board.stops.length - 1 }))}
        jumps={board.jumps.map((jump, i) => ({ id: String(i), from: i === 0 ? 0 : (positions[i - 1] ?? 0), to: positions[i] ?? 0, label: `+${format.money(jump.value, board.currency)}` }))} />;
    }
    case 'array':
      return <ArrayVisual label={label} rows={board.rows} columns={board.columns} caption={[
        `${board.rows} × ${board.columns} = ${fill(words.cells, { n: board.cells })}`,
        `${words.each}: ${format.money(board.unitValue, board.currency)}`,
        `${words.total}: ${format.money(board.total, board.currency)}`,
      ]} />;
    case 'fraction_strip':
      return <div className="lf-pz" data-pizarron-stack="fraction-strip">
        {board.rows.map((r, i) => <FractionCellsVisual key={i} label={`${r.highlighted}/${r.denominator}: ${format.percent(board.shares[i] ?? 0)}`}
          parts={r.denominator} shaded={r.highlighted} series={seriesTone(i)} />)}
      </div>;
    case 'partition':
      return <BarModelVisual label={label} rows={[
        { id: 'whole', label: words.whole, segments: [seg('w', words.whole, format.money(board.whole, board.currency), 1, 0)] },
        ...board.splits.map((s, i) => ({ id: String(i), label: `${s.label} (1/${s.denominator})`, segments: Array.from({ length: s.denominator }, (_, piece) =>
          seg(`${i}-${piece}`, s.label, format.money(board.pieceValues[i] ?? 0, board.currency), 1 / s.denominator, i + 1)) })),
      ]} />;
    case 'table':
      return <RatioLinesVisual label={label} groups={board.options.map((o, i) => ({
        id: String(i), title: `${o.label}${board.bestIndex === i ? ` · ${words.best}` : ''}`, marked: board.bestIndex === i,
        lines: [
          { id: 'units', label: words.units, ticks: [{ id: 'one', text: format.number(1) }, { id: 'units', text: format.number(o.units) }] },
          { id: 'price', label: words.price, ticks: [{ id: 'one', text: format.money(board.unitPrices[i] ?? 0, board.currency) }, { id: 'units', text: format.money(o.price, board.currency) }] },
        ],
        unit: { label: words.unitPrice, value: format.money(board.unitPrices[i] ?? 0, board.currency) },
      }))} />;
    case 'scale':
      return <BalanceScaleVisual label={label} tilt={board.tilt} difference={`${words.difference}: ${format.money(board.difference, board.currency)}`}
        left={{ label: board.left.label, value: format.money(board.left.value, board.currency) }}
        right={{ label: board.right.label, value: format.money(board.right.value, board.currency) }} />;
    case 'two_bins':
      return <SortBinsVisual label={label} bins={board.binLabels.map((bin, b) => ({
        id: String(b), label: bin, count: format.number(board.counts[b] ?? 0), items: board.items.filter((item) => item.bin === b).map((item) => item.label),
      }))} />;
    case 'venn': {
      const items = (side: 'left' | 'right' | 'both') => board.items.filter((item) => item.side === side).map((item) => item.label);
      return <VennVisual label={label} leftLabel={board.leftLabel} rightLabel={board.rightLabel} bothLabel={words.both} regions={{
        left: { count: format.number(board.left), items: items('left') },
        both: { count: format.number(board.both), items: items('both') },
        right: { count: format.number(board.right), items: items('right') },
      }} />;
    }
    case 'ranking':
      return <SeriesBarsVisual label={label} rows={board.order.map((index, place) => {
        const item = board.items[index];
        return { id: String(place), label: `${place + 1}. ${item?.label ?? words.unknown}`, value: format.money(item?.value ?? 0, board.currency), amount: item?.value ?? 0, series: 'sky' as const };
      })} />;
    case 'outcomes':
      return <TextCardsVisual label={label} cards={[
        { id: 'good', title: `${words.good}: ${board.good.label}`, lines: [board.good.detail] },
        { id: 'bad', title: `${words.bad}: ${board.bad.label}`, lines: [board.bad.detail] },
      ]} />;
    case 'trade':
      return <TextCardsVisual label={label} joiner="⇄" cards={[board.left, board.right].map((side, i) => ({
        id: String(i), title: side.who, lines: [`${words.gives}: ${side.gives}`, `${words.gets}: ${side.gets}`],
      }))} />;
    case 'chance':
      return <IconArrayVisual label={label} outcomes={board.outcomes.map((o, i) => {
        const count = Math.round((board.shares[i] ?? 0) * 100);
        return { id: String(i), label: o.label, count, countText: `${count} / 100`, series: seriesTone(i) };
      })} />;
    case 'deal':
      return <DealVisual label={label} bins={board.bins} perBin={board.perBin} remainder={board.remainder} remainderLabel={words.remainder}
        total={`${words.total}: ${format.number(board.total)}`} />;
    case 'change':
      return <BarModelVisual label={label} rows={[
        { id: 'paid', label: words.paid, total: format.money(board.paid, board.currency), segments: [
          seg('price', words.price, format.money(board.price, board.currency), share(board.price, board.paid), 0),
          seg('change', words.change, format.money(board.change, board.currency), share(board.change, board.paid), 1, { marked: true }),
        ] },
      ]} />;
    case 'regroup':
      return <CoinGroupsVisual label={label} arrow groups={[
        { id: 'from', label: format.money(board.fromDenomination, board.currency), count: board.fromCount },
        { id: 'into', label: format.money(board.intoDenomination, board.currency), count: board.intoCount },
      ]} />;
    case 'equation_bar':
      return <BarModelVisual label={label} note={`${words.total}: ${format.money(board.total, board.currency)}`} rows={[
        { id: 'left', label: board.left.map((p) => p.label).join(' + '), segments: board.left.map((p, i) => seg(`l${i}`, p.label, format.money(p.value, board.currency), share(p.value, board.total), i)) },
        { id: 'right', label: board.right.map((p) => p.label).join(' + '), segments: board.right.map((p, i) => seg(`r${i}`, p.label, format.money(p.value, board.currency), share(p.value, board.total), i)) },
      ]} />;
    case 'receipt':
      return <BarModelVisual label={label} rows={[{ id: 'receipt', label: words.total, total: format.money(board.total, board.currency),
        segments: board.lines.map((l, i) => seg(String(i), l.label, format.money(l.value, board.currency), share(l.value, board.total), i)) }]} />;
    case 'ledger':
      return <LedgerVisual label={label} inLabel="+" outLabel="−" entries={[
        ...board.entries.map((e, i) => ({ id: String(i), label: e.label, change: format.money(e.amount, board.currency), direction: e.direction,
          balance: board.balances[i] ?? 0, balanceText: `${words.balance}: ${format.money(board.balances[i] ?? 0, board.currency)}` })),
      ].map((entry, i, all) => (i === all.length - 1 ? { ...entry, marked: true } : entry))} />;
    case 'price_tag':
      return <TextCardsVisual label={label} cards={[{ id: 'tag', title: board.item, marked: true, lines: [
        `${format.money(board.price, board.currency)} / ${format.number(board.units)}`,
        ...(board.discountPercent !== null ? [`${words.discount}: ${format.percent(board.discountPercent / 100)}`] : []),
        `${words.unitPrice}: ${format.money(board.unitPrice, board.currency)}`,
        `${words.finalPrice}: ${format.money(board.finalPrice, board.currency)}`,
      ] }]} />;
    case 'inventory':
      return <BarModelVisual label={label} rows={[{ id: 'stock', label: `${board.item}: ${words.start}`, total: format.number(board.start), segments: [
        seg('sold', words.sold, format.number(board.sold), share(board.sold, board.start), 0),
        seg('left', words.left, format.number(board.left), share(board.left, board.start), 1, { marked: true }),
      ] }]} />;
    case 'budget_plate': {
      const whole = Math.max(board.budget, board.spent);
      return <BarModelVisual label={label} note={board.overBy > 0 ? `${words.over}: ${format.money(board.overBy, board.currency)}` : `${words.remaining}: ${format.money(board.remaining, board.currency)}`}
        rows={[
          { id: 'budget', label: words.budget, segments: [seg('b', words.budget, format.money(board.budget, board.currency), share(board.budget, whole), 0)] },
          { id: 'spent', label: words.spent, total: format.money(board.spent, board.currency),
            segments: board.items.map((item, i) => seg(String(i), item.label, format.money(item.value, board.currency), share(item.value, whole), i + 1)) },
        ]} />;
    }
    case 'pictograph':
      return <PictographVisual label={label} keyText={`= ${format.money(board.unitValue, board.currency)}`}
        rows={board.rows.map((r, i) => ({ id: String(i), label: r.label, count: r.count, total: format.money(board.totals[i] ?? 0, board.currency) }))} />;
    case 'bead_string':
      return <BeadStringVisual label={label} rows={board.rows} total={`${words.total}: ${format.number(board.count)}`} />;
    case 'tally':
      return <TallyVisual label={label} rows={board.groups.map((g, i) => ({
        id: String(i), label: g.label, fives: board.fives[i]?.[0] ?? 0, ones: board.fives[i]?.[1] ?? 0, count: format.number(g.count),
      }))} />;
    case 'fraction_circle':
      return <FractionCircleVisual label={label} parts={board.denominator} shaded={board.highlighted} />;
    case 'stack':
      return <BarModelVisual label={label} rows={board.columns.map((c, i) => ({
        id: String(i), label: c.label, total: format.money(board.totals[i] ?? 0, board.currency),
        segments: c.parts.map((p, j) => seg(`${i}-${j}`, p.label, format.money(p.value, board.currency), share(p.value, board.max), j)),
      }))} />;
    case 'sequence_compare': {
      const series = board.tracks.map((track, t) => {
        const values = [track.start, ...(board.values[t] ?? [])];
        return { id: String(t), label: track.label, values, endText: format.money(values[values.length - 1] ?? track.start, board.currency), series: seriesTone(t) };
      });
      return <GrowthLinesVisual label={label} series={series} startLabel={words.start}
        endLabel={step(board.unit, Math.max(...series.map((s) => s.values.length - 1)))}
        maxText={format.money(Math.max(...series.flatMap((s) => s.values)), board.currency)} />;
    }
    case 'timeline':
      return <NumberLineVisual label={label} minLabel={step(board.unit, 1)} maxLabel={step(board.unit, board.span)}
        marks={board.events.map((e, i) => ({ id: String(i), position: board.positions[i] ?? 0, label: `${step(board.unit, e.at)}: ${e.label}` }))} />;
    case 'cycle':
      return <WorkedStepsVisual label={label} loop steps={board.steps.map((s, i) => ({ id: String(i), marker: String(i + 1), expression: s }))} />;
    case 'before_after': {
      const max = Math.max(board.before, board.after);
      return <BarModelVisual label={label}
        note={`${words.difference}: ${board.direction === 'down' ? '−' : board.direction === 'up' ? '+' : ''}${format.money(Math.abs(board.delta), board.currency)}`}
        rows={[
          { id: 'before', label: `${board.what}: ${words.before}`, segments: [seg('b', words.before, format.money(board.before, board.currency), share(board.before, max), 0)] },
          { id: 'after', label: words.after, segments: [seg('a', words.after, format.money(board.after, board.currency), share(board.after, max), 1)] },
        ]} />;
    }
    case 'grab':
      return <SortBinsVisual label={label} bins={board.binLabels.map((bin, b) => ({
        id: String(b), label: bin, items: board.items.filter((_, i) => state.placed?.[i] === String(b)),
      }))} />;
    case 'fill':
      return <FillContainerVisual label={label} container={board.container} capacity={board.capacity} filled={state.filled ?? 0} />;
    case 'whatif': {
      const series = board.branches.map((b, i) => {
        const values = [board.start, ...(board.values[i] ?? [])];
        return { id: String(i), label: b.label, values, endText: format.money(values[values.length - 1] ?? board.start, board.currency), series: seriesTone(i), highlighted: state.chosen === i };
      });
      return <GrowthLinesVisual label={label} series={series} startLabel={words.start}
        endLabel={step(board.unit, Math.max(...series.map((s) => s.values.length - 1)))}
        maxText={format.money(Math.max(...series.flatMap((s) => s.values)), board.currency)} />;
    }
    case 'your_turn': {
      const values = [board.start, ...board.values];
      const shown = 1 + (state.shown ?? board.givenCount);
      const last = values[Math.min(shown, values.length) - 1] ?? board.start;
      // A value the learner has not reached stays unwritten: in the picture, on the axis and in the description.
      const visibleLabel = boardDescription({ ...model, rows: model.rows.slice(0, shown) });
      return <GrowthLinesVisual label={visibleLabel} shown={shown} startLabel={words.start} endLabel={step(board.unit, board.values.length)}
        maxText={format.money(Math.max(...values.slice(0, shown)), board.currency)}
        series={[{ id: 's', label: model.title, values, endText: format.money(last, board.currency), series: 'sky' }]} />;
    }
  }
}
