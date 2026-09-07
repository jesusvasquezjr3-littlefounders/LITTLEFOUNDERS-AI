import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import { hasCookieConsent } from '@/lib/visitor';
import { Button, Card, LoadingOverlay } from '@/components/ui';

/*
 * /badge/:token — the shareable-achievement-badge loop's public landing
 * page (0072/0073). Opened by STRANGERS: no auth, no app chrome. The
 * <head> OG tags a crawler/unfurler actually reads come from the Vercel
 * function at frontend/api/badge/[token].ts, which injects them into the
 * SAME app-shell before this route ever runs — this component is what a
 * REAL visitor sees once the SPA boots.
 *
 * Click tracking (badge_link_click) goes through the SAME consent-gated
 * trackInsight()/getAnonId() path every other marketing surface uses
 * (/INSIGHTS.md) — a first-time visitor who has not yet accepted cookies
 * simply is not tracked, exactly like a first visit to "/". Nothing here
 * bypasses that gate to make this funnel's numbers more complete.
 */

interface BadgePayload {
  firstName: string;
  achievementKind: 'course_badge' | 'streak';
  achievementLabel: string;
  imageUrl: string;
}

type LoadState = { status: 'loading' } | { status: 'not-found' } | { status: 'ready'; payload: BadgePayload };

export function BadgeLandingPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await api<BadgePayload>(`/badges/${token}`);
      if (cancelled) return;
      if (error || !data) {
        setState({ status: 'not-found' });
        return;
      }
      setState({ status: 'ready', payload: data });
      // Consent-gated like every other pre-signup surface — see file header.
      if (hasCookieConsent()) {
        trackInsight('badge_link_click', { routeClass: 'marketing' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-sunken">
        <LoadingOverlay label={t('marketing.badgeShare.loading')} />
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="lf-display-lg text-content">{t('marketing.badgeShare.notFoundTitle')}</h1>
        <p className="lf-body text-content-muted">{t('marketing.badgeShare.notFoundBody')}</p>
        <Link to="/">
          <Button variant="primary">{t('marketing.badgeShare.cta')}</Button>
        </Link>
      </div>
    );
  }

  const { firstName, achievementLabel, imageUrl } = state.payload;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <img
        src={imageUrl}
        alt={t('marketing.badgeShare.imageAlt', { name: firstName, achievement: achievementLabel })}
        className="w-full max-w-xs rounded-xl shadow-xl"
        width={1080}
        height={1920}
      />
      <Card className="w-full p-6">
        <h1 className="lf-title text-content">
          {t('marketing.badgeShare.heading', { name: firstName, achievement: achievementLabel })}
        </h1>
        <p className="lf-body mt-2 text-content-muted">{t('marketing.badgeShare.body')}</p>
        <Link to="/signup" className="mt-4 block">
          <Button variant="primary" className="w-full">
            {t('marketing.badgeShare.cta')}
          </Button>
        </Link>
      </Card>
    </div>
  );
}

export default BadgeLandingPage;
