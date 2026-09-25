import { useEffect, useState } from 'react';
import { DEFAULT_REGISTER, fetchMoneyRegister, type MoneyRegister } from '@/rebuild/family/moneyRegister';
import { hubSession } from './familyHubSession';

/*
 * S07.6 (D.12): the reader's age register, read once per session token from
 * Core (which reads it from the database; never chosen here) and shared by
 * every money panel on the page. While it loads the hook answers null, and a
 * panel presents the young register, the most legible one; a failed read is
 * not cached, so the next panel asks again.
 */
const pending = new Map<string, Promise<MoneyRegister>>();

export function useMoneyRegister(token: string | null): MoneyRegister | null {
  const [register, setRegister] = useState<MoneyRegister | null>(null);
  useEffect(() => {
    if (!token) return;
    let live = true;
    let request = pending.get(token);
    if (!request) {
      request = fetchMoneyRegister(hubSession(token)).then((result) => {
        if (!result.ok) pending.delete(token);
        return result.ok ? result.data : DEFAULT_REGISTER;
      });
      pending.set(token, request);
    }
    void request.then((value) => { if (live) setRegister(value); });
    return () => { live = false; };
  }, [token]);
  return register;
}

/** Test seam: forget every cached register. */
export function resetMoneyRegisterCache() {
  pending.clear();
}
