import { z } from 'zod';
import { parseCoursePath, type CoursePath } from './coursePath';
import { failureOf, type Failure, type LearnTransport } from './learnHome';

/*
 * W2L.1 (L2): one course screen for both course engines.
 *
 * Core runs the B.6 pathway engine behind a switch (COURSE_PATHWAY_ENGINE,
 * `linear` until the owner accepts the policy, OD-22). With the pathway engine
 * on, GET /learn/courses/:slug/path is the learner's frontier; with the linear
 * engine it answers PATHWAY_ENGINE_DISABLED and the course is the tree
 * (GET /learn/courses/:slug/tree). The legacy app had two screens for this,
 * one per engine; this module reads whichever Core serves and hands the one
 * rebuilt screen a single state. Both entries enforce B.2 (P7 under the
 * pathway engine, the stored badges under the linear one) and the age
 * safeguard, so each refusal has its own state. Core decides every lock; the
 * client never re-derives one and never receives an age.
 */

const localized = z.record(z.string(), z.unknown());
const progress = z.object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), pct: z.number().min(0).max(100) });

const lessonSchema = z.object({
  id: z.string().min(1),
  slug: z.string(),
  title: localized,
  state: z.enum(['locked', 'available', 'current', 'passed']),
  estimated_minutes: z.number().nonnegative().optional(),
  bestScore: z.number().min(0).max(100).optional(),
  placementCredited: z.boolean().optional(),
});
const topicSchema = z.object({ id: z.string().min(1), slug: z.string(), title: localized, lessons: z.array(lessonSchema) });
const sagaSchema = z.object({ id: z.string().min(1), slug: z.string(), title: localized, topics: z.array(topicSchema) });
const adventureSchema = z.object({
  id: z.string().min(1), slug: z.string(), title: localized,
  state: z.enum(['locked', 'available', 'completed']), progress, sagas: z.array(sagaSchema),
});

/** GET /learn/courses/:slug/tree, as far as the course screen reads it (the territory map reads the rest). */
export const courseTreeSchema = z.object({
  course: z.object({
    id: z.string().min(1), slug: z.string().min(1), title: localized, inProgress: z.boolean().optional(),
    progress, placementRequired: z.boolean(),
  }),
  adventures: z.array(adventureSchema),
  nextLessonId: z.string().nullable(),
});
export type CourseTree = z.infer<typeof courseTreeSchema>;
export type TreeLesson = z.infer<typeof lessonSchema>;
export type TreeAdventure = z.infer<typeof adventureSchema>;

export function parseCourseTree(raw: unknown): CourseTree | null {
  const parsed = courseTreeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type CourseDetail = { engine: 'pathway'; path: CoursePath } | { engine: 'linear'; tree: CourseTree };

export type CourseState =
  | { status: 'loading' }
  | { status: 'ready'; detail: CourseDetail }
  | { status: 'age-restricted' }
  | { status: 'prerequisite'; missing: string[] }
  | { status: 'not-found' }
  | { status: Failure };

type Reply = Awaited<ReturnType<LearnTransport>>;

/** One read of Core; a thrown transport is a lost connection. */
export async function call(request: LearnTransport, path: string): Promise<Reply> {
  try {
    return await request(path);
  } catch {
    return { data: null, error: { code: 'NETWORK' } };
  }
}

/** A course entry Core refused (shared by the course screen and the map, which read the same entry). */
export function courseRefusal(error: NonNullable<Reply['error']>): Exclude<CourseState, { status: 'loading' } | { status: 'ready' }> {
  switch (error.code) {
    case 'COURSE_AGE_RESTRICTED': return { status: 'age-restricted' };
    case 'COURSE_PREREQUISITE_REQUIRED': return { status: 'prerequisite', missing: error.missingPrerequisites ?? [] };
    case 'NOT_FOUND': return { status: 'not-found' };
    default: return { status: failureOf(error.code) };
  }
}

/** The course as Core serves it now: the pathway when that engine is on, the tree otherwise. */
export async function fetchCourse(slug: string, request: LearnTransport): Promise<CourseState> {
  const key = encodeURIComponent(slug);
  const path = await call(request, `/learn/courses/${key}/path`);
  if (!path.error) {
    const parsed = parseCoursePath(path.data);
    return parsed ? { status: 'ready', detail: { engine: 'pathway', path: parsed } } : { status: 'error' };
  }
  if (path.error.code !== 'PATHWAY_ENGINE_DISABLED') return courseRefusal(path.error);
  const tree = await call(request, `/learn/courses/${key}/tree`);
  if (tree.error) return courseRefusal(tree.error);
  const parsed = parseCourseTree(tree.data);
  return parsed ? { status: 'ready', detail: { engine: 'linear', tree: parsed } } : { status: 'error' };
}

/** A write to Core (OD-25's two confirmations); the learner host's transport takes a method and a body. */
export interface LearnWriteTransport {
  (path: string, init: { method: 'POST'; body: unknown }): Promise<{ data: unknown; error: { code: string } | null }>;
}

export type CourseAnswer = 'done' | 'refused' | 'offline' | 'error';

async function write(request: LearnWriteTransport, path: string, body: unknown): Promise<CourseAnswer> {
  let reply: Awaited<ReturnType<LearnWriteTransport>>;
  try {
    reply = await request(path, { method: 'POST', body });
  } catch {
    return 'offline';
  }
  if (!reply.error) return 'done';
  if (reply.error.code === 'NETWORK') return 'offline';
  // Core re-derived the offer and it no longer stands (or the engine is off): refresh, never retry blindly.
  return ['EARLY_ACCESS_NOT_ELIGIBLE', 'MASTERY_CREDIT_NOT_ELIGIBLE', 'PATHWAY_ENGINE_DISABLED', 'COURSE_AGE_RESTRICTED', 'NOT_FOUND'].includes(reply.error.code)
    ? 'refused' : 'error';
}

/** OD-25: the learner confirms opening a chapter one stage early. */
export function openChapterEarly(request: LearnWriteTransport, slug: string, chapterId: string): Promise<CourseAnswer> {
  return write(request, `/learn/courses/${encodeURIComponent(slug)}/early-access`, { chapterId });
}

/** OD-25: the learner accepts counting a topic as done on what they showed with the Mentor. */
export function acceptMasteryCredit(request: LearnWriteTransport, slug: string, topicId: string): Promise<CourseAnswer> {
  return write(request, `/learn/courses/${encodeURIComponent(slug)}/mastery-credit`, { topicId });
}

/** What the course offers next: its entry placement, one lesson, a finished course, or nothing to start. */
export type NextStep =
  | { kind: 'placement' }
  | { kind: 'lesson'; lessonId: string; title: Record<string, unknown>; minutes: number | null }
  | { kind: 'done' }
  | { kind: 'none' };

export function flatLessons(tree: CourseTree): { lesson: TreeLesson; topic: z.infer<typeof topicSchema>; adventure: TreeAdventure }[] {
  return tree.adventures.flatMap((adventure) => adventure.sagas.flatMap((saga) => saga.topics.flatMap((topic) =>
    topic.lessons.map((lesson) => ({ lesson, topic, adventure })))));
}

export function nextStep(detail: CourseDetail): NextStep {
  if (detail.engine === 'pathway') {
    const { pathway, items } = detail.path;
    if (pathway.placementRequired) return { kind: 'placement' };
    if (pathway.progress.complete) return { kind: 'done' };
    const recommended = items.find((item) => item.recommended);
    return recommended
      ? { kind: 'lesson', lessonId: recommended.lessonId, title: recommended.topicTitle, minutes: recommended.estimatedMinutes }
      : { kind: 'none' };
  }
  const { tree } = detail;
  if (tree.course.placementRequired) return { kind: 'placement' };
  const next = tree.nextLessonId ? flatLessons(tree).find(({ lesson }) => lesson.id === tree.nextLessonId) : undefined;
  if (next) return { kind: 'lesson', lessonId: next.lesson.id, title: next.topic.title, minutes: next.lesson.estimated_minutes ?? null };
  const { passed, total } = tree.course.progress;
  return total > 0 && passed >= total ? { kind: 'done' } : { kind: 'none' };
}

/** The course's progress as the learner's own path counts it (pathway completion under B.6). */
export function courseProgress(detail: CourseDetail): { passed: number; total: number; pct: number } {
  return detail.engine === 'pathway' ? detail.path.pathway.progress : detail.tree.course.progress;
}

export function courseTitle(detail: CourseDetail): Record<string, unknown> {
  return detail.engine === 'pathway' ? detail.path.course.title : detail.tree.course.title;
}
