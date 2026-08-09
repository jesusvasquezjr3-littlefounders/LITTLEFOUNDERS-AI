import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LiveStats, mapRow } from '../LiveStats';

const { mockApi, mockGetToken, mockOnHeartbeat } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
  mockOnHeartbeat: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));
vi.mock('@/lib/supabaseRealtime', () => ({
  getSupabaseClient: () => null,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

const LIVE_RUN = {
  runId: 'live-run-1',
  trackId: null,
  courseSlug: 'first-lemonade-stand',
  register: 'kid',
  activeSlots: 2,
  completedSlots: 4,
  failedSlots: 1,
  skippedSlots: 1,
  totalSlots: 8,
  stageBreakdown: { writing: 2, published: 4, failed: 1, skipped: 1 },
  tokensUsed: 250_000,
  usdUsed: 0.875,
  cachedTokens: 100_000,
  imagesGenerated: 8,
  imagesBilled: 3,
  imagesInherited: 5,
  startedAt: '2026-07-26T01:00:00Z',
  updatedAt: '2026-07-26T02:00:00Z',
};

beforeEach(() => {
  mockApi.mockReset();
  mockGetToken.mockResolvedValue('fake-token');
  mockOnHeartbeat.mockReset();
});

describe('LiveStats', () => {
  it('hydrates active runs through Core when Realtime is unavailable', async () => {
    mockApi.mockResolvedValue({ data: { activeRuns: [LIVE_RUN] }, error: null });

    const { unmount } = render(<LiveStats onHeartbeat={mockOnHeartbeat} />);

    await waitFor(() => expect(screen.getByText('live-run-1')).toBeInTheDocument());
    expect(screen.getByText('admin.generation.live.automatic')).toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledWith('/admin/generation/live', { token: 'fake-token' });
    expect(mockOnHeartbeat).toHaveBeenLastCalledWith(expect.objectContaining({
      runId: 'live-run-1',
      completedSlots: 4,
      skippedSlots: 1,
    }));

    unmount();
  });

  it('shows a recoverable unavailable state instead of claiming a realtime-only failure', async () => {
    mockApi.mockResolvedValue({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'down' } });

    const { unmount } = render(<LiveStats onHeartbeat={mockOnHeartbeat} />);

    await waitFor(() => expect(screen.getByText('admin.generation.live.unavailableTitle')).toBeInTheDocument());
    expect(screen.getByText('admin.generation.live.unavailableNote')).toBeInTheDocument();
    unmount();
  });
});

describe('mapRow', () => {
  it('sanitizes numeric values and keeps the new skipped counter', () => {
    const mapped = mapRow({
      ...LIVE_RUN,
      run_id: 'mapped-run',
      stage_breakdown: { published: '4', writing: 'bad', skipped: 1 },
      skipped_slots: '1',
    });

    expect(mapped).toMatchObject({
      runId: 'mapped-run',
      skippedSlots: 1,
      stageBreakdown: { published: 4, skipped: 1 },
    });
    expect(mapped.stageBreakdown.writing).toBeUndefined();
  });
});
