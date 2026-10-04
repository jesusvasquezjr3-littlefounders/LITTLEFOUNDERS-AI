import { centsToMicro, fromMicro, offsetsAround, toMicro, withinTolerance } from './decimals.js';
import { bounded, product, range, sameJson, type HzBuilder, type Json } from './shared.js';

const divRound = (n: bigint, d: bigint): bigint => { const top = 2n * n + d; const q = top / (2n * d); return top % (2n * d) !== 0n && top < 0n ? q - 1n : q; };

const compoundCents = (principal: number, rate: number, years: number): bigint =>
  divRound(BigInt(principal) * BigInt(100 + rate) ** BigInt(years), 100n ** BigInt(years));

const compound: HzBuilder = (p, r) => {
  const options = (p.options as Array<{ id: string }>).map((option) => option.id);
  const explains = p.explain as string[];
  const reaches = (rate: number, years: number) => years <= p.challenge.maximumYears && compoundCents(p.principalCents, rate, years) >= BigInt(p.challenge.minimumCents);
  const all = product<string | number>([options, range(1, 12), range(1, 40), explains]).map(([predict, rate, years, explain]) => ({ predict, rate, years, explain }));
  const keep = all.filter((state) => state.predict === r.predictOption && state.explain === r.explainId && reaches(state.rate as number, state.years as number)).slice(0, 40);
  const states = bounded(all, 2_400, keep);
  const spare = ['interest-on-interest', 'same-each-year', 'rate-grows', 'deposit-grows'].find((id) => !explains.includes(id));
  const base = { predict: options[0], rate: p.scenario.rate, years: p.scenario.years, explain: explains[0] };
  return {
    inRange: states,
    invalid: [
      { ...base, predict: 'unknown-option' }, { ...base, rate: 0 }, { ...base, rate: 13 }, { ...base, rate: 6.5 }, { ...base, years: 0 }, { ...base, years: 41 },
      { ...base, rate: '7' }, { ...base, explain: 'not-an-explanation' }, { ...base, explain: 7 }, { predict: options[0], rate: 7 }, { ...base, extra: 1 },
      ...(spare ? [{ ...base, explain: spare }] : []),
    ],
    initial: { predict: options[0], rate: p.scenario.rate, years: p.scenario.years },
    expectMet: (response) => response.predict === r.predictOption && response.explain === r.explainId && reaches(response.rate, response.years),
  };
};

interface Flow { year: number; cents: bigint }

const growthOf = (rateBps: number) => 10_000n + BigInt(rateBps);

function worth(flows: Flow[], rateBps: number, horizon: number, ask: string): bigint {
  const growth = growthOf(rateBps);
  const span = BigInt(horizon);
  if (ask === 'present') {
    const top = flows.reduce((sum, flow) => sum + flow.cents * 10_000n ** BigInt(flow.year) * growth ** (span - BigInt(flow.year)), 0n);
    return divRound(top, growth ** span);
  }
  const top = flows.reduce((sum, flow) => sum + flow.cents * growth ** (span - BigInt(flow.year)) * 10_000n ** BigInt(flow.year), 0n);
  return divRound(top, 10_000n ** span);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}

const timeValue: HzBuilder = (p, r) => {
  const task = p.task as Json;
  const order = task.kind === 'order';
  const slotIds: string[] = order ? (task.amountsCents as number[]).map((_, index) => `year-${index + 1}`) : Array.from({ length: task.count + 1 }, (_, year) => `year-${year}`);
  const pieceIds: string[] = order ? (task.amountsCents as number[]).map((_, index) => `pay-${index + 1}`) : ['payment'];
  const centsOf = (piece: string): bigint => BigInt(order ? task.amountsCents[pieceIds.indexOf(piece)] : task.amountCents);
  const horizon = order ? slotIds.length : task.count;
  const arrangements: Array<Record<string, string[]>> = [];
  if (order) {
    for (const perm of permutations(pieceIds)) arrangements.push(Object.fromEntries(slotIds.map((slot, index) => [slot, [perm[index]!]])));
    for (const mask of range(1, 2 ** slotIds.length - 2)) {
      const slots = slotIds.filter((_, index) => (mask >> index) & 1);
      arrangements.push(Object.fromEntries(slots.map((slot) => [slot, [pieceIds[slotIds.indexOf(slot)]!]])));
    }
  } else {
    for (const mask of range(1, 2 ** slotIds.length - 1)) arrangements.push(Object.fromEntries(slotIds.filter((_, index) => (mask >> index) & 1).map((slot) => [slot, ['payment']])));
  }
  const targetOf = (slots: Record<string, string[]>): bigint => centsToMicro(Number(worth(
    Object.entries(slots).flatMap(([slot, pieces]) => pieces.map((piece) => ({ year: Number(slot.slice(5)), cents: centsOf(piece) }))), p.rateBps, horizon, p.ask)));
  const states: unknown[] = [];
  const full = new Set(arrangements.slice(0, order ? permutations(pieceIds).length : 0));
  for (const slots of arrangements) {
    const target = targetOf(slots);
    const offsets = full.has(slots) || !order ? offsetsAround(target, r.tolerance, r.review) : [0n];
    for (const offset of offsets) {
      const value = target + offset;
      if (value < 0n || value > 1_000_000_000_000n) continue;
      states.push({ slots, value: fromMicro(value) });
    }
  }
  const sameSlots = (a: Record<string, string[]>, b: Record<string, string[]>) => slotIds.every((slot) => sameJson(a[slot] ?? [], b[slot] ?? []));
  const unknownPiece = order ? 'coin-1' : 'coin';
  const first = Object.fromEntries([[slotIds[order ? 0 : 1]!, [pieceIds[0]!]]]);
  return {
    inRange: bounded(states, 2_600, (r.solutions as Array<Record<string, string[]>>).map((slots) => ({ slots, value: fromMicro(targetOf(slots)) }))),
    invalid: [
      { slots: {} }, { slots: { [`year-${slotIds.length + 3}`]: [pieceIds[0]!] } }, { slots: { [slotIds[0]!]: [unknownPiece] } }, { slots: { [slotIds[0]!]: [] } },
      { slots: { [slotIds[0]!]: [pieceIds[0]!, pieceIds[0]!] } },
      ...(order ? [{ slots: { [slotIds[0]!]: [pieceIds[0]!], [slotIds[1]!]: [pieceIds[0]!] } }, { slots: { [slotIds[0]!]: [pieceIds[0]!, pieceIds[1]!] } }] : []),
      { slots: first, value: 'abc' }, { slots: first, value: '-1' }, { slots: first, value: '1000001' }, { slots: first, value: 5 }, { slots: first, value: '1,5' },
      { value: '10' }, { slots: first, extra: 1 }, { slots: 'year-1' },
    ],
    initial: { slots: order ? Object.fromEntries(slotIds.map((slot, index) => [slot, [pieceIds[index]!]])) : {} },
    expectMet: (response) => (r.solutions as Array<Record<string, string[]>>).some((slots) => sameSlots(slots, response.slots))
      && withinTolerance(toMicro(response.value)!, targetOf(response.slots), r.tolerance),
  };
};

const RATE_RANGE = (p: Json): [number, number] => p.kind === 'effective' ? [0, 1000] : p.kind === 'irr' ? [0, 100] : p.kind === 'card' ? (p.ask === 'months' ? [0, 600] : [0, 1_000_000]) : [-100_000, 1_000_000];

const rateReturn: HzBuilder = (p, r) => {
  const target = toMicro(r.target);
  if (target === null) return null;
  const [low, high] = RATE_RANGE(p);
  const lowMicro = BigInt(low) * 1_000_000n;
  const highMicro = BigInt(high) * 1_000_000n;
  const values = offsetsAround(target, r.tolerance, r.review).map((offset) => target + offset).filter((value) => value >= lowMicro && value <= highMicro);
  const noise = [0n, 1n, 9_999n, 10_000n].map((step) => target + step * 7n).filter((value) => value >= lowMicro && value <= highMicro);
  const texts = [...new Set([...values, ...noise])].map(fromMicro);
  return {
    inRange: texts.map((value) => ({ value, final: true })),
    invalid: [
      { value: r.target }, { value: r.target, final: false }, { value: r.target, final: 'yes' }, { value: fromMicro(lowMicro - 10_000n), final: true },
      { value: fromMicro(highMicro + 10_000n), final: true }, { value: 'abc', final: true }, { value: '1e3', final: true }, { value: '', final: true },
      { value: 5, final: true }, { final: true }, { value: r.target, final: true, extra: 1 },
    ],
    initial: { value: fromMicro(lowMicro) },
    expectMet: (response) => withinTolerance(toMicro(response.value)!, target, r.tolerance),
  };
};

export const FIN_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'money.compound-interest.v2': compound,
  'money.time-value.v2': timeValue,
  'money.rate-return.v2': rateReturn,
};
