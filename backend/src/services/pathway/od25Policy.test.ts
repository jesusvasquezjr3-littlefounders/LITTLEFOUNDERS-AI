import { describe, expect, it } from 'vitest';
import { MASTERY_PREREQ_THRESHOLD } from '../pedagogy/bkt.js';
import {
  chapterOpens,
  chapterPolicy,
  chapterPrerequisiteKcs,
  earlyChapterDecision,
  earlyStageAllows,
  gradedPathwayProgress,
  graphState,
  learnerAgeEvidence,
  mayBeMinor,
  mentorMasteryOffers,
  pathwayBadgeDecision,
  pathwayProgress,
  resolvePathway,
  topicCompletion,
  type AgeEvidence,
  type ChapterAccess,
  type ChapterPolicy,
  type KcSatisfaction,
  type LearnerEvidence,
  type PathwayChapter,
  type TopicKcs,
} from './pathwayPolicy.js';

/*
 * OD-25 (owner review P-03 and P-04), the pure rules:
 *   P8  a minor's early access to a chapter ONE stage above their own, only
 *       with every prerequisite KC mastered on the shared graph and a
 *       confirmation; never an adult chapter, never two stages up;
 *   E3  Mentor mastery completes a topic only after the learner accepts;
 *   B6  an accepted Mentor completion never earns the stage badge by itself.
 * Adversarial on purpose: every case a client could argue its way into.
 */

const NOW = new Date('2026-09-24T12:00:00.000Z');
const born = (age: number): string => `${2026 - age - 1}-12-01`;
const exact = (age: number): AgeEvidence => learnerAgeEvidence({ birthDate: born(age), declaredBand: null, protectedOrigin: false }, NOW);
const band = (declaredBand: 'under_13' | '13_to_17' | 'adult'): AgeEvidence => learnerAgeEvidence({ birthDate: null, declaredBand, protectedOrigin: false }, NOW);
const UNKNOWN: AgeEvidence = { lowerBound: null, upperBound: null, exact: false };
const explicit = (stage: string, min: number, max: number | null): ChapterPolicy =>
  chapterPolicy({ id: 'x', age_tier: 'tier1', pathway_stage: stage, eligibility_min_age: min, eligibility_max_age: max })!;
const CHILD = chapterPolicy({ id: 'x', age_tier: 'tier1' })!;
const TWEEN = explicit('tween', 10, 12);
const TEEN = explicit('teen', 13, 17);
const ADULT = explicit('adult', 18, null);

/** One chapter per stage; each topic teaches `kc.<topic>`; lessons `l.<topic>`. */
function chapter(id: string, policy: ChapterPolicy | null, topics: string[]): PathwayChapter {
  return {
    id, position: ['child', 'tween', 'teen', 'adult', 'x'].indexOf(id) + 1, policy,
    sagas: [{ id: `${id}-s`, position: 1, topics: topics.map((t, i) => ({
      id: `topic.${t}`, path: `${id}/s/${t}`, position: i + 1, kind: 'teaching' as const,
      lessonIds: [`l.${t}.1`, `l.${t}.2`], hardPrerequisites: [], reviewOf: [],
    })) }],
  };
}
const kcsOf = (chapters: PathwayChapter[]): Map<string, TopicKcs> =>
  new Map(chapters.flatMap((c) => c.sagas.flatMap((s) => s.topics.map((t) => [t.path, { teaches: [`kc.${t.id.slice(6)}`], reviews: [] }] as const))));
// The graph: the teen chapter builds on c1 and w1; the tween chapter on c1; the adult chapter on t1.
const PREREQS = new Map<string, string[]>([
  ['kc.t1', ['kc.c1', 'kc.w1']],
  ['kc.t2', ['kc.t1']], // taught inside the chapter itself: not a chapter prerequisite
  ['kc.w1', ['kc.c1']],
  ['kc.a1', ['kc.t1']],
]);
const COURSE = [chapter('child', CHILD, ['c1']), chapter('tween', TWEEN, ['w1']), chapter('teen', TEEN, ['t1', 't2']), chapter('adult', ADULT, ['a1'])];
const KCS = kcsOf(COURSE);
const byId = (id: string): PathwayChapter => COURSE.find((c) => c.id === id)!;
const mentor = (entries: Record<string, number>): LearnerEvidence =>
  ({ passedLessonIds: new Set(), creditedLessonIds: new Set(), mentorPKnown: new Map(Object.entries(entries)), dueReviewKcs: new Set() });
const satisfied = (...kcs: string[]): Map<string, KcSatisfaction> => new Map(kcs.map((kc) => [kc, 'mentor' as const]));
const ALL = satisfied('kc.c1', 'kc.w1', 'kc.t1', 'kc.t2', 'kc.a1');

describe('P8 age half: one stage up, never adult, never two stages', () => {
  it('a tween (10-12) may be offered a teen chapter, and a child a tween chapter', () => {
    expect(earlyStageAllows(exact(11), TEEN)).toBe(true);
    expect(earlyStageAllows(exact(10), TEEN)).toBe(true);
    expect(earlyStageAllows(exact(8), TWEEN)).toBe(true);
  });

  it('refuses two stages up: a child is never offered a teen chapter', () => {
    expect(earlyStageAllows(exact(9), TEEN)).toBe(false);
    expect(earlyChapterDecision(exact(9), byId('teen'), KCS, PREREQS, ALL)).toBeNull();
  });

  it('refuses an adult chapter to a 17-year-old and to a declared 13-17 band, even with full mastery', () => {
    expect(earlyChapterDecision(exact(17), byId('adult'), KCS, PREREQS, ALL)).toBeNull();
    expect(earlyChapterDecision(band('13_to_17'), byId('adult'), KCS, PREREQS, ALL)).toBeNull();
    // Even a stored confirmation cannot open it.
    expect(chapterOpens(exact(17), ADULT, true)).toBe(false);
    expect(resolvePathway(band('13_to_17'), [{ id: 'adult', policy: ADULT }], new Set(['adult'])).access.get('adult')).toBe('closed');
  });

  it('treats unknown age as the child stage and the A.2 guest as at most 12', () => {
    expect(mayBeMinor(UNKNOWN)).toBe(true);
    expect(earlyStageAllows(UNKNOWN, TWEEN)).toBe(true);
    expect(earlyStageAllows(UNKNOWN, TEEN)).toBe(false);
    const guest = learnerAgeEvidence({ birthDate: born(30), declaredBand: 'adult', protectedOrigin: true }, NOW);
    expect(mayBeMinor(guest)).toBe(true);
    expect(earlyStageAllows(guest, TEEN)).toBe(true); // capped at 12: a tween
    expect(earlyStageAllows(guest, ADULT)).toBe(false);
    expect(earlyStageAllows(band('under_13'), TEEN)).toBe(false); // lower bound unknown: child stage
  });

  it('leaves adults unaffected: nothing is ever offered early to an adult', () => {
    const late = explicit('adult', 21, null);
    expect(mayBeMinor(exact(18))).toBe(false);
    expect(earlyStageAllows(exact(18), late)).toBe(false);
    expect(earlyChapterDecision(band('adult'), { ...byId('adult'), policy: late }, KCS, PREREQS, ALL)).toBeNull();
  });

  it('does not apply to a chapter age already opens, or to a chapter with no valid policy', () => {
    expect(earlyStageAllows(exact(13), TEEN)).toBe(false);
    expect(earlyStageAllows(exact(8), CHILD)).toBe(false);
    expect(earlyStageAllows(exact(11), null)).toBe(false);
    // A legacy tier4 chapter is teen 12-18: early for 10-11 only.
    const tier4 = chapterPolicy({ id: 'x', age_tier: 'tier4' })!;
    expect(earlyStageAllows(exact(11), tier4)).toBe(true);
    expect(earlyStageAllows(exact(12), tier4)).toBe(false);
  });
});

describe('P8 mastery half: every prerequisite KC mastered on the shared graph', () => {
  it('names the chapter prerequisites: prerequisites of what it teaches, minus what it teaches itself', () => {
    expect(chapterPrerequisiteKcs(byId('teen'), KCS, PREREQS)).toEqual(['kc.c1', 'kc.w1']);
    expect(chapterPrerequisiteKcs(byId('child'), KCS, PREREQS)).toEqual([]);
  });

  it('offers only when every prerequisite is satisfied', () => {
    expect(earlyChapterDecision(exact(11), byId('teen'), KCS, PREREQS, satisfied('kc.c1', 'kc.w1'))).toEqual({
      status: 'offer', prerequisiteKcs: ['kc.c1', 'kc.w1'], missingKcs: [],
    });
  });

  it('refuses partial mastery and names what is missing', () => {
    expect(earlyChapterDecision(exact(11), byId('teen'), KCS, PREREQS, satisfied('kc.c1'))).toEqual({
      status: 'missing-prerequisites', prerequisiteKcs: ['kc.c1', 'kc.w1'], missingKcs: ['kc.w1'],
    });
    expect(earlyChapterDecision(exact(11), byId('teen'), KCS, PREREQS, new Map())?.status).toBe('missing-prerequisites');
  });

  it('reuses the Mentor bar through E2: 0.80 satisfies, 0.79 does not', () => {
    const access = new Map<string, ChapterAccess>(COURSE.map((c) => [c.id, c.id === 'child' ? 'pathway' : 'closed']));
    const at = (p: number) => graphState(COURSE, access, KCS, mentor({ 'kc.c1': p, 'kc.w1': p })).satisfaction;
    expect(earlyChapterDecision(exact(11), byId('teen'), KCS, PREREQS, at(MASTERY_PREREQ_THRESHOLD))?.status).toBe('offer');
    expect(earlyChapterDecision(exact(11), byId('teen'), KCS, PREREQS, at(0.79))?.status).toBe('missing-prerequisites');
  });

  it('never offers a chapter with no prerequisites: there is no mastery evidence to rely on', () => {
    const lone = chapter('teen', TEEN, ['z1']);
    expect(earlyChapterDecision(exact(11), lone, kcsOf([lone]), PREREQS, ALL)).toEqual({ status: 'no-prerequisites', prerequisiteKcs: [], missingKcs: [] });
  });
});

describe('P8 in the pathway resolution: only a stored confirmation opens, and only while the age half holds', () => {
  const rows = COURSE.map((c) => ({ id: c.id, policy: c.policy }));

  it('an unconfirmed eligible chapter stays closed; a confirmed one is optional beside the younger bridge', () => {
    expect(resolvePathway(exact(11), rows).access.get('teen')).toBe('closed');
    const r = resolvePathway(exact(11), rows, new Set(['teen']));
    expect(r).toMatchObject({ learnerStage: 'tween', pathwayStage: 'tween', basis: 'own-stage' });
    expect(Object.fromEntries(r.access)).toEqual({ child: 'optional', tween: 'pathway', teen: 'optional', adult: 'closed' });
  });

  it('a confirmation for a chapter two stages up (for example after a birth-date correction) opens nothing', () => {
    expect(resolvePathway(exact(8), rows, new Set(['teen'])).access.get('teen')).toBe('closed');
    expect(chapterOpens(exact(8), TEEN, true)).toBe(false);
  });

  it('in a course with nothing else open, the confirmed chapter becomes the older-early pathway', () => {
    const r = resolvePathway(exact(11), [{ id: 'teen', policy: TEEN }, { id: 'teen2', policy: TEEN }], new Set(['teen']));
    expect(r).toMatchObject({ pathwayStage: 'teen', basis: 'older-early' });
    expect(Object.fromEntries(r.access)).toEqual({ teen: 'pathway', teen2: 'closed' });
  });

  it('adults are unaffected by a stray confirmation row', () => {
    const before = resolvePathway(exact(30), rows);
    const after = resolvePathway(exact(30), rows, new Set(['teen', 'adult']));
    expect(Object.fromEntries(after.access)).toEqual(Object.fromEntries(before.access));
  });
});

describe('E3 the Mentor-mastery completion offer, and B6 the badge', () => {
  const kids = [chapter('child', CHILD, ['c1', 'c2']), chapter('teen', TEEN, ['t1'])];
  const kcs = kcsOf(kids);
  const access = new Map<string, ChapterAccess>([['child', 'pathway'], ['teen', 'closed']]);

  it('offers a topic whose every taught KC the Mentor holds at 0.80, and nothing below the bar', () => {
    expect(mentorMasteryOffers(kids, access, kcs, mentor({ 'kc.c1': 0.8, 'kc.c2': 0.79 }), new Set()))
      .toEqual([{ topicId: 'topic.c1', chapterId: 'child', kcs: ['kc.c1'] }]);
  });

  it('never offers a closed-chapter topic, a decided topic, or a complete one', () => {
    const strong = mentor({ 'kc.c1': 0.95, 'kc.c2': 0.95, 'kc.t1': 0.99 });
    expect(mentorMasteryOffers(kids, access, kcs, strong, new Set(['topic.c1'])).map((o) => o.topicId)).toEqual(['topic.c2']);
    const played = { ...strong, passedLessonIds: new Set(['l.c2.1', 'l.c2.2']) };
    expect(mentorMasteryOffers(kids, access, kcs, played, new Set(['topic.c1']))).toEqual([]);
  });

  it('does not count a KC satisfied only by course evidence elsewhere: the offer is about Mentor mastery', () => {
    const twin = [chapter('child', CHILD, ['c1']), chapter('x', CHILD, ['c1b'])];
    const same = new Map<string, TopicKcs>([['child/s/c1', { teaches: ['kc.c1'], reviews: [] }], ['x/s/c1b', { teaches: ['kc.c1'], reviews: [] }]]);
    const ev = { ...mentor({}), passedLessonIds: new Set(['l.c1.1', 'l.c1.2']) };
    expect(mentorMasteryOffers(twin, new Map([['child', 'pathway'], ['x', 'pathway']]), same, ev, new Set())).toEqual([]);
  });

  it('mastery alone never completes a topic; an accepted offer does, counting its lessons like a credit', () => {
    const topic = kids[0]!.sagas[0]!.topics[0]!;
    const strong = mentor({ 'kc.c1': 0.99 });
    expect(topicCompletion(topic, strong)).toEqual({ done: 0, total: 2, complete: false });
    expect(topicCompletion(topic, { ...strong, masteryCompletedTopicIds: new Set(['topic.c1']) })).toEqual({ done: 2, total: 2, complete: true });
  });

  it('an accepted completion counts toward pathway progress but not toward the stage badge (B6)', () => {
    const ev: LearnerEvidence = { ...mentor({ 'kc.c1': 0.9 }), passedLessonIds: new Set(['l.c2.1', 'l.c2.2']), masteryCompletedTopicIds: new Set(['topic.c1']) };
    const progress = pathwayProgress(kids, access, kcs, ev);
    expect(progress).toMatchObject({ passed: 4, total: 4, pct: 100, complete: true });
    const graded = gradedPathwayProgress(kids, access, kcs, ev);
    expect(graded).toMatchObject({ passed: 2, total: 4, complete: false });
    const resolution = resolvePathway(exact(8), kids.map((c) => ({ id: c.id, policy: c.policy })));
    expect(pathwayBadgeDecision(resolution, graded, new Set()).eligible).toBe(false);
    // Playing the lessons earns it.
    const played = { ...ev, passedLessonIds: new Set([...ev.passedLessonIds, 'l.c1.1', 'l.c1.2']) };
    expect(pathwayBadgeDecision(resolution, gradedPathwayProgress(kids, access, kcs, played), new Set()).eligible).toBe(true);
  });

  it('an accepted topic satisfies its KCs as course evidence (E2) for what follows', () => {
    const ev: LearnerEvidence = { ...mentor({}), masteryCompletedTopicIds: new Set(['topic.c1']) };
    expect(graphState(kids, access, kcs, ev).satisfaction.get('kc.c1')).toBe('course');
  });
});
