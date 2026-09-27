// OD-23 / OD-28 (owner review D-03): the owner USD-ceiling refusal exists in
// two independent packages. Forge (coursegen) owns it; Echo (audiogen) cannot
// import Forge (no workspaces), so it carries a verbatim copy. This test keeps
// the interface and the function identical, so the two paid entry points can
// never disagree about what counts as an approved ceiling.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const FORGE = 'coursegen/src/pipeline/spendGuard.ts';
const ECHO = 'audiogen/src/spendGuard.ts';

/** The code from `export interface SpendCeilingInput` to the end, whitespace-normalized. */
export function guardCode(source) {
  const start = source.indexOf('export interface SpendCeilingInput');
  assert.ok(start >= 0, 'SpendCeilingInput not found');
  return source
    .slice(start)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .join('\n');
}

test('Echo carries a verbatim copy of Forge\'s spend-ceiling refusal', () => {
  const forge = guardCode(readFileSync(`${repo}${FORGE}`, 'utf8').replace(/\r\n/g, '\n'));
  const echo = guardCode(readFileSync(`${repo}${ECHO}`, 'utf8').replace(/\r\n/g, '\n'));
  assert.equal(echo, forge, `${ECHO} drifted from ${FORGE}: change both copies together`);
});

test('both copies name every paid entry point OD-28 covers', () => {
  for (const file of [FORGE, ECHO]) {
    const source = readFileSync(`${repo}${file}`, 'utf8');
    for (const command of ['generate', 'generate:track', 'images:backfill', 'narrate:all']) {
      assert.match(source, new RegExp(`'${command}'`), `${file} must list ${command}`);
    }
  }
});

test('the comparison notices a drifted copy', () => {
  const forge = readFileSync(`${repo}${FORGE}`, 'utf8');
  const drifted = forge.replace('input.ceilingUsd > 0', 'input.ceilingUsd >= 0');
  assert.notEqual(guardCode(drifted), guardCode(forge));
});
