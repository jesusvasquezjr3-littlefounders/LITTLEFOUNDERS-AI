import assert from 'node:assert/strict';
import type { V2Grade, V2VisualVerdict } from '../../v2VisualScorer.js';
import { SAMPLE_ATTEMPT, isAttemptSeed, isSeededCapabilitySet } from '../seed/protocol.js';
import { horizonteAgeScopeProblem } from '../shared.js';
import type { HorizonteFixture, HorizonteLocale, HorizontePack } from '../types.js';

const LOCALES: readonly HorizonteLocale[] = ['en-US', 'es-MX', 'pt-BR'];
const GARBAGE: readonly unknown[] = [undefined, null, 0, 'x', [], {}, { counts: 'x' }, { unknownField: 1 }];

type Grade = (segment: unknown, response: unknown, rubric: unknown, attempt?: { seed: string }) => V2Grade;
type Sample = (segment: unknown, rubric: unknown) => unknown;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
const clone = <T>(value: T): T => structuredClone(value);

function verdictOf(run: () => V2Grade, label: string): V2VisualVerdict {
  try { return run().verdict; } catch (error) { throw new assert.AssertionError({ message: `${label}: the scorer threw (${String(error)}); it must be pure and total` }); }
}

/**
 * The backend contract every Horizonte scorer meets (RECIPE.md "Definition of done"). It asserts, for every segment type
 * the pack declares: a segment schema, a rubric schema, a scorer and a declared age scope; fixtures that parse and carry
 * the ladder invalid -> valid -> met; a sample response that is scorable (never invalid); purity and determinism on
 * deep-frozen inputs; a total scorer (garbage in, invalid out, never a throw); an advisory (rubric-less) verdict that is
 * never met; and no rubric field leaking into the public payload.
 */
export function assertScorerContract(pack: HorizontePack, fixtures: readonly HorizonteFixture[]): void {
  const types = Object.keys(pack.capabilities);
  assert.ok(types.length > 0, `${pack.id}: declares no segment type`);
  for (const type of types) {
    const label = `${pack.id} ${type}`;
    assert.ok(pack.capabilities[type]!.length > 0, `${label}: declares no capability`);
    const rubricSchema = pack.rubrics[type];
    const scorer = pack.scorers[type];
    const scope = pack.ageScope[type];
    assert.ok(rubricSchema, `${label}: no rubric schema`);
    assert.ok(scorer, `${label}: no scorer`);
    assert.ok(scope, `${label}: no age scope declared (an undeclared scope is a defect, never "open to all")`);
    assert.ok(Number.isInteger(scope.ages[0]) && Number.isInteger(scope.ages[1]) && scope.ages[0] >= 3 && scope.ages[0] <= scope.ages[1] && scope.ages[1] <= 119, `${label}: the age scope is an ordered whole-number range`);

    const own = fixtures.filter((fixture) => fixture.segment('en-US').type === type);
    assert.ok(own.length > 0, `${label}: no fixture`);
    assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, fixtures.length, `${pack.id}: fixture ids are unique`);

    for (const fixture of own) {
      const at = `${label} fixture ${fixture.id}`;
      const segments = LOCALES.map((locale) => fixture.segment(locale));
      for (const [index, segment] of segments.entries()) {
        assert.ok(pack.segments.some((schema) => schema.safeParse(segment).success), `${at}: the ${LOCALES[index]} segment does not parse against any pack segment schema`);
        assert.ok(typeof segment.prompt === 'string' && segment.prompt.trim().length > 0, `${at}: the ${LOCALES[index]} prompt is empty`);
      }
      assert.deepEqual(segments.map((segment) => segment.payload), [segments[0]!.payload, segments[0]!.payload, segments[0]!.payload], `${at}: the payload is the same in every locale`);
      assert.equal(rubricSchema.safeParse(fixture.rubric).success, true, `${at}: the rubric does not parse`);
      assert.equal(horizonteAgeScopeProblem(scope, { age_band: fixture.ageBand, eligibility: fixture.eligibility }), null, `${at}: the fixture is outside its own age scope`);
      const outside = scope.adult ? null : { age_band: 'adult', eligibility: { minimum_age: 18, maximum_age: 99 } };
      if (outside) assert.notEqual(horizonteAgeScopeProblem(scope, outside), null, `${at}: the adult pathway must be refused`);
      const payloadKeys = new Set(Object.keys((segments[0]!.payload ?? {}) as object));
      for (const key of Object.keys(fixture.rubric)) assert.equal(payloadKeys.has(key), false, `${at}: rubric field "${key}" also sits in the public payload`);

      const segment = deepFreeze(clone(segments[0]!));
      const rubric = deepFreeze(clone(fixture.rubric));
      const grade = scorer.grade as unknown as Grade;
      const sample = scorer.sample as unknown as Sample;
      const attempt = Object.freeze({ seed: fixture.seed ?? SAMPLE_ATTEMPT.seed });
      const run = (response: unknown, withRubric = true) => grade(segment, deepFreeze(clone(response)), withRubric ? rubric : undefined, attempt);

      for (const rung of ['invalid', 'valid', 'met'] as const) {
        const first = verdictOf(() => run(fixture.ladder[rung]), `${at} ladder.${rung}`);
        assert.equal(first, rung, `${at}: ladder.${rung} must score ${rung}, got ${first}`);
        assert.deepEqual(run(fixture.ladder[rung]), run(fixture.ladder[rung]), `${at}: ladder.${rung} scores differently on a second run (not deterministic)`);
      }
      assert.equal(run(fixture.ladder.met).diagnostic, 'none', `${at}: a met answer carries no diagnostic`);

      if (isSeededCapabilitySet(pack.capabilities[type]!)) {
        assert.ok(isAttemptSeed(fixture.seed), `${at}: a seeded piece fixture carries the seed its ladder was simulated under`);
        assert.equal(verdictOf(() => grade(segment, clone(fixture.ladder.met), rubric), `${at} no attempt`), 'invalid', `${at}: a seeded kind graded with a key but no attempt must fail closed`);
        assert.equal(verdictOf(() => grade(segment, clone(fixture.ladder.met), rubric, { seed: 'f'.repeat(64) }), `${at} other seed`), 'invalid', `${at}: an answer simulated under another seed must be refused`);
      }

      const advisoryMet = verdictOf(() => run(fixture.ladder.met, false), `${at} advisory met`);
      assert.ok(advisoryMet === 'valid', `${at}: without a rubric the scorer may say only valid or invalid, got ${advisoryMet}`);
      assert.equal(verdictOf(() => run(fixture.ladder.invalid, false), `${at} advisory invalid`), 'invalid', `${at}: the advisory scorer still refuses a rule-breaking response`);

      const sampled = sample(segment, rubric);
      assert.deepEqual(sample(segment, rubric), sampled, `${at}: the sample response is not deterministic`);
      assert.notEqual(verdictOf(() => grade(segment, deepFreeze(clone(sampled)), rubric, SAMPLE_ATTEMPT), `${at} sample`), 'invalid', `${at}: the sample response must be scorable (never invalid)`);

      for (const garbage of GARBAGE) assert.equal(verdictOf(() => run(garbage), `${at} garbage ${JSON.stringify(garbage)}`), 'invalid', `${at}: a malformed response must score invalid`);
      assert.equal(verdictOf(() => grade(segment, fixture.ladder.met, { target: 'nonsense' }, attempt), `${at} bad rubric`), 'invalid', `${at}: a malformed rubric must score invalid, never met`);
    }
  }
}
