import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * BUD-1: every pack's generated contract, scorer and model code once shipped inside the lesson player chunk, about 100 KB gzip
 * that no per-board budget sees. A pack now reaches the player only through the thin `capabilities.ts` and `boards.tsx` (lazy
 * handles); its `index.ts` and generated files load on demand, through a dynamic import in `horizonte/contract.ts`. This walks
 * the static import graph the way the bundler does and fails when a pack's heavy code is statically reachable from the player.
 * The post-build size gate (scripts/check-lesson-layer-budget.mjs) measures the same thing from the other side.
 */
const src = resolve(__dirname, '../../..');
const horizonteDir = resolve(src, 'rebuild/learning/horizonte');

/** The module specifiers a source file imports at load time: not `import type`, not `import()`, not a comment. */
function staticImports(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const found: string[] = [];
  const pattern = /(?:^|[\n;])\s*(?:import|export)\s+(?!type\b)(?:[\w*${}\s,]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of code.matchAll(pattern)) found.push(match[1]!);
  return found;
}

function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? resolve(src, specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function eagerClosure(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = entries.map((entry) => resolve(src, entry));
  for (let file = queue.pop(); file; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of staticImports(readFileSync(file, 'utf8'))) {
      const next = resolveModule(file, specifier);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

const packDirs = readdirSync(horizonteDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(resolve(horizonteDir, entry.name, 'contract.generated.ts')))
  .map((entry) => entry.name);
const THIN = new Set(['capabilities.ts', 'boards.tsx']);

describe('staticImports', () => {
  it('reads value imports and re-exports, across lines', () => {
    expect(staticImports("import { a } from './a';\nimport b from '../b';\nexport * from './c';\nexport { d } from './d';\nimport './e.css';")).toEqual(['./a', '../b', './c', './d', './e.css']);
    expect(staticImports("import {\n  a,\n  b as c,\n} from './multi';")).toEqual(['./multi']);
  });

  it('skips type imports, dynamic imports and commented imports', () => {
    expect(staticImports("import type { A } from './a';\nexport type { B } from './b';\nconst x = import('./lazy');\nconst y = async () => (await import('./lazy2')).z;")).toEqual([]);
    expect(staticImports("// import { a } from './a';\n/* import { b } from './b'; */\nconst u = 'https://example.com/x';")).toEqual([]);
  });
});

describe('the lesson player never statically reaches a pack beyond its capability table and lazy board handles', () => {
  const closure = eagerClosure([
    'routes/app/learn/LessonRoute.tsx',
    'rebuild/learning/LessonLayer.tsx',
    'rebuild/learning/LessonDocumentView.tsx',
    'rebuild/learning/AuthenticatedLessonDocument.tsx',
    'rebuild/learning/lessonDocument.ts',
    'rebuild/learning/clientScorerVerdict.ts',
    'rebuild/learning/horizonte/registry.tsx',
    'rebuild/staff/console/StaffLessonPreview.tsx',
  ]);
  const files = [...closure].map((file) => relative(horizonteDir, file).replace(/\\/g, '/'));

  it('walks the real graph, and finds the thin tables and nothing heavier', () => {
    expect(packDirs.length).toBeGreaterThanOrEqual(18);
    expect(files).toContain('contract.ts');
    for (const pack of packDirs) {
      expect(files, `${pack}: the capability table is part of the player`).toContain(`${pack}/capabilities.ts`);
    }
  });

  it('keeps every pack\'s index, contract, scorer, model and fixtures out of the static graph', () => {
    const heavy = files.filter((file) => {
      const [folder, name] = file.split('/');
      return (packDirs.includes(folder!) && name !== undefined && !THIN.has(name)) || file === 'fixtures.ts' || file === 'previewDocument.ts';
    });
    expect(heavy, 'load these through loadHorizontePacks (horizonte/contract.ts), never with a static import').toEqual([]);
  });
});
