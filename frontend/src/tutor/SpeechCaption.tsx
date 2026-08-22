import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AnchorId } from '@/tutor-scene/anchors';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { HudPlate } from './hud/HudPlate';

/*
 * The tutor's words, ABOVE the character's head.
 *
 * This is an accessibility requirement, not decoration (/ORACLE.md §1 step 4).
 * A deaf or hard-of-hearing learner must get the whole lesson, and a caption
 * that lives in a side panel makes them choose between watching the character
 * and reading what it said. Above the head, they are the same glance.
 *
 * IT IS AN HTML OVERLAY, NOT SCENE GEOMETRY. Text inside WebGL is a font-atlas
 * problem — glyph coverage for three locales, hinting, subpixel rendering,
 * scaling with the camera — and none of it buys anything here, because the
 * caption is always facing the viewer anyway. An absolutely-positioned div
 * over the canvas gets real text rendering, real text selection, real screen
 * reader output and real i18n for free.
 *
 * IT NOW RIDES THE SPEAKER'S OWN CROWN rather than the top edge of the layer,
 * and the crown is a PUBLISHED PLACE rather than an offset from the head. That
 * distinction is the whole fix: `lead.head` is the mid-head, so at a close-up
 * the crown is roughly 290 CSS px further up on a 1280 viewport and roughly 40
 * px further up at the establishing shot. Nudging the caption off the head by
 * any fixed number of pixels therefore puts it across the speaker's forehead in
 * exactly the shot a conversation spends most of its time in. Riding a point
 * the scene computes from the character's own height in metres makes the same
 * small CSS gap correct at every distance.
 * The previous version was `absolute inset-x-0 top-0`: correct while the stage
 * was a box with one character centred in it, and wrong the moment the stage
 * became the page, because the camera moves. A caption pinned to the viewport
 * while the subject travels ends up over the sky, over the sea, over the
 * lesson plate, or over the other character's face, and it never once points at
 * whoever is talking. The anchor channel projects a NAMED place in the scene
 * onto the viewport every frame and writes this node's transform directly, so
 * the caption stays attached through a swoop without React re-rendering once.
 *
 * WHAT DID NOT CHANGE, and must not: every aria attribute below. The live
 * region, the atomic announcement, the full sentence in an `sr-only` span
 * beside the aria-hidden typewriter, the reduced-motion instant reveal, and the
 * `turnSeq` dependency that replays a repeated sentence. The projection touches
 * layout; it must never touch semantics.
 *
 * The typewriter reveal is capped and interruptible: a caption that is still
 * typing when the next line arrives would fall behind the audio and stay
 * behind for the rest of the session.
 */

export interface SpeechCaptionProps {
  text: string | null;
  /** Bump when a NEW line starts, so the same text can replay. */
  turnSeq: number;
  /**
   * The named place the caption rides above.
   *
   * Defaults to the top of the speaking character's head. It is a prop rather
   * than a constant because the companion speaks in the replay director, and a
   * caption over the wrong character is worse than no caption at all.
   */
  slot?: AnchorId;
  className?: string;
  /** Skips the reveal animation. Respected from prefers-reduced-motion too. */
  instant?: boolean;
}

/** Fast enough to keep up with speech, slow enough to read as "being said". */
const CHARS_PER_TICK = 2;
const TICK_MS = 24;

export function SpeechCaption({
  text,
  turnSeq,
  slot = 'lead.crown',
  className,
  instant = false,
}: SpeechCaptionProps) {
  const [shown, setShown] = useState('');
  const timerRef = useRef<number | null>(null);
  const anchorRef = useAnchorSlot(slot);

  useEffect(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (!text) {
      setShown('');
      return;
    }

    const reduced =
      instant ||
      (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (reduced) {
      setShown(text);
      return;
    }

    let index = 0;
    setShown('');
    timerRef.current = window.setInterval(() => {
      index += CHARS_PER_TICK;
      setShown(text.slice(0, index));
      if (index >= text.length && timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, TICK_MS);

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // turnSeq is in the deps on purpose: the same sentence said twice must
    // replay, and text alone would not change.
  }, [text, turnSeq, instant]);

  if (!text) return null;

  return (
    <div
      ref={anchorRef}
      /*
       * A ZERO-SIZED node, and that is what makes "above the head" work. The
       * projector centres whatever it is given on the anchor point, so a plate
       * placed here directly would straddle the crown. A 0x0 box centres on
       * nothing; the plate inside it is then positioned upward from that point
       * in CSS, where the arithmetic is readable and the scene knows nothing
       * about it.
       *
       * `lf-body` sits on THIS element rather than on the text inside, because
       * the projector reads this node's computed font size once at registration
       * to work out how far it may shrink the node before the caption stops
       * being readable. Put the type class deeper and it measures the wrapper's
       * inherited size instead, and the readability floor is computed against a
       * font nobody is reading.
       */
      className={cn(
        'lf-body pointer-events-none fixed left-0 top-0 z-20 h-0 w-0 will-change-transform',
        className,
      )}
    >
      {/*
        A SMALL gap, not a guessed clearance. The anchor is already the top of
        the skull, so this is only the breathing room between the tail's tip and
        the hair, and the same eight pixels read correctly whether the character
        fills the frame or is standing across the island. The wrapper is capped
        so a long sentence wraps to a second line inside the plate instead of
        running off both edges at 375 px, which `w-max` alone allows.
      */}
      <div className="absolute bottom-2 left-1/2 flex w-max max-w-[min(88vw,32rem)] -translate-x-1/2 flex-col items-center">
        <HudPlate
          shape="plate"
          floor="surface"
          /*
           * aria-live="polite" and the FULL text, not the typewriter slice: a
           * screen reader must announce the sentence once, when it is complete,
           * not stutter through it two characters at a time.
           */
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none"
        >
          <span aria-hidden="true">{shown}</span>
          <span className="sr-only">{text}</span>
        </HudPlate>

        {/*
          A short gradient tail down onto the crown. It is NOT a contrast
          scrim: the plate above already stands on the opaque `bg-surface` floor
          (/DESIGN.md §Colors, the opaque floor rule), which is what makes the
          contrast ratio computable over a moving render in the first place. The
          tail's only job is attachment, so that at a two-shot the learner can
          see at a glance WHICH character the words belong to.
        */}
        <span
          aria-hidden="true"
          className="h-6 w-0.5 rounded-full bg-gradient-to-b from-outline to-transparent"
        />
      </div>
    </div>
  );
}
