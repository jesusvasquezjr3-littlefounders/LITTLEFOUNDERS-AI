import { describe, expect, it } from 'vitest';
import { checkV2Behaviour } from '../services/forgeV2Behaviour.js';
import { horizonteBehaviourKinds, horizonteBehaviourSpace } from '../services/forgeV2HorizonteBehaviour/index.js';
import { HORIZONTE_PACKS, isSeededHorizonteType } from '../services/horizonte/index.js';
import { ALG1_FIXTURES } from '../services/horizonte/alg1/fixtures.js';
import { ALG2_FIXTURES } from '../services/horizonte/alg2/fixtures.js';
import { BALANCE_FIXTURES } from '../services/horizonte/balance/fixtures.js';
import { COM_FIXTURES } from '../services/horizonte/com/fixtures.js';
import { FIN1_FIXTURES } from '../services/horizonte/fin1/fixtures.js';
import { FIN2_FIXTURES } from '../services/horizonte/fin2/fixtures.js';
import { GEOM2_FIXTURES } from '../services/horizonte/geom2/fixtures.js';
import { GOLDEN_FIXTURES } from '../services/horizonte/golden/fixtures.js';
import { NUM_A_FIXTURES } from '../services/horizonte/num-a/fixtures.js';
import { NUM_B_FIXTURES } from '../services/horizonte/num-b/fixtures.js';
import { PLANE1_FIXTURES } from '../services/horizonte/plane1/fixtures.js';
import { PROB_FIXTURES } from '../services/horizonte/prob/fixtures.js';
import { SIM1_FIXTURES } from '../services/horizonte/sim1/fixtures.js';
import { SIM2_FIXTURES } from '../services/horizonte/sim2/fixtures.js';
import { SOLIDS_FIXTURES } from '../services/horizonte/solids/fixtures.js';
import { SPACE1_FIXTURES } from '../services/horizonte/space1/fixtures.js';
import { SPACE2_FIXTURES } from '../services/horizonte/space2/fixtures.js';
import { STATS1_FIXTURES } from '../services/horizonte/stats1/fixtures.js';
import type { HorizonteFixture, HorizonteLocale } from '../services/horizonte/types.js';
import { gradeV2Visual, validateV2LessonForGrading } from '../services/v2LessonDocument.js';

/*
 * Core's interactive-behaviour gate fails closed on a kind it has no behaviour space for. These tests hold the Horizonte
 * spaces to the gate itself: every authored fixture of every modelled kind passes it in all three locales, the ladder each
 * fixture carries replays through Core's grader, and a key that disagrees with its board is caught. The seeded
 * simulations (sim1, sim2) are graded against an attempt the gate never has, so they stay fail-closed on purpose.
 */

const FIXTURES: HorizonteFixture[] = [
  ...ALG1_FIXTURES, ...ALG2_FIXTURES, ...BALANCE_FIXTURES, ...COM_FIXTURES, ...FIN1_FIXTURES, ...FIN2_FIXTURES, ...GEOM2_FIXTURES, ...GOLDEN_FIXTURES, ...NUM_A_FIXTURES,
  ...NUM_B_FIXTURES, ...PLANE1_FIXTURES, ...PROB_FIXTURES, ...SIM1_FIXTURES, ...SIM2_FIXTURES, ...SOLIDS_FIXTURES, ...SPACE1_FIXTURES, ...SPACE2_FIXTURES, ...STATS1_FIXTURES,
];
const LOCALES: readonly HorizonteLocale[] = ['en-US', 'es-MX', 'pt-BR'];
const CAPABILITIES = new Map<string, readonly string[]>();
for (const pack of HORIZONTE_PACKS) for (const [type, list] of Object.entries(pack.capabilities)) CAPABILITIES.set(type, list);

type Segment = { id: string; type: string; grading: string; payload: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const segmentOf = (fixture: HorizonteFixture, locale: HorizonteLocale = 'en-US') => fixture.segment(locale) as unknown as Segment;

function lessonOf(fixture: HorizonteFixture, locale: HorizonteLocale = 'en-US', rubric: unknown = fixture.rubric, edit?: (segment: Segment) => void) {
  const segment = structuredClone(segmentOf(fixture, locale));
  edit?.(segment);
  const document = {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-fixture', chapter_id: 'horizonte-fixture', lesson_id: `hz-fixture-${fixture.id}`,
    version_id: 'rev-1', locale, age_band: fixture.ageBand, eligibility: fixture.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
    title: fixture.title[locale], required_capabilities: [...(CAPABILITIES.get(segment.type) ?? [])], segments: [segment],
  };
  const keys = { [segment.id]: rubric };
  return { segment, keys, parsed: validateV2LessonForGrading(document, keys, { lessonId: document.lesson_id, locale }) };
}

const graded = FIXTURES.filter((fixture) => segmentOf(fixture).grading === 'server');
const seeded = graded.filter((fixture) => isSeededHorizonteType(segmentOf(fixture).type));
const modelled = graded.filter((fixture) => !isSeededHorizonteType(segmentOf(fixture).type));
const named = (fixture: HorizonteFixture) => `${segmentOf(fixture).type} ${fixture.id}`;
const fixtureById = (id: string) => FIXTURES.find((fixture) => fixture.id === id)!;

describe('the Horizonte behaviour spaces under Core\'s gate', () => {
  it('covers every fixture of the build, with the seeded simulations as the only graded kinds left out', () => {
    expect(FIXTURES.length).toBeGreaterThan(170);
    const left = [...new Set(graded.map((fixture) => segmentOf(fixture).type).filter((type) => !horizonteBehaviourKinds().includes(type)))].sort();
    expect(left).toEqual(['math.chance-sim.v2', 'math.galton-sim.v2', 'money.life-sim.v2', 'stats.bootstrap-sim.v2', 'stats.coverage-sim.v2']);
    for (const type of left) expect(isSeededHorizonteType(type)).toBe(true);
    for (const kind of horizonteBehaviourKinds()) {
      expect(CAPABILITIES.has(kind), kind).toBe(true);
      expect(isSeededHorizonteType(kind), kind).toBe(false);
    }
  });

  it.each(modelled.map((fixture) => [named(fixture), fixture] as const))('passes the gate in every locale: %s', (_name, fixture) => {
    for (const locale of LOCALES) {
      const { parsed, keys } = lessonOf(fixture, locale);
      expect(parsed, `${locale} refused by Core's contract`).not.toBeNull();
      const [report, ...rest] = checkV2Behaviour(parsed!, keys);
      expect(rest).toEqual([]);
      expect(report!.problems, locale).toEqual([]);
      expect(report!.ok).toBe(true);
      expect(report!.states).toBeGreaterThan(0);
    }
  });

  it.each(modelled.map((fixture) => [named(fixture), fixture] as const))('replays the ladder through Core\'s grader: %s', (_name, fixture) => {
    const { parsed, keys, segment } = lessonOf(fixture);
    const space = horizonteBehaviourSpace(segment as never, fixture.rubric as never)!;
    expect(space).not.toBeNull();
    expect(gradeV2Visual(parsed!, keys, segment.id, fixture.ladder.met)?.correct).toBe(true);
    expect(space.expectMet?.(fixture.ladder.met as never)).toBe(true);
    expect(gradeV2Visual(parsed!, keys, segment.id, fixture.ladder.valid)).toBeNull();
    expect(gradeV2Visual(parsed!, keys, segment.id, fixture.ladder.invalid)).toBeNull();
  });

  it.each(modelled.map((fixture) => [named(fixture), fixture] as const))('builds a bounded, deterministic space with refusals: %s', (_name, fixture) => {
    const { segment } = lessonOf(fixture);
    const first = horizonteBehaviourSpace(segment as never, fixture.rubric as never)!;
    const second = horizonteBehaviourSpace(segment as never, fixture.rubric as never)!;
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.inRange.length).toBeGreaterThan(1);
    expect(first.inRange.length).toBeLessThanOrEqual(6_000);
    expect(first.invalid.length).toBeGreaterThan(0);
    const inside = new Set(first.inRange.map((state) => JSON.stringify(state)));
    for (const state of first.invalid) expect(inside.has(JSON.stringify(state)), JSON.stringify(state)).toBe(false);
    if (first.initial !== undefined) expect(inside.has(JSON.stringify(first.initial))).toBe(false);
  });

  it.each(seeded.map((fixture) => [named(fixture), fixture] as const))('keeps the seeded kind fail-closed: %s', (_name, fixture) => {
    const { parsed, keys, segment } = lessonOf(fixture);
    expect(horizonteBehaviourSpace(segment as never, fixture.rubric as never)).toBeNull();
    expect(parsed).not.toBeNull();
    const [report] = checkV2Behaviour(parsed!, keys);
    expect(report!.ok).toBe(false);
    expect(report!.problems.join(' ')).toMatch(/no behaviour space defined/);
  });

  it('returns nothing for a kind, a payload or a rubric it does not model', () => {
    const coin = lessonOf(fixtureById('coins-as-tall-as-a-phone')).segment;
    expect(horizonteBehaviourSpace({ ...coin, type: 'math.unknown-kind.v2' } as never, { target: '4' })).toBeNull();
    expect(horizonteBehaviourSpace({ ...coin, type: 'constructor' } as never, { target: '4' })).toBeNull();
    expect(horizonteBehaviourSpace({ ...coin, type: '__proto__' } as never, { target: '4' })).toBeNull();
    expect(horizonteBehaviourSpace({ ...coin, payload: null } as never, { target: '4' })).toBeNull();
    expect(horizonteBehaviourSpace({ ...coin, payload: { piece: 'coin' } } as never, { target: '4' })).toBeNull();
    expect(horizonteBehaviourSpace(coin as never, null as never)).toBeNull();
    expect(horizonteBehaviourSpace(coin as never, 'x' as never)).toBeNull();
    expect(horizonteBehaviourSpace(coin as never, { target: '4' })).not.toBeNull();
  });

  it('fails closed on a solid-section mode it cannot model and on a cut that only touches the solid', () => {
    const section = segmentOf(fixtureById('cube-hexagon'));
    const withMode = (mode: string) => ({ ...section, payload: { ...section.payload, mode } });
    expect(horizonteBehaviourSpace(withMode('unfolding') as never, { pick: 'hexagon' })).toBeNull();
    const touching = { ...section, payload: { ...section.payload, plane: { normal: [1, 0, 0], offset: 4 } } };
    expect(horizonteBehaviourSpace(touching as never, { pick: 'hexagon' })).toBeNull();
    expect(horizonteBehaviourSpace(section as never, { pick: 'hexagon' })).not.toBeNull();
  });

  it('refuses to model a choice question whose payload has no single answer', () => {
    const globe = segmentOf(fixtureById('nearest-route'));
    const tied = { ...globe, payload: { ...globe.payload, routes: globe.payload.routes.map((route: Record<string, unknown>) => ({ ...route, to: 'madrid' })) } };
    expect(horizonteBehaviourSpace(tied as never, { choice: 'b' })).toBeNull();
    const surface = segmentOf(fixtureById('time-beats-rate'));
    const flat = { ...surface, payload: { ...surface.payload, options: surface.payload.options.map((option: Record<string, unknown>) => ({ ...option, x: 1, y: 1 })) } };
    expect(horizonteBehaviourSpace(flat as never, { choice: 'c' })).toBeNull();
  });
});

const REFUSED = "refused by Core's v2 contract";
const refusalsOf = (fixture: HorizonteFixture, rubric: unknown, edit?: (segment: Segment) => void): string[] => {
  const { parsed, keys } = lessonOf(fixture, 'en-US', rubric, edit);
  return parsed ? checkV2Behaviour(parsed, keys).flatMap((report) => report.problems) : [REFUSED];
};

/** The gate's own per-state comparison, run on a model built from one payload against a scorer that holds another. */
function disagreements(modelOf: { segment: Segment; rubric: unknown }, scorerOf: { fixture: HorizonteFixture; rubric: unknown; edit: (segment: Segment) => void }): number {
  const space = horizonteBehaviourSpace(modelOf.segment as never, modelOf.rubric as never)!;
  const { parsed, keys, segment } = lessonOf(scorerOf.fixture, 'en-US', scorerOf.rubric, scorerOf.edit);
  expect(parsed, 'the scorer side must be a lesson Core accepts').not.toBeNull();
  let count = 0;
  for (const state of space.inRange) {
    const graded = gradeV2Visual(parsed!, keys, segment.id, state);
    if (graded === null || space.expectMet!(state as never) !== graded.correct) count += 1;
  }
  return count;
}

describe('an authored key that disagrees with its board', () => {
  it('is refused by Core\'s contract before the gate runs', () => {
    const cases: Array<[string, unknown]> = [
      ['coins-as-tall-as-a-phone', { target: '5' }],
      ['time-beats-rate', { choice: 'a' }],
      ['nearest-route', { choice: 'a' }],
      ['cube-hexagon', { pick: 'triangle' }],
      ['cube-edges', { target: '11' }],
      ['pyramid-third', { target: '180' }],
      ['turn-the-l', { pick: 'a', angles: [180] }],
      ['exact-basket', { solutions: [{ apple: ['item', 'item', 'item', 'item'] }] }],
      ['which-has-no-vertices', { solid: 'cylinder', count: '2' }],
      ['nine-edges', { solid: 'cube', count: '6' }],
      ['staircase', { solutions: [{ c2r0: ['cube'], c1r1: ['cube', 'cube'], c0r2: ['cube'] }] }],
      ['finish-the-net', { solutions: [{ g0x1: ['square'], g1x1: ['square'], g2x1: ['square'], g3x1: ['square'], g1x0: ['square'], g0x0: ['square'] }] }],
    ];
    for (const [id, rubric] of cases) {
      expect(refusalsOf(fixtureById(id), fixtureById(id).rubric), id).toEqual([]);
      expect(refusalsOf(fixtureById(id), rubric), id).toEqual([REFUSED]);
    }
  });

  it('is caught by the model when the scorer drifts from it: a coin height, a surface ask, a solid count', () => {
    const coins = fixtureById('coins-as-tall-as-a-phone');
    const coinModel = { segment: lessonOf(coins).segment, rubric: coins.rubric };
    expect(disagreements(coinModel, { fixture: coins, rubric: coins.rubric, edit: () => undefined })).toBe(0);
    expect(disagreements(coinModel, { fixture: coins, rubric: { target: '6' }, edit: (segment) => { segment.payload.goal.mm = 12; } })).toBeGreaterThan(0);

    const surface = fixtureById('time-beats-rate');
    const surfaceModel = { segment: lessonOf(surface).segment, rubric: surface.rubric };
    expect(disagreements(surfaceModel, { fixture: surface, rubric: surface.rubric, edit: () => undefined })).toBe(0);
    expect(disagreements(surfaceModel, { fixture: surface, rubric: { choice: 'b' }, edit: (segment) => { segment.payload.ask = { kind: 'lowest' }; } })).toBeGreaterThan(0);

    const euler = fixtureById('cube-edges');
    const eulerModel = { segment: lessonOf(euler).segment, rubric: euler.rubric };
    expect(disagreements(eulerModel, { fixture: euler, rubric: euler.rubric, edit: () => undefined })).toBe(0);
    expect(disagreements(eulerModel, { fixture: euler, rubric: { target: '8' }, edit: (segment) => { segment.payload.hide = 'vertices'; } })).toBeGreaterThan(0);
  });
});

const spaceOf = (fixture: HorizonteFixture, edit?: (segment: Segment) => void, rubric: unknown = fixture.rubric) => {
  const { segment } = lessonOf(fixture, 'en-US', rubric, edit);
  return horizonteBehaviourSpace(segment as never, rubric as never);
};
const diagnosticOf = (fixture: HorizonteFixture, response: unknown): string | null | undefined => {
  const { parsed, keys, segment } = lessonOf(fixture);
  return gradeV2Visual(parsed!, keys, segment.id, response as never)?.diagnostic;
};

describe('the pieces the visual merge added to the behaviour space', () => {
  const added = ['geometry.solid-section.v2', 'math.number-line.order.v2', 'math.ruler.measure.v2', 'math.surface-formula.v2', 'math.tessellation.v2'];

  it('has a model for each of them, and every authored fixture of them builds a space', () => {
    for (const type of added) {
      expect(horizonteBehaviourKinds(), type).toContain(type);
      const fixtures = modelled.filter((fixture) => segmentOf(fixture).type === type);
      expect(fixtures.length, type).toBeGreaterThan(1);
      for (const fixture of fixtures) expect(spaceOf(fixture), `${type} ${fixture.id}`).not.toBeNull();
    }
  });

  it('reads the motions a tessellation allows from its payload', () => {
    const states = (id: string) => spaceOf(fixtureById(id))!.inRange as Array<{ motions?: string[] }>;
    expect(states('tile-domino').every((state) => state.motions === undefined)).toBe(true);
    expect(states('tile-turn').some((state) => state.motions?.includes('turn'))).toBe(true);
    expect(states('tile-flip').some((state) => state.motions?.includes('flip'))).toBe(true);
    expect(states('tile-turn').some((state) => state.motions?.includes('flip'))).toBe(false);
    expect(states('tile-flip').some((state) => state.motions?.includes('turn'))).toBe(false);
  });

  it('catches a tessellation model that allows a motion the scorer does not', () => {
    const turn = fixtureById('tile-turn');
    const same = { segment: lessonOf(turn).segment, rubric: turn.rubric };
    expect(disagreements(same, { fixture: turn, rubric: turn.rubric, edit: () => undefined })).toBe(0);
    const wider = lessonOf(turn, 'en-US', turn.rubric, (segment) => { segment.payload.moves = ['slide', 'turn', 'flip']; }).segment;
    expect(disagreements({ segment: wider, rubric: turn.rubric }, { fixture: turn, rubric: turn.rubric, edit: () => undefined })).toBeGreaterThan(0);
  });

  it('models every mode of the solid section, and returns a space only for a slide that can reach its target', () => {
    const sections = modelled.filter((fixture) => segmentOf(fixture).type === 'geometry.solid-section.v2');
    const modes = new Set(sections.map((fixture) => segmentOf(fixture).payload.mode));
    expect([...modes].sort()).toEqual(['cone', 'euler', 'section', 'slide', 'volume']);
    for (const fixture of sections) expect(spaceOf(fixture), fixture.id).not.toBeNull();
    const slide = fixtureById('slide-cube-hexagon');
    const space = spaceOf(slide)!;
    const start = segmentOf(slide).payload.start;
    expect(space.initial).toEqual({ offset: start });
    expect(space.inRange.some((state) => (state as { offset: number }).offset === start)).toBe(false);
    expect(space.inRange.length).toBeGreaterThan(10);
    expect(spaceOf(slide, (segment) => { segment.payload.target = 'pentagon'; })).toBeNull();
    expect(spaceOf(slide, (segment) => { segment.payload.start = 99; })).toBeNull();
  });

  it('keeps the Euler and cone answers of the larger solids exact', () => {
    for (const id of ['truncated-icosahedron-faces', 'cuboctahedron-edges', 'cone-third']) {
      const fixture = fixtureById(id);
      const space = spaceOf(fixture)!;
      expect(space.expectMet!(fixture.ladder.met as never), id).toBe(true);
      expect(space.expectMet!(fixture.ladder.valid as never), id).toBe(false);
    }
  });

  it('models the order and the ruler reading by their own rules', () => {
    for (const id of ['order-tens', 'order-tenths']) {
      const fixture = fixtureById(id);
      const space = spaceOf(fixture)!;
      expect(space.expectMet!(fixture.ladder.met as never), id).toBe(true);
      expect(space.expectMet!(fixture.ladder.valid as never), id).toBe(false);
      expect(space.invalid.length, id).toBeGreaterThan(3);
    }
    const ruler = fixtureById('measure-pencil');
    const space = spaceOf(ruler)!;
    const length = Number(Object.values(ruler.ladder.met)[0]);
    for (const spelling of [String(length), `${length}.0`, `${length * 2}/2`]) expect(space.expectMet!({ value: spelling } as never), spelling).toBe(true);
    expect(space.expectMet!({ value: `${length + 1}` } as never)).toBe(false);
  });

  it('models every kind of surface-formula task, with the diagnostics Core stores', () => {
    for (const id of ['slope-two-ways', 'gradient-at-a-point', 'downhill-walk', 'build-a-surface']) {
      const fixture = fixtureById(id);
      const space = spaceOf(fixture)!;
      expect(space.expectMet!(fixture.ladder.met as never), id).toBe(true);
      expect(space.expectMet!(fixture.ladder.valid as never), id).toBe(false);
    }
    const gradient = fixtureById('gradient-at-a-point');
    const space = spaceOf(gradient)!;
    for (const [answer, diagnostic] of [[['3', '9'], 'partial'], [['1', '3'], 'structure'], [['5', '5'], 'value']] as const) {
      expect(space.expectDiagnostic!({ answer } as never), answer.join()).toBe(diagnostic);
      expect(diagnosticOf(gradient, { answer }), answer.join()).toBe(diagnostic);
    }
    const slope = fixtureById('slope-two-ways');
    expect(spaceOf(slope)!.expectDiagnostic!({ answer: ['2'] } as never)).toBe(diagnosticOf(slope, { answer: ['2'] }));
    const build = fixtureById('build-a-surface');
    for (const text of ['z = 1 + 2x - y', '1+2x', '5', 'x^2']) {
      expect(spaceOf(build)!.expectMet!({ answer: [text] } as never), text).toBe(text === 'z = 1 + 2x - y');
    }
    expect(spaceOf(build)!.expectDiagnostic!({ answer: ['1+2x'] } as never)).toBe(diagnosticOf(build, { answer: ['1+2x'] }));
  });

  it('is caught by the model when the surface-formula scorer drifts: a changed expression or walk rate', () => {
    const slope = fixtureById('slope-two-ways');
    const model = { segment: lessonOf(slope).segment, rubric: slope.rubric };
    expect(disagreements(model, { fixture: slope, rubric: slope.rubric, edit: () => undefined })).toBe(0);
    expect(disagreements(model, { fixture: slope, rubric: { key: ['8'] }, edit: (segment) => { segment.payload.task.expression = 'x^2+3xy'; } })).toBeGreaterThan(0);
    const walk = fixtureById('downhill-walk');
    const walkModel = { segment: lessonOf(walk).segment, rubric: walk.rubric };
    expect(disagreements(walkModel, { fixture: walk, rubric: walk.rubric, edit: () => undefined })).toBe(0);
    expect(disagreements(walkModel, { fixture: walk, rubric: { key: ['2'] }, edit: (segment) => { segment.payload.task.rate = { n: 1, d: 5 }; } })).toBeGreaterThan(0);
  });

  it('fails closed on a surface-formula task it cannot model', () => {
    const slope = fixtureById('slope-two-ways');
    expect(spaceOf(slope, (segment) => { segment.payload.task.expression = 'x^y'; })).toBeNull();
    expect(spaceOf(slope, (segment) => { segment.payload.task.kind = 'curl'; })).toBeNull();
    expect(spaceOf(slope, (segment) => { segment.payload.task = null; })).toBeNull();
    const walk = fixtureById('downhill-walk');
    expect(spaceOf(walk, (segment) => { segment.payload.task.below = -50; })).toBeNull();
  });
});
