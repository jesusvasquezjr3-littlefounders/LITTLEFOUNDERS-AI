// v2:author and v2:publish — the owner-run v2 authoring and publication
// commands (GAP-FIX-R1 learning; OD-17, OD-23, OD-24).
//
//   npm run v2:author -- --skeleton <plan.json> --out <plan.json> --dry-run [--reference <plan.json>] [--run-id <id>]
//   npm run v2:author -- --skeleton <plan.json> --out <plan.json> --max-usd <n>       (paid, owner-run)
//   npm run v2:publish -- --plans <dir> --course <slug> --run-id <id> --out <dir> --dry-run
//   npm run v2:publish -- --plans <dir> --course <slug> --run-id <id> --out <dir>     (writes to Vault)
//   --lesson-ids <ids.json> (from v2:hierarchy) rewrites each plan's slug lesson_id to its public.lessons uuid first.
//   --require-lesson-design blocks a plan that names no teaching_role (gate 14, lessonDesign.ts).
//   A Vault write of a Horizonte segment type also needs --core-has-horizonte: the owner's
//   confirmation that Core, which parses the type, is deployed first.
//
// v2:author's dry run answers from a committed plan (the skeleton's own copy,
// or --reference), so prompting, merging and gating run with zero model calls.
// A paid run refuses without the owner-approved --max-usd ceiling
// (spendCeilingRefusal) and runs under the usage ledger. v2:publish never
// spends; without --dry-run it runs verify:course and calls Vault's reviewed
// publication transaction (publish_v2_lesson_version) per market.
// Appendix C Part 1.3 (GAP-FIX-R7): every v2:author run, dry run included,
// appends its first draft's failed gates per market to gate-submissions.jsonl
// in the run directory (`--run-id <id>` -> runs/<id>/, else the directory of
// --out) and prints the per-gate first-submission pass rate of that directory.
// Runbook: docs/content/FORGE-V2-RELEASE.md.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeDeepSeek } from '../providers/deepseek.js';
import { UsageLedger } from '../providers/usage.js';
import { spendCeilingRefusal } from '../pipeline/spendGuard.js';
import { getConfig } from '../env.js';
import { GateSubmissionLog, formatFirstSubmissionPassRates } from '../pipeline/gateSubmissionLog.js';
import { authorV2Plan, fixtureResponder, skeletonOf, type V2FirstSubmission, type V2Responder } from './author.js';
import { applyLessonIds, HierarchyError, parseLessonIds } from './hierarchy.js';
import { loadV2Plans, v2LessonPlanSchema } from './plan.js';
import { releaseV2Lessons } from './release.js';

export type Args = Record<string, string | true>;
export function parse(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    if (!flag.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[flag.slice(2)] = true;
    else { out[flag.slice(2)] = next; i += 1; }
  }
  return out;
}

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Appendix C Part 1.3 (GAP-FIX-R7): the run directory `v2:author` logs its
 * first-submission gate results into. `--run-id <id>` shares `runs/<id>/`
 * with other drafts of the same authoring batch (and with a v1 run of that
 * id); without it, the directory of `--out`, where the usage ledger lives.
 */
export function v2AuthorRunDir(args: Args, packageRoot = PACKAGE_ROOT): string {
  return typeof args['run-id'] === 'string' ? path.join(packageRoot, 'runs', args['run-id']) : path.dirname(path.resolve(args.out as string));
}

/** One gate-submissions.jsonl line per market of the lesson's first draft (pipeline 'v2', slotId = lesson_id). Zero spend. */
export async function recordV2FirstSubmission(runDir: string, lessonId: string, first: readonly V2FirstSubmission[]): Promise<void> {
  const log = new GateSubmissionLog(runDir);
  for (const entry of first) await log.record({ slotId: lessonId, locale: entry.locale, evaluated: entry.evaluated, failedGates: entry.failedGates, pipeline: 'v2' });
}

export async function author(args: Args, responderOverride?: V2Responder): Promise<number> {
  const dryRun = args['dry-run'] === true;
  const maxUsd = typeof args['max-usd'] === 'string' ? Number(args['max-usd']) : undefined;
  const refusal = spendCeilingRefusal({ command: 'generate', flag: '--max-usd', dryRun, ceilingUsd: maxUsd });
  if (refusal) { console.error(refusal.replace('generate:', 'v2:author:')); return 2; }
  if (typeof args.skeleton !== 'string' || typeof args.out !== 'string') { console.error('v2:author: --skeleton <plan.json> and --out <plan.json> are required'); return 2; }
  const source = v2LessonPlanSchema.parse(JSON.parse(readFileSync(path.resolve(args.skeleton), 'utf8')));
  const skeleton = skeletonOf(source);
  const reference = typeof args.reference === 'string' ? v2LessonPlanSchema.parse(JSON.parse(readFileSync(path.resolve(args.reference), 'utf8'))) : source;
  let ledger: UsageLedger | undefined;
  if (!dryRun) {
    ledger = new UsageLedger(path.dirname(path.resolve(args.out)));
    const config = getConfig();
    await ledger.hydrate({ maxTokens: config.FORGE_MAX_TOKENS_PER_RUN, maxUsd: Math.min(config.FORGE_MAX_USD_PER_RUN, maxUsd!) });
  }
  const result = await authorV2Plan(skeleton, responderOverride ?? (dryRun ? fixtureResponder(reference) : completeDeepSeek), { operation: 'v2-author', ledger });
  // Appendix C Part 1.3 (GAP-FIX-R7): the first draft's gates, per market, blocked or not, dry run included. A log failure never fails the stage.
  const runDir = v2AuthorRunDir(args);
  try {
    await recordV2FirstSubmission(runDir, source.lesson_id, result.firstSubmission);
    for (const line of formatFirstSubmissionPassRates(await GateSubmissionLog.read(runDir))) console.log(`v2:author: ${line}`);
  } catch (error) {
    console.warn(`v2:author: the first-submission gate log was not written (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!result.ok || !result.plan) {
    console.error(`v2:author: blocked after ${result.attempts} round(s):\n  ${result.problems.join('\n  ')}`);
    return 1;
  }
  writeFileSync(path.resolve(args.out), `${JSON.stringify(result.plan, null, 2)}\n`);
  console.log(`v2:author: ${result.plan.lesson_id} authored in ${result.attempts} round(s)${dryRun ? ' (dry run: 0 model calls)' : ''} -> ${args.out}`);
  return 0;
}

export async function publish(args: Args): Promise<number> {
  const dryRun = args['dry-run'] === true;
  if (typeof args.plans !== 'string' || typeof args.course !== 'string' || typeof args['run-id'] !== 'string' || typeof args.out !== 'string') {
    console.error('v2:publish: --plans <dir> --course <slug> --run-id <id> --out <dir> are required');
    return 2;
  }
  const loaded = loadV2Plans(path.resolve(args.plans));
  const broken = loaded.filter((entry) => entry.errors.length);
  if (broken.length) { for (const entry of broken) console.error(`v2:publish: ${entry.file}: ${entry.errors.join('; ')}`); return 1; }
  const rpc = dryRun ? undefined : async (fn: string, body: Record<string, unknown>) => {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) as unknown : null };
  };
  // B.18 (GAP-FIX-R3): `--audio-manifest <file>` (audio_ref -> asset) checks differentiated narration; `--require-narration-audio` blocks on a gap.
  const audioManifest = typeof args['audio-manifest'] === 'string' ? JSON.parse(readFileSync(path.resolve(args['audio-manifest']), 'utf8')) as Record<string, unknown> : {};
  // `--lesson-ids <ids.json>` (from v2:hierarchy): rewrite each plan's slug lesson_id to its public.lessons uuid, so document.lesson_id equals p_lesson_id (0221).
  let plans = loaded.map((entry) => entry.plan!);
  if (args['lesson-ids'] !== undefined) {
    if (typeof args['lesson-ids'] !== 'string') { console.error('v2:publish: --lesson-ids needs a file (the ids.json from v2:hierarchy)'); return 2; }
    try {
      const mapped = applyLessonIds(plans, parseLessonIds(JSON.parse(readFileSync(path.resolve(args['lesson-ids']), 'utf8'))));
      if (mapped.problems.length) { for (const problem of mapped.problems) console.error(`v2:publish: ${problem}`); return 1; }
      plans = mapped.plans;
    } catch (error) {
      console.error(`v2:publish: --lesson-ids ${args['lesson-ids']}: ${error instanceof HierarchyError ? error.problems.join('; ') : error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }
  const result = await releaseV2Lessons(plans, {
    runId: args['run-id'], outDir: path.resolve(args.out), courseSlug: args.course, dryRun, deps: rpc ? { rpc } : {},
    audioManifest, requireNarrationAudio: args['require-narration-audio'] === true,
    coreServesHorizonte: args['core-has-horizonte'] === true,
    requireLessonDesign: args['require-lesson-design'] === true,
  });
  if (!result.ok) { console.error(`v2:publish: stopped at ${result.stage}:\n  ${result.problems.join('\n  ')}`); return 1; }
  console.log(`v2:publish: ${result.stage} — ${result.documents.length} document(s), ${result.calls.length} publication call(s)${dryRun ? ' written to publish-calls.json, nothing sent' : ' accepted by Vault'}`);
  // G.2: a live lesson's new version waits for a human staff release.
  for (const gap of result.narrationWithoutAudio ?? []) console.log(`v2:publish: narration flagged: ${gap}`);
  for (const pending of result.pendingApproval ?? []) {
    console.log(`v2:publish: ${pending.lessonId} ${pending.locale} ${pending.versionId} waits for a staff release (staff console, Content, Live updates)`);
  }
  // Appendix C Stage 3 (GAP-FIX-R6): every flag a human must judge, recorded for the Stage 3 pedagogical review.
  for (const record of result.stage3 ?? []) {
    console.log(`v2:publish: ${record.lessonId} ${record.locale} ${record.versionId}: ${record.items.length} Stage 3 review flag(s)${dryRun ? '' : ' recorded'}; a Stage 3 review resolves them before release`);
  }
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const [command, ...rest] = process.argv.slice(2);
  const run = command === 'author' ? author : command === 'publish' ? publish : null;
  if (!run) { console.error('usage: releaseCli.ts author|publish [flags]'); process.exit(2); }
  run(parse(rest)).then((code) => process.exit(code), (error: unknown) => { console.error(error); process.exit(1); });
}
