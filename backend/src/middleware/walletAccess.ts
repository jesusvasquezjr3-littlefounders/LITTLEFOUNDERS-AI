import type { NextFunction, Request, Response } from 'express';
import { fail } from '../lib/http.js';
import { authedUser } from './auth.js';
import { getOwnRoles } from '../services/supabaseRest.js';
import { isFamilyChild, readWalletAccess, type WalletAccess } from '../services/teenWallet.js';

/*
 * S07.2 — D.3 (OD-3 Option B) admission for wallet routes. Mounted after
 * requireAuth. The answer mirrors the database's own wallet_holder_kind():
 * a `kid` role is a parent-created child (the family wallet); a parent or
 * staff account never holds a wallet; every other account is classified by
 * wallet_access() from the stored age-screen declaration, the under-13
 * origin marker, guest status, the profile birth date and verified guardian
 * links, never from anything the caller says about itself. The database
 * re-checks every write regardless.
 *
 *   'holder'       a parent-created child, or an eligible teen (independent or
 *                  linked): their own balances, history and savings goals.
 *   'teen'         an eligible self-registered teen only: logged income,
 *                  personal rewards, goal release, inviting a parent.
 *   'familyChild'  a child in a family: a parent-created child, or a teen with
 *                  a verified parent. Tasks and anything a parent approves stay
 *                  guardian-only (Option B), so an unlinked teen is refused.
 *
 * A guest session is refused before any read. A failed read is 502, never an
 * admission and never a reclassification (§1.14).
 */
export type WalletMode = 'holder' | 'teen' | 'familyChild';

const REFUSAL: Record<WalletMode, { code: string; message: string }> = {
  holder: { code: 'WALLET_UNAVAILABLE', message: 'This account has no wallet' },
  teen: { code: 'TEEN_WALLET_REQUIRED', message: 'This wallet is for teens who manage their own account' },
  familyChild: { code: 'GUARDIAN_LINK_REQUIRED', message: 'Tasks and approvals need a linked parent' },
};

const NO_WALLET_ROLES = new Set(['parent', 'admin', 'superadmin']);

export function walletAccessOf(res: Response): WalletAccess {
  return res.locals.walletAccess as WalletAccess;
}

/** The caller's wallet classification; null = a read failed (the caller answers 502). */
export async function resolveWalletAccess(res: Response): Promise<WalletAccess | null> {
  const user = authedUser(res);
  if (user.isGuest) return { kind: null, verifiedGuardians: null };
  const roles = await getOwnRoles(user.accessToken, user.id);
  if (!roles) return null;
  const names = roles.map((r) => r.role);
  if (names.includes('kid')) return { kind: 'managed_child', verifiedGuardians: null };
  if (names.some((role) => NO_WALLET_ROLES.has(role))) return { kind: null, verifiedGuardians: null };
  return readWalletAccess(user.id);
}

export function requireWalletAccess(mode: WalletMode) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    let access: WalletAccess | null;
    try {
      access = await resolveWalletAccess(res);
    } catch {
      access = null;
    }
    if (!access) {
      fail(res, 502, 'DATA_UNAVAILABLE', 'Could not check wallet access');
      return;
    }
    const admitted = mode === 'holder' ? access.kind !== null : mode === 'teen' ? access.kind === 'teen' : isFamilyChild(access);
    if (!admitted) {
      fail(res, 403, REFUSAL[mode].code, REFUSAL[mode].message);
      return;
    }
    res.locals.walletAccess = access;
    next();
  };
}
