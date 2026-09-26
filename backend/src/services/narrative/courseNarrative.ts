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
}

export interface NarrativeLessonInput {
  lessonId: string;
  lessonTitle: string;
  topicTitle: string;
  courseTitle: string;
  completedAt: string;
  /** Knowledge-component titles the topic teaches, primary first, in the guardian's locale. Empty when the topic has no mapped component. */
  skills: string[];
  /** v1 attempts for this lesson. Empty for a story-only lesson or a v2 lesson (its receipts are Core-only). */
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
  /** Null when there is no attempt evidence to judge from (story-only, v2 or placement-credited). */
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
