import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import {
  COMPOUND, FIN1_CAPABILITIES, RATE_RETURN, TIME_VALUE, bestOrder, cardRun, centsText, compoundValue, effectiveBps, fin1, flowsOf, irrValue, npvValue, permutations,
  readTimeValue, valueOfArrangement, worthAt,
} from '../../v2/horizonte/fin1.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';
import '../../v2/solvabilityPacks.js';

const tv = { tolerance: { absolute: '0.05' }, review: { absolute: '2' } };
const year = (slots: Record<string, string>) => Object.fromEntries(Object.entries(slots).map(([slot, piece]) => [slot, [piece]]));

interface Case { id: string; type: string; visual: string; payload: Record<string, unknown>; key: unknown }
const CASES: Case[] = [
  {
    id: 'compound-thirty', type: COMPOUND, visual: 'compound-interest',
    payload: {
      principalCents: 100_000, scenario: { rate: 7, years: 30 },
      options: [{ id: 'opt-a', cents: 310_000 }, { id: 'opt-b', cents: 500_000 }, { id: 'opt-c', cents: 760_000 }, { id: 'opt-d', cents: 1_200_000 }],
      challenge: { minimumCents: 200_000, maximumYears: 12 }, explain: ['same-each-year', 'interest-on-interest', 'deposit-grows'],
    },
    key: { predictOption: 'opt-c', explainId: 'interest-on-interest' },
  },
  {
    id: 'receive-three', type: TIME_VALUE, visual: 'time-value',
    payload: { rateBps: 600, ask: 'present', task: { kind: 'order', side: 'receive', amountsCents: [100_000, 200_000, 300_000] } },
    key: { solutions: [year({ 'year-1': 'pay-3', 'year-2': 'pay-2', 'year-3': 'pay-1' })], ...tv },
  },
  {
    id: 'pay-four', type: TIME_VALUE, visual: 'time-value',
    payload: { rateBps: 800, ask: 'future', task: { kind: 'order', side: 'pay', amountsCents: [150_000, 50_000, 100_000, 200_000] } },
    key: { solutions: [year({ 'year-1': 'pay-2', 'year-2': 'pay-3', 'year-3': 'pay-1', 'year-4': 'pay-4' })], ...tv },
  },
  {
    id: 'annuity-end', type: TIME_VALUE, visual: 'time-value',
    payload: { rateBps: 600, ask: 'present', task: { kind: 'annuity', timing: 'end', amountCents: 100_000, count: 3 } },
    key: { solutions: [year({ 'year-1': 'payment', 'year-2': 'payment', 'year-3': 'payment' })], ...tv },
  },
  {
    id: 'annuity-start', type: TIME_VALUE, visual: 'time-value',
    payload: { rateBps: 600, ask: 'future', task: { kind: 'annuity', timing: 'start', amountCents: 100_000, count: 3 } },
    key: { solutions: [year({ 'year-0': 'payment', 'year-1': 'payment', 'year-2': 'payment' })], ...tv },
  },
  {
    id: 'effective-monthly', type: RATE_RETURN, visual: 'effective-rate',
    payload: { kind: 'effective', nominalBps: 2400, periodsPerYear: 12 }, key: { target: '26.82', tolerance: { absolute: '0.05' }, review: { absolute: '1' } },
  },
  {
    id: 'card-months', type: RATE_RETURN, visual: 'card-payoff',
    payload: { kind: 'card', ask: 'months', balanceCents: 200_000, aprBps: 1800, minimumPctBps: 100, floorCents: 2500 }, key: { target: '131', tolerance: { absolute: '0' }, review: { absolute: '6' } },
  },
  {
    id: 'card-interest', type: RATE_RETURN, visual: 'card-payoff',
    payload: { kind: 'card', ask: 'interest', balanceCents: 500_000, aprBps: 2400, minimumPctBps: 100, floorCents: 2500 }, key: { target: '8886.94', tolerance: { absolute: '0.05' }, review: { absolute: '50' } },
  },
  {
    id: 'npv-project', type: RATE_RETURN, visual: 'cash-flow',
    payload: { kind: 'npv', rateBps: 1000, outlayCents: 1_000_000, flowsCents: [400_000, 500_000, 600_000] }, key: { target: '2276.48', tolerance: { absolute: '0.05' }, review: { absolute: '50' } },
  },
  {
    id: 'irr-project', type: RATE_RETURN, visual: 'cash-flow',
    payload: { kind: 'irr', outlayCents: 1_000_000, flowsCents: [400_000, 500_000, 600_000] }, key: { target: '21.65', tolerance: { absolute: '0.1' }, review: { absolute: '1' } },
  },
];
const byId = (id: string) => CASES.find((item) => item.id === id)!;
const documentOf = (item: Case, change: (segment: Record<string, unknown>) => void = () => undefined) => {
  const segment: Record<string, unknown> = { id: item.id, type: item.type, visual: { type: item.visual }, payload: structuredClone(item.payload) };
  change(segment);
  return { segments: [segment] };
};
const gates = (item: Case, change?: (segment: Record<string, unknown>) => void, key: unknown = item.key) => horizontePieceGates(documentOf(item, change), { [item.id]: key });
const messages = (item: Case, change?: (segment: Record<string, unknown>) => void, key: unknown = item.key) => gates(item, change, key).map((problem) => problem.message);
const withPayload = (patch: Record<string, unknown>) => (segment: Record<string, unknown>) => { segment.payload = { ...(segment.payload as object), ...patch }; };

describe('fin1 pack in the Forge (F1.10, F2.11, F2.12)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    expect(Object.keys(FIN1_CAPABILITIES)).toEqual([COMPOUND, TIME_VALUE, RATE_RETURN]);
    expect(FIN1_CAPABILITIES[COMPOUND]).toEqual(['visual.compound-growth.v1', 'operation.predict-option.v1', 'operation.slide-rate-years.v1', 'operation.explain-pick.v1']);
    for (const type of Object.keys(FIN1_CAPABILITIES) as Array<keyof typeof FIN1_CAPABILITIES>) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(FIN1_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(FIN1_CAPABILITIES[type]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(fin1);
  });

  it('adds authoring guidance only when the skeleton uses the type, with the age scope of each piece', () => {
    expect(horizonteGuidanceFor([COMPOUND]).join('\n')).toMatch(/ages 10-17/);
    expect(horizonteGuidanceFor([TIME_VALUE]).join('\n')).toMatch(/ages 14-17/);
    expect(horizonteGuidanceFor([RATE_RETURN]).join('\n')).toMatch(/ages 15-17/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('reproduces the golden values of the finance model, independently of Core', () => {
    expect(compoundValue(100_000, 7, 30)).toBe(761_226);
    expect(compoundValue(100_000, 7, 10)).toBe(196_715);
    expect(centsText(compoundValue(100_000, 7, 30))).toBe('7612.26');
    const value = (id: string, slots: Record<string, string[]>) => {
      const payload = readTimeValue(byId(id).payload);
      if (typeof payload === 'string') throw new Error(payload);
      return valueOfArrangement(payload, flowsOf(payload, slots)!);
    };
    expect(value('receive-three', year({ 'year-1': 'pay-3', 'year-2': 'pay-2', 'year-3': 'pay-1' }))).toBe(544_980);
    expect(value('pay-four', year({ 'year-1': 'pay-2', 'year-2': 'pay-3', 'year-3': 'pay-1', 'year-4': 'pay-4' }))).toBe(541_626);
    expect(value('annuity-end', year({ 'year-1': 'payment', 'year-2': 'payment', 'year-3': 'payment' }))).toBe(267_301);
    expect(value('annuity-start', year({ 'year-0': 'payment', 'year-1': 'payment', 'year-2': 'payment' }))).toBe(337_462);
    expect(effectiveBps(2400, 12)).toBe(2682);
    expect(cardRun({ balance: 200_000, aprBps: 1800, pctBps: 100, floor: 2500 })?.months).toBe(131);
    expect(cardRun({ balance: 500_000, aprBps: 2400, pctBps: 100, floor: 2500 })?.interest).toBe(888_694);
    expect(npvValue(1000, 1_000_000, [400_000, 500_000, 600_000])).toBe(227_648);
    expect(irrValue(1_000_000, [400_000, 500_000, 600_000])).toBe(2165);
    expect(irrValue(1_000_000, [400_000, 500_000])).toBeNull();
  });

  it('rounds half up once and handles a negative sum', () => {
    expect(worthAt([{ year: 1, cents: 105 }], 1000, 0)).toBe(95);
    expect(worthAt([{ year: 1, cents: 1 }], 10_000, 0)).toBe(1);
    expect(npvValue(1000, 1_000_000, [100_000, 100_000])).toBe(-826_446);
    expect(centsText(-5)).toBe('-0.05');
    expect([...permutations([1, 2, 3])]).toHaveLength(6);
  });

  it('accepts the ten fixtures with their keys, and a document with no key', () => {
    for (const item of CASES) {
      expect(gates(item), item.id).toEqual([]);
      expect(horizontePieceGates(documentOf(item)), item.id).toEqual([]);
    }
    expect(horizontePieceGates({ segments: [{ id: 'other', type: 'math.ten-frame.v2', visual: { type: 'ten-frame' }, payload: { start: [4] } }] })).toEqual([]);
    expect(horizontePieceGates({})).toEqual([]);
  });

  it('puts the checker on gate 4 for a malformed payload of each piece', () => {
    expect(gates(byId('compound-thirty'), withPayload({ extra: 1 }))[0]).toMatchObject({ gate: 4, segmentId: 'compound-thirty' });
    expect(gates(byId('compound-thirty'), withPayload({ scenario: { rate: 13, years: 30 } }))).toHaveLength(1);
    expect(gates(byId('receive-three'), withPayload({ rateBps: 50 }))).toHaveLength(1);
    expect(gates(byId('npv-project'), withPayload({ flowsCents: [1] }))).toHaveLength(1);
    expect(gates(byId('card-months'), withPayload({ aprBps: 4000 }))).toHaveLength(1);
  });

  describe('F1.10 compound interest', () => {
    const item = byId('compound-thirty');
    it('refuses a tie for nearest, an unreachable challenge and a challenge that already holds', () => {
      expect(messages(item, withPayload({ options: [{ id: 'opt-a', cents: 700_000 }, { id: 'opt-b', cents: 822_452 }, { id: 'opt-c', cents: 310_000 }] }), { predictOption: 'opt-a', explainId: 'interest-on-interest' })[0]).toMatch(/equally near/);
      expect(messages(item, withPayload({ challenge: { minimumCents: 90_000_000, maximumYears: 5 } }))[0]).toMatch(/No slider position/);
      expect(messages(item, withPayload({ challenge: { minimumCents: 500_000, maximumYears: 40 } }))[0]).toMatch(/already meet/);
    });
    it('refuses a key that is not the nearest option or not the real reason', () => {
      expect(messages(item, undefined, { predictOption: 'opt-a', explainId: 'interest-on-interest' })[0]).toMatch(/nearest/);
      expect(messages(item, undefined, { predictOption: 'opt-z', explainId: 'interest-on-interest' })[0]).toMatch(/not one of/);
      expect(messages(item, undefined, { predictOption: 'opt-c', explainId: 'same-each-year' })[0]).toMatch(/real reason/);
      expect(messages(item, undefined, { predictOption: 'opt-c' })[0]).toMatch(/exactly/);
    });
    it('refuses the wrong visual', () => {
      expect(messages(item, (segment) => { segment.visual = { type: 'time-value' }; })[0]).toMatch(/compound-interest visual/);
    });
  });

  describe('F2.11 time value', () => {
    it('refuses a listed order that is already best, and equal amounts', () => {
      expect(messages(byId('receive-three'), withPayload({ task: { kind: 'order', side: 'receive', amountsCents: [300_000, 200_000, 100_000] } }))[0]).toMatch(/already the best/);
      expect(messages(byId('receive-three'), withPayload({ task: { kind: 'order', side: 'receive', amountsCents: [100_000, 100_000, 300_000] } }))[0]).toMatch(/differ/);
    });
    it('refuses a key that holds a worse order, a wrong annuity timing or a place that is not on the board', () => {
      const receive = byId('receive-three');
      expect(messages(receive, undefined, { solutions: [year({ 'year-1': 'pay-1', 'year-2': 'pay-2', 'year-3': 'pay-3' })], ...tv })[0]).toMatch(/not the best order: receive the biggest/);
      expect(messages(byId('pay-four'), undefined, { solutions: [year({ 'year-1': 'pay-4', 'year-2': 'pay-1', 'year-3': 'pay-3', 'year-4': 'pay-2' })], ...tv })[0]).toMatch(/pay the biggest amount last/);
      expect(messages(byId('annuity-start'), undefined, { solutions: [year({ 'year-1': 'payment', 'year-2': 'payment', 'year-3': 'payment' })], ...tv })[0]).toMatch(/years 0 to 2/);
      expect(messages(byId('annuity-end'), undefined, { solutions: [year({ 'year-9': 'payment' })], ...tv })[0]).toMatch(/not on the board/);
    });
    it('refuses a malformed tolerance and a review band narrower than the tolerance', () => {
      const { solutions } = byId('receive-three').key as { solutions: unknown };
      expect(messages(byId('receive-three'), undefined, { solutions, tolerance: { absolute: '5 cents' } })[0]).toMatch(/plain decimal/);
      expect(messages(byId('receive-three'), undefined, { solutions, tolerance: { absolute: '2' }, review: { absolute: '1' } })[0]).toMatch(/narrower/);
      expect(messages(byId('receive-three'), undefined, { solutions })[0]).toMatch(/solutions, tolerance/);
    });
    it('knows the best order for each side', () => {
      const order = (id: string) => bestOrder(readTimeValue(byId(id).payload) as Parameters<typeof bestOrder>[0]);
      expect(order('receive-three')).toEqual(year({ 'year-1': 'pay-3', 'year-2': 'pay-2', 'year-3': 'pay-1' }));
      expect(order('pay-four')).toEqual(year({ 'year-1': 'pay-2', 'year-2': 'pay-3', 'year-3': 'pay-1', 'year-4': 'pay-4' }));
    });
  });

  describe('F2.12 rate and return', () => {
    it('refuses a key that is not the model answer', () => {
      expect(messages(byId('effective-monthly'), undefined, { target: '26.8', tolerance: { absolute: '0.05' } })[0]).toMatch(/must be 26.82/);
      expect(messages(byId('card-months'), undefined, { target: '130', tolerance: { absolute: '0' } })[0]).toMatch(/must be 131/);
      expect(messages(byId('npv-project'), undefined, { target: '2276.4', tolerance: { absolute: '0.05' } })[0]).toMatch(/must be 2276.48/);
    });
    it('accepts the same number spelled with a trailing zero', () => {
      expect(messages(byId('effective-monthly'), undefined, { target: '26.820', tolerance: { absolute: '0.05' } })).toEqual([]);
    });
    it('refuses an IRR tolerance finer than the dial, and a malformed band', () => {
      expect(messages(byId('irr-project'), undefined, { target: '21.65', tolerance: { absolute: '0.05' } })[0]).toMatch(/at least 0.1/);
      expect(messages(byId('irr-project'), undefined, { target: '21.65', tolerance: { relative_bps: 5 } })[0]).toMatch(/at least 0.1/);
      expect(messages(byId('irr-project'), undefined, { target: '21.65', tolerance: { absolute: '-1' } })[0]).toMatch(/plain decimal/);
      expect(messages(byId('irr-project'), undefined, { target: '21.65' })[0]).toMatch(/rate key is/);
    });
    it('refuses a case with nothing to find or no answer', () => {
      expect(messages(byId('effective-monthly'), withPayload({ periodsPerYear: 1 }))[0]).toMatch(/nothing to find/);
      expect(messages(byId('effective-monthly'), withPayload({ nominalBps: 100, periodsPerYear: 2 }))[0]).toMatch(/nothing to find/);
      expect(messages(byId('irr-project'), withPayload({ flowsCents: [400_000, 500_000] }))[0]).toMatch(/inflows that beat the outlay/);
      expect(messages(byId('irr-project'), withPayload({ flowsCents: [4_000_000, 4_000_000] }))[0]).toMatch(/below 100 percent/);
    });
    it('refuses the wrong visual for a case', () => {
      expect(messages(byId('npv-project'), (segment) => { segment.visual = { type: 'card-payoff' }; })[0]).toMatch(/cash-flow visual/);
    });
  });

  describe('solvability (F0.4)', () => {
    it('registers a checker for the two puzzle pieces and for the typed-number piece', () => {
      expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining([COMPOUND, TIME_VALUE, RATE_RETURN]));
    });
    const run = (item: Case, change?: (segment: Record<string, unknown>) => void, key: unknown = item.key) => runSolvabilityGate(documentOf(item, change), { [item.id]: key });
    it('passes the fixtures with their keys and without them', () => {
      for (const item of CASES) {
        expect(run(item), item.id).toEqual([]);
        expect(runSolvabilityGate(documentOf(item)), item.id).toEqual([]);
      }
    });
    it('names a tie, an unreachable challenge and a challenge that already holds', () => {
      const compound = byId('compound-thirty');
      const options = [{ id: 'opt-a', cents: 700_000 }, { id: 'opt-b', cents: 822_452 }, { id: 'opt-c', cents: 310_000 }];
      expect(run(compound, withPayload({ options }), { predictOption: 'opt-a', explainId: 'interest-on-interest' }).map((finding) => finding.code)).toContain('ambiguous-solution');
      expect(run(compound, withPayload({ challenge: { minimumCents: 90_000_000, maximumYears: 5 } })).map((finding) => finding.code)).toContain('no-solution');
      expect(run(compound, withPayload({ challenge: { minimumCents: 500_000, maximumYears: 40 } })).map((finding) => finding.code)).toContain('impossible-state');
    });
    it('warns when most slider positions meet the challenge', () => {
      const found = run(byId('compound-thirty'), withPayload({ scenario: { rate: 1, years: 1 }, challenge: { minimumCents: 120_000, maximumYears: 40 } }));
      expect(found.find((finding) => finding.code === 'vacuous-rubric')).toMatchObject({ severity: 'review' });
    });
    it('names a key that accepts a wrong option, a wrong reason or a dangling option', () => {
      const compound = byId('compound-thirty');
      expect(run(compound, undefined, { predictOption: 'opt-b', explainId: 'interest-on-interest' }).map((finding) => finding.code)).toContain('rubric-accepts-invalid');
      expect(run(compound, undefined, { predictOption: 'opt-c', explainId: 'rate-grows' }).map((finding) => finding.code)).toContain('rubric-accepts-invalid');
      expect(run(compound, undefined, { predictOption: 'opt-z', explainId: 'interest-on-interest' }).map((finding) => finding.code)).toContain('dangling-reference');
      expect(run(compound, undefined, {}).map((finding) => finding.code)).toContain('rubric-gap');
    });
    it('searches every order and names a key with a worse order, a missing best order or a bad timing', () => {
      const receive = byId('receive-three');
      const worse = { solutions: [year({ 'year-1': 'pay-1', 'year-2': 'pay-2', 'year-3': 'pay-3' })], ...tv };
      expect(run(receive, undefined, worse).map((finding) => finding.code)).toContain('rubric-accepts-invalid');
      expect(run(receive, undefined, { solutions: [], ...tv }).map((finding) => finding.code)).toContain('rubric-gap');
      expect(run(receive, undefined, { solutions: [year({ 'year-7': 'pay-1' })], ...tv }).map((finding) => finding.code)).toContain('dangling-reference');
      expect(run(receive, withPayload({ task: { kind: 'order', side: 'receive', amountsCents: [300_000, 200_000, 100_000] } })).map((finding) => finding.code)).toContain('impossible-state');
      expect(run(byId('annuity-end'), undefined, { solutions: [year({ 'year-0': 'payment', 'year-1': 'payment', 'year-2': 'payment' })], ...tv }).map((finding) => finding.code)).toContain('rubric-accepts-invalid');
    });
    it('stays inside a small node budget with a named finding, never silently', () => {
      const found = runSolvabilityGate(documentOf(byId('pay-four')), { 'pay-four': byId('pay-four').key }, { nodeBudget: 5 });
      expect(found.map((finding) => finding.code)).toContain('budget-exceeded');
    });
  });
});
