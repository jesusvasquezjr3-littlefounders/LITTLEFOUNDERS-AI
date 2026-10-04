import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

/*
 * Post-build gate for the lesson player chunk. `LessonLayer-*.js` is what every learner downloads before a lesson starts, and
 * the per-chunk `chunkBudgetKb` of a Horizonte board cannot see it: a pack's generated contract, scorer and model code that
 * leaks into this chunk is shared code, counted nowhere else. The cause is always an eager import of a pack's `index.ts` or
 * `*.generated` files from the player; a pack reaches the player only through `horizonte/contract.ts`, which keeps the
 * capability tables and loads everything else per pack, on demand.
 *
 * Measured with the packs loaded on demand: 110.6 KB gzip (it was 210.4 KB when all 18 packs shipped eagerly). Appendix P soft
 * budget is 150-200 KB; this ceiling leaves room for ordinary player growth and fails well before a pack leaks in (one leaked
 * pack adds several KB). Raise it only in a commit that says what grew and why.
 *
 * Usage: node scripts/check-lesson-layer-budget.mjs [dist-dir]   (default: dist, i.e. after `vite build`)
 */
export const LESSON_LAYER_GZIP_BUDGET_BYTES = 125 * 1024;

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** The failure message for a gzipped chunk size, or null when it is within the budget. */
export function lessonLayerBudgetProblem(file, gzipBytes, budget = LESSON_LAYER_GZIP_BUDGET_BYTES) {
  return gzipBytes > budget
    ? `${file} is ${kb(gzipBytes)} gzip, over its ${kb(budget)} budget. A Horizonte pack (its index.ts or *.generated files) is probably imported eagerly by the player; load it through horizonte/contract.ts instead.`
    : null;
}

function main() {
  const assets = resolve(resolve(process.argv[2] ?? resolve(import.meta.dirname, '../dist')), 'assets');
  const files = readdirSync(assets).filter((name) => /^LessonLayer-[\w-]+\.js$/.test(name));
  if (files.length !== 1) {
    console.error(`check-lesson-layer-budget: expected one LessonLayer-*.js in ${assets}, found ${files.length}. Did vite build run?`);
    process.exit(1);
  }
  const file = files[0];
  const gzipBytes = gzipSync(readFileSync(resolve(assets, file))).length;
  const problem = lessonLayerBudgetProblem(file, gzipBytes);
  if (problem) {
    console.error(`check-lesson-layer-budget: ${problem}`);
    process.exit(1);
  }
  console.log(`check-lesson-layer-budget: ${file} is ${kb(gzipBytes)} gzip (budget ${kb(LESSON_LAYER_GZIP_BUDGET_BYTES)}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
