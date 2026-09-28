// v2:author and v2:publish — the owner-run v2 authoring and publication
// commands (GAP-FIX-R1 learning; OD-17, OD-23, OD-24).
//
//   npm run v2:author -- --skeleton <plan.json> --out <plan.json> --dry-run [--reference <plan.json>]
//   npm run v2:author -- --skeleton <plan.json> --out <plan.json> --max-usd <n>       (paid, owner-run)
//   npm run v2:publish -- --plans <dir> --course <slug> --run-id <id> --out <dir> --dry-run
//   npm run v2:publish -- --plans <dir> --course <slug> --run-id <id> --out <dir>     (writes to Vault)
//
// v2:author's dry run answers from a committed plan (the skeleton's own copy,
// or --reference), so prompting, merging and gating run with zero model calls.
// A paid run refuses without the owner-approved --max-usd ceiling
// (spendCeilingRefusal) and runs under the usage ledger. v2:publish never
// spends; without --dry-run it runs verify:course and calls Vault's reviewed
// publication transaction (publish_v2_lesson_version) per market.
// Runbook: docs/content/FORGE-V2-RELEASE.md.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeDeepSeek } from '../providers/deepseek.js';
import { UsageLedger } from '../providers/usage.js';
import { spendCeilingRefusal } from '../pipeline/spendGuard.js';
import { getConfig } from '../env.js';
import { authorV2Plan, fixtureResponder, skeletonOf } from './author.js';
import { loadV2Plans, v2LessonPlanSchema } from './plan.js';
import { releaseV2Lessons } from './release.js';

type Args = Record<string, string | true>;
function parse(argv: string[]): Args {
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

async function author(args: Args): Promise<number> {
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
  const result = await authorV2Plan(skeleton, dryRun ? fixtureResponder(reference) : completeDeepSeek, { operation: 'v2-author', ledger });
  if (!result.ok || !result.plan) {
    console.error(`v2:author: blocked after ${result.attempts} round(s):\n  ${result.problems.join('\n  ')}`);
    return 1;
  }
  writeFileSync(path.resolve(args.out), `${JSON.stringify(result.plan, null, 2)}\n`);
  console.log(`v2:author: ${result.plan.lesson_id} authored in ${result.attempts} round(s)${dryRun ? ' (dry run: 0 model calls)' : ''} -> ${args.out}`);
  return 0;
}

async function publish(args: Args): Promise<number> {
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
  const result = await releaseV2Lessons(loaded.map((entry) => entry.plan!), {
    runId: args['run-id'], outDir: path.resolve(args.out), courseSlug: args.course, dryRun, deps: rpc ? { rpc } : {},
  });
  if (!result.ok) { console.error(`v2:publish: stopped at ${result.stage}:\n  ${result.problems.join('\n  ')}`); return 1; }
  console.log(`v2:publish: ${result.stage} — ${result.documents.length} document(s), ${result.calls.length} publication call(s)${dryRun ? ' written to publish-calls.json, nothing sent' : ' accepted by Vault'}`);
  // G.2: a live lesson's new version waits for a human staff release.
  for (const pending of result.pendingApproval ?? []) {
    console.log(`v2:publish: ${pending.lessonId} ${pending.locale} ${pending.versionId} waits for a staff release (staff console, Content, Live updates)`);
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
