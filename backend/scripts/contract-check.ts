#!/usr/bin/env -S npx tsx
// contract:check — the no-workspaces parity gate for backend/src/lesson-contract/
// (AGENTS.md §1.2: "8 independent npm packages — no workspaces" means Core
// cannot import frontend/src/lesson-engine directly, so the pure grading
// modules are COPIED under backend/src/lesson-contract/ instead). This script
// diffs each copy against its frontend original so the two never silently
// drift — run it whenever either side changes.
//
// Two comparison modes:
//  1. Full-file parity (core/scoring.ts, families/*/grade.ts): these are
//     meant to be verbatim copies save for import specifiers (backend's
//     NodeNext ESM requires the `.js` extension the frontend bundler doesn't
//     use). Normalizing strips import lines + whitespace, then compares.
//  2. Symbol parity (core/types.ts): that file is a DELIBERATELY TRIMMED
//     subset of the frontend original (the React/ComponentType registry
//     section is stripped — see the file's header comment), so a full-file
//     diff would always fail. Instead we extract each symbol in the parity
//     contract and diff those individually.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(here, '../src/lesson-contract');
const FRONTEND_ROOT = path.resolve(here, '../../frontend/src/lesson-engine');

/** Strip import lines and normalize whitespace so only real logic is compared. */
function normalize(src: string): string {
  return src
    .split('\n')
    .filter((line) => !line.trim().startsWith('import '))
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const FULL_FILE_PAIRS = [
  'core/scoring.ts',
  'families/choice/grade.ts',
  'families/input/grade.ts',
  'families/arrange/grade.ts',
  'families/money/grade.ts',
  'families/analyze/grade.ts',
  'families/storyplay/grade.ts',
  'families/maker/grade.ts',
];

// core/types.ts parity contract (file header comment there explains the trim).
const TYPES_SYMBOLS = [
  'VerdictTier',
  'Verdict',
  'GradeMeta',
  'Grader',
  'GradeOutcome',
  'FamilyGrader',
  'tierFor',
  'verdictFrom',
];

/** Extract `export type NAME = ...` | `export interface NAME {...}` | `export function NAME(...) {...}` by brace matching. */
function extractSymbol(src: string, name: string): string | null {
  const typeAlias = new RegExp(`export type ${name}\\b[^=\\n]*=[^\\n]*`, 'm');
  const aliasMatch = typeAlias.exec(src);
  if (aliasMatch) return aliasMatch[0];

  const blockStart = new RegExp(`export (?:interface|function) ${name}\\b[^{]*\\{`, 'm');
  const startMatch = blockStart.exec(src);
  if (!startMatch) return null;

  const openBraceIndex = startMatch.index + startMatch[0].length - 1;
  let depth = 0;
  let i = openBraceIndex;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return src.slice(startMatch.index, i);
}

let failed = false;

for (const rel of FULL_FILE_PAIRS) {
  const backendPath = path.join(BACKEND_ROOT, rel);
  const frontendPath = path.join(FRONTEND_ROOT, rel);
  let a: string;
  let b: string;
  try {
    a = normalize(readFileSync(backendPath, 'utf8'));
    b = normalize(readFileSync(frontendPath, 'utf8'));
  } catch (err) {
    failed = true;
    console.error(`contract:check ERROR — could not read ${rel}: ${(err as Error).message}`);
    continue;
  }
  if (a !== b) {
    failed = true;
    console.error(`contract:check DRIFT — ${rel} differs from the frontend original`);
    console.error(`  backend:  ${backendPath}`);
    console.error(`  frontend: ${frontendPath}`);
  }
}

const backendTypesPath = path.join(BACKEND_ROOT, 'core/types.ts');
const frontendTypesPath = path.join(FRONTEND_ROOT, 'core/types.ts');
const backendTypes = readFileSync(backendTypesPath, 'utf8');
const frontendTypes = readFileSync(frontendTypesPath, 'utf8');

for (const symbol of TYPES_SYMBOLS) {
  const a = extractSymbol(backendTypes, symbol);
  const b = extractSymbol(frontendTypes, symbol);
  if (!a || !b) {
    failed = true;
    console.error(`contract:check DRIFT — symbol "${symbol}" not found in ${!a ? 'backend' : 'frontend'} core/types.ts`);
    continue;
  }
  if (normalize(a) !== normalize(b)) {
    failed = true;
    console.error(`contract:check DRIFT — core/types.ts symbol "${symbol}" differs from the frontend original`);
    console.error(`  backend:  ${a}`);
    console.error(`  frontend: ${b}`);
  }
}

if (failed) {
  console.error(
    '\ncontract:check FAILED — backend/src/lesson-contract has drifted from frontend/src/lesson-engine. ' +
      'Re-sync the copies (adjust import paths / trim only) and re-run.',
  );
  process.exit(1);
}

console.log(
  `contract:check OK — ${FULL_FILE_PAIRS.length} files + ${TYPES_SYMBOLS.length} core/types.ts symbols match frontend/src/lesson-engine`,
);
