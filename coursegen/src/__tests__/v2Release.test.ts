import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorV2Plan, fixtureResponder, mergeAuthoredCopy, skeletonOf } from '../v2/author.js';
import { emitV2Lesson } from '../v2/emit.js';
import { loadV2Plans, type V2LessonPlan } from '../v2/plan.js';
import { narrationWithoutAudio, releaseV2Lessons, V2_MANIFEST_GATES } from '../v2/release.js';

/*
 * GAP-FIX-R1 learning (OD-17, OD-23, OD-24, F-06/B.16): the v2 authoring
 * stage (zero-spend dry run through a fixture responder) and the write /
 * publish stage (emit, v2 gates, Core check, verify:course, Vault's reviewed
 * publication transaction), with per-market answer keys.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const plans = loadV2Plans(path.resolve(here, '../v2/fixtures/plans'));
const planOf = (id: string) => structuredClone(plans.find((entry) => entry.plan?.lesson_id === id)!.plan!) as V2LessonPlan;
const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'lf-v2-release-'));

afterEach(() => vi.unstubAllGlobals());

describe('v2 plan authoring', () => {
  it('authors a skeleton with zero model calls in the dry run, and the result emits', async () => {
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('no network in the dry run'); }));
    const reference = planOf('v2-first-release-mixed');
    const skeleton = skeletonOf(reference);
    expect(JSON.stringify(skeleton.segments[0]!.copy)).not.toMatch(/Market day/);
    const result = await authorV2Plan(skeleton, fixtureResponder(reference), { operation: 'v2-author' });
    expect(result).toMatchObject({ ok: true, attempts: 1 });
    expect(result.plan).toEqual(reference);
    expect(emitV2Lesson(result.plan!, { versionId: 'forge-test' }).ok).toBe(true);
  });

  it('sends a blocked draft back with its itemized problems, and refuses copy in the wrong shape', async () => {
    const reference = planOf('v2-goal-bullet');
    const skeleton = skeletonOf(reference);
    const bad = structuredClone(reference);
    bad.title['en-US'] = 'Hurry! Last chance to buy now!';
    const replies = [fixtureResponder(bad), fixtureResponder(reference)];
    let call = 0;
    const seen: string[] = [];
    const result = await authorV2Plan(skeleton, async (request, options) => { seen.push(request.messages.at(-1)!.content); return replies[call++]!(request, options); }, { operation: 'v2-author' });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(seen[1]).toMatch(/blocked by the content gates/);
    expect(mergeAuthoredCopy(skeleton, '{"title": {"en-US": "x", "es-MX": "x", "pt-BR": "x"}, "copy": {}}').errors[0]).toMatch(/copy missing/);
    expect(mergeAuthoredCopy(skeleton, 'not json').errors[0]).toMatch(/did not return JSON/);
  });
});

describe('v2 write and publish', () => {
  it('stops after the Core check in a dry run, with one attested publication call per market', async () => {
    const coreCheck = vi.fn(() => ({ ok: true, output: '' }));
    const result = await releaseV2Lessons([planOf('v2-first-release-logic')], { runId: 'gap-fix-r1', outDir: tmp(), courseSlug: 'money', dryRun: true, deps: { coreCheck } });
    expect(result).toMatchObject({ ok: true, stage: 'dry-run' });
    expect(coreCheck).toHaveBeenCalledOnce();
    expect(result.calls.map((c) => c.locale).sort()).toEqual(['en-US', 'es-MX', 'pt-BR']);
    const manifest = result.calls[0]!.body.p_release_manifest as { checks: Array<{ gate: string; ok: boolean }>; interactive_behaviour: boolean };
    expect(manifest.checks.map((c) => c.gate).sort()).toEqual([...V2_MANIFEST_GATES].sort());
    expect(manifest.interactive_behaviour).toBe(true);
    expect(JSON.stringify(result.calls[0]!.body.p_document)).not.toMatch(/must_flip_ids|scam_ids/);
  });

  it('never publishes past a failed Core check, a failed verification or a Vault refusal', async () => {
    const plan = planOf('v2-goal-bullet');
    expect((await releaseV2Lessons([plan], { runId: 'r1', outDir: tmp(), courseSlug: 'money', dryRun: false,
      deps: { coreCheck: () => ({ ok: false, output: 'FAIL: behaviour' }) } })).stage).toBe('core-check');
    const rpc = vi.fn(async () => ({ ok: true, status: 200, body: {} }));
    expect((await releaseV2Lessons([plan], { runId: 'r1', outDir: tmp(), courseSlug: 'money', dryRun: false,
      deps: { coreCheck: () => ({ ok: true, output: '' }), verifyCourse: () => ({ ok: false, output: 'stale' }), rpc } })).stage).toBe('verify');
    expect(rpc).not.toHaveBeenCalled();
    const refused = await releaseV2Lessons([plan], { runId: 'r1', outDir: tmp(), courseSlug: 'money', dryRun: false,
      deps: { coreCheck: () => ({ ok: true, output: '' }), verifyCourse: () => ({ ok: true, output: '' }), rpc: async () => ({ ok: false, status: 400, body: { message: 'missing gate' } }) } });
    expect(refused).toMatchObject({ ok: false, stage: 'publish' });
    const done = await releaseV2Lessons([plan], { runId: 'r1', outDir: tmp(), courseSlug: 'money', dryRun: false,
      deps: { coreCheck: () => ({ ok: true, output: '' }), verifyCourse: () => ({ ok: true, output: '' }), rpc } });
    expect(done.stage).toBe('done');
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[0]![0]).toBe('publish_v2_lesson_version');
    expect(done.pendingApproval).toEqual([]);
  });

  it('G.2: reports every version of a live lesson that Vault queued for a staff release', async () => {
    const plan = planOf('v2-goal-bullet');
    const rpc = vi.fn(async () => ({ ok: true, status: 200, body: { activation: 'pending_staff_approval' } }));
    const done = await releaseV2Lessons([plan], { runId: 'r1', outDir: tmp(), courseSlug: 'money', dryRun: false,
      deps: { coreCheck: () => ({ ok: true, output: '' }), verifyCourse: () => ({ ok: true, output: '' }), rpc } });
    expect(done.stage).toBe('done');
    expect(done.pendingApproval?.map((p) => p.locale).sort()).toEqual(['en-US', 'es-MX', 'pt-BR']);
  });

  it('writes each market its own answer keys when the plan gives a rubric per market (B.16)', () => {
    const plan = planOf('v2-first-release-mixed');
    const coins = plan.segments.find((s) => s.id === 'coins-01')!;
    coins.rubric_by_locale = { 'en-US': { target_minor: 17, fewest: true }, 'es-MX': { target_minor: 18, fewest: true }, 'pt-BR': { target_minor: 16, fewest: true } };
    delete coins.rubric;
    const emitted = emitV2Lesson(plan, { versionId: 'forge-test' });
    expect(emitted.ok).toBe(true);
    expect(Object.fromEntries(emitted.documents.map((d) => [d.locale, (d.answer_keys['coins-01'] as { target_minor: number }).target_minor])))
      .toEqual({ 'en-US': 17, 'es-MX': 18, 'pt-BR': 16 });
  });
});

describe('B.18 narration audio at release (GAP-FIX-R3)', () => {
  const coreCheck = () => ({ ok: true, output: 'ok' });
  it('flags a differentiated narration channel with no generated audio, and blocks it when audio is required', async () => {
    const plan = planOf('v2-first-release-mixed');
    const flagged = await releaseV2Lessons([plan], { runId: 'r3-narration', outDir: tmp(), courseSlug: 'money', dryRun: true, deps: { coreCheck } });
    expect(flagged.ok).toBe(true);
    expect(flagged.narrationWithoutAudio?.length).toBeGreaterThan(0);
    expect(flagged.narrationWithoutAudio?.[0]).toMatch(/names no audio_ref/);
    const required = await releaseV2Lessons([plan], { runId: 'r3-narration', outDir: tmp(), courseSlug: 'money', dryRun: true, deps: { coreCheck }, requireNarrationAudio: true });
    expect(required).toMatchObject({ ok: false, stage: 'emit' });
    // With the ref and its asset, nothing is flagged; a ref the manifest lacks is.
    const emitted = emitV2Lesson(plan, { versionId: 'forge-test' }).documents;
    const withRef = emitted.map((row) => ({ ...row, document: { ...row.document, segments: (row.document.segments as Array<Record<string, any>>).map((segment) => // eslint-disable-line @typescript-eslint/no-explicit-any
      segment.payload?.narration?.mode === 'differentiated' ? { ...segment, payload: { ...segment.payload, narration: { ...segment.payload.narration, audio_ref: `${segment.id}-voice` } } } : segment) } }));
    const refs = Object.fromEntries(withRef.flatMap((row) => (row.document.segments as Array<Record<string, any>>) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((segment) => segment.payload?.narration?.audio_ref).map((segment) => [segment.payload.narration.audio_ref, `/audio/${segment.id}.mp3`])));
    expect(narrationWithoutAudio(withRef as typeof emitted, refs)).toEqual([]);
    expect(narrationWithoutAudio(withRef as typeof emitted, {})[0]).toMatch(/has no generated asset/);
  });
});
