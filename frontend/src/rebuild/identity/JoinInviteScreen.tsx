import { ButtonGroup, ButtonLink, Button, LoadingState } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { AuthIntro, AuthOutcome, AuthSwitch, follow, identityCopy, type Navigate } from './authBlocks';

/*
 * The invite landing, `/join/TOKEN` (A.1 second verified Tutor; D.3 / OD-3
 * Option B: a self-registered teen invites a parent; GAP-FIX-R5). It needs no
 * role: whoever opens the link learns what the invite needs from them, and
 * nothing more. It never shows the child's name or any account detail (only a
 * verified Tutor previews the invite, through Core); the token alone
 * authorizes nothing.
 *
 *   signed-out  a visitor (or a guest): create an account or log in; the
 *               token is kept through both (auth/pendingInvite.ts).
 *   verify      a signed-in adult who is not a verified Tutor: one message,
 *               one brand action to /verify-parent, whose success returns to
 *               the invite; or switch to another account.
 *   child       a parent-created child's account: the link is for an adult.
 *   invalid     a malformed link: ask for a new one.
 * A verified Tutor never sees this screen: the route sends them to the
 * invite on the Family page, where Core previews and accepts it.
 */

export type JoinInviteView =
  | { kind: 'checking' }
  | { kind: 'signed-out' }
  | { kind: 'verify'; signingOut: boolean }
  | { kind: 'child' }
  | { kind: 'invalid' };

export function JoinInviteScreen({ locale, view, signupHref, loginHref, verifyHref, homeHref, onNavigate, onSignOut }: {
  locale: Locale; view: JoinInviteView; signupHref: string; loginHref: string; verifyHref: string; homeHref: string;
  onNavigate?: Navigate; onSignOut: () => void;
}) {
  const copy = identityCopy(locale);
  const j = copy.authJoin;
  switch (view.kind) {
    case 'checking':
      return <div className="lf-auth-page" data-screen="join-invite" data-join-state="checking" data-surface="app">
        <AuthIntro title={j.title} />
        <LoadingState label={j.checking} lines={2} />
      </div>;
    case 'signed-out':
      return <AuthOutcome screen="join-invite" title={j.title} lead={<p className="lf-auth-lead" data-copy-role="body">{j.body}</p>}>
        <ButtonGroup>
          <ButtonLink variant="accent" size="lg" href={signupHref} onClick={follow(signupHref, onNavigate)} data-join="signup">{j.create}</ButtonLink>
          <ButtonLink size="lg" href={loginHref} onClick={follow(loginHref, onNavigate)} data-join="login">{j.login}</ButtonLink>
        </ButtonGroup>
      </AuthOutcome>;
    case 'verify':
      return <AuthOutcome screen="join-invite-verify" title={j.verifyTitle} lead={<p className="lf-auth-lead" data-copy-role="body">{j.verifyBody}</p>}>
        <ButtonGroup>
          <ButtonLink variant="accent" size="lg" href={verifyHref} onClick={follow(verifyHref, onNavigate)} data-join="verify">{j.verify}</ButtonLink>
          <Button size="lg" pending={view.signingOut} pendingLabel={j.checking} onClick={onSignOut} data-join="other-account">{j.otherAccount}</Button>
        </ButtonGroup>
      </AuthOutcome>;
    case 'child':
      return <AuthOutcome screen="join-invite-child" title={j.childTitle} lead={<p className="lf-auth-lead" data-copy-role="body">{j.childBody}</p>}>
        <AuthSwitch label={j.home} href={homeHref} onNavigate={onNavigate} />
      </AuthOutcome>;
    case 'invalid':
      return <AuthOutcome screen="join-invite-invalid" title={j.invalidTitle} lead={<p className="lf-auth-lead" data-copy-role="body">{j.invalidBody}</p>}>
        <AuthSwitch label={j.home} href={homeHref} onNavigate={onNavigate} />
      </AuthOutcome>;
  }
}
