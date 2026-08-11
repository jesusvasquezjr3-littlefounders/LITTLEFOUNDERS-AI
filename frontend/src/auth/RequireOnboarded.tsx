import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

/**
 * Route guard: an unfinished guest is sent to /onboarding on any deep link
 * into the app shell (back button, bookmarked URL, refresh mid-flow). Never
 * applies to a real (non-guest) account — those completed their own signup
 * flow and have no onboarding step to retroactively enforce, no matter how
 * old the account.
 */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { session, meLoaded, isGuest, onboardingComplete } = useAuth();

  if (session === undefined || !meLoaded) return null; // restoring/resolving — avoid a redirect flash
  if (isGuest && !onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
