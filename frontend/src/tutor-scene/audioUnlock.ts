/*
 * BROWSERS DO NOT LET A PAGE MAKE NOISE UNTIL SOMEBODY TOUCHES IT.
 *
 * That rule and this product disagree by design: the Tutor's whole opening is
 * the character speaking FIRST, before the learner has done anything. So the
 * greeting's `play()` is rejected, every time, on every browser, for every
 * learner — and the rejection was being swallowed. The mouth closed, nothing
 * was said, and nothing anywhere reported that the product's headline feature
 * had just been refused by the platform.
 *
 * The fix is the standard one and it has to happen EARLY: the first time the
 * learner touches the page for any reason — a tap, a key, a pointer down —
 * play a silent clip through the same element the tutor will use. That single
 * successful play is what grants the element permission for the rest of the
 * page's life, so the tutor's next line is audible even though the gesture had
 * nothing to do with sound.
 *
 * WHY A SILENT CLIP AND NOT "just call play() again later". Permission is
 * granted to the ELEMENT, at the moment of a gesture, and only if a play is
 * actually attempted then. Waiting for the next turn and retrying is too late:
 * by then the gesture is over and the browser refuses again.
 *
 * WHY IT MUST ALSO REPORT. An unlock can still fail — an iOS low-power mode, a
 * hard autoplay block, a muted device. A tutor that is silently silent looks
 * broken and teaches the learner nothing; one that says "tap to turn sound on"
 * is a product. `onBlocked` is how the stage tells the shell to say so.
 */

/** 45 ms of digital silence, as a WAV. Small enough to inline, real enough to play. */
const SILENCE =
  'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAAAAAAAAAAAAAAAAAAAAAA==';

/** Events that count as a gesture. `pointerdown` covers mouse, touch and pen. */
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

let unlocked = false;

/** Whether this page has already earned the right to make noise. */
export function audioIsUnlocked(): boolean {
  return unlocked;
}

/** Test seam. Production never calls this. */
export function resetAudioUnlockForTests(): void {
  unlocked = false;
}

/**
 * Arms a one-shot unlock on the next user gesture.
 *
 * Returns a teardown. Safe to call repeatedly: once unlocked it is a no-op, so
 * a remounting stage does not accumulate listeners.
 */
export function armAudioUnlock(element: HTMLAudioElement | null): () => void {
  if (unlocked || !element || typeof window === 'undefined') return () => {};

  let disposed = false;

  const attempt = () => {
    if (disposed || unlocked) return;
    /*
     * The element's OWN src is saved and restored. Priming with a different
     * source and leaving it there would make the next turn's `src` assignment
     * a change the browser reloads from scratch, adding a stall to the first
     * real line — the one place a delay is most visible.
     */
    const previous = element.src;
    const wasMuted = element.muted;
    element.muted = true;
    element.src = SILENCE;

    void element
      .play()
      .then(() => {
        unlocked = true;
        teardown();
      })
      .catch(() => {
        // Still refused. Leave the listeners armed: a later gesture may work,
        // and the shell has already been told to offer a sound button.
      })
      .finally(() => {
        element.pause();
        element.muted = wasMuted;
        // '' rather than the previous empty string: assigning src='' makes some
        // browsers fetch the page itself as media and log a decode error.
        if (previous) element.src = previous;
        else element.removeAttribute('src');
      });
  };

  for (const type of GESTURES) {
    window.addEventListener(type, attempt, { capture: true, passive: true });
  }

  function teardown(): void {
    disposed = true;
    for (const type of GESTURES) {
      window.removeEventListener(type, attempt, { capture: true });
    }
  }

  return teardown;
}
