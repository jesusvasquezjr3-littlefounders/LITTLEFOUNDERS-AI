import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tool = resolve(here, 'sync-v2-answer-shapes.mjs');
const canonical = resolve(here, '../../backend/src/services/v2AnswerShapes.ts');
const browserCopy = 'frontend/src/rebuild/learning/v2AnswerShapes.generated.ts';
const forgeCopy = 'coursegen/src/v2/v2AnswerShapes.generated.ts';

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'answer-shapes-sync-'));
  for (const [from, to] of [[tool, 'agent/tools/sync-v2-answer-shapes.mjs'], [canonical, 'backend/src/services/v2AnswerShapes.ts']]) {
    mkdirSync(dirname(join(root, to)), { recursive: true });
    copyFileSync(from, join(root, to));
  }
  for (const copy of [browserCopy, forgeCopy]) mkdirSync(dirname(join(root, copy)), { recursive: true });
  return root;
}

const run = (root, ...args) => spawnSync(process.execPath, [join(root, 'agent/tools/sync-v2-answer-shapes.mjs'), ...args], { encoding: 'utf8' });

test('check fails while the copies are missing, generation fixes it, and drift is named', () => {
  const root = sandbox();
  try {
    assert.equal(run(root, '--check').status, 1);
    assert.equal(run(root).status, 0);
    for (const copy of [browserCopy, forgeCopy]) assert.equal(readFileSync(join(root, copy), 'utf8'), readFileSync(canonical, 'utf8'));
    const clean = run(root, '--check');
    assert.equal(clean.status, 0);
    assert.match(clean.stdout, /parity OK \(browser, Forge\)/);
    writeFileSync(join(root, forgeCopy), `${readFileSync(canonical, 'utf8')}\n// drift\n`);
    const drift = run(root, '--check');
    assert.equal(drift.status, 1);
    assert.match(drift.stderr, /drift \(Forge\)/);
    assert.doesNotMatch(drift.stderr, /browser/);
    assert.equal(run(root).status, 0);
    assert.equal(run(root, '--check').status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the committed copies match the canonical Core module', () => {
  const live = spawnSync(process.execPath, [tool, '--check'], { encoding: 'utf8' });
  assert.equal(live.status, 0, live.stderr);
});
