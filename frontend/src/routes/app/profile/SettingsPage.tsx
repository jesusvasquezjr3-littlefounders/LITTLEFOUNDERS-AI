import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { LOCALES, type Locale } from '@/i18n';
import { Button, Card, Dropdown, Icon, IconChip, LocaleFlag, type DropdownOption } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { UserListItem, type ListedUser } from './UserListItem';

/*
 * /profile/settings — personal data. `locale` is the user's language of
 * record (DB field): it drives lesson content AND the UI. Email and
 * password changes go through Courier's recover/change-email flows
 * (backend/src/routes/auth.ts) — both re-verify currentPassword before
 * touching GoTrue. Birth date is plain profile data for ANY user (distinct
 * from Guardian's verified adult birth_date used only for the Tutor
 * upgrade).
 */

interface OwnProfileFields {
  displayName: string;
  username: string | null;
  locale: string;
  birthDate: string | null;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { session, getToken, refreshMe, isGuest } = useAuth();

  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [locale, setLocale] = useState<Locale>('en-US');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [blocked, setBlocked] = useState<ListedUser[] | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailErrorCode, setEmailErrorCode] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);

  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordErrorCode, setPasswordErrorCode] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const [profileRes, blockedRes] = await Promise.all([
        api<OwnProfileFields>('/profile', { token }),
        api<{ users: ListedUser[] }>('/profile/blocked', { token }),
      ]);
      if (cancelled) return;
      if (profileRes.data) {
        setDisplayName(profileRes.data.displayName);
        setUsername(profileRes.data.username ?? '');
        setLocale(profileRes.data.locale as Locale);
        setBirthDate(profileRes.data.birthDate ?? '');
        setLoaded(true);
      }
      if (blockedRes.data) setBlocked(blockedRes.data.users);
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const usernameInvalid = username.length > 0 && !USERNAME_RE.test(username);
  const birthDateInvalid = birthDate.length > 0 && !BIRTH_DATE_RE.test(birthDate);

  const localeOptions: DropdownOption<Locale>[] = LOCALES.map((l) => ({
    value: l,
    label: t(`language.${l}`),
    prefix: <LocaleFlag locale={l} />,
  }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (usernameInvalid || birthDateInvalid || !displayName.trim()) return;
    setSaving(true);
    setErrorCode(null);
    setSaved(false);
    const token = await getToken();
    const body: Record<string, string> = { displayName: displayName.trim(), locale };
    if (username) body.username = username;
    if (birthDate) body.birthDate = birthDate;
    const { error } = await api('/profile', { method: 'PATCH', body, token });
    // Personalisation depth — a strong early-retention correlate.
    if (!error) trackInsight('profile_edit', { routeClass: 'profile' });
    setSaving(false);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    await refreshMe(); // AppLayout re-syncs i18n to the stored locale
    void i18n.changeLanguage(locale);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function unblock(user: ListedUser) {
    if (!user.username) return;
    setUnblockingId(user.userId);
    const token = await getToken();
    const { error } = await api(`/profiles/${user.username}/block`, { method: 'DELETE', token });
    setUnblockingId(null);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    setBlocked((list) => list?.filter((u) => u.userId !== user.userId) ?? list);
  }

  async function onChangeEmail() {
    setEmailSubmitting(true);
    setEmailErrorCode(null);
    const token = await getToken();
    const { error } = await api('/auth/change-email', {
      method: 'POST',
      token,
      body: { newEmail: newEmail.trim(), currentPassword: emailPassword },
    });
    setEmailSubmitting(false);
    if (error) {
      setEmailErrorCode(error.code);
      return;
    }
    setEmailPending(true);
    setEditingEmail(false);
    setEmailPassword('');
  }

  async function onChangePassword() {
    if (newPassword.length < 8) return;
    setPasswordSubmitting(true);
    setPasswordErrorCode(null);
    const token = await getToken();
    const { error } = await api('/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword, newPassword },
    });
    setPasswordSubmitting(false);
    if (error) {
      setPasswordErrorCode(error.code);
      return;
    }
    setPasswordChanged(true);
    setEditingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setTimeout(() => setPasswordChanged(false), 4000);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <IconChip tone="primary" size="md" className="mt-1">
            <Icon name="settings" />
          </IconChip>
          <div>
            <h1 className="lf-display-lg text-content">{t('profile.settings.title')}</h1>
            <p className="lf-body mt-1 max-w-xl text-content-muted">{t('profile.settings.intro')}</p>
          </div>
        </div>
        <Link
          to="/profile"
          className="lf-label inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-content-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="arrow_back" />
          {t('profile.settings.back')}
        </Link>
      </div>

      {isGuest && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-primary/30 bg-primary-soft">
          <div className="flex items-start gap-3">
            <IconChip tone="primary" size="md">
              <Icon name="person_add" />
            </IconChip>
            <div>
              <p className="lf-label text-content">{t('profile.settings.guestBanner.title')}</p>
              <p className="lf-body mt-1 text-content-muted">{t('profile.settings.guestBanner.body')}</p>
            </div>
          </div>
          <Link to="/upgrade-account">
            <Button>{t('profile.settings.guestBanner.cta')}</Button>
          </Link>
        </Card>
      )}

      <form onSubmit={(e) => void onSubmit(e)} noValidate className="mt-8 grid gap-6 lg:grid-cols-2">
        {errorCode && <div className="lg:col-span-2"><ErrorBanner code={errorCode} /></div>}

        <Card className="flex h-full flex-col gap-5" aria-busy={!loaded}>
          <h2 className="lf-title text-content">{t('profile.settings.identity')}</h2>
          <Field
            label={t('profile.settings.displayName')}
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Field
            label={t('profile.settings.username')}
            value={username}
            placeholder="usuariox"
            maxLength={20}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            hint={t('profile.settings.usernameHint')}
            error={usernameInvalid ? t('profile.settings.usernameInvalid') : undefined}
            trailing={<span className="lf-label pr-2 text-content-muted">@</span>}
          />
          <Field
            label={t('profile.settings.birthDate')}
            inputMode="numeric"
            placeholder="1988-02-14"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            hint={t('profile.settings.birthDateHint')}
            error={birthDateInvalid ? t('profile.settings.birthDateInvalid') : undefined}
          />
          <div className="flex flex-col gap-1.5">
            <span className="lf-label text-content">{t('profile.settings.language')}</span>
            <Dropdown value={locale} options={localeOptions} onChange={setLocale} ariaLabel={t('profile.settings.language')} />
            <p className="lf-caption text-content-muted">{t('profile.settings.languageHint')}</p>
          </div>
        </Card>

        <Card className="flex h-full flex-col gap-5">
          <h2 className="lf-title text-content">{t('profile.settings.account')}</h2>

          {isGuest ? (
            <Field label={t('profile.settings.email')} value={t('profile.settings.guestBanner.title')} disabled readOnly />
          ) : (
            <>
              {!editingEmail && (
                <div className="flex items-end justify-between gap-3">
                  <Field
                    label={t('profile.settings.email')}
                    value={session?.user.email ?? ''}
                    disabled
                    readOnly
                    className="flex-1"
                    hint={emailPending ? t('profile.settings.emailPending', { email: newEmail }) : undefined}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 shrink-0 px-4 py-2"
                    onClick={() => {
                      setEditingEmail(true);
                      setEmailPending(false);
                      setEmailErrorCode(null);
                      setNewEmail('');
                    }}
                  >
                    {t('profile.settings.changeEmail')}
                  </Button>
                </div>
              )}
              {editingEmail && (
                // A <form> here would nest inside the page's own <form> (invalid HTML —
                // the browser falls back to a native submit instead of running React's
                // handler), so this is a plain div with an Enter-to-submit shim instead.
                <div
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newEmail && emailPassword && !emailSubmitting) void onChangeEmail();
                  }}
                  className="flex flex-col gap-4"
                >
                  {emailErrorCode && <ErrorBanner code={emailErrorCode} />}
                  <Field
                    label={t('profile.settings.newEmail')}
                    type="email"
                    required
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <Field
                    label={t('profile.settings.currentPassword')}
                    type="password"
                    required
                    autoComplete="current-password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => void onChangeEmail()}
                      disabled={emailSubmitting || !newEmail || !emailPassword}
                      className="gap-2"
                    >
                      <Icon name={emailSubmitting ? 'progress_activity' : 'send'} className={emailSubmitting ? 'animate-spin' : undefined} />
                      {emailSubmitting ? t('profile.settings.changeEmailSubmitting') : t('profile.settings.changeEmailSubmit')}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingEmail(false)}>
                      {t('profile.settings.cancel')}
                    </Button>
                  </div>
                </div>
              )}

              <div className="h-px bg-outline/50" />

              {!editingPassword && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="lf-label text-content">{t('profile.settings.password')}</p>
                    <p className="lf-body mt-1 tracking-widest text-content-muted" aria-hidden="true">
                      ••••••••
                    </p>
                    {passwordChanged && <p className="lf-caption mt-1 text-success-strong">{t('profile.settings.changePasswordSuccess')}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 shrink-0 px-4 py-2"
                    onClick={() => {
                      setEditingPassword(true);
                      setPasswordErrorCode(null);
                      setCurrentPassword('');
                      setNewPassword('');
                    }}
                  >
                    {t('profile.settings.changePassword')}
                  </Button>
                </div>
              )}
              {editingPassword && (
                // Same nested-<form> constraint as the email section above.
                <div
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && currentPassword && newPassword.length >= 8 && !passwordSubmitting) void onChangePassword();
                  }}
                  className="flex flex-col gap-4"
                >
                  {passwordErrorCode && <ErrorBanner code={passwordErrorCode} />}
                  <Field
                    label={t('profile.settings.currentPassword')}
                    type="password"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <Field
                    label={t('profile.settings.newPassword')}
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    hint={t('profile.settings.newPasswordHint')}
                    error={newPassword.length > 0 && newPassword.length < 8 ? t('profile.settings.newPasswordTooShort') : undefined}
                  />
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => void onChangePassword()}
                      disabled={passwordSubmitting || !currentPassword || newPassword.length < 8}
                      className="gap-2"
                    >
                      <Icon
                        name={passwordSubmitting ? 'progress_activity' : 'lock_reset'}
                        className={passwordSubmitting ? 'animate-spin' : undefined}
                      />
                      {passwordSubmitting ? t('profile.settings.changePasswordSubmitting') : t('profile.settings.changePasswordSubmit')}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingPassword(false)}>
                      {t('profile.settings.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-4 lg:col-span-2">
          <h2 className="lf-title text-content">{t('profile.settings.blockedTitle')}</h2>
          {blocked === null && (
            <div className="flex flex-col gap-2" aria-busy="true">
              <div className="h-[60px] animate-pulse rounded-lg bg-surface-sunken" />
            </div>
          )}
          {blocked !== null && blocked.length === 0 && (
            <p className="lf-caption text-content-muted">{t('profile.settings.blockedEmpty')}</p>
          )}
          {blocked !== null && blocked.length > 0 && (
            <div className="flex flex-col gap-1">
              {blocked.map((u) => (
                <UserListItem
                  key={u.userId}
                  user={u}
                  tutorLabel={t('dashboard.tutorBadge')}
                  action={
                    <Button
                      variant="secondary"
                      className="shrink-0 gap-1.5 px-4 py-2"
                      disabled={unblockingId === u.userId}
                      onClick={() => void unblock(u)}
                    >
                      <Icon
                        name={unblockingId === u.userId ? 'progress_activity' : 'lock_open'}
                        className={unblockingId === u.userId ? 'animate-spin' : undefined}
                      />
                      {t('profile.settings.unblock')}
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </Card>

        <Button
          type="submit"
          disabled={saving || !loaded || !displayName.trim() || usernameInvalid || birthDateInvalid}
          variant={saved ? 'success' : 'primary'}
          className="gap-2 lg:col-span-2 lg:justify-self-start"
        >
          <Icon name={saved ? 'check' : saving ? 'progress_activity' : 'save'} className={saving ? 'animate-spin' : undefined} />
          {saved ? t('profile.settings.saved') : saving ? t('profile.settings.saving') : t('profile.settings.save')}
        </Button>
      </form>
    </div>
  );
}
