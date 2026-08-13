import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { hasCookieConsent } from '@/lib/visitor';

/*
 * Pulse tracker mounting — the §1.9 fence, enforced in ONE place.
 *
 * Plausible: cookieless, no PII, no persistent identifiers, raw IP/UA never
 * stored (verified against its data policy before adoption — WALKTHROUGH.md
 * 2026-07-20). It measures PUBLIC ACQUISITION ONLY: an identified user,
 * authentication callback, product route, or /admin route must never create
 * a Plausible pageview. This prevents OAuth redirects (accounts.google.com)
 * and staff work from masquerading as organic/user traffic. Public marketing
 * measurement waits for explicit optional consent. Uses Plausible's new-format per-site
 * script (`/js/pa-<id>.js` + `plausible.init()`, v3.2.x): the site domain is
 * baked into the hashed file (no data-domain), and autoCapturePageviews is on
 * by default so SPA route changes track via its History hook — no manual
 * pageview calls. VITE_PLAUSIBLE_SRC is the per-site script URL from
 * Plausible's "Script installation" screen; it is public (embedded on every
 * page), not a secret. We reproduce the init stub PROGRAMMATICALLY (not an
 * inline <script>) so a strict CSP can't block it.
 *
 * Umami: behavioral capture (events; heatmaps/replay ship with its recorder).
 * NON-NEGOTIABLE (§1.9 + pulse/AGENTS.md #4): it must NEVER observe a
 * kid-role session. Policy (WALKTHROUGH.md decision log 2026-07-20):
 *   - guests → marketing pages only (never the auth trust surfaces),
 *   - signed-in parent → parent product surfaces only,
 *   - /admin/* → never (operator work is not customer behavior),
 *   - kid role present, or any other role → never; eject if already mounted
 *     (script removal stops all future capture in the session).
 *
 * GA4 (Google Analytics): DUAL-TRACKING, PUBLIC PAGES ONLY. Re-added alongside
 * Plausible per an explicit product decision (2026-07-22). Unlike Plausible and
 * Umami — both cookieless/no-PII — GA4 sets cookies and shares data with Google,
 * so its scope is the NARROWEST of the three and enforced here:
 *   - marketing/public paths ONLY — never the app, never the auth trust surfaces,
 *   - never a kid-role session (§1.9),
 *   - a hard `ga-disable-<id>` kill-switch is re-asserted on every route change and
 *     page_views are fired MANUALLY (send_page_view:false), so GA4 can never
 *     observe an app/kid pathname even if its script stays resident across an SPA
 *     navigation out of the marketing area.
 * COOKIE NOTE: GA4 uses cookies and is mounted only after explicit optional
 * consent. Revoking that choice removes the script and known GA4 cookies.
 *
 * Plausible/Umami self-track SPA navigations; env-unset (local dev) = no-op.
 */

const PLAUSIBLE_SRC: string | undefined = import.meta.env.VITE_PLAUSIBLE_SRC;
const UMAMI_SRC: string | undefined = import.meta.env.VITE_UMAMI_SRC;
const UMAMI_WEBSITE_ID: string | undefined = import.meta.env.VITE_UMAMI_WEBSITE_ID;
const GA4_ID: string | undefined = import.meta.env.VITE_GA4_MEASUREMENT_ID;

interface Plausible {
  (...args: unknown[]): void;
  q?: unknown[][];
  o?: unknown;
  init?: (opts?: unknown) => void;
}
declare global {
  interface Window {
    plausible?: Plausible;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MARKETING_PREFIXES = ['/', '/how-it-works', '/families', '/faq', '/legal'];

export function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return MARKETING_PREFIXES.slice(1).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Only anonymous, consented marketing landings are web-acquisition traffic.
 * `meLoaded` is load-bearing: until identity restoration finishes, an existing
 * staff session must not leak one pageview from a public route.
 */
export function shouldTrackPublicAcquisition(
  pathname: string,
  session: object | null | undefined,
  meLoaded: boolean,
  consented: boolean,
): boolean {
  return meLoaded && session === null && consented && isMarketingPath(pathname);
}

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** New-format Plausible: async per-site script + a CSP-safe programmatic init stub. */
function mountPlausible(): void {
  if (!PLAUSIBLE_SRC || document.getElementById('lf-plausible')) return;
  const el = document.createElement('script');
  el.id = 'lf-plausible';
  el.async = true;
  el.src = PLAUSIBLE_SRC;
  document.head.appendChild(el);
  // Queue calls until the async script defines the real impl, then init().
  if (!window.plausible) {
    const q: unknown[][] = [];
    const stub = ((...args: unknown[]) => {
      q.push(args);
    }) as Plausible;
    stub.q = q;
    stub.init = (opts?: unknown) => {
      stub.o = opts ?? {};
    };
    window.plausible = stub;
  }
  window.plausible.init?.();
}

function mountScript(id: string, src: string, dataset: Record<string, string>): void {
  if (document.getElementById(id)) return;
  const el = document.createElement('script');
  el.id = id;
  el.defer = true;
  el.src = src;
  for (const [k, v] of Object.entries(dataset)) el.setAttribute(`data-${k}`, v);
  document.head.appendChild(el);
}

function ejectScript(id: string): void {
  document.getElementById(id)?.remove();
}

/** GA4 gtag loader (public marketing surfaces only — see the module header). */
function mountGa4(): void {
  if (!GA4_ID || document.getElementById('lf-ga4')) return;
  const dataLayer = (window.dataLayer = window.dataLayer ?? []);
  window.gtag = (...args: unknown[]) => {
    dataLayer.push(args);
  };
  const el = document.createElement('script');
  el.id = 'lf-ga4';
  el.async = true;
  el.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(el);
  window.gtag('js', new Date());
  // send_page_view:false — pageviews are fired manually, only on marketing paths,
  // so GA4 never records an app/kid pathname (module header §1.9 scope).
  window.gtag('config', GA4_ID, { send_page_view: false });
}

export function AnalyticsScripts({ consentVersion = 0 }: { consentVersion?: number }) {
  const { session, roles, meLoaded } = useAuth();
  const { pathname } = useLocation();

  // Public acquisition only. Product behavior lives in first-party Insights
  // (and, for consented adult parent surfaces, Umami), not in this traffic KPI.
  useEffect(() => {
    if (shouldTrackPublicAcquisition(pathname, session, meLoaded, hasCookieConsent())) mountPlausible();
    else ejectScript('lf-plausible');
  }, [session, meLoaded, pathname, consentVersion]);

  // Umami — adult surfaces only; kid sessions eject unconditionally.
  useEffect(() => {
    if (!UMAMI_SRC || !UMAMI_WEBSITE_ID) return;

    const isGuest = session === null;
    const isKid = roles.includes('kid');
    const isParent = roles.includes('parent');

    const shouldMount =
      !isKid &&
      !isAdminPath(pathname) &&
      ((isGuest && meLoaded && isMarketingPath(pathname) && hasCookieConsent()) || (session != null && meLoaded && isParent));

    if (shouldMount) {
      mountScript('lf-umami', UMAMI_SRC, { 'website-id': UMAMI_WEBSITE_ID });
    } else {
      ejectScript('lf-umami');
    }
  }, [session, roles, meLoaded, pathname]);

  // GA4 — public marketing pages only, never app/kid (module header §1.9 scope).
  useEffect(() => {
    if (!GA4_ID) return;
    const onMarketing = isMarketingPath(pathname) && !roles.includes('kid') && hasCookieConsent();
    // Re-assert the hard kill-switch every route change: GA4 stays fully inert
    // off marketing paths / for kids, even if its script is already resident.
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA4_ID}`] = !onMarketing;
    if (!onMarketing) {
      ejectScript('lf-ga4');
      return;
    }
    mountGa4();
    window.gtag?.('event', 'page_view', { page_path: pathname });
  }, [pathname, roles, consentVersion]);

  return null;
}
