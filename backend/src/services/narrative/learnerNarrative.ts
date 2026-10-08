import type { CourseTree, TopicNode } from '../courseTree.js';
import { extractV2Decisions, pickRecall, type RecallRelevance } from './decisionJournal.js';
import { journalCandidates, recordDecisions, recordResurfacing, topicTeaches } from './narrativeData.js';

/*
 * B.9 (S05.3c) — the moments the learning routes hand to the narrative
 * layer. Each is best-effort by design: a failure here is logged and
 * the lesson, grade or completion it rides on proceeds untouched. A narrative
 * echo is never allowed to cost a learner a lesson (and the code stays safe to
 * deploy before its migration exists).
 */

type Json = Record<string, unknown>;

function topicOf(tree: CourseTree, topicId: string): { topic: TopicNode; sagaTopicIds: Set<string> } | null {
  for (const adventure of tree.adventures) {
    for (const saga of adventure.sagas) {
      const topic = saga.topics.find((t) => t.id === topicId);
      if (topic) return { topic, sagaTopicIds: new Set(saga.topics.map((t) => t.id)) };
    }
  }
  return null;
}

function lessonTitleIn(tree: CourseTree, lessonId: string): Json | null {
  for (const adventure of tree.adventures) for (const saga of adventure.sagas) for (const topic of saga.topics) {
    const lesson = topic.lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson.title;
  }
  return null;
}

export interface NarrativeRecall {
  entry_id: string;
  lesson_title: Json;
  situation: string;
  choice: string;
  /** The learner's first choice, when a replay changed it. */
  first_choice: string | null;
  outcome: string | null;
  relevance: RecallRelevance;
  recorded_at: string;
}

/** Moment 2 (B.9): when a lesson opens, resurface one earlier, relevant decision from this course. */
export async function resurfaceForLesson(input: { userId: string; tree: CourseTree; courseId: string; topicId: string; lessonId: string }): Promise<NarrativeRecall | null> {
  try {
    const found = topicOf(input.tree, input.topicId);
    if (!found) return null;
    const journal = await journalCandidates(input.userId, input.courseId);
    if (!journal || journal.candidates.length === 0) return null;
    // Only entries whose lesson is still in the learner's served tree can be named.
    const visible = journal.candidates.filter((c) => lessonTitleIn(input.tree, c.lessonId) !== null);
    if (visible.length === 0) return null;
    // The shared graph is optional context: a failed read leaves the same-arc rule.
    const kcs = await topicTeaches([...new Set([input.topicId, ...visible.map((c) => c.topicId)])]);
    const kcByTopic = new Map<string, Set<string>>();
    for (const [topicId, rows] of kcs ?? new Map()) kcByTopic.set(topicId, new Set(rows.map((k: { id: string }) => k.id)));
    const picked = pickRecall(visible, { lessonId: input.lessonId, topicId: input.topicId, courseId: input.courseId, sagaTopicIds: found.sagaTopicIds, kcByTopic });
    if (!picked) return null;
    const row = journal.rows.get(picked.entry.id);
    const title = lessonTitleIn(input.tree, picked.entry.lessonId);
    if (!row || !title) return null;
    if (!picked.repeat && !(await recordResurfacing(row.id, input.lessonId, input.userId))) {
      // Not counted means not shown: the resurfacing metric must stay truthful.
      console.error('[narrative] resurfacing write failed', { entryId: row.id });
      return null;
    }
    return {
      entry_id: row.id,
      lesson_title: title,
      situation: row.situation_text,
      choice: row.choice_text,
      first_choice: row.first_choice_id !== row.choice_id ? row.first_choice_text : null,
      outcome: row.outcome_text,
      relevance: picked.relevance,
      recorded_at: row.recorded_at,
    };
  } catch (error) {
    console.error('[narrative] resurfacing threw', error);
    return null;
  }
}

/** B.9 for v2 (GAP-FIX-R1): a graded v2 story choice goes to the same journal. Best-effort, after Core stored the receipt. */
export async function recordV2GradedDecisions(input: {
  userId: string; courseId: string; topicId: string; lessonId: string; locale: string; lessonTitle: string | null;
  segment: { id: string; type: string; prompt: string; payload: unknown }; answer: unknown;
}): Promise<void> {
  try {
    const decisions = extractV2Decisions(input.segment, input.answer, input.lessonTitle);
    if (decisions.length === 0) return;
    const ok = await recordDecisions({ userId: input.userId, courseId: input.courseId, topicId: input.topicId, lessonId: input.lessonId, locale: input.locale, decisions });
    if (!ok) console.error('[narrative] v2 decision journal write failed', { lessonId: input.lessonId, segmentId: input.segment.id });
  } catch (error) {
    console.error('[narrative] v2 decision journal write threw', error);
  }
}
