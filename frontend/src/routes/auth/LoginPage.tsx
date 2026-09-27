import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { configureInsights, flushInsights, trackInsight } from '@/lib/insights';
import { playPlatformSound } from '@/lib/sound';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { useShellLocale, useShellNavigate } from '@/app-shell/ShellRoot';
import { LoginScreen } from '@/rebuild/identity/SignInScreens';
import { useGoogleSignIn } from './useGoogleSignIn';

/*
 * `/login` (A1): the rebuilt screen (rebuild/identity) fed the session. What
 * this bridge keeps from the legacy page, unchanged: Core's `identifier`
 * (email or a child's username), the funnel's `login_complete` reported with
 * the analytics permission Core just resolved (never from a stale context),
 * the return to the page that asked for sign-in (and its state), otherwise
 * Learn.
 *
 * New: an account Core has paused or removed (A.1: the child's last verified
 * guardian link is gone) signs in to its own screen, `/account-suspended`,
 * instead of bouncing back to this form with no word (the sign-in succeeds,
 * then `/auth/me` answers ACCOUNT_SUSPENDED and the session is dropped).
 */
export function LoginPage() {
  const locale = useShellLocale();
  const onNavigate = useShellNavigate();
  const { login, getToken, suspended, deleted } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const google = useGoogleSignIn();
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  // After a successful sign-in, where to go is decided on the render that holds Core's /auth/me answer.
  useEffect(() => {
    if (!signedIn) return;
    if (suspended || deleted) { navigate('/account-suspended', { replace: true }); return; }
    const destination = location.state as { from?: string; returnState?: unknown } | null;
    navigate(destination?.from ?? APP_HOME, { replace: true, state: destination?.returnState });
  }, [signedIn, suspended, deleted, location.state, navigate]);

  async function submit(identifier: string, password: string) {
    setPending(true);
    setErrorCode(null);
    const { error, analyticsEnabled } = await login(identifier, password);
    setPending(false);
    if (error) {
      playPlatformSound('auth_error');
      setErrorCode(error.code);
      return;
    }
    playPlatformSound('auth_success');
    // Configured with the fresh value login() resolved: an event queued before consent is known may be discarded.
    configureInsights({ enabled: analyticsEnabled, getToken });
    // Returning-user signal, distinct from signup_complete (fired once per account).
    trackInsight('login_complete', { routeClass: 'marketing' });
    void flushInsights();
    setSignedIn(true);
  }

  return <LoginScreen locale={locale} google={google} pending={pending || signedIn} errorCode={errorCode}
    onSubmit={(identifier, password) => void submit(identifier, password)} onNavigate={onNavigate} />;
}
