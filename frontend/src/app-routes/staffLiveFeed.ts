import type { SupabaseClient } from '@supabase/supabase-js';
import { mapLiveRow, type LiveFeed } from '@/rebuild/staff/console/generationApi';
import { can, type StaffViewer } from '@/rebuild/staff/console/staffConsoleApi';

/*
 * Lane 6 (staff): the Generation page's push transport (W2T.2), carried over
 * from the legacy Live Monitor. Supabase Realtime on `generation_runs_live`
 * (its RLS, since generation_live_manage_content, admits a superadmin or an
 * admin holding manage_content, the G.1 grant of the Generation screen; the
 * table carries no personal data) only ACCELERATES what the rebuilt page already polls from Core every
 * 4 s. The rebuilt console never imports the Supabase client (02 rule 23), so
 * the route host hands it this feed, or none where the public Supabase
 * variables are not deployed.
 *
 * Two library behaviours shape it (verified against @supabase/realtime-js by
 * the legacy regression test, carried over in __tests__/staffLiveFeed.test.ts):
 * `client.channel(topic)` returns the EXISTING channel for a registered topic,
 * and `.on(...)` after `.subscribe()` throws. The client is a module
 * singleton, so a fixed topic latched after the first remount: every attempt
 * gets its own topic, the channel is kept before anything can throw, removal
 * is awaited before a retry, and a throw is REPORTED as a failed push, never
 * shown as ordinary polling.
 */

const RETRY_MS = 3_000;
const REAUTH_MS = 10 * 60 * 1000;

/** Module-scoped like the client it feeds: a per-instance counter would restart and reuse a topic. */
let topicSeq = 0;

export function createLiveFeed(getClient: () => SupabaseClient | null, getToken: () => Promise<string | null>, viewer: StaffViewer): LiveFeed | undefined {
  // G.1: a viewer without manage_content never attempts the subscription the
  // database would refuse (it reads nothing); Core polling is refused too.
  if (!can(viewer, 'manage_content')) return undefined;
  const client = getClient();
  if (!client) return undefined;
  return {
    subscribe({ onRun, onRemove, onStatus }) {
      let cancelled = false;
      let channel: ReturnType<SupabaseClient['channel']> | null = null;
      let retry: ReturnType<typeof setTimeout> | null = null;

      const scheduleRetry = () => {
        if (cancelled) return;
        if (retry) clearTimeout(retry);
        retry = setTimeout(() => { if (!cancelled) void resubscribe(); }, RETRY_MS);
      };
      const resubscribe = async () => {
        const previous = channel;
        channel = null;
        if (previous) {
          try { await client.removeChannel(previous); } catch { /* a channel already gone is not a failure */ }
        }
        if (!cancelled) await attempt();
      };
      const subscribe = async () => {
        const token = await getToken();
        if (!token || cancelled) return;
        await client.realtime.setAuth(token);
        if (cancelled) return;
        topicSeq += 1;
        const next = client.channel(`generation-live-${topicSeq}`);
        channel = next;
        next
          .on('postgres_changes', { event: '*', schema: 'public', table: 'generation_runs_live' }, (payload) => {
            if (cancelled) return;
            if (payload.eventType === 'DELETE') { onRemove(String((payload.old as Record<string, unknown>).run_id ?? '')); return; }
            onRun(mapLiveRow(payload.new as Record<string, unknown>));
          })
          .subscribe((status) => {
            if (cancelled) return;
            if (status === 'SUBSCRIBED') onStatus('connected');
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { onStatus('failed'); scheduleRetry(); }
          });
      };
      const attempt = async () => {
        try { await subscribe(); } catch { onStatus('failed'); scheduleRetry(); }
      };

      void attempt();
      const reauth = setInterval(() => {
        void (async () => {
          const fresh = await getToken();
          if (fresh && !cancelled) await client.realtime.setAuth(fresh);
        })().catch(() => {});
      }, REAUTH_MS);

      return () => {
        cancelled = true;
        clearInterval(reauth);
        if (retry) clearTimeout(retry);
        if (channel) void client.removeChannel(channel).catch(() => {});
      };
    },
  };
}
