// publish stage — COURSE_ENGINE.md §4/§6. Splits each locale's document into
// the client-safe `document` (answer stripped from every segment) +
// server-only `answer_keys` map, then upserts the full hierarchy path by
// slug (course → adventure → saga → topic → lesson → lesson_documents×N).
// Lessons land as status='review' — publishing to 'published' is a human
// action (blocking gate for kids' content, non-negotiable, §6).

import { vaultUpsert } from '../vault/restClient.js';
import type { LessonDocumentParsed } from '../contract/schema.js';
import type { LessonLocale } from '../contract/core/types.js';

export interface ClientSafeSegment {
  [key: string]: unknown;
}

export interface SplitDocumentResult {
  clientDocument: Record<string, unknown>;
  answerKeys: Record<string, unknown>;
}

/** The single sanctioned stripper on the Forge side — mirrors stripAnswers() (LESSON_ENGINE.md §3). */
export function splitDocument(document: LessonDocumentParsed): SplitDocumentResult {
  const answerKeys: Record<string, unknown> = {};
  const segments = document.segments.map((segment) => {
    const { answer, ...rest } = segment as { answer?: unknown; id: string } & Record<string, unknown>;
    if (answer !== undefined) answerKeys[rest.id as string] = answer;
    return rest as ClientSafeSegment;
  });
  return {
    clientDocument: { ...document, segments },
    answerKeys,
  };
}

export function computeXpTotal(document: LessonDocumentParsed): number {
  return document.segments.reduce((sum, segment) => sum + (segment as { xp: number }).xp, 0);
}

function titleMapFromDocuments(documents: Partial<Record<LessonLocale, LessonDocumentParsed>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [locale, doc] of Object.entries(documents) as [LessonLocale, LessonDocumentParsed | undefined][]) {
    if (doc) out[locale] = doc.meta.title;
  }
  return out;
}

interface LocalizedText {
  'en-US': string;
  'es-MX': string;
  'pt-BR': string;
}

export interface PublishInput {
  course: {
    slug: string;
    subject: string;
    title: LocalizedText;
    description: LocalizedText;
    position: number;
  };
  adventure: {
    slug: string;
    position: number;
    theme: string;
    /**
     * Whatever tier key the course's taxonomy.yaml age_tiers declares
     * (tier1/tier2 today, tier3 once Inversiones lands — COURSE_ENGINE.md
     * §3.1b) — NOT a closed literal union here; the catalog is the source
     * of truth (§1.3-style: no hardcoded taxonomy in code). Vault's
     * `adventures.age_tier` column CHECK constraint (database/migrations/
     * 0007) is a separate, DB-level gate — out of scope for coursegen/src.
     */
    ageTier: string;
    title: LocalizedText;
    description: LocalizedText;
    narrativeArc: string;
  };
  saga: {
    slug: string;
    position: number;
    icon: string;
    title: LocalizedText;
    description: LocalizedText;
  };
  topic: {
    slug: string;
    position: number;
    title: LocalizedText;
    conceptMd: string;
    learningObjective: LocalizedText;
    keyVocabulary: string[];
    priorKnowledge: string;
    /** Blueprint pedagogy projection (0016): 'teaching' | review kinds. */
    kind: string;
    /** Raw catalog slug paths ("adv/saga" or "adv/saga/topic") — resolved at query time. */
    reviewOf: string[];
  };
  lesson: {
    slug: string;
    position: number;
    difficulty: 1 | 2 | 3 | 4 | 5;
    estimatedMinutes: number;
    cast: string[];
  };
  /** One entry per locale successfully generated for this slot — at least one required. */
  documents: Partial<Record<LessonLocale, LessonDocumentParsed>>;
}

interface RowWithId {
  id: string;
}

export interface PublishResult {
  courseId: string;
  adventureId: string;
  sagaId: string;
  topicId: string;
  lessonId: string;
  xpTotal: number;
  localesPublished: LessonLocale[];
}

export async function publishLessonSlot(input: PublishInput): Promise<PublishResult> {
  const localeEntries = Object.entries(input.documents).filter(
    (entry): entry is [LessonLocale, LessonDocumentParsed] => entry[1] !== undefined,
  );
  if (localeEntries.length === 0) {
    throw new Error(`publish: slot "${input.lesson.slug}" has no generated documents to publish`);
  }

  const [course] = await vaultUpsert<RowWithId>(
    'courses',
    [{ slug: input.course.slug, subject: input.course.subject, title: input.course.title, description: input.course.description, position: input.course.position }],
    'slug',
  );
  if (!course) throw new Error('publish: course upsert returned no row');

  const [adventure] = await vaultUpsert<RowWithId>(
    'adventures',
    [
      {
        course_id: course.id,
        position: input.adventure.position,
        slug: input.adventure.slug,
        title: input.adventure.title,
        description: input.adventure.description,
        narrative_arc: input.adventure.narrativeArc,
        theme: input.adventure.theme,
        age_tier: input.adventure.ageTier,
      },
    ],
    'course_id,slug',
  );
  if (!adventure) throw new Error('publish: adventure upsert returned no row');

  const [saga] = await vaultUpsert<RowWithId>(
    'sagas',
    [
      {
        adventure_id: adventure.id,
        position: input.saga.position,
        slug: input.saga.slug,
        title: input.saga.title,
        description: input.saga.description,
        icon: input.saga.icon,
      },
    ],
    'adventure_id,slug',
  );
  if (!saga) throw new Error('publish: saga upsert returned no row');

  const [topic] = await vaultUpsert<RowWithId>(
    'topics',
    [
      {
        saga_id: saga.id,
        position: input.topic.position,
        slug: input.topic.slug,
        title: input.topic.title,
        concept_md: input.topic.conceptMd,
        learning_objective: input.topic.learningObjective,
        key_vocabulary: input.topic.keyVocabulary,
        prior_knowledge: input.topic.priorKnowledge,
        // Spaced-review projection (0016) — feeds the always-on retention
        // metric (admin_retention_* functions); the catalog stays the source
        // of truth, publish just keeps Vault's copy current.
        kind: input.topic.kind,
        review_of: input.topic.reviewOf,
      },
    ],
    'saga_id,slug',
  );
  if (!topic) throw new Error('publish: topic upsert returned no row');

  // xp_total is computed per-locale (segment counts should match across
  // locales by construction — localize.ts freezes structure); the first
  // available document is authoritative.
  const xpTotal = computeXpTotal(localeEntries[0]![1]);

  const [lesson] = await vaultUpsert<RowWithId>(
    'lessons',
    [
      {
        topic_id: topic.id,
        position: input.lesson.position,
        slug: input.lesson.slug,
        title: titleMapFromDocuments(input.documents),
        difficulty: input.lesson.difficulty,
        xp_total: xpTotal,
        estimated_minutes: input.lesson.estimatedMinutes,
        cast: input.lesson.cast,
        status: 'review',
      },
    ],
    'topic_id,slug',
  );
  if (!lesson) throw new Error('publish: lesson upsert returned no row');

  const documentRows = localeEntries.map(([locale, document]) => {
    const { clientDocument, answerKeys } = splitDocument(document);
    return {
      lesson_id: lesson.id,
      locale,
      schema_version: 1,
      document: clientDocument,
      answer_keys: answerKeys,
      // New/changed text invalidates any prior narration: reset the manifest
      // so Echo's batch (which only picks rows with audio->>version null)
      // re-narrates this document instead of leaving stale clips attached.
      audio: {},
    };
  });
  await vaultUpsert('lesson_documents', documentRows, 'lesson_id,locale');

  return {
    courseId: course.id,
    adventureId: adventure.id,
    sagaId: saga.id,
    topicId: topic.id,
    lessonId: lesson.id,
    xpTotal,
    localesPublished: localeEntries.map(([locale]) => locale),
  };
}
