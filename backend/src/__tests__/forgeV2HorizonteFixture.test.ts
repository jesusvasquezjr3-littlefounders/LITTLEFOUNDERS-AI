import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { horizonteBehaviourKinds } from '../services/forgeV2HorizonteBehaviour/index.js';
import { checkForgeV2Rows, forgeV2BehaviourPassRate } from '../services/forgeV2Rows.js';
import { isSeededHorizonteType } from '../services/horizonte/index.js';
import { gradeV2Visual, validateV2LessonForGrading } from '../services/v2LessonDocument.js';

/*
 * The rows Forge emitted for the Horizonte build, run through Core's own validator. The JSON is read by relative path, so
 * the two packages stay independent: no import crosses the service boundary, and a checkout without the file skips the suite.
 * Every graded segment, the five seeded simulations included, must pass the contract, the feedback rules and the
 * interactive-behaviour gate. The gate grades the seeded kinds under its own synthetic attempt; graded without one they
 * are still refused.
 */

type Row = { lesson_id: string; locale: string; schema_version: number; version_id: string; document: Record<string, any>; answer_keys: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, '../../../coursegen/src/v2/fixtures/emitted-horizonte.json');
const present = existsSync(file);

let loaded: Row[] | null = null;
const rows = (): Row[] => (loaded ??= JSON.parse(readFileSync(file, 'utf8')) as Row[]);
let checked: string[] | null = null;
const problems = (): string[] => (checked ??= checkForgeV2Rows(rows()));
let measured: ReturnType<typeof forgeV2BehaviourPassRate> | null = null;
const passRate = () => (measured ??= forgeV2BehaviourPassRate(rows()));
const rowWith = (type: string): Row => structuredClone(rows().find((row) => row.locale === 'en-US' && row.document.segments.some((segment: { type: string }) => segment.type === type))!);

const parseRow = (row: Row) => validateV2LessonForGrading(row.document, row.answer_keys, { lessonId: row.lesson_id, locale: row.locale });

const GATE = 'interactive-behaviour gate';
const SEEDED = ['math.chance-sim.v2', 'math.galton-sim.v2', 'money.life-sim.v2', 'stats.bootstrap-sim.v2', 'stats.coverage-sim.v2'];

describe.skipIf(!present)('the Horizonte rows Forge emitted, under Core\'s validator', () => {
  // Each pass over the gate takes 2 to 3 s alone, more than the default 5 s once the rest of the suite shares the CPU: run both once, here.
  beforeAll(() => { problems(); passRate(); }, 60_000);

  it('holds every lesson in all three locales', () => {
    expect(rows().length).toBeGreaterThan(100);
    const locales = new Map<string, string[]>();
    for (const row of rows()) locales.set(row.lesson_id, [...(locales.get(row.lesson_id) ?? []), row.locale]);
    for (const [lesson, found] of locales) expect([...found].sort(), lesson).toEqual(['en-US', 'es-MX', 'pt-BR']);
  });

  it('passes the contract, the schema checks and the feedback rules on every row', () => {
    expect(problems().filter((problem) => !problem.includes(GATE))).toEqual([]);
  });

  it('passes the behaviour gate on every graded segment, the seeded simulations included', () => {
    expect(problems().filter((problem) => problem.includes(GATE))).toEqual([]);
  });

  it('models every graded kind the file carries', () => {
    const graded = new Set<string>();
    for (const row of rows()) for (const segment of row.document.segments) if (segment.grading === 'server') graded.add(segment.type);
    expect(graded.size).toBeGreaterThan(50);
    for (const type of SEEDED) expect(graded.has(type), type).toBe(true);
    const left = [...graded].filter((type) => !horizonteBehaviourKinds().includes(type)).sort();
    expect(left).toEqual([]);
    for (const type of SEEDED) expect(isSeededHorizonteType(type), type).toBe(true);
  });

  it('reports a pass rate of 100% over the graded segments', () => {
    const rate = passRate();
    expect(rate.segments).toBeGreaterThan(200);
    expect(rate.passed).toBe(rate.segments);
    expect(rate.passRate).toBe(1);
    expect(rate.states).toBeGreaterThan(50_000);
  });

  it.each(SEEDED)('keeps %s fail-closed when it is graded without an attempt', (type) => {
    const row = rowWith(type);
    expect(checkForgeV2Rows([row])).toEqual([]);
    const segment = row.document.segments.find((candidate: { type: string }) => candidate.type === type);
    const parsed = parseRow(row);
    expect(parsed).not.toBeNull();
    for (const response of [{ seed: '0'.repeat(64) }, { seed: '0'.repeat(64), trials: 100 }, {}, null]) {
      expect(gradeV2Visual(parsed!, row.answer_keys, segment.id, response as never), JSON.stringify(response)).toBeNull();
    }
  });

  it('refuses a wrong schema version, a duplicate row and a version id that does not match', () => {
    const base = rowWith('math.ten-frame.v2');
    expect(checkForgeV2Rows([base])).toEqual([]);
    expect(checkForgeV2Rows([{ ...base, schema_version: 3 }]).join('\n')).toMatch(/schema_version must be 2/);
    expect(checkForgeV2Rows([base, structuredClone(base)]).join('\n')).toMatch(/duplicate lesson\/locale row/);
    expect(checkForgeV2Rows([{ ...base, version_id: 'rev-other' }]).join('\n')).toMatch(/version_id must match/);
    expect(checkForgeV2Rows([]).join('\n')).toMatch(/no emitted rows/);
    expect(checkForgeV2Rows({}).join('\n')).toMatch(/expected a JSON array/);
  });

  it('refuses a row whose key is missing, malformed or wrong for its board', () => {
    const refused = /refused by Core's v2 contract/;
    const missing = rowWith('math.ten-frame.v2');
    missing.answer_keys = {};
    expect(checkForgeV2Rows([missing]).join('\n')).toMatch(refused);
    const malformed = rowWith('math.ten-frame.v2');
    const segmentId = malformed.document.segments[0].id as string;
    malformed.answer_keys[segmentId] = { unexpected: true };
    expect(checkForgeV2Rows([malformed]).join('\n')).toMatch(refused);
    for (const [type, wrong] of [['math.surface-formula.v2', { key: ['99999'] }], ['math.ruler.measure.v2', { target: '1' }], ['geometry.solid-section.v2', { pick: 'nothing' }]] as const) {
      const row = rowWith(type);
      const segment = row.document.segments.find((candidate: { type: string }) => candidate.type === type);
      expect(checkForgeV2Rows([row]).filter((problem) => !problem.includes(GATE)), type).toEqual([]);
      row.answer_keys[segment.id] = wrong;
      expect(checkForgeV2Rows([row]).join('\n'), type).toMatch(refused);
    }
  });
});
