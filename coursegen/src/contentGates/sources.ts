// Inputs for `content:gates` — every place Forge content and system copy live
// in the repository, read without any network call (OD-23, zero spend):
//
//   catalog    coursegen/curriculum/<course>/*.yaml — learner-visible titles
//              and descriptions (all three locales), parent_check coaching
//              tips, and the author briefs that seed generation.
//   documents  generated v1 lesson documents: a database/seeds course fixture
//              (.sql, exported by database/scripts/export-course-fixture.sh),
//              a Forge run checkpoint (runs/<id>/checkpoint.json), or a
//              directory/file of lesson-document JSON (red-team samples,
//              author:validate inputs).
//   ui         the frontend's system/UI copy: frontend/src/i18n/<locale>/*.json
//              plus the string literals of the rebuilt learning surfaces
//              (frontend/src/rebuild/**, inline per-locale copy).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ContentLocale, CopyRole } from './budgets.js';
import type { LessonDocumentLike } from './lessonModel.js';
import type { LessonPolicy } from './policyGates.js';

export const CONTENT_LOCALES: readonly ContentLocale[] = ['en-US', 'es-MX', 'pt-BR'];

// ---- catalog --------------------------------------------------------------------

export interface CatalogString {
  file: string;
  path: string;
  locale: ContentLocale;
  /** 'brief' strings are generation inputs: tone-scanned, never budgeted (not rendered). */
  role: CopyRole | 'brief';
  text: string;
  /** Age tier of the adventure the string belongs to (course-level strings: undefined). */
  tier?: string;
}

const BRIEF_KEYS = new Set([
  'concept', 'learning_objective', 'micro_objective', 'narrative_beat', 'narrative_arc', 'prior_knowledge', 'key_vocabulary', 'reason',
  // S05.4b authoring contracts: B.11 episode briefs and B.16 market scenarios (generation inputs, never rendered).
  'misjudgment', 'recovery', 'scenario', 'universal',
]);

function catalogRole(key: string): CopyRole | 'brief' | undefined {
  if (key === 'title' || key === 'title_es') return 'heading';
  if (key === 'description') return 'body';
  // A coaching tip on the parent's surface (Bible 06 §6 "Parent, coaching tip" is body copy).
  if (key === 'parent_check') return 'body';
  if (BRIEF_KEYS.has(key)) return 'brief';
  return undefined;
}

function walkCatalog(node: unknown, keys: string[], file: string, tier: string | undefined, out: CatalogString[]): void {
  if (typeof node === 'string') {
    const localeKey = keys[keys.length - 1] as ContentLocale;
    const isLocaleMap = CONTENT_LOCALES.includes(localeKey);
    const key = isLocaleMap ? keys[keys.length - 2] : keys[keys.length - 1];
    if (!key) return;
    const role = catalogRole(key);
    if (!role || !node.trim()) return;
    const locale: ContentLocale = isLocaleMap ? localeKey : 'es-MX'; // single-language catalog fields are authored in es-MX
    out.push({ file, path: keys.join('.'), locale, role, text: node, ...(tier ? { tier } : {}) });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => walkCatalog(item, [...keys, String(index)], file, tier, out));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) walkCatalog(value, [...keys, key], file, tier, out);
  }
}

export function loadCatalogStrings(courseDir: string): { strings: CatalogString[]; tiers: string[] } {
  const strings: CatalogString[] = [];
  const tiers = new Set<string>();
  const catalogFile = path.join(courseDir, 'catalog.yaml');
  if (existsSync(catalogFile)) walkCatalog(parseYaml(readFileSync(catalogFile, 'utf8')), [], path.basename(catalogFile), undefined, strings);
  const adventuresDir = path.join(courseDir, 'adventures');
  if (existsSync(adventuresDir)) {
    for (const name of readdirSync(adventuresDir).filter((n) => n.endsWith('.yaml')).sort()) {
      const data = parseYaml(readFileSync(path.join(adventuresDir, name), 'utf8')) as { adventure?: { age_tier?: string } };
      const tier = data?.adventure?.age_tier;
      if (tier) tiers.add(tier);
      walkCatalog(data, [], `adventures/${name}`, tier, strings);
    }
  }
  return { strings, tiers: [...tiers] };
}

// ---- lesson documents -------------------------------------------------------------

export interface SourcedDocument {
  /** Where it came from, for the report ("first-lemonade-stand-fixture.sql", "runs/x/checkpoint.json"). */
  source: string;
  lesson: string;
  locale: string;
  tier?: string;
  document: LessonDocumentLike;
  /** Narration unit ids actually recorded for this document (seed audio manifests), when known. */
  recordedUnits?: string[];
  /** The lesson's catalog policy (gates 14-16): attached from the course catalog, or a fixture's own `policy`. */
  policy?: LessonPolicy;
}

/** Parses the INSERT statements of an export-course-fixture.sh file into rows of SQL string literals. */
export function parseSeedInserts(sql: string): Array<{ table: string; row: Record<string, string | null> }> {
  const rows: Array<{ table: string; row: Record<string, string | null> }> = [];
  const re = /INSERT INTO ([a-z_]+) \(([^)]*)\) VALUES \(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const table = match[1]!;
    const columns = match[2]!.split(',').map((c) => c.trim().replace(/"/g, ''));
    const values: Array<string | null> = [];
    let i = re.lastIndex;
    while (i < sql.length) {
      while (sql[i] === ' ' || sql[i] === ',') i += 1;
      if (sql[i] === ')') break;
      if (sql.startsWith('NULL', i)) {
        values.push(null);
        i += 4;
        continue;
      }
      if (sql[i] === 'E' && sql[i + 1] === "'") {
        // PostgreSQL escape-string literal (format('%L') emits E'...' when a value holds a backslash).
        let value = '';
        i += 2;
        for (;;) {
          const ch = sql[i];
          if (ch === undefined) throw new Error(`seed parse: unterminated E-literal in ${table}`);
          if (ch === '\\') {
            const next = sql[i + 1];
            const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
            if (next === 'u' || next === 'x') {
              const len = next === 'u' ? 4 : 2;
              value += String.fromCharCode(parseInt(sql.slice(i + 2, i + 2 + len), 16));
              i += 2 + len;
            } else {
              value += next !== undefined && next in simple ? simple[next] : (next ?? '');
              i += 2;
            }
            continue;
          }
          if (ch === "'") {
            if (sql[i + 1] === "'") { value += "'"; i += 2; continue; }
            i += 1;
            break;
          }
          value += ch;
          i += 1;
        }
        values.push(value);
        continue;
      }
      if (sql[i] !== "'") throw new Error(`seed parse: unexpected "${sql.slice(i, i + 20)}" in ${table}`);
      let value = '';
      i += 1;
      for (;;) {
        const next = sql.indexOf("'", i);
        if (next === -1) throw new Error(`seed parse: unterminated literal in ${table}`);
        value += sql.slice(i, next);
        if (sql[next + 1] === "'") {
          value += "'";
          i = next + 2;
          continue;
        }
        i = next + 1;
        break;
      }
      values.push(value);
    }
    re.lastIndex = i;
    if (values.length !== columns.length) throw new Error(`seed parse: ${table} has ${columns.length} columns but ${values.length} values`);
    rows.push({ table, row: Object.fromEntries(columns.map((c, index) => [c, values[index] ?? null])) });
  }
  return rows;
}

export interface SeedCorpus {
  courseSlug: string;
  documents: SourcedDocument[];
  /** Published hierarchy titles/descriptions, per locale. */
  strings: CatalogString[];
}

type Json = Record<string, unknown>;

export function loadSeedCorpus(file: string): SeedCorpus {
  const rows = parseSeedInserts(readFileSync(file, 'utf8'));
  const byTable = (table: string) => rows.filter((r) => r.table === table).map((r) => r.row);
  const json = (value: string | null | undefined): unknown => (value ? JSON.parse(value) : null);

  const adventureTier = new Map(byTable('adventures').map((a) => [a.id!, a.age_tier ?? undefined]));
  const sagaAdventure = new Map(byTable('sagas').map((s) => [s.id!, s.adventure_id!]));
  const topicSaga = new Map(byTable('topics').map((t) => [t.id!, t.saga_id!]));
  const lessons = new Map(byTable('lessons').map((l) => [l.id!, l]));
  const tierOfTopic = (topicId: string) => adventureTier.get(sagaAdventure.get(topicSaga.get(topicId) ?? '') ?? '');
  const source = path.basename(file);

  const documents: SourcedDocument[] = byTable('lesson_documents').map((row) => {
    const lesson = lessons.get(row.lesson_id!);
    const document = json(row.document) as Json & { segments?: Json[] };
    const keys = (json(row.answer_keys) ?? {}) as Record<string, unknown>;
    // Answer feedback prose (correction/reveal/rationale) lives in answer_keys after publish: merge it back.
    const merged = {
      ...document,
      segments: (document.segments ?? []).map((segment) => (keys[segment.id as string] ? { ...segment, answer: keys[segment.id as string] } : segment)),
    } as unknown as LessonDocumentLike;
    const audio = json(row.audio) as { units?: Record<string, unknown> } | null;
    return {
      source,
      lesson: lesson?.slug ?? row.lesson_id!,
      locale: row.locale!,
      tier: lesson ? tierOfTopic(lesson.topic_id!) : undefined,
      document: merged,
      ...(audio?.units ? { recordedUnits: Object.keys(audio.units) } : {}),
    };
  });

  const strings: CatalogString[] = [];
  const localized = (table: string, key: string, row: Record<string, string | null>, tier?: string) => {
    const map = json(row[key] ?? null) as Record<string, string> | null;
    if (!map || typeof map !== 'object') return;
    for (const locale of CONTENT_LOCALES) {
      const text = map[locale];
      if (typeof text === 'string' && text.trim()) {
        strings.push({ file: source, path: `${table}.${row.slug}.${key}`, locale, role: key === 'title' ? 'heading' : 'body', text, ...(tier ? { tier } : {}) });
      }
    }
  };
  for (const row of byTable('courses')) { localized('courses', 'title', row); localized('courses', 'description', row); }
  for (const row of byTable('adventures')) { localized('adventures', 'title', row, row.age_tier ?? undefined); localized('adventures', 'description', row, row.age_tier ?? undefined); }
  for (const row of byTable('sagas')) { const tier = adventureTier.get(row.adventure_id!); localized('sagas', 'title', row, tier); localized('sagas', 'description', row, tier); }
  for (const row of byTable('topics')) localized('topics', 'title', row, tierOfTopic(row.id!));
  for (const row of byTable('lessons')) localized('lessons', 'title', row, tierOfTopic(row.topic_id!));

  const courseSlug = byTable('courses')[0]?.slug ?? path.basename(file, '.sql');
  return { courseSlug, documents, strings };
}

/** A Forge run checkpoint: every slot that carries documents (written → illustrated). */
export function loadCheckpointDocuments(file: string): SourcedDocument[] {
  const checkpoint = JSON.parse(readFileSync(file, 'utf8')) as { slots?: Record<string, { data?: { documents?: Record<string, LessonDocumentLike> } }> };
  const out: SourcedDocument[] = [];
  for (const [slotId, slot] of Object.entries(checkpoint.slots ?? {})) {
    for (const [locale, document] of Object.entries(slot.data?.documents ?? {})) {
      out.push({ source: path.basename(path.dirname(file)) + '/checkpoint.json', lesson: slotId, locale, document });
    }
  }
  return out;
}

/** A lesson-document JSON file or a directory of them (`{ "tier": "tier1", "document": {...} }` or a bare document). */
export function loadJsonDocuments(target: string): SourcedDocument[] {
  const files = statSync(target).isDirectory()
    ? readdirSync(target).filter((n) => n.endsWith('.json')).sort().map((n) => path.join(target, n))
    : [target];
  return files.map((file) => {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Json;
    const document = (raw.document ?? raw) as LessonDocumentLike & { meta?: { slug?: string } };
    return {
      source: path.basename(file),
      lesson: document.meta?.slug ?? path.basename(file, '.json'),
      locale: document.meta?.locale ?? 'es-MX',
      ...(typeof raw.tier === 'string' ? { tier: raw.tier } : {}),
      ...(raw.policy && typeof raw.policy === 'object' ? { policy: raw.policy as unknown as LessonPolicy } : {}),
      document,
    };
  });
}

// ---- system / UI copy ---------------------------------------------------------------

export interface UiString {
  file: string;
  key: string;
  locale: ContentLocale;
  text: string;
}

/**
 * Namespaces that are not the product's voice to families. `admin` is the
 * staff console (internal tooling whose ledger/transaction vocabulary is
 * accurate for staff). Subtrees named `legal` are mandated disclosures
 * (Bible 06 §3.3): they are reviewed by Legal (OD-10), not rewritten by a
 * tone lexicon.
 */
export const UI_EXCLUDED_NAMESPACES = new Set(['admin.json']);
export const UI_EXCLUDED_SUBTREES = new Set(['legal']);

export function loadUiJson(i18nRoot: string): UiString[] {
  const out: UiString[] = [];
  for (const locale of CONTENT_LOCALES) {
    const dir = path.join(i18nRoot, locale);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
      if (UI_EXCLUDED_NAMESPACES.has(name)) continue;
      const walk = (node: unknown, keys: string[]): void => {
        if (typeof node === 'string') {
          out.push({ file: `${locale}/${name}`, key: keys.join('.'), locale, text: node });
          return;
        }
        if (node && typeof node === 'object') {
          for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
            if (UI_EXCLUDED_SUBTREES.has(key)) continue;
            walk(value, [...keys, key]);
          }
        }
      };
      walk(JSON.parse(readFileSync(path.join(dir, name), 'utf8')), []);
    }
  }
  return out;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(full);
  }
  return out.sort();
}

/**
 * String literals of the rebuilt surfaces that carry prose (two or more
 * words). Their locale is not declared per literal, so each literal is
 * scanned with every locale's lexicon: the phrases are language-specific, so a
 * Spanish phrase can only match Spanish text.
 */
export function loadUiSourceLiterals(sourceRoot: string): Array<Omit<UiString, 'locale'>> {
  if (!existsSync(sourceRoot)) return [];
  const out: Array<Omit<UiString, 'locale'>> = [];
  const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  for (const file of listSourceFiles(sourceRoot)) {
    const source = readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = literal.exec(source)) !== null) {
      const text = match[1] ?? match[2] ?? match[3] ?? '';
      if (!/[\p{L}]{2,}\s+[\p{L}]{2,}/u.test(text)) continue; // prose only; identifiers, paths and class names have no spaced words
      const line = source.slice(0, match.index).split('\n').length;
      out.push({ file: path.relative(path.dirname(sourceRoot), file).replace(/\\/g, '/'), key: `line ${line}`, text });
    }
  }
  return out;
}
