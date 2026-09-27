import { MASTERY_PREREQ_THRESHOLD } from '../pedagogy/bkt.js';

/*
 * B.6 / OD-16 / OD-22 — the age-pathway policy as executable, pure code.
 *
 * STATUS: engineering proposal awaiting owner review (OD-22). The written
 * policy is docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md; every numbered rule
 * there that a program can decide is decided HERE, and each one is pinned by
 * pathwayPolicy.test.ts. S05.3a ships this module and the data it reads; the
 * learner routes adopt it in the following checkpoint, so nothing a learner
 * sees changes yet.
 *
 * ONE BRAIN. Nothing here stores or estimates mastery. Prerequisites come
 * from the Mentor's KC graph (kc_edge), "already known" from the Mentor's BKT
 * posterior at the Mentor's own bar (MASTERY_PREREQ_THRESHOLD) or from graded
 * course evidence, and review from the Mentor's memory cards. A topic reaches
 * the graph only through topic_knowledge_components (kcTopicMap.ts).
 *
 * AGE IS A SAFEGUARD, NEVER A MASTERY PROXY (OD-16). Age decides which
 * chapters may open and which ones a learner's completion is measured on. It
 * never credits, skips or blocks a topic by itself; that is evidence's job.
 * Age evidence is read server-side and never leaves Core (S05.2a posture).
 */

export type PathwayStage = 'child' | 'tween' | 'teen' | 'adult';
export const STAGE_ORDER: readonly PathwayStage[] = ['child', 'tween', 'teen', 'adult'];

/** Frontend Bible registers and the v2 document `age_band`s: 6–9, 10–12, 13–17, 18+. */
export const STAGE_AGE_BANDS: Readonly<Record<PathwayStage, { min: number; max: number | null }>> = {
  child: { min: 6, max: 9 },
  tween: { min: 10, max: 12 },
  teen: { min: 13, max: 17 },
  adult: { min: 18, max: null },
};

export type LegacyAgeTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

/**
 * Legacy chapters (adventures without explicit pathway columns) keep the
 * audience their taxonomy.yaml declared: tier1 6–7, tier2 8–10, tier4 12–18.
 * tier3 is allowed by the 0008 CHECK but no catalog uses it; it is placed in
 * the tween band so a future row cannot fall between stages. The stage is the
 * band the ages mostly sit in: tier2 is a child chapter, tier4 a teen chapter.
 */
export const LEGACY_AGE_TIER_POLICY: Readonly<Record<LegacyAgeTier, { stage: PathwayStage; minAge: number; maxAge: number }>> = {
  tier1: { stage: 'child', minAge: 6, maxAge: 7 },
  tier2: { stage: 'child', minAge: 8, maxAge: 10 },
  tier3: { stage: 'tween', minAge: 11, maxAge: 12 },
  tier4: { stage: 'teen', minAge: 12, maxAge: 18 },
};

export interface ChapterRowLite {
  id: string;
  age_tier: string;
  pathway_stage?: string | null;
  eligibility_min_age?: number | null;
  eligibility_max_age?: number | null;
}

export interface ChapterPolicy {
  stage: PathwayStage;
  minAge: number;
  maxAge: number | null;
  source: 'explicit' | 'legacy-age-tier';
}

const isStage = (value: unknown): value is PathwayStage => typeof value === 'string' && (STAGE_ORDER as readonly string[]).includes(value);
const rank = (stage: PathwayStage): number => STAGE_ORDER.indexOf(stage);
const isAge = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 119;

/**
 * Rule P1 — a chapter's policy. Explicit columns win and must be complete and
 * coherent; a half-filled or incoherent row is `null`, which every caller
 * treats as CLOSED (fail closed, never fall back to a guess).
 */
export function chapterPolicy(row: ChapterRowLite): ChapterPolicy | null {
  const explicit = row.pathway_stage != null || row.eligibility_min_age != null || row.eligibility_max_age != null;
  if (explicit) {
    if (!isStage(row.pathway_stage) || !isAge(row.eligibility_min_age)) return null;
    const maxAge = row.eligibility_max_age ?? null;
    if (maxAge !== null && (!isAge(maxAge) || maxAge < row.eligibility_min_age)) return null;
    const band = STAGE_AGE_BANDS[row.pathway_stage];
    // The authored range must overlap its own stage band; a "teen" chapter for 6–9 is an authoring error.
    if (band.max !== null && row.eligibility_min_age > band.max) return null;
    if (maxAge !== null && maxAge < band.min) return null;
    return { stage: row.pathway_stage, minAge: row.eligibility_min_age, maxAge, source: 'explicit' };
  }
  const legacy = LEGACY_AGE_TIER_POLICY[row.age_tier as LegacyAgeTier];
  return legacy ? { stage: legacy.stage, minAge: legacy.minAge, maxAge: legacy.maxAge, source: 'legacy-age-tier' } : null;
}

/**
 * Server-side age evidence as an interval. `lowerBound` null means nothing
 * is known. Only the minimum needed leaves this function: no date, ever.
 */
export interface AgeEvidence {
  lowerBound: number | null;
  upperBound: number | null;
  exact: boolean;
}

function ageOn(birthDate: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !Number.isFinite(now.getTime())) return null;
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate || birth > now) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/**
 * Rule P2 — age evidence follows age, not account role. A valid birth date is
 * exact; otherwise the declared band bounds it; an under-13 protected origin
 * (the A.2 refusal path) caps it at 12 whatever else was typed.
 */
export function learnerAgeEvidence(
  input: { birthDate: string | null; declaredBand: 'under_13' | '13_to_17' | 'adult' | null; protectedOrigin: boolean },
  now = new Date(),
): AgeEvidence {
  const exactAge = input.birthDate ? ageOn(input.birthDate, now) : null;
  let evidence: AgeEvidence;
  if (exactAge !== null) evidence = { lowerBound: exactAge, upperBound: exactAge, exact: true };
  else if (input.declaredBand === '13_to_17') evidence = { lowerBound: 13, upperBound: 17, exact: false };
  else if (input.declaredBand === 'adult') evidence = { lowerBound: 18, upperBound: null, exact: false };
  else if (input.declaredBand === 'under_13') evidence = { lowerBound: null, upperBound: 12, exact: false };
  else evidence = { lowerBound: null, upperBound: null, exact: false };
  if (input.protectedOrigin) {
    const cap = (value: number | null): number | null => (value === null ? 12 : Math.min(value, 12));
    evidence = { lowerBound: evidence.lowerBound === null ? null : Math.min(evidence.lowerBound, 12), upperBound: cap(evidence.upperBound), exact: evidence.exact && (evidence.lowerBound ?? 0) <= 12 };
  }
  return evidence;
}

/** Rule P3 — the learner's stage is the band of the YOUNGEST age the evidence allows. Unknown is child. */
export function learnerStage(evidence: AgeEvidence): PathwayStage {
  const age = evidence.lowerBound;
  if (age === null || age < STAGE_AGE_BANDS.tween.min) return 'child';
  if (age < STAGE_AGE_BANDS.teen.min) return 'tween';
  if (age < STAGE_AGE_BANDS.adult.min) return 'teen';
  return 'adult';
}

/**
 * Rule P4 — the safeguard. Child chapters are open to everyone. Any other
 * chapter opens only when the youngest age the evidence allows meets the
 * chapter's minimum; unknown age opens nothing above child.
 */
export function chapterOpensForAge(evidence: AgeEvidence, policy: ChapterPolicy | null): boolean {
  if (!policy) return false;
  if (policy.stage === 'child') return true;
  return evidence.lowerBound !== null && evidence.lowerBound >= policy.minAge;
}

export type ChapterAccess = 'pathway' | 'optional' | 'closed';
export type PathwayBasis = 'own-stage' | 'younger-bridge' | 'older-early' | 'unavailable';

export interface PathwayResolution {
  learnerStage: PathwayStage;
  /** The stage whose chapters the learner's completion is measured on (null when unavailable). */
  pathwayStage: PathwayStage | null;
  basis: PathwayBasis;
  access: Map<string, ChapterAccess>;
}

/**
 * Rule P5 — which chapters form the learner's pathway in ONE course.
 *  1. Open chapters of the learner's own stage.
 *  2. Else the nearest YOUNGER stage with open chapters ("younger-bridge":
 *     today's adults in the teen-only legacy courses). Recorded as a content
 *     gap: OD-16 wants genuinely authored chapters for every stage.
 *  3. Else the nearest OLDER stage whose chapters the safeguard opens
 *     ("older-early": a 12-year-old in the 12–18 legacy chapters).
 *  4. Else the course is unavailable to this learner.
 * Every other open chapter is optional: playable, never required, never in a
 * denominator. Closed chapters never open, whatever the evidence of mastery.
 */
export function resolvePathway(evidence: AgeEvidence, chapters: ReadonlyArray<{ id: string; policy: ChapterPolicy | null }>): PathwayResolution {
  const stage = learnerStage(evidence);
  const open = chapters.filter((c) => chapterOpensForAge(evidence, c.policy)) as Array<{ id: string; policy: ChapterPolicy }>;
  const stagesWithOpen = new Set(open.map((c) => c.policy.stage));
  let pathwayStage: PathwayStage | null = null;
  let basis: PathwayBasis = 'unavailable';
  if (stagesWithOpen.has(stage)) {
    pathwayStage = stage;
    basis = 'own-stage';
  } else {
    const younger = [...STAGE_ORDER].slice(0, rank(stage)).reverse().find((s) => stagesWithOpen.has(s));
    const older = STAGE_ORDER.slice(rank(stage) + 1).find((s) => stagesWithOpen.has(s));
    if (younger) {
      pathwayStage = younger;
      basis = 'younger-bridge';
    } else if (older) {
      pathwayStage = older;
      basis = 'older-early';
    }
  }
  const access = new Map<string, ChapterAccess>();
  for (const chapter of chapters) {
    const opens = chapterOpensForAge(evidence, chapter.policy);
    access.set(chapter.id, !opens ? 'closed' : chapter.policy!.stage === pathwayStage ? 'pathway' : 'optional');
  }
  return { learnerStage: stage, pathwayStage, basis, access };
}

export type CoursePrerequisiteDecision = 'satisfied' | 'waived-younger-stage' | 'missing';

/**
 * Rule P7 — a course-level prerequisite (B.2, `courses.requires`) across
 * stages. It is satisfied by a credential of the required course earned in
 * ANY stage (a frozen legacy badge included). When the learner's pathway in
 * the required course would be a younger bridge — a teen or adult facing a
 * children's course — it is waived: OD-16 never makes an older learner
 * complete another stage's chapters, and what that course teaches still
 * reaches the frontier through the shared graph (F2/F5). Otherwise it is
 * missing. S05.2ba's route currently demands the badge from everyone; S05.3b
 * adopts this rule there.
 */
export function coursePrerequisiteDecision(
  requiredCourse: PathwayResolution,
  earnedStagesInRequiredCourse: ReadonlySet<PathwayStage>,
): CoursePrerequisiteDecision {
  if (earnedStagesInRequiredCourse.size > 0) return 'satisfied';
  if (requiredCourse.basis === 'younger-bridge') return 'waived-younger-stage';
  return 'missing';
}

// ---------------------------------------------------------------------------
// Course structure and evidence
// ---------------------------------------------------------------------------

export interface PathwayTopic {
  id: string;
  /** "<adventure>/<saga>/<topic>" — the key into the KC map. */
  path: string;
  position: number;
  kind: 'teaching' | 'review_spaced' | 'review_interleaved' | 'review_quest';
  /** Live lesson ids in position order. */
  lessonIds: readonly string[];
  /** Authored topic prerequisites of strength "hard": topic or saga paths. */
  hardPrerequisites: readonly string[];
  reviewOf: readonly string[];
}

export interface PathwaySaga {
  id: string;
  position: number;
  topics: readonly PathwayTopic[];
}

export interface PathwayChapter {
  id: string;
  position: number;
  policy: ChapterPolicy | null;
  sagas: readonly PathwaySaga[];
}

export interface TopicKcs {
  teaches: readonly string[];
  reviews: readonly string[];
}

export interface LearnerEvidence {
  /** lesson_progress rows with passed = true. */
  passedLessonIds: ReadonlySet<string>;
  /** placement_credits lesson ids — count as passed, never as played (0043 decision). */
  creditedLessonIds: ReadonlySet<string>;
  /** Mentor BKT posterior by KC key (learner_kc_mastery). */
  mentorPKnown: ReadonlyMap<string, number>;
  /** KC keys whose Mentor memory card is due now (memory_card). */
  dueReviewKcs: ReadonlySet<string>;
  /**
   * OD-24: ACTIVE KC keys a completed legacy topic taught (legacy_kc_credits,
   * written by the OD-9 toolkit before the legacy catalog is retired). Graded
   * course evidence under E2 that outlives the legacy content; T3: it
   * satisfies prerequisites at every stage and never completes a topic.
   */
  legacyCreditedKcs?: ReadonlySet<string>;
}

export interface TopicCompletion {
  done: number;
  total: number;
  complete: boolean;
}

/** Rule E1 — a topic is complete when every live lesson is passed or placement-credited. */
export function topicCompletion(topic: PathwayTopic, evidence: LearnerEvidence): TopicCompletion {
  const done = topic.lessonIds.filter((id) => evidence.passedLessonIds.has(id) || evidence.creditedLessonIds.has(id)).length;
  return { done, total: topic.lessonIds.length, complete: topic.lessonIds.length > 0 && done === topic.lessonIds.length };
}

export type KcSatisfaction = 'course' | 'mentor' | 'none';

export interface GraphState {
  /** How each KC is currently satisfied for prerequisite purposes. */
  satisfaction: Map<string, KcSatisfaction>;
}

/**
 * Rule E2 — a KC is satisfied by graded course evidence (a complete topic, in
 * any open chapter, that TEACHES it, or an OD-24 legacy credit for one) or by
 * the Mentor's posterior at its own prerequisite bar. Either way the other surface cannot show it as locked.
 */
export function graphState(
  chapters: readonly PathwayChapter[],
  access: ReadonlyMap<string, ChapterAccess>,
  kcsByTopicPath: ReadonlyMap<string, TopicKcs>,
  evidence: LearnerEvidence,
): GraphState {
  const satisfaction = new Map<string, KcSatisfaction>();
  for (const chapter of chapters) {
    if ((access.get(chapter.id) ?? 'closed') === 'closed') continue;
    for (const saga of chapter.sagas) {
      for (const topic of saga.topics) {
        const kcs = kcsByTopicPath.get(topic.path);
        if (kcs && topicCompletion(topic, evidence).complete) kcs.teaches.forEach((kc) => satisfaction.set(kc, 'course'));
      }
    }
  }
  for (const kc of evidence.legacyCreditedKcs ?? []) {
    if (!satisfaction.has(kc)) satisfaction.set(kc, 'course');
  }
  for (const [kc, p] of evidence.mentorPKnown) {
    if (!satisfaction.has(kc) && p >= MASTERY_PREREQ_THRESHOLD) satisfaction.set(kc, 'mentor');
  }
  return { satisfaction };
}

export interface FrontierItem {
  topicId: string;
  topicPath: string;
  chapterId: string;
  /** First lesson of the topic not yet passed or credited. */
  lessonId: string;
  reason: 'next' | 'review' | 'review-due' | 'bridge';
  access: 'pathway' | 'optional';
}

export interface BlockedSaga {
  sagaId: string;
  topicPath: string;
  missingKcs: string[];
  missingTopics: string[];
}

export interface Frontier {
  items: FrontierItem[];
  blocked: BlockedSaga[];
  /** Unsatisfied prerequisites taught only outside the pathway: suggested, never required (OD-16). */
  advisoryKcs: string[];
}

function firstOpenLesson(topic: PathwayTopic, evidence: LearnerEvidence): string | null {
  return topic.lessonIds.find((id) => !evidence.passedLessonIds.has(id) && !evidence.creditedLessonIds.has(id)) ?? null;
}

const byPosition = <T extends { position: number }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.position - b.position);

/**
 * Rules F1–F7 — the frontier that replaces the single linear "current lesson".
 *
 *  F1  Pathway order is the authored order: chapter, saga, topic position.
 *      Each saga of a pathway chapter contributes at most its FIRST
 *      incomplete topic, so the narrative inside a saga is kept (B.9).
 *  F2  A topic's KC prerequisites are the Mentor-graph prerequisites of every
 *      KC it teaches, minus the KCs it teaches itself. One of them BLOCKS only
 *      when an EARLIER pathway topic teaches it and it is not yet satisfied
 *      (Rule E2). Where the shared graph and the authored order disagree, the
 *      authored order wins for gating, and where nothing earlier in the
 *      pathway teaches a prerequisite (a content gap, another course, a
 *      younger stage) it never blocks: a course cannot demand what it has
 *      not taught, and an adult never has to clear childhood chapters.
 *  F3  Authored hard topic prerequisites and review citations block the same
 *      way: only when they point at an earlier pathway topic that is neither
 *      complete nor has all of its taught KCs satisfied.
 *  F4  Chapters are no longer locked in sequence: every open saga of every
 *      pathway chapter is on the frontier, ranked in pathway order.
 *  F5  A prerequisite that stays unsatisfied and is taught only in an
 *      OPTIONAL chapter is advisory: its first incomplete teaching topic there
 *      is offered as a "bridge" item after the pathway items.
 *  F6  At most one "review-due" item leads: a Mentor memory card that is due
 *      promotes the first open frontier review topic that reviews it.
 *  F7  No deadlock, by construction: the earliest incomplete pathway topic
 *      only waits on earlier topics, which are all complete, so the frontier
 *      is empty only when the pathway is complete (pinned on the whole real
 *      catalog by pathwayPolicy.test.ts).
 * Deterministic: same inputs, same order.
 */
export function computeFrontier(
  chapters: readonly PathwayChapter[],
  access: ReadonlyMap<string, ChapterAccess>,
  kcsByTopicPath: ReadonlyMap<string, TopicKcs>,
  kcPrerequisites: ReadonlyMap<string, readonly string[]>,
  evidence: LearnerEvidence,
): Frontier {
  const state = graphState(chapters, access, kcsByTopicPath, evidence);
  const sorted = byPosition(chapters);
  const pathwayChapters = sorted.filter((c) => access.get(c.id) === 'pathway');
  const optionalChapters = sorted.filter((c) => access.get(c.id) === 'optional');

  // Pathway order index, the topics of each saga path, and where each KC is first taught.
  const orderOf = new Map<string, number>();
  const pathwayTopicByPath = new Map<string, PathwayTopic>();
  const pathwayTopicsBySaga = new Map<string, PathwayTopic[]>();
  const earliestTeacher = new Map<string, number>();
  for (const chapter of pathwayChapters) {
    for (const saga of byPosition(chapter.sagas)) {
      for (const topic of byPosition(saga.topics)) {
        const order = orderOf.size;
        orderOf.set(topic.path, order);
        pathwayTopicByPath.set(topic.path, topic);
        const sagaPath = topic.path.split('/').slice(0, 2).join('/');
        pathwayTopicsBySaga.set(sagaPath, [...(pathwayTopicsBySaga.get(sagaPath) ?? []), topic]);
        for (const kc of kcsByTopicPath.get(topic.path)?.teaches ?? []) {
          if (!earliestTeacher.has(kc)) earliestTeacher.set(kc, order);
        }
      }
    }
  }

  const satisfied = (kc: string): boolean => (state.satisfaction.get(kc) ?? 'none') !== 'none';
  const topicSatisfied = (topic: PathwayTopic): boolean => {
    if (topicCompletion(topic, evidence).complete) return true;
    const kcs = kcsByTopicPath.get(topic.path)?.teaches ?? [];
    return kcs.length > 0 && kcs.every(satisfied);
  };
  /** Earlier pathway topics a citation names; later, outside or unknown ones are advisory. */
  const citedEarlier = (citation: string, before: number): PathwayTopic[] => {
    const direct = pathwayTopicByPath.get(citation);
    const cited = direct ? [direct] : (pathwayTopicsBySaga.get(citation) ?? []).filter((t) => t.kind === 'teaching');
    return cited.filter((t) => (orderOf.get(t.path) ?? Infinity) < before);
  };
  const advisory = new Set<string>();
  const missingFor = (topic: PathwayTopic): { kcs: string[]; topics: string[] } => {
    const order = orderOf.get(topic.path) ?? Infinity;
    const teaches = new Set(kcsByTopicPath.get(topic.path)?.teaches ?? []);
    const missingKcs = new Set<string>();
    for (const kc of teaches) {
      for (const prereq of kcPrerequisites.get(kc) ?? []) {
        if (teaches.has(prereq) || satisfied(prereq)) continue;
        if ((earliestTeacher.get(prereq) ?? Infinity) < order) missingKcs.add(prereq);
        else advisory.add(prereq);
      }
    }
    const citations = topic.kind === 'teaching' ? topic.hardPrerequisites : [...topic.hardPrerequisites, ...topic.reviewOf];
    const missingTopics = citations.filter((c) => citedEarlier(c, order).some((t) => !topicSatisfied(t)));
    return { kcs: [...missingKcs].sort(), topics: missingTopics };
  };

  const items: FrontierItem[] = [];
  const blocked: BlockedSaga[] = [];
  const openReviews: FrontierItem[] = [];
  for (const chapter of pathwayChapters) {
    for (const saga of byPosition(chapter.sagas)) {
      const next = byPosition(saga.topics).find((t) => t.lessonIds.length > 0 && !topicCompletion(t, evidence).complete);
      if (!next) continue;
      const missing = missingFor(next);
      const lessonId = firstOpenLesson(next, evidence);
      if (missing.kcs.length === 0 && missing.topics.length === 0 && lessonId) {
        const item: FrontierItem = { topicId: next.id, topicPath: next.path, chapterId: chapter.id, lessonId, reason: next.kind === 'teaching' ? 'next' : 'review', access: 'pathway' };
        items.push(item);
        if (next.kind !== 'teaching') openReviews.push(item);
        continue;
      }
      blocked.push({ sagaId: saga.id, topicPath: next.path, missingKcs: missing.kcs, missingTopics: missing.topics });
    }
  }

  // F5: one bridge per advisory KC that an optional chapter teaches.
  const bridges: FrontierItem[] = [];
  const advisoryKcs = [...advisory].sort();
  for (const kc of advisoryKcs) {
    for (const chapter of optionalChapters) {
      const candidate = byPosition(chapter.sagas)
        .flatMap((s) => byPosition(s.topics))
        .find((t) => t.kind === 'teaching' && (kcsByTopicPath.get(t.path)?.teaches ?? []).includes(kc) && !topicCompletion(t, evidence).complete);
      const lessonId = candidate ? firstOpenLesson(candidate, evidence) : null;
      if (candidate && lessonId) {
        if (!bridges.some((b) => b.topicId === candidate.id)) {
          bridges.push({ topicId: candidate.id, topicPath: candidate.path, chapterId: chapter.id, lessonId, reason: 'bridge', access: 'optional' });
        }
        break;
      }
    }
  }

  // F6: one review-due lead, from an OPEN frontier review topic that reviews a due KC.
  const dueKcs = [...evidence.dueReviewKcs].sort();
  const lead = openReviews.find((item) => dueKcs.some((kc) => (kcsByTopicPath.get(item.topicPath)?.reviews ?? []).includes(kc)));
  const ordered = lead ? [{ ...lead, reason: 'review-due' as const }, ...items.filter((i) => i.topicId !== lead.topicId)] : items;
  return { items: [...ordered, ...bridges], blocked, advisoryKcs };
}

// ---------------------------------------------------------------------------
// Progress, completion and badges
// ---------------------------------------------------------------------------

export interface PathwayProgress {
  passed: number;
  total: number;
  pct: number;
  /** KCs the pathway teaches, and how many are satisfied (course or Mentor). */
  kcsTaught: number;
  kcsSatisfied: number;
  /** Rule B1: every topic of every pathway chapter complete. */
  complete: boolean;
}

/**
 * Rules B1–B3 — progress and completion are measured on the PATHWAY only.
 *  B1  Progress % = lessons passed or credited in pathway chapters / lessons
 *      in pathway chapters. For a legacy single-stage course whose chapters
 *      are all the learner's pathway this is exactly today's formula, so no
 *      migrated percentage moves (OD-9).
 *  B2  Graph completion = every topic of the pathway complete, i.e. every KC
 *      the pathway teaches demonstrated through its own graded topics or
 *      placement credits. Mentor mastery alone satisfies prerequisites but
 *      never completes a pathway topic: completion stays graded evidence.
 *  B3  Optional and closed chapters never enter a denominator: an adult is
 *      never measured on childhood chapters, a minor never on adult ones.
 */
export function pathwayProgress(
  chapters: readonly PathwayChapter[],
  access: ReadonlyMap<string, ChapterAccess>,
  kcsByTopicPath: ReadonlyMap<string, TopicKcs>,
  evidence: LearnerEvidence,
): PathwayProgress {
  let passed = 0;
  let total = 0;
  let complete = true;
  let topicCount = 0;
  const taught = new Set<string>();
  for (const chapter of chapters) {
    if (access.get(chapter.id) !== 'pathway') continue;
    for (const saga of chapter.sagas) {
      for (const topic of saga.topics) {
        const c = topicCompletion(topic, evidence);
        passed += c.done;
        total += c.total;
        if (c.total > 0) {
          topicCount++;
          if (!c.complete) complete = false;
        }
        (kcsByTopicPath.get(topic.path)?.teaches ?? []).forEach((kc) => taught.add(kc));
      }
    }
  }
  const state = graphState(chapters, access, kcsByTopicPath, evidence);
  const kcsSatisfied = [...taught].filter((kc) => (state.satisfaction.get(kc) ?? 'none') !== 'none').length;
  return {
    passed,
    total,
    pct: total === 0 ? 0 : Math.round((passed / total) * 100),
    kcsTaught: taught.size,
    kcsSatisfied,
    complete: topicCount > 0 && complete,
  };
}

/**
 * Rule B4 — a course badge is a staged credential: earned for the pathway
 * stage it was completed on, once, and never revoked by a later catalog
 * expansion, an age change or a map revision (OD-9). An unavailable pathway
 * can never earn one; a younger-bridge pathway can (today's adults keep
 * today's badges) and is reported as a content gap.
 */
export function pathwayBadgeDecision(
  resolution: PathwayResolution,
  progress: PathwayProgress,
  alreadyEarnedStages: ReadonlySet<PathwayStage>,
): { eligible: boolean; stage: PathwayStage | null; alreadyEarned: boolean; contentGap: boolean } {
  const stage = resolution.pathwayStage;
  if (stage === null) return { eligible: false, stage: null, alreadyEarned: false, contentGap: true };
  const alreadyEarned = alreadyEarnedStages.has(stage);
  return { eligible: progress.complete && !alreadyEarned, stage, alreadyEarned, contentGap: resolution.basis !== 'own-stage' };
}

/**
 * Rule B5 — which stage credentials a learner already holds in one course,
 * from course_pathway_badges rows. A frozen legacy full-course badge counts
 * as the credential of the stage its chapters formed, so a learner who earned
 * the legacy badge is never asked to earn the same stage twice.
 */
export function earnedStagesFromBadgeRows(
  rows: ReadonlyArray<{ award_key: string; pathway_stage: string | null }>,
): Set<PathwayStage> {
  const stages = new Set<PathwayStage>();
  for (const row of rows) {
    if (isStage(row.pathway_stage)) stages.add(row.pathway_stage);
    else if (isStage(row.award_key)) stages.add(row.award_key);
  }
  return stages;
}

// ---------------------------------------------------------------------------
// Legacy-credit equivalence (OD-9)
// ---------------------------------------------------------------------------

export type EvidenceTreatment =
  | 'kept-as-is-counts-toward-completion'
  | 'kept-as-is-satisfies-prerequisites'
  | 'kept-as-is-never-revoked'
  | 'kept-as-is-outside-pathway-scope';

/**
 * Every OD-9 evidence type and what the pathway model does with it. None is
 * rewritten, re-scored, remapped or deleted by the pathway cutover; the test
 * pins that no entry is ever "dropped" and that the list covers OD-9 §4.1.
 */
export const LEGACY_EVIDENCE_EQUIVALENCE: ReadonlyArray<{ evidence: string; table: string; treatment: EvidenceTreatment; rule: string }> = [
  { evidence: 'lesson passes and best scores', table: 'lesson_progress', treatment: 'kept-as-is-counts-toward-completion', rule: 'E1/B1: a passed lesson completes its topic in every stage; best_score is preserved and never lowered (B.5).' },
  { evidence: 'placement credits', table: 'placement_credits', treatment: 'kept-as-is-counts-toward-completion', rule: 'E1/B1: counts as passed for completion and badges, never as played and never as XP.' },
  { evidence: 'placement records', table: 'course_placements', treatment: 'kept-as-is-satisfies-prerequisites', rule: 'P6: a legacy placement is the entry placement of the pathway stage its course chapters had at cutover.' },
  { evidence: 'segment attempts and v2 attempts', table: 'lesson_segment_attempts, lesson_v2_attempts', treatment: 'kept-as-is-outside-pathway-scope', rule: 'Grading history; pathway reads only lesson-level outcomes.' },
  { evidence: 'XP', table: 'profiles / learning events', treatment: 'kept-as-is-outside-pathway-scope', rule: 'Never recomputed from pathway membership.' },
  { evidence: 'course badges', table: 'badge awards and shares', treatment: 'kept-as-is-never-revoked', rule: 'B4: a legacy course badge is the credential of the stage its chapters form (financial-education, first-lemonade-stand: child; investing, entrepreneurship: teen).' },
  { evidence: 'streaks (current and best)', table: 'streak state', treatment: 'kept-as-is-outside-pathway-scope', rule: 'Pathway changes never touch streak arithmetic.' },
  { evidence: 'Mentor mastery, review cards, misconceptions, evidence log', table: 'learner_kc_mastery, memory_card, learner_misconception, kc_attempt', treatment: 'kept-as-is-satisfies-prerequisites', rule: 'E2/F6: the same rows drive course prerequisites and review-due items; no copy, no second model.' },
  { evidence: 'Mentor plans and notebooks', table: 'tutor tables', treatment: 'kept-as-is-outside-pathway-scope', rule: 'Untouched.' },
  { evidence: 'coins, savings goals, chore history', table: 'family hub tables', treatment: 'kept-as-is-outside-pathway-scope', rule: 'Untouched.' },
];
