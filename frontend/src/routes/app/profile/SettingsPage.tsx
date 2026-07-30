import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { LOCALES, type Locale } from '@/i18n';
import { Button, Card, Dropdown, Icon, type DropdownOption } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { UserListItem, type ListedUser } from './UserListItem';

/*
 * /profile/settings — personal data. `locale` is the user's language of
 * record (DB field): it drives lessons/games/content AND the UI. Email and
 * password changes stay disabled until Courier (email-server) ships.
 * Birth date is plain profile data for ANY user (distinct from Guardian's
 * verified adult birth_date used only for the Tutor upgrade).
 */

interface OwnProfileFields {
  displayName: string;
  username: string | null;
  locale: string;
  birthDate: string | null;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const LOCALE_FLAGS: Record<Locale, string> = {
  'en-US': '🇺🇸',
  'es-MX': '🇲🇽',
  'pt-BR': '🇧🇷',
};

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { session, getToken, refreshMe } = useAuth();

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
    prefix: <span aria-hidden="true">{LOCALE_FLAGS[l]}</span>,
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="lf-display-lg text-content">{t('profile.settings.title')}</h1>
        <Link
          to="/profile"
          className="lf-label inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-content-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="arrow_back" />
          {t('profile.settings.back')}
        </Link>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} noValidate className="mt-8 flex flex-col gap-6">
        {errorCode && <ErrorBanner code={errorCode} />}

        <Card className="flex flex-col gap-5" aria-busy={!loaded}>
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

        <Card className="flex flex-col gap-5">
          <h2 className="lf-title text-content">{t('profile.settings.account')}</h2>
          <Field label={t('profile.settings.email')} value={session?.user.email ?? ''} disabled readOnly />
          <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3">
            <Icon name="hourglass_top" className="mt-0.5 shrink-0 text-content-muted" />
            <p className="lf-caption text-content-muted">{t('profile.settings.emailPasswordPending')}</p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
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
          className="gap-2"
        >
          <Icon name={saved ? 'check' : saving ? 'progress_activity' : 'save'} className={saving ? 'animate-spin' : undefined} />
          {saved ? t('profile.settings.saved') : saving ? t('profile.settings.saving') : t('profile.settings.save')}
        </Button>
      </form>
    </div>
  );
}
