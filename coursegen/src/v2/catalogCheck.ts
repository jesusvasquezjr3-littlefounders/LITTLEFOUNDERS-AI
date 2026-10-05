// v2:catalog — validates the planning record (`structure.yaml`) of each v2 course
// against the KC graph and the pathway policy BEFORE any lesson is authored.
// Zero spend, offline.
//
//   npm run v2:catalog                      every curriculum-v2/<course>/structure.yaml, plus catalog-wide coverage
//   npm run v2:catalog -- --course <slug>   one course (coverage is skipped: it needs the whole catalog)
//   npm run v2:catalog -- --json <file>     also write the issues and the coverage table
//
// Errors block (exit 1); warnings are for a human to read. The checks are the
// ones a structure can get wrong that a lesson plan cannot show: a KC that does
// not exist, a lesson over the B.17 concept ceiling, a chapter of the wrong
// size, a prerequisite taught after its dependent, and a KC the whole catalog
// never teaches (pathway policy G3).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { CONCEPT_CEILINGS } from '../contentGates/conceptCap.js';
import { V2_AGE_BANDS, V2_ID, V2_SEGMENT_TYPES } from './contract.js';
import { v2WorkingMemoryBand } from './gates.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CATALOG_DIR = path.join(PACKAGE_ROOT, 'curriculum-v2');
export const KC_GRAPH_FILE = path.resolve(PACKAGE_ROOT, '..', 'database', 'seeds', 'kc_graph.v1.json');

/** Courses the catalog covers, in the order a learner meets them (database/seeds/dev_seed.sql positions). */
export const CATALOG_COURSES = ['financial-education', 'entrepreneurship', 'investing', 'first-lemonade-stand'] as const;

/** The two topics the KC graph names and no existing lesson taught (B.6 G3): the catalog must add them. */
export const GAP_KCS = ['money.fraction-of-amount', 'biz.goods-vs-services'] as const;

export const BAND_AGES: Readonly<Record<(typeof V2_AGE_BANDS)[number], readonly [number, number]>> = { '6-9': [6, 9], '10-12': [10, 12], '13-17': [13, 17], adult: [18, 119] };
/** Lowest age at which each KC tier is taught (P1: tier1 6-7, tier2 8-10, tier3 11-12, tier4 12-18). */
const TIER_MIN_AGE: Readonly<Record<number, number>> = { 1: 6, 2: 8, 3: 11, 4: 12 };
const BAND_ORDER: Readonly<Record<(typeof V2_AGE_BANDS)[number], number>> = { '6-9': 0, '10-12': 1, '13-17': 2, adult: 3 };

const localized = z.object({ 'en-US': z.string().trim().min(1), 'es-MX': z.string().trim().min(1), 'pt-BR': z.string().trim().min(1) });
const lessonSchema = z.object({
  lesson_id: z.string().regex(V2_ID),
  eligibility: z.object({ minimum_age: z.number().int().min(6), maximum_age: z.number().int().max(119) }),
  knowledge_components: z.array(z.string()).min(1),
  new_concepts: z.array(z.string()),
  mentor: z.object({ character: z.enum(['rho', 'zara', 'liruf', 'dina']), scene: z.enum(['diorama-a', 'diorama-b']) }).optional(),
  regional: z.enum(['universal', 'scenarios']),
  segment_types: z.array(z.string()).min(1),
}).passthrough();
const structureFileSchema = z.object({
  course_id: z.string().regex(V2_ID),
  pathways: z.array(z.object({
    pathway_id: z.string().regex(V2_ID),
    age_band: z.enum(V2_AGE_BANDS),
    chapters: z.array(z.object({
      chapter_id: z.string().regex(V2_ID),
      title: localized,
      objective: z.string().trim().min(1),
      external_prerequisites: z.array(z.string()).optional(),
      lessons: z.array(lessonSchema),
    }).passthrough()).min(1),
  })).min(1),
}).passthrough();
export type CatalogStructure = z.infer<typeof structureFileSchema>;

export interface KcRecord { key: string; strand: string; tier_min: number }
export interface KcGraphFile { kcs: KcRecord[]; edges: [string, string][] }
export interface CatalogIssue { level: 'error' | 'warning'; where: string; message: string }
export interface CoverageRow { kc: string; strand: string; tier_min: number; taught_in: string[] }

export function loadKcGraph(file = KC_GRAPH_FILE): KcGraphFile {
  return JSON.parse(readFileSync(file, 'utf8')) as KcGraphFile;
}

export function parseCatalogStructure(yamlText: string): { structure?: CatalogStructure; problems: string[] } {
  const parsed = structureFileSchema.safeParse(parseYaml(yamlText));
  if (!parsed.success) return { problems: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`) };
  return { structure: parsed.data, problems: [] };
}

export interface CheckResult { issues: CatalogIssue[]; coverage: CoverageRow[]; lessons: number }

/** Checks every structure against the graph. `coverage: true` also demands that the structures together teach every KC. */
export function checkCatalog(input: { structures: readonly CatalogStructure[]; graph: KcGraphFile; coverage: boolean }): CheckResult {
  const { structures, graph } = input;
  const issues: CatalogIssue[] = [];
  const error = (where: string, message: string): void => { issues.push({ level: 'error', where, message }); };
  const warn = (where: string, message: string): void => { issues.push({ level: 'warning', where, message }); };
  const kcByKey = new Map(graph.kcs.map((kc) => [kc.key, kc]));
  const taughtIn = new Map<string, string[]>();
  const knownTypes = new Set<string>(V2_SEGMENT_TYPES);
  const lessonIds = new Map<string, string>();
  let lessons = 0;

  for (const structure of structures) {
    const course = structure.course_id;
    const chapterIds = new Set<string>();
    const pathwayIds = new Set<string>();
    let previousBand = -1;
    for (const pathway of structure.pathways) {
      const here = `${course}/${pathway.pathway_id}`;
      if (pathwayIds.has(pathway.pathway_id)) error(here, 'pathway_id repeats inside the course');
      pathwayIds.add(pathway.pathway_id);
      const order = BAND_ORDER[pathway.age_band];
      if (order <= previousBand) warn(here, `pathways should run youngest to oldest; ${pathway.age_band} follows an equal or older band`);
      previousBand = Math.max(previousBand, order);
      const [bandMin, bandMax] = BAND_AGES[pathway.age_band];
      const { target, ceiling } = CONCEPT_CEILINGS[v2WorkingMemoryBand(pathway.age_band)];
      const firstTaught = new Map<string, number>();
      let position = 0;

      for (const chapter of pathway.chapters) {
        const where = `${here}/${chapter.chapter_id}`;
        if (chapterIds.has(chapter.chapter_id)) error(where, 'chapter_id repeats inside the course');
        chapterIds.add(chapter.chapter_id);
        if (chapter.lessons.length < 3 || chapter.lessons.length > 6) error(where, `${chapter.lessons.length} lesson(s): a chapter holds 3 to 6`);
        for (const key of chapter.external_prerequisites ?? []) if (!kcByKey.has(key)) error(where, `external prerequisite ${key} is not in the KC graph`);

        for (const lesson of chapter.lessons) {
          lessons += 1;
          position += 1;
          const at = `${where}/${lesson.lesson_id}`;
          const previous = lessonIds.get(lesson.lesson_id);
          if (previous) error(at, `lesson_id repeats ${previous}`);
          lessonIds.set(lesson.lesson_id, at);

          const { minimum_age: lo, maximum_age: hi } = lesson.eligibility;
          if (lo > hi) error(at, `eligibility ${lo}-${hi} is reversed`);
          if (lo < bandMin || hi > bandMax) error(at, `eligibility ${lo}-${hi} falls outside the ${pathway.age_band} band (${bandMin}-${bandMax})`);

          const keys = lesson.knowledge_components;
          if (new Set(keys).size !== keys.length) error(at, 'knowledge_components repeats a key');
          for (const key of keys) if (!kcByKey.has(key)) error(at, `knowledge component ${key} is not in the KC graph`);
          const unique = new Set(lesson.new_concepts);
          if (unique.size !== lesson.new_concepts.length) error(at, 'new_concepts repeats a key');
          for (const key of lesson.new_concepts) if (!keys.includes(key)) error(at, `new concept ${key} is not among the lesson's knowledge_components`);
          if (lesson.new_concepts.length > ceiling) error(at, `${lesson.new_concepts.length} new concepts, over the ${pathway.age_band} ceiling of ${ceiling} (B.17)`);
          else if (lesson.new_concepts.length > target) warn(at, `${lesson.new_concepts.length} new concepts, above the ${pathway.age_band} target of ${target}`);
          if (lesson.new_concepts.length > 0 && !lesson.new_concepts.includes(keys[0]!)) warn(at, 'the primary (first) knowledge component is not a new concept; a review lesson should say so in its title');
          if (lesson.new_concepts.length === 0) warn(at, 'declares no new concept (a pure practice lesson); the course needs few of these');

          for (const key of lesson.new_concepts) {
            const kc = kcByKey.get(key);
            if (!kc) continue;
            taughtIn.set(key, [...(taughtIn.get(key) ?? []), at]);
            if (!firstTaught.has(key)) firstTaught.set(key, position);
            const floor = TIER_MIN_AGE[kc.tier_min] ?? 6;
            if (hi < floor) warn(at, `${key} is tier ${kc.tier_min} (from age ${floor}) and this lesson ends at ${hi}`);
          }

          if (lesson.mentor?.character === 'liruf' && lo >= 13) warn(at, 'Liruf is the youngest voice; a 13+ lesson should use rho, zara or dina (register: childish-framing is forbidden)');
          for (const type of lesson.segment_types) if (!knownTypes.has(type)) error(at, `segment type ${type} is not a registered v2 type`);
        }
      }

      // Prerequisite order inside one pathway: a KC taught for the first time before its prerequisite is a warning (a prerequisite may sit in a younger pathway or another course).
      for (const [from, to] of graph.edges) {
        const a = firstTaught.get(from);
        const b = firstTaught.get(to);
        if (a !== undefined && b !== undefined && b < a) warn(here, `${to} is taught (lesson ${b}) before its prerequisite ${from} (lesson ${a})`);
      }
    }
  }

  const coverage: CoverageRow[] = graph.kcs.map((kc) => ({ kc: kc.key, strand: kc.strand, tier_min: kc.tier_min, taught_in: taughtIn.get(kc.key) ?? [] }));
  if (input.coverage) {
    const missing = coverage.filter((row) => row.taught_in.length === 0);
    for (const row of missing) error('catalog', `${row.kc} (${row.strand}, tier ${row.tier_min}) is not taught as a new concept anywhere (G3)${(GAP_KCS as readonly string[]).includes(row.kc) ? ': a content gap the catalog must fill' : ''}`);
  }
  return { issues, coverage, lessons };
}

export interface CatalogArgs { courses: string[]; json?: string }

export function main(argv: string[]): number {
  const args: CatalogArgs = { courses: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--course' && argv[i + 1]) { args.courses.push(argv[i + 1]!); i += 1; }
    else if (argv[i] === '--json' && argv[i + 1]) { args.json = path.resolve(argv[i + 1]!); i += 1; }
  }
  const wanted = args.courses.length ? args.courses : readdirSync(CATALOG_DIR).filter((name) => existsSync(path.join(CATALOG_DIR, name, 'structure.yaml')));
  const structures: CatalogStructure[] = [];
  let failed = false;
  for (const course of wanted) {
    const file = path.join(CATALOG_DIR, course, 'structure.yaml');
    if (!existsSync(file)) { console.error(`v2:catalog: ${file} does not exist`); failed = true; continue; }
    const { structure, problems } = parseCatalogStructure(readFileSync(file, 'utf8'));
    if (!structure) { for (const problem of problems) console.error(`v2:catalog: ${course}: ${problem}`); failed = true; continue; }
    if (structure.course_id !== course) { console.error(`v2:catalog: ${file}: course_id ${structure.course_id} differs from its folder ${course}`); failed = true; continue; }
    structures.push(structure);
  }
  const whole = args.courses.length === 0 && CATALOG_COURSES.every((course) => structures.some((structure) => structure.course_id === course));
  const result = checkCatalog({ structures, graph: loadKcGraph(), coverage: whole });
  for (const issue of result.issues) (issue.level === 'error' ? console.error : console.warn)(`v2:catalog ${issue.level}: ${issue.where}: ${issue.message}`);
  const errors = result.issues.filter((issue) => issue.level === 'error').length;
  const taught = result.coverage.filter((row) => row.taught_in.length > 0).length;
  console.log(`v2:catalog: ${structures.length} course(s), ${result.lessons} lesson(s); ${taught}/${result.coverage.length} KCs taught${whole ? '' : ' (coverage not enforced: not the whole catalog)'}; ${errors} error(s), ${result.issues.length - errors} warning(s)`);
  if (args.json) writeFileSync(args.json, `${JSON.stringify(result, null, 2)}\n`);
  return failed || errors > 0 ? 1 : 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
