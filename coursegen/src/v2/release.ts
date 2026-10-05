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
//   6. Stage 3     (GAP-FIX-R6, Appendix C Part 3) each published version's
//                  review flags (gates 12, 14, 16, 17, 18, 19: findings a human
//                  must judge) are recorded in Vault
//                  (`record_forge_stage3_items`); no version goes live until a
//                  Stage 3 pedagogical review resolves each of them.
//
// Nothing here spends: no model, image or voice call. Steps 3-5 are injected
// (child processes and the service-role RPC by default) so the stage is fully
// testable, and `dryRun` stops after step 3 with the RPC bodies it would send.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELEASE_CHECK_IDS } from '../release/gateManifest.js';
import { emitV2Lesson, forgeVersionId, type EmittedV2Document, type V2EmitResult } from './emit.js';
import { HORIZONTE_FORGE_CAPABILITIES } from './horizonte/index.js';
import type { V2LessonPlan } from './plan.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

/**
 * The Forge gates a v2 document runs (the manifest ids Vault requires, rows of
 * public.forge_v2_manifest_gates): gate 1 (contract, by Core), gates 11-16,
 * the v2 content gate and (GAP-FIX-R2, Appendix C Stage 2) the carried-over
 * legacy document gates 2-9, plus reward-mechanic (17), wellbeing-language
 * (18) and age-register (19). check-forge-release-gate-parity keeps
 * this list equal to the migration rows.
 */
export const V2_MANIFEST_GATES = RELEASE_CHECK_IDS
  .filter((id) => ['forge.gate.01.contract', 'forge.gate.02.age-vocabulary', 'forge.gate.03.currency-facts', 'forge.gate.04.arithmetic',
    'forge.gate.05.rationale-canon', 'forge.gate.06.anti-genericity', 'forge.gate.07.generation-quality', 'forge.gate.08.clarity', 'forge.gate.09.readability',
    'forge.gate.11.redundancy', 'forge.gate.12.tone', 'forge.gate.13.copy-budget', 'forge.gate.14.concept-cap', 'forge.gate.15.mentor-misjudgment',
    'forge.gate.16.regional-adaptation', 'forge.gate.17.reward-mechanics', 'forge.gate.18.wellbeing-language', 'forge.gate.19.age-register', 'forge.release.v2-content'].includes(id));

export interface V2PublishCall { lessonId: string; locale: string; versionId: string; body: Record<string, unknown> }

export interface V2ReleaseDeps {
  /** Core's contract and interactive-behaviour check over a documents file. */
  coreCheck?: (documentsFile: string) => { ok: boolean; output: string };
  /** Forge's course verification (writes the attestation 0209 reads for a published lesson). */
  verifyCourse?: (courseSlug: string) => { ok: boolean; output: string };
  /** The service-role RPC to Vault. */
  rpc?: (fn: string, body: Record<string, unknown>) => Promise<{ ok: boolean; status: number; body: unknown }>;
}

/** One Forge flag for the Stage 3 pedagogical reviewer, as Vault stores it (gate 1-99, message 1-600 characters). */
export interface Stage3Item { gate: number; message: string }
export interface Stage3Record { lessonId: string; locale: string; versionId: string; items: Stage3Item[] }

/**
 * Appendix C Part 3 Stage 3 (GAP-FIX-R6): the review flags of one market's
 * document. A plan-level flag (no locale) belongs to every market's version,
 * so each version's review resolves it. Duplicates are dropped.
 */
export function stage3ItemsFor(review: V2EmitResult['review'], locale: string): Stage3Item[] {
  const seen = new Set<string>();
  const items: Stage3Item[] = [];
  for (const finding of review) {
    if (finding.locale && finding.locale !== locale) continue;
    const text = finding.segmentId && !finding.message.includes(finding.segmentId) ? `${finding.segmentId}: ${finding.message}` : finding.message;
    const message = text.trim().slice(0, 600);
    const key = `${finding.gate}|${message}`;
    if (!message || seen.has(key)) continue;
    seen.add(key);
    items.push({ gate: finding.gate, message });
  }
  return items;
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
  /** Stage 3 (GAP-FIX-R6): the review flags per published version; recorded in Vault on a real run, listed on a dry run. */
  stage3?: Stage3Record[];
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

/**
 * The Horizonte segment types the documents use. Core parses a type only once
 * it is deployed, so Vault must not accept a version holding one before then.
 */
export function horizonteTypesIn(documents: readonly EmittedV2Document[]): string[] {
  const types = new Set<string>();
  for (const row of documents) {
    const segments = (row.document as unknown as { segments?: Array<{ type?: unknown }> }).segments ?? [];
    for (const segment of segments) if (typeof segment.type === 'string' && Object.hasOwn(HORIZONTE_FORGE_CAPABILITIES, segment.type)) types.add(segment.type);
  }
  return [...types].sort();
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
  /** Draft/review course: write invisible current pointers first, then attest that exact final corpus. */
  initialCourse?: boolean;
  /** Echo's audio manifest (audio_ref -> asset) the narration check reads; empty when no audio was generated. */
  audioManifest?: Readonly<Record<string, unknown>>;
  /** Refuse (instead of flag) a differentiated narration channel without its audio. */
  requireNarrationAudio?: boolean;
  /** The owner confirms the deployed Core already serves the Horizonte segment types; a Vault write refuses them otherwise. */
  coreServesHorizonte?: boolean;
  /** Block a plan that names no teaching_role at all (gate 14, lessonDesign.ts). */
  requireLessonDesign?: boolean;
}): Promise<V2ReleaseResult> {
  const versionId = forgeVersionId(options.runId);
  const documents: EmittedV2Document[] = [];
  const problems: string[] = [];
  const reviewByLesson = new Map<string, V2EmitResult['review']>();
  for (const plan of plans) {
    const result = emitV2Lesson(plan, { versionId, ...(options.requireLessonDesign ? { requireLessonDesign: true } : {}) });
    if (!result.ok) problems.push(...result.problems.map((p) => `${plan.lesson_id}: [gate ${p.gate}] ${p.locale ?? ''} ${p.message}`.trim()));
    documents.push(...result.documents);
    reviewByLesson.set(plan.lesson_id, [...(reviewByLesson.get(plan.lesson_id) ?? []), ...result.review]);
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
  const stage3: Stage3Record[] = calls
    .map((call) => ({ lessonId: call.lessonId, locale: call.locale, versionId: call.versionId, items: stage3ItemsFor(reviewByLesson.get(call.lessonId) ?? [], call.locale) }))
    .filter((record) => record.items.length > 0);
  if (options.dryRun) return { ok: true, stage: 'dry-run', documents, calls, problems: [], stage3, ...flagged };

  const horizonte = horizonteTypesIn(documents);
  if (horizonte.length && !options.coreServesHorizonte) {
    return { ok: false, stage: 'core-check', documents, calls, problems: [`${horizonte.join(', ')}: the local Core check cannot tell whether the deployed Core serves these Horizonte types, and an older Core answers 422 UNSUPPORTED_LESSON for a version that holds one. Deploy Core first, then pass --core-has-horizonte`] };
  }

  // A live course needs a fresh attestation before Vault will accept a pending
  // version. A first release is the inverse: its review lessons are invisible,
  // so all current pointers must exist before verify:course can attest the
  // complete authored corpus and its final watermark.
  if (!options.initialCourse) {
    const verified = (options.deps?.verifyCourse ?? defaultVerifyCourse)(options.courseSlug);
    if (!verified.ok) return { ok: false, stage: 'verify', documents, calls, problems: [verified.output.trim() || 'verify:course failed'] };
  }
  if (!options.deps?.rpc) return { ok: false, stage: 'publish', documents, calls, problems: ['no Vault RPC configured for the publish stage'] };
  const pendingApproval: NonNullable<V2ReleaseResult['pendingApproval']> = [];
  for (const call of calls) {
    const reply = await options.deps.rpc('publish_v2_lesson_version', call.body);
    if (!reply.ok) return { ok: false, stage: 'publish', documents, calls, problems: [`${call.lessonId} ${call.locale}: Vault refused the publication (${reply.status}) ${JSON.stringify(reply.body)}`], pendingApproval };
    const body = reply.body as { activation?: unknown } | null;
    const activation = body && typeof body === 'object' ? body.activation : undefined;
    if (activation !== 'activated' && activation !== 'pending_staff_approval') {
      return { ok: false, stage: 'publish', documents, calls, problems: [`${call.lessonId} ${call.locale}: Vault returned non-releasable activation ${JSON.stringify(activation)}; expected activated or pending_staff_approval`], pendingApproval };
    }
    if (activation === 'pending_staff_approval') {
      pendingApproval.push({ lessonId: call.lessonId, locale: call.locale, versionId: call.versionId });
    }
    const record = stage3.find((entry) => entry.lessonId === call.lessonId && entry.locale === call.locale);
    if (record) {
      const stored = await options.deps.rpc('record_forge_stage3_items', {
        p_lesson_id: record.lessonId, p_locale: record.locale, p_version_id: record.versionId, p_run_id: options.runId.slice(0, 120), p_items: record.items,
      });
      if (!stored.ok) {
        return { ok: false, stage: 'publish', documents, calls, pendingApproval, stage3,
          problems: [`${call.lessonId} ${call.locale}: Vault did not record the ${record.items.length} Stage 3 review flag(s) (${stored.status}) ${JSON.stringify(stored.body)}; the version cannot be released until they are recorded and reviewed`] };
      }
    }
  }
  if (options.initialCourse) {
    const verified = (options.deps?.verifyCourse ?? defaultVerifyCourse)(options.courseSlug);
    if (!verified.ok) return { ok: false, stage: 'verify', documents, calls, problems: [verified.output.trim() || 'verify:course failed'], pendingApproval, stage3, ...flagged };
  }
  return { ok: true, stage: 'done', documents, calls, problems: [], pendingApproval, stage3, ...flagged };
}
