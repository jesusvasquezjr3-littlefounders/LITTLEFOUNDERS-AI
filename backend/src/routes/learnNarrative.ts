import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser } from '../middleware/auth.js';
import type { AgeScreenState } from '../services/ageScreen.js';
import { getRolesForGate } from '../services/insights.js';
import { bridgeAudience } from '../services/narrative/familyBridge.js';
import { actOnBridgePrompt, clearJournal, dismissBridgePrompt, getBridgePrompt, kcRowsByIds, listJournal, listOpenBridgePrompts } from '../services/narrative/narrativeData.js';
import { getVerifiedGuardiansOfKid, insertAuditLog, serviceRest } from '../services/supabaseRest.js';

/*
 * /api/v1/learn/journal and /api/v1/learn/bridges (S05.3c). Mounted inside
 * learnRouter, behind its requireAuth + requireAgeScreen.
 *
 * B.9 — the learner's own decision journal: read it, clear it. Only ever the
 * caller's own rows; there is no id in the path to point at someone else.
 *
 * B.13 — self-directed bridge prompts, for an independent teen only (Option
 * B). Every other population gets an empty list and a 404 on any prompt id:
 * a child's guardian prompts live in the Family Hub, never on the child's
 * side, and nobody can act on a prompt addressed to someone else. Acting on a
 * self prompt records the teen's own commitment and creates nothing; the
 * database refuses a task for a self prompt whatever Core sends.
 */

const NOT_FOUND = 'NOT_FOUND';
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

  /** The caller's audience, or null when the read failed. 'none' = not an independent teen. */
  async function selfAudience(res: Parameters<typeof authedUser>[0]): Promise<'self' | 'none' | null> {
    const user = authedUser(res);
    const [roles, guardians] = await Promise.all([getRolesForGate(user.id), getVerifiedGuardiansOfKid(user.id)]);
    if (roles === null || guardians === null) return null;
    const audience = bridgeAudience({ roles, isGuest: user.isGuest, age: res.locals.ageScreen as AgeScreenState, hasVerifiedGuardian: guardians.length > 0 });
    return audience === 'self' ? 'self' : 'none';
  }

  router.get('/bridges', async (_req, res) => {
    const audience = await selfAudience(res);
    if (audience === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your suggestions');
    if (audience === 'none') return ok(res, { prompts: [] });
    const user = authedUser(res);
    const prompts = await listOpenBridgePrompts(user.id, 'self');
    if (!prompts) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your suggestions');
    const kcs = await kcRowsByIds([...new Set(prompts.map((p) => p.kc_id))]);
    if (!kcs) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your suggestions');
    return ok(res, {
      prompts: prompts.flatMap((p) => {
        const kc = kcs.get(p.kc_id);
        return kc ? [{ id: p.id, action: p.action, skill: kc.title, createdAt: p.created_at, expiresAt: p.expires_at }] : [];
      }),
    });
  });

  const PromptId = z.string().uuid();

  /** Resolves a self prompt the caller may act on, or answers 404/502 itself. */
  async function ownSelfPrompt(req: { params: Record<string, string | undefined> }, res: Parameters<typeof authedUser>[0]): Promise<string | null> {
    const id = PromptId.safeParse(req.params.id);
    if (!id.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
      return null;
    }
    const audience = await selfAudience(res);
    if (audience === null) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not load this suggestion');
      return null;
    }
    const prompt = audience === 'self' ? await getBridgePrompt(id.data) : null;
    if (prompt === undefined) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not load this suggestion');
      return null;
    }
    // 404, not 403: a caller learns nothing about a prompt that is not theirs.
    if (!prompt || prompt.audience !== 'self' || prompt.learner_id !== authedUser(res).id) {
      fail(res, 404, NOT_FOUND, 'No such suggestion');
      return null;
    }
    return prompt.id;
  }

  router.post('/bridges/:id/act', async (req, res) => {
    if (z.object({}).strict().safeParse(req.body ?? {}).success === false) {
      return fail(res, 400, 'VALIDATION_ERROR', 'A self suggestion takes no details');
    }
    const promptId = await ownSelfPrompt(req, res);
    if (!promptId) return res;
    const user = authedUser(res);
    const result = await actOnBridgePrompt({ promptId, actorId: user.id, title: null, amount: null, icon: null, recurrence: null });
    if (!result) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save this');
    if (result.status === 'closed') return fail(res, 409, 'BRIDGE_CLOSED', 'This suggestion has closed');
    if (result.status !== 'acted') return fail(res, 404, NOT_FOUND, 'No such suggestion');
    if (!result.replayed) await insertAuditLog(user.id, 'learning_bridge.self_committed', promptId, {});
    return ok(res, { status: 'acted', replayed: result.replayed === true });
  });

  router.post('/bridges/:id/dismiss', async (req, res) => {
    const promptId = await ownSelfPrompt(req, res);
    if (!promptId) return res;
    const result = await dismissBridgePrompt(promptId, authedUser(res).id);
    if (!result) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save this');
    if (result.status === 'closed') return fail(res, 409, 'BRIDGE_CLOSED', 'This suggestion has closed');
    if (result.status !== 'dismissed') return fail(res, 404, NOT_FOUND, 'No such suggestion');
    return ok(res, { status: 'dismissed', replayed: result.replayed === true });
  });

  return router;
}
