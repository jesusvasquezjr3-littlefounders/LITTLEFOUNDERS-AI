import { beforeEach, describe, expect, it } from 'vitest';
import { classifyReferrer, getCookieConsent, setCookieConsent } from './visitor';

function clearCookies(): void {
  for (const name of ['lf_cc', 'lf_aid', '_ga', '_gid', '_gat', '_ga_TEST', 'lf_other']) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

describe('visitor cookie consent', () => {
  beforeEach(() => {
    clearCookies();
  });

  it('starts unset and records an explicit decision', () => {
    expect(getCookieConsent()).toBe('unset');

    setCookieConsent('granted');

    expect(getCookieConsent()).toBe('granted');
  });

  it('revoking consent removes first-party identity and known GA4 cookies', () => {
    document.cookie = 'lf_aid=visitor-id; path=/';
    document.cookie = '_ga=GA1.1.123; path=/';
    document.cookie = '_gid=GA1.1.456; path=/';
    document.cookie = '_gat=1; path=/';
    document.cookie = '_ga_TEST=GA1.1.789; path=/';
    document.cookie = 'lf_other=keep-me; path=/';

    setCookieConsent('denied');

    expect(getCookieConsent()).toBe('denied');
    expect(document.cookie).not.toMatch(/(?:^|; )lf_aid=/);
    expect(document.cookie).not.toMatch(/(?:^|; )_ga(?:_|=)/);
    expect(document.cookie).not.toMatch(/(?:^|; )_gid=/);
    expect(document.cookie).not.toMatch(/(?:^|; )_gat=/);
    expect(document.cookie).toMatch(/(?:^|; )lf_other=keep-me/);
  });

  it('treats a Google OAuth return as internal rather than search acquisition', () => {
    Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://accounts.google.com/o/oauth2/auth' });

    expect(classifyReferrer()).toBe('internal');
  });
});
