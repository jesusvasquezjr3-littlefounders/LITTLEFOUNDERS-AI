import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import { getRolesForGate } from '../services/insights.js';
import { requiresMinorMentorSafeguards } from '../services/mentorSafety.js';
import { buildLessonNarrative, weekSummary, type NarrativeAttempt } from '../services/narrative/courseNarrative.js';
import {
  actOnBridgePrompt,
  dismissBridgePrompt,
  getBridgePrompt,
  journalCountsByLesson,
  kcRowsByIds,
  listOpenBridgePrompts,
  readKidAttempts,
  readKidLearningRecord,
  topicTeaches,
} from '../services/narrative/narrativeData.js';
import { getFullOwnProfile, getVerifiedKidLinks, insertAuditLog } from '../services/supabaseRest.js';

/*
 * /api/v1/family/learning (S05.3c) — the guardian's side of course learning.
 * Mounted before /api/v1/family, with the same gate: a parent role AND a
 * current verified adult identity, then a VERIFIED guardian link to this
 * exact child on every request. 404 (never 403) for a child who is not the
 * caller's, so the answer reveals nothing about whether that child exists.
 *
 * B.10 — GET /kids/:kidId/narrative: one short, deterministic entry per
 * completed lesson (courseNarrative.ts), titles in the guardian's own locale,
 * plus the last seven days in two numbers. Counts story decisions, never shows
 * them.
 *
 * B.13 — the child's open bridge prompts and the two actions on them. Acting
 * creates a REAL savings goal or task in one database transaction that
 * re-checks the guardian link; tasks remain guardian-only.
 */

const NOT_FOUND = 'NOT_FOUND';
const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
type Locale = 'en-US' | 'es-MX' | 'pt-BR';

const normalizeLocale = (raw: string | null | undefined): Locale => (raw === 'en-US' || raw === 'pt-BR' ? raw : 'es-MX');
function pick(title: Record<string, unknown> | undefined, locale: Locale): string {
  if (!title) return '';
  const value = title[locale] ?? title['es-MX'] ?? title['en-US'] ?? Object.values(title)[0];
  return typeof value === 'string' ? value : '';
}

const NarrativeQuery = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
}).strict();

const GOAL_ICONS = ['star', 'game', 'toy', 'book', 'bike', 'trip', 'gift'] as const;
const ActBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('savings_goal'),
    title: z.string().trim().min(1).max(80),
    target: z.number().int().min(1).max(100000),
    icon: z.enum(GOAL_ICONS).default('star'),
  }).strict(),
  z.object({
    action: z.literal('earning_task'),
    title: z.string().trim().min(1).max(120),
    rewardCoins: z.number().int().min(1).max(500),
    recurrence: z.enum(['once', 'weekly']).default('once'),
  }).strict(),
]);

export function familyLearningRouter(): Router {
  const router = Router();

  router.use(requireAuth, requireRole(['parent']));
  router.use(async (_req, res, next) => {
    const user = authedUser(res);
    const roles = await getRolesForGate(user.id);
    if (!roles || await requiresMinorMentorSafeguards(user.id, roles)) {
      return fail(res, 403, 'PARENT_VERIFICATION_REQUIRED', 'Current adult identity verification is required');
    }
    return next();
  });

  async function guardKid(req: { params: Record<string, string | undefined> }, res: Parameters<typeof fail>[0]): Promise<string | null> {
    const parsed = z.string().uuid().safeParse(req.params.kidId);
    if (!parsed.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
      return null;
    }
    const links = await getVerifiedKidLinks(authedUser(res).id);
    if (links === null) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
      return null;
    }
    if (!links.some((l) => l.kid_user_id === parsed.data)) {
      fail(res, 404, NOT_FOUND, 'No such child for this account');
      return null;
    }
    return parsed.data;
  }

  async function guardianLocale(res: Parameters<typeof fail>[0]): Promise<Locale> {
    const user = authedUser(res);
    const profile = await getFullOwnProfile(user.accessToken, user.id);
    return normalizeLocale(profile?.[0]?.locale);
  }

  // ── B.10 ────────────────────────────────────────────────────────────────

  router.get('/kids/:kidId/narrative', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const query = NarrativeQuery.safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit must be 1-30 and offset 0-5000');
    const [record, locale] = await Promise.all([readKidLearningRecord(kidId), guardianLocale(res)]);
    if (!record) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the child’s learning');

    const now = new Date();
    const since = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const pageRows = record.completions.slice(query.data.offset, query.data.offset + query.data.limit);
    const weekRows = record.completions.filter((c) => Date.parse(c.completedAt) >= since);
    const lessonIds = [...new Set(pageRows.map((c) => c.lessonId))];
    const topicIds = [...new Set(lessonIds.map((id) => record.lessons.get(id)?.topic_id).filter((id): id is string => Boolean(id)))];
    const [attempts, decisions, teaches] = await Promise.all([
      readKidAttempts(kidId, lessonIds),
      journalCountsByLesson(kidId, lessonIds),
      topicTeaches(topicIds),
    ]);
    if (!attempts) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the child’s learning');
    // The journal and the skill map are enrichments: without them the entry
    // still names the lesson and topic, and says nothing it cannot back.
    const attemptsByLesson = new Map<string, NarrativeAttempt[]>();
    for (const a of attempts) {
      attemptsByLesson.set(a.lesson_id, [...(attemptsByLesson.get(a.lesson_id) ?? []), {
        segmentId: a.segment_id, score: a.score, createdAt: a.created_at, hintsUsed: a.hints_used ?? 0, diagnosticCode: a.diagnostic_code ?? null,
      }]);
    }
    const topicComplete = (topicId: string | undefined): boolean => {
      const siblings = topicId ? record.lessonsByTopic.get(topicId) ?? [] : [];
      return siblings.length > 0 && siblings.every((id) => record.done.has(id));
    };

    const entries = pageRows.flatMap((c) => {
      const lesson = record.lessons.get(c.lessonId);
      const topic = lesson ? record.topics.get(lesson.topic_id) : undefined;
      if (!lesson || !topic) return [];
      return [buildLessonNarrative({
        lessonId: c.lessonId,
        lessonTitle: pick(lesson.title, locale),
        topicTitle: pick(topic.title, locale),
        courseTitle: pick(record.courseTitleByTopic.get(topic.id), locale),
        completedAt: c.completedAt,
        skills: (teaches?.get(topic.id) ?? []).map((k) => pick(k.title, locale)),
        attempts: attemptsByLesson.get(c.lessonId) ?? [],
        graded: lesson.xp_total > 0,
        decisions: decisions?.get(c.lessonId) ?? 0,
        topicComplete: topicComplete(topic.id),
      })];
    });
    const week = weekSummary(weekRows.map((c) => ({
      completedAt: c.completedAt,
      topicComplete: topicComplete(record.lessons.get(c.lessonId)?.topic_id),
    })), now);
    return ok(res, { locale, week, entries, hasMore: query.data.offset + query.data.limit < record.completions.length });
  });

  // ── B.13 ────────────────────────────────────────────────────────────────

  router.get('/kids/:kidId/bridges', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const [prompts, locale] = await Promise.all([listOpenBridgePrompts(kidId, 'guardian'), guardianLocale(res)]);
    if (!prompts) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load suggestions');
    const kcs = await kcRowsByIds([...new Set(prompts.map((p) => p.kc_id))]);
    if (!kcs) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load suggestions');
    return ok(res, {
      prompts: prompts.flatMap((p) => {
        const kc = kcs.get(p.kc_id);
        return kc ? [{ id: p.id, action: p.action, skill: pick(kc.title, locale), createdAt: p.created_at, expiresAt: p.expires_at }] : [];
      }),
    });
  });

  /** A guardian prompt of THIS child, or answers itself. */
  async function kidPrompt(req: { params: Record<string, string | undefined> }, res: Parameters<typeof fail>[0], kidId: string) {
    const id = z.string().uuid().safeParse(req.params.promptId);
    if (!id.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'promptId must be a uuid');
      return null;
    }
    const prompt = await getBridgePrompt(id.data);
    if (prompt === undefined) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not load this suggestion');
      return null;
    }
    if (!prompt || prompt.learner_id !== kidId || prompt.audience !== 'guardian') {
      fail(res, 404, NOT_FOUND, 'No such suggestion');
      return null;
    }
    return prompt;
  }

  router.post('/kids/:kidId/bridges/:promptId/act', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const body = ActBody.safeParse(req.body);
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the details');
    const prompt = await kidPrompt(req, res, kidId);
    if (!prompt) return res;
    if (prompt.action !== body.data.action) return fail(res, 400, 'VALIDATION_ERROR', 'This suggestion is for a different action');
    const user = authedUser(res);
    const result = await actOnBridgePrompt(body.data.action === 'savings_goal'
      ? { promptId: prompt.id, actorId: user.id, title: body.data.title, amount: body.data.target, icon: body.data.icon, recurrence: null }
      : { promptId: prompt.id, actorId: user.id, title: body.data.title, amount: body.data.rewardCoins, icon: null, recurrence: body.data.recurrence });
    if (!result) return fail(res, 502, DATA_UNAVAILABLE, 'Could not create it');
    if (result.status === 'forbidden' || result.status === 'not_found') return fail(res, 404, NOT_FOUND, 'No such suggestion');
    if (result.status === 'closed') return fail(res, 409, 'BRIDGE_CLOSED', 'This suggestion has closed');
    if (result.status !== 'acted') return fail(res, 502, DATA_UNAVAILABLE, 'Could not create it');
    if (!result.replayed) {
      if (result.task_id) await insertAuditLog(user.id, 'tasks.created', result.task_id, { assignedTo: kidId, rewardCoins: body.data.action === 'earning_task' ? body.data.rewardCoins : null, via: 'learning_bridge' });
      await insertAuditLog(user.id, 'learning_bridge.acted', prompt.id, { action: prompt.action, taskId: result.task_id ?? null, goalId: result.goal_id ?? null });
    }
    return ok(res, { status: 'acted', replayed: result.replayed === true, taskId: result.task_id ?? null, goalId: result.goal_id ?? null }, result.replayed ? 200 : 201);
  });

  router.post('/kids/:kidId/bridges/:promptId/dismiss', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const prompt = await kidPrompt(req, res, kidId);
    if (!prompt) return res;
    const result = await dismissBridgePrompt(prompt.id, authedUser(res).id);
    if (!result) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save this');
    if (result.status === 'forbidden' || result.status === 'not_found') return fail(res, 404, NOT_FOUND, 'No such suggestion');
    if (result.status === 'closed') return fail(res, 409, 'BRIDGE_CLOSED', 'This suggestion has closed');
    return ok(res, { status: 'dismissed', replayed: result.replayed === true });
  });

  return router;
}
