// S05.4c: Forge's zero-spend v2 emitter targets the VERIFIED contract (OD-17).
// Its committed output (coursegen/src/v2/fixtures/emitted.json, one row per
// lesson and market, every v2 segment kind) must pass the exact function Core
// runs before delivering or grading a v2 lesson. The negative cases prove the
// check can fail: each is a defect an emitter could plausibly produce.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkForgeV2Rows } from '../services/forgeV2Rows.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../../../coursegen/src/v2/fixtures/emitted.json');

type Row = {
  lesson_id: string;
  locale: string;
  version_id: string;
  document: { lesson_id: string; locale: string; version_id: string; required_capabilities: string[]; segments: Array<{ id: string; type: string; grading: string; payload: Record<string, unknown> }> } & Record<string, unknown>;
  answer_keys: Record<string, unknown>;
};
const rows = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Row[];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const rowOf = (lesson: string, locale = 'es-MX') => clone(rows.find((row) => row.lesson_id === lesson && row.locale === locale)!);

describe('Forge-emitted v2 rows under Core\'s strict contract', () => {
  it('accepts every committed row: all segment kinds, all three markets', () => {
    expect(rows.length).toBeGreaterThanOrEqual(60);
    // Every v2 segment kind: the 21 of S05.2, B.12's decide-and-justify (S05.3d), and the 15 first-release
    // logic, money, story and Mentor-voice kinds, the teaching chart and the eight concept boards of GAP-FIX-R1,
    // and GAP-FIX-R2's $6 unit prices and L2 rule builder.
    expect(new Set(rows.flatMap((row) => row.document.segments.map((segment) => segment.type))).size).toBe(48);
    expect(checkForgeV2Rows(rows)).toEqual([]);
  });

  it('refuses a row whose document declares a capability its segments do not need', () => {
    const row = rowOf('v2-allocation-bar');
    row.document.required_capabilities.push('operation.not-real.v1');
    expect(checkForgeV2Rows([row])).toEqual([expect.stringMatching(/refused by Core's v2 contract/)]);
  });

  it('refuses a public document that leaks a private rubric into its segment', () => {
    const row = rowOf('v2-number-line-whole');
    row.document.segments[0]!.payload.target = 12;
    expect(checkForgeV2Rows([row])).toEqual([expect.stringMatching(/refused/)]);
  });

  it('refuses answer keys that do not match the server-graded segments', () => {
    const row = rowOf('v2-bar-model');
    delete row.answer_keys['bar-answer-01'];
    expect(checkForgeV2Rows([row])).toEqual([expect.stringMatching(/refused/)]);
    const extra = rowOf('v2-goal-bullet');
    extra.answer_keys['goal-bullet-01'] = { target: 60 };
    expect(checkForgeV2Rows([extra])).toEqual([expect.stringMatching(/refused/)]);
  });

  it('refuses a rubric its canonical scorer cannot use', () => {
    const row = rowOf('v2-cpa-count');
    row.answer_keys['cpa-abstract-01'] = { target: 8 };
    expect(checkForgeV2Rows([row])).toEqual([expect.stringMatching(/refused/)]);
  });

  it('refuses a document outside its pathway age policy', () => {
    const row = rowOf('v2-tax-bracket', 'en-US');
    (row.document.eligibility as { minimum_age: number }).minimum_age = 13;
    expect(checkForgeV2Rows([row])).toEqual([expect.stringMatching(/refused/)]);
  });

  it('refuses a row labelled with another locale or version, and a duplicate row', () => {
    const relabelled = rowOf('v2-place-value');
    relabelled.locale = 'pt-BR';
    expect(checkForgeV2Rows([relabelled])).toEqual([expect.stringMatching(/refused/)]);
    const version = rowOf('v2-place-value');
    version.version_id = 'forge-other';
    expect(checkForgeV2Rows([version])).toEqual([expect.stringMatching(/version_id must match/)]);
    const twice = rowOf('v2-savings-rule');
    expect(checkForgeV2Rows([twice, clone(twice)])).toEqual([expect.stringMatching(/duplicate/)]);
  });

  it('refuses an empty or non-array input rather than passing it', () => {
    expect(checkForgeV2Rows([])).toEqual(['no emitted rows to validate']);
    expect(checkForgeV2Rows({})).toEqual(['expected a JSON array of emitted rows']);
  });
});
