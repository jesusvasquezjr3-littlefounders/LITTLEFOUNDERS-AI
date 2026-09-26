import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';

/**
 * Route guard: a visitor with a REAL (non-guest) session is sent to
 * APP_HOME — they're already logged in, no reason to see /login or /signup.
 * A guest session does NOT count as "already authenticated" here: guest
 * accounts are created silently by the primary landing CTA (see
 * Landing.tsx's startAsGuest), so without this carve-out every guest would
 * be permanently locked out of ever reaching /login or /signup to sign into
 * a different, pre-existing account — the only escape hatch would be
 * /upgrade-account, which can only ATTACH an identity to the current guest
 * session, never switch to a different one.
 */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { session, isGuest } = useAuth();

  if (session === undefined) return null; // restoring from storage
  if (session && !isGuest) return <Navigate to={APP_HOME} replace />;
  return <>{children}</>;
}
