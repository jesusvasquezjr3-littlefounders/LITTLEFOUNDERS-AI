import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { behaviourSpace, checkV2Behaviour } from '../services/forgeV2Behaviour.js';
import { horizonteBehaviourKinds, horizonteBehaviourSpace } from '../services/forgeV2HorizonteBehaviour/index.js';
import { HORIZONTE_PACKS, isSeededHorizonteType } from '../services/horizonte/index.js';
import { SAMPLE_ATTEMPT } from '../services/horizonte/seed/protocol.js';
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
 * spaces to the gate itself: every authored fixture of every kind passes it in all three locales, the ladder each
 * fixture carries replays through Core's grader, and a key that disagrees with its board is caught. The five seeded
 * simulations are graded under an attempt the gate supplies itself; without one, they are still refused.
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

const SEEDED_KINDS = ['math.chance-sim.v2', 'math.galton-sim.v2', 'money.life-sim.v2', 'stats.bootstrap-sim.v2', 'stats.coverage-sim.v2'];
const RUN_FIELD: Record<string, string> = { 'math.chance-sim.v2': 'trials', 'math.galton-sim.v2': 'balls', 'stats.bootstrap-sim.v2': 'resamples' };
const graded = FIXTURES.filter((fixture) => segmentOf(fixture).grading === 'server');
const seeded = graded.filter((fixture) => isSeededHorizonteType(segmentOf(fixture).type));
const modelled = graded.filter((fixture) => !isSeededHorizonteType(segmentOf(fixture).type));
const named = (fixture: HorizonteFixture) => `${segmentOf(fixture).type} ${fixture.id}`;
const fixtureById = (id: string) => FIXTURES.find((fixture) => fixture.id === id)!;

describe('the Horizonte behaviour spaces under Core\'s gate', () => {
  it('covers every graded fixture of the build, the five seeded simulations included', () => {
    expect(FIXTURES.length).toBeGreaterThan(170);
    const left = [...new Set(graded.map((fixture) => segmentOf(fixture).type).filter((type) => !horizonteBehaviourKinds().includes(type)))].sort();
    expect(left).toEqual([]);
    expect([...new Set(seeded.map((fixture) => segmentOf(fixture).type))].sort()).toEqual(SEEDED_KINDS);
    for (const kind of horizonteBehaviourKinds()) expect(CAPABILITIES.has(kind), kind).toBe(true);
    for (const kind of SEEDED_KINDS) expect(isSeededHorizonteType(kind), kind).toBe(true);
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
    const length = Number(Object.values(ruler.ladder.met as Record<string, unknown>)[0]);
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

describe('the solid nets the second merge added to the behaviour space', () => {
  const nets = modelled.filter((fixture) => segmentOf(fixture).type === 'geometry.solid-net.v2');
  const diagnosticsOf = (fixture: HorizonteFixture): Set<string | null | undefined> => {
    const space = spaceOf(fixture)!;
    return new Set(space.inRange.filter((state) => !space.expectMet!(state as never)).map((state) => space.expectDiagnostic!(state as never)));
  };

  it('models the cube-net area and every mode of the solid net, and each authored fixture builds a space', () => {
    expect(horizonteBehaviourKinds()).toContain('geometry.solid-net.v2');
    expect([...new Set(nets.map((fixture) => segmentOf(fixture).payload.mode))].sort()).toEqual(['area', 'complete', 'label']);
    expect(nets).toHaveLength(9);
    for (const fixture of nets) expect(spaceOf(fixture), fixture.id).not.toBeNull();
    const cube = fixtureById('area-of-the-cube');
    expect(segmentOf(cube).payload.mode).toBe('area');
    expect(spaceOf(cube)).not.toBeNull();
  });

  it('keeps the exact surface areas of the cube, the box, the prism and the pyramid', () => {
    for (const [id, target] of [['area-of-the-cube', '54'], ['area-of-the-box', '52'], ['area-of-the-prism', '72'], ['area-of-the-pyramid', '96']] as const) {
      const space = spaceOf(fixtureById(id))!;
      for (const spelling of [target, `${target}.0`, `${Number(target) * 2}/2`]) expect(space.expectMet!({ value: spelling } as never), `${id} ${spelling}`).toBe(true);
      for (const spelling of [String(Number(target) + 1), String(Number(target) - 1), '', 'abc']) expect(space.expectMet!({ value: spelling } as never), `${id} ${spelling}`).toBe(false);
      expect(space.invalid.length, id).toBeGreaterThan(3);
    }
  });

  it('gives the area answers the diagnostics Core stores: one face too many, some faces, any other value', () => {
    const box = fixtureById('area-of-the-box');
    const space = spaceOf(box)!;
    for (const [value, diagnostic] of [['64', 'false_alarm'], ['60', 'false_alarm'], ['32', 'miss'], ['12', 'miss'], ['53', 'value'], ['1', 'value']] as const) {
      expect(space.expectDiagnostic!({ value } as never), value).toBe(diagnostic);
      expect(diagnosticOf(box, { value }), value).toBe(diagnostic);
    }
    const cube = fixtureById('area-of-the-cube');
    for (const [value, diagnostic] of [['63', 'false_alarm'], ['27', 'miss'], ['55', 'value']] as const) {
      expect(spaceOf(cube)!.expectDiagnostic!({ value } as never), value).toBe(diagnostic);
      expect(diagnosticOf(cube, { value }), value).toBe(diagnostic);
    }
  });

  it('models the labelling by the panels Core stores, and agrees with Core on every partial answer', () => {
    for (const id of ['name-the-box', 'name-the-prism', 'name-the-pyramid']) {
      const fixture = fixtureById(id);
      const space = spaceOf(fixture)!;
      expect(space.expectMet!(fixture.ladder.met as never), id).toBe(true);
      expect(space.expectMet!(fixture.ladder.valid as never), id).toBe(false);
      expect(space.invalid.length, id).toBeGreaterThan(1);
      for (const state of space.inRange) {
        if (!space.expectMet!(state as never)) expect(space.expectDiagnostic!(state as never), `${id} ${JSON.stringify(state)}`).toBe(diagnosticOf(fixture, state));
      }
    }
    const prism = fixtureById('name-the-prism');
    const slots = { panel2: ['slope'] };
    expect(diagnosticOf(prism, { slots: { ...slots, panel0: ['back'] } })).toBe('miss');
    expect(diagnosticOf(prism, { slots: { ...slots, panel0: ['back'], panel1: ['left'] } })).toBe('partial');
    expect(diagnosticOf(prism, { slots: { ...slots, panel0: ['left'] } })).toBe('value');
  });

  it('agrees with Core on every state of every completion, and reaches all three diagnostics', () => {
    const seen = new Set<string | null | undefined>();
    for (const id of ['finish-the-box-net', 'finish-the-prism-net', 'finish-the-pyramid-net']) {
      const fixture = fixtureById(id);
      const space = spaceOf(fixture)!;
      expect(space.expectMet!(fixture.ladder.met as never), id).toBe(true);
      expect(space.expectMet!(fixture.ladder.valid as never), id).toBe(false);
      expect(space.inRange.length, id).toBeGreaterThan(10);
      expect(space.invalid.length, id).toBeGreaterThan(3);
      for (const state of space.inRange) {
        if (!space.expectMet!(state as never)) expect(space.expectDiagnostic!(state as never), `${id} ${JSON.stringify(state)}`).toBe(diagnosticOf(fixture, state));
      }
      for (const entry of diagnosticsOf(fixture)) seen.add(entry);
    }
    expect([...seen].filter((entry) => entry !== null).sort()).toEqual(['miss', 'structure', 'value']);
  });

  it('is caught by the model when the scorer drifts: a wider sheet, other dimensions', () => {
    const box = fixtureById('finish-the-box-net');
    const model = { segment: lessonOf(box).segment, rubric: box.rubric };
    expect(disagreements(model, { fixture: box, rubric: box.rubric, edit: () => undefined })).toBe(0);
    const wider = lessonOf(box, 'en-US', box.rubric, (segment) => { segment.payload.sheet = { width: 60, height: 60 }; }).segment;
    expect(disagreements({ segment: wider, rubric: box.rubric }, { fixture: box, rubric: box.rubric, edit: () => undefined })).toBeGreaterThan(0);

    const area = fixtureById('area-of-the-box');
    const areaModel = { segment: lessonOf(area).segment, rubric: area.rubric };
    expect(disagreements(areaModel, { fixture: area, rubric: area.rubric, edit: () => undefined })).toBe(0);
    expect(disagreements(areaModel, { fixture: area, rubric: { target: '66' }, edit: (segment) => { segment.payload.solid.dims = [4, 3, 3]; } })).toBeGreaterThan(0);

    const cube = fixtureById('area-of-the-cube');
    const cubeModel = { segment: lessonOf(cube).segment, rubric: cube.rubric };
    expect(disagreements(cubeModel, { fixture: cube, rubric: cube.rubric, edit: () => undefined })).toBe(0);
    expect(disagreements(cubeModel, { fixture: cube, rubric: { target: '96' }, edit: (segment) => { segment.payload.edge = 4; } })).toBeGreaterThan(0);
  });

  it('fails closed on a solid net it cannot model', () => {
    const box = fixtureById('finish-the-box-net');
    expect(spaceOf(box, (segment) => { segment.payload.mode = 'fold'; })).toBeNull();
    expect(spaceOf(box, (segment) => { segment.payload.solid.kind = 'torus'; })).toBeNull();
    expect(spaceOf(box, (segment) => { segment.payload.solid.dims = [4, 3]; })).toBeNull();
    expect(spaceOf(box, (segment) => { segment.payload.sheet = { width: 2, height: 11 }; })).toBeNull();
    expect(spaceOf(box, (segment) => { segment.payload.sheet = { width: 3, height: 3 }; })).toBeNull();
    expect(spaceOf(box, (segment) => { segment.payload.fixed = []; })).toBeNull();
    expect(spaceOf(box, (segment) => { segment.payload.fixed = [{ parent: 'bottom', child: 'bottom' }]; })).toBeNull();
    expect(spaceOf(box, (segment) => { segment.payload.fixed = [{ parent: 'front', child: 'back' }]; })).toBeNull();
    expect(spaceOf(box, (segment) => { segment.payload.root = 'lid'; })).toBeNull();

    const prism = fixtureById('name-the-prism');
    expect(spaceOf(prism, undefined, { solutions: [] })).toBeNull();
    expect(spaceOf(prism, undefined, {})).toBeNull();
    expect(spaceOf(prism, undefined, { solutions: [{ panel0: ['back'], panel1: ['bottom'], panel2: ['bottom'], panel3: ['left'], panel4: ['right'] }] })).toBeNull();
    expect(spaceOf(prism, undefined, { solutions: [{ panel0: ['back'], panel1: ['bottom'], panel2: ['left'], panel3: ['slope'], panel4: ['right'] }] })).toBeNull();
    expect(spaceOf(prism, (segment) => { segment.payload.fixed = 'slope'; })).toBeNull();

    const area = fixtureById('area-of-the-prism');
    expect(spaceOf(area, (segment) => { segment.payload.solid.dims = [3, 5, 6]; })).toBeNull();
    expect(spaceOf(area, (segment) => { segment.payload.solid.dims = [0, 4, 5]; })).toBeNull();
    expect(spaceOf(area, (segment) => { segment.payload.solid = null; })).toBeNull();

    const cube = fixtureById('area-of-the-cube');
    for (const edge of [0, 41, 1.5, '3']) expect(spaceOf(cube, (segment) => { segment.payload.edge = edge; }), String(edge)).toBeNull();
  });
});

const seededNames = seeded.map((fixture) => [named(fixture), fixture] as const);
/** A coverage board whose goal every offered choice reaches: the gate rightly calls it trivially met. */
const EASY_BOARDS = ['coverage-one-half'];
const hardNames = seededNames.filter(([, fixture]) => !EASY_BOARDS.includes(fixture.id));
const otherSeed = (seed: string) => (seed.startsWith('a') ? 'b' : 'a') + seed.slice(1);

/** One seeded fixture graded under the attempt its ladder was simulated under, the way Core grades a real run. */
function seededRun(fixture: HorizonteFixture, locale: HorizonteLocale = 'en-US') {
  const { parsed, keys, segment } = lessonOf(fixture, locale);
  expect(parsed, 'Core must accept the lesson').not.toBeNull();
  const attempt = { seed: fixture.seed! };
  const grade = (response: unknown, given: { seed: string } | undefined = attempt) => gradeV2Visual(parsed!, keys, segment.id, response as never, given);
  const space = horizonteBehaviourSpace(segment as never, fixture.rubric as never, attempt)!;
  expect(space, 'the space must exist under an attempt').not.toBeNull();
  return { parsed: parsed!, keys, segment, attempt, grade, space };
}

describe('the five seeded simulations under Core\'s gate', () => {
  it('has fixtures of every one of the five kinds', () => {
    for (const kind of SEEDED_KINDS) expect(seeded.filter((fixture) => segmentOf(fixture).type === kind).length, kind).toBeGreaterThan(1);
  });

  it.each(hardNames)('passes the gate in every locale under the gate\'s own attempt: %s', (_name, fixture) => {
    for (const locale of LOCALES) {
      const { parsed, keys } = lessonOf(fixture, locale);
      const [report, ...rest] = checkV2Behaviour(parsed!, keys);
      expect(rest).toEqual([]);
      expect(report!.problems, locale).toEqual([]);
      expect(report!.ok).toBe(true);
      expect(report!.states).toBeGreaterThan(1);
    }
  });

  it('supplies its own attempt: synthetic, not the publish sample, not a fixture seed, and the source never reaches the secret', () => {
    const fixture = seeded[0]!;
    const { segment } = lessonOf(fixture);
    const space = behaviourSpace(segment as never, fixture.rubric as never)!;
    expect(space.attempt!.seed).toMatch(/^[0-9a-f]{64}$/);
    expect(space.attempt!.seed).not.toBe(SAMPLE_ATTEMPT.seed);
    expect(seeded.map((entry) => entry.seed)).not.toContain(space.attempt!.seed);
    const source = readFileSync(new URL('../services/forgeV2Behaviour.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/horizonteAttemptSeed|deriveAttemptSeed|process\.env/);
  });

  it.each(seededNames)('replays the ladder under the seed it was simulated under: %s', (_name, fixture) => {
    const { grade, space } = seededRun(fixture);
    expect(grade(fixture.ladder.met)?.correct).toBe(true);
    expect(space.expectMet!(fixture.ladder.met as never)).toBe(true);
    expect(grade(fixture.ladder.valid)).toBeNull();
    expect(grade(fixture.ladder.invalid)).toBeNull();
  });

  it('fails a coverage board that every offered choice satisfies, and still scores it as Core does', () => {
    const fixture = fixtureById('coverage-one-half');
    const { parsed, keys } = lessonOf(fixture);
    const [report] = checkV2Behaviour(parsed!, keys);
    expect(report!.ok).toBe(false);
    expect(report!.problems.join(' ')).toMatch(/trivially met/);
    expect(report!.problems.filter((problem) => !/trivially met/.test(problem))).toEqual([]);
    const { grade, space } = seededRun(fixture);
    expect(space.inRange.every((state) => space.expectMet!(state as never))).toBe(true);
    for (const state of space.inRange) expect(grade(state)?.correct, JSON.stringify(state)).toBe(true);
  });

  it.each(hardNames)('has a met state and a state short of it, and Core agrees on both: %s', (_name, fixture) => {
    const { grade, space } = seededRun(fixture);
    const met = space.inRange.filter((state) => space.expectMet!(state as never));
    const short = space.inRange.filter((state) => !space.expectMet!(state as never));
    expect(met.length).toBeGreaterThan(0);
    expect(short.length).toBeGreaterThan(0);
    for (const state of met) expect(grade(state)?.correct, JSON.stringify(state)).toBe(true);
    for (const state of short) {
      const result = grade(state);
      expect(result, JSON.stringify(state)).not.toBeNull();
      expect(result!.correct, JSON.stringify(state)).toBe(false);
      expect(result!.score, JSON.stringify(state)).toBeLessThan(100);
    }
  });

  it.each(seededNames)('refuses a wrong seed, a malformed seed and an off-grid parameter: %s', (_name, fixture) => {
    const { grade, space } = seededRun(fixture);
    const met = fixture.ladder.met as Record<string, unknown>;
    const reversed = [...fixture.seed!].reverse().join('');
    for (const seed of [otherSeed(fixture.seed!), reversed, SAMPLE_ATTEMPT.seed, fixture.seed!.toUpperCase(), fixture.seed!.slice(1), `${fixture.seed!}0`, '']) {
      expect(grade({ ...met, seed }), seed.slice(0, 8)).toBeNull();
    }
    expect(grade({ ...met, seed: undefined })).toBeNull();
    expect(space.invalid.length).toBeGreaterThan(6);
    for (const state of space.invalid) expect(grade(state), JSON.stringify(state)).toBeNull();
    const inside = new Set(space.inRange.map((state) => JSON.stringify(state)));
    for (const state of space.invalid) expect(inside.has(JSON.stringify(state))).toBe(false);
  });

  it.each(seededNames)('contains a hostile response without a throw and never grades it met: %s', (_name, fixture) => {
    const { grade, space } = seededRun(fixture);
    expect(space.hostile!.length).toBeGreaterThan(30);
    for (const response of space.hostile!) {
      let result: ReturnType<typeof grade> | 'threw';
      try { result = grade(response); } catch { result = 'threw'; }
      const shown = JSON.stringify(response)?.slice(0, 80);
      expect(result, shown).not.toBe('threw');
      if (result !== 'threw' && result !== null) expect(result.correct, shown).toBe(false);
    }
  });

  it.each(seededNames)('stays fail-closed without an attempt: %s', (_name, fixture) => {
    const { parsed, keys, segment } = lessonOf(fixture);
    expect(horizonteBehaviourSpace(segment as never, fixture.rubric as never)).toBeNull();
    expect(horizonteBehaviourSpace(segment as never, fixture.rubric as never, undefined)).toBeNull();
    expect(gradeV2Visual(parsed!, keys, segment.id, fixture.ladder.met as never)).toBeNull();
    expect(gradeV2Visual(parsed!, keys, segment.id, fixture.ladder.met as never, undefined)).toBeNull();
  });

  it.each(seededNames.filter(([, fixture]) => RUN_FIELD[segmentOf(fixture).type]))('walks the run-length slider: too short, not started, off the stops: %s', (_name, fixture) => {
    const { segment, grade, space } = seededRun(fixture);
    const field = RUN_FIELD[segment.type]!;
    const stops = segment.payload.stops as number[];
    const floor = (segment.payload.minTrials ?? segment.payload.minBalls ?? segment.payload.minResamples) as number;
    const at = (runs: unknown) => ({ seed: fixture.seed, [field]: runs });
    expect(space.inRange).toHaveLength(stops.length);
    expect(stops[0]).toBeLessThan(floor);
    expect(grade(at(stops[0]))?.correct).toBe(false);
    expect(grade(at(stops[stops.length - 1]))?.correct).toBe(true);
    expect(grade(at(0))).toBeNull();
    for (const runs of [stops[0]! + 1, stops[stops.length - 1]! + 1, -1, 1.5, '5', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(stops.includes(runs as number)).toBe(false);
      expect(grade(at(runs)), String(runs)).toBeNull();
    }
    for (const runs of stops.filter((value) => value < floor)) expect(grade(at(runs))?.correct, String(runs)).toBe(false);
  });

  it.each(seededNames.filter(([, fixture]) => segmentOf(fixture).type === 'stats.coverage-sim.v2'))('walks the level and size sliders, and refuses the start and off-grid choices: %s', (_name, fixture) => {
    const { segment, grade, space } = seededRun(fixture);
    const { levels, sizes, start } = segment.payload as { levels: number[]; sizes: number[]; start: { level: number; size: number } };
    expect(space.inRange).toHaveLength(levels.length * sizes.length - 1);
    const at = (level: unknown, size: unknown) => ({ seed: fixture.seed, level, size });
    expect(grade(at(start.level, start.size))).toBeNull();
    expect(space.initial).toEqual(at(start.level, start.size));
    expect(grade(at(Math.max(...levels), Math.max(...sizes)))?.correct).toBe(true);
    expect(space.inRange.some((state) => space.expectMet!(state as never))).toBe(true);
    expect(levels.includes(7)).toBe(false);
    expect(sizes.includes(7)).toBe(false);
    for (const [level, size] of [[7, sizes[0]], [levels[0], 7], [Math.max(...levels) + 1, sizes[0]], [levels[0], Math.max(...sizes) + 1], ['95', sizes[0]], [levels[0], 1.5]]) {
      expect(grade(at(level, size)), JSON.stringify([level, size])).toBeNull();
    }
  });

  it.each(seededNames.filter(([, fixture]) => segmentOf(fixture).type === 'money.life-sim.v2'))('walks the choice slider: every answer is met, the rest are not: %s', (_name, fixture) => {
    const { segment, grade, space } = seededRun(fixture);
    const { choices, start } = segment.payload as { choices: number[]; start: number };
    const answers = (fixture.rubric as { target: { answers: number[] } }).target.answers;
    expect(space.inRange).toHaveLength(choices.length - 1);
    expect(space.initial).toEqual({ seed: fixture.seed, choice: start });
    expect(grade({ seed: fixture.seed, choice: start })).toBeNull();
    for (const choice of choices.filter((value) => value !== start)) {
      expect(grade({ seed: fixture.seed, choice })?.correct, String(choice)).toBe(answers.includes(choice));
    }
    expect(choices.includes(7)).toBe(false);
    for (const choice of [7, -1, 1.5, '25', Number.NaN, Math.max(...choices) + 1]) expect(grade({ seed: fixture.seed, choice }), String(choice)).toBeNull();
  });

  it('is caught by the gate when the key disagrees with what the board derives', () => {
    const wrong: Record<string, unknown> = {
      'math.chance-sim.v2': { target: { num: 1, den: 3 } },
      'math.galton-sim.v2': { target: { num: 1, den: 3 } },
      'stats.coverage-sim.v2': { target: { level: 80 } },
      'stats.bootstrap-sim.v2': { target: { low: 1, high: 2 } },
      'money.life-sim.v2': { target: { answers: [-12345] } },
    };
    for (const kind of SEEDED_KINDS) {
      const fixture = seeded.find((entry) => segmentOf(entry).type === kind)!;
      expect(refusalsOf(fixture, fixture.rubric), kind).toEqual([]);
      expect(refusalsOf(fixture, wrong[kind]).length, kind).toBeGreaterThan(0);
    }
  });

  it('returns nothing for a seeded payload it cannot model, and never throws on a hostile one', () => {
    for (const fixture of seeded) {
      const { segment } = lessonOf(fixture);
      const attempt = { seed: fixture.seed! };
      for (const payload of [null, {}, { ...segment.payload, stops: 'x' }, { ...segment.payload, truth: null }, { ...segment.payload, choices: [] }, { ...segment.payload, machine: null }]) {
        expect(() => horizonteBehaviourSpace({ ...segment, payload } as never, fixture.rubric as never, attempt), segment.type).not.toThrow();
      }
      expect(horizonteBehaviourSpace(segment as never, null as never, attempt), segment.type).toBeNull();
      expect(horizonteBehaviourSpace(segment as never, 'x' as never, attempt), segment.type).toBeNull();
      expect(horizonteBehaviourSpace(segment as never, { target: null } as never, attempt), segment.type).toBeNull();
    }
  });
});
