#!/usr/bin/env node
// contract:check — the no-workspaces parity gate (task brief §4).
//
// coursegen/src/contract/** is a COPY of frontend/src/lesson-engine's Zod
// contract (schemaBase.ts + schema.ts + the 8 families' schema.ts). Copies
// drift; this script catches it. It normalizes each pair (strip import
// statements, strip all whitespace, strip semicolons — coursegen and
// frontend use different formatting conventions, that's not drift) and
// diffs the result. Any real difference (a field added/removed, a
// min/max/enum changed, a type renamed) fails the gate.
//
// Deliberately NOT diffed: contract/core/types.ts (an intentional MINIMAL
// subset of the frontend original — see that file's header) and
// contract/registry.ts (Forge-only, no frontend counterpart).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// coursegen/src/contract/check.ts -> repo root is 3 levels up.
const REPO_ROOT = path.resolve(__dirname, '../../..');
const FRONTEND_ROOT = path.join(REPO_ROOT, 'frontend/src/lesson-engine');
const CONTRACT_ROOT = path.join(REPO_ROOT, 'coursegen/src/contract');

const FAMILIES = ['story', 'choice', 'input', 'arrange', 'money', 'analyze', 'storyplay', 'maker'] as const;

const PAIRS: Array<{ label: string; original: string; copy: string }> = [
  {
    label: 'core/schemaBase.ts',
    original: path.join(FRONTEND_ROOT, 'core/schemaBase.ts'),
    copy: path.join(CONTRACT_ROOT, 'core/schemaBase.ts'),
  },
  {
    label: 'schema.ts',
    original: path.join(FRONTEND_ROOT, 'schema.ts'),
    copy: path.join(CONTRACT_ROOT, 'schema.ts'),
  },
  ...FAMILIES.map((f) => ({
    label: `families/${f}/schema.ts`,
    original: path.join(FRONTEND_ROOT, `families/${f}/schema.ts`),
    copy: path.join(CONTRACT_ROOT, `families/${f}/schema.ts`),
  })),
];

/** Strips `import ... from '...'` statements (single- or multi-line), then all whitespace and semicolons. */
function normalize(source: string): string {
  const noImports = source.replace(/^import\s[\s\S]*?from\s+['"][^'"]*['"];?\s*$/gm, '');
  return noImports.replace(/\s+/g, '').replace(/;/g, '');
}

function main(): void {
  let drifted = 0;
  let missing = 0;

  for (const pair of PAIRS) {
    let originalRaw: string;
    let copyRaw: string;
    try {
      originalRaw = readFileSync(pair.original, 'utf8');
    } catch {
      console.error(`contract:check MISSING frontend original — ${pair.original}`);
      missing++;
      continue;
    }
    try {
      copyRaw = readFileSync(pair.copy, 'utf8');
    } catch {
      console.error(`contract:check MISSING contract copy — ${pair.copy}`);
      missing++;
      continue;
    }

    const a = normalize(originalRaw);
    const b = normalize(copyRaw);
    if (a !== b) {
      console.error(`contract:check DRIFT — ${pair.label}`);
      console.error(`  frontend: ${pair.original}`);
      console.error(`  copy:     ${pair.copy}`);
      drifted++;
    } else {
      console.log(`contract:check OK — ${pair.label}`);
    }
  }

  if (drifted > 0 || missing > 0) {
    console.error(
      `\ncontract:check FAILED — ${drifted} drifted, ${missing} missing. Re-copy the frontend files into coursegen/src/contract/ (adjust only relative imports to .js NodeNext form).`,
    );
    process.exit(1);
  }
  console.log(`\ncontract:check OK — ${PAIRS.length} files match their frontend originals.`);
}

main();
