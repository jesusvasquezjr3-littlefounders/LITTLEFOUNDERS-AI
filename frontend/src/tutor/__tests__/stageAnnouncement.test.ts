import { act, renderHook } from '@testing-library/react';
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
