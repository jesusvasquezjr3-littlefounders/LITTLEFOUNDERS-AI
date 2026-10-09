import { useEffect } from 'react';
import { hasCookieConsent } from '@/lib/visitor';

/*
 * Consent-gated web analytics for the public site.
 *
 * Plausible (cookieless, no personal data) and Umami load only after the
 * visitor accepts optional cookies, never in an automated browser, and never
 * on a device that opted out. Declining or revoking consent removes the
 * script. Pageviews are fired by hand, once per route, because both trackers
 * would otherwise keep observing navigations after their script is removed.
 *
 * VITE_PLAUSIBLE_SRC is Plausible's per-site script URL (public, not a
 * secret). Without the variables set (local development) everything is a
 * no-op.
 */

const PLAUSIBLE_SRC: string | undefined = import.meta.env.VITE_PLAUSIBLE_SRC;
const UMAMI_SRC: string | undefined = import.meta.env.VITE_UMAMI_SRC;
const UMAMI_WEBSITE_ID: string | undefined = import.meta.env.VITE_UMAMI_WEBSITE_ID;

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
  }
}

const DEVICE_OPT_OUT_FLAG = 'lf_analytics_device_optout';

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
    const stub = ((...args: unknown[]) => {
      q.push(args);
    }) as Plausible;
    stub.q = q;
    stub.init = (opts?: unknown) => {
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

/** Umami's tracker is deferred, so on the mount that creates the tag the first pageview waits for its load event. */
function trackUmamiPageview(): void {
  if (window.umami) {
    window.umami.track();
    return;
  }
  document.getElementById('lf-umami')?.addEventListener('load', () => window.umami?.track(), { once: true });
}

function ejectScript(id: string): void {
  document.getElementById(id)?.remove();
}

/** Mounts or removes the trackers. `consentVersion` changes whenever the visitor makes a cookie choice. */
export function AnalyticsScripts({ consentVersion = 0 }: { consentVersion?: number }) {
  useEffect(() => {
    if (measurable()) {
      mountPlausible();
      window.plausible?.('pageview');
      mountUmami();
      trackUmamiPageview();
    } else {
      ejectScript('lf-plausible');
      ejectScript('lf-umami');
    }
  }, [consentVersion]);
  return null;
}
