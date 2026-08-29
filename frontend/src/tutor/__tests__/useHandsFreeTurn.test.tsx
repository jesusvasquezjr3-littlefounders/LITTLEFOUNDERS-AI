import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutableRefObject } from 'react';
import { useHandsFreeTurn } from '../useHandsFreeTurn';
import type { Microphone } from '../useMicrophone';

/*
 * WHEN A CHILD'S MICROPHONE OPENS.
 *
 * This hook shipped with no test at all, and it is the code that decides when
 * a minor's microphone starts recording. The pure detector underneath it is
 * covered and the recorder is covered; the thing that WIRES them — the one
 * that can open a stream at the wrong moment — was not.
 *
 * Every case here is a rule stated in the hook's own header, which is the only
 * honest place to take them from: it opens only in the gap after a tutor turn,
 * never over the tutor's own voice, never while a turn is in flight, and never
 * when the gate says no.
 */

function fakeMic(overrides: Partial<Microphone> = {}): Microphone & {
  emit: (level: number) => void;
  starts: number;
  stops: number;
} {
  const listeners = new Set<(level: number) => void>();
  const ref = { current: 0 } as MutableRefObject<number>;
  const mic = {
    permission: 'granted' as const,
    recording: true,
    levelRef: ref,
    holdBytesRef: { current: 0 } as MutableRefObject<number>,
    holdMsRef: { current: 0 } as MutableRefObject<number>,
    holdFractionRef: { current: 0 } as MutableRefObject<number>,
    subscribe: (listener: (level: number) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: vi.fn(async () => {
      mic.starts += 1;
    }),
    stop: vi.fn(async () => {
      mic.stops += 1;
      return new Blob(['audio']);
    }),
    release: () => {},
    emit: (level: number) => listeners.forEach((l) => l(level)),
    starts: 0,
    stops: 0,
    ...overrides,
  };
  return mic as never;
}

const BASE = {
  enabled: true,
  speaking: false,
  awaitingReply: false,
  policy: null,
  turnSeq: 1,
};

beforeEach(() => {
  // The detector reads `performance.now()`; a controllable clock is what lets
  // "four seconds of silence" be tested in microseconds.
  let now = 0;
  vi.stubGlobal('performance', { now: () => (now += 20) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the microphone opens only when it should', () => {
  it('opens in the gap after a tutor turn', async () => {
    const mic = fakeMic();
    await act(async () => {
      renderHook(() => useHandsFreeTurn({ ...BASE, microphone: mic, onTurn: vi.fn() }));
    });
    expect(mic.starts).toBe(1);
  });

  it('never opens over the tutor’s own voice', async () => {
    const mic = fakeMic();
    await act(async () => {
      renderHook(() => useHandsFreeTurn({ ...BASE, speaking: true, microphone: mic, onTurn: vi.fn() }));
    });
    expect(mic.starts).toBe(0);
  });

  it('never opens while a turn is already in flight', async () => {
    const mic = fakeMic();
    await act(async () => {
      renderHook(() => useHandsFreeTurn({ ...BASE, awaitingReply: true, microphone: mic, onTurn: vi.fn() }));
    });
    expect(mic.starts).toBe(0);
  });

  it('never opens when the gate says no', async () => {
    // `enabled` is downstream of consent and of Core's answer. A minor with no
    // verified guardian consent must get no microphone at all, held or
    // hands-free, and this is the last line where that is enforced.
    const mic = fakeMic();
    await act(async () => {
      renderHook(() => useHandsFreeTurn({ ...BASE, enabled: false, microphone: mic, onTurn: vi.fn() }));
    });
    expect(mic.starts).toBe(0);
  });

  it('closes the microphone when the gate closes mid-listen', async () => {
    const mic = fakeMic();
    const { rerender } = renderHook((props: Parameters<typeof useHandsFreeTurn>[0]) => useHandsFreeTurn(props), {
      initialProps: { ...BASE, microphone: mic, onTurn: vi.fn() },
    });
    await act(async () => {});
    expect(mic.starts).toBe(1);

    // Consent revoked, the session ended, the tutor started speaking — any of
    // them, and the stream must not outlive the reason it was opened.
    await act(async () => {
      rerender({ ...BASE, enabled: false, microphone: mic, onTurn: vi.fn() });
    });
    expect(mic.stops).toBeGreaterThan(0);
  });
});

describe('what it does with what it hears', () => {
  it('sends the clip once the learner stops talking', async () => {
    const onTurn = vi.fn();
    const mic = fakeMic();
    await act(async () => {
      renderHook(() => useHandsFreeTurn({ ...BASE, microphone: mic, onTurn }));
    });

    await act(async () => {
      // Speech, then silence past the default budget. The fake clock advances
      // 20ms per read, so this is well over two seconds of quiet.
      for (let i = 0; i < 40; i += 1) mic.emit(0.5);
      for (let i = 0; i < 200; i += 1) mic.emit(0);
    });

    expect(onTurn).toHaveBeenCalledTimes(1);
    expect(onTurn.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
  });

  it('sends NOTHING when nobody spoke', async () => {
    // A silent room must not ship room tone to a paid transcriber, and the
    // caller needs to know the difference — null, not an empty clip.
    const onTurn = vi.fn();
    const mic = fakeMic();
    await act(async () => {
      renderHook(() => useHandsFreeTurn({ ...BASE, microphone: mic, onTurn }));
    });

    await act(async () => {
      for (let i = 0; i < 600; i += 1) mic.emit(0);
    });

    expect(onTurn).toHaveBeenCalledWith(null);
  });

  it('defers to the orb when the learner ended their own turn', async () => {
    // Pressing the orb stops the recorder and sends the clip through the same
    // handler. The detector reaching its verdict a frame later must stay
    // silent, or the socket gets a null clip and abandons a committed upload.
    const onTurn = vi.fn();
    const mic = fakeMic({ recording: false });
    await act(async () => {
      renderHook(() => useHandsFreeTurn({ ...BASE, microphone: mic, onTurn }));
    });

    await act(async () => {
      for (let i = 0; i < 40; i += 1) mic.emit(0.5);
      for (let i = 0; i < 200; i += 1) mic.emit(0);
    });

    expect(onTurn).not.toHaveBeenCalled();
  });
});

describe('the silence budget comes from the strategy', () => {
  it('uses the server’s budget when one arrived', async () => {
    // A fluency drill closes at 900ms; the default is 2000. With the short
    // budget the turn ends on silence the default would still be waiting out.
    const onTurn = vi.fn();
    const mic = fakeMic();
    await act(async () => {
      renderHook(() =>
        useHandsFreeTurn({
          ...BASE,
          policy: { listenSilenceMs: 900 },
          microphone: mic,
          onTurn,
        }),
      );
    });

    await act(async () => {
      for (let i = 0; i < 40; i += 1) mic.emit(0.5);
      // ~1.2s of silence: past 900ms, short of the 2000ms default.
      for (let i = 0; i < 60; i += 1) mic.emit(0);
    });

    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it('is patient when the v3 brain sent no policy at all', async () => {
    const onTurn = vi.fn();
    const mic = fakeMic();
    await act(async () => {
      renderHook(() => useHandsFreeTurn({ ...BASE, policy: null, microphone: mic, onTurn }));
    });

    await act(async () => {
      for (let i = 0; i < 40; i += 1) mic.emit(0.5);
      for (let i = 0; i < 60; i += 1) mic.emit(0);
    });

    // The same silence that closed a fluency turn leaves this one open. A
    // dormant brain must not collapse to a voice-assistant timeout.
    expect(onTurn).not.toHaveBeenCalled();
  });
});
