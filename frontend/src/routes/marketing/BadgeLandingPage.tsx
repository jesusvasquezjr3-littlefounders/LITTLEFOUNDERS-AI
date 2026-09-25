import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button, Card, LoadingOverlay } from '@/components/ui';

/*
 * /badge/:token — the LEGACY badge-link landing page (0072/0073), retiring
 * under OD-20: new shares are images the parent sends, so no new link is
 * issued. Links issued before the cutover render here until they expire
 * (Core enforces revocation, expiry and the cutover on every read). From
 * BADGE_LINK_ROUTE_RETIRES_AT every such link has expired, so the page
 * shows the not-found state without asking Core; removing the route is the
 * dated runbook in docs/rebuild/policies/ACHIEVEMENT-SHARING.md.
 *
 * No viewer tracking: the badge_link_click event is retired (Appendix L
 * under OD-20 counts shares initiated, never viewer reach).
 */

/** Mirrors backend/src/services/badgeLinkWindow.ts; `npm run sharing:check` keeps them equal. */
export const BADGE_LINK_ROUTE_RETIRES_AT = '2026-10-24T00:00:00.000Z';

interface BadgePayload {
  firstName: string;
  achievementKind: 'course_badge' | 'streak' | 'goal_reached';
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
      if (Date.now() >= Date.parse(BADGE_LINK_ROUTE_RETIRES_AT)) {
        setState({ status: 'not-found' });
        return;
      }
      const { data, error } = await api<BadgePayload>(`/badges/${token}`);
      if (cancelled) return;
      if (error || !data) {
        setState({ status: 'not-found' });
        return;
      }
      setState({ status: 'ready', payload: data });
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
