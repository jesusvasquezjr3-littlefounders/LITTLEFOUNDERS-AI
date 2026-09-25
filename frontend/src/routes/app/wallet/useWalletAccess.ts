import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';

/*
 * S07.2 (D.3, OD-3 Option B): what this account's wallet is, as Core's
 * GET /wallet/access classifies it by AGE (the stored age-screen declaration,
 * the under-13 origin marker, guest status, the roles and a profile birth
 * date). UI admission only: Core and the database re-check every request.
 *
 *   holder 'teen'           a self-registered teen: the personal wallet at /wallet.
 *   holder 'managed_child'  a parent-created child: the family wallet (Tasks, Banking).
 *   familyChild             a child in a family (parent-created, or a teen who
 *                           linked a verified parent): Tasks and Banking unlock.
 *
 * A parent-created child and a parent are known from the roles alone, so no
 * request is made for them. One request per signed-in account otherwise,
 * shared by every caller; a failed read resolves to "no wallet" for the UI
 * (never an admission), and is retried on the next sign-in.
 */
export interface WalletAccessView { loaded: boolean; holder: 'teen' | 'managed_child' | null; familyChild: boolean }

const NONE: WalletAccessView = { loaded: true, holder: null, familyChild: false };
const cache = new Map<string, Promise<WalletAccessView>>();

function fetchAccess(userId: string, getToken: () => Promise<string | null>): Promise<WalletAccessView> {
  const known = cache.get(userId);
  if (known) return known;
  const pending = (async (): Promise<WalletAccessView> => {
    const token = await getToken();
    if (!token) return NONE;
    const result = await api<{ holder: unknown; familyChild: unknown }>('/wallet/access', { token });
    const holder = result.data?.holder;
    if (result.error || !(holder === null || holder === 'teen' || holder === 'managed_child') || typeof result.data?.familyChild !== 'boolean') {
      cache.delete(userId);
      return NONE;
    }
    return { loaded: true, holder: holder as WalletAccessView['holder'], familyChild: result.data.familyChild };
  })();
  cache.set(userId, pending);
  return pending;
}

const listeners = new Set<() => void>();

/** Forget the cached answers (after the teen confirms a parent, for example); every mounted shell re-reads. */
export function invalidateWalletAccess() {
  cache.clear();
  for (const listener of listeners) listener();
}

export function useWalletAccess(): WalletAccessView {
  const { session, roles, meLoaded, getToken } = useAuth();
  const userId = session?.user?.id ?? null;
  const isKid = roles.includes('kid');
  const noWallet = roles.includes('parent') || roles.includes('admin') || roles.includes('superadmin') || session?.isGuest === true;
  const [view, setView] = useState<WalletAccessView>({ loaded: false, holder: null, familyChild: false });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (!session || !meLoaded || !userId) { setView(session === null ? NONE : { loaded: false, holder: null, familyChild: false }); return; }
    if (isKid) { setView({ loaded: true, holder: 'managed_child', familyChild: true }); return; }
    if (noWallet) { setView(NONE); return; }
    let cancelled = false;
    void fetchAccess(userId, getToken).then((next) => { if (!cancelled) setView(next); });
    return () => { cancelled = true; };
  }, [session, meLoaded, userId, isKid, noWallet, getToken, version]);

  return view;
}
