// check-migration-phase.mjs — every migration declares whether it is safe to
// apply before the code that uses it, and the declaration is CHECKED against
// the SQL rather than trusted.
//
// WHY THIS EXISTS. On 2026-08-26 the deploy note for `0049` said to apply the
// column drop BEFORE shipping the code. That is the order that breaks
// production: the column disappears while the old Core still names it, and
// PostgREST rejects every insert that references a column absent from its
// schema cache. It was caught by re-reading the runbook, which is not a
// control. This is the control.
//
// THE VOCABULARY is expand/contract, and the distinction is about what an
// ALREADY-DEPLOYED service can still be doing:
//
//   expand    adds or widens. Nothing that is running can break, so it may be
//             applied before or after the code. 40 of the 49 migrations here.
//   contract  removes or narrows something an older deploy could still be
//             using. It MUST NOT be applied until the code that stopped
//             depending on it is live, and it names that release.
//
// The classifier is deliberately CONSERVATIVE: it would rather call an expand
// migration a contraction than the reverse, because the cost of the first is a
// manual dispatch and the cost of the second is an outage.
//
// ONLY UNAPPLIED MIGRATIONS CARRY THE HEADER, and that is not a convenience.
// `railway-migrate.sh` records a SHA-256 of each applied file and REFUSES to
// run when a recorded checksum no longer matches ("migration drift detected").
// An applied migration is immutable (/AGENTS.md §1.3) down to its comments:
// stamping a header on the 48 files already in production changed every one of
// those checksums and would have bricked the migrator on its next run. It was
// caught here by diffing the hashes, not in production.
//
// So: at or below the high-water mark the phase is DERIVED and reported;
// above it, the file must declare, because that is where the ordering decision
// still has to be made by a person and `@after-release` is knowledge no
// classifier has.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, never URL.pathname — on Windows the latter yields '/C:/...'
// and readdirSync dies with ENOENT before checking anything.
// Overridable so the gate can be pointed at fixtures. A checker nothing can
// test against a KNOWN-BAD input is a checker nobody has seen fail.
const dir = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../migrations', import.meta.url));

/*
 * Every pattern here is something an older deploy could still depend on.
 *
 * `DROP POLICY IF EXISTS` followed by `CREATE POLICY` is stripped before any
 * of this runs: that is the idempotent re-create idiom used in eleven files,
 * and the policy exists again before the transaction commits.
 *
 * A dropped-and-re-added CHECK counts as a contraction whether or not it looks
 * narrower. It is either identical, in which case saying so costs nothing, or
 * different — and "different" against a running deploy means writes it used to
 * make are now rejected. `0025` is exactly that: three event kinds deleted and
 * the constraint re-added without them.
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

/*
 * The ledger's verified production high-water mark. Migrations at or below it
 * shipped before this convention existed, so they carry `historical` as their
 * release marker; requiring a real one would mean inventing facts about deploys
 * nobody recorded. Anything ABOVE it is unapplied and must name the release
 * that made it safe.
 *
 * Raise this when ROADMAP's `production at **NN/NN**` mark moves.
 */
const APPLIED_THROUGH = 53;
const HISTORICAL = 'historical (applied before this convention existed)';

let failed = false;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  failed = true;
};

const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const counts = { expand: 0, contract: 0 };
const pendingContract = [];

for (const file of files) {
  const sql = readFileSync(join(dir, file), 'utf8');
  const number = Number(file.slice(0, 4));

  const probe = sql.replace(/DROP\s+POLICY\s+IF\s+EXISTS[^;]*;/gi, '');
  const found = CONTRACTIONS.filter(([re]) => re.test(probe)).map(([, why]) => why);
  const derived = found.length > 0 ? 'contract' : 'expand';

  const declared = /^-- @phase:\s*(expand|contract)\s*$/m.exec(sql)?.[1];
  if (!declared) {
    if (number > APPLIED_THROUGH) {
      fail(
        `${file}: no "-- @phase: expand" or "-- @phase: contract" header. ` +
          'Every UNAPPLIED migration declares whether it is safe to apply before the code that uses it.',
      );
      continue;
    }
    // Already in production and therefore immutable: classify it, do not
    // demand that it be rewritten.
    counts[derived] += 1;
    continue;
  }
  counts[declared] += 1;

  // The self-contradiction check: a file that CLAIMS to be additive while
  // containing something an older deploy could break on.
  if (declared === 'expand' && found.length > 0) {
    fail(
      `${file}: declares "@phase: expand" but ${found.join(', ')}. ` +
        'An already-deployed service can still be using that — declare it contract.',
    );
  }

  if (declared === 'contract') {
    const release = /^-- @after-release:\s*(.+?)\s*$/m.exec(sql)?.[1];
    if (!release) {
      fail(`${file}: "@phase: contract" requires an "-- @after-release:" line naming what made it safe.`);
      continue;
    }
    if (number > APPLIED_THROUGH) {
      if (release === HISTORICAL) {
        fail(
          `${file}: is not applied yet (above ${APPLIED_THROUGH}) so "@after-release" must name the ` +
            'release that removed the last reader, not "historical".',
        );
      }
      pendingContract.push(`${file} — after ${release}`);
    }
  }
}

if (pendingContract.length > 0) {
  console.log('');
  console.log('CONTRACT migrations not yet applied — these must NOT be applied before their release is live:');
  for (const line of pendingContract) console.log(`  ${line}`);
  console.log('');
}

if (failed) process.exit(1);
console.log(
  `migration-phase OK — ${files.length} file(s): ${counts.expand} expand, ${counts.contract} contract; ` +
    `every declaration agrees with its SQL${pendingContract.length ? `; ${pendingContract.length} contract pending` : ''}`,
);
