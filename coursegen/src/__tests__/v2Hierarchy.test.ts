import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generate, HIERARCHY_FILES, loadKcInfo, main } from '../v2/hierarchyCli.js';
import {
  ageTierFor, applyLessonIds, buildHierarchy, DEFAULT_ADVENTURE_THEME, HIERARCHY_NAMESPACE, hierarchyId, HierarchyError, KC_MAP_VERSION,
  parseLessonIds, parseStructure, renderIdsJson, renderRowsJson, renderSql, uuidV5,
  type HierarchyRows, type Localized,
} from '../v2/hierarchy.js';
import { loadV2Plans, type V2LessonPlan } from '../v2/plan.js';
import { releaseV2Lessons } from '../v2/release.js';
import { parse as parseArgs, publish } from '../v2/releaseCli.js';

/*
 * v2 hierarchy generator: structure + plans -> Vault hierarchy rows, seed SQL
 * and ids.json; plus releaseCli's --lesson-ids rewrite (migration 0221: the
 * document's lesson_id must equal p_lesson_id, a public.lessons uuid).
 * Always runs against a synthetic structure cloned from the committed fixture
 * plans; the real pilot (coursegen/curriculum-v2 is untracked) is checked too
 * when it is present.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PLANS = path.resolve(here, '../v2/fixtures/plans');
const PILOT_DIR = path.resolve(here, '../../curriculum-v2/financial-education');
const KC_GRAPH = path.resolve(here, '../../../database/seeds/kc_graph.v1.json');
const MIGRATIONS = path.resolve(here, '../../../database/migrations');

const fixtures = loadV2Plans(FIXTURE_PLANS);
const fixtureById = (id: string): V2LessonPlan => structuredClone(fixtures.find((entry) => entry.plan?.lesson_id === id)!.plan!) as V2LessonPlan;
const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'lf-v2-hierarchy-'));
const localized = (en: string): Localized => ({ 'en-US': en, 'es-MX': `${en} (es)`, 'pt-BR': `${en} (pt)` });

const STRUCTURE_YAML = `
course_id: financial-education
pathways:
  - pathway_id: financial-young
    age_band: "6-9"
    chapters:
      - chapter_id: saving-basics
        title: { en-US: Saving basics, es-MX: Fundamentos del ahorro, pt-BR: Fundamentos da poupanca }
        lessons: [{ lesson_id: v2-allocation-bar }, { lesson_id: v2-allocation-waffle }]
  - pathway_id: financial-10-12
    age_band: "10-12"
    chapters:
      - chapter_id: discounts
        title: { en-US: Discounts, es-MX: Descuentos, pt-BR: Descontos }
        lessons: [{ lesson_id: v2-percent-grid }, { lesson_id: v2-worked-example }]
  - pathway_id: financial-teen
    age_band: "13-17"
    chapters:
      - chapter_id: tracking-money
        title: { en-US: Tracking money, es-MX: Seguir el dinero, pt-BR: Acompanhar o dinheiro }
        lessons: [{ lesson_id: v2-running-ledger }]
`;

/** Five fixture lessons; the percent-grid one carries three KCs (new, reviewed, new) to exercise every link role. */
function syntheticPlans(): V2LessonPlan[] {
  const grid = fixtureById('v2-percent-grid');
  grid.knowledge_component_ids = ['kc-percent-of', 'kc-fraction-magnitude', 'kc-budget-parts'];
  grid.new_concepts = ['kc-percent-of', 'kc-budget-parts'];
  return [fixtureById('v2-allocation-bar'), fixtureById('v2-allocation-waffle'), grid, fixtureById('v2-worked-example'), fixtureById('v2-running-ledger')];
}
const kcsFor = (plans: readonly V2LessonPlan[]) =>
  Object.fromEntries(plans.flatMap((plan) => plan.knowledge_component_ids).map((key) => [key, { objective: localized(`Objective of ${key}`) }]));
function synthetic(overrides: { yaml?: string; plans?: V2LessonPlan[]; kcs?: Record<string, { objective: Localized }> } = {}) {
  const plans = overrides.plans ?? syntheticPlans();
  return { structure: parseStructure(overrides.yaml ?? STRUCTURE_YAML), plans, kcs: overrides.kcs ?? kcsFor(plans) };
}
const problemsOf = (run: () => unknown): string[] => {
  try { run(); } catch (error) { if (error instanceof HierarchyError) return error.problems; throw error; }
  throw new Error('expected a HierarchyError');
};

// ── the real columns, read from the migrations ───────────────────────────

const read = (prefix: string): string => {
  const file = readdirSync(MIGRATIONS).find((name) => name.startsWith(`${prefix}_`));
  if (!file) throw new Error(`migration ${prefix} not found`);
  return readFileSync(path.join(MIGRATIONS, file), 'utf8').replace(/\r\n/g, '\n');
};

interface TableSchema { columns: Map<string, { required: boolean }>; enums: Record<string, string[]> }

const quotedValues = (text: string, column: string): string[] => {
  const match = new RegExp(`\\b${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(text);
  if (!match) throw new Error(`no "${column} IN (...)" in the migration text`);
  return [...match[1]!.matchAll(/'([^']*)'/g)].map((value) => value[1]!);
};

/** Columns of one table from its CREATE TABLE body plus later ADD COLUMNs; required = NOT NULL without DEFAULT. */
function tableSchema(table: string, texts: string[], enumColumns: Record<string, string>): TableSchema {
  const text = texts.join('\n');
  const created = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(\\n([\\s\\S]*?)\\n\\);`, 'i').exec(text);
  const columns = new Map<string, { required: boolean }>();
  if (created) {
    for (const line of created[1]!.split('\n')) {
      const column = /^\s+"?([a-z_]+)"?\s+(?:uuid|text|jsonb|integer|smallint|boolean|timestamptz)\b(.*)$/i.exec(line);
      if (column) columns.set(column[1]!, { required: /NOT NULL/i.test(column[2]!) && !/DEFAULT/i.test(column[2]!) });
    }
  }
  for (const alter of text.matchAll(/ALTER TABLE public\.(\w+)\s+([\s\S]*?);/gi)) {
    if (alter[1]!.toLowerCase() !== table) continue;
    for (const piece of alter[2]!.split(/ADD COLUMN IF NOT EXISTS\s+/i).slice(1)) {
      const column = /^"?([a-z_]+)"?\s+[\s\S]*$/i.exec(piece);
      if (column) columns.set(column[1]!, { required: /NOT NULL/i.test(piece) && !/DEFAULT/i.test(piece) });
    }
  }
  const enums: Record<string, string[]> = {};
  for (const [column, source] of Object.entries(enumColumns)) enums[column] = quotedValues(source === 'create' ? created![1]! : source, column);
  return { columns, enums };
}

function loadSchema(): Record<keyof HierarchyRows, TableSchema> {
  const m = { '0002': read('0002'), '0007': read('0007'), '0008': read('0008'), '0016': read('0016'), '0039': read('0039'), '0044': read('0044'), '0123': read('0123') };
  return {
    courses: tableSchema('courses', [m['0002'], m['0007'], m['0008'], m['0039']], { status: 'create', subject: m['0007'] }),
    adventures: tableSchema('adventures', [m['0007'], m['0123']], { status: 'create', theme: m['0007'], age_tier: m['0044'], pathway_stage: m['0123'] }),
    sagas: tableSchema('sagas', [m['0007']], { status: 'create' }),
    topics: tableSchema('topics', [m['0007'], m['0016']], { status: 'create', kind: m['0016'] }),
    lessons: tableSchema('lessons', [m['0007']], { status: 'create' }),
    topic_knowledge_components: tableSchema('topic_knowledge_components', [m['0123']], { role: m['0123'] }),
  };
}

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Every violation of the Vault constraints the rows could trip; empty means the rows fit the schema. */
function violations(rows: HierarchyRows, schema: Record<keyof HierarchyRows, TableSchema>): string[] {
  const out: string[] = [];
  for (const [table, list] of Object.entries(rows) as Array<[keyof HierarchyRows, object[]]>) {
    const declared = schema[table];
    list.forEach((row, index) => {
      const at = `${table}[${index}]`;
      const entries = Object.entries(row).map(([key, value]) => [key === 'kc_key' ? 'kc_id' : key, value] as const);
      for (const [key, value] of entries) {
        if (!declared.columns.has(key)) out.push(`${at}: ${key} is not a column of public.${table}`);
        if (value === null || value === undefined) out.push(`${at}: ${key} is null`);
        if (declared.enums[key] && !declared.enums[key]!.includes(value as string)) out.push(`${at}: ${key}=${String(value)} is outside its CHECK`);
      }
      const keys = entries.map(([key]) => key);
      for (const [name, info] of declared.columns) if (info.required && !keys.includes(name)) out.push(`${at}: NOT NULL column ${name} has no value`);
    });
  }

  const idsOf = (list: Array<{ id: string }>) => list.map((row) => row.id);
  for (const table of ['courses', 'adventures', 'sagas', 'topics', 'lessons'] as const) {
    const ids = idsOf(rows[table]);
    if (new Set(ids).size !== ids.length) out.push(`${table}: duplicate ids`);
    for (const id of ids) if (!UUID_V5.test(id)) out.push(`${table}: ${id} is not a UUIDv5`);
  }
  const parents: Array<[string, Array<{ id: string; slug: string; position: number } & Record<string, unknown>>, string, Set<string>]> = [
    ['adventures', rows.adventures as never, 'course_id', new Set(idsOf(rows.courses))],
    ['sagas', rows.sagas as never, 'adventure_id', new Set(idsOf(rows.adventures))],
    ['topics', rows.topics as never, 'saga_id', new Set(idsOf(rows.sagas))],
    ['lessons', rows.lessons as never, 'topic_id', new Set(idsOf(rows.topics))],
  ];
  for (const [table, list, parentColumn, parentIds] of parents) {
    const slugs = new Set<string>();
    const positions = new Set<string>();
    for (const row of list) {
      const parent = String(row[parentColumn]);
      if (!parentIds.has(parent)) out.push(`${table}: ${row.slug} points at a missing ${parentColumn} ${parent}`);
      if (slugs.has(`${parent}/${row.slug}`)) out.push(`${table}: slug ${row.slug} repeats under one parent`);
      if (positions.has(`${parent}/${row.position}`)) out.push(`${table}: position ${row.position} repeats under one parent`);
      slugs.add(`${parent}/${row.slug}`);
      positions.add(`${parent}/${row.position}`);
      if (!Number.isInteger(row.position) || row.position < 1) out.push(`${table}: ${row.slug} has position ${row.position}`);
    }
  }
  for (const row of rows.adventures) {
    const { pathway_stage: stage, eligibility_min_age: min, eligibility_max_age: max } = row;
    if (stage == null || min == null) out.push(`adventures: ${row.slug} breaks adventures_pathway_eligibility_complete`);
    if (min < 0 || min > 119 || max < 0 || max > 119) out.push(`adventures: ${row.slug} eligibility is outside 0..119`);
    if (max != null && max < min) out.push(`adventures: ${row.slug} max age ${max} is below min ${min}`);
  }
  for (const row of [...rows.adventures, ...rows.sagas, ...rows.topics, ...rows.courses]) if (row.status !== 'draft') out.push(`${row.slug}: a generated row must be draft, got ${row.status}`);
  for (const row of rows.lessons) if (row.status !== 'review') out.push(`lessons: ${row.slug} must land as review, got ${row.status}`);
  for (const row of [...rows.adventures, ...rows.sagas, ...rows.topics, ...rows.lessons]) {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) if (typeof row.title[locale] !== 'string' || !row.title[locale].trim()) out.push(`${row.slug}: title.${locale} is empty`);
  }

  const topicIds = new Set(idsOf(rows.topics));
  const linked = new Set<string>();
  const primaries = new Map<string, number>();
  for (const link of rows.topic_knowledge_components) {
    if (!topicIds.has(link.topic_id)) out.push(`topic_knowledge_components: ${link.kc_key} points at a missing topic`);
    if (linked.has(`${link.topic_id}/${link.kc_key}`)) out.push(`topic_knowledge_components: primary key (${link.topic_id}, ${link.kc_key}) repeats`);
    linked.add(`${link.topic_id}/${link.kc_key}`);
    if (link.is_primary && link.role !== 'teaches') out.push(`topic_knowledge_components: ${link.kc_key} is primary but ${link.role} (topic_kc_primary_teaches)`);
    if (link.is_primary) primaries.set(link.topic_id, (primaries.get(link.topic_id) ?? 0) + 1);
    if (!Number.isInteger(link.map_version) || link.map_version < 1) out.push(`topic_knowledge_components: map_version ${link.map_version} is below 1`);
  }
  for (const topic of rows.topics) if (primaries.get(topic.id) !== 1) out.push(`topics: ${topic.slug} has ${primaries.get(topic.id) ?? 0} primary KC links (uq_topic_kc_one_primary wants one)`);
  return out;
}

afterEach(() => vi.restoreAllMocks());

describe('ids', () => {
  it('computes RFC 4122 name-based UUIDv5 (python uuid.uuid5(NAMESPACE_DNS, "python.org"))', () => {
    expect(uuidV5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });

  it('pins the namespace and the id scheme: changing either would re-key every published lesson', () => {
    expect(HIERARCHY_NAMESPACE).toBe('a3c1f0de-5b7e-4c21-9d34-7e6f1b2a8c90');
    const slug = 'fe-69-01-count-coins';
    const chapter = 'fe-69-coins-and-choices';
    expect(hierarchyId('lesson', 'financial-education', chapter, chapter, slug, slug)).toBe('1093d2a4-356e-5319-94ba-e75ef6c8c5dc');
  });

  it('keeps same-slug nodes at different levels apart and always yields a UUIDv5', () => {
    const a = hierarchyId('saga', 'c', 'x', 'x');
    const b = hierarchyId('topic', 'c', 'x', 'x');
    expect(a).not.toBe(b);
    expect([a, b].every((value) => UUID_V5.test(value))).toBe(true);
  });
});

describe('buildHierarchy (synthetic structure)', () => {
  it('is deterministic: two builds, and a build over reordered plans, are identical down to the SQL bytes', () => {
    const first = buildHierarchy(synthetic());
    const second = buildHierarchy(synthetic());
    const reordered = buildHierarchy({ ...synthetic(), plans: syntheticPlans().reverse() });
    expect(second).toEqual(first);
    expect(reordered).toEqual(first);
    expect(renderSql(second)).toBe(renderSql(first));
    expect(renderRowsJson(reordered)).toBe(renderRowsJson(first));
    expect(renderIdsJson(reordered)).toBe(renderIdsJson(first));
  });

  it('maps a v2 chapter to an adventure carrying pathway stage and eligibility, in authored order', () => {
    const { rows } = buildHierarchy(synthetic());
    expect(rows.courses).toHaveLength(1);
    expect(rows.adventures.map((a) => [a.position, a.slug, a.pathway_stage, a.eligibility_min_age, a.eligibility_max_age, a.age_tier])).toEqual([
      [1, 'saving-basics', 'child', 6, 9, 'tier1'],
      [2, 'discounts', 'tween', 10, 12, 'tier3'],
      [3, 'tracking-money', 'teen', 13, 17, 'tier4'],
    ]);
    expect(rows.adventures.every((a) => a.theme === DEFAULT_ADVENTURE_THEME && a.course_id === rows.courses[0]!.id)).toBe(true);
    expect(rows.adventures[0]!.title).toEqual({ 'en-US': 'Saving basics', 'es-MX': 'Fundamentos del ahorro', 'pt-BR': 'Fundamentos da poupanca' });
  });

  it('defaults to one saga per chapter, one topic per lesson in authored order, and a review lesson', () => {
    const { rows, ids } = buildHierarchy(synthetic());
    expect(rows.sagas.map((s) => [s.slug, s.position])).toEqual([['saving-basics', 1], ['discounts', 1], ['tracking-money', 1]]);
    expect(rows.topics.map((t) => [t.slug, t.position])).toEqual([
      ['v2-allocation-bar', 1], ['v2-allocation-waffle', 2], ['v2-percent-grid', 1], ['v2-worked-example', 2], ['v2-running-ledger', 1],
    ]);
    expect(rows.lessons.map((l) => [l.slug, l.position, l.status])).toEqual(rows.topics.map((t) => [t.slug, 1, 'review']));
    expect(Object.keys(ids)).toEqual(rows.lessons.map((l) => l.slug));
    expect(rows.lessons.map((l) => l.id)).toEqual(Object.values(ids));
    expect(rows.topics.every((t) => t.kind === 'teaching')).toBe(true);
  });

  it('carries the plan title and the primary KC objective, and links KCs with the primary first', () => {
    const plans = syntheticPlans();
    const { rows } = buildHierarchy(synthetic({ plans }));
    const grid = rows.topics.find((t) => t.slug === 'v2-percent-grid')!;
    expect(grid.title).toEqual(plans[2]!.title);
    expect(grid.learning_objective).toEqual(localized('Objective of kc-percent-of'));
    const links = rows.topic_knowledge_components.filter((l) => l.topic_id === grid.id);
    expect(links.map((l) => [l.kc_key, l.role, l.is_primary, l.map_version])).toEqual([
      ['kc-percent-of', 'teaches', true, KC_MAP_VERSION],
      ['kc-fraction-magnitude', 'reviews', false, KC_MAP_VERSION],
      ['kc-budget-parts', 'teaches', false, KC_MAP_VERSION],
    ]);
    const worked = rows.topics.find((t) => t.slug === 'v2-worked-example')!;
    expect(rows.topic_knowledge_components.filter((l) => l.topic_id === worked.id)).toMatchObject([{ kc_key: 'kc-percent-of', role: 'teaches', is_primary: true }]);
  });

  it('derives the informational age tier from the P1 table', () => {
    expect(ageTierFor('child', 6)).toBe('tier1');
    expect(ageTierFor('child', 7)).toBe('tier1');
    expect(ageTierFor('child', 8)).toBe('tier2');
    expect(ageTierFor('tween', 10)).toBe('tier3');
    expect(ageTierFor('teen', 13)).toBe('tier4');
    expect(ageTierFor('adult', 18)).toBe('tier4');
  });

  it('widens an adventure to the lessons it holds', () => {
    const plans = syntheticPlans();
    plans[0]!.eligibility = { minimum_age: 7, maximum_age: 8 };
    plans[1]!.eligibility = { minimum_age: 6, maximum_age: 9 };
    const adventure = buildHierarchy(synthetic({ plans })).rows.adventures[0]!;
    expect([adventure.eligibility_min_age, adventure.eligibility_max_age]).toEqual([6, 9]);
  });

  it('blocks with every problem at once instead of guessing', () => {
    const plans = syntheticPlans().filter((plan) => plan.lesson_id !== 'v2-worked-example');
    plans[0]!.age_band = '10-12';
    plans[1]!.chapter_id = 'somewhere-else';
    plans[2]!.knowledge_component_ids = ['kc-percent-of', 'kc-percent-of'];
    plans.push(fixtureById('v2-savings-line'));
    const kcs = kcsFor(plans);
    delete (kcs as Record<string, unknown>)['kc-running-ledger'];
    const problems = problemsOf(() => buildHierarchy({ structure: parseStructure(STRUCTURE_YAML), plans, kcs }));
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringMatching(/v2-worked-example has no plan/),
      expect.stringMatching(/v2-allocation-bar: plan age_band 10-12 differs from its pathway's 6-9/),
      expect.stringMatching(/v2-allocation-waffle: the plan says .*somewhere-else but the structure places it/),
      expect.stringMatching(/v2-percent-grid: knowledge_component_ids repeats a key/),
      expect.stringMatching(/v2-running-ledger: knowledge component kc-running-ledger is not in the KC graph/),
      expect.stringMatching(/plan v2-savings-line is not listed in the structure/),
    ]));
  });

  it('refuses eligibility outside the pathway band, a repeated lesson id and a course with no metadata', () => {
    const plans = syntheticPlans();
    plans[0]!.eligibility = { minimum_age: 5, maximum_age: 9 };
    expect(problemsOf(() => buildHierarchy(synthetic({ plans })))).toEqual([expect.stringMatching(/v2-allocation-bar: eligibility 5-9 falls outside the 6-9 band/)]);

    const twice = [...syntheticPlans(), fixtureById('v2-allocation-bar')];
    expect(problemsOf(() => buildHierarchy(synthetic({ plans: twice })))).toEqual(expect.arrayContaining([expect.stringMatching(/two plans carry lesson_id v2-allocation-bar/)]));

    const elsewhere = STRUCTURE_YAML.replace('course_id: financial-education', 'course_id: other-course');
    expect(problemsOf(() => buildHierarchy(synthetic({ yaml: elsewhere })))).toEqual(expect.arrayContaining([expect.stringMatching(/no course metadata for "other-course"/)]));
  });

  it('rejects a structure file of the wrong shape with a HierarchyError', () => {
    expect(problemsOf(() => parseStructure('course_id: financial-education\npathways: []'))[0]).toMatch(/^structure pathways/);
    expect(problemsOf(() => parseStructure('not: a structure'))[0]).toMatch(/^structure /);
  });
});

describe.skipIf(!existsSync(MIGRATIONS))('rows against the Vault constraints (columns read from the migrations)', () => {
  const schema = existsSync(MIGRATIONS) ? loadSchema() : ({} as ReturnType<typeof loadSchema>);

  it('reads the real column sets (so the checks below are not vacuous)', () => {
    expect([...schema.courses.columns.keys()]).toEqual(expect.arrayContaining(['slug', 'title', 'description', 'subject', 'status', 'position', 'requires', 'badge_asset']));
    expect([...schema.adventures.columns.keys()]).toEqual(expect.arrayContaining(['course_id', 'slug', 'theme', 'age_tier', 'pathway_stage', 'eligibility_min_age', 'eligibility_max_age']));
    expect([...schema.lessons.columns.keys()]).toEqual(expect.arrayContaining(['topic_id', 'slug', 'status', 'cast']));
    expect([...schema.topic_knowledge_components.columns.keys()]).toEqual(expect.arrayContaining(['topic_id', 'kc_id', 'role', 'is_primary', 'map_version']));
    expect(schema.lessons.enums.status).toEqual(['draft', 'review', 'published', 'archived']);
    expect(schema.adventures.enums.age_tier).toEqual(['tier1', 'tier2', 'tier3', 'tier4']);
    expect(schema.adventures.columns.get('theme')).toEqual({ required: true });
    expect(schema.adventures.columns.get('pathway_stage')).toEqual({ required: false });
  });

  it('fits every constraint for a synthetic build', () => {
    expect(violations(buildHierarchy(synthetic()).rows, schema)).toEqual([]);
  });

  it('catches a violation when one is planted (the check is not vacuous)', () => {
    const planted = (change: (rows: HierarchyRows) => void): string[] => {
      const rows = structuredClone(buildHierarchy(synthetic()).rows);
      change(rows);
      return violations(rows, schema);
    };
    expect(planted((rows) => { (rows.lessons[0] as { status: string }).status = 'published'; })).toEqual(expect.arrayContaining([expect.stringMatching(/must land as review/)]));
    expect(planted((rows) => { (rows.adventures[0] as { theme: string }).theme = 'moon'; })).toEqual(expect.arrayContaining([expect.stringMatching(/theme=moon is outside its CHECK/)]));
    expect(planted((rows) => { rows.topics[1]!.position = rows.topics[0]!.position; })).toEqual(expect.arrayContaining([expect.stringMatching(/position 1 repeats under one parent/)]));
    expect(planted((rows) => { (rows.adventures[0] as unknown as Record<string, unknown>).eligibility_min_age = 10; })).toEqual(expect.arrayContaining([expect.stringMatching(/max age 9 is below min 10/)]));
    expect(planted((rows) => { (rows.topics[0] as unknown as Record<string, unknown>).owner = 'x'; })).toEqual(expect.arrayContaining([expect.stringMatching(/owner is not a column/)]));
    expect(planted((rows) => { rows.topic_knowledge_components.find((link) => !link.is_primary)!.is_primary = true; })).toEqual(expect.arrayContaining([expect.stringMatching(/has 2 primary KC links/)]));
    expect(planted((rows) => { (rows.topic_knowledge_components[0] as { role: string }).role = 'reviews'; })).toEqual(expect.arrayContaining([expect.stringMatching(/topic_kc_primary_teaches/)]));
    expect(planted((rows) => { rows.sagas[0]!.adventure_id = hierarchyId('adventure', 'nowhere'); })).toEqual(expect.arrayContaining([expect.stringMatching(/missing adventure_id/)]));
  });

  describe.skipIf(!existsSync(path.join(PILOT_DIR, 'pilot.structure.yaml')) || !existsSync(KC_GRAPH))('the Educación Financiera pilot', () => {
    const pilot = () => {
      const loaded = loadV2Plans(path.join(PILOT_DIR, 'plans'));
      expect(loaded.filter((entry) => entry.errors.length)).toEqual([]);
      const plans = loaded.map((entry) => entry.plan!);
      return { structure: parseStructure(readFileSync(path.join(PILOT_DIR, 'pilot.structure.yaml'), 'utf8')), plans, kcs: loadKcInfo(KC_GRAPH) };
    };

    it('builds deterministically, fits the constraints and gives every plan a lesson id', () => {
      const input = pilot();
      const hierarchy = buildHierarchy(input);
      expect(buildHierarchy(pilot())).toEqual(hierarchy);
      expect(renderSql(buildHierarchy(pilot()))).toBe(renderSql(hierarchy));
      expect(violations(hierarchy.rows, schema)).toEqual([]);
      expect(Object.keys(hierarchy.ids).sort()).toEqual(input.plans.map((plan) => plan.lesson_id).sort());
      expect(hierarchy.rows.lessons).toHaveLength(input.plans.length);
    });

    it('lands the pilot as a child chapter and a tween chapter', () => {
      const adventures = buildHierarchy(pilot()).rows.adventures;
      expect(adventures.map((a) => a.pathway_stage)).toEqual(['child', 'tween']);
      expect(adventures.every((a) => a.status === 'draft')).toBe(true);
    });

    it('generate() renders the three files the CLI writes', () => {
      const files = generate({ structure: path.join(PILOT_DIR, 'pilot.structure.yaml'), plans: path.join(PILOT_DIR, 'plans'), kcGraph: KC_GRAPH });
      expect(Object.keys(files)).toEqual([...HIERARCHY_FILES]);
      expect(files['ids.json']).toBe(renderIdsJson(buildHierarchy(pilot())));
    });
  });
});

describe('seed SQL', () => {
  const hierarchy = buildHierarchy(synthetic());
  const sql = renderSql(hierarchy);

  it('is wrapped for owner review: a transaction that ends in ROLLBACK, never COMMIT', () => {
    expect(sql.indexOf('\nBEGIN;\n')).toBeGreaterThan(0);
    expect(sql.trimEnd().endsWith('ROLLBACK;')).toBe(true);
    expect(sql).not.toMatch(/^COMMIT;/m);
  });

  it('is create-only and idempotent: only INSERT ... ON CONFLICT DO NOTHING, no DDL or deletes', () => {
    const inserts = sql.match(/^INSERT INTO /gm) ?? [];
    expect(inserts.length).toBe(1 + hierarchy.rows.adventures.length + 4); // course, one per adventure, then sagas, topics, lessons and KC links
    expect((sql.match(/^ON CONFLICT DO NOTHING;$/gm) ?? []).length).toBe(inserts.length);
    expect(sql).not.toMatch(/^\s*(UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\b/im);
  });

  it('never writes a published status', () => {
    expect(sql).not.toMatch(/'published'/);
    expect(sql.match(/'review'/g)?.length).toBe(hierarchy.rows.lessons.length);
  });

  it('quotes safely: balanced dollar tags, and a value that could close a tag is refused', () => {
    expect((sql.match(/\$lf\$/g) ?? []).length % 2).toBe(0);
    expect(sql.match(/\$lfkc\$/g)).toHaveLength(2);
    expect(sql.match(/\$lfassert\$/g)).toHaveLength(2);
    const plans = syntheticPlans();
    plans[0]!.title['en-US'] = 'Tricky $lf$ title';
    expect(() => renderSql(buildHierarchy(synthetic({ plans })))).toThrow(HierarchyError);
  });

  it('resolves the course by slug, KCs by key, and checks completeness before the final ROLLBACK', () => {
    expect(sql).toContain("FROM public.courses c WHERE c.slug = 'financial-education'");
    expect(sql).toContain('JOIN public.kc k ON k.key = v.kc_key');
    expect(sql).toContain('knowledge components missing from public.kc');
    expect(sql.indexOf('$lfassert$')).toBeLessThan(sql.lastIndexOf('ROLLBACK;'));
    expect(sql.split(hierarchy.rows.courses[0]!.id)).toHaveLength(2);
  });

  it('mentions every generated id and every KC key, and leaves "cast" to its column default', () => {
    for (const row of [...hierarchy.rows.adventures, ...hierarchy.rows.sagas, ...hierarchy.rows.topics, ...hierarchy.rows.lessons]) expect(sql).toContain(row.id);
    for (const link of hierarchy.rows.topic_knowledge_components) expect(sql).toContain(`'${link.kc_key}'`);
    expect(sql).not.toMatch(/\bcast\b/);
  });
});

describe('--lesson-ids rewrite', () => {
  const ids = buildHierarchy(synthetic()).ids;

  it('validates ids.json: a flat object of slug -> lowercase uuid', () => {
    expect(parseLessonIds(ids)).toEqual(ids);
    expect(parseLessonIds(JSON.parse(renderIdsJson(buildHierarchy(synthetic()))))).toEqual(ids);
    expect(problemsOf(() => parseLessonIds({ 'a-lesson': 'not-a-uuid' }))[0]).toMatch(/a-lesson: "not-a-uuid" is not a lowercase uuid/);
    expect(problemsOf(() => parseLessonIds({ 'a-lesson': '1093D2A4-356E-5319-94BA-E75EF6C8C5DC' }))).toHaveLength(1);
    expect(problemsOf(() => parseLessonIds({ 'a-lesson': 7 }))).toHaveLength(1);
    expect(() => parseLessonIds([])).toThrow(HierarchyError);
    expect(() => parseLessonIds(null)).toThrow(HierarchyError);
    expect(() => parseLessonIds('x')).toThrow(HierarchyError);
  });

  it('rewrites a slug lesson_id to its uuid, passes an id that is already a mapped uuid, and never mutates its input', () => {
    const plan = fixtureById('v2-allocation-bar');
    const uuid = ids['v2-allocation-bar']!;
    const rewritten = applyLessonIds([plan], ids);
    expect(rewritten.problems).toEqual([]);
    expect(rewritten.plans[0]!.lesson_id).toBe(uuid);
    expect(plan.lesson_id).toBe('v2-allocation-bar');
    expect(rewritten.plans[0]!.title).toEqual(plan.title);
    expect(applyLessonIds(rewritten.plans, ids)).toEqual({ plans: rewritten.plans, problems: [] });
  });

  it('reports a slug with no entry instead of guessing a uuid', () => {
    const result = applyLessonIds([fixtureById('v2-allocation-bar'), fixtureById('v2-savings-line')], ids);
    expect(result.problems).toEqual(['v2-savings-line: no Vault lesson id in the lesson-ids file']);
    expect(result.plans[1]!.lesson_id).toBe('v2-savings-line');
  });

  it('makes document.lesson_id equal p_lesson_id for every market of the publication call (0221)', async () => {
    const plan = fixtureById('v2-first-release-logic');
    const uuid = hierarchyId('lesson', 'financial-education', 'chapter', 'chapter', plan.lesson_id, plan.lesson_id);
    const { plans, problems } = applyLessonIds([plan], { [plan.lesson_id]: uuid });
    expect(problems).toEqual([]);
    const result = await releaseV2Lessons(plans, { runId: 'hierarchy', outDir: tmp(), courseSlug: 'financial-education', dryRun: true, deps: { coreCheck: () => ({ ok: true, output: '' }) } });
    expect(result).toMatchObject({ ok: true, stage: 'dry-run' });
    expect(result.calls.map((call) => call.locale).sort()).toEqual(['en-US', 'es-MX', 'pt-BR']);
    for (const call of result.calls) {
      expect(call.body.p_lesson_id).toBe(uuid);
      expect((call.body.p_document as { lesson_id: string }).lesson_id).toBe(uuid);
    }
  });
});

describe('v2:publish --lesson-ids', () => {
  const base = (extra: string[]) => parseArgs(['--plans', FIXTURE_PLANS, '--course', 'financial-education', '--run-id', 'hierarchy', '--out', tmp(), '--dry-run', ...extra]);
  const idsFile = (content: unknown) => {
    const file = path.join(tmp(), 'ids.json');
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
  };
  const silenced = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

  it('exits 2 when the flag has no file', async () => {
    const errors = silenced();
    expect(await publish(base(['--lesson-ids']))).toBe(2);
    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/--lesson-ids needs a file/));
  });

  it('exits 1 on a malformed ids file, an unreadable file, and a plan with no uuid, before anything is emitted', async () => {
    const errors = silenced();
    expect(await publish(base(['--lesson-ids', idsFile({ 'v2-allocation-bar': 'not-a-uuid' })]))).toBe(1);
    expect(errors).toHaveBeenLastCalledWith(expect.stringMatching(/--lesson-ids .*"not-a-uuid" is not a lowercase uuid/));
    expect(await publish(base(['--lesson-ids', idsFile('{ nope')]))).toBe(1);
    expect(await publish(base(['--lesson-ids', path.join(tmp(), 'missing.json')]))).toBe(1);
    expect(await publish(base(['--lesson-ids', idsFile({ 'v2-allocation-bar': hierarchyId('lesson', 'x', 'x', 'x', 'x', 'x') })]))).toBe(1);
    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/no Vault lesson id in the lesson-ids file/));
  });
});

describe('v2:hierarchy CLI', () => {
  const quietLog = () => vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const quietError = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

  function fixtureProject() {
    const dir = tmp();
    const plansDir = path.join(dir, 'plans');
    const plans = syntheticPlans();
    writeFileSync(path.join(dir, 'structure.yaml'), STRUCTURE_YAML);
    mkdirSync(plansDir, { recursive: true });
    for (const plan of plans) writeFileSync(path.join(plansDir, `${plan.lesson_id}.json`), JSON.stringify(plan));
    const kcGraph = path.join(dir, 'kc.json');
    writeFileSync(kcGraph, JSON.stringify({ kcs: Object.entries(kcsFor(plans)).map(([key, value]) => ({ key, objective: value.objective })) }));
    return { dir, args: ['--structure', path.join(dir, 'structure.yaml'), '--plans', plansDir, '--kc-graph', kcGraph, '--out', path.join(dir, 'out')] };
  }

  it('writes the three files, and --check passes until a file goes stale', () => {
    quietLog();
    const errors = quietError();
    const { dir, args } = fixtureProject();
    expect(main(args)).toBe(0);
    for (const name of HIERARCHY_FILES) expect(existsSync(path.join(dir, 'out', name))).toBe(true);
    expect(main([...args, '--check'])).toBe(0);
    writeFileSync(path.join(dir, 'out', 'ids.json'), '{}\n');
    expect(main([...args, '--check'])).toBe(1);
    expect(errors).toHaveBeenLastCalledWith(expect.stringMatching(/stale or missing .*ids\.json/));
  });

  it('prints every problem and exits 1 when the plans and the structure disagree', () => {
    quietLog();
    const errors = quietError();
    const { dir, args } = fixtureProject();
    writeFileSync(path.join(dir, 'structure.yaml'), STRUCTURE_YAML.replace('v2-running-ledger', 'v2-not-authored'));
    expect(main(args)).toBe(1);
    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/blocked:[\s\S]*v2-not-authored has no plan[\s\S]*v2-running-ledger is not listed in the structure/));
  });
});
