import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import { getRolesForGate } from '../services/insights.js';
import { recordParentJourneyEvent } from '../services/parentTimeToValue.js';
import { requiresMinorMentorSafeguards } from '../services/mentorSafety.js';
import { buildLessonNarrative, lessonEvidence, weekSummary, type LessonEvidence, type NarrativeAttempt } from '../services/narrative/courseNarrative.js';
import {
  actOnBridgePrompt,
  dismissBridgePrompt,
  getBridgePrompt,
  journalCountsByLesson,
  kcRowsByIds,
  listJournal,
  listOpenBridgePrompts,
  readKidAttempts, readKidV2Attempts,
  readKidLearningRecord,
  topicTeaches,
} from '../services/narrative/narrativeData.js';
import { readJournalSharing } from '../services/narrative/journalSharing.js';
import { readTutorChoices, readTutorSeesChoices, type TutorChoice } from '../services/narrative/tutorChoices.js';
import { cancelStreakPause, getFullOwnProfile, getVerifiedKidLinks, insertAuditLog, serviceRest, setStreakPause } from '../services/supabaseRest.js';
import { pauseRangeRefusal } from '../services/habitStreak.js';
import { isCalendarDate } from '../services/streak.js';
import { loadStreakView } from './learnMotivation.js';

/*
 * /api/v1/family/learning (S05.3c) — the guardian's side of course learning.
 * Mounted before /api/v1/family, with the same gate: a parent role AND a
 * current verified adult identity, then a VERIFIED guardian link to this
 * exact child on every request. 404 (never 403) for a child who is not the
 * caller's, so the answer reveals nothing about whether that child exists.
 *
 * B.10 — GET /kids/:kidId/narrative: one short, deterministic entry per
 * completed lesson (courseNarrative.ts), titles in the guardian's own locale,
 * plus the last seven days in two numbers. Counts story decisions; shows them
 * only under L-13 (OD-27 (3)): for a parent-created child under 13, the
 * response adds, at the top level, which option the child chose in each story
 * decision of the page's lessons (`choicesVisible`, `choices`); teens and
 * self-registered accounts keep counts only (services/narrative/tutorChoices.ts).
 *
 * OD-27 (3), L-13 — GET /kids/:kidId/decisions: for a parent-created child
 * under 13 only, the option the child chose in each story decision and the
 * situation it answered (journalSharing.ts). A teen's journal stays private:
 * 403 JOURNAL_PRIVATE, and the narrative above still counts only. Every read
 * is audited.
 *
 * B.13 — the child's open bridge prompts and the two actions on them. Acting
 * creates a REAL savings goal or task in one database transaction that
 * re-checks the guardian link; tasks remain guardian-only.
 *
 * B.21 (S05.3e) — the child's habit streak as the model reads it today, and
 * the holiday pause (Frontend Bible 02 §9.6 rule 3): a verified guardian may
 * pause the streak for up to 21 days so a family trip or an illness never
 * reads as a lapse. The database function re-checks the verified link and the
 * range; every change is audited. The child's pace stays the child's own
 * choice (B.24): there is no guardian route to set it.
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

const DecisionQuery = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
}).strict();

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
    // L-13: decided on every read, from age evidence as of today. A failed
    // read shows counts only (fail closed); the journal is never widened.
    const choicesVisible = (await readTutorSeesChoices(kidId, undefined, now)) === true;
    const [attempts, v2Attempts, counts, choices, teaches] = await Promise.all([
      readKidAttempts(kidId, lessonIds),
      // B.10 for v2 (GAP-FIX-R1): completed v2 runs' receipts, read server-side; never answers.
      readKidV2Attempts(kidId, lessonIds),
      choicesVisible ? Promise.resolve(null) : journalCountsByLesson(kidId, lessonIds),
      choicesVisible ? readTutorChoices(kidId, lessonIds) : Promise.resolve(null),
      topicTeaches(topicIds),
    ]);
    if (!attempts || !v2Attempts) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the child’s learning');
    let decisions = counts;
    if (choices) {
      decisions = new Map<string, number>();
      for (const c of choices) decisions.set(c.lessonId, (decisions.get(c.lessonId) ?? 0) + 1);
    }
    // The journal and the skill map are enrichments: without them the entry
    // still names the lesson and topic, and says nothing it cannot back.
    const attemptsByLesson = new Map<string, NarrativeAttempt[]>();
    for (const a of attempts) {
      attemptsByLesson.set(a.lesson_id, [...(attemptsByLesson.get(a.lesson_id) ?? []), {
        segmentId: a.segment_id, score: a.score, createdAt: a.created_at, hintsUsed: a.hints_used ?? 0, diagnosticCode: a.diagnostic_code ?? null,
      }]);
    }
    for (const a of v2Attempts) {
      attemptsByLesson.set(a.lesson_id, [...(attemptsByLesson.get(a.lesson_id) ?? []), {
        segmentId: a.segment_id, score: a.score, createdAt: a.created_at, hintsUsed: a.hints_used, diagnosticCode: a.diagnostic_code, judgment: a.judgment,
      }]);
    }
    const v2Graded = new Set(v2Attempts.map((a) => a.lesson_id));
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
        graded: lesson.xp_total > 0 || v2Graded.has(c.lessonId),
        decisions: decisions?.get(c.lessonId) ?? 0,
        topicComplete: topicComplete(topic.id),
      })];
    });
    const week = weekSummary(weekRows.map((c) => ({
      completedAt: c.completedAt,
      topicComplete: topicComplete(record.lessons.get(c.lessonId)?.topic_id),
    })), now);
    const shown = new Set(entries.map((e) => e.lessonId));
    // Additive and top-level: the per-entry shape stays exactly as before, so
    // a client that validates entries strictly keeps working.
    const visible: { choicesVisible: boolean; choices?: TutorChoice[] } = choicesVisible && choices
      ? { choicesVisible: true, choices: choices.filter((c) => shown.has(c.lessonId)) }
      : { choicesVisible: false };
    // GAP-FIX-R1 (B.10 for v2): first-try share and judgment counts per shown lesson, beside the entries.
    const evidence = entries.map((e) => lessonEvidence({ lessonId: e.lessonId, attempts: attemptsByLesson.get(e.lessonId) ?? [],
      graded: (record.lessons.get(e.lessonId)?.xp_total ?? 0) > 0 || v2Graded.has(e.lessonId) })).filter((e): e is LessonEvidence => e !== null);
    // Appendix C 1.2 Parent Time-to-Value: the weekly narrative (B.10) is a first insight too (once per account).
    recordParentJourneyEvent(authedUser(res).id, 'parent_first_value');
    return ok(res, { locale, week, entries, hasMore: query.data.offset + query.data.limit < record.completions.length, ...visible, evidence });
  });

  // ── OD-27 (3): the under-13 child's story choices ─────────────────────────

  router.get('/kids/:kidId/decisions', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const query = DecisionQuery.safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'limit must be 1-30 and offset 0-5000');
    const shared = await readJournalSharing(kidId);
    if (shared === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the child’s choices');
    if (!shared) return fail(res, 403, 'JOURNAL_PRIVATE', 'This learner’s decisions are private');
    const [journal, locale] = await Promise.all([listJournal(kidId, query.data.limit, query.data.offset), guardianLocale(res)]);
    if (!journal) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the child’s choices');
    const lessonIds = [...new Set(journal.rows.map((r) => r.lesson_id))];
    const courseIds = [...new Set(journal.rows.map((r) => r.course_id))];
    const [lessons, courses] = await Promise.all([
      lessonIds.length ? serviceRest<Array<{ id: string; title: Record<string, unknown> }>>(`/lessons?id=in.(${lessonIds.join(',')})&select=id,title`) : Promise.resolve([]),
      courseIds.length ? serviceRest<Array<{ id: string; title: Record<string, unknown> }>>(`/courses?id=in.(${courseIds.join(',')})&select=id,title`) : Promise.resolve([]),
    ]);
    if (!lessons || !courses) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the child’s choices');
    const lessonById = new Map(lessons.map((l) => [l.id, l]));
    const courseById = new Map(courses.map((c) => [c.id, c]));
    await insertAuditLog(authedUser(res).id, 'learner_journal.guardian_read', kidId, { offset: query.data.offset, count: journal.rows.length });
    // Minimised on purpose: the situation and the chosen option only; never the
    // first choice, the outcome, a score or anything the child wrote.
    return ok(res, {
      locale,
      entries: journal.rows.flatMap((r) => {
        const lesson = lessonById.get(r.lesson_id);
        const course = courseById.get(r.course_id);
        if (!lesson || !course) return [];
        return [{ id: r.id, courseTitle: pick(course.title, locale), lessonTitle: pick(lesson.title, locale),
          situation: r.situation_text, choice: r.choice_text, recordedAt: r.recorded_at }];
      }),
      hasMore: journal.hasMore,
    });
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

  // ── B.21 (S05.3e) ───────────────────────────────────────────────────────

  const LocalDate = z.string().refine(isCalendarDate, 'Dates must be YYYY-MM-DD');
  const StreakQuery = z.object({ local_date: LocalDate.optional() }).strict();
  const PauseBody = z.object({ starts_on: LocalDate, ends_on: LocalDate, local_date: LocalDate.optional() }).strict();
  const serverToday = () => new Date().toISOString().slice(0, 10);

  router.get('/kids/:kidId/streak', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const query = StreakQuery.safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'local_date must be YYYY-MM-DD');
    const view = await loadStreakView(kidId, query.data.local_date ?? serverToday());
    if (!view) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the streak');
    return ok(res, { streak: view });
  });

  router.put('/kids/:kidId/streak-pause', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const body = PauseBody.safeParse(req.body);
    if (!body.success || Object.keys(req.query).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a start and an end date');
    const today = body.data.local_date ?? serverToday();
    const refusal = pauseRangeRefusal(body.data.starts_on, body.data.ends_on, today);
    if (refusal) return fail(res, 400, 'STREAK_PAUSE_INVALID', 'A pause lasts up to 21 days and starts within the last week or the next 60 days', { reason: refusal });
    const user = authedUser(res);
    const status = await setStreakPause({ guardianId: user.id, learnerId: kidId, startsOn: body.data.starts_on, endsOn: body.data.ends_on, today });
    if (status === 'forbidden') return fail(res, 404, NOT_FOUND, 'No such child for this account');
    if (status === 'invalid') return fail(res, 400, 'STREAK_PAUSE_INVALID', 'A pause lasts up to 21 days and starts within the last week or the next 60 days');
    if (status !== 'set') return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the pause');
    await insertAuditLog(user.id, 'learning_streak.paused', kidId, { startsOn: body.data.starts_on, endsOn: body.data.ends_on });
    const view = await loadStreakView(kidId, today);
    return ok(res, { streak: view });
  });

  router.delete('/kids/:kidId/streak-pause', async (req, res) => {
    const kidId = await guardKid(req, res);
    if (!kidId) return res;
    const query = StreakQuery.safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'local_date must be YYYY-MM-DD');
    const today = query.data.local_date ?? serverToday();
    const user = authedUser(res);
    const status = await cancelStreakPause({ guardianId: user.id, learnerId: kidId, today });
    if (status === 'forbidden') return fail(res, 404, NOT_FOUND, 'No such child for this account');
    if (status !== 'cancelled' && status !== 'none') return fail(res, 502, DATA_UNAVAILABLE, 'Could not end the pause');
    if (status === 'cancelled') await insertAuditLog(user.id, 'learning_streak.pause_ended', kidId, { endedOn: today });
    const view = await loadStreakView(kidId, today);
    return ok(res, { status, streak: view });
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
