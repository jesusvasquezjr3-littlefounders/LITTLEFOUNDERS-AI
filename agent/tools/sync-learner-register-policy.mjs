#!/usr/bin/env node
// sync-learner-register-policy.mjs — B.23 (S05.3f): one register policy for
// Core, the UI and the Forge gates. Core's file is canonical; the UI and Forge
// read byte-identical generated copies (no shared package exists, by design).
//
//   node agent/tools/sync-learner-register-policy.mjs          regenerate the copies
//   node agent/tools/sync-learner-register-policy.mjs --check  fail on drift (inside spec:check)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const CANONICAL = 'backend/src/services/learnerRegisterPolicy.ts';
export const COPIES = [
  'frontend/src/rebuild/design/learnerRegisterPolicy.generated.ts',
  'coursegen/src/pipeline/learnerRegisterPolicy.generated.ts',
];
const BANNER = `// GENERATED from ${CANONICAL} by agent/tools/sync-learner-register-policy.mjs. Do not edit.\n`;

export function expectedCopy(canonical) {
  return BANNER + canonical;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const canonical = readFileSync(resolve(root, CANONICAL), 'utf8');
  const expected = expectedCopy(canonical);
  if (process.argv.includes('--check')) {
    const drifted = COPIES.filter((copy) => {
      try { return readFileSync(resolve(root, copy), 'utf8') !== expected; } catch { return true; }
    });
    if (drifted.length > 0) {
      console.error(`Learner register policy drift: ${drifted.join(', ')}. Run node agent/tools/sync-learner-register-policy.mjs.`);
      process.exitCode = 1;
    } else {
      console.log(`Learner register policy parity OK (${COPIES.length} copies).`);
    }
  } else {
    for (const copy of COPIES) writeFileSync(resolve(root, copy), expected);
    console.log(`Generated ${COPIES.length} copies of the learner register policy.`);
  }
}
