import type { Response } from 'express';
import { fail } from '../lib/http.js';
import { getBankingAccount } from '../services/supabaseRest.js';

/** D.1 admission guard; SQL must independently serialize money movement with freeze. */
export async function requireUnfrozenBanking(kidId: string, res: Response): Promise<boolean> {
  const account = await getBankingAccount(kidId);
  if (account === undefined) {
    fail(res, 502, 'DATA_UNAVAILABLE', 'Could not check whether the account is frozen');
    return false;
  }
  if (account?.frozen) {
    fail(res, 409, 'ACCOUNT_FROZEN', 'This account is frozen; the operation is on hold');
    return false;
  }
  return true;
}
