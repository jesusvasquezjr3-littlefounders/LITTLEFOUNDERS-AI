import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { configureInsights, flushInsights, trackInsight } from '@/lib/insights';
import { playPlatformSound } from '@/lib/sound';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { useShellLocale, useShellNavigate } from '@/app-shell/ShellRoot';
import { SignupScreen, type SignupValues, type SignupView } from '@/rebuild/identity/SignInScreens';
import { useGoogleSignIn } from './useGoogleSignIn';

/*
 * `/signup` (A2): the rebuilt screen fed the session. Kept from the legacy page:
 *
 *   - every account starts `universal` (Core enforces it); the parent-or-
 *     guardian box records intent only and `?intent=tutor` (the family pages'
 *     call to action) pre-ticks it; the Tutor role comes from verification;
 *   - the funnel: `signup_start` on the first focus inside the form (intent,
 *     not a page view), `signup_submit`, `signup_complete` with the permission
 *     Core just resolved;
 *   - A.2: under 13, Core refuses (AGE_RESTRICTED); the form's name, email,
 *     password and date are dropped, the first-party analytics buffer is
 *     turned off, and the one way on is a guest session carrying only the
 *     under-13 origin marker. It navigates to onboarding only once Core
 *     confirms that protected session; a failure stays here with a retry.
 */
export function SignupPage() {
  const locale = useShellLocale();
  const onNavigate = useShellNavigate();
  const { signup, getToken, startGuestSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const google = useGoogleSignIn();
  const [view, setView] = useState<SignupView>({ kind: 'form', pending: false, errorCode: null });
  const started = useRef(false);

  function markStart() {
    if (started.current) return;
    started.current = true;
    trackInsight('signup_start', { routeClass: 'marketing' });
  }

  async function submit(values: SignupValues) {
    trackInsight('signup_submit', { routeClass: 'marketing' });
    setView({ kind: 'form', pending: true, errorCode: null });
    const { error, confirmationRequired, analyticsEnabled } = await signup({ ...values, locale });
    if (error) {
      playPlatformSound('auth_error');
      if (error.code === 'AGE_RESTRICTED') {
        configureInsights({ enabled: false, getToken });
        setView({ kind: 'refused', starting: false, failed: false });
        return;
      }
      setView({ kind: 'form', pending: false, errorCode: error.code });
      return;
    }
    playPlatformSound('auth_success');
    configureInsights({ enabled: analyticsEnabled, getToken });
    trackInsight('signup_complete', { routeClass: 'marketing' });
    void flushInsights();
    if (confirmationRequired) { setView({ kind: 'confirm', email: values.email }); return; }
    navigate(values.parentIntent ? '/verify-parent' : APP_HOME, { replace: true });
  }

  async function startGuest() {
    if (view.kind !== 'refused' || view.starting) return;
    setView({ kind: 'refused', starting: true, failed: false });
    const { error } = await startGuestSession({ under13Origin: true });
    if (error) { setView({ kind: 'refused', starting: false, failed: true }); return; }
    navigate('/onboarding', { replace: true });
  }

  return <SignupScreen locale={locale} google={google} view={view} initialParentIntent={searchParams.get('intent') === 'tutor'}
    onSubmit={(values) => void submit(values)} onFirstEdit={markStart} onStartGuest={() => void startGuest()} onNavigate={onNavigate} />;
}
