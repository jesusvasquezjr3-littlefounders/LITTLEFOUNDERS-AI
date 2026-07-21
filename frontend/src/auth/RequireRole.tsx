import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';

/*
 * Role gate for app routes (client-side UX only — real authorization lives
 * in RLS + Core; this just keeps locked sections out of reach in the UI).
 * `role` accepts a single role or an any-of set — the staff console unlocks
 * for admin OR superadmin (/AGENTS.md §1.4: both hold the console
 * capabilities; only superadmin-exclusive panels gate on the single role).
 */
export function RequireRole({ role, children }: { role: string | string[]; children: ReactNode }) {
  const { session, roles, meLoaded } = useAuth();
  if (session === undefined || (session && !meLoaded)) return null; // roles still loading
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.some((r) => roles.includes(r))) return <Navigate to={APP_HOME} replace />;
  return <>{children}</>;
}
