import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { SIM1_CAPABILITIES, sim1 } from '../../v2/horizonte/sim1.js';

const CHANCE = 'math.chance-sim.v2';
const GALTON = 'math.galton-sim.v2';
const COVERAGE = 'stats.coverage-sim.v2';
const BOOTSTRAP = 'stats.bootstrap-sim.v2';

type Doc = { segments: Array<Record<string, unknown>> };
const doc = (type: string, visual: string, prompt: string, payload: unknown, id = 'seg-sim'): Doc => ({ segments: [{ id, type, visual: { type: visual }, prompt, payload }] });
const gate = (document: Doc, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-sim': key });
const messages = (document: Doc, key?: unknown) => gate(document, key).map((problem) => problem.message);

const die = doc(CHANCE, 'chance-sim', 'Roll at least 2000 times. Stop when the share of sixes is within 3 points of its chance.',
  { machine: { kind: 'die', weights: [1, 1, 1, 1, 1, 1] }, event: [5], stops: [10, 100, 500, 2000, 5000], tolerance: 3, minTrials: 2000 });
const spinner = doc(CHANCE, 'chance-sim', 'Spin at least 2000 times. Stop when sectors 1 and 4 together are within 4 points of their chance.',
  { machine: { kind: 'spinner', weights: [2, 1, 1, 2] }, event: [0, 3], stops: [20, 100, 500, 2000, 5000], tolerance: 4, minTrials: 2000 });
const board = doc(GALTON, 'galton-sim', 'Drop at least 1500 balls. Stop when the share in bin 3 is within 5 points of its chance.',
  { view: 'board', rows: 6, rightPct: 50, bin: 3, stops: [20, 100, 500, 1500, 3000], tolerance: 5, minBalls: 1500 });
const biased = doc(GALTON, 'galton-sim', 'Each peg sends 7 of 10 balls right. Drop balls until bin 3 is within 5 points of its chance.',
  { view: 'board', rows: 4, rightPct: 70, bin: 3, stops: [20, 100, 500, 1500, 3000], tolerance: 5, minBalls: 1500 });
const coverage = doc(COVERAGE, 'coverage-sim', 'Where 3 in 5 say yes, pick a level and size so at least 92 intervals cover the truth.',
  { truth: { num: 3, den: 5 }, levels: [80, 90, 95, 99], sizes: [20, 50, 100, 200], start: { level: 80, size: 20 }, goal: { covered: 92 } });
const half = doc(COVERAGE, 'coverage-sim', 'Where half say yes, pick a level and size so at least 85 intervals cover the truth.',
  { truth: { num: 1, den: 2 }, levels: [90, 95, 99], sizes: [30, 100, 300], start: { level: 90, size: 30 }, goal: { covered: 85 } });
const bootstrap = doc(BOOTSTRAP, 'bootstrap-sim', 'Resample the six values with replacement. Run at least 500 resamples so the middle 90% of the totals settles.',
  { axis: { min: 0, max: 10 }, data: [2, 3, 3, 5, 6, 8], level: 90, stops: [50, 200, 500, 1000, 3000], tolerance: 1, minResamples: 500 });
const eight = doc(BOOTSTRAP, 'bootstrap-sim', 'Resample the eight values with replacement. Run at least 1000 resamples so the middle 80% of the totals settles.',
  { axis: { min: 10, max: 30 }, data: [12, 15, 15, 18, 22, 25, 25, 28], level: 80, stops: [100, 300, 1000, 2000, 3000], tolerance: 3, minResamples: 1000 });

const withPayload = (document: Doc, patch: Record<string, unknown>): Doc => ({ segments: [{ ...document.segments[0]!, payload: { ...(document.segments[0]!.payload as object), ...patch } }] });
const withPrompt = (document: Doc, prompt: string): Doc => ({ segments: [{ ...document.segments[0]!, prompt }] });

describe('sim1 pack in the Forge (F3.1, F3.2)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    for (const type of [CHANCE, GALTON, COVERAGE, BOOTSTRAP] as const) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(SIM1_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(SIM1_CAPABILITIES[type]);
      expect(SIM1_CAPABILITIES[type]).toContain('operation.seeded-run.v1');
      expect(SIM1_CAPABILITIES[type]).toContain('operation.show-table.v1');
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(sim1);
  });

  it('adds authoring guidance only for the types a skeleton uses, with the age scopes and the prompt rules', () => {
    expect(horizonteGuidanceFor([CHANCE]).join('\n')).toMatch(/ages 10-14 only.*never carries it/s);
    expect(horizonteGuidanceFor([GALTON]).join('\n')).toMatch(/ages 14-17 and the adult pathway/);
    expect(horizonteGuidanceFor([COVERAGE]).join('\n')).toMatch(/ages 16-17 and the adult pathway.*written in digits/s);
    expect(horizonteGuidanceFor([BOOTSTRAP]).join('\n')).toMatch(/exact low and high total/);
    expect(horizonteGuidanceFor([CHANCE]).join('\n')).not.toMatch(/bootstrap/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('accepts every authored example with its key and without one', () => {
    const keyed: Array<[Doc, unknown]> = [
      [die, { target: { num: 1, den: 6 } }], [spinner, { target: { num: 2, den: 3 } }],
      [board, { target: { num: 5, den: 16 } }], [biased, { target: { num: 1029, den: 2500 } }],
      [coverage, { target: { level: 99 } }], [half, { target: { level: 95 } }],
      [bootstrap, { target: { low: 19, high: 36 } }], [eight, { target: { low: 140, high: 180 } }],
    ];
    for (const [document, key] of keyed) {
      expect(gate(document, key)).toEqual([]);
      expect(gate(document)).toEqual([]);
    }
  });

  describe('chance', () => {
    it('refuses a key that is not the exact reduced chance, a non-reduced fraction included', () => {
      expect(messages(die, { target: { num: 1, den: 5 } })[0]).toMatch(/must be 1\/6, the exact reduced chance/);
      expect(messages(die, { target: { num: 2, den: 12 } })[0]).toMatch(/must be 1\/6/);
      expect(messages(spinner, { target: { num: 1, den: 3 } })[0]).toMatch(/must be 2\/3/);
      expect(gate(die, { target: { num: 1, den: 6 } })).toEqual([]);
      expect(gate(die, { target: 'one sixth' })[0]).toMatchObject({ gate: 4, segmentId: 'seg-sim' });
    });

    it('refuses a machine, an event, stops, a floor and a tolerance the Core contract refuses', () => {
      expect(messages(withPayload(die, { machine: { kind: 'die', weights: [1, 1, 1] } }))[0]).toMatch(/A coin has 2 weights, a die 6/);
      expect(messages(withPayload(die, { machine: { kind: 'die', weights: [1, 1, 1, 1, 1, 13] } }))[0]).toMatch(/each from 1 to 12/);
      expect(messages(withPayload(die, { event: [] }))[0]).toMatch(/non-empty, proper set of faces/);
      expect(messages(withPayload(die, { event: [0, 1, 2, 3, 4, 5] }))[0]).toMatch(/non-empty, proper set of faces/);
      expect(messages(withPayload(die, { event: [3, 2] }))[0]).toMatch(/rising order/);
      expect(messages(withPayload(die, { stops: [10, 100] }))[0]).toMatch(/3 to 8 rising counts up to 5000/);
      expect(messages(withPayload(die, { stops: [10, 100, 500, 2000, 6000] }))[0]).toMatch(/up to 5000/);
      expect(messages(withPayload(die, { minTrials: 10 }))[0]).toMatch(/floor must be one of the stops/);
      expect(messages(withPayload(die, { minTrials: 10, stops: [10, 100, 500, 2000, 5000] }))[0]).toMatch(/at least 20/);
      expect(messages(withPayload(die, { minTrials: 7 }))[0]).toMatch(/floor must be one of the stops/);
      expect(messages(withPayload(die, { stops: [2000, 3000, 4000], minTrials: 2000 }))[0]).toMatch(/never the first/);
      expect(messages(withPayload(die, { tolerance: 26 }))[0]).toMatch(/1 to 25 percentage points/);
    });

    it('refuses an event that is rare or near certain, and a tolerance too tight for the last stop', () => {
      const rare = withPayload(die, { machine: { kind: 'spinner', weights: [1, 12, 12, 12, 12, 12, 12, 12] }, event: [0] });
      expect(messages(rare)[0]).toMatch(/between 5% and 95%/);
      expect(messages(withPayload(die, { tolerance: 1 }))[0]).toMatch(/too tight for the last stop/);
      expect(messages(withPrompt(die, 'Roll at least 2000 times. Stop when the share of sixes is close to its chance.'))[0]).toMatch(/write the tolerance in digits/);
    });

    it('refuses the wrong visual and a missing payload', () => {
      expect(messages(doc(CHANCE, 'galton-sim', die.segments[0]!.prompt as string, die.segments[0]!.payload))[0]).toMatch(/visual must be chance-sim/);
      expect(messages({ segments: [{ id: 'seg-sim', type: CHANCE, visual: { type: 'chance-sim' }, prompt: 'x' }] })[0]).toMatch(/payload is missing/);
    });
  });

  describe('Galton board and random walk', () => {
    it('refuses a key that is not the exact chance of the bin', () => {
      expect(messages(board, { target: { num: 3, den: 8 } })[0]).toMatch(/must be 5\/16/);
      expect(messages(biased, { target: { num: 1029, den: 2501 } })[0]).toMatch(/must be 1029\/2500/);
    });

    it('refuses a board off the grid, a bin past the rows and a prompt that hides the bin or the tolerance', () => {
      expect(messages(withPayload(board, { rightPct: 55 }))[0]).toMatch(/multiple of 10/);
      expect(messages(withPayload(board, { rows: 11 }))[0]).toMatch(/3 to 10 rows/);
      expect(messages(withPayload(board, { bin: 7 }))[0]).toMatch(/bin from 0 to the rows/);
      expect(messages(withPayload(board, { view: 'galaxy' }))[0]).toMatch(/3 to 10 rows/);
      expect(messages(withPrompt(board, 'Drop at least 1500 balls. Stop when the share in the middle bin is within 5 points of its chance.'))[0]).toMatch(/write the bin in digits/);
      expect(messages(withPrompt(board, 'Drop at least 1500 balls. Stop when the share in bin 3 is close to its chance.'))[0]).toMatch(/write the tolerance in digits/);
    });

    it('refuses a bin in a tail that is under 5%, and a tolerance too tight for the last stop', () => {
      expect(messages(withPayload(board, { bin: 0 }))[0]).toMatch(/between 5% and 95%/);
      expect(messages(withPayload(board, { tolerance: 1 }))[0]).toMatch(/too tight for the last stop/);
    });
  });

  describe('coverage', () => {
    it('refuses a key that is not the lowest level that reaches the goal', () => {
      expect(messages(coverage, { target: { level: 95 } })[0]).toMatch(/must be level 99/);
      expect(messages(half, { target: { level: 99 } })[0]).toMatch(/must be level 95/);
      expect(messages(half, { target: { level: 90 } })[0]).toMatch(/must be level 95/);
    });

    it('refuses a goal no choice reaches and a goal the start already has', () => {
      expect(messages(withPayload(coverage, { levels: [80, 90], sizes: [20, 50], goal: { covered: 99 }, start: { level: 80, size: 20 } }))[0]).toMatch(/No level and size reach 99/);
      expect(messages(withPayload(half, { start: { level: 95, size: 30 } }))[0]).toMatch(/already reached at the start level/);
    });

    it('refuses a truth, levels, sizes, start and goal the Core contract refuses', () => {
      expect(messages(withPayload(half, { truth: { num: 1, den: 21 } }))[0]).toMatch(/between 1\/5 and 4\/5/);
      expect(messages(withPayload(half, { truth: { num: 1, den: 10 } }))[0]).toMatch(/between 1\/5 and 4\/5/);
      expect(messages(withPayload(half, { levels: [95, 90] }))[0]).toMatch(/2 to 5 rising picks/);
      expect(messages(withPayload(half, { levels: [90, 92] }))[0]).toMatch(/2 to 5 rising picks/);
      expect(messages(withPayload(half, { sizes: [5, 100] }))[0]).toMatch(/2 to 5 rising counts from 10 to 400/);
      expect(messages(withPayload(half, { start: { level: 80, size: 30 } }))[0]).toMatch(/among the choices/);
      expect(messages(withPayload(half, { goal: { covered: 100 } }))[0]).toMatch(/50 to 99 intervals/);
    });

    it('refuses a prompt that hides the goal number', () => {
      expect(messages(withPrompt(half, 'Where half say yes, pick a level and size so most intervals cover the truth.'))[0]).toMatch(/goal number of intervals in digits/);
      expect(messages(withPrompt(half, 'Where half say yes, pick a level and size so at least 185 intervals cover the truth.'))[0]).toMatch(/goal number of intervals in digits/);
    });
  });

  describe('bootstrap', () => {
    it('refuses a key that is not the exact edges of the middle level', () => {
      expect(messages(bootstrap, { target: { low: 19, high: 35 } })[0]).toMatch(/must be low 19 and high 36/);
      expect(messages(bootstrap, { target: { low: 20, high: 36 } })[0]).toMatch(/must be low 19 and high 36/);
      expect(messages(bootstrap, { target: { low: 19 } })[0]).toMatch(/must be low 19 and high 36/);
    });

    it('refuses an axis, data, level, stops, floor and tolerance the Core contract refuses', () => {
      expect(messages(withPayload(bootstrap, { axis: { min: 0, max: 30 } }))[0]).toMatch(/4 to 20 steps wide/);
      expect(messages(withPayload(bootstrap, { data: [2, 3, 3] }))[0]).toMatch(/4 to 10 whole values/);
      expect(messages(withPayload(bootstrap, { data: [2, 2, 3, 3] }))[0]).toMatch(/at least 3 different/);
      expect(messages(withPayload(bootstrap, { data: [2, 3, 3, 5, 6, 11] }))[0]).toMatch(/on the axis/);
      expect(messages(withPayload(bootstrap, { level: 99 }))[0]).toMatch(/80, 90 or 95/);
      expect(messages(withPayload(bootstrap, { stops: [50, 200] }))[0]).toMatch(/3 to 8 rising counts up to 3000/);
      expect(messages(withPayload(bootstrap, { stops: [50, 200, 500, 1000, 4000] }))[0]).toMatch(/up to 3000/);
      expect(messages(withPayload(bootstrap, { minResamples: 40 }))[0]).toMatch(/floor is one of the stops, at least 50/);
      expect(messages(withPayload(bootstrap, { minResamples: 50 }))[0]).toMatch(/never the first/);
      expect(messages(withPayload(bootstrap, { tolerance: 41 }))[0]).toMatch(/1 to 40 sum steps/);
    });

    it('refuses a tolerance the last stop cannot reach and a prompt that hides the floor or the level', () => {
      expect(messages(withPayload(bootstrap, { stops: [50, 100, 200], minResamples: 100 }))[0]).toMatch(/too tight for the last stop/);
      expect(messages(withPrompt(bootstrap, 'Resample the six values with replacement until the middle 90% of the totals settles.'))[0]).toMatch(/floor of resamples in digits/);
      expect(messages(withPrompt(bootstrap, 'Resample the six values with replacement. Run at least 500 resamples so the middle part of the totals settles.'))[0]).toMatch(/level in digits/);
    });
  });
});
