import { requireUnfrozenBanking } from '../middleware/bankingFreeze.js';
import { requireWalletAccess } from '../middleware/walletAccess.js';
import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser, requireAuth, requireRole } from '../middleware/auth.js';
import {
  allocatePendingCredit,
  getAllowanceRule,
  getBankingAccount,
  getPendingCreditById,
  getPendingCreditsForKid,
  getSavingsBonusRule,
  getSpendLimit,
  getSpendUsedThisPeriod,
  getVerifiedKidLinks,
  getWalletLedgerInRange,
  insertAuditLog,
  insertBankingAccount,
  runDueScheduledCredits,
  setBankingAccountFrozen,
  updateBankingAccount,
  upsertAllowanceRule,
  upsertSavingsBonusRule,
  upsertSpendLimit,
  type AllowanceRuleRow,
  type BankingAccountRow,
  type PendingCreditRow,
  type SavingsBonusRuleRow,
  type SpendLimitRow,
  type WalletLedgerRow,
} from '../services/supabaseRest.js';
import { getGuardianActionsByIds, type GuardianActionRow } from '../services/familyLifecycle.js';

/*
 * /api/v1/banking — BANKING.md's presentation-and-mechanics layer over
 * FAMILY_HUB.md's wallet_ledger: a named account + card, automated
 * allowance, a "Parent-Paid" savings bonus, and a spend limit. Same router
 * shape as routes/tasks.ts on purpose (requireAuth at the router,
 * requireRole per route) — a kid reads their own account, a parent reads
 * and configures a verified kid's. `family_gifts` (BANKING.md §5.7) is
 * NOT here yet — see that file's Wave tracking.
 *
 * Language discipline (BANKING.md §4, NON-NEGOTIABLE): nothing this
 * router returns or the frontend built on it may say "bank account,"
 * "interest," "APY," or "FDIC-insured." There is no real money here to
 * protect or grow — only LF Coins, same as FAMILY_HUB.md's economy.
 */

const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
const NOT_FOUND = 'NOT_FOUND';
const CONFLICT = 'CONFLICT';

const CARD_DESIGNS = ['indigo', 'emerald', 'violet', 'amber', 'sunrise', 'ocean'] as const;
const MAX_ALLOWANCE_AMOUNT = 1000;
const MAX_BONUS_RATE_BP = 2000; // 20%

/**
 * The next occurrence of `anchorDay` at/after `from` (UTC calendar days —
 * this is a gamified schedule, not a payroll system, so no timezone
 * precision is owed). `weekly`/`biweekly` share the same "next matching
 * weekday" first occurrence — biweekly's actual 14-day cadence is enforced
 * by 0081's `run_due_scheduled_credits`, which steps every SUBSEQUENT
 * occurrence by 14 days from there, not by this function again.
 */
export function computeNextRunAt(frequency: 'weekly' | 'biweekly' | 'monthly', anchorDay: number, from: Date): Date {
  const today = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  if (frequency === 'monthly') {
    const year = today.getUTCFullYear();
    let month = today.getUTCMonth();
    let candidate = new Date(Date.UTC(year, month, anchorDay));
    if (candidate.getTime() < today.getTime()) {
      month += 1;
      candidate = new Date(Date.UTC(year, month, anchorDay));
    }
    return candidate;
  }
  const currentDow = today.getUTCDay();
  const deltaDays = (anchorDay - currentDow + 7) % 7;
  return new Date(today.getTime() + deltaDays * 24 * 60 * 60 * 1000);
}

function toWireAccount(a: BankingAccountRow) {
  return {
    nickname: a.nickname,
    cardDesign: a.card_design,
    displayNumber: a.display_number,
    frozen: a.frozen,
    frozenBy: a.frozen_by,
    frozenAt: a.frozen_at,
    openedAt: a.opened_at,
  };
}

function toWireAllowanceRule(r: AllowanceRuleRow) {
  return { amount: r.amount, frequency: r.frequency, anchorDay: r.anchor_day, active: r.active, nextRunAt: r.next_run_at };
}

function toWireSavingsBonusRule(r: SavingsBonusRuleRow) {
  return { rateBp: r.rate_bp, active: r.active, nextRunAt: r.next_run_at };
}

function toWirePendingCredit(c: PendingCreditRow) {
  return { id: c.id, amount: c.amount, source: c.source, createdAt: c.created_at };
}

function toWireLedgerEntry(e: WalletLedgerRow, actions: Map<string, GuardianActionRow>) {
  const note = e.guardian_action_id ? actions.get(e.guardian_action_id)?.reason ?? null : null;
  return { id: e.id, bucket: e.bucket, amount: e.amount, reason: e.reason, taskId: e.task_id, goalId: e.goal_id, note, createdAt: e.created_at };
}

async function spendLimitStatus(kidId: string, limit: SpendLimitRow | null) {
  if (!limit || !limit.active) return { configured: false as const };
  const used = await getSpendUsedThisPeriod(kidId, limit.period);
  if (used === null) return null;
  return { configured: true as const, period: limit.period, cap: limit.cap, used, remaining: Math.max(0, limit.cap - used) };
}

const MonthQuery = z
  .object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM').optional() })
  .strict();

function monthRange(month?: string): { fromISO: string; toISO: string; label: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let mo = now.getUTCMonth() + 1;
  if (month) {
    const parts = month.split('-');
    year = Number(parts[0]);
    mo = Number(parts[1]);
  }
  const from = new Date(Date.UTC(year, mo - 1, 1));
  const to = new Date(Date.UTC(mo === 12 ? year + 1 : year, mo === 12 ? 0 : mo, 1));
  return { fromISO: from.toISOString(), toISO: to.toISOString(), label: `${year}-${String(mo).padStart(2, '0')}` };
}

async function buildStatement(kidId: string, month?: string) {
  const { fromISO, toISO, label } = monthRange(month);
  const entries = await getWalletLedgerInRange(kidId, fromISO, toISO);
  if (entries === null) return null;
  const actions = await getGuardianActionsByIds(entries.flatMap((e) => (e.guardian_action_id ? [e.guardian_action_id] : [])));
  if (actions === null) return null;
  // S07.1: a goal withdrawal is a transfer between the child's own buckets,
  // never income or spending; a guardian correction is reported on its own
  // line ("adjusted") so it can never pass for coins the child earned or spent.
  let earned = 0;
  let spent = 0;
  let adjusted = 0;
  for (const e of entries) {
    // S07.2: a teen moving coins out of their own goal is a transfer too.
    if (e.reason === 'goal_withdrawal' || e.reason === 'goal_release') continue;
    if (e.reason === 'manual_adjustment') adjusted += e.amount;
    else if (e.amount >= 0) earned += e.amount;
    else spent += -e.amount;
  }
  const saved = entries.filter((e) => e.bucket === 'save').reduce((sum, e) => sum + e.amount, 0);
  return { month: label, earned, spent, adjusted, saved, entries: entries.map((e) => toWireLedgerEntry(e, actions)) };
}

export function bankingRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  /** Verifies the caller (a parent) is a verified guardian of `kidId`. Same shape as routes/tasks.ts's own guardParentOf — kept local to this router per that file's own precedent (each router owns its guards). */
  async function guardParentOf(kidId: string, res: Parameters<typeof fail>[0], parentId: string): Promise<boolean> {
    const links = await getVerifiedKidLinks(parentId);
    if (links === null) {
      fail(res, 502, DATA_UNAVAILABLE, 'Could not load family links');
      return false;
    }
    if (!links.some((l) => l.kid_user_id === kidId)) {
      fail(res, 404, NOT_FOUND, 'No such child for this account');
      return false;
    }
    return true;
  }

  // ── PARENT: account ──────────────────────────────────────────────────────

  const OpenAccount = z
    .object({
      nickname: z.string().trim().min(1).max(40).default('My Account'),
      cardDesign: z.enum(CARD_DESIGNS).default('indigo'),
    })
    .strict();

  router.post('/accounts/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = OpenAccount.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the account details');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;

    const existing = await getBankingAccount(kidId.data);
    if (existing === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check for an existing account');
    if (existing !== null) return fail(res, 409, CONFLICT, 'This account is already open');

    const account = await insertBankingAccount({
      kid_user_id: kidId.data,
      nickname: parsed.data.nickname,
      card_design: parsed.data.cardDesign,
      opened_by: parent.id,
    });
    if (!account) return fail(res, 502, DATA_UNAVAILABLE, 'Could not open the account');
    await insertAuditLog(parent.id, 'banking.account_opened', kidId.data, {});
    return ok(res, { account: toWireAccount(account) }, 201);
  });

  router.get('/accounts/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;

    await runDueScheduledCredits(kidId.data); // best-effort — a late allowance is a UX delay, not a failed request
    const account = await getBankingAccount(kidId.data);
    if (account === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the account');
    return ok(res, { account: account ? toWireAccount(account) : null });
  });

  const UpdateAccount = z.object({ nickname: z.string().trim().min(1).max(40).optional(), cardDesign: z.enum(CARD_DESIGNS).optional() }).strict();

  router.patch('/accounts/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = UpdateAccount.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the account details');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;

    const account = await updateBankingAccount(kidId.data, { nickname: parsed.data.nickname, card_design: parsed.data.cardDesign });
    if (!account) return fail(res, 404, NOT_FOUND, 'No account to update yet');
    return ok(res, { account: toWireAccount(account) });
  });

  const SetFrozen = z.object({ frozen: z.boolean() }).strict();

  router.post('/accounts/:kidId/freeze', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = SetFrozen.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'frozen must be a boolean');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;

    const account = await setBankingAccountFrozen(kidId.data, parsed.data.frozen, parent.id);
    if (!account) return fail(res, 404, NOT_FOUND, 'No account to freeze yet');
    await insertAuditLog(parent.id, parsed.data.frozen ? 'banking.frozen' : 'banking.unfrozen', kidId.data, {});
    return ok(res, { account: toWireAccount(account) });
  });

  // ── PARENT: allowance / spend limit / savings bonus config ─────────────

  const SetAllowance = z
    .object({
      amount: z.number().int().min(1).max(MAX_ALLOWANCE_AMOUNT),
      frequency: z.enum(['weekly', 'biweekly', 'monthly']),
      anchorDay: z.number().int().min(0).max(28),
      active: z.boolean().default(true),
    })
    .strict()
    .refine((v) => v.frequency === 'monthly' || v.anchorDay <= 6, 'anchorDay must be 0-6 for weekly/biweekly')
    .refine((v) => v.frequency !== 'monthly' || v.anchorDay >= 1, 'anchorDay must be 1-28 for monthly');

  router.get('/allowance/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const rule = await getAllowanceRule(kidId.data);
    if (rule === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the allowance rule');
    return ok(res, { rule: rule ? toWireAllowanceRule(rule) : null });
  });

  router.put('/allowance/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = SetAllowance.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the allowance details');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const account = await getBankingAccount(kidId.data);
    if (account === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check the account');
    if (account === null) return fail(res, 409, CONFLICT, 'Open the account before setting up an allowance');

    const rule = await upsertAllowanceRule({
      kid_user_id: kidId.data,
      parent_user_id: parent.id,
      amount: parsed.data.amount,
      frequency: parsed.data.frequency,
      anchor_day: parsed.data.anchorDay,
      active: parsed.data.active,
      next_run_at: computeNextRunAt(parsed.data.frequency, parsed.data.anchorDay, new Date()).toISOString(),
    });
    if (!rule) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the allowance rule');
    await insertAuditLog(parent.id, 'banking.allowance_set', kidId.data, { amount: parsed.data.amount, frequency: parsed.data.frequency });
    return ok(res, { rule: toWireAllowanceRule(rule) });
  });

  const SetSpendLimit = z.object({ period: z.enum(['weekly', 'monthly']), cap: z.number().int().min(1), active: z.boolean().default(true) }).strict();

  router.get('/spend-limit/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const limit = await getSpendLimit(kidId.data);
    if (limit === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the spend limit');
    const status = await spendLimitStatus(kidId.data, limit);
    if (status === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not compute spend used this period');
    return ok(res, { status });
  });

  router.put('/spend-limit/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = SetSpendLimit.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the spend limit');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const account = await getBankingAccount(kidId.data);
    if (account === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check the account');
    if (account === null) return fail(res, 409, CONFLICT, 'Open the account before setting a spend limit');

    const limit = await upsertSpendLimit({ kid_user_id: kidId.data, parent_user_id: parent.id, period: parsed.data.period, cap: parsed.data.cap, active: parsed.data.active });
    if (!limit) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the spend limit');
    await insertAuditLog(parent.id, 'banking.spend_limit_set', kidId.data, { period: parsed.data.period, cap: parsed.data.cap });
    const status = await spendLimitStatus(kidId.data, limit);
    return ok(res, { status: status ?? { configured: true, period: limit.period, cap: limit.cap, used: 0, remaining: limit.cap } });
  });

  const SetSavingsBonus = z.object({ rateBp: z.number().int().min(0).max(MAX_BONUS_RATE_BP), active: z.boolean().default(true) }).strict();

  router.get('/savings-bonus/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const rule = await getSavingsBonusRule(kidId.data);
    if (rule === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the savings bonus rule');
    return ok(res, { rule: rule ? toWireSavingsBonusRule(rule) : null });
  });

  router.put('/savings-bonus/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = SetSavingsBonus.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the savings bonus rate');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const account = await getBankingAccount(kidId.data);
    if (account === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check the account');
    if (account === null) return fail(res, 409, CONFLICT, 'Open the account before setting a savings bonus');

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rule = await upsertSavingsBonusRule({ kid_user_id: kidId.data, parent_user_id: parent.id, rate_bp: parsed.data.rateBp, active: parsed.data.active, next_run_at: nextWeek.toISOString() });
    if (!rule) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the savings bonus rule');
    await insertAuditLog(parent.id, 'banking.savings_bonus_set', kidId.data, { rateBp: parsed.data.rateBp });
    return ok(res, { rule: toWireSavingsBonusRule(rule) });
  });

  router.get('/statement/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const q = MonthQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'month must be YYYY-MM');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const statement = await buildStatement(kidId.data, q.data.month);
    if (!statement) return fail(res, 502, DATA_UNAVAILABLE, 'Could not build the statement');
    return ok(res, { statement });
  });

  // ── CHILD IN A FAMILY: own account ──────────────────────────────────────
  // S07.2 (D.3): a parent-created child, or a teen who linked a verified
  // parent (the account, allowance, bonus and limit are guardian-set, so an
  // unlinked teen has none). The monthly statement is admitted for every
  // wallet holder, the independent teen included.
  const familyChild = requireWalletAccess('familyChild');
  const walletHolder = requireWalletAccess('holder');


  router.get('/account', familyChild, async (req, res) => {
    const kid = authedUser(res);
    await runDueScheduledCredits(kid.id); // best-effort catch-up, same as the parent read above
    const account = await getBankingAccount(kid.id);
    if (account === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the account');
    return ok(res, { account: account ? toWireAccount(account) : null });
  });

  router.patch('/account', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const parsed = UpdateAccount.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the account details');
    const account = await updateBankingAccount(kid.id, { nickname: parsed.data.nickname, card_design: parsed.data.cardDesign });
    if (!account) return fail(res, 404, NOT_FOUND, 'No account to update yet');
    return ok(res, { account: toWireAccount(account) });
  });

  router.post('/account/freeze', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const parsed = SetFrozen.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'frozen must be a boolean');
    const existing = await getBankingAccount(kid.id);
    if (existing === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not verify freeze ownership');
    if (!existing) return fail(res, 404, NOT_FOUND, 'No account to freeze yet');
    if (existing.frozen && existing.frozen_by !== kid.id) {
      return fail(res, 403, 'GUARDIAN_FREEZE', 'Only your guardian can change this freeze');
    }
    const account = await setBankingAccountFrozen(kid.id, parsed.data.frozen, kid.id);
    if (!account) return fail(res, 409, 'FREEZE_CHANGED', 'The account changed; reload before trying again');
    await insertAuditLog(kid.id, parsed.data.frozen ? 'banking.frozen' : 'banking.unfrozen', kid.id, {});
    return ok(res, { account: toWireAccount(account) });
  });

  router.get('/allowance', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const rule = await getAllowanceRule(kid.id);
    if (rule === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the allowance rule');
    return ok(res, { rule: rule ? toWireAllowanceRule(rule) : null });
  });

  router.get('/spend-limit', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const limit = await getSpendLimit(kid.id);
    if (limit === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the spend limit');
    const status = await spendLimitStatus(kid.id, limit);
    if (status === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not compute spend used this period');
    return ok(res, { status });
  });

  router.get('/savings-bonus', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const rule = await getSavingsBonusRule(kid.id);
    if (rule === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the savings bonus rule');
    return ok(res, { rule: rule ? toWireSavingsBonusRule(rule) : null });
  });

  router.get('/wallet/pending-credits', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const credits = await getPendingCreditsForKid(kid.id);
    if (credits === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load pending credits');
    return ok(res, { credits: credits.map(toWirePendingCredit) });
  });

  const AllocateCredit = z
    .object({ save: z.number().int().min(0), spend: z.number().int().min(0), share: z.number().int().min(0) })
    .strict()
    .refine((v) => v.save + v.spend + v.share > 0, 'Split must add up to more than zero');

  router.post('/wallet/pending-credits/:id/allocate', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return fail(res, 400, 'VALIDATION_ERROR', 'id must be a uuid');
    const parsed = AllocateCredit.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the split');
    const credit = await getPendingCreditById(id.data);
    if (!credit || credit.kid_user_id !== kid.id) return fail(res, 404, NOT_FOUND, 'No such credit');

    if (!await requireUnfrozenBanking(kid.id, res)) return;
    const allocated = await allocatePendingCredit({ creditId: id.data, kidId: kid.id, save: parsed.data.save, spend: parsed.data.spend, share: parsed.data.share, createdBy: kid.id });
    if (allocated === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not allocate the credit');
    if (allocated === false) return fail(res, 409, CONFLICT, 'This credit is not ready to allocate, or the split is invalid');
    return ok(res, { allocated: true });
  });

  router.get('/statement', walletHolder, async (req, res) => {
    const kid = authedUser(res);
    const q = MonthQuery.safeParse(req.query);
    if (!q.success) return fail(res, 400, 'VALIDATION_ERROR', 'month must be YYYY-MM');
    const statement = await buildStatement(kid.id, q.data.month);
    if (!statement) return fail(res, 502, DATA_UNAVAILABLE, 'Could not build the statement');
    return ok(res, { statement });
  });

  return router;
}
