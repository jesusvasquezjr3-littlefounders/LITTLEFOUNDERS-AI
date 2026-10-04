import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { ALG2_CAPABILITIES, alg2 } from '../../v2/horizonte/alg2.js';
import { analyseLines, parseExpression, sameParsed } from '../../v2/horizonte/alg2Expression.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';

const GRAPH = 'math.function-graph.v2';
const SYSTEM = 'math.line-system.v2';
const EXPRESSION = 'math.expression-editor.v2';

type Doc = { segments: Array<Record<string, unknown>> };
const doc = (type: string, visual: string, prompt: string, payload: unknown, id = 'seg-alg2'): Doc => ({ segments: [{ id, type, visual: { type: visual }, prompt, payload }] });
const gate = (document: Doc, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-alg2': key });
const messages = (document: Doc, key?: unknown) => gate(document, key).map((problem) => problem.message);
const withPayload = (document: Doc, patch: Record<string, unknown>): Doc => ({ segments: [{ ...document.segments[0]!, payload: { ...(document.segments[0]!.payload as object), ...patch } }] });
const withPrompt = (document: Doc, prompt: string): Doc => ({ segments: [{ ...document.segments[0]!, prompt }] });

const slider = (min: string, max: string, step: string) => ({ min, max, step });

const line = doc(GRAPH, 'function-graph', 'Slide m and b until the line goes through both dots.', {
  curve: 'line', start: { m: '1', b: '0' }, sliders: { m: slider('-5', '5', '1'), b: slider('-6', '6', '1') },
  window: { xMin: -6, xMax: 6, yMin: -8, yMax: 8 }, marks: [{ x: 0, y: -3 }, { x: 2, y: 1 }],
});
const vertex = doc(GRAPH, 'function-graph', 'Set the vertex and the opening so the curve goes through the three dots.', {
  curve: 'quadratic', form: 'vertex', start: { a: '1', h: '0', k: '0' },
  sliders: { a: slider('1', '4', '1'), h: slider('-3', '4', '1'), k: slider('-6', '6', '1') },
  window: { xMin: -4, xMax: 6, yMin: -5, yMax: 10 }, marks: [{ x: 1, y: -3 }, { x: 3, y: 5 }, { x: -1, y: 5 }],
});
const standard = doc(GRAPH, 'function-graph', 'Match the three dots with a, b and c.', {
  curve: 'quadratic', start: { a: '2', b: '0', c: '0' },
  sliders: { a: slider('-2', '2', '1'), b: slider('-6', '6', '1'), c: slider('-6', '6', '1') },
  window: { xMin: -4, xMax: 6, yMin: -6, yMax: 6 }, marks: [{ x: -1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: -3 }],
});
const growth = doc(GRAPH, 'function-graph', 'Slide a and the base until the curve goes through both dots.', {
  curve: 'exponential', start: { a: '2', b: '1.5' }, sliders: { a: slider('1', '4', '1'), b: slider('0.5', '3', '0.5') },
  window: { xMin: -3, xMax: 5, yMin: -2, yMax: 20 }, marks: [{ x: 0, y: 1 }, { x: 3, y: 8 }],
});
const bare = doc(GRAPH, 'function-graph', 'Set the line to y = 2x - 3.', {
  curve: 'line', start: { m: '1', b: '0' }, sliders: { m: slider('-5', '5', '1'), b: slider('-6', '6', '1') }, window: { xMin: -6, xMax: 6, yMin: -8, yMax: 8 },
});
const half = doc(GRAPH, 'function-graph', 'Raise the line to y = 0.5x + 1.', {
  curve: 'line', start: { m: '0', b: '0' }, sliders: { m: slider('-2', '2', '0.5'), b: slider('-3', '3', '1') }, window: { xMin: -6, xMax: 6, yMin: -8, yMax: 8 },
});

const cross = doc(SYSTEM, 'line-system', 'Move the marker to the point where the two lines cross.', {
  lines: [{ a: 1, b: 1, c: 5 }, { a: 1, b: -1, c: 1 }], window: { xMin: -2, xMax: 8, yMin: -2, yMax: 8 }, grid: 1, start: [{ x: 0, y: 0 }],
});
const halfGrid = doc(SYSTEM, 'line-system', 'The lines cross between whole numbers. Move the marker onto the crossing.', {
  lines: [{ a: 1, b: 1, c: 2 }, { a: 1, b: -1, c: 1 }], window: { xMin: -2, xMax: 5, yMin: -2, yMax: 5 }, grid: 0.5, start: [{ x: 0, y: 0 }],
});
const triangle = doc(SYSTEM, 'line-system', 'Three lines make a triangle. Move a marker onto each corner.', {
  lines: [{ a: 1, b: 1, c: 6 }, { a: 1, b: -1, c: 0 }, { a: 0, b: 1, c: 1 }], window: { xMin: -1, xMax: 7, yMin: -1, yMax: 7 }, grid: 1,
  start: [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }],
});

const expand = doc(EXPRESSION, 'expression-editor', 'Expand the product. Write each step on its own line.', { task: 'rewrite', given: '(x+2)(x+3)', form: 'expanded', variable: 'x' });
const factor = doc(EXPRESSION, 'expression-editor', 'Factor the expression. Write each step on its own line.', { task: 'rewrite', given: 'x^2+7x+12', form: 'factored', variable: 'x' });
const isolate = doc(EXPRESSION, 'expression-editor', 'Solve for x. Write each step on its own line.', { task: 'solve', given: '3x+5=20', form: 'isolated', variable: 'x' });
const separate = doc(EXPRESSION, 'expression-editor', 'Gather the x terms on one side. Write each step on its own line.', { task: 'solve', given: '5x-4=2x+8', form: 'separated', variable: 'x' });

const decimals = doc(EXPRESSION, 'expression-editor', 'Expand the product. Write each step on its own line.', { task: 'rewrite', given: '(x+0.5)(x+2)', form: 'expanded', variable: 'x' });

const root = (name: string) => fileURLToPath(new URL(`../../../../backend/src/services/horizonte/alg2/${name}`, import.meta.url));
const lf = (text: string) => text.replace(/\r\n/g, '\n');

describe('alg2 pack in the Forge (F2.4, F2.5, F2.6)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    for (const type of Object.keys(ALG2_CAPABILITIES) as Array<keyof typeof ALG2_CAPABILITIES>) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(ALG2_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(ALG2_CAPABILITIES[type]);
    }
    expect(ALG2_CAPABILITIES[GRAPH]).toEqual(['visual.function-graph.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1']);
    expect(ALG2_CAPABILITIES[SYSTEM]).toEqual(['visual.line-system.v1', 'operation.drag-point.v1', 'operation.move-menu.v1', 'operation.show-table.v1']);
    expect(ALG2_CAPABILITIES[EXPRESSION]).toEqual(['visual.expression-editor.v1', 'operation.type-expression.v1', 'operation.step-check.v1']);
    expect(Object.keys(ALG2_CAPABILITIES)).toHaveLength(3);
    expect(HORIZONTE_FORGE_PACKS).toContain(alg2);
  });

  it('adds authoring guidance only for the types a skeleton uses, with the age scopes and the prompt rules', () => {
    expect(horizonteGuidanceFor([GRAPH]).join('\n')).toMatch(/ages 12-17 only.*skips zero.*never writes the target values/s);
    expect(horizonteGuidanceFor([SYSTEM]).join('\n')).toMatch(/ages 13-17 only.*one marker for each crossing.*never writes a crossing/s);
    expect(horizonteGuidanceFor([EXPRESSION]).join('\n')).toMatch(/ages 13-17 and adults.*not already have the finished form.*never writes the reference/s);
    expect(horizonteGuidanceFor([GRAPH]).join('\n')).not.toMatch(new RegExp(SYSTEM.replace('.', '\\.')));
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('accepts every authored example with its key and without one', () => {
    const keyed: Array<[Doc, unknown]> = [
      [line, { family: 'line', target: { m: '2', b: '-3' } }],
      [vertex, { family: 'quadratic', target: { a: '2', b: '-4', c: '-1' } }],
      [standard, { family: 'quadratic', target: { a: '1', b: '-2', c: '-3' } }],
      [growth, { family: 'exponential', target: { a: '1', b: '2' } }],
      [bare, { family: 'line', target: { m: '2', b: '-3' } }],
      [half, { family: 'line', target: { m: '0.5', b: '1' } }],
      [cross, { required: [{ x: 3, y: 2 }] }],
      [halfGrid, { required: [{ x: 1.5, y: 0.5 }] }],
      [triangle, { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }] }],
      [expand, { reference: 'x^2+5x+6' }],
      [factor, { reference: '(x+3)(x+4)' }],
      [isolate, { reference: 'x=5' }],
      [separate, { reference: '3x=12' }],
    ];
    for (const [document, key] of keyed) {
      expect(messages(document, key)).toEqual([]);
      expect(messages(document)).toEqual([]);
    }
  });

  it('accepts a key for the vertex form given in the learner\'s terms, and a crossing key in any order', () => {
    expect(messages(triangle, { required: [{ x: 1, y: 1 }, { x: 3, y: 3 }, { x: 5, y: 1 }] })).toEqual([]);
    expect(messages(expand, { reference: '  x^2 + 5x + 6 ' })).toEqual([]);
    expect(messages(expand, { reference: '5x+x^2+6' })).toEqual([]);
  });

  it('ignores documents of other types, keys for other segments and inherited keys', () => {
    const other = doc('money.allocation.v2', 'allocation', 'Share the money.', { nope: true });
    expect(horizontePieceGates(other, { 'seg-alg2': { whatever: 1 } }).filter((problem) => problem.message.includes('alg2'))).toEqual([]);
    expect(horizontePieceGates(cross, { 'seg-other': { required: [] } })).toEqual([]);
    const inherited = doc(SYSTEM, 'line-system', 'Move the marker to the point where the two lines cross.', (cross.segments[0]!.payload), 'constructor');
    expect(horizontePieceGates(inherited, {})).toEqual([]);
  });

  it('rejects a wrong visual, a missing payload and an unplayable payload', () => {
    expect(messages(doc(GRAPH, 'line-system', 'x', line.segments[0]!.payload))).toContain(`The ${GRAPH} visual must be function-graph`);
    expect(messages(doc(SYSTEM, 'function-graph', 'x', cross.segments[0]!.payload))).toContain(`The ${SYSTEM} visual must be line-system`);
    expect(messages(doc(EXPRESSION, 'line-system', 'x', expand.segments[0]!.payload))).toContain(`The ${EXPRESSION} visual must be expression-editor`);
    expect(messages(doc(GRAPH, 'function-graph', 'x', null))).toEqual(['The payload is missing']);
    expect(messages(doc(SYSTEM, 'line-system', 'x', 'nope'))).toEqual(['The payload is missing']);
    expect(gate(doc(EXPRESSION, 'expression-editor', 'x', undefined))[0]).toMatchObject({ gate: 4, segmentId: 'seg-alg2' });
  });

  it('rejects a graph payload that cannot be played', () => {
    expect(messages(withPayload(line, { marks: [{ x: 0, y: -3 }] }))[0]).toMatch(/at least 2/);
    expect(messages(withPayload(vertex, { marks: [{ x: 1, y: -3 }, { x: 3, y: 5 }] }))[0]).toMatch(/at least 3/);
    expect(messages(withPayload(line, { marks: [{ x: 1, y: -3 }, { x: 1, y: 1 }] }))[0]).toMatch(/different x/);
    expect(messages(withPayload(vertex, { sliders: { a: slider('-1', '3', '1'), h: slider('-3', '4', '1'), k: slider('-6', '6', '1') } }))[0]).toMatch(/skips zero/);
    expect(messages(withPayload(growth, { sliders: { a: slider('1', '4', '1'), b: slider('0', '3', '0.5') } }))[0]).toMatch(/above zero/);
    expect(messages(withPayload(line, { start: { m: '1', b: '9' } }))[0]).toMatch(/b start must sit on its slider/);
    expect(messages(withPayload(line, { sliders: { m: slider('-5', '5', '0.001'), b: slider('-6', '6', '1') } }))[0]).toMatch(/m slider/);
    expect(messages(withPayload(line, { curve: 'cubic' }))[0]).toMatch(/line, quadratic or exponential/);
  });

  it('rejects a graph key that is not one curve of the payload', () => {
    expect(messages(line, null)[0]).toMatch(/family and a target/);
    expect(messages(line, { family: 'line', target: { m: '2', b: '-3' }, by: 'curve' })[0]).toMatch(/no tolerance/);
    expect(messages(line, { family: 'quadratic', target: { a: '1', b: '0', c: '0' } })[0]).toMatch(/family must be line/);
    expect(messages(line, { family: 'line', target: { m: '2' } })[0]).toMatch(/exactly m, b/);
    expect(messages(line, { family: 'line', target: { m: 'two', b: '-3' } })[0]).toMatch(/exactly m, b/);
    expect(messages(line, { family: 'line', target: { m: '2', b: '-9' } })[0]).toMatch(/sit on the sliders/);
    expect(messages(line, { family: 'line', target: { m: '2', b: '-3.5' } })[0]).toMatch(/sit on the sliders/);
    expect(messages(line, { family: 'line', target: { m: '2', b: '-2' } })[0]).toMatch(/mark must lie exactly/);
    expect(messages(line, { family: 'line', target: { m: '1', b: '0' } })[0]).toMatch(/mark must lie exactly/);
    expect(messages(standard, { family: 'quadratic', target: { a: '2', b: '0', c: '0' } })[0]).toMatch(/mark must lie exactly/);
    expect(messages(growth, { family: 'exponential', target: { a: '1', b: '1' } })[0]).toMatch(/not 1|mark must lie/);
  });

  it('rejects a graph that starts on its own answer and a zero a', () => {
    const atKey = withPayload(line, { start: { m: '2', b: '-3' } });
    expect(messages(atKey, { family: 'line', target: { m: '2', b: '-3' } })).toEqual(['The curve must start away from the answer']);
    const vertexAtKey = withPayload(vertex, { start: { a: '2', h: '1', k: '-3' } });
    expect(messages(vertexAtKey, { family: 'quadratic', target: { a: '2', b: '-4', c: '-1' } })).toEqual(['The curve must start away from the answer']);
    const flat = withPayload(standard, { sliders: { a: slider('-2', '2', '1'), b: slider('-6', '6', '1'), c: slider('-6', '6', '1') }, marks: [] });
    expect(messages(flat, { family: 'quadratic', target: { a: '0', b: '1', c: '1' } })[0]).toMatch(/a must not be zero/);
  });

  it('asks for the numbers in the prompt when a graph has no marks', () => {
    expect(messages(withPrompt(bare, 'Set the line.'), { family: 'line', target: { m: '2', b: '-3' } })).toEqual(['With no marks the prompt must write m, b in digits']);
    expect(messages(withPrompt(bare, 'Set the slope to 2.'), { family: 'line', target: { m: '2', b: '-3' } })).toEqual(['With no marks the prompt must write b in digits']);
    expect(messages(withPrompt(half, 'Raise the line to y = 0,5x + 1.'), { family: 'line', target: { m: '0.5', b: '1' } })).toEqual([]);
    expect(messages(withPrompt(half, 'Raise the line to y = 5x + 1.'), { family: 'line', target: { m: '0.5', b: '1' } })).toEqual(['With no marks the prompt must write m in digits']);
    expect(messages(withPrompt(bare, 'Set the slope to 2 and the intercept to 0.'), { family: 'line', target: { m: '2', b: '0' } })).toEqual([]);
    expect(messages(withPrompt(bare, 'Set the line.'))).toEqual([]);
  });

  it('rejects a system payload that cannot be played', () => {
    expect(messages(withPayload(halfGrid, { grid: 1 }))[0]).toMatch(/crossing lies in the window, on the grid/);
    expect(messages(withPayload(cross, { start: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }))[0]).toMatch(/one marker for each crossing/);
    expect(messages(withPayload(cross, { lines: [{ a: 1, b: 1, c: 5 }, { a: 2, b: 2, c: 10 }] }))[0]).toMatch(/must differ/);
    expect(messages(withPayload(cross, { grid: 3 }))[0]).toMatch(/grid is 0.5, 1 or 2/);
    expect(messages(withPayload(cross, { window: { xMin: -2, xMax: 8, yMin: -2, yMax: 7.5 } }))[0]).toMatch(/whole numbers/);
    expect(messages(withPayload(cross, { start: [{ x: 99, y: 0 }] }))[0]).toMatch(/inside the window/);
  });

  it('rejects a system key that is not exactly the crossings, away from the start', () => {
    expect(messages(cross, { required: [{ x: 3, y: 2 }], extra: 1 })[0]).toMatch(/list of required crossings/);
    expect(messages(cross, { required: [{ x: 3 }] })[0]).toMatch(/list of required crossings/);
    expect(messages(cross, { required: 'x' })[0]).toMatch(/list of required crossings/);
    expect(messages(cross, { required: [{ x: 3, y: 2 }, { x: 5, y: 1 }] })[0]).toMatch(/one crossing for each marker/);
    expect(messages(cross, { required: [{ x: 3, y: 3 }] })[0]).toMatch(/must be a crossing/);
    expect(messages(triangle, { required: [{ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 1, y: 1 }] })[0]).toMatch(/different points/);
    expect(messages(triangle, { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 2, y: 2 }] })[0]).toMatch(/must be a crossing/);
    const onIt = withPayload(cross, { start: [{ x: 3, y: 2 }] });
    expect(messages(onIt, { required: [{ x: 3, y: 2 }] })).toEqual(['The markers must start away from the crossings']);
    const shuffled = withPayload(triangle, { start: [{ x: 5, y: 1 }, { x: 1, y: 1 }, { x: 3, y: 3 }] });
    expect(messages(shuffled, { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }] })).toEqual(['The markers must start away from the crossings']);
  });

  it('rejects an expression task that cannot be played', () => {
    expect(messages(withPayload(expand, { given: 'x^2+5x+6' }))).toEqual(['The given already has the finished form']);
    expect(messages(withPayload(isolate, { given: 'x=5' }))).toEqual(['The given already has the finished form']);
    expect(messages(withPayload(expand, { given: '(x+2)(x+3' }))[0]).toMatch(/does not parse/);
    expect(messages(withPayload(expand, { given: 'x+1=2' }))[0]).toMatch(/starts from an expression/);
    expect(messages(withPayload(isolate, { given: '3x+5' }))[0]).toMatch(/starts from an equation/);
    expect(messages(withPayload(expand, { form: 'isolated' }))[0]).toMatch(/form that fits the task/);
    expect(messages(withPayload(expand, { variable: 'X' }))[0]).toMatch(/lowercase variable letter/);
    expect(messages(withPayload(expand, { variable: 'xy' }))[0]).toMatch(/lowercase variable letter/);
    expect(messages(withPayload(expand, { extra: true }))[0]).toMatch(/lowercase variable letter/);
    expect(messages(withPayload(expand, { given: `(x+1)^9+${'1+'.repeat(40)}1` }))[0]).toMatch(/does not parse/);
    expect(messages(withPayload(expand, { given: '(x+2)(y+3)' }))[0]).toMatch(/does not parse/);
  });

  it('rejects an expression key that is not the finished form of the given', () => {
    expect(messages(expand, { reference: 'x^2+5x+7' })[0]).toMatch(/not equivalent/);
    expect(messages(expand, { reference: '(x+2)(x+3)' })[0]).toMatch(/does not have the finished form/);
    expect(messages(expand, { reference: 'x^2+5x+6=0' })[0]).toMatch(/not the same kind/);
    expect(messages(expand, { reference: 'x^2+5x+' })[0]).toMatch(/does not parse/);
    expect(messages(expand, { reference: 42 })[0]).toMatch(/does not parse/);
    expect(messages(expand, { reference: 'x^2+5x+6', note: 'x' })[0]).toMatch(/reference and nothing else/);
    expect(messages(expand, null)[0]).toMatch(/reference and nothing else/);
    expect(messages(factor, { reference: '(x+3)(x+5)' })[0]).toMatch(/not equivalent/);
    expect(messages(factor, { reference: 'x^2+7x+12' })[0]).toMatch(/does not have the finished form/);
    expect(messages(isolate, { reference: 'x=4' })[0]).toMatch(/not equivalent/);
    expect(messages(isolate, { reference: '3x=15' })[0]).toMatch(/does not have the finished form/);
    expect(messages(separate, { reference: '3x=13' })[0]).toMatch(/not equivalent/);
  });

  it('keeps the reference answer out of the prompt', () => {
    expect(messages(withPrompt(expand, 'Expand it to x^2 + 5x + 6, one step at a time.'), { reference: 'x^2+5x+6' })).toEqual(['The prompt must not write the reference answer']);
    expect(messages(withPrompt(isolate, 'Show that x=5.'), { reference: 'x=5' })).toEqual(['The prompt must not write the reference answer']);
    expect(messages(withPrompt(isolate, 'Solve for x.'), { reference: 'x=5' })).toEqual([]);
    expect(messages(withPrompt(expand, 'Expand it to x^2+5x+6.'))).toEqual([]);
  });

  it('reads a decimal comma like a point in a key, a given and the prompt, and refuses a comma between numbers', () => {
    expect(messages(decimals, { reference: 'x^2+2.5x+1' })).toEqual([]);
    expect(messages(decimals, { reference: 'x^2+2,5x+1' })).toEqual([]);
    expect(messages(withPayload(decimals, { given: '(x+0,5)(x+2)' }), { reference: 'x^2+2.5x+1' })).toEqual([]);
    expect(messages(decimals, { reference: 'x^2+2,5x+2' })[0]).toMatch(/not equivalent/);
    expect(messages(decimals, { reference: 'x^2+2,5,1x' })[0]).toMatch(/does not parse/);
    expect(messages(decimals, { reference: 'x^2+2,5.1x' })[0]).toMatch(/does not parse/);
    expect(messages(withPayload(decimals, { given: '(x+0,5,1)(x+2)' }))[0]).toBeTruthy();
  });

  it('finds the reference in the prompt whichever decimal mark either side uses', () => {
    const leak = ['The prompt must not write the reference answer'];
    expect(messages(withPrompt(decimals, 'Expand it to x^2+2,5x+1.'), { reference: 'x^2+2.5x+1' })).toEqual(leak);
    expect(messages(withPrompt(decimals, 'Expand it to x^2+2.5x+1.'), { reference: 'x^2+2,5x+1' })).toEqual(leak);
    expect(messages(withPrompt(decimals, 'Expand it, then check 2,5 against 2.5.'), { reference: 'x^2+2.5x+1' })).toEqual([]);
  });

  it('copies the Core model and expression engine byte for byte', () => {
    const copies: Array<[string, string]> = [['alg2Model.ts', 'model.ts'], ['alg2Expression.ts', 'expression.ts']];
    for (const [copy, original] of copies) {
      const forge = readFileSync(fileURLToPath(new URL(`../../v2/horizonte/${copy}`, import.meta.url)), 'utf8');
      expect(lf(forge)).toBe(lf(readFileSync(root(original), 'utf8')));
    }
  });

  it('reads and compares lines with the same engine Core grades with', () => {
    const task = { task: 'rewrite', given: '(x+2)(x+3)', form: 'expanded', variable: 'x' } as const;
    const report = analyseLines(task, ['x(x+3)+2(x+3)', 'x^2+5x+6', 'x^2+5x+7']);
    expect(report?.lines.map((entry) => entry.same)).toEqual([true, true, false]);
    expect(report?.chainSound).toBe(false);
    expect(sameParsed(parseExpression('2(x+1)', 'x'), parseExpression('2x+2', 'x'))).toBe(true);
    expect(sameParsed(parseExpression('x/x', 'x'), parseExpression('1', 'x'))).toBe(false); // undefined at 0, so not the same function
    expect(sameParsed(parseExpression('3x+5=20', 'x'), parseExpression('6x+10=40', 'x'))).toBe(true);
    expect(sameParsed(parseExpression('3x+5=20', 'x'), parseExpression('x=4', 'x'))).toBe(false);
    expect(parseExpression('x^7', 'x')).toMatchObject({ ok: false, error: 'bad-exponent' });
    expect(parseExpression('1'.repeat(65), 'x')).toMatchObject({ ok: false, error: 'too-long' });
    expect(parseExpression('1234567890', 'x')).toMatchObject({ ok: false });
  });
});
