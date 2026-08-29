import { describe, expect, it, vi } from 'vitest';
import { mayDemonstrate, runTrayDemo, TRAY_TYPES } from '../trayDemo';
import type { TrayDemoStep } from '../types';

/*
 * THE TUTOR'S HANDS.
 *
 * "Mira, si agrego esta moneda…" — the tutor moves the learner's own money
 * tray while it speaks. The blueprint calls this the thing that separates a
 * tutor from a quiz (§10.2), and it had no test: a driver that writes directly
 * into a child's unsubmitted answer, with nothing checking what it writes.
 *
 * Every case here is something that would reach a learner as the tutor's hands
 * doing the wrong thing — adding a coin the activity does not offer, taking
 * back the wrong one, or carrying on after the child interrupted.
 */

/** Drives the same controlled draft a real tap changes. */
function tray(initial: number[] = []) {
  let picked = [...initial];
  return {
    getPicked: () => picked,
    setPicked: (next: number[]) => {
      picked = next;
    },
    get value() {
      return picked;
    },
  };
}

const COINS = [1, 5, 10];
/** Zero step delay: the timing is the renderer's business, not this driver's. */
const FAST = { stepMs: 0 };

describe('what the tutor puts on the tray', () => {
  it('adds and removes in the order it was told', async () => {
    const io = tray();
    const steps: TrayDemoStep[] = [
      { kind: 'add', denomination: 10 },
      { kind: 'add', denomination: 5 },
      { kind: 'remove', denomination: 10 },
    ];
    await runTrayDemo(steps, COINS, io, FAST);
    expect(io.value).toEqual([5]);
  });

  it('DROPS a coin the activity does not offer', async () => {
    // The schema upstream bounds the shape; this bounds the content. A tutor
    // putting a 50 on a tray that only has 1, 5 and 10 is showing a child a
    // move they cannot make themselves.
    const io = tray();
    await runTrayDemo([{ kind: 'add', denomination: 50 }], COINS, io, FAST);
    expect(io.value).toEqual([]);
  });

  it('takes back the coin it most recently put down', async () => {
    // `lastIndexOf`, not `indexOf`. Removing the FIRST 5 of three would leave
    // the same multiset here, so the case is built to tell them apart.
    const io = tray([5, 10, 5]);
    await runTrayDemo([{ kind: 'remove', denomination: 5 }], COINS, io, FAST);
    expect(io.value).toEqual([5, 10]);
  });

  it('ignores a removal of something that is not there', async () => {
    const io = tray([1]);
    await runTrayDemo([{ kind: 'remove', denomination: 10 }], COINS, io, FAST);
    expect(io.value).toEqual([1]);
  });
});

describe('when the learner interrupts', () => {
  it('stops between steps and never mid-update', async () => {
    // A child reaching for the tray must get it back. Aborting has to leave a
    // coherent tray — the demo's own steps, up to where it stopped — never a
    // half-applied one.
    const io = tray();
    const abort = new AbortController();
    const steps: TrayDemoStep[] = [
      { kind: 'add', denomination: 1 },
      { kind: 'add', denomination: 5 },
      { kind: 'add', denomination: 10 },
    ];
    const running = runTrayDemo(steps, COINS, io, { signal: abort.signal, stepMs: 50 });
    abort.abort();
    await running;
    expect(io.value.length).toBeLessThan(3);
    expect(io.value.every((c) => COINS.includes(c))).toBe(true);
  });

  it('resolves rather than hanging when aborted during a pause', async () => {
    const io = tray();
    const abort = new AbortController();
    const running = runTrayDemo([{ kind: 'pause', ms: 2_000 }], COINS, io, { signal: abort.signal });
    abort.abort();
    await expect(running).resolves.toBeUndefined();
  });
});

describe('the bounds the driver enforces itself', () => {
  it('never plays more than eight steps', async () => {
    // A demonstration is a beat in a conversation, not a cutscene. Twelve
    // requested, eight played.
    const io = tray();
    const steps: TrayDemoStep[] = Array.from({ length: 12 }, () => ({
      kind: 'add' as const,
      denomination: 1,
    }));
    await runTrayDemo(steps, COINS, io, FAST);
    expect(io.value).toHaveLength(8);
  });

  it('clamps a pause a model asked to be absurd', async () => {
    vi.useFakeTimers();
    try {
      const io = tray();
      const running = runTrayDemo([{ kind: 'pause', ms: 999_999 }], COINS, io, {});
      // The ceiling is two seconds; advancing past it must finish the demo.
      await vi.advanceTimersByTimeAsync(2_100);
      await expect(running).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('which activities the tutor may touch', () => {
  it('knows the tray types and nothing else', () => {
    // A demo aimed at a segment that is not a tray is ignored fail-safe by the
    // panel, and this set is what it asks.
    expect(TRAY_TYPES.has('coin_count')).toBe(true);
    expect(TRAY_TYPES.has('make_change')).toBe(true);
    expect(TRAY_TYPES.has('sort_buckets')).toBe(false);
  });
});

describe('when the tutor may touch the tray at all', () => {
  /*
   * Four guards protecting a child's unsubmitted answer. They lived inside a
   * `useEffect` in a component with no test file, so the only thing holding
   * them was that nobody edited them.
   */
  const ok = {
    demoSeq: 2,
    lastPlayedSeq: 1,
    segmentType: 'coin_count',
    answeredCorrectly: false,
    denominations: [1, 5, 10],
  };

  it('demonstrates when everything is in order', () => {
    expect(mayDemonstrate(ok)).toBe(true);
  });

  it('never replays a demonstration it already played', () => {
    // The same seq arriving twice is a re-render, not a second instruction.
    // Replaying would double every coin the tutor put down.
    expect(mayDemonstrate({ ...ok, lastPlayedSeq: 2 })).toBe(false);
  });

  it('does not reach into an activity that is not a tray', () => {
    expect(mayDemonstrate({ ...ok, segmentType: 'sort_buckets' })).toBe(false);
  });

  it('does not rewrite an answer the learner already got right', () => {
    // That answer has been graded and paid. Moving coins in it afterwards
    // edits a result the child was already told was correct.
    expect(mayDemonstrate({ ...ok, answeredCorrectly: true })).toBe(false);
  });

  it('refuses a payload that offers no legal move', () => {
    expect(mayDemonstrate({ ...ok, denominations: [] })).toBe(false);
    expect(mayDemonstrate({ ...ok, denominations: undefined })).toBe(false);
    expect(mayDemonstrate({ ...ok, denominations: 'coins' })).toBe(false);
  });

  it('does nothing when there is no demonstration', () => {
    expect(mayDemonstrate({ ...ok, demoSeq: null })).toBe(false);
  });
});
