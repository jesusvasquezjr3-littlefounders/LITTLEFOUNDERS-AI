import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { BASE_URL } from '@/lib/api';
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
 * INTERNAL-TRAFFIC EXCLUSION (Vault 0045): before ANY of the three mounts,
 * the gate asks Core whether this visitor's address is on the staff exclusion
 * list. Plausible CE has no ingestion-side IP blocklist, so this — not
 * loading the script in the first place — is the only place the exclusion can
 * actually be enforced. See useTrackingDecision below.
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
interface Umami {
  track: (...args: unknown[]) => void;
}
declare global {
  interface Window {
    plausible?: Plausible;
    umami?: Umami;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MARKETING_PREFIXES = ['/', '/how-it-works', '/families', '/faq', '/legal', '/badge'];

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

/* ── Internal-traffic exclusion (Vault 0045) ───────────────────────────────
 *
 * `pending` is a real state, not a loading detail: mounting a tracker before
 * the answer arrives would send the very pageview the exclusion exists to
 * prevent. The check costs one request per browser session.
 *
 * The localStorage flag is what makes exclusion survive a Core outage — an
 * excluded staff machine stays excluded even when the check cannot run. It is
 * also CLEARED on an `allowed` answer, so revoking an exclusion in the console
 * genuinely re-enables measurement instead of being a one-way door.
 */

type TrackingDecision = 'pending' | 'allowed' | 'excluded';

const EXCLUSION_FLAG = 'lf_analytics_excluded';
/*
 * A DEVICE-level opt-out, deliberately separate from EXCLUSION_FLAG.
 *
 * EXCLUSION_FLAG mirrors the server's IP verdict and is cleared whenever Core
 * answers "allowed" — that is what makes revoking an exclusion in the console
 * genuinely re-enable measurement rather than being a one-way door. It also
 * makes it useless for the case that actually bit us: staff browsing through a
 * consumer VPN, whose exit IP rotates and whose exclusion would silently
 * remove every other visitor behind that same exit (RUNBOOK, 2026-08-14).
 *
 * This flag is set only by an explicit human action and cleared only by
 * another one. No server answer touches it. It costs nothing, cannot affect
 * anybody else's data, and survives a changing address — which is exactly
 * what an IP-based exclusion cannot do.
 */
const DEVICE_OPT_OUT_FLAG = 'lf_analytics_device_optout';

/** True when this browser has been opted out by hand. */
export function isDeviceOptedOut(): boolean {
  return readFlag('local', DEVICE_OPT_OUT_FLAG) === '1';
}

/**
 * Turn the device-level opt-out on or off. Applies the vendor opt-outs
 * immediately so the current page stops (or resumes) reporting without a
 * reload.
 */
export function setDeviceOptOut(enabled: boolean): void {
  writeFlag('local', DEVICE_OPT_OUT_FLAG, enabled ? '1' : null);
  // The session cache holds the previous verdict; drop it or the next mount
  // would answer from a decision this action just invalidated.
  writeFlag('session', SESSION_FLAG, null);
  applyVendorOptOuts(enabled);
}
const SESSION_FLAG = 'lf_analytics_decision';

function readFlag(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null; // Safari private mode / storage disabled
  }
}

function writeFlag(store: 'local' | 'session', key: string, value: string | null): void {
  try {
    const target = store === 'local' ? window.localStorage : window.sessionStorage;
    if (value === null) target.removeItem(key);
    else target.setItem(key, value);
  } catch {
    /* storage unavailable — the in-memory decision still gates this session */
  }
}

/**
 * Belt-and-braces for anything that might load outside this gate: Plausible
 * and Umami both honour their own documented localStorage opt-outs.
 */
function applyVendorOptOuts(excluded: boolean): void {
  writeFlag('local', 'plausible_ignore', excluded ? 'true' : null);
  writeFlag('local', 'umami.disabled', excluded ? '1' : null);
}

/**
 * An automated browser, by its own admission.
 *
 * `navigator.webdriver` is set by every WebDriver-controlled session
 * (Playwright, Selenium, Puppeteer's non-stealth mode, headless Chrome under
 * automation) and is false for real users. Checking it costs nothing and stops
 * a whole class of non-human traffic before a single hit is sent — including
 * this project's own browser verification runs, which would otherwise be
 * recorded as visitors on the marketing site.
 */
function isAutomatedBrowser(): boolean {
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

export function useTrackingDecision(): TrackingDecision {
  const [decision, setDecision] = useState<TrackingDecision>(() =>
    isAutomatedBrowser() || isDeviceOptedOut() || readFlag('local', EXCLUSION_FLAG) === '1' ? 'excluded' : 'pending',
  );

  useEffect(() => {
    /*
     * The device opt-out outranks the server, like automation does. It is
     * checked BEFORE the session cache and before the fetch, so an "allowed"
     * answer can never overwrite a human's explicit choice — the failure mode
     * that makes a hand-set vendor flag useless on this site.
     */
    if (isDeviceOptedOut()) {
      setDecision('excluded');
      applyVendorOptOuts(true);
      return;
    }
    // Automation never graduates to 'allowed', whatever the server answers.
    if (isAutomatedBrowser()) {
      setDecision('excluded');
      applyVendorOptOuts(true);
      return;
    }

    const cached = readFlag('session', SESSION_FLAG);
    if (cached === 'excluded' || cached === 'allowed') {
      setDecision(cached);
      applyVendorOptOuts(cached === 'excluded');
      return;
    }

    let cancelled = false;
    const settle = (next: 'allowed' | 'excluded', persist: boolean): void => {
      if (cancelled) return;
      setDecision(next);
      applyVendorOptOuts(next === 'excluded');
      writeFlag('session', SESSION_FLAG, next);
      if (persist) writeFlag('local', EXCLUSION_FLAG, next === 'excluded' ? '1' : null);
    };

    void fetch(`${BASE_URL}/api/v1/analytics/tracking-decision`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: { excluded?: boolean; degraded?: boolean } } | null) => {
        const data = body?.data;
        if (!data) {
          // Unreadable answer: fall back to whatever this device already knows.
          settle(readFlag('local', EXCLUSION_FLAG) === '1' ? 'excluded' : 'allowed', false);
          return;
        }
        // A degraded answer is an assumption, not a fact — never let it CLEAR
        // a stored exclusion, or an outage would quietly re-admit staff.
        if (data.degraded) {
          settle(readFlag('local', EXCLUSION_FLAG) === '1' ? 'excluded' : 'allowed', false);
          return;
        }
        settle(data.excluded === true ? 'excluded' : 'allowed', true);
      })
      .catch(() => {
        settle(readFlag('local', EXCLUSION_FLAG) === '1' ? 'excluded' : 'allowed', false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return decision;
}

/** New-format Plausible: async per-site script + a CSP-safe programmatic init stub. Exported for the auto-capture test. */
export function mountPlausible(): void {
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
  /*
   * autoCapturePageviews: FALSE — load-bearing, not a preference.
   *
   * The default is true, which makes Plausible patch history.pushState and
   * record every SPA navigation by itself. Ejecting the <script> tag on the
   * next route change does NOT undo that: the runtime has already executed and
   * its History hook survives the node's removal. So a consented visitor who
   * landed on a marketing page carried Plausible with them into /signup,
   * /learn and /admin/* — verified in production on 2026-08-14, where a single
   * day's native pageviews included /admin/analytics and /admin/users, which
   * the boundary in pulse/AGENTS.md forbids outright.
   *
   * Pageviews are therefore fired MANUALLY, once per navigation the gate has
   * already approved. This is exactly the treatment GA4 received here
   * (send_page_view:false plus a manual page_view); Plausible never got it.
   */
  window.plausible.init?.({ autoCapturePageviews: false });
}

/** One pageview for a route the acquisition gate has already allowed. */
function trackPlausiblePageview(): void {
  window.plausible?.('pageview');
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

/*
 * Emit one Umami pageview for the CURRENT route.
 *
 * Umami's tracker is deferred, so on the mount that creates the tag
 * `window.umami` does not exist yet and a direct call would drop the very
 * first pageview — the landing page, i.e. the one acquisition reporting cares
 * about most. Defer to the script's own load event in that case. Subsequent
 * navigations take the fast path because the tracker is already resident.
 */
export function mountUmami(): void {
  if (!UMAMI_SRC || !UMAMI_WEBSITE_ID) return;
  mountScript('lf-umami', UMAMI_SRC, { 'website-id': UMAMI_WEBSITE_ID, 'auto-track': 'false' });
}

export function trackUmamiPageview(): void {
  if (window.umami) {
    window.umami.track();
    return;
  }
  const el = document.getElementById('lf-umami');
  if (!el) return;
  el.addEventListener('load', () => window.umami?.track(), { once: true });
}

function ejectScript(id: string): void {
  document.getElementById(id)?.remove();
}

/** GA4 gtag loader (public marketing surfaces only — see the module header). */
export function mountGa4(): void {
  if (!GA4_ID || document.getElementById('lf-ga4')) return;
  const dataLayer = (window.dataLayer = window.dataLayer ?? []);
  /*
   * MUST be a `function` that pushes `arguments` — not an arrow pushing a rest
   * array. gtag.js processes the dataLayer queue by inspecting each entry as an
   * `arguments` object; a real Array is silently ignored, so `js`, `config` and
   * every `event` are discarded and the property receives NOTHING while
   * gtag.js itself loads normally and the console shows no error.
   *
   * That is exactly what happened: GA4 recorded zero data for three weeks
   * (2026-07-24 → 2026-08-14) with a healthy-looking tag. Proven in production
   * over CDP, not deduced — the live dataLayer held `[object Array]` entries
   * and zero `/g/collect` requests; re-registering this function and replaying
   * the same commands produced a collect request immediately.
   */
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
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

/*
 * ── Acquisition conversion goals ───────────────────────────────────────────
 *
 * Until now both trackers received nothing but pageviews, so the console
 * could say which marketing page was VISITED but never which one converted.
 * The funnel that used to answer that lives in GA4-imported history; nothing
 * in the running product emitted a single custom event.
 *
 * SCOPE IS DELIBERATELY NARROW, and it is a §1.9 boundary decision rather
 * than a limitation: only actions taken ON a public marketing surface by an
 * anonymous, consented visitor are reported. Product events (onboarding
 * steps, placement answers, lesson activity) are NOT sent here — they belong
 * to first-party Insights, which has the kid-consent gate. Sending them to a
 * third party is exactly the boundary violation this session spent its time
 * removing, and a conversion metric is not worth reopening it.
 *
 * The emitter reuses the SAME predicate as the pageview path, so a goal can
 * never be reported from a surface a pageview would not have been.
 */

/** Goal names are a closed set — a typo must not silently create a new goal. */
export const MARKETING_GOALS = [
  'cta_signup_start',
  'cta_secondary',
  'guest_start',
] as const;
export type MarketingGoal = (typeof MARKETING_GOALS)[number];

export function trackMarketingGoal(
  goal: MarketingGoal,
  context: { pathname: string; session: object | null | undefined; meLoaded: boolean },
): void {
  if (isAutomatedBrowser() || isDeviceOptedOut()) return;
  if (readFlag('local', EXCLUSION_FLAG) === '1') return;
  if (!shouldTrackPublicAcquisition(context.pathname, context.session, context.meLoaded, hasCookieConsent())) return;

  // Both tools, one call: two behavioural datasets disagreeing about the same
  // conversion is worse than either one alone.
  window.plausible?.(goal, { props: { path: context.pathname } });
  window.umami?.track(goal, { path: context.pathname });
  window.gtag?.('event', goal, { page_path: context.pathname });
}

export function AnalyticsScripts({ consentVersion = 0 }: { consentVersion?: number }) {
  const { session, roles, meLoaded, analyticsEnabled } = useAuth();
  const { pathname } = useLocation();
  const decision = useTrackingDecision();
  const measurable = decision === 'allowed';

  // Public acquisition only. Product behavior lives in first-party Insights
  // (and, for consented adult parent surfaces, Umami), not in this traffic KPI.
  useEffect(() => {
    if (measurable && shouldTrackPublicAcquisition(pathname, session, meLoaded, hasCookieConsent())) {
      mountPlausible();
      // Fired per approved navigation, because the script no longer self-fires.
      trackPlausiblePageview();
    } else {
      ejectScript('lf-plausible');
    }
  }, [session, meLoaded, pathname, consentVersion, measurable]);

  // Umami — adult surfaces only; kid sessions eject unconditionally.
  useEffect(() => {
    if (!UMAMI_SRC || !UMAMI_WEBSITE_ID) return;

    const isGuest = session === null;
    const isKid = roles.includes('kid');
    const isParent = roles.includes('parent');

    const shouldMount =
      measurable &&
      !isKid &&
      !isAdminPath(pathname) &&
      ((isGuest && meLoaded && isMarketingPath(pathname) && hasCookieConsent()) || (session != null && meLoaded && isParent && analyticsEnabled));

    if (shouldMount) {
      /*
       * auto-track: FALSE — the same failure Plausible had, for the same
       * reason. Umami's tracker hooks history.pushState on load and then
       * reports every SPA navigation itself, so `!isAdminPath(pathname)`
       * above only ever decided whether to ADD the script tag; it could not
       * stop a tracker that was already resident. Ejecting the node does not
       * unhook history. Production confirmed it on 2026-08-14: /admin and
       * /admin/analytics were among the top recorded paths despite the gate.
       *
       * With auto-track off, the gate and the emission are the same decision.
       */
      mountUmami();
      trackUmamiPageview();
    } else {
      ejectScript('lf-umami');
    }
  }, [session, roles, meLoaded, analyticsEnabled, pathname, measurable]);

  /*
   * GA4 — public marketing pages only, never app/kid (module header §1.9 scope).
   *
   * The session check is load-bearing and was MISSING: GA4 gated only on
   * "marketing path + not a kid", so every signed-in visitor — including staff
   * checking the public site between admin tasks — was recorded as marketing
   * traffic, while Plausible (which requires an anonymous session) was not.
   * The two tools measured different populations and could not be reconciled.
   * GA4 now follows the same acquisition boundary as Plausible.
   */
  useEffect(() => {
    if (!GA4_ID) return;
    const onMarketing =
      measurable && shouldTrackPublicAcquisition(pathname, session, meLoaded, hasCookieConsent()) && !roles.includes('kid');
    // Re-assert the hard kill-switch every route change: GA4 stays fully inert
    // off marketing paths / for kids, even if its script is already resident.
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA4_ID}`] = !onMarketing;
    if (!onMarketing) {
      ejectScript('lf-ga4');
      return;
    }
    mountGa4();
    window.gtag?.('event', 'page_view', { page_path: pathname });
  }, [pathname, roles, consentVersion, session, meLoaded, measurable]);

  return null;
}
