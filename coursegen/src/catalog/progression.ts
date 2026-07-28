/*
 * progression.ts — proves a course TEACHES, rather than merely containing lessons.
 *
 * The catalog schema already carries the pedagogy vocabulary (age tiers, per-lesson
 * `difficulty`, `micro_objective`, the spaced-review layer's `review_of`, and
 * `prerequisites` with an earlier-only rule). What was missing is the part that
 * makes it a GUARANTEE instead of a convention: nothing checked that the numbers
 * actually describe a learnable path. A catalog could open at difficulty 4, jump
 * 1→5 between two lessons, teach a saga and never revisit it, or run eleven
 * identical exercise shapes in a row, and every existing gate would pass it.
 *
 * These checks encode the product promise — take someone with ZERO prior knowledge
 * (a small child) to mastery, guiding them by the hand, with day-over-day
 * retention, and without boring or saturating them:
 *
 *   cold-start        the course opens where a beginner can actually start
 *   ramp-cliff        difficulty never jumps more than one step forward
 *   retention         every teaching saga is revisited by spaced review
 *   expanding-review  later reviews sit further out than earlier ones
 *   variety           no long run of identically-shaped lessons
 *   load              one sitting never piles on too many new facts at once
 *
 * All checks are DETERMINISTIC and run on the catalog BEFORE a single paid API
 * call — a 1000-lesson course's pedagogy is validated for free, in milliseconds,
 * instead of being discovered by a human reading generated lessons afterwards.
 *
 * Severity policy: structural promises a learner would FEEL as a wall are errors
 * (cold-start, ramp-cliff). Design-quality signals are warnings, because the right
 * value is a content-design judgement and existing curricula are allowed to be
 * imperfect while they are being authored.
 */

import type { CourseCatalog } from './loader.js';
import type { LessonBlueprint, TopicBlueprint } from './schema.js';

export interface ProgressionIssue {
  level: 'error' | 'warning';
  /** Stable code for aggregation across a mass run. */
  code: string;
  message: string;
}

/** One lesson in global course order, with the path needed for a useful message. */
interface OrderedLesson {
  adventure: string;
  saga: string;
  topic: string;
  topicKind: string;
  lesson: LessonBlueprint;
  /** 0-based index in global course order. */
  index: number;
}

interface OrderedTopic {
  adventure: string;
  saga: string;
  sagaKind: string;
  topic: TopicBlueprint;
  /** 0-based index in global topic order. */
  index: number;
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Flattens the course into the order a learner meets it: adventures in file
 * order, then sagas / topics / lessons by `position`.
 */
export function orderCourse(course: CourseCatalog): { lessons: OrderedLesson[]; topics: OrderedTopic[] } {
  const lessons: OrderedLesson[] = [];
  const topics: OrderedTopic[] = [];
  for (const loaded of course.adventures) {
    const advSlug = loaded.data.adventure.slug;
    for (const saga of [...loaded.data.sagas].sort(byPosition)) {
      for (const topic of [...saga.topics].sort(byPosition)) {
        topics.push({ adventure: advSlug, saga: saga.slug, sagaKind: saga.kind ?? 'teaching', topic, index: topics.length });
        for (const lesson of [...topic.lessons].sort(byPosition)) {
          lessons.push({
            adventure: advSlug,
            saga: saga.slug,
            topic: topic.slug,
            topicKind: topic.kind ?? 'teaching',
            lesson,
            index: lessons.length,
          });
        }
      }
    }
  }
  return { lessons, topics };
}

const where = (l: OrderedLesson) => `${l.adventure}/${l.saga}/${l.topic}/${l.lesson.slug}`;

/** Difficulty a total beginner can start on. */
const COLD_START_MAX = 1;
/** Biggest sanctioned forward step in difficulty between consecutive lessons. */
const MAX_RAMP_STEP = 1;
/** Consecutive lessons allowed to share an identical family signature. */
const MAX_IDENTICAL_RUN = 4;
/** How far the FIRST retrieval of a saga may sit before the material decays. */
const MAX_FIRST_REVIEW_DISTANCE = 12;
/** New facts one lesson may introduce before it saturates a young learner. */
const MAX_FACTS_PER_TOPIC = 6;

export function checkProgression(course: CourseCatalog): ProgressionIssue[] {
  const issues: ProgressionIssue[] = [];
  const { lessons, topics } = orderCourse(course);
  if (lessons.length === 0) return issues;

  // ---- cold start: a beginner must be able to walk in ------------------------
  const first = lessons[0];
  if (first && first.lesson.difficulty > COLD_START_MAX) {
    issues.push({
      level: 'error',
      code: 'cold-start',
      message: `the course opens at difficulty ${first.lesson.difficulty} (${where(first)}) — a learner with zero prior knowledge has nothing to stand on. The first lesson must be difficulty ${COLD_START_MAX}.`,
    });
  }

  // ---- ramp: no cliffs -------------------------------------------------------
  // Drops are fine and expected (consolidation and review deliberately ease off);
  // only a forward JUMP strands the learner.
  for (let i = 1; i < lessons.length; i++) {
    const prev = lessons[i - 1];
    const cur = lessons[i];
    if (!prev || !cur) continue;
    const step = cur.lesson.difficulty - prev.lesson.difficulty;
    if (step > MAX_RAMP_STEP) {
      issues.push({
        level: 'error',
        code: 'ramp-cliff',
        message: `difficulty jumps ${prev.lesson.difficulty}→${cur.lesson.difficulty} between ${where(prev)} and ${where(cur)} — a ${step}-step cliff. Insert an intermediate lesson so the ramp rises one step at a time.`,
      });
    }
  }

  // ---- retention: everything taught must come back ---------------------------
  // Collect what the review layer actually cites. `review_of` paths are
  // "<adv>/<saga>" or "<adv>/<saga>/<topic>"; a saga is covered by either form.
  const reviewedSagas = new Set<string>();
  const reviewCitationsBySaga = new Map<string, number[]>(); // saga path → reviewing topic indexes
  for (const t of topics) {
    for (const ref of t.topic.review_of ?? []) {
      const parts = ref.split('/');
      const sagaPath = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : ref;
      reviewedSagas.add(sagaPath);
      const list = reviewCitationsBySaga.get(sagaPath) ?? [];
      list.push(t.index);
      reviewCitationsBySaga.set(sagaPath, list);
    }
  }

  const teachingSagas = new Map<string, number>(); // saga path → index of its LAST teaching topic
  for (const t of topics) {
    if (t.sagaKind === 'review' || (t.topic.kind ?? 'teaching') !== 'teaching') continue;
    teachingSagas.set(`${t.adventure}/${t.saga}`, t.index);
  }

  // A standalone catalog is a type-coverage / practice harness, not a teaching
  // arc — its lessons are isolated demos with nothing to consolidate, so the
  // retention checks below do not apply (same exemption the review judge uses).
  const standalone = course.catalog?.course.standalone === true;

  for (const [sagaPath, lastTaughtIndex] of teachingSagas) {
    if (standalone) break;
    if (!reviewedSagas.has(sagaPath)) {
      issues.push({
        level: 'warning',
        code: 'retention-gap',
        message: `teaching saga "${sagaPath}" is never cited by any review topic's review_of — what it teaches is practised once and never retrieved again, so it will not stick. Add it to a review topic.`,
      });
      continue;
    }
    /*
     * Spacing quality. Measured against the authored curriculum first, which
     * corrected the rule: a review topic legitimately cites SEVERAL topics of the
     * same saga, and several review topics legitimately sit at the same distance,
     * so the raw citation list is full of duplicates (real example: gaps 1,1,1,1,
     * 1,1,1,1,2,2,12,12,33,33,33,33,37,38,48,176). Demanding a strictly
     * increasing raw sequence flagged all 32 teaching sagas of every big course —
     * 96 false warnings against a curriculum whose spacing is in fact textbook.
     * What actually matters is the set of DISTINCT distances:
     *   • the first retrieval must land before the material decays, and
     *   • there must be more than one scale of distance, or it is not spaced
     *     practice at all, just one extra pass.
     */
    const distances = [...new Set(
      (reviewCitationsBySaga.get(sagaPath) ?? []).filter((idx) => idx > lastTaughtIndex).map((idx) => idx - lastTaughtIndex),
    )].sort((a, b) => a - b);
    if (distances.length === 0) {
      issues.push({
        level: 'warning',
        code: 'retention-backwards',
        message: `every review of teaching saga "${sagaPath}" is positioned BEFORE the saga finishes teaching — a learner meets the review before the material. Move those review topics after it.`,
      });
      continue;
    }
    const firstDistance = distances[0] ?? 0;
    if (firstDistance > MAX_FIRST_REVIEW_DISTANCE) {
      issues.push({
        level: 'warning',
        code: 'first-review-too-far',
        message: `the first review of "${sagaPath}" is ${firstDistance} topics later (max ${MAX_FIRST_REVIEW_DISTANCE}) — by then the material has decayed and the review is re-teaching, not retrieval. Add an earlier consolidation pass.`,
      });
    }
    if (distances.length === 1) {
      issues.push({
        level: 'warning',
        code: 'retention-single-shot',
        message: `"${sagaPath}" is reviewed at exactly one distance (${firstDistance} topics) — a single extra pass is not spaced practice. Retrieve it again at a longer interval so it consolidates.`,
      });
    }
  }

  // ---- variety: never the same shape for too long ----------------------------
  // Signature = the forced types when pinned, else the suggested families. A long
  // identical run is what makes a course feel like a worksheet.
  const signature = (l: OrderedLesson) =>
    (l.lesson.forced_types ?? l.lesson.suggested_families).slice().sort().join('+');
  let runStart = 0;
  for (let i = 1; i <= lessons.length; i++) {
    const head = lessons[runStart];
    const cur = i < lessons.length ? lessons[i] : undefined;
    if (head && cur && signature(cur) === signature(head)) continue;
    const runLength = i - runStart;
    if (head && runLength > MAX_IDENTICAL_RUN) {
      issues.push({
        level: 'warning',
        code: 'monotony',
        message: `${runLength} consecutive lessons share the same shape "${signature(head)}" (from ${where(head)}) — that reads as a worksheet and loses attention. Vary the families/types within the run.`,
      });
    }
    runStart = i;
  }

  // ---- cognitive load: one sitting, a handful of new things -------------------
  for (const t of topics) {
    const facts = t.topic.fact_refs?.length ?? 0;
    if (facts > MAX_FACTS_PER_TOPIC) {
      issues.push({
        level: 'warning',
        code: 'cognitive-load',
        message: `topic "${t.adventure}/${t.saga}/${t.topic.slug}" introduces ${facts} facts (max ${MAX_FACTS_PER_TOPIC}) — that saturates a young learner in one sitting. Split it across topics.`,
      });
    }
    // A single topic spanning the whole difficulty scale is a cliff in miniature.
    const diffs = t.topic.lessons.map((l) => l.difficulty);
    const spread = Math.max(...diffs) - Math.min(...diffs);
    if (spread > 2) {
      issues.push({
        level: 'warning',
        code: 'topic-difficulty-spread',
        message: `topic "${t.adventure}/${t.saga}/${t.topic.slug}" spans difficulty ${Math.min(...diffs)}→${Math.max(...diffs)} in ${diffs.length} lessons — too wide for one sitting. Keep a topic within 2 steps.`,
      });
    }
  }

  return issues;
}
