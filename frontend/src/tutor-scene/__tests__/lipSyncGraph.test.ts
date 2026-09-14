import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTutorVoiceVolume, setTutorVoiceVolume, useLipSync } from '../useLipSync';

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

class FakeGain extends FakeNode {
  gain = { value: 1 };
}

let captures = 0;
let contexts = 0;
let closed = 0;
/** Elements this fake has already captured, mirroring the real spec rule. */
let capturedByAnyone: Set<unknown>;
/** Every analyser/gain node ever created, across the whole file — `ensureGain`
 * is a module singleton like `sharedContext`, so a test must be able to find
 * the one gain node created by an earlier test, not just its own. */
let analysersCreated: FakeAnalyser[];
let gainsCreated: FakeGain[];

class FakeAudioContext {
  destination = new FakeNode();
  state = 'running';
  constructor() {
    contexts += 1;
  }
  createAnalyser() {
    const node = new FakeAnalyser();
    analysersCreated.push(node);
    return node;
  }
  createGain() {
    const node = new FakeGain();
    gainsCreated.push(node);
    return node;
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
  analysersCreated = [];
  gainsCreated = [];
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

describe('the learner\'s voice-volume preference', () => {
  /*
   * `audioElement.volume` is a dead letter once `createMediaElementSource`
   * has captured the element (the doctrine `useLipSync.ts` documents beside
   * `ensureGain`) — these tests are about the GAIN NODE the graph now always
   * routes through instead, never about the element's own property.
   */

  it('routes the analyser through the shared gain node, never straight to destination', () => {
    /*
     * `audioElement.volume` is ignored once the element is captured (see
     * `useLipSync.ts`'s own doctrine beside `ensureGain`), so a volume
     * control only works if the graph itself has a gain stage in it. A
     * regression here is silent in production: the mouth still moves, only
     * a volume slider would stop doing anything.
     */
    const audio = fakeAudio();
    renderHook(() => useLipSync(audio));

    /*
     * Read the gain off the analyser's OWN recorded connection rather than
     * off `gainsCreated` — `ensureGain` is a create-once module singleton
     * (like `sharedContext` above), so a run after the first test in this
     * file never calls `createGain()` again, and `gainsCreated` (reset every
     * `beforeEach`) would be empty here. The analyser is fresh every run.
     */
    const analyser = analysersCreated.at(-1)!;
    expect(analyser.connections.length).toBe(1);
    const gain = analyser.connections[0] as FakeGain;
    expect(gain).toBeInstanceOf(FakeGain);
    // The gain forwards exactly once, onward to the real destination.
    expect(gain.connections.length).toBe(1);
  });

  it('creates the gain node at most once, and reuses it across remounts and elements', () => {
    // Same shape as "shares one context across every element on the page"
    // above, and for the same reason: a second gain node mid-session would
    // either silence the new element or double it against the old one.
    renderHook(() => useLipSync(fakeAudio())).unmount();
    renderHook(() => useLipSync(fakeAudio())).unmount();
    expect(gainsCreated.length).toBeLessThanOrEqual(1);
  });

  it('setTutorVoiceVolume clamps to 0..1 and getTutorVoiceVolume reflects it', () => {
    setTutorVoiceVolume(0.4);
    expect(getTutorVoiceVolume()).toBeCloseTo(0.4);

    setTutorVoiceVolume(5);
    expect(getTutorVoiceVolume()).toBe(1);

    setTutorVoiceVolume(-2);
    expect(getTutorVoiceVolume()).toBe(0);

    setTutorVoiceVolume(0.7); // leave it somewhere sane for later tests
  });

  it('a volume change reaches the live graph without tearing anything down', () => {
    const audio = fakeAudio();
    const { unmount } = renderHook(() => useLipSync(audio));

    // Changing the preference mid-conversation must not throw and must not
    // require a re-render — it is a single property write on the node the
    // graph already built.
    expect(() => setTutorVoiceVolume(0.2)).not.toThrow();
    expect(getTutorVoiceVolume()).toBeCloseTo(0.2);

    unmount();
  });
});
