import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStageAnnouncement } from '../stage/useStageAnnouncement';

/*
 * THE SPEECH GATE, AND THE DEADLINE ON IT.
 *
 * `onReady` is what tells the conversation the tutor may be heard. It used to
 * wait on the 3D scene's first rendered frame and nothing else — correct until
 * the frame never comes, which is a reachable state on a device with no WebGL,
 * in a background tab, or behind an asset that fails to load.
 *
 * Reported from a real session on 2026-08-29: the tutor answered in text and
 * was never once heard, and a spoken "¿Qué es el interés compuesto?" came back
 * from the transcriber as "Ah." Both from this one gate: no audio meant
 * `speaking` was never true, and hands-free listening waits for the tutor to
 * STOP speaking, so the microphone opened while the learner was still reading.
 */

const TIMEOUT = 8_000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('when the scene renders', () => {
  it('opens the gate on the first frame', () => {
    const onReady = vi.fn();
    const { result } = renderHook(() => useStageAnnouncement(onReady, TIMEOUT));
    expect(onReady).not.toHaveBeenCalled();

    act(() => result.current.onFirstFrame());
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(true);
    expect(result.current.timedOut).toBe(false);
  });

  it('does not announce a second time when the deadline passes', () => {
    const onReady = vi.fn();
    const { result } = renderHook(() => useStageAnnouncement(onReady, TIMEOUT));
    act(() => result.current.onFirstFrame());
    act(() => void vi.advanceTimersByTime(TIMEOUT + 1_000));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.timedOut).toBe(false);
  });
});

describe('when the frame never comes', () => {
  it('opens the gate anyway, so the tutor is not mute for the whole session', () => {
    // THE REGRESSION. Before this, the gate stayed shut forever and every line
    // of the session was captioned and silent.
    const onReady = vi.fn();
    const { result } = renderHook(() => useStageAnnouncement(onReady, TIMEOUT));

    act(() => void vi.advanceTimersByTime(TIMEOUT + 1));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(true);
    expect(result.current.timedOut).toBe(true);
  });

  it('keeps the gate shut while the scene still has time to load', () => {
    // The original reasoning holds for the first eight seconds: announcing a
    // cast that is not on screen yet plays the tutor's first line at a blank
    // canvas. The deadline is what stops that from lasting forever.
    const onReady = vi.fn();
    const { result } = renderHook(() => useStageAnnouncement(onReady, TIMEOUT));

    act(() => void vi.advanceTimersByTime(TIMEOUT - 100));
    expect(onReady).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);
  });

  it('says so out loud, because a silent tutor looks like a working one', () => {
    // Every line is captioned either way, so nothing on screen distinguishes
    // this from a healthy session. The log is the only signal anyone gets.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(() => useStageAnnouncement(vi.fn(), TIMEOUT));
    act(() => void vi.advanceTimersByTime(TIMEOUT + 1));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('never reported a first frame'));
  });
});

describe('a fresh mount after an old one tears down', () => {
  // Investigating a live 2026-08-29 report: a session hung with nothing on
  // screen for 30+ seconds after a learner ended one session and immediately
  // started another. The suspects were (a) this deadline depending on
  // `requestAnimationFrame`/tab visibility the way the first-frame path does,
  // and (b) a stale timer or stale `announced` flag from the OLD instance
  // leaking into the NEW one across the remount. Neither holds: `StageShell`
  // is documented as "THE ONE MOUNT" that nothing above it may key or
  // conditionally render (stage/StageShell.tsx ~line 557), so in the real
  // control flow this hook is never actually remounted between sessions — but
  // this test proves the hook would still behave correctly even if it were.
  it('does not let the old instance announce into the new instance, and the new instance gets its own full deadline', () => {
    const onReadyOld = vi.fn();
    const { result: oldResult, unmount } = renderHook(() =>
      useStageAnnouncement(onReadyOld, TIMEOUT),
    );

    // The old canvas is torn down BEFORE its own frame or deadline ever
    // fired — e.g. the learner navigated away 3s into an 8s deadline.
    act(() => void vi.advanceTimersByTime(3_000));
    expect(onReadyOld).not.toHaveBeenCalled();
    unmount();

    // A new instance mounts (the new session's canvas). If the old timer
    // were not cleared on unmount, it would fire 5s from now into a
    // component that no longer exists.
    const onReadyNew = vi.fn();
    const { result: newResult } = renderHook(() => useStageAnnouncement(onReadyNew, TIMEOUT));

    // Advance past when the OLD timer would have fired (3s + 5s = 8s from
    // its own mount) but short of the NEW instance's own deadline.
    act(() => void vi.advanceTimersByTime(5_000));
    expect(onReadyOld).not.toHaveBeenCalled(); // old timer was cleared, not fired late
    expect(onReadyNew).not.toHaveBeenCalled(); // new instance has its own, fresh 8s budget
    expect(newResult.current.ready).toBe(false);

    // The new instance's own deadline, timed from ITS mount, still fires.
    act(() => void vi.advanceTimersByTime(3_001));
    expect(onReadyNew).toHaveBeenCalledTimes(1);
    expect(newResult.current.ready).toBe(true);
    expect(newResult.current.timedOut).toBe(true);

    // Sanity: the old, unmounted instance's own state never moved.
    expect(oldResult.current.ready).toBe(false);
  });
});

describe('under React.StrictMode (frontend/src/main.tsx wraps the whole app in it)', () => {
  // StrictMode double-invokes effects on the FIRST mount of a subtree in
  // development: render, run effects, immediately run their cleanup, then run
  // the effects again — synchronously, in one commit. `renderHook`'s default
  // wrapper does not add StrictMode, so the six tests above never exercised
  // this. Live evidence (2026-08-31) narrowed the hang to specifically a COLD
  // route mount (a fresh `navigate` to /tutor, which is exactly when
  // StrictMode's double-invoke runs) versus an in-place SPA transition
  // between sessions on an already-mounted route (which never re-triggers
  // it) — 3/3 cold mounts hung, 1/1 warm transition worked.
  it('arms exactly one live timer across the double-invoke and announces exactly once', () => {
    const onReady = vi.fn();
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    const { result } = renderHook(() => useStageAnnouncement(onReady, TIMEOUT), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    });

    // The discard-then-redo cycle already happened by the time renderHook
    // returns. Two timers were armed and exactly one was cleared — the
    // first-pass timer, torn down by its own cleanup — leaving exactly one
    // live.
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    act(() => void vi.advanceTimersByTime(TIMEOUT + 1));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(true);
    expect(result.current.timedOut).toBe(true);
  });

  it('a first frame delivered to the callback still opens the gate exactly once', () => {
    // Proves the callback identity itself survives the double-invoke intact:
    // `onFirstFrame` is a `useCallback` over `announce`, which is ALSO a
    // `useCallback` with an empty dependency array closing over a `useRef` —
    // hook state (refs/state) is not reset by StrictMode's replay, only
    // effects are re-run, so this is the same function and the same
    // `announced` ref throughout both passes, not two independent ones.
    const onReady = vi.fn();
    const { result } = renderHook(() => useStageAnnouncement(onReady, TIMEOUT), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    });

    act(() => result.current.onFirstFrame());
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(true);
    expect(result.current.timedOut).toBe(false);

    // The (already-cleared) first-pass timer reaching its original deadline
    // must not announce a second time.
    act(() => void vi.advanceTimersByTime(TIMEOUT + 1));
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe('a second first-frame signal into the SAME, still-mounted instance', () => {
  // RUNBOOK.md Round 111 left an open question rather than a reproduction: a
  // FUTURE mid-conversation stage remount (a character-cue change) "would
  // reopen [the veil] for as long as 8 seconds". Reading `TutorScene.tsx` end
  // to end finds no path that fires `onReady` a second time from a character
  // or companion swap — `PrincipalModels` stops rendering once `ready` is
  // true, and `Cast` gives every character its own Suspense boundary
  // (TUTOR_3D.md §5.2), so a swap can only ever suspend the ONE new
  // character's own boundary, never the shared one `Reveal` sits in. The one
  // REAL remount this codebase does have — `SceneCanvas`'s `<Canvas
  // key={contextEpoch}>`, recreated after a lost WebGL context — lives INSIDE
  // the canvas and would produce a brand-new `Reveal`, which would call this
  // SAME, never-remounted hook's `onFirstFrame` a second time. Either way, the
  // question that actually matters is answered here rather than assumed: does
  // a second call reopen anything.
  it('does not reopen the gate, re-announce, or touch timedOut', () => {
    const onReady = vi.fn();
    const { result } = renderHook(() => useStageAnnouncement(onReady, TIMEOUT));

    act(() => result.current.onFirstFrame());
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(true);
    expect(result.current.timedOut).toBe(false);

    // A second "first frame" — the shape a Canvas-context-loss remount's
    // fresh `Reveal` would produce into this same instance.
    act(() => result.current.onFirstFrame());
    expect(onReady).toHaveBeenCalledTimes(1); // not called again
    expect(result.current.ready).toBe(true); // never flickered back to false first
    expect(result.current.timedOut).toBe(false); // still opened by a frame, not the clock

    // And the still-pending deadline from the ORIGINAL mount, now moot,
    // must not retroactively relabel this as a timeout.
    act(() => void vi.advanceTimersByTime(TIMEOUT + 1));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.timedOut).toBe(false);
  });

  it('a late frame after the DEADLINE already opened the gate is equally inert', () => {
    // The mirror image: the timeout fires first (a slow load), and only
    // afterwards does the scene's own frame arrive. The learner must not see
    // the loading plate's `role="status"` line change, or the veil's opacity
    // transition replay, for a signal that is now irrelevant.
    const onReady = vi.fn();
    const { result } = renderHook(() => useStageAnnouncement(onReady, TIMEOUT));

    act(() => void vi.advanceTimersByTime(TIMEOUT + 1));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.timedOut).toBe(true);

    act(() => result.current.onFirstFrame());
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(result.current.ready).toBe(true);
    expect(result.current.timedOut).toBe(true); // stays attributed to the clock
  });
});

describe('the gate does not depend on who is listening', () => {
  it('survives the callback identity changing every render', () => {
    // `onReady` is an inline arrow in the shell's parent. Keying the timer on
    // its identity would restart the deadline on every render and it would
    // never fire — the same bug wearing a different hat.
    const calls: number[] = [];
    const { rerender } = renderHook(
      ({ n }: { n: number }) => useStageAnnouncement(() => calls.push(n), TIMEOUT),
      { initialProps: { n: 0 } },
    );
    for (let n = 1; n <= 5; n += 1) {
      act(() => void vi.advanceTimersByTime(1_000));
      rerender({ n });
    }
    act(() => void vi.advanceTimersByTime(TIMEOUT));
    expect(calls).toHaveLength(1);
  });
});
