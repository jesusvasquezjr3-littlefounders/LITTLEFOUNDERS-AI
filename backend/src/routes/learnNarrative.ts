import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser } from '../middleware/auth.js';
import { clearJournal, listJournal } from '../services/narrative/narrativeData.js';
import { serviceRest } from '../services/supabaseRest.js';

/*
 * /api/v1/learn/journal. Mounted inside learnRouter, behind its requireAuth +
 * requireAgeScreen.
 *
 * The learner's own decision journal: read it, clear it. Only ever the
 * caller's own rows; there is no id in the path to point at someone else.
 */

const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
const Page = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
}).strict();

type LessonTitleRow = { id: string; title: Record<string, unknown> };
type CourseTitleRow = { id: string; slug: string; title: Record<string, unknown> };

export function learnNarrativeRouter(): Router {
  const router = Router();

  router.get('/journal', async (req, res) => {
    const page = Page.safeParse(req.query);
    if (!page.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit must be 1-50 and offset 0-10000');
    const user = authedUser(res);
    const journal = await listJournal(user.id, page.data.limit, page.data.offset);
    if (!journal) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your journal');
    const lessonIds = [...new Set(journal.rows.map((r) => r.lesson_id))];
    const courseIds = [...new Set(journal.rows.map((r) => r.course_id))];
    const [lessons, courses] = await Promise.all([
      lessonIds.length ? serviceRest<LessonTitleRow[]>(`/lessons?id=in.(${lessonIds.join(',')})&select=id,title`) : Promise.resolve([] as LessonTitleRow[]),
      courseIds.length ? serviceRest<CourseTitleRow[]>(`/courses?id=in.(${courseIds.join(',')})&select=id,slug,title`) : Promise.resolve([] as CourseTitleRow[]),
    ]);
    if (!lessons || !courses) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your journal');
    const lessonById = new Map(lessons.map((l) => [l.id, l]));
    const courseById = new Map(courses.map((c) => [c.id, c]));
    return ok(res, {
      entries: journal.rows.flatMap((r) => {
        const lesson = lessonById.get(r.lesson_id);
        const course = courseById.get(r.course_id);
        if (!lesson || !course) return [];
        return [{
          id: r.id,
          course: { slug: course.slug, title: course.title },
          lesson: { id: r.lesson_id, title: lesson.title },
          situation: r.situation_text,
          choice: r.choice_text,
          firstChoice: r.first_choice_id !== r.choice_id ? r.first_choice_text : null,
          outcome: r.outcome_text,
          timesDecided: r.times_decided,
          resurfaced: journal.resurfaced.get(r.id) ?? 0,
          recordedAt: r.recorded_at,
        }];
      }),
      hasMore: journal.hasMore,
    });
  });

  router.delete('/journal', async (_req, res) => {
    const user = authedUser(res);
    if (!(await clearJournal(user.id))) return fail(res, 502, DATA_UNAVAILABLE, 'Could not clear your journal');
    return ok(res, { cleared: true });
  });

  return router;
}
