import { describe, expect, it } from 'vitest';
import { horizontePieceGates } from '../../v2/horizonte/index.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const GRAPH = 'math.function-graph.v2';
const EXPRESSION = 'math.expression-editor.v2';

type Seg = { id: string; type: string; grading: string; visual: { type: string }; prompt: string; payload: Record<string, unknown> };
const slider = (min: string, max: string, step: string) => ({ min, max, step });
const graph = (payload: Record<string, unknown>): Seg => ({ id: 'seg-graph', type: GRAPH, grading: 'server', visual: { type: 'function-graph' }, prompt: 'Slide the sliders until the curve goes through the dots.', payload });
const editor = (payload: Record<string, unknown>): Seg => ({ id: 'seg-expr', type: EXPRESSION, grading: 'server', visual: { type: 'expression-editor' }, prompt: 'Work it out. Write each step on its own line.', payload });
const findings = (target: Seg, key?: unknown, nodeBudget?: number) =>
  runSolvabilityGate({ segments: [target] }, key === undefined ? undefined : { [target.id]: key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (target: Seg, key?: unknown, nodeBudget?: number) => findings(target, key, nodeBudget).map((finding) => finding.code).sort();
const pack = (target: Seg, key?: unknown) => horizontePieceGates({ segments: [target] }, key === undefined ? undefined : { [target.id]: key });

const line = (patch: Record<string, unknown> = {}) => graph({
  curve: 'line', start: { m: '1', b: '0' }, sliders: { m: slider('-5', '5', '1'), b: slider('-6', '6', '1') },
  window: { xMin: -6, xMax: 6, yMin: -8, yMax: 8 }, marks: [{ x: 0, y: -3 }, { x: 2, y: 1 }], ...patch,
});
const lineKey = { family: 'line', target: { m: '2', b: '-3' } };
const standard = (patch: Record<string, unknown> = {}) => graph({
  curve: 'quadratic', start: { a: '2', b: '0', c: '0' },
  sliders: { a: slider('-2', '2', '1'), b: slider('-6', '6', '1'), c: slider('-6', '6', '1') },
  window: { xMin: -4, xMax: 6, yMin: -6, yMax: 6 }, marks: [{ x: -1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: -3 }], ...patch,
});
const standardKey = { family: 'quadratic', target: { a: '1', b: '-2', c: '-3' } };
const vertex = (patch: Record<string, unknown> = {}) => graph({
  curve: 'quadratic', form: 'vertex', start: { a: '1', h: '0', k: '0' },
  sliders: { a: slider('1', '4', '1'), h: slider('-3', '4', '1'), k: slider('-6', '6', '1') },
  window: { xMin: -4, xMax: 6, yMin: -5, yMax: 10 }, marks: [{ x: 1, y: -3 }, { x: 3, y: 5 }, { x: -1, y: 5 }], ...patch,
});
const vertexKey = { family: 'quadratic', target: { a: '2', b: '-4', c: '-1' } };
const growth = (patch: Record<string, unknown> = {}) => graph({
  curve: 'exponential', start: { a: '2', b: '1.5' }, sliders: { a: slider('1', '4', '1'), b: slider('0.5', '3', '0.5') },
  window: { xMin: -3, xMax: 5, yMin: -2, yMax: 20 }, marks: [{ x: 0, y: 1 }, { x: 3, y: 8 }], ...patch,
});
const growthKey = { family: 'exponential', target: { a: '1', b: '2' } };
const bare = () => graph({
  curve: 'line', start: { m: '1', b: '0' }, sliders: { m: slider('-5', '5', '1'), b: slider('-6', '6', '1') }, window: { xMin: -6, xMax: 6, yMin: -8, yMax: 8 },
});

describe('function graph F0.4 checker', () => {
  it('is registered for both types', () => {
    expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining([GRAPH, EXPRESSION]));
  });

  it('accepts every family when the marks pin down one curve on the sliders', () => {
    for (const [target, key] of [[line(), lineKey], [standard(), standardKey], [vertex(), vertexKey], [growth(), growthKey]] as const) {
      expect(codes(target), JSON.stringify(target.payload)).toEqual([]);
      expect(codes(target, key), JSON.stringify(target.payload)).toEqual([]);
      expect(pack(target, key)).toEqual([]);
    }
  });

  it('has nothing to prove for a graph with no marks, whose answer only the key names', () => {
    expect(codes(bare())).toEqual([]);
  });

  it('refuses marks whose one curve is off the sliders, which the pack gate only sees with a key', () => {
    const offRange = line({ sliders: { m: slider('-5', '5', '1'), b: slider('0', '6', '1') } });
    expect(codes(offRange)).toEqual(['no-solution']);
    expect(pack(offRange)).toEqual([]);
    expect(pack(offRange, lineKey)).not.toEqual([]);
    const offStep = line({ marks: [{ x: 0, y: 0 }, { x: 2, y: 1 }] });
    expect(codes(offStep)).toEqual(['no-solution']);
    expect(codes(standard({ start: { a: '-1', b: '0', c: '0' }, sliders: { a: slider('-2', '0', '1'), b: slider('-6', '6', '1'), c: slider('-6', '6', '1') } }))).toEqual(['no-solution']);
    expect(codes(vertex({ sliders: { a: slider('1', '4', '1'), h: slider('-3', '0', '1'), k: slider('-6', '6', '1') } }))).toEqual(['no-solution']);
    expect(codes(growth({ marks: [{ x: 0, y: 1 }, { x: 3, y: 9 }] }))).toEqual(['no-solution']);
    expect(codes(growth({ sliders: { a: slider('2', '4', '1'), b: slider('0.5', '3', '0.5') } }))).toEqual(['no-solution']);
  });

  it('refuses a quadratic whose marks are collinear and an exponential through a zero mark', () => {
    expect(codes(standard({ marks: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }))).toEqual(['no-solution']);
    expect(codes(growth({ marks: [{ x: 0, y: 0 }, { x: 3, y: 0 }] }))).toEqual(['no-solution']);
  });

  it('refuses a fourth mark that the one curve misses', () => {
    expect(codes(line({ marks: [{ x: 0, y: -3 }, { x: 2, y: 1 }, { x: 4, y: 6 }] }))).toEqual(['no-solution']);
    expect(codes(line({ marks: [{ x: 0, y: -3 }, { x: 2, y: 1 }, { x: 4, y: 5 }] }))).toEqual([]);
  });

  it('refuses a start that already is the curve through the marks', () => {
    expect(codes(line({ start: { m: '2', b: '-3' } }))).toEqual(['impossible-state']);
    expect(codes(vertex({ start: { a: '2', h: '1', k: '-3' } }))).toEqual(['impossible-state']);
    expect(pack(line({ start: { m: '2', b: '-3' } }), lineKey)).not.toEqual([]);
  });

  it('refuses a payload that cannot be played', () => {
    expect(codes(line({ curve: 'cubic' }))).toEqual(['impossible-state']);
    expect(codes(line({ marks: [{ x: 0, y: 0 }] }))).toEqual(['impossible-state']);
    expect(codes(graph({}))).toEqual(['impossible-state']);
  });

  it('says so when the budget runs out on the base scan', () => {
    expect(codes(growth(), undefined, 2)).toEqual(['budget-exceeded']);
    expect(codes(growth(), undefined, 100)).toEqual([]);
  });

  it('agrees with a brute force over the slider grid for lines', () => {
    let compared = 0;
    for (let m = -3; m <= 3; m += 1) {
      for (let b = -3; b <= 3; b += 1) {
        const target = line({ start: { m: '0', b: '1' }, sliders: { m: slider('-2', '2', '1'), b: slider('-2', '2', '1') }, marks: [{ x: 0, y: b }, { x: 2, y: 2 * m + b }] });
        const expected = Math.abs(m) <= 2 && Math.abs(b) <= 2 && !(m === 0 && b === 1);
        expect(codes(target).length === 0, `m ${m} b ${b}`).toBe(expected);
        compared += 1;
      }
    }
    for (let y = -5; y <= 5; y += 1) {
      const target = line({ start: { m: '2', b: '1' }, sliders: { m: slider('-2', '2', '1'), b: slider('-2', '2', '1') }, marks: [{ x: 0, y: 0 }, { x: 2, y }] });
      expect(codes(target).length === 0, `y ${y}`).toBe(y % 2 === 0 && Math.abs(y / 2) <= 2);
      compared += 1;
    }
    expect(compared).toBe(49 + 11);
  });
});

const task = (kind: 'rewrite' | 'solve', given: string, form: string, variable = 'x') => editor({ task: kind, given, form, variable });

describe('expression editor F0.4 checker', () => {
  it('accepts a task with a finished answer, with and without a key', () => {
    const cases: Array<[Seg, string]> = [
      [task('rewrite', '(x+2)(x+3)', 'expanded'), 'x^2+5x+6'],
      [task('rewrite', 'x^2+7x+12', 'factored'), '(x+3)(x+4)'],
      [task('solve', '3x+5=20', 'isolated'), 'x=5'],
      [task('solve', '5x-4=2x+8', 'separated'), '3x=12'],
      [task('rewrite', '(x+0.5)(x+2)', 'expanded'), 'x^2+2.5x+1'],
    ];
    for (const [target, reference] of cases) {
      expect(codes(target), JSON.stringify(target.payload)).toEqual([]);
      expect(pack(target, { reference }), JSON.stringify(target.payload)).toEqual([]);
    }
  });

  it('refuses a solve task that is not one linear equation, which the pack gate cannot see without a key', () => {
    const quadratic = task('solve', 'x^2=4', 'isolated');
    expect(codes(quadratic)).toEqual(['no-solution']);
    expect(pack(quadratic)).toEqual([]);
    expect(pack(quadratic, { reference: 'x=2' })).not.toEqual([]);
    expect(codes(task('solve', 'x+1=x+2', 'isolated'))).toEqual(['no-solution']);
    expect(codes(task('solve', 'x+1=x+1', 'isolated'))).toEqual(['ambiguous-solution']);
    expect(codes(task('solve', '2(x+3)=2x+6', 'separated'))).toEqual(['ambiguous-solution']);
    expect(codes(task('solve', '1/x=2', 'isolated'))).toEqual(['no-solution']);
  });

  it('refuses a rewrite of something that is not a polynomial, or a single term to factor', () => {
    expect(codes(task('rewrite', '1/x+1', 'expanded'))).toEqual(['no-solution']);
    expect(codes(task('rewrite', '2x^3', 'factored'))).toEqual(['no-solution']);
    expect(pack(task('rewrite', '2x^3', 'factored'))).toEqual([]);
    expect(codes(task('rewrite', 'x(x+1)', 'expanded'))).toEqual([]);
    expect(codes(task('rewrite', 'x^3+x^2', 'factored'))).toEqual([]);
  });

  it('refuses a given that already has the finished form, and a malformed task', () => {
    expect(codes(task('solve', 'x=3', 'isolated'))).toEqual(['impossible-state']);
    expect(codes(task('rewrite', 'x^2+5x+6', 'expanded'))).toEqual(['impossible-state']);
    expect(codes(task('rewrite', 'x+', 'expanded'))).toEqual(['impossible-state']);
    expect(codes(task('rewrite', 'x^2+1', 'isolated'))).toEqual(['impossible-state']);
    expect(codes(task('solve', 'x^2+1', 'isolated'))).toEqual(['impossible-state']);
    expect(codes(task('solve', '3x+5=20', 'isolated', 'X'))).toEqual(['impossible-state']);
    expect(codes(editor({ task: 'solve', given: '3x+5=20', form: 'isolated', variable: 'x', extra: 1 }))).toEqual(['impossible-state']);
    expect(codes(editor({}))).toEqual(['impossible-state']);
  });
});
