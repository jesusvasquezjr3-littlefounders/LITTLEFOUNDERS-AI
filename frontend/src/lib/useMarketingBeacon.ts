import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import {
  announceSessionStart,
  flushInsights,
  flushInsightsOnHide,
  startAnonymousTracking,
  trackInsight,
} from './insights';
import { hasCookieConsent, isMarketingRoute } from './visitor';

const FLUSH_MS = 30_000;
const SCROLL_MARKS = [25, 50, 75, 100] as const;

/*
 * Anonymous acquisition beacon (/INSIGHTS.md §7) — the funnel BEFORE signup.
 *
 * Runs only when: there is no session (an authenticated visitor is covered by
 * the product beacon instead), the route is a marketing surface, and the
 * visitor granted cookie consent. Those three conditions are why an
 * unidentified — possibly kid — product session can never end up here; Core
 * enforces the same restriction server-side by rejecting non-acquisition
 * events on the anonymous path.
 *
 * Captures: page views per marketing route, CTA clicks (delegated, by the
 * element's data-cta label — a closed label, never text the user typed),
 * and scroll depth at 25/50/75/100%.
 */
export function useMarketingBeacon(consentVersion = 0): void {
  const { session, meLoaded } = useAuth();
  const { i18n } = useTranslation();
  const location = useLocation();
  const marksRef = useRef<Set<number>>(new Set());

  const active = meLoaded && !session && isMarketingRoute(location.pathname) && hasCookieConsent();

  /*
   * NOTE ON THE MISSING `startedRef` GUARD.
   *
   * This effect used to return early once it had run, to avoid emitting
   * session_start twice. But the effect's cleanup ALSO runs on every
   * dependency change — so switching language tore down the flush timer and
   * the CTA/scroll/pagehide listeners, and the guard then returned before
   * re-registering them. The visitor kept browsing and nothing more was ever
   * recorded, silently, for the rest of the visit.
   *
   * Registration is therefore unconditional (it must mirror the cleanup), and
   * the duplicate-session_start problem is solved where it belongs:
   * announceSessionStart() is idempotent per session id.
   */
  useEffect(() => {
    if (!active) return;
    if (!startAnonymousTracking(i18n.resolvedLanguage)) return;
    announceSessionStart('marketing');
    void flushInsights();

    const flusher = setInterval(() => void flushInsights(), FLUSH_MS);
    const onHide = () => {
      trackInsight('session_end', { routeClass: 'marketing' });
      flushInsightsOnHide();
    };
    window.addEventListener('pagehide', onHide);

    // Delegated CTA capture: the label comes from data-cta, a value WE author
    // in the markup — never innerText, which could contain anything.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-cta]');
      const label = el?.getAttribute('data-cta');
      if (label && /^[A-Za-z0-9._-]{1,64}$/.test(label)) {
        trackInsight('cta_click', { routeClass: 'marketing', segmentId: label });
      }
    };
    document.addEventListener('click', onClick, true);

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = Math.round((window.scrollY / scrollable) * 100);
      for (const mark of SCROLL_MARKS) {
        if (pct >= mark && !marksRef.current.has(mark)) {
          marksRef.current.add(mark);
          trackInsight('scroll_depth', { routeClass: 'marketing', value: mark });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearInterval(flusher);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onScroll);
    };
  }, [active, i18n.resolvedLanguage, consentVersion]);

  useEffect(() => {
    if (!active) return;
    marksRef.current = new Set();
    trackInsight('page_view', { routeClass: 'marketing' });
  }, [active, location.pathname]);
}
