import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { space1 } from '../../services/horizonte/space1/index.js';
import { SPACE1_FIXTURES } from '../../services/horizonte/space1/fixtures.js';
import { ANGLES, ROTATION_COUNT, congruentByTurning, matchingAngles, mirrorFigure, turnFigure, type Cell } from '../../services/horizonte/space1/voxels.js';
import {
  ARCHIMEDEAN_IDS, EULER_COUNTS, PLATONIC_COUNTS, PLATONIC_IDS, SECTION_SOLIDS, coneVolume, cylinderVolume, eulerMesh, faceNormalOf, eulerSum, platonicMesh, polyCounts, prismVolume, pyramidVolume, sectionCut, sectionShape, sectionSolidMesh, slideRange, slideShapes,
} from '../../services/horizonte/space1/polyhedra.js';
import { readRotationPayload, rotationAnswer, rotationProblem } from '../../services/horizonte/space1/rotationRules.js';
import { CONE_LIMITS, eulerBounds, readSolidSectionPayload, slideCut, slideSolutions, solidSectionAnswer, solidSectionProblem } from '../../services/horizonte/space1/sectionRules.js';
import { basketMeets, mostItems, readStallPayload, reachableTotals, slotsToBasket, stallAnswer, stallProblem } from '../../services/horizonte/space1/stall.js';
import { coinAnswer, coinPositions, coinProblem, readCoinPayload, stackCents, stackTenths } from '../../services/horizonte/space1/coins.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const ROTATION = 'geometry.mental-rotation.v2';
const SECTION = 'geometry.solid-section.v2';
const STALL = 'money.market-stall.v2';
const COIN = 'money.coin-stack.v2';
const grade = (type: string) => space1.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => SPACE1_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const run = (id: string, response: unknown, rubric: unknown = fixture(id).rubric) => grade(segmentOf(id).type as string)(segmentOf(id), response, rubric);
const bare = (id: string, response: unknown) => grade(segmentOf(id).type as string)(segmentOf(id), response, undefined);

function lesson(id: string, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const entry = fixture(id);
  const segment = entry.segment(locale);
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-6-9', chapter_id: 'horizonte-space1', lesson_id: `hz-space1-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...space1.capabilities[segment.type as keyof typeof space1.capabilities]], segments: [segment],
  };
}

const L: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 1]];

describe('space1 pack: scorer contract', () => {
  it('meets the scorer contract for the four segment types', () => {
    expect(() => assertScorerContract(space1, SPACE1_FIXTURES)).not.toThrow();
  });

  it('keeps every fixture inside the authoring rules', () => {
    for (const entry of SPACE1_FIXTURES) {
      const segment = entry.segment('en-US');
      const payload = segment.payload;
      if (segment.type === ROTATION) expect(rotationProblem(readRotationPayload(payload)!), entry.id).toBeNull();
      if (segment.type === SECTION) expect(solidSectionProblem(readSolidSectionPayload(payload)!), entry.id).toBeNull();
      if (segment.type === STALL) expect(stallProblem(readStallPayload(payload)!), entry.id).toBeNull();
      if (segment.type === COIN) expect(coinProblem(readCoinPayload(payload)!), entry.id).toBeNull();
    }
  });
});

describe('F4.4 mental rotation: discrete angles', () => {
  it('has a rotation group of 24 and tells a mirror from a turn', () => {
    expect(ROTATION_COUNT).toBe(24);
    expect(ANGLES).toEqual([0, 90, 180, 270]);
    const turned = turnFigure(L, 'up', 1);
    expect(congruentByTurning(L, turned)).toBe(true);
    expect(turnFigure(turned, 'up', 3)).toEqual(turnFigure(L, 'up', 0));
    const chiral: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1]];
    expect(congruentByTurning(chiral, mirrorFigure(chiral))).toBe(false);
  });

  it('finds the single target and the angles that carry the figure onto it', () => {
    const payload = readRotationPayload(segmentOf('pick-the-turned').payload)!;
    expect(rotationAnswer(payload)).toEqual({ pick: 'b', angles: [180] });
    expect(matchingAngles(payload.figure, payload.targets[1]!, payload.axis)).toEqual([180]);
    expect(rotationAnswer(readRotationPayload(segmentOf('turn-the-l').payload)!)).toEqual({ pick: 'a', angles: [90] });
    expect(rotationAnswer(readRotationPayload(segmentOf('turn-the-corner').payload)!)).toEqual({ pick: 'c', angles: [270] });
  });

  it('grades the target and the angle', () => {
    expect(run('pick-the-turned', { pick: 'b', angle: 180 })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('pick-the-turned', { pick: 'b', angle: 90 })).toEqual({ verdict: 'review', diagnostic: 'partial' });
    expect(run('pick-the-turned', { pick: 'a', angle: 180 })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('turn-the-l', { pick: 'a', angle: 90 }).verdict).toBe('met');
    expect(run('turn-the-l', { pick: 'a', angle: 270 })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('turn-the-corner', { pick: 'c', angle: 270 }).verdict).toBe('met');
  });

  it('treats an unturned figure or no pick as not yet an answer and refuses off-list input', () => {
    expect(run('pick-the-turned', { pick: 'b', angle: 0 }).verdict).toBe('valid');
    expect(run('pick-the-turned', { pick: '', angle: 180 }).verdict).toBe('valid');
    expect(run('turn-the-l', { pick: 'b', angle: 90 }).verdict).toBe('invalid');
    expect(run('pick-the-turned', { pick: 'd', angle: 90 }).verdict).toBe('invalid');
    expect(run('pick-the-turned', { pick: 'b', angle: 45 }).verdict).toBe('invalid');
    expect(run('pick-the-turned', { pick: 'b', angle: '90' }).verdict).toBe('invalid');
    expect(run('pick-the-turned', { pick: 'b', angle: 90, extra: 1 }).verdict).toBe('invalid');
  });

  it('checks the key against the geometry and never says met without one', () => {
    expect(run('pick-the-turned', { pick: 'b', angle: 180 }, { pick: 'a', angles: [180] }).verdict).toBe('invalid');
    expect(run('pick-the-turned', { pick: 'b', angle: 180 }, { pick: 'b', angles: [90] }).verdict).toBe('invalid');
    expect(run('pick-the-turned', { pick: 'b', angle: 180 }, { pick: 'b' }).verdict).toBe('invalid');
    expect(bare('pick-the-turned', { pick: 'b', angle: 180 }).verdict).toBe('valid');
    expect(bare('pick-the-turned', { pick: 'b', angle: 45 }).verdict).toBe('invalid');
  });

  it('refuses a rotation question without exactly one answer', () => {
    const figure = segmentOf('pick-the-turned').payload as { axis: 'side'; figure: Cell[]; targets: Cell[][] };
    const same = { ...figure, targets: [figure.figure] };
    expect(rotationProblem(readRotationPayload(same)!)).not.toBeNull();
    const twice = { ...figure, targets: [figure.targets[1]!, turnFigure(figure.figure, 'side', 2)] };
    expect(rotationProblem(readRotationPayload(twice)!)).not.toBeNull();
    const none = { ...figure, targets: [figure.targets[0]!, figure.targets[2]!] };
    expect(rotationProblem(readRotationPayload(none)!)).not.toBeNull();
    expect(readRotationPayload({ ...figure, axis: 'diagonal' })).toBeNull();
    expect(readRotationPayload({ ...figure, extra: 1 })).toBeNull();
    expect(readRotationPayload({ ...figure, figure: [[0, 0, 0], [0, 0, 5], [1, 0, 0]] })).toBeNull();
  });
});

describe('F4.5 solids: sections, Euler and a pyramid', () => {
  it('has the right counts for the five Platonic solids and V - E + F = 2', () => {
    for (const id of PLATONIC_IDS) {
      const counts = polyCounts(platonicMesh(id));
      expect(counts, id).toEqual(PLATONIC_COUNTS[id]);
      expect(eulerSum(counts), id).toBe(2);
    }
    expect(PLATONIC_COUNTS.dodecahedron).toEqual({ vertices: 20, edges: 30, faces: 12 });
    expect(PLATONIC_COUNTS.icosahedron).toEqual({ vertices: 12, edges: 30, faces: 20 });
  });

  it('classifies a plane section on the geometry', () => {
    expect(sectionShape('cube', { normal: [1, 1, 1], offset: 0 })).toBe('hexagon');
    expect(sectionShape('tetrahedron', { normal: [1, 0, 0], offset: 0 })).toBe('square');
    expect(sectionShape('cube', { normal: [0, 0, 1], offset: 0 })).toBe('square');
    expect(sectionShape('cube', { normal: [0, 0, 1], offset: 16 })).toBeNull();
  });

  it('computes the prism and the pyramid volume', () => {
    expect(prismVolume(6, 5)).toBe(180);
    expect(pyramidVolume(6, 5)).toBe(60);
    expect(pyramidVolume(5, 5)).toBeNull();
    expect(solidSectionAnswer({ mode: 'volume', side: 6, height: 5 })).toEqual({ target: '60' });
    expect(solidSectionProblem({ mode: 'volume', side: 5, height: 5 })).not.toBeNull();
  });

  it('grades a section pick', () => {
    expect(run('cube-hexagon', { pick: 'hexagon' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('cube-hexagon', { pick: 'triangle' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('cube-hexagon', { pick: '' }).verdict).toBe('valid');
    expect(run('cube-hexagon', { pick: 'circle' }).verdict).toBe('invalid');
    expect(run('cube-hexagon', { pick: 'hexagon' }, { pick: 'square' }).verdict).toBe('invalid');
    expect(run('tetrahedron-square', { pick: 'square' }).verdict).toBe('met');
    expect(bare('cube-hexagon', { pick: 'hexagon' }).verdict).toBe('valid');
  });

  it('grades the hidden count and the pyramid volume', () => {
    expect(run('cube-edges', { value: '12' }).verdict).toBe('met');
    expect(run('cube-edges', { value: '8' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('cube-edges', { value: '' }).verdict).toBe('valid');
    expect(run('cube-edges', { value: '12.5' }).verdict).toBe('invalid');
    expect(run('cube-edges', { value: '031' }).verdict).toBe('invalid');
    expect(run('cube-edges', { value: '99999' }).verdict).toBe('invalid');
    expect(run('cube-edges', { value: 12 }).verdict).toBe('invalid');
    expect(run('cube-edges', { value: '12' }, { target: '8' }).verdict).toBe('invalid');
    expect(run('dodecahedron-faces', { value: '12' }).verdict).toBe('met');
    expect(run('pyramid-third', { value: '60' }).verdict).toBe('met');
    expect(run('pyramid-third', { value: '180' })).toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(run('pyramid-third', { value: '90' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('pyramid-third', { value: '1729' }).verdict).toBe('invalid');
    expect(bare('pyramid-third', { value: '60' }).verdict).toBe('valid');
  });

  it('refuses a section the plane does not cut or an option list that also holds a true answer', () => {
    const section = segmentOf('cube-hexagon').payload as Record<string, unknown>;
    expect(solidSectionProblem(readSolidSectionPayload({ ...section, plane: { normal: [0, 0, 1], offset: 16 } })!)).not.toBeNull();
    expect(readSolidSectionPayload({ ...section, options: ['hexagon'] })).toBeNull();
    expect(readSolidSectionPayload({ ...section, options: ['hexagon', 'hexagon'] })).toBeNull();
    expect(readSolidSectionPayload({ ...section, solid: 'sphere' })).toBeNull();
  });
});

describe('F4.5 fix round: Archimedean solids, the cylinder, the cone and the sliding plane', () => {
  type Normal = [number, number, number];
  const cut = (solid: (typeof SECTION_SOLIDS)[number], normal: Normal, offset: number) => sectionCut(solid, { normal, offset });
  const dotWith = (normal: readonly number[], point: readonly number[]) => normal[0]! * point[0]! + normal[1]! * point[1]! + normal[2]! * point[2]!;

  it('builds the five Archimedean solids with the right counts, planar faces and equal edges', () => {
    for (const id of ARCHIMEDEAN_IDS) {
      const mesh = eulerMesh(id);
      const counts = polyCounts(mesh);
      expect(counts, id).toEqual(EULER_COUNTS[id]);
      expect(eulerSum(counts), id).toBe(2);
      const lengths = mesh.edges.map(([a, b]) => Math.hypot(...mesh.vertices[a]!.map((value, axis) => value - mesh.vertices[b]![axis]!)));
      expect(Math.max(...lengths) - Math.min(...lengths), id).toBeLessThan(1e-9);
      for (const face of mesh.faces) {
        const normal = faceNormalOf(mesh, face);
        const at = dotWith(normal, mesh.vertices[face[0]!]!);
        for (const vertex of mesh.vertices) expect(dotWith(normal, vertex), id).toBeLessThan(at + 1e-9);
        for (const index of face) expect(Math.abs(dotWith(normal, mesh.vertices[index]!) - at), id).toBeLessThan(1e-9);
      }
      const owners = new Map<string, number>();
      for (const face of mesh.faces) face.forEach((from, place) => { const key = [from, face[(place + 1) % face.length]!].sort().join('-'); owners.set(key, (owners.get(key) ?? 0) + 1); });
      expect([...owners.values()].every((count) => count === 2), id).toBe(true);
    }
    expect(EULER_COUNTS['truncated-icosahedron']).toEqual({ vertices: 60, edges: 90, faces: 32 });
    expect(EULER_COUNTS.cuboctahedron).toEqual({ vertices: 12, edges: 24, faces: 14 });
  });

  it('grades the hidden count of an Archimedean solid inside its own bounds', () => {
    expect(eulerBounds('cube')).toEqual({ minimum: '0', maximum: '30' });
    expect(eulerBounds('truncated-icosahedron')).toEqual({ minimum: '0', maximum: '90' });
    expect(run('truncated-icosahedron-faces', { value: '32' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('truncated-icosahedron-faces', { value: '60' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('truncated-icosahedron-faces', { value: '90' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('truncated-icosahedron-faces', { value: '91' }).verdict).toBe('invalid');
    expect(run('truncated-icosahedron-faces', { value: '' }).verdict).toBe('valid');
    expect(run('truncated-icosahedron-faces', { value: '32' }, { target: '20' }).verdict).toBe('invalid');
    expect(run('cuboctahedron-edges', { value: '24' }).verdict).toBe('met');
    expect(run('cuboctahedron-edges', { value: '12' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('cube-edges', { value: '31' }).verdict).toBe('invalid');
  });

  it('cuts the cylinder into a circle, a rectangle or an ellipse and flags a cut that runs into an end cap', () => {
    expect(cut('cylinder', [0, 1, 0], 0)).toEqual({ shape: 'circle', clipped: false });
    expect(cut('cylinder', [0, 1, 0], 4).shape).toBe('circle');
    expect(cut('cylinder', [0, 1, 0], 6).shape).toBeNull();
    expect(cut('cylinder', [0, 1, 0], 8).shape).toBeNull();
    expect(cut('cylinder', [1, 0, 0], 0).shape).toBe('rectangle');
    expect(cut('cylinder', [0, 0, 2], 3).shape).toBe('rectangle');
    expect(cut('cylinder', [1, 0, 0], 4).shape).toBeNull();
    expect(cut('cylinder', [1, 0, 0], 8).shape).toBeNull();
    expect(cut('cylinder', [1, 2, 0], 0).shape).toBe('ellipse');
    expect(cut('cylinder', [1, 2, 0], 7).shape).toBe('ellipse');
    expect(cut('cylinder', [1, 2, 0], 8)).toEqual({ shape: null, clipped: true });
    expect(cut('cylinder', [1, 2, 0], 14)).toEqual({ shape: null, clipped: true });
    expect(cut('cylinder', [3, 1, 0], 0)).toEqual({ shape: null, clipped: true });
    expect(sectionSolidMesh('cylinder').curved).toBe(true);
    expect(sectionSolidMesh('cube').curved).toBeUndefined();
  });

  it('keeps the section of the polyhedra exactly as it was', () => {
    expect(cut('cube', [1, 1, 1], 0)).toEqual({ shape: 'hexagon', clipped: false });
    expect(cut('cube', [0, 0, 1], 16)).toEqual({ shape: null, clipped: false });
    expect(cut('octahedron', [0, 0, 1], 0).shape).toBe('square');
  });

  it('finds the cone as a third of the cylinder with the same base and height', () => {
    expect(cylinderVolume(3, 4)).toBe(36);
    expect(coneVolume(3, 4)).toBe(12);
    expect(coneVolume(2, 3)).toBe(4);
    expect(coneVolume(2, 1)).toBeNull();
    expect(solidSectionAnswer({ mode: 'cone', radius: 3, height: 4 })).toEqual({ target: '12' });
    expect(solidSectionProblem({ mode: 'cone', radius: 2, height: 1 })).not.toBeNull();
    expect(CONE_LIMITS).toEqual({ radius: { min: 1, max: 12 }, height: { min: 1, max: 12 } });
    expect(readSolidSectionPayload({ mode: 'cone', radius: 13, height: 3 })).toBeNull();
    expect(readSolidSectionPayload({ mode: 'cone', radius: 3, height: 0 })).toBeNull();
    expect(readSolidSectionPayload({ mode: 'cone', radius: 3, height: 4, extra: 1 })).toBeNull();
    expect(readSolidSectionPayload({ mode: 'cone', radius: 1.5, height: 4 })).toBeNull();
  });

  it('grades the cone volume and names the cylinder trap', () => {
    expect(run('cone-third', { value: '12' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('cone-third', { value: '36' })).toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(run('cone-third', { value: '24' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('cone-third', { value: '' }).verdict).toBe('valid');
    expect(run('cone-third', { value: '1729' }).verdict).toBe('invalid');
    expect(run('cone-third', { value: '12' }, { target: '36' }).verdict).toBe('invalid');
    expect(bare('cone-third', { value: '12' }).verdict).toBe('valid');
  });

  it('grades a cylinder section pick', () => {
    expect(run('cylinder-circle', { pick: 'circle' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('cylinder-circle', { pick: 'rectangle' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('cylinder-rectangle', { pick: 'rectangle' }).verdict).toBe('met');
    expect(run('cylinder-ellipse', { pick: 'ellipse' }).verdict).toBe('met');
    expect(run('cylinder-ellipse', { pick: 'circle' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('cylinder-ellipse', { pick: 'ellipse' }, { pick: 'circle' }).verdict).toBe('invalid');
  });

  it('refuses a cylinder cut that clips the end cap and an option that is also true', () => {
    const base = segmentOf('cylinder-ellipse').payload as Record<string, unknown>;
    expect(solidSectionProblem(readSolidSectionPayload({ ...base, plane: { normal: [1, 2, 0], offset: 14 } })!)).toMatch(/end caps/);
    const circle = segmentOf('cylinder-circle').payload as Record<string, unknown>;
    expect(solidSectionProblem(readSolidSectionPayload({ ...circle, options: ['circle', 'ellipse'] })!)).not.toBeNull();
  });

  it('slides a plane through a solid and reads the shape at every position', () => {
    expect(slideRange('cube', [1, 1, 1])).toEqual({ min: -13, max: 13 });
    const cube = slideShapes('cube', [1, 1, 1]);
    expect(cube.get(0)).toBe('hexagon');
    expect(cube.get(10)).toBe('triangle');
    expect(cube.get(12)).toBeNull();
    expect(cube.get(13)).toBeNull();
    const cylinder = slideShapes('cylinder', [0, 1, 0]);
    expect(cylinder.get(0)).toBe('circle');
    expect(cylinder.get(7)).toBeNull();
    expect(cylinder.get(10)).toBeUndefined();
    for (const solid of SECTION_SOLIDS) {
      for (const normal of [[1, 0, 0], [0, 1, 0], [1, 1, 1], [1, 2, 0], [3, 1, 2]] as Normal[]) {
        const { min, max } = slideRange(solid, normal);
        expect(min, `${solid} ${normal}`).toBeGreaterThanOrEqual(-16);
        expect(max, `${solid} ${normal}`).toBeLessThanOrEqual(16);
        const shapes = slideShapes(solid, normal);
        expect(shapes.size, `${solid} ${normal}`).toBe(max - min + 1);
        if (min > -16) expect(shapes.get(min) ?? null, `${solid} ${normal} low end`).toBeNull();
        if (max < 16) expect(shapes.get(max) ?? null, `${solid} ${normal} high end`).toBeNull();
      }
    }
  });

  it('knows which positions of the plane make the shape asked for', () => {
    const payload = readSolidSectionPayload(segmentOf('slide-cube-hexagon').payload)!;
    if (payload.mode !== 'slide') throw new Error('not a slide');
    expect(slideSolutions(payload)).toContain(0);
    expect(slideSolutions(payload)).not.toContain(10);
    expect(slideCut(payload, 0)).toBe('hexagon');
    expect(slideCut(payload, 10)).toBe('triangle');
    expect(solidSectionAnswer(payload)).toEqual({ pick: 'hexagon' });
  });

  it('grades the position the learner leaves the plane at and never says met on the start', () => {
    expect(run('slide-cube-hexagon', { offset: 0 })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('slide-cube-hexagon', { offset: 2 }).verdict).toBe('met');
    expect(run('slide-cube-hexagon', { offset: 10 }).verdict).toBe('valid');
    expect(run('slide-cube-hexagon', { offset: 6 })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('slide-cube-hexagon', { offset: 12 })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('slide-cube-hexagon', { offset: 99 }).verdict).toBe('invalid');
    expect(run('slide-cube-hexagon', { offset: -14 }).verdict).toBe('invalid');
    expect(run('slide-cube-hexagon', { offset: 1.5 }).verdict).toBe('invalid');
    expect(run('slide-cube-hexagon', { offset: '0' }).verdict).toBe('invalid');
    expect(run('slide-cube-hexagon', { offset: 0, extra: 1 }).verdict).toBe('invalid');
    expect(run('slide-cube-hexagon', { pick: 'hexagon' }).verdict).toBe('invalid');
    expect(run('slide-cube-hexagon', { offset: 0 }, { pick: 'square' }).verdict).toBe('invalid');
    expect(run('slide-cube-hexagon', { offset: 0 }, { pick: 'hexagon', extra: 1 }).verdict).toBe('invalid');
    expect(bare('slide-cube-hexagon', { offset: 0 }).verdict).toBe('valid');
    expect(run('slide-tetrahedron-square', { offset: 0 }).verdict).toBe('met');
    expect(run('slide-tetrahedron-square', { offset: 1 })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('slide-cylinder-ellipse', { offset: 0 }).verdict).toBe('met');
    expect(run('slide-cylinder-ellipse', { offset: 12 })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('slide-cylinder-ellipse', { offset: 14 }).verdict).toBe('valid');
  });

  it('refuses a slide that has no answer, starts on the answer, or would grade one position two ways', () => {
    const cube = segmentOf('slide-cube-hexagon').payload as Record<string, unknown>;
    const problem = (patch: Record<string, unknown>) => solidSectionProblem(readSolidSectionPayload({ ...cube, ...patch })!);
    expect(problem({})).toBeNull();
    expect(problem({ start: 0 })).toMatch(/must not start/);
    expect(problem({ target: 'circle' })).toMatch(/No position/);
    expect(problem({ solid: 'tetrahedron', normal: [1, 0, 0], start: 0, target: 'rectangle' })).toMatch(/also make/);
    expect(readSolidSectionPayload({ ...cube, start: 17 })).toBeNull();
    expect(readSolidSectionPayload({ ...cube, normal: [0, 0, 0] })).toBeNull();
    expect(readSolidSectionPayload({ ...cube, normal: [4, 0, 0] })).toBeNull();
    expect(readSolidSectionPayload({ ...cube, solid: 'dodecahedron' })).toBeNull();
    expect(readSolidSectionPayload({ ...cube, target: 'sphere' })).toBeNull();
    expect(readSolidSectionPayload({ ...cube, extra: 1 })).toBeNull();
    expect(readSolidSectionPayload({ mode: 'slide', solid: 'cube', normal: [1, 1, 1], start: 10 })).toBeNull();
  });
});

describe('F4.6 market stall: baskets that meet a rule', () => {
  const basket = (slots: Record<string, number>) => ({ slots: Object.fromEntries(Object.entries(slots).map(([id, count]) => [id, Array.from({ length: count }, () => 'item')])) });

  it('finds the biggest bag a budget buys and the totals a stall can make', () => {
    const payload = readStallPayload(segmentOf('most-for-three').payload)!;
    expect(mostItems(payload.items, 300)).toBe(7);
    expect(stallAnswer(payload)).not.toBeNull();
    const exact = readStallPayload(segmentOf('exact-basket').payload)!;
    expect(reachableTotals(exact.items, 1000).has(250)).toBe(true);
    expect(reachableTotals(exact.items, 1000).has(251)).toBe(false);
  });

  it('accepts any basket that meets the rule', () => {
    expect(run('exact-basket', basket({ apple: 5 })).verdict).toBe('met');
    expect(run('exact-basket', basket({ apple: 1, bread: 1, juice: 1 })).verdict).toBe('met');
    expect(run('exact-basket', basket({ apple: 1 }))).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('exact-basket', basket({ apple: 5, bread: 1 }))).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
    expect(run('exact-basket', basket({})).verdict).toBe('valid');
    expect(run('most-for-three', basket({ shell: 4, stamp: 3 })).verdict).toBe('met');
    expect(run('most-for-three', basket({ shell: 4 }))).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('most-for-three', basket({ toy: 2 }))).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
    expect(run('make-the-change', basket({ pen: 4, cap: 0 })).verdict).not.toBe('invalid');
  });

  it('refuses an item the stall does not sell, a stack over the stock and a wrong piece', () => {
    expect(run('exact-basket', basket({ kite: 1 })).verdict).toBe('invalid');
    expect(run('exact-basket', basket({ apple: 6 })).verdict).toBe('invalid');
    expect(run('exact-basket', { slots: { apple: ['coin'] } }).verdict).toBe('invalid');
    expect(run('exact-basket', { slots: 'apple' }).verdict).toBe('invalid');
    expect(slotsToBasket({ apple: ['item'] }, readStallPayload(segmentOf('exact-basket').payload)!)).toEqual({ apple: 1 });
  });

  it('checks the key against the stall and never says met without one', () => {
    expect(run('exact-basket', basket({ apple: 5 }), { solutions: [{ apple: ['item'] }] }).verdict).toBe('invalid');
    expect(run('exact-basket', basket({ apple: 5 }), { solutions: [] }).verdict).toBe('invalid');
    expect(bare('exact-basket', basket({ apple: 5 })).verdict).toBe('valid');
    const payload = readStallPayload(segmentOf('exact-basket').payload)!;
    expect(basketMeets(payload, { apple: 5 })).toBe(true);
    expect(basketMeets(payload, { apple: 4 })).toBe(false);
  });

  it('refuses a goal the stall cannot reach', () => {
    const base = segmentOf('exact-basket').payload as Record<string, unknown>;
    expect(stallProblem(readStallPayload({ ...base, goal: { kind: 'exact', total: 251 } })!)).not.toBeNull();
    expect(readStallPayload({ ...base, goal: { kind: 'exact', total: 99999 } })).toBeNull();
    expect(readStallPayload({ ...base, goal: { kind: 'change', paid: 100, change: 100 } })).toBeNull();
    expect(readStallPayload({ ...base, items: [{ id: 'apple', price: 50, stock: 5 }] })).toBeNull();
  });
});

describe('F4.6 coin stacks: counts to scale', () => {
  it('computes the stack from the piece thickness', () => {
    expect(stackTenths('coin', 4)).toBe(80);
    expect(stackTenths('bill', 10)).toBe(10);
    expect(stackCents({ value: 100 }, 15)).toBe(1500);
    const phone = readCoinPayload(segmentOf('coins-as-tall-as-a-phone').payload)!;
    expect(coinAnswer(phone)).toBe(4);
    expect(coinAnswer(readCoinPayload(segmentOf('coins-worth-fifteen').payload)!)).toBe(15);
    expect(coinAnswer(readCoinPayload(segmentOf('a-million-in-bills').payload)!)).toBe(10000);
    expect(coinPositions({ step: 400, max: 12000 })).toHaveLength(31);
  });

  it('grades the count', () => {
    expect(run('coins-as-tall-as-a-phone', { value: '4' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('coins-as-tall-as-a-phone', { value: '3' })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('coins-as-tall-as-a-phone', { value: '7' })).toEqual({ verdict: 'review', diagnostic: 'false_alarm' });
    expect(run('coins-as-tall-as-a-phone', { value: '0' }).verdict).toBe('valid');
    expect(run('coins-as-tall-as-a-phone', { value: '' }).verdict).toBe('valid');
    expect(run('coins-as-tall-as-a-phone', { value: '11' }).verdict).toBe('invalid');
    expect(run('coins-as-tall-as-a-phone', { value: '04' }).verdict).toBe('invalid');
    expect(run('coins-as-tall-as-a-phone', { value: 4 }).verdict).toBe('invalid');
    expect(run('a-million-in-bills', { value: '10000' }).verdict).toBe('met');
    expect(run('a-million-in-bills', { value: '10001' }).verdict).toBe('invalid');
    expect(run('a-million-in-bills', { value: '9600' })).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(run('coins-worth-fifteen', { value: '15' }).verdict).toBe('met');
  });

  it('checks the key against the stack and never says met without one', () => {
    expect(run('coins-worth-fifteen', { value: '15' }, { target: '16' }).verdict).toBe('invalid');
    expect(run('coins-worth-fifteen', { value: '15' }, { target: '15', extra: 1 }).verdict).toBe('invalid');
    expect(bare('coins-worth-fifteen', { value: '15' }).verdict).toBe('valid');
  });

  it('refuses a stack the handle cannot answer', () => {
    const base = segmentOf('coins-worth-fifteen').payload as Record<string, unknown>;
    expect(coinProblem(readCoinPayload({ ...base, goal: { kind: 'amount', total: 1550 } })!)).not.toBeNull();
    expect(coinProblem(readCoinPayload({ ...base, max: 14, step: 4 })!)).not.toBeNull();
    expect(coinProblem(readCoinPayload({ ...base, goal: { kind: 'amount', total: 100000 } })!)).not.toBeNull();
    expect(readCoinPayload({ ...base, piece: 'note' })).toBeNull();
    expect(readCoinPayload({ ...base, extra: 1 })).toBeNull();
  });
});

describe('space1 pack: Core integration and age scope', () => {
  it('opens the age ranges of the catalogue and refuses the adult pathway where it is not meant', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    expect(scope(ROTATION, '6-9', 6, 9)).toBeNull();
    expect(scope(ROTATION, '13-17', 13, 17)).toBeNull();
    expect(scope(SECTION, '6-9', 6, 9)).not.toBeNull();
    expect(scope(SECTION, '10-12', 11, 12)).toBeNull();
    expect(scope(STALL, '6-9', 6, 9)).not.toBeNull();
    expect(scope(STALL, '6-9', 7, 9)).toBeNull();
    expect(scope(STALL, '13-17', 13, 17)).not.toBeNull();
    expect(scope(STALL, 'adult', 18, 99)).not.toBeNull();
    expect(scope(COIN, '13-17', 13, 17)).toBeNull();
    expect(scope(COIN, 'adult', 18, 99)).toBeNull();
    expect(scope(SECTION, 'adult', 18, 99)).toBeNull();
  });

  it('plugs into Core for every fixture: public schema, answer key and the server grade', () => {
    for (const entry of SPACE1_FIXTURES) {
      for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(entry.id, locale)).success, `${entry.id} ${locale}`).toBe(true);
      const document = lesson(entry.id);
      const id = entry.segment('en-US').id as string;
      const keys = { [id]: entry.rubric };
      const expected = { lessonId: document.lesson_id, locale: document.locale };
      expect(validateV2LessonForGrading(document, keys, expected), entry.id).not.toBeNull();
      const parsed = v2PublicLessonSchema.parse(document);
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.met), entry.id).toMatchObject({ score: 100, correct: true });
      expect(gradeV2Visual(parsed, keys, id, entry.ladder.valid), entry.id).toBeNull();
      expect(horizonteSampleVerdict(entry.segment('en-US') as { type: string }, entry.rubric), entry.id).toBe('valid');
    }
  });

  it('rejects a key the geometry contradicts at the grading gate', () => {
    const document = lesson('pick-the-turned');
    const id = document.segments[0]!.id as string;
    const expected = { lessonId: document.lesson_id, locale: document.locale };
    expect(validateV2LessonForGrading(document, { [id]: { pick: 'a', angles: [180] } }, expected)).toBeNull();
    const coin = lesson('coins-worth-fifteen');
    const coinId = coin.segments[0]!.id as string;
    expect(validateV2LessonForGrading(coin, { [coinId]: { target: '14' } }, { lessonId: coin.lesson_id, locale: coin.locale })).toBeNull();
  });

  it('refuses a leaked answer, a wrong visual and an unsolvable payload', () => {
    for (const entry of SPACE1_FIXTURES) {
      const base = lesson(entry.id);
      const segment = base.segments[0] as Record<string, unknown>;
      expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, payload: { ...(segment.payload as object), solution: 'x' } }] }).success, `${entry.id} leak`).toBe(false);
      expect(v2PublicLessonSchema.safeParse({ ...base, segments: [{ ...segment, visual: { type: 'ten-frame' } }] }).success, `${entry.id} visual`).toBe(false);
    }
    const coin = lesson('coins-worth-fifteen');
    const coinSegment = coin.segments[0] as Record<string, unknown>;
    expect(v2PublicLessonSchema.safeParse({ ...coin, segments: [{ ...coinSegment, payload: { ...(coinSegment.payload as object), goal: { kind: 'amount', total: 1550 } } }] }).success).toBe(false);
    expect(horizonteGrade({ type: ROTATION }, { pick: 'a', angle: 90 }, undefined)).toBeNull();
  });
});
