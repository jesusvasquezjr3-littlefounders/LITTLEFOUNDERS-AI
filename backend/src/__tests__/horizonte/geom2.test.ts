import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { geom2 } from '../../services/horizonte/geom2/index.js';
import { GEOM2_FIXTURES } from '../../services/horizonte/geom2/fixtures.js';
import { GEOM2_CAPABILITIES } from '../../services/horizonte/geom2/capabilities.js';
import { areaCells, isAreaSquaresPayload } from '../../services/horizonte/geom2/areaModel.js';
import { findBand, isGeoboardRubric, readBand } from '../../services/horizonte/geom2/geoboardModel.js';
import { area2, cellsInside, cornersOf, isOrthogonal, isSimplePolygon, matchesShape, segmentsMeet, type Lattice } from '../../services/horizonte/geom2/geometry.js';
import { floorFrom, isTessellationPayload, placeTiles, solveTiling } from '../../services/horizonte/geom2/tessellationModel.js';
import { applyMove, imageOf, isMirrorSetup, isTransformMove, isTransformPayload } from '../../services/horizonte/geom2/transformModel.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const grade = (type: string) => geom2.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => GEOM2_FIXTURES.find((candidate) => candidate.id === id)!;
const at = (x: number, y: number): Lattice => ({ x, y });
const pts = (...list: Array<[number, number]>): Lattice[] => list.map(([x, y]) => at(x, y));
const run = (id: string, response: unknown, rubric: unknown = fixture(id).rubric) => grade(fixture(id).segment('en-US').type as string)(fixture(id).segment('en-US'), response, rubric);
const advisory = (id: string, response: unknown) => grade(fixture(id).segment('en-US').type as string)(fixture(id).segment('en-US'), response, undefined);

function lesson(entry = GEOM2_FIXTURES[0]!, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const segment = entry.segment(locale);
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${entry.ageBand}`, chapter_id: 'horizonte-geom2', lesson_id: `hz-geom2-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...GEOM2_CAPABILITIES[segment.type as keyof typeof GEOM2_CAPABILITIES]], segments: [segment],
  };
}

describe('geom2 pack: F2.7 geoboard and area by squares, F2.8 transformations and tessellations', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(geom2, GEOM2_FIXTURES)).not.toThrow();
  });

  it('covers every move and both mirror and tiling puzzles with a fixture', () => {
    const moves = GEOM2_FIXTURES.filter((entry) => entry.segment('en-US').type === 'math.transform.v2').map((entry) => ((entry.segment('en-US').payload as { move: { kind: string } }).move.kind));
    expect(new Set(moves)).toEqual(new Set(['translate', 'reflect', 'rotate', 'dilate']));
    expect(GEOM2_FIXTURES.some((entry) => (entry.segment('en-US').visual as { type: string }).type === 'symmetry-mirror')).toBe(true);
    expect(GEOM2_FIXTURES.filter((entry) => entry.segment('en-US').type === 'math.tessellation.v2').length).toBeGreaterThanOrEqual(3);
  });

  describe('plane geometry', () => {
    it('tells simple bands from tangled ones', () => {
      expect(isSimplePolygon(pts([0, 0], [4, 0], [0, 2]))).toBe(true);
      expect(isSimplePolygon(pts([0, 0], [2, 2], [2, 0], [0, 2]))).toBe(false);
      expect(isSimplePolygon(pts([0, 0], [1, 1], [2, 2]))).toBe(false);
      expect(isSimplePolygon(pts([0, 0], [4, 0], [4, 4], [2, 0], [0, 4]))).toBe(false);
      expect(isSimplePolygon(pts([0, 0], [2, 0], [1, 0], [1, 2]))).toBe(false);
      expect(isSimplePolygon(pts([0, 0], [1, 0], [0, 0]))).toBe(false);
      expect(segmentsMeet(at(0, 0), at(2, 2), at(0, 2), at(2, 0))).toBe(true);
      expect(segmentsMeet(at(0, 0), at(1, 0), at(2, 0), at(3, 0))).toBe(false);
    });

    it('measures area in half squares and reads only the corners of a figure', () => {
      expect(area2(pts([0, 0], [3, 0], [3, 2], [0, 2]))).toBe(12);
      expect(area2(pts([0, 0], [4, 0], [0, 2]))).toBe(8);
      expect(cornersOf(pts([0, 0], [1, 0], [2, 0], [2, 2], [0, 2]))).toHaveLength(4);
      expect(matchesShape(pts([0, 0], [2, 0], [2, 2], [0, 2]), 'square')).toBe(true);
      expect(matchesShape(pts([0, 0], [3, 0], [3, 2], [0, 2]), 'square')).toBe(false);
      expect(matchesShape(pts([0, 0], [3, 0], [3, 2], [0, 2]), 'rectangle')).toBe(true);
      expect(matchesShape(pts([0, 0], [3, 0], [4, 2], [1, 2]), 'parallelogram')).toBe(true);
      expect(matchesShape(pts([0, 0], [3, 0], [4, 2], [1, 2]), 'rectangle')).toBe(false);
      expect(matchesShape(pts([0, 0], [4, 0], [0, 2]), 'right-triangle')).toBe(true);
      expect(matchesShape(pts([0, 0], [4, 0], [1, 2]), 'right-triangle')).toBe(false);
      expect(matchesShape(pts([0, 0], [4, 0], [1, 2]), 'triangle')).toBe(true);
    });

    it('counts the squares inside an outline along the grid', () => {
      const outline = pts([0, 0], [4, 0], [4, 2], [2, 2], [2, 3], [0, 3]);
      expect(isOrthogonal(outline)).toBe(true);
      expect(isOrthogonal(pts([0, 0], [3, 0], [0, 3]))).toBe(false);
      expect(cellsInside(outline, 5, 4)).toHaveLength(10);
      expect(areaCells({ columns: 5, rows: 4, outline })).toHaveLength(10);
    });
  });

  describe('F2.7 geoboard (E02)', () => {
    const six = fixture('geoboard-area-six');
    const triangle = fixture('geoboard-right-triangle');

    it('reads a band as none, or a simple closed band of pegs on the board', () => {
      expect(readBand({ points: [] }, 5)).toEqual({ kind: 'untouched' });
      expect(readBand({ points: pts([0, 0], [4, 0], [0, 2]) }, 5)).toMatchObject({ kind: 'band' });
      expect(readBand({ points: pts([0, 0], [1, 0]) }, 5)).toBeNull();
      expect(readBand({ points: pts([0, 0], [5, 0], [5, 1]) }, 5)).toBeNull();
      expect(readBand({ points: pts([0, 0], [4, 0], [4, 0]) }, 5)).toBeNull();
      expect(readBand({ points: pts([0, 0], [2, 2], [2, 0], [0, 2]) }, 5)).toBeNull();
      expect(readBand({ points: [{ x: 0.5, y: 0 }, at(1, 0), at(0, 1)] }, 5)).toBeNull();
      expect(readBand({ points: pts([0, 0], [4, 0], [0, 2]), extra: 1 }, 5)).toBeNull();
    });

    it('grades the area, then the named figure', () => {
      expect(run('geoboard-area-six', { points: pts([0, 0], [3, 0], [3, 2], [0, 2]) }).verdict).toBe('met');
      expect(run('geoboard-area-six', { points: pts([0, 0], [4, 0], [0, 3]) }).verdict).toBe('met');
      expect(run('geoboard-area-six', { points: pts([0, 0], [1, 0], [1, 1], [0, 1]) })).toEqual({ verdict: 'review', diagnostic: 'value' });
      expect(run('geoboard-area-six', { points: [] }).verdict).toBe('valid');
      expect(run('geoboard-right-triangle', { points: pts([0, 0], [4, 0], [0, 2]) }).verdict).toBe('met');
      expect(run('geoboard-right-triangle', { points: pts([0, 0], [2, 0], [2, 2], [0, 2]) })).toEqual({ verdict: 'review', diagnostic: 'miss' });
      expect(run('geoboard-right-triangle', { points: pts([0, 0], [4, 0], [1, 2]) })).toEqual({ verdict: 'review', diagnostic: 'miss' });
      expect(run('geoboard-right-triangle', { points: pts([0, 0], [2, 0], [0, 1]) })).toEqual({ verdict: 'review', diagnostic: 'value' });
    });

    it('refuses a malformed key and never says met without one', () => {
      expect(isGeoboardRubric({ area2: 12 }, 5)).toBe(true);
      expect(isGeoboardRubric({ area2: 33 }, 5)).toBe(false);
      expect(isGeoboardRubric({ area2: 0 }, 5)).toBe(false);
      expect(isGeoboardRubric({ area2: 2.5 }, 5)).toBe(false);
      expect(isGeoboardRubric({ area2: 12, shape: 'hexagon' }, 5)).toBe(false);
      expect(run('geoboard-area-six', { points: pts([0, 0], [3, 0], [3, 2], [0, 2]) }, { area2: 99 }).verdict).toBe('invalid');
      expect(run('geoboard-area-six', { points: pts([0, 0], [3, 0], [3, 2], [0, 2]) }, { area2: 12, extra: 1 }).verdict).toBe('invalid');
      expect(advisory('geoboard-area-six', { points: pts([0, 0], [3, 0], [3, 2], [0, 2]) }).verdict).toBe('valid');
      expect(six.rubric).toEqual({ area2: 12 });
      expect(triangle.rubric).toEqual({ area2: 8, shape: 'right-triangle' });
    });

    it('finds a band for a key the board can hold and none for one it cannot', () => {
      expect(findBand(5, { area2: 12 })).not.toBeNull();
      expect(findBand(5, { area2: 8, shape: 'right-triangle' })).not.toBeNull();
      expect(findBand(5, { area2: 12, shape: 'parallelogram' })).not.toBeNull();
      expect(findBand(5, { area2: 12, shape: 'square' })).toBeNull();
      expect(findBand(3, { area2: 9 })).toBeNull();
    });
  });

  describe('F2.7 area by squares (E22)', () => {
    const cells = areaCells({ columns: 5, rows: 4, outline: pts([0, 0], [4, 0], [4, 2], [2, 2], [2, 3], [0, 3]) });

    it('grades the shading against the squares inside the outline', () => {
      expect(run('area-l-shape', { points: cells }).verdict).toBe('met');
      expect(run('area-l-shape', { points: cells.slice(1) })).toEqual({ verdict: 'review', diagnostic: 'miss' });
      expect(run('area-l-shape', { points: [...cells, at(4, 3)] })).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
      expect(run('area-l-shape', { points: [...cells.slice(1), at(4, 3)] })).toEqual({ verdict: 'review', diagnostic: 'partial' });
      expect(run('area-l-shape', { points: [at(4, 3)] })).toEqual({ verdict: 'review', diagnostic: 'value' });
      expect(run('area-l-shape', { points: [] }).verdict).toBe('valid');
    });

    it('refuses squares off the grid, repeated squares and a key that is not the outline', () => {
      expect(run('area-l-shape', { points: [at(5, 0)] }).verdict).toBe('invalid');
      expect(run('area-l-shape', { points: [at(0, 0), at(0, 0)] }).verdict).toBe('invalid');
      expect(run('area-l-shape', { points: [{ x: 0.5, y: 0 }] }).verdict).toBe('invalid');
      expect(run('area-l-shape', { points: cells }, { required: cells.slice(1) }).verdict).toBe('invalid');
      expect(run('area-l-shape', { points: cells }, { required: [...cells, at(4, 3)] }).verdict).toBe('invalid');
      expect(run('area-l-shape', { points: cells }, { required: cells, extra: 'allow' }).verdict).toBe('invalid');
      expect(advisory('area-l-shape', { points: cells }).verdict).toBe('valid');
    });

    it('accepts only a simple outline along the grid lines that covers 1 to 32 squares', () => {
      expect(isAreaSquaresPayload({ columns: 5, rows: 4, outline: pts([0, 0], [4, 0], [4, 2], [2, 2], [2, 3], [0, 3]) })).toBe(true);
      expect(isAreaSquaresPayload({ columns: 3, rows: 3, outline: pts([0, 0], [3, 0], [0, 3], [0, 1]) })).toBe(false);
      expect(isAreaSquaresPayload({ columns: 4, rows: 4, outline: pts([0, 0], [2, 0], [4, 0], [4, 4], [0, 4]) })).toBe(false);
      expect(isAreaSquaresPayload({ columns: 8, rows: 8, outline: pts([0, 0], [8, 0], [8, 8], [0, 8]) })).toBe(false);
      expect(isAreaSquaresPayload({ columns: 3, rows: 3, outline: pts([0, 0], [4, 0], [4, 2], [0, 2]) })).toBe(false);
      expect(isAreaSquaresPayload({ columns: 3, rows: 3, outline: pts([0, 0], [2, 0], [2, 2], [0, 2]), answer: [] })).toBe(false);
    });
  });

  describe('F2.8 transformations (E07, E09, E10)', () => {
    it('applies each move to a peg', () => {
      expect(applyMove({ kind: 'translate', dx: -2, dy: 3 }, at(1, 1))).toEqual(at(-1, 4));
      expect(applyMove({ kind: 'reflect', across: 'vertical', at: 2 }, at(5, 1))).toEqual(at(-1, 1));
      expect(applyMove({ kind: 'reflect', across: 'horizontal', at: -1 }, at(3, 2))).toEqual(at(3, -4));
      expect(applyMove({ kind: 'reflect', across: 'diagonal', at: 0 }, at(2, 1))).toEqual(at(1, 2));
      expect(applyMove({ kind: 'reflect', across: 'diagonal', at: 1 }, at(2, 1))).toEqual(at(0, 3));
      expect(applyMove({ kind: 'reflect', across: 'anti-diagonal', at: 0 }, at(2, 1))).toEqual(at(-1, -2));
      expect(applyMove({ kind: 'rotate', degrees: 90, about: at(0, 0) }, at(1, 2))).toEqual(at(-2, 1));
      expect(applyMove({ kind: 'rotate', degrees: 180, about: at(1, 1) }, at(3, 2))).toEqual(at(-1, 0));
      expect(applyMove({ kind: 'rotate', degrees: 270, about: at(0, 0) }, at(1, 2))).toEqual(at(2, -1));
      expect(applyMove({ kind: 'dilate', num: 3, den: 2, about: at(0, 0) }, at(2, 4))).toEqual(at(3, 6));
      expect(applyMove({ kind: 'dilate', num: 1, den: 2, about: at(0, 0) }, at(3, 1))).toBeNull();
      expect(imageOf({ kind: 'dilate', num: 1, den: 2, about: at(0, 0) }, pts([2, 2], [3, 1]))).toBeNull();
    });

    it('accepts only a well-formed move', () => {
      expect(isTransformMove({ kind: 'translate', dx: 1, dy: 0 })).toBe(true);
      expect(isTransformMove({ kind: 'translate', dx: 0, dy: 0 })).toBe(false);
      expect(isTransformMove({ kind: 'dilate', num: 2, den: 2, about: at(0, 0) })).toBe(false);
      expect(isTransformMove({ kind: 'dilate', num: 2, den: 4, about: at(0, 0) })).toBe(false);
      expect(isTransformMove({ kind: 'dilate', num: 5, den: 1, about: at(0, 0) })).toBe(false);
      expect(isTransformMove({ kind: 'rotate', degrees: 45, about: at(0, 0) })).toBe(false);
      expect(isTransformMove({ kind: 'reflect', across: 'sideways', at: 0 })).toBe(false);
      expect(isTransformMove({ kind: 'reflect', across: 'vertical', at: 0, extra: 1 })).toBe(false);
      expect(isTransformMove({ kind: 'spin' })).toBe(false);
      expect(isTransformMove(null)).toBe(false);
    });

    it('accepts only a payload whose image is on pegs, inside the plane and elsewhere', () => {
      const figure = pts([1, 1], [3, 1], [1, 3]);
      expect(isTransformPayload({ extent: 5, figure, move: { kind: 'translate', dx: 1, dy: 1 } })).toBe(true);
      expect(isTransformPayload({ extent: 3, figure, move: { kind: 'translate', dx: 3, dy: 0 } })).toBe(false);
      expect(isTransformPayload({ extent: 5, figure: pts([-1, -1], [1, -1], [1, 1], [-1, 1]), move: { kind: 'rotate', degrees: 90, about: at(0, 0) } })).toBe(false);
      expect(isTransformPayload({ extent: 5, figure: pts([0, 0], [2, 2], [2, 0], [0, 2]), move: { kind: 'translate', dx: 1, dy: 0 } })).toBe(false);
      expect(isTransformPayload({ extent: 5, figure: pts([1, 1], [2, 1], [1, 2]), move: { kind: 'dilate', num: 1, den: 2, about: at(0, 0) } })).toBe(false);
      expect(isTransformPayload({ extent: 5, figure, move: { kind: 'translate', dx: 1, dy: 1 }, answer: [] })).toBe(false);
    });

    it('limits the mirror to a vertical or horizontal line with the figure on one side', () => {
      expect(isMirrorSetup(fixture('mirror-half').segment('en-US').payload as never)).toBe(true);
      expect(isMirrorSetup(fixture('rotate-quarter').segment('en-US').payload as never)).toBe(false);
      expect(isMirrorSetup({ extent: 5, figure: pts([-1, 0], [1, 0], [0, 2]), move: { kind: 'reflect', across: 'vertical', at: 0 } })).toBe(false);
      expect(isMirrorSetup({ extent: 5, figure: pts([1, 1], [2, 1], [1, 2]), move: { kind: 'reflect', across: 'diagonal', at: 0 } })).toBe(false);
      const base = lesson(fixture('mirror-half'));
      const diagonal = { ...base, segments: [{ ...base.segments[0], payload: { extent: 5, figure: pts([1, 1], [3, 1], [1, 4]), move: { kind: 'reflect', across: 'diagonal', at: 0 } } }] };
      expect(v2PublicLessonSchema.safeParse(diagonal).success).toBe(false);
    });

    it('grades the image as a point set, in any order', () => {
      const image = pts([-1, 1], [-3, 1], [-1, 4]);
      expect(run('reflect-triangle', { points: image }).verdict).toBe('met');
      expect(run('reflect-triangle', { points: [image[2]!, image[0]!, image[1]!] }).verdict).toBe('met');
      expect(run('reflect-triangle', { points: image.slice(0, 2) })).toEqual({ verdict: 'review', diagnostic: 'miss' });
      expect(run('reflect-triangle', { points: [...image.slice(0, 2), at(-1, 3)] })).toEqual({ verdict: 'review', diagnostic: 'partial' });
      expect(run('reflect-triangle', { points: pts([2, 2], [3, 3], [4, 4]) })).toEqual({ verdict: 'review', diagnostic: 'value' });
      expect(run('reflect-triangle', { points: pts([1, 1], [3, 1], [1, 4]) }).verdict).toBe('valid');
      expect(run('reflect-triangle', { points: pts([1, 4], [1, 1], [3, 1]) }).verdict).toBe('valid');
    });

    it('refuses pegs off the plane, too many points and a key that is not the image', () => {
      expect(run('reflect-triangle', { points: [at(6, 0)] }).verdict).toBe('invalid');
      expect(run('reflect-triangle', { points: pts([0, 0], [1, 0], [2, 0], [3, 0]) }).verdict).toBe('invalid');
      expect(run('reflect-triangle', { points: pts([0, 0], [0, 0]) }).verdict).toBe('invalid');
      expect(run('reflect-triangle', { points: pts([-1, 1], [-3, 1], [-1, 4]) }, { required: pts([1, 1], [3, 1], [1, 4]) }).verdict).toBe('invalid');
      expect(run('reflect-triangle', { points: pts([-1, 1], [-3, 1], [-1, 4]) }, { required: pts([-1, 1], [-3, 1], [-1, 3]) }).verdict).toBe('invalid');
      expect(advisory('reflect-triangle', { points: pts([-1, 1], [-3, 1], [-1, 4]) }).verdict).toBe('valid');
    });
  });

  describe('F2.8 tessellations (E06)', () => {
    const domino = fixture('tile-domino').segment('en-US').payload as { floor: Lattice[]; tile: Lattice[] };
    const bump = fixture('tile-bump').segment('en-US').payload as { floor: Lattice[]; tile: Lattice[] };

    it('accepts a floor that is whole copies of a connected tile and nothing looser', () => {
      expect(isTessellationPayload(domino)).toBe(true);
      expect(isTessellationPayload({ floor: domino.floor, tile: pts([1, 0], [2, 0]) })).toBe(false);
      expect(isTessellationPayload({ floor: pts([0, 0], [2, 0]), tile: pts([0, 0], [2, 0]) })).toBe(false);
      expect(isTessellationPayload({ floor: pts([0, 0], [1, 0], [2, 0]), tile: pts([0, 0], [1, 0]) })).toBe(false);
      expect(isTessellationPayload({ floor: pts([0, 0], [0, 0]), tile: pts([0, 0], [1, 0]) })).toBe(false);
      expect(isTessellationPayload({ floor: pts([11, 0], [12, 0]), tile: pts([0, 0], [1, 0]) })).toBe(false);
      expect(isTessellationPayload({ floor: domino.floor, tile: pts([0, 0]) })).toBe(false);
      expect(isTessellationPayload({ floor: domino.floor, tile: pts([0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]) })).toBe(false);
      const many = floorFrom(domino.tile, Array.from({ length: 25 }, (_, index) => at((index % 5) * 2, Math.floor(index / 5))));
      expect(isTessellationPayload({ floor: many, tile: domino.tile })).toBe(false);
      expect(isTessellationPayload({ ...domino, answer: [] })).toBe(false);
    });

    it('slides copies and reports an overlap, a copy off the floor or the cells covered', () => {
      expect(placeTiles(domino, pts([0, 0], [2, 0]))).toEqual({ kind: 'placed', covered: 4 });
      expect(placeTiles(domino, pts([0, 0], [1, 0]))).toEqual({ kind: 'broken' });
      expect(placeTiles(domino, pts([3, 0]))).toEqual({ kind: 'broken' });
      expect(placeTiles(domino, [])).toEqual({ kind: 'placed', covered: 0 });
    });

    it('solves the floor an author built and says so when no cover exists', () => {
      for (const entry of GEOM2_FIXTURES.filter((candidate) => candidate.segment('en-US').type === 'math.tessellation.v2')) {
        const payload = entry.segment('en-US').payload as { floor: Lattice[]; tile: Lattice[] };
        const anchors = solveTiling(payload);
        expect(anchors, entry.id).not.toBeNull();
        expect(placeTiles(payload, anchors!), entry.id).toEqual({ kind: 'placed', covered: payload.floor.length });
        expect(anchors!.length, entry.id).toBe((entry.rubric as { copies: number }).copies);
      }
      expect(solveTiling({ floor: pts([0, 0], [2, 0]), tile: pts([0, 0], [1, 0]) })).toBeNull();
      expect(solveTiling({ floor: pts([0, 0], [1, 0], [2, 0], [3, 0]), tile: bump.tile })).toBeNull();
    });

    it('grades a partial cover as review, a full one as met and a broken one as invalid', () => {
      expect(run('tile-domino', { points: pts([0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]) }).verdict).toBe('met');
      expect(run('tile-domino', { points: pts([2, 2], [0, 2], [2, 1], [0, 1], [2, 0], [0, 0]) }).verdict).toBe('met');
      expect(run('tile-domino', { points: pts([0, 0]) })).toEqual({ verdict: 'review', diagnostic: 'partial' });
      expect(run('tile-domino', { points: [] }).verdict).toBe('valid');
      expect(run('tile-domino', { points: pts([0, 0], [1, 0]) }).verdict).toBe('invalid');
      expect(run('tile-domino', { points: pts([3, 0]) }).verdict).toBe('invalid');
      expect(run('tile-domino', { points: pts([9, 9]) }).verdict).toBe('invalid');
      expect(run('tile-domino', { points: pts([0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2], [0, 0]) }).verdict).toBe('invalid');
      expect(run('tile-bump', { points: pts([0, 0], [4, 0], [2, 1], [6, 1]) }).verdict).toBe('met');
      expect(run('tile-bump', { points: pts([0, 0], [4, 0], [2, 1]) })).toEqual({ verdict: 'review', diagnostic: 'partial' });
      expect(run('tile-l', { points: pts([0, 0], [1, 1], [2, 2], [3, 3]) }).verdict).toBe('met');
    });

    it('refuses a key that is not the copy count and never says met without one', () => {
      expect(run('tile-domino', { points: pts([0, 0]) }, { copies: 5 }).verdict).toBe('invalid');
      expect(run('tile-domino', { points: pts([0, 0]) }, { copies: 6, extra: 1 }).verdict).toBe('invalid');
      expect(advisory('tile-domino', { points: pts([0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]) }).verdict).toBe('valid');
    });

    it('catches an unsolvable floor at publish through the sample verdict', () => {
      const payload = { floor: pts([0, 0], [2, 0]), tile: pts([0, 0], [1, 0]) };
      const segment = { id: 'tile-gap', type: 'math.tessellation.v2', grading: 'server', visual: { type: 'tessellation' }, prompt: 'Cover the floor.', payload };
      expect(horizonteSampleVerdict(segment, { copies: 1 })).toBe('invalid');
      expect(horizonteSampleVerdict(fixture('tile-bump').segment('en-US') as { type: string }, fixture('tile-bump').rubric)).toBe('met');
    });
  });

  it('is open to ages 8-12 for the geoboard and the area grid, and 8-15 for the plane', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    for (const type of ['math.geoboard.v2', 'math.area-squares.v2']) {
      expect(scope(type, '6-9', 8, 9)).toBeNull();
      expect(scope(type, '10-12', 10, 12)).toBeNull();
      expect(scope(type, '6-9', 6, 9)).not.toBeNull();
      expect(scope(type, '13-17', 13, 15)).not.toBeNull();
      expect(scope(type, 'adult', 18, 99)).not.toBeNull();
    }
    for (const type of ['math.transform.v2', 'math.tessellation.v2']) {
      expect(scope(type, '6-9', 8, 9)).toBeNull();
      expect(scope(type, '13-17', 13, 15)).toBeNull();
      expect(scope(type, '13-17', 13, 17)).not.toBeNull();
      expect(scope(type, '6-9', 6, 9)).not.toBeNull();
      expect(scope(type, 'adult', 18, 99)).not.toBeNull();
    }
  });

  describe('Core', () => {
    it('parses every fixture in every locale against the public schema', () => {
      for (const entry of GEOM2_FIXTURES) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry, locale)).success, `${entry.id} ${locale}`).toBe(true);
    });

    it('accepts the author key, refuses a wrong one and grades on the server', () => {
      for (const entry of GEOM2_FIXTURES) {
        const document = lesson(entry);
        const id = entry.segment('en-US').id as string;
        const expected = { lessonId: document.lesson_id, locale: document.locale };
        expect(validateV2LessonForGrading(document, { [id]: entry.rubric }, expected), entry.id).not.toBeNull();
        const parsed = v2PublicLessonSchema.parse(document);
        expect(gradeV2Visual(parsed, { [id]: entry.rubric }, id, entry.ladder.met), entry.id).toMatchObject({ score: 100, correct: true });
        expect(gradeV2Visual(parsed, { [id]: entry.rubric }, id, entry.ladder.valid), entry.id).toBeNull();
        expect(horizonteGrade({ type: entry.segment('en-US').type as string }, entry.ladder.invalid, entry.rubric), entry.id).toBeNull();
      }
      const triangle = fixture('geoboard-right-triangle');
      const document = lesson(triangle);
      const id = triangle.segment('en-US').id as string;
      expect(validateV2LessonForGrading(document, { [id]: { area2: 99 } }, { lessonId: document.lesson_id, locale: document.locale })).toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, { [id]: triangle.rubric }, id, { points: pts([0, 0], [2, 0], [2, 2], [0, 2]) })).toMatchObject({ score: 0, correct: false, diagnostic: 'miss' });
    });

    it('refuses a payload that leaks the answer or carries the wrong visual', () => {
      const payloadOf = (id: string) => fixture(id).segment('en-US').payload as Record<string, unknown>;
      const withPayload = (id: string, extra: Record<string, unknown>) => {
        const base = lesson(fixture(id));
        return { ...base, segments: [{ ...base.segments[0], payload: { ...payloadOf(id), ...extra } }] };
      };
      expect(v2PublicLessonSchema.safeParse(withPayload('geoboard-area-six', { area2: 12 })).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse(withPayload('area-l-shape', { required: [] })).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse(withPayload('reflect-triangle', { required: [] })).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse(withPayload('tile-domino', { copies: 6 })).success).toBe(false);
      const base = lesson(fixture('geoboard-area-six'));
      expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...base.segments[0], visual: { type: 'area-squares' } }] }).success).toBe(false);
      expect(v2PublicLessonSchema.safeParse({ ...base, age_band: '13-17', eligibility: { minimum_age: 13, maximum_age: 15 } }).success).toBe(false);
    });
  });
});
