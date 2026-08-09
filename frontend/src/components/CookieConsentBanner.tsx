import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Button, Icon } from '@/components/ui';
import { getCookieConsent, isMarketingRoute, setCookieConsent } from '@/lib/visitor';

/*
 * First-party cookie consent (/INSIGHTS.md §7).
 *
 * Shown once, on marketing surfaces only, until the visitor chooses. The two
 * choices are equally weighted and equally easy — no pre-ticked box, no
 * "accept" styled as the only way forward, no cookie wall. That is both the
 * §1.9 "no dark patterns" rule and the only version that survives an
 * LGPD/LFPDPPP look.
 *
 * Declining does not merely stop future writes: setCookieConsent('denied')
 * DELETES the identity cookie, so the visitor leaves with nothing on their
 * machine.
 */
export function CookieConsentBanner({ onDecision }: { onDecision?: (granted: boolean) => void }) {
  const { t } = useTranslation();
  const { session, meLoaded } = useAuth();
  const location = useLocation();
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    setDecided(getCookieConsent() !== 'unset');
  }, []);

  /*
   * MARKETING SURFACES ONLY — the header comment above has always said so,
   * but the banner was mounted at the app root and rendered everywhere. It
   * therefore appeared over the product, including a kid's lesson, where it
   * is both wrong and harmful: it is a fixed bottom bar, and the lesson
   * player's action bar is also fixed to the bottom, so it covered the button
   * a child needs to answer. A consent question also has no meaning inside a
   * signed-in product session — the cookie it governs is the pre-signup
   * visitor id, and the beacon that would use it does not run here.
   *
   * Waiting for meLoaded avoids a flash of the banner on a signed-in reload,
   * when the session is known only after /auth/me answers.
   */
  const eligible = meLoaded && !session && isMarketingRoute(location.pathname);
  if (decided || !eligible) return null;

  function decide(choice: 'granted' | 'denied') {
    setCookieConsent(choice);
    setDecided(true);
    onDecision?.(choice === 'granted');
  }

  return createPortal(
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('cookies.title')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-outline bg-surface/95 px-4 py-4 shadow-glass-lg backdrop-blur md:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <Icon name="cookie" className="hidden shrink-0 text-[24px] text-primary md:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="lf-label text-content">{t('cookies.title')}</p>
          <p className="lf-caption text-content-muted">{t('cookies.body')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => decide('denied')} className="flex-1 md:flex-none">
            {t('cookies.decline')}
          </Button>
          <Button onClick={() => decide('granted')} className="flex-1 md:flex-none">
            {t('cookies.accept')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CookieConsentBanner;
