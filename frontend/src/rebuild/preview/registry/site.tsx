import type { ReactNode } from 'react';
import { AuthShell, RebuildRoot, type MentorCharacter } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import { RouteErrorScreen } from '../../site/RouteErrorScreen';
import { LoginScreen, SignupScreen, type SignupView } from '../../identity/SignInScreens';
import { ForgotPasswordScreen, ResetPasswordScreen, UpgradeAccountScreen } from '../../identity/RecoveryScreens';
import { VerifyParentScreen, type VerificationCheck, type VerifyView } from '../../identity/VerifyParentScreen';
import { OnboardingFlow, ONBOARDING_STEPS, type OnboardingStep } from '../../identity/OnboardingFlow';
import { standalone, type PreviewContext, type PreviewRegistry } from './types';

/*
 * Lane 1 (site): the public site, sign-in, recovery, verification and
 * onboarding. Every screen is audited on its real route where the route can be
 * made to show it (scripts/audits/lanes/site.mjs). The states a real route
 * cannot show on demand are previewed here, in the frame they have on the
 * route:
 *
 *   route-error       X2, standalone as the lesson player shows it (`?stale=1`).
 *   identity          A1–A7 inside the sign-in shell: `?view=` one of
 *                     login-google (Google on, a failed start, a wrong password),
 *                     signup-refused, signup-refused-failed, signup-confirm,
 *                     forgot-sent, reset-form, reset-done, upgrade-error,
 *                     verify-failed, verify-success, verify-revoked,
 *                     verify-ineligible, verify-status-error.
 *   onboarding        O1 on its single-state screen: `?step=` one of the five
 *                     steps (name prefilled), `?chosen=` a Mentor, `?failed=1`.
 */
const noop = () => {};

function inAuthShell({ locale, theme, t }: PreviewContext, title: string, screen: ReactNode) {
  return <RebuildRoot theme={theme} locale={locale}>
    <AuthShell appName="LittleFounders" pageTitle={title} routeKey="identity-preview" locale={locale} homeHref="#" back={{ label: t.siteShell.home, href: '#' }}
      labels={{ skip: t.appShell.skip }}>{screen}</AuthShell>
  </RebuildRoot>;
}

function identityScreen(context: PreviewContext) {
  const { locale, params } = context;
  const view = params.get('view') ?? 'login-google';
  const google = { available: view === 'login-google', pending: false, failed: view === 'login-google', onStart: noop };
  const signup = (signupView: SignupView) => <SignupScreen locale={locale} google={google} view={signupView} initialParentIntent={false} onSubmit={noop} onStartGuest={noop} />;
  const verify = (verifyView: VerifyView) => <VerifyParentScreen locale={locale} view={verifyView} homeHref="#" familyHref="#"
    onRetryStatus={noop} onStart={noop} onSubmit={noop} />;
  const failedChecks: readonly VerificationCheck[] = ['nameMatch', 'notExpired'];
  const screens: Record<string, ReactNode> = {
    'login-google': <LoginScreen locale={locale} google={google} pending={false} errorCode="INVALID_CREDENTIALS" onSubmit={noop} />,
    'signup-refused': signup({ kind: 'refused', starting: false, failed: false }),
    'signup-refused-failed': signup({ kind: 'refused', starting: false, failed: true }),
    'signup-confirm': signup({ kind: 'confirm', email: 'alessandro.bartolomeo.villanueva@example.test' }),
    'forgot-sent': <ForgotPasswordScreen locale={locale} view={{ kind: 'sent', email: 'alessandro.bartolomeo.villanueva@example.test' }} onSubmit={noop} />,
    'reset-form': <ResetPasswordScreen locale={locale} view={{ kind: 'form', pending: false, errorCode: 'VALIDATION_ERROR' }} onSubmit={noop} />,
    'reset-done': <ResetPasswordScreen locale={locale} view={{ kind: 'done' }} onSubmit={noop} />,
    'upgrade-error': <UpgradeAccountScreen locale={locale} pending={false} errorCode="EMAIL_IN_USE" onSubmit={noop} onLater={noop} />,
    'verify-failed': verify({ kind: 'form', pending: false, errorCode: null, failedChecks }),
    'verify-success': verify({ kind: 'success' }),
    'verify-revoked': verify({ kind: 'revoked' }),
    'verify-ineligible': verify({ kind: 'ineligible' }),
    'verify-status-error': verify({ kind: 'status-error', retrying: false }),
  };
  return inAuthShell(context, context.t.authLogin.title, screens[view] ?? screens['login-google']);
}

function onboardingScreen({ locale, theme, params, t }: PreviewContext) {
  const requested = params.get('step') as OnboardingStep | null;
  const step = requested && (ONBOARDING_STEPS as readonly string[]).includes(requested) ? requested : 'welcome';
  const chosen = (params.get('chosen') as MentorCharacter | null) || null;
  const saving = (params.get('saving') as MentorCharacter | null) || null;
  const failed = params.get('failed') === '1';
  return <RebuildRoot theme={theme} locale={locale as Locale}>
    <OnboardingFlow locale={locale} skipLabel={t.appShell.skip} initialStep={step} initialName="Alessandro" askDiscovery={params.get('discovery') !== '0'}
      mentor={{ chosen, saving, failed: failed && step === 'mentor', onChoose: noop }} completing={null} failed={failed && step === 'account'} onComplete={noop} />
  </RebuildRoot>;
}

export const sitePreviewScreens: PreviewRegistry = {
  'route-error': standalone(({ locale, theme, params }) => <div className="lf-rebuild" data-theme={theme} lang={locale}>
    <RouteErrorScreen locale={locale} stale={params.get('stale') === '1'} home="learn" frame="standalone" onReload={() => {}} onHome={() => {}} />
  </div>),
  identity: standalone(identityScreen),
  onboarding: standalone(onboardingScreen),
};
