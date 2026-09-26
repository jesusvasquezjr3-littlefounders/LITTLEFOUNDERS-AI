import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { useWalletAccess } from './useWalletAccess';

/*
 * S07.2 (D.3) route gates, UI only (Core admits by age at every request):
 *  - 'teen':        the personal wallet at /wallet (a self-registered teen).
 *  - 'familyMoney': Tasks and Banking, for the parent/kid roles as before OR a
 *                   teen who linked a verified parent.
 */
export function RequireWalletAccess({ mode, children }: { mode: 'teen' | 'familyMoney'; children: ReactNode }) {
  const { session, roles, meLoaded } = useAuth();
  const wallet = useWalletAccess();
  if (session === undefined || (session && !meLoaded)) return null;
  if (mode === 'familyMoney' && (roles.includes('parent') || roles.includes('kid'))) return <>{children}</>;
  if (!wallet.loaded) return null;
  const allowed = mode === 'teen' ? wallet.holder === 'teen' : wallet.familyChild;
  return allowed ? <>{children}</> : <Navigate to={APP_HOME} replace />;
}
