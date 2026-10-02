import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { PROB_CAPABILITIES, prob } from '../../v2/horizonte/prob.js';

const TREE = 'prob.tree.v2';
const BAYES = 'prob.bayes.v2';
const REGRESSION = 'prob.regression.v2';

type Doc = { segments: Array<Record<string, unknown>> };
const doc = (type: string, visual: string, payload: unknown, prompt = 'Build it.', id = 'seg-prob'): Doc => ({ segments: [{ id, type, visual: { type: visual }, prompt, payload }] });
const gate = (document: Doc, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-prob': key });
const messages = (document: Doc, key?: unknown) => gate(document, key).map((problem) => problem.message);
const withPayload = (document: Doc, patch: Record<string, unknown>): Doc => ({ segments: [{ ...document.segments[0]!, payload: { ...(document.segments[0]!.payload as object), ...patch } }] });

const SCREENING = { population: 1000, prior: { part: 1, whole: 100 }, hit: { part: 9, whole: 10 }, alarm: { part: 1, whole: 10 } };
const tree = doc(TREE, 'prob-tree', { ...SCREENING, chips: [1, 9, 10, 99, 100, 891, 900, 990] });
const treeKey = { solutions: [{ has: ['n-10'], lacks: ['n-990'], 'has-pos': ['n-9'], 'has-neg': ['n-1'], 'lacks-pos': ['n-99'], 'lacks-neg': ['n-891'] }] };
const bayes = doc(BAYES, 'natural-frequencies', { ...SCREENING, ask: 'positive' }, 'One person tests positive. What is the chance they have it?');
const bayesKey = { target: '1/12', tolerance: { absolute: '0.005' }, review: { absolute: '0.02' } };
const regression = doc(REGRESSION, 'regression-residuals', {
  size: 10, points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 }, { x: 6, y: 7 }, { x: 8, y: 10 }, { x: 10, y: 10 }], start: { slope: 0, intercept: 50 },
}, 'Move the line to make the squares as small as you can.');
const regressionKey = { family: 'line', target: { m: '1', b: '1' }, parameter_tolerance: { absolute: '0.05' }, parameter_review: { absolute: '0.3' } };

describe('prob pack in the Forge (F2.9, F2.10)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    for (const type of [TREE, BAYES, REGRESSION] as const) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(PROB_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(PROB_CAPABILITIES[type]);
    }
    expect(PROB_CAPABILITIES[TREE]).toEqual(['visual.prob-tree.v1', 'operation.drag-chips.v1', 'operation.move-menu.v1', 'operation.show-table.v1']);
    expect(PROB_CAPABILITIES[REGRESSION]).toContain('visual.math-notation.v1');
    expect(HORIZONTE_FORGE_PACKS).toContain(prob);
  });

  it('adds authoring guidance only for the types a skeleton uses, with the age scopes and the prompt rules', () => {
    expect(horizonteGuidanceFor([TREE]).join('\n')).toMatch(/ages 13-17 and the adult pathway only.*never writes a head count/s);
    expect(horizonteGuidanceFor([BAYES]).join('\n')).toMatch(/never writes the number of people or the answer/);
    expect(horizonteGuidanceFor([REGRESSION]).join('\n')).toMatch(/ages 14-17.*never writes the slope or the intercept/s);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('accepts every authored example with its key and without one', () => {
    for (const [document, key] of [[tree, treeKey], [bayes, bayesKey], [regression, regressionKey]] as Array<[Doc, unknown]>) {
      expect(gate(document, key)).toEqual([]);
      expect(gate(document)).toEqual([]);
    }
  });

  describe('probability tree', () => {
    it('refuses shares that do not land on whole people and counts that repeat', () => {
      expect(messages(withPayload(tree, { population: 1001 }))[0]).toMatch(/whole people/);
      expect(messages(withPayload(tree, { hit: { part: 1, whole: 2 }, prior: { part: 1, whole: 5 }, alarm: { part: 1, whole: 2 }, population: 1000 }))[0]).toMatch(/must all differ/);
      expect(messages(withPayload(tree, { prior: { part: 5, whole: 4 } }))[0]).toMatch(/part in a whole/);
      expect(messages(withPayload(tree, { population: 50 }))[0]).toMatch(/100 to 10000/);
      expect(gate(withPayload(tree, { population: 1001 }))[0]).toMatchObject({ gate: 4, segmentId: 'seg-prob' });
    });

    it('refuses a tray that misses a head count, repeats a chip or is too short', () => {
      expect(messages(withPayload(tree, { chips: [1, 9, 10, 99, 100, 891, 900] }))[0]).toMatch(/tray holds the six counts/);
      expect(messages(withPayload(tree, { chips: [1, 9, 10, 99, 100, 891, 900, 900, 990] }))[0]).toMatch(/tray holds the six counts/);
      expect(messages(withPayload(tree, { chips: [1, 9, 10, 99, 891, 990] }))[0]).toMatch(/tray holds the six counts/);
      expect(messages(withPayload(tree, { chips: [1, 9, 10, 99, 100, 891, 900, 990, 1001] }))[0]).toMatch(/tray holds the six counts/);
    });

    it('refuses a payload that carries more than the shares, and a key that is not the one arrangement', () => {
      expect(messages(withPayload(tree, { target: 10 }))[0]).toMatch(/carries only/);
      expect(messages(tree, { solutions: [{ ...treeKey.solutions[0], has: ['n-990'] }] })[0]).toMatch(/one arrangement/);
      expect(messages(tree, { solutions: [] })[0]).toMatch(/one arrangement/);
      expect(messages(tree, { solutions: [treeKey.solutions[0], treeKey.solutions[0]] })[0]).toMatch(/one arrangement/);
      expect(messages(tree, null)[0]).toMatch(/one arrangement/);
    });

    it('refuses the wrong visual', () => {
      expect(messages(doc(TREE, 'ten-frame', tree.segments[0]!.payload))[0]).toMatch(/visual must be prob-tree/);
    });
  });

  describe('Bayes with natural frequencies', () => {
    it('refuses a share outside 1 in 20 to 19 in 20 and an ask that is neither result', () => {
      const large = { population: 10_000, prior: { part: 1, whole: 100 }, hit: { part: 9, whole: 10 }, alarm: { part: 1, whole: 100 } };
      expect(messages(doc(BAYES, 'natural-frequencies', { ...large, ask: 'positive' }))).toEqual([]);
      const tiny = { population: 10_000, prior: { part: 1, whole: 1000 }, hit: { part: 9, whole: 10 }, alarm: { part: 1, whole: 10 } };
      expect(messages(doc(BAYES, 'natural-frequencies', { ...tiny, ask: 'positive' }))[0]).toMatch(/1 in 20 and 19 in 20/);
      expect(messages(withPayload(bayes, { ask: 'maybe' }))[0]).toMatch(/positive or a negative/);
    });

    it('refuses a key that is not the exact share, and one with a loose or inverted allowance', () => {
      expect(messages(bayes, { ...bayesKey, target: '0.1' })[0]).toMatch(/must be 9 in 108/);
      expect(messages(bayes, { ...bayesKey, target: '0.083' })[0]).toMatch(/must be 9 in 108/);
      expect(messages(bayes, { ...bayesKey, tolerance: { absolute: '0.02' } })[0]).toMatch(/at most 0.01/);
      expect(messages(bayes, { ...bayesKey, review: { absolute: '0.001' } })[0]).toMatch(/wider than the tolerance/);
      expect(messages(bayes, { target: '1/12', tolerance: 'tight' })[0]).toMatch(/at most 0.01/);
      expect(messages(bayes, { target: '9/108', tolerance: { absolute: '0.005' } })).toEqual([]);
    });

    it('reads the negative share and a payload that leaks a target', () => {
      const checkup = doc(BAYES, 'natural-frequencies', { population: 1000, prior: { part: 4, whole: 10 }, hit: { part: 3, whole: 4 }, alarm: { part: 1, whole: 5 }, ask: 'negative' });
      expect(gate(checkup, { target: '5/29', tolerance: { absolute: '0.005' } })).toEqual([]);
      expect(messages(withPayload(bayes, { target: '1/12' }))[0]).toMatch(/carries only/);
    });
  });

  describe('regression residuals', () => {
    it('refuses points off the grid, repeated, or with fewer than three x', () => {
      expect(messages(withPayload(regression, { size: 5 }))[0]).toMatch(/4 to 12 different whole points/);
      expect(messages(withPayload(regression, { points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 2, y: 5 }, { x: 1, y: 7 }] }))[0]).toMatch(/at least 3 of them at different x/);
      expect(messages(withPayload(regression, { points: [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 }] }))[0]).toMatch(/4 to 12 different whole points/);
      expect(messages(withPayload(regression, { points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 }, { x: 11, y: 7 }] }))[0]).toMatch(/4 to 12 different whole points/);
    });

    it('refuses a best line off the tenths grid, outside the sliders, or perfect', () => {
      expect(messages(withPayload(regression, { points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 9 }] }))[0]).toMatch(/tenths grid/);
      expect(messages(withPayload(regression, { points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 }, { x: 4, y: 7 }] }))[0]).toMatch(/not all lie on one line/);
      expect(messages(withPayload(regression, { size: 20, points: [{ x: 0, y: 0 }, { x: 1, y: 4 }, { x: 2, y: 9 }, { x: 3, y: 12 }] }))[0]).toMatch(/tenths grid/);
    });

    it('refuses a start on the best line, a start off the sliders and a payload that leaks the answer', () => {
      expect(messages(withPayload(regression, { start: { slope: 10, intercept: 10 } }))[0]).toMatch(/start away from the best line/);
      expect(messages(withPayload(regression, { start: { slope: 31, intercept: 10 } }))[0]).toMatch(/slope from -30 to 30/);
      expect(messages(withPayload(regression, { answer: { m: 1, b: 1 } }))[0]).toMatch(/carries only/);
    });

    it('refuses a key that is not the least squares line or has a loose allowance', () => {
      expect(messages(regression, { ...regressionKey, target: { m: '1', b: '2' } })[0]).toMatch(/slope 1 and intercept 1/);
      expect(messages(regression, { ...regressionKey, family: 'quadratic' })[0]).toMatch(/best line/);
      expect(messages(regression, { ...regressionKey, parameter_tolerance: { absolute: '0.2' } })[0]).toMatch(/at most 0.05/);
      expect(messages(regression, { ...regressionKey, parameter_review: { absolute: '0.04' } })[0]).toMatch(/wider than the tolerance/);
      expect(messages(regression, { ...regressionKey, target: { m: '2/2', b: '1.0' } })).toEqual([]);
    });

    it('keeps the line exact where a float would drift', () => {
      const gentle = doc(REGRESSION, 'regression-residuals', {
        size: 8, points: [{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 4, y: 6 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 }], start: { slope: 20, intercept: 0 },
      });
      expect(gate(gentle, { family: 'line', target: { m: '0.5', b: '3.5' }, parameter_tolerance: { absolute: '0.05' } })).toEqual([]);
      expect(messages(gentle, { family: 'line', target: { m: '0.5', b: '3.4' }, parameter_tolerance: { absolute: '0.05' } })[0]).toMatch(/slope 0.5 and intercept 3.5/);
    });
  });
});
