import { useState } from 'react';
import { Button, ButtonGroup, Checkbox, Copy, InlineNotice, Sheet, TextField } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import {
  AuthError, AuthForm, AuthIntro, AuthLink, AuthOutcome, AuthSwitch, DateFields, EMPTY_DATE, GoogleSignIn, identityCopy, isoDate, PasswordField,
  type DateParts, type GoogleState, type Navigate,
} from './authBlocks';
import { ageFromParts } from './ageFromParts';

/*
 * A1 Log in and A2 Sign up, rebuilt on the sign-in shell (W2S.2). Every
 * capability of the legacy screens is kept and nothing is added that Core
 * does not back (Law 5, A.1):
 *
 *   A1  email OR username (a child signs in with the username a parent chose,
 *       OD-3), password with show/hide, Google when Core has it enabled, the
 *       forgotten-password link, the way to sign up; the specific reason on a
 *       failure (wrong details, email not confirmed, too many tries).
 *   A2  name, email, password (8+), date of birth checked and not kept, the
 *       parent-or-guardian intent (it records intent only: the Tutor role comes
 *       from ID verification alone, A.5), Google; "check your inbox" when Core
 *       asks for confirmation; the under-13 refusal (A.2), whose one way on is a
 *       protected guest session, never a closed door.
 */

export function LoginScreen({ locale, google, pending, errorCode, onSubmit, onNavigate }: {
  locale: Locale; google: GoogleState; pending: boolean; errorCode: string | null;
  onSubmit: (identifier: string, password: string) => void; onNavigate?: Navigate;
}) {
  const copy = identityCopy(locale);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const ready = identifier.trim() !== '' && password !== '';
  return <div className="lf-auth-page" data-screen="login" data-surface="app">
    <AuthIntro title={copy.authLogin.title} />
    <GoogleSignIn copy={copy} google={google} />
    <AuthForm onSubmit={() => { if (ready && !pending) onSubmit(identifier.trim(), password); }} busy={pending} data-auth-form="login">
      <AuthError copy={copy} code={errorCode} />
      {/* Not type="email": a child's username is not an address, and the browser's email check would refuse it. The email keyboard (inputMode) still types a username. */}
      <TextField label={copy.authLogin.identifier} help={copy.authLogin.identifierHelp} value={identifier} onChange={(event) => setIdentifier(event.target.value)}
        autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} required />
      <PasswordField copy={copy} label={copy.authCommon.password} value={password} onChange={setPassword} autoComplete="current-password" />
      <AuthLink label={copy.authLogin.forgot} href="/forgot-password" onNavigate={onNavigate} data-auth-link="forgot" />
      <Button type="submit" variant="accent" size="lg" disabled={!ready} pending={pending} pendingLabel={copy.authLogin.submitting} data-auth="submit">
        {copy.authLogin.submit}
      </Button>
    </AuthForm>
    <AuthSwitch prompt={copy.authLogin.newHere} label={copy.authLogin.signup} href="/signup" onNavigate={onNavigate} />
  </div>;
}

/** `birthMonth` (`YYYY-MM`, S-04) only for a 13-17 date, after the form said what it is kept for. */
export interface SignupValues { displayName: string; email: string; password: string; birthDate: string; birthMonth?: string; parentIntent: boolean }

export type SignupView =
  | { kind: 'form'; pending: boolean; errorCode: string | null }
  | { kind: 'confirm'; email: string }
  /** Under 13 (A.2): the protected guest start, its pending state and a failure beside it. */
  | { kind: 'refused'; starting: boolean; failed: boolean };

export function SignupScreen({ locale, google, view, initialParentIntent, onSubmit, onFirstEdit, onStartGuest, onNavigate }: {
  locale: Locale; google: GoogleState; view: SignupView; initialParentIntent: boolean;
  onSubmit: (values: SignupValues) => void; onFirstEdit?: () => void; onStartGuest: () => void; onNavigate?: Navigate;
}) {
  const copy = identityCopy(locale);
  const [why, setWhy] = useState(false);

  if (view.kind === 'confirm') {
    return <AuthOutcome screen="signup-confirm" title={copy.authSignup.confirmTitle} focusOnMount lead={<>
      <p className="lf-auth-lead" data-copy-role="body">{copy.authSignup.confirmBody}</p>
      <p className="lf-auth-address ugc" data-copy-role="data">{view.email}</p>
    </>} />;
  }

  if (view.kind === 'refused') {
    return <AuthOutcome screen="signup-refused" title={copy.authSignup.refusedTitle} focusOnMount
      lead={<p className="lf-auth-lead" data-copy-role="body">{copy.authSignup.refusedBody}</p>}>
      {view.failed ? <InlineNotice tone="error" live>{copy.authSignup.guestFailed}</InlineNotice> : null}
      <ButtonGroup>
        <Button variant="accent" size="lg" pending={view.starting} pendingLabel={copy.authSignup.starting} onClick={onStartGuest} data-auth="guest">
          {copy.authSignup.tryGuest}
        </Button>
        <Button size="lg" onClick={() => setWhy(true)} aria-haspopup="dialog" data-auth="why">{copy.authSignup.why}</Button>
      </ButtonGroup>
      <Sheet open={why} onClose={() => setWhy(false)} heading={copy.authSignup.whyTitle} closeLabel={copy.authSignup.close}>
        <div className="lf-auth-why">
          <p data-copy-role="body">{copy.authSignup.whyNoEmail}</p>
          <p data-copy-role="body">{copy.authSignup.whySafety}</p>
          <p data-copy-role="body">{copy.authSignup.whyParent}</p>
        </div>
      </Sheet>
    </AuthOutcome>;
  }

  return <SignupForm copy={copy} google={google} view={view} initialParentIntent={initialParentIntent} onSubmit={onSubmit} onFirstEdit={onFirstEdit} onNavigate={onNavigate} />;
}

/*
 * The sign-up form owns what was typed. It is its own component so that the
 * refused and confirmation views unmount it: a refused child's name, email,
 * password and date of birth are discarded with it (A.2), not kept in memory
 * behind the refusal (W2S.3; the legacy page cleared them by hand).
 */
function SignupForm({ copy, google, view, initialParentIntent, onSubmit, onFirstEdit, onNavigate }: {
  copy: ReturnType<typeof identityCopy>; google: GoogleState; view: Extract<SignupView, { kind: 'form' }>; initialParentIntent: boolean;
  onSubmit: (values: SignupValues) => void; onFirstEdit?: () => void; onNavigate?: Navigate;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birth, setBirth] = useState<DateParts>(EMPTY_DATE);
  const [parentIntent, setParentIntent] = useState(initialParentIntent);
  const birthDate = isoDate(birth);
  const birthTyped = birth.year.length === 4 && birth.day !== '' && birth.month !== '';
  const ready = displayName.trim() !== '' && email.trim() !== '' && password.length >= 8 && birthDate !== null;
  // S-04 (OD-28): a 13-17 date keeps its month so the account moves to adult at 18; the form says so first.
  const age = birthDate === null ? null : ageFromParts(birth.day, birth.month, birth.year);
  const teen = age !== null && age >= 13 && age <= 17;
  return <div className="lf-auth-page" data-screen="signup" data-surface="app">
    <AuthIntro title={copy.authSignup.title} />
    <GoogleSignIn copy={copy} google={google} />
    <AuthForm busy={view.pending} data-auth-form="signup"
      onSubmit={() => { if (ready && !view.pending) onSubmit({ displayName: displayName.trim(), email: email.trim(), password, birthDate: birthDate!,
        ...(teen ? { birthMonth: birthDate!.slice(0, 7) } : {}), parentIntent }); }}>
      <div className="lf-auth-fields" onFocusCapture={onFirstEdit}>
        <AuthError copy={copy} code={view.errorCode} />
        <TextField label={copy.authSignup.name} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={80} required />
        <TextField type="email" label={copy.authCommon.email} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        <PasswordField copy={copy} label={copy.authCommon.password} value={password} onChange={setPassword} autoComplete="new-password" showRule ruleHelp={false} />
        <DateFields copy={copy} legend={copy.authCommon.birthDate} help={copy.authSignup.birthHelp} value={birth} onChange={setBirth}
          error={birthTyped && birthDate === null ? copy.authCommon.dateInvalid : undefined} />
        {teen ? <Copy role="body">{copy.authSignup.teenMonth}</Copy> : null}
        <Checkbox label={copy.authSignup.tutorIntent} help={copy.authSignup.tutorIntentHelp} checked={parentIntent}
          onChange={(event) => setParentIntent(event.target.checked)} data-auth="parent-intent" />
      </div>
      <Button type="submit" variant="accent" size="lg" disabled={!ready} pending={view.pending} pendingLabel={copy.authSignup.submitting} data-auth="submit">
        {copy.authSignup.submit}
      </Button>
      {/* Under the one action, where the legacy note sat: it reassures, it does not ask (and keeps the first view short). */}
      <p className="lf-auth-note" data-copy-role="body">{copy.authSignup.lead}</p>
    </AuthForm>
    <AuthSwitch prompt={copy.authSignup.haveAccount} label={copy.authSignup.login} href="/login" onNavigate={onNavigate} />
  </div>;
}
