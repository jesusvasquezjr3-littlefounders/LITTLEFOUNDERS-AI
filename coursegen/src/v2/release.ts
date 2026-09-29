// The v2 write/publish stage (GAP-FIX-R1 learning; OD-17, OD-24, OD-23,
// F-06/B.16). A new-catalog lesson reaches learners only through this chain:
//
//   1. emit        the per-market documents and answer keys (emit.ts),
//                  each market with its own rubric when the plan gives one
//                  (B.16 per-market answer keys);
//   2. v2 gates    Forge content gates 11-16 (inside emit);
//   3. Core check  `npm --prefix backend run forge-v2:check -- <file>`:
//                  Core's strict contract plus the interactive-behaviour gate
//                  on the authoritative scorer;
//   4. verify      `npm run verify:course -- <course>`: the course attestation
//                  the reviewed publication requires for a published lesson;
//   5. publish     Vault's `publish_v2_lesson_version` (0209), once per market,
//                  with a manifest that attests exactly that document. For a
//                  lesson that is already published, Vault stores the version
//                  as PENDING and nothing a child sees changes until a staff
//                  member releases it on the Content page (G.2, GAP-FIX-R2:
//                  *_v2_staff_release_approval.sql); the result lists those.
//
// Nothing here spends: no model, image or voice call. Steps 3-5 are injected
// (child processes and the service-role RPC by default) so the stage is fully
// testable, and `dryRun` stops after step 3 with the RPC bodies it would send.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELEASE_CHECK_IDS } from '../release/gateManifest.js';
import { emitV2Lesson, forgeVersionId, type EmittedV2Document } from './emit.js';
import type { V2LessonPlan } from './plan.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

/**
 * The Forge gates a v2 document runs (the manifest ids Vault requires, rows of
 * public.forge_v2_manifest_gates): gate 1 (contract, by Core), gates 11-16,
 * the v2 content gate and (GAP-FIX-R2, Appendix C Stage 2) the carried-over
 * age-vocabulary (2), currency-fact (3), arithmetic (4), reward-mechanic (17)
 * and wellbeing-language (18) gates. check-forge-release-gate-parity keeps
 * this list equal to the migration rows.
 */
export const V2_MANIFEST_GATES = RELEASE_CHECK_IDS
  .filter((id) => ['forge.gate.01.contract', 'forge.gate.02.age-vocabulary', 'forge.gate.03.currency-facts', 'forge.gate.04.arithmetic',
    'forge.gate.11.redundancy', 'forge.gate.12.tone', 'forge.gate.13.copy-budget', 'forge.gate.14.concept-cap', 'forge.gate.15.mentor-misjudgment',
    'forge.gate.16.regional-adaptation', 'forge.gate.17.reward-mechanics', 'forge.gate.18.wellbeing-language', 'forge.release.v2-content'].includes(id));

export interface V2PublishCall { lessonId: string; locale: string; versionId: string; body: Record<string, unknown> }

export interface V2ReleaseDeps {
  /** Core's contract and interactive-behaviour check over a documents file. */
  coreCheck?: (documentsFile: string) => { ok: boolean; output: string };
  /** Forge's course verification (writes the attestation 0209 reads for a published lesson). */
  verifyCourse?: (courseSlug: string) => { ok: boolean; output: string };
  /** The service-role RPC to Vault. */
  rpc?: (fn: string, body: Record<string, unknown>) => Promise<{ ok: boolean; status: number; body: unknown }>;
}

export interface V2ReleaseResult {
  ok: boolean;
  stage: 'emit' | 'core-check' | 'verify' | 'publish' | 'done' | 'dry-run';
  documents: EmittedV2Document[];
  calls: V2PublishCall[];
  problems: string[];
  /** G.2: versions of live lessons Vault queued for a staff release (Content page, Live updates). */
  pendingApproval?: { lessonId: string; locale: string; versionId: string }[];
  /**
   * B.18 (GAP-FIX-R3): differentiated narration channels with no generated
   * audio asset. Flagged, never silently shipped: learners get the text-only
   * plate until the audio exists; with `requireNarrationAudio` they block.
   */
  narrationWithoutAudio?: string[];
}

/**
 * B.18 (GAP-FIX-R3): each Mentor-voiced segment whose narration channel is
 * `differentiated` must name an `audio_ref` that Echo's audio manifest (the
 * assets audiogen generated, a paid run under OD-23) holds. Producing the
 * audio is out of scope here; this only reports what is missing.
 */
export function narrationWithoutAudio(documents: readonly EmittedV2Document[], audioManifest: Readonly<Record<string, unknown>> = {}): string[] {
  const missing: string[] = [];
  for (const row of documents) {
    const segments = (row.document as unknown as { segments?: Array<Record<string, unknown>> }).segments ?? [];
    for (const segment of segments) {
      const narration = (segment.payload as { narration?: { mode?: string; audio_ref?: string } } | undefined)?.narration;
      if (narration?.mode !== 'differentiated') continue;
      const asset = narration.audio_ref ? audioManifest[narration.audio_ref] : undefined;
      if (typeof asset === 'string' && asset.length > 0) continue;
      missing.push(`${row.lesson_id} ${row.locale} ${String(segment.id)}: differentiated narration ${narration.audio_ref ? `audio_ref ${narration.audio_ref} has no generated asset` : 'names no audio_ref'}; learners get the text-only plate`);
    }
  }
  return missing;
}

function defaultCoreCheck(file: string) {
  const run = spawnSync('npm', ['--prefix', path.join(repoRoot, 'backend'), 'run', 'forge-v2:check', '--', file], { encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: run.status === 0, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

function defaultVerifyCourse(course: string) {
  const run = spawnSync('npm', ['--prefix', path.join(repoRoot, 'coursegen'), 'run', 'verify:course', '--', course], { encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: run.status === 0, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

/** The manifest 0209 requires: this document's identity, every v2 gate ok, and Core's two checks. */
export function publicationManifest(row: EmittedV2Document, runId: string): Record<string, unknown> {
  return {
    lesson_id: row.lesson_id, locale: row.locale, version_id: row.version_id, run_id: runId,
    core_contract: true, interactive_behaviour: true,
    checks: V2_MANIFEST_GATES.map((gate) => ({ gate, ok: true })),
  };
}

/**
 * Runs the chain for plans whose lesson ids are Vault's lesson ids. `outDir`
 * receives documents.json (the Core check reads it). Stops at the first
 * failing stage with its itemized problems.
 */
export async function releaseV2Lessons(plans: V2LessonPlan[], options: {
  runId: string; outDir: string; courseSlug: string; dryRun: boolean; deps?: V2ReleaseDeps;
  /** Echo's audio manifest (audio_ref -> asset) the narration check reads; empty when no audio was generated. */
  audioManifest?: Readonly<Record<string, unknown>>;
  /** Refuse (instead of flag) a differentiated narration channel without its audio. */
  requireNarrationAudio?: boolean;
}): Promise<V2ReleaseResult> {
  const versionId = forgeVersionId(options.runId);
  const documents: EmittedV2Document[] = [];
  const problems: string[] = [];
  for (const plan of plans) {
    const result = emitV2Lesson(plan, { versionId });
    if (!result.ok) problems.push(...result.problems.map((p) => `${plan.lesson_id}: [gate ${p.gate}] ${p.locale ?? ''} ${p.message}`.trim()));
    documents.push(...result.documents);
  }
  if (problems.length) return { ok: false, stage: 'emit', documents: [], calls: [], problems };
  const silent = narrationWithoutAudio(documents, options.audioManifest);
  if (silent.length && options.requireNarrationAudio) return { ok: false, stage: 'emit', documents: [], calls: [], problems: silent, narrationWithoutAudio: silent };
  const flagged = silent.length ? { narrationWithoutAudio: silent } : {};

  mkdirSync(options.outDir, { recursive: true });
  const file = path.join(options.outDir, 'documents.json');
  writeFileSync(file, `${JSON.stringify(documents, null, 2)}\n`);
  const core = (options.deps?.coreCheck ?? defaultCoreCheck)(file);
  if (!core.ok) return { ok: false, stage: 'core-check', documents, calls: [], problems: [core.output.trim() || 'forge-v2:check failed'] };

  const calls: V2PublishCall[] = documents.map((row) => ({
    lessonId: row.lesson_id, locale: row.locale, versionId: row.version_id,
    body: {
      p_lesson_id: row.lesson_id, p_locale: row.locale, p_version_id: row.version_id,
      p_document: row.document, p_answer_keys: row.answer_keys, p_release_manifest: publicationManifest(row, options.runId),
    },
  }));
  writeFileSync(path.join(options.outDir, 'publish-calls.json'), `${JSON.stringify(calls, null, 2)}\n`);
  if (options.dryRun) return { ok: true, stage: 'dry-run', documents, calls, problems: [], ...flagged };

  const verified = (options.deps?.verifyCourse ?? defaultVerifyCourse)(options.courseSlug);
  if (!verified.ok) return { ok: false, stage: 'verify', documents, calls, problems: [verified.output.trim() || 'verify:course failed'] };
  if (!options.deps?.rpc) return { ok: false, stage: 'publish', documents, calls, problems: ['no Vault RPC configured for the publish stage'] };
  const pendingApproval: NonNullable<V2ReleaseResult['pendingApproval']> = [];
  for (const call of calls) {
    const reply = await options.deps.rpc('publish_v2_lesson_version', call.body);
    if (!reply.ok) return { ok: false, stage: 'publish', documents, calls, problems: [`${call.lessonId} ${call.locale}: Vault refused the publication (${reply.status}) ${JSON.stringify(reply.body)}`], pendingApproval };
    const body = reply.body as { activation?: unknown } | null;
    if (body && typeof body === 'object' && body.activation === 'pending_staff_approval') {
      pendingApproval.push({ lessonId: call.lessonId, locale: call.locale, versionId: call.versionId });
    }
  }
  return { ok: true, stage: 'done', documents, calls, problems: [], pendingApproval, ...flagged };
}
