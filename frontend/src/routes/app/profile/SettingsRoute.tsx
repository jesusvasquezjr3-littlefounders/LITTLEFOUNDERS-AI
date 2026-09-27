import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api, type ApiError } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { SessionPreferencesSetting } from '@/app-shell/SessionPreferencesSetting';
import {
  BlockedCard, DetailsCard, GuestCard, SettingsPanels, SettingsScreen, SignInCard, USERNAME_PATTERN,
  type BlockedUser, type BlockedView, type DetailsFormState, type EmailChangeState, type PasswordChangeState, type SettingsView,
} from '@/rebuild/account/AccountSettings';
import { isOffline, useProfileScreenEnvironment } from './profileRouteKit';
import { TeenAnalyticsSetting } from './TeenAnalyticsSetting';
import { TeenMemoryReviewSetting } from './TeenMemoryReviewSetting';
import { DispositionSetting } from './DispositionSetting';
import { AccountDeletionSetting } from './AccountDeletionSetting';
import { DiscoverableSetting, parseDiscoverable, type DiscoverableState } from './DiscoverableSetting';

/*
 * /profile/settings (P3): the data plane of the rebuilt Settings page.
 *
 *   details    GET /profile, then PATCH /profile with only the fields that
 *              changed (plus the language). A child's username is never sent
 *              (A.6); Core's refusals map to the field they concern:
 *              USERNAME_TAKEN, PROFILE_FIELD_UNSAFE (E.13, with `fields`),
 *              KID_USERNAME_LOCKED.
 *   sign-in    POST /auth/change-email and /auth/change-password, both
 *              re-verified by Core with the current password. No email row
 *              for a child (A.6) and none for a guest (nothing to change yet).
 *   blocked    GET /profile/blocked, DELETE /profiles/:username/block.
 *   found      OD-27 (2): a 16-17-year-old's choice to be found, offered only
 *              where GET /profile's `social.discoverable.canChoose` says so
 *              (DiscoverableSetting writes PUT /profile/discoverable).
 *   panels     the rebuilt panels with their own data planes: the analytics
 *              choice (H.1), the memory self-review (OD-18), how the Mentor
 *              adapts (C.7), the mode and sign-out (Lane 0), account deletion
 *              (E.6). Each decides its own visibility from Core's answer.
 */

const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLOSED_EMAIL: EmailChangeState = { open: false, newEmail: '', password: '', submitting: false, error: null, pending: null };
const CLOSED_PASSWORD: PasswordChangeState = { open: false, current: '', next: '', submitting: false, error: null, done: false };

interface Stored { displayName: string; username: string; locale: string; birthDate: string | null; email: string | null }

export function SettingsRoute() {
  const { session } = useAuth();
  return session ? <ScopedSettings key={session.user.id} /> : null;
}

function ScopedSettings() {
  const { session, isGuest, getToken, refreshMe } = useAuth();
  const { i18n } = useTranslation();
  const { locale, dark, copy, kid, ageBand } = useProfileScreenEnvironment();
  const navigate = useNavigate();
  const [view, setView] = useState<SettingsView>({ kind: 'loading' });
  const [stored, setStored] = useState<Stored | null>(null);
  const [form, setForm] = useState<DetailsFormState>({ displayName: '', username: '', locale: 'en-US', birthDate: null, saving: false, status: null, errors: {} });
  const [emailChange, setEmailChange] = useState<EmailChangeState>(CLOSED_EMAIL);
  const [passwordChange, setPasswordChange] = useState<PasswordChangeState>(CLOSED_PASSWORD);
  const [blocked, setBlocked] = useState<BlockedView>({ kind: 'loading' });
  const [discoverable, setDiscoverable] = useState<DiscoverableState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [blockedAttempt, setBlockedAttempt] = useState(0);
  const inFlight = useRef({ details: false, email: false, password: false, unblock: false });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const result = token ? await api<{ displayName?: unknown; username?: unknown; locale?: unknown; birthDate?: unknown; email?: unknown }>('/profile', { token }) : null;
      if (cancelled) return;
      const data = result?.data;
      if (!data || typeof data.displayName !== 'string' || !(data.username === null || typeof data.username === 'string')) {
        setView({ kind: 'failed', offline: isOffline(result?.error), retrying: false });
        return;
      }
      const next: Stored = {
        displayName: data.displayName, username: data.username ?? '',
        locale: typeof data.locale === 'string' && LOCALES.includes(data.locale) ? data.locale : locale,
        birthDate: typeof data.birthDate === 'string' ? data.birthDate : null,
        // The sign-in address as Core knows it (the session's copy can be older, e.g. after a confirmed change).
        email: typeof data.email === 'string' && data.email ? data.email : null,
      };
      setStored(next);
      setDiscoverable(parseDiscoverable(data));
      setForm({ displayName: next.displayName, username: next.username, locale: next.locale, birthDate: next.birthDate, saving: false, status: null, errors: {} });
      setView({ kind: 'ready' });
    })();
    return () => { cancelled = true; };
    // `locale` is only the fallback for an unreadable stored language: a language change must not reload the form.
  }, [getToken, attempt]);

  useEffect(() => {
    let cancelled = false;
    setBlocked({ kind: 'loading' });
    void (async () => {
      const token = await getToken();
      const result = token ? await api<{ users?: unknown }>('/profile/blocked', { token }) : null;
      if (cancelled) return;
      const users = result?.data?.users;
      if (!Array.isArray(users)) { setBlocked({ kind: 'failed' }); return; }
      setBlocked({ kind: 'ready', unblocking: null, failedId: null, users: users.flatMap((entry) => {
        const user = entry as { userId?: unknown; displayName?: unknown; username?: unknown };
        return typeof user.userId === 'string' ? [{ userId: user.userId, displayName: typeof user.displayName === 'string' ? user.displayName : '',
          username: typeof user.username === 'string' ? user.username : null }] : [];
      }) });
    })();
    return () => { cancelled = true; };
  }, [getToken, blockedAttempt]);

  const onField = useCallback((field: 'displayName' | 'username' | 'locale', value: string) => {
    setForm((current) => {
      const errors = { ...current.errors };
      if (field !== 'locale') delete errors[field];
      return { ...current, [field]: value, status: null, errors };
    });
  }, []);

  async function saveDetails() {
    if (!stored || inFlight.current.details) return;
    const displayName = form.displayName.trim();
    const username = form.username.trim();
    const errors: DetailsFormState['errors'] = {};
    if (!displayName) errors.displayName = 'required';
    const usernameChanged = !kid && username !== stored.username;
    if (usernameChanged && !USERNAME_PATTERN.test(username)) errors.username = 'invalid';
    if (errors.displayName || errors.username) { setForm((current) => ({ ...current, errors, status: null })); return; }
    const body: Record<string, string> = { locale: form.locale };
    if (displayName !== stored.displayName) body.displayName = displayName;
    if (usernameChanged) body.username = username;
    inFlight.current.details = true;
    setForm((current) => ({ ...current, saving: true, status: null, errors: {} }));
    const token = await getToken();
    const result = token ? await api('/profile', { method: 'PATCH', token, body }) : null;
    inFlight.current.details = false;
    if (!result || result.error) {
      setForm((current) => ({ ...current, saving: false, ...detailsFailure(result?.error ?? null) }));
      return;
    }
    trackInsight('profile_edit', { routeClass: 'profile' });
    setStored({ ...stored, displayName, username: usernameChanged ? username : stored.username, locale: form.locale });
    setForm((current) => ({ ...current, displayName, saving: false, status: 'saved', errors: {} }));
    await refreshMe();
    if (form.locale !== i18n.resolvedLanguage) void i18n.changeLanguage(form.locale);
  }

  async function onEmail(action: Parameters<Parameters<typeof SignInCard>[0]['onEmail']>[0]) {
    if (action.type === 'open') { setEmailChange({ ...CLOSED_EMAIL, open: true }); return; }
    if (action.type === 'cancel') { setEmailChange((current) => ({ ...CLOSED_EMAIL, pending: current.pending })); return; }
    if (action.type === 'field') { setEmailChange((current) => ({ ...current, [action.field]: action.value, error: null })); return; }
    if (inFlight.current.email) return;
    const newEmail = emailChange.newEmail.trim();
    if (!EMAIL.test(newEmail)) { setEmailChange((current) => ({ ...current, error: 'invalid' })); return; }
    if (!emailChange.password) { setEmailChange((current) => ({ ...current, error: 'password' })); return; }
    inFlight.current.email = true;
    setEmailChange((current) => ({ ...current, submitting: true, error: null }));
    const token = await getToken();
    const result = token ? await api('/auth/change-email', { method: 'POST', token, body: { newEmail, currentPassword: emailChange.password } }) : null;
    inFlight.current.email = false;
    if (!result || result.error) {
      const code = result?.error?.code;
      setEmailChange((current) => ({ ...current, submitting: false, password: code === 'INVALID_CREDENTIALS' ? '' : current.password,
        error: code === 'INVALID_CREDENTIALS' ? 'password' : code === 'VALIDATION_ERROR' ? 'invalid' : 'failed' }));
      return;
    }
    // Core promises a pending change only: the address changes once the link is opened.
    setEmailChange({ ...CLOSED_EMAIL, pending: newEmail });
  }

  async function onPassword(action: Parameters<Parameters<typeof SignInCard>[0]['onPassword']>[0]) {
    if (action.type === 'open') { setPasswordChange({ ...CLOSED_PASSWORD, open: true }); return; }
    if (action.type === 'cancel') { setPasswordChange(CLOSED_PASSWORD); return; }
    if (action.type === 'field') { setPasswordChange((current) => ({ ...current, [action.field]: action.value, error: null, done: false })); return; }
    if (inFlight.current.password) return;
    if (!passwordChange.current) { setPasswordChange((current) => ({ ...current, error: 'password' })); return; }
    if (passwordChange.next.length < 8) { setPasswordChange((current) => ({ ...current, error: 'short' })); return; }
    inFlight.current.password = true;
    setPasswordChange((current) => ({ ...current, submitting: true, error: null }));
    const token = await getToken();
    const result = token ? await api('/auth/change-password', { method: 'POST', token, body: { currentPassword: passwordChange.current, newPassword: passwordChange.next } }) : null;
    inFlight.current.password = false;
    if (!result || result.error) {
      const code = result?.error?.code;
      setPasswordChange((current) => ({ ...current, submitting: false, current: code === 'INVALID_CREDENTIALS' ? '' : current.current,
        error: code === 'INVALID_CREDENTIALS' ? 'password' : 'failed' }));
      return;
    }
    setPasswordChange({ ...CLOSED_PASSWORD, done: true });
  }

  async function unblock(user: BlockedUser) {
    if (!user.username || inFlight.current.unblock || blocked.kind !== 'ready') return;
    inFlight.current.unblock = true;
    setBlocked({ ...blocked, unblocking: user.userId, failedId: null });
    const token = await getToken();
    const result = token ? await api(`/profiles/${encodeURIComponent(user.username)}/block`, { method: 'DELETE', token }) : null;
    inFlight.current.unblock = false;
    setBlocked((current) => current.kind !== 'ready' ? current : !result || result.error
      ? { ...current, unblocking: null, failedId: user.userId }
      : { ...current, unblocking: null, users: current.users.filter((entry) => entry.userId !== user.userId) });
  }

  return <SettingsScreen copy={copy.settings} locale={locale} dark={dark} ageBand={ageBand} view={view}
    onRetry={() => { setView({ kind: 'failed', offline: false, retrying: true }); setAttempt((value) => value + 1); }}
    onNavigate={(href) => navigate(href)}>
    {isGuest ? <GuestCard copy={copy.settings} onNavigate={(href) => navigate(href)} /> : null}
    <DetailsCard copy={copy.settings} locale={locale} kid={kid} form={form} onField={onField} onSave={() => void saveDetails()} />
    {isGuest ? null : <SignInCard copy={copy.settings} kid={kid} email={stored?.email ?? session?.user.email ?? null} emailChange={emailChange} passwordChange={passwordChange}
      onEmail={(action) => void onEmail(action)} onPassword={(action) => void onPassword(action)} />}
    <BlockedCard copy={copy.settings} view={blocked} onUnblock={(user) => void unblock(user)} onRetry={() => setBlockedAttempt((value) => value + 1)} />
    <SettingsPanels>
      {isGuest ? null : <DiscoverableSetting key={`${attempt}`} copy={copy.discoverable} initial={discoverable} />}
      <TeenAnalyticsSetting />
      <TeenMemoryReviewSetting />
      <DispositionSetting />
      <SessionPreferencesSetting />
      <AccountDeletionSetting />
    </SettingsPanels>
  </SettingsScreen>;
}

/** Core's refusal of a details save, on the field it concerns. */
export function detailsFailure(error: ApiError | null): Pick<DetailsFormState, 'status' | 'errors'> {
  const code = error?.code;
  if (code === 'USERNAME_TAKEN') return { status: null, errors: { username: 'taken' } };
  if (code === 'KID_USERNAME_LOCKED') return { status: null, errors: { username: 'locked' } };
  if (code === 'PROFILE_FIELD_UNSAFE') {
    const fields = (error as ApiError & { fields?: unknown }).fields;
    const list = Array.isArray(fields) ? fields : ['username', 'displayName'];
    return { status: null, errors: { ...(list.includes('displayName') ? { displayName: 'unsafe' as const } : {}), ...(list.includes('username') ? { username: 'unsafe' as const } : {}) } };
  }
  return { status: isOffline(error) ? 'offline' : 'failed', errors: {} };
}
