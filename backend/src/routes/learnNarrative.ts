import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser } from '../middleware/auth.js';
import type { AgeScreenState } from '../services/ageScreen.js';
import { getRolesForGate } from '../services/insights.js';
import { bridgeAudience } from '../services/narrative/familyBridge.js';
import { readJournalSharing } from '../services/narrative/journalSharing.js';
import { actOnBridgePrompt, clearJournal, dismissBridgePrompt, getBridgePrompt, kcRowsByIds, listJournal, listOpenBridgePrompts } from '../services/narrative/narrativeData.js';
import { getVerifiedGuardiansOfKid, insertAuditLog, serviceRest } from '../services/supabaseRest.js';

/*
 * /api/v1/learn/journal and /api/v1/learn/bridges (S05.3c). Mounted inside
 * learnRouter, behind its requireAuth + requireAgeScreen.
 *
 * B.9 — the learner's own decision journal: read it, clear it. Only ever the
 * caller's own rows; there is no id in the path to point at someone else. It
 * says whether the verified Tutor can see the chosen options (OD-27 (3): a
 * parent-created child under 13 only; journalSharing.ts).
 *
 * B.13 — self-directed bridge prompts, for an independent teen only (Option
 * B). Every other population gets an empty list and a 404 on any prompt id:
 * a child's guardian prompts live in the Family Hub, never on the child's
 * side, and nobody can act on a prompt addressed to someone else. Acting on a
 * self prompt records the teen's own commitment; on a savings-goal prompt the
 * teen may also name a goal, and it is created in the teen's own wallet
 * (OD-28, L-12). A task never comes from a self prompt: Core refuses details
 * on a task prompt and the database refuses a task for a self prompt whatever
 * Core sends.
 */

const NOT_FOUND = 'NOT_FOUND';
const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
/** The goal icons the wallet offers (tasks.ts GOAL_ICONS, the database CHECK in the bridge function). */
const SELF_GOAL_ICONS = ['star', 'game', 'toy', 'book', 'bike', 'trip', 'gift'] as const;
/** OD-28 (L-12): the teen's own goal from a savings-goal prompt; an empty body is the commitment alone. */
const SelfGoal = z.object({
  title: z.string().trim().min(1).max(80),
  target: z.number().int().min(1).max(100000),
  icon: z.enum(SELF_GOAL_ICONS).default('star'),
}).strict();
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
    const [journal, shared] = await Promise.all([
      listJournal(user.id, page.data.limit, page.data.offset),
      readJournalSharing(user.id, res.locals.ageScreen as AgeScreenState),
    ]);
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
      // OD-27 (3): the learner is told when their verified Tutor can see their choices; null when that could not be read.
      sharedWithTutor: shared,
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
  async function ownSelfPrompt(req: { params: Record<string, string | undefined> }, res: Parameters<typeof authedUser>[0]): Promise<{ id: string; action: string } | null> {
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
    return { id: prompt.id, action: prompt.action };
  }

  router.post('/bridges/:id/act', async (req, res) => {
    const body = req.body ?? {};
    const empty = z.object({}).strict().safeParse(body).success;
    const goal = empty ? null : SelfGoal.safeParse(body);
    if (goal && !goal.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the goal details');
    const prompt = await ownSelfPrompt(req, res);
    if (!prompt) return res;
    // Tasks stay guardian-only (OD-3): a task prompt takes the commitment alone.
    if (goal && prompt.action !== 'savings_goal') return fail(res, 400, 'VALIDATION_ERROR', 'This suggestion takes no details');
    const user = authedUser(res);
    const details = goal?.success ? goal.data : null;
    const result = await actOnBridgePrompt({ promptId: prompt.id, actorId: user.id, title: details?.title ?? null, amount: details?.target ?? null,
      icon: details?.icon ?? null, recurrence: null });
    if (!result) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save this');
    if (result.status === 'closed') return fail(res, 409, 'BRIDGE_CLOSED', 'This suggestion has closed');
    if (result.status === 'no_wallet') return fail(res, 409, 'WALLET_UNAVAILABLE', 'Your wallet is not open');
    if (result.status !== 'acted') return fail(res, 404, NOT_FOUND, 'No such suggestion');
    const goalId = result.goal_id ?? null;
    if (!result.replayed) {
      await insertAuditLog(user.id, goalId ? 'learning_bridge.self_goal_created' : 'learning_bridge.self_committed', prompt.id, goalId ? { goal_id: goalId } : {});
    }
    return ok(res, { status: 'acted', replayed: result.replayed === true, ...(goalId ? { goalId } : {}) });
  });

  router.post('/bridges/:id/dismiss', async (req, res) => {
    const prompt = await ownSelfPrompt(req, res);
    if (!prompt) return res;
    const result = await dismissBridgePrompt(prompt.id, authedUser(res).id);
    if (!result) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save this');
    if (result.status === 'closed') return fail(res, 409, 'BRIDGE_CLOSED', 'This suggestion has closed');
    if (result.status !== 'dismissed') return fail(res, 404, NOT_FOUND, 'No such suggestion');
    return ok(res, { status: 'dismissed', replayed: result.replayed === true });
  });

  return router;
}
