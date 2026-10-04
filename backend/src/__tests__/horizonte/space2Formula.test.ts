import { describe, expect, it } from 'vitest';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import {
  FORMULA_LIMITS, answerCount, evaluate, formulaGrid, formulaKey, formulaLatex, formulaMesh, formulaProblem, formulaSpoken, inWindow, isTypable, newMeter, parseFormula,
  partialsAt, ratCompare, ratDecimal, ratEquals, ratFromInt, ratText, ratToNumber, readFormulaPayload, readNumber, throughCount, walkPath, walkReach, worldPoint,
  type FormulaPayload, type Node, type SpokenWords,
} from '../../services/horizonte/space2/field.js';
import { SPACE2_FIXTURES } from '../../services/horizonte/space2/fixtures.js';
import { space2 } from '../../services/horizonte/space2/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

const FORMULA = 'math.surface-formula.v2';
type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const grade = space2.scorers[FORMULA]!.grade as unknown as Grade;
const fixture = (id: string) => SPACE2_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const payloadOf = (id: string) => readFormulaPayload(segmentOf(id).payload)!;
const run = (id: string, answer: unknown, rubric: unknown = fixture(id).rubric) => grade(segmentOf(id), { answer }, rubric);
const bare = (id: string, answer: unknown) => grade(segmentOf(id), { answer }, undefined);

const expr = (text: string): Node => {
  const parsed = parseFormula(text);
  if (!parsed.ok) throw new Error(`${text}: ${parsed.error}`);
  return parsed.expr;
};
const at = (text: string, x: number, y: number) => {
  const found = evaluate(expr(text), ratFromInt(x), ratFromInt(y));
  if (!found.ok) throw new Error(`${text}: ${found.reason}`);
  return { z: ratText(found.z), dx: ratText(found.dx), dy: ratText(found.dy) };
};
const errorOf = (input: unknown) => { const parsed = parseFormula(input); return parsed.ok ? 'ok' : parsed.error; };

function lesson(id: string, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const entry = fixture(id);
  const segment = entry.segment(locale);
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${entry.ageBand}`, chapter_id: 'horizonte-space2', lesson_id: `hz-space2-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...space2.capabilities[segment.type as keyof typeof space2.capabilities]], segments: [segment],
  };
}

const FORMULA_IDS = ['slope-two-ways', 'gradient-at-a-point', 'downhill-walk', 'build-a-surface'];

describe('F4.7 formulas: the safe parser', () => {
  it('reads polynomials with and without a z = prefix, in either case, with a point or a comma for the decimal mark', () => {
    expect(at('x^2+2xy', 1, 2)).toEqual({ z: '5', dx: '6', dy: '2' });
    expect(at('z = x^2 + 2*x*y', 1, 2)).toEqual({ z: '5', dx: '6', dy: '2' });
    expect(at('Z=X^2+2XY', 1, 2)).toEqual({ z: '5', dx: '6', dy: '2' });
    expect(at('0,5x + 0.25y', 4, 4)).toEqual({ z: '3', dx: '0.5', dy: '0.25' });
    expect(at('0,5*x', 3, 0).z).toBe('1.5');
    expect(at('x×y − y÷2', 3, 2)).toEqual({ z: '5', dx: '2', dy: '2.5' });
    expect(at('(x+1)(y-1)', 2, 3)).toEqual({ z: '6', dx: '2', dy: '3' });
    expect(at('-x^2', 3, 0).z).toBe('-9');
    expect(at('2-(-x)', 1, 0).z).toBe('3');
    expect(at('+x', 4, 0).z).toBe('4');
    expect(at('007x', 2, 0).z).toBe('14');
    expect(at('x^0', 5, 5)).toEqual({ z: '1', dx: '0', dy: '0' });
  });

  it('treats a decimal comma between digits as a decimal mark and anywhere else as an error', () => {
    expect(at('1,000x', 2, 0).z).toBe('2');
    expect(errorOf('x,y')).toBe('bad-number');
    expect(errorOf('1,')).toBe('bad-number');
    expect(errorOf(',5')).toBe('bad-number');
    expect(errorOf('.5')).toBe('bad-number');
    expect(errorOf('1.2.3')).toBe('bad-number');
    expect(errorOf('1,5,5')).toBe('bad-number');
    expect(errorOf('(1, 2)')).toBe('bad-number');
  });

  it('refuses anything that looks like code, a name or a property lookup', () => {
    for (const text of ['eval("1")', 'Function("return 1")()', 'constructor', 'this.constructor', 'globalThis', 'process', 'Math.sin(x)', 'x.__proto__', 'sin(x)', 'sqrt(x)', 'e^x', 'pi', 'a+b', 'x=y', 'x==1', 'y=x']) {
      expect(errorOf(text), text).not.toBe('ok');
    }
    for (const text of ['__proto__', 'x["constructor"]', '`1`', 'x;y', 'x\ny', 'x\ty', '{x}', '[x]', 'x!', 'x%2', 'x&y', 'x|y', 'x?y:1', 'x<y', '$x', '#x', 'x²', 'x\u0000', '\u{1f4a5}']) {
      expect(errorOf(text), JSON.stringify(text)).toBe('bad-char');
    }
    expect(errorOf('constructor')).toBe('unknown-symbol');
    expect(errorOf('z')).toBe('unknown-symbol');
    expect(errorOf('z x')).toBe('unknown-symbol');
    expect(errorOf('z = z')).toBe('unknown-symbol');
    expect(errorOf('= x')).toBe('bad-char');
    expect(errorOf('z =')).toBe('empty');
    expect(errorOf('z = = x')).toBe('bad-char');
  });

  it('does not read a name from the text: hostile names never reach a lookup', () => {
    const before = Object.keys(Object.prototype).length;
    for (const text of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'prototype', 'valueOf']) expect(parseFormula(text).ok, text).toBe(false);
    expect(Object.keys(Object.prototype).length).toBe(before);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('is total: any input gives a result and never a throw', () => {
    for (const input of [undefined, null, 0, 1n, true, [], {}, () => 1, Symbol.iterator, '', ' ', '   ', 'z=', 'z =  ', '()', ')(', '(', ')', '*', '+', '-', '--', '^', 'x^', 'x^^2', '2x3', 'x2', 'x 2']) {
      expect(() => parseFormula(input as unknown), String(typeof input)).not.toThrow();
      expect(parseFormula(input as unknown).ok, String(typeof input)).toBe(false);
    }
  });

  it('bounds the length, the nesting, the node count and the digits', () => {
    expect(errorOf('x'.repeat(FORMULA_LIMITS.maxChars))).toBe('too-complex');
    expect(errorOf(`x+${'1'.repeat(FORMULA_LIMITS.maxChars)}`)).toBe('too-long');
    expect(errorOf('x'.repeat(FORMULA_LIMITS.maxChars + 1))).toBe('too-long');
    expect(errorOf(`${'('.repeat(20)}x${')'.repeat(20)}`)).toBe('too-complex');
    expect(errorOf(`${'('.repeat(10)}x${')'.repeat(10)}`)).toBe('too-complex');
    expect(errorOf(`${'('.repeat(8)}x${')'.repeat(8)}`)).toBe('ok');
    expect(errorOf('-'.repeat(40))).toBe('too-complex');
    expect(errorOf('x+'.repeat(23) + 'x')).toBe('ok');
    expect(errorOf('1234567')).toBe('bad-number');
    expect(errorOf('123456')).toBe('ok');
    expect(errorOf('0.12345')).toBe('ok');
    expect(errorOf('0.1234567')).toBe('bad-number');
    expect(errorOf('9'.repeat(40))).toBe('bad-number');
    expect(errorOf('9'.repeat(49))).toBe('too-long');
  });

  it('allows only a whole exponent from 0 to 6, on one level', () => {
    expect(errorOf('x^6')).toBe('ok');
    expect(errorOf('x^7')).toBe('bad-exponent');
    expect(errorOf('x^99999999')).toBe('bad-number');
    expect(errorOf('x^-1')).toBe('bad-exponent');
    expect(errorOf('x^0,5')).toBe('bad-exponent');
    expect(errorOf('x^1.5')).toBe('bad-exponent');
    expect(errorOf('x^y')).toBe('bad-exponent');
    expect(errorOf('x^(2)')).toBe('bad-exponent');
    expect(errorOf('x^2^2')).toBe('bad-exponent');
    expect(errorOf('2^x')).toBe('bad-exponent');
    expect(errorOf('x^')).toBe('bad-exponent');
    expect(errorOf('(x+y)^3')).toBe('ok');
  });

  it('reports a stray or missing piece where it is', () => {
    expect(errorOf('(x')).toBe('unbalanced');
    expect(errorOf('x)')).toBe('unbalanced');
    expect(errorOf('()')).toBe('unbalanced');
    expect(errorOf('x+')).toBe('unexpected');
    expect(errorOf('*x')).toBe('unexpected');
    expect(errorOf('x**2')).toBe('unexpected');
    expect(errorOf('x//2')).toBe('unexpected');
    expect(errorOf('x 2')).toBe('unexpected');
    expect(errorOf('2 3')).toBe('unexpected');
    const parsed = parseFormula('x + $');
    expect(parsed.ok ? -1 : parsed.at).toBe(4);
  });
});

describe('F4.7 formulas: exact evaluation, partial derivatives and the gradient', () => {
  it('gives exact partials for sums, products, quotients and powers', () => {
    expect(at('x^2*y + 3y', 2, 3)).toEqual({ z: '21', dx: '12', dy: '7' });
    expect(at('x/y', 1, 2)).toEqual({ z: '0.5', dx: '0.5', dy: '-0.25' });
    expect(at('(x+y)/(x-y)', 3, 1)).toEqual({ z: '2', dx: '-0.5', dy: '1.5' });
    expect(at('(x+y)^3', 1, 1)).toEqual({ z: '8', dx: '12', dy: '12' });
    expect(at('x^6', 2, 0)).toEqual({ z: '64', dx: '192', dy: '0' });
    expect(at('7', 1, 1)).toEqual({ z: '7', dx: '0', dy: '0' });
    expect(at('x*y*y', 2, 3)).toEqual({ z: '18', dx: '9', dy: '12' });
  });

  it('keeps fractions exact instead of rounding them', () => {
    const found = evaluate(expr('x/3'), ratFromInt(1), ratFromInt(0));
    expect(found.ok && found.z).toEqual({ n: 1n, d: 3n });
    expect(found.ok && ratText(found.z)).toBe('1/3');
    expect(found.ok && isTypable(found.z)).toBe(false);
    expect(at('0.1x+0.2x', 10, 0).z).toBe('3');
  });

  it('refuses a division by zero and a result with too many bits, and says so', () => {
    expect(evaluate(expr('1/(x-y)'), ratFromInt(2), ratFromInt(2))).toEqual({ ok: false, reason: 'undefined' });
    expect(evaluate(expr('x/0'), ratFromInt(1), ratFromInt(1))).toEqual({ ok: false, reason: 'undefined' });
    expect(evaluate(expr('1/(x^2-y^2)'), ratFromInt(3), ratFromInt(-3))).toEqual({ ok: false, reason: 'undefined' });
    expect(evaluate(expr('x^6'), ratFromInt(1e300), ratFromInt(0))).toEqual({ ok: false, reason: 'large' });
    expect(evaluate(expr('x*x*x*x'), ratFromInt(1e200), ratFromInt(0))).toEqual({ ok: false, reason: 'large' });
  });

  it('stops after the evaluation budget, so a hostile task cannot spend unbounded work', () => {
    const meter = newMeter();
    const point = ratFromInt(1);
    for (let used = 0; used < FORMULA_LIMITS.maxEvaluations; used += 1) expect(evaluate(expr('x+y'), point, point, meter).ok).toBe(true);
    expect(evaluate(expr('x+y'), point, point, meter)).toEqual({ ok: false, reason: 'budget' });
    expect(formulaGrid(expr('x+y'), { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }, meter)).toBeNull();
    const walk = walkPath(expr('x^2+y^2'), { x: 1, y: 1 }, { n: 1, d: 10 }, 5, meter);
    expect(walk.ok).toBe(false);
    expect(walk.ok ? '' : walk.reason).toBe('budget');
    expect(formulaGrid(expr('x+y'), { xMin: -4, xMax: 4, yMin: -4, yMax: 4 })).not.toBeNull();
  });

  it('computes the gradient and the second partial pair at a point', () => {
    const payload = payloadOf('gradient-at-a-point');
    expect(partialsAt(payload)).toEqual({ dx: ratFromInt(3), dy: ratFromInt(1) });
    expect(formulaKey(payload)!.map(ratText)).toEqual(['3', '1']);
    expect(partialsAt(payloadOf('build-a-surface'))).toBeNull();
    expect(formulaKey(payloadOf('build-a-surface'))).toBeNull();
    expect(formulaKey(payloadOf('slope-two-ways'))!.map(ratText)).toEqual(['6']);
    expect(partialsAt(payloadOf('slope-two-ways'))).toEqual({ dx: ratFromInt(6), dy: ratFromInt(2) });
  });

  it('reads and writes exact decimals', () => {
    expect(ratDecimal({ n: 1n, d: 8n })).toEqual({ text: '0.125', exact: true });
    expect(ratDecimal({ n: 1n, d: 3n })).toEqual({ text: '0.333', exact: false });
    expect(ratDecimal({ n: -2n, d: 3n })).toEqual({ text: '-0.667', exact: false });
    expect(ratDecimal({ n: -1n, d: 10000n })).toEqual({ text: '0', exact: false });
    expect(ratText({ n: -3n, d: 2n })).toBe('-1.5');
    expect(ratText({ n: 5n, d: 1n })).toBe('5');
    expect(ratToNumber({ n: -3n, d: 2n })).toBeCloseTo(-1.5);
    expect(ratCompare(ratFromInt(2), { n: 5n, d: 2n })).toBe(-1);
    expect(ratEquals({ n: 1n, d: 2n }, { n: 1n, d: 2n })).toBe(true);
  });
});

describe('F4.7 formulas: typed numbers accept a decimal comma', () => {
  it('reads a point, a comma, a fraction and a sign, the same value each way', () => {
    for (const text of ['0.5', '0,5', ' 0,5 ', '+0,5', '1/2', '2/4', '0.50']) expect(ratText(readNumber(text)!), text).toBe('0.5');
    expect(ratText(readNumber('-1,25')!)).toBe('-1.25');
    expect(ratText(readNumber('−2,5')!)).toBe('-2.5');
    expect(ratText(readNumber('12')!)).toBe('12');
    expect(ratText(readNumber('-0')!)).toBe('0');
    expect(ratText(readNumber('3/4')!)).toBe('0.75');
  });

  it('refuses everything else, never throwing', () => {
    for (const text of ['', ' ', '.', ',', '0,', ',5', '1.2.3', '1,2,3', '1 000', '1e3', '--1', '1/0', '1/', '/2', '1/2/3', '1/2.5', '1,5/2', 'abc', '0x10', 'Infinity', 'NaN', '1'.repeat(25), '9'.repeat(10), '0.' + '1'.repeat(10)]) {
      expect(readNumber(text), JSON.stringify(text)).toBeNull();
    }
    for (const value of [undefined, null, 5, {}, [], true, 1n]) expect(readNumber(value as unknown)).toBeNull();
  });
});

describe('F4.7 formulas: the walk, the grid and the picture', () => {
  it('steps downhill by a fraction of the gradient and finds the first step at or below the line', () => {
    const payload = payloadOf('downhill-walk');
    const task = payload.task as Extract<FormulaPayload['task'], { kind: 'walk' }>;
    const walk = walkPath(expr(task.expression), task.at, task.rate, task.maxSteps);
    expect(walk.ok).toBe(true);
    const path = walk.path;
    expect(path).toHaveLength(task.maxSteps + 1);
    expect(ratText(path[0]!.z)).toBe('13');
    expect(path[1]!.x).toEqual({ n: 12n, d: 5n });
    expect(path[1]!.y).toEqual({ n: 8n, d: 5n });
    expect(ratText(path[1]!.z)).toBe('8.32');
    expect(path.map((point) => ratToNumber(point.z)).every((height, step) => step === 0 || height < ratToNumber(path[step - 1]!.z))).toBe(true);
    expect(walkReach(path, task.below)).toBe(4);
    expect(walkReach(path, -5)).toBeNull();
    expect(walkReach(path, 13)).toBe(1);
  });

  it('refuses a walk that leaves the exact range or divides by zero', () => {
    const blown = walkPath(expr('x^6'), { x: 9, y: 0 }, { n: 99, d: 100 }, 12);
    expect(blown.ok).toBe(false);
    const zero = walkPath(expr('1/x'), { x: 0, y: 0 }, { n: 1, d: 10 }, 3);
    expect(zero).toMatchObject({ ok: false, reason: 'undefined' });
    expect(walkPath(expr('x'), { x: 1, y: 1 }, { n: 1, d: 0 }, 3)).toMatchObject({ ok: false });
  });

  it('builds the grid and the mesh inside the same box as the money surfaces', () => {
    const window = payloadOf('slope-two-ways').window;
    const grid = formulaGrid(expr('x^2+2xy'), window)!;
    expect(grid.xs).toHaveLength(7);
    expect(grid.ys).toHaveLength(7);
    expect(ratText(grid.values[5]![4]!)).toBe('5');
    expect(grid.low).toBe(-9);
    expect(grid.high).toBe(27);
    const mesh = formulaMesh(grid, window);
    expect(mesh).toHaveLength(7);
    const flat = mesh.flat().filter((point): point is [number, number, number] => point !== null);
    expect(Math.max(...flat.map((point) => point[1]))).toBeCloseTo(0.5);
    expect(Math.min(...flat.map((point) => point[1]))).toBeCloseTo(-0.5);
    expect(Math.max(...flat.map((point) => Math.abs(point[0])))).toBeCloseTo(0.7);
    const corner = worldPoint(window, window.xMin, window.yMax, 0, 0, 0);
    expect(corner[0]).toBeCloseTo(-0.7);
    expect(corner[1]).toBe(0);
    expect(corner[2]).toBeCloseTo(-0.7);
    const holes = formulaGrid(expr('1/x'), { xMin: -1, xMax: 1, yMin: 0, yMax: 2 })!;
    expect(holes.values[0]![1]).toBeNull();
    expect(formulaMesh(holes, { xMin: -1, xMax: 1, yMin: 0, yMax: 2 })[0]![1]).toBeNull();
    expect(inWindow(window, 3, -3)).toBe(true);
    expect(inWindow(window, 4, 0)).toBe(false);
  });
});

describe('F4.7 formulas: notation is built from the tree, never from the text', () => {
  const words: SpokenWords = { plus: 'plus', minus: 'minus', times: 'times', over: 'over', power: 'to the power', open: 'open', close: 'close', negative: 'negative' };

  it('writes KaTeX source from digits, x, y and fixed commands only', () => {
    expect(formulaLatex(expr('x^2+2xy'))).toBe('x^{2}+2xy');
    expect(formulaLatex(expr('z = x^2 + 3y - x*y'))).toBe('x^{2}+3y-xy');
    expect(formulaLatex(expr('(x+1)(y-1)'))).toBe('(x+1)(y-1)');
    expect(formulaLatex(expr('x/(y+1)'))).toBe('\\frac{x}{y+1}');
    expect(formulaLatex(expr('-(x+y)^2'))).toBe('-(x+y)^{2}');
    expect(formulaLatex(expr('x - (y - 1)'))).toBe('x-(y-1)');
    expect(formulaLatex(expr('x-(-y)'))).toBe('x-(-y)');
    expect(formulaLatex(expr('2*3'))).toBe('2\\cdot 3');
    expect(formulaLatex(expr('0.5x'))).toBe('0.5x');
    expect(formulaLatex(expr('0,5x'), ',')).toBe('0{,}5x');
    for (const text of ['x^2+2xy', '0,5x-y/3', '(x+y)^3*7']) expect(formulaLatex(expr(text))).not.toMatch(/[<>&"';$%]/);
  });

  it('speaks a formula in the words and the decimal mark the caller gives', () => {
    expect(formulaSpoken(expr('x^2+2xy'), words)).toBe('x to the power 2 plus 2 times x times y');
    expect(formulaSpoken(expr('0,5x'), words, ',')).toBe('0,5 times x');
    expect(formulaSpoken(expr('0.5x'), words, '.')).toBe('0.5 times x');
    expect(formulaSpoken(expr('x/(y+1)'), words)).toBe('x over open y plus 1 close');
    expect(formulaSpoken(expr('-x'), words)).toBe('negative x');
    expect(formulaSpoken(expr('x-(y-1)'), words)).toBe('x minus open y minus 1 close');
  });
});

describe('F4.7 formulas: the payload and the authoring rules', () => {
  const base = () => structuredClone(segmentOf('slope-two-ways').payload) as { window: Record<string, number>; task: Record<string, unknown> };
  const problem = (payload: unknown) => { const read = readFormulaPayload(payload); return read ? formulaProblem(read) : 'malformed'; };

  it('reads the four fixtures and finds none of them at fault', () => {
    for (const id of FORMULA_IDS) expect(formulaProblem(payloadOf(id)), id).toBeNull();
  });

  it('refuses a payload that is not exactly the documented shape', () => {
    expect(problem({ ...base(), extra: 1 })).toBe('malformed');
    expect(problem({ window: base().window })).toBe('malformed');
    expect(problem({ window: { ...base().window, xMax: 100 }, task: base().task })).toBe('malformed');
    expect(problem({ window: { ...base().window, xMax: base().window.xMin! + 1 }, task: base().task })).toBe('malformed');
    expect(problem({ window: { ...base().window, xMax: base().window.xMin! + 9 }, task: base().task })).toBe('malformed');
    expect(problem({ window: { ...base().window, xMin: 0.5 }, task: base().task })).toBe('malformed');
    expect(problem({ ...base(), task: { ...base().task, axis: 'z' } })).toBe('malformed');
    expect(problem({ ...base(), task: { ...base().task, at: { x: 9, y: 0 } } })).toBe('malformed');
    expect(problem({ ...base(), task: { ...base().task, at: { x: 1, y: 2, z: 3 } } })).toBe('malformed');
    expect(problem({ ...base(), task: { ...base().task, expression: 'eval(1)' } })).toBe('malformed');
    expect(problem({ ...base(), task: { ...base().task, expression: 'x'.repeat(49) } })).toBe('malformed');
    expect(problem({ ...base(), task: { ...base().task, kind: 'integral' } })).toBe('malformed');
    expect(problem({ ...base(), task: { ...base().task, extra: true } })).toBe('malformed');
    for (const garbage of [null, undefined, 0, 'x', [], {}, { window: 1, task: 2 }]) expect(readFormulaPayload(garbage)).toBeNull();
    const poisoned = JSON.parse('{"window":{"xMin":-3,"xMax":3,"yMin":-3,"yMax":3},"task":{"kind":"slope","expression":"x^2","axis":"x","at":{"x":1,"y":1}},"__proto__":{"x":1}}');
    expect(readFormulaPayload(poisoned)).toBeNull();
  });

  it('refuses a surface that is flat, undefined somewhere, or has no exact typed answer', () => {
    expect(problem({ ...base(), task: { ...base().task, expression: '0*x+5' } })).toBe('The surface must not be flat');
    expect(problem({ ...base(), task: { ...base().task, expression: 'x/y' } })).toBe('The formula must be defined at every whole point of the window');
    expect(problem({ ...base(), task: { ...base().task, expression: 'x^2/3', at: { x: 1, y: 2 } } })).toMatch(/^The answer must be a number a learner can type exactly/);
    expect(problem({ ...base(), task: { ...base().task, expression: 'x^6*y^6' } })).toBeNull();
    expect(problem({ ...base(), task: { ...base().task, expression: 'x^2/1000' } })).toBeNull();
    expect(problem({ ...base(), task: { ...base().task, expression: 'x^2/10000' } })).toMatch(/^The answer must be a number/);
    expect(problem({ ...base(), task: { ...base().task, expression: '1000*x^3*y^3', at: { x: 3, y: 3 } } })).toMatch(/^The answer must be a number/);
  });

  it('refuses a walk that never gets there, leaves the window, starts below the line or reaches it in one step', () => {
    const walk = (patch: Record<string, unknown>) => problem({ window: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 }, task: { kind: 'walk', expression: 'x^2+y^2', at: { x: 3, y: 2 }, rate: { n: 1, d: 10 }, below: 3, maxSteps: 8, ...patch } });
    expect(walk({})).toBeNull();
    expect(walk({ below: 1, maxSteps: 3 })).toBe('The walk must reach the line within its steps');
    expect(walk({ expression: 'x^3+y^2', at: { x: 2, y: 1 }, rate: { n: 1, d: 2 }, below: -30, maxSteps: 3 })).toBe('The walk must stay inside the window');
    expect(walk({ below: 20 })).toBe('The walk must start above the line');
    expect(walk({ below: 9 })).toBe('The walk must take at least 2 steps to reach the line');
    expect(walk({ rate: { n: 3, d: 2 } })).toBe('malformed');
    expect(walk({ rate: { n: 0, d: 2 } })).toBe('malformed');
    expect(walk({ maxSteps: 13 })).toBe('malformed');
    expect(walk({ maxSteps: 2 })).toBe('malformed');
    expect(walk({ expression: '1/(x-3)' })).toBe('The formula must be defined at every whole point of the window');
  });

  it('refuses a build with one point, equal cells, a point outside the window or one flat height', () => {
    const build = (through: unknown) => problem({ window: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }, task: { kind: 'build', through } });
    expect(build([{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 3 }])).toBeNull();
    expect(build([{ x: 0, y: 0, z: 1 }])).toBe('malformed');
    expect(build([{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 3 }])).toBe('malformed');
    expect(build([{ x: 0, y: 0, z: 1 }, { x: 3, y: 0, z: 3 }])).toBe('malformed');
    expect(build([{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }])).toBe('The points must not all have the same height, or a flat surface would pass through them all');
    expect(build([{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 2 }, { x: 0, y: 1, z: 3 }, { x: 1, y: 1, z: 4 }])).toBe('malformed');
  });

  it('counts the answer boxes and the points a typed formula passes through', () => {
    expect(answerCount(payloadOf('gradient-at-a-point').task)).toBe(2);
    expect(answerCount(payloadOf('slope-two-ways').task)).toBe(1);
    expect(answerCount(payloadOf('build-a-surface').task)).toBe(1);
    const through = [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 3 }, { x: 0, y: 1, z: 0 }];
    expect(throughCount('1+2x-y', through)).toBe(3);
    expect(throughCount('z = 1 + 2,0x - y', through)).toBe(3);
    expect(throughCount('1+2x', through)).toBe(2);
    expect(throughCount('5', through)).toBe(0);
    expect(throughCount('1/x', through)).toBe(0);
    expect(throughCount('sin(x)', through)).toBeNull();
    expect(throughCount(undefined, through)).toBeNull();
  });
});

describe('F4.7 formulas: the scorer', () => {
  it('climbs invalid, valid, met on every fixture, and says valid at most without a key', () => {
    for (const id of FORMULA_IDS) {
      const { ladder } = fixture(id);
      expect(grade(segmentOf(id), ladder.invalid, fixture(id).rubric).verdict, id).toBe('invalid');
      expect(grade(segmentOf(id), ladder.valid, fixture(id).rubric).verdict, id).toBe('valid');
      expect(grade(segmentOf(id), ladder.met, fixture(id).rubric), id).toEqual({ verdict: 'met', diagnostic: 'none' });
      expect(grade(segmentOf(id), ladder.met, undefined).verdict, id).toBe('valid');
      expect(grade(segmentOf(id), ladder.invalid, undefined).verdict, id).toBe('invalid');
    }
  });

  it('reads a slope as a number, with a point, a comma or a fraction', () => {
    expect(run('slope-two-ways', ['6'])).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('slope-two-ways', ['6.0']).verdict).toBe('met');
    expect(run('slope-two-ways', ['12/2']).verdict).toBe('met');
    expect(run('slope-two-ways', ['2'])).toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(run('slope-two-ways', ['5'])).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('slope-two-ways', [''])).toEqual({ verdict: 'valid', diagnostic: 'none' });
    expect(run('slope-two-ways', ['  '])).toEqual({ verdict: 'valid', diagnostic: 'none' });
    expect(run('slope-two-ways', ['six']).verdict).toBe('invalid');
    expect(bare('slope-two-ways', ['6'])).toEqual({ verdict: 'valid', diagnostic: 'none' });
  });

  it('accepts the decimal comma in the answer and in the formula, and refuses a number that does not read', () => {
    const window = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };
    const payload = { window, task: { kind: 'slope', expression: '0,5x*y+x', axis: 'y', at: { x: 1, y: 1 } } };
    const segment = { ...segmentOf('slope-two-ways'), payload };
    expect(formulaKey(readFormulaPayload(payload)!)!.map(ratText)).toEqual(['0.5']);
    for (const typed of ['0.5', '0,5', '1/2', ' 0,50 ', '+0,5']) expect(grade(segment, { answer: [typed] }, { key: ['0.5'] }), typed).toEqual({ verdict: 'met', diagnostic: 'none' });
    for (const typed of ['0,5,5', '0..5', '½', '0,5x', '1e-1']) expect(grade(segment, { answer: [typed] }, { key: ['0.5'] }).verdict, typed).toBe('invalid');
    expect(grade(segment, { answer: ['2'] }, { key: ['0.5'] })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(grade(segment, { answer: ['1,5'] }, { key: ['0.5'] })).toEqual({ verdict: 'review', diagnostic: 'structure' });
  });

  it('scores a gradient by part, by swap and by value', () => {
    expect(run('gradient-at-a-point', ['3', '1']).verdict).toBe('met');
    expect(run('gradient-at-a-point', ['3,0', '1.0']).verdict).toBe('met');
    expect(run('gradient-at-a-point', ['3', '9'])).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run('gradient-at-a-point', ['9', '1'])).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run('gradient-at-a-point', ['1', '3'])).toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(run('gradient-at-a-point', ['8', '9'])).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('gradient-at-a-point', ['3', ''])).toEqual({ verdict: 'valid', diagnostic: 'none' });
    expect(run('gradient-at-a-point', ['', ''])).toEqual({ verdict: 'valid', diagnostic: 'none' });
    expect(run('gradient-at-a-point', ['3']).verdict).toBe('invalid');
    expect(run('gradient-at-a-point', ['3', '1', '0']).verdict).toBe('invalid');
    expect(run('gradient-at-a-point', ['3', 'x']).verdict).toBe('invalid');
  });

  it('scores a walk by its step count', () => {
    expect(run('downhill-walk', ['4'])).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('downhill-walk', ['3'])).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('downhill-walk', ['4,5']).verdict).toBe('review');
    expect(run('downhill-walk', ['four']).verdict).toBe('invalid');
  });

  it('scores a built formula by the points it passes through, and never by how it is written', () => {
    for (const typed of ['1+2x-y', 'z = 1 + 2x - y', 'z=1+2*x-y', '2x-y+1', '1+2,0x-y', '1 + 2x - y + x*y*(x-1)', '1+2x-y+x^2*(x-1)']) {
      expect(run('build-a-surface', [typed]), typed).toEqual({ verdict: 'met', diagnostic: 'none' });
    }
    expect(run('build-a-surface', ['1+2x'])).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run('build-a-surface', ['7'])).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('build-a-surface', ['1/x'])).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('build-a-surface', [''])).toEqual({ verdict: 'valid', diagnostic: 'none' });
    expect(run('build-a-surface', ['eval(1)']).verdict).toBe('invalid');
    expect(run('build-a-surface', ['x'.repeat(49)]).verdict).toBe('invalid');
    expect(bare('build-a-surface', ['1+2x-y']).verdict).toBe('valid');
  });

  it('refuses hostile and malformed responses without throwing', () => {
    const hostile: unknown[] = [undefined, null, 0, 'x', [], {}, { answer: 'x' }, { answer: {} }, { answer: null }, { answer: [null] }, { answer: [1] }, { answer: [['6']] },
      { answer: ['6'], extra: 1 }, { counts: 'x' }, { answer: [{}] }, { answer: ['6'.repeat(1000)] }, { answer: ['__proto__'] }];
    for (const response of hostile) {
      expect(() => grade(segmentOf('slope-two-ways'), response, fixture('slope-two-ways').rubric)).not.toThrow();
      expect(grade(segmentOf('slope-two-ways'), response, fixture('slope-two-ways').rubric).verdict, JSON.stringify(response)).toBe('invalid');
      expect(grade(segmentOf('build-a-surface'), response, fixture('build-a-surface').rubric).verdict, JSON.stringify(response)).toBe('invalid');
    }
    const huge = { answer: Array.from({ length: 1000 }, () => '1') };
    expect(grade(segmentOf('slope-two-ways'), huge, fixture('slope-two-ways').rubric).verdict).toBe('invalid');
    expect(grade({ payload: null }, { answer: ['6'] }, fixture('slope-two-ways').rubric).verdict).toBe('invalid');
    expect(grade(undefined, { answer: ['6'] }, undefined)).toEqual({ verdict: 'invalid', diagnostic: 'none' });
    expect(grade(segmentOf('slope-two-ways'), JSON.parse('{"answer":["6"],"__proto__":{"a":1}}'), undefined).verdict).toBe('invalid');
  });

  it('fails closed on a key that is not the one exact answer of the payload', () => {
    for (const rubric of [{ key: ['5'] }, { key: ['6', '2'] }, { key: [] }, { key: '6' }, { key: ['6.0'] }, { key: [6] }, { reference: '1+2x-y' }, { choice: 'a' }, {}, null, 'x', [], { key: ['6'], extra: 1 }]) {
      expect(run('slope-two-ways', ['6'], rubric).verdict, JSON.stringify(rubric)).toBe('invalid');
    }
    for (const rubric of [{ reference: '1+2x' }, { reference: '7' }, { reference: 'eval(1)' }, { key: ['1'] }, { reference: '1+2x-y', extra: 1 }, { reference: 5 }]) {
      expect(run('build-a-surface', ['1+2x-y'], rubric).verdict, JSON.stringify(rubric)).toBe('invalid');
    }
    expect(run('gradient-at-a-point', ['3', '1'], { key: ['1', '3'] }).verdict).toBe('invalid');
    expect(run('downhill-walk', ['4'], { key: ['3'] }).verdict).toBe('invalid');
  });

  it('keeps the key out of the public payload and out of the sample response', () => {
    for (const id of FORMULA_IDS) {
      const json = JSON.stringify(segmentOf(id));
      expect(json, id).not.toMatch(/"(key|reference|answer|solution)"/);
    }
    const sample = space2.scorers[FORMULA]!.sample as unknown as (segment: unknown, rubric: unknown) => unknown;
    expect(sample(segmentOf('gradient-at-a-point'), fixture('gradient-at-a-point').rubric)).toEqual({ answer: ['', ''] });
    expect(sample(segmentOf('build-a-surface'), fixture('build-a-surface').rubric)).toEqual({ answer: [''] });
    expect(sample({ payload: null }, {})).toEqual({ answer: [''] });
  });
});

describe('F4.7 formulas: Core and Forge plug-in', () => {
  it('serves the public lesson in every locale and grades from the answer key at the server gate', () => {
    for (const id of FORMULA_IDS) {
      for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(id, locale)).success, `${id} ${locale}`).toBe(true);
      const document = lesson(id);
      const segmentId = segmentOf(id).id as string;
      const keys = { [segmentId]: fixture(id).rubric };
      const parsed = v2PublicLessonSchema.parse(document);
      expect(validateV2LessonForGrading(document, keys, { lessonId: document.lesson_id, locale: document.locale }), id).not.toBeNull();
      expect(gradeV2Visual(parsed, keys, segmentId, fixture(id).ladder.met), id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, segmentId, fixture(id).ladder.valid), id).toBeNull();
      expect(horizonteGrade(segmentOf(id) as { type: string }, fixture(id).ladder.met, undefined), id).toBeNull();
      expect(horizonteGrade(segmentOf(id) as { type: string }, fixture(id).ladder.met, fixture(id).rubric), id).toMatchObject({ score: 100, correct: true });
      expect(horizonteSampleVerdict(segmentOf(id) as { type: string }, fixture(id).rubric), id).toBe('valid');
    }
  });

  it('rejects a key the formula contradicts, a leaked key, a wrong visual and a hostile formula at the grading gate', () => {
    for (const [id, wrong] of [['slope-two-ways', { key: ['2'] }], ['gradient-at-a-point', { key: ['1', '3'] }], ['downhill-walk', { key: ['3'] }], ['build-a-surface', { reference: '1+2x' }]] as const) {
      const document = lesson(id);
      expect(validateV2LessonForGrading(document, { [segmentOf(id).id as string]: wrong }, { lessonId: document.lesson_id, locale: document.locale }), id).toBeNull();
    }
    const parse = (document: unknown) => v2PublicLessonSchema.safeParse(document).success;
    for (const id of FORMULA_IDS) {
      const document = lesson(id);
      const segment = document.segments[0] as Record<string, unknown>;
      const payload = segment.payload as Record<string, unknown>;
      expect(parse({ ...document, segments: [{ ...segment, payload: { ...payload, key: ['6'] } }] }), `${id} leak`).toBe(false);
      expect(parse({ ...document, segments: [{ ...segment, visual: { type: 'surface' } }] }), `${id} visual`).toBe(false);
      expect(parse({ ...document, segments: [{ ...segment, grading: 'none' }] }), `${id} ungraded`).toBe(false);
    }
    const document = lesson('slope-two-ways');
    const segment = document.segments[0] as { payload: { task: Record<string, unknown> } } & Record<string, unknown>;
    for (const expression of ['eval("1")', 'constructor', 'x^7', 'x/0', `(${'x+'.repeat(30)}1)`, '__proto__']) {
      const hostile = { ...segment, payload: { ...segment.payload, task: { ...segment.payload.task, expression } } };
      expect(parse({ ...document, segments: [hostile] }), expression).toBe(false);
    }
  });

  it('is open to ages 15-17 and adults only', () => {
    const scope = (band: string, low: number, high: number) => horizonteScopeProblem({ type: FORMULA }, { age_band: band, eligibility: { minimum_age: low, maximum_age: high } });
    expect(scope('13-17', 15, 17)).toBeNull();
    expect(scope('13-17', 13, 17)).not.toBeNull();
    expect(scope('10-12', 12, 12)).not.toBeNull();
    expect(scope('6-9', 7, 9)).not.toBeNull();
    expect(scope('adult', 18, 99)).toBeNull();
  });
});
