import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';

/*
 * Role gate for app routes (client-side UX only — real authorization lives
 * in RLS + Core; this just keeps locked sections out of reach in the UI).
 */
export function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const { session, roles, meLoaded } = useAuth();
  if (session === undefined || (session && !meLoaded)) return null; // roles still loading
  if (!roles.includes(role)) return <Navigate to={APP_HOME} replace />;
  return <>{children}</>;
}
