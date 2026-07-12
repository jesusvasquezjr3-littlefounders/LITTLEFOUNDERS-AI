import { Router } from 'express';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { getPublishedCourses } from '../services/supabaseRest.js';

/*
 * /api/v1/learn — the learn section's read surface. Deliberately shallow
 * while 0002's content schema is PROVISIONAL (database/AGENTS.md): list
 * published courses, nothing deeper. RLS does the filtering (user token).
 */
export function learnRouter(): Router {
  const router = Router();

  router.get('/courses', requireAuth, async (_req, res) => {
    const rows = await getPublishedCourses(authedUser(res).accessToken);
    if (!rows) return fail(res, 502, 'INTERNAL', 'Content service unreachable');
    return ok(res, {
      courses: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        lessonCount: r.lessons[0]?.count ?? 0,
      })),
    });
  });

  return router;
}
