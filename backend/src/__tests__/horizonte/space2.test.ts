import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { HORIZONTE_CAPABILITIES, HORIZONTE_RUBRICS, horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import {
  AR_ADULT_AGE, AR_OBJECTS, AR_OBJECT_IDS, AR_PILOT_MIN_AGE, AR_RING_POINTS, arPilotGate, arVolumeMl, arWire, isArPilotEnabled, readArConsent, readArPayload,
} from '../../services/horizonte/space2/ar.js';
import { SPACE2_FIXTURES } from '../../services/horizonte/space2/fixtures.js';
import {
  PLACES, PLACE_IDS, distanceKm, feeCents, globeKey, globePlaces, globeProblem, readGlobePayload, routeCenter, routeDistances, routeFees,
} from '../../services/horizonte/space2/globe.js';
import { space2 } from '../../services/horizonte/space2/index.js';
import {
  compoundCents, nextYearCents, optionCents, profitCents, readSurfacePayload, surfaceGrid, surfaceKey, surfaceMesh, surfaceProblem, surfaceSlice,
} from '../../services/horizonte/space2/surface.js';
import { gradeV2Visual, v2PublicLessonSchema, v2ViewedSegmentIds, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const SURFACE = 'math.surface.v2';
const GLOBE = 'geography.globe-route.v2';
const AR = 'space.ar-table.v2';
const GRADED = [SURFACE, GLOBE] as const;

const grade = (type: string) => space2.scorers[type]!.grade as unknown as Grade;
const fixture = (id: string) => SPACE2_FIXTURES.find((entry) => entry.id === id)!;
const segmentOf = (id: string) => fixture(id).segment('en-US');
const run = (id: string, response: unknown, rubric: unknown = fixture(id).rubric) => grade(segmentOf(id).type as string)(segmentOf(id), response, rubric);
const bare = (id: string, response: unknown) => grade(segmentOf(id).type as string)(segmentOf(id), response, undefined);
const payloadOf = (id: string) => segmentOf(id).payload as Record<string, unknown>;

function lesson(id: string, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') {
  const entry = fixture(id);
  const segment = entry.segment(locale);
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${entry.ageBand}`, chapter_id: 'horizonte-space2', lesson_id: `hz-space2-${entry.id}`,
    version_id: 'rev-1', locale, age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: entry.title[locale], required_capabilities: [...space2.capabilities[segment.type as keyof typeof space2.capabilities]], segments: [segment],
  };
}

const gradedPack = {
  ...space2,
  segments: space2.segments.slice(0, 2),
  capabilities: Object.fromEntries(GRADED.map((type) => [type, space2.capabilities[type]])),
  ageScope: Object.fromEntries(GRADED.map((type) => [type, space2.ageScope[type]!])),
};
const gradedFixtures = SPACE2_FIXTURES.filter((entry) => (GRADED as readonly string[]).includes(entry.segment('en-US').type as string));

describe('space2 pack: scorer contract', () => {
  it('meets the scorer contract for the two graded segment types', () => {
    expect(() => assertScorerContract(gradedPack, gradedFixtures)).not.toThrow();
  });

  it('declares three types, only two of them scored and keyed', () => {
    expect(Object.keys(space2.capabilities).sort()).toEqual([AR, GLOBE, SURFACE].sort());
    expect(Object.keys(space2.rubrics).sort()).toEqual([GLOBE, SURFACE].sort());
    expect(Object.keys(space2.scorers).sort()).toEqual([GLOBE, SURFACE].sort());
    expect(Object.keys(space2.ageScope).sort()).toEqual([AR, GLOBE, SURFACE].sort());
    for (const type of GRADED) expect(Object.hasOwn(HORIZONTE_RUBRICS, type), type).toBe(true);
    expect(Object.hasOwn(HORIZONTE_RUBRICS, AR)).toBe(false);
    expect(Object.hasOwn(HORIZONTE_CAPABILITIES, AR)).toBe(true);
  });

  it('keeps every fixture inside the authoring rules', () => {
    for (const entry of SPACE2_FIXTURES) {
      const segment = entry.segment('en-US');
      if (segment.type === SURFACE) expect(surfaceProblem(readSurfacePayload(segment.payload)!), entry.id).toBeNull();
      if (segment.type === GLOBE) expect(globeProblem(readGlobePayload(segment.payload)!), entry.id).toBeNull();
      if (segment.type === AR) expect(readArPayload(segment.payload), entry.id).not.toBeNull();
    }
  });
});

describe('F4.7 surfaces: compound interest and profit', () => {
  it('computes every value with integers, rounding a year of interest half up to the cent', () => {
    expect(nextYearCents(100000, 400)).toBe(104000);
    expect(nextYearCents(101, 500)).toBe(106);
    expect(nextYearCents(100, 150)).toBe(102);
    expect(nextYearCents(100, 50)).toBe(101);
    expect(compoundCents(100000, 600, 15)).toBe(239656);
    expect(compoundCents(100000, 0, 40)).toBe(100000);
    expect(compoundCents(100000, 400, 0)).toBe(100000);
    expect(profitCents(150, 20000, 500, 200)).toBe(50000);
    expect(profitCents(150, 20000, 200, 50)).toBe(-17500);
  });

  it('builds the grid, a slice and a mesh from the same numbers', () => {
    const payload = readSurfacePayload(payloadOf('price-and-units'))!;
    const grid = surfaceGrid(payload.surface);
    expect(grid).toHaveLength(4);
    expect(grid[0]).toHaveLength(4);
    expect(grid[1]![3]).toBe(15000);
    expect(optionCents(payload)).toEqual([-10000, 2500, 5000, 15000]);
    expect(surfaceSlice(payload.surface, 'x', 3)).toEqual({ fixed: 'x', index: 3, along: [50, 100, 150, 200], values: [-2500, 15000, 32500, 50000] });
    expect(surfaceSlice(payload.surface, 'y', 0)!.values).toEqual([-17500, -12500, -7500, -2500]);
    expect(surfaceSlice(payload.surface, 'x', 4)).toBeNull();
    expect(surfaceSlice(payload.surface, 'y', -1)).toBeNull();
    const mesh = surfaceMesh(payload.surface);
    expect(mesh.points).toHaveLength(4);
    expect(mesh.points[0]).toHaveLength(4);
    expect(mesh.minCents).toBe(-17500);
    expect(mesh.maxCents).toBe(50000);
    expect(mesh.zero).not.toBeNull();
    expect(Math.max(...mesh.points.flat().map((point) => point[1]))).toBeCloseTo(0.5);
    expect(Math.min(...mesh.points.flat().map((point) => point[1]))).toBeCloseTo(-0.5);
    expect(surfaceMesh(readSurfacePayload(payloadOf('time-beats-rate'))!.surface).zero).toBeNull();
  });

  it('finds the one option the question asks for', () => {
    expect(surfaceKey(readSurfacePayload(payloadOf('time-beats-rate'))!)).toBe('c');
    expect(surfaceKey(readSurfacePayload(payloadOf('price-and-units'))!)).toBe('d');
    const lowest = readSurfacePayload({ ...payloadOf('time-beats-rate'), ask: { kind: 'lowest' } })!;
    expect(surfaceKey(lowest)).toBe('b');
  });

  it('grades the choice on the grid', () => {
    expect(run('time-beats-rate', { choice: 'c' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('time-beats-rate', { choice: 'a' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('price-and-units', { choice: 'd' }).verdict).toBe('met');
    expect(run('price-and-units', { choice: 'b' })).toEqual({ verdict: 'review', diagnostic: 'value' });
  });

  it('treats nothing chosen as not yet an answer and refuses anything else', () => {
    expect(run('time-beats-rate', { choice: '' }).verdict).toBe('valid');
    expect(run('time-beats-rate', { choice: 'z' }).verdict).toBe('invalid');
    expect(run('time-beats-rate', { choice: 1 }).verdict).toBe('invalid');
    expect(run('time-beats-rate', { choice: 'c', extra: 1 }).verdict).toBe('invalid');
    expect(run('time-beats-rate', {}).verdict).toBe('invalid');
    expect(run('time-beats-rate', null).verdict).toBe('invalid');
    expect(grade(SURFACE)({ payload: { surface: 'x' } }, { choice: 'a' }, undefined).verdict).toBe('invalid');
  });

  it('never says met without a rubric, and refuses a key the grid contradicts', () => {
    expect(bare('time-beats-rate', { choice: 'c' }).verdict).toBe('valid');
    expect(bare('time-beats-rate', { choice: 'q' }).verdict).toBe('invalid');
    expect(run('time-beats-rate', { choice: 'c' }, { choice: 'a' }).verdict).toBe('invalid');
    expect(run('time-beats-rate', { choice: 'c' }, { choice: 'c', extra: 1 }).verdict).toBe('invalid');
    expect(run('time-beats-rate', { choice: '' }, { choice: 'b' }).verdict).toBe('invalid');
  });

  it('refuses a flat surface, a tie and a question nothing answers', () => {
    const problem = (patch: Record<string, unknown>) => { const read = readSurfacePayload({ ...payloadOf('time-beats-rate'), ...patch }); return read ? surfaceProblem(read) : 'malformed'; };
    expect(problem({})).toBeNull();
    expect(problem({ surface: { kind: 'compound', principalCents: 100000, ratesBps: [0, 100, 200], terms: [0, 1, 2] }, ask: { kind: 'lowest' }, options: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 1 }] })).not.toBeNull();
    expect(problem({ surface: { kind: 'compound', principalCents: 100000, ratesBps: [0, 100, 200], terms: [0, 1, 2] }, options: [{ id: 'a', x: 0, y: 1 }, { id: 'b', x: 1, y: 0 }, { id: 'c', x: 0, y: 2 }, { id: 'd', x: 0, y: 0 }] })).toBe('Exactly one option must be the highest');
    expect(problem({ ask: { kind: 'reach', targetCents: 999999999 } })).toBe('Exactly one option must reach the target');
    expect(problem({ ask: { kind: 'reach', targetCents: 100000 } })).toBe('Exactly one option must reach the target');
    expect(problem({ surface: { kind: 'profit', unitCostCents: 100, fixedCents: 0, prices: [100, 200, 300], units: [0, 1, 2] }, ask: { kind: 'lowest' }, options: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }] })).toBe('Exactly one option must be the lowest');
  });

  it('refuses a malformed payload', () => {
    const base = payloadOf('time-beats-rate') as { surface: Record<string, unknown>; ask: unknown; options: unknown[] };
    expect(readSurfacePayload(base)).not.toBeNull();
    expect(readSurfacePayload({ ...base, extra: 1 })).toBeNull();
    expect(readSurfacePayload({ ...base, surface: { ...base.surface, ratesBps: [400, 200, 600] } })).toBeNull();
    expect(readSurfacePayload({ ...base, surface: { ...base.surface, ratesBps: [200, 400] } })).toBeNull();
    expect(readSurfacePayload({ ...base, surface: { ...base.surface, ratesBps: [200, 400, 600, 1600] } })).toBeNull();
    expect(readSurfacePayload({ ...base, surface: { ...base.surface, terms: [5, 10, 15, 41] } })).toBeNull();
    expect(readSurfacePayload({ ...base, surface: { ...base.surface, principalCents: 99 } })).toBeNull();
    expect(readSurfacePayload({ ...base, surface: { ...base.surface, principalCents: 10.5 } })).toBeNull();
    expect(readSurfacePayload({ ...base, ask: { kind: 'reach' } })).toBeNull();
    expect(readSurfacePayload({ ...base, ask: { kind: 'median' } })).toBeNull();
    expect(readSurfacePayload({ ...base, options: [{ id: 'a', x: 1, y: 3 }] })).toBeNull();
    expect(readSurfacePayload({ ...base, options: [{ id: 'a', x: 1, y: 3 }, { id: 'b', x: 1, y: 3 }] })).toBeNull();
    expect(readSurfacePayload({ ...base, options: [{ id: 'a', x: 9, y: 3 }, { id: 'b', x: 1, y: 3 }] })).toBeNull();
    expect(readSurfacePayload({ ...base, options: [{ id: 'b', x: 1, y: 3 }, { id: 'a', x: 2, y: 3 }] })).toBeNull();
    expect(readSurfacePayload({ ...base, surface: { kind: 'profit', unitCostCents: 0, fixedCents: 0, prices: [100, 200, 300], units: [0, 1, 2] } })).toBeNull();
    expect(readSurfacePayload(null)).toBeNull();
  });
});

describe('F4.8 globe: distance and fee routes', () => {
  it('measures great-circle kilometres from the fixed gazetteer', () => {
    expect(PLACE_IDS).toHaveLength(Object.keys(PLACES).length);
    expect(distanceKm('mexico-city', 'houston')).toBe(1215);
    expect(distanceKm('mexico-city', 'new-york')).toBe(3359);
    expect(distanceKm('los-angeles', 'manila')).toBe(11743);
    expect(distanceKm('lagos', 'nairobi')).toBe(3807);
    expect(distanceKm('tokyo', 'tokyo')).toBe(0);
    expect(distanceKm('madrid', 'lisbon')).toBe(distanceKm('lisbon', 'madrid'));
    for (const from of PLACE_IDS) for (const to of PLACE_IDS) expect(distanceKm(from, to)).toBeLessThanOrEqual(20040);
  });

  it('computes a fee in whole cents, rate rounded half up plus the flat charge', () => {
    expect(feeCents(20000, 150, 300)).toBe(600);
    expect(feeCents(20000, 400, 800)).toBe(1600);
    expect(feeCents(1000, 50, 0)).toBe(5);
    expect(feeCents(1010, 50, 0)).toBe(5);
    expect(feeCents(1030, 50, 0)).toBe(5);
    expect(feeCents(1100, 50, 0)).toBe(6);
    expect(feeCents(1000, 0, 250)).toBe(250);
  });

  it('finds the shortest, the longest and the cheapest route, and keeps a margin on distance', () => {
    const near = readGlobePayload(payloadOf('nearest-route'))!;
    expect(routeDistances(near)).toEqual([9063, 1215, 11310, 3359]);
    expect(globeKey(near)).toBe('b');
    expect(globeKey({ ...near, ask: 'longest' })).toBe('c');
    const cheap = readGlobePayload(payloadOf('cheapest-corridor'))!;
    expect(routeFees(cheap)).toEqual([1600, 600, 1100, 1200]);
    expect(globeKey(cheap)).toBe('b');
    const tight = readGlobePayload({ ...payloadOf('nearest-route'), routes: [
      { id: 'a', from: 'lagos', to: 'nairobi', feeBps: 0, flatCents: 0 }, { id: 'b', from: 'lagos', to: 'lisbon', feeBps: 0, flatCents: 0 },
    ] })!;
    expect(globeKey(tight)).toBeNull();
    expect(globeProblem(tight)).toBe('Exactly one route must be the shortest, ahead of the next by at least 2 percent');
  });

  it('grades the choice', () => {
    expect(run('nearest-route', { choice: 'b' })).toEqual({ verdict: 'met', diagnostic: 'none' });
    expect(run('nearest-route', { choice: 'c' })).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(run('cheapest-corridor', { choice: 'b' }).verdict).toBe('met');
    expect(run('cheapest-corridor', { choice: 'a' }).verdict).toBe('review');
    expect(run('cheapest-corridor', { choice: '' }).verdict).toBe('valid');
    expect(run('cheapest-corridor', { choice: 'e' }).verdict).toBe('invalid');
    expect(run('cheapest-corridor', { choice: 'b' }, { choice: 'a' }).verdict).toBe('invalid');
    expect(bare('cheapest-corridor', { choice: 'b' }).verdict).toBe('valid');
  });

  it('refuses a route to itself, a repeated corridor, an unknown place and a bad fee', () => {
    const base = payloadOf('cheapest-corridor') as { routes: Array<Record<string, unknown>> };
    const problem = (routes: unknown[], extra: Record<string, unknown> = {}) => { const read = readGlobePayload({ ...base, routes, ...extra }); return read ? globeProblem(read) : 'malformed'; };
    expect(problem(base.routes)).toBeNull();
    expect(problem([{ ...base.routes[0], to: 'los-angeles' }, base.routes[1]])).toBe('A route joins two different places');
    expect(problem([base.routes[0], { ...base.routes[1], id: 'b', from: 'mexico-city', to: 'los-angeles' }])).toBe('Each corridor is listed once');
    expect(problem([{ ...base.routes[0], to: 'atlantis' }, base.routes[1]])).toBe('malformed');
    expect(problem([{ ...base.routes[0], feeBps: 2001 }, base.routes[1]])).toBe('malformed');
    expect(problem([{ ...base.routes[0], flatCents: -1 }, base.routes[1]])).toBe('malformed');
    expect(problem([base.routes[0]])).toBe('malformed');
    expect(problem([base.routes[1], base.routes[0]])).toBe('malformed');
    expect(problem(base.routes, { sendCents: 999 })).toBe('malformed');
    expect(problem(base.routes, { ask: 'fastest' })).toBe('malformed');
    expect(problem([base.routes[0], { ...base.routes[1], feeBps: 400, flatCents: 800, to: 'manila' }, { ...base.routes[2], feeBps: 400, flatCents: 800 }])).toBe('Exactly one route must have the lowest fee');
  });

  it('lists the places a payload draws and centres a route inside the sphere', () => {
    expect(globePlaces(readGlobePayload(payloadOf('nearest-route'))!)).toEqual(['mexico-city', 'madrid', 'houston', 'tokyo', 'new-york']);
    const middle = routeCenter('los-angeles', 'new-york');
    expect(middle.lon).toBeGreaterThan(-118);
    expect(middle.lon).toBeLessThan(-74);
    expect(middle.lat).toBeGreaterThanOrEqual(35);
    expect(routeCenter('tokyo', 'tokyo')).toEqual({ lon: 140, lat: 36 });
    expect(Math.abs(routeCenter('manila', 'los-angeles').lon)).toBeLessThanOrEqual(180);
  });
});

describe('F4.9 AR table pilot: ungraded and closed by default', () => {
  const consent = { learner: true, guardian: true };

  it('is off with no input at all', () => {
    expect(isArPilotEnabled()).toBe(false);
    expect(isArPilotEnabled({})).toBe(false);
    expect(arPilotGate()).toBe('off');
  });

  it('stays off without the flag, whatever the age and consent', () => {
    expect(isArPilotEnabled({ age: 30, consent })).toBe(false);
    expect(isArPilotEnabled({ flag: false, age: 30, consent })).toBe(false);
    expect(isArPilotEnabled({ flag: 'true' as unknown as boolean, age: 30, consent })).toBe(false);
    expect(isArPilotEnabled({ flag: 1 as unknown as boolean, age: 30, consent })).toBe(false);
  });

  it('needs the learner to be 13 or older', () => {
    expect(AR_PILOT_MIN_AGE).toBe(13);
    for (const age of [null, undefined, 0, 7, 12, 12.9, Number.NaN, -1]) expect(isArPilotEnabled({ flag: true, age: age as number | null, consent }), String(age)).toBe(false);
    expect(arPilotGate({ flag: true, age: 12, consent })).toBe('age');
    expect(arPilotGate({ flag: true, age: '15' as unknown as number, consent })).toBe('age');
    expect(isArPilotEnabled({ flag: true, age: 13, consent })).toBe(true);
  });

  it('needs recorded consent, and a minor needs a guardian as well as their own', () => {
    expect(isArPilotEnabled({ flag: true, age: 15 })).toBe(false);
    expect(isArPilotEnabled({ flag: true, age: 15, consent: null })).toBe(false);
    expect(arPilotGate({ flag: true, age: 15, consent: { learner: false, guardian: true } })).toBe('consent');
    expect(arPilotGate({ flag: true, age: 15, consent: { learner: true, guardian: false } })).toBe('guardian');
    expect(isArPilotEnabled({ flag: true, age: 17, consent: { learner: true, guardian: false } })).toBe(false);
    expect(isArPilotEnabled({ flag: true, age: 17, consent })).toBe(true);
    expect(AR_ADULT_AGE).toBe(18);
    expect(isArPilotEnabled({ flag: true, age: 18, consent: { learner: true, guardian: false } })).toBe(true);
    expect(isArPilotEnabled({ flag: true, age: 18, consent: { learner: false, guardian: true } })).toBe(false);
    expect(isArPilotEnabled({ flag: true, age: 40 })).toBe(false);
  });

  it('reads consent strictly', () => {
    expect(readArConsent({ learner: true, guardian: false })).toEqual({ learner: true, guardian: false });
    expect(readArConsent({ learner: true })).toBeNull();
    expect(readArConsent({ learner: 'yes', guardian: true })).toBeNull();
    expect(readArConsent({ learner: true, guardian: true, at: 'now' })).toBeNull();
    expect(readArConsent(null)).toBeNull();
  });

  it('describes real objects at their true size and a wireframe of each', () => {
    expect(AR_OBJECT_IDS).toEqual(Object.keys(AR_OBJECTS));
    expect(arVolumeMl('litre-box')).toBe(1000);
    expect(arVolumeMl('cereal-box')).toBe(4200);
    expect(arVolumeMl('shoebox')).toBe(7068);
    expect(arVolumeMl('soup-can')).toBe(385);
    const box = arWire('shoebox');
    expect(box.vertices).toHaveLength(8);
    expect(box.edges).toHaveLength(12);
    const can = arWire('soup-can');
    expect(can.vertices).toHaveLength(AR_RING_POINTS * 2);
    expect(can.edges).toHaveLength(AR_RING_POINTS * 2 + 4);
    for (const id of AR_OBJECT_IDS) {
      const wire = arWire(id);
      for (const [from, to] of wire.edges) { expect(wire.vertices[from]).toBeDefined(); expect(wire.vertices[to]).toBeDefined(); }
      const longest = Math.max(...wire.vertices.flatMap((point) => point.map(Math.abs)));
      expect(longest).toBeCloseTo(0.8);
    }
    expect(readArPayload({ object: 'litre-box' })).toEqual({ object: 'litre-box' });
    expect(readArPayload({ object: 'sofa' })).toBeNull();
    expect(readArPayload({ object: 'litre-box', camera: true })).toBeNull();
    expect(readArPayload({})).toBeNull();
  });
});

describe('space2 pack: Core integration and age scope', () => {
  const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });

  it('opens ages 15-17 for surfaces, 12-17 for the globe and 13-17 for AR, and the adult pathway for all three', () => {
    expect(scope(SURFACE, '13-17', 13, 17)).not.toBeNull();
    expect(scope(SURFACE, '13-17', 15, 17)).toBeNull();
    expect(scope(SURFACE, '10-12', 12, 12)).not.toBeNull();
    expect(scope(GLOBE, '10-12', 11, 12)).not.toBeNull();
    expect(scope(GLOBE, '10-12', 12, 12)).toBeNull();
    expect(scope(GLOBE, '13-17', 13, 17)).toBeNull();
    expect(scope(AR, '10-12', 12, 12)).not.toBeNull();
    expect(scope(AR, '13-17', 13, 17)).toBeNull();
    expect(scope(AR, '6-9', 7, 9)).not.toBeNull();
    for (const type of [SURFACE, GLOBE, AR]) expect(scope(type, 'adult', 18, 99), type).toBeNull();
  });

  it('plugs the two graded kinds into Core: public schema, answer key and the server grade', () => {
    for (const entry of gradedFixtures) {
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

  it('rejects a key the grid or the globe contradicts at the grading gate', () => {
    for (const [id, wrong] of [['time-beats-rate', 'a'], ['price-and-units', 'a'], ['nearest-route', 'a'], ['cheapest-corridor', 'a']] as const) {
      const document = lesson(id);
      const segmentId = document.segments[0]!.id as string;
      expect(validateV2LessonForGrading(document, { [segmentId]: { choice: wrong } }, { lessonId: document.lesson_id, locale: document.locale }), id).toBeNull();
    }
  });

  it('serves the AR step as an ungraded step with no key, no scorer and a view receipt', () => {
    const document = lesson('object-on-the-table');
    const id = document.segments[0]!.id as string;
    const parsed = v2PublicLessonSchema.parse(document);
    expect(parsed.segments[0]!.grading).toBe('none');
    expect(v2ViewedSegmentIds(parsed)).toEqual([id]);
    expect(validateV2LessonForGrading(document, {}, { lessonId: document.lesson_id, locale: document.locale })).not.toBeNull();
    expect(validateV2LessonForGrading(document, { [id]: { choice: 'a' } }, { lessonId: document.lesson_id, locale: document.locale })).toBeNull();
    expect(gradeV2Visual(parsed, {}, id, { choice: 'a' })).toBeNull();
    expect(horizonteGrade({ type: AR }, { choice: 'a' }, undefined)).toBeNull();
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson('object-on-the-table', locale)).success, locale).toBe(true);
  });

  it('refuses a graded AR step, an AR payload that asks for the camera, a leaked answer, a wrong visual and an unsolvable payload', () => {
    const ar = lesson('object-on-the-table');
    const arSegment = ar.segments[0] as Record<string, unknown>;
    const parse = (segment: Record<string, unknown>, base = ar) => v2PublicLessonSchema.safeParse({ ...base, segments: [segment] }).success;
    expect(parse({ ...arSegment, grading: 'server' })).toBe(false);
    expect(parse({ ...arSegment, payload: { object: 'litre-box', camera: true } })).toBe(false);
    expect(parse({ ...arSegment, payload: { object: 'sofa' } })).toBe(false);
    expect(parse({ ...arSegment, visual: { type: 'ten-frame' } })).toBe(false);
    for (const entry of gradedFixtures) {
      const base = lesson(entry.id);
      const segment = base.segments[0] as Record<string, unknown>;
      expect(parse({ ...segment, payload: { ...(segment.payload as object), solution: 'x' } }, base as typeof ar), `${entry.id} leak`).toBe(false);
      expect(parse({ ...segment, visual: { type: 'ten-frame' } }, base as typeof ar), `${entry.id} visual`).toBe(false);
      expect(parse({ ...segment, grading: 'none' }, base as typeof ar), `${entry.id} ungraded`).toBe(false);
    }
    const surface = lesson('time-beats-rate');
    const surfaceSegment = surface.segments[0] as Record<string, unknown>;
    const surfacePayload = surfaceSegment.payload as { surface: object; ask: object };
    expect(parse({ ...surfaceSegment, payload: { ...surfacePayload, options: [{ id: 'a', x: 1, y: 3 }, { id: 'b', x: 1, y: 3 }] } }, surface as typeof ar)).toBe(false);
    expect(parse({ ...surfaceSegment, payload: { ...surfacePayload, ask: { kind: 'reach', targetCents: 1 } } }, surface as typeof ar)).toBe(false);
    const globe = lesson('nearest-route');
    const globeSegment = globe.segments[0] as Record<string, unknown>;
    const globePayload = globeSegment.payload as { routes: Array<Record<string, unknown>> };
    expect(parse({ ...globeSegment, payload: { ...globePayload, routes: [{ ...globePayload.routes[0], to: 'mexico-city' }, globePayload.routes[1]] } }, globe as typeof ar)).toBe(false);
    expect(parse({ ...globeSegment, payload: { ...globePayload, ask: 'cheapest' } }, globe as typeof ar)).toBe(false);
  });

  it('keeps the AR payload free of anything about a camera', () => {
    const keys = JSON.stringify(payloadOf('object-on-the-table'));
    expect(keys).toBe('{"object":"litre-box"}');
    expect(Object.keys(space2.rubrics)).not.toContain(AR);
    expect(Object.keys(space2.scorers)).not.toContain(AR);
  });
});
