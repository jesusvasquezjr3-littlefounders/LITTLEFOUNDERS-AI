import { useSyncExternalStore } from 'react';

/*
 * WHY THIS EXISTS, AND WHY IT DOES NOT TOUCH WHETHER THE CAPTION SHOWS.
 *
 * The caption above the speaker's head is an accessibility requirement, not
 * decoration (/ORACLE.md §1 step 4 — see `SpeechCaption.tsx`'s own doctrine):
 * a deaf or hard-of-hearing learner has no other channel for the lesson. A
 * product "closed captions" toggle that can turn it OFF would break that
 * guarantee for exactly the learner it exists for, so there is no such
 * toggle here — only a SIZE preference, which every real captioning system
 * (broadcast, YouTube, the OS) also exposes as separate from on/off.
 *
 * A PLAIN MODULE, LIKE `lib/sound.ts`'s MUTE FLAG, NOT A PROP THREADED
 * THROUGH THREE LAYER INTERFACES. `SpeechCaption` is mounted from
 * `ConversationView`, `OfferChips` and `ReplayInWorld` — three different
 * `*LayerProps` shapes with three different owners in `TutorExperience.tsx`
 * — and the preference is the same everywhere a learner opens the Tutor. A
 * device-level flag `lib/sound.ts` already reads directly is the established
 * shape for exactly this kind of setting in this codebase; threading it
 * through three prop interfaces would make every layer's props type lie
 * about depending on something none of them otherwise touch.
 */
const KEY = 'lf.tutor.captionLarge';

function readLarge(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let large = readLarge();
const listeners = new Set<() => void>();

/** The learner's current caption-size preference. Safe to call anywhere, anytime. */
export function isCaptionLarge(): boolean {
  return large;
}

/** Sets the preference and remembers it for the next visit. */
export function setCaptionLarge(next: boolean): void {
  if (large === next) return;
  large = next;
  try {
    window.localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    // Private browsing, a blocked origin, a full quota — the session still honours it.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive read — re-renders the caller the moment the toggle changes, wherever it was pressed. */
export function useCaptionLarge(): boolean {
  return useSyncExternalStore(subscribe, isCaptionLarge, () => false);
}
