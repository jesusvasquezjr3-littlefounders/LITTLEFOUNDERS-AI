import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { RequireAgeScreen } from './RequireAgeScreen';

/** Route guard: unauthenticated visitors are sent to /login (return path kept). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, accountDeletion } = useAuth();
  const location = useLocation();

  if (session === undefined) return null; // restoring from storage — avoid a redirect flash
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash, returnState: location.state }} />;
  if (location.pathname === '/reset-password') return <>{children}</>;
  // E.6: an account with a scheduled self-service deletion signs in to one
  // decision, keep it or leave, on the deletion screen (date + keep action).
  if (accountDeletion) return <Navigate to="/account-deletion" replace />;
  return <RequireAgeScreen>{children}</RequireAgeScreen>;
}
