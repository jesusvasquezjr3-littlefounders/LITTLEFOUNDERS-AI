/*
 * author-publish — write subagent-authored lesson bundles into Vault.
 *
 * This calls the pipeline's own `publishLessonSlot`, unchanged: the hierarchy
 * upsert, the (parent_id, slug) identity rule that keeps learner progress
 * attached across republishes, the `renamed_from` migration, the answer-key
 * split (`splitDocument` is the ONLY sanctioned stripper — never hand-strip
 * elsewhere), the audio reset, and the refusal to silently overwrite a lesson
 * that is already live. Nothing about publishing is reimplemented here.
 *
 * Lessons land as status='review'. That is COURSE_ENGINE.md §6's human gate and
 * it is not a limitation of this script: kid-facing content is released by a
 * person, in Core, after reading it.
 *
 * REFUSES to publish a slot unless all THREE locales are present and each one
 * re-parses against the contract at publish time (a lesson is an atomic
 * three-locale release unit — a partial bundle makes a course unreleasable in
 * two languages).
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.production src/scripts/author-publish.ts \
 *     --course <slug> --dir <d> [--titles <file>] [--confirm-production]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadCourseCatalog } from '../catalog/loader.js';
import { enumerateSlots, type Slot } from '../pipeline/run.js';
import { resolveRegister } from '../pipeline/register.js';
import { lessonDocumentSchema, type LessonDocumentParsed } from '../contract/schema.js';
import { LESSON_LOCALES, type LessonLocale } from '../contract/core/types.js';
import { publishLessonSlot, type PublishInput } from '../pipeline/publish.js';
import { vaultPatch } from '../vault/restClient.js';
import { getConfig } from '../env.js';

interface Args {
  course: string;
  dir: string;
  titles?: string;
  confirmProduction: boolean;
  /**
   * `publishLessonSlot` hardcodes position 0, which was unambiguous while
   * Vault held exactly one course. A SECOND course at position 0 leaves the
   * learner-facing order undefined, and this one explicitly `requires`
   * financial-education, so it belongs after it. Made an operator decision
   * rather than a guess baked into a script.
   */
  coursePosition: number;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { confirmProduction: false, coursePosition: 0 };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    const take = (name: string): string => {
      if (value === undefined || value.startsWith('--')) throw new Error(`author-publish: ${name} requires a value`);
      i++;
      return value;
    };
    if (argv[i] === '--course') args.course = take('--course');
    else if (argv[i] === '--dir') args.dir = take('--dir');
    else if (argv[i] === '--titles') args.titles = take('--titles');
    else if (argv[i] === '--confirm-production') args.confirmProduction = true;
    else if (argv[i] === '--course-position') {
      const raw = take('--course-position');
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`author-publish: --course-position must be a non-negative integer, got "${raw}"`);
      args.coursePosition = parsed;
    }
    else throw new Error(`author-publish: unknown flag "${argv[i]}"`);
  }
  if (!args.course || !args.dir) throw new Error('author-publish: --course and --dir are required');
  return args as Args;
}

function readDocument(path: string, label: string): LessonDocumentParsed {
  const parsed = lessonDocumentSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.success) {
    throw new Error(`author-publish: ${label} failed contract validation at publish time — refusing to write it`);
  }
  return parsed.data;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = getConfig();
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('author-publish: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  /*
   * Writing to production is a decision, never a default (agent/core/
   * BOUNDARIES.md). A localhost Supabase URL is obviously the dev stack; a
   * remote one is not obviously anything, so it has to be affirmed.
   */
  const isLocal = /localhost|127\.0\.0\.1/.test(config.SUPABASE_URL);
  if (!isLocal && !args.confirmProduction) {
    throw new Error(
      `author-publish: SUPABASE_URL points at a REMOTE Vault (${new URL(config.SUPABASE_URL).host}). ` +
        'Pass --confirm-production to write there on purpose.',
    );
  }

  const load = loadCourseCatalog(join('curriculum', args.course));
  const errors = load.issues.filter((i) => i.level === 'error');
  if (errors.length > 0) throw new Error(`author-publish: catalog has ${errors.length} error(s)`);
  const { catalog, taxonomy } = load.course;
  if (!catalog || !taxonomy) throw new Error('author-publish: course catalog/taxonomy failed to load');

  const register = resolveRegister(taxonomy, 'kid');
  if (register.slugSuffix !== '') throw new Error('author-publish: only the kid register is supported here');
  const slotsById = new Map<string, Slot>(enumerateSlots(load.course.adventures).map((s) => [s.slotId, s]));

  // Topic titles are authored es-MX-only (`title_es`); en-US/pt-BR are filled
  // at publish time. The pipeline uses a model call per title; here a subagent
  // produced them ahead of time into one file, keyed by topic slug.
  const titles: Record<string, { 'en-US': string; 'pt-BR': string }> = args.titles
    ? JSON.parse(readFileSync(args.titles, 'utf8'))
    : {};

  const report = JSON.parse(readFileSync(join(args.dir, 'report.json'), 'utf8')) as {
    slots: Array<{ slotId: string; out: string; ok: boolean }>;
  };
  const ready = report.slots.filter((s) => s.ok);
  if (ready.length === 0) throw new Error('author-publish: no validated slots to publish');

  const published: string[] = [];
  const failed: Array<{ slotId: string; error: string }> = [];

  for (const entry of ready) {
    const slot = slotsById.get(entry.slotId);
    if (!slot) throw new Error(`author-publish: "${entry.slotId}" is not in the catalog`);
    const stem = entry.out.replace(/^out\//, '').replace(/\.es-MX\.json$/, '');

    try {
      const documents: Partial<Record<LessonLocale, LessonDocumentParsed>> = {};
      for (const locale of LESSON_LOCALES) {
        const path = join(args.dir, `out/${stem}.${locale}.json`);
        if (!existsSync(path)) throw new Error(`missing the ${locale} document — a lesson ships as one complete 3-locale bundle`);
        documents[locale] = readDocument(path, `${stem}.${locale}.json`);
      }

      const topicTitle = titles[slot.topic.slug];
      if (!topicTitle?.['en-US'] || !topicTitle?.['pt-BR']) {
        // A blank topic title renders as an empty pill, not an error — exactly
        // the defect that shipped nine of ten topics unnamed in two locales.
        // Refuse instead of writing an untranslated or empty one.
        throw new Error(`no en-US/pt-BR title for topic "${slot.topic.slug}" — supply it via --titles`);
      }

      const input: PublishInput = {
        course: {
          slug: catalog.course.slug,
          subject: catalog.course.subject,
          title: catalog.course.title,
          description: catalog.course.description,
          position: args.coursePosition,
        },
        adventure: {
          slug: slot.adventure.slug,
          renamedFrom: slot.adventure.renamed_from,
          position: slot.adventure.position,
          theme: slot.adventure.theme,
          ageTier: slot.tier,
          title: slot.adventure.title,
          description: slot.adventure.description,
          narrativeArc: slot.adventure.narrative_arc,
        },
        saga: {
          slug: slot.saga.slug,
          renamedFrom: slot.saga.renamed_from,
          position: slot.saga.position,
          icon: slot.saga.icon,
          title: slot.saga.title,
          description: slot.saga.description,
        },
        topic: {
          slug: slot.topic.slug,
          renamedFrom: slot.topic.renamed_from,
          position: slot.topic.position,
          title: { 'es-MX': slot.topic.title_es, 'en-US': topicTitle['en-US'], 'pt-BR': topicTitle['pt-BR'] },
          conceptMd: slot.topic.concept,
          learningObjective: {
            'en-US': slot.topic.learning_objective,
            'es-MX': slot.topic.learning_objective,
            'pt-BR': slot.topic.learning_objective,
          },
          keyVocabulary: slot.topic.key_vocabulary,
          priorKnowledge: slot.topic.prior_knowledge,
          kind: slot.topic.kind ?? 'teaching',
          reviewOf: slot.topic.review_of ?? [],
          prerequisites: slot.topic.prerequisites ?? [],
          // Placement probes are generated by their own stage (COURSE_ENGINE.md
          // §3.2) and are deferred with audio and images. null = "not yet".
          placementProbe: null,
        },
        lesson: {
          slug: slot.lesson.slug,
          renamedFrom: slot.lesson.renamed_from,
          position: slot.lesson.position,
          ...(slot.lesson.optional_enrichment !== undefined ? { optionalEnrichment: slot.lesson.optional_enrichment } : {}),
          difficulty: slot.lesson.difficulty,
          estimatedMinutes: documents['es-MX']!.meta.estimated_minutes,
          cast: documents['es-MX']!.meta.cast,
        },
        documents,
        // First publish of a course that does not exist in Vault yet. If a slot
        // turns out to be live already, publish REFUSES rather than guessing —
        // which is the behaviour we want here, not something to paper over.
      };

      const result = await publishLessonSlot(input);
      published.push(entry.slotId);
      console.log(`  published ${entry.slotId} (lesson ${result.lessonId}, xp ${result.xpTotal}, ${result.localesPublished.join('/')})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ slotId: entry.slotId, error: message });
      console.error(`  FAILED ${entry.slotId}: ${message}`);
    }
  }

  /*
   * COURSE-LEVEL FIELDS THE PIPELINE DOES NOT WRITE.
   *
   * `publishLessonSlot` upserts only slug/subject/title/description/position,
   * so a course it creates from scratch has `badge_asset = NULL` and
   * `requires = []`. Both matter:
   *
   *  - Vault's `courses_published_badge_required_check` is
   *    `status <> 'published' OR badge_asset IS NOT NULL`, so a badge-less
   *    course can NEVER be released. The failure would surface later, to
   *    whoever tries to flip the switch, as a constraint violation with no
   *    obvious cause.
   *  - `requires` is the course-to-course prerequisite edge (COURSE_ENGINE.md
   *    §3.1b). This course assumes financial-education; dropping the edge
   *    silently offers it to a learner who has not done the money mechanics.
   *
   * Both live in catalog.yaml, so they are projected here rather than left to
   * a manual SQL fix nobody remembers to run.
   */
  if (published.length > 0) {
    const courseFields: Record<string, unknown> = { requires: catalog.course.requires ?? [] };
    if (catalog.course.badge_asset) courseFields.badge_asset = catalog.course.badge_asset;
    await vaultPatch(`/courses?slug=eq.${encodeURIComponent(catalog.course.slug)}`, courseFields);
    console.log(
      `  course fields set: requires=${JSON.stringify(courseFields.requires)}` +
        `${courseFields.badge_asset ? `, badge_asset=${courseFields.badge_asset}` : ' (no badge_asset in catalog — the course CANNOT be released until one is set)'}`,
    );
  }

  writeFileSync(
    join(args.dir, 'publish-report.json'),
    `${JSON.stringify({ course: args.course, vault: new URL(config.SUPABASE_URL).host, published, failed }, null, 2)}\n`,
    'utf8',
  );
  console.log(`\nauthor-publish: ${published.length} published as status='review', ${failed.length} failed`);
  console.log("Lessons are NOT learner-visible until a human releases them (COURSE_ENGINE.md §6).");
  if (failed.length > 0) process.exitCode = 1;
}

await main();
