import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';

/** Route guard: authenticated visitors are sent to APP_HOME (dashboard). */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  if (session === undefined) return null; // restoring from storage
  if (session) return <Navigate to={APP_HOME} replace />;
  return <>{children}</>;
}
