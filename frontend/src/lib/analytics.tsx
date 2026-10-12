import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { hasCookieConsent } from '@/lib/visitor';

/*
 * Consent-gated web analytics for the public site.
 *
 * Plausible and Umami (cookieless, no personal data) and Google Analytics 4
 * (which sets cookies and shares data with Google) load only after the
 * visitor accepts optional cookies, never in an automated browser, and never
 * on a device that opted out. Declining or revoking consent removes the
 * scripts and the GA4 cookies. Pageviews are fired by hand, once per route, because both trackers
 * would otherwise keep observing navigations after their script is removed.
 *
 * A tracker is never told an address's query string, only its path: a query can carry something
 * private (the token of an unsubscribe link). And two pages are never measured at all, nor is any
 * tracker's script loaded on them: the unsubscribe page and the page a Google sign-in returns to
 * (`PRIVATE_PATHS`). A page whose address carries a secret goes in that list.
 *
 * VITE_PLAUSIBLE_SRC is Plausible's per-site script URL and
 * VITE_GA4_MEASUREMENT_ID is the GA4 measurement id (G-XXXX); both are public,
 * not secrets. Without the variables set (local development) everything is a
 * no-op.
 */

const PLAUSIBLE_SRC: string | undefined = import.meta.env.VITE_PLAUSIBLE_SRC;

const UMAMI_SRC: string | undefined = import.meta.env.VITE_UMAMI_SRC;

const UMAMI_WEBSITE_ID: string | undefined = import.meta.env.VITE_UMAMI_WEBSITE_ID;

const GA4_ID: string | undefined = import.meta.env.VITE_GA4_MEASUREMENT_ID;

/** The one option this site passes to Plausible's `init`. */
interface PlausibleOptions {
  autoCapturePageviews?: boolean;
}

interface Plausible {
  (...args: unknown[]): void;
  q?: unknown[][];
  o?: PlausibleOptions;
  init?: (opts?: PlausibleOptions) => void;
}

interface Umami {
  track: (...args: unknown[]) => void;
}

/** What Umami is about to send for a pageview. Only the address is replaced. */
interface UmamiPageview {
  url?: string;
  title?: string;
  referrer?: string;
  hostname?: string;
  language?: string;
  screen?: string;
  website?: string;
}

declare global {
  interface Window {
    plausible?: Plausible;
    umami?: Umami;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    /** GA4's own switch: `true` under `ga-disable-<measurement id>` stops that property from sending anything. */
    [gaDisable: `ga-disable-${string}`]: boolean;
  }
}

const DEVICE_OPT_OUT_FLAG = 'lf_analytics_device_optout';

/**
 * Pages no tracker sees or loads on. The first two carry something that belongs to one person in their address.
 * The onboarding is where a person, often a child, says their age and their name. The rest are the signed-in application: what a person does in it, most of them minors, is not measured by any
 * third party (D-055). Measuring the product itself is decided with its own feature, never by default.
 */
const PRIVATE_PATHS = ['/unsubscribe', '/auth/callback', '/onboarding', '/home', '/learn', '/mentor', '/wallet', '/tasks', '/family'];

// the router matches a path whatever its case, so `/HOME` is the application too
const isPrivatePath = (pathname: string): boolean => PRIVATE_PATHS.some((path) => pathname.toLowerCase() === path || pathname.toLowerCase().startsWith(`${path}/`));

const TRACKER_TAGS = ['lf-plausible', 'lf-umami', 'lf-ga4'];

function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Safari private mode / storage disabled
  }
}

function writeFlag(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** True when this browser has been opted out by hand. */
export function isDeviceOptedOut(): boolean {
  return readFlag(DEVICE_OPT_OUT_FLAG) === '1';
}

/** Turn the device-level opt-out on or off. Both vendors honour their own localStorage opt-outs too. */
export function setDeviceOptOut(enabled: boolean): void {
  writeFlag(DEVICE_OPT_OUT_FLAG, enabled ? '1' : null);
  writeFlag('plausible_ignore', enabled ? 'true' : null);
  writeFlag('umami.disabled', enabled ? '1' : null);
}

/** An automated browser, by its own admission (WebDriver sets `navigator.webdriver`). */
function isAutomatedBrowser(): boolean {
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

function measurable(): boolean {
  return hasCookieConsent() && !isAutomatedBrowser() && !isDeviceOptedOut();
}

/** Async per-site Plausible script plus a CSP-safe programmatic init stub. */
function mountPlausible(): void {
  if (!PLAUSIBLE_SRC || document.getElementById('lf-plausible')) return;
  const el = document.createElement('script');
  el.id = 'lf-plausible';
  el.async = true;
  el.src = PLAUSIBLE_SRC;
  document.head.appendChild(el);

  // Queue calls until the async script defines the real implementation.
  if (!window.plausible) {
    const q: unknown[][] = [];

    const stub: Plausible = (...args: unknown[]) => {
      q.push(args);
    };

    stub.q = q;
    stub.init = (opts?: PlausibleOptions) => {
      stub.o = opts ?? {};
    };

    window.plausible = stub;
  }

  // Pageviews are fired by hand: the default would hook history and outlive the script tag.
  window.plausible.init?.({ autoCapturePageviews: false });
}

function mountUmami(): void {
  if (!UMAMI_SRC || !UMAMI_WEBSITE_ID || document.getElementById('lf-umami')) return;
  const el = document.createElement('script');
  el.id = 'lf-umami';
  el.defer = true;
  el.src = UMAMI_SRC;
  el.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
  el.setAttribute('data-auto-track', 'false');
  document.head.appendChild(el);
}

/**
 * Google Analytics 4. Page views are fired by hand (send_page_view: false) so a
 * route the site does not want measured is never reported.
 */
function mountGa4(): void {
  if (!GA4_ID || document.getElementById('lf-ga4')) return;
  const dataLayer = (window.dataLayer = window.dataLayer ?? []);
  // This MUST be a plain function that pushes `arguments`. gtag.js reads the queue as
  // arguments objects and silently ignores real arrays: an arrow function with a rest
  // parameter loads the script, shows no error and records nothing.
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
  window.gtag('config', GA4_ID, { send_page_view: false });
}

/** Removes the cookies GA4 sets (the client id and the per-property session cookie). */
function clearGa4Cookies(): void {
  const names = document.cookie.split(';').map((c) => c.split('=')[0]?.trim() ?? '').filter((n) => n === '_ga' || n.startsWith('_ga_') || n === '_gid');

  for (const name of names) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname}`;
  }
}

/** Umami's tracker is deferred, so on the mount that creates the tag the first pageview waits for its load event. */
function trackUmamiPageview(pathname: string): void {
  // Umami would send the address with its query: it is given the path alone.
  const send = () => window.umami?.track((props: UmamiPageview): UmamiPageview => ({ ...props, url: pathname }));

  if (window.umami) {
    send();

    return;
  }

  document.getElementById('lf-umami')?.addEventListener('load', send, { once: true });
}

function ejectScript(id: string): void {
  document.getElementById(id)?.remove();
}

/** Mounts or removes the trackers. `consentVersion` changes whenever the visitor makes a cookie choice. */
export function AnalyticsScripts({ consentVersion = 0 }: { consentVersion?: number }) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (measurable() && !isPrivatePath(pathname)) {
      // The address a tracker is given: this page's path on this site, never its query string.
      const url = `${window.location.origin}${pathname}`;

      mountPlausible();
      window.plausible?.('pageview', { url });
      mountUmami();
      trackUmamiPageview(pathname);

      if (GA4_ID) {
        window[`ga-disable-${GA4_ID}`] = false;
        mountGa4();
        window.gtag?.('event', 'page_view', { page_path: pathname, page_location: url });
      }
    } else {
      // Removing a tag does not stop code that already ran. A person who walks from a public page into a
      // private one gets that page loaded afresh, so no tracker is left in memory there (D-055).
      if (isPrivatePath(pathname) && TRACKER_TAGS.some((id) => document.getElementById(id) !== null)) {
        window.location.replace(`${pathname}${window.location.search}`);

        return;
      }

      ejectScript('lf-plausible');
      ejectScript('lf-umami');

      if (GA4_ID) {
        window[`ga-disable-${GA4_ID}`] = true;
        ejectScript('lf-ga4');
        clearGa4Cookies();
      }
    }
  }, [consentVersion, pathname]);

  return null;
}
