import { Profiler } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOLD_MAX_BYTES,
  HOLD_MAX_MS,
  MAX_AUDIO_B64_CHARS,
  useMicrophone,
} from '../useMicrophone';

/*
 * The two things that were actually wrong with the microphone, tested at the
 * level where they were wrong.
 *
 * (1) The level meter used to be React state written from a requestAnimationFrame
 *     loop, so consuming it would have re-rendered the whole tutor route sixty
 *     times a second while a 3D scene was already competing for the frame.
 * (2) The hold had no cap at all, and any cap expressed in SECONDS is a guess:
 *     `new MediaRecorder(stream)` takes no options, so the codec is the
 *     browser's choice and 1.5M base64 characters is thirty-five seconds of one
 *     and several minutes of another.
 */

// ── Controllable browser audio ──────────────────────────────────────────────

class FakeRecorder {
  static last: FakeRecorder | null = null;

  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  timeslice: number | undefined;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(public stream: MediaStream) {
    FakeRecorder.last = this;
  }

  start(timeslice?: number) {
    this.state = 'recording';
    this.timeslice = timeslice;
  }

  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }

  /** Hand over one chunk, the way a real recorder does on its timeslice. */
  emit(bytes: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) });
  }
}

/** A stand-in analyser whose samples are whatever the test wants them to be. */
let analyserSample = 128;

class FakeAudioContext {
  createAnalyser() {
    return {
      fftSize: 0,
      frequencyBinCount: 8,
      getByteTimeDomainData: (data: Uint8Array) => data.fill(analyserSample),
      connect: () => {},
    };
  }
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  close() {
    return Promise.resolve();
  }
}

let frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
const stoppedTracks: string[] = [];

/** Run every frame callback currently queued, exactly once. */
function flushFrame() {
  const queued = [...frames.entries()];
  frames = new Map();
  for (const [, cb] of queued) cb(0);
}

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  analyserSample = 128;
  stoppedTracks.length = 0;
  FakeRecorder.last = null;

  // Only Date is faked: the frame loop is driven by hand above, and faking
  // requestAnimationFrame as well would take that control away.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-21T10:00:00Z'));

  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: () => stoppedTracks.push('audio') }],
      }),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── The hold cap ────────────────────────────────────────────────────────────

describe('useMicrophone hold cap', () => {
  it('runs the recorder with a timeslice, because a running byte total needs one', async () => {
    const { result } = renderHook(() => useMicrophone(true));
    await act(async () => {
      await result.current.start();
    });

    // Without a timeslice `ondataavailable` fires exactly once, at stop, and
    // the total this cap is derived from would not exist until it was too late.
    expect(FakeRecorder.last?.timeslice).toBeGreaterThan(0);
  });

  it('releases the hold before the wire cap, measured in bytes rather than seconds', async () => {
    const onAutoRelease = vi.fn();
    const { result } = renderHook(() => useMicrophone(true, { onAutoRelease }));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.recording).toBe(true);

    // One fat chunk: a high-bitrate codec reaching the ceiling in a few seconds.
    await act(async () => {
      FakeRecorder.last?.emit(HOLD_MAX_BYTES);
      flushFrame();
    });
    await act(async () => {});

    expect(onAutoRelease).toHaveBeenCalledTimes(1);
    expect(result.current.recording).toBe(false);
  });

  it('leaves headroom under the wire cap for the chunk that arrives after stop', () => {
    // MediaRecorder flushes whatever it buffered when stop() is called, so the
    // final chunk lands AFTER the decision to stop. Encoding the cap exactly
    // would therefore still produce a frame Oracle's schema rejects.
    const worstCaseB64 = Math.ceil((HOLD_MAX_BYTES * 4) / 3);
    expect(worstCaseB64).toBeLessThan(MAX_AUDIO_B64_CHARS);
  });

  it('still releases on the wall clock when the codec is too small to reach the byte cap', async () => {
    const onAutoRelease = vi.fn();
    const { result } = renderHook(() => useMicrophone(true, { onAutoRelease }));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      FakeRecorder.last?.emit(4_096);
      vi.setSystemTime(new Date(Date.now() + HOLD_MAX_MS + 1));
      flushFrame();
    });
    await act(async () => {});

    expect(onAutoRelease).toHaveBeenCalledTimes(1);
    expect(result.current.recording).toBe(false);
  });

  it('enforces the cap even when the browser refuses an AudioContext', async () => {
    // The auto-release lives in the same loop as the meter but must not depend
    // on it: a browser with no AudioContext would otherwise lose the only thing
    // holding the wire cap, and fail as a rejected frame rather than a missing
    // meter.
    vi.stubGlobal('AudioContext', function BrokenAudioContext() {
      throw new Error('no audio context here');
    });

    const onAutoRelease = vi.fn();
    const { result } = renderHook(() => useMicrophone(true, { onAutoRelease }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      FakeRecorder.last?.emit(HOLD_MAX_BYTES);
      flushFrame();
    });
    await act(async () => {});

    expect(onAutoRelease).toHaveBeenCalledTimes(1);
  });
});

// ── The level channel ───────────────────────────────────────────────────────

describe('useMicrophone level channel', () => {
  it('publishes sixty level updates without a single re-render', async () => {
    let commits = 0;
    let hook: ReturnType<typeof useMicrophone> | null = null;

    function Probe() {
      hook = useMicrophone(true);
      return null;
    }

    render(
      <Profiler id="mic" onRender={() => (commits += 1)}>
        <Probe />
      </Profiler>,
    );

    await act(async () => {
      await hook?.start();
    });

    const seen: number[] = [];
    const unsubscribe = hook!.subscribe((level) => seen.push(level));
    const commitsBeforeUpdates = commits;

    await act(async () => {
      for (let i = 0; i < 60; i += 1) {
        // A different sample each frame, so a channel that silently stopped
        // delivering could not pass this test by publishing one constant value.
        analyserSample = 128 + (i % 100);
        flushFrame();
      }
    });

    expect(seen).toHaveLength(60);
    expect(new Set(seen).size).toBeGreaterThan(1);
    expect(commits).toBe(commitsBeforeUpdates);
    unsubscribe();
  });

  it('zeroes the meters when the hold ends, so a ring never freezes mid-fill', async () => {
    const { result } = renderHook(() => useMicrophone(true));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      FakeRecorder.last?.emit(2_000);
      flushFrame();
    });
    expect(result.current.holdBytesRef.current).toBeGreaterThan(0);

    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.holdBytesRef.current).toBe(0);
    expect(result.current.holdFractionRef.current).toBe(0);
    expect(result.current.levelRef.current).toBe(0);
  });
});

// ── What must not change ────────────────────────────────────────────────────

describe('useMicrophone push-to-talk guarantees', () => {
  it('records nothing until start is called: there is no open-mic path', () => {
    renderHook(() => useMicrophone(true));
    // §1.9: an always-listening microphone in a child's room captures people
    // who never agreed to anything. Mounting the hook must acquire nothing.
    expect(FakeRecorder.last).toBeNull();
  });

  it('refuses to start when the server has not enabled the microphone', async () => {
    const { result } = renderHook(() => useMicrophone(false));
    await act(async () => {
      await result.current.start();
    });
    expect(FakeRecorder.last).toBeNull();
    expect(result.current.recording).toBe(false);
  });

  it('stops the stream on unmount so the browser indicator goes dark', async () => {
    const { result, unmount } = renderHook(() => useMicrophone(true));
    await act(async () => {
      await result.current.start();
    });
    unmount();
    expect(stoppedTracks).toContain('audio');
  });

  it('drops a mis-tap rather than sending a fragment of a word', async () => {
    const { result } = renderHook(() => useMicrophone(true));
    await act(async () => {
      await result.current.start();
    });

    let clip: Blob | null = null;
    await act(async () => {
      FakeRecorder.last?.emit(40);
      clip = await result.current.stop();
    });

    expect(clip).toBeNull();
  });
});
