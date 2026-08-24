import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { loadCourseTree } from './learn.js';
import {
  courseOutline,
  flattenTopicsForPlacement,
  listPlacementProbesForGrading,
  placementProbeForTopic,
} from '../services/courseTree.js';
import {
  MAX_QUESTIONS,
  gradeQuizAnswers,
  nextPlacementStep,
  placeAtLearnerChoice,
  type ClaimedLevel,
  type DoneStep,
  type EducationLevel,
  type PlacementSignals,
  type PlacementTopic,
} from '../services/placementAlgorithm.js';
import { ageBandForIntake, runPlacementIntake } from '../services/placementIntake.js';
import {
  getCoursePlacement,
  getFullOwnProfile,
  getPublishedCourseBySlug,
  insertCoursePlacement,
  insertPlacementCredits,
  patchOwnProfile,
} from '../services/supabaseRest.js';

/*
 * /api/v1/placement — the per-course placement flow (COURSE_ENGINE.md §3.2).
 *
 * STATELESS BY DESIGN. There is no session table and no server-side quiz state.
 * The client holds the answers it has given and sends the whole list with every
 * request; the server replays the deterministic search over it to decide the
 * next question. That makes a refresh, a dropped connection, a back button and
 * a switched device all free, and it keeps grading server-authoritative: an
 * answer is graded against the persisted probe, never against anything the
 * client asserts, and an answer for a topic that carries no probe cannot be
 * correct because there is no correct index to match.
 *
 * WHAT A CLIENT CAN AND CANNOT DO WITH THAT. It can retry the quiz freely
 * before committing, which is intentional — nothing is written until /commit.
 * It cannot learn an answer it did not guess (correctIndex never leaves the
 * server), and it cannot commit a frontier its answers did not earn: /commit
 * recomputes the placement from the graded answers and clamps any learner
 * adjustment DOWNWARD only.
 */

const NOT_FOUND = 'NOT_FOUND';
const CLAIMED_LEVELS = ['new', 'some', 'confident'] as const;
const EDUCATION_LEVELS = ['preschool', 'elementary', 'middle', 'high', 'adult'] as const;
type Locale = 'en-US' | 'es-MX' | 'pt-BR';

function isValidPastDate(d: string): boolean {
  const t = Date.parse(d);
  return !Number.isNaN(t) && t <= Date.now() && Number(d.slice(0, 4)) >= 1900;
}

const BirthDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be yyyy-mm-dd')
  .refine(isValidPastDate, 'Enter a valid birth date');

/** The self-reported half. Every field optional: a learner may answer nothing and still be placed. */
const SignalsBody = z
  .object({
    claimedLevel: z.enum(CLAIMED_LEVELS).optional(),
    educationLevel: z.enum(EDUCATION_LEVELS).optional(),
    birthDate: BirthDate.optional(),
    /** Carried back from POST /intake so the search opens where the conversation suggested. */
    aiPriorFraction: z.number().min(0).max(1).optional(),
  })
  .strict();

const AnswersBody = z
  .array(z.object({ topicId: z.string().uuid(), selectedIndex: z.number().int().min(0).max(16) }))
  .max(MAX_QUESTIONS);

const StepBody = z.object({ signals: SignalsBody.default({}), answers: AnswersBody.default([]) }).strict();

const CommitBody = z
  .object({
    signals: SignalsBody.default({}),
    answers: AnswersBody.default([]),
    /**
     * The learner moving themselves on the result screen, or choosing to start
     * from the beginning without taking the quiz at all. Clamped to the frontier
     * the answers actually earned — a learner may always go LOWER, never higher
     * than their own evidence.
     */
    chosenFrontier: z.number().int().min(0).optional(),
    /** True when the learner skipped the quiz outright ("empezar desde cero"). */
    startFromBeginning: z.boolean().default(false),
  })
  .strict();

const IntakeBody = z
  .object({
    learnerText: z.string().min(1).max(4000),
    /** Localized fallback line, owned by the frontend catalog — see placementIntake.ts. */
    neutralReflection: z.string().min(1).max(400),
    birthDate: BirthDate.optional(),
  })
  .strict();

function ageYearsFrom(birthDate: string | null | undefined, now: Date): number | undefined {
  if (!birthDate) return undefined;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return undefined;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 ? age : undefined;
}

function signalsFrom(
  body: z.infer<typeof SignalsBody>,
  knownBirthDate: string | null | undefined,
  now: Date,
): PlacementSignals {
  return {
    claimedLevel: body.claimedLevel as ClaimedLevel | undefined,
    educationLevel: body.educationLevel as EducationLevel | undefined,
    ageYears: ageYearsFrom(body.birthDate ?? knownBirthDate, now),
    aiPriorFraction: body.aiPriorFraction,
  };
}

/**
 * Placement walks topics that a learner can actually PLAY. A topic whose
 * lessons are all archived arrives from the tree with an empty lesson list
 * (RLS hides archived rows), and financial-education alone has 733 archived
 * lessons behind 26 such topics. Leaving them in the ordered path would let the
 * frontier land on a topic with nothing in it, and would silently inflate every
 * "you skipped N lessons" number with lessons that do not exist.
 */
function playableTopics(tree: Parameters<typeof flattenTopicsForPlacement>[0]): PlacementTopic[] {
  return flattenTopicsForPlacement(tree).filter((t) => t.lessonIds.length > 0);
}

/** The shape the client renders a finished placement with. */
function describeResult(done: DoneStep, topics: readonly PlacementTopic[]) {
  return {
    frontier: done.frontier,
    startTopicId: done.startTopicId,
    startLessonId: done.startLessonId,
    creditedLessonCount: done.creditedLessonIds.length,
    creditedTopicCount: done.creditedTopicCount,
    totalTopicCount: topics.length,
    method: done.method,
    cappedByPrerequisite: done.cappedByPrerequisite,
  };
}

export function placementRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  /**
   * What the client needs to open the flow: whether we already know the age (so
   * the question is not asked twice), and whether the conversational intake is
   * on the table for this learner at all.
   */
  router.get('/:courseSlug/intake', async (req, res) => {
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.courseSlug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');

    const profiles = await getFullOwnProfile(user.accessToken, user.id);
    if (!profiles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');
    const birthDate = profiles[0]?.birth_date ?? null;

    return ok(res, {
      ageAlreadyKnown: Boolean(birthDate),
      /*
       * The §1.9 floor, decided here and nowhere else. Under 12 — and unknown,
       * which we refuse to treat as "probably old enough" — never sees a
       * free-text box, and the client is told so rather than being trusted to
       * work it out.
       */
      conversationalIntakeAvailable: ageBandForIntake(birthDate, new Date()) !== null,
    });
  });

  /**
   * The conversational opener, 12+ only. Advisory in every sense: its answer is
   * a prior the client carries into /step, and a null here simply means the
   * learner answers the ordinary questions instead.
   */
  router.post('/:courseSlug/intake', async (req, res) => {
    const parsed = IntakeBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.courseSlug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');

    const [tree, profiles] = await Promise.all([
      loadCourseTree(user.accessToken, user.id, course),
      getFullOwnProfile(user.accessToken, user.id),
    ]);
    if (!tree) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (!profiles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');

    const locale = (profiles[0]?.locale as Locale | undefined) ?? 'en-US';
    const ageBand = ageBandForIntake(parsed.data.birthDate ?? profiles[0]?.birth_date, new Date());
    if (!ageBand) {
      // Not an error — the learner is simply not eligible, and the client shows
      // the deterministic opener. Saying so plainly beats a 403 the UI has to
      // interpret as a normal state.
      return ok(res, { available: false, priorFraction: null, reflection: null });
    }

    const courseTitle = (tree.course.title as Record<string, string> | null)?.[locale] ?? course.slug;
    const outcome = await runPlacementIntake({
      courseTitle,
      courseSubject: tree.course.subject,
      outline: courseOutline(tree, locale),
      locale,
      ageBand,
      learnerText: parsed.data.learnerText,
      neutralReflection: parsed.data.neutralReflection,
    });

    if (!outcome) return ok(res, { available: false, priorFraction: null, reflection: null });
    return ok(res, { available: true, priorFraction: outcome.priorFraction, reflection: outcome.reflection });
  });

  /**
   * The next question, or the result the answers so far imply. Writes nothing:
   * a learner can walk the quiz, go back, and walk it again, and the only thing
   * that persists is what /commit is explicitly asked to persist.
   */
  router.post('/:courseSlug/step', async (req, res) => {
    const parsed = StepBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.courseSlug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');

    const [tree, profiles] = await Promise.all([
      loadCourseTree(user.accessToken, user.id, course),
      getFullOwnProfile(user.accessToken, user.id),
    ]);
    if (!tree) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (!profiles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');

    const locale = (profiles[0]?.locale as Locale | undefined) ?? 'en-US';
    const topics = playableTopics(tree);
    const graded = gradeQuizAnswers(listPlacementProbesForGrading(tree, locale), parsed.data.answers);
    const signals = signalsFrom(parsed.data.signals, profiles[0]?.birth_date, new Date());
    const step = nextPlacementStep(topics, signals, graded);

    if (step.kind === 'done') {
      return ok(res, { kind: 'done', result: describeResult(step, topics) });
    }

    const probe = placementProbeForTopic(tree, step.topicId, locale);
    if (!probe) {
      // The search chose a topic whose probe disappeared between the flatten and
      // the lookup — impossible in one request, but a null here would render as
      // a blank question. Commit what we have instead of showing nothing.
      const fallbackStep = nextPlacementStep(topics, signals, graded);
      const done = fallbackStep.kind === 'done' ? fallbackStep : placeAtLearnerChoice(topics, 0, 'no_probe_content_fallback');
      return ok(res, { kind: 'done', result: describeResult(done, topics) });
    }

    return ok(res, {
      kind: 'ask',
      probe,
      questionNumber: step.questionNumber,
      questionsRemaining: step.questionsRemaining,
      phase: step.phase,
    });
  });

  /** Writes the placement: the result row, the skip-ahead credits, and the birth date if this was where we learned it. */
  router.post('/:courseSlug/commit', async (req, res) => {
    const parsed = CommitBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input');
    }
    const user = authedUser(res);
    const course = await getPublishedCourseBySlug(user.accessToken, req.params.courseSlug as string);
    if (!course) return fail(res, 404, NOT_FOUND, 'No such course');

    const existing = await getCoursePlacement(user.accessToken, user.id, course.id);
    if (existing === null) return fail(res, 502, 'INTERNAL', 'Could not check placement status');
    if (existing.length > 0) return fail(res, 409, 'PLACEMENT_ALREADY_COMPLETE', 'Placement was already completed for this course');

    const [tree, profiles] = await Promise.all([
      loadCourseTree(user.accessToken, user.id, course),
      getFullOwnProfile(user.accessToken, user.id),
    ]);
    if (!tree) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    if (!profiles) return fail(res, 502, 'INTERNAL', 'Profile service unreachable');

    const locale = (profiles[0]?.locale as Locale | undefined) ?? 'en-US';
    const topics = playableTopics(tree);
    const graded = gradeQuizAnswers(listPlacementProbesForGrading(tree, locale), parsed.data.answers);
    const signals = signalsFrom(parsed.data.signals, profiles[0]?.birth_date, new Date());

    // What the answers earned. Recomputed here rather than trusted from /step —
    // /step is a read and this is the write, and the write does not take the
    // read's word for it.
    const step = nextPlacementStep(topics, signals, graded);
    const earned = step.kind === 'done' ? step : placeAtLearnerChoice(topics, 0, 'adaptive_quiz');

    let placement = earned;
    if (parsed.data.startFromBeginning) {
      placement = placeAtLearnerChoice(topics, 0, 'learner_chose_start');
    } else if (parsed.data.chosenFrontier !== undefined) {
      // DOWNWARD only. Moving yourself earlier is always allowed — it costs the
      // learner time and nothing else. Moving yourself later would skip content
      // no answer established, which is the failure the quiz exists to prevent.
      const clamped = Math.min(parsed.data.chosenFrontier, earned.frontier);
      if (clamped !== earned.frontier) placement = placeAtLearnerChoice(topics, clamped, 'learner_adjusted');
    }

    const recorded = await insertCoursePlacement({
      user_id: user.id,
      course_id: course.id,
      claimed_level: parsed.data.signals.claimedLevel ?? 'some',
      education_level: parsed.data.signals.educationLevel ?? 'adult',
      quiz_answers: graded,
      start_topic_id: placement.startTopicId,
      start_lesson_id: placement.startLessonId,
      method: placement.method,
    });
    if (!recorded) return fail(res, 502, 'INTERNAL', 'Could not record placement');

    if (placement.creditedLessonIds.length > 0) {
      const topicIdByLesson = new Map<string, string>();
      for (const topic of topics) {
        for (const lessonId of topic.lessonIds) topicIdByLesson.set(lessonId, topic.id);
      }
      const creditRows = placement.creditedLessonIds
        .map((lessonId) => {
          const topicId = topicIdByLesson.get(lessonId);
          return topicId ? { user_id: user.id, lesson_id: lessonId, topic_id: topicId, course_id: course.id } : null;
        })
        .filter((r): r is { user_id: string; lesson_id: string; topic_id: string; course_id: string } => r !== null);
      const creditsWritten = await insertPlacementCredits(creditRows);
      if (!creditsWritten) return fail(res, 502, 'INTERNAL', 'Placement recorded, but credited lessons could not be saved');
    }

    // Same "only asked because it wasn't already known" posture as onboarding —
    // never overwrite an existing birth_date.
    if (parsed.data.signals.birthDate !== undefined && !profiles[0]?.birth_date) {
      await patchOwnProfile(user.accessToken, user.id, { birth_date: parsed.data.signals.birthDate });
    }

    return ok(res, describeResult(placement, topics), 201);
  });

  return router;
}
