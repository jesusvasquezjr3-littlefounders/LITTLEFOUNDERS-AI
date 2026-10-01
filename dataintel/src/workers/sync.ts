import { syncAll, refreshAggregates } from '../db/sync.js';
import { refreshLearnerSkillStates } from '../services/learning.js';
import { getConfig } from '../env.js';
import { isReady } from '../db/duckdb.js';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let paused = false;

export function pauseSyncWorker(): void { paused = true; }
export function resumeSyncWorker(): void { paused = false; }
export function isSyncWorkerIdle(): boolean { return !running; }

export function startSyncWorker(): void {
  const config = getConfig();

  void runSync();

  timer = setInterval(() => void runSync(), config.SYNC_INTERVAL_MS);
}

export function stopSyncWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function runSync(): Promise<void> {
  if (!isReady()) return;
  if (paused) return;
  if (running) return;

  try {
    running = true;
    console.log('[dataintel] Starting sync...');
    const result = await syncAll();
    await refreshAggregates();
    await refreshLearnerSkillStates();
    console.log(
      `[dataintel] Sync complete:`,
      result.tables,
      `in ${result.elapsed}ms`,
    );
  } catch (err) {
    console.error('[dataintel] Sync failed:', err);
  } finally {
    running = false;
  }
}
