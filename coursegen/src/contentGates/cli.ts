#!/usr/bin/env node
// content:gates — the Forge content gates over everything in the repository
// (gates 11-13: B.18, B.14, OD-13; gates 14-16: B.17, B.11, B.16),
// with zero spend (no network, no model call; OD-23).
//
//   npm run content:gates -- --course financial-education
//   npm run content:gates -- --course first-lemonade-stand          (catalog + database/seeds/first-lemonade-stand-fixture.sql)
//   npm run content:gates -- --documents runs/<run-id>/checkpoint.json --no-ui
//   npm run content:gates -- --documents src/contentGates/fixtures/red-team --no-ui
//
// Flags:
//   --course <slug>        catalog YAML under curriculum/<slug>/ and, when it exists,
//                          the committed course fixture database/seeds/<slug>-fixture.sql
//   --documents <path>     extra lesson documents: a .sql course fixture, a run
//                          checkpoint.json, a .json document or a directory of them
//                          (repeatable)
//   --no-ui                skip the system/UI copy scan (frontend/src/i18n + frontend/src/rebuild)
//   --register kid|adult   audience register (default kid)
//   --blueprint <path>     explicit v2 source; requires --course, --plans and --lesson-ids
//   --plans <directory>    authored plans for that complete source
//   --lesson-ids <path>    exact slug-to-Vault mapping; never use historical catalog defaults
//   --json <file>          report path (default runs/content-gates/<label>-<timestamp>.json)
//
// Exit codes: 0 no blocking finding, 1 blocking findings (release check fails), 2 setup error.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { taxonomyFileSchema, type TaxonomyFile } from '../catalog/schema.js';
import {
  loadCatalogStrings,
  loadCheckpointDocuments,
  loadJsonDocuments,
  loadSeedCorpus,
  loadUiJson,
  loadUiSourceLiterals,
  type CatalogString,
  type SourcedDocument,
} from './sources.js';
import { formatReport, runContentGates } from './runner.js';
import { loadCourseCatalog } from '../catalog/loader.js';
import { buildCoursePolicy, type CoursePolicy } from './policyGates.js';
import { emitV2Lesson } from '../v2/emit.js';
import { loadV2Plans } from '../v2/plan.js';
import { loadCourseReleaseSource, type CourseReleaseSourcePaths } from '../v2/courseReleaseSource.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');

interface Options {
  course?: string;
  documents: string[];
  ui: boolean;
  register: 'kid' | 'adult';
  json?: string;
  blueprint?: string;
  plans?: string;
  lessonIds?: string;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = { documents: [], ui: true, register: 'kid' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = (): string => {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) throw new Error(`${flag} needs a value`);
      i += 1;
      return next;
    };
    switch (flag) {
      case '--course': options.course = value(); break;
      case '--documents': options.documents.push(value()); break;
      case '--no-ui': options.ui = false; break;
      case '--register': {
        const register = value();
        if (register !== 'kid' && register !== 'adult') throw new Error('--register must be kid or adult');
        options.register = register;
        break;
      }
      case '--json': options.json = value(); break;
      case '--blueprint': options.blueprint = value(); break;
      case '--plans': options.plans = value(); break;
      case '--lesson-ids': options.lessonIds = value(); break;
      default: throw new Error(`unknown flag ${flag}`);
    }
  }
  if (options.course && !/^[a-z0-9-]+$/.test(options.course)) throw new Error('--course must be a lowercase slug');
  const explicit = [options.blueprint, options.plans, options.lessonIds];
  if (explicit.some(Boolean) && (!explicit.every(Boolean) || !options.course || options.documents.length)) {
    throw new Error('An explicit course source requires --course, --blueprint, --plans and --lesson-ids together, without --documents.');
  }
  if (!options.course && options.documents.length === 0 && !options.ui) throw new Error('nothing to check: pass --course, --documents, or keep the UI scan');
  return options;
}

function loadTaxonomy(courseDir: string): TaxonomyFile | undefined {
  const file = path.join(courseDir, 'taxonomy.yaml');
  if (!existsSync(file)) return undefined;
  const parsed = taxonomyFileSchema.safeParse(parseYaml(readFileSync(file, 'utf8')));
  return parsed.success ? parsed.data : undefined;
}

function loadDocuments(target: string): { documents: SourcedDocument[]; strings: CatalogString[]; courseSlug?: string } {
  const resolved = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
  if (!existsSync(resolved)) throw new Error(`--documents: ${target} does not exist`);
  if (resolved.endsWith('.sql')) {
    const corpus = loadSeedCorpus(resolved);
    return { documents: corpus.documents, strings: corpus.strings, courseSlug: corpus.courseSlug };
  }
  if (path.basename(resolved) === 'checkpoint.json') return { documents: loadCheckpointDocuments(resolved), strings: [] };
  return { documents: loadJsonDocuments(resolved), strings: [] };
}

/**
 * A canonical v2 course has no v1 blueprint to scan. Its plans and emitted
 * documents already run the same numbered content gates through the v2 gate
 * adapter, so report that evidence directly instead of falling back to a
 * similarly named legacy catalog.
 */
function runCanonicalV2(options: Options, courseDir: string, explicit?: CourseReleaseSourcePaths): void {
  const loaded = explicit
    ? loadCourseReleaseSource(options.course!, explicit, { allowCalibration: true }).plans.map(plan => ({ plan, errors: [] as string[], file: explicit.plans }))
    : loadV2Plans(path.join(courseDir, 'plans'));
  const setup = loaded.flatMap((entry) => entry.errors.map((error) => `${entry.file}: ${error}`));
  const blocking: Array<{ lesson: string; gate: number; locale?: string; message: string }> = [];
  const review: Array<{ lesson: string; gate: number; locale?: string; message: string }> = [];
  let documentCount = 0;
  for (const entry of loaded) {
    if (!entry.plan) continue;
    const emitted = emitV2Lesson(entry.plan, { versionId: 'content-gates-v2', requireLessonDesign: true });
    documentCount += emitted.documents.length;
    blocking.push(...emitted.problems.map((finding) => ({ lesson: entry.plan!.lesson_id, gate: finding.gate, ...(finding.locale ? { locale: finding.locale } : {}), message: finding.message })));
    review.push(...emitted.review.map((finding) => ({ lesson: entry.plan!.lesson_id, gate: finding.gate, ...(finding.locale ? { locale: finding.locale } : {}), message: finding.message })));
  }

  const ui = options.ui ? loadUiJson(path.join(REPO_ROOT, 'frontend', 'src', 'i18n')) : [];
  const uiLiterals = options.ui ? loadUiSourceLiterals(path.join(REPO_ROOT, 'frontend', 'src', 'rebuild')) : [];
  const uiReport = runContentGates({ documents: [], catalog: [], ui, uiLiterals, register: options.register });
  const ok = setup.length === 0 && loaded.length > 0 && documentCount === loaded.length * 3 && blocking.length === 0 && uiReport.summary.blocking.uiTone === 0;
  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    pipeline: 'v2',
    course: options.course,
    sources: [...(explicit ? [explicit.blueprint, explicit.plans, explicit.lessonIds] : [`curriculum-v2/${options.course}`]), ...(options.ui ? ['frontend/src/i18n', 'frontend/src/rebuild'] : [])],
    plans: loaded.length,
    documents: documentCount,
    setup,
    blocking,
    review,
    ui: uiReport.ui,
    summary: { ok, expectedDocuments: loaded.length * 3, uiBlocking: uiReport.summary.blocking.uiTone },
  };
  const jsonPath = options.json
    ? path.resolve(process.cwd(), options.json)
    : path.join(PACKAGE_ROOT, 'runs', 'content-gates', `${options.course}-${generatedAt.replace(/[:.]/g, '-')}.json`);
  mkdirSync(path.dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`sources: ${report.sources.join(', ')}`);
  console.log('== Forge V2 content gates (carried gates 2–19, including B.18, B.14, OD-13, B.17, B.11 and B.16) ==');
  console.log(`plans: ${loaded.length}   documents: ${documentCount}/${loaded.length * 3}   UI strings: ${uiReport.ui.strings}`);
  console.log(`blocking: ${blocking.length}   Stage 3 review flags: ${review.length}   UI tone blocks: ${uiReport.summary.blocking.uiTone}`);
  for (const finding of [...setup, ...blocking.slice(0, 15).map((item) => `${item.lesson}${item.locale ? ` [${item.locale}]` : ''} gate ${item.gate}: ${item.message}`)]) console.log(`  ✗ ${typeof finding === 'string' ? finding : JSON.stringify(finding)}`);
  console.log(`\n${ok ? 'content:gates OK — canonical V2 plans and emitted documents have no blocking finding' : 'content:gates FAILED — fix the blocking findings above'}`);
  console.log(`\nfull report: ${path.relative(process.cwd(), jsonPath).replace(/\\/g, '/')}`);
  if (!ok) process.exit(1);
}

function main(): void {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`content:gates: ${(error as Error).message}`);
    process.exit(2);
  }

  if (options.course) {
    if (options.blueprint && options.plans && options.lessonIds) {
      try { runCanonicalV2(options, '', { blueprint: options.blueprint, plans: options.plans, lessonIds: options.lessonIds }); } catch (error) {
        console.error(`content:gates: ${(error as Error).message}`);
        process.exit(2);
      }
      return;
    }
    const v2Dir = path.join(PACKAGE_ROOT, 'curriculum-v2', options.course);
    if (existsSync(path.join(v2Dir, 'structure.yaml'))) {
      try { runCanonicalV2(options, v2Dir); } catch (error) {
        console.error(`content:gates: ${(error as Error).message}`);
        process.exit(2);
      }
      return;
    }
  }

  const documents: SourcedDocument[] = [];
  const catalog: CatalogString[] = [];
  let taxonomy: TaxonomyFile | undefined;
  let coursePolicy: CoursePolicy | undefined;
  const sources: string[] = [];
  // Gates 14-16 need the whole catalog (course order, declarations, scenarios).
  const policyFor = (slug: string): CoursePolicy | undefined => {
    const courseDir = path.join(PACKAGE_ROOT, 'curriculum', slug);
    if (!existsSync(courseDir)) return undefined;
    const loaded = loadCourseCatalog(courseDir);
    return loaded.course.catalog ? buildCoursePolicy(loaded.course, { register: options.register }) : undefined;
  };

  try {
    if (options.course) {
      const courseDir = path.join(PACKAGE_ROOT, 'curriculum', options.course);
      if (!existsSync(courseDir)) throw new Error(`no catalog at curriculum/${options.course}`);
      taxonomy = loadTaxonomy(courseDir);
      catalog.push(...loadCatalogStrings(courseDir).strings);
      coursePolicy = policyFor(options.course);
      sources.push(`curriculum/${options.course}`);
      const seed = path.join(REPO_ROOT, 'database', 'seeds', `${options.course}-fixture.sql`);
      if (existsSync(seed)) options.documents.unshift(seed);
    }
    for (const target of options.documents) {
      const loaded = loadDocuments(target);
      documents.push(...loaded.documents);
      catalog.push(...loaded.strings);
      sources.push(path.relative(REPO_ROOT, path.resolve(target)).replace(/\\/g, '/'));
      if (!taxonomy && loaded.courseSlug) taxonomy = loadTaxonomy(path.join(PACKAGE_ROOT, 'curriculum', loaded.courseSlug));
      if (!coursePolicy && loaded.courseSlug) coursePolicy = policyFor(loaded.courseSlug);
    }
  } catch (error) {
    console.error(`content:gates: ${(error as Error).message}`);
    process.exit(2);
  }

  const ui = options.ui ? loadUiJson(path.join(REPO_ROOT, 'frontend', 'src', 'i18n')) : [];
  const uiLiterals = options.ui ? loadUiSourceLiterals(path.join(REPO_ROOT, 'frontend', 'src', 'rebuild')) : [];
  if (options.ui) sources.push('frontend/src/i18n', 'frontend/src/rebuild');

  const report = runContentGates({ taxonomy, register: options.register, documents, catalog, ui, uiLiterals, ...(coursePolicy ? { coursePolicy } : {}) });

  const label = options.course ?? 'content';
  const jsonPath = options.json
    ? path.resolve(process.cwd(), options.json)
    : path.join(PACKAGE_ROOT, 'runs', 'content-gates', `${label}-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
  mkdirSync(path.dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify({ sources, ...report }, null, 2)}\n`);

  console.log(`sources: ${sources.join(', ') || '(none)'}`);
  console.log(formatReport(report));
  console.log(`\nfull report: ${path.relative(process.cwd(), jsonPath).replace(/\\/g, '/')}`);
  if (!report.summary.ok) process.exit(1);
}

main();
