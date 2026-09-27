import type { PathwayCourseTree } from './coursePathway.js';
import type { LearnerPathwayContext } from './pathwayData.js';
import { recordEarlyChapterAccess, recordMasteryDecision, type EarlyAccessRecord, type MasteryDecisionRecord } from './pathwayDecisionsData.js';
import { learnerStage } from './pathwayPolicy.js';

/*
 * OD-25 (owner review P-03 and P-04) — the two learner decisions the pathway
 * engine accepts, decided on the SERVER's own pathway tree. The client only
 * says "confirm" or "accept/decline"; eligibility is always re-derived here
 * from the learner's age evidence, Mentor mastery and course evidence, read
 * fresh for this request (pathwayData.ts). A client that claims a chapter or
 * topic is eligible when it is not is refused, and nothing is written.
 *
 * Both writes are idempotent: the same request again returns the same stored
 * record with 200. Every refusal names a stable code for the client.
 */

export type DecisionOutcome<T> =
  | { kind: 'ok'; body: T }
  | { kind: 'refused'; status: number; code: string; message: string; details?: Record<string, unknown> };

const refused = (status: number, code: string, message: string, details?: Record<string, unknown>): DecisionOutcome<never> =>
  ({ kind: 'refused', status, code, message, ...(details ? { details } : {}) });

export interface EarlyAccessBody {
  earlyAccess: { courseId: string; chapterId: string; stage: EarlyAccessRecord['pathwayStage']; confirmedAt: string };
  replayed: boolean;
}

const earlyBody = (record: EarlyAccessRecord, replayed: boolean): EarlyAccessBody =>
  ({ earlyAccess: { courseId: record.courseId, chapterId: record.chapterId, stage: record.pathwayStage, confirmedAt: record.confirmedAt }, replayed });

/**
 * Rule P8 — confirm early access to one chapter of this course.
 *
 * Mastery is checked when the learner confirms, and the confirmation is kept
 * if the Mentor's estimate later dips: the prerequisites were shown, OD-16
 * makes age (not mastery) the safeguard, and re-closing a chapter mid-play
 * would lock work the learner has started (the F8 principle). The AGE half is
 * re-checked on every read instead (earlyStageAllows), so a confirmation never
 * outlives the safeguard: if a corrected birth date puts the chapter two
 * stages up, or it is an adult chapter, it is closed again (T4) and a replay
 * of the confirmation is refused.
 */
export async function confirmEarlyChapter(
  userId: string,
  course: { id: string },
  tree: PathwayCourseTree,
  ctx: LearnerPathwayContext,
  chapterId: string,
): Promise<DecisionOutcome<EarlyAccessBody>> {
  const chapter = tree.adventures.find((a) => a.id === chapterId);
  if (!chapter) return refused(404, 'NOT_FOUND', 'No such chapter in this course');
  const entry = tree.pathway.earlyChapters.find((e) => e.chapterId === chapterId);
  const stored = ctx.earlyAccess.get(chapterId);
  // Replay: the stored confirmation, while the chapter is open (by it, or by age once the learner has grown into it).
  if (stored && stored.courseId === course.id && chapter.pathwayAccess !== 'closed') return { kind: 'ok', body: earlyBody(stored, true) };
  if (chapter.pathwayAccess !== 'closed') return refused(409, 'CHAPTER_ALREADY_OPEN', 'This chapter is already open');
  if (!entry || entry.status === 'confirmed') {
    // Not exactly one stage above, an adult chapter, an adult learner, or a stored confirmation the safeguard no longer allows.
    return refused(403, 'EARLY_ACCESS_NOT_ELIGIBLE', 'This chapter cannot open early', { reason: 'age-stage' });
  }
  if (entry.status === 'no-prerequisites') {
    return refused(403, 'EARLY_ACCESS_NOT_ELIGIBLE', 'This chapter cannot open early', { reason: 'no-prerequisites' });
  }
  if (entry.status === 'missing-prerequisites') {
    return refused(403, 'EARLY_ACCESS_NOT_ELIGIBLE', 'Master the skills this chapter builds on first', { reason: 'missing-prerequisites', missingSkills: entry.missingSkills });
  }
  const record = await recordEarlyChapterAccess({
    userId,
    courseId: course.id,
    chapterId,
    pathwayStage: entry.stage,
    learnerStage: learnerStage(ctx.age),
    prerequisiteKcs: entry.prerequisiteSkills,
  });
  if (!record) return refused(502, 'INTERNAL', 'Could not record the confirmation');
  return { kind: 'ok', body: earlyBody(record, false) };
}

export interface MasteryOfferBody {
  masteryOffer: { courseId: string; topicId: string; decision: MasteryDecisionRecord['decision']; skills: string[]; decidedAt: string };
  replayed: boolean;
}

const decisionBody = (record: MasteryDecisionRecord, replayed: boolean): MasteryOfferBody =>
  ({ masteryOffer: { courseId: record.courseId, topicId: record.topicId, decision: record.decision, skills: record.kcs, decidedAt: record.decidedAt }, replayed });

/**
 * Rule E3 — the learner's answer to one Mentor-mastery completion offer.
 *
 * The first decision is final and write-once. The same decision again is a
 * replay (200, same record); the other decision is refused with
 * MASTERY_OFFER_ALREADY_DECIDED. A declined offer is never shown again for
 * that topic; the topic stays completable through its lessons (E1). An
 * accepted one completes the topic from the next read (E3) and is never
 * revoked, like every other completion evidence (OD-9).
 */
export async function decideMasteryOffer(
  userId: string,
  course: { id: string },
  tree: PathwayCourseTree,
  ctx: LearnerPathwayContext,
  topicId: string,
  decision: 'accept' | 'decline',
): Promise<DecisionOutcome<MasteryOfferBody>> {
  const inCourse = tree.adventures.some((a) => a.sagas.some((s) => s.topics.some((t) => t.id === topicId)));
  if (!inCourse) return refused(404, 'NOT_FOUND', 'No such topic in this course');
  const wanted = decision === 'accept' ? 'accepted' : 'declined';
  const stored = ctx.masteryDecisions.get(topicId);
  if (stored && stored.courseId === course.id) {
    if (stored.decision === wanted) return { kind: 'ok', body: decisionBody(stored, true) };
    return refused(409, 'MASTERY_OFFER_ALREADY_DECIDED', 'This offer was already answered', { decision: stored.decision });
  }
  const offer = tree.pathway.masteryOffers.find((o) => o.topicId === topicId);
  if (!offer) return refused(403, 'MASTERY_OFFER_NOT_ELIGIBLE', 'There is no mastery offer for this topic');
  const record = await recordMasteryDecision({ userId, courseId: course.id, topicId, decision: wanted, kcs: offer.skills });
  if (!record) return refused(502, 'INTERNAL', 'Could not record the decision');
  // A concurrent request stored the other decision first: the first one stands.
  if (record.decision !== wanted) return refused(409, 'MASTERY_OFFER_ALREADY_DECIDED', 'This offer was already answered', { decision: record.decision });
  return { kind: 'ok', body: decisionBody(record, false) };
}
