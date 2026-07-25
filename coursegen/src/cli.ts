#!/usr/bin/env node
// Forge CLI — the ONLY entry point that spends money (COURSE_ENGINE.md §4).
// `npm run generate -- --course financial-education [--slots a1-s1-t1-l1,...]
//   [--locales es-MX,en-US,pt-BR] [--no-images] [--dry-run] [--run-id <id>]
//   [--register kid|adult]`
//
// Operator-triggered only — never run by CI or any automatic process
// (/AGENTS.md sign-off rule, BOUNDARIES.md #8).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGeneration } from './pipeline/run.js';
import { REGISTERS, isRegister, type Register } from './pipeline/register.js';
import { LESSON_LOCALES, type LessonLocale } from './contract/core/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

interface CliOptions {
  course?: string;
  slots?: string[];
  locales?: LessonLocale[];
  noImages?: boolean;
  dryRun?: boolean;
  runId?: string;
  register?: Register;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--course':
        opts.course = argv[++i];
        break;
      // §1.14: validate at the edge, never coerce silently. Both of these used to
      // accept an empty value and turn it into a DIFFERENT run: an empty --slots
      // became "the whole course" (a 1000-lesson bill from a typo) and an empty
      // --locales became "no locales at all" (slots marked done having published
      // nothing). A sharding invocation whose pattern matches no slot is likewise a
      // zero-work run that used to exit 0 with "published: 0".
      case '--slots': {
        const raw = argv[++i] ?? '';
        const list = raw.split(',').map((x) => x.trim()).filter(Boolean);
        if (list.length === 0) {
          console.error('generate: --slots was given but is empty — omit the flag to generate the whole course, or pass at least one slot id.');
          process.exit(1);
        }
        opts.slots = list;
        break;
      }
      case '--locales': {
        const raw = argv[++i] ?? '';
        const list = raw.split(',').map((x) => x.trim()).filter(Boolean);
        if (list.length === 0) {
          console.error(`generate: --locales was given but is empty — omit the flag for all locales, or pass a subset of ${LESSON_LOCALES.join('|')}.`);
          process.exit(1);
        }
        const bad = list.filter((l) => !(LESSON_LOCALES as readonly string[]).includes(l));
        if (bad.length > 0) {
          console.error(`generate: unknown locale(s) ${bad.join(', ')} — valid values are ${LESSON_LOCALES.join('|')}.`);
          process.exit(1);
        }
        opts.locales = list as LessonLocale[];
        break;
      }
      case '--no-images':
        opts.noImages = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--run-id':
        opts.runId = argv[++i];
        break;
      case '--register': {
        const value = argv[++i] ?? '';
        if (!isRegister(value)) {
          console.error(`generate: --register must be one of ${REGISTERS.join('|')}, got "${value}"`);
          process.exit(1);
        }
        opts.register = value;
        break;
      }
      default:
        console.error(`generate: unknown argument "${arg}"`);
        process.exit(1);
    }
  }
  return opts;
}

function printUsage(): void {
  console.error(
    'Usage: npm run generate -- --course <slug> [--slots a1-s1-t1-l1,...] ' +
      '[--locales es-MX,en-US,pt-BR] [--no-images] [--dry-run] [--run-id <id>] [--register kid|adult]',
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.course) {
    printUsage();
    process.exit(1);
  }

  const summary = await runGeneration({
    course: opts.course,
    slots: opts.slots,
    locales: opts.locales,
    noImages: opts.noImages,
    dryRun: opts.dryRun,
    runId: opts.runId,
    register: opts.register,
    curriculumRoot: path.join(PACKAGE_ROOT, 'curriculum'),
    runsRoot: path.join(PACKAGE_ROOT, 'runs'),
  });

  // Print EVERY bucket, so the numbers add up to the enumerated slot count. A
  // report that shows only published/failed hid whole categories: 700 unattempted
  // slots of 1000 used to look like a clean partial success.
  console.log(`\nrun ${summary.runId}`);
  console.log(`  slots enumerated: ${summary.slotsEnumerated}`);
  console.log(`  published: ${summary.published.length}`);
  for (const slotId of summary.published) console.log(`    - ${slotId}`);
  console.log(`  failed: ${summary.failed.length}`);
  for (const failure of summary.failed) console.log(`    - ${failure.slotId}: ${failure.error}`);
  if (summary.alreadyDone.length > 0) console.log(`  already done before this run: ${summary.alreadyDone.length}`);
  if (summary.dryRun.length > 0) console.log(`  dry-run validated (nothing written): ${summary.dryRun.length}`);
  if (summary.skipped.length > 0) {
    console.log(`  skipped: ${summary.skipped.length}`);
    for (const s of summary.skipped) console.log(`    - ${s.slotId}: ${s.reason}`);
  }
  if (summary.notAttempted.length > 0) {
    console.warn(`  NOT ATTEMPTED: ${summary.notAttempted.length} slot(s) were enumerated but never reached — resume with the same --run-id to continue.`);
  }
  if (summary.stoppedOnBudget) {
    console.warn('  STOPPED: run budget exceeded (see the budget line printed at start)');
  }
  if (summary.fatalProviderError) {
    // The ONE cause, stated once, instead of leaving the operator to infer it from
    // dozens of derived slot failures.
    console.error(`\n  ABORTED — provider credential/balance failure:\n    ${summary.fatalProviderError}`);
    console.error('  Nothing further could have succeeded. Fix the account, then resume with the SAME --run-id;');
    console.error('  everything already published stays published and only the remaining slots are regenerated.');
  }
  console.log(`  images: ${summary.imagesGenerated} placed, ${summary.imagesBilled} freshly generated (billed), ${summary.imagesInherited} inherited from previous art (free)`);
  if (summary.imageSkipReasons.length > 0) {
    console.warn(`  IMAGES SKIPPED (${summary.imageSkipReasons.join(', ')}) — this curriculum is visual-first; lessons published without illustrations.`);
  } else if (summary.imagesGenerated === 0 && summary.published.length > 0) {
    console.warn('  WARNING: published lessons but generated ZERO images — check PICTUREGEN_URL, or pass --no-images if that was intended.');
  }
  if (summary.salvagedSlots.length > 0) {
    console.warn(`  SALVAGED (published SHORTER than the blueprint): ${summary.salvagedSlots.length}`);
    for (const s of summary.salvagedSlots) console.warn(`    - ${s.slotId}: ${s.droppedSegments} segment(s) dropped`);
  }
  console.log(`  tokens used: ${summary.tokensUsed}, est. USD: ${summary.usdUsed.toFixed(4)}`);

  // A run that did NOTHING is not a success. A --slots pattern that matched no
  // slot, or an enumeration that produced none, used to exit 0 with "published: 0".
  if (summary.slotsEnumerated === 0) {
    console.error('generate: no slots matched — check --slots (a sharding pattern that matches nothing is not a successful run).');
    process.exitCode = 1;
  }
  if (summary.failed.length > 0 || summary.stoppedOnBudget || summary.notAttempted.length > 0 || summary.fatalProviderError) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
