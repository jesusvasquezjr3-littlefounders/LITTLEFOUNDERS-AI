import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LiveStats } from '../LiveStats';

/*
 * REGRESSION COVER FOR A LATCHING REALTIME FAILURE.
 *
 * `supabase.channel(topic)` returns the EXISTING channel when that topic is
 * already registered, and `.on('postgres_changes', ...)` on a channel that has
 * already been subscribed THROWS. The client is a module singleton
 * (lib/supabaseRealtime.ts), so its registry outlives any one mount of this
 * component - and LiveStats used the fixed topic 'generation-live'.
 *
 * The second mount therefore threw. Because the throw landed mid-chain the
 * channel reference was never assigned, so the cleanup had nothing to remove,
 * so the topic stayed registered and EVERY later attempt threw too: the admin
 * Live Monitor lost its push transport for the rest of the browser session
 * while displaying the ordinary polling state.
 *
 * The fake below reproduces exactly those three library behaviours - same
 * instance returned for a repeated topic, `.on()` after `.subscribe()` throws,
 * topic stays registered until an async removal resolves - all verified against
 * the installed @supabase/realtime-js. A fake that let `.on()` succeed twice
 * would pass against the original bug, which is the whole point: both tests
 * here were confirmed to FAIL against the previous code, with its error.
 */

const { mockApi, mockGetToken, mockOnHeartbeat, removeCalls } = vi.hoisted(() => ({
  mockApi: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('fake-token'),
  mockOnHeartbeat: vi.fn(),
  removeCalls: [] as string[],
}));

const { fakeClient } = vi.hoisted(() => {
  function makeChannel(topic: string) {
    const state = { subscribed: false };
    const channel = {
      topic,
      on(_event: string, _filter: unknown, _cb: unknown) {
        if (state.subscribed) {
          throw new Error(
            `cannot add \`postgres_changes\` callbacks for realtime:${topic} after \`subscribe()\`.`,
          );
        }
        return channel;
      },
      subscribe(cb?: (status: string) => void) {
        state.subscribed = true;
        cb?.('SUBSCRIBED');
        return channel;
      },
    };
    return channel;
  }

  const channels = new Map<string, ReturnType<typeof makeChannel>>();
  const fakeClient = {
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
    channel(topic: string) {
      const existing = channels.get(topic);
      if (existing) return existing;
      const created = makeChannel(topic);
      channels.set(topic, created);
      return created;
    },
    // Async, like the real one, and the topic is only freed once it resolves -
    // which is what let an un-awaited teardown race the next subscribe.
    async removeChannel(channel: { topic: string }) {
      removeCalls.push(channel.topic);
      await Promise.resolve();
      channels.delete(channel.topic);
      return 'ok';
    },
  };
  return { fakeClient };
});

vi.mock('@/lib/api', () => ({ api: mockApi }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ getToken: mockGetToken }) }));
vi.mock('@/lib/supabaseRealtime', () => ({ getSupabaseClient: () => fakeClient }));
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
  failedSlots: 0,
  skippedSlots: 0,
  totalSlots: 8,
  stageBreakdown: { writing: 2, published: 4 },
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
  mockApi.mockResolvedValue({ data: { activeRuns: [LIVE_RUN] }, error: null });
  mockGetToken.mockResolvedValue('fake-token');
  mockOnHeartbeat.mockReset();
  removeCalls.length = 0;
});

describe('LiveStats realtime subscription', () => {
  it('reconnects across remounts instead of latching on a reused channel topic', async () => {
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => {
      rejections.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);

    try {
      const first = render(<LiveStats onHeartbeat={mockOnHeartbeat} />);
      await waitFor(() => expect(screen.getByText('admin.generation.live.realtime')).toBeInTheDocument());
      first.unmount();

      // The remount is the whole point: this is where the old code threw.
      const second = render(<LiveStats onHeartbeat={mockOnHeartbeat} />);
      await waitFor(() => expect(screen.getByText('admin.generation.live.realtime')).toBeInTheDocument());

      // Not "it did not crash" - CONNECTED. A component that silently fell back
      // to polling would also render without throwing.
      expect(screen.queryByText('admin.generation.live.realtimeFailed')).not.toBeInTheDocument();
      second.unmount();

      await waitFor(() => expect(removeCalls.length).toBeGreaterThanOrEqual(2));
      // Each mount claimed its own topic; none was reused.
      expect(new Set(removeCalls).size).toBe(removeCalls.length);
    } finally {
      window.removeEventListener('unhandledrejection', onRejection);
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rejections).toEqual([]);
  });

  it('reports a failed subscription rather than passing it off as ordinary polling', async () => {
    // The mode this replaced was invisible precisely because the fallback state
    // looks healthy. Rejected on the REALTIME path specifically: `getToken` is
    // shared with the Core polling effect, so failing that would prove nothing
    // about which effect noticed.
    fakeClient.realtime.setAuth.mockRejectedValueOnce(new Error('realtime auth refused'));

    const { unmount } = render(<LiveStats onHeartbeat={mockOnHeartbeat} />);

    await waitFor(() => expect(screen.getByText('admin.generation.live.realtimeFailed')).toBeInTheDocument());
    unmount();
  });
});
