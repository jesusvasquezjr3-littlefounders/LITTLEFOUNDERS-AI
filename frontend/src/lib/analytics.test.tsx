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

/*
 * Plausible's SPA capture.
 *
 * init() defaults autoCapturePageviews to true, which patches history.pushState
 * so the script records every navigation itself. Ejecting the <script> tag on
 * the next route change does NOT undo that — the runtime has already executed.
 * A consented visitor who landed on marketing therefore carried Plausible into
 * /signup, /learn and /admin/*, which pulse/AGENTS.md forbids. Production
 * confirmed it on 2026-08-14: one day of native pageviews included
 * /admin/analytics and /admin/users.
 */
describe('mountPlausible', () => {
  /*
   * PLAUSIBLE_SRC is read from import.meta.env at module load and is unset in
   * the test env, so the mount is a no-op unless the env is stubbed and the
   * module re-imported. Getting this wrong yields a test that passes while
   * asserting nothing.
   */
  async function loadWithSrc() {
    vi.resetModules();
    vi.stubEnv('VITE_PLAUSIBLE_SRC', 'https://pulse.example/js/script.js');
    return (await import('./analytics')) as typeof import('./analytics');
  }

  beforeEach(() => {
    document.getElementById('lf-plausible')?.remove();
    delete (window as { plausible?: unknown }).plausible;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('disables automatic SPA capture so the boundary cannot be bypassed', async () => {
    const mod = await loadWithSrc();
    mod.mountPlausible();
    expect(document.getElementById('lf-plausible')).not.toBeNull();

    const opts = (window as unknown as { plausible?: { o?: { autoCapturePageviews?: boolean } } }).plausible?.o;
    // If this ever reverts to the default (true), Plausible patches
    // history.pushState and records /signup, /learn and /admin/* by itself.
    expect(opts).toBeDefined();
    expect(opts?.autoCapturePageviews).toBe(false);
  });

  it('queues calls made before the async script defines the real implementation', async () => {
    const mod = await loadWithSrc();
    mod.mountPlausible();
    const p = (window as unknown as { plausible?: { q?: unknown[][] } }).plausible;
    (p as unknown as (e: string) => void)('pageview');
    expect(p?.q?.some((args) => args[0] === 'pageview')).toBe(true);
  });
});

describe('trackUmamiPageview', () => {
  /*
   * Umami had the same auto-capture defect as Plausible: production was
   * recording /admin and /admin/analytics on 2026-08-14 despite an explicit
   * !isAdminPath gate, because the tracker hooks history.pushState on load.
   */
  async function loadUmami() {
    vi.resetModules();
    vi.stubEnv('VITE_UMAMI_SRC', 'https://pulse.example/script.js');
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', '82166b5f-4bb2-4e33-9b58-6ee1f93fc1ac');
    return (await import('./analytics')) as typeof import('./analytics');
  }

  beforeEach(() => {
    document.getElementById('lf-umami')?.remove();
    delete (window as { umami?: unknown }).umami;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('waits for the deferred script rather than dropping the first pageview', async () => {
    const mod = await loadUmami();
    mod.mountUmami();
    // The tag exists but the tracker has not executed yet.
    expect(window.umami).toBeUndefined();
    mod.trackUmamiPageview();

    const track = vi.fn();
    (window as { umami?: { track: () => void } }).umami = { track };
    document.getElementById('lf-umami')!.dispatchEvent(new Event('load'));
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('mounts with automatic SPA capture disabled', async () => {
    const mod = await loadUmami();
    mod.mountUmami();
    const el = document.getElementById('lf-umami');
    // If this reverts, the tracker hooks history and reports /admin/* itself,
    // regardless of the isAdminPath gate in the effect.
    expect(el?.getAttribute('data-auto-track')).toBe('false');
    expect(el?.getAttribute('data-website-id')).toBe('82166b5f-4bb2-4e33-9b58-6ee1f93fc1ac');
  });

  it('emits immediately once the tracker is resident', async () => {
    const mod = await loadUmami();
    const track = vi.fn();
    (window as { umami?: { track: () => void } }).umami = { track };
    mod.trackUmamiPageview();
    expect(track).toHaveBeenCalledTimes(1);
  });
});


describe('mountGa4', () => {
  /*
   * GA4 recorded nothing for three weeks behind a tag that loaded fine. The
   * cause was the shape of the dataLayer entries, which no type checker, lint
   * rule or console error can catch — so it has to be a test.
   */
  async function loadGa4() {
    vi.resetModules();
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-0XH7S80QG2');
    return (await import('./analytics')) as typeof import('./analytics');
  }

  beforeEach(() => {
    document.getElementById('lf-ga4')?.remove();
    delete (window as { dataLayer?: unknown }).dataLayer;
    delete (window as { gtag?: unknown }).gtag;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('pushes arguments objects, never arrays — gtag.js ignores arrays outright', async () => {
    const mod = await loadGa4();
    mod.mountGa4();
    const layer = (window as unknown as { dataLayer: unknown[] }).dataLayer;
    expect(layer.length).toBeGreaterThan(0);
    for (const entry of layer) {
      expect(
        Object.prototype.toString.call(entry),
        'a real Array here means GA4 silently receives nothing',
      ).toBe('[object Arguments]');
    }
  });

  it('issues the js and config commands the property needs to initialise', async () => {
    const mod = await loadGa4();
    mod.mountGa4();
    const layer = (window as unknown as { dataLayer: IArguments[] }).dataLayer;
    const commands = layer.map((a) => a[0]);
    expect(commands).toContain('js');
    expect(commands).toContain('config');
    const config = layer.find((a) => a[0] === 'config');
    expect(config?.[1]).toBe('G-0XH7S80QG2');
    // Pageviews are fired manually so GA4 never sees an app/kid pathname.
    expect((config?.[2] as { send_page_view?: boolean })?.send_page_view).toBe(false);
  });

  it('loads the tag exactly once', async () => {
    const mod = await loadGa4();
    mod.mountGa4();
    mod.mountGa4();
    expect(document.querySelectorAll('#lf-ga4')).toHaveLength(1);
  });
});
