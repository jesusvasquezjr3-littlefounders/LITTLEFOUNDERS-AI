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

// ROADMAP's production migration handoff names the unapplied delta range; its
// upper bound must be the highest migration the repo actually ships.
{
  const migrations = readdirSync(path.join(root, 'database/migrations'))
    .map((entry) => /^(\d{4})_.+\.sql$/.exec(entry)?.[1])
    .filter((n) => n !== undefined)
    .sort();
  const highest = migrations[migrations.length - 1];
  assert.ok(highest, 'database/migrations must contain NNNN_description.sql files');

  const roadmap = readFileSync(path.join(root, 'ROADMAP.md'), 'utf8');
  const delta = /unapplied deltas `(\d{4})`–`(\d{4})`/.exec(roadmap);
  assert.ok(delta?.[1] && delta?.[2], 'ROADMAP.md must state the unapplied migration delta range');
  assert.ok(delta[1] <= delta[2], 'ROADMAP.md delta range must be ordered');
  assert.equal(
    delta[2],
    highest,
    'ROADMAP.md delta upper bound must match the highest shipped migration',
  );

  const audit = readFileSync(path.join(root, 'COURSEGEN_AUDIT_2026-08-01.md'), 'utf8');
  assert.match(
    audit,
    /Post-audit correction, 2026-08-02/,
    'the audit snapshot must carry the bracketed migration-state correction',
  );
  assert.ok(
    audit.includes(`\`${delta[1]}\`–\`${delta[2]}\``),
    'the audit correction must state the same delta range as ROADMAP.md',
  );
}

console.log('repo-consistency OK — setup coverage, README count, and migration-delta docs match the repo');
