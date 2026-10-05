// npm run v2:emit — the zero-spend v2 lesson dry-run (S05.4c; OD-17, OD-23).
//
//   npm run v2:emit                                  fixture plans → runs/v2-emit/<run>/
//   npm run v2:emit -- --plans <dir> --out <dir> --run-id <id>
//   npm run v2:emit -- --require-lesson-design       a plan with no teaching_role blocks (gate 14, lessonDesign.ts)
//   npm run v2:emit -- --write-fixture               refresh src/v2/fixtures/emitted.json
//   npm run v2:emit -- --horizonte [--write-fixture] the Horizonte plans and their own emitted-horizonte.json
//
// Reads v2 lesson plans, emits each market's public document and private
// answer keys, runs the v2 Forge gates, and writes:
//   documents.json  the emitted rows (only lessons with no blocking finding)
//   report.json     per-lesson itemized problems, review items, and the
//                   zero-spend receipt (model calls: 0)
// Then validate the rows with Core's strict v2 contract:
//   npm --prefix backend run forge-v2:check -- <out>/documents.json
// Exit 1 when a plan is malformed or any gate blocks. Nothing here calls a
// model, an image or voice provider, or the network, and nothing is written
// to Vault: publication stays the reviewed publication transaction (0101).

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitV2Lesson, forgeVersionId, type EmittedV2Document, type V2EmitResult } from './emit.js';
import { loadV2Plans } from './plan.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PLANS = path.join(here, 'fixtures/plans');
export const FIXTURE_EMITTED = path.join(here, 'fixtures/emitted.json');
export const FIXTURE_PLANS_HORIZONTE = path.join(here, 'fixtures/plans-horizonte');
export const FIXTURE_EMITTED_HORIZONTE = path.join(here, 'fixtures/emitted-horizonte.json');
export const FIXTURE_RUN_ID = 'fixture';

export interface V2EmitRun {
  runId: string;
  versionId: string;
  planErrors: Array<{ file: string; errors: string[] }>;
  results: V2EmitResult[];
  documents: EmittedV2Document[];
  ok: boolean;
}

export function runV2Emit(plansDir: string, runId: string, options: { requireLessonDesign?: boolean } = {}): V2EmitRun {
  const versionId = forgeVersionId(runId);
  const loaded = loadV2Plans(plansDir);
  const planErrors = loaded.filter((entry) => entry.errors.length > 0).map((entry) => ({ file: entry.file, errors: entry.errors }));
  const seen = new Set<string>();
  const results: V2EmitResult[] = [];
  for (const entry of loaded) {
    if (!entry.plan) continue;
    if (seen.has(entry.plan.lesson_id)) {
      planErrors.push({ file: entry.file, errors: [`lesson_id "${entry.plan.lesson_id}" is planned twice`] });
      continue;
    }
    seen.add(entry.plan.lesson_id);
    results.push(emitV2Lesson(entry.plan, { versionId, ...(options.requireLessonDesign ? { requireLessonDesign: true } : {}) }));
  }
  const documents = results.flatMap((result) => result.documents);
  return { runId, versionId, planErrors, results, documents, ok: planErrors.length === 0 && loaded.length > 0 && results.every((result) => result.ok) };
}

function parseArgs(argv: string[]): { plans: string; out?: string; runId: string; writeFixture: boolean; fixtureFile: string; requireLessonDesign: boolean } {
  let plans = FIXTURE_PLANS;
  let fixtureFile = FIXTURE_EMITTED;
  let out: string | undefined;
  let runId = `v2-emit-${new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()}`;
  let writeFixture = false;
  let requireLessonDesign = false;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Error(`v2:emit: ${flag} requires a value`);
      return next;
    };
    if (flag === '--plans') plans = path.resolve(value());
    else if (flag === '--out') out = path.resolve(value());
    else if (flag === '--run-id') runId = value();
    else if (flag === '--write-fixture') writeFixture = true;
    else if (flag === '--require-lesson-design') requireLessonDesign = true;
    else if (flag === '--horizonte') {
      plans = FIXTURE_PLANS_HORIZONTE;
      fixtureFile = FIXTURE_EMITTED_HORIZONTE;
    } else throw new Error(`v2:emit: unknown flag "${flag}"`);
  }
  if (writeFixture) runId = FIXTURE_RUN_ID;
  return { plans, runId, writeFixture, fixtureFile, requireLessonDesign, ...(out ? { out } : {}) };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  const run = runV2Emit(args.plans, args.runId, { requireLessonDesign: args.requireLessonDesign });

  const report = {
    runId: run.runId,
    versionId: run.versionId,
    generatedAt: new Date().toISOString(),
    zeroSpend: { modelCalls: 0, imageCalls: 0, voiceCalls: 0, networkCalls: 0, vaultWrites: 0 },
    ok: run.ok,
    plans: run.results.length + run.planErrors.length,
    lessonsEmitted: run.results.filter((result) => result.ok).length,
    documents: run.documents.length,
    planErrors: run.planErrors,
    lessons: run.results.map((result) => ({
      lessonId: result.lessonId,
      ok: result.ok,
      problems: result.problems,
      review: result.review,
      notApplicable: result.notApplicable,
    })),
  };

  if (args.writeFixture) {
    if (!run.ok) {
      console.error('v2:emit: refusing to write the fixture from a failing run');
    } else {
      writeFileSync(args.fixtureFile, `${JSON.stringify(run.documents, null, 2)}\n`);
      console.log(`v2:emit: wrote ${path.relative(process.cwd(), args.fixtureFile)} (${run.documents.length} documents)`);
    }
  } else {
    const outDir = args.out ?? path.resolve(here, '../../runs/v2-emit', run.runId);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'documents.json'), `${JSON.stringify(run.documents, null, 2)}\n`);
    writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`v2:emit: ${path.relative(process.cwd(), outDir)}`);
  }

  console.log(`\n══ V2 DRY-RUN EMIT — ${run.runId} (version ${run.versionId}) ══`);
  for (const { file, errors } of run.planErrors) {
    console.log(`  ✗ ${file}`);
    for (const error of errors.slice(0, 5)) console.log(`      ${error}`);
  }
  for (const result of run.results) {
    console.log(`  ${result.ok ? '✓' : '✗'} ${result.lessonId}${result.ok ? ` — ${result.documents.length} documents` : ''}`);
    for (const problem of result.problems.slice(0, 6)) {
      console.log(`      gate ${problem.gate}${problem.locale ? ` [${problem.locale}]` : ''}${problem.segmentId ? ` ${problem.segmentId}` : ''}: ${problem.message.slice(0, 160)}`);
    }
    if (result.problems.length > 6) console.log(`      … and ${result.problems.length - 6} more`);
  }
  console.log(`\n  zero spend: 0 model, image, voice or network calls; nothing written to Vault`);
  console.log(`  next: npm --prefix backend run forge-v2:check -- <out>/documents.json (Core's strict v2 contract)`);
  console.log(`\n  RESULT: ${run.ok ? 'ALL LESSONS EMITTED' : 'BLOCKED — see the itemized report'}\n`);
  if (!run.ok) process.exit(1);
}
