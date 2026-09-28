/*
 * B.10 (S05.3c) — the guardian's narrative for course learning, the course
 * pillar's counterpart of the Mentor's session narrative
 * (services/pedagogy/sessionNarrative.ts). Same pattern, on purpose:
 *
 *   - Deterministic. No model reads or writes anything. Everything needed is
 *     already structured data: lesson completions (lesson_progress), graded
 *     attempts with their diagnostic codes (lesson_segment_attempts), the
 *     knowledge components each topic teaches (topic_knowledge_components,
 *     B.6) and the count of the learner's story decisions (B.9).
 *   - Structured, not prose. Core returns facts; the Family Hub renders one
 *     short sentence per fact in the guardian's language, within the Copy
 *     Budget. Titles are resolved in the GUARDIAN's locale by the route.
 *   - Emits nothing rather than a confident, content-free sentence.
 *
 * "The lesson does the explaining, you do the talking" (the Plan, step 2):
 * every entry ends in a conversation starter. When the child made story
 * decisions, the starter asks the guardian to ask about them. The narrative
 * counts decisions and never reveals which option the child chose (the
 * journal is the child's own record; the parent asks and the child tells).
 * Otherwise it invites the child to explain the skill in their own words.
 *
 * No I/O in this file.
 */

/** One graded attempt of the lesson, from lesson_segment_attempts. */
export interface NarrativeAttempt {
  segmentId: string;
  score: number;
  createdAt: string;
  hintsUsed: number;
  diagnosticCode: string | null;
  /** B.12 judgment of a v2 reasoning answer (GAP-FIX-R1); absent for v1 attempts. */
  judgment?: 'sound' | 'partial' | 'unsupported' | null;
}

export interface NarrativeLessonInput {
  lessonId: string;
  lessonTitle: string;
  topicTitle: string;
  courseTitle: string;
  completedAt: string;
  /** Knowledge-component titles the topic teaches, primary first, in the guardian's locale. Empty when the topic has no mapped component. */
  skills: string[];
  /** Graded attempts for this lesson: v1 attempts, or the receipts of completed v2 runs read server-side (GAP-FIX-R1). Empty for a story-only lesson. */
  attempts: NarrativeAttempt[];
  /** True when the lesson has graded exercises, so an empty `attempts` means placement-credited rather than "no struggle". */
  graded: boolean;
  /** How many story decisions the learner recorded in this lesson (B.9). */
  decisions: number;
  /** Every lesson of the topic is now passed. */
  topicComplete: boolean;
}

export type Struggle = 'none' | 'resolved' | 'open';

export interface LessonNarrative {
  lessonId: string;
  lessonTitle: string;
  topicTitle: string;
  courseTitle: string;
  completedAt: string;
  /** Up to two skills this lesson practised; the topic title when no skill is mapped. */
  skills: string[];
  /** Null when there is no attempt evidence to judge from (story-only or placement-credited). */
  struggle: Struggle | null;
  usedHint: boolean;
  decisions: number;
  topicComplete: boolean;
  /** Which conversation starter the Family Hub shows. */
  conversation: 'decision' | 'explain';
}

/** A segment counts as understood at this score, the default lesson pass bar. */
export const UNDERSTOOD_SCORE = 70;
const MAX_SKILLS = 2;

/**
 * Struggle, from the attempts alone:
 *   none      every exercise was right on its first attempt
 *   resolved  something was missed first and later got right (a retry, or with a hint)
 *   open      at least one exercise is still below the bar
 */
export function struggleOf(attempts: readonly NarrativeAttempt[]): Struggle | null {
  if (attempts.length === 0) return null;
  const bySegment = new Map<string, NarrativeAttempt[]>();
  for (const a of [...attempts].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    const list = bySegment.get(a.segmentId) ?? [];
    list.push(a);
    bySegment.set(a.segmentId, list);
  }
  let missed = false;
  for (const list of bySegment.values()) {
    const first = list[0]!;
    const firstMissed = first.score < UNDERSTOOD_SCORE || first.diagnosticCode === 'initial_incorrect';
    const best = Math.max(...list.map((a) => a.score));
    if (best < UNDERSTOOD_SCORE) return 'open';
    if (firstMissed) missed = true;
  }
  return missed ? 'resolved' : 'none';
}

/** The first attempt of each exercise, in time order. */
function firstTries(attempts: readonly NarrativeAttempt[]): NarrativeAttempt[] {
  const first = new Map<string, NarrativeAttempt>();
  for (const a of [...attempts].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) if (!first.has(a.segmentId)) first.set(a.segmentId, a);
  return [...first.values()];
}

export function buildLessonNarrative(input: NarrativeLessonInput): LessonNarrative {
  const skills = input.skills.filter(Boolean).slice(0, MAX_SKILLS);
  return {
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle,
    topicTitle: input.topicTitle,
    courseTitle: input.courseTitle,
    completedAt: input.completedAt,
    skills: skills.length > 0 ? skills : [input.topicTitle].filter(Boolean),
    struggle: input.graded ? struggleOf(input.attempts) : null,
    usedHint: input.attempts.some((a) => a.hintsUsed > 0),
    decisions: input.decisions,
    topicComplete: input.topicComplete,
    conversation: input.decisions > 0 ? 'decision' : 'explain',
  };
}

/**
 * GAP-FIX-R1 (B.10 for v2): the lesson's first-try share and B.12 judgment
 * counts, from the same attempts. Carried beside the entries (the entry shape
 * the Family Hub validates strictly is unchanged). Null without evidence.
 */
export interface LessonEvidence {
  lessonId: string;
  firstTry: { correct: number; graded: number };
  judgment?: { assessed: number; sound: number; partial: number; unsupported: number };
}

export function lessonEvidence(input: Pick<NarrativeLessonInput, 'lessonId' | 'attempts' | 'graded'>): LessonEvidence | null {
  const firsts = input.graded ? firstTries(input.attempts) : [];
  if (firsts.length === 0) return null;
  const judged = firsts.filter((a) => a.judgment);
  const count = (quality: 'sound' | 'partial' | 'unsupported') => judged.filter((a) => a.judgment === quality).length;
  return {
    lessonId: input.lessonId,
    firstTry: { correct: firsts.filter((a) => a.score >= UNDERSTOOD_SCORE && a.diagnosticCode !== 'initial_incorrect').length, graded: firsts.length },
    ...(judged.length > 0 ? { judgment: { assessed: judged.length, sound: count('sound'), partial: count('partial'), unsupported: count('unsupported') } } : {}),
  };
}

export interface WeekSummary {
  lessons: number;
  topicsCompleted: number;
}

/** The last seven days, counted from `now`, over the lessons the route read. */
export function weekSummary(entries: ReadonlyArray<Pick<LessonNarrative, 'completedAt' | 'topicComplete'>>, now: Date = new Date()): WeekSummary {
  const since = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => Date.parse(e.completedAt) >= since);
  return { lessons: recent.length, topicsCompleted: recent.filter((e) => e.topicComplete).length };
}
