// Pins the claims our operator docs and setup script make about the repo to
// what the repo actually contains. Each of these drifted silently at least
// once: setup-dev.sh installed 8 of 10 packages while the README promised
// "all" of them, and ROADMAP carried a migration delta two files behind the
// shipped migrations.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);

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
 * So the coupling is split. ROADMAP.md tracks the LIVE state and must name a
 * high-water mark equal to the highest migration the repo ships — the check
 * that actually prevents someone under-applying. The audit keeps its own
 * 2026-08-02 range, asserted only to be present and well-formed, because a
 * snapshot's job is to stay true to its date.
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

  // The verified production high-water mark, stated as `NN/NN`, must also
  // agree with the repo — this is the number an operator acts on.
  const highWater = /production at \*\*(\d+)\/(\d+)\*\*/.exec(roadmap);
  assert.ok(highWater, 'ROADMAP.md must state the verified production high-water mark as **NN/NN**');
  assert.equal(highWater[1], highWater[2], 'a partially applied ledger must not be recorded as verified');
  assert.equal(
    Number(highWater[2]),
    migrations.length,
    'ROADMAP.md production high-water mark must match the migration count the repo ships',
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
