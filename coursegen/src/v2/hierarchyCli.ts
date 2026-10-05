// v2:hierarchy — generates the Vault hierarchy rows and the reviewable seed SQL
// for a v2 structure file plus its lesson plans. Zero spend, no database access.
//
//   npm run v2:hierarchy                        (the Educación Financiera pilot, writes hierarchy/)
//   npm run v2:hierarchy -- --course <slug>     (curriculum-v2/<slug>/{structure.yaml,plans,hierarchy})
//   npm run v2:hierarchy -- --check             (exits 1 when the written files are stale)
//   npm run v2:hierarchy -- --structure <yaml> --plans <dir> --kc-graph <json> --out <dir>
//
// Outputs in --out: hierarchy.rows.json (rows per table), hierarchy.seed.sql
// (idempotent, ends in ROLLBACK for owner review) and ids.json (lesson slug ->
// public.lessons.id, the file `v2:publish --lesson-ids` reads).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHierarchy, HierarchyError, parseStructure, renderIdsJson, renderRowsJson, renderSql, type KcInfo, type Localized } from './hierarchy.js';
import { loadV2Plans } from './plan.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PILOT_DIR = path.join(PACKAGE_ROOT, 'curriculum-v2', 'financial-education');

export const HIERARCHY_FILES = ['hierarchy.rows.json', 'hierarchy.seed.sql', 'ids.json'] as const;

type Args = Record<string, string | true>;
function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    if (!flag.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[flag.slice(2)] = true;
    else { out[flag.slice(2)] = next; i += 1; }
  }
  return out;
}

export function loadKcInfo(file: string): Record<string, KcInfo> {
  const graph = JSON.parse(readFileSync(file, 'utf8')) as { kcs: Array<{ key: string; objective: Localized }> };
  return Object.fromEntries(graph.kcs.map((kc) => [kc.key, { objective: kc.objective }]));
}

export interface GenerateOptions { structure: string; plans: string; kcGraph: string }

/** The three generated files, keyed by file name. Throws HierarchyError listing every problem. */
export function generate(options: GenerateOptions): Record<(typeof HIERARCHY_FILES)[number], string> {
  const loaded = loadV2Plans(options.plans);
  const broken = loaded.filter((entry) => entry.errors.length);
  if (broken.length) throw new HierarchyError(broken.map((entry) => `${entry.file}: ${entry.errors.join('; ')}`));
  const hierarchy = buildHierarchy({
    structure: parseStructure(readFileSync(options.structure, 'utf8')),
    plans: loaded.map((entry) => entry.plan!),
    kcs: loadKcInfo(options.kcGraph),
  });
  return { 'hierarchy.rows.json': renderRowsJson(hierarchy), 'hierarchy.seed.sql': renderSql(hierarchy), 'ids.json': renderIdsJson(hierarchy) };
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const str = (name: string, fallback: string): string => (typeof args[name] === 'string' ? path.resolve(args[name] as string) : fallback);
  const course = typeof args.course === 'string' ? args.course : undefined;
  const courseDir = course ? path.join(PACKAGE_ROOT, 'curriculum-v2', course) : PILOT_DIR;
  const options: GenerateOptions = {
    structure: str('structure', path.join(courseDir, course ? 'structure.yaml' : 'pilot.structure.yaml')),
    plans: str('plans', path.join(courseDir, 'plans')),
    kcGraph: str('kc-graph', path.resolve(PACKAGE_ROOT, '..', 'database', 'seeds', 'kc_graph.v1.json')),
  };
  const outDir = str('out', path.join(courseDir, 'hierarchy'));
  let files: ReturnType<typeof generate>;
  try {
    files = generate(options);
  } catch (error) {
    if (error instanceof HierarchyError) { console.error(`v2:hierarchy: blocked:\n  ${error.problems.join('\n  ')}`); return 1; }
    throw error;
  }
  if (args.check === true) {
    const stale = HIERARCHY_FILES.filter((name) => !existsSync(path.join(outDir, name)) || readFileSync(path.join(outDir, name), 'utf8') !== files[name]);
    if (stale.length) { console.error(`v2:hierarchy: stale or missing in ${outDir}: ${stale.join(', ')}; rerun \`npm run v2:hierarchy\``); return 1; }
    console.log(`v2:hierarchy: ${HIERARCHY_FILES.length} file(s) in ${outDir} are current`);
    return 0;
  }
  mkdirSync(outDir, { recursive: true });
  for (const name of HIERARCHY_FILES) writeFileSync(path.join(outDir, name), files[name]);
  const ids = JSON.parse(files['ids.json']) as Record<string, string>;
  console.log(`v2:hierarchy: ${Object.keys(ids).length} lesson(s) -> ${outDir} (${HIERARCHY_FILES.join(', ')}); the SQL ends in ROLLBACK and was not run`);
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
