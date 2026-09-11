// Pins the claims the README and setup script make about the repo to what
// the repo actually contains. These drifted silently at least once:
// setup-dev.sh installed 8 of 10 packages while the README promised "all"
// of them.

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

console.log('repo-consistency OK — setup coverage and README count match the repo');
