#!/usr/bin/env node
/*
 * "Public acquisition surface" is defined in TWO packages, and they must agree.
 *
 *   frontend/src/lib/analytics.tsx   MARKETING_PREFIXES  → what gets RECORDED
 *   backend/src/services/pulse.ts    MARKETING_ROOTS     → what gets REPORTED
 *
 * They cannot share an import: this repo is nine independent npm packages with
 * no workspaces (/AGENTS.md §1.2), so the definition is duplicated by
 * necessity. What must NOT be duplicated is the enforcement.
 *
 * Drift here is silent and asymmetric, which is what makes it worth a gate
 * rather than a comment:
 *
 *   - Added to the frontend only → the new page is recorded but filtered out
 *     of every report. The marketing page nobody can measure looks like a page
 *     nobody visits.
 *   - Added to the backend only → the report admits a path the tracker never
 *     collects. Harmless today, but it widens the read-time scope that exists
 *     to keep pre-2026-08-14 history inside the §1.9 boundary (RUNBOOK:
 *     "Plausible records /admin/* and product routes").
 *
 * Neither failure produces an error, a failing test, or a visibly wrong
 * number — only a quietly incomplete one. Hence a gate.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FRONTEND = 'frontend/src/lib/analytics.tsx';
const BACKEND = 'backend/src/services/pulse.ts';

/** Pull a single-line array literal out of a source file, or fail loudly. */
function extractArray(relPath, constName, pattern) {
  const source = readFileSync(join(ROOT, relPath), 'utf8');
  const match = source.match(pattern);
  if (!match) {
    // A rename or reformat must fail the gate, never silently pass it: an
    // extractor that quietly returns [] would make both sides "agree" on
    // nothing at all.
    throw new Error(
      `Could not find ${constName} in ${relPath}.\n` +
        `This gate parses it by pattern, so renaming or reformatting the ` +
        `declaration breaks it. Update the pattern in ` +
        `agent/tools/check-marketing-paths.mjs to match the new shape.`,
    );
  }
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

export function readMarketingPaths() {
  // MARKETING_PREFIXES = ['/', '/how-it-works', ...]
  const prefixes = extractArray(FRONTEND, 'MARKETING_PREFIXES', /const MARKETING_PREFIXES\s*=\s*\[([^\]]*)\]/);
  // MARKETING_ROOTS = ['how-it-works', ...] as const
  const roots = extractArray(BACKEND, 'MARKETING_ROOTS', /const MARKETING_ROOTS\s*=\s*\[([^\]]*)\]/);
  return { prefixes, roots };
}

/**
 * The frontend list carries the site root `/`, which has no "root name" and is
 * handled explicitly on both sides; every other entry must appear in the
 * backend list with its leading slash removed.
 */
export function compareMarketingPaths({ prefixes, roots }) {
  const expected = prefixes.filter((p) => p !== '/').map((p) => p.replace(/^\//, ''));
  const missingInBackend = expected.filter((r) => !roots.includes(r));
  const extraInBackend = roots.filter((r) => !expected.includes(r));
  return { expected, missingInBackend, extraInBackend, ok: !missingInBackend.length && !extraInBackend.length };
}

function main() {
  let paths;
  try {
    paths = readMarketingPaths();
  } catch (err) {
    // A stack trace in CI reads as "the gate is broken" rather than "your
    // rename broke the gate". Print the actionable message instead.
    console.error(`FAIL  ${err.message}`);
    process.exit(1);
  }

  if (!paths.prefixes.includes('/')) {
    console.error(`FAIL  MARKETING_PREFIXES in ${FRONTEND} no longer contains the site root '/'.`);
    process.exit(1);
  }

  const result = compareMarketingPaths(paths);
  if (result.ok) {
    console.log(`OK    marketing paths agree across both packages (${result.expected.length} + root)`);
    return;
  }

  console.error('FAIL  the public acquisition surface is defined differently in each package.\n');
  console.error(`  ${FRONTEND}`);
  console.error(`    MARKETING_PREFIXES = ${JSON.stringify(paths.prefixes)}`);
  console.error(`  ${BACKEND}`);
  console.error(`    MARKETING_ROOTS    = ${JSON.stringify(paths.roots)}\n`);
  for (const r of result.missingInBackend) {
    console.error(`  - '${r}' is tracked by the frontend but filtered OUT of every report.`);
  }
  for (const r of result.extraInBackend) {
    console.error(`  - '${r}' is admitted by reports but never tracked by the frontend.`);
  }
  console.error('\n  Add the route to BOTH lists (see the header of either file).');
  process.exit(1);
}

// Only run when invoked directly, so the test can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
