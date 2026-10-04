// Every committed row of emitted-horizonte.json, read from disk, under the Forge contract and the Forge gates.
// v2Emit.test.ts proves the emitter reproduces the file; this proves the file itself is a valid, answerless,
// solvable document set, so a hand edit or a stale regeneration cannot slip through. Core's own validation of the
// same file lives in backend/src/__tests__/forgeV2HorizonteFixture.test.ts.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadMarketInventory } from '../contentGates/regional.js';
import { hasNeutralPayload, requiredCapabilities, V2_ID, V2_LOCALES, V2_SEGMENT_CAPABILITIES, V2_SEGMENT_TYPES, type V2PublicDocument } from '../v2/contract.js';
import { FIXTURE_EMITTED_HORIZONTE, FIXTURE_PLANS_HORIZONTE, FIXTURE_RUN_ID } from '../v2/cli.js';
import { forgeVersionId, type EmittedV2Document } from '../v2/emit.js';
import { analyzeV2Plan, runV2DocumentGates } from '../v2/gates.js';
import { loadV2Plans } from '../v2/plan.js';
import '../v2/solvabilityPacks.js';
import { runSolvabilityGate } from '../v2/solvability.js';
import { v2AgeScopeProblem, v2PayloadScopeProblem } from '../v2/v2SegmentFamilies.generated.js';

const rows = JSON.parse(readFileSync(FIXTURE_EMITTED_HORIZONTE, 'utf8')) as EmittedV2Document[];
const plans = loadV2Plans(FIXTURE_PLANS_HORIZONTE).map((entry) => entry.plan!);
const planById = new Map(plans.map((plan) => [plan.lesson_id, plan]));
const markets = loadMarketInventory();
const label = (row: EmittedV2Document) => `${row.lesson_id} (${row.locale})`;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const horizonteTypes = V2_SEGMENT_TYPES.filter((type) => hasNeutralPayload(type));

describe('emitted-horizonte.json, read as written', () => {
  it('holds one row per Horizonte lesson and market, and every Horizonte segment kind', () => {
    expect(plans.length).toBeGreaterThan(0);
    expect(rows).toHaveLength(plans.length * V2_LOCALES.length);
    for (const plan of plans) expect(rows.filter((row) => row.lesson_id === plan.lesson_id).map((row) => row.locale).sort()).toEqual([...V2_LOCALES].sort());
    const kinds = new Set(rows.flatMap((row) => row.document.segments.map((segment) => segment.type)));
    expect([...kinds].sort()).toEqual([...horizonteTypes].sort());
  });

  it('keeps every row identical to Core\'s identity rules: ids, locale, version and the six row fields', () => {
    const seen = new Set<string>();
    for (const row of rows) {
      expect(Object.keys(row).sort(), label(row)).toEqual(['answer_keys', 'document', 'lesson_id', 'locale', 'schema_version', 'version_id']);
      expect(row.schema_version, label(row)).toBe(2);
      expect(V2_LOCALES as readonly string[], label(row)).toContain(row.locale);
      expect(row.version_id, label(row)).toBe(forgeVersionId(FIXTURE_RUN_ID));
      expect(V2_ID.test(row.version_id), label(row)).toBe(true);
      expect(row.document.lesson_id, label(row)).toBe(row.lesson_id);
      expect(row.document.locale, label(row)).toBe(row.locale);
      expect(row.document.version_id, label(row)).toBe(row.version_id);
      expect(row.document.schema_version, label(row)).toBe(2);
      const key = `${row.lesson_id}|${row.locale}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('declares exactly the capabilities its segments need, with unique ids and known kinds', () => {
    for (const row of rows) {
      const { segments } = row.document;
      expect(new Set(segments.map((segment) => segment.id)).size, label(row)).toBe(segments.length);
      for (const segment of segments) {
        expect(Object.hasOwn(V2_SEGMENT_CAPABILITIES, segment.type), `${label(row)} ${segment.id}`).toBe(true);
        expect(['server', 'none'], `${label(row)} ${segment.id}`).toContain(segment.grading);
      }
      expect(row.document.required_capabilities, label(row)).toEqual(requiredCapabilities(segments));
    }
  });

  it('keeps the rubric private: one key per server-graded segment, none in the public document', () => {
    for (const row of rows) {
      const graded = row.document.segments.filter((segment) => segment.grading === 'server').map((segment) => segment.id);
      expect(Object.keys(row.answer_keys).sort(), label(row)).toEqual([...new Set(graded)].sort());
      for (const segment of row.document.segments) {
        expect(segment, `${label(row)} ${segment.id}`).not.toHaveProperty('rubric');
        expect(segment, `${label(row)} ${segment.id}`).not.toHaveProperty('answer_key');
        const key = row.answer_keys[segment.id];
        if (key && typeof key === 'object') {
          for (const name of Object.keys(key)) {
            const planned = planById.get(row.lesson_id)!.segments.find((candidate) => candidate.id === segment.id)!;
            if (!(name in planned.payload)) expect(segment.payload, `${label(row)} ${segment.id}.${name}`).not.toHaveProperty(name);
          }
        }
      }
    }
  });

  it('passes the age scope and payload scope of every segment against its plan', () => {
    for (const row of rows) {
      const plan = planById.get(row.lesson_id)!;
      for (const segment of row.document.segments) {
        const scopeKey = segment.type === 'money.allocation.v2' && segment.visual.type !== 'stacked-bar' ? `${segment.type}:${segment.visual.type}` : segment.type;
        expect(v2AgeScopeProblem(scopeKey, plan), `${label(row)} ${segment.id}`).toBeNull();
        expect(v2PayloadScopeProblem({ type: segment.type, visual: segment.visual, payload: segment.payload }, plan.age_band), `${label(row)} ${segment.id}`).toBeNull();
      }
    }
  });

  it('passes every document gate, with its private keys and with the regional policy of its plan', () => {
    for (const row of rows) {
      const policy = analyzeV2Plan(planById.get(row.lesson_id)!, markets);
      expect(policy.findings.filter((finding) => finding.severity === 'block'), label(row)).toEqual([]);
      const report = runV2DocumentGates(row.document, policy.regional, markets, row.answer_keys);
      expect(report.problems, label(row)).toEqual([]);
    }
  });

  it('passes the solvability gate at release time (no keys) and at emit time (with keys)', () => {
    for (const row of rows) {
      const document = row.document as unknown as Parameters<typeof runSolvabilityGate>[0];
      expect(runSolvabilityGate(document), `${label(row)} without keys`).toEqual([]);
      expect(runSolvabilityGate(document, row.answer_keys), `${label(row)} with keys`).toEqual([]);
    }
  });

  it('can fail: a stale capability list, a leaked rubric and a wrong key are each caught', () => {
    const row = clone(rows.find((candidate) => candidate.document.segments.some((segment) => segment.type === 'math.equation-balance.v2'))!);
    const stale = clone(row);
    stale.document.required_capabilities.pop();
    expect(stale.document.required_capabilities).not.toEqual(requiredCapabilities(stale.document.segments));

    const balance = row.document.segments.find((segment) => segment.type === 'math.equation-balance.v2')!;
    const wrong = clone(row);
    wrong.answer_keys[balance.id] = { x: (wrong.answer_keys[balance.id] as { x: number }).x + 1 };
    const policy = analyzeV2Plan(planById.get(wrong.lesson_id)!, markets);
    const gates = runV2DocumentGates(wrong.document as V2PublicDocument, policy.regional, markets, wrong.answer_keys);
    expect(gates.problems.filter((problem) => problem.segmentId === balance.id)).not.toEqual([]);
    const solvability = runSolvabilityGate(wrong.document as unknown as Parameters<typeof runSolvabilityGate>[0], wrong.answer_keys);
    expect(solvability.map((finding) => finding.code)).toEqual(expect.arrayContaining(['rubric-accepts-invalid']));

    const leaked = clone(row);
    (leaked.document.segments.find((segment) => segment.id === balance.id)!.payload as Record<string, unknown>).x = 3;
    expect(Object.keys(leaked.document.segments.find((segment) => segment.id === balance.id)!.payload)).toContain('x');
    expect(runV2DocumentGates(leaked.document as V2PublicDocument, policy.regional, markets, leaked.answer_keys).problems.filter((problem) => problem.segmentId === balance.id)).not.toEqual([]);
  });
});
