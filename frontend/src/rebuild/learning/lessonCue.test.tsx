import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonFeedback } from './LessonFeedback';
import { LESSON_CUE_SRC } from './lessonCue';

/* OD-28 (L-02): a "not yet" gets its own gentle cue, never an error sound. */
const [NOT_YET, YES, CHECK, RETRY] = ['Not yet', 'Yes', 'Check', 'Retry'];
const played: string[] = [];

class FakeAudio {
  src: string;
  preload = '';
  volume = 1;
  currentTime = 0;
  constructor(src: string) { this.src = src; }
  play() { played.push(this.src); return Promise.resolve(); }
}

beforeEach(() => {
  played.length = 0;
  vi.stubGlobal('Audio', FakeAudio);
  window.localStorage.removeItem('lf_sound_muted');
});
afterEach(() => { vi.unstubAllGlobals(); window.localStorage.removeItem('lf_sound_muted'); });

describe('the v2 lesson answer cues', () => {
  it('a not-yet plays the gentle cue and a correct answer the success cue', () => {
    const view = render(<LessonFeedback verdict="review">{NOT_YET}</LessonFeedback>);
    expect(played).toEqual([LESSON_CUE_SRC.review]);
    view.rerender(<LessonFeedback verdict="met">{YES}</LessonFeedback>);
    expect(played).toEqual([LESSON_CUE_SRC.review, LESSON_CUE_SRC.met]);
  });

  it('never an error sound, and silent for an invalid answer or a failed check', () => {
    expect(Object.values(LESSON_CUE_SRC).some((src) => /error|fail|buzz|wrong/.test(src))).toBe(false);
    const view = render(<LessonFeedback verdict="invalid">{CHECK}</LessonFeedback>);
    view.rerender(<LessonFeedback verdict="unavailable">{RETRY}</LessonFeedback>);
    view.rerender(<LessonFeedback verdict={null} />);
    expect(played).toEqual([]);
  });

  it('honours the platform off switch', () => {
    window.localStorage.setItem('lf_sound_muted', '1');
    render(<LessonFeedback verdict="review">{NOT_YET}</LessonFeedback>);
    expect(played).toEqual([]);
  });
});
