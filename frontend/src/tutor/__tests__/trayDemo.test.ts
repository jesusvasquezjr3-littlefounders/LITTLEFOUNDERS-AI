import { describe, expect, it, vi } from 'vitest';
import { mayDemonstrate, runTrayDemo, TRAY_TYPES } from '../trayDemo';
import type { TrayDemoStep } from '../types';

/*
 * THE TUTOR'S HANDS.
 *
 * "Mira, si agrego esta moneda…" — the tutor moves the learner's own draft
 * while it speaks. The blueprint calls this the thing that separates a
 * tutor from a quiz (§10.2), and it had no test: a driver that writes
 * directly into a child's unsubmitted answer, with nothing checking what it
 * writes.
 *
 * Every case here is something that would reach a learner as the tutor's
 * hands doing the wrong thing — adding a coin the activity does not offer,
 * placing an item that is not in the bank, assigning to a bucket that does
 * not exist, or carrying on after the child interrupted.
 *
 * `order_steps`/`sort_buckets`/`match_pairs` are tested here even though
 * nothing in `prompt.ts` currently asks the model to emit `place`/`assign`/
 * `pair` (see the long comment on trayDemo.ts's own header) — the adapters
 * are real, shipped, reachable via `runTrayDemo` by ANY caller, and a
 * defect in one would be exactly as harmful the day the prompt gap closes
 * as it would be today.
 */

/**
 * Drives a generic draft the same way `LiveSegmentPanel` really does: a bare
 * replace (`setDraft(next)` over `useState`), never a merge. Each adapter is
 * therefore responsible for returning a COMPLETE draft, exactly as the real
 * lesson-engine components' own `onChange({ ...draft, ...changes })` calls
 * do — verified against `SortBuckets`/`MatchPairs`/`OrderSteps`/`NumberLine`
 * in `frontend/src/lesson-engine/families/arrange/components.tsx` before
 * writing the adapters this file tests.
 */
function draftIo<T>(initial: T) {
  let draft: unknown = initial;
  return {
    getDraft: () => draft,
    setDraft: (next: unknown) => {
      draft = next;
    },
    get value() {
      return draft as T;
    },
  };
}

const COIN_PAYLOAD = { denominations: [1, 5, 10] };
/** Zero step delay: the timing is the renderer's business, not this driver's. */
const FAST = { stepMs: 0 };

describe('what the tutor puts on the money tray', () => {
  it('adds and removes in the order it was told', async () => {
    const io = draftIo<{ picked: number[] }>({ picked: [] });
    const steps: TrayDemoStep[] = [
      { kind: 'add', denomination: 10 },
      { kind: 'add', denomination: 5 },
      { kind: 'remove', denomination: 10 },
    ];
    await runTrayDemo('coin_count', COIN_PAYLOAD, steps, io, FAST);
    expect(io.value.picked).toEqual([5]);
  });

  it('DROPS a coin the activity does not offer', async () => {
    // The schema upstream bounds the shape; this bounds the content. A tutor
    // putting a 50 on a tray that only has 1, 5 and 10 is showing a child a
    // move they cannot make themselves.
    const io = draftIo<{ picked: number[] }>({ picked: [] });
    await runTrayDemo('coin_count', COIN_PAYLOAD, [{ kind: 'add', denomination: 50 }], io, FAST);
    expect(io.value.picked).toEqual([]);
  });

  it('takes back the coin it most recently put down', async () => {
    // `lastIndexOf`, not `indexOf`. Removing the FIRST 5 of three would leave
    // the same multiset here, so the case is built to tell them apart.
    const io = draftIo<{ picked: number[] }>({ picked: [5, 10, 5] });
    await runTrayDemo('coin_count', COIN_PAYLOAD, [{ kind: 'remove', denomination: 5 }], io, FAST);
    expect(io.value.picked).toEqual([5, 10]);
  });

  it('ignores a removal of something that is not there', async () => {
    const io = draftIo<{ picked: number[] }>({ picked: [1] });
    await runTrayDemo('coin_count', COIN_PAYLOAD, [{ kind: 'remove', denomination: 10 }], io, FAST);
    expect(io.value.picked).toEqual([1]);
  });
});

describe('when the learner interrupts', () => {
  it('stops between steps and never mid-update', async () => {
    // A child reaching for the tray must get it back. Aborting has to leave a
    // coherent tray — the demo's own steps, up to where it stopped — never a
    // half-applied one.
    const io = draftIo<{ picked: number[] }>({ picked: [] });
    const abort = new AbortController();
    const steps: TrayDemoStep[] = [
      { kind: 'add', denomination: 1 },
      { kind: 'add', denomination: 5 },
      { kind: 'add', denomination: 10 },
    ];
    const running = runTrayDemo('coin_count', COIN_PAYLOAD, steps, io, { signal: abort.signal, stepMs: 50 });
    abort.abort();
    await running;
    expect(io.value.picked.length).toBeLessThan(3);
    expect(io.value.picked.every((c) => COIN_PAYLOAD.denominations.includes(c))).toBe(true);
  });

  it('resolves rather than hanging when aborted during a pause', async () => {
    const io = draftIo<{ picked: number[] }>({ picked: [] });
    const abort = new AbortController();
    const running = runTrayDemo('coin_count', COIN_PAYLOAD, [{ kind: 'pause', ms: 2_000 }], io, {
      signal: abort.signal,
    });
    abort.abort();
    await expect(running).resolves.toBeUndefined();
  });
});

describe('the bounds the driver enforces itself', () => {
  it('never plays more than eight steps', async () => {
    // A demonstration is a beat in a conversation, not a cutscene. Twelve
    // requested, eight played.
    const io = draftIo<{ picked: number[] }>({ picked: [] });
    const steps: TrayDemoStep[] = Array.from({ length: 12 }, () => ({
      kind: 'add' as const,
      denomination: 1,
    }));
    await runTrayDemo('coin_count', COIN_PAYLOAD, steps, io, FAST);
    expect(io.value.picked).toHaveLength(8);
  });

  it('clamps a pause a model asked to be absurd', async () => {
    vi.useFakeTimers();
    try {
      const io = draftIo<{ picked: number[] }>({ picked: [] });
      const running = runTrayDemo('coin_count', COIN_PAYLOAD, [{ kind: 'pause', ms: 999_999 }], io, {});
      // The ceiling is two seconds; advancing past it must finish the demo.
      await vi.advanceTimersByTimeAsync(2_100);
      await expect(running).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing for a segment type with no adapter', async () => {
    const io = draftIo<{ picked: number[] }>({ picked: [] });
    await runTrayDemo('memory_flip', COIN_PAYLOAD, [{ kind: 'add', denomination: 1 }], io, FAST);
    expect(io.value.picked).toEqual([]);
  });
});

describe('placing a step in an order_steps sequence', () => {
  const PAYLOAD = { items: [{ id: 'azucar' }, { id: 'limones' }, { id: 'vaso-chico' }] };

  it('appends a real item to the next open slot', async () => {
    const io = draftIo<{ order: string[] }>({ order: [] });
    await runTrayDemo('order_steps', PAYLOAD, [{ kind: 'place', item: 'azucar' }], io, FAST);
    expect(io.value.order).toEqual(['azucar']);
  });

  it('DROPS a place naming an id the bank does not have', async () => {
    const io = draftIo<{ order: string[] }>({ order: [] });
    await runTrayDemo('order_steps', PAYLOAD, [{ kind: 'place', item: 'no-existe' }], io, FAST);
    expect(io.value.order).toEqual([]);
  });

  it('DROPS a place for an item already in the sequence', async () => {
    const io = draftIo<{ order: string[] }>({ order: ['azucar'] });
    await runTrayDemo('order_steps', PAYLOAD, [{ kind: 'place', item: 'azucar' }], io, FAST);
    expect(io.value.order).toEqual(['azucar']);
  });

  it('DROPS a place once every slot is filled', async () => {
    const io = draftIo<{ order: string[] }>({ order: ['azucar', 'limones', 'vaso-chico'] });
    await runTrayDemo('order_steps', PAYLOAD, [{ kind: 'place', item: 'azucar' }], io, FAST);
    expect(io.value.order).toEqual(['azucar', 'limones', 'vaso-chico']);
  });
});

describe('assigning an item to a sort_buckets bucket', () => {
  const PAYLOAD = {
    buckets: [{ id: 'needs' }, { id: 'wants' }],
    items: [{ id: 'azucar' }, { id: 'juguete' }],
  };

  it('assigns a real item to a real bucket', async () => {
    const io = draftIo<{ assignments: Record<string, string> }>({ assignments: {} });
    await runTrayDemo('sort_buckets', PAYLOAD, [{ kind: 'assign', item: 'azucar', bucket: 'needs' }], io, FAST);
    expect(io.value.assignments).toEqual({ azucar: 'needs' });
  });

  it('DROPS an assign naming a bucket the payload does not have', async () => {
    const io = draftIo<{ assignments: Record<string, string> }>({ assignments: {} });
    await runTrayDemo('sort_buckets', PAYLOAD, [{ kind: 'assign', item: 'azucar', bucket: 'quizas' }], io, FAST);
    expect(io.value.assignments).toEqual({});
  });

  it('DROPS an assign naming an item the payload does not have', async () => {
    const io = draftIo<{ assignments: Record<string, string> }>({ assignments: {} });
    await runTrayDemo('sort_buckets', PAYLOAD, [{ kind: 'assign', item: 'no-existe', bucket: 'needs' }], io, FAST);
    expect(io.value.assignments).toEqual({});
  });
});

describe('committing a match_pairs pair', () => {
  const PAYLOAD = {
    left: [{ id: 'moneda-1' }, { id: 'moneda-5' }],
    right: [{ id: 'una-peseta' }, { id: 'cinco-pesos' }],
  };

  it('commits a real left/right pair', async () => {
    const io = draftIo<{ pairs: [string, string][] }>({ pairs: [] });
    await runTrayDemo('match_pairs', PAYLOAD, [{ kind: 'pair', left: 'moneda-1', right: 'una-peseta' }], io, FAST);
    expect(io.value.pairs).toEqual([['moneda-1', 'una-peseta']]);
  });

  it('DROPS a pair naming an id off either list', async () => {
    const io = draftIo<{ pairs: [string, string][] }>({ pairs: [] });
    await runTrayDemo('match_pairs', PAYLOAD, [{ kind: 'pair', left: 'moneda-1', right: 'no-existe' }], io, FAST);
    expect(io.value.pairs).toEqual([]);
  });

  it('DROPS a pair reusing a side already matched', async () => {
    const io = draftIo<{ pairs: [string, string][] }>({ pairs: [['moneda-1', 'una-peseta']] });
    await runTrayDemo('match_pairs', PAYLOAD, [{ kind: 'pair', left: 'moneda-1', right: 'cinco-pesos' }], io, FAST);
    expect(io.value.pairs).toEqual([['moneda-1', 'una-peseta']]);
  });
});

describe('moving the number_line marker', () => {
  const PAYLOAD = { min: 0, max: 10 };

  it('moves the marker to a value inside the line', async () => {
    const io = draftIo<{ value: number; touched: boolean }>({ value: 0, touched: false });
    await runTrayDemo('number_line', PAYLOAD, [{ kind: 'move', value: 6 }], io, FAST);
    expect(io.value).toEqual({ value: 6, touched: true });
  });

  it('clamps a value past the line\'s own max', async () => {
    const io = draftIo<{ value: number; touched: boolean }>({ value: 0, touched: false });
    await runTrayDemo('number_line', PAYLOAD, [{ kind: 'move', value: 999 }], io, FAST);
    expect(io.value.value).toBe(10);
  });

  it('clamps a value before the line\'s own min', async () => {
    const io = draftIo<{ value: number; touched: boolean }>({ value: 0, touched: false });
    await runTrayDemo('number_line', PAYLOAD, [{ kind: 'move', value: -999 }], io, FAST);
    expect(io.value.value).toBe(0);
  });
});

describe('which activities the tutor may touch', () => {
  it('knows every family with an adapter, including the three the prompt does not yet invite', () => {
    // TRAY_TYPES tracks DEFINED capability (what `runTrayDemo` can drive), not
    // LIVE vocabulary (what the model is currently invited to ask for) — see
    // trayDemo.ts's header. `place`/`assign`/`pair` are real and tested even
    // though prompt.ts withholds them today.
    expect(TRAY_TYPES.has('coin_count')).toBe(true);
    expect(TRAY_TYPES.has('make_change')).toBe(true);
    expect(TRAY_TYPES.has('order_steps')).toBe(true);
    expect(TRAY_TYPES.has('sort_buckets')).toBe(true);
    expect(TRAY_TYPES.has('match_pairs')).toBe(true);
    expect(TRAY_TYPES.has('number_line')).toBe(true);
    expect(TRAY_TYPES.has('memory_flip')).toBe(false);
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
    payload: COIN_PAYLOAD,
  };

  it('demonstrates when everything is in order', () => {
    expect(mayDemonstrate(ok)).toBe(true);
  });

  it('never replays a demonstration it already played', () => {
    // The same seq arriving twice is a re-render, not a second instruction.
    // Replaying would double every coin the tutor put down.
    expect(mayDemonstrate({ ...ok, lastPlayedSeq: 2 })).toBe(false);
  });

  it('does not reach into an activity with no adapter', () => {
    expect(mayDemonstrate({ ...ok, segmentType: 'memory_flip' })).toBe(false);
  });

  it('does not rewrite an answer the learner already got right', () => {
    // That answer has been graded and paid. Moving coins in it afterwards
    // edits a result the child was already told was correct.
    expect(mayDemonstrate({ ...ok, answeredCorrectly: true })).toBe(false);
  });

  it('refuses a money payload that offers no legal move', () => {
    expect(mayDemonstrate({ ...ok, payload: { denominations: [] } })).toBe(false);
    expect(mayDemonstrate({ ...ok, payload: {} })).toBe(false);
    expect(mayDemonstrate({ ...ok, payload: { denominations: 'coins' } })).toBe(false);
  });

  it('reads items/buckets/left-right/min-max for the other four families', () => {
    expect(mayDemonstrate({ ...ok, segmentType: 'order_steps', payload: { items: [{ id: 'a' }] } })).toBe(true);
    expect(mayDemonstrate({ ...ok, segmentType: 'order_steps', payload: {} })).toBe(false);
    expect(
      mayDemonstrate({
        ...ok,
        segmentType: 'match_pairs',
        payload: { left: [{ id: 'a' }], right: [{ id: 'b' }] },
      }),
    ).toBe(true);
    expect(mayDemonstrate({ ...ok, segmentType: 'match_pairs', payload: { left: [{ id: 'a' }], right: [] } })).toBe(
      false,
    );
    expect(mayDemonstrate({ ...ok, segmentType: 'number_line', payload: { min: 0, max: 10 } })).toBe(true);
    expect(mayDemonstrate({ ...ok, segmentType: 'number_line', payload: { min: 0 } })).toBe(false);
  });

  it('does nothing when there is no demonstration', () => {
    expect(mayDemonstrate({ ...ok, demoSeq: null })).toBe(false);
  });
});
