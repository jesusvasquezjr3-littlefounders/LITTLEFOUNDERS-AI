import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigCache } from '../env.js';
import { LiveTelemetry } from '../pipeline/liveTelemetry.js';

const mocks = vi.hoisted(() => ({
  vaultUpsert: vi.fn(async () => []),
}));

vi.mock('../vault/restClient.js', () => ({ vaultUpsert: mocks.vaultUpsert }));

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://vault.example.com';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv-test-key';
  resetConfigCache();
  mocks.vaultUpsert.mockClear();
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  resetConfigCache();
});

describe('LiveTelemetry', () => {
  it('publishes an initial row and keeps terminal counters accurate', async () => {
    const telemetry = new LiveTelemetry({
      runId: 'run-1',
      courseSlug: 'financial-education',
      register: 'kid',
      totalSlots: 3,
    });

    await telemetry.flush();
    telemetry.seedCompleted(['slot-published']);
    telemetry.onTransition('slot-failed', 'failed');
    telemetry.markSkipped('slot-skipped');
    telemetry.setCost(1200, 0.42, 300);
    await telemetry.flush();

    const liveWrites = mocks.vaultUpsert.mock.calls.filter(([table]) => table === 'generation_runs_live');
    const snapshotWrites = mocks.vaultUpsert.mock.calls.filter(([table]) => table === 'generation_heartbeat_snapshots');
    expect(liveWrites).toHaveLength(2);
    expect(snapshotWrites).toHaveLength(2);

    const latestLiveRow = liveWrites.at(-1)?.[1]?.[0] as Record<string, unknown>;
    expect(latestLiveRow).toMatchObject({
      active_slots: 0,
      completed_slots: 1,
      failed_slots: 1,
      skipped_slots: 1,
      total_slots: 3,
      tokens_used: 1200,
      cached_tokens: 300,
    });
  });
});
