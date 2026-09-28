import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { ShellRoot } from '@/app-shell/ShellRoot';
import { BadgeLanding, type BadgeLandingState, type BadgePayload } from '@/rebuild/site/BadgeLanding';
import { useSiteActions } from './siteActions';

/*
 * /badge/:token — the LEGACY badge-link landing page (0072/0073), retiring
 * under OD-20: new shares are images the parent sends, so no new link is
 * issued. Links issued before the cutover render here until they expire
 * (Core enforces revocation, expiry and the cutover on every read). From
 * BADGE_LINK_ROUTE_RETIRES_AT every such link has expired, so the page
 * shows the expired state without asking Core; removing the route is the
 * dated runbook in docs/rebuild/policies/ACHIEVEMENT-SHARING.md.
 *
 * The body is the rebuilt M7 surface (rebuild/site/BadgeLanding.tsx, S10L.3);
 * this bridge owns the fetch and the session-aware call to action.
 *
 * No viewer tracking: the badge_link_click event is retired (Appendix L
 * under OD-20 counts shares initiated, never viewer reach).
 */

/** Mirrors backend/src/services/badgeLinkWindow.ts; `npm run sharing:check` keeps them equal. */
export const BADGE_LINK_ROUTE_RETIRES_AT = '2026-10-24T00:00:00.000Z';

export function BadgeLandingPage() {
  const { token = '' } = useParams();
  const { locale, onNavigate, start } = useSiteActions();
  const [state, setState] = useState<BadgeLandingState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      if (Date.now() >= Date.parse(BADGE_LINK_ROUTE_RETIRES_AT)) {
        setState({ status: 'expired' });
        return;
      }
      const { data, error } = await api<BadgePayload>(`/badges/${encodeURIComponent(token)}`);
      if (cancelled) return;
      setState(error || !data ? { status: 'expired' } : { status: 'ready', payload: data });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return <ShellRoot>
    <BadgeLanding locale={locale} state={state} start={start} onNavigate={onNavigate} />
  </ShellRoot>;
}

export default BadgeLandingPage;
