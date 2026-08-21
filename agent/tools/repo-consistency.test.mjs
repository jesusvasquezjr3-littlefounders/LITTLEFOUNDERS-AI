// Pins the claims our operator docs and setup script make about the repo to
// what the repo actually contains. Each of these drifted silently at least
// once: setup-dev.sh installed 8 of 10 packages while the README promised
// "all" of them, and ROADMAP carried a migration delta two files behind the
// shipped migrations.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, never URL.pathname: on Windows the latter yields
// '/C:/...', which path.resolve turns into 'C:\C:\...' and every read
// dies with ENOENT before a single assertion runs.
const root = fileURLToPath(new URL('../..', import.meta.url));

function packageDirs() {
  return readdirSync(root)
    .filter((entry) => {
      const dir = path.join(root, entry);
      try {
        return statSync(dir).isDirectory() && statSync(path.join(dir, 'package.json')).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

// setup-dev.sh installs every npm package in the repo — a new service dir with
// a package.json must be added to its SERVICES array in the same change.
{
  const setup = readFileSync(path.join(root, 'scripts/setup-dev.sh'), 'utf8');
  const arrayMatch = /SERVICES=\(([^)]*)\)/.exec(setup);
  assert.ok(arrayMatch?.[1], 'scripts/setup-dev.sh must declare a SERVICES array');
  const declared = [...arrayMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    declared,
    packageDirs(),
    'setup-dev.sh SERVICES must list exactly the top-level directories that carry a package.json',
  );
}

// The README quickstart states how many packages `npm run setup` covers.
{
  const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
  const countMatch = /all (\d+) npm packages/.exec(readme);
  assert.ok(countMatch?.[1], 'README.md quickstart must state the npm package count');
  assert.equal(
    Number(countMatch[1]),
    packageDirs().length,
    'README.md package count must match the packages actually in the repo',
  );
}

/*
 * The migration docs must not go stale against the repo.
 *
 * This assertion originally required ROADMAP.md and the frozen 2026-08-01
 * audit snapshot to name the SAME unapplied delta range, with its upper bound
 * equal to the highest shipped migration. That held while one handoff was
 * pending and both documents described it. It stopped being expressible on
 * 2026-08-14, when a read-only ledger probe confirmed production at 46/46
 * (`0001` … `0046`) with nothing pending: there is no current "unapplied
 * range", and forcing a dated audit snapshot to carry today's numbers would
 * falsify a historical record to satisfy a test.
 *
 * So the coupling is split. ROADMAP.md tracks the LIVE state; the audit keeps
 * its own 2026-08-02 range, asserted only to be present and well-formed,
 * because a snapshot's job is to stay true to its date.
 *
 * REVISED 2026-08-21. The live check used to demand that the verified
 * high-water mark equal the highest migration the repo ships. That silently
 * assumed the repo never HOLDS an unapplied migration — which stopped being
 * true the moment a feature landed with its schema ahead of the deploy
 * (`0047`, the AI Tutor). Under the old rule the only way to go green was to
 * write `production at **47/47**` while production sat at 46, which is exactly
 * the falsification the paragraph above refuses to make for the audit.
 *
 * The invariant that actually matters is ARITHMETIC, not equality: whatever
 * ROADMAP claims is verified, plus whatever it declares pending, must account
 * for every migration in the repo. That still catches someone under-applying —
 * an unapplied delta nobody wrote down fails — while letting the document tell
 * the truth about a schema that has shipped in git and not in production.
 */
{
  const migrations = readdirSync(path.join(root, 'database/migrations'))
    .map((entry) => /^(\d{4})_.+\.sql$/.exec(entry)?.[1])
    .filter((n) => n !== undefined)
    .sort();
  const highest = migrations[migrations.length - 1];
  assert.ok(highest, 'database/migrations must contain NNNN_description.sql files');

  const roadmap = readFileSync(path.join(root, 'ROADMAP.md'), 'utf8');
  const delta = /unapplied deltas `(\d{4})`–`(\d{4})`/.exec(roadmap);
  assert.ok(delta?.[1] && delta?.[2], 'ROADMAP.md must state the migration delta range it last handed off');
  assert.ok(delta[1] <= delta[2], 'ROADMAP.md delta range must be ordered');
  assert.equal(
    delta[2],
    highest,
    'ROADMAP.md delta upper bound must match the highest shipped migration',
  );
  const pendingCount = Number(delta[2]) - Number(delta[1]) + 1;

  // The verified production high-water mark, stated as `NN/NN`, must also
  // agree with the repo — this is the number an operator acts on.
  const highWater = /production at \*\*(\d+)\/(\d+)\*\*/.exec(roadmap);
  assert.ok(highWater, 'ROADMAP.md must state the verified production high-water mark as **NN/NN**');
  assert.equal(highWater[1], highWater[2], 'a partially applied ledger must not be recorded as verified');
  // Either everything is applied, or the shortfall is EXACTLY the delta range
  // ROADMAP declares pending. Anything else means a migration exists in the
  // repo that no document accounts for.
  const applied = Number(highWater[2]);
  assert.ok(
    applied === migrations.length || applied + pendingCount === migrations.length,
    `ROADMAP.md must account for every migration: ${migrations.length} in the repo, ` +
      `${applied} recorded as applied, ${pendingCount} declared pending`,
  );

  const audit = readFileSync(path.join(root, 'COURSEGEN_AUDIT_2026-08-01.md'), 'utf8');
  assert.match(
    audit,
    /Post-audit correction, 2026-08-02/,
    'the audit snapshot must carry the bracketed migration-state correction',
  );
  // Deliberately NOT compared against ROADMAP's range: this is a dated
  // snapshot and its numbers are correct AS OF its date.
  assert.match(
    audit,
    /`\d{4}`–`\d{4}`/,
    'the audit correction must still state a well-formed delta range',
  );
}

console.log('repo-consistency OK — setup coverage, README count, and migration docs match the repo');
