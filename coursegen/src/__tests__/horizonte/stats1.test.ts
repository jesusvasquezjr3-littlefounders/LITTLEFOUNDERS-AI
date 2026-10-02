import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { STATS1_CAPABILITIES, stats1 } from '../../v2/horizonte/stats1.js';

const DOT_PLOT = 'stats.dot-plot.v2';
const BALANCE = 'stats.balance-point.v2';
const NORMAL = 'stats.normal.v2';
const BINOMIAL = 'stats.binomial.v2';
const CLT = 'stats.clt.v2';

type Doc = { segments: Array<Record<string, unknown>> };
const doc = (type: string, visual: string, prompt: string, payload: unknown, id = 'seg-stats'): Doc => ({ segments: [{ id, type, visual: { type: visual }, prompt, payload }] });
const gate = (document: Doc, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-stats': key });
const messages = (document: Doc, key?: unknown) => gate(document, key).map((problem) => problem.message);

const median = doc(DOT_PLOT, 'dot-plot', 'Move up to two dots so the median is 6.', { axis: { min: 0, max: 10 }, dots: [2, 3, 4, 4, 5, 7, 9], measure: 'median', moves: 2 });
const mode = doc(DOT_PLOT, 'dot-plot', 'Move up to two dots so the mode is 5.', { axis: { min: 0, max: 8 }, dots: [1, 2, 3, 3, 3, 4, 5, 6], measure: 'mode', moves: 2 });
const mean = doc(DOT_PLOT, 'dot-plot', 'Move up to two dots so the mean is 6.', { axis: { min: 0, max: 10 }, dots: [1, 3, 4, 4, 5, 7], measure: 'mean', moves: 2 });
const balance = doc(BALANCE, 'balance-point', 'Slide the pivot until the beam balances.', { axis: { min: 0, max: 12 }, dots: [1, 2, 2, 5, 8, 12], pivot: 3 });
const normal = doc(NORMAL, 'normal-curve', 'Fit the curve so 40 to 60 is two standard deviations either side of the mean.',
  { axis: { min: 0, max: 100 }, start: { mean: 30, sd: 10 }, sdMax: 20, band: { rule: 2, low: 40, high: 60 } });
const binomial = doc(BINOMIAL, 'binomial-bars', 'Set n and the chance so the mean is 10 and the variance is 5.', { nMax: 40, start: { n: 10, pct: 30 }, goal: { mean: 10, variance: 5 } });
const clt = doc(CLT, 'sampling-mean', 'Pick the sample size that makes the spread of the mean 3 times smaller.',
  { weights: [6, 1, 1, 1, 1, 6], nMax: 25, start: { n: 1 }, goal: { shrink: 3 } });

const withPayload = (document: Doc, patch: Record<string, unknown>): Doc => ({ segments: [{ ...document.segments[0]!, payload: { ...(document.segments[0]!.payload as object), ...patch } }] });
const withPrompt = (document: Doc, prompt: string): Doc => ({ segments: [{ ...document.segments[0]!, prompt }] });

describe('stats1 pack in the Forge (F1.13, F1.14)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    for (const type of [DOT_PLOT, BALANCE, NORMAL, BINOMIAL, CLT] as const) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(STATS1_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(STATS1_CAPABILITIES[type]);
    }
    expect(STATS1_CAPABILITIES[DOT_PLOT]).toEqual(['visual.dot-plot.v1', 'operation.drag-point.v1', 'operation.move-menu.v1', 'operation.show-table.v1']);
    expect(HORIZONTE_FORGE_PACKS).toContain(stats1);
  });

  it('adds authoring guidance only for the types a skeleton uses, with the age scopes and the prompt rules', () => {
    expect(horizonteGuidanceFor([DOT_PLOT]).join('\n')).toMatch(/ages 10-14 only.*target number in digits/s);
    expect(horizonteGuidanceFor([BALANCE]).join('\n')).toMatch(/never gives the position/);
    expect(horizonteGuidanceFor([NORMAL]).join('\n')).toMatch(/either side of the mean/);
    expect(horizonteGuidanceFor([BINOMIAL]).join('\n')).toMatch(/ages 14-17 and the adult pathway/);
    expect(horizonteGuidanceFor([CLT]).join('\n')).toMatch(/square/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('accepts every authored example with its key and without one', () => {
    const keyed: Array<[Doc, unknown]> = [
      [median, { target: 6 }], [mode, { target: 5 }], [mean, { target: 6 }], [balance, { target: 5 }],
      [normal, { target: { mean: 50, sd: 5 } }], [binomial, { target: { n: 20, pct: 50 } }], [clt, { target: { n: 9 } }],
    ];
    for (const [document, key] of keyed) {
      expect(gate(document, key)).toEqual([]);
      expect(gate(document)).toEqual([]);
    }
  });

  describe('dot plot', () => {
    it('refuses a target no allowed move reaches, one the start already has and one off the axis', () => {
      expect(messages(withPayload(median, { moves: 1 }), { target: 6 })[0]).toMatch(/No 1 dot moves bring the median to 6/);
      expect(messages(median, { target: 4 })[0]).toMatch(/must not already have/);
      expect(messages(median, { target: 11 })[0]).toMatch(/whole value on the axis/);
      expect(messages(median, { target: 5.5 })[0]).toMatch(/whole value on the axis/);
      expect(gate(median, { target: 4 })[0]).toMatchObject({ gate: 4, segmentId: 'seg-stats' });
    });

    it('treats a tie as no mode, so the start with a tie cannot already have the target', () => {
      const tie = withPayload(mode, { dots: [1, 2, 3, 3, 4, 4, 5, 6] });
      expect(gate(withPrompt(tie, 'Move up to two dots so the mode is 4.'), { target: 4 })).toEqual([]);
      expect(gate(withPrompt(tie, 'Move up to two dots so the mode is 3.'), { target: 3 })).toEqual([]);
    });

    it('refuses a prompt that does not write the target, and a malformed payload', () => {
      expect(messages(withPrompt(median, 'Move up to two dots so the median goes up.'), { target: 6 })[0]).toMatch(/write the target number in digits/);
      expect(messages(withPrompt(median, 'Move the dots so the median is 16.'), { target: 6 })[0]).toMatch(/write the target number in digits/);
      expect(messages(withPayload(median, { dots: [2, 3] }))[0]).toMatch(/3 to 12 whole dots/);
      expect(messages(withPayload(median, { dots: [2, 3, 4, 4, 5, 7, 11] }))[0]).toMatch(/3 to 12 whole dots/);
      expect(messages(withPayload(median, { axis: { min: 0, max: 30 } }))[0]).toMatch(/4 to 20 steps wide/);
      expect(messages(withPayload(median, { measure: 'range' }))[0]).toMatch(/mean, median or mode/);
      expect(messages(withPayload(median, { moves: 3 }))[0]).toMatch(/1 or 2 dots/);
      expect(messages(doc(DOT_PLOT, 'ten-frame', median.segments[0]!.prompt as string, median.segments[0]!.payload))[0]).toMatch(/visual must be dot-plot/);
    });
  });

  describe('balance point', () => {
    it('refuses dots that do not balance on a whole position, a pivot on it and a wrong key', () => {
      expect(messages(withPayload(balance, { dots: [1, 2, 2, 5, 8, 11] }))[0]).toMatch(/balance on a whole position/);
      expect(messages(withPayload(balance, { pivot: 5 }))[0]).toMatch(/away from the balance point/);
      expect(messages(withPayload(balance, { pivot: 13 }))[0]).toMatch(/pivot must start on the axis/);
      expect(messages(balance, { target: 4 })[0]).toMatch(/must be 5, the mean of the dots/);
    });
  });

  describe('normal curve', () => {
    it('refuses a band that is off the grid, a start on the answer, and a prompt that hides the edges or the sides', () => {
      expect(messages(withPayload(normal, { band: { rule: 2, low: 41, high: 60 } }))[0]).toMatch(/centred on a whole mean/);
      expect(messages(withPayload(normal, { band: { rule: 2, low: 40, high: 62 } }))[0]).toMatch(/centred on a whole mean/);
      expect(messages(withPayload(normal, { band: { rule: 4, low: 40, high: 60 } }))[0]).toMatch(/centred on a whole mean/);
      expect(messages(withPayload(normal, { start: { mean: 50, sd: 5 } }))[0]).toMatch(/start away from the answer/);
      expect(messages(withPrompt(normal, 'Fit the curve so 40 to 60 is two standard deviations from the mean.'))[0]).toMatch(/either side of the mean/);
      expect(messages(withPrompt(normal, 'Fit the curve so the band is two standard deviations either side of the mean.'))[0]).toMatch(/band edges in digits/);
      expect(messages(normal, { target: { mean: 50, sd: 10 } })[0]).toMatch(/mean 50 and spread 5/);
      expect(messages(withPayload(normal, { sdMax: 4 }))[0]).toMatch(/spread from 1 to sdMax/);
    });

    it('accepts the Spanish and Portuguese wording of either side', () => {
      expect(gate(withPrompt(normal, 'Ajusta la curva para que 40 a 60 sean dos desviaciones estándar a cada lado de la media.'), { target: { mean: 50, sd: 5 } })).toEqual([]);
      expect(gate(withPrompt(normal, 'Ajuste a curva para que 40 a 60 sejam dois desvios padrão de cada lado da média.'), { target: { mean: 50, sd: 5 } })).toEqual([]);
    });
  });

  describe('binomial', () => {
    it('refuses a goal with no pair on the grid and a prompt that hides the goal', () => {
      expect(messages(withPayload(binomial, { goal: { mean: 10, variance: 7 } }))[0]).toMatch(/exactly one count and percent/);
      expect(messages(withPayload(binomial, { goal: { mean: 10, variance: 10 } }))[0]).toMatch(/exactly one count and percent/);
      expect(messages(withPayload(binomial, { goal: { mean: 30, variance: 15 }, nMax: 40 }))[0]).toMatch(/exactly one count and percent/);
      expect(messages(withPayload(binomial, { start: { n: 20, pct: 50 } }))[0]).toMatch(/start away from the answer/);
      expect(messages(withPayload(binomial, { start: { n: 10, pct: 32 } }))[0]).toMatch(/5 step grid/);
      expect(messages(withPrompt(binomial, 'Set n and the chance so the mean is 10.'))[0]).toMatch(/mean and variance in digits/);
      expect(messages(binomial, { target: { n: 10, pct: 50 } })[0]).toMatch(/n 20 at 50 percent/);
    });

    it('keeps the pair exact in whole numbers', () => {
      const half = withPrompt(withPayload(binomial, { goal: { mean: 6, variance: 3 }, start: { n: 5, pct: 30 } }), 'Set n and the chance so the mean is 6 and the variance is 3.');
      expect(gate(half, { target: { n: 12, pct: 50 } })).toEqual([]);
      expect(messages(withPayload(binomial, { goal: { mean: 6, variance: 3 }, start: { n: 5, pct: 30 }, nMax: 10 }))[0]).toMatch(/exactly one count and percent/);
    });
  });

  describe('sample mean', () => {
    it('refuses a shrink whose square does not fit, a start on the answer and a prompt without the number', () => {
      expect(messages(withPayload(clt, { goal: { shrink: 5 }, nMax: 20 }))[0]).toMatch(/must fit within nMax/);
      expect(messages(withPayload(clt, { start: { n: 9 } }))[0]).toMatch(/start away from the answer/);
      expect(messages(withPayload(clt, { goal: { shrink: 6 } }))[0]).toMatch(/whole number from 2 to 5/);
      expect(messages(withPayload(clt, { weights: [0, 0, 0] }))[0]).toMatch(/at least one is above zero/);
      expect(messages(withPrompt(clt, 'Pick the sample size that makes the spread of the mean three times smaller.'))[0]).toMatch(/shrink factor in digits/);
      expect(messages(clt, { target: { n: 6 } })[0]).toMatch(/n 9/);
    });
  });
});
