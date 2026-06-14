import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks (hoisted so they're available inside vi.mock factories) ──
const { mockStats, mockList } = vi.hoisted(() => ({
  mockStats: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}));

vi.mock('@/hooks/useAdminStats', () => ({
  useAdminStats: () => mockStats(),
}));

vi.mock('@/lib/api/notifications', () => ({
  notificationsAdminApi: { list: (...args: unknown[]) => mockList(...args) },
}));

import { useAdminAlerts } from '@/hooks/useAdminAlerts';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const iso = (d: number) => new Date(2020, 0, d).toISOString();

describe('useAdminAlerts', () => {
  beforeEach(() => {
    localStorage.clear();
    mockStats.mockReturnValue({
      data: {
        recent_edits: [
          { id: 'e1', editor_user_id: 'other-id', editor_name: 'Otra Admin', entity_type: 'lesson', action: 'update', created_at: iso(2) },
        ],
      },
      isLoading: false,
      refetch: vi.fn(),
    });
    mockList.mockResolvedValue([
      { public_id: 'n1', title_es: 'Aviso', title_en: 'Notice', status: 'active', created_at: iso(3) },
    ]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { public_id: 'r1', subject: 'Bug report', report_type: 'bug', created_at: iso(4) },
      ],
    }) as unknown as typeof fetch;
  });

  it('aggregates reports, edits and broadcasts into one list', async () => {
    const { result } = renderHook(() => useAdminAlerts(), { wrapper });
    await waitFor(() => expect(result.current.alerts).toHaveLength(3));

    const kinds = result.current.alerts.map((a) => a.kind).sort();
    expect(kinds).toEqual(['broadcast', 'edit', 'report']);
    // Newest first: report (Jan 4) before broadcast (Jan 3) before edit (Jan 2).
    expect(result.current.alerts[0].kind).toBe('report');
    expect(result.current.unreadCount).toBe(3);
  });

  it('markAllSeen clears the unread count and persists', async () => {
    const { result } = renderHook(() => useAdminAlerts(), { wrapper });
    await waitFor(() => expect(result.current.alerts).toHaveLength(3));

    act(() => result.current.markAllSeen());
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(localStorage.getItem('admin_alerts_seen')).toContain('report:r1');
  });

  it('dismiss marks a single alert as read', async () => {
    const { result } = renderHook(() => useAdminAlerts(), { wrapper });
    await waitFor(() => expect(result.current.alerts).toHaveLength(3));

    act(() => result.current.dismiss('report:r1'));
    await waitFor(() => expect(result.current.unreadCount).toBe(2));
  });

  it("excludes the logged-in admin's own edits", async () => {
    localStorage.setItem('user', JSON.stringify({ name: 'Otra Admin' }));
    const { result } = renderHook(() => useAdminAlerts(), { wrapper });
    await waitFor(() => expect(result.current.alerts).toHaveLength(2));
    expect(result.current.alerts.some((a) => a.kind === 'edit')).toBe(false);
  });
});
