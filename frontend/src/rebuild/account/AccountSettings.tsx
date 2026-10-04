import { ApplicationArt } from '../design/ApplicationArt';
import type { FormEvent, ReactNode } from 'react';
import { Button, ButtonGroup, Card, ErrorState, InlineNotice, LoadingState, SelectField, TextField } from '../design/controls';
import { AppLink, BackLink } from './navLink';
import '../design/tokens.css';
import '../design/system.css';
import './account.css';

/*
 * P3, SETTINGS (Product 10 A.6, E.4, E.6, E.8, E.13, H.1, C.4/OD-18, C.7;
 * Frontend Bible 02 §4.5, §9.8, 06).
 *
 * One neutral page of cards in one reading column, composed by the route
 * from these presentational parts and the rebuilt panels it passes in (the
 * analytics choice, the memory self-review, how the Mentor adapts, the mode
 * and sign-out, account deletion). Every age-tier rule is decided by Core;
 * this page states the same truth:
 *
 *   - A.6: a child account (the kid role) has no email of its own and keeps
 *     its username (the sign-in name derives from it). The email row is a
 *     note, the username a read-only field that says why. Core refuses both
 *     changes anyway (KID_EMAIL_FORBIDDEN, KID_USERNAME_LOCKED).
 *   - E.4: the birth date is shown, never edited here.
 *   - E.13: a minor's name or username that could help a stranger find them
 *     is refused by Core (PROFILE_FIELD_UNSAFE) and the field says so.
 *   - A guest has no sign-in details yet: the page offers the account upgrade
 *     instead of email and password rows.
 */

export interface SettingsCopy {
  title: string; back: string; loading: string; failedTitle: string; failedBody: string; offlineTitle: string; offlineBody: string; retry: string; retrying: string;
  guestTitle: string; guestBody: string; guestAction: string;
  detailsTitle: string; name: string; nameRequired: string; username: string; usernameHelp: string; usernameKidHelp: string; usernameInvalid: string;
  usernameTaken: string; usernameLocked: string; fieldUnsafe: string; language: string; languageHelp: string; birthDate: string; birthDateHelp: string;
  save: string; saving: string; saved: string; saveFailed: string; offlineSave: string;
  signInTitle: string; email: string; emailKid: string; changeEmail: string; newEmail: string; emailInvalid: string; currentPassword: string;
  sendLink: string; sending: string; cancel: string; emailPending: string; emailFailed: string; wrongPassword: string;
  password: string; changePassword: string; newPassword: string; newPasswordHelp: string; newPasswordShort: string; savePassword: string;
  passwordSaved: string; passwordFailed: string; showPassword: string; hidePassword: string;
  blockedTitle: string; blockedLoading: string; blockedFailed: string; blockedEmpty: string; unblock: string; unblocking: string; unblockFailed: string;
  languages: Record<'en-US' | 'es-MX' | 'pt-BR', string>;
}

export type SettingsView = { kind: 'loading' } | { kind: 'failed'; offline: boolean; retrying: boolean } | { kind: 'ready' };

/** The page: a header and one reading column of cards. */
export function SettingsScreen({ copy, locale, dark, ageBand, view, onRetry, onNavigate, children }: {
  copy: SettingsCopy; locale: string; dark: boolean; ageBand?: '6-9'; view: SettingsView;
  onRetry: () => void; onNavigate: (href: string) => void; children?: ReactNode;
}) {
  return <div className="lf-rebuild lf-account-screen" data-screen="settings" data-theme={dark ? 'dark' : 'light'} lang={locale}
    data-age-band={ageBand} aria-busy={view.kind === 'loading'}>
    <header className="lf-account-header lf-illustrated-header"><div className="lf-illustrated-heading">
      <BackLink href="/profile" label={copy.back} onNavigate={onNavigate} />
      <h1 data-copy-role="heading">{copy.title}</h1>
    </div><ApplicationArt scene="family" /></header>
    <div className="lf-settings-column">
      {view.kind === 'loading' ? <LoadingState label={copy.loading} lines={4} />
        : view.kind === 'failed' ? <ErrorState heading={view.offline ? copy.offlineTitle : copy.failedTitle} body={view.offline ? copy.offlineBody : copy.failedBody}
          retryLabel={copy.retry} retryingLabel={copy.retrying} retrying={view.retrying} onRetry={onRetry} />
          : children}
    </div>
  </div>;
}

export function GuestCard({ copy, onNavigate }: { copy: SettingsCopy; onNavigate: (href: string) => void }) {
  return <Card tone="primary" heading={copy.guestTitle}>
    <p data-copy-role="body">{copy.guestBody}</p>
    <div className="lf-account-actions"><AppLink href="/upgrade-account" variant="inverse" onNavigate={onNavigate}>{copy.guestAction}</AppLink></div>
  </Card>;
}

export type DetailsFieldError = 'required' | 'invalid' | 'taken' | 'unsafe' | 'locked';
export interface DetailsFormState {
  displayName: string; username: string; locale: string; birthDate: string | null;
  saving: boolean; status: 'saved' | 'failed' | 'offline' | null;
  errors: { displayName?: DetailsFieldError; username?: DetailsFieldError };
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function DetailsCard({ copy, locale, kid, form, onField, onSave }: {
  copy: SettingsCopy; locale: string;
  /**
   * A.6: a child account keeps its username. A child also reads the youngest
   * register (06 §3.1: 25 words in the first view), so the two helper lines an
   * adult reads (what the language drives, that the birth date is fixed here)
   * are left out: the row without a control already says it cannot be edited.
   */
  kid: boolean;
  form: DetailsFormState;
  onField: (field: 'displayName' | 'username' | 'locale', value: string) => void;
  onSave: () => void;
}) {
  const nameError = form.errors.displayName === 'required' ? copy.nameRequired : form.errors.displayName === 'unsafe' ? copy.fieldUnsafe : undefined;
  const usernameError = form.errors.username === 'invalid' ? copy.usernameInvalid : form.errors.username === 'taken' ? copy.usernameTaken
    : form.errors.username === 'unsafe' ? copy.fieldUnsafe : form.errors.username === 'locked' ? copy.usernameLocked : undefined;
  const birth = form.birthDate && Number.isFinite(Date.parse(form.birthDate))
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${form.birthDate.slice(0, 10)}T00:00:00Z`)) : null;
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(); };
  return <Card heading={copy.detailsTitle}>
    <form className="lf-settings-form" noValidate onSubmit={submit}>
      <TextField label={copy.name} value={form.displayName} maxLength={80} autoComplete="nickname" required error={nameError} errorLive={form.errors.displayName !== 'required'}
        onChange={(event) => onField('displayName', event.target.value)} />
      {kid ? <div className="lf-settings-row" data-field="username">
        {/* A.6: a child's username is shown, never offered as a field it cannot change. */}
        <div className="lf-settings-row-text">
          <span className="lf-settings-row-label" data-copy-role="body">{copy.username}</span>
          <span className="lf-settings-row-value ugc" data-copy-role="data">{form.username}</span>
          <span className="lf-settings-row-value" data-copy-role="body">{copy.usernameKidHelp}</span>
          {usernameError ? <InlineNotice tone="error" live>{usernameError}</InlineNotice> : null}
        </div>
      </div> : <TextField label={copy.username} value={form.username} maxLength={20} autoComplete="username" spellCheck={false} autoCapitalize="none"
        help={copy.usernameHelp} error={usernameError} errorLive={form.errors.username !== 'invalid'}
        onChange={(event) => onField('username', event.target.value.toLowerCase())} />}
      <SelectField label={copy.language} help={kid ? undefined : copy.languageHelp} value={form.locale}
        options={(['en-US', 'es-MX', 'pt-BR'] as const).map((value) => ({ value, label: copy.languages[value] }))}
        onChange={(event) => onField('locale', event.target.value)} />
      {birth ? <div className="lf-settings-row">
        <div className="lf-settings-row-text">
          <span className="lf-settings-row-label" data-copy-role="body">{copy.birthDate}</span>
          <span className="lf-settings-row-value" data-copy-role="data">{birth}</span>
          {kid ? null : <span className="lf-settings-row-value" data-copy-role="body">{copy.birthDateHelp}</span>}
        </div>
      </div> : null}
      <div className="lf-account-actions">
        <Button type="submit" variant="accent" pending={form.saving} pendingLabel={copy.saving}>{copy.save}</Button>
      </div>
      <div className="lf-account-live" aria-live="polite">
        {form.status === 'saved' ? <InlineNotice tone="success">{copy.saved}</InlineNotice> : null}
        {form.status === 'failed' ? <InlineNotice tone="error">{copy.saveFailed}</InlineNotice> : null}
        {form.status === 'offline' ? <InlineNotice tone="error">{copy.offlineSave}</InlineNotice> : null}
      </div>
    </form>
  </Card>;
}

export interface EmailChangeState { open: boolean; newEmail: string; password: string; submitting: boolean; error: 'invalid' | 'password' | 'failed' | null; pending: string | null }
export interface PasswordChangeState { open: boolean; current: string; next: string; submitting: boolean; error: 'short' | 'password' | 'failed' | null; done: boolean }

export function SignInCard({ copy, kid, email, emailChange, passwordChange, onEmail, onPassword }: {
  copy: SettingsCopy;
  /** A.6: a child account has no email of its own, by design. */
  kid: boolean;
  email: string | null;
  emailChange: EmailChangeState;
  passwordChange: PasswordChangeState;
  onEmail: (action: { type: 'open' | 'cancel' | 'submit' } | { type: 'field'; field: 'newEmail' | 'password'; value: string }) => void;
  onPassword: (action: { type: 'open' | 'cancel' | 'submit' } | { type: 'field'; field: 'current' | 'next'; value: string }) => void;
}) {
  const reveal = { show: copy.showPassword, hide: copy.hidePassword };
  const emailSubmit = (event: FormEvent) => { event.preventDefault(); onEmail({ type: 'submit' }); };
  const passwordSubmit = (event: FormEvent) => { event.preventDefault(); onPassword({ type: 'submit' }); };
  return <Card heading={copy.signInTitle}>
    {kid ? <div className="lf-settings-row">
      <div className="lf-settings-row-text">
        <span className="lf-settings-row-label" data-copy-role="body">{copy.email}</span>
        <span className="lf-settings-row-value" data-copy-role="body">{copy.emailKid}</span>
      </div>
    </div> : emailChange.open ? <form className="lf-settings-form" noValidate onSubmit={emailSubmit}>
      <TextField label={copy.newEmail} type="email" value={emailChange.newEmail} autoComplete="email" required
        error={emailChange.error === 'invalid' ? copy.emailInvalid : undefined}
        onChange={(event) => onEmail({ type: 'field', field: 'newEmail', value: event.target.value })} />
      <TextField label={copy.currentPassword} type="password" revealLabels={reveal} value={emailChange.password} autoComplete="current-password" required
        error={emailChange.error === 'password' ? copy.wrongPassword : undefined} errorLive
        onChange={(event) => onEmail({ type: 'field', field: 'password', value: event.target.value })} />
      <ButtonGroup>
        <Button type="submit" variant="brand" pending={emailChange.submitting} pendingLabel={copy.sending}>{copy.sendLink}</Button>
        <Button onClick={() => onEmail({ type: 'cancel' })} disabled={emailChange.submitting}>{copy.cancel}</Button>
      </ButtonGroup>
      <div className="lf-account-live" aria-live="assertive">
        {emailChange.error === 'failed' ? <InlineNotice tone="error">{copy.emailFailed}</InlineNotice> : null}
      </div>
    </form> : <div className="lf-settings-row">
      <div className="lf-settings-row-text">
        <span className="lf-settings-row-label" data-copy-role="body">{copy.email}</span>
        <span className="lf-settings-row-value ugc" data-copy-role="data">{email ?? ''}</span>
      </div>
      <Button size="sm" onClick={() => onEmail({ type: 'open' })}>{copy.changeEmail}</Button>
      <div className="lf-account-live" aria-live="polite">
        {emailChange.pending ? <InlineNotice tone="info">{copy.emailPending.replace('{email}', emailChange.pending)}</InlineNotice> : null}
      </div>
    </div>}
    {passwordChange.open ? <form className="lf-settings-form" noValidate onSubmit={passwordSubmit}>
      <TextField label={copy.currentPassword} type="password" revealLabels={reveal} value={passwordChange.current} autoComplete="current-password" required
        error={passwordChange.error === 'password' ? copy.wrongPassword : undefined} errorLive
        onChange={(event) => onPassword({ type: 'field', field: 'current', value: event.target.value })} />
      <TextField label={copy.newPassword} type="password" revealLabels={reveal} value={passwordChange.next} autoComplete="new-password" required minLength={8}
        help={copy.newPasswordHelp} error={passwordChange.error === 'short' ? copy.newPasswordShort : undefined}
        onChange={(event) => onPassword({ type: 'field', field: 'next', value: event.target.value })} />
      <ButtonGroup>
        <Button type="submit" variant="brand" pending={passwordChange.submitting} pendingLabel={copy.saving}>{copy.savePassword}</Button>
        <Button onClick={() => onPassword({ type: 'cancel' })} disabled={passwordChange.submitting}>{copy.cancel}</Button>
      </ButtonGroup>
      <div className="lf-account-live" aria-live="assertive">
        {passwordChange.error === 'failed' ? <InlineNotice tone="error">{copy.passwordFailed}</InlineNotice> : null}
      </div>
    </form> : <div className="lf-settings-row">
      <div className="lf-settings-row-text">
        <span className="lf-settings-row-label" data-copy-role="body">{copy.password}</span>
      </div>
      <Button size="sm" onClick={() => onPassword({ type: 'open' })}>{copy.changePassword}</Button>
      <div className="lf-account-live" aria-live="polite">
        {passwordChange.done ? <InlineNotice tone="success">{copy.passwordSaved}</InlineNotice> : null}
      </div>
    </div>}
  </Card>;
}

export interface BlockedUser { userId: string; displayName: string; username: string | null }
export type BlockedView = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; users: BlockedUser[]; unblocking: string | null; failedId: string | null };

export function BlockedCard({ copy, view, onUnblock, onRetry }: {
  copy: SettingsCopy; view: BlockedView; onUnblock: (user: BlockedUser) => void; onRetry: () => void;
}) {
  return <Card heading={copy.blockedTitle}>
    {view.kind === 'loading' ? <LoadingState label={copy.blockedLoading} lines={1} />
      : view.kind === 'failed' ? <>
        <InlineNotice tone="error" live>{copy.blockedFailed}</InlineNotice>
        <div className="lf-account-actions"><Button onClick={onRetry}>{copy.retry}</Button></div>
      </> : view.users.length === 0 ? <p className="lf-account-muted" data-copy-role="body">{copy.blockedEmpty}</p>
        : <ul className="lf-settings-blocked">
          {view.users.map((user) => <li key={user.userId} className="lf-settings-row">
            <div className="lf-settings-row-text">
              <span className="lf-settings-row-label ugc" data-copy-role="data">{user.displayName || user.username}</span>
              {user.username ? <span className="lf-settings-row-value ugc" data-copy-role="data">@{user.username}</span> : null}
            </div>
            <Button size="sm" disabled={!user.username || (view.unblocking !== null && view.unblocking !== user.userId)}
              pending={view.unblocking === user.userId} pendingLabel={copy.unblocking} onClick={() => onUnblock(user)}>{copy.unblock}</Button>
            {view.failedId === user.userId ? <InlineNotice tone="error" live>{copy.unblockFailed}</InlineNotice> : null}
          </li>)}
        </ul>}
  </Card>;
}

/** The rebuilt panels the route passes in, in the page's column. */
export function SettingsPanels({ children }: { children: ReactNode }) {
  return <div className="lf-account-panels">{children}</div>;
}
