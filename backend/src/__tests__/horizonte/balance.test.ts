import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { balance } from '../../services/horizonte/balance/index.js';
import { BALANCE_FIXTURES } from '../../services/horizonte/balance/fixtures.js';
import { applyOp, canApply, equationTex, holdsAt, isOfferedOps, isSolved, isStartScale, levelScale, replay, solveRoute, solvedValue, tiltDegrees } from '../../services/horizonte/balance/model.js';
import { canonicalRational, canonicalText, ratio, sameRational } from '../../services/horizonte/balance/numeric.js';
import { PROOF_FORMULAS, PROOF_VISUALS, insidePolygon, placePolygon, polygonArea, proofFigure, proofGroups, proofKey, proofPayloadProblem, proofValue, sameProofValue, type Pt, type ProofFigure, type ProofVisual } from '../../services/horizonte/balance/proof.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

const BALANCE_TYPE = 'math.equation-balance.v2';
const PROOF_TYPE = 'math.visual-proof.v2';
type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const gradeBalance = balance.scorers[BALANCE_TYPE]!.grade as unknown as Grade;
const gradeProof = balance.scorers[PROOF_TYPE]!.grade as unknown as Grade;
const fixture = (id: string) => BALANCE_FIXTURES.find((entry) => entry.id === id)!;
const balanceFixtures = BALANCE_FIXTURES.filter((entry) => entry.segment('en-US').type === BALANCE_TYPE);
const proofFixtures = BALANCE_FIXTURES.filter((entry) => entry.segment('en-US').type === PROOF_TYPE);

function lesson(entry: (typeof BALANCE_FIXTURES)[number], locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const type = entry.segment('en-US').type;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${entry.ageBand}`, chapter_id: 'horizonte-balance', lesson_id: `hz-balance-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale],
    required_capabilities: [...(balance.capabilities as Record<string, readonly string[]>)[type as string]!], segments: [entry.segment(locale)],
  };
}

describe('balance pack contract', () => {
  it('meets the scorer contract for both segment types', () => {
    expect(() => assertScorerContract(balance, BALANCE_FIXTURES)).not.toThrow();
    expect(balanceFixtures.length).toBe(3);
    expect(proofFixtures.map((entry) => entry.segment('en-US').visual)).toEqual(PROOF_VISUALS.map((type) => ({ type })));
  });

  it('declares the capability sets and the age scopes', () => {
    expect(balance.capabilities[BALANCE_TYPE]).toContain('visual.math-notation.v1');
    expect(balance.capabilities[PROOF_TYPE]).not.toContain('visual.math-notation.v1');
    expect(balance.ageScope[BALANCE_TYPE]).toEqual({ ages: [10, 14], adult: false });
    expect(balance.ageScope[PROOF_TYPE]).toEqual({ ages: [10, 15], adult: false });
  });
});

describe('F1.8 equation balance: the model', () => {
  const start = { l: { x: 3, u: 2 }, r: { x: 1, u: 8 } };

  it('keeps the scale level when the same operation is done on both pans', () => {
    const level = levelScale(start);
    expect(applyOp(level, 'sub-x')).toEqual({ l: { x: 2, u: 2 }, r: { x: 0, u: 8 }, skew: 0 });
    expect(applyOp(level, 'add-unit')).toEqual({ l: { x: 3, u: 3 }, r: { x: 1, u: 9 }, skew: 0 });
    expect(applyOp(levelScale({ l: { x: 4, u: 2 }, r: { x: 2, u: 6 } }), 'div-2')).toEqual({ l: { x: 2, u: 1 }, r: { x: 1, u: 3 }, skew: 0 });
    expect(tiltDegrees(level)).toBe(0);
  });

  it('refuses what cannot be done on both pans', () => {
    const level = levelScale(start);
    expect(canApply(level, 'div-2')).toBe(false);
    expect(applyOp(level, 'div-3')).toBeNull();
    expect(canApply(levelScale({ l: { x: 1, u: 0 }, r: { x: 0, u: 5 } }), 'sub-x')).toBe(false);
    expect(canApply(levelScale({ l: { x: 1, u: 0 }, r: { x: 0, u: 5 } }), 'sub-unit')).toBe(false);
    expect(canApply(levelScale({ l: { x: 1, u: 30 }, r: { x: 0, u: 30 } }), 'add-unit')).toBe(false);
  });

  it('tips the scale when one pan alone is changed, and then allows nothing until reset', () => {
    const slip = applyOp(levelScale(start), 'slip-left')!;
    expect(slip).toEqual({ l: { x: 3, u: 1 }, r: { x: 1, u: 8 }, skew: 1 });
    expect(tiltDegrees(slip)).toBe(-12);
    expect(tiltDegrees(applyOp(levelScale(start), 'slip-right')!)).toBe(12);
    expect(canApply(slip, 'sub-x')).toBe(false);
    expect(isSolved(slip)).toBe(false);
    expect(replay(start, ['slip-left'])).toBeNull();
  });

  it('recognises x alone on either pan and reads its value', () => {
    expect(isSolved({ l: { x: 1, u: 0 }, r: { x: 0, u: 3 }, skew: 0 })).toBe(true);
    expect(solvedValue({ l: { x: 0, u: 4 }, r: { x: 1, u: 0 }, skew: 0 })).toBe(4);
    expect(isSolved({ l: { x: 2, u: 0 }, r: { x: 0, u: 6 }, skew: 0 })).toBe(false);
    expect(isSolved({ l: { x: 1, u: 1 }, r: { x: 0, u: 3 }, skew: 0 })).toBe(false);
    expect(solvedValue(levelScale(start))).toBeNull();
  });

  it('replays a route and ends where the equation says', () => {
    expect(solvedValue(replay(start, ['sub-x', 'sub-unit', 'sub-unit', 'div-2'])!)).toBe(3);
    expect(replay(start, ['sub-x', 'div-3'])).toBeNull();
    expect(replay(start, ['jump'])).toBeNull();
    expect(holdsAt(start, 3)).toBe(true);
    expect(holdsAt(start, 4)).toBe(false);
  });

  it('solves by breadth-first search and says so when there is no route', () => {
    expect(solveRoute(start, ['sub-x', 'sub-unit', 'div-2'])).toEqual(['sub-x', 'div-2', 'sub-unit']);
    expect(solveRoute({ l: { x: 1, u: 0 }, r: { x: 0, u: 3 } }, ['sub-x'])).toEqual([]);
    expect(solveRoute(start, ['div-2', 'div-3'])).toBeNull();
    expect(solveRoute(start, ['sub-x'])).toBeNull();
    expect(solveRoute(start, ['sub-x', 'sub-unit', 'div-2'], 2)).toBeNull();
    for (const entry of balanceFixtures) {
      const payload = entry.segment('en-US').payload as { start: never; ops: never[] };
      const route = solveRoute(payload.start, payload.ops);
      expect(route, entry.id).not.toBeNull();
      expect(solvedValue(replay(payload.start, route!)!), entry.id).toBe((entry.rubric as { x: number }).x);
      expect(holdsAt(payload.start, (entry.rubric as { x: number }).x), entry.id).toBe(true);
    }
  });

  it('keeps the guards total and writes the equation as plain TeX', () => {
    expect(isStartScale({ l: { x: 0, u: 3 }, r: { x: 0, u: 3 } })).toBe(false);
    expect(isStartScale({ l: { x: 9, u: 0 }, r: { x: 0, u: 3 } })).toBe(false);
    expect(isStartScale({ l: { x: 1, u: 0 }, r: { x: 0, u: 3 }, extra: 1 })).toBe(false);
    expect(isStartScale(null)).toBe(false);
    expect(isOfferedOps(['slip-left'])).toBe(false);
    expect(isOfferedOps(['sub-x', 'sub-x'])).toBe(false);
    expect(isOfferedOps(['sub-x', 'slip-left'])).toBe(true);
    expect(equationTex(start)).toBe('3x + 2 = x + 8');
    expect(equationTex({ l: { x: 1, u: 0 }, r: { x: 0, u: 3 } })).toBe('x = 3');
    expect(equationTex({ l: { x: 0, u: 0 }, r: { x: 2, u: 0 } })).toBe('0 = 2x');
  });
});

describe('F1.8 equation balance: grading', () => {
  const two = fixture('two-sides');
  const segment = two.segment('en-US');
  const right = fixture('x-on-right');

  it('is met when the route isolates x and the typed value is the key', () => {
    expect(gradeBalance(segment, { steps: ['sub-x', 'sub-unit', 'sub-unit', 'div-2'], answer: '3' }, two.rubric)).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(gradeBalance(segment, { steps: ['sub-unit', 'sub-unit', 'sub-x', 'div-2'], answer: '3' }, two.rubric).verdict).toBe('met');
    expect(gradeBalance(right.segment('en-US'), { steps: ['sub-x', 'sub-unit'], answer: '4' }, right.rubric).verdict).toBe('met');
  });

  it('is review when the value or the route is not the key', () => {
    expect(gradeBalance(segment, { steps: ['sub-x', 'sub-unit', 'sub-unit', 'div-2'], answer: '4' }, two.rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(gradeBalance(segment, { steps: ['sub-x'], answer: '3' }, two.rubric).verdict).toBe('review');
    expect(gradeBalance(segment, { steps: [], answer: '3' }, two.rubric).verdict).toBe('review');
    expect(gradeBalance(segment, { steps: ['sub-x', 'sub-unit', 'sub-unit', 'div-2'], answer: '3.5' }, two.rubric).verdict).toBe('review');
  });

  it('is valid while nothing is typed yet, with or without steps', () => {
    expect(gradeBalance(segment, { steps: [], answer: '' }, two.rubric).verdict).toBe('valid');
    expect(gradeBalance(segment, { steps: ['sub-x', 'sub-unit'], answer: '' }, two.rubric).verdict).toBe('valid');
  });

  it('is invalid for a rule break, a slip, an operation not offered and malformed text', () => {
    expect(gradeBalance(segment, { steps: ['div-2'], answer: '' }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: ['slip-left'], answer: '' }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: ['div-3'], answer: '' }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: ['sub-x'], answer: '3,0' }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: ['sub-x'], answer: ' 3' }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: ['sub-x'], answer: '03' }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: ['sub-x'], answer: 3 }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: 'sub-x', answer: '' }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: [], answer: '', extra: 1 }, two.rubric).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: Array(17).fill('add-unit'), answer: '' }, two.rubric).verdict).toBe('invalid');
  });

  it('refuses a key that is wrong, unreachable or malformed, never met', () => {
    const solved = { steps: ['sub-x', 'sub-unit', 'sub-unit', 'div-2'], answer: '4' };
    expect(gradeBalance(segment, solved, { x: 4 }).verdict).toBe('invalid');
    expect(gradeBalance(segment, { steps: [], answer: '' }, { x: 4 }).verdict).toBe('invalid');
    expect(gradeBalance(segment, solved, { x: 3, extra: 1 }).verdict).toBe('invalid');
    expect(gradeBalance(segment, solved, { x: '3' }).verdict).toBe('invalid');
    expect(gradeBalance(segment, solved, { x: 3.5 }).verdict).toBe('invalid');
    expect(gradeBalance(segment, solved, null).verdict).toBe('invalid');
    const noRoute = { ...segment, payload: { start: { l: { x: 3, u: 2 }, r: { x: 1, u: 8 } }, ops: ['div-2', 'div-3'] } };
    expect(gradeBalance(noRoute, { steps: [], answer: '' }, { x: 3 }).verdict).toBe('invalid');
  });

  it('never says met in the browser, which holds no rubric', () => {
    expect(gradeBalance(segment, { steps: ['sub-x', 'sub-unit', 'sub-unit', 'div-2'], answer: '3' }, undefined).verdict).toBe('valid');
    expect(gradeBalance(segment, { steps: ['div-2'], answer: '' }, undefined).verdict).toBe('invalid');
  });

  it('judges a malformed segment as invalid, never as a throw', () => {
    for (const bad of [undefined, null, {}, { payload: null }, { payload: { start: { l: 1, r: 2 }, ops: [] } }]) expect(gradeBalance(bad, { steps: [], answer: '' }, two.rubric).verdict).toBe('invalid');
  });
});

describe('numeric text', () => {
  it('accepts only the canonical decimal the browser submits', () => {
    expect(canonicalText(canonicalRational('78.5')!)).toBe('78.5');
    expect(sameRational(canonicalRational('0.5')!, ratio(1, 2))).toBe(true);
    for (const bad of ['', ' 1', '1 ', '1,5', '01', '1.50', '-0', '+1', '1e3', '.5', '1.', '1234567890123', 'NaN']) expect(canonicalRational(bad), bad).toBeNull();
    expect(canonicalRational('-3')).toEqual({ n: -3n, d: 1n });
    expect(canonicalRational(3)).toBeNull();
    expect(canonicalText(ratio(1, 3))).toBeNull();
    expect(canonicalText(ratio(314 * 25, 100))).toBe('78.5');
    expect(canonicalText(ratio(7, 4))).toBe('1.75');
    expect(canonicalText(ratio(-1, 2))).toBe('-0.5');
  });
});

/* ---------- F1.15 geometry ---------- */

type Region = { kind: string; points: readonly Pt[] };
const STILL = new Set(['frame', 'neutral']);

/** Every solid region of a figure in one state: pieces at their pose, fixed shapes, and the remainder shown in that state. */
function regions(figure: ProofFigure, state: 'from' | 'to'): Region[] {
  return [
    ...figure.fixed.filter((shape) => !STILL.has(shape.tone)).map((shape) => ({ kind: shape.id, points: shape.points })),
    ...figure.pieces.map((piece) => ({ kind: piece.id, points: placePolygon(piece.base, piece[state]) })),
    ...(figure.remainders?.[state].map((shape) => ({ kind: shape.id, points: shape.points })) ?? []),
  ];
}
const sum = (list: Region[]): number => list.reduce((total, region) => total + polygonArea(region.points), 0);

/** The most regions any grid point falls in; an offset irrational grid keeps points off shared edges. */
function deepestOverlap(list: Region[], step = 0.173, shrink = 0): number {
  if (shrink > 0) {
    // Poses round to 1e-4, so two edges that coincide can overlap by a hair: shrink each convex region toward its centre first.
    list = list.map((region) => {
      const cx = region.points.reduce((total, [x]) => total + x, 0) / region.points.length;
      const cy = region.points.reduce((total, [, y]) => total + y, 0) / region.points.length;
      return { kind: region.kind, points: region.points.map(([x, y]): Pt => [cx + (x - cx) * (1 - shrink), cy + (y - cy) * (1 - shrink)]) };
    });
  }
  const points = list.flatMap((region) => region.points);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  let deepest = 0;
  for (let x = Math.min(...xs) + 0.0137; x < Math.max(...xs); x += step) {
    for (let y = Math.min(...ys) + 0.0291; y < Math.max(...ys); y += step) deepest = Math.max(deepest, list.filter((region) => insidePolygon([x, y], region.points)).length);
  }
  return deepest;
}

const figureOf = (id: string, sectors?: number) => {
  const entry = fixture(id);
  const segment = entry.segment('en-US') as { visual: { type: ProofVisual }; payload: Record<string, unknown> };
  return { entry, figure: proofFigure(segment.visual.type, segment.payload, sectors)!, segment };
};
const near = (actual: number, expected: number, tolerance = 1e-3) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(expected)));

describe('F1.15 visual proofs: the figures', () => {
  it('builds a figure for every fixture and refuses malformed payloads', () => {
    for (const entry of proofFixtures) {
      const segment = entry.segment('en-US') as { visual: { type: ProofVisual }; payload: Record<string, unknown> };
      expect(proofFigure(segment.visual.type, segment.payload), entry.id).not.toBeNull();
      expect(proofPayloadProblem(segment.visual.type, segment.payload), entry.id).toBeNull();
    }
    expect(proofPayloadProblem('triangle-area', { base: 8, height: 5, apex: 9, choices: ['half-base-height', 'base-height', 'base-plus-height'] })).not.toBeNull();
    expect(proofPayloadProblem('triangle-area', { base: 8, height: 5, apex: 3, choices: ['base-height', 'base-plus-height', 'base-height'] })).not.toBeNull();
    expect(proofPayloadProblem('triangle-area', { base: 8, height: 5, apex: 3, choices: ['base-height', 'base-plus-height', 'pi-diameter'] })).not.toBeNull();
    expect(proofPayloadProblem('pythagoras-proof', { a: 5, b: 6, choices: ['legs-squares-sum', 'legs-sum', 'legs-product'] })).not.toBeNull();
    expect(proofPayloadProblem('circle-area', { radius: 5, sectors: [8, 6], choices: ['pi-r-squared', 'pi-diameter', 'pi-radius'] })).not.toBeNull();
    expect(proofPayloadProblem('circle-area', { radius: 5, sectors: [8, 9], choices: ['pi-r-squared', 'pi-diameter', 'pi-radius'] })).not.toBeNull();
    expect(proofPayloadProblem('odd-sum-proof', { n: 9, choices: ['n-times-n', 'n-plus-n', 'n-times-two'] })).not.toBeNull();
    expect(proofPayloadProblem('triangle-area', null)).not.toBeNull();
    expect(proofPayloadProblem('nope', {})).not.toBeNull();
    expect(proofFigure('triangle-area', { base: 0 })).toBeNull();
  });

  it('moves only rigid pieces: every piece keeps its area at both poses', () => {
    for (const entry of proofFixtures) {
      const { figure } = figureOf(entry.id);
      for (const piece of figure.pieces) {
        near(polygonArea(placePolygon(piece.base, piece.from)), polygonArea(piece.base), 1e-3);
        near(polygonArea(placePolygon(piece.base, piece.to)), polygonArea(piece.base), 1e-3);
      }
      expect(figure.pieces.length, entry.id).toBeGreaterThan(0);
      expect(figure.extent.maxX).toBeGreaterThan(figure.extent.minX);
      expect(figure.extent.maxY).toBeGreaterThan(figure.extent.minY);
    }
  });

  it('turns a parallelogram into a rectangle of the same area', () => {
    const { figure } = figureOf('parallelogram');
    near(sum(regions(figure, 'from')), 24);
    near(sum(regions(figure, 'to')), 24);
    expect(deepestOverlap(regions(figure, 'from'))).toBe(1);
    expect(deepestOverlap(regions(figure, 'to'))).toBe(1);
    const end = placePolygon(figure.pieces[0]!.base, figure.pieces[0]!.to);
    expect(end.some(([x]) => x === 6 + 2)).toBe(true);
  });

  it('doubles a triangle and a trapezoid into a parallelogram', () => {
    for (const [id, whole] of [['triangle', 40], ['trapezoid', 84]] as const) {
      const { figure } = figureOf(id);
      near(sum(regions(figure, 'to')), whole);
      expect(deepestOverlap(regions(figure, 'to')), id).toBe(1);
      expect(deepestOverlap(regions(figure, 'from')), id).toBe(1);
      near(sum(regions(figure, 'from')), whole);
      const value = proofValue(id === 'triangle' ? 'triangle-area' : 'trapezoid-area', fixture(id).segment('en-US').payload as Record<string, unknown>)!;
      near((Number(value.n) / Number(value.d)) * 2, whole);
    }
  });

  it('lays circle slices side by side at every slice count, nearer a rectangle as they get thinner', () => {
    const sectors = [8, 16, 32];
    for (const count of sectors) {
      const { figure } = figureOf('circle-area', count);
      expect(figure.pieces.length).toBe(count);
      expect(proofGroups(figure)).toEqual(['slices']);
      near(sum(regions(figure, 'to')), Math.PI * 25, 0.02);
      expect(deepestOverlap(regions(figure, 'to'), 0.2, 0.01)).toBe(1);
      expect(deepestOverlap(regions(figure, 'from'), 0.2, 0.01)).toBe(1);
      const all = [...regions(figure, 'from'), ...regions(figure, 'to')];
      expect(deepestOverlap(all, 0.2, 0.01), `slice count ${count}: the circle and the row never collide`).toBe(1);
      const width = Math.max(...regions(figure, 'to').flatMap((region) => region.points.map(([x]) => x))) - Math.min(...regions(figure, 'to').flatMap((region) => region.points.map(([x]) => x)));
      near(width, Math.PI * 5, 0.2);
    }
    const coarse = figureOf('circle-area', 8).figure;
    const fine = figureOf('circle-area', 32).figure;
    const ragged = (figure: ProofFigure) => {
      const tops = figure.pieces.filter((piece) => piece.to.angle === 0).map((piece) => Math.max(...placePolygon(piece.base, piece.to).map(([, y]) => y)));
      return Math.max(...tops) - Math.min(...placePolygon(figure.pieces[0]!.base, figure.pieces[0]!.to).map(([, y]) => y));
    };
    expect(ragged(fine)).toBeLessThanOrEqual(ragged(coarse) + 1e-9);
    expect(figureOf('circle-area').figure.pieces.length).toBe(8);
    expect(figureOf('circle-area', 7).figure.pieces.length).toBe(8);
  });

  it('rolls a wheel one circumference along the ground for one turn', () => {
    const { figure } = figureOf('circumference');
    const disc = figure.pieces.find((piece) => piece.id === 'disc')!;
    const spoke = figure.pieces.find((piece) => piece.id === 'spoke')!;
    expect(proofGroups(figure)).toEqual(['wheel']);
    near(Math.abs(disc.to.dx - disc.from.dx), 3.5 * Math.abs(disc.to.angle) * (Math.PI / 180), 1e-3);
    near(figure.measure!.length, Math.PI * 7, 1e-3);
    expect(figure.measure!.marks).toEqual([7, 14, 21]);
    expect(Math.abs(spoke.to.angle - spoke.from.angle)).toBe(360);
    expect(placePolygon(spoke.base, spoke.from).some(([, y]) => Math.abs(y) < 1e-6)).toBe(true);
    near(polygonArea(placePolygon(disc.base, disc.from)), Math.PI * 3.5 * 3.5, 0.01);
  });

  it('proves Pythagoras by rearranging four triangles in a frame', () => {
    const { figure } = figureOf('pythagoras');
    expect(figure.pieces.length).toBe(3);
    expect(figure.fixed.filter((shape) => !STILL.has(shape.tone)).length).toBe(1);
    near(sum(regions(figure, 'from')), 14 * 14);
    near(sum(regions(figure, 'to')), 14 * 14);
    expect(deepestOverlap(regions(figure, 'from'))).toBe(1);
    expect(deepestOverlap(regions(figure, 'to'))).toBe(1);
    const hypotenuse = figure.remainders!.from[0]!.points;
    const side = (index: number) => Math.hypot(hypotenuse[(index + 1) % 4]![0] - hypotenuse[index]![0], hypotenuse[(index + 1) % 4]![1] - hypotenuse[index]![1]);
    for (let index = 0; index < 4; index += 1) near(side(index), 10);
    near(polygonArea(hypotenuse), 100);
    near(figure.remainders!.to.reduce((total, shape) => total + polygonArea(shape.points), 0), 36 + 64);
  });

  it('builds a square from the odd numbers', () => {
    for (const n of [3, 4, 5, 6, 7]) {
      const { figure } = figureOf('odd-sum');
      const custom = proofFigure('odd-sum-proof', { n, choices: ['n-times-n', 'n-plus-n', 'n-times-two'] })!;
      expect(custom.pieces.length).toBe(n);
      expect(custom.pieces.map((piece) => polygonArea(piece.base))).toEqual(Array.from({ length: n }, (_, index) => 2 * (index + 1) - 1));
      near(sum(regions(custom, 'to')), n * n);
      expect(deepestOverlap(regions(custom, 'to'), 0.13), `n=${n} end`).toBe(1);
      const tray = regions(custom, 'from');
      expect(deepestOverlap(tray, 0.13), `n=${n} tray`).toBe(1);
      const frame = custom.fixed.find((shape) => shape.tone === 'frame')!.points;
      expect(tray.every((region) => region.points.every(([x]) => x > n)), `n=${n}: the tray sits beside the frame`).toBe(true);
      expect(frame.length).toBe(4);
      expect(figure.pieces.length).toBe(5);
    }
  });
});

describe('F1.15 visual proofs: the key and the grade', () => {
  it('derives the key from the geometry with pi at 3.14', () => {
    const keys = Object.fromEntries(proofFixtures.map((entry) => [entry.id, proofKey((entry.segment('en-US') as { visual: { type: ProofVisual } }).visual.type, entry.segment('en-US').payload as Record<string, unknown>)]));
    expect(keys).toEqual({
      parallelogram: { choice: 'base-height', value: '24' }, triangle: { choice: 'half-base-height', value: '20' },
      trapezoid: { choice: 'half-sum-bases-height', value: '42' }, 'circle-area': { choice: 'pi-r-squared', value: '78.5' },
      circumference: { choice: 'pi-diameter', value: '21.98' }, pythagoras: { choice: 'legs-squares-sum', value: '10' }, 'odd-sum': { choice: 'n-times-n', value: '25' },
    });
    for (const entry of proofFixtures) expect(entry.rubric, entry.id).toEqual(keys[entry.id]);
    for (const visual of PROOF_VISUALS) expect(PROOF_FORMULAS[visual].pool).toContain(PROOF_FORMULAS[visual].correct);
    expect(proofKey('triangle-area', { base: 0 })).toBeNull();
    expect(sameProofValue('21.98', '21.98')).toBe(true);
    expect(sameProofValue('21.980', '21.98')).toBe(false);
    expect(sameProofValue('1,5', '1.5')).toBe(false);
  });

  const triangle = fixture('triangle');
  const segment = triangle.segment('en-US');

  it('is met on the right formula and the right value, review when either is wrong', () => {
    expect(gradeProof(segment, { choice: 'half-base-height', value: '20' }, triangle.rubric)).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(gradeProof(segment, { choice: 'half-base-height', value: '40' }, triangle.rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(gradeProof(segment, { choice: 'base-height', value: '20' }, triangle.rubric).verdict).toBe('review');
    expect(gradeProof(segment, { choice: 'base-height', value: '40' }, triangle.rubric).verdict).toBe('review');
    expect(gradeProof(fixture('circle-area').segment('en-US'), { choice: 'pi-r-squared', value: '78.5' }, fixture('circle-area').rubric).verdict).toBe('met');
    expect(gradeProof(fixture('circle-area').segment('en-US'), { choice: 'pi-r-squared', value: '78.50' }, fixture('circle-area').rubric).verdict).toBe('invalid');
  });

  it('is valid until both a prediction and a number are in', () => {
    expect(gradeProof(segment, { choice: '', value: '' }, triangle.rubric).verdict).toBe('valid');
    expect(gradeProof(segment, { choice: 'half-base-height', value: '' }, triangle.rubric).verdict).toBe('valid');
    expect(gradeProof(segment, { choice: '', value: '20' }, triangle.rubric).verdict).toBe('valid');
  });

  it('is invalid for a formula not offered, malformed text, extra fields and a wrong visual', () => {
    expect(gradeProof(segment, { choice: 'pi-r-squared', value: '' }, triangle.rubric).verdict).toBe('invalid');
    expect(gradeProof(segment, { choice: 'nonsense', value: '' }, triangle.rubric).verdict).toBe('invalid');
    expect(gradeProof(segment, { choice: 'half-base-height', value: '2 0' }, triangle.rubric).verdict).toBe('invalid');
    expect(gradeProof(segment, { choice: 'half-base-height', value: 20 }, triangle.rubric).verdict).toBe('invalid');
    expect(gradeProof(segment, { choice: 'half-base-height', value: '20', extra: 1 }, triangle.rubric).verdict).toBe('invalid');
    expect(gradeProof({ ...segment, visual: { type: 'circle-area' } }, { choice: '', value: '' }, triangle.rubric).verdict).toBe('invalid');
  });

  it('refuses a key that does not match its geometry, never met', () => {
    const met = { choice: 'half-base-height', value: '20' };
    expect(gradeProof(segment, met, { choice: 'half-base-height', value: '40' }).verdict).toBe('invalid');
    expect(gradeProof(segment, met, { choice: 'base-height', value: '20' }).verdict).toBe('invalid');
    expect(gradeProof(segment, { choice: '', value: '' }, { choice: 'base-height', value: '20' }).verdict).toBe('invalid');
    expect(gradeProof(segment, met, { choice: 'half-base-height', value: '20.0' }).verdict).toBe('invalid');
    expect(gradeProof(segment, met, { choice: 'half-base-height', value: '20', extra: 1 }).verdict).toBe('invalid');
    expect(gradeProof(segment, met, null).verdict).toBe('invalid');
  });

  it('never says met in the browser, which holds no rubric', () => {
    expect(gradeProof(segment, { choice: 'half-base-height', value: '20' }, undefined).verdict).toBe('valid');
    expect(gradeProof(segment, { choice: 'pi-r-squared', value: '20' }, undefined).verdict).toBe('invalid');
  });
});

describe('balance pack in Core', () => {
  it('is open to ages 10-14 and 10-15 only', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope(BALANCE_TYPE, '10-12', 10, 12)).toBeNull();
    expect(scope(BALANCE_TYPE, '13-17', 13, 14)).toBeNull();
    expect(scope(BALANCE_TYPE, '13-17', 13, 15)).not.toBeNull();
    expect(scope(BALANCE_TYPE, '6-9', 6, 9)).not.toBeNull();
    expect(scope(BALANCE_TYPE, 'adult', 18, 99)).not.toBeNull();
    expect(scope(PROOF_TYPE, '13-17', 13, 15)).toBeNull();
    expect(scope(PROOF_TYPE, '13-17', 13, 16)).not.toBeNull();
    expect(scope(PROOF_TYPE, '6-9', 6, 9)).not.toBeNull();
    expect(scope(PROOF_TYPE, 'adult', 18, 99)).not.toBeNull();
  });

  it('plugs into Core: public schema, answer key and the server grade, in every locale', () => {
    for (const entry of BALANCE_FIXTURES) {
      for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry, locale)).success, `${entry.id} ${locale}`).toBe(true);
      const document = lesson(entry);
      const id = entry.segment('en-US').id as string;
      const keys = { [id]: entry.rubric };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.valid), entry.id).toBeNull();
      expect(horizonteSampleVerdict(entry.segment('en-US') as { type: string }, entry.rubric), entry.id).toBe('valid');
    }
    const document = lesson(fixture('two-sides'));
    const id = fixture('two-sides').segment('en-US').id as string;
    const parsed = v2PublicLessonSchema.parse(document);
    expect(gradeV2Visual(parsed, { [id]: { x: 3 } }, id, { steps: ['sub-x'], answer: '3' })).toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
    expect(validateV2LessonForGrading(document, { [id]: { x: 5 } }, { lessonId: document.lesson_id, locale: document.locale })).toBeNull();
    expect(horizonteGrade({ type: BALANCE_TYPE }, { steps: [], answer: '' }, { x: 3 })).toBeNull();
  });

  it('refuses a payload that leaks the answer, a wrong visual and an out-of-scope document', () => {
    const base = lesson(fixture('two-sides'));
    const withPayload = (payload: unknown) => ({ ...base, segments: [{ ...base.segments[0], payload }] });
    const start = { l: { x: 3, u: 2 }, r: { x: 1, u: 8 } };
    expect(v2PublicLessonSchema.safeParse(withPayload({ start, ops: ['sub-x', 'sub-unit'], x: 3 })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ start, ops: ['slip-left'] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse(withPayload({ start: { l: { x: 0, u: 2 }, r: { x: 0, u: 8 } }, ops: ['sub-x'] })).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 } }).success).toBe(false);
    const proof = lesson(fixture('triangle'));
    const withVisual = (visual: string) => ({ ...proof, segments: [{ ...proof.segments[0], visual: { type: visual } }] });
    expect(v2PublicLessonSchema.safeParse(withVisual('circle-area')).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...proof, segments: [{ ...proof.segments[0], payload: { ...(proof.segments[0]!.payload as object), choice: 'half-base-height' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...proof, segments: [{ ...proof.segments[0], payload: { ...(proof.segments[0]!.payload as object), value: '20' } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...proof, age_band: '13-17', eligibility: { minimum_age: 13, maximum_age: 16 } }).success).toBe(false);
  });
});
