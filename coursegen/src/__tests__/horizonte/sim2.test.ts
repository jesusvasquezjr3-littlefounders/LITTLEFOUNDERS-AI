import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { SIM2_CAPABILITIES, sim2 } from '../../v2/horizonte/sim2.js';

const LIFE = 'money.life-sim.v2';

type Doc = { segments: Array<Record<string, unknown>> };
const doc = (prompt: string, payload: unknown, visual = 'life-sim', id = 'seg-sim'): Doc => ({ segments: [{ id, type: LIFE, visual: { type: visual }, prompt, payload }] });
const gate = (document: Doc, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-sim': key });
const messages = (document: Doc, key?: unknown) => gate(document, key).map((problem) => problem.message);
const withPayload = (document: Doc, patch: Record<string, unknown>): Doc => ({ segments: [{ ...document.segments[0]!, payload: { ...(document.segments[0]!.payload as object), ...patch } }] });
const withPrompt = (document: Doc, prompt: string): Doc => ({ segments: [{ ...document.segments[0]!, prompt }] });

const portfolio = doc('Pick the highest stock share that still gets 90 of 100 futures past the target and above the floor.',
  { scenario: 'portfolio', periods: 5, cash: 10000, debt: 0, flow: 1000, finish: 19000, floor: 11000, goal: 90, choices: [0, 10, 25, 60, 80, 100], start: 80 });
const retirement = doc('Pick the most you can spend each chapter and still stay above the floor in 80 of 100 futures.',
  { scenario: 'retirement', periods: 5, cash: 100000, debt: 0, flow: 0, finish: 0, floor: 16000, goal: 80, choices: [10000, 15000, 20000, 25000, 30000, 35000], start: 30000 });
const insurance = doc('Pick the least cover that keeps you above the floor and on target in 90 of 100 futures.',
  { scenario: 'insurance', periods: 5, cash: 3000, debt: 0, flow: 3000, finish: 5500, floor: 1000, goal: 90, choices: [0, 10, 25, 85, 95, 100], start: 0 });
const life = doc('Split your pay between debt and savings. Get at least 60 of 100 futures on target above the floor.',
  { scenario: 'life', periods: 5, cash: 1000, debt: 5000, flow: 4000, finish: 5700, floor: 1400, goal: 60, choices: [0, 5, 30, 40, 50, 95, 100], start: 100 });

describe('sim2 pack in the Forge (F3.3)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    expect(HORIZONTE_FORGE_CAPABILITIES[LIFE]).toEqual(SIM2_CAPABILITIES[LIFE]);
    expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[LIFE]).toEqual(SIM2_CAPABILITIES[LIFE]);
    expect(SIM2_CAPABILITIES[LIFE]).toEqual(['visual.life-sim.v1', 'operation.seeded-run.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1']);
    expect(HORIZONTE_FORGE_PACKS).toContain(sim2);
  });

  it('adds authoring guidance only for the type a skeleton uses, with the age scope, the answer rules and the prompt rule', () => {
    const lines = horizonteGuidanceFor([LIFE]).join('\n');
    expect(lines).toMatch(/ages 13-17 and the adult pathway/);
    expect(lines).toMatch(/never carries the answer/);
    expect(lines).toMatch(/highest reliable choice for portfolio and retirement, the lowest for insurance and every reliable choice for life/);
    expect(lines).toMatch(/writes the goal in digits/);
    expect(horizonteGuidanceFor(['math.chance-sim.v2']).join('\n')).not.toMatch(/life-sim/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('accepts every authored example with its key and without one', () => {
    const keyed: Array<[Doc, unknown]> = [
      [portfolio, { target: { answers: [25] } }], [retirement, { target: { answers: [15000] } }],
      [insurance, { target: { answers: [85] } }], [life, { target: { answers: [30, 40, 50] } }],
    ];
    for (const [document, key] of keyed) {
      expect(gate(document, key)).toEqual([]);
      expect(gate(document)).toEqual([]);
    }
  });

  it('refuses a key that is not the exact answer set', () => {
    expect(messages(portfolio, { target: { answers: [10] } })[0]).toMatch(/must be the answers 25/);
    expect(messages(portfolio, { target: { answers: [25, 10] } })[0]).toMatch(/must be the answers 25/);
    expect(messages(insurance, { target: { answers: [85, 95, 100] } })[0]).toMatch(/must be the answers 85/);
    expect(messages(life, { target: { answers: [30, 40] } })[0]).toMatch(/must be the answers 30, 40, 50/);
    expect(messages(life, { target: { answers: [50, 40, 30] } })[0]).toMatch(/must be the answers 30, 40, 50/);
    expect(gate(portfolio, { target: 25 })[0]).toMatchObject({ gate: 4, segmentId: 'seg-sim' });
    expect(gate(portfolio, { answers: [25] })[0]).toMatchObject({ gate: 4, segmentId: 'seg-sim' });
    expect(gate(portfolio, null)[0]).toMatchObject({ gate: 4, segmentId: 'seg-sim' });
  });

  it('refuses a payload with no answer, a lucky borderline choice or a start that already solves it', () => {
    expect(messages(withPayload(portfolio, { finish: 9_000_000 }))[0]).toMatch(/No choice reaches the goal reliably/);
    expect(messages(withPayload(portfolio, { start: 25 }))[0]).toMatch(/already solves the piece/);
    const lucky = Array.from({ length: 50 }, (_, index) => 50 + index).map((goal) => messages(withPayload(portfolio, { goal }))[0]).filter((message) => message?.includes('by luck'));
    expect(lucky.length).toBeGreaterThan(0);
  });

  it('refuses a payload shape the Core contract refuses', () => {
    expect(messages(withPayload(portfolio, { scenario: 'lottery' }))[0]).toMatch(/scenario is portfolio, retirement, insurance or life/);
    expect(messages(withPayload(portfolio, { periods: 1 }))[0]).toMatch(/2 to 5 chapters/);
    expect(messages(withPayload(portfolio, { periods: 6 }))[0]).toMatch(/2 to 5 chapters/);
    expect(messages(withPayload(portfolio, { cash: -5 }))[0]).toMatch(/whole amounts up to 1000000/);
    expect(messages(withPayload(portfolio, { debt: 100 }))[0]).toMatch(/Only a life piece carries debt/);
    expect(messages(withPayload(life, { debt: 0 }))[0]).toMatch(/Only a life piece carries debt/);
    expect(messages(withPayload(portfolio, { floor: 1.5 }))[0]).toMatch(/finish and the floor are whole/);
    expect(messages(withPayload(portfolio, { goal: 100 }))[0]).toMatch(/goal is 50 to 99/);
    expect(messages(withPayload(portfolio, { goal: 49 }))[0]).toMatch(/goal is 50 to 99/);
    expect(messages(withPayload(portfolio, { choices: [0, 10] }))[0]).toMatch(/3 to 8 rising whole values/);
    expect(messages(withPayload(portfolio, { choices: [0, 60, 10] }))[0]).toMatch(/3 to 8 rising whole values/);
    expect(messages(withPayload(portfolio, { choices: [0, 10, 125] }))[0]).toMatch(/3 to 8 rising whole values/);
    expect(messages(withPayload(retirement, { choices: [10000, 15000, 2000000] }))[0]).toMatch(/3 to 8 rising whole values/);
    expect(messages(withPayload(portfolio, { start: 7 }))[0]).toMatch(/start is one of the choices/);
    expect(messages(withPayload(portfolio, { extra: 1 }))[0]).toMatch(/exactly the fields/);
    expect(messages(withPayload(portfolio, { answers: [25] }))[0]).toMatch(/exactly the fields/);
  });

  it('refuses a prompt that hides the goal, the wrong visual and a missing payload', () => {
    expect(messages(withPrompt(portfolio, 'Pick the highest stock share that still gets most futures past the target and above the floor.'))[0]).toMatch(/write the goal number of futures in digits/);
    expect(messages(withPrompt(portfolio, 'Pick the share that gets 9 of 100 futures past the target.'))[0]).toMatch(/write the goal number of futures in digits/);
    expect(messages(withPrompt(portfolio, 'Pick the share that gets 900 of 1000 futures past the target.'))[0]).toMatch(/write the goal number of futures in digits/);
    expect(messages(doc(portfolio.segments[0]!.prompt as string, portfolio.segments[0]!.payload, 'galton-sim'))[0]).toMatch(/visual must be life-sim/);
    expect(messages({ segments: [{ id: 'seg-sim', type: LIFE, visual: { type: 'life-sim' }, prompt: 'x' }] })[0]).toMatch(/exactly the fields/);
  });

  it('ignores other segment types', () => {
    expect(horizontePieceGates({ segments: [{ id: 'a', type: 'math.chance-sim.v2', visual: { type: 'x' }, prompt: 'x', payload: {} }] }).filter((problem) => /life/.test(problem.message))).toEqual([]);
  });
});
