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

beforeEach(() => {
  localStorage.clear();
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
