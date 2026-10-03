import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { horizonteBehaviourKinds } from '../services/forgeV2HorizonteBehaviour/index.js';
import { checkForgeV2Rows, forgeV2BehaviourPassRate } from '../services/forgeV2Rows.js';
import { isSeededHorizonteType } from '../services/horizonte/index.js';

/*
 * The rows Forge emitted for the Horizonte build, run through Core's own validator. The JSON is read by relative path, so
 * the two packages stay independent: no import crosses the service boundary, and a checkout without the file skips the suite.
 * The seeded simulations (sim1, sim2) are graded against an attempt the gate never has, so they stay fail-closed here on
 * purpose; every other kind must pass the contract, the feedback rules and the interactive-behaviour gate.
 */

type Row = { lesson_id: string; locale: string; schema_version: number; version_id: string; document: Record<string, any>; answer_keys: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, '../../../coursegen/src/v2/fixtures/emitted-horizonte.json');
const present = existsSync(file);

let loaded: Row[] | null = null;
const rows = (): Row[] => (loaded ??= JSON.parse(readFileSync(file, 'utf8')) as Row[]);
let checked: string[] | null = null;
const problems = (): string[] => (checked ??= checkForgeV2Rows(rows()));
const rowWith = (type: string): Row => structuredClone(rows().find((row) => row.locale === 'en-US' && row.document.segments.some((segment: { type: string }) => segment.type === type))!);

const GATE = 'interactive-behaviour gate';
const SEEDED = ['math.chance-sim.v2', 'math.galton-sim.v2', 'money.life-sim.v2', 'stats.bootstrap-sim.v2', 'stats.coverage-sim.v2'];

describe.skipIf(!present)('the Horizonte rows Forge emitted, under Core\'s validator', () => {
  it('holds every lesson in all three locales', () => {
    expect(rows().length).toBeGreaterThan(100);
    const locales = new Map<string, string[]>();
    for (const row of rows()) locales.set(row.lesson_id, [...(locales.get(row.lesson_id) ?? []), row.locale]);
    for (const [lesson, found] of locales) expect([...found].sort(), lesson).toEqual(['en-US', 'es-MX', 'pt-BR']);
  });

  it('passes the contract, the schema checks and the feedback rules on every row', () => {
    expect(problems().filter((problem) => !problem.includes(GATE))).toEqual([]);
  });

  it('fails the behaviour gate only on the seeded simulations, which stay fail-closed on purpose', () => {
    const failing = problems().filter((problem) => problem.includes(GATE));
    const kinds = new Map<string, number>();
    for (const problem of failing) {
      const match = /\((\w[\w.-]*\.v2)\): no behaviour space defined for this kind/.exec(problem);
      expect(match, problem).not.toBeNull();
      kinds.set(match![1]!, (kinds.get(match![1]!) ?? 0) + 1);
    }
    expect([...kinds.keys()].sort()).toEqual(SEEDED);
    for (const [kind, count] of kinds) {
      expect(isSeededHorizonteType(kind), kind).toBe(true);
      expect(count, kind).toBe(3);
    }
  });

  it('models every other graded kind the file carries', () => {
    const graded = new Set<string>();
    for (const row of rows()) for (const segment of row.document.segments) if (segment.grading === 'server') graded.add(segment.type);
    expect(graded.size).toBeGreaterThan(50);
    const left = [...graded].filter((type) => !horizonteBehaviourKinds().includes(type)).sort();
    expect(left).toEqual(SEEDED);
  });

  it('reports the gate pass rate over the graded segments', () => {
    const rate = forgeV2BehaviourPassRate(rows());
    expect(rate.segments).toBeGreaterThan(200);
    expect(rate.segments - rate.passed).toBe(SEEDED.length * 3);
    expect(rate.passRate).toBeGreaterThan(0.9);
    expect(rate.passRate).toBeLessThan(1);
    expect(rate.states).toBeGreaterThan(50_000);
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
