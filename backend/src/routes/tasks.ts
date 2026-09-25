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
  evidenceStillReferencedElsewhere,
  getCatalogForGuardians,
  getCatalogForParent,
  getCatalogItemById,
  getGoalById,
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
  insertTask,
  setCatalogItemActive,
  setTaskEvidence,
  type CatalogItemRow,
  type GoalRow,
  type RedemptionRow,
  type TaskRow,
  type WalletLedgerRow,
} from '../services/supabaseRest.js';
import {
  archiveShareDestination,
  createShareDestination,
  declineNextStep,
  DESTINATION_KINDS,
  getGoalBreakdowns,
  getNextSteps,
  getShareDestination,
  getShareGift,
  listShareDestinations,
  listShareGifts,
  markNextStepSeen,
  pledgeShareGift,
  readUsualSplit,
  RECOMMENDED_SPLIT,
  SHARE_GIFT_MAX_COINS,
  setUsualSplit,
  settleShareGift,
  type DestinationRow,
  type GiftRow,
  type GoalProgress,
  type NextStepRow,
} from '../services/moneyHabits.js';
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
import {
  CHILD_NOTE_MAX_CHARS,
  CHILD_REWARD_REASONS,
  closeTalk,
  decideLevelRequest,
  decideRedemptionWithReason,
  decideTask,
  DECISION_REASON_MAX_CHARS,
  DECISION_REVISIT_MAX_DAYS,
  getDecision,
  getLevelRequestKid,
  getNudgeKid,
  LEVEL_LOWER_REASON_CODES,
  LEVEL_REQUEST_REASON_CODES,
  listAutonomyChanges,
  listDecisions,
  listNudges,
  listPendingLevelRequests,
  markTaskDone,
  NOT_YET_OUTCOMES,
  PREAPPROVED_CAP,
  readAutonomyStatus,
  reasonActionable,
  requestLevel,
  requestRedemption,
  requestTalk,
  reviewDecision,
  reviewedIds,
  REWARD_REASON_CODES,
  selfLogTask,
  setAutonomy,
  stepDownAutonomy,
  TASK_REASON_CODES,
  toWireAutonomy,
  toWireChange,
  catalogItems,
  subjectTitles,
  type DecisionRow,
  type NudgeRow,
} from '../services/familyAutonomy.js';

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
    // S07.5 (D.18): the child's own words when marking it done.
    childNote: t.child_note ?? null,
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

/*
 * S07.4 (D.16): a goal's progress always travels with its provenance — the
 * child's own coins, bonus coins and Tutor coins — so no display can show one
 * mixed number. `saved` stays (the total) for older clients. (D.15) the next
 * step of a reached goal: whether "what's your next goal?" is still due.
 */
const EMPTY_PROGRESS: GoalProgress = { own: 0, bonus: 0, family: 0, total: 0 };

function toWireGoal(g: GoalRow, progress: GoalProgress, nextStep: NextStepRow | null = null) {
  return {
    id: g.id,
    kidUserId: g.kid_user_id,
    title: g.title,
    target: g.target,
    icon: g.icon,
    status: g.status,
    createdAt: g.created_at,
    reachedAt: g.reached_at,
    followsGoalId: g.follows_goal_id ?? null,
    saved: progress.total,
    progress,
    nextStep: nextStep ? { state: nextStep.state, nextGoalId: nextStep.next_goal_id } : null,
  };
}

/** Goals with their provenance and next steps; null = unreadable (refused, never shown as a mixed or empty number). */
async function goalsWithProgress(goals: GoalRow[]) {
  const ids = goals.map((g) => g.id);
  const [breakdowns, steps] = await Promise.all([getGoalBreakdowns(ids), getNextSteps(ids)]);
  if (breakdowns === null || steps === null) return null;
  return goals.map((g) => toWireGoal(g, breakdowns.get(g.id) ?? EMPTY_PROGRESS, steps.get(g.id) ?? null));
}

async function oneGoalWithProgress(g: GoalRow) {
  const wire = await goalsWithProgress([g]);
  return wire ? wire[0]! : null;
}

function toWireDestination(d: DestinationRow) {
  return { id: d.id, title: d.title, kind: d.kind, chosenBy: d.chosen_by, status: d.status, createdAt: d.created_at };
}

/** Who settled a gift is shared as the child themself or "a Tutor" only. */
function toWireGift(g: GiftRow) {
  return {
    id: g.id,
    destinationId: g.destination_id,
    amount: g.amount,
    status: g.status,
    pledgedAt: g.pledged_at,
    settledAt: g.settled_at,
    settledBy: g.settled_by === null ? null : g.settled_by === g.holder_user_id ? 'holder' : 'tutor',
    note: g.note,
  };
}

async function shareView(holderId: string) {
  const [destinations, gifts] = await Promise.all([listShareDestinations(holderId), listShareGifts(holderId)]);
  if (destinations === null || gifts === null) return null;
  return { destinations: destinations.map(toWireDestination), gifts: gifts.map(toWireGift) };
}

/** Database refusals from the S07.4 RPCs, mapped to the API's error envelope. */
const HABIT_REFUSALS: Record<string, { status: number; message: string }> = {
  SPLIT_INVALID: { status: 400, message: 'The three parts must add up to 100' },
  SPLIT_OWNER_ONLY: { status: 403, message: 'Only the wallet holder sets their usual split' },
  SHARE_DESTINATION_INVALID: { status: 400, message: 'A destination needs a name up to 60 characters and a kind' },
  SHARE_DESTINATION_LIMIT: { status: 409, message: 'There are already 10 active destinations' },
  SHARE_DESTINATION_FORBIDDEN: { status: 403, message: 'A Tutor chooses the destinations for a child in a family' },
  SHARE_DESTINATION_UNAVAILABLE: { status: 409, message: 'That destination is not active' },
  SHARE_DESTINATION_NOT_FOUND: { status: 404, message: 'No such destination' },
  SHARE_GIFT_INVALID: { status: 400, message: 'Check the amount and the note' },
  SHARE_GIFT_NOT_FOUND: { status: 404, message: 'No such gift' },
  SHARE_GIFT_FORBIDDEN: { status: 403, message: 'Only whoever chose the destination records what happened' },
  SHARE_GIFT_SETTLED: { status: 409, message: 'This gift was already settled' },
  SHARE_GIFT_NOTE_REQUIRED: { status: 400, message: 'Say what happened' },
  INSUFFICIENT_BALANCE: { status: 409, message: 'There are not that many coins in Share' },
  ACCOUNT_FROZEN: { status: 409, message: 'This account is frozen; the operation is on hold' },
  WALLET_HOLDER_REQUIRED: { status: 403, message: 'This account holds no wallet' },
  GOAL_NOT_FOUND: { status: 404, message: 'No such goal' },
  GOAL_FOLLOWS_INVALID: { status: 409, message: 'A next goal can only follow a goal you reached' },
};

function habitRefusal(res: Parameters<typeof fail>[0], refused: string, fallback: string) {
  const mapped = HABIT_REFUSALS[refused];
  return mapped ? fail(res, mapped.status, refused, mapped.message) : fail(res, 409, CONFLICT, fallback);
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
    // S07.5 (D.18): the child's own reason, surfaced to the Tutor at decision time.
    childReasonKind: r.child_reason_kind ?? null,
    childNote: r.child_note ?? null,
  };
}

/*
 * S07.5 (D.18): one decision as the family reads it. Who decided is shared as
 * "you" (the calling Tutor), "a Tutor", or the child themself under their
 * level; never another account's id.
 */
function toWireDecision(d: DecisionRow, callerId: string, title: string | null) {
  return {
    id: d.id,
    subject: d.subject,
    subjectId: d.task_id ?? d.redemption_id ?? d.level_request_id,
    title,
    outcome: d.outcome,
    by: d.actor_kind,
    byMe: d.actor_user_id === callerId,
    reasonCode: d.reason_code,
    reason: d.reason,
    revisitOn: d.revisit_on,
    reviewsDecisionId: d.reviews_decision_id,
    createdAt: d.created_at,
  };
}

function toWireNudge(n: NudgeRow) {
  return { id: n.id, kidUserId: n.kid_user_id, origin: n.origin, decisionId: n.decision_id, denials: n.denials, status: n.status, createdAt: n.created_at };
}

/** Database refusals from the S07.5 RPCs, mapped to the API's error envelope. */
const DECISION_REFUSALS: Record<string, { status: number; message: string }> = {
  DECISION_REASON_REQUIRED: { status: 400, message: 'A "not yet" needs a reason code and a reason' },
  DECISION_REASON_NOT_ACTIONABLE: { status: 400, message: 'Say what they can do next, in a few words' },
  DECISION_REVISIT_INVALID: { status: 400, message: 'Pick a date from tomorrow to 90 days ahead, only for "later"' },
  DECISION_NOTE_INVALID: { status: 400, message: 'A note on a yes is up to 240 characters' },
  DECISION_OUTCOME_INVALID: { status: 409, message: 'This request is no longer waiting for that decision' },
  DECISION_ALREADY_REVIEWED: { status: 409, message: 'This was already reviewed' },
  DECISION_NOT_FOUND: { status: 404, message: 'No such decision' },
  NOT_A_GUARDIAN: { status: 404, message: 'No such child for this account' },
  TASK_NOT_FOUND: { status: 404, message: 'No such task' },
  TASK_NOT_OPEN: { status: 409, message: 'This task is not open' },
  TASK_NOTE_INVALID: { status: 400, message: 'A note is up to 140 characters' },
  TASK_EVIDENCE_REQUIRED: { status: 409, message: 'This task requires a photo before it can be approved' },
  TASK_COMPLETION_DAY_INVALID: { status: 400, message: 'localDate must be the local day of the completion' },
  REDEMPTION_NOT_FOUND: { status: 404, message: 'No such redemption' },
  REDEMPTION_DECIDED: { status: 409, message: 'This redemption was already decided' },
  REDEMPTION_REASON_REQUIRED: { status: 400, message: 'Pick why you want it' },
  REDEMPTION_NOTE_INVALID: { status: 400, message: 'A note is up to 140 characters' },
  REWARD_UNAVAILABLE: { status: 404, message: 'No such reward' },
  SPEND_LIMIT_REACHED: { status: 409, message: 'This would go over the spending limit' },
  INSUFFICIENT_BALANCE: { status: 409, message: 'Balance no longer covers this redemption' },
  ACCOUNT_FROZEN: { status: 409, message: 'This account is frozen; the operation is on hold' },
  AUTONOMY_NOT_ELIGIBLE: { status: 409, message: 'The rule for that level is not met yet' },
  AUTONOMY_LIMIT_INVALID: { status: 400, message: 'The pre-approved amount is above what this level allows' },
  AUTONOMY_REASON_REQUIRED: { status: 400, message: 'Lowering a level needs a reason code and a reason' },
  AUTONOMY_REASON_INVALID: { status: 400, message: 'A reason is only given when lowering a level' },
  AUTONOMY_NO_CHANGE: { status: 409, message: 'Nothing changed' },
  AUTONOMY_STALE: { status: 409, message: 'The level changed meanwhile; refresh and try again' },
  AUTONOMY_NOT_IN_FAMILY: { status: 403, message: 'Levels are for children in a family' },
  AUTONOMY_CHILD_STEP_DOWN_ONLY: { status: 409, message: 'You are already on the first level' },
  AUTONOMY_REQUEST_PENDING: { status: 409, message: 'You already asked; your Tutor will answer' },
  AUTONOMY_REQUEST_INVALID: { status: 400, message: 'Check the request' },
  AUTONOMY_REQUEST_DECIDED: { status: 409, message: 'This request was already answered' },
  AUTONOMY_REQUEST_NOT_FOUND: { status: 404, message: 'No such request' },
  TALK_NUDGE_INVALID: { status: 409, message: 'You can ask to talk about a "not yet" you received' },
  TALK_NUDGE_CLOSED: { status: 409, message: 'This was already closed' },
  TALK_NUDGE_NOT_FOUND: { status: 404, message: 'No such nudge' },
};

function decisionRefusal(res: Parameters<typeof fail>[0], refused: string, fallback: string) {
  const mapped = DECISION_REFUSALS[refused];
  return mapped ? fail(res, mapped.status, refused, mapped.message) : fail(res, 409, 'CONFLICT', fallback);
}

// S07.5 (D.18): the shape of a "not yet", checked before any write; the
// database checks it again for every writer.
const ReasonText = z.string().max(DECISION_REASON_MAX_CHARS);
const RevisitOn = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ChildNote = z.string().max(CHILD_NOTE_MAX_CHARS).nullable().optional();

/** Days from today (UTC) to a calendar date, or NaN. */
function daysAhead(date: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

/** Why a "not yet" body is unusable, or null when the database may judge it. */
function notYetProblem(body: Record<string, unknown>, codes: readonly string[]) {
  const code = typeof body.reasonCode === 'string' ? body.reasonCode : null;
  const reason = typeof body.reason === 'string' ? body.reason : null;
  const revisitOn = typeof body.revisitOn === 'string' ? body.revisitOn : null;
  if (!code || !codes.includes(code) || !reason) return 'DECISION_REASON_REQUIRED';
  if (!reasonActionable(reason)) return 'DECISION_REASON_NOT_ACTIONABLE';
  if (code === 'later_date') {
    const days = revisitOn ? daysAhead(revisitOn) : Number.NaN;
    if (!(days >= 1 && days <= DECISION_REVISIT_MAX_DAYS)) return 'DECISION_REVISIT_INVALID';
  } else if (revisitOn) {
    return 'DECISION_REVISIT_INVALID';
  }
  return null;
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

  /*
   * S07.5 (D.18): every decision on a chore goes through one database flow
   * that records it (family_decide_task). A yes may carry an encouraging
   * note; sending a chore back to finish and cancelling it each need a reason
   * code and a reason the child can act on.
   */
  const ApproveTask = z.object({ note: ReasonText.nullable().optional() }).strict();
  const NotYetTask = z.object({ reasonCode: z.enum(TASK_REASON_CODES), reason: ReasonText }).strict();

  async function decideChore(req: Parameters<RequestHandler>[0], res: Parameters<typeof fail>[0], outcome: 'approved' | 'sent_back' | 'cancelled') {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    let reasonCode: string | null = null;
    let reason: string | null = null;
    if (outcome === 'approved') {
      const body = ApproveTask.safeParse(req.body ?? {});
      if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'A note is up to 240 characters');
      reason = body.data.note?.trim() || null;
    } else {
      const raw = (req.body ?? {}) as Record<string, unknown>;
      const problem = notYetProblem(raw, TASK_REASON_CODES);
      if (problem) return decisionRefusal(res, problem, 'Check the reason');
      const body = NotYetTask.safeParse(raw);
      if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'A reason code and a reason are required');
      reasonCode = body.data.reasonCode;
      reason = body.data.reason.trim();
    }
    const task = await getTaskById(id.data);
    if (!task) return fail(res, 404, NOT_FOUND, 'No such task');
    if (!(await guardParentOf(task.assigned_to, res, parent.id))) return;
    if (outcome === 'approved' && task.requires_evidence && !hasEvidence(task)) {
      return fail(res, 409, CONFLICT, 'This task requires a photo before it can be approved');
    }
    const result = await decideTask({ taskId: id.data, actorId: parent.id, outcome, reasonCode, reason });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the decision');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'The decision was refused');
    await insertAuditLog(parent.id, `tasks.${outcome === 'approved' ? 'approved' : outcome}`, id.data, { reasonCode });
    const updated = await getTaskById(id.data);
    if (!updated) return fail(res, 502, DATA_UNAVAILABLE, 'The decision was recorded; reload to see it');
    return ok(res, { task: toWireTask(updated) });
  }

  router.post('/:id/approve', requireRole(['parent']), (req, res) => decideChore(req, res, 'approved'));
  router.post('/:id/send-back', requireRole(['parent']), (req, res) => decideChore(req, res, 'sent_back'));
  router.post('/:id/cancel', requireRole(['parent']), (req, res) => decideChore(req, res, 'cancelled'));

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
    const withProgress = await goalsWithProgress(goals);
    if (withProgress === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load goal progress');
    return ok(res, { goals: withProgress });
  });

  /** S07.4 (D.13): the child's usual split, read-only for the Tutor (only the child sets it). */
  router.get('/:kidId/wallet/split', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const usual = await readUsualSplit(kidId.data);
    if (!usual) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the usual split');
    return ok(res, { usual: { save: usual.save, spend: usual.spend, share: usual.share }, custom: usual.custom, recommended: RECOMMENDED_SPLIT });
  });

  // ── PARENT: the Share destination (D.14) ─────────────────────────────────

  router.get('/:kidId/share', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const view = await shareView(kidId.data);
    if (!view) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the Share destinations');
    return ok(res, view);
  });

  const NewDestination = z.object({ title: z.string().trim().min(1).max(60), kind: z.enum(DESTINATION_KINDS) }).strict();

  router.post('/:kidId/share/destinations', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = NewDestination.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'A name up to 60 characters and a kind are required');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const result = await createShareDestination({ holderId: kidId.data, actorId: parent.id, ...parsed.data });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not add the destination');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The destination was refused');
    return ok(res, { destinationId: result }, 201);
  });

  router.post('/:kidId/share/destinations/:destinationId/archive', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    const destinationId = z.string().uuid().safeParse(req.params.destinationId);
    if (!kidId.success || !destinationId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId and destinationId must be uuids');
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const destination = await getShareDestination(destinationId.data);
    if (destination === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the destination');
    if (!destination || destination.holder_user_id !== kidId.data) return fail(res, 404, NOT_FOUND, 'No such destination');
    const result = await archiveShareDestination(destinationId.data, parent.id);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not archive the destination');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The archive was refused');
    return ok(res, { archived: result });
  });

  const SettleGift = z.object({ outcome: z.enum(['given', 'returned']), note: z.string().trim().min(1).max(240).nullable().optional() }).strict();

  router.post('/:kidId/share/gifts/:giftId/settle', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    const giftId = z.string().uuid().safeParse(req.params.giftId);
    if (!kidId.success || !giftId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId and giftId must be uuids');
    const parsed = SettleGift.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'An outcome (given or returned) and a note up to 240 characters are required');
    // A Tutor always says what happened, or why the coins came back.
    if (!parsed.data.note) return fail(res, 400, 'SHARE_GIFT_NOTE_REQUIRED', 'Say what happened');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const gift = await getShareGift(giftId.data);
    if (gift === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the gift');
    if (!gift || gift.holder_user_id !== kidId.data) return fail(res, 404, NOT_FOUND, 'No such gift');
    const result = await settleShareGift({ giftId: giftId.data, actorId: parent.id, outcome: parsed.data.outcome, note: parsed.data.note });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the outcome');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The outcome was refused');
    return ok(res, { outcome: result });
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
    const fresh = (await getGoalById(goalId.data)) ?? goal;
    const wire = await oneGoalWithProgress(fresh);
    return ok(res, { actionId: result, goal: wire }, 201);
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

  /*
   * S07.5 (D.18): a yes (with an optional note) or a denial with a reward
   * reason code, an actionable reason and, for "later", a date.
   */
  const DecideRedemption = z
    .object({
      approve: z.boolean(),
      reasonCode: z.enum(REWARD_REASON_CODES).nullable().optional(),
      reason: ReasonText.nullable().optional(),
      revisitOn: RevisitOn.nullable().optional(),
      note: ReasonText.nullable().optional(),
    })
    .strict();

  router.post('/redemptions/:id/decide', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const raw = (req.body ?? {}) as Record<string, unknown>;
    if (raw.approve === false) {
      const problem = notYetProblem(raw, REWARD_REASON_CODES);
      if (problem) return decisionRefusal(res, problem, 'Check the reason');
    }
    const parsed = DecideRedemption.safeParse(raw);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'approve must be a boolean, with a reason for a denial');
    const redemption = await getRedemptionById(id.data);
    if (!redemption) return fail(res, 404, NOT_FOUND, 'No such redemption');
    if (!(await guardParentOf(redemption.kid_user_id, res, parent.id))) return;

    const { approve } = parsed.data;
    const result = await decideRedemptionWithReason({
      redemptionId: id.data,
      actorId: parent.id,
      approve,
      reasonCode: approve ? null : parsed.data.reasonCode,
      reason: approve ? parsed.data.note?.trim() || null : parsed.data.reason?.trim(),
      revisitOn: approve ? null : parsed.data.revisitOn,
    });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the decision');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'The decision was refused');
    await insertAuditLog(parent.id, approve ? 'tasks.redemption_approved' : 'tasks.redemption_denied', id.data, { reasonCode: parsed.data.reasonCode ?? null });
    return ok(res, { decided: true, status: result });
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

  const CompleteTask = z.object({ localDate: z.string().refine(isCalendarDate, 'localDate must be YYYY-MM-DD').optional(), note: ChildNote }).strict();

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
    // S07.5 (D.17, D.18): one database flow marks it done with the child's
    // note, then lets the child's level self-log it (or leaves it for the
    // Tutor). Core never approves anything here.
    const marked = await markTaskDone(id.data, kid.id, todayLocal, parsedBody.data.note?.trim() || null);
    if (marked === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not mark the task done');
    if (isRefusal(marked)) return decisionRefusal(res, marked.refused, 'This task is not open');
    const updated = await getTaskById(id.data);
    if (!updated) return fail(res, 502, DATA_UNAVAILABLE, 'The task was marked done; reload to see it');
    const selfLogged = marked.self_logged;

    const facts = before?.get(kid.id);
    if (!facts) return ok(res, { task: toWireTask(updated), streak: null, milestone: null, selfLogged });
    const day = updated.completed_on ?? todayLocal;
    const beforeState = evaluateStreak({ practisedDays: facts.practisedDays, pauses: livePauses(facts.pauses), today: todayLocal, legacyBest: facts.legacyBest }).state;
    const afterState = streakFromFacts({ ...facts, practisedDays: [...facts.practisedDays, day] }, todayLocal);
    const milestone = milestoneReached(beforeState, afterState, !facts.practisedDays.includes(day));
    return ok(res, { task: toWireTask(updated), streak: toWireStreak(afterState, facts.pauses, todayLocal), milestone, selfLogged });
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

    // S07.5 (D.17): a chore that asked for a photo is self-logged once the
    // photo is in, when the child's level admits it. A refusal or a
    // transport failure leaves it waiting for the Tutor; the photo is saved.
    if (updated.status === 'done') {
      const logged = await selfLogTask(id.data, kid.id);
      if (logged === true) {
        const after = await getTaskById(id.data);
        if (after) return ok(res, { task: toWireTask(after), selfLogged: true });
      }
    }
    return ok(res, { task: toWireTask(updated), selfLogged: false });
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

    // S07.4: a goal the Save part covered is marked reached inside the same
    // transaction (allocate_task_reward), so the goal comes back as it now
    // is; the child's surface celebrates it once (D.15). A failed read never
    // turns a completed allocation into an error.
    const goalRow = parsed.data.goalId ? await getGoalById(parsed.data.goalId) : null;
    const goal = goalRow ? await oneGoalWithProgress(goalRow) : null;
    return ok(res, { allocated: true, goal });
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
      // S07.4 (D.15): the reached goal this one follows, when started from
      // the "what's your next goal?" prompt. The database checks it is the
      // caller's own reached goal and closes that goal's next step.
      followsGoalId: z.string().uuid().nullable().optional(),
    })
    .strict();

  router.post('/goals', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const parsed = CreateGoal.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the goal details');
    const follows = parsed.data.followsGoalId ?? null;
    if (follows) {
      const previous = await getGoalById(follows);
      if (!previous || previous.kid_user_id !== kid.id) return fail(res, 404, NOT_FOUND, 'No such goal');
      if (previous.reached_at === null) return fail(res, 409, 'GOAL_FOLLOWS_INVALID', 'A next goal can only follow a goal you reached');
    }
    const goal = await insertGoal({ kid_user_id: kid.id, title: parsed.data.title, target: parsed.data.target, icon: parsed.data.icon, follows_goal_id: follows });
    if (!goal) return fail(res, 502, DATA_UNAVAILABLE, 'Could not create the goal');
    return ok(res, { goal: toWireGoal(goal, EMPTY_PROGRESS) }, 201);
  });

  router.get('/goals', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const goals = await getGoalsForKid(kid.id);
    if (goals === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load goals');
    const withProgress = await goalsWithProgress(goals);
    if (withProgress === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load goal progress');
    return ok(res, { goals: withProgress });
  });

  /*
   * S07.4 (D.15): the child's first view of a reached goal. `celebrate` is
   * true exactly once per goal (the database moves pending -> prompted), so
   * the OD-7 celebration and the "what's your next goal?" prompt happen at
   * the same moment and never again.
   */
  router.post('/goals/:id/next-step/seen', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    const result = await markNextStepSeen(kid.id, id.data);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the prompt');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The prompt was refused');
    return ok(res, { celebrate: result });
  });

  router.post('/goals/:id/next-step/decline', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    const result = await declineNextStep(kid.id, id.data);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the answer');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The answer was refused');
    return ok(res, { declined: result });
  });

  router.patch('/goals/:id', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const goal = await getGoalById(id.data);
    if (!goal || goal.kid_user_id !== kid.id) return fail(res, 404, NOT_FOUND, 'No such goal');
    const archived = await archiveGoal(id.data, kid.id);
    if (!archived) return fail(res, 502, DATA_UNAVAILABLE, 'Could not archive the goal');
    const wire = await oneGoalWithProgress({ ...goal, status: 'archived' });
    if (!wire) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load goal progress');
    return ok(res, { goal: wire });
  });

  // ── WALLET HOLDER: the usual split (D.13) ────────────────────────────────
  /*
   * The recommended default split with an easy override. The holder (a child
   * in a family or a teen) owns their usual split; every payout is offered
   * pre-split by it and any other split that adds up is accepted.
   */
  router.get('/wallet/split', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const usual = await readUsualSplit(kid.id);
    if (!usual) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the usual split');
    return ok(res, { usual: { save: usual.save, spend: usual.spend, share: usual.share }, custom: usual.custom, recommended: RECOMMENDED_SPLIT });
  });

  const Percent = z.number().int().min(0).max(100);
  const UsualSplitBody = z
    .object({ save: Percent, spend: Percent, share: Percent })
    .strict()
    .refine((v) => v.save + v.spend + v.share === 100, 'The three parts must add up to 100');

  router.put('/wallet/split', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const parsed = UsualSplitBody.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'The three parts must be whole numbers adding up to 100');
    const result = await setUsualSplit(kid.id, kid.id, parsed.data);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the usual split');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The usual split was refused');
    return ok(res, { usual: parsed.data, custom: true, recommended: RECOMMENDED_SPLIT });
  });

  // ── WALLET HOLDER: the Share destination (D.14) ──────────────────────────

  router.get('/share', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const view = await shareView(kid.id);
    if (!view) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the Share destinations');
    return ok(res, view);
  });

  // A self-registered teen may choose their own destination (OD-3 Option B);
  // for a child in a family the database refuses it: a Tutor chooses.
  router.post('/share/destinations', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const parsed = NewDestination.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'A name up to 60 characters and a kind are required');
    const result = await createShareDestination({ holderId: kid.id, actorId: kid.id, ...parsed.data });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not add the destination');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The destination was refused');
    return ok(res, { destinationId: result }, 201);
  });

  router.post('/share/destinations/:id/archive', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    const destination = await getShareDestination(id.data);
    if (destination === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the destination');
    if (!destination || destination.holder_user_id !== kid.id) return fail(res, 404, NOT_FOUND, 'No such destination');
    const result = await archiveShareDestination(id.data, kid.id);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not archive the destination');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The archive was refused');
    return ok(res, { archived: result });
  });

  const PledgeGift = z.object({ destinationId: z.string().uuid(), amount: z.number().int().min(1).max(SHARE_GIFT_MAX_COINS) }).strict();

  router.post('/share/gifts', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const parsed = PledgeGift.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'A destination and 1 to 1000 coins are required');
    const result = await pledgeShareGift(kid.id, parsed.data.destinationId, parsed.data.amount);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the gift');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The gift was refused');
    return ok(res, { giftId: result }, 201);
  });

  // The child takes a pledge back ('returned'), or a teen records what happened
  // with a gift to a destination they chose themself ('given'). The database
  // decides which the caller may do.
  router.post('/share/gifts/:id/settle', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const parsed = SettleGift.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'An outcome (given or returned) and an optional note up to 240 characters are required');
    const result = await settleShareGift({ giftId: id.data, actorId: kid.id, outcome: parsed.data.outcome, note: parsed.data.note ?? null });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the outcome');
    if (isRefusal(result)) return habitRefusal(res, result.refused, 'The outcome was refused');
    return ok(res, { outcome: result });
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

  // S07.5 (D.18): the child says why (a closed set a young child can tap,
  // plus an optional note); the level may pre-approve it (D.17).
  const RequestRedemption = z.object({ catalogId: z.string().uuid(), reasonKind: z.enum(CHILD_REWARD_REASONS), note: ChildNote }).strict();

  router.post('/redemptions', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const parsed = RequestRedemption.safeParse(req.body);
    if (!parsed.success) {
      const missing = typeof (req.body ?? {}).reasonKind !== 'string';
      return missing ? decisionRefusal(res, 'REDEMPTION_REASON_REQUIRED', 'Pick why you want it') : fail(res, 400, 'VALIDATION_ERROR', 'Check the request');
    }
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
    const requested = await requestRedemption(kid.id, item.id, parsed.data.reasonKind, parsed.data.note?.trim() || null);
    if (requested === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not request the redemption');
    if (isRefusal(requested)) return decisionRefusal(res, requested.refused, 'The request was refused');
    const redemption = await getRedemptionById(requested.id);
    if (!redemption) return fail(res, 502, DATA_UNAVAILABLE, 'The request was saved; reload to see it');
    return ok(res, { redemption: toWireRedemption(redemption), preapproved: requested.preapproved }, 201);
  });

  router.get('/redemptions/mine', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const redemptions = await getRedemptionsForKid(kid.id);
    if (redemptions === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load redemptions');
    return ok(res, { redemptions: redemptions.map(toWireRedemption) });
  });

  // ── S07.5 (D.18): the Tutor's decision queue ──────────────────────────────
  /*
   * Everything waiting for a Tutor, with the child's own words next to each
   * request: chores marked done (and open chores, which may be removed with
   * a reason), reward requests, the self-directed items the child's level
   * let through (to look at afterwards), "talk about it" nudges and level
   * requests. One child (kidId) or all of the caller's children.
   */
  const QueueQuery = z.object({ kidId: z.string().uuid().optional() }).strict();
  const REVIEW_WINDOW_DAYS = 30;

  router.get('/decisions/queue', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const q = QueueQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    let kidIds: string[];
    if (q.data.kidId) {
      if (!(await guardParentOf(q.data.kidId, res, parent.id))) return;
      kidIds = [q.data.kidId];
    } else {
      const links = await getVerifiedKidLinks(parent.id);
      if (links === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
      kidIds = links.map((l) => l.kid_user_id);
    }
    const [tasks, redemptions, selfDirected, nudges, requests] = await Promise.all([
      getTasksForKids(kidIds),
      getRedemptionsForKids(kidIds),
      listDecisions(kidIds, { sinceDays: REVIEW_WINDOW_DAYS, outcomes: ['self_logged', 'preapproved'] }),
      listNudges(kidIds, { openOnly: true }),
      listPendingLevelRequests(kidIds),
    ]);
    if (tasks === null || redemptions === null || selfDirected === null || nudges === null || requests === null) {
      return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the decisions waiting for you');
    }
    const waitingRewards = redemptions.filter((r) => r.status === 'requested');
    const [reviewed, items, childAsks] = await Promise.all([
      reviewedIds(selfDirected.map((d) => d.id)),
      catalogItems(waitingRewards.map((r) => r.catalog_id)),
      Promise.all(nudges.filter((n) => n.decision_id).map((n) => getDecision(n.decision_id!))),
    ]);
    if (reviewed === null || items === null || childAsks.some((d) => d === UNAVAILABLE)) {
      return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the decisions waiting for you');
    }
    const toReview = selfDirected.filter((d) => !reviewed.has(d.id));
    const nudgeDecisions = childAsks.filter((d): d is DecisionRow => d !== null && d !== UNAVAILABLE);
    const titles = await subjectTitles([...toReview, ...nudgeDecisions]);
    if (titles === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the decisions waiting for you');
    const decisionById = new Map(nudgeDecisions.map((d) => [d.id, d]));
    const titleOf = (d: DecisionRow) => titles.get(d.task_id ?? d.redemption_id ?? '') ?? null;
    return ok(res, {
      chores: tasks.filter((t) => t.status === 'done').map(toWireTask),
      openChores: tasks.filter((t) => t.status === 'open').map(toWireTask),
      rewards: waitingRewards.map((r) => ({ ...toWireRedemption(r), title: items.get(r.catalog_id)?.title ?? null, cost: items.get(r.catalog_id)?.cost ?? null })),
      reviews: toReview.map((d) => ({ ...toWireDecision(d, parent.id, titleOf(d)), kidUserId: d.kid_user_id })),
      nudges: nudges.map((n) => {
        const d = n.decision_id ? decisionById.get(n.decision_id) : undefined;
        return { ...toWireNudge(n), decision: d ? toWireDecision(d, parent.id, titleOf(d)) : null };
      }),
      levelRequests: requests.map((r) => ({ id: r.id, kidUserId: r.kid_user_id, level: r.requested_level, note: r.child_note, createdAt: r.created_at })),
    });
  });

  const ReviewBody = z
    .object({ outcome: z.enum(['confirmed', 'questioned']), reasonCode: z.enum(TASK_REASON_CODES).or(z.enum(REWARD_REASON_CODES)).nullable().optional(), reason: ReasonText.nullable().optional() })
    .strict();

  router.post('/decisions/:id/review', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const reviewed = await getDecision(id.data);
    if (reviewed === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the decision');
    if (!reviewed || !['self_logged', 'preapproved'].includes(reviewed.outcome)) return fail(res, 404, NOT_FOUND, 'No such decision');
    if (!(await guardParentOf(reviewed.kid_user_id, res, parent.id))) return;
    if (raw.outcome === 'questioned') {
      const problem = notYetProblem(raw, reviewed.subject === 'task' ? TASK_REASON_CODES : REWARD_REASON_CODES.filter((c) => c !== 'later_date'));
      if (problem) return decisionRefusal(res, problem, 'Check the reason');
    }
    const body = ReviewBody.safeParse(raw);
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'Say whether it looks good, or why not');
    const result = await reviewDecision({
      decisionId: id.data, actorId: parent.id, outcome: body.data.outcome,
      reasonCode: body.data.outcome === 'questioned' ? body.data.reasonCode : null,
      reason: body.data.outcome === 'questioned' ? body.data.reason?.trim() : null,
    });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the review');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'The review was refused');
    await insertAuditLog(parent.id, `tasks.self_directed_${result}`, id.data, {});
    return ok(res, { outcome: result });
  });

  const CloseNudge = z.object({ outcome: z.enum(['talked', 'dismissed']) }).strict();

  router.post('/nudges/:id/close', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const body = CloseNudge.safeParse(req.body ?? {});
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'outcome must be talked or dismissed');
    const kidId = await getNudgeKid(id.data);
    if (kidId === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the nudge');
    if (!kidId) return fail(res, 404, NOT_FOUND, 'No such nudge');
    if (!(await guardParentOf(kidId, res, parent.id))) return;
    const result = await closeTalk(id.data, parent.id, body.data.outcome);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not close the nudge');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'The nudge could not be closed');
    return ok(res, { status: result });
  });

  // ── S07.5 (D.18): the child's own decisions, and "let's talk" ─────────────
  router.get('/decisions/mine', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const [decisions, asks] = await Promise.all([
      listDecisions([kid.id], { sinceDays: 60, limit: 30 }),
      listNudges([kid.id], { openOnly: false, sinceDays: 60 }),
    ]);
    if (decisions === null || asks === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your decisions');
    const titles = await subjectTitles(decisions);
    if (titles === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your decisions');
    const asked = new Map(asks.filter((n) => n.origin === 'child' && n.decision_id).map((n) => [n.decision_id!, n.status]));
    return ok(res, {
      decisions: decisions.map((d) => ({
        ...toWireDecision(d, kid.id, titles.get(d.task_id ?? d.redemption_id ?? '') ?? null),
        notYet: NOT_YET_OUTCOMES.includes(d.outcome),
        talk: asked.get(d.id) ?? null,
      })),
    });
  });

  router.post('/decisions/:id/talk', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    const decision = await getDecision(id.data);
    if (decision === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the decision');
    if (!decision || decision.kid_user_id !== kid.id) return fail(res, 404, NOT_FOUND, 'No such decision');
    const result = await requestTalk(kid.id, id.data);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not send it');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'It could not be sent');
    return ok(res, { nudgeId: result }, 201);
  });

  // ── S07.5 (D.17): the independence ladder ─────────────────────────────────
  router.get('/autonomy', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const [status, changes] = await Promise.all([readAutonomyStatus(kid.id), listAutonomyChanges(kid.id, 5)]);
    if (!status || changes === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your level');
    return ok(res, { autonomy: toWireAutonomy(status), changes: changes.map((c) => toWireChange(c, kid.id)) });
  });

  const AskLevel = z.object({ note: ChildNote }).strict();

  router.post('/autonomy/request', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const body = AskLevel.safeParse(req.body ?? {});
    if (!body.success) return decisionRefusal(res, 'AUTONOMY_REQUEST_INVALID', 'Check the request');
    const result = await requestLevel(kid.id, body.data.note?.trim() || null);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not send your request');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'The request was refused');
    return ok(res, { requestId: result }, 201);
  });

  router.post('/autonomy/step-down', familyChild, async (req, res) => {
    const kid = authedUser(res);
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    const result = await stepDownAutonomy(kid.id);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not change your level');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'The change was refused');
    return ok(res, { level: result });
  });

  router.get('/:kidId/autonomy', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const [status, changes] = await Promise.all([readAutonomyStatus(kidId.data), listAutonomyChanges(kidId.data, 10)]);
    if (!status || changes === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the level');
    return ok(res, { autonomy: toWireAutonomy(status), changes: changes.map((c) => toWireChange(c, parent.id)) });
  });

  /*
   * A Tutor moves a level: up only when the documented rule says eligible
   * (the database checks it), down only with a reason code and an
   * actionable reason, and sets the pre-approved amount within the level's
   * cap. The same call changes only the amount when the level stays.
   */
  const SetLevel = z
    .object({
      level: z.number().int().min(1).max(3),
      preapprovedLimit: z.number().int().min(0).max(PREAPPROVED_CAP[3]),
      reasonCode: z.enum(LEVEL_LOWER_REASON_CODES).nullable().optional(),
      reason: ReasonText.nullable().optional(),
    })
    .strict();

  router.put('/:kidId/autonomy', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const body = SetLevel.safeParse(req.body ?? {});
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'A level from 1 to 3 and a pre-approved amount are required');
    if (body.data.preapprovedLimit > PREAPPROVED_CAP[body.data.level as 1 | 2 | 3]) return decisionRefusal(res, 'AUTONOMY_LIMIT_INVALID', 'Check the amount');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const current = await readAutonomyStatus(kidId.data);
    if (!current) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the level');
    const lowering = body.data.level < current.stored_level;
    if (lowering && (!body.data.reasonCode || !reasonActionable(body.data.reason))) return decisionRefusal(res, 'AUTONOMY_REASON_REQUIRED', 'Say why');
    if (!lowering && (body.data.reasonCode || body.data.reason)) return decisionRefusal(res, 'AUTONOMY_REASON_INVALID', 'No reason is given here');
    const result = await setAutonomy({
      kidId: kidId.data, actorId: parent.id, level: body.data.level, limit: body.data.preapprovedLimit,
      reasonCode: lowering ? body.data.reasonCode : null, reason: lowering ? body.data.reason?.trim() : null,
    });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not change the level');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'The change was refused');
    await insertAuditLog(parent.id, 'tasks.autonomy_set', kidId.data, { level: body.data.level, preapprovedLimit: body.data.preapprovedLimit });
    const status = await readAutonomyStatus(kidId.data);
    return ok(res, { level: result, autonomy: status ? toWireAutonomy(status) : null });
  });

  const DecideLevelRequest = z
    .object({
      grant: z.boolean(),
      preapprovedLimit: z.number().int().min(0).max(PREAPPROVED_CAP[3]).nullable().optional(),
      reasonCode: z.enum(LEVEL_REQUEST_REASON_CODES).nullable().optional(),
      reason: ReasonText.nullable().optional(),
      revisitOn: RevisitOn.nullable().optional(),
    })
    .strict();

  router.post('/autonomy/requests/:id/decide', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const raw = (req.body ?? {}) as Record<string, unknown>;
    if (raw.grant === false) {
      const problem = notYetProblem(raw, LEVEL_REQUEST_REASON_CODES);
      if (problem) return decisionRefusal(res, problem, 'Check the reason');
    }
    const body = DecideLevelRequest.safeParse(raw);
    if (!body.success) return fail(res, 400, 'VALIDATION_ERROR', 'grant must be a boolean, with a reason for "not yet"');
    const kidId = await getLevelRequestKid(id.data);
    if (kidId === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the request');
    if (!kidId) return fail(res, 404, NOT_FOUND, 'No such request');
    if (!(await guardParentOf(kidId, res, parent.id))) return;
    const result = await decideLevelRequest({
      requestId: id.data, actorId: parent.id, grant: body.data.grant,
      limit: body.data.grant ? body.data.preapprovedLimit ?? 0 : null,
      reasonCode: body.data.grant ? null : body.data.reasonCode,
      reason: body.data.grant ? null : body.data.reason?.trim(),
      revisitOn: body.data.grant ? null : body.data.revisitOn,
    });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the answer');
    if (isRefusal(result)) return decisionRefusal(res, result.refused, 'The answer was refused');
    await insertAuditLog(parent.id, `tasks.autonomy_request_${result}`, id.data, {});
    return ok(res, { status: result });
  });

  return router;
}
