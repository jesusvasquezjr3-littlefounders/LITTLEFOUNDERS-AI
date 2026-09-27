import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/theme/useTheme';
import { CookieConsentBanner, openCookiePreferences } from '@/components/CookieConsentBanner';
import { getCookieConsent } from '@/lib/visitor';
import en from '@/i18n/en-US/rebuild-site.json';

/*
 * M8 on the real bridge: who is asked, what a choice writes, and that the
 * preferences reopen from anywhere. The visitor's choice is the `lf` consent
 * cookie of lib/visitor; nothing optional runs before "Accept".
 */

const auth = vi.hoisted(() => ({ session: null as object | null, meLoaded: true }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

function clearCookies() {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(() => {
  clearCookies();
  auth.session = null;
  auth.meLoaded = true;
});

const at = (path: string, onDecision = vi.fn()) => render(<ThemeProvider><MemoryRouter initialEntries={[path]}>
  <CookieConsentBanner onDecision={onDecision} />
</MemoryRouter></ThemeProvider>);

describe('CookieConsentBanner (M8 bridge)', () => {
  it('asks a visitor with no choice on a public page; rejecting records it and says so to the app', () => {
    const onDecision = vi.fn();
    at('/', onDecision);
    expect(getCookieConsent()).toBe('unset');
    fireEvent.click(screen.getByRole('button', { name: en.cookies.reject }));
    expect(getCookieConsent()).toBe('denied');
    expect(onDecision).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('region', { name: en.cookies.title })).toBeNull();
  });

  it('records an acceptance', () => {
    at('/faq');
    fireEvent.click(screen.getByRole('button', { name: en.cookies.accept }));
    expect(getCookieConsent()).toBe('granted');
  });

  it('never asks a signed-in account, a product route, or before identity is restored', () => {
    auth.session = { user: { id: 'kid' } };
    const signedIn = at('/');
    expect(screen.queryByRole('region', { name: en.cookies.title })).toBeNull();
    signedIn.unmount();
    auth.session = null;
    const product = at('/learn');
    expect(screen.queryByRole('region', { name: en.cookies.title })).toBeNull();
    product.unmount();
    auth.meLoaded = false;
    at('/');
    expect(screen.queryByRole('region', { name: en.cookies.title })).toBeNull();
  });

  it('reopens the preferences from anywhere and shows the current choice', () => {
    document.cookie = 'lf_cc=denied; path=/';
    auth.session = { user: { id: 'teen' } };
    at('/legal/privacy');
    act(() => openCookiePreferences());
    const sheet = screen.getByRole('dialog', { name: en.cookies.sheetTitle });
    expect(sheet).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: en.cookies.accept }).at(-1)!);
    expect(getCookieConsent()).toBe('granted');
    expect(screen.queryByRole('dialog', { name: en.cookies.sheetTitle })).toBeNull();
  });
});
