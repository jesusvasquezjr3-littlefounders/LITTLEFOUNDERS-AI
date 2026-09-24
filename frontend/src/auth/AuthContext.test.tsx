import { ANALYTICS_POLICY_SIGNAL } from '@/lib/analyticsPolicySignal';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

/*
 * login()/signup()/completeOAuth() persist a new session and call loadMe()
 * asynchronously — without resetting meLoaded/analyticsEnabled to false
 * FIRST, a same-tab identity switch (no intervening logout) could leave
 * useInsightsBeacon's `ready` gate reading a stale analyticsEnabled from the
 * PREVIOUS identity for the async gap until the new /auth/me answers. That
 * is a real fail-closed violation even though the backend independently
 * re-checks consent per batch: the frontend's own gate must not admit it.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function loginResponse(userId: string): Response {
  return jsonResponse({
    data: {
      session: {
        accessToken: `token-${userId}`,
        refreshToken: `refresh-${userId}`,
        expiresIn: 3600,
        user: { id: userId, email: `${userId}@example.com` },
      },
    },
    error: null,
  });
}

/** Frontend only decodes claims, never verifies the signature — a fake sig is fine here. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url(JSON.stringify({ alg: 'HS256' }))}.${b64url(JSON.stringify(payload))}.sig`;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('AuthContext — session isolation under delayed responses', () => {
  it.each(['storage', 'focus'])('suspends optional analytics before a fresh %s policy response', async trigger => {
    let refresh = false; const response = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/login')) return Promise.resolve(loginResponse('teen'));
      if (String(input).includes('/auth/me') && refresh) return response.promise;
      return Promise.resolve(jsonResponse({ data: { profile: null, roles: ['universal'], analyticsEnabled: true }, error: null }));
    }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.login('teen@example.invalid', 'password123'); });
    expect(result.current.analyticsEnabled).toBe(true); refresh = true;
    act(() => window.dispatchEvent(trigger === 'storage'
      ? new StorageEvent('storage', { key: ANALYTICS_POLICY_SIGNAL, newValue: 'untrusted-enable-claim' })
      : new Event('focus')));
    expect(result.current.analyticsEnabled).toBe(false);
    await act(async () => response.resolve(jsonResponse({ data: { profile: null, roles: ['universal'], analyticsEnabled: false }, error: null })));
    expect(result.current.analyticsEnabled).toBe(false);
  });
  it('hiding a tab invalidates an outstanding permission response', async () => {
    let refresh = false; const response = deferred<Response>();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/login')) return Promise.resolve(loginResponse('teen'));
      if (String(input).includes('/auth/me') && refresh) return response.promise;
      return Promise.resolve(jsonResponse({ data: { profile: null, roles: ['universal'], analyticsEnabled: true }, error: null }));
    }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.login('teen@example.invalid', 'password123'); });
    refresh = true; let pending!: Promise<void>;
    act(() => { pending = result.current.refreshMe(); });
    visibility.mockReturnValue('hidden'); act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => { response.resolve(jsonResponse({ data: { profile: null, roles: ['universal'], analyticsEnabled: true }, error: null })); await pending; });
    expect(result.current.analyticsEnabled).toBe(false); visibility.mockRestore();
  });

  it('revokes optional collection when a same-account policy refresh fails', async () => {
    let failed = false;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/login')) return Promise.resolve(loginResponse('teen'));
      if (String(input).includes('/auth/me')) return Promise.resolve(jsonResponse(failed
        ? { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Offline' } }
        : { data: { profile: { display_name: 'Synthetic' }, roles: ['universal'], avatarOptions: {}, analyticsEnabled: true }, error: null }));
      return Promise.resolve(jsonResponse({ data: {}, error: null }));
    }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.login('teen@example.invalid', 'password123'); });
    expect(result.current.analyticsEnabled).toBe(true);
    failed = true;
    await act(async () => { await result.current.refreshMe(); });
    expect(result.current.analyticsEnabled).toBe(false);
    expect(result.current.profile?.display_name).toBe('Synthetic');
  });

  it('clears the previous identity before a replacement profile fails to load', async () => {
    let user = 'parent';
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/login')) return Promise.resolve(loginResponse(user));
      if (String(input).includes('/auth/me')) return Promise.resolve(jsonResponse(user === 'parent'
        ? { data: { profile: { display_name: 'Private parent' }, roles: ['parent'], avatarOptions: { hair: 'private' }, analyticsEnabled: true, onboardingComplete: true }, error: null }
        : { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Offline' } }));
      return Promise.resolve(jsonResponse({ data: {}, error: null }));
    }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.login('parent@example.com', 'password123'); });
    expect(result.current.roles).toEqual(['parent']);
    sessionStorage.setItem('lf.lesson.checkpoint.v1:parent:lesson', 'private feedback');
    user = 'kid';
    await act(async () => { await result.current.login('kid', 'password123'); });
    expect(result.current.session?.user.id).toBe('kid');
    expect(result.current.profile).toBeNull();
    expect(result.current.roles).toEqual([]);
    expect(result.current.avatarOptions).toEqual({});
    expect(result.current.onboardingComplete).toBe(false);
    expect(sessionStorage.getItem('lf.lesson.checkpoint.v1:parent:lesson')).toBeNull();
  });

  it('clears staff grants immediately on logout', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/login')) return Promise.resolve(loginResponse('staff'));
      if (String(input).includes('/auth/me')) return Promise.resolve(jsonResponse({
        data: { profile: null, roles: ['admin'], adminPermissions: ['manage_users'], analyticsEnabled: false },
        error: null,
      }));
      return Promise.resolve(jsonResponse({ data: {}, error: null }));
    }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.login('staff@example.com', 'password123'); });
    expect(result.current.adminPermissions).toEqual(['manage_users']);
    await act(async () => { await result.current.logout(); });
    expect(result.current.adminPermissions).toEqual([]);
  });

  it('fails closed on staff grants when a later profile refresh is unavailable', async () => {
    let unavailable = false;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/login')) return Promise.resolve(loginResponse('staff'));
      if (String(input).includes('/auth/me')) return Promise.resolve(jsonResponse(unavailable
        ? { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Offline' } }
        : { data: { profile: null, roles: ['admin'], adminPermissions: ['manage_users'], analyticsEnabled: false }, error: null }));
      return Promise.resolve(jsonResponse({ data: {}, error: null }));
    }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.login('staff@example.com', 'password123'); });
    expect(result.current.adminPermissions).toEqual(['manage_users']);
    unavailable = true;
    await act(async () => { await result.current.refreshMe(); });
    expect(result.current.adminPermissions).toEqual([]);
  });

  it('preserves the session on a temporary refresh failure so a screen can show an error and retry', async () => {
    localStorage.setItem('lf.session.v1', JSON.stringify({
      accessToken: 'expired', refreshToken: 'old-refresh', expiresAt: 1,
      user: { id: 'parent' }, isGuest: false,
    }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.meLoaded).toBe(true));
    await act(async () => { expect(await result.current.getToken()).toBe('expired'); });
    expect(result.current.session?.user.id).toBe('parent');
  });

  it('does not restore a signed-out profile when an earlier profile request completes', async () => {
    const pendingMe = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/login')) return Promise.resolve(loginResponse('parent'));
      if (String(input).includes('/auth/me')) return pendingMe.promise;
      return Promise.resolve(jsonResponse({ data: {}, error: null }));
    }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    let login!: ReturnType<typeof result.current.login>;
    await act(async () => { login = result.current.login('parent@example.com', 'password123'); });
    await waitFor(() => expect(result.current.session?.user.id).toBe('parent'));
    sessionStorage.setItem('lf.lesson.checkpoint.v1:parent:lesson', 'private feedback');
    await act(async () => { await result.current.logout(); });
    expect(sessionStorage.getItem('lf.lesson.checkpoint.v1:parent:lesson')).toBeNull();
    await act(async () => {
      pendingMe.resolve(jsonResponse({ data: {
        profile: { display_name: 'Private parent', username: 'parent', locale: 'en-US', theme: 'light', cover: {} },
        roles: ['parent'], avatarOptions: { hair: 'private' }, analyticsEnabled: true, onboardingComplete: true,
      }, error: null }));
      await login;
    });
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.roles).toEqual([]);
    expect(result.current.avatarOptions).toEqual({});
    expect(result.current.analyticsEnabled).toBe(false);
    expect(result.current.onboardingComplete).toBe(false);
  });

  it('shares one refresh across concurrent callers and cannot resurrect a signed-out session', async () => {
    localStorage.setItem('lf.session.v1', JSON.stringify({
      accessToken: 'expired', refreshToken: 'old-refresh', expiresAt: 1,
      user: { id: 'parent' }, isGuest: false,
    }));
    const pendingRefresh = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/auth/refresh')) return pendingRefresh.promise;
      return Promise.resolve(jsonResponse({ data: {}, error: null }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    let tokens!: Promise<(string | null)[]>;
    await act(async () => { tokens = Promise.all([result.current.getToken(), result.current.getToken()]); });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))).toHaveLength(1);
    await act(async () => { await result.current.logout(); });
    await act(async () => { pendingRefresh.resolve(loginResponse('parent')); await tokens; });
    expect(await tokens).toEqual([null, null]);
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem('lf.session.v1')).toBeNull();
  });
});

describe('AuthContext — identity-switch fail-closed gate', () => {
  it('resets meLoaded/analyticsEnabled to false the instant a SECOND login is persisted, not carrying over the first identity\'s enabled state during the gap', async () => {
    const secondMeGate = deferred<Response>();
    let meCallCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/login')) {
          const isSecond = meCallCount >= 1;
          return Promise.resolve(loginResponse(isSecond ? 'user-b' : 'user-a'));
        }
        if (url.includes('/auth/me')) {
          meCallCount += 1;
          if (meCallCount === 1) {
            // First identity: resolves immediately with analytics enabled.
            return Promise.resolve(
              jsonResponse({
                data: { profile: null, roles: ['universal'], avatarOptions: {}, analyticsEnabled: true },
                error: null,
              }),
            );
          }
          // Second identity: held pending until the test releases it.
          return secondMeGate.promise;
        }
        return Promise.resolve(jsonResponse({ data: null, error: null }));
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // No stored session on mount -> settles immediately with nothing enabled.
    await waitFor(() => expect(result.current.meLoaded).toBe(true));
    expect(result.current.analyticsEnabled).toBe(false);

    // First identity logs in and its /auth/me resolves with analytics enabled.
    await act(async () => {
      await result.current.login('a@example.com', 'password123');
    });
    await waitFor(() => expect(result.current.analyticsEnabled).toBe(true));
    expect(result.current.meLoaded).toBe(true);

    // Second identity logs in (same tab, no logout in between). Its /auth/me
    // is held pending — the fix must reset meLoaded/analyticsEnabled to
    // false the instant the new session is persisted, not leave the first
    // identity's `true` visible for the duration of this gap.
    await act(async () => {
      void result.current.login('b@example.com', 'password456');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.meLoaded).toBe(false);
    expect(result.current.analyticsEnabled).toBe(false);

    secondMeGate.resolve(
      jsonResponse({
        data: { profile: null, roles: ['kid'], avatarOptions: {}, analyticsEnabled: false },
        error: null,
      }),
    );

    await waitFor(() => expect(result.current.meLoaded).toBe(true));
    expect(result.current.analyticsEnabled).toBe(false);
  });
});

describe('AuthContext — guest session and upgrade', () => {
  it('startGuestSession marks the session isGuest from the JWT is_anonymous claim, and upgradeAccount clears it in place', async () => {
    const guestToken = fakeJwt({ sub: 'guest-1', is_anonymous: true });
    const upgradedToken = fakeJwt({ sub: 'guest-1', email: 'ana@example.com', is_anonymous: false });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/guest')) {
          return Promise.resolve(
            jsonResponse({
              data: { session: { accessToken: guestToken, refreshToken: 'guest-rt', expiresIn: 3600, user: { id: 'guest-1', email: null } } },
              error: null,
            }),
          );
        }
        if (url.includes('/auth/upgrade')) {
          return Promise.resolve(
            jsonResponse({
              data: {
                session: {
                  accessToken: upgradedToken,
                  refreshToken: 'upgraded-rt',
                  expiresIn: 3600,
                  user: { id: 'guest-1', email: 'ana@example.com' },
                },
              },
              error: null,
            }),
          );
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(jsonResponse({ data: { profile: null, roles: ['universal'], avatarOptions: {}, analyticsEnabled: true }, error: null }));
        }
        return Promise.resolve(jsonResponse({ data: null, error: null }));
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.meLoaded).toBe(true));

    await act(async () => {
      await result.current.startGuestSession();
    });
    await waitFor(() => expect(result.current.session?.user.id).toBe('guest-1'));
    expect(result.current.isGuest).toBe(true);

    await act(async () => {
      await result.current.upgradeAccount({ email: 'ana@example.com', password: 'longenough1' });
    });
    await waitFor(() => expect(result.current.isGuest).toBe(false));
  });
});
