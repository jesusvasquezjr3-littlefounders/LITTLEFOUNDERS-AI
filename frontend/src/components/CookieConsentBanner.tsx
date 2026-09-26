import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Button, Icon } from '@/components/ui';
import { getCookieConsent, isMarketingRoute, setCookieConsent } from '@/lib/visitor';

const OPEN_PREFERENCES_EVENT = 'lf:open-cookie-preferences';

/** Reopens the cookie preferences (the rebuilt site footer's control uses this; no UI component crosses over). */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}

/*
 * Public cookie choices are deliberately separate from guardian analytics
 * consent. This surface governs guest marketing technologies; a child's
 * behavioural collection is still decided by the verified guardian flow.
 */

export function CookiePreferencesButton({ className = '' }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))}
      className={`lf-body inline-flex min-h-11 items-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className || 'text-on-inverse-muted hover:text-on-inverse focus-visible:ring-on-inverse'}`}
    >
      {t('cookies.manage')}
    </button>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  status,
}: {
  icon: string;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-outline/60 bg-surface-sunken/40 p-4">
      <Icon name={icon} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="lf-label text-content">{title}</h3>
          <span className="lf-caption rounded-full bg-success-soft px-2.5 py-1 font-bold text-success-strong">{status}</span>
        </div>
        <p className="lf-caption mt-1 max-w-prose text-content-muted">{description}</p>
      </div>
    </div>
  );
}

function PreferencesDialog({
  onClose,
  onDecision,
}: {
  onClose: () => void;
  onDecision: (granted: boolean) => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const decide = (granted: boolean) => {
    setCookieConsent(granted ? 'granted' : 'denied');
    onDecision(granted);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-base/80 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        className="lf-glass flex max-h-[calc(100dvh-2rem)] min-w-0 w-full max-w-2xl flex-col overflow-hidden rounded-md shadow-pop sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline/50 p-5 sm:p-7">
          <div>
            <p className="lf-caption font-bold uppercase tracking-[0.14em] text-primary">{t('cookies.eyebrow')}</p>
            <h2 id="cookie-preferences-title" className="lf-headline mt-2 text-content">{t('cookies.preferencesTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cookies.close')}
            className="lf-press flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-sunken hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="close" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7">
          <p className="lf-body max-w-prose text-content-muted">{t('cookies.preferencesIntro')}</p>
          <div className="space-y-3">
            <PreferenceRow
              icon="security"
              title={t('cookies.necessaryTitle')}
              description={t('cookies.necessaryDescription')}
              status={t('cookies.alwaysOn')}
            />
            <PreferenceRow
              icon="campaign"
              title={t('cookies.attributionTitle')}
              description={t('cookies.attributionDescription')}
              status={t('cookies.optional')}
            />
            <PreferenceRow
              icon="insights"
              title={t('cookies.analyticsTitle')}
              description={t('cookies.analyticsDescription')}
              status={t('cookies.optional')}
            />
          </div>
          <p className="lf-caption text-content-faint">
            {t('cookies.privacyNote')}{' '}
            <Link to="/legal/privacy" onClick={onClose} className="font-bold text-primary underline-offset-4 hover:underline">
              {t('cookies.privacyLink')}
            </Link>
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-outline/50 p-5 sm:flex-row sm:justify-end sm:p-7">
          <Button variant="secondary" onClick={() => decide(false)}>
            {t('cookies.rejectOptional')}
          </Button>
          <Button onClick={() => decide(true)}>
            {t('cookies.acceptOptional')}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function CookieConsentBanner({ onDecision }: { onDecision?: (granted: boolean) => void }) {
  const { t } = useTranslation();
  const { session, meLoaded } = useAuth();
  const location = useLocation();
  const [consent, setConsent] = useState(getCookieConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const open = () => {
      setConsent(getCookieConsent());
      setPreferencesOpen(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, open);
  }, []);

  const eligible = meLoaded && !session && isMarketingRoute(location.pathname);

  const onDecisionMade = (granted: boolean) => {
    setConsent(granted ? 'granted' : 'denied');
    setPreferencesOpen(false);
    onDecision?.(granted);
  };

  const decide = (granted: boolean) => {
    setCookieConsent(granted ? 'granted' : 'denied');
    onDecisionMade(granted);
  };

  return (
    <>
      {consent === 'unset' && eligible ? createPortal(
        <div
          role="dialog"
          aria-live="polite"
          aria-label={t('cookies.title')}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-outline bg-surface/95 px-4 py-4 shadow-glass-lg backdrop-blur md:px-6"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <div className="flex min-w-0 flex-1 gap-3">
              <Icon name="cookie" className="mt-0.5 hidden shrink-0 text-[24px] text-primary sm:block" aria-hidden />
              <div className="min-w-0">
                <p className="lf-label text-content">{t('cookies.title')}</p>
                <p className="lf-caption mt-1 max-w-3xl text-content-muted">{t('cookies.body')}</p>
                <button
                  type="button"
                  onClick={() => setPreferencesOpen(true)}
                  className="lf-caption mt-2 inline-flex min-h-9 items-center rounded-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('cookies.configure')}
                </button>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 sm:justify-end">
              <Button variant="secondary" onClick={() => decide(false)} className="flex-1 md:flex-none">
                {t('cookies.rejectOptional')}
              </Button>
              <Button onClick={() => decide(true)} className="flex-1 md:flex-none">
                {t('cookies.acceptOptional')}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
      {preferencesOpen ? <PreferencesDialog onClose={() => setPreferencesOpen(false)} onDecision={onDecisionMade} /> : null}
    </>
  );
}

export default CookieConsentBanner;
