import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { LOCALES, type Locale } from '@/i18n';
import { Button, Card, Dropdown, Icon, type DropdownOption } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';

/*
 * /profile/settings — personal data. `locale` is the user's language of
 * record (DB field): it drives lessons/games/content AND the UI. Email and
 * password changes stay disabled until Courier (email-server) ships.
 */

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const LOCALE_FLAGS: Record<Locale, string> = {
  'en-US': '🇺🇸',
  'es-MX': '🇲🇽',
  'pt-BR': '🇧🇷',
};

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { session, profile, getToken, refreshMe } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [locale, setLocale] = useState<Locale>((profile?.locale as Locale) ?? 'en-US');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Profile may resolve after mount (hard refresh) — sync once it lands.
  useEffect(() => {
    if (profile) {
      setDisplayName((v) => v || profile.display_name);
      setUsername((v) => v || (profile.username ?? ''));
      setLocale(profile.locale as Locale);
    }
  }, [profile]);

  const usernameInvalid = username.length > 0 && !USERNAME_RE.test(username);

  const localeOptions: DropdownOption<Locale>[] = LOCALES.map((l) => ({
    value: l,
    label: t(`language.${l}`),
    prefix: <span aria-hidden="true">{LOCALE_FLAGS[l]}</span>,
  }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (usernameInvalid || !displayName.trim()) return;
    setSaving(true);
    setErrorCode(null);
    setSaved(false);
    const token = await getToken();
    const body: Record<string, string> = { displayName: displayName.trim(), locale };
    if (username) body.username = username;
    const { error } = await api('/profile', { method: 'PATCH', body, token });
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

        <Card className="flex flex-col gap-5">
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

        <Button type="submit" disabled={saving || !displayName.trim() || usernameInvalid} variant={saved ? 'success' : 'primary'} className="gap-2">
          <Icon name={saved ? 'check' : saving ? 'progress_activity' : 'save'} className={saving ? 'animate-spin' : undefined} />
          {saved ? t('profile.settings.saved') : saving ? t('profile.settings.saving') : t('profile.settings.save')}
        </Button>
      </form>
    </div>
  );
}
