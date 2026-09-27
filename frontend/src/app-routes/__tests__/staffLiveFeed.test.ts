import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLiveFeed } from '../staffLiveFeed';

/*
 * REGRESSION COVER FOR A LATCHING REALTIME FAILURE, carried over from the
 * legacy Live Monitor's test (LiveStats.realtime.test.tsx) to the rebuilt
 * Generation page's push feed (W2T.2).
 *
 * `supabase.channel(topic)` returns the EXISTING channel for a registered
 * topic, and `.on('postgres_changes', ...)` on a channel already subscribed
 * THROWS. The client is a module singleton, so a fixed topic latched after
 * the first remount: the throw landed mid-chain, the channel was never kept,
 * the cleanup had nothing to remove, and every later attempt threw too while
 * the page showed ordinary polling. The fake reproduces those three library
 * behaviours (same instance for a repeated topic, `.on()` after `.subscribe()`
 * throws, the topic freed only when an async removal resolves).
 */

function fakeClient() {
  const removed: string[] = [];
  const channels = new Map<string, ReturnType<typeof makeChannel>>();
  function makeChannel(topic: string) {
    const state = { subscribed: false, handler: null as null | ((payload: unknown) => void) };
    const channel = {
      topic,
      on(_event: string, _filter: unknown, handler: (payload: unknown) => void) {
        if (state.subscribed) throw new Error(`cannot add \`postgres_changes\` callbacks for realtime:${topic} after \`subscribe()\`.`);
        state.handler = handler;
        return channel;
      },
      subscribe(callback?: (status: string) => void) { state.subscribed = true; callback?.('SUBSCRIBED'); return channel; },
      push(payload: unknown) { state.handler?.(payload); },
    };
    return channel;
  }
  const client = {
    realtime: { setAuth: vi.fn(async () => undefined) },
    channel(topic: string) {
      const existing = channels.get(topic);
      if (existing) return existing;
      const created = makeChannel(topic);
      channels.set(topic, created);
      return created;
    },
    async removeChannel(channel: { topic: string }) { removed.push(channel.topic); await Promise.resolve(); channels.delete(channel.topic); return 'ok'; },
  };
  return { client: client as unknown as SupabaseClient & typeof client, removed, channels };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the Generation page\'s Realtime feed', () => {
  it('is absent where the public Supabase variables are not deployed (Core polling alone)', () => {
    expect(createLiveFeed(() => null, async () => 'token')).toBeUndefined();
  });

  it('reconnects across remounts instead of latching on a reused topic, and maps pushed rows', async () => {
    const { client, removed, channels } = fakeClient();
    const feed = createLiveFeed(() => client, async () => 'token')!;
    const statuses: string[] = [];
    const runs: string[] = [];
    const removedRuns: string[] = [];
    const handlers = { onRun: (run: { runId: string }) => runs.push(run.runId), onRemove: (id: string) => removedRuns.push(id), onStatus: (status: string) => statuses.push(status) };
    const stopFirst = feed.subscribe(handlers);
    await flush();
    stopFirst();
    const stopSecond = feed.subscribe(handlers);
    await flush();
    expect(statuses).toEqual(['connected', 'connected']);
    const [live] = [...channels.values()].slice(-1);
    live!.push({ eventType: 'UPDATE', new: { run_id: 'r1', course_slug: 'money-basics', total_slots: 4, updated_at: '2026-09-26T00:00:00Z' } });
    live!.push({ eventType: 'DELETE', old: { run_id: 'r1' } });
    expect(runs).toEqual(['r1']);
    expect(removedRuns).toEqual(['r1']);
    stopSecond();
    await flush();
    expect(removed).toHaveLength(2);
    expect(new Set(removed).size).toBe(2);
  });

  it('reports a failed subscription instead of passing it off as polling', async () => {
    const { client } = fakeClient();
    client.realtime.setAuth.mockRejectedValueOnce(new Error('realtime auth refused'));
    const statuses: string[] = [];
    const stop = createLiveFeed(() => client, async () => 'token')!.subscribe({ onRun: () => {}, onRemove: () => {}, onStatus: (status) => statuses.push(status) });
    await flush();
    expect(statuses).toEqual(['failed']);
    stop();
  });
});
