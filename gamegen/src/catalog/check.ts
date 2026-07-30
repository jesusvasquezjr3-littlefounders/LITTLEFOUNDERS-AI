// The Arcade catalog ORACLE — GAME_ENGINE.md §9 (`validate`, the free stage that runs
// before every paid one).
//
// Not a smoke test. A smoke test asks "does this file parse"; this asks the two
// questions that decide whether a paid run is worth starting:
//   1. Does every game bind to a concept that REALLY EXISTS in Forge's curriculum?
//      (loader.ts — an unresolvable `topic_path` is an orphan, and orphan games do not
//      exist: `games.topic_id` is NOT NULL, so the failure is otherwise discovered at
//      publish, after every paid stage has already been billed.)
//   2. Is the resulting course a SHAPE worth generating — mechanic distribution, topic
//      coverage, tier agreement? (Reported here, warnings only.)
//
// DEV/CI-TIME ONLY. Reading `coursegen/curriculum/` is impossible in gamegen's Railway
// image (`--path-as-root`), and nothing on a request path may call this module. See the
// deployment note at the top of loader.ts.
//
// Pure by default: discovery + the report, no printing, no `process.exit` — the test
// suite calls `checkGameCatalogDirs` directly against fixture directories, exactly as
// Forge's `checkCourseDirs` is called. `runCatalogCheck` is the printing wrapper, and
// `src/catalogCli.ts` is the documented entry point that invokes it.

import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadGameCatalog, REPO_ROOT, type GameCatalogLoadResult, type LoadGameCatalogOptions } from './loader.js';
import { MECHANIC_IDS } from './schema.js';

export const PACKAGE_ROOT = path.join(REPO_ROOT, 'gamegen');
export const CURRICULUM_ROOT = path.join(PACKAGE_ROOT, 'curriculum');

export interface GameCatalogCheckReport {
  results: GameCatalogLoadResult[];
  totalBlueprints: number;
  /** Course-independent roll-up of the mechanic distribution. */
  mechanicTotals: Record<string, number>;
  totalErrors: number;
  totalWarnings: number;
}

/** Every immediate subdirectory of `gamegen/curriculum/` is one course. */
export function discoverGameCourseDirs(curriculumRoot: string = CURRICULUM_ROOT): string[] {
  try {
    return readdirSync(curriculumRoot)
      .map((name) => path.join(curriculumRoot, name))
      .filter((candidate) => statSync(candidate).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

export function checkGameCatalogDirs(
  courseDirs: readonly string[],
  options: LoadGameCatalogOptions = {},
): GameCatalogCheckReport {
  const results = courseDirs.map((courseDir) => loadGameCatalog(courseDir, options));

  const mechanicTotals: Record<string, number> = Object.fromEntries(MECHANIC_IDS.map((m) => [m, 0]));
  let totalBlueprints = 0;
  for (const result of results) {
    totalBlueprints += result.coverage.blueprints;
    for (const mechanic of MECHANIC_IDS) {
      mechanicTotals[mechanic] = (mechanicTotals[mechanic] ?? 0) + (result.coverage.mechanicCounts[mechanic] ?? 0);
    }
  }

  return {
    results,
    totalBlueprints,
    mechanicTotals,
    totalErrors: results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'error').length, 0),
    totalWarnings: results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'warning').length, 0),
  };
}

/** `mechanic×count` in a stable, closed-set order — never `Object.keys` ordering. */
export function formatMechanicDistribution(counts: Record<string, number>): string {
  return MECHANIC_IDS.map((m) => `${m}=${counts[m] ?? 0}`).join('  ');
}

/**
 * Prints the per-course summary and returns the process exit code (non-zero on ANY
 * error). Kept here rather than in catalogCli.ts so the direct-execution safety net at
 * the bottom of this file needs no import cycle.
 */
export function runCatalogCheck(argv: readonly string[], options: LoadGameCatalogOptions = {}): number {
  const argPath = argv[0];
  const courseDirs = argPath
    ? [path.isAbsolute(argPath) ? argPath : path.resolve(process.cwd(), argPath)]
    : discoverGameCourseDirs();

  if (courseDirs.length === 0) {
    console.log('catalog:check — no course directories found under gamegen/curriculum/. Nothing to validate.');
    return 0;
  }

  const report = checkGameCatalogDirs(courseDirs, options);
  const rel = (p: string): string => path.relative(PACKAGE_ROOT, p) || p;

  for (const result of report.results) {
    const errors = result.issues.filter((i) => i.level === 'error');
    const warnings = result.issues.filter((i) => i.level === 'warning');
    const { coverage } = result;

    console.log(`\n── ${rel(result.courseDir)} ──`);
    console.log(
      `  ${coverage.blueprints} game blueprint(s) across ${coverage.topicsWithGames} topic(s)` +
        (coverage.topicsInCourse === null
          ? ' (Forge course unreadable — topic total unknown)'
          : ` of ${coverage.topicsInCourse} in the bound course`),
    );
    console.log(`  mechanics: ${formatMechanicDistribution(coverage.mechanicCounts)}`);

    for (const w of warnings) console.log(`  WARN  ${rel(w.file)}: ${w.message}`);
    for (const e of errors) console.error(`  ERROR ${rel(e.file)}: ${e.message}`);

    if (errors.length > 0) {
      console.error(`  catalog:check FAILED — ${errors.length} error(s), ${warnings.length} warning(s)`);
    } else {
      console.log(`  catalog:check OK — 0 errors, ${warnings.length} warning(s)`);
    }
  }

  console.log(
    `\n══ ALL COURSES ══\n` +
      `  ${report.results.length} course(s) scanned, ${report.totalBlueprints} game blueprint(s), ` +
      `${report.totalErrors} error(s), ${report.totalWarnings} warning(s)\n` +
      `  mechanics: ${formatMechanicDistribution(report.mechanicTotals)}`,
  );

  return report.totalErrors > 0 ? 1 : 0;
}

// ---- direct-execution safety net --------------------------------------------------
//
// The documented entry point is `src/catalogCli.ts`. This guard exists because a gate
// that is wired to a module path and SILENTLY EXITS 0 is worse than no gate at all: if
// anything (a package.json script, a CI step, a habit carried over from Forge, whose
// `catalog:check` really is `src/catalog/check.ts`) executes THIS file directly, it must
// still run the check. Importing this module remains side-effect free — the guard only
// fires when this file is the process entry point.
const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exit(runCatalogCheck(process.argv.slice(2)));
}
