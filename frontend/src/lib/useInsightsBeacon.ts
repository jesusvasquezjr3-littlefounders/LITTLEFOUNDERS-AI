import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import {
  announceSessionStart,
  classifyRoute,
  configureInsights,
  flushInsights,
  flushInsightsOnHide,
  rebaseSessionStart,
  resetInsights,
  trackInsight,
  type InsightRouteClass,
} from './insights';

const HEARTBEAT_MS = 60_000;
// One flush a minute per session: telemetry must never meaningfully compete
// with product traffic for the per-IP rate budget (shared-IP households).
// The 25-event threshold in trackInsight still flushes bursts early.
const FLUSH_MS = 60_000;

/*
 * Session-lifecycle wiring for the insights beacon (/INSIGHTS.md). Mounted
 * ONCE at the App level — ABOVE the route groups — because the lesson player
 * routes live OUTSIDE AppLayout: mounting this in the layout meant entering
 * a lesson unmounted the beacon, silently discarding lesson_start /
 * lesson_abandon / audio_replay and double-counting session_start on the way
 * back. The beacon must outlive every navigation and die only with the
 * session. Unauthenticated visitors carry no beacon: nothing is configured
 * until /auth/me confirms a session AND analyticsEnabled.
 *
 * Emits: session_start once per real session (announceSessionStart dedupes
 * across re-renders and StrictMode double-mounts), a heartbeat while the tab
 * is VISIBLE, nav_view per SURFACE change (not per pathname change), and
 * session_end + a keepalive flush on pagehide — with a pageshow rebase so a
 * bfcache restore starts a fresh, disjoint session instead of double-counting.
 */
export function useInsightsBeacon(): void {
  const { session, meLoaded, analyticsEnabled, getToken } = useAuth();
  const location = useLocation();
  const startedAtRef = useRef<number>(Date.now());
  const lastRouteClassRef = useRef<InsightRouteClass | null>(null);

  const ready = meLoaded && !!session;

  useEffect(() => {
    if (!ready) {
      // Session gone (logout / expiry): forget everything, transmit nothing.
      resetInsights();
      lastRouteClassRef.current = null;
      return;
    }
    configureInsights({ enabled: analyticsEnabled, getToken });
    if (!analyticsEnabled) return;

    startedAtRef.current = Date.now();
    announceSessionStart();
    // Prime lastKnownToken immediately so an early pagehide can still flush.
    void flushInsights();

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        trackInsight('session_heartbeat', { value: HEARTBEAT_MS / 1000 });
      }
    }, HEARTBEAT_MS);
    const flusher = setInterval(() => void flushInsights(), FLUSH_MS);
    const onHide = () => {
      trackInsight('session_end', { value: Math.round((Date.now() - startedAtRef.current) / 1000) });
      flushInsightsOnHide();
    };
    const onShow = (e: PageTransitionEvent) => {
      // bfcache restore: the previous session_end already closed the old
      // interval — rebase and open a fresh one so intervals stay disjoint.
      if (e.persisted) {
        startedAtRef.current = Date.now();
        rebaseSessionStart();
        announceSessionStart();
      }
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);

    return () => {
      clearInterval(heartbeat);
      clearInterval(flusher);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
      // Deliberately NO resetInsights() here: this cleanup also runs on
      // dependency changes (e.g. a token refresh re-creating getToken) and
      // on StrictMode's probe mount — resetting would wipe the queue and the
      // session dedup mid-session. The !ready branch above owns teardown.
    };
  }, [ready, analyticsEnabled, getToken]);

  useEffect(() => {
    if (!ready || !analyticsEnabled) return;
    // Per SURFACE, not per pathname: /learn → /learn/:course → /learn/:course/territory
    // is one surface. Counting every deep navigation would skew the admin
    // "where time goes" chart toward deeply-routed surfaces.
    const routeClass = classifyRoute(location.pathname);
    if (lastRouteClassRef.current === routeClass) return;
    lastRouteClassRef.current = routeClass;
    trackInsight('nav_view', { routeClass });
  }, [ready, analyticsEnabled, location.pathname]);
}
