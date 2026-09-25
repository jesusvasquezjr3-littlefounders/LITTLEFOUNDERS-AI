import { requireUnfrozenBanking } from '../middleware/bankingFreeze.js';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import { evidenceUploadRateLimiter } from '../middleware/rateLimit.js';
import { requireWalletAccess } from '../middleware/walletAccess.js';
import { getSelfActionDetails } from '../services/teenWallet.js';
import { deleteEvidence, EVIDENCE_ALLOWED_MIME, fetchEvidenceBytes, sniffImageMime, uploadEvidence } from '../services/evidence.js';
import { isCalendarDate } from '../services/streak.js';
import { dayDifference, evaluateStreak, milestoneReached, REST_DAYS_PER_WEEK, resolveLocalToday, utcDayOffset, type StreakState } from '../services/choreStreak.js';
import { endChoreStreakPause, getPauseKid, livePauses, pauseChoreStreak, readStreakFacts, streakFromFacts, type PauseRecord } from '../services/choreStreakData.js';
import {
  allocateTaskReward,
  archiveGoal,
  decideRedemption,
  evidenceStillReferencedElsewhere,
  getCatalogForGuardians,
  getCatalogForParent,
  getCatalogItemById,
  getGoalById,
  getGoalProgress,
  getGoalsForKid,
  getSpendLimit,
  getSpendUsedThisPeriod,
  getRedemptionById,
  getRedemptionsForKid,
  getRedemptionsForKids,
  getTaskById,
  getTasksForKid,
  getTasksForKids,
  getVerifiedGuardiansOfKid,
  getVerifiedKidLinks,
  getWalletBalances,
  getWalletLedger,
  getOwnRoles,
  insertAuditLog,
  insertCatalogItem,
  insertGoal,
  insertRedemption,
  insertTask,
  markGoalReached,
  setCatalogItemActive,
  setTaskEvidence,
  transitionTaskStatus,
  type CatalogItemRow,
  type GoalRow,
  type RedemptionRow,
  type TaskRow,
  type WalletLedgerRow,
} from '../services/supabaseRest.js';
import {
  adjustWalletAsGuardian,
  fulfillRedemptionAsGuardian,
  getGuardianActionsByIds,
  isRefusal,
  listGuardianActions,
  withdrawGoalAsGuardian,
  UNAVAILABLE,
  WALLET_BUCKETS,
  type GuardianActionRow,
} from '../services/familyLifecycle.js';

/*
 * Wire shapes: every OTHER route in this codebase (routes/family.ts above
 * all) translates snake_case DB rows into camelCase before they reach the
 * browser — /AGENTS.md §1.7's naming split is DB vs TS, not DB vs wire, but
 * the actual convention every response in this API already follows is
 * camelCase JSON. These mappers are the one place that translation happens
 * for this router, so a caller reading the wire shape never has to know a
 * Postgres column name.
 */
function toWireTask(t: TaskRow) {
  return {
    id: t.id,
    assignedBy: t.assigned_by,
    assignedTo: t.assigned_to,
    title: t.title,
    rewardCoins: t.reward_coins,
    recurrence: t.recurrence,
    dueAt: t.due_at,
    status: t.status,
    allocated: t.allocated,
    createdAt: t.created_at,
    // The pointer (bucket/hash/ext) never leaves Core — only whether one
    // exists. The image itself is fetched through the authenticated
    // GET /:id/evidence proxy below, never a raw Depot URL (§1.9).
    hasEvidence: t.evidence_bucket !== null && t.evidence_hash !== null && t.evidence_ext !== null,
    requiresEvidence: t.requires_evidence,
    cancelReason: t.cancel_reason,
    // S07.3 (D.10): an expected family contribution or a paid bonus task.
    kind: t.kind,
    // S07.3 (D.2): the child's local day of the completion.
    completedOn: t.completed_on,
  };
}

/** S07.3 (D.2): the lapse-tolerant chore streak as the child and the Tutor see it. */
function toWireStreak(state: StreakState, pauses: PauseRecord[], today: string) {
  const covering = pauses.find((p) => p.cancelled_at === null && p.starts_on <= today && p.ends_on >= today);
  return {
    status: state.status,
    current: state.current,
    best: state.best,
    totalDays: state.totalDays,
    restDaysLeftThisWeek: state.restDaysLeftThisWeek,
    restDaysPerWeek: REST_DAYS_PER_WEEK,
    pausedUntil: covering ? covering.ends_on : null,
    today,
  };
}

function toWirePause(p: PauseRecord, today: string) {
  const state = p.cancelled_at !== null ? 'cancelled' : p.ends_on < today ? 'over' : p.starts_on > today ? 'upcoming' : 'running';
  return { id: p.id, startsOn: p.starts_on, endsOn: p.ends_on, state };
}

function hasEvidence(t: Pick<TaskRow, 'evidence_bucket' | 'evidence_hash' | 'evidence_ext'>): boolean {
  return t.evidence_bucket !== null && t.evidence_hash !== null && t.evidence_ext !== null;
}

function toWireGoal(g: GoalRow, saved: number) {
  return {
    id: g.id,
    kidUserId: g.kid_user_id,
    title: g.title,
    target: g.target,
    icon: g.icon,
    status: g.status,
    createdAt: g.created_at,
    reachedAt: g.reached_at,
    saved,
  };
}

function toWireCatalogItem(c: CatalogItemRow) {
  return {
    id: c.id,
    parentUserId: c.parent_user_id,
    title: c.title,
    cost: c.cost,
    active: c.active,
    createdAt: c.created_at,
  };
}

function toWireRedemption(r: RedemptionRow) {
  return {
    id: r.id,
    catalogId: r.catalog_id,
    kidUserId: r.kid_user_id,
    status: r.status,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
    fulfilledAt: r.fulfilled_at ?? null,
  };
}

/**
 * `note` is the guardian's own reason for a manual adjustment or a goal
 * withdrawal (OD-21: required, audited). The child sees it on their history:
 * a coin that moved without an explanation is exactly the broken promise
 * D.5 exists to prevent.
 */
type SelfDetails = NonNullable<Awaited<ReturnType<typeof getSelfActionDetails>>>;

function toWireLedgerEntry(e: WalletLedgerRow, actions?: Map<string, GuardianActionRow>, selfActions?: SelfDetails) {
  const action = e.guardian_action_id ? actions?.get(e.guardian_action_id) : undefined;
  const self = e.self_action_id ? selfActions?.get(e.self_action_id) : undefined;
  return {
    id: e.id,
    bucket: e.bucket,
    amount: e.amount,
    reason: e.reason,
    taskId: e.task_id,
    goalId: e.goal_id,
    redemptionId: e.redemption_id,
    note: action?.reason ?? null,
    // S07.2: a teen's own entry says where the coins came from (income) or
    // which of their personal rewards they marked; never free text.
    source: self?.source ?? null,
    rewardTitle: self?.reward_title ?? null,
    createdAt: e.created_at,
  };
}

/** Resolves the guardian reasons and the teen's own action details behind one page of ledger rows. null = unreadable; the caller refuses rather than showing an unexplained movement. */
async function ledgerWithNotes(entries: WalletLedgerRow[]) {
  const ids = entries.flatMap((e) => (e.guardian_action_id ? [e.guardian_action_id] : []));
  const selfIds = entries.flatMap((e) => (e.self_action_id ? [e.self_action_id] : []));
  const [actions, selfActions] = await Promise.all([getGuardianActionsByIds(ids), getSelfActionDetails(selfIds)]);
  if (actions === null || selfActions === null) return null;
  return entries.map((e) => toWireLedgerEntry(e, actions, selfActions));
}

function toWireGuardianAction(a: GuardianActionRow, callerId: string) {
  return {
    id: a.id,
    kind: a.kind,
    bucket: a.bucket,
    goalId: a.goal_id,
    amount: a.amount,
    reason: a.reason,
    // Which guardian acted is shared as "you or another Tutor" only.
    byMe: a.actor_user_id === callerId,
    createdAt: a.created_at,
  };
}

/** Database refusals from the S07.1 RPCs, mapped to the API's error envelope. */
const GUARDIAN_ACTION_REFUSALS: Record<string, { status: number; message: string }> = {
  NOT_A_GUARDIAN: { status: 404, message: 'No such child for this account' },
  GOAL_NOT_FOUND: { status: 404, message: 'No such goal' },
  INSUFFICIENT_BALANCE: { status: 409, message: 'That would take the bucket below zero' },
  GOAL_BALANCE_INSUFFICIENT: { status: 409, message: 'The goal does not hold that many coins' },
  GOAL_SAVINGS_PROTECTED: { status: 409, message: 'Those coins are saved toward a goal; withdraw them from the goal first' },
  WALLET_ADJUSTMENT_INVALID: { status: 400, message: 'Check the amount and the reason' },
  GOAL_WITHDRAWAL_INVALID: { status: 400, message: 'Check the amount, destination and reason' },
};

/*
 * /api/v1/tasks — the earn (chores) -> allocate (Save/Spend/Share) -> goal
 * loop, plus the parent-authored redemption catalog. FAMILY_HUB.md is
 * authoritative on the product; this router implements Waves 1-3.
 *
 * DELIBERATELY NOT under /api/v1/family. That router is entirely
 * `requireRole(['parent'])` (routes/family.ts), because it has never had a
 * kid-facing endpoint. This surface needs both: a kid marks their own tasks
 * done, allocates their own reward, and reads their own wallet, while a
 * parent creates/approves tasks and the redemption catalog. Mirrors the
 * `learn`/`tutor` routers' shape instead — `requireAuth` at the router level,
 * `requireRole([...])` per route — because a kid already reaches those two
 * as themselves.
 *
 * "Family" is a kid + their verified guardians (guardian_links), never a
 * separate entity (§0074, D1) — every guardian check below re-derives it
 * fresh per request, the same discipline routes/family.ts already applies.
 */

const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
const NOT_FOUND = 'NOT_FOUND';
const CONFLICT = 'CONFLICT';

// A parent's chore-economy safety valve — the same shape as family.ts's
// MAX_KIDS_PER_PARENT: not a product opinion about what a chore is worth,
// but a bound on what a single mistyped or automated request can mint.
const MAX_REWARD_COINS = 500;
// S07.3 (D.10): an expected family contribution is unpaid or nominal. The
// database enforces the same bound (family_task_contribution_kind).
export const MAX_CONTRIBUTION_COINS = 2;
// S07.3 (D.2): the chore streak's holiday pause bounds, the same as the
// database's guard (chore_streak_rest_days); pinned by the threshold log.
export const PAUSE_MAX_DAYS = 21;
export const PAUSE_MAX_BACKDATE_DAYS = 7;
export const PAUSE_MAX_LEAD_DAYS = 120;

const GOAL_ICONS = ['star', 'game', 'toy', 'book', 'bike', 'trip', 'gift'] as const;

// Mirrors verification.ts's own upload multer instance: memory storage (the
// buffer is forwarded to Depot and dropped, never written to Core's own
// disk), a small size ceiling for a phone-camera photo. `fields`/`parts` are
// capped explicitly too — the single-file form this route expects has no
// legitimate reason to carry more than a couple of extra text fields, and an
// unbounded multipart body could otherwise burn memory before `fileSize`
// alone would reject it.
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 5, parts: 10 },
});

export function tasksRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  /** Verifies the caller (a parent) is a verified guardian of `kidId`. Returns the caller's kid ids, or null having already responded. */
  async function guardParentOf(kidId: string, res: Parameters<typeof fail>[0], parentId: string): Promise<boolean> {
    const links = await getVerifiedKidLinks(parentId);
    if (links === null) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
      return false;
    }
    if (!links.some((l) => l.kid_user_id === kidId)) {
      // 404, not 403 — a parent asking about someone else's child learns
      // nothing about whether that child exists (same posture as family.ts).
      fail(res, 404, NOT_FOUND, 'No such child for this account');
      return false;
    }
    return true;
  }

  /** Same check as guardParentOf, without writing a response — for routes reachable by EITHER role, where the caller decides the final status after also checking "is this my own". */
  async function isVerifiedGuardianOfSilently(kidId: string, parentId: string): Promise<boolean | null> {
    const links = await getVerifiedKidLinks(parentId);
    if (links === null) return null;
    return links.some((l) => l.kid_user_id === kidId);
  }

  // ── PARENT: tasks ──────────────────────────────────────────────────────

  // S07.3 (D.10): the Tutor tags each chore. `kind` defaults to 'bonus' only
  // so an older client (which always sent a paid chore) keeps its meaning;
  // the rebuilt composer always sends an explicit choice.
  const KIND_RANGE = 'A bonus task pays 1 to 500 coins; a family contribution pays 0 to 2';
  const CreateTask = z
    .object({
      assignedTo: z.string().uuid(),
      title: z.string().trim().min(1).max(120),
      kind: z.enum(['contribution', 'bonus']).default('bonus'),
      rewardCoins: z.number().int().min(0).max(MAX_REWARD_COINS),
      recurrence: z.enum(['once', 'weekly']).default('once'),
      dueAt: z.string().datetime().nullable().optional(),
      requiresEvidence: z.boolean().default(false),
    })
    .strict()
    .refine((v) => (v.kind === 'bonus' ? v.rewardCoins >= 1 : v.rewardCoins <= MAX_CONTRIBUTION_COINS), { message: KIND_RANGE });

  router.post('/', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const parsed = CreateTask.safeParse(req.body);
    if (!parsed.success) {
      const kindIssue = parsed.error.issues.some((i) => i.message === KIND_RANGE);
      return fail(res, 400, 'VALIDATION_ERROR', kindIssue ? KIND_RANGE : 'Check the task details');
    }
    const { assignedTo, title, kind, rewardCoins, recurrence, dueAt, requiresEvidence } = parsed.data;
    if (!(await guardParentOf(assignedTo, res, parent.id))) return;

    const task = await insertTask({
      assigned_by: parent.id,
      assigned_to: assignedTo,
      title,
      kind,
      reward_coins: rewardCoins,
      recurrence,
      due_at: dueAt ?? null,
      requires_evidence: requiresEvidence,
    });
    if (!task) return fail(res, 502, DATA_UNAVAILABLE, 'Could not create the task');
    await insertAuditLog(parent.id, 'tasks.created', task.id, { assignedTo, kind, rewardCoins });
    return ok(res, { task: toWireTask(task) }, 201);
  });

  const ListTasksQuery = z.object({ kidId: z.string().uuid().optional() }).strict();

  router.get('/', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const q = ListTasksQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');

    if (q.data.kidId) {
      if (!(await guardParentOf(q.data.kidId, res, parent.id))) return;
      const tasks = await getTasksForKid(q.data.kidId);
      if (tasks === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load tasks');
      return ok(res, { tasks: tasks.map(toWireTask) });
    }

    const links = await getVerifiedKidLinks(parent.id);
    if (links === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    const tasks = await getTasksForKids(links.map((l) => l.kid_user_id));
    if (tasks === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load tasks');
    return ok(res, { tasks: tasks.map(toWireTask) });
  });

  router.post('/:id/approve', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const task = await getTaskById(id.data);
    if (!task) return fail(res, 404, NOT_FOUND, 'No such task');
    if (!(await guardParentOf(task.assigned_to, res, parent.id))) return;
    if (task.requires_evidence && !hasEvidence(task)) {
      return fail(res, 409, CONFLICT, 'This task requires a photo before it can be approved');
    }

    // decided_by/decided_at: the database re-checks that this actor is a
    // verified guardian of the assignee (family_hub_transition_guards).
    const updated = await transitionTaskStatus(id.data, 'done', 'approved', {
      decided_by: parent.id,
      decided_at: new Date().toISOString(),
    });
    if (!updated) return fail(res, 409, CONFLICT, 'This task is not awaiting approval');
    await insertAuditLog(parent.id, 'tasks.approved', id.data, {});
    return ok(res, { task: toWireTask(updated) });
  });

  const CancelTask = z.object({ reason: z.string().trim().min(1).max(240).nullable().optional() }).strict();

  router.post('/:id/cancel', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const parsedBody = CancelTask.safeParse(req.body ?? {});
    if (!parsedBody.success) return fail(res, 400, 'VALIDATION_ERROR', 'reason must be 240 characters or fewer');
    const task = await getTaskById(id.data);
    if (!task) return fail(res, 404, NOT_FOUND, 'No such task');
    if (!(await guardParentOf(task.assigned_to, res, parent.id))) return;
    if (task.status !== 'open' && task.status !== 'done') {
      return fail(res, 409, CONFLICT, 'This task can no longer be cancelled');
    }

    const updated = await transitionTaskStatus(id.data, task.status, 'cancelled', {
      cancel_reason: parsedBody.data.reason ?? null,
      decided_by: parent.id,
      decided_at: new Date().toISOString(),
    });
    if (!updated) return fail(res, 409, CONFLICT, 'This task changed state — refresh and try again');
    await insertAuditLog(parent.id, 'tasks.cancelled', id.data, { reason: parsedBody.data.reason ?? null });
    return ok(res, { task: toWireTask(updated) });
  });

  // ── PARENT: a kid's wallet/goals, read-only (family monitoring) ────────

  router.get('/:kidId/wallet', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const balances = await getWalletBalances(kidId.data);
    if (!balances) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the wallet');
    return ok(res, { balances });
  });

  router.get('/:kidId/goals', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const goals = await getGoalsForKid(kidId.data);
    if (goals === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load goals');
    const withProgress = await Promise.all(goals.map(async (g) => toWireGoal(g, (await getGoalProgress(g.id)) ?? 0)));
    return ok(res, { goals: withProgress });
  });

  router.get('/:kidId/wallet/ledger', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const entries = await getWalletLedger(kidId.data, 100);
    if (entries === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the ledger');
    const wire = await ledgerWithNotes(entries);
    if (wire === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the ledger');
    return ok(res, { entries: wire });
  });

  // ── PARENT: guardian money actions (D.5 / OD-21) ────────────────────────
  // Guardian-only, audited, with a required reason — enforced by the
  // database functions; these routes add the 404-not-403 family guard.

  router.get('/:kidId/wallet/guardian-actions', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const actions = await listGuardianActions(kidId.data, 50);
    if (actions === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the corrections');
    return ok(res, { actions: actions.map((a) => toWireGuardianAction(a, parent.id)) });
  });

  const Reason = z.string().trim().min(1).max(240);
  const WalletAdjustment = z
    .object({
      bucket: z.enum(WALLET_BUCKETS),
      amount: z.number().int().min(-1000).max(1000).refine((v) => v !== 0, 'amount cannot be zero'),
      reason: Reason,
    })
    .strict();

  router.post('/:kidId/wallet/adjustments', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = WalletAdjustment.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'A bucket, a non-zero amount up to 1000 and a reason are required');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const result = await adjustWalletAsGuardian({ kidId: kidId.data, actorId: parent.id, ...parsed.data });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the correction');
    if (isRefusal(result)) {
      const mapped = GUARDIAN_ACTION_REFUSALS[result.refused];
      return mapped ? fail(res, mapped.status, result.refused, mapped.message) : fail(res, 409, CONFLICT, 'The correction was refused');
    }
    return ok(res, { actionId: result }, 201);
  });

  const GoalWithdrawal = z
    .object({
      amount: z.number().int().min(1).max(1000),
      destination: z.enum(['spend', 'save']),
      reason: Reason,
    })
    .strict();

  router.post('/:kidId/goals/:goalId/withdrawals', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    const goalId = z.string().uuid().safeParse(req.params.goalId);
    if (!kidId.success || !goalId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId and goalId must be uuids');
    const parsed = GoalWithdrawal.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'An amount, a destination (spend or save) and a reason are required');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const goal = await getGoalById(goalId.data);
    if (!goal || goal.kid_user_id !== kidId.data) return fail(res, 404, NOT_FOUND, 'No such goal');
    const result = await withdrawGoalAsGuardian({ goalId: goalId.data, actorId: parent.id, ...parsed.data });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the withdrawal');
    if (isRefusal(result)) {
      const mapped = GUARDIAN_ACTION_REFUSALS[result.refused];
      return mapped ? fail(res, mapped.status, result.refused, mapped.message) : fail(res, 409, CONFLICT, 'The withdrawal was refused');
    }
    const progress = await getGoalProgress(goalId.data);
    return ok(res, { actionId: result, goal: toWireGoal(goal, progress ?? 0) }, 201);
  });

  // ── PARENT: redemption catalog + decisions ──────────────────────────────

  const CreateCatalogItem = z
    .object({
      title: z.string().trim().min(1).max(120),
      cost: z.number().int().min(1).max(MAX_REWARD_COINS),
    })
    .strict();

  router.post('/catalog', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const parsed = CreateCatalogItem.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the reward details');
    const item = await insertCatalogItem({ parent_user_id: parent.id, title: parsed.data.title, cost: parsed.data.cost });
    if (!item) return fail(res, 502, DATA_UNAVAILABLE, 'Could not create the catalog item');
    return ok(res, { item: toWireCatalogItem(item) }, 201);
  });

  router.get('/catalog', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const items = await getCatalogForParent(parent.id);
    if (items === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the catalog');
    return ok(res, { items: items.map(toWireCatalogItem) });
  });

  const UpdateCatalogItem = z.object({ active: z.boolean() }).strict();

  router.patch('/catalog/:id', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const parsed = UpdateCatalogItem.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'active must be a boolean');
    const item = await getCatalogItemById(id.data);
    if (!item || item.parent_user_id !== parent.id) return fail(res, 404, NOT_FOUND, 'No such catalog item');
    const okWrite = await setCatalogItemActive(id.data, parent.id, parsed.data.active);
    if (!okWrite) return fail(res, 502, DATA_UNAVAILABLE, 'Could not update the catalog item');
    return ok(res, { item: toWireCatalogItem({ ...item, active: parsed.data.active }) });
  });

  const ListRedemptionsQuery = z.object({ kidId: z.string().uuid().optional() }).strict();

  router.get('/redemptions', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const q = ListRedemptionsQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');

    if (q.data.kidId) {
      if (!(await guardParentOf(q.data.kidId, res, parent.id))) return;
      const redemptions = await getRedemptionsForKid(q.data.kidId);
      if (redemptions === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load redemptions');
      return ok(res, { redemptions: redemptions.map(toWireRedemption) });
    }

    const links = await getVerifiedKidLinks(parent.id);
    if (links === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    const redemptions = await getRedemptionsForKids(links.map((l) => l.kid_user_id));
    if (redemptions === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load redemptions');
    return ok(res, { redemptions: redemptions.map(toWireRedemption) });
  });

  const DecideRedemption = z.object({ approve: z.boolean() }).strict();

  router.post('/redemptions/:id/decide', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const parsed = DecideRedemption.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'approve must be a boolean');
    const redemption = await getRedemptionById(id.data);
    if (!redemption) return fail(res, 404, NOT_FOUND, 'No such redemption');
    if (!(await guardParentOf(redemption.kid_user_id, res, parent.id))) return;

    const decided = await decideRedemption(id.data, parsed.data.approve, parent.id);
    if (decided === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the decision');
    if (decided === false) {
      return fail(res, 409, CONFLICT, parsed.data.approve ? 'Balance no longer covers this redemption' : 'This redemption was already decided');
    }
    await insertAuditLog(parent.id, parsed.data.approve ? 'tasks.redemption_approved' : 'tasks.redemption_denied', id.data, {});
    return ok(res, { decided: true });
  });

  /*
   * OD-21: the 'fulfilled' redemption state. A verified guardian marks an
   * approved reward as delivered; the child's history then shows it as
   * received instead of leaving "approved" as the last word forever.
   */
  router.post('/redemptions/:id/fulfill', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    const redemption = await getRedemptionById(id.data);
    if (!redemption) return fail(res, 404, NOT_FOUND, 'No such redemption');
    if (!(await guardParentOf(redemption.kid_user_id, res, parent.id))) return;
    const result = await fulfillRedemptionAsGuardian(id.data, parent.id);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the delivery');
    if (isRefusal(result)) {
      return result.refused === 'NOT_A_GUARDIAN'
        ? fail(res, 404, NOT_FOUND, 'No such redemption')
        : fail(res, 409, CONFLICT, 'The delivery was refused');
    }
    if (result === false) return fail(res, 409, CONFLICT, 'Only an approved reward can be marked delivered');
    return ok(res, { fulfilled: true });
  });

  // ── CHILD IN A FAMILY: own tasks ─────────────────────────────────────────
  /*
   * S07.2 (D.3, OD-3 Option B): a child in a family is a parent-created child
   * OR a self-registered teen who linked a verified parent. The family
   * mechanics (chores, reward requests) layer onto the teen's existing wallet;
   * an unlinked teen is refused, because tasks and anything a parent approves
   * stay guardian-only. Balances, history and goals are admitted for every
   * wallet holder (the teen's personal wallet uses these same endpoints).
   */
  const familyChild = requireWalletAccess('familyChild');
  const walletHolder = requireWalletAccess('holder');
  /** Evidence is viewed by a verified guardian (parent role) or the child in a family. */
  const evidenceViewer: RequestHandler = async (req, res, next) => {
    const roles = await getOwnRoles(authedUser(res).accessToken, authedUser(res).id);
    if (!roles) return void fail(res, 502, DATA_UNAVAILABLE, 'Could not verify permissions');
    if (roles.some((r) => r.role === 'parent')) return void next();
    return familyChild(req, res, next);
  };


  router.get('/mine', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const tasks = await getTasksForKid(kid.id);
    if (tasks === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load tasks');
    return ok(res, { tasks: tasks.map(toWireTask) });
  });

  /** Verifies the caller (a kid) is the task's own assignee. */
  async function guardOwnTask(id: string, res: Parameters<typeof fail>[0], kidId: string) {
    const task = await getTaskById(id);
    if (!task || task.assigned_to !== kidId) {
      fail(res, 404, NOT_FOUND, 'No such task');
      return null;
    }
    return task;
  }

  const CompleteTask = z.object({ localDate: z.string().refine(isCalendarDate, 'localDate must be YYYY-MM-DD').optional() }).strict();

  router.post('/:id/complete', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const parsedBody = CompleteTask.safeParse(req.body ?? {});
    if (!parsedBody.success) return fail(res, 400, 'VALIDATION_ERROR', 'localDate must be YYYY-MM-DD');
    const task = await guardOwnTask(id.data, res, kid.id);
    if (!task) return;

    // S07.3 (D.2): the child's local day, bounded to the server's UTC day
    // plus or minus one. The database enforces the same bound on
    // completed_on and records the practised day from the task itself, so
    // Core never writes a streak. The read before the transition only tells
    // whether this is the day's first chore (a milestone celebrates once,
    // OD-7); its failure never blocks marking the chore done (§1.14).
    const todayLocal = resolveLocalToday(parsedBody.data.localDate);
    const before = await readStreakFacts([kid.id]);
    const updated = await transitionTaskStatus(id.data, 'open', 'done', { completed_on: todayLocal });
    if (!updated) return fail(res, 409, CONFLICT, 'This task is not open');

    const facts = before?.get(kid.id);
    if (!facts) return ok(res, { task: toWireTask(updated), streak: null, milestone: null });
    const day = updated.completed_on ?? todayLocal;
    const beforeState = evaluateStreak({ practisedDays: facts.practisedDays, pauses: livePauses(facts.pauses), today: todayLocal, legacyBest: facts.legacyBest }).state;
    const afterState = streakFromFacts({ ...facts, practisedDays: [...facts.practisedDays, day] }, todayLocal);
    const milestone = milestoneReached(beforeState, afterState, !facts.practisedDays.includes(day));
    return ok(res, { task: toWireTask(updated), streak: toWireStreak(afterState, facts.pauses, todayLocal), milestone });
  });

  const StreakQuery = z.object({ today: z.string().optional() }).strict();

  router.get('/streak', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const q = StreakQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'Only today may be given');
    const today = resolveLocalToday(q.data.today);
    const facts = await readStreakFacts([kid.id]);
    const own = facts?.get(kid.id);
    if (!own) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the streak');
    return ok(res, { streak: toWireStreak(streakFromFacts(own, today), own.pauses, today) });
  });

  // ── PARENT: the chore streak and holiday pauses (D.2) ───────────────────

  router.get('/:kidId/streak', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    const q = StreakQuery.safeParse(req.query);
    if (!kidId.success || !q.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const today = resolveLocalToday(q.data.today);
    const facts = await readStreakFacts([kidId.data]);
    const own = facts?.get(kidId.data);
    if (!own) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the streak');
    const pauses = own.pauses.map((p) => toWirePause(p, today)).filter((p) => p.state === 'running' || p.state === 'upcoming');
    return ok(res, { streak: toWireStreak(streakFromFacts(own, today), own.pauses, today), pauses });
  });

  const PauseDay = z.string().refine(isCalendarDate, 'must be YYYY-MM-DD');
  const PauseStreak = z.object({ startsOn: PauseDay, endsOn: PauseDay }).strict();
  const PAUSE_REFUSALS: Record<string, { status: number; message: string }> = {
    NOT_A_GUARDIAN: { status: 404, message: 'No such child for this account' },
    STREAK_PAUSE_INVALID: { status: 400, message: 'A pause lasts 1 to 21 days and starts no more than 7 days ago' },
    STREAK_PAUSE_OVERLAP: { status: 409, message: 'These days are already paused' },
    STREAK_PAUSE_LIMIT: { status: 409, message: 'Three pauses are already planned' },
    STREAK_PAUSE_OVER: { status: 409, message: 'This pause is already over' },
    STREAK_PAUSE_NOT_FOUND: { status: 404, message: 'No such pause' },
  };

  router.post('/:kidId/streak/pauses', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = PauseStreak.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'startsOn and endsOn must be YYYY-MM-DD');
    const { startsOn, endsOn } = parsed.data;
    const length = dayDifference(startsOn, endsOn) + 1;
    if (length < 1 || length > PAUSE_MAX_DAYS || startsOn < utcDayOffset(-PAUSE_MAX_BACKDATE_DAYS) || startsOn > utcDayOffset(PAUSE_MAX_LEAD_DAYS)) {
      return fail(res, 400, 'STREAK_PAUSE_INVALID', PAUSE_REFUSALS.STREAK_PAUSE_INVALID!.message);
    }
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const result = await pauseChoreStreak({ kidId: kidId.data, actorId: parent.id, startsOn, endsOn });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the pause');
    if (isRefusal(result)) {
      const mapped = PAUSE_REFUSALS[result.refused];
      return mapped ? fail(res, mapped.status, result.refused, mapped.message) : fail(res, 409, CONFLICT, 'The pause was refused');
    }
    await insertAuditLog(parent.id, 'tasks.streak_paused', kidId.data, { pauseId: result, startsOn, endsOn });
    return ok(res, { pauseId: result }, 201);
  });

  router.post('/:kidId/streak/pauses/:pauseId/end', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    const pauseId = z.string().uuid().safeParse(req.params.pauseId);
    if (!kidId.success || !pauseId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId and pauseId must be uuids');
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const owner = await getPauseKid(pauseId.data);
    if (owner === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the pause');
    if (owner !== kidId.data) return fail(res, 404, NOT_FOUND, 'No such pause');
    const result = await endChoreStreakPause(pauseId.data, parent.id);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not end the pause');
    if (isRefusal(result)) {
      const mapped = PAUSE_REFUSALS[result.refused];
      return mapped ? fail(res, mapped.status, result.refused, mapped.message) : fail(res, 409, CONFLICT, 'The change was refused');
    }
    await insertAuditLog(parent.id, 'tasks.streak_pause_ended', kidId.data, { pauseId: pauseId.data, outcome: result });
    return ok(res, { outcome: result });
  });

  /*
   * Proof-of-work photo (0077). Attachable while the task is still `open`
   * or `done` — before or right when marking it done, and replaceable up
   * until a parent decides — never after `approved`/`cancelled`, the same
   * "nothing changes once decided" boundary /:id/allocate already enforces
   * for the wallet side.
   */
  router.post('/:id/evidence', familyChild, evidenceUploadRateLimiter, evidenceUpload.single('photo'), async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const task = await guardOwnTask(id.data, res, kid.id);
    if (!task) return;
    if (task.status !== 'open' && task.status !== 'done') {
      return fail(res, 409, CONFLICT, 'This task already has a decision — a photo can no longer be attached');
    }
    if (!req.file || !EVIDENCE_ALLOWED_MIME.has(req.file.mimetype)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'A jpeg/png/webp photo is required');
    }
    // The declared Content-Type is client-controlled and trivially spoofable
    // — confirm the bytes actually ARE what the header claims before this
    // goes anywhere near Depot or a parent's screen.
    const sniffed = sniffImageMime(req.file.buffer);
    if (!sniffed || sniffed !== req.file.mimetype) {
      return fail(res, 400, 'VALIDATION_ERROR', 'The uploaded file is not a valid jpeg/png/webp photo');
    }

    const uploaded = await uploadEvidence(req.file.buffer, req.file.mimetype);
    if (!uploaded) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the photo');
    const updated = await setTaskEvidence(id.data, uploaded);
    if (!updated) {
      // The CAS in setTaskEvidence lost the race (a parent decided the task
      // between our read above and this write) — never distinguish that
      // from a transport failure to the caller (§1.14), but DO clean up the
      // orphaned upload we just made, best-effort.
      await deleteEvidence(uploaded.bucket, uploaded.hash, uploaded.ext);
      return fail(res, 409, CONFLICT, 'This task already has a decision — a photo can no longer be attached');
    }

    // Replaced a prior photo — clean up the superseded object, but only once
    // confirmed no other task row still points at the same content-addressed
    // bytes (evidenceStillReferencedElsewhere).
    if (hasEvidence(task) && task.evidence_bucket && task.evidence_hash && task.evidence_ext) {
      const changed = task.evidence_bucket !== uploaded.bucket || task.evidence_hash !== uploaded.hash || task.evidence_ext !== uploaded.ext;
      if (changed) {
        const stillReferenced = await evidenceStillReferencedElsewhere(id.data, task.evidence_bucket, task.evidence_hash, task.evidence_ext);
        if (stillReferenced === false) {
          await deleteEvidence(task.evidence_bucket, task.evidence_hash, task.evidence_ext);
        }
      }
    }

    return ok(res, { task: toWireTask(updated) });
  });

  /** Streams the photo back — never a raw Depot URL (§1.9). Either the assigned kid or a verified guardian of theirs may view it. */
  router.get('/:id/evidence', evidenceViewer, async (req, res) => {
    const caller = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const task = await getTaskById(id.data);
    if (!task) return fail(res, 404, NOT_FOUND, 'No such task');

    const isOwnKid = task.assigned_to === caller.id;
    if (!isOwnKid) {
      const isGuardian = await isVerifiedGuardianOfSilently(task.assigned_to, caller.id);
      if (isGuardian === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
      if (!isGuardian) return fail(res, 404, NOT_FOUND, 'No such task');
    }

    if (!task.evidence_bucket || !task.evidence_hash || !task.evidence_ext) {
      return fail(res, 404, NOT_FOUND, 'No photo attached to this task');
    }
    const bytes = await fetchEvidenceBytes(task.evidence_bucket, task.evidence_hash, task.evidence_ext);
    if (!bytes) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the photo');
    res.set('Content-Type', bytes.mime);
    res.set('Cache-Control', 'private, max-age=3600');
    return res.send(bytes.buffer);
  });

  const AllocateReward = z
    .object({
      save: z.number().int().min(0),
      spend: z.number().int().min(0),
      share: z.number().int().min(0),
      goalId: z.string().uuid().nullable().optional(),
    })
    .strict()
    .refine((v) => v.save + v.spend + v.share > 0, 'Split must add up to more than zero');

  router.post('/:id/allocate', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const parsed = AllocateReward.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the split');
    const task = await guardOwnTask(id.data, res, kid.id);
    if (!task) return;

    if (!await requireUnfrozenBanking(kid.id, res)) return;
    const allocated = await allocateTaskReward({
      taskId: id.data,
      kidId: kid.id,
      save: parsed.data.save,
      spend: parsed.data.spend,
      share: parsed.data.share,
      createdBy: kid.id,
      goalId: parsed.data.goalId ?? null,
    });
    if (allocated === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not allocate the reward');
    if (allocated === false) return fail(res, 409, CONFLICT, 'This task is not ready to allocate, or the split is invalid');

    // A goal-reached flip is a display fact derived from money already
    // safely credited above, not a second money-moving step — a brief delay
    // between "saved enough" and the status flip is cosmetic, unlike the
    // credit itself, which is why this runs outside the locked transaction.
    if (parsed.data.goalId) {
      const goal = await getGoalById(parsed.data.goalId);
      const progress = await getGoalProgress(parsed.data.goalId);
      if (goal && goal.status === 'active' && progress !== null && progress >= goal.target) {
        await markGoalReached(parsed.data.goalId);
      }
    }

    return ok(res, { allocated: true });
  });

  // ── KID: wallet ──────────────────────────────────────────────────────────

  router.get('/wallet', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const balances = await getWalletBalances(kid.id);
    if (!balances) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the wallet');
    return ok(res, { balances });
  });

  router.get('/wallet/ledger', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const entries = await getWalletLedger(kid.id, 100);
    if (entries === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the ledger');
    const wire = await ledgerWithNotes(entries);
    if (wire === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the ledger');
    return ok(res, { entries: wire });
  });

  // ── KID: goals ───────────────────────────────────────────────────────────

  const CreateGoal = z
    .object({
      title: z.string().trim().min(1).max(80),
      target: z.number().int().min(1).max(100000),
      icon: z.enum(GOAL_ICONS).default('star'),
    })
    .strict();

  router.post('/goals', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const parsed = CreateGoal.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the goal details');
    const goal = await insertGoal({ kid_user_id: kid.id, title: parsed.data.title, target: parsed.data.target, icon: parsed.data.icon });
    if (!goal) return fail(res, 502, DATA_UNAVAILABLE, 'Could not create the goal');
    return ok(res, { goal: toWireGoal(goal, 0) }, 201);
  });

  router.get('/goals', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const goals = await getGoalsForKid(kid.id);
    if (goals === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load goals');
    const withProgress = await Promise.all(goals.map(async (g) => toWireGoal(g, (await getGoalProgress(g.id)) ?? 0)));
    return ok(res, { goals: withProgress });
  });

  router.patch('/goals/:id', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const goal = await getGoalById(id.data);
    if (!goal || goal.kid_user_id !== kid.id) return fail(res, 404, NOT_FOUND, 'No such goal');
    const archived = await archiveGoal(id.data, kid.id);
    if (!archived) return fail(res, 502, DATA_UNAVAILABLE, 'Could not archive the goal');
    const progress = (await getGoalProgress(id.data)) ?? 0;
    return ok(res, { goal: toWireGoal({ ...goal, status: 'archived' }, progress) });
  });

  // ── KID: redemption catalog + requests ──────────────────────────────────

  router.get('/catalog/available', familyChild, async (req, res) => {
    const kid = authedUser(res);
    // A kid has no direct FK to a catalog — it is resolved through their OWN
    // verified guardians, the mirror image of guardParentOf above.
    const guardians = await getVerifiedGuardiansOfKid(kid.id);
    if (guardians === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    const items = await getCatalogForGuardians(guardians);
    if (items === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the catalog');
    return ok(res, { items: items.map(toWireCatalogItem) });
  });

  const RequestRedemption = z.object({ catalogId: z.string().uuid() }).strict();

  router.post('/redemptions', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const parsed = RequestRedemption.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'catalogId must be a uuid');
    const item = await getCatalogItemById(parsed.data.catalogId);
    if (!item || !item.active) return fail(res, 404, NOT_FOUND, 'No such reward');
    const guardians = await getVerifiedGuardiansOfKid(kid.id);
    if (guardians === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
    if (!guardians.includes(item.parent_user_id)) return fail(res, 404, NOT_FOUND, 'No such reward');

    // BANKING.md §5.5/§6.3: a parent-set spend limit is enforced at
    // REQUEST time, before this ever reaches their approval queue — a limit
    // discovered only after a parent says no teaches nothing; hitting it
    // yourself, immediately, with a clear reason, is the actual lesson.
    const limit = await getSpendLimit(kid.id);
    if (limit === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check the spend limit');
    if (limit && limit.active) {
      const used = await getSpendUsedThisPeriod(kid.id, limit.period);
      if (used === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check the spend limit');
      if (used + item.cost > limit.cap) {
        return fail(res, 409, 'SPEND_LIMIT_REACHED', `This would go over the ${limit.period} spending limit`);
      }
    }

    if (!await requireUnfrozenBanking(kid.id, res)) return;
    const redemption = await insertRedemption({ catalog_id: item.id, kid_user_id: kid.id });
    if (!redemption) return fail(res, 502, DATA_UNAVAILABLE, 'Could not request the redemption');
    return ok(res, { redemption: toWireRedemption(redemption) }, 201);
  });

  router.get('/redemptions/mine', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const redemptions = await getRedemptionsForKid(kid.id);
    if (redemptions === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load redemptions');
    return ok(res, { redemptions: redemptions.map(toWireRedemption) });
  });

  return router;
}
