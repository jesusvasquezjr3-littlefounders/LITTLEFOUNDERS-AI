#!/usr/bin/env node
// contract:check — the no-workspaces parity gate for `gamegen/src/contract/`.
//
// CLAUDE.md §1.2 pins "10 independent npm packages — no workspaces", so Arcade cannot
// import `frontend/src/game-engine` directly. But the `simulate` stage IS the
// winnability gate (GAME_ENGINE.md §9): it bot-plays a freshly authored document with
// the mechanic's REAL simulator — perfect bot must reach `scoring.pass_score`, random
// bot must not — and a gate that runs a stale fork of the simulator proves nothing
// about the game a child will actually load. So the pure simulation modules are COPIED
// here, and a copy drifts.
//
// WHY DRIFT IS SILENT AND EXPENSIVE (the lesson coursegen/AGENTS.md records): Zod
// STRIPS unknown keys by default. A field the frontend adds and this copy lacks is not
// rejected on the way in — it is silently DELETED. The gate then bot-plays a document
// missing exactly the field the mechanic depends on, scores it, publishes it, and the
// real player gets a game that cannot be won. Nothing logs an error anywhere. That is
// how coursegen once shipped lessons with no images. This script is the only thing
// standing between that and a paid generation run.
//
// Modeled on `coursegen/src/contract/check.ts` (same normalize regex, so an import
// rewritten to NodeNext `.js` form is not drift) and on `backend/scripts/
// game-contract-check.ts`, which gates the same copy on the reward-replay side.
//
// THREE MODES:
//  1. FULL FILE — every module that is a verbatim copy save for import specifiers.
//     Normalizing strips import statements (single- AND multi-line), then all
//     whitespace and semicolons, then compares.
//  2. SYMBOL — for the files that are DELIBERATELY partial copies:
//       core/types.ts      omits `MechanicViewProps` + `MechanicSlice` (React).
//       core/characters.ts copies only the closed id set out of the character rig.
//       core/schema.ts     omits `parseGameDocument` (async, registry-driven) — see
//                          mode 3, which covers it rather than exempting it.
//     Each symbol list is DERIVED from the frontend file and the exclusions
//     subtracted, so a symbol added upstream and never copied here fails the gate
//     instead of passing unnoticed. Non-exported top-level helpers are included:
//     `crossFieldIssues` is where the sprite-slot, category-reference and duplicate-id
//     rules live, and it is not exported from either side.
//  3. SUBSTITUTION — `parseGameDocument` (frontend, async) vs `parseGameDocumentSync`
//     (here). Arcade holds every mechanic eagerly, so it must not await a chunk
//     loader; that is a legitimate signature difference and NOT a licence for the
//     composition logic to diverge. The gate applies exactly three declared textual
//     substitutions to the frontend original and then diffs the normalized bodies, so
//     any other change — a reordered check, a dropped cross-field call, a different
//     document assembly — still fails.
//
// Run: `npx tsx src/contract/check.ts` from `gamegen/` (wire it into `npm test` as
// `contract:check`, the way backend and coursegen do).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
// gamegen/src/contract/check.ts -> repo root is 3 levels up.
const REPO_ROOT = path.resolve(here, '../../..');
const ENGINE_ROOT = path.join(REPO_ROOT, 'frontend/src/game-engine');
const CONTRACT_ROOT = path.join(REPO_ROOT, 'gamegen/src/contract');
const RIG_TYPES = path.join(REPO_ROOT, 'frontend/src/components/characters/control/types.ts');

const MECHANICS = [
  'sorter',
  'launcher',
  'runner',
  'stacker',
  'autobattler',
  'explorer',
  'defender',
  'flyer',
] as const;

/** Every module copied verbatim. Add a mechanic's two files here when its slice lands. */
const FULL_FILE_PAIRS: string[] = [
  'core/schemaBase.ts',
  'core/rng.ts',
  'core/mathd.ts',
  'core/scoring.ts',
  'core/replay.ts',
  ...MECHANICS.flatMap((mechanic) => [
    `mechanics/${mechanic}/schema.ts`,
    `mechanics/${mechanic}/simulate.ts`,
  ]),
];

/** Rendering-only symbols that must NEVER reach a generation service's core/types.ts. */
const TYPES_EXCLUDED = ['MechanicViewProps', 'MechanicSlice'];

/** The only symbols lifted out of the character rig (see core/characters.ts). */
const CHARACTER_SYMBOLS = ['CHARACTER_IDS', 'CharacterId'];

/** Covered by mode 3 instead of copied verbatim (see the header). */
const SCHEMA_EXCLUDED = ['parseGameDocument'];

/**
 * The ONLY sanctioned differences between the frontend's `parseGameDocument` and this
 * copy's `parseGameDocumentSync`. Applied to the frontend source before the diff.
 * Every entry must still be FOUND in the frontend original — if one stops matching
 * (an upstream rename, a switch away from `loadMechanic`) the gate fails loudly rather
 * than quietly comparing nothing.
 */
const SYNC_SUBSTITUTIONS: ReadonlyArray<readonly [string, string]> = [
  ['export async function parseGameDocument(', 'export function parseGameDocumentSync('],
  ['Promise<GameDocumentParse>', 'GameDocumentParse'],
  ['await loadMechanic(', 'getMechanic('],
];

/**
 * Strips `import ... from '...'` statements (single- or multi-line), then all
 * whitespace and semicolons. Import specifiers legitimately differ between the two
 * copies — the frontend uses the `@/` alias with no extension, gamegen NodeNext with
 * an explicit `.js` — and formatting is not drift either.
 */
function normalize(source: string): string {
  const noImports = source.replace(/^import\s[\s\S]*?from\s+['"][^'"]*['"];?\s*$/gm, '');
  return noImports.replace(/\s+/g, '').replace(/;/g, '');
}

/**
 * A top-level declaration. `export` is OPTIONAL on purpose: `core/schema.ts` keeps its
 * load-bearing rules (`crossFieldIssues`, `peekMechanic`, `formatIssues`) module-private
 * on both sides, and a gate that only saw exports would let all three drift freely.
 */
const DECLARATION =
  /^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:const|let|var|type|interface|function|class)\s+([A-Za-z0-9_$]+)\b/;

/** Every top-level declared symbol name, in file order. */
function declaredSymbols(source: string): string[] {
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
 * The full declaration block for `name`: from its declaration line until the bracket
 * depth is back to zero AND the next line is not an indented continuation. These files
 * are prettier-formatted with top-level declarations at column 0, so "depth 0 and the
 * next line starts at column 0 or is blank" is the end of the declaration. The
 * continuation clause is what keeps a multi-line union alias
 * (`export type GameDocumentParse =` / `  | { … }` / `  | { … }`, which balances on
 * every line) from being truncated to its first line on both sides — which would
 * compare nothing at all.
 */
function extractSymbol(source: string, name: string): string | null {
  const lines = source.split('\n');
  const start = new RegExp(
    `^(?:export\\s+)?(?:declare\\s+)?(?:async\\s+)?(?:const|let|var|type|interface|function|class)\\s+${name}\\b`,
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
      if (depth > 0) continue;
      const next = lines[j + 1];
      // Blank line, end of file, or a new column-0 statement closes the block; an
      // indented line continues it.
      if (next === undefined || next.trim() === '' || !/^\s/.test(next)) break;
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
    fail(`contract:check ERROR — could not read ${relative}: ${(error as Error).message}`);
    continue;
  }
  if (copy !== original) {
    fail(`contract:check DRIFT — ${relative} differs from the frontend original`);
    console.error(`  gamegen:  ${copyPath}`);
    console.error(`  frontend: ${originalPath}`);
  }
}

// ---- Mode 2: symbol parity -----------------------------------------------------

function checkSymbols(
  label: string,
  originalPath: string,
  copyPath: string,
  symbols: readonly string[],
): number {
  let original: string;
  let copy: string;
  try {
    original = readFileSync(originalPath, 'utf8');
    copy = readFileSync(copyPath, 'utf8');
  } catch (error) {
    fail(`contract:check ERROR — could not read ${label}: ${(error as Error).message}`);
    return 0;
  }
  for (const symbol of symbols) {
    const a = extractSymbol(original, symbol);
    const b = extractSymbol(copy, symbol);
    if (a === null || b === null) {
      fail(
        `contract:check DRIFT — ${label}: symbol "${symbol}" is missing from the ${a === null ? 'frontend original' : 'gamegen copy'}`,
      );
      continue;
    }
    if (normalize(a) !== normalize(b)) {
      fail(`contract:check DRIFT — ${label}: symbol "${symbol}" differs from the frontend original`);
      console.error(`  frontend: ${a}`);
      console.error(`  gamegen:  ${b}`);
    }
  }
  return symbols.length;
}

/**
 * Symbol list for a partial copy: everything the frontend declares, minus the
 * exclusions. Verifying each exclusion still EXISTS upstream is the point — an
 * exclusion list is only sound while the symbol it names is still there; if one was
 * renamed or removed, the list must be re-derived rather than quietly widening the
 * gate.
 */
function requiredSymbols(label: string, originalPath: string, excluded: readonly string[]): string[] {
  const declared = declaredSymbols(readFileSync(originalPath, 'utf8'));
  for (const name of excluded) {
    if (!declared.includes(name)) {
      fail(
        `contract:check ERROR — ${label}: excluded symbol "${name}" no longer exists in ${originalPath}; re-derive the exclusion list`,
      );
    }
  }
  return declared.filter((name) => !excluded.includes(name));
}

const engineTypesPath = path.join(ENGINE_ROOT, 'core/types.ts');
const engineSchemaPath = path.join(ENGINE_ROOT, 'core/schema.ts');

let typesSymbolCount = 0;
let schemaSymbolCount = 0;
try {
  typesSymbolCount = checkSymbols(
    'core/types.ts',
    engineTypesPath,
    path.join(CONTRACT_ROOT, 'core/types.ts'),
    requiredSymbols('core/types.ts', engineTypesPath, TYPES_EXCLUDED),
  );
  schemaSymbolCount = checkSymbols(
    'core/schema.ts',
    engineSchemaPath,
    path.join(CONTRACT_ROOT, 'core/schema.ts'),
    requiredSymbols('core/schema.ts', engineSchemaPath, SCHEMA_EXCLUDED),
  );
} catch (error) {
  fail(`contract:check ERROR — could not derive a symbol list: ${(error as Error).message}`);
}

const characterSymbolCount = checkSymbols(
  'core/characters.ts',
  RIG_TYPES,
  path.join(CONTRACT_ROOT, 'core/characters.ts'),
  CHARACTER_SYMBOLS,
);

// ---- Mode 3: the one sanctioned divergence -------------------------------------

function checkSyncParse(): void {
  let original: string;
  let copy: string;
  try {
    original = readFileSync(engineSchemaPath, 'utf8');
    copy = readFileSync(path.join(CONTRACT_ROOT, 'core/schema.ts'), 'utf8');
  } catch (error) {
    fail(`contract:check ERROR — could not read core/schema.ts: ${(error as Error).message}`);
    return;
  }
  const asyncBlock = extractSymbol(original, 'parseGameDocument');
  const syncBlock = extractSymbol(copy, 'parseGameDocumentSync');
  if (asyncBlock === null || syncBlock === null) {
    fail(
      `contract:check DRIFT — core/schema.ts: ${asyncBlock === null ? 'parseGameDocument is missing from the frontend original' : 'parseGameDocumentSync is missing from the gamegen copy'}`,
    );
    return;
  }
  let translated = asyncBlock;
  for (const [from, to] of SYNC_SUBSTITUTIONS) {
    if (!translated.includes(from)) {
      fail(
        `contract:check ERROR — core/schema.ts: the declared substitution ${JSON.stringify(from)} no longer appears in the frontend's parseGameDocument; re-derive SYNC_SUBSTITUTIONS`,
      );
      return;
    }
    translated = translated.split(from).join(to);
  }
  if (normalize(translated) !== normalize(syncBlock)) {
    fail(
      'contract:check DRIFT — core/schema.ts: parseGameDocumentSync no longer matches the frontend parseGameDocument under the declared substitutions',
    );
    console.error(`  frontend (translated): ${translated}`);
    console.error(`  gamegen:               ${syncBlock}`);
  }
}

checkSyncParse();

// ---- Result --------------------------------------------------------------------

if (failed) {
  console.error(
    '\ncontract:check FAILED — gamegen/src/contract has drifted from ' +
      'frontend/src/game-engine. Re-copy the frontend files (adjust ONLY the import ' +
      'specifiers to NodeNext .js form) and re-run.',
  );
  process.exit(1);
}

console.log(
  `contract:check OK — ${FULL_FILE_PAIRS.length} files + ${typesSymbolCount} core/types.ts symbols + ` +
    `${schemaSymbolCount} core/schema.ts symbols + ${characterSymbolCount} character symbols + ` +
    '1 substituted function match frontend/src/game-engine',
);
