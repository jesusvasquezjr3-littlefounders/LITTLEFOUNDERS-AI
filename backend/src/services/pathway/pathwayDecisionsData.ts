import { z } from 'zod';
import { serviceRest } from '../supabaseRest.js';
import type { PathwayStage } from './pathwayPolicy.js';

/*
 * OD-25 (owner review P-03 and P-04) — the learner's own pathway decisions,
 * stored by migration 0183 and written only by Core with the service role:
 *
 *   course_chapter_early_access      a minor's confirmation of early access to
 *                                    a chapter one stage above their own
 *                                    (Rule P8);
 *   course_topic_mastery_decisions   the learner's answer to "You have shown
 *                                    mastery of X; complete this topic?"
 *                                    (Rule E3).
 *
 * Both are write-once (the table refuses UPDATE) and keyed so a replay is
 * ignored: a second confirmation or the same decision again returns the row
 * already stored. Every reader returns null on an upstream failure, never
 * "no decisions" (§1.14), because treating a failed read as empty would
 * re-close a chapter or re-offer a decided topic.
 */

const Uuid = z.string().uuid();
const eu = (value: string): string => encodeURIComponent(Uuid.parse(value));
const STAGES = ['child', 'tween', 'teen', 'adult'] as const;

export interface EarlyAccessRecord {
  courseId: string;
  chapterId: string;
  pathwayStage: PathwayStage;
  confirmedAt: string;
}

export type MasteryDecision = 'accepted' | 'declined';

export interface MasteryDecisionRecord {
  courseId: string;
  topicId: string;
  decision: MasteryDecision;
  kcs: string[];
  decidedAt: string;
}

export interface PathwayDecisions {
  /** Early-access confirmations by chapter (adventure) id. */
  earlyAccess: Map<string, EarlyAccessRecord>;
  /** Mastery-offer decisions by topic id. */
  masteryDecisions: Map<string, MasteryDecisionRecord>;
}

const EarlyRows = z.array(z.object({
  course_id: z.string(),
  adventure_id: z.string(),
  pathway_stage: z.enum(STAGES),
  confirmed_at: z.string(),
}).passthrough());
const DecisionRows = z.array(z.object({
  course_id: z.string(),
  topic_id: z.string(),
  decision: z.enum(['accepted', 'declined']),
  kcs: z.array(z.string()),
  decided_at: z.string(),
}).passthrough());

const toEarly = (row: z.infer<typeof EarlyRows>[number]): EarlyAccessRecord =>
  ({ courseId: row.course_id, chapterId: row.adventure_id, pathwayStage: row.pathway_stage, confirmedAt: row.confirmed_at });
const toDecision = (row: z.infer<typeof DecisionRows>[number]): MasteryDecisionRecord =>
  ({ courseId: row.course_id, topicId: row.topic_id, decision: row.decision, kcs: [...row.kcs].sort(), decidedAt: row.decided_at });

const EARLY_SELECT = 'select=course_id,adventure_id,pathway_stage,confirmed_at';
const DECISION_SELECT = 'select=course_id,topic_id,decision,kcs,decided_at';

/** Every decision one learner has recorded, across all courses. Null when either read fails. */
export async function readPathwayDecisions(userId: string): Promise<PathwayDecisions | null> {
  if (!Uuid.safeParse(userId).success) return null;
  const [early, decisions] = await Promise.all([
    serviceRest<unknown>(`/course_chapter_early_access?user_id=eq.${eu(userId)}&${EARLY_SELECT}&limit=1000`),
    serviceRest<unknown>(`/course_topic_mastery_decisions?user_id=eq.${eu(userId)}&${DECISION_SELECT}&limit=5000`),
  ]);
  const earlyRows = EarlyRows.safeParse(early);
  const decisionRows = DecisionRows.safeParse(decisions);
  if (!earlyRows.success || !decisionRows.success) return null;
  return {
    earlyAccess: new Map(earlyRows.data.map((row) => [row.adventure_id, toEarly(row)])),
    masteryDecisions: new Map(decisionRows.data.map((row) => [row.topic_id, toDecision(row)])),
  };
}

/**
 * Rule P8 — store the learner's confirmation, then read back what is stored.
 * A replay (or a concurrent twin) is ignored by the primary key, so the
 * caller always gets the one stored row. Null on any failure.
 */
export async function recordEarlyChapterAccess(row: {
  userId: string;
  courseId: string;
  chapterId: string;
  pathwayStage: PathwayStage;
  learnerStage: PathwayStage;
  prerequisiteKcs: readonly string[];
}, now = new Date()): Promise<EarlyAccessRecord | null> {
  const written = await serviceRest<unknown>('/course_chapter_early_access?on_conflict=user_id,adventure_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      user_id: Uuid.parse(row.userId),
      course_id: Uuid.parse(row.courseId),
      adventure_id: Uuid.parse(row.chapterId),
      pathway_stage: row.pathwayStage,
      learner_stage: row.learnerStage,
      prerequisite_kcs: [...row.prerequisiteKcs].sort(),
      confirmed_at: now.toISOString(),
    }),
  });
  if (written === null) return null;
  const stored = EarlyRows.safeParse(await serviceRest<unknown>(
    `/course_chapter_early_access?user_id=eq.${eu(row.userId)}&adventure_id=eq.${eu(row.chapterId)}&${EARLY_SELECT}&limit=1`,
  ));
  return stored.success && stored.data[0] ? toEarly(stored.data[0]) : null;
}

/**
 * Rule E3 — store the learner's decision on a mastery offer, then read back
 * what is stored. The first decision wins and is never changed; the caller
 * compares the returned decision with the one it asked for.
 */
export async function recordMasteryDecision(row: {
  userId: string;
  courseId: string;
  topicId: string;
  decision: MasteryDecision;
  kcs: readonly string[];
}, now = new Date()): Promise<MasteryDecisionRecord | null> {
  const written = await serviceRest<unknown>('/course_topic_mastery_decisions?on_conflict=user_id,topic_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({
      user_id: Uuid.parse(row.userId),
      course_id: Uuid.parse(row.courseId),
      topic_id: Uuid.parse(row.topicId),
      decision: row.decision,
      kcs: [...row.kcs].sort(),
      decided_at: now.toISOString(),
    }),
  });
  if (written === null) return null;
  const stored = DecisionRows.safeParse(await serviceRest<unknown>(
    `/course_topic_mastery_decisions?user_id=eq.${eu(row.userId)}&topic_id=eq.${eu(row.topicId)}&${DECISION_SELECT}&limit=1`,
  ));
  return stored.success && stored.data[0] ? toDecision(stored.data[0]) : null;
}
