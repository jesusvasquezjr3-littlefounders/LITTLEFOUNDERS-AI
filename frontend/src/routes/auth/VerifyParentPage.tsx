import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { api } from '@/lib/api';
import { Badge, Button, DateField, Icon, SectionHeading } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { FileField } from '@/components/ui/FileField';
import { AUTH_LINK_CLASS, AuthShell } from './AuthShell';
import { ErrorBanner } from './ErrorBanner';

/*
 * universal → Tutor (`parent` role) upgrade — the Guardian OCR flow
 * (Jesús, 2026-07-12). The ID photo goes to Core → Guardian for an in-memory
 * OCR verdict and is never stored anywhere; we say so, prominently.
 */

type Verdict = { verified: boolean; checks?: Record<string, boolean>; role?: string };

const CHECK_KEYS = ['documentReadable', 'nameMatch', 'birthDateMatch', 'notExpired'] as const;
const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MENTOR = '/marketing/mentor-rho-bust.webp';
/* The same address the marketing footer publishes: a support route the
   visitor can already see elsewhere is one they will believe. */
const SUPPORT_EMAIL = 'informame@littlefounders.ai';

export function VerifyParentPage() {
  const { t } = useTranslation();
  const { getToken, refreshMe } = useAuth();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusAttempt, setStatusAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setVerified(null); setStatusError(null);
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<{ verified: boolean }>('/verification/parent', { token });
      if (cancelled) return;
      if (error || typeof data?.verified !== 'boolean') setStatusError(error?.code ?? 'INTERNAL');
      else setVerified(data.verified);
    })();
    return () => { cancelled = true; };
  }, [getToken, statusAttempt]);

  /*
   * The form does not open first. It used to ask for a name, a date of birth,
   * a document type and a photograph of a government ID before saying what
   * would happen to any of it - the privacy note was there, but underneath the
   * decision to start. A gated step gets explained before it gates.
   */
  const [started, setStarted] = useState(false);
  const stepsId = useId();
  const identityId = useId();
  const documentId = useId();
  const [givenNames, setGivenNames] = useState('');
  const [surnames, setSurnames] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const birthDateInvalid = birthDate.length > 0 && !BIRTH_DATE_RE.test(birthDate);
  const birthDateReady = BIRTH_DATE_RE.test(birthDate);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || birthDateInvalid) return;
    setSubmitting(true);
    setErrorCode(null);
    setVerdict(null);

    const token = await getToken();
    const form = new FormData();
    form.set('givenNames', givenNames);
    form.set('surnames', surnames);
    form.set('birthDate', birthDate);
    // A.5: no document-type field — the declaration cannot be validated
    // against the image, so the claim was removed rather than collected.
    form.set('document', file);

    const { data, error } = await api<Verdict>('/verification/parent', { formData: form, token });
    setSubmitting(false);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    setVerdict(data);
    if (data.verified) void refreshMe();
  }

  if (verified === null) return <AuthShell character={MENTOR} title={t('auth.verify.checking')}>
    {statusError ? <>
      <ErrorBanner code={statusError} onRetry={statusError === 'PARENT_VERIFICATION_REVOKED' ? undefined : () => setStatusAttempt(n => n + 1)} />
      {statusError === 'PARENT_VERIFICATION_REVOKED' && <a href={`mailto:${SUPPORT_EMAIL}`} className={AUTH_LINK_CLASS}>{SUPPORT_EMAIL}</a>}
    </> : <div role="status">{t('auth.verify.checking')}</div>}
  </AuthShell>;

  if (verified && !verdict?.verified) {
    return (
      <AuthShell character={MENTOR} title={t('auth.verify.alreadyTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          {/* The same well the success state wears, so the two verified screens
              read as one state of the product rather than two designs. */}
          <span className="lf-tile h-14 w-14 text-success-strong">
            <Icon name="verified_user" aria-hidden className="!text-[26px]" />
          </span>
          <Badge className="bg-success-soft text-success-strong">{t('auth.verify.tutorBadge')}</Badge>
          <p className="lf-body text-content">{t('auth.verify.alreadyBody')}</p>
          <Link to={APP_HOME}>
            <Button variant="secondary">{t('auth.verify.goHome')}</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (verdict?.verified) {
    return (
      <AuthShell character={MENTOR} title={t('auth.verify.successTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="lf-tile h-14 w-14 text-success-strong">
            <Icon name="verified_user" aria-hidden className="!text-[26px]" />
          </span>
          <Badge className="bg-success-soft text-success-strong">{t('auth.verify.tutorBadge')}</Badge>
          <p className="lf-body text-content">{t('auth.verify.successBody')}</p>
          <Link to={APP_HOME}>
            <Button>{t('auth.verify.goHome')}</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (!started) {
    return (
      <AuthShell character={MENTOR} title={t('auth.verify.introTitle')} subtitle={t('auth.verify.introBody')}>
        {/*
          THE THREE STEPS ARE A GROUP, so they get the study's lockup and its
          settings-row skeleton: each step is a `.lf-config-row` carrying a
          numbered `.lf-tile` well, which is what turns a loose ordered list
          into three objects a person can count at a glance.
        */}
        <section aria-labelledby={stepsId}>
          <SectionHeading as="h2" id={stepsId} icon="checklist" tone="accent">
            {t('auth.section.steps')}
          </SectionHeading>
          <ol className="flex flex-col gap-3">
            {(['step1', 'step2', 'step3'] as const).map((step, index) => (
              <li key={step} className="lf-config-row flex items-start gap-3 p-3.5">
                <span className="lf-tile lf-label h-8 w-8 !rounded-full text-accent" aria-hidden>
                  {index + 1}
                </span>
                <p className="lf-body text-content">{t(`auth.verify.${step}`)}</p>
              </li>
            ))}
          </ol>
        </section>
        {/*
          The action row in the study's tiers: ghost (the way out, no surface)
          then primary. It was a full-width primary stacked over a centred
          secondary, which gave the escape hatch a surface of its own and made
          the pair read as two offers.
        */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to={APP_HOME}
            className="lf-press lf-label inline-flex min-h-11 items-center justify-center rounded-full px-4 text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.verify.introBack')}
          </Link>
          <Button className="w-full sm:w-auto" onClick={() => setStarted(true)}>
            {t('auth.verify.introCta')}
          </Button>
        </div>
      </AuthShell>
    );
  }

  const failedChecks = verdict && !verdict.verified ? CHECK_KEYS.filter((k) => verdict.checks?.[k] === false) : [];

  return (
    <AuthShell character={MENTOR} wide title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle')}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        {/* The privacy promise, before anything else — in the study's settings
            row, so the one thing a parent has to believe on this page is a
            first-class object instead of a tinted paragraph. */}
        <div className="lf-config-row flex items-start gap-3 p-3.5">
          <span className="lf-tile h-9 w-9 text-accent">
            <Icon name="shield_lock" aria-hidden className="!text-[18px]" />
          </span>
          <p className="lf-caption text-content">{t('auth.verify.privacyNote')}</p>
        </div>

        {errorCode && <ErrorBanner code={errorCode} />}

        {failedChecks.length > 0 && (
          <div role="alert" className="rounded-md border border-warning/50 bg-warning-soft px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="lf-tile h-8 w-8 text-warning-strong">
                <Icon name="report" aria-hidden className="!text-[18px]" />
              </span>
              <p className="lf-label text-content">{t('auth.verify.failTitle')}</p>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {failedChecks.map((k) => (
                <li key={k} className="lf-caption flex items-start gap-2 text-content">
                  <Icon name="close" className="mt-px shrink-0 !text-[16px] text-error-strong" />
                  {t(`auth.verify.checks.${k}`)}
                </li>
              ))}
            </ul>
            <p className="lf-caption mt-2 text-content-muted">{t('auth.verify.retryHint')}</p>
            {/* A WAY OUT. Retry was the only affordance, so a document the OCR
                cannot read was a closed door - and the people most likely to
                hit it carry the oldest and most worn IDs. */}
            <div className="mt-3 border-t border-warning/30 pt-3">
              <p className="lf-label text-content">{t('auth.verify.failHelpTitle')}</p>
              <p className="lf-caption mt-1 text-content-muted">{t('auth.verify.failHelpBody')}</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('auth.verify.title'))}`}
                className={`${AUTH_LINK_CLASS} mt-2 inline-block`}
              >
                {t('auth.verify.failHelpCta')}
              </a>
            </div>
          </div>
        )}

        {/*
          TWO GROUPS, NOT ONE GRID. The form asked for a name, a date, a
          document TYPE and a photograph of that document in a single
          four-cell grid, which put "which document is this" a column away from
          the document itself. The lockups say what each half is for, and the
          hues key them: accent for what the person types about themselves,
          delight for the thing they photograph.
        */}
        <section aria-labelledby={identityId}>
          <SectionHeading as="h2" id={identityId} icon="badge" tone="accent">
            {t('auth.section.identity')}
          </SectionHeading>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t('auth.verify.givenNames')}
              autoComplete="given-name"
              required
              value={givenNames}
              onChange={(e) => setGivenNames(e.target.value)}
            />
            <Field
              label={t('auth.verify.surnames')}
              autoComplete="family-name"
              required
              value={surnames}
              onChange={(e) => setSurnames(e.target.value)}
            />
            <div className="sm:col-span-2">
              <DateField
                label={t('auth.verify.birthDate')}
                hint={t('auth.verify.birthDateHint')}
                required
                value={birthDate}
                onChange={setBirthDate}
                dayLabel={t('auth.verify.dayLabel')}
                monthLabel={t('auth.verify.monthLabel')}
                yearLabel={t('auth.verify.yearLabel')}
                yearPlaceholder="1988"
                error={birthDateInvalid ? t('auth.verify.birthDateInvalid') : undefined}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby={documentId}>
          <SectionHeading as="h2" id={documentId} icon="photo_camera" tone="delight">
            {t('auth.section.document')}
          </SectionHeading>
          <div className="flex flex-col gap-5">
            <FileField
              label={t('auth.verify.photo')}
              help={t('auth.verify.photoHelp')}
              file={file}
              onFile={setFile}
              chooseLabel={t('auth.verify.photoChoose')}
              replaceLabel={t('auth.verify.photoReplace')}
            />
          </div>
        </section>

        {/* Primary tier, and the only one on the form. */}
        <Button
          type="submit"
          disabled={submitting || !givenNames || !surnames || !file || !birthDateReady}
          className="w-full"
        >
          {submitting ? t('auth.verify.checking') : t('auth.verify.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
