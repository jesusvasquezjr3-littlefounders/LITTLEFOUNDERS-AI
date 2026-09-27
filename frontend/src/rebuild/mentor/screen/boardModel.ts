import type { Locale } from '../../design/copyBudget';
import type { TutorWhiteboardWire } from '../session/types';

/*
 * The Mentor's board on demand (Frontend Bible 08 §2 layer 4, 05), as data.
 *
 * Oracle sends one of its closed whiteboard shapes with every server-computed
 * field already filled in (the running values, the difference, each mark's
 * position, the unit prices): the client draws them as given and never redoes
 * the arithmetic. This module turns every shape into the one model the shared
 * Pizarrón board frame draws (`learning/TeachingChartBoard`): a title, rows of
 * label and value for the table view, and, where the shape is numbers, one bar
 * per row for the picture view. No kind is dropped: a shape with no numbers to
 * draw is its table, and a new kind fails to compile here before it can reach a
 * learner as a blank board.
 */

export type BoardTone = 'primary' | 'accent' | 'mint' | 'sky' | 'berry';

export interface BoardRow {
  id: string;
  label: string;
  value: string;
  /** The number a bar draws for this row, when the row is one. */
  amount?: number;
  tone?: BoardTone;
  /** A row the shape marks (the best option, the unknown part, the answer the Mentor checks). */
  marked?: boolean;
}

export interface BoardModel {
  kind: TutorWhiteboardWire['kind'];
  title: string;
  rows: BoardRow[];
  /** `bars`: the picture view draws one bar per row with an amount. `list`: the rows are the picture. */
  picture: 'bars' | 'list';
  /** The learner can act on it (grab, fill, your turn, what if): the board renders its controls. */
  interactive: boolean;
}

/** The board's own words (`rebuild-mentor.json` `mentorScreen.board`). */
export interface BoardWords {
  fallbackTitle: string;
  start: string;
  total: string;
  difference: string;
  whole: string;
  remaining: string;
  check: string;
  frame: string;
  jump: string;
  each: string;
  cells: string;
  best: string;
  remainder: string;
  price: string;
  paid: string;
  change: string;
  balance: string;
  discount: string;
  unitPrice: string;
  finalPrice: string;
  sold: string;
  left: string;
  budget: string;
  spent: string;
  over: string;
  before: string;
  after: string;
  both: string;
  good: string;
  bad: string;
  gives: string;
  gets: string;
  unknown: string;
  step: { day: string; week: string; month: string; year: string };
}

const TONES: readonly BoardTone[] = ['primary', 'sky', 'mint', 'berry', 'accent'];
const tone = (index: number) => TONES[index % TONES.length]!;

export interface BoardFormat {
  number: (value: number) => string;
  money: (value: number, currency: 'MXN' | 'USD' | 'BRL' | null) => string;
  percent: (fraction: number) => string;
}

export function boardFormat(locale: Locale): BoardFormat {
  const plain = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return {
    number: (value) => plain.format(value),
    money: (value, currency) => (currency
      // Whole amounts without cents ($7, not $7.00): a child reads the number the story said.
      ? new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value)
      : plain.format(value)),
    percent: (fraction) => percent.format(fraction),
  };
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);

const opSign = (op: string) => (op === 'subtract' ? '−' : op === 'multiply_percent' ? '×' : '+');

export function boardModel(board: TutorWhiteboardWire, words: BoardWords, format: BoardFormat): BoardModel {
  const title = board.label.trim() || words.fallbackTitle;
  const step = (unit: 'day' | 'week' | 'month' | 'year', n: number) => fill(words.step[unit], { n });
  const row = (id: string | number, label: string, value: string, extra: Partial<BoardRow> = {}): BoardRow => ({ id: String(id), label, value, ...extra });
  const bars = (rows: BoardRow[]): BoardModel => ({ kind: board.kind, title, rows, picture: 'bars', interactive: false });
  const list = (rows: BoardRow[]): BoardModel => ({ kind: board.kind, title, rows, picture: 'list', interactive: false });
  const act = (rows: BoardRow[]): BoardModel => ({ kind: board.kind, title, rows, picture: 'list', interactive: true });

  switch (board.kind) {
    case 'sequence': {
      const money = (v: number) => format.money(v, board.currency);
      return bars([
        row('start', words.start, money(board.start), { amount: board.start, tone: 'sky' }),
        ...board.values.map((value, i) => row(i, step(board.unit, i + 1), money(value), { amount: value, tone: 'primary' })),
      ]);
    }
    case 'compare': {
      const money = (v: number) => format.money(v, board.currency);
      return bars([
        row('left', board.left.label, money(board.left.value), { amount: board.left.value, tone: 'sky', marked: board.greater === 'left' }),
        row('right', board.right.label, money(board.right.value), { amount: board.right.value, tone: 'berry', marked: board.greater === 'right' }),
        row('difference', words.difference, money(board.difference)),
      ]);
    }
    case 'marked_line': {
      const money = (v: number) => format.money(v, board.currency);
      return bars([
        row('min', words.start, money(board.min)),
        ...board.marks.map((mark, i) => row(i, mark.label, money(mark.value), { amount: mark.value, tone: tone(i) })),
        row('max', words.total, money(board.max)),
      ]);
    }
    case 'categories':
      return bars(board.categories.map((c, i) => row(i, c.label, format.money(board.values[i] ?? c.value, board.currency), { amount: board.values[i] ?? c.value, tone: tone(i) })));
    case 'tokens':
      return bars([
        ...board.groups.map((g, i) => row(i, `${g.count} × ${format.money(g.denomination, board.currency)}`, format.money(board.subtotals[i] ?? 0, board.currency),
          { amount: board.subtotals[i] ?? 0, tone: tone(i) })),
        row('total', words.total, format.money(board.total, board.currency), { marked: true }),
      ]);
    case 'bar_model':
      return bars([
        row('whole', board.whole.label, format.money(board.whole.value, board.currency), { amount: board.whole.value, tone: 'sky' }),
        ...board.parts.map((p, i) => row(i, p.label, p.value === null ? words.unknown : format.money(p.value, board.currency),
          { amount: p.value ?? (board.widths[i] ?? 0) * board.whole.value, tone: tone(i + 1), marked: board.unknownIndex === i })),
      ]);
    case 'part_whole':
      return bars([
        row('whole', board.whole.label, format.money(board.whole.value, board.currency), { amount: board.whole.value, tone: 'sky' }),
        row('left', board.left.label, format.money(board.left.value, board.currency), { amount: board.left.value, tone: 'primary' }),
        row('right', board.right.label, format.money(board.right.value, board.currency), { amount: board.right.value, tone: 'mint' }),
      ]);
    case 'flow':
      return bars([
        row('income', board.income.label, format.money(board.income.value, board.currency), { amount: board.income.value, tone: 'mint' }),
        row('spent', board.spent.label, format.money(board.spent.value, board.currency), { amount: board.spent.value, tone: 'berry' }),
        row('kept', board.keptLabel, format.money(board.kept, board.currency), { amount: board.kept, tone: 'primary', marked: true }),
      ]);
    case 'goal_bar':
      return bars([
        row('goal', board.goal.label, format.money(board.goal.value, board.currency), { amount: board.goal.value, tone: 'sky' }),
        row('saved', board.saved.label, `${format.money(board.saved.value, board.currency)} (${format.percent(board.savedFraction)})`, { amount: board.saved.value, tone: 'mint' }),
        row('remaining', words.remaining, format.money(board.remaining, board.currency), { amount: board.remaining, tone: 'primary' }),
      ]);
    case 'worked':
      return bars([
        row('start', words.start, format.money(board.start, board.currency), { amount: board.start, tone: 'sky' }),
        ...board.steps.map((s, i) => row(i, `${opSign(s.op)} ${format.money(s.value, board.currency)}`, format.money(board.values[i] ?? 0, board.currency),
          { amount: board.values[i] ?? 0, tone: 'primary' })),
        row('check', words.check, format.money(board.checkValue, board.currency), { marked: true }),
      ]);
    case 'ten_frame':
      return bars([
        ...board.frames.map((count, i) => row(i, fill(words.frame, { n: i + 1 }), format.number(count), { amount: count, tone: 'primary' })),
        row('total', words.total, format.number(board.count), { marked: true }),
      ]);
    case 'open_number_line':
      return bars([
        row('from', words.start, format.money(board.from, board.currency), { amount: board.from, tone: 'sky' }),
        ...board.jumps.map((j, i) => row(i, `${words.jump} ${i + 1}: +${format.money(j.value, board.currency)}`, format.money(board.stops[i] ?? 0, board.currency),
          { amount: board.stops[i] ?? 0, tone: 'primary' })),
        row('to', words.total, format.money(board.to, board.currency), { marked: true }),
      ]);
    case 'array':
      return list([
        row('grid', `${board.rows} × ${board.columns}`, fill(words.cells, { n: board.cells })),
        row('each', words.each, format.money(board.unitValue, board.currency)),
        row('total', words.total, format.money(board.total, board.currency), { marked: true }),
      ]);
    case 'fraction_strip':
      return bars(board.rows.map((r, i) => row(i, `${r.highlighted}/${r.denominator}`, format.percent(board.shares[i] ?? 0), { amount: board.shares[i] ?? 0, tone: tone(i) })));
    case 'partition':
      return bars([
        row('whole', words.whole, format.money(board.whole, board.currency), { amount: board.whole, tone: 'sky' }),
        ...board.splits.map((s, i) => row(i, `${s.label} (1/${s.denominator})`, format.money(board.pieceValues[i] ?? 0, board.currency),
          { amount: board.pieceValues[i] ?? 0, tone: tone(i + 1) })),
      ]);
    case 'table':
      return bars(board.options.map((o, i) => row(i, `${o.label}: ${format.money(o.price, board.currency)} / ${format.number(o.units)}`,
        `${format.money(board.unitPrices[i] ?? 0, board.currency)} ${words.each}${board.bestIndex === i ? ` · ${words.best}` : ''}`,
        { amount: board.unitPrices[i] ?? 0, tone: tone(i), marked: board.bestIndex === i })));
    case 'scale':
      return bars([
        row('left', board.left.label, format.money(board.left.value, board.currency), { amount: board.left.value, tone: 'sky', marked: board.tilt === 'left' }),
        row('right', board.right.label, format.money(board.right.value, board.currency), { amount: board.right.value, tone: 'berry', marked: board.tilt === 'right' }),
        row('difference', words.difference, format.money(board.difference, board.currency)),
      ]);
    case 'two_bins':
      return list([
        ...board.items.map((item, i) => row(i, item.label, board.binLabels[item.bin] ?? words.unknown)),
        ...board.binLabels.map((bin, i) => row(`count-${i}`, bin, format.number(board.counts[i] ?? 0), { marked: true })),
      ]);
    case 'venn':
      return list([
        ...board.items.map((item, i) => row(i, item.label, item.side === 'left' ? board.leftLabel : item.side === 'right' ? board.rightLabel : words.both)),
        row('left', board.leftLabel, format.number(board.left), { marked: true }),
        row('both', words.both, format.number(board.both), { marked: true }),
        row('right', board.rightLabel, format.number(board.right), { marked: true }),
      ]);
    case 'ranking':
      return bars(board.order.map((index, place) => {
        const item = board.items[index];
        return row(place, `${place + 1}. ${item?.label ?? words.unknown}`, format.money(item?.value ?? 0, board.currency), { amount: item?.value ?? 0, tone: tone(place) });
      }));
    case 'outcomes':
      return list([
        row('good', `${words.good}: ${board.good.label}`, board.good.detail),
        row('bad', `${words.bad}: ${board.bad.label}`, board.bad.detail),
      ]);
    case 'trade':
      return list([
        row('left', board.left.who, `${words.gives} ${board.left.gives}, ${words.gets} ${board.left.gets}`),
        row('right', board.right.who, `${words.gives} ${board.right.gives}, ${words.gets} ${board.right.gets}`),
      ]);
    case 'chance':
      return bars(board.outcomes.map((o, i) => row(i, o.label, format.percent(board.shares[i] ?? 0), { amount: board.shares[i] ?? 0, tone: tone(i) })));
    case 'deal':
      return bars([
        ...board.bins.map((bin, i) => row(i, bin, format.number(board.perBin), { amount: board.perBin, tone: tone(i) })),
        row('remainder', words.remainder, format.number(board.remainder)),
        row('total', words.total, format.number(board.total), { marked: true }),
      ]);
    case 'change':
      return bars([
        row('price', words.price, format.money(board.price, board.currency), { amount: board.price, tone: 'berry' }),
        row('paid', words.paid, format.money(board.paid, board.currency), { amount: board.paid, tone: 'sky' }),
        row('change', words.change, format.money(board.change, board.currency), { amount: board.change, tone: 'mint', marked: true }),
      ]);
    case 'regroup':
      return list([
        row('from', `${board.fromCount} × ${format.money(board.fromDenomination, board.currency)}`, format.money(board.fromCount * board.fromDenomination, board.currency)),
        row('into', `${board.intoCount} × ${format.money(board.intoDenomination, board.currency)}`, format.money(board.intoCount * board.intoDenomination, board.currency), { marked: true }),
      ]);
    case 'equation_bar':
      return bars([
        ...board.left.map((p, i) => row(`l${i}`, p.label, format.money(p.value, board.currency), { amount: p.value, tone: 'sky' })),
        ...board.right.map((p, i) => row(`r${i}`, p.label, format.money(p.value, board.currency), { amount: p.value, tone: 'berry' })),
        row('total', words.total, format.money(board.total, board.currency), { marked: true }),
      ]);
    case 'receipt':
      return bars([
        ...board.lines.map((l, i) => row(i, l.label, format.money(l.value, board.currency), { amount: l.value, tone: tone(i) })),
        row('total', words.total, format.money(board.total, board.currency), { marked: true }),
      ]);
    case 'ledger':
      return bars([
        ...board.entries.map((e, i) => row(i, `${e.direction === 'in' ? '+' : '−'}${format.money(e.amount, board.currency)} ${e.label}`,
          `${words.balance}: ${format.money(board.balances[i] ?? 0, board.currency)}`, { amount: board.balances[i] ?? 0, tone: e.direction === 'in' ? 'mint' : 'berry' })),
        row('final', words.balance, format.money(board.final, board.currency), { marked: true }),
      ]);
    case 'price_tag':
      return list([
        row('item', board.item, `${format.money(board.price, board.currency)} / ${format.number(board.units)}`),
        ...(board.discountPercent !== null ? [row('discount', words.discount, format.percent(board.discountPercent / 100))] : []),
        row('unit', words.unitPrice, format.money(board.unitPrice, board.currency)),
        row('final', words.finalPrice, format.money(board.finalPrice, board.currency), { marked: true }),
      ]);
    case 'inventory':
      return bars([
        row('start', `${board.item}: ${words.start}`, format.number(board.start), { amount: board.start, tone: 'sky' }),
        row('sold', words.sold, format.number(board.sold), { amount: board.sold, tone: 'berry' }),
        row('left', words.left, format.number(board.left), { amount: board.left, tone: 'mint', marked: true }),
      ]);
    case 'budget_plate':
      return bars([
        row('budget', words.budget, format.money(board.budget, board.currency), { amount: board.budget, tone: 'sky' }),
        ...board.items.map((item, i) => row(i, item.label, format.money(item.value, board.currency), { amount: item.value, tone: tone(i + 1) })),
        row('spent', words.spent, format.money(board.spent, board.currency)),
        board.overBy > 0
          ? row('over', words.over, format.money(board.overBy, board.currency), { marked: true })
          : row('remaining', words.remaining, format.money(board.remaining, board.currency), { marked: true }),
      ]);
    case 'pictograph':
      return bars(board.rows.map((r, i) => row(i, `${r.label} (${r.count} × ${format.money(board.unitValue, board.currency)})`,
        format.money(board.totals[i] ?? 0, board.currency), { amount: board.totals[i] ?? 0, tone: tone(i) })));
    case 'bead_string':
      return bars([
        ...board.rows.map((count, i) => row(i, fill(words.frame, { n: i + 1 }), format.number(count), { amount: count, tone: tone(i) })),
        row('total', words.total, format.number(board.count), { marked: true }),
      ]);
    case 'tally':
      return bars(board.groups.map((g, i) => row(i, g.label, format.number(g.count), { amount: g.count, tone: tone(i) })));
    case 'fraction_circle':
      return bars([row('share', `${board.highlighted}/${board.denominator}`, format.percent(board.share), { amount: board.share, tone: 'primary' })]);
    case 'stack':
      return bars(board.columns.map((c, i) => row(i, `${c.label} (${c.parts.map((p) => `${p.label} ${format.money(p.value, board.currency)}`).join(', ')})`,
        format.money(board.totals[i] ?? 0, board.currency), { amount: board.totals[i] ?? 0, tone: tone(i) })));
    case 'sequence_compare':
      return bars(board.tracks.flatMap((track, t) => {
        const values = board.values[t] ?? [];
        const last = values[values.length - 1] ?? track.start;
        return [row(`t${t}`, `${track.label}: ${step(board.unit, values.length)}`, format.money(last, board.currency), { amount: last, tone: t === 0 ? 'sky' : 'berry' })];
      }));
    case 'timeline':
      return list(board.events.map((e, i) => row(i, step(board.unit, e.at), e.label)));
    case 'cycle':
      return list(board.steps.map((s, i) => row(i, String(i + 1), s)));
    case 'before_after':
      return bars([
        row('before', `${board.what}: ${words.before}`, format.money(board.before, board.currency), { amount: board.before, tone: 'sky' }),
        row('after', words.after, format.money(board.after, board.currency), { amount: board.after, tone: 'primary' }),
        row('delta', words.difference, `${board.direction === 'down' ? '−' : board.direction === 'up' ? '+' : ''}${format.money(Math.abs(board.delta), board.currency)}`, { marked: true }),
      ]);
    case 'grab':
      return act(board.items.map((item, i) => row(i, item, words.unknown)));
    case 'fill':
      return act([row('capacity', words.total, format.number(board.capacity))]);
    case 'whatif':
      return act(board.branches.map((b, i) => {
        const values = board.values[i] ?? [];
        const last = values[values.length - 1] ?? board.start;
        return row(i, `${b.label}: ${step(board.unit, values.length)}`, format.money(last, board.currency), { amount: last, tone: tone(i) });
      }));
    case 'your_turn':
      return act([
        row('start', words.start, format.money(board.start, board.currency)),
        ...board.values.map((value, i) => row(i, step(board.unit, i + 1), format.money(value, board.currency), { amount: value, tone: i < board.givenCount ? 'sky' : 'accent' })),
      ]);
  }
}
