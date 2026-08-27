// gate-auto-apply.mjs — may this run apply migrations to production WITHOUT a
// human looking at it?
//
// One decision, in one place, so it can be tested against known inputs instead
// of being spread across a YAML file nobody can run locally. It reads the
// output of `railway-migrate.sh --dry-run` and answers on stdout:
//
//   apply=true   every pending migration is additive
//   apply=false  something pending removes or narrows, or the input is not
//                something this script understands
//
// THE DEFAULT IS REFUSAL. Every path that is not "I read the list and all of it
// is additive" answers false: no pending list, an unparseable line, a file the
// repository does not have, a contraction, a contraction whose release is not
// named. An automatic migrator that guesses is worse than one that stops,
// because the thing on the other side is a production database holding
// families' data.
//
// Usage: node gate-auto-apply.mjs <dry-run-output-file>

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../migrations', import.meta.url));

/*
 * Kept in step with check-migration-phase.mjs deliberately rather than shared
 * through a module: this file is the SAFETY decision and that one is the
 * authoring gate. If they ever disagree, the disagreement should be visible in
 * a diff rather than hidden behind a common import that changed under both.
 * The self-tests assert they agree on the real tree.
 */
const CONTRACTIONS = [
  [/\bDROP\s+COLUMN\b/i, 'drops a column'],
  [/\bDROP\s+TABLE\b/i, 'drops a table'],
  [/\bDROP\s+(?:MATERIALIZED\s+)?VIEW\b/i, 'drops a view'],
  [/\bALTER\s+COLUMN\s+\w+\s+SET\s+NOT\s+NULL\b/i, 'tightens a column to NOT NULL'],
  [/\bALTER\s+COLUMN\s+\w+\s+TYPE\b/i, 'changes a column type'],
  [/\bRENAME\s+(?:COLUMN|TO)\b/i, 'renames'],
  [/\bDROP\s+CONSTRAINT\b[\s\S]{0,600}?\bADD\s+CONSTRAINT\b[\s\S]{0,80}?\bCHECK\b/i, 'narrows a CHECK constraint'],
  [/\bDROP\s+CONSTRAINT\b(?![\s\S]{0,600}?\bADD\s+CONSTRAINT\b)/i, 'drops a constraint without re-adding it'],
  [/^\s*delete\s+from\b/im, 'deletes rows'],
];

function refuse(reason) {
  console.log('apply=false');
  console.log(`reason=${reason}`);
  process.exit(0); // A refusal is a correct outcome, not a broken job.
}

const inputPath = process.argv[2];
if (!inputPath) refuse('no dry-run output was given to read');

let text;
try {
  text = readFileSync(inputPath, 'utf8');
} catch {
  refuse('the dry-run output could not be read');
}

// `--dry-run` must have completed. Applying on the strength of a truncated or
// failed probe would be applying without knowing what is pending.
if (!/^OK: dry-run complete$/m.test(text)) {
  refuse('the dry-run did not complete — its list cannot be trusted');
}

const pending = [...text.matchAll(/^pending\s+(\S+)$/gm)].map((m) => m[1]);
if (pending.length === 0) {
  console.log('apply=false');
  console.log('reason=nothing is pending');
  console.log('pending=0');
  process.exit(0);
}

const known = new Set(readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')));
const blockers = [];
for (const file of pending) {
  if (!known.has(file)) {
    // The remote ledger named a file this checkout does not have. Something is
    // out of step; refusing is the only safe reading.
    refuse(`pending file ${file} is not in this checkout`);
  }
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  const declared = /^-- @phase:\s*(expand|contract)\s*$/m.exec(sql)?.[1];
  if (!declared) refuse(`pending file ${file} declares no phase`);

  const probe = sql.replace(/DROP\s+POLICY\s+IF\s+EXISTS[^;]*;/gi, '');
  const derived = CONTRACTIONS.some(([re]) => re.test(probe)) ? 'contract' : 'expand';
  // Both must say expand. A declaration alone is a promise; the derivation is
  // the check on it.
  if (declared === 'contract' || derived === 'contract') {
    blockers.push(`${file} (${declared === 'contract' ? 'declared' : 'derived'} contract)`);
  }
}

console.log(`pending=${pending.length}`);
if (blockers.length > 0) {
  console.log('apply=false');
  console.log(`reason=contraction pending: ${blockers.join(', ')} — apply by hand after the release is live`);
  process.exit(0);
}

console.log('apply=true');
console.log(`reason=all ${pending.length} pending migration(s) are additive`);
