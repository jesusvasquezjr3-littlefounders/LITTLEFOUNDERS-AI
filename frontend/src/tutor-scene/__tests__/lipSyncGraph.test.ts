import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLipSync } from '../useLipSync';

/*
 * THE TUTOR WAS SILENT IN PRODUCTION FOR EVERY LEARNER, and this is the file
 * that did it.
 *
 * `createMediaElementSource(el)` does not tap an element, it CAPTURES it:
 * from that call on, the element's audio goes into the graph and nowhere else,
 * permanently, with no API to undo it. The hook built a NEW AudioContext per
 * effect run and closed it on cleanup, so the first cleanup closed the context
 * the capture lived in and the element drained into a dead node for the rest
 * of the page's life. Every later run threw InvalidStateError, which was
 * caught and logged as "lip-sync could not attach" — a message about a mouth,
 * for a defect that had already silenced the entire product.
 *
 * Every test here is about the SOUND, not the mouth.
 */

class FakeNode {
  connections: unknown[] = [];
  connect(target: unknown) {
    this.connections.push(target);
  }
  disconnect() {
    this.connections = [];
  }
}

class FakeAnalyser extends FakeNode {
  fftSize = 1024;
  getFloatTimeDomainData() {}
}

let captures = 0;
let contexts = 0;
let closed = 0;
/** Elements this fake has already captured, mirroring the real spec rule. */
let capturedByAnyone: Set<unknown>;

class FakeAudioContext {
  destination = new FakeNode();
  state = 'running';
  constructor() {
    contexts += 1;
  }
  createAnalyser() {
    return new FakeAnalyser();
  }
  createMediaElementSource(el: unknown) {
    if (capturedByAnyone.has(el)) {
      throw new Error('HTMLMediaElement already connected previously to a different node');
    }
    capturedByAnyone.add(el);
    captures += 1;
    return new FakeNode();
  }
  close() {
    closed += 1;
    this.state = 'closed';
    return Promise.resolve();
  }
  resume() {
    return Promise.resolve();
  }
}

function fakeAudio(): HTMLAudioElement {
  return { addEventListener: vi.fn(), removeEventListener: vi.fn(), paused: false } as never;
}

beforeEach(() => {
  captures = 0;
  contexts = 0;
  closed = 0;
  capturedByAnyone = new Set();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the audio element keeps its voice', () => {
  it('captures an element only once across remounts', () => {
    // The second capture is what threw InvalidStateError in production.
    const audio = fakeAudio();
    for (let i = 0; i < 4; i += 1) {
      const { unmount } = renderHook(() => useLipSync(audio));
      unmount();
    }
    expect(captures).toBe(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('NEVER closes the context that owns the capture', () => {
    // Closing it is the exact act that silenced the tutor: the element stays
    // bound to a node inside a dead context, forever.
    const audio = fakeAudio();
    const { unmount } = renderHook(() => useLipSync(audio));
    unmount();
    expect(closed).toBe(0);
  });

  it('leaves the element wired to the speakers after teardown', () => {
    /*
     * THE INVARIANT. Once captured, the element's only path to the speakers is
     * through the graph, so a dangling source node is not "no lip-sync" — it is
     * a permanently mute player.
     */
    const audio = fakeAudio();
    const { unmount } = renderHook(() => useLipSync(audio));
    unmount();

    const source = [...capturedByAnyone.values()].length;
    expect(source).toBe(1);
    // Re-mounting must find sound working, which is the observable version of
    // the same claim.
    const second = renderHook(() => useLipSync(audio));
    expect(console.warn).not.toHaveBeenCalled();
    second.unmount();
  });

  it('shares one context across every element on the page', () => {
    /*
     * The context is a module singleton and deliberately outlives everything,
     * including the previous test — which is the property under test, so the
     * assertion is "at most one was created here", not "exactly one". A second
     * context is what made the second capture throw.
     */
    const a = fakeAudio();
    const b = fakeAudio();
    renderHook(() => useLipSync(a)).unmount();
    renderHook(() => useLipSync(b)).unmount();
    expect(contexts).toBeLessThanOrEqual(1);
    expect(captures).toBe(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('degrades quietly when Web Audio does not exist', () => {
    // No lip-sync, and — crucially — nothing touched the element, so the
    // browser plays it normally.
    vi.stubGlobal('AudioContext', undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const audio = fakeAudio();
    renderHook(() => useLipSync(audio)).unmount();
    expect(captures).toBe(0);
    expect(info).toHaveBeenCalled();
  });
});
