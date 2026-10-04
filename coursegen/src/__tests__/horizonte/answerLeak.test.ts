import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_EMITTED_HORIZONTE } from '../../v2/cli.js';
import type { EmittedV2Document } from '../../v2/emit.js';
import type { V2DocumentLike } from '../../v2/gates.js';
import { HORIZONTE_FORGE_CAPABILITIES, horizontePieceGates } from '../../v2/horizonte/index.js';
import { answerLeakGates, answerParts, commaToPoint, GOAL_STATED, numeralsOf, withoutSpaces } from '../../v2/horizonte/answerLeak.js';

const rows = JSON.parse(readFileSync(FIXTURE_EMITTED_HORIZONTE, 'utf8')) as EmittedV2Document[];
const label = (row: EmittedV2Document) => `${row.lesson_id} (${row.locale})`;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const TYPES: ReadonlySet<string> = new Set(Object.keys(HORIZONTE_FORGE_CAPABILITIES));
const run = (document: V2DocumentLike, keys?: Record<string, unknown>) => answerLeakGates(document, keys, TYPES);

type Seg = Record<string, unknown> & { id: string; type: string; prompt?: string; help?: string[]; labels?: Record<string, string> };

/** One segment of one committed row, rewritten by `change`, with its key replaced when `key` is given. */
function scenario(type: string, segmentId: string, change: (segment: Seg) => void, key?: unknown, locale = 'en-US'): { document: V2DocumentLike; keys: Record<string, unknown>; segment: Seg } {
  const row = clone(rows.find((candidate) => candidate.locale === locale && candidate.document.segments.some((segment) => segment.id === segmentId && segment.type === type))!);
  const segment = row.document.segments.find((candidate) => candidate.id === segmentId)! as unknown as Seg;
  change(segment);
  if (key !== undefined) row.answer_keys[segmentId] = key;
  return { document: row.document as unknown as V2DocumentLike, keys: row.answer_keys, segment };
}

const leaks = (type: string, segmentId: string, change: (segment: Seg) => void, key?: unknown, locale?: string) => {
  const { document, keys } = scenario(type, segmentId, change, key, locale);
  return run(document, keys).filter((problem) => problem.segmentId === segmentId);
};

describe('the committed Horizonte rows', () => {
  it('write none of their keyed answers, in any market, with the gate run on its own and through the piece gates', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(run(row.document as unknown as V2DocumentLike, row.answer_keys), label(row)).toEqual([]);
      expect(horizontePieceGates(row.document as unknown as V2DocumentLike, row.answer_keys).filter((problem) => problem.gate === 8), label(row)).toEqual([]);
    }
  });

  it('reads nothing without the keys: the release-time call has no rubric to compare against', () => {
    for (const row of rows) expect(run(row.document as unknown as V2DocumentLike), label(row)).toEqual([]);
  });
});

describe('a prompt, help step or label that writes the keyed answer is caught as a clarity problem', () => {
  it('catches the rekenrek pair written in the prompt, and not a prompt that only describes the state', () => {
    const written = leaks('math.rekenrek.v2', 'rekenrek-seven', (segment) => { segment.prompt = 'Slide 5 beads on top and 2 below.'; });
    expect(written).toEqual([{ gate: 8, segmentId: 'rekenrek-seven', message: expect.stringContaining('prompt writes the keyed answer (target)') }]);
    expect(leaks('math.rekenrek.v2', 'rekenrek-seven', (segment) => { segment.prompt = 'Show seven with five on the top row.'; })).toEqual([]);
  });

  it('needs every number of a pair: one number of the target alone is not the answer', () => {
    expect(leaks('math.rekenrek.v2', 'rekenrek-seven', (segment) => { segment.prompt = 'Show seven with 5 beads on the top row.'; })).toEqual([]);
  });

  it('catches a number written in a help step or a label as well as in the prompt', () => {
    const inHelp = leaks('math.array-area.v2', 'array-rows-columns', (segment) => { segment.help = ['Count by rows.', 'It is 12 in all.']; });
    expect(inHelp.map((problem) => problem.message)).toEqual([expect.stringContaining('help[1] writes the keyed answer (value)')]);
    const inLabel = leaks('math.array-area.v2', 'array-rows-columns', (segment) => { segment.labels = { ...(segment.labels ?? {}), total: 'Total: 12' }; });
    expect(inLabel.map((problem) => problem.message)).toEqual([expect.stringContaining('labels.total writes the keyed answer (value)')]);
  });

  it('catches a keyed formula written with or without spaces and with a decimal comma', () => {
    const spaced = leaks('math.expression-editor.v2', 'expression-expand-product', (segment) => { segment.help = ['Aim for x^2 + 5x + 6.']; });
    expect(spaced).toEqual([{ gate: 8, segmentId: 'expression-expand-product', message: expect.stringContaining('help[0] writes the keyed answer (reference)') }]);
    const comma = leaks('math.expression-editor.v2', 'expression-expand-product', (segment) => { segment.help = ['Apunta a x²+x*0,5+1.']; }, { reference: 'x²+x*0.5+1' }, 'es-MX');
    expect(comma).toHaveLength(1);
    expect(leaks('math.expression-editor.v2', 'expression-expand-product', (segment) => { segment.help = ['Write each step on its own line.']; })).toEqual([]);
  });

  it('leaves the reference in the prompt to the pack that owns it, and reports it once through the piece gates', () => {
    const { document, keys } = scenario('math.expression-editor.v2', 'expression-expand-product', (segment) => { segment.prompt = 'Expand it to x^2 + 5x + 6.'; });
    expect(run(document, keys)).toEqual([]);
    expect(horizontePieceGates(document, keys).map((problem) => problem.message)).toEqual(['The prompt must not write the reference answer']);
  });

  it('does not read a word the text only offers among others, and reads one it says', () => {
    const key = { target: { direction: 'up', price: 12 } };
    const offeredBoth = (segment: Seg) => { segment.prompt = 'Demand adds 12 units. Does the price go up or down?'; };
    const said = (segment: Seg) => { segment.prompt = 'Demand adds 12 units. The price goes up to 12.'; };
    expect(leaks('econ.market-shift.v2', 'market-shift-demand', offeredBoth, key)).toEqual([]);
    expect(leaks('econ.market-shift.v2', 'market-shift-demand', said, key)).toHaveLength(1);
  });

  it('lets a function graph with no marks write its numbers, and keeps them out when it has marks', () => {
    const key = { family: 'line', target: { m: '2', b: '-3' } };
    const bare = (segment: Seg) => { segment.payload = { ...(segment.payload as object), marks: [] }; segment.prompt = 'Set the slope to 2 and the intercept to 3.'; };
    const marked = (segment: Seg) => { segment.payload = { ...(segment.payload as object), marks: [{ x: 0, y: -3 }, { x: 1, y: -1 }] }; segment.prompt = 'Set the slope to 2 and the intercept to 3.'; };
    expect(leaks('math.function-graph.v2', 'graph-line-two-dots', bare, key)).toEqual([]);
    expect(leaks('math.function-graph.v2', 'graph-line-two-dots', marked, key)).toHaveLength(1);
  });

  it('reads a decimal comma and a decimal point as one numeral', () => {
    const key = { target: '26.82' };
    const comma = leaks('money.rate-return.v2', 'effective-monthly', (segment) => { segment.prompt = 'Type 26,82 as the rate.'; }, key, 'es-MX');
    const point = leaks('money.rate-return.v2', 'effective-monthly', (segment) => { segment.prompt = 'Type 26.82 as the rate.'; }, key);
    expect(comma).toHaveLength(1);
    expect(point).toHaveLength(1);
  });

  it('catches a fraction written as its numerator and denominator, or as a slash pair', () => {
    expect(leaks('math.fraction-wall.v2', 'wall-equivalent', (segment) => { segment.prompt = 'Shade 3 of the 6 parts.'; })).toHaveLength(1);
    expect(leaks('math.fraction-wall.v2', 'wall-equivalent', (segment) => { segment.prompt = 'Shade 3/6 of the wall.'; })).toHaveLength(1);
    expect(leaks('math.fraction-wall.v2', 'wall-equivalent', (segment) => { segment.prompt = 'Shade the sixths that match one half.'; })).toEqual([]);
  });

  it('catches the name of the keyed solid and the keyed option letter in the fields that pick one', () => {
    expect(leaks('geometry.solid-viewer.v2', 'solid-viewer-no-vertices', (segment) => { segment.prompt = 'Is it the cylinder? Count its faces.'; })).toHaveLength(1);
    expect(leaks('geometry.solid-viewer.v2', 'solid-viewer-no-vertices', (segment) => { segment.prompt = 'Find the solid with no vertices. Count its 3 faces.'; })).toHaveLength(1);
    expect(leaks('geometry.solid-viewer.v2', 'solid-viewer-no-vertices', (segment) => { segment.prompt = 'Find the solid with no vertices. Then count its faces.'; })).toEqual([]);
    expect(leaks('geography.globe-route.v2', 'globe-nearest-route', (segment) => { segment.prompt = 'Which route is the shortest? Route b.'; })).toHaveLength(1);
  });

  it('catches a head count written in the tree prompt, whichever branch it belongs to', () => {
    const problems = leaks('prob.tree.v2', 'tree-screening', (segment) => { segment.prompt = 'Build the tree. 99 people have no disease and test positive.'; });
    expect(problems).toEqual([{ gate: 8, segmentId: 'tree-screening', message: expect.stringContaining('writes the head count 99') }]);
  });

  it('reads only Horizonte kinds: a coin tray or a lesson that is not Horizonte is left to its own gates', () => {
    const { document, keys } = scenario('math.rekenrek.v2', 'rekenrek-seven', (segment) => { segment.prompt = 'Slide 5 beads on top and 2 below.'; });
    expect(run(document, keys)).toHaveLength(1);
    expect(answerLeakGates(document, keys, new Set(['money.coin-tray.v2']))).toEqual([]);
  });

  it('reaches the Forge gate report through horizontePieceGates', () => {
    const { document, keys } = scenario('math.rekenrek.v2', 'rekenrek-seven', (segment) => { segment.prompt = 'Slide 5 beads on top and 2 below.'; });
    expect(horizontePieceGates(document, keys).filter((problem) => problem.gate === 8)).toHaveLength(1);
  });
});

describe('a type whose goal is a number the learner is told keeps its numerals', () => {
  it('lets the clock, the ruler, the zoom, the jump and the dot plot state their goal', () => {
    const goals: Array<[string, string, string]> = [
      ['math.ruler.v2', 'ruler-six', 'Make the bar 8 cm long.'],
      ['math.number-line.empty.v2', 'jump-up', 'Jump from 47 to 73.'],
      ['math.number-line.zoom.v2', 'zoom-tenths', 'Place 34 on the line.'],
      ['stats.dot-plot.v2', 'dot-plot-median', 'Move up to two dots so the median is 6.'],
    ];
    for (const [type, id, prompt] of goals) {
      expect(GOAL_STATED.has(type), type).toBe(true);
      expect(leaks(type, id, (segment) => { segment.prompt = prompt; }), `${type} ${id}`).toEqual([]);
    }
  });

  it('keeps the numerals of every other type under the gate', () => {
    expect(GOAL_STATED.has('math.rekenrek.v2')).toBe(false);
    expect(GOAL_STATED.has('math.array-area.v2')).toBe(false);
    expect(GOAL_STATED.has('prob.bayes.v2')).toBe(false);
  });
});

describe('how a key is read', () => {
  it('never counts zero, a tolerance, a review band, a placement set or a payload family as an answer', () => {
    expect(answerParts({ target: 0 })).toEqual([]);
    expect(answerParts({ target: '7', tolerance: { absolute: '0.05' }, review: { absolute: '1' } }).map((part) => part.field)).toEqual(['target']);
    expect(answerParts({ solutions: [{ 'cell-0': ['1:3'] }] })).toEqual([]);
    expect(answerParts({ required: [{ x: 3, y: 2 }] })).toEqual([]);
    expect(answerParts({ family: 'line', target: { m: '2', b: '-3' }, parameter_tolerance: { absolute: '0.05' } }).map((part) => part.field)).toEqual(['target']);
  });

  it('holds a pair or an object as one part, and n over d as one fraction', () => {
    expect(answerParts({ target: [5, 2] })).toEqual([expect.objectContaining({ field: 'target', numerals: ['5', '2'] })]);
    expect(answerParts({ n: 3, d: 6 }).map((part) => [part.field, part.numerals])).toEqual([['n/d', ['3', '6']]]);
    expect(answerParts({ target: { mean: 50, sd: 5 } })).toEqual([expect.objectContaining({ numerals: ['50', '5'] })]);
  });

  it('keeps a single letter or a word only where it names one of the board\'s own options', () => {
    expect(answerParts({ choice: 'c' })).toEqual([expect.objectContaining({ letters: ['c'] })]);
    expect(answerParts({ choice: 'a' })).toEqual([]);
    expect(answerParts({ predict: 'negative', value: -3 })).toEqual([expect.objectContaining({ field: 'value', numerals: ['3'] })]);
    expect(answerParts({ pick: 'hexagon' })).toEqual([expect.objectContaining({ words: ['hexagon'] })]);
  });

  it('shares the spacing and decimal-comma helpers with the algebra gate', () => {
    expect(withoutSpaces('x ^ 2 + 5 x')).toBe('x^2+5x');
    expect(commaToPoint('x=0,5, y=1')).toBe('x=0.5, y=1');
    expect([...numeralsOf('26,82 and 1,000 and 0')].sort()).toEqual(['1', '1000', '26', '26.82', '82']);
  });
});
