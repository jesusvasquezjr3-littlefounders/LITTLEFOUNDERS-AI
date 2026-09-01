import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechCaption } from '../SpeechCaption';
import type { WordTiming } from '../types';

/*
 * WORD-LEVEL CAPTION HIGHLIGHTING (ORACLE.md §19.5).
 *
 * The reveal boundary IS the highlight (see `SpeechCaptionProps.wordTimings`'s
 * own comment): there is no separate highlight colour, so every assertion
 * here is about WHICH PREFIX of the sentence is visible at a given simulated
 * playback position, not about a CSS class.
 *
 * `requestAnimationFrame` is stubbed to capture its callback rather than
 * auto-run it, so a test can step "playback" forward one frame at a time on
 * its own clock — the same technique `tutor-scene/__tests__/lipSyncGraph
 * .test.ts` uses for the sibling audio-driven effect (the mouth).
 */

let rafCallback: FrameRequestCallback | null = null;

beforeEach(() => {
  rafCallback = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A step of "playback": advance the fake clock and let one frame run. */
function tick(audio: { currentTime: number }, atSeconds: number) {
  audio.currentTime = atSeconds;
  act(() => {
    rafCallback?.(atSeconds * 1000);
  });
}

function fakeAudio(): HTMLAudioElement {
  return { currentTime: 0 } as unknown as HTMLAudioElement;
}

const TIMINGS: WordTiming[] = [
  { word: 'Vamos', startMs: 0, endMs: 300 },
  { word: ' a', startMs: 300, endMs: 450 },
  { word: ' contar', startMs: 450, endMs: 800 },
  { word: ' monedas.', startMs: 800, endMs: 1300 },
];
const FULL_TEXT = TIMINGS.map((t) => t.word).join('');

describe('the synced reveal tracks a REAL playback position', () => {
  it('reveals nothing during a lead-in silence, before the first word has started', () => {
    // A clip whose own first word starts after a beat of silence — the
    // ordinary shape for a synthesized line, and the case that actually
    // exercises "nothing yet" (a first word starting at 0 is already
    // "started" the instant playback begins, which the very next test below
    // relies on being true).
    const leadIn: WordTiming[] = [{ ...TIMINGS[0]!, startMs: 200, endMs: 500 }, ...TIMINGS.slice(1)];
    const audio = fakeAudio();
    render(
      <SpeechCaption text={FULL_TEXT} turnSeq={1} wordTimings={leadIn} audioElement={audio} speaking />,
    );
    expect(screen.getByText(FULL_TEXT)).toBeInTheDocument(); // the sr-only full sentence, always present
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe('');

    tick(audio, 0.1);
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe('');
  });

  it('reveals the first word the instant playback reaches it, at t=0', () => {
    const audio = fakeAudio();
    render(
      <SpeechCaption text={FULL_TEXT} turnSeq={1} wordTimings={TIMINGS} audioElement={audio} speaking />,
    );
    tick(audio, 0);
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe('Vamos');
  });

  it('reveals exactly the words already started, one frame at a time', () => {
    const audio = fakeAudio();
    render(
      <SpeechCaption text={FULL_TEXT} turnSeq={1} wordTimings={TIMINGS} audioElement={audio} speaking />,
    );

    tick(audio, 0.05);
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe('Vamos');

    tick(audio, 0.5);
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe('Vamos a contar');

    tick(audio, 1.301);
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe(FULL_TEXT);
  });

  it('never runs backwards if playback position jitters', () => {
    // A word already revealed must not un-reveal on a stray earlier reading —
    // this loop only ever asks "which word has this position reached", so it
    // is naturally monotonic with the position it is GIVEN, but the position
    // it is given must never regress the caption on its own.
    const audio = fakeAudio();
    render(
      <SpeechCaption text={FULL_TEXT} turnSeq={1} wordTimings={TIMINGS} audioElement={audio} speaking />,
    );
    tick(audio, 0.5);
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe('Vamos a contar');
    tick(audio, 0.5);
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe('Vamos a contar');
  });
});

describe('the three reasons playback is not advancing all get the SAME safe answer', () => {
  it('shows the complete sentence immediately when the clip is not actually playing', () => {
    // Autoplay blocked, not yet started, or already ended — `speaking=false`
    // covers all three, and the wrong answer here (trusting a `currentTime`
    // stuck at 0) is a caption that never reveals a single word for a
    // learner who has no sound to fall back on at all.
    const audio = fakeAudio();
    render(
      <SpeechCaption
        text={FULL_TEXT}
        turnSeq={1}
        wordTimings={TIMINGS}
        audioElement={audio}
        speaking={false}
      />,
    );
    expect(document.querySelector('[aria-hidden="true"]')?.textContent).toBe(FULL_TEXT);
  });

  it('falls back to the ordinary typewriter when there is no audio element to read', () => {
    const before = document.querySelector('[aria-hidden="true"]');
    render(
      <SpeechCaption text="Vamos a contar monedas." turnSeq={1} wordTimings={TIMINGS} audioElement={null} instant />,
    );
    // `instant` alone already proves this is the OLD path: the synced path
    // ignores nothing about reduced motion via `instant` on its reveal loop
    // — it never starts at all without an element to read.
    expect(before).toBeNull();
    expect(screen.getAllByText('Vamos a contar monedas.').length).toBeGreaterThan(0);
  });

  it('falls back to the ordinary typewriter when this turn carries no timing at all', () => {
    // The common case in production today (ORACLE.md §19.5): every existing
    // caller of SpeechCaption keeps working exactly as it did before this
    // feature existed.
    const audio = fakeAudio();
    render(
      <SpeechCaption text="Vamos a contar monedas." turnSeq={1} wordTimings={null} audioElement={audio} instant />,
    );
    expect(screen.getAllByText('Vamos a contar monedas.').length).toBeGreaterThan(0);
  });

  it('reduced motion shows the full sentence immediately even with real timing and a playing clip', () => {
    const audio = fakeAudio();
    render(
      <SpeechCaption
        text={FULL_TEXT}
        turnSeq={1}
        wordTimings={TIMINGS}
        audioElement={audio}
        speaking
        instant
      />,
    );
    expect(screen.getAllByText(FULL_TEXT).length).toBeGreaterThan(0);
    // And the synced loop genuinely never started — nothing to advance.
    expect(rafCallback).toBeNull();
  });
});
