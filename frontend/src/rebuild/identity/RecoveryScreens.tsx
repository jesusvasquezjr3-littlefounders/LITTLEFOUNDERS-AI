import { useState } from 'react';
import { Button, ButtonGroup, LoadingState, TextField } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { AuthError, AuthForm, AuthIntro, AuthOutcome, AuthSwitch, identityCopy, PasswordField, type Navigate } from './authBlocks';

/*
 * A3 Forgot password, A4 Reset password, A5 the Google return and A6 Save your
 * progress, rebuilt on the sign-in shell (W2S.2).
 *
 *   A3  one email field. Core never says whether an address has an account, so
 *       the confirmation is the same for every address ("if an account uses
 *       this email"). A refused request (too many tries, no connection) says
 *       so instead of claiming a link was sent.
 *   A4  the link's short-lived recovery session authorises one new password;
 *       an old or used link says so and offers a new one.
 *   A5  "Signing you in", or "Sign-in didn't finish" with the way back. What
 *       comes next (the mandatory age screen for a first Google sign-in, A.3)
 *       is the app's route guard, not this screen.
 *   A6  attaches an email and password to the guest account in place: the
 *       same account, so the streak and progress stay (and so does the A.2
 *       origin marker, server-side).
 */

export type ForgotView = { kind: 'form'; pending: boolean; errorCode: string | null } | { kind: 'sent'; email: string };

export function ForgotPasswordScreen({ locale, view, onSubmit, onNavigate }: {
  locale: Locale; view: ForgotView; onSubmit: (email: string) => void; onNavigate?: Navigate;
}) {
  const copy = identityCopy(locale);
  const [email, setEmail] = useState('');
  if (view.kind === 'sent') {
    return <AuthOutcome screen="forgot-sent" title={copy.authForgot.sentTitle} focusOnMount lead={<>
      <p className="lf-auth-lead" data-copy-role="body">{copy.authForgot.sentBody}</p>
      <p className="lf-auth-address ugc" data-copy-role="data">{view.email}</p>
    </>}>
      <AuthSwitch label={copy.authCommon.backToLogin} href="/login" onNavigate={onNavigate} />
    </AuthOutcome>;
  }
  const ready = email.trim() !== '';
  return <div className="lf-auth-page" data-screen="forgot-password" data-surface="app">
    <AuthIntro title={copy.authForgot.title} lead={copy.authForgot.lead} />
    <AuthForm onSubmit={() => { if (ready && !view.pending) onSubmit(email.trim()); }} busy={view.pending} data-auth-form="forgot">
      <AuthError copy={copy} code={view.errorCode} />
      <TextField type="email" label={copy.authCommon.email} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      <Button type="submit" variant="accent" size="lg" disabled={!ready} pending={view.pending} pendingLabel={copy.authForgot.submitting} data-auth="submit">
        {copy.authForgot.submit}
      </Button>
    </AuthForm>
    <AuthSwitch label={copy.authCommon.backToLogin} href="/login" onNavigate={onNavigate} />
  </div>;
}

export type ResetView =
  | { kind: 'checking' }
  | { kind: 'expired' }
  | { kind: 'form'; pending: boolean; errorCode: string | null }
  | { kind: 'done' };

export function ResetPasswordScreen({ locale, view, onSubmit, onNavigate }: {
  locale: Locale; view: ResetView; onSubmit: (password: string) => void; onNavigate?: Navigate;
}) {
  const copy = identityCopy(locale);
  const [password, setPassword] = useState('');
  if (view.kind === 'checking') {
    return <div className="lf-auth-page" data-screen="reset-password" data-surface="app">
      <AuthIntro title={copy.authReset.title} />
      <LoadingState label={copy.authReset.checking} lines={2} />
    </div>;
  }
  if (view.kind === 'expired') {
    return <AuthOutcome screen="reset-expired" title={copy.authReset.expiredTitle}
      lead={<p className="lf-auth-lead" data-copy-role="body">{copy.authReset.expiredBody}</p>}>
      <AuthSwitch label={copy.authReset.requestNew} href="/forgot-password" onNavigate={onNavigate} />
    </AuthOutcome>;
  }
  if (view.kind === 'done') {
    return <AuthOutcome screen="reset-done" title={copy.authReset.doneTitle} focusOnMount
      lead={<p className="lf-auth-lead" data-copy-role="body">{copy.authReset.doneBody}</p>}>
      <AuthSwitch label={copy.authReset.login} href="/login" onNavigate={onNavigate} />
    </AuthOutcome>;
  }
  const ready = password.length >= 8;
  return <div className="lf-auth-page" data-screen="reset-password" data-surface="app">
    <AuthIntro title={copy.authReset.title} />
    <AuthForm onSubmit={() => { if (ready && !view.pending) onSubmit(password); }} busy={view.pending} data-auth-form="reset">
      <AuthError copy={copy} code={view.errorCode} />
      <PasswordField copy={copy} label={copy.authReset.newPassword} value={password} onChange={setPassword} autoComplete="new-password" showRule />
      <Button type="submit" variant="accent" size="lg" disabled={!ready} pending={view.pending} pendingLabel={copy.authReset.submitting} data-auth="submit">
        {copy.authReset.submit}
      </Button>
    </AuthForm>
  </div>;
}

export function OAuthCallbackScreen({ locale, failed, onNavigate }: { locale: Locale; failed: boolean; onNavigate?: Navigate }) {
  const copy = identityCopy(locale);
  if (failed) {
    // The route's own outcome, shown as the page arrives: it moves no focus (the skip link stays the first stop).
    return <AuthOutcome screen="oauth-failed" title={copy.authCallback.failedTitle}
      lead={<p className="lf-auth-lead" data-copy-role="body">{copy.authCallback.failedBody}</p>}>
      <AuthSwitch label={copy.authCommon.backToLogin} href="/login" onNavigate={onNavigate} />
    </AuthOutcome>;
  }
  return <div className="lf-auth-page" data-screen="oauth-callback" data-surface="app">
    <AuthIntro title={copy.authCallback.title} />
    <LoadingState label={copy.authCallback.signingIn} lines={2} />
  </div>;
}

export function UpgradeAccountScreen({ locale, pending, errorCode, onSubmit, onLater, onNavigate }: {
  locale: Locale; pending: boolean; errorCode: string | null; onSubmit: (email: string, password: string) => void; onLater: () => void; onNavigate?: Navigate;
}) {
  const copy = identityCopy(locale);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = email.trim() !== '' && password.length >= 8;
  return <div className="lf-auth-page" data-screen="upgrade-account" data-surface="app">
    <AuthIntro title={copy.authUpgrade.title} lead={copy.authUpgrade.lead} />
    <AuthForm onSubmit={() => { if (ready && !pending) onSubmit(email.trim(), password); }} busy={pending} data-auth-form="upgrade">
      <AuthError copy={copy} code={errorCode} />
      <TextField type="email" label={copy.authCommon.email} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      <PasswordField copy={copy} label={copy.authCommon.password} value={password} onChange={setPassword} autoComplete="new-password" showRule />
      <ButtonGroup>
        <Button type="submit" variant="accent" size="lg" disabled={!ready} pending={pending} pendingLabel={copy.authUpgrade.submitting} data-auth="submit">
          {copy.authUpgrade.submit}
        </Button>
        <Button size="lg" onClick={onLater} disabled={pending} data-auth="later">{copy.authUpgrade.later}</Button>
      </ButtonGroup>
    </AuthForm>
    <AuthSwitch prompt={copy.authUpgrade.other} label={copy.authUpgrade.login} href="/login" onNavigate={onNavigate} />
  </div>;
}
