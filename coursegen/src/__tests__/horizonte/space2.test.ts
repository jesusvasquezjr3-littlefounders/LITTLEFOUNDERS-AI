import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { space2, SPACE2_CAPABILITIES } from '../../v2/horizonte/space2.js';
import {
  compoundCents, distanceKm, feeCents, globeKey, nextYearCents, PLACE_IDS, profitCents, readArPayload, readGlobePayload, readSurfacePayload,
  routeDistances, routeFees, surfaceGrid, surfaceKey,
} from '../../v2/horizonte/space2Geometry.js';
import {
  FORMULA_LIMITS, answerCount, evaluate, formulaGrid, formulaKey, formulaProblem, newMeter, parseFormula, ratFromInt, ratText, readFormulaPayload, readNumber,
  throughCount, walkPath, walkReach, type Node,
} from '../../v2/horizonte/space2Formula.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const SURFACE = 'math.surface.v2';
const FORMULA = 'math.surface-formula.v2';
const GLOBE = 'geography.globe-route.v2';
const AR = 'space.ar-table.v2';
const TYPES = [SURFACE, FORMULA, GLOBE, AR];

const surface = (payload: Record<string, unknown>, id = 'seg-surface') => ({ id, type: SURFACE, grading: 'server', visual: { type: 'surface' }, payload });
const globe = (payload: Record<string, unknown>, id = 'seg-globe') => ({ id, type: GLOBE, grading: 'server', visual: { type: 'globe-route' }, payload });
const formula = (payload: Record<string, unknown>, id = 'seg-formula') => ({ id, type: FORMULA, grading: 'server', visual: { type: 'surface-formula' }, payload });
const table = (payload: Record<string, unknown>, id = 'seg-ar') => ({ id, type: AR, grading: 'none', visual: { type: 'ar-table' }, payload });

const timeBeatsRate = () => surface({
  surface: { kind: 'compound', principalCents: 100000, ratesBps: [200, 400, 600, 800], terms: [5, 10, 15, 20] },
  ask: { kind: 'highest' },
  options: [{ id: 'a', x: 1, y: 3 }, { id: 'b', x: 3, y: 0 }, { id: 'c', x: 2, y: 2 }, { id: 'd', x: 0, y: 3 }],
});
const priceAndUnits = () => surface({
  surface: { kind: 'profit', unitCostCents: 150, fixedCents: 20000, prices: [200, 300, 400, 500], units: [50, 100, 150, 200] },
  ask: { kind: 'reach', targetCents: 10000 },
  options: [{ id: 'a', x: 0, y: 3 }, { id: 'b', x: 1, y: 2 }, { id: 'c', x: 2, y: 1 }, { id: 'd', x: 3, y: 1 }],
});
const cheapest = (ask: 'shortest' | 'longest' | 'cheapest' = 'cheapest') => globe({
  routes: [
    { id: 'a', from: 'los-angeles', to: 'mexico-city', feeBps: 400, flatCents: 800 },
    { id: 'b', from: 'los-angeles', to: 'manila', feeBps: 150, flatCents: 300 },
    { id: 'c', from: 'los-angeles', to: 'lagos', feeBps: 350, flatCents: 400 },
    { id: 'd', from: 'los-angeles', to: 'new-york', feeBps: 250, flatCents: 700 },
  ],
  ask,
  sendCents: 20000,
});
const nearest = () => globe({
  routes: [
    { id: 'a', from: 'mexico-city', to: 'madrid', feeBps: 300, flatCents: 500 },
    { id: 'b', from: 'mexico-city', to: 'houston', feeBps: 400, flatCents: 300 },
    { id: 'c', from: 'mexico-city', to: 'tokyo', feeBps: 250, flatCents: 600 },
    { id: 'd', from: 'mexico-city', to: 'new-york', feeBps: 350, flatCents: 400 },
  ],
  ask: 'shortest',
  sendCents: 20000,
});

const WINDOW = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };
const slope = (expression = 'x^2+2xy', axis = 'x', at = { x: 1, y: 2 }) => formula({ window: WINDOW, task: { kind: 'slope', expression, axis, at } });
const gradient = (expression = 'x^2+3y-xy', at = { x: 2, y: 1 }) => formula({ window: WINDOW, task: { kind: 'gradient', expression, at } });
const walk = (patch: Record<string, unknown> = {}) => formula({
  window: WINDOW,
  task: { kind: 'walk', expression: 'x^2+y^2', at: { x: 3, y: 2 }, rate: { n: 1, d: 10 }, below: 3, maxSteps: 8, ...patch },
});
const build = (through: unknown[] = [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 3 }, { x: 0, y: 1, z: 0 }]) => formula({ window: { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }, task: { kind: 'build', through } });

const flatSurface = () => surface({
  surface: { kind: 'compound', principalCents: 100, ratesBps: [0, 1, 2], terms: [0, 1, 2] },
  ask: { kind: 'highest' },
  options: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 2, y: 2 }],
});

const gates = (segments: unknown[], ageBand = '13-17') => horizontePieceGates({ age_band: ageBand, segments } as never);
const findings = (segment: { id: string }, key?: unknown) => runSolvabilityGate({ segments: [segment] }, key === undefined ? undefined : { [segment.id]: key });
const codes = (segment: { id: string }, key?: unknown) => findings(segment, key).map((item) => item.code).sort();

describe('space2 pack in the Forge (F4.7 surface, F4.8 globe, F4.9 AR table)', () => {
  it('declares the capability literals and the emitter map spreads them', () => {
    expect(SPACE2_CAPABILITIES[SURFACE]).toEqual(['visual.surface.v1', 'operation.read-surface.v1', 'operation.slice-surface.v1']);
    expect(SPACE2_CAPABILITIES[FORMULA]).toEqual(['visual.surface-formula.v1', 'operation.read-partials.v1', 'operation.walk-gradient.v1']);
    expect(SPACE2_CAPABILITIES[GLOBE]).toEqual(['visual.globe-route.v1', 'operation.rotate-globe.v1', 'operation.compare-routes.v1']);
    expect(SPACE2_CAPABILITIES[AR]).toEqual(['visual.ar-table.v1', 'operation.view-object.v1', 'operation.optional-ar.v1']);
    for (const type of TYPES) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(SPACE2_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(SPACE2_CAPABILITIES[type]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(space2);
  });

  it('adds authoring guidance only for the types a skeleton uses', () => {
    expect(horizonteGuidanceFor([SURFACE]).join('\n')).toMatch(/third real variable/);
    expect(horizonteGuidanceFor([FORMULA]).join('\n')).toMatch(/never runs it as code/);
    expect(horizonteGuidanceFor([FORMULA]).join('\n')).toMatch(/the prompt never writes it/);
    expect(horizonteGuidanceFor([SURFACE]).join('\n')).not.toMatch(/never runs it as code/);
    expect(horizonteGuidanceFor([GLOBE]).join('\n')).toMatch(/great-circle distance/);
    expect(horizonteGuidanceFor([AR]).join('\n')).toMatch(/never mentions the camera/);
    expect(horizonteGuidanceFor([AR]).join('\n')).toMatch(/grading is none/);
    expect(horizonteGuidanceFor([SURFACE]).join('\n')).not.toMatch(/great-circle/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('registers a solvability checker for the three graded types and none for the unscored one', () => {
    expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining([SURFACE, FORMULA, GLOBE]));
    expect(registeredSolvabilityTypes()).not.toContain(AR);
  });

  describe('the Forge model copy', () => {
    it('rounds a year of interest half up and computes compound and profit in whole cents', () => {
      expect(nextYearCents(100000, 200)).toBe(102000);
      expect(nextYearCents(1, 5000)).toBe(2);
      expect(nextYearCents(3, 1000)).toBe(3);
      expect(compoundCents(100000, 200, 5)).toBe(110408);
      expect(compoundCents(100000, 600, 0)).toBe(100000);
      expect(profitCents(150, 20000, 500, 150)).toBe(32500);
      expect(profitCents(150, 20000, 200, 50)).toBe(-17500);
    });

    it('keeps the grid and the keys of the two fixtures', () => {
      const compound = readSurfacePayload(timeBeatsRate().payload)!;
      expect(surfaceGrid(compound.surface)).toHaveLength(4);
      expect(surfaceKey(compound)).toBe('c');
      expect(surfaceKey(readSurfacePayload(priceAndUnits().payload)!)).toBe('d');
    });

    it('measures great circles in whole kilometres and fees in whole cents', () => {
      expect(PLACE_IDS).toHaveLength(16);
      expect(distanceKm('mexico-city', 'houston')).toBe(1215);
      expect(distanceKm('houston', 'mexico-city')).toBe(1215);
      expect(distanceKm('tokyo', 'houston')).toBe(10730);
      expect(distanceKm('madrid', 'madrid')).toBe(0);
      expect(feeCents(20000, 400, 800)).toBe(1600);
      expect(feeCents(20000, 150, 300)).toBe(600);
      const payload = readGlobePayload(cheapest().payload)!;
      expect(routeFees(payload)).toEqual([1600, 600, 1100, 1200]);
      expect(globeKey(payload)).toBe('b');
      const shortest = readGlobePayload(nearest().payload)!;
      expect(routeDistances(shortest)).toHaveLength(4);
      expect(globeKey(shortest)).toBe('b');
    });

    it('reads an AR payload only when it names a listed object', () => {
      expect(readArPayload({ object: 'litre-box' })).toEqual({ object: 'litre-box' });
      expect(readArPayload({ object: 'litre-box', camera: true })).toBeNull();
      expect(readArPayload({ object: 'sofa' })).toBeNull();
      expect(readArPayload(null)).toBeNull();
    });
  });

  describe('piece gates', () => {
    it('accept the well formed boards and a document with no key', () => {
      expect(gates([timeBeatsRate(), priceAndUnits(), cheapest(), nearest(), table({ object: 'litre-box' })])).toEqual([]);
      expect(gates([nearest()], '10-12')).toEqual([]);
      expect(gates([cheapest('shortest')])).toEqual([]);
    });

    it('refuse a malformed surface, a flat one and a question with no single answer', () => {
      expect(gates([surface({ surface: { kind: 'compound' } })])[0]).toMatchObject({ gate: 4, segmentId: 'seg-surface', message: expect.stringMatching(/malformed/) });
      const tie = surface({
        surface: { kind: 'profit', unitCostCents: 100, fixedCents: 0, prices: [200, 300, 400], units: [10, 20, 30] },
        ask: { kind: 'highest' },
        options: [{ id: 'a', x: 2, y: 1 }, { id: 'b', x: 1, y: 2 }],
      });
      expect(gates([tie])[0]?.message).toMatch(/Exactly one option must be the highest/);
      const none = surface({ ...(priceAndUnits().payload as Record<string, unknown>), ask: { kind: 'reach', targetCents: 99999999 } });
      expect(gates([none])[0]?.message).toMatch(/Exactly one option must reach the target/);
      const several = surface({ ...(priceAndUnits().payload as Record<string, unknown>), ask: { kind: 'reach', targetCents: 0 } });
      expect(gates([several])[0]?.message).toMatch(/Exactly one option must reach the target/);
    });

    it('refuse a surface that is flat everywhere (a one-dollar principal never grows at 0 to 2 basis points)', () => {
      expect(gates([flatSurface()])[0]).toMatchObject({ gate: 4, segmentId: 'seg-surface', message: 'The surface must not be flat' });
    });

    it('refuse a route to itself, a repeated corridor, a tie and a distance inside the margin', () => {
      const withRoutes = (routes: unknown[], ask = 'cheapest') => globe({ routes, ask, sendCents: 20000 });
      const route = (id: string, from: string, to: string, feeBps = 300, flatCents = 100) => ({ id, from, to, feeBps, flatCents });
      expect(gates([withRoutes([route('a', 'tokyo', 'tokyo'), route('b', 'tokyo', 'lagos', 100)])])[0]?.message).toMatch(/two different places/);
      expect(gates([withRoutes([route('a', 'tokyo', 'lagos'), route('b', 'lagos', 'tokyo', 100)])])[0]?.message).toMatch(/corridor is listed once/);
      expect(gates([withRoutes([route('a', 'tokyo', 'lagos'), route('b', 'tokyo', 'manila')])])[0]?.message).toMatch(/lowest fee/);
      expect(gates([withRoutes([route('a', 'tokyo', 'houston'), route('b', 'tokyo', 'madrid')], 'longest')])[0]?.message).toMatch(/at least 2 percent/);
      expect(gates([globe({ routes: [], ask: 'cheapest', sendCents: 20000 })])[0]?.message).toMatch(/malformed/);
      expect(gates([globe({ ...(cheapest().payload as Record<string, unknown>), sendCents: 5 })])[0]?.message).toMatch(/malformed/);
      expect(gates([withRoutes([route('a', 'tokyo', 'atlantis'), route('b', 'tokyo', 'lagos')])])[0]?.message).toMatch(/malformed/);
    });

    it('refuse an AR payload that is not a listed object', () => {
      expect(gates([table({ object: 'sofa' })])[0]).toMatchObject({ gate: 4, segmentId: 'seg-ar', message: expect.stringMatching(/exactly \{ object \}/) });
      expect(gates([table({ object: 'litre-box', camera: true })])).toHaveLength(1);
    });

    it('refuse a wrong visual, a wrong grading, an age band out of scope and a long prompt', () => {
      expect(gates([{ ...timeBeatsRate(), visual: { type: 'globe-route' } }])[0]?.message).toMatch(/visual type surface/);
      expect(gates([{ ...cheapest(), visual: { type: 'surface' } }])[0]?.message).toMatch(/visual type globe-route/);
      expect(gates([{ ...table({ object: 'litre-box' }), visual: { type: 'surface' } }])[0]?.message).toMatch(/visual type ar-table/);
      expect(gates([{ ...table({ object: 'litre-box' }), grading: 'server' }])[0]?.message).toMatch(/not scored/);
      expect(gates([{ ...timeBeatsRate(), grading: 'none' }])[0]?.message).toMatch(/graded on Core/);
      expect(gates([{ ...table({ object: 'litre-box' }), grading: undefined }])[0]?.message).toMatch(/not scored/);
      expect(gates([timeBeatsRate()], '10-12')[0]?.message).toMatch(/age band 13-17, adult/);
      expect(gates([table({ object: 'litre-box' })], '10-12')[0]?.message).toMatch(/age band 13-17, adult/);
      expect(gates([timeBeatsRate()], 'adult')).toEqual([]);
      expect(gates([{ ...cheapest(), prompt: Array.from({ length: 30 }, () => 'word').join(' ') }])[0]?.message).toMatch(/at most 24 words/);
    });

    it('ignore every other segment type', () => {
      expect(gates([{ id: 'x', type: 'money.allocation.v2', visual: { type: 'whatever' }, payload: {} }])).toEqual([]);
    });
  });

  describe('solvability checkers', () => {
    it('prove the surface has one answer and judge the key', () => {
      expect(findings(timeBeatsRate(), { choice: 'c' })).toEqual([]);
      expect(findings(priceAndUnits(), { choice: 'd' })).toEqual([]);
      expect(findings(timeBeatsRate())).toEqual([]);
      expect(codes(timeBeatsRate(), { choice: 'a' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(priceAndUnits(), { choice: 'z' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    });

    it('name a flat surface as an impossible state', () => {
      expect(codes(flatSurface())).toEqual(['impossible-state']);
    });

    it('name a tie as ambiguous and an unreachable target as no solution', () => {
      const tie = surface({
        surface: { kind: 'profit', unitCostCents: 100, fixedCents: 0, prices: [200, 300, 400], units: [10, 20, 30] },
        ask: { kind: 'highest' },
        options: [{ id: 'a', x: 2, y: 1 }, { id: 'b', x: 1, y: 2 }],
      });
      expect(codes(tie)).toEqual(['ambiguous-solution']);
      const none = surface({ ...(priceAndUnits().payload as Record<string, unknown>), ask: { kind: 'reach', targetCents: 99999999 } });
      expect(codes(none)).toEqual(['no-solution']);
      const several = surface({ ...(priceAndUnits().payload as Record<string, unknown>), ask: { kind: 'reach', targetCents: 0 } });
      expect(codes(several)).toEqual(['ambiguous-solution']);
    });

    it('prove the globe has one answer and judge the key', () => {
      expect(findings(cheapest(), { choice: 'b' })).toEqual([]);
      expect(findings(nearest(), { choice: 'b' })).toEqual([]);
      expect(findings(cheapest())).toEqual([]);
      expect(codes(cheapest(), { choice: 'a' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(nearest(), { choice: 'd' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    });

    it('name a fee tie, a distance inside the margin, a repeated corridor and a route to itself', () => {
      const route = (id: string, from: string, to: string, feeBps = 300, flatCents = 100) => ({ id, from, to, feeBps, flatCents });
      const withRoutes = (routes: unknown[], ask = 'cheapest') => globe({ routes, ask, sendCents: 20000 });
      expect(codes(withRoutes([route('a', 'tokyo', 'lagos'), route('b', 'tokyo', 'manila')]))).toEqual(['ambiguous-solution']);
      expect(codes(withRoutes([route('a', 'tokyo', 'houston'), route('b', 'tokyo', 'madrid')], 'longest'))).toEqual(['ambiguous-solution']);
      expect(codes(withRoutes([route('a', 'tokyo', 'lagos'), route('b', 'lagos', 'tokyo', 100)]))).toEqual(['duplicate-id']);
      expect(codes(withRoutes([route('a', 'tokyo', 'tokyo'), route('b', 'tokyo', 'lagos', 100)]))).toEqual(['impossible-state']);
    });

    it('refuse a malformed payload or key without throwing', () => {
      expect(codes({ id: 'seg-bad', type: SURFACE, payload: { surface: {} } } as never)).toEqual(['impossible-state']);
      expect(codes({ id: 'seg-bad', type: GLOBE, payload: { routes: 'nope' } } as never)).toEqual(['impossible-state']);
      expect(codes(timeBeatsRate(), 'nope')).toEqual(['impossible-state']);
      expect(codes(timeBeatsRate(), { choice: 'c', extra: true })).toEqual(['impossible-state']);
      expect(codes(timeBeatsRate(), { choice: 3 })).toEqual(['impossible-state']);
      expect(codes(cheapest(), { pick: 'b' })).toEqual(['impossible-state']);
    });

    it('never asks for a key on the unscored AR step', () => {
      expect(findings(table({ object: 'litre-box' }))).toEqual([]);
    });
  });
});

describe('F4.7 formula surface in the Forge (a free-form z = f(x, y), read by a bounded parser)', () => {
  const backend = (name: string) => fileURLToPath(new URL(`../../../../backend/src/services/horizonte/space2/${name}`, import.meta.url));
  const lf = (text: string) => text.replace(/\r\n/g, '\n');
  const expr = (text: string): Node => {
    const parsed = parseFormula(text);
    if (!parsed.ok) throw new Error(`${text}: ${parsed.error}`);
    return parsed.expr;
  };
  const gateMessages = (segment: unknown) => gates([segment], '13-17').map((problem) => problem.message);
  const withKey = (segment: { id: string }, key: unknown) => horizontePieceGates({ age_band: '13-17', segments: [segment] } as never, { [segment.id]: key });

  it('copies the Core formula engine byte for byte', () => {
    const forge = readFileSync(fileURLToPath(new URL('../../v2/horizonte/space2Formula.ts', import.meta.url)), 'utf8');
    expect(lf(forge)).toBe(lf(readFileSync(backend('field.ts'), 'utf8')));
  });

  describe('the Forge model copy', () => {
    it('reads a formula exactly and keeps the slope of each task of the four fixtures', () => {
      expect(formulaKey(readFormulaPayload(slope().payload)!)?.map(ratText)).toEqual(['6']);
      expect(formulaKey(readFormulaPayload(slope('x^2+2xy', 'y').payload)!)?.map(ratText)).toEqual(['2']);
      expect(formulaKey(readFormulaPayload(gradient().payload)!)?.map(ratText)).toEqual(['3', '1']);
      expect(formulaKey(readFormulaPayload(walk().payload)!)?.map(ratText)).toEqual(['4']);
      expect(formulaKey(readFormulaPayload(build().payload)!)).toBeNull();
      const payload = readFormulaPayload(build().payload)!;
      expect(payload.task.kind === 'build' && throughCount('1+2x-y', payload.task.through)).toBe(3);
      expect(payload.task.kind === 'build' && throughCount('z = 1 + 2,0x - y', payload.task.through)).toBe(3);
      expect(payload.task.kind === 'build' && throughCount('alert(1)', payload.task.through)).toBeNull();
      expect(answerCount(payload.task)).toBe(1);
      expect(answerCount(readFormulaPayload(gradient().payload)!.task)).toBe(2);
    });

    it('walks downhill in exact fractions and finds the step the height gets to the line', () => {
      const walked = walkPath(expr('x^2+y^2'), { x: 3, y: 2 }, { n: 1, d: 10 }, 8);
      expect(walked.ok && walked.path).toHaveLength(9);
      expect(walked.ok && ratText(walked.path[1]!.z)).toBe('8.32');
      expect(walked.ok && walkReach(walked.path, 3)).toBe(4);
      expect(walked.ok && walkReach(walked.path, -5)).toBeNull();
    });

    it('accepts a decimal comma anywhere a number is typed and refuses a number that is not exact', () => {
      expect(ratText(readNumber('0,5')!)).toBe('0.5');
      expect(ratText(readNumber('-1,25')!)).toBe('-1.25');
      expect(ratText(readNumber('3/6')!)).toBe('0.5');
      expect(readNumber('1,2,3')).toBeNull();
      expect(readNumber('1e3')).toBeNull();
      expect(readNumber('0x10')).toBeNull();
      expect(readNumber('')).toBeNull();
      const found = evaluate(expr('0,5x+0.25y'), ratFromInt(4), ratFromInt(4), newMeter());
      expect(found.ok && ratText(found.z)).toBe('3');
    });

    it('never throws and never runs text: hostile and oversized input is refused by name', () => {
      const hostile: unknown[] = [
        'alert(1)', 'constructor', '__proto__', 'process.exit()', 'this', 'globalThis', 'x.constructor', 'x["a"]', 'x;y', 'x=y', 'x,y', '`x`', '${x}', '<script>', 'x//y',
        'eval("1")', 'Function("return 1")()', 'x^7', 'x^-1', 'x^y', 'x^x', 'x^2^2', 'x^2.5', 'x^99999999999', '1'.repeat(40), '9'.repeat(7), '1e999', '0x1f', '1_000',
        '(((((((((((x)))))))))))', '('.repeat(30) + 'x' + ')'.repeat(30), 'x'.repeat(49), 'x+'.repeat(40), '((x', 'x)', '()', '', '   ', '.', ',', '1.', '1,,2', 'x y',
        'x\n+y', '‮x+y', 'ｘ+ｙ', 'x'.repeat(100_000), `${'x*'.repeat(30)}x`, '2^6^6', 'x/0', '--x', '+-x', null, undefined, 7, {}, [], ['x'],
      ];
      for (const input of hostile) {
        let parsed: ReturnType<typeof parseFormula> | undefined;
        expect(() => { parsed = parseFormula(input); }, String(input).slice(0, 20)).not.toThrow();
        if (parsed?.ok) {
          // A few of these are legal formulas ("x/0" reads, and is refused when evaluated); none may run text.
          expect(['x/0', '--x', '+-x', '(((((((((((x)))))))))))']).toContain(input);
        }
      }
      expect(parseFormula('x/0').ok).toBe(true);
      const divided = evaluate(expr('x/0'), ratFromInt(1), ratFromInt(1), newMeter());
      expect(divided.ok).toBe(false);
    });

    it('bounds the length, the nodes, the depth and the cost of every formula', () => {
      expect(FORMULA_LIMITS).toMatchObject({ maxChars: 48, maxNodes: 48, maxDepth: 10, maxDigits: 6, maxExponent: 6, maxEvaluations: 400 });
      expect(parseFormula('x'.repeat(48))).toMatchObject({ ok: false, error: 'too-complex' }); // 48 factors is more than 48 nodes
      expect(parseFormula('x'.repeat(49))).toMatchObject({ ok: false, error: 'too-long' });
      expect(parseFormula('('.repeat(20) + 'x' + ')'.repeat(20))).toMatchObject({ ok: false, error: 'too-complex' });
      const costly = expr('(x+1)^6*(y+1)^6*(x+y+1)^6');
      const grid = formulaGrid(costly, { xMin: -9, xMax: 9, yMin: -9, yMax: 9 });
      expect(grid === null || grid.values.length > 0).toBe(true);
      const meter = newMeter();
      let refused = false;
      for (let n = 0; n < FORMULA_LIMITS.maxEvaluations + 5; n += 1) refused = !evaluate(expr('x+y'), ratFromInt(1), ratFromInt(1), meter).ok || refused;
      expect(refused).toBe(true);
    });
  });

  describe('piece gates', () => {
    it('accept the four well formed tasks, with and without a key', () => {
      expect(gates([slope(), gradient(), walk(), build()])).toEqual([]);
      expect(withKey(slope(), { key: ['6'] })).toEqual([]);
      expect(withKey(build(), { reference: '1+2x-y' })).toEqual([]);
    });

    it('refuse an expression that is not a formula, in plain words, without running it', () => {
      for (const expression of ['alert(1)', 'constructor', '__proto__', 'x^7', 'x^2^2', '(x+y', '1'.repeat(40), 'x'.repeat(500)]) {
        expect(gateMessages(slope(expression)), expression).toEqual([expect.stringMatching(/malformed/)]);
      }
      expect(gateMessages(slope('x^2+2xy', 'z'))).toEqual([expect.stringMatching(/malformed/)]);
      expect(gateMessages(slope(7 as never))).toEqual([expect.stringMatching(/malformed/)]);
    });

    it('refuse a formula that is flat or undefined somewhere in the window', () => {
      expect(gateMessages(slope('x-x'))).toEqual(['The surface must not be flat']);
      expect(gateMessages(slope('7'))).toEqual(['The surface must not be flat']);
      expect(gateMessages(slope('1/x'))).toEqual(['The formula must be defined at every whole point of the window']);
      expect(gateMessages(slope('x/(y-1)', 'x', { x: 1, y: 2 }))).toEqual(['The formula must be defined at every whole point of the window']);
      expect(gateMessages(slope('(x+1)^6*(y+1)^6*(x+y+1)^6*(x-y+9)^6'))[0]).toMatch(/a number a learner can type exactly/); // evaluates in bounds, but the slope is huge
    });

    it('refuse an answer a learner cannot type exactly', () => {
      expect(gateMessages(slope('x/7'))[0]).toMatch(/a number a learner can type exactly/);
      expect(gateMessages(slope('999999x^6'))[0]).toMatch(/a number a learner can type exactly/);
    });

    it('refuse a walk that never gets there, starts below the line, takes one step or leaves the window', () => {
      expect(gateMessages(walk({ maxSteps: 3 }))).toEqual(['The walk must reach the line within its steps']);
      expect(gateMessages(walk({ below: 99 }))).toEqual(['The walk must start above the line']);
      expect(gateMessages(walk({ below: 10 }))).toEqual(['The walk must take at least 2 steps to reach the line']);
      expect(gateMessages(walk({ expression: 'x^3+y^2', rate: { n: 99, d: 100 }, below: -900, maxSteps: 12 }))[0]).toMatch(/inside the window|reach the line/);
    });

    it('refuse a build with the same height everywhere, a repeated position or a point off the window', () => {
      expect(gateMessages(build([{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }]))).toEqual([expect.stringMatching(/must not all have the same height/)]);
      expect(gateMessages(build([{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 2 }]))).toEqual([expect.stringMatching(/malformed/)]);
      expect(gateMessages(build([{ x: 0, y: 0, z: 1 }, { x: 5, y: 0, z: 2 }]))).toEqual([expect.stringMatching(/malformed/)]);
      expect(gateMessages(build([{ x: 0, y: 0, z: 1 }]))).toEqual([expect.stringMatching(/malformed/)]);
    });

    it('refuse a malformed payload, a wrong visual, a wrong grading, an age band out of scope and a long prompt', () => {
      expect(gateMessages(formula({ window: WINDOW }))).toEqual([expect.stringMatching(/malformed/)]);
      expect(gateMessages(formula({ window: { ...WINDOW, xMax: 40 }, task: { kind: 'gradient', expression: 'x+y', at: { x: 0, y: 0 } } }))).toEqual([expect.stringMatching(/malformed/)]);
      expect(gateMessages({ ...slope(), visual: { type: 'surface' } })[0]).toMatch(/visual type surface-formula/);
      expect(gateMessages({ ...slope(), grading: 'none' })[0]).toMatch(/graded on Core/);
      expect(gates([slope()], '10-12')[0]?.message).toMatch(/age band 13-17, adult/);
      expect(gates([slope()], 'adult')).toEqual([]);
      expect(gateMessages({ ...slope(), prompt: Array.from({ length: 30 }, () => 'word').join(' ') })[0]).toMatch(/at most 24 words/);
    });

    it('refuse a prompt that writes the reference formula', () => {
      const prompt = (text: string) => ({ ...build(), prompt: text });
      expect(withKey(prompt('Type 1 + 2x - y for z.'), { reference: '1+2x-y' }).map((problem) => problem.message)).toEqual(['The prompt must not write the reference formula']);
      expect(withKey(prompt('Type a formula for z through all three dots.'), { reference: '1+2x-y' })).toEqual([]);
      expect(gates([prompt('Type 1+2x-y for z.')])).toEqual([]);
    });
  });

  describe('solvability checker', () => {
    it('proves each task has one exact answer and judges the key', () => {
      expect(findings(slope(), { key: ['6'] })).toEqual([]);
      expect(findings(gradient(), { key: ['3', '1'] })).toEqual([]);
      expect(findings(walk(), { key: ['4'] })).toEqual([]);
      expect(findings(build(), { reference: '1+2x-y' })).toEqual([]);
      expect(findings(slope())).toEqual([]);
      expect(findings(build())).toEqual([]);
    });

    it('catches a key that would grade a right answer wrong or a wrong answer right', () => {
      expect(codes(slope(), { key: ['5'] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(slope(), { key: ['6.0'] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(gradient(), { key: ['1', '3'] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(walk(), { key: ['5'] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(build(), { reference: 'x+y' })).toEqual(['rubric-accepts-invalid']);
    });

    it('names a task with no answer', () => {
      expect(codes(walk({ maxSteps: 3 }))).toEqual(['no-solution']);
      expect(codes(slope('x-x'))).toEqual(['impossible-state']);
      expect(codes(slope('1/x'))).toEqual(['impossible-state']);
      expect(codes(build([{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }]))).toEqual(['impossible-state']);
    });

    it('refuses a malformed payload, expression or key without throwing', () => {
      expect(codes({ id: 'seg-bad', type: FORMULA, payload: { window: {} } } as never)).toEqual(['impossible-state']);
      expect(codes({ id: 'seg-bad', type: FORMULA, payload: 'x^2' } as never)).toEqual(['impossible-state']);
      expect(codes(slope('alert(1)'))).toEqual(['impossible-state']);
      expect(codes(slope('x'.repeat(100_000)))).toEqual(['impossible-state']);
      expect(codes(slope(), 'nope')).toEqual(['impossible-state']);
      expect(codes(slope(), { key: '6' })).toEqual(['impossible-state']);
      expect(codes(slope(), { key: [6] })).toEqual(['impossible-state']);
      expect(codes(slope(), { key: ['6', '1'] })).toEqual(['impossible-state']);
      expect(codes(slope(), { key: ['6'], extra: true })).toEqual(['impossible-state']);
      expect(codes(gradient(), { key: ['3'] })).toEqual(['impossible-state']);
      expect(codes(build(), { key: ['6'] })).toEqual(['impossible-state']);
      expect(codes(build(), { reference: 7 })).toEqual(['impossible-state']);
      expect(codes(build(), { reference: 'alert(1)' })).toEqual(['impossible-state']);
    });
  });

  it('keeps the helper surface of the copy that the gates need', () => {
    expect(formulaProblem(readFormulaPayload(slope().payload)!)).toBeNull();
    expect(formulaProblem(readFormulaPayload(walk().payload)!)).toBeNull();
  });
});
