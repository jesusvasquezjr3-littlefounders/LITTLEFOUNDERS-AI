// S05.4c — the zero-spend v2 lesson emitter and the v2 Forge content gates.
// Adversarial by design: every red-team plan must block on exactly its own
// gate (Appendix C DoD "Gated") and emit nothing, while the committed plans
// cover every v2 segment kind Core accepts. Core's own validation of the same
// output lives in backend/src/__tests__/forgeV2Emitted.test.ts.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { V2_SEGMENT_TYPES, requiredCapabilities } from '../v2/contract.js';
import { emitV2Lesson, forgeVersionId } from '../v2/emit.js';
import { FIXTURE_EMITTED, FIXTURE_PLANS, FIXTURE_RUN_ID, runV2Emit } from '../v2/cli.js';
import { analyzeV2Plan, runV2DocumentGates, v2Audience, v2TextBlocks, v2WorkingMemoryBand } from '../v2/gates.js';
import { loadV2Plans, v2LessonPlanSchema, type V2LessonPlan } from '../v2/plan.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RED_TEAM = path.resolve(here, '../v2/fixtures/red-team');
const plans = loadV2Plans(FIXTURE_PLANS);
const planById = new Map(plans.map((entry) => [entry.plan!.lesson_id, entry.plan!]));
const base = planById.get('v2-allocation-bar')!;
const clone = (plan: V2LessonPlan): V2LessonPlan => JSON.parse(JSON.stringify(plan));

afterEach(() => vi.unstubAllGlobals());

describe('the committed v2 plans', () => {
  it('parse, and together cover every segment kind of the v2 contract', () => {
    expect(plans.every((entry) => entry.errors.length === 0)).toBe(true);
    const kinds = new Set(plans.flatMap((entry) => entry.plan!.segments.map((segment) => segment.type)));
    expect([...kinds].sort()).toEqual([...V2_SEGMENT_TYPES].sort());
  });

  it('emit with zero spend: no network call is possible during a run', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('the v2 emitter must never call the network');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const run = runV2Emit(FIXTURE_PLANS, FIXTURE_RUN_ID);
    expect(run.ok).toBe(true);
    expect(run.documents).toHaveLength(plans.length * 3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('match the committed emitted fixture that Core validates (refresh: npm run v2:emit -- --write-fixture)', () => {
    const run = runV2Emit(FIXTURE_PLANS, FIXTURE_RUN_ID);
    expect(JSON.parse(readFileSync(FIXTURE_EMITTED, 'utf8'))).toEqual(JSON.parse(JSON.stringify(run.documents)));
  });

  it('keep rubrics private: answer keys hold exactly the server-graded segments and the public document holds none', () => {
    const run = runV2Emit(FIXTURE_PLANS, FIXTURE_RUN_ID);
    for (const row of run.documents) {
      const graded = row.document.segments.filter((segment) => segment.grading === 'server').map((segment) => segment.id);
      expect(Object.keys(row.answer_keys).sort()).toEqual([...new Set(graded)].sort());
      const plan = planById.get(row.lesson_id)!;
      for (const segment of plan.segments.filter((s) => s.rubric)) {
        const emitted = row.document.segments.find((s) => s.id === segment.id)!;
        // GAP-FIX-R1: the optional help ladder, item role and KC ride beside the six base fields; nothing else does.
        const optional = ['help', 'item_role', 'knowledge_component_id', 'item_phase', 'variant'];
        expect(Object.keys(emitted).filter((key) => !optional.includes(key)).sort()).toEqual(['grading', 'id', 'payload', 'prompt', 'type', 'visual']);
        for (const key of Object.keys(segment.rubric!)) {
          if (!(key in segment.payload)) expect(emitted.payload).not.toHaveProperty(key);
        }
      }
      expect(row.document.required_capabilities).toEqual(requiredCapabilities(row.document.segments));
      expect(row.document.version_id).toBe('forge-fixture');
    }
  });

  it('localize every visible string per market and never leave a string in the neutral payload', () => {
    const run = runV2Emit(FIXTURE_PLANS, FIXTURE_RUN_ID);
    const ledger = run.documents.filter((row) => row.lesson_id === 'v2-schema-diagram');
    expect(ledger.map((row) => (row.document.segments[0]!.payload.quantities as Array<{ label: string }>)[0]!.label)).toEqual(['Earned', 'Ganado', 'Ganho']);
    const market = run.documents.filter((row) => row.lesson_id === 'v2-savings-line').map((row) => row.document.segments[0]!.prompt);
    expect(market[0]).toContain('yard sale');
    expect(market[1]).toContain('tianguis');
    expect(market[2]).toContain('feira livre');
  });
});

describe('the v2 red team (Appendix C DoD "Gated")', () => {
  const samples = readdirSync(RED_TEAM).filter((file) => file.endsWith('.json'));

  it('has one sample per content gate that applies to v2', () => {
    const gates = samples.map((file) => (JSON.parse(readFileSync(path.join(RED_TEAM, file), 'utf8')) as { expected_gate: number }).expected_gate);
    expect(gates.sort((a, b) => a - b)).toEqual([1, 1, 1, 2, 3, 4, 12, 13, 14, 15, 16, 18, 18]);
  });

  it.each(samples)('%s blocks on exactly its own gate and emits nothing', (file) => {
    const sample = JSON.parse(readFileSync(path.join(RED_TEAM, file), 'utf8')) as { expected_gate: number; plan: unknown };
    const plan = v2LessonPlanSchema.parse(sample.plan);
    const result = emitV2Lesson(plan, { versionId: 'forge-red-team' });
    expect(result.ok).toBe(false);
    expect(result.documents).toEqual([]);
    expect([...new Set(result.problems.map((problem) => problem.gate))]).toEqual([sample.expected_gate]);
  });

  it('the v2:emit command itself blocks the red-team directory, each sample on its own gate, and emits nothing', () => {
    const run = runV2Emit(RED_TEAM, 'red-team');
    expect(run.planErrors).toEqual([]);
    expect(run.ok).toBe(false);
    expect(run.documents).toEqual([]);
    expect(run.results).toHaveLength(samples.length);
    const blockedGates = run.results.map((result) => [...new Set(result.problems.map((problem) => problem.gate))]);
    expect(blockedGates.flat().sort((a, b) => a - b)).toEqual([1, 1, 1, 2, 3, 4, 12, 13, 14, 15, 16, 18, 18]);
    expect(blockedGates.every((gates) => gates.length === 1)).toBe(true);
  });
});

describe('the emitter refuses structural defects before any gate', () => {
  it('refuses a learner-visible string left in the locale-neutral payload', () => {
    const plan = clone(planById.get('v2-bar-model')!);
    plan.segments[0]!.payload.unknownLabel = 'Leo';
    const result = emitV2Lesson(plan, { versionId: 'forge-test' });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.gate === 1 && /unknownLabel/.test(p.message))).toBe(true);
  });

  it('refuses markets that fill different copy fields', () => {
    const plan = clone(planById.get('v2-fraction-area')!);
    delete (plan.segments[0]!.copy['pt-BR'] as Record<string, unknown>).spokenText;
    const result = emitV2Lesson(plan, { versionId: 'forge-test' });
    expect(result.problems.some((p) => p.gate === 1 && /same copy fields/.test(p.message))).toBe(true);
  });

  it('refuses copy that would overwrite a locale-neutral number', () => {
    const plan = clone(base);
    (plan.segments[0]!.copy['en-US'] as Record<string, unknown>).total = 'twelve';
    const result = emitV2Lesson(plan, { versionId: 'forge-test' });
    expect(result.problems.some((p) => p.gate === 1 && /overwrite/.test(p.message))).toBe(true);
  });

  it('refuses a server-graded segment without its private rubric at parse time', () => {
    const plan = clone(base) as unknown as { segments: Array<Record<string, unknown>> };
    delete plan.segments[0]!.rubric;
    expect(v2LessonPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('derives a version id Vault accepts from any run id', () => {
    expect(forgeVersionId('v2-emit-2026-09-24T12:00:00Z')).toBe('forge-v2-emit-2026-09-24t12:00:00z');
    expect(forgeVersionId('  ')).toBe('forge-run');
  });
});

describe('the v2 content gates', () => {
  it('classify title, prompt, labels and readouts by Copy Budget role', () => {
    const run = runV2Emit(FIXTURE_PLANS, FIXTURE_RUN_ID);
    const row = run.documents.find((r) => r.lesson_id === 'v2-schema-diagram' && r.locale === 'en-US')!;
    const roles = new Map(v2TextBlocks(row.document as never).map((block) => [`${block.segmentId}:${block.path}`, block.role]));
    expect(roles.get('(title):title')).toBe('heading');
    expect(roles.get('schema-structure-01:prompt')).toBe('prompt');
    expect(roles.get('schema-structure-01:payload.quantities[0].label')).toBe('option');
    expect(roles.get('schema-structure-01:payload.unknownLabel')).toBe('option');
    expect(roles.get('schema-structure-01:payload.spokenText')).toBe('data');
    expect([...roles.keys()].some((key) => key.endsWith('payload.currency'))).toBe(false);
  });

  it('apply the 6-9 budgets and working-memory band by age pathway', () => {
    expect(v2Audience('6-9').young).toBe(true);
    expect(v2Audience('10-12').young).toBe(false);
    expect(v2WorkingMemoryBand('6-9')).toBe('6-9');
    expect(v2WorkingMemoryBand('10-12')).toBe('10-12');
    expect(v2WorkingMemoryBand('13-17')).toBe('13+');
    expect(v2WorkingMemoryBand('adult')).toBe('13+');
    expect(v2WorkingMemoryBand('unknown')).toBe('6-9');
  });

  it('runs the redundancy gate on the v2 Mentor narration channel (GAP-FIX-R1)', () => {
    const quiet = runV2DocumentGates({ locale: 'en-US', age_band: '10-12', title: 'Fine', segments: [] });
    expect(quiet.notApplicable).toEqual([]);
    const turn = (script: string) => ({ locale: 'en-US', age_band: '10-12', title: 'Fine', segments: [{ id: 'intro-01', type: 'voice.mentor-turn.v2', prompt: 'Listen.',
      payload: { role: 'intro', line: 'Market day. Let us choose well.', narration: { mode: 'differentiated', script } } }] });
    expect(runV2DocumentGates(turn('Today we sort needs from wants and pay with care.')).problems.filter((p) => p.gate === 11)).toEqual([]);
    expect(runV2DocumentGates(turn('Market day. Let us choose well.')).problems.some((p) => p.gate === 11 && /repeats the on-screen line/.test(p.message))).toBe(true);
  });

  it('passes a flagged misjudgment staged by a voice.mentor-episode.v2 segment and blocks one staged nowhere (gate 15)', () => {
    const staged = clone(planById.get('v2-first-release-mixed')!);
    expect(analyzeV2Plan(staged).findings.filter((f) => f.gate === 15)).toEqual([]);
    const unstaged = clone(staged);
    unstaged.segments = unstaged.segments.filter((segment) => segment.type !== 'voice.mentor-episode.v2');
    expect(analyzeV2Plan(unstaged).findings.some((f) => f.gate === 15 && f.severity === 'block')).toBe(true);
    expect(emitV2Lesson(staged, { versionId: 'forge-test' }).ok).toBe(true);
  });

  it('B.8 / OD-19 (GAP-FIX-R3): blocks a document whose Mentor stage has no approved scene (gate 15)', () => {
    const base = { locale: 'en-US', age_band: '10-12', title: 'Fine', segments: [] };
    const stageProblems = (document: Record<string, unknown>) => runV2DocumentGates(document as never).problems.filter((p) => p.gate === 15);
    expect(stageProblems({ ...base, adventure_scene_id: 'diorama-b' })).toEqual([]);
    expect(stageProblems({ ...base, adventure_scene_id: 'harbor-night', mentor_stage: { character: 'rho', scene: 'diorama-a' } })).toEqual([]);
    expect(stageProblems({ ...base, adventure_scene_id: 'harbor-night' })[0]?.message).toMatch(/no approved scene/);
    expect(stageProblems({ ...base, adventure_scene_id: 'diorama-a', mentor_stage: { character: 'rho', scene: 'moon' } })).toHaveLength(1);
    // Every committed plan stages its Mentor.
    for (const plan of planById.values()) expect(emitV2Lesson(clone(plan), { versionId: 'forge-test' }).problems.filter((p) => p.gate === 15)).toEqual([]);
  });

  it('block local-currency amounts in a lesson declared market-neutral', () => {
    const plan = clone(planById.get('v2-goal-bullet')!);
    plan.segments[0]!.payload.currency = 'local';
    const policy = analyzeV2Plan(plan);
    expect(policy.findings.some((f) => f.gate === 16 && f.severity === 'block' && /local currency/.test(f.message))).toBe(true);
    expect(emitV2Lesson(plan, { versionId: 'forge-test' }).ok).toBe(false);
  });

  it('send a count above the target but within the ceiling to Stage 3 review, not a block', () => {
    const plan = clone(planById.get('v2-allocation-donut')!);
    plan.new_concepts = ['kc-a', 'kc-b', 'kc-c', 'kc-d'];
    const policy = analyzeV2Plan(plan);
    expect(policy.findings.filter((f) => f.gate === 14).map((f) => f.severity)).toEqual(['review']);
  });
});
