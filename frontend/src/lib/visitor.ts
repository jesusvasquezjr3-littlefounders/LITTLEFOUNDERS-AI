import type { InsightRouteClass } from './insights';

/*
 * First-party visitor identity + acquisition context (/INSIGHTS.md §7).
 *
 * The cookie is OURS and only ours: set on `.littlefounders.ai` from our own
 * JavaScript, sent to our own API in the request body. No third-party
 * script, no cross-site pixel, no ad network. It exists to answer one
 * question the product could not answer at all — which channel produces
 * signups — and to recognise a returning visitor across the marketing site's
 * locale subdomains.
 *
 * Why the value travels in the BODY and not as a Cookie header: Core's CORS
 * deliberately runs credentials-off ("auth travels in the Authorization
 * header, never cookies", middleware/cors.ts). Sending the id explicitly
 * keeps that posture intact instead of weakening it for analytics.
 *
 * Consent: nothing here runs until the visitor accepts. `hasCookieConsent()`
 * is checked by every caller, and declining actively DELETES the cookie.
 */

const COOKIE = 'lf_aid';
const CONSENT_COOKIE = 'lf_cc';
const MAX_AGE_DAYS = 400; // the practical browser ceiling for a JS-set cookie

function cookieDomain(): string {
  const { hostname } = window.location;
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return '';
  // Registrable domain, so en./es. subdomains see the same visitor.
  const parts = hostname.split('.');
  return parts.length > 2 ? `; domain=.${parts.slice(-2).join('.')}` : `; domain=.${hostname}`;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function writeCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/${cookieDomain()}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${cookieDomain()}`;
}

/** Remove cookies written by the optional GA4 script when consent is revoked. */
function deleteOptionalAnalyticsCookies(): void {
  const names = document.cookie
    .split(';')
    .map((entry) => entry.trim().split('=')[0])
    .filter((name): name is string => typeof name === 'string' && (name === '_ga' || name === '_gid' || name === '_gat' || name.startsWith('_ga_')));
  for (const name of names) deleteCookie(name);
}

export type CookieConsent = 'granted' | 'denied' | 'unset';

export function getCookieConsent(): CookieConsent {
  const v = readCookie(CONSENT_COOKIE);
  return v === 'granted' || v === 'denied' ? v : 'unset';
}

export function hasCookieConsent(): boolean {
  return getCookieConsent() === 'granted';
}

/** Record the visitor's choice. Declining deletes the identity immediately. */
export function setCookieConsent(choice: 'granted' | 'denied'): void {
  writeCookie(CONSENT_COOKIE, choice, MAX_AGE_DAYS);
  if (choice === 'denied') {
    deleteCookie(COOKIE);
    deleteOptionalAnalyticsCookies();
  }
}

/** The visitor id, minted on first consented visit. Null when not consented. */
export function getAnonId(): string | null {
  if (!hasCookieConsent()) return null;
  const existing = readCookie(COOKIE);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const fresh = globalThis.crypto?.randomUUID?.();
  if (!fresh) return null;
  writeCookie(COOKIE, fresh, MAX_AGE_DAYS);
  return fresh;
}

export type Device = 'mobile' | 'tablet' | 'desktop';
export type ReferrerClass = 'direct' | 'search' | 'social' | 'referral' | 'internal' | 'campaign';

/** Viewport-derived, matching the §1.11 breakpoints. No user-agent string. */
export function detectDevice(): Device {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Coarse acquisition class — NEVER the raw referrer URL. A URL can carry
 * identifiers and query strings, which is precisely the free-text channel
 * §1.9 forbids; a class carries the marketing signal and nothing else.
 */
export function classifyReferrer(): ReferrerClass {
  const params = new URLSearchParams(window.location.search);
  if (params.get('utm_source') || params.get('utm_campaign')) return 'campaign';
  const ref = document.referrer;
  if (!ref) return 'direct';
  let host = '';
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    return 'direct';
  }
  if (host.endsWith('littlefounders.ai')) return 'internal';
  if (/google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\./.test(host)) return 'search';
  if (/facebook\.|instagram\.|twitter\.|x\.com|tiktok\.|youtube\.|linkedin\.|reddit\.|whatsapp\./.test(host)) return 'social';
  return 'referral';
}

const LABEL = /^[A-Za-z0-9._-]{1,64}$/;

function label(v: string | null): string | undefined {
  return v && LABEL.test(v) ? v : undefined;
}

export interface VisitorContext {
  referrerClass: ReferrerClass;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingRoute?: string;
  device: Device;
  locale?: 'en-US' | 'es-MX' | 'pt-BR';
}

const LANDING_KEY = 'lf.landing.v1';

/**
 * Snapshot the ACQUISITION CONTEXT at first script execution.
 *
 * This must happen on module load, not when consent is granted: the UTM
 * parameters and the external referrer only exist on the landing URL, and
 * they are gone the moment the SPA navigates. Capturing late attributed a
 * campaign visit to whatever page the visitor happened to be on when they
 * accepted the banner — i.e. it silently destroyed channel attribution,
 * which is the whole reason this layer exists.
 *
 * Held in sessionStorage: survives in-tab navigation, dies with the tab, and
 * is NOT the visitor identity (that is the consented cookie). Storing it is
 * consent-independent because nothing is transmitted until consent — if the
 * visitor declines, the snapshot is simply never read and dies with the tab.
 */
export function captureLandingContext(): void {
  try {
    if (sessionStorage.getItem(LANDING_KEY)) return; // first landing wins
    const params = new URLSearchParams(window.location.search);
    const route = window.location.pathname.slice(0, 120);
    const snapshot = {
      referrerClass: classifyReferrer(),
      utmSource: label(params.get('utm_source')),
      utmMedium: label(params.get('utm_medium')),
      utmCampaign: label(params.get('utm_campaign')),
      landingRoute: /^[A-Za-z0-9/_-]{1,120}$/.test(route) ? route : '/',
      device: detectDevice(),
    };
    sessionStorage.setItem(LANDING_KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode / storage disabled — attribution degrades, nothing breaks */
  }
}

/** Acquisition context for THIS landing, sent once when the visitor registers. */
export function collectVisitorContext(locale?: string): VisitorContext {
  let snap: Partial<VisitorContext> = {};
  try {
    const raw = sessionStorage.getItem(LANDING_KEY);
    if (raw) snap = JSON.parse(raw) as Partial<VisitorContext>;
  } catch {
    /* fall through to a live read */
  }
  const params = new URLSearchParams(window.location.search);
  const route = window.location.pathname.slice(0, 120);
  return {
    referrerClass: snap.referrerClass ?? classifyReferrer(),
    utmSource: snap.utmSource ?? label(params.get('utm_source')),
    utmMedium: snap.utmMedium ?? label(params.get('utm_medium')),
    utmCampaign: snap.utmCampaign ?? label(params.get('utm_campaign')),
    landingRoute: snap.landingRoute ?? (/^[A-Za-z0-9/_-]{1,120}$/.test(route) ? route : '/'),
    device: snap.device ?? detectDevice(),
    locale: locale === 'en-US' || locale === 'es-MX' || locale === 'pt-BR' ? locale : undefined,
  };
}

/** Marketing pathnames map to the 'marketing' class; everything else is product. */
export function isMarketingRoute(pathname: string): boolean {
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  return first === '' || ['how-it-works', 'families', 'faq', 'legal', 'login', 'signup'].includes(first);
}

export type { InsightRouteClass };
