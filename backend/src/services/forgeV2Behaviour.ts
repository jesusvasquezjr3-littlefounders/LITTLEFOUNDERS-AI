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
import { longArithmeticSteps } from './v2SegmentFamilies.js';

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
      return { inRange: [{ schema: 'change' }, { schema: 'compare' }], invalid: [{ schema: 'combine' }] };
    case 'math.schema-diagram.slots.v2':
      return { inRange: product([range(0, p.income), range(0, p.income)]).map(([income, spending]) => ({ income: String(income), spending: String(spending) })),
        invalid: [{ income: String(p.income + 1), spending: '1' }] };
    case 'math.schema-diagram.answer.v2':
      return { inRange: range(0, p.income).map((value) => ({ value: String(value) })), invalid: [{ value: String(p.income + 1) }] };
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
    case 'math.place-value.v2':
      return { inRange: product([range(0, Math.floor(p.total / 10)), range(0, 3), range(0, 29)]).map(([trades, tens, ones]) => ({ trades, tens: String(tens), ones: String(ones) })),
        invalid: [{ trades: Math.floor(p.total / 10) + 1, tens: '0', ones: '0' }] };
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
      return { inRange: subsets(ids).map((flagged) => ({ flagged })), invalid: [{ flagged: ['not-a-message'] }],
        expectMet: (r) => sameSet(r.flagged, rubric.scam_ids) };
    }
    case 'money.coin-tray.v2':
    case 'money.making-change.v2': {
      const over = { counts: Object.fromEntries((p.denominations as Json[]).map((d, index) => [String(d.value_minor), index === 0 ? d.available + 1 : 0])) };
      return { inRange: money(p.denominations), invalid: [over, { counts: {} }] };
    }
    case 'story.branch.v2':
    case 'story.would-you-rather.v2':
      return { inRange: (p.options as Json[]).map((option) => ({ choice: option.id })), invalid: [{ choice: 'not-an-option' }],
        expectMet: (r) => (rubric.acceptable_choice_ids as string[]).includes(r.choice) };
    case 'story.dialogue-choice.v2':
      return { inRange: (p.replies as Json[]).map((option) => ({ choice: option.id })), invalid: [{ choice: 'not-an-option' }],
        expectMet: (r) => (rubric.acceptable_choice_ids as string[]).includes(r.choice) };
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
