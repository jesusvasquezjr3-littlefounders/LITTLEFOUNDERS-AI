import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CheckpointStore,
  RunLock,
  newRunCheckpoint,
  getSlot,
  setSlotState,
  isSlotDone,
} from '../pipeline/checkpoint.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'forge-checkpoint-'));
});

describe('RunLock', () => {
  it('excludes a concurrent process for the same run and releases cleanly', async () => {
    const runDir = path.join(dir, 'locked-run');
    const first = await RunLock.acquire(runDir, 'locked-run');
    await expect(RunLock.acquire(runDir, 'locked-run')).rejects.toThrow(/already active/);
    await first.release();
    const second = await RunLock.acquire(runDir, 'locked-run');
    await second.release();
  });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('checkpoint state machine', () => {
  it('starts every slot as pending', () => {
    const cp = newRunCheckpoint('run-1', 'financial-education');
    expect(getSlot(cp, 'a1/s1/t1/l1').state).toBe('pending');
    expect(isSlotDone(cp, 'a1/s1/t1/l1')).toBe(false);
  });

  it('advances through the full state machine', () => {
    let cp = newRunCheckpoint('run-1', 'financial-education');
    const slotId = 'a1/s1/t1/l1';
    for (const state of ['planned', 'written', 'reviewed', 'localized', 'illustrated', 'published'] as const) {
      cp = setSlotState(cp, slotId, state);
      expect(getSlot(cp, slotId).state).toBe(state);
    }
    expect(isSlotDone(cp, slotId)).toBe(true);
  });

  it('records an error on failure and clears it on the next successful transition', () => {
    let cp = newRunCheckpoint('run-1', 'financial-education');
    const slotId = 'a1/s1/t1/l1';
    cp = setSlotState(cp, slotId, 'failed', { error: 'gate failure: forbidden word' });
    expect(getSlot(cp, slotId).error).toBe('gate failure: forbidden word');

    cp = setSlotState(cp, slotId, 'planned');
    expect(getSlot(cp, slotId).error).toBeUndefined();
  });

  it('preserves stage data across transitions unless overwritten', () => {
    let cp = newRunCheckpoint('run-1', 'financial-education');
    const slotId = 'a1/s1/t1/l1';
    cp = setSlotState(cp, slotId, 'planned', { data: { skeleton: { segments: [] } } });
    expect(getSlot(cp, slotId).data?.skeleton).toBeDefined();
  });
});

describe('CheckpointStore (kill-mid-run resume simulation)', () => {
  it('persists and reloads a run checkpoint across a simulated process restart', async () => {
    const filePath = path.join(dir, 'run-1', 'checkpoint.json');
    const storeBeforeCrash = new CheckpointStore(filePath);

    let cp = newRunCheckpoint('run-1', 'financial-education');
    cp = setSlotState(cp, 'a1/s1/t1/l1', 'planned', { data: { skeleton: { segments: [{ type: 'story_scene', brief: 'x' }] } } });
    cp = setSlotState(cp, 'a1/s1/t1/l1', 'written', { data: { documents: { 'es-MX': { fake: true } } } });
    await storeBeforeCrash.save(cp);
    // Simulate a crash: no further save happens for this slot.

    // "Process restarts" — brand-new CheckpointStore instance reading from disk.
    const storeAfterRestart = new CheckpointStore(filePath);
    const reloaded = await storeAfterRestart.load();
    expect(reloaded).not.toBeNull();
    expect(getSlot(reloaded!, 'a1/s1/t1/l1').state).toBe('written');
    expect(isSlotDone(reloaded!, 'a1/s1/t1/l1')).toBe(false); // NOT published — resume must continue from "written"
    expect((reloaded!.slots['a1/s1/t1/l1']!.data as { documents: unknown }).documents).toBeDefined();
  });

  it('returns null when no checkpoint file exists yet', async () => {
    const store = new CheckpointStore(path.join(dir, 'nonexistent', 'checkpoint.json'));
    expect(await store.load()).toBeNull();
  });

  it('a slot already published stays done across reload and is never redone', async () => {
    const filePath = path.join(dir, 'run-2', 'checkpoint.json');
    const store = new CheckpointStore(filePath);
    let cp = newRunCheckpoint('run-2', 'financial-education');
    cp = setSlotState(cp, 'a1/s1/t1/l1', 'published', { data: { publishResult: { lessonId: 'abc' } } });
    await store.save(cp);

    const reloaded = await new CheckpointStore(filePath).load();
    expect(isSlotDone(reloaded!, 'a1/s1/t1/l1')).toBe(true);
  });

  it('survives concurrent save() calls from parallel slot workers (FORGE_CONCURRENCY > 1) without ENOENT', async () => {
    const filePath = path.join(dir, 'run-3', 'checkpoint.json');
    const store = new CheckpointStore(filePath);
    let cp = newRunCheckpoint('run-3', 'financial-education');

    // Simulate two concurrent slot workers sharing the SAME checkpoint object
    // (exactly what run.ts's promisePool does), each racing to save().
    const saves: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      cp = setSlotState(cp, `a1/s1/t1/l${i}`, 'written', { data: { i } });
      saves.push(store.save(cp));
    }
    await expect(Promise.all(saves)).resolves.toBeDefined();

    // The final on-disk state must reflect ALL 10 slots — not a stale
    // mid-sequence snapshot from an earlier save() that happened to finish last.
    const reloaded = await new CheckpointStore(filePath).load();
    for (let i = 0; i < 10; i++) {
      expect(getSlot(reloaded!, `a1/s1/t1/l${i}`).state).toBe('written');
    }
  });
});
