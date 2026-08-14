import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { isMarketingPath, shouldTrackPublicAcquisition, useTrackingDecision } from './analytics';

describe('public acquisition tracker boundary', () => {
  it('accepts only consented, identity-resolved guest marketing routes', () => {
    expect(shouldTrackPublicAcquisition('/', null, true, true)).toBe(true);
    expect(shouldTrackPublicAcquisition('/families', null, true, true)).toBe(true);
    expect(shouldTrackPublicAcquisition('/login', null, true, true)).toBe(false);
    expect(shouldTrackPublicAcquisition('/auth/callback', null, true, true)).toBe(false);
    expect(shouldTrackPublicAcquisition('/admin/content', null, true, true)).toBe(false);
  });

  it('fails closed while authentication restores or a user is identified', () => {
    expect(shouldTrackPublicAcquisition('/', null, false, true)).toBe(false);
    expect(shouldTrackPublicAcquisition('/', {}, true, true)).toBe(false);
    expect(shouldTrackPublicAcquisition('/', null, true, false)).toBe(false);
  });

  it('does not treat app and OAuth routes as marketing', () => {
    expect(isMarketingPath('/learn')).toBe(false);
    expect(isMarketingPath('/auth/callback')).toBe(false);
    expect(isMarketingPath('/admin')).toBe(false);
  });
});

/*
 * Internal-traffic exclusion gate (Vault 0045). The decision runs BEFORE any
 * tracker mounts — that is the only place a self-hosted Plausible exclusion
 * can be enforced at all — so these cases are the difference between the
 * console's exclusion list changing real numbers and being decoration.
 */
describe('useTrackingDecision', () => {
  const decisionResponse = (data: { excluded: boolean; degraded?: boolean }) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { degraded: false, ...data }, error: null }) });

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('excludes staff traffic and sets the vendors\' own opt-outs', async () => {
    vi.stubGlobal('fetch', vi.fn(() => decisionResponse({ excluded: true })));
    const { result } = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(result.current).toBe('excluded'));
    expect(window.localStorage.getItem('lf_analytics_excluded')).toBe('1');
    expect(window.localStorage.getItem('plausible_ignore')).toBe('true');
    expect(window.localStorage.getItem('umami.disabled')).toBe('1');
  });

  it('starts pending — never mounts a tracker before the answer arrives', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useTrackingDecision());
    expect(result.current).toBe('pending');
  });

  it('clears a stored exclusion when the console revokes it', async () => {
    window.localStorage.setItem('lf_analytics_excluded', '1');
    window.localStorage.setItem('plausible_ignore', 'true');
    vi.stubGlobal('fetch', vi.fn(() => decisionResponse({ excluded: false })));
    const { result } = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(result.current).toBe('allowed'));
    expect(window.localStorage.getItem('lf_analytics_excluded')).toBeNull();
    expect(window.localStorage.getItem('plausible_ignore')).toBeNull();
  });

  it('keeps an excluded machine excluded when Core cannot answer', async () => {
    window.localStorage.setItem('lf_analytics_excluded', '1');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const { result } = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(result.current).toBe('excluded'));
    expect(window.localStorage.getItem('lf_analytics_excluded')).toBe('1');
  });

  it('does not let a degraded answer clear a stored exclusion', async () => {
    window.localStorage.setItem('lf_analytics_excluded', '1');
    vi.stubGlobal('fetch', vi.fn(() => decisionResponse({ excluded: false, degraded: true })));
    const { result } = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(result.current).toBe('excluded'));
    expect(window.localStorage.getItem('lf_analytics_excluded')).toBe('1');
  });

  it('keeps measuring an ordinary visitor when Core cannot answer', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const { result } = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(result.current).toBe('allowed'));
  });

  it('asks once per browser session', async () => {
    const fetchSpy = vi.fn(() => decisionResponse({ excluded: false }));
    vi.stubGlobal('fetch', fetchSpy);
    const first = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(first.result.current).toBe('allowed'));
    const second = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(second.result.current).toBe('allowed'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

/*
 * Automated browsers announce themselves via navigator.webdriver. Excluding
 * them costs a real user nothing and removes a whole class of non-human
 * traffic before a single hit is sent — including this project's own browser
 * verification runs, which loaded the marketing site repeatedly today and
 * would otherwise have been counted as visitors.
 */
describe('useTrackingDecision — automated browsers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    vi.unstubAllGlobals();
  });

  it('never tracks a WebDriver-controlled session, whatever the server says', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { excluded: false, degraded: false }, error: null }) }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(result.current).toBe('excluded'));
    // It does not even ask: the decision is local and final.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('plausible_ignore')).toBe('true');
  });

  it('leaves an ordinary browser to the normal decision path', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { excluded: false, degraded: false }, error: null }) }),
      ),
    );
    const { result } = renderHook(() => useTrackingDecision());
    await waitFor(() => expect(result.current).toBe('allowed'));
  });
});
