import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const script = path.join(root, 'agent/tools/check-clean-tree.sh');
const temp = await mkdtemp(path.join(os.tmpdir(), 'littlefounders-clean-tree-'));

function git(...args) {
  const result = spawnSync('git', args, { cwd: temp, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function runGate() {
  return spawnSync('bash', [script], { cwd: temp, encoding: 'utf8' });
}

try {
  git('init', '--quiet');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  await writeFile(path.join(temp, 'repo_map.md'), 'services: 9\n', 'utf8');
  git('add', 'repo_map.md');
  git('commit', '--quiet', '-m', 'baseline');

  const clean = runGate();
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /git:diff-check OK/);

  // A pure content change with no whitespace error — exactly what a stale
  // regenerated repo_map.md looks like, and what `git diff --check` (the
  // previous implementation) could never detect.
  await writeFile(path.join(temp, 'repo_map.md'), 'services: 10\n', 'utf8');
  const dirty = runGate();
  assert.equal(dirty.status, 1, 'a modified tracked file must fail the gate');
  assert.match(dirty.stderr, /git:diff-check FAILED/);
  assert.match(dirty.stderr, /repo_map\.md/);

  // Staging the change must not silence the gate.
  git('add', 'repo_map.md');
  const staged = runGate();
  assert.equal(staged.status, 1, 'a staged change must fail the gate');
  assert.match(staged.stderr, /git:diff-check FAILED/);

  git('commit', '--quiet', '-m', 'regenerated');
  const cleanAgain = runGate();
  assert.equal(cleanAgain.status, 0, cleanAgain.stderr);

  // Untracked (non-gitignored) files are uncommitted work — agent/README.md
  // promises "uncommitted work stops the gate", and an earlier revision let
  // untracked files sail through.
  await writeFile(path.join(temp, 'notes.txt'), 'scratch\n', 'utf8');
  const untracked = runGate();
  assert.equal(untracked.status, 1, 'an untracked file must fail the gate');
  assert.match(untracked.stderr, /git:diff-check FAILED/);
  assert.match(untracked.stderr, /notes\.txt/);
  await rm(path.join(temp, 'notes.txt'));

  // Gitignored artifacts (exactly what release-readiness itself creates,
  // e.g. generation runs/) must NOT trip the gate.
  await writeFile(path.join(temp, '.gitignore'), 'runs/\n', 'utf8');
  git('add', '.gitignore');
  git('commit', '--quiet', '-m', 'ignore runs');
  await mkdir(path.join(temp, 'runs'), { recursive: true });
  await writeFile(path.join(temp, 'runs', 'artifact.json'), '{}\n', 'utf8');
  const ignored = runGate();
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.match(ignored.stdout, /git:diff-check OK/);

  console.log('check-clean-tree OK — content changes and untracked files fail the gate; gitignored artifacts do not');
} finally {
  await rm(temp, { recursive: true, force: true });
}
