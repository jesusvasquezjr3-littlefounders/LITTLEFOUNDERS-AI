/*
 * The visitor's cookie choice.
 *
 * One first-party cookie records whether the visitor accepted optional
 * cookies. Nothing optional (the analytics in lib/analytics) runs until the
 * visitor accepts, and declining is as easy as accepting.
 */

const CONSENT_COOKIE = 'lf_cc';
const MAX_AGE_DAYS = 400; // the practical browser ceiling for a JS-set cookie

function cookieDomain(): string {
  const { hostname } = window.location;
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return '';
  // Registrable domain, so locale subdomains share one choice.
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

export type CookieConsent = 'granted' | 'denied' | 'unset';

export function getCookieConsent(): CookieConsent {
  const v = readCookie(CONSENT_COOKIE);
  return v === 'granted' || v === 'denied' ? v : 'unset';
}

export function hasCookieConsent(): boolean {
  return getCookieConsent() === 'granted';
}

/** Record the visitor's choice. */
export function setCookieConsent(choice: 'granted' | 'denied'): void {
  writeCookie(CONSENT_COOKIE, choice, MAX_AGE_DAYS);
}
