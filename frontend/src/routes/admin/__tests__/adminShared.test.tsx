import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminData, useAdminMutation } from '../adminShared';

/*
 * Both admin data hooks are contracted to hand callers an ENVELOPE, never to
 * throw: every consumer branches on `state`/`error` and none of them wrap the
 * call in a try.
 *
 * They used to rely on api() honouring that by itself. When something upstream
 * threw instead — a rejected token fetch, a mocked client, a future refactor —
 * the rejection escaped an async callback nothing awaits. In CI that surfaced
 * as an unhandled rejection which failed a run where all 476 tests passed; in
 * a browser it leaves the panel on "loading" forever with no error state and
 * no way for the user to know anything went wrong.
 */

const throwingApi = vi.fn();
/*
 * getToken MUST keep a stable identity across renders. useAdminData's `load`
 * lists it as a dependency, so a fresh function per render re-runs the effect,
 * which setStates, which re-renders — an infinite loop that OOMs the worker
 * rather than failing a test (frontend/AGENTS.md, stable dependency identity).
 */
const getToken = () => Promise.resolve('token');
const auth = { getToken };
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => throwingApi(...args),
  BASE_URL: 'http://localhost:4000',
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

describe('useAdminData', () => {
  it('turns a thrown failure into an error state instead of an unhandled rejection', async () => {
    throwingApi.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAdminData<{ x: number }>('/admin/whatever'));
    await waitFor(() => expect(result.current.data.state).toBe('error'));
    expect(result.current.data).toEqual({ state: 'error', code: 'INTERNAL' });
  });

  it('still reports an envelope error with its own code', async () => {
    throwingApi.mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'no' } });
    const { result } = renderHook(() => useAdminData('/admin/whatever'));
    await waitFor(() => expect(result.current.data.state).toBe('error'));
    expect(result.current.data).toEqual({ state: 'error', code: 'DATA_UNAVAILABLE' });
  });

  it('reaches the ready state on success', async () => {
    throwingApi.mockResolvedValue({ data: { x: 1 }, error: null });
    const { result } = renderHook(() => useAdminData<{ x: number }>('/admin/whatever'));
    await waitFor(() => expect(result.current.data.state).toBe('ready'));
  });
});

describe('useAdminMutation', () => {
  it('returns an envelope rather than rejecting when the call throws', async () => {
    throwingApi.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAdminMutation());
    await expect(result.current('/admin/whatever', {})).resolves.toEqual({
      data: null,
      error: { code: 'INTERNAL', message: 'Request failed' },
    });
  });
});
