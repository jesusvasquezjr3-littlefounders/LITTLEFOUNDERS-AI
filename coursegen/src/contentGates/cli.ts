#!/usr/bin/env node
// content:gates — the Forge content gates over everything in the repository,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');

interface Options {
  course?: string;
  documents: string[];
  ui: boolean;
  register: 'kid' | 'adult';
  json?: string;
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
      default: throw new Error(`unknown flag ${flag}`);
    }
  }
  if (options.course && !/^[a-z0-9-]+$/.test(options.course)) throw new Error('--course must be a lowercase slug');
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

function main(): void {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`content:gates: ${(error as Error).message}`);
    process.exit(2);
  }

  const documents: SourcedDocument[] = [];
  const catalog: CatalogString[] = [];
  let taxonomy: TaxonomyFile | undefined;
  const sources: string[] = [];

  try {
    if (options.course) {
      const courseDir = path.join(PACKAGE_ROOT, 'curriculum', options.course);
      if (!existsSync(courseDir)) throw new Error(`no catalog at curriculum/${options.course}`);
      taxonomy = loadTaxonomy(courseDir);
      catalog.push(...loadCatalogStrings(courseDir).strings);
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
    }
  } catch (error) {
    console.error(`content:gates: ${(error as Error).message}`);
    process.exit(2);
  }

  const ui = options.ui ? loadUiJson(path.join(REPO_ROOT, 'frontend', 'src', 'i18n')) : [];
  const uiLiterals = options.ui ? loadUiSourceLiterals(path.join(REPO_ROOT, 'frontend', 'src', 'rebuild')) : [];
  if (options.ui) sources.push('frontend/src/i18n', 'frontend/src/rebuild');

  const report = runContentGates({ taxonomy, register: options.register, documents, catalog, ui, uiLiterals });

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
