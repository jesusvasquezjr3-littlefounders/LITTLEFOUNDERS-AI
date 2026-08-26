import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { api } from '@/lib/api';
import { Badge, Button, DateField, Dropdown, Icon, type DropdownOption } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { FileField } from '@/components/ui/FileField';
import { AUTH_LINK_CLASS, AuthShell } from './AuthShell';
import { ErrorBanner } from './ErrorBanner';

/*
 * universal → Tutor (`parent` role) upgrade — the Guardian OCR flow
 * (Jesús, 2026-07-12). The ID photo goes to Core → Guardian for an in-memory
 * OCR verdict and is never stored anywhere; we say so, prominently.
 */

type DocumentType = 'national-id' | 'passport' | 'driver-license';
type Verdict = { verified: boolean; checks?: Record<string, boolean>; role?: string };

const CHECK_KEYS = ['documentReadable', 'nameMatch', 'birthDateMatch', 'notExpired'] as const;
const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MENTOR = '/marketing/mentor-rho-bust.webp';
/* The same address the marketing footer publishes: a support route the
   visitor can already see elsewhere is one they will believe. */
const SUPPORT_EMAIL = 'informame@littlefounders.ai';

export function VerifyParentPage() {
  const { t } = useTranslation();
  const { roles, getToken, refreshMe } = useAuth();

  /*
   * The form does not open first. It used to ask for a name, a date of birth,
   * a document type and a photograph of a government ID before saying what
   * would happen to any of it - the privacy note was there, but underneath the
   * decision to start. A gated step gets explained before it gates.
   */
  const [started, setStarted] = useState(false);
  const [givenNames, setGivenNames] = useState('');
  const [surnames, setSurnames] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('national-id');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const birthDateInvalid = birthDate.length > 0 && !BIRTH_DATE_RE.test(birthDate);
  const birthDateReady = BIRTH_DATE_RE.test(birthDate);
  const isParent = roles.includes('parent');

  const docTypeOptions: DropdownOption<DocumentType>[] = [
    { value: 'national-id', label: t('auth.verify.docTypes.nationalId') },
    { value: 'passport', label: t('auth.verify.docTypes.passport') },
    { value: 'driver-license', label: t('auth.verify.docTypes.driverLicense') },
  ];

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
    form.set('documentType', documentType);
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

  if (isParent && !verdict?.verified) {
    return (
      <AuthShell character={MENTOR} title={t('auth.verify.alreadyTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
            <Icon name="verified_user" className="text-success-strong" />
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
        <ol className="flex flex-col gap-4">
          {(['step1', 'step2', 'step3'] as const).map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="lf-label flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                {index + 1}
              </span>
              <p className="lf-body text-content">{t(`auth.verify.${step}`)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-7 flex flex-col gap-3">
          <Button className="w-full" onClick={() => setStarted(true)}>
            {t('auth.verify.introCta')}
          </Button>
          <Link to={APP_HOME} className="self-center">
            <Button variant="secondary">{t('auth.verify.introBack')}</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  const failedChecks = verdict && !verdict.verified ? CHECK_KEYS.filter((k) => verdict.checks?.[k] === false) : [];

  return (
    <AuthShell character={MENTOR} wide title={t('auth.verify.title')} subtitle={t('auth.verify.subtitle')}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        {/* The privacy promise, before anything else. */}
        <div className="flex items-start gap-3 rounded-md bg-primary-soft/50 px-4 py-3">
          <Icon name="shield_lock" className="mt-0.5 shrink-0 text-primary" />
          <p className="lf-caption text-content">{t('auth.verify.privacyNote')}</p>
        </div>

        {errorCode && <ErrorBanner code={errorCode} />}

        {failedChecks.length > 0 && (
          <div role="alert" className="rounded-md border border-warning/50 bg-warning-soft px-4 py-3">
            <p className="lf-label text-content">{t('auth.verify.failTitle')}</p>
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
          <div className="flex flex-col gap-1.5">
            <span className="lf-label text-content">{t('auth.verify.documentType')}</span>
            <Dropdown
              value={documentType}
              options={docTypeOptions}
              onChange={setDocumentType}
              ariaLabel={t('auth.verify.documentType')}
            />
          </div>
        </div>
        <FileField
          label={t('auth.verify.photo')}
          help={t('auth.verify.photoHelp')}
          file={file}
          onFile={setFile}
          chooseLabel={t('auth.verify.photoChoose')}
          replaceLabel={t('auth.verify.photoReplace')}
        />
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
