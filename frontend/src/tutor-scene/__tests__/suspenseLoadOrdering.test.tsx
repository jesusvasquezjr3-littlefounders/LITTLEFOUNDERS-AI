import { Suspense } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * RUNBOOK.md Round 111 capped the Tutor's first-frame veil at an 8-second
 * timeout but left its root cause open. The leading hypothesis investigated
 * here: `TutorScene.tsx` renders its diorama and its two principals as three
 * UNWRAPPED `useLoader` calls — `Diorama` in the outer Suspense boundary,
 * `PrincipalModels`' two `PrincipalModel`s as siblings of `Cast`/`Reveal` in a
 * NESTED inner one — deliberately, so `onReady` can wait for the island and
 * the cast at once (see `PrincipalModels`'s own comment). If React abandoned
 * a boundary's not-yet-reached siblings the instant an earlier one threw, as
 * a plain reading of "Suspense shows a fallback and stops" suggests, three
 * assets that could load concurrently would load end to end instead — a
 * three-way serial chain that would make an 8-second fallback feel necessary
 * even on an ordinary connection.
 *
 * THE HYPOTHESIS DOES NOT HOLD. A faithful reproduction of the exact nested
 * shape below shows React 18 discovering every pending suspend across BOTH
 * boundaries in the SAME synchronous render pass: all three loader calls
 * fire immediately, each settles independently, and the total wait is
 * whichever ONE is slowest — never their sum. Staggering the delays (a
 * second test) additionally confirms no asset is fetched twice and nothing
 * re-triggers once the boundaries above it resolve. `TutorScene.tsx` was
 * therefore not changed: there is no confirmed defect for a preload
 * mechanism to fix, and shipping one anyway — which an earlier pass of this
 * investigation did before writing this test — would have been exactly the
 * "wrong diagnosis costs more than no diagnosis" mistake AGENTS.md §1.0
 * warns about, dressed up as a performance fix.
 *
 * This does not import `suspend-react` (a transitive dependency of
 * `@react-three/fiber` that this package.json does not declare) or mount a
 * `<Canvas>` (unreliable in this sandbox's headless WebGL — RUNBOOK.md round
 * 100). What is under test is a fact about REACT's own Suspense scheduling —
 * `suspend-react` and `useLoader` key off exactly the same mechanic this
 * reproduces: check a cache, else call the loader function and throw its
 * pending promise. That mechanic lives in `react-reconciler`, which both
 * `react-dom` (used here) and `@react-three/fiber`'s custom renderer are
 * built on — the fiber work loop that decides whether a throw aborts
 * not-yet-rendered siblings is shared code, not a per-renderer host config.
 *
 * Kept as a REGRESSION GUARD, not a fix's test: if a future refactor ever
 * changes this nesting in a way that reintroduces the serial chain, this is
 * what would catch it.
 */

interface Entry {
  promise: Promise<void>;
  done: boolean;
}

let cache: Map<string, Entry>;
let events: string[];

/** The one place a "fetch" actually starts — mirrors `loader.load(url, ...)`. */
function startLoad(key: string, delayMs: number): Promise<void> {
  events.push(`start:${key}`);
  return new Promise((resolve) => {
    setTimeout(() => {
      events.push(`end:${key}`);
      resolve();
    }, delayMs);
  });
}

/** Mirrors `suspend-react`'s `query()`: cache hit, else start and record the entry. */
function getOrStart(key: string, delayMs: number): Entry {
  let entry = cache.get(key);
  if (!entry) {
    const created: Entry = { done: false, promise: undefined as unknown as Promise<void> };
    created.promise = startLoad(key, delayMs).then(() => {
      created.done = true;
    });
    cache.set(key, created);
    entry = created;
  }
  return entry;
}

/** The shape `Diorama` / `PrincipalModel` use: throw until the cache says done. */
function Consume({ id, delayMs }: { id: string; delayMs: number }) {
  const entry = getOrStart(id, delayMs);
  if (!entry.done) throw entry.promise;
  return null;
}

beforeEach(() => {
  cache = new Map();
  events = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TutorScene’s actual boundary shape: an outer Diorama-like sibling around a nested inner boundary holding both principals', () => {
  it('starts all three loads in the same synchronous pass, and finishes in max(), not sum()', async () => {
    render(
      <Suspense fallback={null}>
        {/* Stands in for `<group visible={ready}><Diorama/><Suspense>…</Suspense></group>` */}
        <div>
          <Consume id="diorama" delayMs={100} />
          <Suspense fallback={null}>
            <Consume id="tutor" delayMs={100} />
            <Consume id="companion" delayMs={100} />
          </Suspense>
        </div>
      </Suspense>,
    );

    // All three `loader.load()`-equivalent calls already fired — nothing was
    // ever "not yet reached" here, contrary to the refuted hypothesis.
    expect(events).toEqual(['start:diorama', 'start:tutor', 'start:companion']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    // ONE 100ms delay later, all three are done — not three delays back to
    // back, which is what would make an 8-second fallback feel necessary.
    expect(events).toEqual([
      'start:diorama',
      'start:tutor',
      'start:companion',
      'end:diorama',
      'end:tutor',
      'end:companion',
    ]);
  });

  it('settles each asset on its own schedule, with no duplicate fetch when an earlier one resolves first', async () => {
    render(
      <Suspense fallback={null}>
        <div>
          <Consume id="diorama2" delayMs={50} />
          <Suspense fallback={null}>
            <Consume id="tutor2" delayMs={200} />
            <Consume id="companion2" delayMs={300} />
          </Suspense>
        </div>
      </Suspense>,
    );
    expect(events).toEqual(['start:diorama2', 'start:tutor2', 'start:companion2']);

    // The diorama (OUTER boundary) resolves first. If the outer boundary's
    // own retry re-rendered the inner one from scratch, `tutor2`/`companion2`
    // would fetch a SECOND time here.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(events.filter((line) => line === 'start:diorama2')).toHaveLength(1);
    expect(events.filter((line) => line === 'start:tutor2')).toHaveLength(1);
    expect(events.filter((line) => line === 'start:companion2')).toHaveLength(1);
    expect(events).toContain('end:diorama2');
    expect(events).not.toContain('end:tutor2');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(events).toContain('end:tutor2');
    expect(events).not.toContain('end:companion2');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(events).toContain('end:companion2');
    // Total wall clock: 300ms, the slowest asset — never 50+200+300=550.
    expect(events.filter((line) => line.startsWith('start:'))).toHaveLength(3);
  });
});
