#!/usr/bin/env node
// Current lesson wire parity: Core, browser and Forge independently carry
// the v2 capabilities, canonical visual scorer, payloads and fixture catalogue.
// The removed v1 browser engine is no longer a contract participant. Forge's
// remaining v1 schemas support offline legacy-catalog checks only; generation
// and publication use the canonical v2 pipeline.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const checks = [
  ['check-v2-lesson-capability-parity.mjs'],
  ['sync-v2-visual-scorer.mjs', '--check'],
  ['sync-v2-growth-comparison.mjs', '--check'],
  ['sync-v2-tax-bracket.mjs', '--check'],
  ['sync-v2-segment-families.mjs', '--check'],
  ['sync-v2-answer-shapes.mjs', '--check'],
  ['sync-v2-scorer-payload.mjs', '--check'],
  ['sync-v2-chart-model.mjs', '--check'],
  ['sync-v2-concept-boards.mjs', '--check'],
  ['sync-v2-preview-fixtures.mjs', '--check'],
] as const;

let failed = false;
for (const [script, ...args] of checks) {
  const result = spawnSync(process.execPath, [path.join(repo, 'agent/tools', script), ...args], {
    cwd: repo,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    failed = true;
    console.error(`contract:check failed: ${script}${result.error ? `: ${result.error.message}` : ''}`);
  }
}

if (failed) process.exit(1);
console.log(`contract:check OK — ${checks.length} current v2 source/capability/fixture parity checks (Core, browser, Forge)`);
