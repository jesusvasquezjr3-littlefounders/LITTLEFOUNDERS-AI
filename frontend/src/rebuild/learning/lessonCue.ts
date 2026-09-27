/**
 * The v2 lesson's answer cues (OD-28, owner review item L-02; B.26).
 *
 * A correct answer plays the product's success cue; a "not yet" plays the
 * gentle not-yet cue (synthesised in-house by
 * `scripts/synthesize-not-yet-sound.mjs`, zero spend), never an error buzzer.
 * The v2 lesson's feedback row and the Mentor's live activity both play it.
 * Only answer verdicts sound: an invalid or incomplete answer and a failed check
 * stay silent, and no cue is ever a celebration (D7).
 *
 * The rebuilt tree may not import the legacy sound modules (the UI boundary in
 * `check-product-spec.mjs`), so this file honours the same persisted off switch
 * the platform's sound module writes (`lf_sound_muted`) by reading it directly.
 * Fire-and-forget: autoplay refusals and missing assets are swallowed; a sound
 * is an enhancement, never information on its own.
 */
export type LessonCue = 'met' | 'review';

export const LESSON_CUE_SRC: Record<LessonCue, string> = {
  met: '/sounds/edu/success.mp3',
  review: '/sounds/edu/not_yet.wav',
};

/** The platform's one-shot audible level (0.15 x 0.5, as the v1 player). */
export const LESSON_CUE_VOLUME = 0.075;

const MUTE_KEY = 'lf_sound_muted';
const cache = new Map<string, HTMLAudioElement>();

export function lessonSoundMuted(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function playLessonCue(cue: LessonCue): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined' || lessonSoundMuted()) return;
  try {
    const src = LESSON_CUE_SRC[cue];
    let el = cache.get(src);
    if (!el) {
      el = new Audio(src);
      el.preload = 'auto';
      cache.set(src, el);
    }
    el.volume = LESSON_CUE_VOLUME;
    el.currentTime = 0;
    const started: unknown = el.play();
    if (started instanceof Promise) started.catch(() => {});
  } catch {
    // No audio here (jsdom, a blocked autoplay, a missing asset): stay silent.
  }
}
