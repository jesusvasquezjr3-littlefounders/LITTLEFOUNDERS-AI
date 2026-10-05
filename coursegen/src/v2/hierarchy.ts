// v2 hierarchy generator: turns a v2 structure file plus its lesson plans into
// the Vault hierarchy rows a real publish needs (courses -> adventures ->
// sagas -> topics -> lessons, plus topic_knowledge_components).
//
// Why it exists: publish_v2_lesson_version(p_lesson_id uuid, ...) needs a
// `public.lessons` row and requires document.lesson_id = p_lesson_id::text
// (migration 0221), while a plan carries a slug lesson_id. The generator is
// pure and deterministic: ids are UUIDv5 over a fixed namespace of the slug
// path, so a rerun is byte-identical and the same lesson always gets the same
// uuid. It never touches a database; the SQL it renders is for the owner to
// review and run.
//
// Mapping (S05-B6-PATHWAY-POLICY P1, F1):
//   v2 chapter            -> adventure (pathway_stage, eligibility_min/max_age)
//   (default) one saga    -> per chapter, same slug as the chapter
//   v2 lesson             -> one topic (authored order) holding one lesson
//   plan knowledge comps  -> topic_knowledge_components, first = primary
// Everything lands unpublished: adventures, sagas and topics as 'draft',
// lessons as 'review'. A human publishes.

import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { V2_AGE_BANDS, V2_ID, type V2AgeBand } from './contract.js';
import type { V2LessonPlan } from './plan.js';

/** Fixed UUIDv5 namespace of every v2 hierarchy id. Changing it changes every id. */
export const HIERARCHY_NAMESPACE = 'a3c1f0de-5b7e-4c21-9d34-7e6f1b2a8c90';

export type Locale = 'en-US' | 'es-MX' | 'pt-BR';
export type Localized = Record<Locale, string>;
export type PathwayStage = 'child' | 'tween' | 'teen' | 'adult';
export type AgeTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

/** What the generator needs of a knowledge component (database/seeds/kc_graph.v1.json). */
export interface KcInfo { objective: Localized }

export class HierarchyError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'HierarchyError';
  }
}

/** RFC 4122 section 4.3 name-based UUID, SHA-1. */
export function uuidV5(name: string, namespace: string = HIERARCHY_NAMESPACE): string {
  const hash = createHash('sha1').update(Buffer.from(namespace.replace(/-/g, ''), 'hex')).update(name, 'utf8').digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type HierarchyLevel = 'course' | 'adventure' | 'saga' | 'topic' | 'lesson';

/** The id of one node: UUIDv5 over `<level>:<slug>/<slug>/...` (the level keeps same-slug nodes apart). */
export function hierarchyId(level: HierarchyLevel, ...slugPath: string[]): string {
  return uuidV5(`${level}:${slugPath.join('/')}`);
}

const id = z.string().regex(V2_ID);
const localizedText = z.object({ 'en-US': z.string().trim().min(1), 'es-MX': z.string().trim().min(1), 'pt-BR': z.string().trim().min(1) });

/** The slice of pilot.structure.yaml the generator reads (the rest of the file is the planning record). */
export const structureSchema = z.object({
  course_id: id,
  pathways: z
    .array(
      z.object({
        pathway_id: id,
        age_band: z.enum(V2_AGE_BANDS),
        chapters: z
          .array(z.object({ chapter_id: id, title: localizedText, lessons: z.array(z.object({ lesson_id: id })).min(1) }))
          .min(1),
      }),
    )
    .min(1),
});
export type V2Structure = z.infer<typeof structureSchema>;

export function parseStructure(yamlText: string): V2Structure {
  const parsed = structureSchema.safeParse(parseYaml(yamlText));
  if (!parsed.success) throw new HierarchyError(parsed.error.issues.map((issue) => `structure ${issue.path.join('.') || '(root)'}: ${issue.message}`));
  return parsed.data;
}

export interface CourseMetadata {
  title: Localized;
  description: Localized;
  subject: 'money' | 'math' | 'science' | 'economics' | 'code' | 'mixed';
  position: number;
  badge_asset: string;
  requires?: string[];
}

/**
 * Metadata used only when the course row does not exist yet (a fresh database).
 * Mirrors database/seeds/dev_seed.sql; a live course is never modified.
 */
export const COURSE_METADATA: Readonly<Record<string, CourseMetadata>> = {
  'financial-education': {
    title: { 'en-US': 'Financial Education', 'es-MX': 'Educación Financiera', 'pt-BR': 'Educação Financeira' },
    description: {
      'en-US': 'Learn what money is, how it works, and how to make it work for you.',
      'es-MX': 'Aprende qué es el dinero, cómo funciona y cómo hacerlo trabajar para ti.',
      'pt-BR': 'Aprenda o que é dinheiro, como funciona e como fazê-lo trabalhar para você.',
    },
    subject: 'money',
    position: 1,
    badge_asset: 'course-badges/financial-education.png',
  },
  entrepreneurship: {
    title: { 'en-US': 'Entrepreneurship', 'es-MX': 'Emprendimiento', 'pt-BR': 'Empreendedorismo' },
    description: {
      'en-US': 'Learn how to turn an idea into something real that people want.',
      'es-MX': 'Aprende cómo convertir una idea en algo real que la gente quiera.',
      'pt-BR': 'Aprenda como transformar uma ideia em algo real que as pessoas queiram.',
    },
    subject: 'economics',
    position: 2,
    badge_asset: 'course-badges/entrepreneurship.png',
    requires: ['financial-education'],
  },
  investing: {
    title: { 'en-US': 'Investing', 'es-MX': 'Inversiones', 'pt-BR': 'Investimentos' },
    description: {
      'en-US': 'Learn how money can grow over time by putting it to work wisely.',
      'es-MX': 'Aprende cómo el dinero puede crecer con el tiempo al ponerlo a trabajar con sabiduría.',
      'pt-BR': 'Aprenda como o dinheiro pode crescer com o tempo ao colocá-lo para trabalhar com sabedoria.',
    },
    subject: 'money',
    position: 3,
    badge_asset: 'course-badges/investing.png',
    requires: ['financial-education', 'entrepreneurship'],
  },
  'first-lemonade-stand': {
    title: { 'en-US': 'My First Lemonade Stand', 'es-MX': 'Mi Primer Puesto de Limonada', 'pt-BR': 'Minha Primeira Banca de Limonada' },
    description: {
      'en-US': 'Run a small stall of your own: count coins, give exact change, set a fair price, tell needs from wants, and save what is left. One small money skill per lesson.',
      'es-MX': 'Maneja un puesto propio: contar monedas, dar el cambio exacto, poner un precio justo, distinguir necesidades de deseos y ahorrar lo que sobra. Una habilidad de dinero por lección.',
      'pt-BR': 'Tenha uma banca sua: contar moedas, dar o troco exato, definir um preço justo, separar necessidades de desejos e poupar o que sobra. Uma habilidade de dinheiro por lição.',
    },
    subject: 'mixed',
    position: 0,
    badge_asset: 'course-badges/first-lemonade-stand.png',
  },
};

/** adventures.theme is NOT NULL with a closed set (0007); the course's first adventure uses this one. */
export const DEFAULT_ADVENTURE_THEME = 'archipelago';
/** map_version of the generated topic-to-KC links, matching kc_topic_map.v1.json. */
export const KC_MAP_VERSION = 1;

export interface CourseRow {
  id: string;
  slug: string;
  title: Localized;
  description: Localized;
  subject: CourseMetadata['subject'];
  status: 'draft';
  position: number;
  requires: string[];
  badge_asset: string;
}
export interface AdventureRow {
  id: string;
  course_id: string;
  position: number;
  slug: string;
  title: Localized;
  theme: string;
  age_tier: AgeTier;
  status: 'draft';
  pathway_stage: PathwayStage;
  eligibility_min_age: number;
  eligibility_max_age: number;
}
export interface SagaRow { id: string; adventure_id: string; position: number; slug: string; title: Localized; status: 'draft' }
export interface TopicRow {
  id: string;
  saga_id: string;
  position: number;
  slug: string;
  title: Localized;
  learning_objective: Localized;
  kind: 'teaching';
  status: 'draft';
}
export interface LessonRow { id: string; topic_id: string; position: number; slug: string; title: Localized; status: 'review' }
/** `kc_key` stands in for the kc_id uuid: Vault assigns kc ids, so the SQL resolves the key at run time. */
export interface TopicKcRow { topic_id: string; kc_key: string; role: 'teaches' | 'reviews'; is_primary: boolean; map_version: number }

export interface HierarchyRows {
  courses: CourseRow[];
  adventures: AdventureRow[];
  sagas: SagaRow[];
  topics: TopicRow[];
  lessons: LessonRow[];
  topic_knowledge_components: TopicKcRow[];
}
export interface Hierarchy {
  courseSlug: string;
  rows: HierarchyRows;
  /** lesson slug -> public.lessons.id, in authored order. */
  ids: Record<string, string>;
}

const STAGE_BY_BAND: Record<V2AgeBand, PathwayStage> = { '6-9': 'child', '10-12': 'tween', '13-17': 'teen', adult: 'adult' };
const BAND_AGES: Record<V2AgeBand, [number, number]> = { '6-9': [6, 9], '10-12': [10, 12], '13-17': [13, 17], adult: [18, 119] };

/** P1 tier table: tier1 6-7, tier2 8-10 (child), tier3 11-12 (tween), tier4 12-18 (teen and up). Informational: explicit pathway columns decide eligibility. */
export function ageTierFor(stage: PathwayStage, minimumAge: number): AgeTier {
  if (stage === 'child') return minimumAge <= 7 ? 'tier1' : 'tier2';
  if (stage === 'tween') return 'tier3';
  return 'tier4';
}

export function buildHierarchy(input: { structure: V2Structure; plans: readonly V2LessonPlan[]; kcs: Readonly<Record<string, KcInfo>> }): Hierarchy {
  const { structure, plans, kcs } = input;
  const problems: string[] = [];
  const course = structure.course_id;
  const meta = COURSE_METADATA[course];
  if (!meta) problems.push(`no course metadata for "${course}" in COURSE_METADATA; add it before generating a course row`);

  const planById = new Map<string, V2LessonPlan>();
  for (const plan of plans) {
    if (planById.has(plan.lesson_id)) problems.push(`two plans carry lesson_id ${plan.lesson_id}`);
    planById.set(plan.lesson_id, plan);
  }
  const listed = new Set<string>();

  const rows: HierarchyRows = { courses: [], adventures: [], sagas: [], topics: [], lessons: [], topic_knowledge_components: [] };
  const ids: Record<string, string> = {};
  const courseId = hierarchyId('course', course);
  if (meta) rows.courses.push({ id: courseId, slug: course, title: meta.title, description: meta.description, subject: meta.subject, status: 'draft', position: meta.position, requires: meta.requires ?? [], badge_asset: meta.badge_asset });

  let adventurePosition = 0;
  for (const pathway of structure.pathways) {
    const [bandMin, bandMax] = BAND_AGES[pathway.age_band];
    const stage = STAGE_BY_BAND[pathway.age_band];
    for (const chapter of pathway.chapters) {
      adventurePosition += 1;
      const adventureId = hierarchyId('adventure', course, chapter.chapter_id);
      const sagaSlug = chapter.chapter_id;
      const sagaId = hierarchyId('saga', course, chapter.chapter_id, sagaSlug);
      const where = `${pathway.pathway_id}/${chapter.chapter_id}`;
      let minAge = Infinity;
      let maxAge = -Infinity;

      chapter.lessons.forEach((entry, index) => {
        const slug = entry.lesson_id;
        listed.add(slug);
        const plan = planById.get(slug);
        if (!plan) { problems.push(`${where}: lesson ${slug} has no plan`); return; }
        if (plan.course_id !== course || plan.pathway_id !== pathway.pathway_id || plan.chapter_id !== chapter.chapter_id) {
          problems.push(`${slug}: the plan says ${plan.course_id}/${plan.pathway_id}/${plan.chapter_id} but the structure places it in ${course}/${where}`);
        }
        if (plan.age_band !== pathway.age_band) problems.push(`${slug}: plan age_band ${plan.age_band} differs from its pathway's ${pathway.age_band}`);
        const { minimum_age: lo, maximum_age: hi } = plan.eligibility;
        if (lo > hi) problems.push(`${slug}: eligibility minimum_age ${lo} is above maximum_age ${hi}`);
        if (lo < bandMin || hi > bandMax) problems.push(`${slug}: eligibility ${lo}-${hi} falls outside the ${pathway.age_band} band`);
        minAge = Math.min(minAge, lo);
        maxAge = Math.max(maxAge, hi);

        const keys = plan.knowledge_component_ids;
        if (new Set(keys).size !== keys.length) problems.push(`${slug}: knowledge_component_ids repeats a key`);
        for (const key of keys) if (!kcs[key]) problems.push(`${slug}: knowledge component ${key} is not in the KC graph`);
        const primary = kcs[keys[0]!];

        const topicId = hierarchyId('topic', course, chapter.chapter_id, sagaSlug, slug);
        const lessonId = hierarchyId('lesson', course, chapter.chapter_id, sagaSlug, slug, slug);
        ids[slug] = lessonId;
        rows.topics.push({
          id: topicId, saga_id: sagaId, position: index + 1, slug, title: plan.title,
          learning_objective: primary ? primary.objective : plan.title, kind: 'teaching', status: 'draft',
        });
        rows.lessons.push({ id: lessonId, topic_id: topicId, position: 1, slug, title: plan.title, status: 'review' });
        keys.forEach((key, position) => {
          const isPrimary = position === 0;
          rows.topic_knowledge_components.push({
            topic_id: topicId, kc_key: key, role: isPrimary || plan.new_concepts.includes(key) ? 'teaches' : 'reviews',
            is_primary: isPrimary, map_version: KC_MAP_VERSION,
          });
        });
      });

      if (Number.isFinite(minAge)) {
        rows.adventures.push({
          id: adventureId, course_id: courseId, position: adventurePosition, slug: chapter.chapter_id, title: chapter.title,
          theme: DEFAULT_ADVENTURE_THEME, age_tier: ageTierFor(stage, minAge), status: 'draft',
          pathway_stage: stage, eligibility_min_age: minAge, eligibility_max_age: maxAge,
        });
        rows.sagas.push({ id: sagaId, adventure_id: adventureId, position: 1, slug: sagaSlug, title: chapter.title, status: 'draft' });
      }
    }
  }
  for (const slug of planById.keys()) if (!listed.has(slug)) problems.push(`plan ${slug} is not listed in the structure`);
  if (problems.length) throw new HierarchyError(problems);
  return { courseSlug: course, rows, ids };
}

export function renderRowsJson(hierarchy: Hierarchy): string {
  return `${JSON.stringify({ namespace: HIERARCHY_NAMESPACE, course_slug: hierarchy.courseSlug, tables: hierarchy.rows }, null, 2)}\n`;
}

export function renderIdsJson(hierarchy: Hierarchy): string {
  return `${JSON.stringify(hierarchy.ids, null, 2)}\n`;
}

// ── SQL ──────────────────────────────────────────────────────────────────

const RESERVED_COLUMNS = new Set(['cast', 'user', 'order', 'group']);
const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

function sqlJson(value: unknown): string {
  const text = JSON.stringify(value);
  if (text.includes('$lf$')) throw new HierarchyError([`a value contains the SQL quote tag $lf$: ${text.slice(0, 80)}`]);
  return `$lf$${text}$lf$::jsonb`;
}

function sqlValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'string') return sqlString(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new HierarchyError([`a non-finite number reached the SQL renderer`]);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return sqlJson(value);
}

const column = (name: string): string => (RESERVED_COLUMNS.has(name) ? `"${name}"` : name);

function insertRows(table: string, rows: readonly object[]): string {
  if (!rows.length) return `-- ${table}: no rows\n`;
  const columns = Object.keys(rows[0]!);
  const tuples = rows.map((row) => {
    const keys = Object.keys(row);
    if (keys.join() !== columns.join()) throw new HierarchyError([`${table}: rows disagree on their columns`]);
    return `  (${Object.values(row).map(sqlValue).join(', ')})`;
  });
  return `INSERT INTO public.${table} (${columns.map(column).join(', ')})\nVALUES\n${tuples.join(',\n')}\nON CONFLICT DO NOTHING;\n`;
}

/** An adventure resolves its course by slug (a live course keeps its own id) and appends after the course's existing adventures. */
function insertAdventures(rows: readonly AdventureRow[], courseSlug: string): string {
  if (!rows.length) return '-- adventures: no rows\n';
  const columns = Object.keys(rows[0]!);
  const statements = rows.map((row) => {
    const values = Object.entries(row).map(([name, value]) => {
      if (name === 'course_id') return 'c.id';
      if (name === 'position') return `COALESCE((SELECT max(a.position) FROM public.adventures a WHERE a.course_id = c.id), 0) + 1`;
      return sqlValue(value);
    });
    return `INSERT INTO public.adventures (${columns.map(column).join(', ')})\nSELECT ${values.join(', ')}\nFROM public.courses c WHERE c.slug = ${sqlString(courseSlug)}\nON CONFLICT DO NOTHING;\n`;
  });
  return statements.join('\n');
}

function insertTopicKcs(rows: readonly TopicKcRow[]): string {
  if (!rows.length) return '-- topic_knowledge_components: no rows\n';
  const tuples = rows.map((r) => `  (${sqlString(r.topic_id)}, ${sqlString(r.kc_key)}, ${sqlString(r.role)}, ${r.is_primary}, ${r.map_version})`);
  return [
    'INSERT INTO public.topic_knowledge_components (topic_id, kc_id, role, is_primary, map_version)',
    'SELECT v.topic_id::uuid, k.id, v.role, v.is_primary, v.map_version',
    `FROM (VALUES\n${tuples.join(',\n')}\n) AS v(topic_id, kc_key, role, is_primary, map_version)`,
    'JOIN public.kc k ON k.key = v.kc_key',
    'ON CONFLICT DO NOTHING;',
    '',
  ].join('\n');
}

const uuidList = (values: readonly string[]): string => `ARRAY[${values.map((v) => sqlString(v)).join(', ')}]::uuid[]`;

function missingRowsAssertion(rows: HierarchyRows): string {
  const present = (table: string, ids: readonly string[]) =>
    `SELECT '${table}:' || e.id FROM unnest(${uuidList(ids)}) AS e(id) WHERE NOT EXISTS (SELECT 1 FROM public.${table} t WHERE t.id = e.id)`;
  const links = rows.topic_knowledge_components.map((r) => `(${sqlString(r.topic_id)}, ${sqlString(r.kc_key)})`);
  const parts = [
    present('adventures', rows.adventures.map((r) => r.id)),
    present('sagas', rows.sagas.map((r) => r.id)),
    present('topics', rows.topics.map((r) => r.id)),
    present('lessons', rows.lessons.map((r) => r.id)),
  ];
  if (links.length) {
    parts.push(
      `SELECT 'topic_knowledge_components:' || v.topic_id || '/' || v.kc_key FROM (VALUES ${links.join(', ')}) AS v(topic_id, kc_key) ` +
        'WHERE NOT EXISTS (SELECT 1 FROM public.topic_knowledge_components l JOIN public.kc k ON k.id = l.kc_id WHERE l.topic_id = v.topic_id::uuid AND k.key = v.kc_key)',
    );
  }
  return [
    'DO $lfassert$',
    'DECLARE v_missing text;',
    'BEGIN',
    `  SELECT string_agg(m.item, ', ') INTO v_missing FROM (\n    ${parts.join('\n    UNION ALL\n    ')}\n  ) AS m(item);`,
    "  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'v2 hierarchy seed is incomplete: %', v_missing; END IF;",
    'END',
    '$lfassert$;',
    '',
  ].join('\n');
}

function kcPrecondition(rows: HierarchyRows): string {
  const keys = [...new Set(rows.topic_knowledge_components.map((r) => r.kc_key))].sort();
  if (!keys.length) return '';
  return [
    'DO $lfkc$',
    'DECLARE v_missing text;',
    'BEGIN',
    `  SELECT string_agg(k.key, ', ') INTO v_missing FROM unnest(ARRAY[${keys.map(sqlString).join(', ')}]) AS k(key)`,
    '  WHERE NOT EXISTS (SELECT 1 FROM public.kc WHERE kc.key = k.key);',
    "  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'knowledge components missing from public.kc (run backend seed:kc first): %', v_missing; END IF;",
    'END',
    '$lfkc$;',
    '',
  ].join('\n');
}

export function renderSql(hierarchy: Hierarchy): string {
  const { rows, courseSlug } = hierarchy;
  const count = (n: number, noun: string) => `${n} ${noun}`;
  return [
    `-- v2 hierarchy seed for "${courseSlug}". GENERATED by \`npm run v2:hierarchy\` in coursegen; do not edit by hand.`,
    '--',
    `-- Creates ${count(rows.adventures.length, 'adventure(s)')}, ${count(rows.sagas.length, 'saga(s)')}, ${count(rows.topics.length, 'topic(s)')}, ${count(rows.lessons.length, 'lesson(s)')} and ${count(rows.topic_knowledge_components.length, 'topic-to-KC link(s)')}.`,
    '-- Create-only and idempotent: every INSERT is ON CONFLICT DO NOTHING, so a rerun changes nothing and an existing row is never overwritten.',
    '-- Ids are UUIDv5 of the slug path (ids.json maps each lesson slug to its public.lessons.id).',
    '-- Nothing is published: adventures, sagas and topics are inserted as draft and lessons as review. A human publishes.',
    '-- The course row is only created when the slug is absent. Adventures resolve the course by slug and append after its existing adventures.',
    '-- Knowledge components resolve by key from public.kc (seed:kc must have loaded them, draft ones included).',
    '--',
    '-- REVIEW GATE: the file ends in ROLLBACK, so running it as-is persists nothing. It still executes every statement and the',
    '-- completeness check, which raises if any row or link did not land. After reading it, replace the final ROLLBACK with COMMIT.',
    '',
    'BEGIN;',
    '',
    kcPrecondition(rows),
    '-- courses',
    insertRows('courses', rows.courses),
    '-- adventures (one per v2 chapter)',
    insertAdventures(rows.adventures, courseSlug),
    '-- sagas (one per chapter)',
    insertRows('sagas', rows.sagas),
    '-- topics (one per lesson, authored order)',
    insertRows('topics', rows.topics),
    '-- lessons (review, never published)',
    insertRows('lessons', rows.lessons),
    '-- topic_knowledge_components (first KC of a lesson is primary)',
    insertTopicKcs(rows.topic_knowledge_components),
    '-- completeness check',
    missingRowsAssertion(rows),
    '-- Replace ROLLBACK with COMMIT after review.',
    'ROLLBACK;',
    '',
  ].join('\n');
}

// ── lesson-ids rewrite (releaseCli --lesson-ids) ─────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Validates an ids.json: a flat object of lesson slug -> lowercase uuid. */
export function parseLessonIds(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HierarchyError(['the lesson-ids file must be a JSON object of lesson slug -> uuid']);
  const out: Record<string, string> = {};
  const problems: string[] = [];
  for (const [slug, value] of Object.entries(raw)) {
    if (typeof value !== 'string' || !UUID.test(value)) problems.push(`lesson-ids ${slug}: ${JSON.stringify(value)} is not a lowercase uuid`);
    else out[slug] = value;
  }
  if (problems.length) throw new HierarchyError(problems);
  return out;
}

/**
 * Rewrites each plan's slug `lesson_id` to its Vault uuid so the emitted
 * document.lesson_id equals p_lesson_id (0221). A plan already carrying one of
 * the uuids passes through; a slug with no entry is a problem, never guessed.
 */
export function applyLessonIds<T extends { lesson_id: string }>(plans: readonly T[], ids: Readonly<Record<string, string>>): { plans: T[]; problems: string[] } {
  const known = new Set(Object.values(ids));
  const problems: string[] = [];
  const out = plans.map((plan) => {
    const uuid = ids[plan.lesson_id];
    if (uuid) return { ...plan, lesson_id: uuid };
    if (known.has(plan.lesson_id)) return plan;
    problems.push(`${plan.lesson_id}: no Vault lesson id in the lesson-ids file`);
    return plan;
  });
  return { plans: out, problems };
}
