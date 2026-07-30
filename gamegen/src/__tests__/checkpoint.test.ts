// The checkpoint is the only durable record of what a paid run has already bought.
//
// `CheckpointStore` is shared by ARCADE_CONCURRENCY concurrent slot workers, so
// `save()` is called CONCURRENTLY (gamegen/AGENTS.md). Forge's pre-queue version
// crashed at concurrency 2: two saves built the same pid-only tmp filename, and the
// second rename of an already-renamed-away file threw ENOENT — mid-run, after the
// tokens were spent. Even with unique tmp names, two in-flight renames could still
// land out of order and leave checkpoint.json holding a STALER snapshot than the one
// already on disk, which on the next resume re-pays every stage it forgot.
//
// This suite hammers the queue (interleaved mutations, concurrent saves, a poisoned
// write) and pins the failedFrom/dry-run state semantics the stage-aware retry and
// the dry-run guard both read. No network, no provider, nothing paid.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  CheckpointStore,
  SLOT_LIFECYCLE,
  describeParamMismatch,
  getSlot,
  isSlotDone,
  newRunCheckpoint,
  setSlotState,
  type RunCheckpoint,
  type RunParams,
} from '../pipeline/checkpoint.js';

const PARAMS: RunParams = { kind: 'games', course: 'mi-primer-dinero', locales: ['es-MX', 'en-US', 'pt-BR'], noImages: false };

let runDir: string;
let filePath: string;

beforeEach(() => {
  runDir = mkdtempSync(path.join(tmpdir(), 'arcade-checkpoint-'));
  filePath = path.join(runDir, 'checkpoint.json');
});

afterEach(() => {
  rmSync(runDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function readCheckpoint(): RunCheckpoint {
  return JSON.parse(readFileSync(filePath, 'utf8')) as RunCheckpoint;
}

// ---------------------------------------------------------------------------
// The serialized write queue
// ---------------------------------------------------------------------------

describe('CheckpointStore — concurrent saves', () => {
  it('serializes 40 concurrent saves without ENOENT and without corrupting the file', async () => {
    const store = new CheckpointStore(filePath);
    const checkpoint = newRunCheckpoint('games-mi-primer-dinero-2026-07-30T00:00:00.000Z', 'mi-primer-dinero', PARAMS);

    // The real shape: each worker mutates the SHARED object, then saves — with no
    // awaiting between workers, exactly as ARCADE_CONCURRENCY lanes do.
    const saves: Promise<void>[] = [];
    for (let i = 0; i < 40; i++) {
      setSlotState(checkpoint, `topic-${i}/game-${i}`, 'published', { data: { publishResult: { gameId: `g${i}` } } });
      saves.push(store.save(checkpoint));
    }

    await expect(Promise.all(saves)).resolves.toHaveLength(40);

    // Valid JSON, every slot present, and the LAST snapshot won — the queue preserves
    // call order, so the file can never be staler than a write that already returned.
    const onDisk = readCheckpoint();
    expect(Object.keys(onDisk.slots)).toHaveLength(40);
    expect(onDisk.slots['topic-39/game-39']?.state).toBe('published');

    // No tmp file survives: a leftover means a rename lost its race.
    expect(readdirSync(runDir).filter((name) => name.includes('.tmp-'))).toEqual([]);
  });

  it('a concurrent save never publishes a snapshot older than one already written', async () => {
    const store = new CheckpointStore(filePath);
    const checkpoint = newRunCheckpoint('games-r1', 'c', PARAMS);

    setSlotState(checkpoint, 'a/one', 'authored');
    const first = store.save(checkpoint);
    setSlotState(checkpoint, 'a/one', 'judged');
    const second = store.save(checkpoint);
    setSlotState(checkpoint, 'a/one', 'published');
    const third = store.save(checkpoint);

    await Promise.all([first, second, third]);
    // save() snapshots JSON synchronously at call time, so the on-disk state is the
    // state of the last call — never an earlier one that renamed late.
    expect(readCheckpoint().slots['a/one']?.state).toBe('published');
  });

  it('one failed write does not poison the queue for the saves behind it', async () => {
    // A real, un-mockable I/O failure: the run directory's own path is occupied by a
    // FILE, so mkdir fails with ENOTDIR. (node:fs/promises cannot be vi.spyOn'd — an
    // ESM namespace is not configurable — and faking it would not exercise the
    // queue's actual rejection path anyway.)
    const blocked = path.join(runDir, 'blocker');
    writeFileSync(blocked, 'not a directory', 'utf8');
    const store = new CheckpointStore(path.join(blocked, 'checkpoint.json'));
    const checkpoint = newRunCheckpoint('games-r1', 'c', PARAMS);
    setSlotState(checkpoint, 'a/one', 'authored');

    // The caller sees its own rejection…
    await expect(store.save(checkpoint)).rejects.toThrow();

    // …and the queue keeps running for everything behind it.
    rmSync(blocked, { force: true });
    setSlotState(checkpoint, 'a/one', 'published');
    await expect(store.save(checkpoint)).resolves.toBeUndefined();
    const onDisk = JSON.parse(readFileSync(path.join(blocked, 'checkpoint.json'), 'utf8')) as RunCheckpoint;
    expect(onDisk.slots['a/one']?.state).toBe('published');
  });

  it('load() on a run that has never been saved is null, not a crash', async () => {
    await expect(new CheckpointStore(filePath).load()).resolves.toBeNull();
  });

  it('round-trips a saved checkpoint through load()', async () => {
    const store = new CheckpointStore(filePath);
    const checkpoint = newRunCheckpoint('games-r1', 'c', PARAMS);
    setSlotState(checkpoint, 'a/one', 'illustrated', { data: { documents: { 'es-MX': { ok: true } } } });
    await store.save(checkpoint);

    const loaded = await store.load();
    expect(loaded?.params).toEqual(PARAMS);
    expect(loaded?.slots['a/one']?.data).toEqual({ documents: { 'es-MX': { ok: true } } });
  });
});

// ---------------------------------------------------------------------------
// State semantics the retry and the dry-run guard depend on
// ---------------------------------------------------------------------------

describe('slot state machine', () => {
  it('pins the eight lifecycle states of GAME_ENGINE.md §9, in order', () => {
    expect(SLOT_LIFECYCLE).toEqual([
      'pending',
      'planned',
      'authored',
      'simulated',
      'judged',
      'localized',
      'illustrated',
      'published',
    ]);
  });

  it('records failedFrom on the failed transition and NEVER wipes the paid work', () => {
    let cp = newRunCheckpoint('games-r1', 'c', PARAMS);
    const judged = { documents: { 'es-MX': { fake: true } }, rubric: { kid_safety: 5 } };
    cp = setSlotState(cp, 'a/one', 'judged', { data: judged });
    cp = setSlotState(cp, 'a/one', 'failed', { error: 'localize timed out', failedFrom: 'judged' });

    const slot = getSlot(cp, 'a/one');
    expect(slot.state).toBe('failed');
    expect(slot.failedFrom).toBe('judged');
    expect(slot.data).toEqual(judged); // the judge-approved document survives the failure
  });

  it('clears error and failedFrom on any successful transition', () => {
    let cp = newRunCheckpoint('games-r1', 'c', PARAMS);
    cp = setSlotState(cp, 'a/one', 'failed', { error: 'boom', failedFrom: 'authored' });
    cp = setSlotState(cp, 'a/one', 'localized', {});
    const slot = getSlot(cp, 'a/one');
    expect(slot.error).toBeUndefined();
    expect(slot.failedFrom).toBeUndefined();
  });

  it('an unseen slot reads as pending rather than throwing', () => {
    const cp = newRunCheckpoint('games-r1', 'c', PARAMS);
    expect(getSlot(cp, 'never/seen').state).toBe('pending');
  });

  it("only 'published' is done — 'dry-run' and 'failed' are both retried on resume", () => {
    let cp = newRunCheckpoint('games-r1', 'c', PARAMS);
    cp = setSlotState(cp, 'a/pub', 'published');
    cp = setSlotState(cp, 'a/dry', 'dry-run');
    cp = setSlotState(cp, 'a/fail', 'failed', { error: 'x', failedFrom: 'authored' });
    cp = setSlotState(cp, 'a/ill', 'illustrated');

    expect(isSlotDone(cp, 'a/pub')).toBe(true);
    // The regression this state exists for: a dry-run marker read as a real publish
    // meant a validation pass followed by the real run published NOTHING.
    expect(isSlotDone(cp, 'a/dry')).toBe(false);
    expect(isSlotDone(cp, 'a/fail')).toBe(false);
    expect(isSlotDone(cp, 'a/ill')).toBe(false);
  });
});

describe('describeParamMismatch — a resume must not mix incompatible work', () => {
  it('is null when the parameters match, order-insensitively for locales', () => {
    expect(describeParamMismatch({ ...PARAMS, locales: ['pt-BR', 'en-US', 'es-MX'] }, PARAMS)).toBeNull();
  });

  it('names a locale, image or course change', () => {
    expect(describeParamMismatch({ ...PARAMS, locales: ['es-MX'] }, PARAMS)).toMatch(/locales/);
    expect(describeParamMismatch({ ...PARAMS, noImages: true }, PARAMS)).toMatch(/noImages/);
    expect(describeParamMismatch({ ...PARAMS, course: 'otro' }, PARAMS)).toMatch(/course/);
  });

  it('treats a checkpoint with no params as unknown, never as a match', () => {
    expect(describeParamMismatch(undefined, PARAMS)).toBeTruthy();
  });

  it("carries kind='games' so a game run can never be resumed as, or averaged into, a Forge run", () => {
    expect(PARAMS.kind).toBe('games');
    const forgeShaped = { ...PARAMS, kind: 'lessons' } as unknown as RunParams;
    expect(describeParamMismatch(forgeShaped, PARAMS)).toMatch(/kind/);
  });
});
