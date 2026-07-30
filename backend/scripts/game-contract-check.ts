#!/usr/bin/env -S npx tsx
// game-contract:check — the no-workspaces parity gate for backend/src/game-contract/
// (CLAUDE.md §1.2: "10 independent npm packages — no workspaces", so Core cannot
// import frontend/src/game-engine directly). Core derives a game's reward by
// REPLAYING the player's input log through the same pure simulation code the browser
// ran, so the modules are COPIED here — and a copy drifts.
//
// WHY DRIFT IS SILENT AND EXPENSIVE (the lesson coursegen/src/contract/AGENTS.md
// records): Zod STRIPS unknown keys by default, so a field the frontend added and
// this copy lacks is not rejected on the way in — it is silently DELETED. The
// simulator then replays a document that is missing exactly the field the player's
// session depended on, derives a lower score than the child earned, and Core rejects
// or under-pays an honest attempt. Nothing logs an error anywhere. This script is the
// only thing standing between that and production.
//
// Modeled on coursegen/src/contract/check.ts (same normalize regex, so a multi-line
// import rewritten to NodeNext `.js` form is not drift) and on this repo's sibling
// scripts/contract-check.ts (same two comparison modes).
//
// TWO MODES:
//  1. FULL FILE — every module that is a verbatim copy save for import specifiers.
//     Normalizing strips import statements (single- AND multi-line), then all
//     whitespace and semicolons, then compares.
//  2. SYMBOL — for the two files that are DELIBERATELY partial copies:
//       core/types.ts      omits `MechanicViewProps` + `MechanicSlice` (React).
//       core/characters.ts copies only the closed id set out of the character rig.
//     The types.ts symbol list is DERIVED from the frontend file and the exclusions
//     subtracted, so a symbol added upstream and never copied here fails the gate
//     instead of passing unnoticed.
//
// Run: `npm run game-contract:check` (also runs inside `npm test` and
// `npm run contract:check`).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_ROOT = path.resolve(here, '../src/game-contract');
const ENGINE_ROOT = path.resolve(here, '../../frontend/src/game-engine');
const RIG_TYPES = path.resolve(here, '../../frontend/src/components/characters/control/types.ts');

/** Every module copied verbatim. Add a mechanic's two files here when its slice lands. */
const FULL_FILE_PAIRS = [
  'core/schemaBase.ts',
  'core/rng.ts',
  'core/mathd.ts',
  'core/scoring.ts',
  'core/replay.ts',
  'mechanics/sorter/schema.ts',
  'mechanics/sorter/simulate.ts',
  'mechanics/runner/schema.ts',
  'mechanics/runner/simulate.ts',
  'mechanics/launcher/schema.ts',
  'mechanics/launcher/simulate.ts',
  'mechanics/stacker/schema.ts',
  'mechanics/stacker/simulate.ts',
  'mechanics/defender/schema.ts',
  'mechanics/defender/simulate.ts',
];

/** Rendering-only symbols that must NEVER reach the backend copy of core/types.ts. */
const TYPES_EXCLUDED = ['MechanicViewProps', 'MechanicSlice'];

/** The only symbols lifted out of the character rig (see core/characters.ts). */
const CHARACTER_SYMBOLS = ['CHARACTER_IDS', 'CharacterId'];

/**
 * Strips `import ... from '...'` statements (single- or multi-line), then all
 * whitespace and semicolons. Import specifiers legitimately differ between the two
 * copies — the frontend uses the `@/` alias with no extension, the backend NodeNext
 * with an explicit `.js` — and formatting is not drift either.
 */
function normalize(source: string): string {
  const noImports = source.replace(/^import\s[\s\S]*?from\s+['"][^'"]*['"];?\s*$/gm, '');
  return noImports.replace(/\s+/g, '').replace(/;/g, '');
}

const DECLARATION = /^export\s+(?:declare\s+)?(?:const|let|var|type|interface|function|class)\s+([A-Za-z0-9_$]+)\b/;

/** Every top-level exported symbol name, in file order. */
function exportedSymbols(source: string): string[] {
  const names: string[] = [];
  for (const line of source.split('\n')) {
    const match = DECLARATION.exec(line);
    if (match !== null && match[1] !== undefined) names.push(match[1]);
  }
  return names;
}

/** Net bracket delta of one line, counting `([{` and `)]}` with a single depth. */
function bracketDelta(line: string): number {
  let delta = 0;
  for (const character of line) {
    if (character === '(' || character === '[' || character === '{') delta += 1;
    else if (character === ')' || character === ']' || character === '}') delta -= 1;
  }
  return delta;
}

/**
 * The full declaration block for `name`: from its `export …` line until the bracket
 * depth returns to zero. These files are prettier-formatted with top-level
 * declarations at column 0, so depth tracking terminates on the closing `}`/`]` of
 * the declaration itself; a single-line declaration balances on its own line.
 */
function extractSymbol(source: string, name: string): string | null {
  const lines = source.split('\n');
  const start = new RegExp(
    `^export\\s+(?:declare\\s+)?(?:const|let|var|type|interface|function|class)\\s+${name}\\b`,
  );
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined || !start.test(line)) continue;
    let depth = 0;
    const block: string[] = [];
    for (let j = i; j < lines.length; j += 1) {
      const current = lines[j];
      if (current === undefined) break;
      block.push(current);
      depth += bracketDelta(current);
      if (depth <= 0) break;
    }
    return block.join('\n');
  }
  return null;
}

let failed = false;

function fail(message: string): void {
  failed = true;
  console.error(message);
}

// ---- Mode 1: full-file parity --------------------------------------------------

for (const relative of FULL_FILE_PAIRS) {
  const copyPath = path.join(CONTRACT_ROOT, relative);
  const originalPath = path.join(ENGINE_ROOT, relative);
  let copy: string;
  let original: string;
  try {
    copy = normalize(readFileSync(copyPath, 'utf8'));
    original = normalize(readFileSync(originalPath, 'utf8'));
  } catch (error) {
    fail(`game-contract:check ERROR — could not read ${relative}: ${(error as Error).message}`);
    continue;
  }
  if (copy !== original) {
    fail(`game-contract:check DRIFT — ${relative} differs from the frontend original`);
    console.error(`  backend:  ${copyPath}`);
    console.error(`  frontend: ${originalPath}`);
  }
}

// ---- Mode 2: symbol parity -----------------------------------------------------

function checkSymbols(label: string, originalPath: string, copyPath: string, symbols: string[]): number {
  let original: string;
  let copy: string;
  try {
    original = readFileSync(originalPath, 'utf8');
    copy = readFileSync(copyPath, 'utf8');
  } catch (error) {
    fail(`game-contract:check ERROR — could not read ${label}: ${(error as Error).message}`);
    return 0;
  }
  for (const symbol of symbols) {
    const a = extractSymbol(original, symbol);
    const b = extractSymbol(copy, symbol);
    if (a === null || b === null) {
      fail(
        `game-contract:check DRIFT — ${label}: symbol "${symbol}" is missing from the ${a === null ? 'frontend original' : 'backend copy'}`,
      );
      continue;
    }
    if (normalize(a) !== normalize(b)) {
      fail(`game-contract:check DRIFT — ${label}: symbol "${symbol}" differs from the frontend original`);
      console.error(`  frontend: ${a}`);
      console.error(`  backend:  ${b}`);
    }
  }
  return symbols.length;
}

const engineTypesPath = path.join(ENGINE_ROOT, 'core/types.ts');
let typesSymbolCount = 0;
try {
  const declared = exportedSymbols(readFileSync(engineTypesPath, 'utf8'));
  for (const excluded of TYPES_EXCLUDED) {
    if (!declared.includes(excluded)) {
      // The exclusion list is only sound while the symbol it names still exists
      // upstream. If it was renamed or removed, re-derive the list rather than
      // quietly widening the gate.
      fail(
        `game-contract:check ERROR — excluded symbol "${excluded}" no longer exists in ${engineTypesPath}; update TYPES_EXCLUDED`,
      );
    }
  }
  const required = declared.filter((name) => !TYPES_EXCLUDED.includes(name));
  typesSymbolCount = checkSymbols(
    'core/types.ts',
    engineTypesPath,
    path.join(CONTRACT_ROOT, 'core/types.ts'),
    required,
  );
} catch (error) {
  fail(`game-contract:check ERROR — could not read ${engineTypesPath}: ${(error as Error).message}`);
}

const characterSymbolCount = checkSymbols(
  'core/characters.ts',
  RIG_TYPES,
  path.join(CONTRACT_ROOT, 'core/characters.ts'),
  CHARACTER_SYMBOLS,
);

if (failed) {
  console.error(
    '\ngame-contract:check FAILED — backend/src/game-contract has drifted from ' +
      'frontend/src/game-engine. Re-copy the frontend files (adjust ONLY the import ' +
      'specifiers to NodeNext .js form) and re-run.',
  );
  process.exit(1);
}

console.log(
  `game-contract:check OK — ${FULL_FILE_PAIRS.length} files + ${typesSymbolCount} core/types.ts symbols + ${characterSymbolCount} character symbols match frontend/src/game-engine`,
);
