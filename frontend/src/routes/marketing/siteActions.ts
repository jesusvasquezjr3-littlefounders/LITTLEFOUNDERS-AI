import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { trackMarketingGoal } from '@/lib/analytics';
import { APP_HOME } from '@/app-shell/home';
import { useShellLocale } from '@/app-shell/ShellRoot';
import type { StartAction, TutorAction } from '@/rebuild/site/blocks';

/*
 * The bridge between the public pages and the application (W2 Lane 1): the
 * rebuilt surfaces in rebuild/site/ read no session, router or analytics, so
 * this hook hands them the session-aware calls to action.
 *
 *   start   A visitor starts a guest session and lands on onboarding (the
 *           "Start free" entry, M1; a guest already has a session, so
 *           RequireAuth lets /onboarding through). Anyone signed in (a guest
 *           included) continues to the app instead (a marketing call to action
 *           is session-aware). A failed start is reported beside the button.
 *   tutor   The family pages' call to action: a visitor is offered the Tutor
 *           sign-up (/signup?intent=tutor), a verified parent their family, and
 *           anyone else signed in the app, where the navigation offers
 *           verification to an adult who is not yet a Tutor. The legacy page
 *           sent every signed-in non-parent to /verify-parent, a child and a
 *           teen included; minor safeguards follow age (OD-3), so it no longer
 *           does.
 *
 * The acquisition goals are reported exactly as before (trackMarketingGoal
 * re-checks consent, the session and the public-route boundary itself).
 */
export function useSiteActions() {
  const { session, roles, meLoaded, startGuestSession } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const locale = useShellLocale();
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const onNavigate = useCallback((href: string) => navigate(href), [navigate]);

  const onStart = useCallback(async (origin: string) => {
    // Reported before the await: success navigates away, and a goal fired after the route change would be credited to it.
    trackMarketingGoal('guest_start', { pathname, session, meLoaded });
    setPending(origin);
    setFailed(null);
    const { error } = await startGuestSession();
    setPending(null);
    if (error) { setFailed(origin); return; }
    navigate('/onboarding');
  }, [meLoaded, navigate, pathname, session, startGuestSession]);

  const start: StartAction = session
    ? { kind: 'continue', href: APP_HOME, onFollow: () => trackMarketingGoal('cta_signup_start', { pathname, session, meLoaded }) }
    : { kind: 'guest', pending, failed, onStart: (origin) => { void onStart(origin); } };

  const tutor: TutorAction = !session
    ? { kind: 'visitor', onFollow: () => trackMarketingGoal('cta_signup_start', { pathname, session, meLoaded }) }
    : roles.includes('parent') ? { kind: 'parent' } : { kind: 'member', href: APP_HOME };

  // "Log in" beside "Start free": the legacy landing's secondary goal.
  const onSecondary = () => trackMarketingGoal('cta_secondary', { pathname, session, meLoaded });

  return { locale, onNavigate, start, tutor, onSecondary };
}
