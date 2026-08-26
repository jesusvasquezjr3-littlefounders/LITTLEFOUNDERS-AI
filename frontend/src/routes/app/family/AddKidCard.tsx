import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import type { Locale } from '@/i18n';
import { Button, Card, DateField, Icon } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';

/*
 * ADD A CHILD — the flow that makes the `kid` role reachable at all.
 *
 * Until this existed, /family listed children the product had no way to
 * create: Guardian verification granted `parent`, and then nothing. The legal
 * terms describe a CHILD account "vinculada obligatoriamente" to a TUTOR
 * account, so the gap was a promise with no code path behind it.
 *
 * WHAT IS ASKED FOR, AND WHAT IS NOT. A first name, a username and a
 * passphrase, plus an optional date of birth. No email - the child does not
 * have one and must not be made to get one; Core creates the auth user with a
 * synthetic `.invalid` address that never receives mail. No surname, no
 * address. That is the §1.9 ceiling ("age band + first name") applied at the
 * point of collection rather than apologised for afterwards, and the copy says
 * so on the form rather than in a policy nobody opens.
 *
 * The parent chooses the passphrase, so the success panel repeats the USERNAME
 * and not the passphrase: showing a credential back to someone who just typed
 * it teaches nothing and puts it on screen for anyone standing behind them.
 */

export interface CreatedKid {
  userId: string;
  displayName: string | null;
  username: string | null;
  analyticsConsent: boolean;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function AddKidCard({ onCreated }: { onCreated: (kid: CreatedKid) => void }) {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();

  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; username: string } | null>(null);

  // Normalised as it is typed, for the same reason Core normalises it: a
  // parent capitalising their child's name is not making a mistake.
  const handle = username.trim().toLowerCase();
  const usernameInvalid = handle.length > 0 && !USERNAME_RE.test(handle);
  const birthDateInvalid = birthDate.length > 0 && !BIRTH_DATE_RE.test(birthDate);
  const ready =
    displayName.trim().length > 0 &&
    USERNAME_RE.test(handle) &&
    passphrase.length >= 8 &&
    !birthDateInvalid;

  function reset() {
    setDisplayName('');
    setUsername('');
    setPassphrase('');
    setBirthDate('');
    setErrorCode(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setErrorCode(null);
    const token = await getToken();
    const { data, error } = await api<{ kid: CreatedKid }>('/family/kids', {
      method: 'POST',
      token,
      body: {
        displayName: displayName.trim(),
        username: handle,
        passphrase,
        birthDate: birthDate.length > 0 ? birthDate : null,
        locale: (i18n.resolvedLanguage as Locale) ?? 'en-US',
      },
    });
    setSubmitting(false);
    if (error || !data) {
      setErrorCode(error?.code ?? 'INTERNAL');
      return;
    }
    setDone({ name: data.kid.displayName ?? displayName.trim(), username: handle });
    onCreated({ ...data.kid, analyticsConsent: false });
    reset();
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center sm:p-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
          <Icon name="celebration" className="text-success-strong" />
        </span>
        <h2 className="lf-title text-content">{t('family.addKid.doneTitle')}</h2>
        <p className="lf-body max-w-md text-content-muted">
          {t('family.addKid.doneBody', { name: done.name, username: `@${done.username}` })}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setDone(null);
            setOpen(false);
          }}
        >
          {t('family.addKid.doneCta')}
        </Button>
      </Card>
    );
  }

  if (!open) {
    return (
      <Button className="w-full sm:w-auto sm:self-start" onClick={() => setOpen(true)}>
        <Icon name="person_add" />
        {t('family.addKid.cta')}
      </Button>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="lf-title text-content">{t('family.addKid.title')}</h2>
      <p className="lf-body mt-2 text-content-muted">{t('family.addKid.body')}</p>

      {/* The data-minimisation promise BEFORE the fields, the same placement
          and the same shield the Guardian form uses - a privacy note is not
          fine print (/DESIGN.md §Screen Recipes → Auth). */}
      <div className="mt-5 flex items-start gap-3 rounded-md bg-primary-soft/50 px-4 py-3">
        <Icon name="shield_lock" className="mt-0.5 shrink-0 text-primary" />
        <p className="lf-caption text-content">{t('family.addKid.privacy')}</p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} noValidate className="mt-5 flex flex-col gap-5">
        {errorCode && <ErrorBanner code={errorCode} />}
        <Field
          label={t('family.addKid.displayName')}
          hint={t('family.addKid.displayNameHint')}
          autoComplete="off"
          required
          maxLength={80}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Field
          label={t('family.addKid.username')}
          hint={t('family.addKid.usernameHint')}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={usernameInvalid ? t('family.addKid.usernameHint') : undefined}
        />
        <Field
          label={t('family.addKid.passphrase')}
          hint={t('family.addKid.passphraseHint')}
          type={showPassphrase ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          trailing={
            <button
              type="button"
              aria-label={showPassphrase ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
              aria-pressed={showPassphrase}
              onClick={() => setShowPassphrase((s) => !s)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name={showPassphrase ? 'visibility_off' : 'visibility'} />
            </button>
          }
        />
        <DateField
          label={t('family.addKid.birthDate')}
          hint={t('family.addKid.birthDateHint')}
          value={birthDate}
          onChange={setBirthDate}
          dayLabel={t('family.addKid.dayLabel')}
          monthLabel={t('family.addKid.monthLabel')}
          yearLabel={t('family.addKid.yearLabel')}
          yearPlaceholder="2016"
          error={birthDateInvalid ? t('auth.verify.birthDateInvalid') : undefined}
        />
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button type="submit" disabled={!ready || submitting} className="w-full sm:w-auto">
            {submitting ? t('family.addKid.submitting') : t('family.addKid.submit')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            {t('family.addKid.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
