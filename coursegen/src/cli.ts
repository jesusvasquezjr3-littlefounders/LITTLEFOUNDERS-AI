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
import type { LessonLocale } from './contract/core/types.js';

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
      case '--slots':
        opts.slots = (argv[++i] ?? '').split(',').filter(Boolean);
        break;
      case '--locales':
        opts.locales = (argv[++i] ?? '').split(',').filter(Boolean) as LessonLocale[];
        break;
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

  console.log(`\nrun ${summary.runId}`);
  console.log(`  published: ${summary.published.length}`);
  for (const slotId of summary.published) console.log(`    - ${slotId}`);
  console.log(`  failed: ${summary.failed.length}`);
  for (const failure of summary.failed) console.log(`    - ${failure.slotId}: ${failure.error}`);
  if (summary.stoppedOnBudget) {
    console.warn('  STOPPED: run budget exceeded (FORGE_MAX_TOKENS_PER_RUN / FORGE_MAX_USD_PER_RUN)');
  }
  console.log(`  tokens used: ${summary.tokensUsed}, est. USD: ${summary.usdUsed.toFixed(4)}`);

  if (summary.failed.length > 0 || summary.stoppedOnBudget) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
