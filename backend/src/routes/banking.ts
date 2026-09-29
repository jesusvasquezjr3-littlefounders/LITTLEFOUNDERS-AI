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
  getWalletBalances,
  getWalletLedgerInRange,
  insertAuditLog,
  insertBankingAccount,
  runDueScheduledCredits,
  setBankingAccountFrozen,
  updateBankingAccount,
  upsertAllowanceRule,
  upsertSpendLimit,
  type AllowanceRuleRow,
  type BankingAccountRow,
  type PendingCreditRow,
  type SavingsBonusRuleRow,
  type SpendLimitRow,
  type WalletLedgerRow,
} from '../services/supabaseRest.js';
import { getGuardianActionsByIds, isRefusal, UNAVAILABLE, type GuardianActionRow } from '../services/familyLifecycle.js';
import {
  BONUS_PER_TEN_COINS,
  BONUS_PER_TEN_RATE_BP,
  BONUS_PER_TEN_UNIT,
  MAX_BONUS_RATE_BP,
  nextBonus,
  readBonusFraming,
  readExampleProgress,
  recordExample,
  saveBonusRule,
  type BonusFraming,
} from '../services/savingsBonus.js';
import {
  FREEZE_HOLDS,
  freezeAuthor,
  presentSpendLimit,
  presentStatement,
  readMoneyRegister,
} from '../services/moneyPresentation.js';

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
    frozen: a.frozen,
    frozenBy: a.frozen_by,
    frozenAt: a.frozen_at,
    openedAt: a.opened_at,
  };
}

/*
 * S07.6 (D.7): the rebuilt account card. It is always declared a simulation,
 * carries no card number (a number laid out like a card's implies a real
 * card), and lists only what a freeze really holds (FREEZE_HOLDS, pinned to
 * the database by docs/operations/block-d-controls.json), whether or not the
 * account is frozen, so the explanation before a freeze is as honest as the
 * one during it. `by` is relative to the reader.
 */
function presentAccount(a: BankingAccountRow, readerId: string, childId: string) {
  const by = freezeAuthor(a.frozen, a.frozen_by, readerId, childId);
  const readerIsChild = readerId === childId;
  return {
    nickname: a.nickname,
    design: a.card_design,
    simulated: true as const,
    freeze: {
      frozen: a.frozen,
      by,
      since: a.frozen ? a.frozen_at : null,
      holds: [...FREEZE_HOLDS],
      // A child lifts only a freeze they set themselves (D.1); a Tutor always may.
      canChange: readerIsChild ? !a.frozen || by === 'you' : true,
    },
  };
}

function toWireAllowanceRule(r: AllowanceRuleRow) {
  return { amount: r.amount, frequency: r.frequency, anchorDay: r.anchor_day, active: r.active, nextRunAt: r.next_run_at };
}

function toWireSavingsBonusRule(r: SavingsBonusRuleRow) {
  // reframedFromRateBp (S07.3, D.11): the rate this rule had before it moved to
  // its child's age framing, until the Tutor's next save. The Tutor is told.
  return { rateBp: r.rate_bp, active: r.active, nextRunAt: r.next_run_at, reframedFromRateBp: r.reframed_from_rate_bp ?? null };
}

/** S07.3 (D.11): the framing and its fixed numbers, so a surface never re-derives the ratio. */
function toWireFraming(framing: BonusFraming) {
  return framing === 'per_ten'
    ? { framing, perTen: { unit: BONUS_PER_TEN_UNIT, coins: BONUS_PER_TEN_COINS }, maxRateBp: null }
    : { framing, perTen: null, maxRateBp: MAX_BONUS_RATE_BP };
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

/** How many months a child can page back through their own statement (this month included). */
export const STATEMENT_MONTHS_BACK = 24;

/** A real calendar month, not after this UTC month and not before the paging window. */
export function statementMonthAllowed(month: string, now = new Date()): boolean {
  const [year, mo] = month.split('-').map(Number) as [number, number];
  if (!Number.isInteger(year) || !Number.isInteger(mo) || mo < 1 || mo > 12) return false;
  const index = year * 12 + (mo - 1);
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return index <= current && index > current - STATEMENT_MONTHS_BACK;
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
  let given = 0;
  for (const e of entries) {
    // S07.2: a teen moving coins out of their own goal is a transfer too.
    if (e.reason === 'goal_withdrawal' || e.reason === 'goal_release') continue;
    // S07.4 (D.14): coins directed to a Share destination are given, never
    // spent; a returned pledge cancels its gift on the same line.
    if (e.reason === 'share_gift' || e.reason === 'share_gift_returned') given -= e.amount;
    else if (e.reason === 'manual_adjustment') adjusted += e.amount;
    else if (e.amount >= 0) earned += e.amount;
    else spent += -e.amount;
  }
  const saved = entries.filter((e) => e.bucket === 'save').reduce((sum, e) => sum + e.amount, 0);
  return { month: label, earned, spent, adjusted, given, saved, entries: entries.map((e) => toWireLedgerEntry(e, actions)) };
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

  /*
   * S07.6 (D.7, D.12): the Tutor's rebuilt freeze card. What a freeze holds
   * comes from the server, never from copy; the child's register lets the
   * Tutor see which presentation their child reads.
   */
  router.get('/accounts/:kidId/freeze', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const [account, register] = await Promise.all([getBankingAccount(kidId.data), readMoneyRegister(kidId.data)]);
    if (account === undefined || register === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the account');
    if (register === null) return fail(res, 409, 'WALLET_HOLDER_REQUIRED', 'This account has no wallet');
    return ok(res, { register, account: account ? presentAccount(account, parent.id, kidId.data) : null });
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

  /*
   * S07.3 (D.11): the bonus is framed by the child's age, never role. Under 13
   * (or no known birth date) it is "1 coin for every 10 saved, each week" and
   * the Tutor only switches it on or off; 13-17 it is the Tutor's 0-20% rate.
   * The database decides the framing, refuses a percentage for a younger
   * child on every write and credits by the framing at credit time.
   */
  const SetSavingsBonus = z
    .object({ rateBp: z.number().int().min(0).max(MAX_BONUS_RATE_BP).optional(), active: z.boolean().default(true) })
    .strict();
  const BONUS_REFUSALS: Record<string, { status: number; message: string }> = {
    SAVINGS_BONUS_FIXED_FOR_AGE: { status: 409, message: 'Under 13 the bonus is 1 coin for every 10 coins saved' },
    NOT_A_GUARDIAN: { status: 404, message: 'No such child for this account' },
    WALLET_HOLDER_REQUIRED: { status: 409, message: 'This account has no wallet' },
  };

  router.get('/savings-bonus/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const [rule, framing] = await Promise.all([getSavingsBonusRule(kidId.data), readBonusFraming(kidId.data)]);
    if (rule === undefined || framing === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the savings bonus rule');
    if (framing === null) return fail(res, 409, 'WALLET_HOLDER_REQUIRED', 'This account has no wallet');
    return ok(res, { rule: rule ? toWireSavingsBonusRule(rule) : null, ...toWireFraming(framing) });
  });

  router.put('/savings-bonus/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const parsed = SetSavingsBonus.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Check the savings bonus rate');
    if (!(await guardParentOf(kidId.data, res, parent.id))) return;
    const framing = await readBonusFraming(kidId.data);
    if (framing === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check the child\'s bonus framing');
    if (framing === null) return fail(res, 409, 'WALLET_HOLDER_REQUIRED', 'This account has no wallet');
    let rateBp: number;
    if (framing === 'per_ten') {
      if (parsed.data.rateBp !== undefined && parsed.data.rateBp !== BONUS_PER_TEN_RATE_BP) {
        return fail(res, 409, 'SAVINGS_BONUS_FIXED_FOR_AGE', BONUS_REFUSALS.SAVINGS_BONUS_FIXED_FOR_AGE!.message);
      }
      rateBp = BONUS_PER_TEN_RATE_BP;
    } else {
      if (parsed.data.rateBp === undefined) return fail(res, 400, 'VALIDATION_ERROR', 'Choose a weekly rate from 0% to 20%');
      rateBp = parsed.data.rateBp;
    }
    const account = await getBankingAccount(kidId.data);
    if (account === undefined) return fail(res, 502, DATA_UNAVAILABLE, 'Could not check the account');
    if (account === null) return fail(res, 409, CONFLICT, 'Open the account before setting a savings bonus');

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rule = await saveBonusRule({ kid_user_id: kidId.data, parent_user_id: parent.id, rate_bp: rateBp, active: parsed.data.active, next_run_at: nextWeek.toISOString() });
    if (rule === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save the savings bonus rule');
    if (isRefusal(rule)) {
      const mapped = BONUS_REFUSALS[rule.refused];
      return mapped ? fail(res, mapped.status, rule.refused, mapped.message) : fail(res, 409, CONFLICT, 'The savings bonus was refused');
    }
    await insertAuditLog(parent.id, 'banking.savings_bonus_set', kidId.data, { framing, rateBp, active: parsed.data.active });
    return ok(res, { rule: toWireSavingsBonusRule(rule), ...toWireFraming(framing) });
  });

  /*
   * GAP-FIX-R6 (OD-3 §2, Law 5, Block D monthly statements): a child's month
   * as their verified Tutor reads it on the Wallet screen. The Tutor is an
   * adult reader, so the statement keeps its full detail (every line with its
   * reason, a linked teen's self-directed entries included); the month is
   * bounded exactly like the child's own paging (never after this month, at
   * most STATEMENT_MONTHS_BACK months back).
   */
  router.get('/statement/:kidId', requireRole(['parent']), async (req, res) => {
    const parent = authedUser(res);
    const kidId = z.string().uuid().safeParse(req.params.kidId);
    if (!kidId.success) return fail(res, 400, 'VALIDATION_ERROR', 'kidId must be a uuid');
    const q = MonthQuery.safeParse(req.query);
    if (!q.success || (q.data.month !== undefined && !statementMonthAllowed(q.data.month))) {
      return fail(res, 400, 'VALIDATION_ERROR', `month must be YYYY-MM, this month or up to ${STATEMENT_MONTHS_BACK - 1} months before it`);
    }
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

  /*
   * S07.6 (D.7, D.12): the rebuilt coin account, in one read, shaped by the
   * child's age register at the server: the card (a declared simulation, no
   * card number), what a freeze really holds, the pockets, the spending limit
   * and this month, each with only the numbers that register's reader is
   * given. A failed read is 502, never a guessed register.
   */
  router.get('/overview', familyChild, async (req, res) => {
    const kid = authedUser(res);
    await runDueScheduledCredits(kid.id); // best-effort catch-up, same as GET /account
    const [register, account, balances, limit, credits] = await Promise.all([
      readMoneyRegister(kid.id), getBankingAccount(kid.id), getWalletBalances(kid.id), getSpendLimit(kid.id), getPendingCreditsForKid(kid.id),
    ]);
    if (register === UNAVAILABLE || account === undefined || balances === null || limit === undefined || credits === null) {
      return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the account');
    }
    if (register === null) return fail(res, 403, 'WALLET_UNAVAILABLE', 'This account has no wallet');
    const [status, statement] = await Promise.all([spendLimitStatus(kid.id, limit), buildStatement(kid.id)]);
    if (status === null || statement === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the account');
    return ok(res, {
      register,
      account: account ? presentAccount(account, kid.id, kid.id) : null,
      pockets: { save: balances.save, spend: balances.spend, share: balances.share },
      pendingCredits: credits.length,
      spendLimit: presentSpendLimit(register, status),
      statement: presentStatement(register, statement),
    });
  });

  /*
   * F5-K (W2F.3, OD-9): another month of the child's own statement, shaped by
   * the same register as the overview (D.12). Never a month after this one,
   * and at most STATEMENT_MONTHS_BACK months back; the month comes from the
   * query, the child and the register from the session and the database.
   */
  router.get('/overview/month', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const q = MonthQuery.safeParse(req.query);
    if (!q.success || !q.data.month || !statementMonthAllowed(q.data.month)) {
      return fail(res, 400, 'VALIDATION_ERROR', `month must be YYYY-MM, this month or up to ${STATEMENT_MONTHS_BACK - 1} months before it`);
    }
    const register = await readMoneyRegister(kid.id);
    if (register === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the account');
    if (register === null) return fail(res, 403, 'WALLET_UNAVAILABLE', 'This account has no wallet');
    const statement = await buildStatement(kid.id, q.data.month);
    if (!statement) return fail(res, 502, DATA_UNAVAILABLE, 'Could not build the statement');
    return ok(res, { register, statement: presentStatement(register, statement) });
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

  /*
   * S07.3 (D.11): the child's own bonus in their framing, with their own
   * numbers: what they have in Save now and what next week's bonus would add
   * (the same arithmetic the database's weekly credit uses). A 13-17 child
   * with a percentage bonus also gets the worked-example progress.
   */
  router.get('/savings-bonus', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const [rule, framing, balances] = await Promise.all([getSavingsBonusRule(kid.id), readBonusFraming(kid.id), getWalletBalances(kid.id)]);
    if (rule === undefined || framing === UNAVAILABLE || balances === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the savings bonus rule');
    if (framing === null) return fail(res, 403, 'WALLET_UNAVAILABLE', 'This account has no wallet');
    const active = rule !== null && rule.active && (framing === 'per_ten' || rule.rate_bp > 0);
    let example = null;
    if (framing === 'percent' && active) {
      example = await readExampleProgress(kid.id);
      if (example === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the savings bonus rule');
    }
    return ok(res, {
      rule: rule ? { rateBp: rule.rate_bp, active: rule.active, nextRunAt: rule.next_run_at } : null,
      ...toWireFraming(framing),
      saved: balances.save,
      nextBonus: active && rule ? nextBonus(framing, balances.save, rule.rate_bp) : 0,
      example,
    });
  });

  const ExampleStep = z.discriminatedUnion('step', [
    z.object({ step: z.literal('shown') }).strict(),
    z.object({ step: z.literal('answered'), exampleSaved: z.number().int().min(10).max(10000), answer: z.number().int().min(0).max(10000) }).strict(),
  ]);

  /** S07.3 (D.11): the 13-17 worked example. The answer is checked by the database at the child's current rate. */
  router.post('/savings-bonus/example', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const parsed = ExampleStep.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Send shown, or an answer for 10 to 10000 saved coins');
    const result = await recordExample(kid.id, parsed.data);
    if (result === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not record the example');
    if (isRefusal(result)) {
      return result.refused === 'EXAMPLE_NOT_APPLICABLE'
        ? fail(res, 409, 'EXAMPLE_NOT_APPLICABLE', 'The worked example goes with a percentage bonus')
        : fail(res, 400, 'VALIDATION_ERROR', 'Send shown, or an answer for 10 to 10000 saved coins');
    }
    return ok(res, parsed.data.step === 'answered' ? { correct: result } : { shown: true });
  });

  router.get('/wallet/pending-credits', familyChild, async (req, res) => {
    const kid = authedUser(res);
    const credits = await getPendingCreditsForKid(kid.id);
    if (credits === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load pending credits');
    return ok(res, { credits: credits.map(toWirePendingCredit) });
  });

  const AllocateCredit = z
    .object({
      save: z.number().int().min(0),
      spend: z.number().int().min(0),
      share: z.number().int().min(0),
      // S07.4 (D.13): the Save part may go to one of the child's active goals.
      goalId: z.string().uuid().nullable().optional(),
    })
    .strict()
    .refine((v) => !v.goalId || v.save > 0, 'A goal needs some coins in Save')
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
    const allocated = await allocatePendingCredit({
      creditId: id.data, kidId: kid.id, save: parsed.data.save, spend: parsed.data.spend, share: parsed.data.share, createdBy: kid.id, goalId: parsed.data.goalId ?? null,
    });
    if (allocated === null) return fail(res, 502, DATA_UNAVAILABLE, 'Could not allocate the credit');
    if (allocated === false) return fail(res, 409, CONFLICT, 'This credit is not ready to allocate, or the split is invalid');
    return ok(res, { allocated: true });
  });

  /**
   * S07.6 (D.12): the caller's own age register, for every wallet holder (an
   * independent teen included), so every rebuilt money surface is presented
   * in it. Decided by the database from age evidence; never chosen by a client.
   */
  router.get('/register', walletHolder, async (req, res) => {
    const holder = authedUser(res);
    const register = await readMoneyRegister(holder.id);
    if (register === UNAVAILABLE) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load the register');
    if (register === null) return fail(res, 403, 'WALLET_UNAVAILABLE', 'This account has no wallet');
    return ok(res, { register });
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
