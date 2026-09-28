// Forge's interactive-behaviour gate for v2 lessons (GAP-FIX-R1 learning;
// B.7 "deterministic gates across the full interactive input range",
// Appendix C 1.3's "interactive-behavior" per-gate pass rate).
//
// For every server-graded segment of an emitted document, this enumerates the
// permitted input space from the payload's own bounds (grids, parts, ranges,
// denominations, option sets), or samples it densely where the space is too
// large, and runs every state through the AUTHORITATIVE path Core uses to
// grade (`gradeV2Visual`: the strict document, the private rubric and the
// canonical scorer). It asserts:
//   - the target is reachable: at least one permitted state is met;
//   - the rubric is not trivially met: at least one permitted state is not;
//   - where the rubric names its accepted answers (option ids, card sets,
//     regions, paths, bins, scam sets), exactly those states are met;
//   - no permitted state throws, and none is refused as malformed;
//   - off-grid, out-of-range and conservation-breaking states are refused;
//   - the board's initial state (where the payload declares one) is not met.
// A document that fails blocks review; the report carries the pass rate.

import { gradeV2Visual, type V2PublicLesson } from './v2LessonDocument.js';
import { amortizationSchedule } from './v2ConceptBoards.js';
import { longArithmeticSteps, placeValueScorerPayload, SCHEMA_KINDS, SCHEMA_SLOTS, type PlaceValuePayload } from './v2SegmentFamilies.js';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const MAX_STATES = 20_000;

interface Space { inRange: unknown[]; invalid: unknown[]; initial?: unknown; expectMet?: (response: Json) => boolean }

const range = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  for (let value = from; value <= to && out.length <= MAX_STATES; value += step) out.push(value);
  return out;
};
/** Evenly spaced picks from a grid, always keeping both ends. */
const sample = <T,>(values: T[], limit: number): T[] => values.length <= limit ? values
  : Array.from({ length: limit }, (_, index) => values[Math.round(index * (values.length - 1) / (limit - 1))]!);
const subsets = <T,>(items: T[], minimum = 0): T[][] => {
  const out: T[][] = [];
  for (let mask = 0; mask < 1 << items.length; mask += 1) {
    const picked = items.filter((_, index) => mask & (1 << index));
    if (picked.length >= minimum) out.push(picked);
  }
  return out;
};
const product = <T,>(lists: T[][], limit = MAX_STATES): T[][] => {
  let out: T[][] = [[]];
  for (const list of lists) {
    const next: T[][] = [];
    for (const prefix of out) for (const value of list) { next.push([...prefix, value]); if (next.length > limit * 4) break; }
    out = next.length > limit ? sample(next, limit) : next;
  }
  return out;
};
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((value) => b.includes(value));

function flowPaths(payload: Json): string[][] {
  const byId = new Map<string, Json>(payload.nodes.map((node: Json) => [node.id, node]));
  const out: string[][] = [];
  const walk = (id: string, path: string[]) => {
    const node = byId.get(id)!;
    const next = [...path, id];
    if (node.kind === 'outcome') { out.push(next); return; }
    walk(node.yes, next); walk(node.no, next);
  };
  walk(payload.start, []);
  return out;
}

function replayPlace(start: { hundreds: number; tens: number; ones: number }, trades: string[]): { hundreds: number; tens: number; ones: number } | null {
  let { hundreds, tens, ones } = start;
  for (const trade of trades) {
    if (trade === 'ten') { if (ones < 10) return null; ones -= 10; tens += 1; }
    else if (trade === 'hundred') { if (tens < 10 || hundreds >= 9) return null; tens -= 10; hundreds += 1; }
    else if (trade === 'borrow-ten') { if (tens < 1 || ones > 9) return null; tens -= 1; ones += 10; }
    else { if (hundreds < 1 || tens > 9) return null; hundreds -= 1; tens += 10; }
  }
  return { hundreds, tens, ones };
}

/** Every built chart of distinct questions (depth at most the question count), each leaf an outcome. */
function builtTrees(questions: string[], outcomes: string[], asked: string[]): Json[] {
  const leaves: Json[] = outcomes.map((o) => ({ o }));
  if (asked.length >= questions.length) return leaves;
  const out: Json[] = [...leaves];
  for (const q of questions.filter((item) => !asked.includes(item))) {
    const below = builtTrees(questions, outcomes, [...asked, q]);
    for (const yes of below) for (const no of below) { out.push({ q, yes, no }); if (out.length > MAX_STATES * 4) return out; }
  }
  return out;
}

/** Every rule expression the L2 level allows, built the way the board builds it. */
function ruleExprs(conditions: string[], level: string): Json[] {
  const atoms: Json[] = conditions.map((c) => ({ c }));
  if (level === 'single') return atoms;
  const pairs = atoms.flatMap((a) => atoms.filter((b) => b !== a).flatMap((b) => [{ and: [a, b] }, { or: [a, b] }]));
  if (level === 'connective') return [...atoms, ...pairs];
  const literals = [...atoms, ...atoms.map((a) => ({ not: a }))];
  const twos = literals.flatMap((a) => literals.filter((b) => b !== a).flatMap((b) => [{ and: [a, b] }, { or: [a, b] }]));
  const threes = twos.flatMap((left) => literals.flatMap((c) => [{ and: [left, c] }, { or: [left, c] }]));
  return [...literals, ...twos, ...sample(threes, 4_000)];
}
function evalExpr(expr: Json, facts: Json): boolean {
  if (expr.c !== undefined) return facts[expr.c] === true;
  if (expr.not !== undefined) return !evalExpr(expr.not, facts);
  if (expr.and !== undefined) return evalExpr(expr.and[0], facts) && evalExpr(expr.and[1], facts);
  return evalExpr(expr.or[0], facts) || evalExpr(expr.or[1], facts);
}

function money(denominations: Json[], limit = MAX_STATES): Json[] {
  const lists = denominations.map((d) => range(0, d.available));
  return product(lists, limit).map((counts) => ({ counts: Object.fromEntries(denominations.map((d, index) => [String(d.value_minor), counts[index]])) }));
}

/** The permitted input space of one server-graded segment, from its payload bounds and (for accepted-answer rubrics) its rubric. */
export function behaviourSpace(segment: Json, rubric: Json): Space | null {
  const p = segment.payload as Json;
  switch (segment.type as string) {
    case 'money.allocation.v2': {
      const values = range(0, p.total, p.step);
      const inRange = values.flatMap((save) => values.filter((spend) => save + spend <= p.total).map((spend) => ({ save, spend, share: p.total - save - spend })));
      return { inRange, invalid: [{ save: p.total, spend: p.step, share: 0 }, { save: -p.step, spend: p.total, share: p.step }, ...(p.step > 1 ? [{ save: 1, spend: p.total - 1, share: 0 }] : [])] };
    }
    case 'math.number-line.whole.v2':
      if (p.hops) {
        // M2 counting on (GAP-FIX-R2): every hop sequence from the current square that stays on the line.
        const sequences: number[][] = [];
        const grow = (prefix: number[], at: number) => {
          if (prefix.length > 0) sequences.push(prefix);
          if (prefix.length >= 12 || sequences.length > MAX_STATES) return;
          for (const hop of p.hops as number[]) if (at + hop <= p.maximum) grow([...prefix, hop], at + hop);
        };
        grow([], p.initial);
        const landed = (hops: number[]) => hops.reduce((sum, hop) => sum + hop, p.initial);
        return { inRange: sample(sequences, MAX_STATES).map((hops) => ({ value: String(landed(hops)), hops })),
          invalid: [{ value: String(p.initial), hops: [] }, { value: String(p.initial + 1 + (p.hops as number[])[0]!), hops: [(p.hops as number[])[0]] }, { value: String(p.initial) }],
          expectMet: (r) => Number(r.value) === rubric.target };
      }
      return { inRange: range(p.minimum, p.maximum, p.step).map((value) => ({ value: String(value) })),
        invalid: [{ value: String(p.maximum + p.step) }, { value: '-1' }, ...(p.step > 1 ? [{ value: String(p.minimum + 1) }] : []), { value: '7.0' }],
        initial: { value: String(p.initial) } };
    case 'math.number-line.fraction.v2':
      return { inRange: range(0, p.maximumWhole * p.divisions).map((units) => ({ value: `${units}/${p.divisions}` })),
        invalid: [{ value: `${p.maximumWhole * p.divisions + 1}/${p.divisions}` }, { value: '0.5' }, { value: `1/${p.divisions * 7 + 1}` }],
        initial: { value: `${p.initialUnits}/${p.divisions}` } };
    case 'math.fraction-area.v2':
      return { inRange: range(p.minimumParts, p.maximumParts).flatMap((d) => range(0, d).map((n) => ({ n, d }))),
        invalid: [{ n: 0, d: p.maximumParts + 1 }, { n: 3, d: 2 }, { n: -1, d: p.minimumParts }],
        initial: { n: p.initialShaded, d: p.initialParts } };
    case 'math.bar-model.structure.v2':
      return { inRange: [{ model: 'comparison' }, { model: 'part-whole' }], invalid: [{ model: 'guess' }] };
    case 'math.bar-model.answer.v2':
      return { inRange: range(0, p.whole).map((value) => ({ value: String(value) })), invalid: [{ value: String(p.whole + 1) }, { value: '-3' }] };
    case 'math.schema-diagram.structure.v2':
      return { inRange: SCHEMA_KINDS.map((schema) => ({ schema })), invalid: [{ schema: 'combine' }, {}], expectMet: (r) => r.schema === rubric.schema };
    case 'math.schema-diagram.slots.v2': {
      // M8 (GAP-FIX-R2): every schema with every placement of the two quantities and the unknown.
      const ids = [(p.quantities as Json[])[0]!.id as string, (p.quantities as Json[])[1]!.id as string, 'unknown'];
      const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
      const inRange = SCHEMA_KINDS.flatMap((schema) => orders.map((order) => ({ schema, slots: Object.fromEntries(SCHEMA_SLOTS[schema].map((slot, index) => [slot, ids[order[index]!]])) })));
      return { inRange, invalid: [{ schema: 'change', slots: { start: ids[0], change: ids[0], result: 'unknown' } }, { schema: 'group', slots: { start: ids[0], change: ids[1], result: 'unknown' } }],
        expectMet: (r) => r.schema === rubric.schema && Object.entries(rubric.slots as Record<string, string>).every(([slot, value]) => r.slots[slot] === value) };
    }
    case 'math.schema-diagram.answer.v2': {
      const [a, b] = (p.quantities as Json[]).map((item) => item.value as number) as [number, number];
      return { inRange: sample(range(0, a * b + a + b), 2_000).concat([rubric.target]).map((value) => ({ value: String(value) })), invalid: [{ value: String(a * b + a + b + 1) }, { value: '-3' }],
        expectMet: (r) => Number(r.value) === rubric.target };
    }
    case 'math.worked-example.v2': {
      const ids = p.response_step_ids as string[];
      const expected = rubric.expectedValues as Json;
      const shifted = (delta: number) => Object.fromEntries(ids.map((id) => [id, /^-?\d+(\.\d+)?$/.test(expected[id]) ? String(Number(expected[id]) + delta) : `${expected[id]}x`]));
      return { inRange: [{ values: { ...expected } }, { values: shifted(1) }, { values: shifted(-1) }], invalid: [{ values: {} }, { values: Object.fromEntries(ids.map((id) => [id, ''])) }] };
    }
    case 'math.function-machine.v2':
      return { inRange: product([range(1, p.multiplierMaximum), range(0, p.offsetMaximum)]).map(([m, o]) => ({ multiplier: String(m), offset: String(o) })),
        invalid: [{ multiplier: '0', offset: '0' }, { multiplier: String(p.multiplierMaximum + 1), offset: '0' }] };
    case 'math.cpa-count.v2':
      return { inRange: range(0, p.left + p.right).map((value) => ({ value: String(value) })), invalid: [{ value: String(p.left + p.right + 1) }] };
    case 'reasoning.decide-justify.v2':
      return { inRange: p.choices.flatMap((choice: Json) => p.reasons.map((reason: Json) => ({ choice: choice.id, reason: reason.id }))),
        invalid: [{ choice: 'not-an-option', reason: p.reasons[0].id }],
        expectMet: (r) => (rubric.acceptableChoiceIds as string[]).includes(r.choice) };
    case 'math.place-value.v2': {
      // M5 (GAP-FIX-R2): every possible trade sequence up to one past the needed count, each with the right and a wrong written result.
      const start = placeValueScorerPayload(p as PlaceValuePayload);
      const ops = start.mode === 'compose' ? ['ten', 'hundred'] : ['borrow-ten', 'borrow-hundred'];
      const take = { hundreds: Math.floor(start.subtrahend / 100), tens: Math.floor(start.subtrahend / 10) % 10, ones: start.subtrahend % 10 };
      const inRange: Json[] = [];
      for (let length = 0; length <= Math.min(rubric.trades + 1, 8); length += 1) {
        for (const trades of product(Array.from({ length }, () => ops), 4_000)) {
          const end = replayPlace(start, trades as string[]);
          if (!end) continue;
          const shown = start.mode === 'compose' ? end : { hundreds: end.hundreds - take.hundreds, tens: end.tens - take.tens, ones: end.ones - take.ones };
          for (const delta of [0, 1]) inRange.push({ trades, hundreds: String(Math.max(0, shown.hundreds)), tens: String(Math.max(0, shown.tens)), ones: String(Math.max(0, shown.ones) + delta) });
        }
      }
      return { inRange, invalid: [{ trades: [ops[0] === 'ten' ? 'borrow-ten' : 'ten'], hundreds: '0', tens: '0', ones: '0' }, { trades: 3, hundreds: '0', tens: '0', ones: '0' }],
        initial: { trades: [], hundreds: String(start.hundreds), tens: String(start.tens), ones: String(start.ones) } };
    }
    case 'math.ratio-table.v2':
      return { inRange: range(p.minimumPacks, p.maximumPacks).flatMap((packs) => [packs * p.pricePerPack, packs * p.pricePerPack + 1].map((price) => ({ packs, price: String(price) }))),
        invalid: [{ packs: p.maximumPacks + 1, price: '0' }, { packs: p.minimumPacks - 1, price: '0' }] };
    case 'visual.percent-grid.v2':
      return { inRange: range(0, 100, p.step).flatMap((percent) => [p.baseUnits * percent / 100, p.baseUnits * percent / 100 + 1].map((amount) => ({ percent, amount: String(amount) }))),
        invalid: [...(p.step > 1 ? [{ percent: 1, amount: '0' }] : []), { percent: 105, amount: '0' }] };
    case 'visual.growth-comparison.v2': {
      const rates = range(p.minimumRateBps, p.maximumRateBps, p.rateStepBps);
      const years = range(p.minimumYears, p.maximumYears, p.yearStep);
      const predictions = sample(range(p.principalMinor, p.predictionMaximumMinor, p.predictionStepMinor), 400);
      return { inRange: sample(product([rates, years, predictions], MAX_STATES * 4), MAX_STATES).map(([rateBps, yearsValue, predictionMinor]) => ({ rateBps, years: yearsValue, predictionMinor })),
        invalid: [{ rateBps: p.minimumRateBps + 1, years: p.minimumYears, predictionMinor: p.principalMinor }, { rateBps: p.minimumRateBps, years: p.maximumYears + p.yearStep, predictionMinor: p.principalMinor }] };
    }
    case 'visual.tax-bracket.v2': {
      const incomes = sample(range(p.minimumIncomeMinor, p.maximumIncomeMinor, p.incomeStepMinor), 200);
      if (!incomes.includes(rubric.income_minor)) incomes.push(rubric.income_minor);
      const rates = [...new Set((p.brackets as Json[]).map((b) => b.rateBasisPoints as number))];
      const owed = (income: number) => {
        let lower = 0; let tax = 0;
        for (const b of p.brackets as Json[]) { const upper = b.upToMinor ?? income; tax += Math.round(Math.max(0, Math.min(income, upper) - lower) * b.rateBasisPoints / 10_000); if (b.upToMinor === null) break; lower = b.upToMinor; }
        return tax;
      };
      return { inRange: incomes.flatMap((incomeMinor) => rates.flatMap((marginalBps) => [owed(incomeMinor), owed(incomeMinor) + 1].map((tax) => ({ incomeMinor, taxMinor: String(tax), marginalBps })))),
        invalid: [{ incomeMinor: p.maximumIncomeMinor + p.incomeStepMinor, taxMinor: '0', marginalBps: 0 }] };
    }
    case 'logic.savings-rule.v2':
      return { inRange: product<string | number>([['>=', '>', '<=', '<'], range(0, p.goal * 2), ['and', 'or', 'none']]).map(([comparator, threshold, link]) => ({ comparator, threshold, link })),
        invalid: [{ comparator: '==', threshold: 0, link: 'and' }, { comparator: '>=', threshold: p.goal * 2 + 1, link: 'and' }] };
    case 'visual.goal-bullet.v2':
      return { inRange: range(p.minimum, p.maximum, p.step).map((value) => ({ value })), invalid: [{ value: p.maximum + p.step }, ...(p.step > 1 ? [{ value: p.minimum + 1 }] : [])],
        initial: { value: p.initial } };
    case 'money.running-ledger.v2': {
      const sequences: string[][] = [[]];
      for (let length = 1; length <= p.maxEntries; length += 1) for (const seq of product(Array.from({ length }, () => ['sale', 'cost']), 600)) sequences.push(seq as string[]);
      const balance = (entries: string[]) => entries.reduce((sum, e) => sum + (e === 'sale' ? p.sale : -p.cost), p.initial);
      return { inRange: sample(sequences, 2_000).flatMap((entries) => [balance(entries), balance(entries) + 1].map((b) => ({ entries, balance: String(b) }))),
        invalid: [{ entries: Array.from({ length: p.maxEntries + 1 }, () => 'sale'), balance: '0' }, { entries: ['refund'], balance: '0' }] };
    }
    case 'logic.rule-checker.v2': {
      const ids = (p.cards as Json[]).map((card) => card.id as string);
      return { inRange: subsets(ids, 1).map((flipped) => ({ flipped })), invalid: [{ flipped: [] }, { flipped: ['not-a-card'] }],
        expectMet: (r) => sameSet(r.flipped, rubric.must_flip_ids) };
    }
    case 'logic.euler.v2': {
      const allowed = p.relation === 'subset' ? ['second', 'both', 'neither'] : p.relation === 'disjoint' ? ['first', 'second', 'neither'] : ['first', 'second', 'both', 'neither'];
      const forbidden = ['first', 'second', 'both', 'neither'].find((region) => !allowed.includes(region));
      const items = (p.items as Json[]).map((item) => item.id as string);
      return { inRange: product(items.map(() => allowed)).map((regions) => ({ placements: Object.fromEntries(items.map((id, index) => [id, regions[index]])) })),
        invalid: forbidden ? [{ placements: Object.fromEntries(items.map((id) => [id, forbidden])) }] : [{ placements: {} }],
        expectMet: (r) => items.every((id) => r.placements[id] === rubric.regions[id]) };
    }
    case 'logic.flowchart.v2':
    case 'money.spend-decision.v2': {
      if (p.mode === 'build') {
        // L6 / $9 built charts (GAP-FIX-R2): every tree of up to the declared questions, each asked once per path.
        const trees = builtTrees((p.questions as Json[]).map((q) => q.id as string), (p.outcomes as Json[]).map((o) => o.id as string), []);
        const cases = rubric.cases as Json[];
        const walk = (tree: Json, answers: Json): string => tree.o ?? walk(answers[tree.q] ? tree.yes : tree.no, answers);
        return { inRange: sample(trees, MAX_STATES).map((tree) => ({ tree })), invalid: [{ tree: { o: 'not-an-outcome' } }, { tree: { q: 'not-a-question', yes: { o: 'x' }, no: { o: 'y' } } }],
          expectMet: (r) => cases.every((item) => walk(r.tree, item.answers) === item.outcome) };
      }
      const paths = flowPaths(p);
      const scenarios = (p.scenarios as Json[]).map((s) => s.id as string);
      return { inRange: product(scenarios.map(() => paths)).map((chosen) => ({ paths: Object.fromEntries(scenarios.map((id, index) => [id, chosen[index]])) })),
        invalid: [{ paths: Object.fromEntries(scenarios.map((id) => [id, [p.start]])) }, { paths: Object.fromEntries(scenarios.map((id) => [id, [p.start, 'nowhere']])) }],
        expectMet: (r) => scenarios.every((id) => (r.paths[id] as string[]).join('>') === (rubric.paths[id] as string[]).join('>')) };
    }
    case 'logic.sort-by-rule.v2':
    case 'money.needs-wants.v2': {
      const pairs = (p.bins as Json[]).flatMap((bin) => (p.reasons as Json[]).map((reason) => ({ bin: bin.id, reason: reason.id })));
      const items = (p.items as Json[]).map((item) => item.id as string);
      const accepted = rubric.accepted as Record<string, Json[]>;
      const inRange: Json[] = product(items.map(() => pairs)).map((chosen) => ({ placements: Object.fromEntries(items.map((id, index) => [id, chosen[index]])) }));
      // Always include the rubric's own accepted placement, so reachability is tested even when sampled.
      inRange.push({ placements: Object.fromEntries(items.map((id) => [id, accepted[id]![0]])) });
      return { inRange, invalid: [{ placements: Object.fromEntries(items.map((id) => [id, { bin: 'no-bin', reason: pairs[0]!.reason }])) }],
        expectMet: (r) => items.every((id) => accepted[id]!.some((pair) => pair.bin === r.placements[id].bin && pair.reason === r.placements[id].reason)) };
    }
    case 'logic.scam-spotter.v2':
    case 'money.scam-check.v2': {
      const ids = (p.messages as Json[]).map((m) => m.id as string);
      // L12 cues (GAP-FIX-R2) never change the verdict: every flag set is swept with no ticks and with every cue ticked.
      const cueIds = ((p.cues ?? []) as Json[]).map((c) => c.id as string);
      const variants = p.cues ? [{}, Object.fromEntries(ids.map((id) => [id, cueIds]))] : [null];
      return { inRange: subsets(ids).flatMap((flagged) => variants.map((cues) => cues === null ? { flagged } : { flagged, cues })),
        invalid: [p.cues ? { flagged: ['not-a-message'], cues: {} } : { flagged: ['not-a-message'] }, ...(p.cues ? [{ flagged: [] }, { flagged: [], cues: { [ids[0]!]: ['not-a-cue'] } }] : [])],
        expectMet: (r) => sameSet(r.flagged, rubric.scam_ids) };
    }
    case 'money.coin-tray.v2': {
      const over = { counts: Object.fromEntries((p.denominations as Json[]).map((d, index) => [String(d.value_minor), index === 0 ? d.available + 1 : 0])) };
      return { inRange: money(p.denominations), invalid: [over, { counts: {} }] };
    }
    case 'money.making-change.v2': {
      // $2 count-up (GAP-FIX-R2): each tray said counting up from the price; the right change also counted from zero (a review).
      const change = p.paid_minor - p.price_minor;
      const said = (counts: Json, start: number) => {
        const out: number[] = []; let at = start;
        for (const d of p.denominations as Json[]) for (let n = 0; n < counts[String(d.value_minor)]; n += 1) { at += d.value_minor; out.push(at); }
        return out;
      };
      const trays = money(p.denominations, MAX_STATES / 2);
      const total = (counts: Json) => (p.denominations as Json[]).reduce((sum, d) => sum + d.value_minor * counts[String(d.value_minor)], 0);
      const inRange = trays.flatMap((tray) => [{ counts: tray.counts, sequence: said(tray.counts, p.price_minor) },
        ...(total(tray.counts) === change ? [{ counts: tray.counts, sequence: said(tray.counts, 0) }] : [])]);
      const over = { counts: Object.fromEntries((p.denominations as Json[]).map((d, index) => [String(d.value_minor), index === 0 ? d.available + 1 : 0])), sequence: [] };
      return { inRange, invalid: [over, { counts: trays[0]!.counts }, { counts: trays.at(-1)!.counts, sequence: [1] }],
        expectMet: (r) => total(r.counts) === change && (r.sequence.length === 0 ? change === 0 : r.sequence.at(-1) === p.paid_minor) };
    }
    case 'money.unit-price.v2': {
      // $6 (GAP-FIX-R2): the rounded exact unit price and a cent off for each offer, with every choice.
      const scale = p.currency === 'local' ? 100 : 1;
      const offers = p.offers as Json[];
      const exact = (o: Json) => Math.round(o.price_minor * 100 / (o.quantity * scale)) / 100;
      const perOffer = offers.map((o) => [exact(o), exact(o) + 0.25].map((value) => value.toFixed(2)));
      const inRange = product(perOffer).flatMap((prices) => offers.map((choice) => ({ unit_prices: Object.fromEntries(offers.map((o, i) => [o.id, prices[i]])), choice: choice.id })));
      return { inRange, invalid: [{ unit_prices: {}, choice: offers[0]!.id }, { unit_prices: Object.fromEntries(offers.map((o) => [o.id, '-1'])), choice: offers[0]!.id },
        { unit_prices: Object.fromEntries(offers.map((o) => [o.id, '1'])), choice: 'not-an-offer' }],
        expectMet: (r) => r.choice === rubric.better_id && offers.every((o) => Math.abs(Number(r.unit_prices[o.id]) - o.price_minor / (o.quantity * scale)) <= 0.005 + 1e-9) };
    }
    case 'logic.rule-builder.v2': {
      // L2 (GAP-FIX-R2): every rule the level allows, graded on the hidden scenarios by behaviour.
      const conditions = (p.conditions as Json[]).map((c) => c.id as string);
      const actions = (p.actions as Json[]).map((a) => a.id as string);
      const exprs = ruleExprs(conditions, p.level);
      const pairs = actions.flatMap((then) => actions.map((otherwise) => [then, otherwise] as const));
      const rules = product([exprs as unknown[], pairs as unknown[]], MAX_STATES).map(([expr, pair]) => ({ rule: { if: expr, then: (pair as string[])[0], else: (pair as string[])[1] } }));
      const evalRule = (rule: Json, facts: Json) => evalExpr(rule.if, facts) ? rule.then : rule.else;
      const scenarios = rubric.scenarios as Json[];
      return { inRange: rules, invalid: [{ rule: { if: { c: 'not-a-condition' }, then: actions[0], else: actions[1] } }, { rule: { if: { c: conditions[0] }, then: 'not-an-action', else: actions[1] } },
        ...(p.level === 'single' ? [{ rule: { if: { not: { c: conditions[0] } }, then: actions[0], else: actions[1] } }] : [])],
        expectMet: (r) => scenarios.every((facts) => evalRule(r.rule, facts) === evalRule(rubric.target, facts)) };
    }
    case 'story.branch.v2':
    case 'story.would-you-rather.v2':
      return { inRange: (p.options as Json[]).map((option) => ({ choice: option.id })), invalid: [{ choice: 'not-an-option' }],
        expectMet: (r) => (rubric.acceptable_choice_ids as string[]).includes(r.choice) };
    case 'visual.chart.v2':
      return { inRange: ((p.question?.options ?? []) as Json[]).map((option) => ({ choice: option.id })), invalid: [{ choice: 'not-an-option' }],
        expectMet: (r) => (rubric.acceptable_choice_ids as string[]).includes(r.choice) };
    case 'story.dialogue-choice.v2':
      return { inRange: (p.replies as Json[]).map((option) => ({ choice: option.id })), invalid: [{ choice: 'not-an-option' }],
        expectMet: (r) => (rubric.acceptable_choice_ids as string[]).includes(r.choice) };
    // Appendix A Part 3 concept boards (B.7 part 2).
    case 'money.amortization.v2': {
      const rows = amortizationSchedule(p.principal_minor, p.rate_bps, p.months);
      return { inRange: range(0, rows.length).flatMap((month) => { const balance = month === 0 ? p.principal_minor : rows[month - 1]!.balance; return [balance, balance + 5].map((b) => ({ month, balance: String(b) })); }),
        invalid: [{ month: rows.length + 1, balance: '0' }, { month: 1, balance: 'twelve' }], initial: { month: 0, balance: String(p.principal_minor) } };
    }
    case 'econ.supply-demand.v2': {
      const shifts = range(-p.max_shift, p.max_shift);
      return { inRange: product<string | number>([shifts, shifts, ['up', 'down', 'same']]).map(([demand_shift, supply_shift, price]) => ({ demand_shift, supply_shift, price })),
        invalid: [{ demand_shift: p.max_shift + 1, supply_shift: 0, price: 'up' }, { demand_shift: 0, supply_shift: 0, price: 'sideways' }] };
    }
    case 'money.inflation.v2': {
      const rates = range(p.min_rate_bps, p.max_rate_bps, p.rate_step_bps);
      const years = range(p.min_years, p.max_years, p.year_step);
      const predictions = sample(range(p.price_minor, p.prediction_max_minor, p.prediction_step_minor), 400);
      return { inRange: sample(product([rates, years, predictions], MAX_STATES * 4), MAX_STATES).map(([rateBps, yearsValue, predictionMinor]) => ({ rateBps, years: yearsValue, predictionMinor })),
        invalid: [{ rateBps: p.max_rate_bps + p.rate_step_bps, years: p.min_years, predictionMinor: p.price_minor }, { rateBps: p.min_rate_bps, years: p.min_years, predictionMinor: p.price_minor - 1 }] };
    }
    case 'money.rule-of-72.v2':
      return { inRange: product([range(p.min_rate_bps, p.max_rate_bps, p.rate_step_bps), range(1, 100)]).map(([rateBps, years]) => ({ rateBps, years })),
        invalid: [{ rateBps: p.max_rate_bps + p.rate_step_bps, years: 10 }, { rateBps: p.min_rate_bps, years: 0 }] };
    case 'money.debt-payoff.v2':
      return { inRange: [{ strategy: 'snowball' }, { strategy: 'avalanche' }], invalid: [{ strategy: 'minimum' }, {}] };
    case 'money.diversification.v2': {
      const ids = (p.assets as Json[]).map((a) => a.id as string);
      const inRange = product(ids.map(() => range(0, 100, p.step))).filter((w) => w.reduce((sum, v) => sum + v, 0) === 100)
        .map((w) => ({ weights: Object.fromEntries(ids.map((assetId, index) => [assetId, w[index]])) }));
      return { inRange, invalid: [{ weights: Object.fromEntries(ids.map((assetId, index) => [assetId, index === 0 ? 90 : 0])) }, { weights: {} }] };
    }
    case 'money.lemonade-stand.v2':
      return { inRange: product([range(0, p.max_price_minor, p.price_step_minor), range(0, p.max_cups)]).map(([price, cups]) => ({ price, cups })),
        invalid: [{ price: p.max_price_minor + p.price_step_minor, cups: 0 }, { price: 0, cups: p.max_cups + 1 }], initial: { price: 0, cups: 0 } };
    default:
      return null;
  }
}

/** Story choices may accept every option (a decision, not a test); only those kinds are exempt from "not trivially met". */
const ALL_MET_ALLOWED = new Set(['story.branch.v2', 'story.dialogue-choice.v2', 'story.would-you-rather.v2']);

export interface BehaviourSegmentReport { segmentId: string; type: string; states: number; ok: boolean; problems: string[] }

/** Runs the gate over one validated document and its private answer keys. */
export function checkV2Behaviour(document: V2PublicLesson, answerKeys: Record<string, unknown>): BehaviourSegmentReport[] {
  const reports: BehaviourSegmentReport[] = [];
  for (const segment of document.segments) {
    if (segment.grading !== 'server') continue;
    const problems: string[] = [];
    const rubric = answerKeys[segment.id] as Json;
    const space = behaviourSpace(segment as unknown as Json, rubric);
    if (!space) { reports.push({ segmentId: segment.id, type: segment.type, states: 0, ok: false, problems: ['no behaviour space defined for this kind'] }); continue; }
    const verdict = (response: unknown): 'met' | 'review' | 'invalid' | 'threw' => {
      try {
        const graded = gradeV2Visual(document, answerKeys, segment.id, response);
        return graded === null ? 'invalid' : graded.correct ? 'met' : 'review';
      } catch { return 'threw'; }
    };
    let met = 0; let review = 0;
    for (const response of space.inRange) {
      const result = verdict(response);
      if (result === 'threw') { problems.push(`a permitted state threw: ${JSON.stringify(response).slice(0, 120)}`); break; }
      if (result === 'invalid') { problems.push(`a permitted state was refused: ${JSON.stringify(response).slice(0, 120)}`); break; }
      if (result === 'met') met += 1; else review += 1;
      if (space.expectMet && space.expectMet(response as Json) !== (result === 'met')) {
        problems.push(`the met set differs from the rubric's accepted answers at ${JSON.stringify(response).slice(0, 120)}`); break;
      }
    }
    if (met === 0) problems.push('the target is unreachable: no permitted state is met');
    if (review === 0 && !ALL_MET_ALLOWED.has(segment.type)) problems.push('the rubric is trivially met: every permitted state is met');
    for (const response of space.invalid) {
      const result = verdict(response);
      if (result !== 'invalid') problems.push(`an off-grid or impossible state was not refused (${result}): ${JSON.stringify(response).slice(0, 120)}`);
    }
    if (space.initial !== undefined && verdict(space.initial) === 'met') problems.push('the initial board state is already met');
    reports.push({ segmentId: segment.id, type: segment.type, states: space.inRange.length, ok: problems.length === 0, problems });
  }
  return reports;
}

/** A worked example's written algorithm must match the algorithm, a check the renderer relies on; exported for the gate's tests. */
export function algorithmIsStandard(algorithm: Json): boolean {
  const steps = longArithmeticSteps(algorithm as Parameters<typeof longArithmeticSteps>[0]);
  return JSON.stringify(steps) === JSON.stringify(algorithm.steps);
}
