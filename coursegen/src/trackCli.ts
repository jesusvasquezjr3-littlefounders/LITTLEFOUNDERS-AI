#!/usr/bin/env node
// Forge track CLI — mass generation over a whole course, sharded per adventure
// (COURSE_ENGINE.md §4). `npm run generate:track -- --course financial-education
//   [--track-id <id>] [--locales es-MX,en-US,pt-BR] [--no-images] [--dry-run]
//   [--register kid|adult] [--budget-usd 350] [--shard-passes 3]`
//
// Operator-triggered only — never run by CI or any automatic process
// (/AGENTS.md sign-off rule, BOUNDARIES.md #8). Re-running with the same
// --track-id resumes: every shard keeps its own run-id/checkpoint.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTrack, type TrackReport } from './pipeline/track.js';
import { REGISTERS, isRegister, type Register } from './pipeline/register.js';
import { LESSON_LOCALES, type LessonLocale } from './contract/core/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

interface CliOptions {
  course?: string;
  trackId?: string;
  locales?: LessonLocale[];
  noImages?: boolean;
  dryRun?: boolean;
  register?: Register;
  budgetUsd?: number;
  shardPasses?: number;
}

/**
 * A value-taking flag must never swallow the NEXT flag as its value —
 * `--track-id --dry-run` would otherwise run a REAL paid track whose id is the
 * literal string "--dry-run" (§1.14: validate at the edge).
 */
function requireValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith('--')) {
    console.error(`generate:track: ${flag} needs a value (got ${value === undefined ? 'nothing' : `"${value}"`})`);
    process.exit(1);
  }
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--course':
        opts.course = requireValue('--course', argv[++i]);
        break;
      case '--track-id':
        opts.trackId = requireValue('--track-id', argv[++i]);
        break;
      case '--locales': {
        const raw = argv[++i] ?? '';
        const list = raw.split(',').map((x) => x.trim()).filter(Boolean);
        if (list.length === 0) {
          console.error(`generate:track: --locales was given but is empty — omit the flag for all locales, or pass a subset of ${LESSON_LOCALES.join('|')}.`);
          process.exit(1);
        }
        const bad = list.filter((l) => !(LESSON_LOCALES as readonly string[]).includes(l));
        if (bad.length > 0) {
          console.error(`generate:track: unknown locale(s) ${bad.join(', ')} — valid values are ${LESSON_LOCALES.join('|')}.`);
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
      case '--register': {
        const value = argv[++i] ?? '';
        if (!isRegister(value)) {
          console.error(`generate:track: --register must be one of ${REGISTERS.join('|')}, got "${value}"`);
          process.exit(1);
        }
        opts.register = value;
        break;
      }
      case '--budget-usd': {
        const value = Number(argv[++i]);
        if (!Number.isFinite(value) || value <= 0) {
          console.error('generate:track: --budget-usd must be a positive number');
          process.exit(1);
        }
        opts.budgetUsd = value;
        break;
      }
      case '--shard-passes': {
        const value = Number(argv[++i]);
        if (!Number.isInteger(value) || value < 1 || value > 10) {
          console.error('generate:track: --shard-passes must be an integer between 1 and 10');
          process.exit(1);
        }
        opts.shardPasses = value;
        break;
      }
      default:
        console.error(`generate:track: unknown argument "${arg}"`);
        process.exit(1);
    }
  }
  return opts;
}

function printReport(report: TrackReport): void {
  console.log(`\ntrack ${report.trackId} (${report.course})`);
  console.log(`  global budget: $${report.budgetUsd.toFixed(2)} — spent: $${report.totals.usd.toFixed(4)}`);
  for (const s of report.shards) {
    console.log(
      `  shard ${s.adventure}: ${s.published}/${s.slotCount} published` +
        `${s.dryRun > 0 ? `, ${s.dryRun} dry-run` : ''}` +
        `${s.failed.length > 0 ? `, ${s.failed.length} FAILED` : ''}` +
        `${s.notAttempted > 0 ? `, ${s.notAttempted} NOT ATTEMPTED` : ''}` +
        ` — ${s.passes} pass(es), $${s.usd.toFixed(4)}, cache ${s.cachePct}%`,
    );
    if (s.imagesGenerated === 0 && s.published > 0 && s.dryRun === 0 && s.imageSkipReasons.length === 0) {
      console.warn(`    WARNING: shard published lessons with ZERO images — check PICTUREGEN_URL.`);
    }
    if (s.salvaged.length > 0) {
      console.warn(`    SALVAGED (published shorter than blueprint): ${s.salvaged.map((x) => x.slotId).join(', ')}`);
    }
  }
  const heat = Object.entries(report.failureHeatmap).sort((a, b) => b[1] - a[1]);
  if (heat.length > 0) {
    console.log(`  failure heatmap by stage: ${heat.map(([stage, n]) => `${stage}=${n}`).join(', ')}`);
  }
  if (report.mopUp.length > 0) {
    console.warn(`  MOP-UP (stubborn failures — re-run with generate -- --slots <id>):`);
    for (const slotId of report.mopUp) console.warn(`    - ${slotId}`);
  }
  if (report.halted) {
    console.error(`\n  TRACK HALTED: ${report.halted}`);
    console.error('  Fix the cause, then re-run generate:track with the SAME --track-id — finished shards are');
    console.error('  skipped via their checkpoints and the halted shard resumes where it stopped.');
  }
  console.log(
    `  totals: ${report.totals.published}/${report.totals.slots} published, ` +
      `${report.totals.failed} failed, ${report.totals.notAttempted} not attempted — ` +
      `${report.totals.tokens.toLocaleString()} tokens, $${report.totals.usd.toFixed(4)}, cache ${report.totals.cachePct}%`,
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.course) {
    console.error(
      'Usage: npm run generate:track -- --course <slug> [--track-id <id>] [--locales es-MX,en-US,pt-BR] ' +
        '[--no-images] [--dry-run] [--register kid|adult] [--budget-usd <n>] [--shard-passes <n>]',
    );
    process.exit(1);
  }
  const trackId = opts.trackId ?? `${opts.course}-track-${new Date().toISOString().slice(0, 10)}`;

  const report = await runTrack({
    course: opts.course,
    trackId,
    locales: opts.locales,
    noImages: opts.noImages,
    dryRun: opts.dryRun,
    register: opts.register,
    budgetUsd: opts.budgetUsd,
    shardPasses: opts.shardPasses,
    curriculumRoot: path.join(PACKAGE_ROOT, 'curriculum'),
    runsRoot: path.join(PACKAGE_ROOT, 'runs'),
  });

  printReport(report);
  if (report.halted || report.mopUp.length > 0 || report.totals.failed > 0 || report.totals.notAttempted > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
