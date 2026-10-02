import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { alg2 } from '../../services/horizonte/alg2/index.js';
import { ALG2_CAPABILITIES } from '../../services/horizonte/alg2/capabilities.js';
import { ALG2_FIXTURES } from '../../services/horizonte/alg2/fixtures.js';
import {
  EXPRESSION_LIMITS, SAMPLE_POINTS, analyseLines, expressionReferenceProblem, expressionTaskProblem, parseExpression, sameExpression, sameParsed, satisfiesForm,
  toLatex, toPolynomial, toSpoken, type ExpressionTask,
} from '../../services/horizonte/alg2/expression.js';
import {
  crossingOf, curveAt, formatDecimal, fromStandard, isCrossing, liesOn, lineText, onSliders, parseExactNumber, parseSliderNumber, passesThrough, readGraphPayload,
  readStandard, readSystemPayload, sameSpots, startResponse, toNumber, toStandard,
} from '../../services/horizonte/alg2/model.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const grade = (type: keyof typeof ALG2_CAPABILITIES): Grade => alg2.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => ALG2_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') => fixture(id).segment(locale) as { payload: Record<string, unknown> } & Record<string, unknown>;
const withPayload = (id: string, patch: Record<string, unknown>) => ({ ...segmentOf(id), payload: { ...segmentOf(id).payload, ...patch } });

const GRAPH = grade('math.function-graph.v2');
const SYSTEM = grade('math.line-system.v2');
const EDITOR = grade('math.expression-editor.v2');

function lesson(entry = fixture('graph-line-two-dots'), locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const segment = entry.segment(locale) as { type: keyof typeof ALG2_CAPABILITIES };
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-alg2', chapter_id: 'horizonte-alg2', lesson_id: `hz-alg2-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...ALG2_CAPABILITIES[segment.type]], segments: [segment],
  };
}

const dec = (text: string) => parseExactNumber(text)!;

describe('alg2 pack: F2.4, F2.5, F2.6', () => {
  it('meets the scorer contract for every type and covers the catalogue', () => {
    expect(() => assertScorerContract(alg2, ALG2_FIXTURES)).not.toThrow();
    expect(Object.keys(ALG2_CAPABILITIES)).toEqual(['math.function-graph.v2', 'math.line-system.v2', 'math.expression-editor.v2']);
    expect(ALG2_FIXTURES).toHaveLength(11);
    for (const type of Object.keys(ALG2_CAPABILITIES)) expect(ALG2_FIXTURES.some((entry) => (entry.segment('en-US') as { type: string }).type === type), type).toBe(true);
  });

  describe('exact numbers', () => {
    it('reads slider text as small decimals only', () => {
      expect(parseSliderNumber('1.5')).toEqual({ n: 3n, d: 2n });
      expect(parseSliderNumber('-0.125')).toEqual({ n: -1n, d: 8n });
      expect(parseSliderNumber('1/2')).toBeNull();
      expect(parseSliderNumber('0.0001')).toBeNull();
      expect(parseSliderNumber('1234567')).toBeNull();
      expect(parseSliderNumber('')).toBeNull();
      expect(parseSliderNumber(5)).toBeNull();
      expect(parseSliderNumber('1e3')).toBeNull();
    });
    it('reads exact decimals and fractions, and writes back only finite decimals', () => {
      expect(parseExactNumber('3/4')).toEqual({ n: 3n, d: 4n });
      expect(parseExactNumber('-6/4')).toEqual({ n: -3n, d: 2n });
      expect(parseExactNumber('1/0')).toBeNull();
      expect(parseExactNumber('x')).toBeNull();
      expect(parseExactNumber('1'.repeat(33))).toBeNull();
      expect(formatDecimal(dec('-1.5'))).toBe('-1.5');
      expect(formatDecimal(dec('4'))).toBe('4');
      expect(formatDecimal(dec('1/3'))).toBeNull();
      expect(formatDecimal(dec('1/4'))).toBe('0.25');
      expect(toNumber(dec('3/4'))).toBe(0.75);
    });
  });

  describe('F2.4 function graph model', () => {
    const read = (id: string) => {
      const graph = readGraphPayload(segmentOf(id).payload);
      if (typeof graph === 'string') throw new Error(graph);
      return graph;
    };

    it('reads every fixture payload', () => {
      for (const id of ['graph-line-two-dots', 'graph-parabola-vertex', 'graph-parabola-standard', 'graph-growth-curve']) expect(typeof readGraphPayload(segmentOf(id).payload), id).toBe('object');
    });

    it('converts vertex form to standard form and back without losing the vertex', () => {
      const graph = read('graph-parabola-vertex');
      const standard = toStandard(graph, graph.start)!;
      expect(Object.fromEntries([...standard].map(([name, value]) => [name, formatDecimal(value)]))).toEqual({ a: '1', b: '0', c: '0' });
      const moved = toStandard(graph, new Map([['a', dec('2')], ['h', dec('1')], ['k', dec('-3')]]))!;
      expect(Object.fromEntries([...moved].map(([name, value]) => [name, formatDecimal(value)]))).toEqual({ a: '2', b: '-4', c: '-1' });
      const back = fromStandard(graph, moved)!;
      expect(Object.fromEntries([...back].map(([name, value]) => [name, formatDecimal(value)]))).toEqual({ a: '2', h: '1', k: '-3' });
      expect(onSliders(graph, moved)).toBe(true);
      expect(onSliders(graph, new Map([['a', dec('2')], ['b', dec('-4')], ['c', dec('0.5')]]))).toBe(false);
    });

    it('draws the curve exactly at a point and checks the marks', () => {
      const graph = read('graph-parabola-vertex');
      const target = readStandard('quadratic', { a: '2', b: '-4', c: '-1' })!;
      expect(formatDecimal(curveAt('quadratic', target, 3)!)).toBe('5');
      expect(passesThrough('quadratic', target, graph.marks)).toBe(true);
      expect(passesThrough('quadratic', readStandard('quadratic', { a: '1', b: '0', c: '0' })!, graph.marks)).toBe(false);
      expect(curveAt('exponential', readStandard('exponential', { a: '1', b: '2' })!, 3)).toEqual({ n: 8n, d: 1n });
      expect(readStandard('line', { m: '1' })).toBeNull();
      expect(readStandard('line', { m: '1', b: '0', c: '0' })).toBeNull();
      expect(readStandard('line', { m: 1, b: 0 })).toBeNull();
      expect(startResponse(graph)).toEqual({ family: 'quadratic', params: { a: '1', b: '0', c: '0' } });
    });

    it('refuses a payload that cannot be solved on its sliders', () => {
      const problem = (id: string, patch: Record<string, unknown>) => readGraphPayload({ ...segmentOf(id).payload, ...patch });
      expect(typeof problem('graph-line-two-dots', { marks: [{ x: 0, y: 1 }] })).toBe('string');
      expect(typeof problem('graph-line-two-dots', { marks: [{ x: 1, y: 1 }, { x: 1, y: 2 }] })).toBe('string');
      expect(typeof problem('graph-line-two-dots', { curve: 'cubic' })).toBe('string');
      expect(typeof problem('graph-line-two-dots', { start: { m: '1' } })).toBe('string');
      expect(typeof problem('graph-line-two-dots', { start: { m: '9', b: '0' } })).toBe('string');
      expect(typeof problem('graph-line-two-dots', { window: { xMin: 5, xMax: -5, yMin: -8, yMax: 8 } })).toBe('string');
      expect(typeof problem('graph-line-two-dots', { sliders: { m: { min: '-5', max: '5', step: '0.001' }, b: { min: '-6', max: '6', step: '1' } } })).toBe('string');
      expect(typeof problem('graph-growth-curve', { sliders: { a: { min: '1', max: '4', step: '1' }, b: { min: '0', max: '3', step: '0.5' } }, start: { a: '2', b: '1' } })).toBe('string');
      expect(typeof problem('graph-parabola-vertex', { sliders: { a: { min: '-2', max: '2', step: '1' }, h: { min: '-3', max: '4', step: '1' }, k: { min: '-6', max: '6', step: '1' } }, start: { a: '1', h: '0', k: '0' } })).toBe('string');
      expect(typeof readGraphPayload(null)).toBe('string');
      expect(typeof readGraphPayload('x')).toBe('string');
    });
  });

  describe('F2.4 grading', () => {
    const id = 'graph-line-two-dots';
    const entry = fixture(id);
    const segment = segmentOf(id);

    it('grades the ladder and the diagnostics of the answer shape', () => {
      expect(GRAPH(segment, entry.ladder.met, entry.rubric)).toEqual({ verdict: 'met', diagnostic: 'none' });
      expect(GRAPH(segment, entry.ladder.valid, entry.rubric)).toEqual({ verdict: 'valid', diagnostic: 'none' });
      expect(GRAPH(segment, entry.ladder.invalid, entry.rubric).verdict).toBe('invalid');
      const wrong = GRAPH(segment, { family: 'line', params: { m: '2', b: '-2' } }, entry.rubric);
      expect(wrong.verdict).toBe('review');
      expect(wrong.diagnostic).not.toBe('none');
    });

    it('refuses what is not a moved slider', () => {
      expect(GRAPH(segment, { family: 'quadratic', params: { a: '1', b: '0', c: '0' } }, entry.rubric).verdict).toBe('invalid');
      expect(GRAPH(segment, { family: 'line', params: { m: '2', b: '-3' }, extra: 1 }, entry.rubric).verdict).toBe('invalid');
      expect(GRAPH(segment, { family: 'line', params: { m: '2', b: '-3', c: '1' } }, entry.rubric).verdict).toBe('invalid');
      expect(GRAPH(segment, { family: 'line', params: { m: 2, b: -3 } }, entry.rubric).verdict).toBe('invalid');
      expect(GRAPH(segment, { family: 'line', params: { m: '2.5', b: '-3' } }, entry.rubric).verdict).toBe('invalid');
      expect(GRAPH(segment, { family: 'line', params: { m: '9', b: '-3' } }, entry.rubric).verdict).toBe('invalid');
    });

    it('never says met in the browser, which holds no rubric', () => {
      expect(GRAPH(segment, entry.ladder.met, undefined)).toEqual({ verdict: 'valid', diagnostic: 'none' });
      expect(GRAPH(segment, entry.ladder.invalid, undefined).verdict).toBe('invalid');
    });

    it('refuses a malformed key', () => {
      const key = (patch: Record<string, unknown>) => ({ ...(entry.rubric as Record<string, unknown>), ...patch });
      expect(GRAPH(segment, entry.ladder.met, key({ target: { m: '1', b: '0' } })).verdict).toBe('invalid');
      expect(GRAPH(segment, entry.ladder.met, key({ target: { m: '3', b: '-3' } })).verdict).toBe('invalid');
      expect(GRAPH(segment, entry.ladder.met, key({ family: 'quadratic', target: { a: '1', b: '0', c: '0' } })).verdict).toBe('invalid');
      expect(GRAPH(segment, entry.ladder.met, key({ target: { m: '2', b: '-3', c: '1' } })).verdict).toBe('invalid');
      expect(GRAPH(segment, entry.ladder.met, key({ target: { m: '2', b: '-3' }, unknown: 1 })).verdict).toBe('invalid');
      expect(GRAPH(segment, entry.ladder.met, { target: 'nonsense' }).verdict).toBe('invalid');
      expect(GRAPH(segment, entry.ladder.met, null).verdict).toBe('invalid');
    });

    it('grades a vertex-form parabola and an exponential by the same key', () => {
      const vertex = fixture('graph-parabola-vertex');
      expect(GRAPH(vertex.segment('en-US'), vertex.ladder.met, vertex.rubric).verdict).toBe('met');
      expect(GRAPH(vertex.segment('en-US'), { family: 'quadratic', params: { a: '2', b: '-4', c: '0.5' } }, vertex.rubric).verdict).toBe('invalid');
      expect(GRAPH(vertex.segment('en-US'), { family: 'quadratic', params: { a: '2', b: '-4', c: '0' } }, vertex.rubric)).toMatchObject({ verdict: 'review' });
      const growth = fixture('graph-growth-curve');
      expect(GRAPH(growth.segment('en-US'), growth.ladder.met, growth.rubric).verdict).toBe('met');
      expect(GRAPH(growth.segment('en-US'), { family: 'exponential', params: { a: '1', b: '1.5' } }, growth.rubric).verdict).toBe('review');
    });

    it('refuses a key that the start already meets and one that misses the dots', () => {
      expect(GRAPH(segment, entry.ladder.met, { family: 'line', target: { m: '1', b: '0' } }).verdict).toBe('invalid');
      expect(GRAPH(withPayload(id, { marks: [{ x: 0, y: 1 }, { x: 2, y: 5 }] }), entry.ladder.met, entry.rubric).verdict).toBe('invalid');
    });
  });

  describe('F2.5 line system model', () => {
    it('reads the payload and tests membership exactly', () => {
      const system = readSystemPayload(segmentOf('system-cross-two-lines').payload);
      if (typeof system === 'string') throw new Error(system);
      expect(liesOn(system.lines[0]!, { x: 3, y: 2 })).toBe(true);
      expect(liesOn(system.lines[0]!, { x: 3, y: 2.5 })).toBe(false);
      expect(isCrossing(system.lines, { x: 3, y: 2 })).toBe(true);
      expect(isCrossing(system.lines, { x: 4, y: 1 })).toBe(false);
      expect(crossingOf(system.lines[0]!, system.lines[1]!)).toEqual({ x: { n: 3n, d: 1n }, y: { n: 2n, d: 1n } });
      expect(crossingOf({ a: 1, b: 1, c: 2 }, { a: 2, b: 2, c: 7 })).toBeNull();
      expect(lineText({ a: 1, b: -1, c: 1 })).toContain('=');
      expect(sameSpots([{ x: 1, y: 2 }, { x: 3, y: 4 }], [{ x: 3, y: 4 }, { x: 1, y: 2 }])).toBe(true);
      expect(sameSpots([{ x: 1, y: 2 }], [{ x: 1, y: 2.5 }])).toBe(false);
    });

    it('refuses a payload that cannot be solved', () => {
      const bad = (patch: Record<string, unknown>) => readSystemPayload({ ...segmentOf('system-cross-two-lines').payload, ...patch });
      expect(typeof bad({ lines: [{ a: 1, b: 1, c: 5 }, { a: 2, b: 2, c: 7 }] })).toBe('string');
      expect(typeof bad({ lines: [{ a: 1, b: 1, c: 5 }] })).toBe('string');
      expect(typeof bad({ lines: [{ a: 0, b: 0, c: 5 }, { a: 1, b: -1, c: 1 }] })).toBe('string');
      expect(typeof bad({ grid: 3 })).toBe('string');
      expect(typeof bad({ start: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })).toBe('string');
      expect(typeof bad({ lines: [{ a: 1, b: 1, c: 5 }, { a: 2, b: -2, c: 1 }] })).toBe('string');
      expect(typeof bad({ start: [{ x: 3, y: 2 }] })).toBe('object');
      expect(typeof bad({ window: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 } })).toBe('string');
      expect(typeof bad({ lines: [{ a: 1, b: 1, c: 5 }, { a: 1, b: -1, c: 1 }], window: { xMin: 5, xMax: 9, yMin: 5, yMax: 9 } })).toBe('string');
      expect(bad({ grid: 2, window: { xMin: -1, xMax: 9, yMin: -2, yMax: 8 } })).toBe('Every window edge sits on a grid line');
      expect(typeof readSystemPayload(undefined)).toBe('string');
    });
  });

  describe('F2.5 grading', () => {
    it('grades the ladder for one, a half step and three markers', () => {
      for (const id of ['system-cross-two-lines', 'system-half-grid', 'system-triangle']) {
        const entry = fixture(id);
        expect(SYSTEM(entry.segment('en-US'), entry.ladder.met, entry.rubric).verdict, id).toBe('met');
        expect(SYSTEM(entry.segment('en-US'), entry.ladder.valid, entry.rubric).verdict, id).toBe('valid');
        expect(SYSTEM(entry.segment('en-US'), entry.ladder.invalid, entry.rubric).verdict, id).toBe('invalid');
      }
    });

    it('reports a marker on a line but not on the crossing as review', () => {
      const entry = fixture('system-cross-two-lines');
      const near = SYSTEM(entry.segment('en-US'), { points: [{ x: 4, y: 1 }] }, entry.rubric);
      expect(near.verdict).toBe('review');
      expect(near.diagnostic).not.toBe('none');
      const triangle = fixture('system-triangle');
      expect(SYSTEM(triangle.segment('en-US'), { points: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 2, y: 0 }] }, triangle.rubric).verdict).toBe('review');
    });

    it('refuses the wrong count, an overlap, an off-grid or off-window marker and extra keys', () => {
      const entry = fixture('system-triangle');
      const segment = entry.segment('en-US');
      expect(SYSTEM(segment, { points: [{ x: 3, y: 3 }, { x: 5, y: 1 }] }, entry.rubric).verdict).toBe('invalid');
      expect(SYSTEM(segment, { points: [{ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 1 }] }, entry.rubric).verdict).toBe('invalid');
      expect(SYSTEM(segment, { points: [{ x: 3.5, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }] }, entry.rubric).verdict).toBe('invalid');
      expect(SYSTEM(segment, { points: [{ x: 30, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }] }, entry.rubric).verdict).toBe('invalid');
      expect(SYSTEM(segment, { points: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }], extra: 1 }, entry.rubric).verdict).toBe('invalid');
      expect(SYSTEM(segment, { points: [{ x: 3, y: 3, z: 1 }, { x: 5, y: 1 }, { x: 1, y: 1 }] }, entry.rubric).verdict).toBe('invalid');
      expect(SYSTEM(segment, { points: 'x' }, entry.rubric).verdict).toBe('invalid');
    });

    it('refuses a key that is not one crossing per marker', () => {
      const entry = fixture('system-triangle');
      const segment = entry.segment('en-US');
      expect(SYSTEM(segment, entry.ladder.met, { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }] }).verdict).toBe('invalid');
      expect(SYSTEM(segment, entry.ladder.met, { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 2, y: 2 }] }).verdict).toBe('invalid');
      expect(SYSTEM(segment, entry.ladder.met, { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }], snap: 1 }).verdict).toBe('invalid');
      expect(SYSTEM(segment, entry.ladder.met, { required: [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }] }).verdict).toBe('invalid');
    });

    it('never says met in the browser, which holds no rubric', () => {
      const entry = fixture('system-cross-two-lines');
      expect(SYSTEM(entry.segment('en-US'), entry.ladder.met, undefined).verdict).toBe('valid');
      expect(SYSTEM(entry.segment('en-US'), { points: [] }, undefined).verdict).toBe('invalid');
    });
  });

  describe('F2.6 expression engine', () => {
    const p = (text: string) => parseExpression(text, 'x');
    const same = (a: string, b: string) => {
      const left = p(a);
      const right = p(b);
      return sameParsed(left, right);
    };

    it('treats equivalent forms as the same and different ones as different', () => {
      expect(same('(x+2)(x+3)', 'x^2+5x+6')).toBe(true);
      expect(same('(x+2)(x+3)', 'x^2+5x+7')).toBe(false);
      expect(same('2(x+3)', '2x+6')).toBe(true);
      expect(same('x/2+x/2', 'x')).toBe(true);
      expect(same('(x^2-1)/(x-1)', 'x+1')).toBe(false);
      expect(same('0.5x', 'x/2')).toBe(true);
      expect(same('-x(x+3)', '-x^2-3x')).toBe(true);
      expect(same('x^6*x^6-x', '0')).toBe(false);
      expect(same('x^12-x', '0')).toBeNull();
      expect(same('x^6*x^6', 'x^6*x^6')).toBe(true);
      expect(same('x^6*x^3', 'x^3*x^6')).toBe(true);
      expect(same('(x+1)^2', 'x^2+2x+1')).toBe(true);
      expect(same('x^2+2x+1', '(x+1)^3')).toBe(false);
    });

    it('compares equations by their solutions, not by their look', () => {
      expect(same('3x+5=20', '3x=15')).toBe(true);
      expect(same('3x+5=20', 'x=5')).toBe(true);
      expect(same('3x+5=20', 'x=6')).toBe(false);
      expect(same('5x-4=2x+8', '3x=12')).toBe(true);
      expect(same('5x-4=2x+8', '5x=2x+12')).toBe(true);
      expect(same('x=5', '2x=10')).toBe(true);
      expect(same('x=5', '5=x')).toBe(true);
      expect(same('x=5', 'x+0=5')).toBe(true);
      expect(same('3x+5=20', '3x+5')).toBeNull();
    });

    it('reads equations and expressions and reports where a line breaks', () => {
      expect(p('x=5')).toMatchObject({ ok: true, kind: 'equation' });
      expect(p('x+5')).toMatchObject({ ok: true, kind: 'expression' });
      expect(p('')).toMatchObject({ ok: false, error: 'empty' });
      expect(p('   ')).toMatchObject({ ok: false, error: 'empty' });
      expect(p('(x+2')).toMatchObject({ ok: false });
      expect(p('x+2)')).toMatchObject({ ok: false });
      expect(p('x=5=5')).toMatchObject({ ok: false, error: 'two-equals' });
      expect(p('x+')).toMatchObject({ ok: false });
      expect(p('x y')).toMatchObject({ ok: false });
      expect(p('2 3')).toMatchObject({ ok: false });
      expect(p('x^x')).toMatchObject({ ok: false, error: 'bad-exponent' });
      expect(p('x^-1')).toMatchObject({ ok: false, error: 'bad-exponent' });
      expect(p('x^2.5')).toMatchObject({ ok: false, error: 'bad-exponent' });
      expect(p('x^7')).toMatchObject({ ok: false, error: 'bad-exponent' });
      expect(p('x^2^2')).toMatchObject({ ok: false });
      expect(p('1.5.2')).toMatchObject({ ok: false });
    });

    it('stays total on adversarial input and never evaluates text', () => {
      const hostile = [
        'eval(1)', 'constructor', '__proto__', 'constructor.constructor("return 1")()', 'process.exit(1)', 'Function("x")', 'import("fs")', 'x;y', 'x ', '${1}', '`x`',
        'toString', 'x=constructor', 'x=__proto__', '‮x+1', 'ｘ+1', 'x​+1', '1e9', '0x10', 'NaN', 'Infinity', '9'.repeat(64), '9'.repeat(10),
        '(((((((((((((((((((((((x)))))))))))))))))))))))', 'x+'.repeat(40) + 'x', '-'.repeat(60) + 'x', '('.repeat(60), ')'.repeat(60), '1/0', 'x/0', '0/0', '(x-x)/(x-x)',
        'x^6*x^6*x^6*x^6*x^6', '((x^6)^6)', '(x+1)^6*(x+1)^6*(x+1)^6', '99999999*99999999*99999999*99999999*99999999*99999999',
        'x'.repeat(65), '1+'.repeat(33), '(x+1)(x+2)(x+3)(x+4)(x+5)(x+6)(x+7)(x+8)(x+9)',
      ];
      for (const text of hostile) {
        const parsed = parseExpression(text, 'x');
        expect(typeof parsed.ok, text).toBe('boolean');
        const again = parseExpression(text, 'x');
        expect(JSON.stringify(again, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)), text).toBe(JSON.stringify(parsed, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
        if (parsed.ok) {
          // Comparing two readable lines must never throw either.
          expect(() => sameParsed(parsed, parsed), text).not.toThrow();
          expect(() => toLatex(parsed, 'x'), text).not.toThrow();
        }
      }
    });

    it('rejects the unsafe shapes and keeps the hard bounds', () => {
      expect(p('x'.repeat(65))).toMatchObject({ ok: false, error: 'too-long' });
      expect(parseExpression('x'.repeat(EXPRESSION_LIMITS.maxChars), 'x').ok).toBe(false);
      expect(p('constructor')).toMatchObject({ ok: false });
      expect(p('__proto__')).toMatchObject({ ok: false });
      expect(p('eval(1)')).toMatchObject({ ok: false });
      expect(p('1234567890')).toMatchObject({ ok: false });
      expect(p('123456789').ok).toBe(true);
      expect(p('('.repeat(EXPRESSION_LIMITS.maxDepth + 2) + 'x' + ')'.repeat(EXPRESSION_LIMITS.maxDepth + 2))).toMatchObject({ ok: false, error: 'too-complex' });
      expect(p('-'.repeat(EXPRESSION_LIMITS.maxDepth + 2) + 'x')).toMatchObject({ ok: false, error: 'too-complex' });
      expect(p('x'.repeat(EXPRESSION_LIMITS.maxChars))).toMatchObject({ ok: false, error: 'too-complex' });
      expect(parseExpression('x', 'X')).toMatchObject({ ok: false });
      expect(parseExpression('x', 'xy')).toMatchObject({ ok: false });
      expect(parseExpression(5, 'x')).toMatchObject({ ok: false });
      expect(parseExpression(null, 'x')).toMatchObject({ ok: false });
      expect(parseExpression({ toString: () => 'x' }, 'x')).toMatchObject({ ok: false });
    });

    it('answers null, not a guess, where a line has no defined value or grows too large', () => {
      expect(same('1/0', '1/0')).toBeNull();
      expect(same('x/0', 'x/0')).toBeNull();
      expect(same('(x-x)/(x-x)', '1/0')).toBeNull();
      expect(same('(x-x)/(x-x)', '1')).toBe(false);
      expect(same('(((x^6)^6)^6)^6', 'x')).toBeNull();
    });

    it('is deterministic: the sample points are fixed and distinct', () => {
      expect(SAMPLE_POINTS).toHaveLength(33);
      expect(new Set(SAMPLE_POINTS.map((point) => `${point.n}/${point.d}`)).size).toBe(33);
      const a = p('(x+2)(x+3)');
      const b = p('x^2+5x+6');
      if (!a.ok || !b.ok || a.kind !== 'expression' || b.kind !== 'expression') throw new Error('read');
      for (let i = 0; i < 5; i += 1) expect(sameExpression(a.expr, b.expr)).toBe(true);
    });

    it('reads polynomials and the finished forms', () => {
      const expanded = p('x^2+5x+6');
      const product = p('(x+2)(x+3)');
      const factored = p('(x+3)(x+4)');
      if (!expanded.ok || expanded.kind !== 'expression') throw new Error('read');
      expect(toPolynomial(expanded.expr)).toEqual([{ n: 6n, d: 1n }, { n: 5n, d: 1n }, { n: 1n, d: 1n }]);
      expect(satisfiesForm(expanded, 'expanded')).toBe(true);
      expect(satisfiesForm(product, 'expanded')).toBe(false);
      expect(satisfiesForm(factored, 'factored')).toBe(true);
      expect(satisfiesForm(expanded, 'factored')).toBe(false);
      expect(satisfiesForm(p('x=5'), 'isolated')).toBe(true);
      expect(satisfiesForm(p('5=x'), 'isolated')).toBe(true);
      expect(satisfiesForm(p('x=x+1'), 'isolated')).toBe(false);
      expect(satisfiesForm(p('3x=15'), 'isolated')).toBe(false);
      expect(satisfiesForm(p('3x=12'), 'separated')).toBe(true);
      expect(satisfiesForm(p('5x=2x+12'), 'separated')).toBe(false);
      expect(satisfiesForm(p('(x+1)^2'), 'factored')).toBe(true);
      expect(satisfiesForm(p('-x(x+3)'), 'factored')).toBe(true);
    });

    it('checks the task and the reference before anything is graded', () => {
      const task: ExpressionTask = { task: 'rewrite', given: '(x+2)(x+3)', form: 'expanded', variable: 'x' };
      expect(expressionTaskProblem(task)).toBeNull();
      expect(expressionTaskProblem({ ...task, form: 'isolated' })).not.toBeNull();
      expect(expressionTaskProblem({ ...task, given: 'x=5' })).not.toBeNull();
      expect(expressionTaskProblem({ ...task, given: 'x^2+5x+6' })).not.toBeNull();
      expect(expressionTaskProblem({ ...task, given: '(x+2' })).not.toBeNull();
      expect(expressionTaskProblem({ ...task, variable: 'xy' })).not.toBeNull();
      expect(expressionReferenceProblem(task, 'x^2+5x+6')).toBeNull();
      expect(expressionReferenceProblem(task, 'x^2+5x+7')).not.toBeNull();
      expect(expressionReferenceProblem(task, '(x+2)(x+3)')).not.toBeNull();
      expect(expressionReferenceProblem(task, 5)).not.toBeNull();
      expect(expressionReferenceProblem({ task: 'solve', given: '3x+5=20', form: 'isolated', variable: 'x' }, 'x=6')).not.toBeNull();
    });

    it('analyses each line against the one above it', () => {
      const task: ExpressionTask = { task: 'solve', given: '3x+5=20', form: 'isolated', variable: 'x' };
      const sound = analyseLines(task, ['3x+5=20', '3x=15', 'x=5'])!;
      expect(sound).toMatchObject({ wellFormed: true, chainSound: true });
      const broken = analyseLines(task, ['3x=15', 'x=6'])!;
      expect(broken).toMatchObject({ wellFormed: true, chainSound: false });
      expect(broken.lines[1]).toMatchObject({ error: null, same: false });
      expect(analyseLines(task, ['3x+5'])!.lines[0]).toMatchObject({ error: 'kind' });
      expect(analyseLines(task, [])).toBeNull();
      expect(analyseLines(task, Array.from({ length: EXPRESSION_LIMITS.maxLines + 1 }, () => 'x=5'))).toBeNull();
      expect(analyseLines({ ...task, given: '' }, ['x=5'])).toBeNull();
    });

    it('writes notation only from the parsed tree', () => {
      const words = { plus: 'plus', minus: 'minus', times: 'times', over: 'over', power: 'to the power', equals: 'equals', open: 'open', close: 'close', negative: 'negative' };
      const parsed = p('(x+2)(x+3)=x^2+5x+6');
      expect(toLatex(parsed, 'x')).toBe('(x+2)(x+3)=x^{2}+5x+6');
      expect(toSpoken(parsed, 'x', words)).toContain('equals');
      expect(toLatex(p('x/2'), 'x')).toBe('\\frac{x}{2}');
      expect(toLatex(p('\\frac{1}{2}'), 'x')).toBe('');
      expect(toLatex({ ok: false, error: 'empty', at: 0 }, 'x')).toBe('');
      for (const text of ['x', '-x', '2x', '2(x+1)', 'x^2', '-(x+1)', '1.5x', 'x-(x-1)', '2*3', '(x+1)/(x-1)']) {
        const tex = toLatex(p(text), 'x');
        expect(tex, text).toMatch(/^[0-9a-z+\-=^{}().\\ ]*$/);
        expect(tex).not.toContain('\\text');
      }
    });
  });

  describe('F2.6 grading', () => {
    const entry = fixture('expression-expand-product');
    const segment = segmentOf('expression-expand-product');

    it('grades the ladder', () => {
      expect(EDITOR(segment, entry.ladder.met, entry.rubric)).toEqual({ verdict: 'met', diagnostic: 'none' });
      expect(EDITOR(segment, entry.ladder.valid, entry.rubric)).toEqual({ verdict: 'valid', diagnostic: 'none' });
      expect(EDITOR(segment, entry.ladder.invalid, entry.rubric).verdict).toBe('invalid');
    });

    it('reports an unfinished chain as partial and a broken line as value or structure', () => {
      expect(EDITOR(segment, { steps: ['(x+2)(x+3)', 'x(x+3)+2(x+3)'] }, entry.rubric)).toEqual({ verdict: 'review', diagnostic: 'partial' });
      expect(EDITOR(segment, { steps: ['(x+2)(x+3)', 'x^2+5x+7'] }, entry.rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
      expect(EDITOR(segment, { steps: ['x^2+5x+7', 'x^2+5x+6'] }, entry.rubric)).toEqual({ verdict: 'review', diagnostic: 'structure' });
      expect(EDITOR(segment, { steps: ['x^2+5x+6'] }, entry.rubric).verdict).toBe('met');
    });

    it('accepts any equivalent route to the finished form', () => {
      expect(EDITOR(segment, { steps: ['(x+2)(x+3)', '6+5x+x^2'] }, entry.rubric).verdict).toBe('met');
      expect(EDITOR(segment, { steps: ['(x+2)(x+3)', 'x^2+2x+3x+6', '6+5x+x^2'] }, entry.rubric).verdict).toBe('met');
      expect(EDITOR(segment, { steps: ['x^2+2x+3x+6'] }, entry.rubric)).toEqual({ verdict: 'review', diagnostic: 'partial' });
      expect(EDITOR(segment, { steps: ['(x+2)(x+3)', '6+5x+x*x'] }, entry.rubric)).toEqual({ verdict: 'review', diagnostic: 'partial' });
    });

    it('does not take a finished-looking but unexpanded line for the expansion', () => {
      expect(EDITOR(segment, { steps: ['(x+2)(x+3)', '(x+3)(x+2)'] }, entry.rubric)).toEqual({ verdict: 'review', diagnostic: 'partial' });
    });

    it('grades solving, gathering and factoring', () => {
      for (const id of ['expression-factor-trinomial', 'expression-solve-isolate', 'expression-solve-separate']) {
        const solved = fixture(id);
        expect(EDITOR(solved.segment('en-US'), solved.ladder.met, solved.rubric).verdict, id).toBe('met');
        expect(EDITOR(solved.segment('en-US'), solved.ladder.valid, solved.rubric).verdict, id).toBe('valid');
        expect(EDITOR(solved.segment('en-US'), solved.ladder.invalid, solved.rubric).verdict, id).toBe('invalid');
      }
      const solve = fixture('expression-solve-isolate');
      expect(EDITOR(solve.segment('en-US'), { steps: ['3x+5=20', 'x=6'] }, solve.rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
      expect(EDITOR(solve.segment('en-US'), { steps: ['3x+5=20', '3x=15'] }, solve.rubric)).toEqual({ verdict: 'review', diagnostic: 'partial' });
      expect(EDITOR(solve.segment('en-US'), { steps: ['3x+5=20', 'x+5/3=20/3'] }, solve.rubric)).toEqual({ verdict: 'review', diagnostic: 'partial' });
    });

    it('refuses malformed responses', () => {
      const bad = (response: unknown) => EDITOR(segment, response, entry.rubric).verdict;
      expect(bad({ steps: [] })).toBe('invalid');
      expect(bad({ steps: 'x' })).toBe('invalid');
      expect(bad({ steps: [5] })).toBe('invalid');
      expect(bad({ steps: ['x^2+5x+6'], extra: 1 })).toBe('invalid');
      expect(bad({ steps: ['x^2+5x+6=0'] })).toBe('invalid');
      expect(bad({ steps: Array.from({ length: EXPRESSION_LIMITS.maxLines + 1 }, () => 'x^2+5x+6') })).toBe('invalid');
      expect(bad({ steps: ['x'.repeat(65)] })).toBe('invalid');
      expect(bad({ steps: ['constructor'] })).toBe('invalid');
      expect(bad({ steps: ['eval(1)'] })).toBe('invalid');
      expect(bad('x^2+5x+6')).toBe('invalid');
      expect(bad(null)).toBe('invalid');
    });

    it('refuses a malformed key', () => {
      const met = entry.ladder.met;
      expect(EDITOR(segment, met, { reference: 'x^2+5x+7' }).verdict).toBe('invalid');
      expect(EDITOR(segment, met, { reference: '(x+2)(x+3)' }).verdict).toBe('invalid');
      expect(EDITOR(segment, met, { reference: 'x^2+5x+6', extra: 1 }).verdict).toBe('invalid');
      expect(EDITOR(segment, met, { reference: 5 }).verdict).toBe('invalid');
      expect(EDITOR(segment, met, { reference: 'x^2+5x+6=0' }).verdict).toBe('invalid');
      expect(EDITOR(segment, met, {}).verdict).toBe('invalid');
      expect(EDITOR(segment, met, null).verdict).toBe('invalid');
    });

    it('refuses a payload that does not read', () => {
      const bad = (patch: Record<string, unknown>) => EDITOR(withPayload('expression-expand-product', patch), entry.ladder.met, entry.rubric).verdict;
      expect(bad({ form: 'isolated' })).toBe('invalid');
      expect(bad({ given: '(x+2' })).toBe('invalid');
      expect(bad({ task: 'solve' })).toBe('invalid');
      expect(bad({ extra: 1 })).toBe('invalid');
      expect(bad({ variable: 'y' })).toBe('invalid');
    });

    it('never says met in the browser, which holds no rubric', () => {
      expect(EDITOR(segment, entry.ladder.met, undefined)).toEqual({ verdict: 'valid', diagnostic: 'none' });
      expect(EDITOR(segment, { steps: ['(x+2'] }, undefined).verdict).toBe('invalid');
    });
  });

  it('is open to the stated ages, and the expression editor to adults too', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope('math.function-graph.v2', '10-12', 12, 12)).toBeNull();
    expect(scope('math.function-graph.v2', '10-12', 10, 12)).not.toBeNull();
    expect(scope('math.function-graph.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('math.function-graph.v2', 'adult', 18, 99)).not.toBeNull();
    expect(scope('math.line-system.v2', '10-12', 12, 12)).not.toBeNull();
    expect(scope('math.line-system.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('math.line-system.v2', 'adult', 18, 99)).not.toBeNull();
    expect(scope('math.expression-editor.v2', '13-17', 13, 17)).toBeNull();
    expect(scope('math.expression-editor.v2', '6-9', 6, 9)).not.toBeNull();
    expect(scope('math.expression-editor.v2', 'adult', 18, 99)).toBeNull();
  });

  it('plugs into Core: public schema in three locales, answer key and the server grade', () => {
    for (const entry of ALG2_FIXTURES) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry, locale)).success, `${entry.id} ${locale}`).toBe(true);
    for (const entry of ALG2_FIXTURES) {
      const document = lesson(entry);
      const id = (entry.segment('en-US') as { id: string }).id;
      const keys = { [id]: entry.rubric };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.valid), entry.id).toBeNull();
      expect(horizonteSampleVerdict(entry.segment('en-US') as { type: string }, entry.rubric), entry.id).toBe('valid');
    }
    const line = lesson(fixture('graph-line-two-dots'));
    const lineId = (line.segments[0] as { id: string }).id;
    const parsed = v2PublicLessonSchema.parse(line);
    expect(gradeV2Visual(parsed, { [lineId]: fixture('graph-line-two-dots').rubric }, lineId, { family: 'line', params: { m: '2', b: '-2' } })).toMatchObject({ score: 0, correct: false });
    expect(horizonteGrade(line.segments[0] as { type: string }, { family: 'line', params: { m: '2', b: '-3' } }, fixture('graph-line-two-dots').rubric)).toMatchObject({ score: 100, correct: true });
    expect(horizonteGrade({ type: 'math.function-graph.v2' }, { family: 'line', params: { m: '2', b: '-3' } }, fixture('graph-line-two-dots').rubric)).toBeNull();
    expect(validateV2LessonForGrading(line, { [lineId]: { family: 'line', target: { m: '1', b: '0' } } }, { lessonId: line.lesson_id, locale: line.locale })).toBeNull();
  });

  it('refuses a payload that leaks the answer, a wrong visual and an out-of-scope document', () => {
    const base = lesson(fixture('graph-line-two-dots'));
    const segment = base.segments[0] as Record<string, unknown> & { payload: Record<string, unknown> };
    const parse = (patch: Record<string, unknown>) => v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, ...patch }] }).success;
    expect(parse({})).toBe(true);
    expect(parse({ visual: { type: 'line-system' } })).toBe(false);
    expect(parse({ payload: { ...segment.payload, target: { m: '2', b: '-3' } } })).toBe(false);
    expect(parse({ payload: { ...segment.payload, family: 'line' } })).toBe(false);
    expect(parse({ payload: { ...segment.payload, marks: [{ x: 0, y: 1 }] } })).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 } }).success).toBe(false);
    const editor = lesson(fixture('expression-expand-product'));
    const editorSegment = editor.segments[0] as Record<string, unknown> & { payload: Record<string, unknown> };
    const editorParse = (payload: Record<string, unknown>) => v2PublicLessonSchema.safeParse({ ...editor, segments: [{ ...editorSegment, payload }] }).success;
    expect(editorParse(editorSegment.payload)).toBe(true);
    expect(editorParse({ ...editorSegment.payload, reference: 'x^2+5x+6' })).toBe(false);
    expect(editorParse({ ...editorSegment.payload, given: 'x'.repeat(65) })).toBe(false);
    expect(editorParse({ ...editorSegment.payload, given: '(x+2' })).toBe(false);
    const system = lesson(fixture('system-cross-two-lines'));
    const systemSegment = system.segments[0] as Record<string, unknown> & { payload: Record<string, unknown> };
    expect(v2PublicLessonSchema.safeParse({ ...system, segments: [{ ...systemSegment, payload: { ...systemSegment.payload, required: [{ x: 3, y: 2 }] } }] }).success).toBe(false);
  });
});
