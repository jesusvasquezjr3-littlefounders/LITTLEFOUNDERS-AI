import { useId, useState } from 'react';
import { Button, Checkbox, Copy, Glyph, InlineNotice, LoadingState, TextField } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './accountDeletion.css';

/*
 * Product 10 E.6: the account holder's own deletion, one copy-driven
 * component for every state of the flow.
 *
 * Law 5 is the point of E.6: the person sees the SHAPE and the TIMELINE of
 * the deletion before they confirm (when it happens, how to keep the account,
 * what goes and what stays, which children are paused) and the stated date
 * afterwards. Detail beyond the Copy Budget sits behind "What gets deleted"
 * (Bible 06 §4, layering), never in more words on the first view.
 *
 * Core decides everything that matters (deletionClient.ts is the transport):
 * who may delete themselves, the grace period, the password or recent
 * sign-in, the children paused (A.1). This component renders the verdict it
 * is given. A parent-created child sees who can delete the account instead
 * of a control. No celebration: a deletion is not on the OD-7 milestone list.
 */

export interface AccountDeletionCopy {
  title: string;
  start: string;
  graceBody: string;
  graceKeep: string;
  immediateBody: string;
  pausedOne: string;
  pausedMany: string;
  pausedAfter: string;
  detailsLabel: string;
  detailsProfile: string;
  detailsFiles: string;
  detailsKept: string;
  detailsLog: string;
  acknowledge: string;
  password: string;
  passwordHint: string;
  showPassword: string;
  hidePassword: string;
  confirm: string;
  back: string;
  working: string;
  wrongPassword: string;
  reauth: string;
  signInAgain: string;
  failed: string;
  loading: string;
  unavailable: string;
  retry: string;
  blockedKid: string;
  blockedStaff: string;
  scheduledTitle: string;
  scheduledBody: string;
  scheduledKeep: string;
  signedOut: string;
  keep: string;
  keeping: string;
  kept: string;
  keepFailed: string;
  processingBody: string;
  heldBody: string;
  deletedTitle: string;
  deletedBody: string;
  finishingBody: string;
  signIn: string;
  signOut: string;
  continue: string;
}

export type AccountDeletionView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'blocked'; reason: 'kid' | 'staff' }
  | {
      kind: 'ready';
      step: 'intro' | 'confirm';
      immediate: boolean;
      graceDays: number;
      reauth: 'password' | 'recent_sign_in' | 'none';
      pausedChildren: number;
      submitting: boolean;
      error: 'password' | 'reauth' | 'failed' | null;
    }
  | {
      kind: 'scheduled';
      status: 'pending' | 'processing' | 'held';
      scheduledFor: string;
      signedOut: boolean;
      keeping: boolean;
      keepFailed: boolean;
    }
  | { kind: 'kept' }
  | { kind: 'deleted'; finishing: boolean };

export interface AccountDeletionHandlers {
  onStart?: () => void;
  onBack?: () => void;
  onConfirm?: (input: { password: string | null }) => void;
  onKeep?: () => void;
  onRetry?: () => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onContinue?: () => void;
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function AccountDeletion({ copy, locale, dark, view, layout = 'card', ...handlers }: {
  copy: AccountDeletionCopy;
  locale: string;
  dark: boolean;
  view: AccountDeletionView;
  layout?: 'card' | 'screen';
} & AccountDeletionHandlers) {
  const Root = layout === 'screen' ? 'main' : 'section';
  const heading = view.kind === 'scheduled' ? copy.scheduledTitle : view.kind === 'deleted' ? copy.deletedTitle : copy.title;
  return <Root className={`lf-rebuild lf-account-deletion lf-account-deletion--${layout}`} data-theme={dark ? 'dark' : 'light'}
    data-deletion-audit={view.kind} lang={locale} aria-label={layout === 'card' ? heading : undefined}>
    <Copy role="heading" as={layout === 'screen' ? 'h1' : 'h2'}>{heading}</Copy>
    <Body copy={copy} locale={locale} view={view} {...handlers} />
  </Root>;
}

function Body({ copy, locale, view, onStart, onBack, onConfirm, onKeep, onRetry, onSignIn, onSignOut, onContinue }: {
  copy: AccountDeletionCopy;
  locale: string;
  view: AccountDeletionView;
} & AccountDeletionHandlers) {
  switch (view.kind) {
    case 'loading':
      return <LoadingState label={copy.loading} lines={2} />;
    case 'unavailable':
      return <>
        <InlineNotice tone="error" live>{copy.unavailable}</InlineNotice>
        <div className="lf-actions"><Button onClick={onRetry}>{copy.retry}</Button></div>
      </>;
    case 'blocked':
      return <Copy role="body">{view.reason === 'kid' ? copy.blockedKid : copy.blockedStaff}</Copy>;
    case 'ready':
      return <Ready copy={copy} view={view} onStart={onStart} onBack={onBack} onConfirm={onConfirm} onSignIn={onSignIn} />;
    case 'scheduled': {
      const date = formatDate(view.scheduledFor, locale);
      if (view.status === 'processing') return <Copy role="body">{copy.processingBody}</Copy>;
      return <>
        <Copy role="body">{copy.scheduledBody.replace('{date}', date)}</Copy>
        {view.status === 'held' ? <Copy role="body">{copy.heldBody}</Copy> : null}
        <Copy role="body">{view.signedOut ? copy.signedOut : copy.scheduledKeep}</Copy>
        {/* The status region stays mounted so "keeping" is announced once; a failure is its own alert. */}
        <div className="lf-account-deletion-feedback">
          <div role="status">{view.keeping && !view.keepFailed ? <InlineNotice tone="info">{copy.keeping}</InlineNotice> : null}</div>
          {view.keepFailed ? <InlineNotice tone="error" live>{copy.keepFailed}</InlineNotice> : null}
        </div>
        <div className="lf-actions">
          {view.signedOut
            ? <Button variant="accent" onClick={onSignIn}>{copy.signIn}</Button>
            : <Button variant="accent" onClick={onKeep} disabled={view.keeping} aria-busy={view.keeping}>{copy.keep}</Button>}
          {!view.signedOut && onSignOut ? <Button onClick={onSignOut} disabled={view.keeping}>{copy.signOut}</Button> : null}
        </div>
      </>;
    }
    case 'kept':
      return <>
        <InlineNotice tone="success" live>{copy.kept}</InlineNotice>
        {onContinue ? <div className="lf-actions"><Button variant="accent" onClick={onContinue}>{copy.continue}</Button></div> : null}
      </>;
    case 'deleted':
      return <>
        <InlineNotice tone="info" live>{copy.deletedBody}</InlineNotice>
        {view.finishing ? <Copy role="body">{copy.finishingBody}</Copy> : null}
      </>;
  }
}

function Ready({ copy, view, onStart, onBack, onConfirm, onSignIn }: {
  copy: AccountDeletionCopy;
  view: Extract<AccountDeletionView, { kind: 'ready' }>;
} & AccountDeletionHandlers) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [password, setPassword] = useState('');
  const errorId = useId();
  const needsPassword = view.reauth === 'password';
  const canConfirm = acknowledged && (!needsPassword || password.length > 0) && !view.submitting;
  // A wrong password belongs to the password field (02 §9.8: the error sits
  // directly under its control); the other two errors are about the request.
  const passwordError = view.error === 'password' ? copy.wrongPassword : undefined;
  const errorText = view.error === 'reauth' ? copy.reauth : view.error === 'failed' ? copy.failed : null;
  if (view.step === 'intro') {
    return <>
      <Copy role="body">{view.immediate ? copy.immediateBody : copy.graceBody.replace('{days}', String(view.graceDays))}</Copy>
      {view.immediate ? null : <Copy role="body">{copy.graceKeep}</Copy>}
      <details className="lf-account-deletion-details">
        <summary data-copy-role="action">
          {copy.detailsLabel}
          {/* System glyph, class A (chevron): shows that the row opens. */}
          <Glyph name="chevron" className="lf-system-glyph lf-account-deletion-chevron" />
        </summary>
        <div className="lf-account-deletion-details-body">
          <Copy role="body">{copy.detailsProfile}</Copy>
          <Copy role="body">{copy.detailsFiles}</Copy>
          <Copy role="body">{copy.detailsKept}</Copy>
          <Copy role="body">{copy.detailsLog}</Copy>
        </div>
      </details>
      <div className="lf-actions"><Button onClick={onStart}>{copy.start}</Button></div>
    </>;
  }
  // The confirm step states what this account's deletion does to others
  // (children it supervises alone are paused, A.1) right above the decision.
  return <>
    {view.pausedChildren > 0 ? <div className="lf-account-deletion-children">
      <Copy role="body">{view.pausedChildren === 1 ? copy.pausedOne : copy.pausedMany.replace('{count}', String(view.pausedChildren))}</Copy>
      <Copy role="body">{copy.pausedAfter}</Copy>
    </div> : null}
    <form className="lf-account-deletion-confirm" noValidate onSubmit={(event) => {
      event.preventDefault();
      if (canConfirm) onConfirm?.({ password: needsPassword ? password : null });
    }}>
      <Checkbox label={copy.acknowledge} checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
      {needsPassword
        ? <TextField label={copy.password} help={copy.passwordHint} type="password"
          revealLabels={{ show: copy.showPassword, hide: copy.hidePassword }} autoComplete="current-password" value={password}
          error={passwordError} errorLive onChange={(event) => setPassword(event.target.value)} />
        : null}
      {/* The status region stays mounted so "working" is announced once; an error is its own alert, announced once. */}
      <div id={errorId} className="lf-account-deletion-feedback">
        <div role="status">{view.submitting ? <InlineNotice tone="info">{copy.working}</InlineNotice> : null}</div>
        {!view.submitting && errorText ? <InlineNotice tone="error" live>{errorText}</InlineNotice> : null}
      </div>
      <div className="lf-actions">
        {view.error === 'reauth'
          ? <Button variant="accent" onClick={onSignIn}>{copy.signInAgain}</Button>
          : <Button type="submit" data-destructive="true" disabled={!canConfirm} aria-busy={view.submitting}
            aria-describedby={!view.submitting && errorText ? errorId : undefined}>{copy.confirm}</Button>}
        <Button onClick={onBack} disabled={view.submitting}>{copy.back}</Button>
      </div>
    </form>
  </>;
}
