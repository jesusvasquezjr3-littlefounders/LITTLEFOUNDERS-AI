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

/*
 * The smallest the tutor's own voice may RENDER at, once the depth scale has
 * had its say, in CSS pixels.
 *
 * `lf-action` (/DESIGN.md §Lumen -> Type) — the size a CONTROL is set at on
 * this layer, and therefore the floor under anything a learner is meant to
 * read over a moving render. `ScreenAnchor`'s own default is 12, which is
 * right for a two-word chip and wrong here twice over: the same section calls
 * 12 px on this layer "not a size, an apology" and has the stylesheet
 * neutralise `lf-caption` to stop it, and it calls this node "the largest type
 * on the stage after the character".
 *
 * A chip never reaches 12 anyway, because the 44 px tap floor stops it first.
 * Nobody presses a caption, so nothing stopped this one: measured on
 * `/dev/tutor-lab` at 375x812 with an adaptation question up, the two-shot's
 * stand-off clamped it to exactly 12.0 px — below a world chip's 13.7 — while
 * the same tutor's question, one plate below it in the dock, was 19 px.
 */
const MIN_SPEECH_PX = 15;

export function SpeechCaption({
  text,
  turnSeq,
  slot = 'lead.crown',
  className,
  instant = false,
}: SpeechCaptionProps) {
  const [shown, setShown] = useState('');
  const timerRef = useRef<number | null>(null);
  /*
   * ABOVE the crown, and OUT OF THE WAY of the fixed chrome.
   *
   * `place: 'above'` replaces the `w-0 h-0` wrapper this used to hang the plate
   * out of. That trick positioned correctly and measured as a POINT, so the
   * caption — the largest anchored surface on the route — had zero half-extents:
   * it was culled on its centre rather than on its box, and it had no box to
   * compare against anything else at all.
   *
   * `avoid` is the caption's alone on this route, and it is the answer to a
   * measured collision: at 375 px in `introducing` the plate landed at
   * (54, 31, 266, 68) and the way-out chip at (16, 16, 155, 44), so "Hi Robi!
   * I'm Dr." sat underneath the word "Leave" on three of three fresh mounts. It
   * may not be solved the way every other anchored surface solves being covered
   * — hiding — because this is the whole lesson for a deaf or hard-of-hearing
   * learner (/ORACLE.md §1 step 4). So it moves, by the smallest amount that
   * clears.
   */
  /*
   * `keepInFrame` is the other half of the same sentence, and it was missing.
   * `avoid` gets the caption out from under the fixed chrome; nothing got it out
   * from under the frame EDGE, so the ordinary cull ran instead. Measured on
   * `/dev/tutor-lab` at 1280x800 during `conversing`: the closeup fills the frame
   * with the tutor's face, the crown is above the top of the screen, and the
   * caption node was `hidden` and `inert` — the tutor's words on a desktop
   * existed only inside the lesson plate, and the plate rests CLOSED on a phone.
   * It now slides down to the edge and stays.
   */
  const anchorRef = useAnchorSlot(slot, {
    place: 'above',
    avoid: true,
    keepInFrame: true,
    minTextPx: MIN_SPEECH_PX,
  });

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
       * THE ANCHORED NODE IS THE CAPTION, box and all. It used to be a 0x0
       * wrapper with this column absolutely positioned up out of it — which put
       * the plate in the right place and told the projector the caption was a
       * point, so it was culled on its centre and could not be compared with
       * anything. `place: 'above'` moves that arithmetic into the projector,
       * where the node's measured height is already known, and leaves a real
       * rectangle behind for the cull test and the HUD escape to work on.
       *
       * The eight-pixel gap over the crown is the projector's now
       * (`HUD_SURFACE_GAP_PX`) and reads correctly whether the character fills
       * the frame or is standing across the island. The width is capped so a
       * long sentence wraps to a second line inside the plate instead of running
       * off both edges at 375 px, which `w-max` alone allows.
       *
       * `lf-speech` sits on THIS element rather than on the text inside,
       * because the projector reads this node's computed font size once at
       * registration to work out how far it may shrink the node before the
       * caption stops being readable. Put the type class deeper and it measures
       * the wrapper's inherited size instead, and the readability floor is
       * computed against a font nobody is reading.
       *
       * IT IS `lf-speech` AND NOT `lf-body` (/DESIGN.md §Lumen → Type). This is
       * the tutor talking, and until the token existed the tutor's own voice
       * was being set in the same 16/400 the product uses for a paragraph in a
       * settings page — which is why the largest thing said on a cinematic
       * stage read as chat copy. 19 px at 500, 21 from `sm:`, and it is the
       * biggest type on the stage after the character, which is the order the
       * two should be in.
       */
      className={cn(
        'lf-speech pointer-events-none fixed left-0 top-0 z-20 flex w-max max-w-[min(88vw,32rem)] flex-col items-center will-change-transform',
        className,
      )}
    >
      <HudPlate
        shape="plate"
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
        A short gradient tail down onto the crown. It is NOT a contrast scrim:
        the plate above is made of Lumen, whose alpha puts a FLOOR under the
        composite, so the ratio a moving render cannot give as a measurement it
        still gives as a bound (/DESIGN.md §Lumen). The tail's only job is
        attachment, so that at a two-shot the learner can see at a glance WHICH
        character the words belong to — and it is made of the scene's own shade
        rather than of `outline`, because it is the one part of the caption that
        actually touches the island.
      */}
      <span aria-hidden="true" className="lf-caption-tail h-6 w-0.5 rounded-full" />
    </div>
  );
}
