import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReplayScript } from '../replayScript';
import { useReplayDirector } from '../useReplayDirector';
import type { SessionSummary, SessionTranscript, TranscriptTurn } from '../../types';

/*
 * The clock of a replay, tested with a clock we control.
 *
 * WHY THIS IS WORTH A TEST AT ALL, given the standing instruction on this
 * project that the Tutor is verified by LOOKING at it: everything here happens
 * over minutes and the failures are all of the form "it stopped". A beat that
 * never advances, a pause that stops the sound but not the clock, an audio
 * `ended` arriving after the learner paused and stepping the performance
 * forward underneath them — none of those are visible in a screenshot, and
 * catching them by watching means watching a whole conversation, twice, in two
 * themes. The composition is looked at; the timing is asserted.
 */

const SESSION: SessionSummary = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  locale: 'en-US',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'weak_skill',
  startedAt: '2026-08-14T16:20:00.000Z',
  endedAt: null,
  closeReason: null,
  turnCount: 3,
  segmentCount: 0,
  xpAwarded: 0,
};

function turn(over: Pick<TranscriptTurn, 'id' | 'seq' | 'speaker' | 'text'> & Partial<TranscriptTurn>): TranscriptTurn {
  return {
    emotion: null,
    action: null,
    audio_path: null,
    source: 'model',
    created_at: `2026-08-14T16:2${over.seq}:00.000Z`,
    whiteboard: null,
    ...over,
  };
}

const SILENT: SessionTranscript = {
  session: SESSION,
  turns: [
    turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'one' }),
    turn({ id: 't2', seq: 2, speaker: 'learner', text: 'two' }),
    turn({ id: 't3', seq: 3, speaker: 'tutor', text: 'three' }),
  ],
  segments: [],
};

/** A DIFFERENT conversation: the hook's identity is the session, not the object. */
const OTHER_SESSION: SessionSummary = { ...SESSION, id: '11111111-2222-4333-8444-555555555555' };

const WITH_AUDIO: SessionTranscript = {
  session: OTHER_SESSION,
  turns: [
    turn({ id: 't1', seq: 1, speaker: 'tutor', text: 'one', audio_path: 'https://depot.invalid/one.mp3' }),
    turn({ id: 't2', seq: 2, speaker: 'tutor', text: 'two', audio_path: 'https://depot.invalid/two.mp3' }),
  ],
  segments: [],
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Run the director's clock forward far enough to end whatever beat is on. */
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useReplayDirector', () => {
  it('plays a silent conversation through, on the timer, one beat at a time', () => {
    // SILENCE IS A STATE, NOT A FAILURE. Every line here lost its audio — which
    // is what every conversation looks like after the 90-day sweep — and the
    // performance still runs at a human pace.
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(SILENT)));

    expect(result.current?.playing).toBe(true);
    expect(result.current?.beat?.text).toBe('one');
    // No clip, so nothing has been handed to the stage's audio element.
    expect(result.current?.speechUrl).toBeNull();

    tick(result.current?.beat?.durationMs ?? 0);
    expect(result.current?.beat?.text).toBe('two');

    tick(result.current?.beat?.durationMs ?? 0);
    expect(result.current?.beat?.text).toBe('three');

    tick(result.current?.beat?.durationMs ?? 0);
    // The END holds the last line rather than snapping back to the first: the
    // caption stays up while the camera pulls back, which is what the live
    // goodbye does (/ORACLE.md §9.5).
    expect(result.current?.finished).toBe(true);
    expect(result.current?.playing).toBe(false);
    expect(result.current?.beat?.text).toBe('three');
  });

  it('hands the stage a clip only while a tutor beat is actually running', () => {
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(WITH_AUDIO)));
    expect(result.current?.speechUrl).toBe('https://depot.invalid/one.mp3');

    act(() => result.current?.pause());
    // Pausing nulls the URL, which is how the ONE audio element on the stage
    // is stopped. Nothing else drives it, so it keeps its single owner.
    expect(result.current?.speechUrl).toBeNull();

    act(() => result.current?.play());
    expect(result.current?.speechUrl).toBe('https://depot.invalid/one.mp3');
  });

  it('stops the clock as well as the sound when the learner pauses', () => {
    // The bug this forbids: pausing that nulls the URL but leaves the timer
    // armed, so a paused replay silently walks forward on its own.
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(SILENT)));
    act(() => result.current?.pause());

    tick(60_000);
    expect(result.current?.index).toBe(0);
    expect(result.current?.beat?.text).toBe('one');
  });

  it('ignores a clip that ends after the learner paused', () => {
    /*
     * A real ordering, not a hypothetical: the learner presses pause, the URL
     * goes null, and the element fires `ended` for the clip it was already
     * finishing. Advancing on that steps the performance forward underneath a
     * learner who just asked it to stop.
     */
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(WITH_AUDIO)));
    act(() => result.current?.pause());
    act(() => result.current?.handleSpeechEnd());
    expect(result.current?.index).toBe(0);
  });

  it('gives up on a clip that never reports anything, and keeps going', () => {
    /*
     * `play()` refused by the autoplay policy fires NO media event at all —
     * neither `ended` nor `error` — so without the backstop the performance
     * would sit on one line for ever. The backstop is deliberately longer than
     * any real clip of a line this length, so it can only fire when the audio
     * genuinely never spoke.
     */
    const script = buildReplayScript(WITH_AUDIO);
    const { result } = renderHook(() => useReplayDirector(script));

    const beat = script.beats[0];
    tick((beat?.durationMs ?? 0) + 1);
    expect(result.current?.index, 'a real clip is still playing at this point').toBe(0);

    tick((beat?.durationMs ?? 0) + 6001);
    expect(result.current?.index).toBe(1);
  });

  it('advances the moment the clip says it is done', () => {
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(WITH_AUDIO)));
    act(() => result.current?.handleSpeechEnd());
    expect(result.current?.beat?.text).toBe('two');
  });

  it('steps by line without changing whether it is playing', () => {
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(SILENT)));
    act(() => result.current?.pause());

    act(() => result.current?.next());
    expect(result.current?.index).toBe(1);
    // Stepping through the captions with the sound off is a reading mode, and
    // it is the primary one for a learner who cannot hear the clip.
    expect(result.current?.playing).toBe(false);

    act(() => result.current?.previous());
    expect(result.current?.index).toBe(0);
    // Never off the front, however many times a child presses it.
    act(() => result.current?.previous());
    expect(result.current?.index).toBe(0);
  });

  it('ends the performance when forward is pressed on the last line', () => {
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(SILENT)));
    act(() => result.current?.jumpTo(99));
    expect(result.current?.index).toBe(2);

    act(() => result.current?.next());
    expect(result.current?.finished).toBe(true);
  });

  it('plays a finished performance again rather than doing nothing', () => {
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(SILENT)));
    act(() => result.current?.jumpTo(2));
    act(() => result.current?.next());
    expect(result.current?.finished).toBe(true);

    act(() => result.current?.play());
    expect(result.current?.index).toBe(0);
    expect(result.current?.playing).toBe(true);
  });

  it('replays the same line when asked, which an index alone cannot express', () => {
    // Pressing play on the line you are already on has to re-fire the one-shot
    // action and restart the clip. Both are keyed off `beatKey`, because the
    // index did not move.
    const { result } = renderHook(() => useReplayDirector(buildReplayScript(SILENT)));
    const before = result.current?.beatKey ?? 0;
    act(() => result.current?.pause());
    act(() => result.current?.play());
    expect(result.current?.index).toBe(0);
    expect(result.current?.beatKey).toBeGreaterThan(before);
  });

  it('starts the second conversation at its own beginning', () => {
    /*
     * The wrong frame this prevents: opening a second replay and seeing the
     * last beat of the first — wrong pose, wrong caption, "3 of 3" over a
     * conversation that has not started. The reset happens during render, so
     * there is no commit in which the old state is on screen.
     *
     * A DIFFERENT conversation, by session id. The same conversation arriving
     * as a fresh object must NOT restart — see the note on `identity` — because
     * a caller that rebuilds its script on every render would otherwise get an
     * infinite reset instead of a performance.
     */
    const first = buildReplayScript(SILENT);
    const second = buildReplayScript(WITH_AUDIO);
    const { result, rerender } = renderHook(({ script }) => useReplayDirector(script), {
      initialProps: { script: first },
    });

    act(() => result.current?.jumpTo(2));
    expect(result.current?.index).toBe(2);

    rerender({ script: second });
    expect(result.current?.index).toBe(0);
    expect(result.current?.playing).toBe(true);
    expect(result.current?.finished).toBe(false);
  });

  it('is null when there is no conversation loaded', () => {
    // Distinct from a loaded conversation with no lines in it, which the layer
    // says something else about.
    const { result } = renderHook(() => useReplayDirector(null));
    expect(result.current).toBeNull();
  });
});
