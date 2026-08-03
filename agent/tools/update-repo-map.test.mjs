// The repo-map generator must be byte-deterministic for a committed tree:
// release-readiness regenerates the map and then requires a clean tree
// (`git:diff-check`), so a wall-clock stamp false-failed the gate on the next
// calendar day, and a plain (non-git-aware) `find` leaked gitignored run
// artifacts — which release-readiness itself creates — into the tracked map.

import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const generator = path.join(root, 'scripts/update-repo-map.sh');
const temp = await mkdtemp(path.join(os.tmpdir(), 'littlefounders-repo-map-'));
const mapPath = path.join(temp, 'repo_map.md');

// A fixed commit date proves the stamp comes from git history, not the clock.
const COMMIT_DATE = '2026-01-15T12:00:00Z';

function git(...args) {
  const result = spawnSync('git', args, {
    cwd: temp,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: COMMIT_DATE,
      GIT_COMMITTER_DATE: COMMIT_DATE,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function runGenerator() {
  return spawnSync('bash', [path.join(temp, 'scripts/update-repo-map.sh')], {
    cwd: temp,
    encoding: 'utf8',
  });
}

try {
  await mkdir(path.join(temp, 'scripts'), { recursive: true });
  await cp(generator, path.join(temp, 'scripts/update-repo-map.sh'));
  await mkdir(path.join(temp, 'backend/src'), { recursive: true });
  await writeFile(path.join(temp, 'backend/src/app.ts'), 'export const app = 1;\n', 'utf8');
  await writeFile(path.join(temp, '.gitignore'), 'runs/\n', 'utf8');
  git('init', '--quiet');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '--quiet', '-m', 'baseline');

  const first = runGenerator();
  assert.equal(first.status, 0, first.stderr);
  const firstMap = await readFile(mapPath, 'utf8');
  assert.match(firstMap, /on 2026-01-15/, 'stamp must be the last commit date, not wall-clock');
  assert.match(firstMap, /### backend\/src\/app\.ts/);

  // Gitignored run artifacts must never enter the map — and therefore can
  // never dirty a committed tree between two release-gate runs.
  await mkdir(path.join(temp, 'runs'), { recursive: true });
  await writeFile(path.join(temp, 'runs/checkpoint.json'), '{}\n', 'utf8');
  const second = runGenerator();
  assert.equal(second.status, 0, second.stderr);
  const secondMap = await readFile(mapPath, 'utf8');
  assert.equal(secondMap, firstMap, 'regenerating on a committed tree must be byte-identical');
  assert.doesNotMatch(secondMap, /checkpoint/, 'gitignored artifacts must not leak into the map');

  // Untracked (not ignored) work-in-progress DOES show up — the §5 gate runs
  // repo:map before new files are committed.
  await writeFile(path.join(temp, 'notes.md'), '# wip\n', 'utf8');
  const third = runGenerator();
  assert.equal(third.status, 0, third.stderr);
  const thirdMap = await readFile(mapPath, 'utf8');
  assert.match(thirdMap, /### notes\.md/);

  console.log('update-repo-map OK — commit-date stamp, git-aware enumeration, byte-deterministic on a committed tree');
} finally {
  await rm(temp, { recursive: true, force: true });
}
