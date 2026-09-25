import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth } from '../middleware/auth.js';
import { requireWalletAccess, resolveWalletAccess } from '../middleware/walletAccess.js';
import { getGoalById, getGoalProgress, insertAuditLog } from '../services/supabaseRest.js';
import { getDisplayNames } from '../services/familyLifecycle.js';
import {
  archivePersonalReward,
  claimPersonalReward,
  createPersonalReward,
  createTeenGuardianInvite,
  INCOME_SOURCES,
  isFamilyChild,
  isRefusal,
  listPersonalRewards,
  listTeenLinks,
  logIncome,
  releaseGoal,
  teenDecideGuardianLink,
  UNAVAILABLE,
  type PersonalRewardRow,
} from '../services/teenWallet.js';

/*
 * /api/v1/wallet — S07.2, D.3 (OD-3 Option B): the self-registered teen's
 * personal wallet. The teen logs income and splits it across Save/Spend/Share
 * in one step, keeps a personal reward list and marks a reward for
 * themselves, moves coins out of their own goal, and may invite a parent
 * later. There is no approval step anywhere here. Balances, history and
 * savings goals are the SAME endpoints a parent-created child uses
 * (/api/v1/tasks/wallet, /wallet/ledger, /goals), admitted for every wallet
 * holder, so nothing about the teen's wallet lives in a second system that a
 * later family link would have to migrate.
 *
 * Admission is by age at the server (requireWalletAccess('teen'), which
 * mirrors the database's wallet_holder_kind()); every write is a database
 * function that re-checks eligibility, the linked guardian's freeze and
 * spend limit, balances and ownership, and audits.
 */

const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';

const REFUSALS: Record<string, { status: number; message: string }> = {
  TEEN_WALLET_REQUIRED: { status: 403, message: 'This wallet is for teens who manage their own account' },
  ACCOUNT_FROZEN: { status: 409, message: 'This account is frozen; the operation is on hold' },
  SPEND_LIMIT_REACHED: { status: 409, message: 'This would go over the spending limit' },
  INSUFFICIENT_BALANCE: { status: 409, message: 'Not enough coins in that pocket' },
  GOAL_BALANCE_INSUFFICIENT: { status: 409, message: 'The goal does not hold that many coins' },
  GOAL_NOT_ACTIVE: { status: 409, message: 'That goal is not active' },
  GOAL_NOT_FOUND: { status: 404, message: 'No such goal' },
  PERSONAL_REWARD_UNAVAILABLE: { status: 404, message: 'No such reward' },
  PERSONAL_REWARD_NOT_FOUND: { status: 404, message: 'No such reward' },
  PERSONAL_REWARD_LIMIT: { status: 409, message: 'Archive a reward before adding another' },
  PERSONAL_REWARD_INVALID: { status: 400, message: 'Check the reward name and cost' },
  SELF_INCOME_INVALID: { status: 400, message: 'Check the amount, the source and the split' },
  GOAL_RELEASE_INVALID: { status: 400, message: 'Check the amount and where the coins go' },
  GUARDIAN_LINK_NOT_FOUND: { status: 404, message: 'No such parent request' },
  GUARDIAN_LINK_NOT_PENDING: { status: 409, message: 'This request was already decided' },
  GUARDIAN_INVITE_LIMIT: { status: 409, message: 'Three invites are already waiting' },
};

function refuse(res: Parameters<typeof fail>[0], refused: string) {
  const mapped = REFUSALS[refused];
  return mapped ? fail(res, mapped.status, refused, mapped.message) : fail(res, 409, 'CONFLICT', 'The wallet refused this action');
}

function toWireReward(r: PersonalRewardRow) {
  return { id: r.id, title: r.title, cost: r.cost, status: r.status, createdAt: r.created_at, archivedAt: r.archived_at };
}

async function wireGoal(goalId: string) {
  const [goal, saved] = await Promise.all([getGoalById(goalId), getGoalProgress(goalId)]);
  if (!goal || saved === null) return null;
  return { id: goal.id, title: goal.title, target: goal.target, icon: goal.icon, status: goal.status, reachedAt: goal.reached_at, saved };
}

export function walletRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  /*
   * What this account's wallet is, for the client to decide what to show.
   * Every signed-in account may ask; an adult learns only that it has none.
   */
  router.get('/access', async (_req, res) => {
    const access = await resolveWalletAccess(res).catch(() => null);
    if (!access) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check wallet access');
    return ok(res, { holder: access.kind, familyChild: access.kind !== null && isFamilyChild(access) });
  });

  const teen = requireWalletAccess('teen');

  // ── Logged income: split in the same step, no approval ─────────────────
  const LogIncome = z.object({
    source: z.enum(INCOME_SOURCES),
    save: z.number().int().min(0).max(1000),
    spend: z.number().int().min(0).max(1000),
    share: z.number().int().min(0).max(1000),
    goalId: z.string().uuid().nullable().optional(),
  }).strict()
    .refine((v) => v.save + v.spend + v.share >= 1 && v.save + v.spend + v.share <= 1000, 'The split must add up to 1 to 1000 coins')
    .refine((v) => !v.goalId || v.save > 0, 'A goal needs coins in Save');

  router.post('/income', teen, async (req, res) => {
    const parsed = LogIncome.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the amount, the source and the split');
    const me = authedUser(res).id;
    const goalId = parsed.data.goalId ?? null;
    const result = await logIncome({ holderId: me, source: parsed.data.source, save: parsed.data.save, spend: parsed.data.spend, share: parsed.data.share, goalId });
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the income');
    if (isRefusal(result)) return refuse(res, result.refused);
    // The coins are already credited; the goal read is informational and never
    // turns a landed income into a reported failure.
    const goal = goalId ? await wireGoal(goalId) : null;
    return ok(res, { actionId: result, goal }, 201);
  });

  // ── Personal rewards (in place of a parent-curated catalog) ────────────
  router.get('/rewards', teen, async (_req, res) => {
    const rewards = await listPersonalRewards(authedUser(res).id);
    if (rewards === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your rewards');
    return ok(res, { rewards: rewards.map(toWireReward) });
  });

  const CreateReward = z.object({ title: z.string().trim().min(1).max(60), cost: z.number().int().min(1).max(500) }).strict();

  router.post('/rewards', teen, async (req, res) => {
    const parsed = CreateReward.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the reward name and cost');
    const result = await createPersonalReward(authedUser(res).id, parsed.data.title, parsed.data.cost);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the reward');
    if (isRefusal(result)) return refuse(res, result.refused);
    return ok(res, { rewardId: result }, 201);
  });

  const RewardId = z.string().uuid();

  router.post('/rewards/:id/claim', teen, async (req, res) => {
    const id = RewardId.safeParse(req.params.id);
    if (!id.success || Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid and no body is accepted');
    const result = await claimPersonalReward(authedUser(res).id, id.data);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not use the reward');
    if (isRefusal(result)) return refuse(res, result.refused);
    return ok(res, { actionId: result }, 201);
  });

  router.post('/rewards/:id/archive', teen, async (req, res) => {
    const id = RewardId.safeParse(req.params.id);
    if (!id.success || Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid and no body is accepted');
    const result = await archivePersonalReward(authedUser(res).id, id.data);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not archive the reward');
    if (isRefusal(result)) return refuse(res, result.refused);
    return ok(res, { archived: result });
  });

  // ── Coins out of the teen's own goal ───────────────────────────────────
  const Release = z.object({ amount: z.number().int().min(1).max(1000), destination: z.enum(['save', 'spend']) }).strict();

  router.post('/goals/:id/release', teen, async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    const parsed = Release.safeParse(req.body);
    if (!id.success || !parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the amount and where the coins go');
    const result = await releaseGoal(authedUser(res).id, id.data, parsed.data.amount, parsed.data.destination);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not move the coins');
    if (isRefusal(result)) return refuse(res, result.refused);
    return ok(res, { actionId: result, goal: await wireGoal(id.data) }, 201);
  });

  // ── Inviting a parent later (optional, teen-initiated) ─────────────────
  router.post('/guardian-invite', teen, async (req, res) => {
    if (Object.keys(req.body ?? {}).length > 0) return fail(res, 400, 'VALIDATION_ERROR', 'No body is accepted');
    const me = authedUser(res).id;
    const invite = await createTeenGuardianInvite(me);
    if (invite === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not create the invite');
    if (isRefusal(invite)) return refuse(res, invite.refused);
    await insertAuditLog(me, 'family.teen_guardian_invite_created', me, {});
    return ok(res, { token: invite.token, expiresAt: invite.expiresAt }, 201);
  });

  router.get('/guardians', teen, async (_req, res) => {
    const me = authedUser(res).id;
    const links = await listTeenLinks(me);
    if (links === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your parents');
    const names = await getDisplayNames(links.map((l) => l.parent_user_id));
    if (names === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your parents');
    return ok(res, {
      guardians: links.map((l) => ({
        linkId: l.id,
        displayName: names.get(l.parent_user_id) ?? null,
        status: l.verification_status,
        since: l.verified_at ?? l.created_at,
        decidedAt: l.decided_at,
        // Only a link from the teen's OWN invite is the teen's to decide.
        awaitingMe: l.verification_status === 'pending' && l.selfInvited,
      })),
    });
  });

  const Decision = z.object({ decision: z.enum(['confirm', 'reject']) }).strict();

  router.post('/guardians/:linkId/decision', teen, async (req, res) => {
    const linkId = z.string().uuid().safeParse(req.params.linkId);
    const parsed = Decision.safeParse(req.body);
    if (!linkId.success || !parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'decision must be confirm or reject');
    const result = await teenDecideGuardianLink(linkId.data, authedUser(res).id, parsed.data.decision === 'confirm');
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the decision');
    if (isRefusal(result)) return refuse(res, result.refused);
    return ok(res, { linkId: linkId.data, status: result });
  });

  return router;
}
